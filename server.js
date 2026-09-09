#!/usr/bin/env node
// server.js — static files + POST /api/judge for laptop + phones on the same Wi-Fi.
// Node 22 built-ins only. CommonJS. Run: `npm start` (needs ANTHROPIC_API_KEY) or `npm run mock`.
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { handleJudgeRequest, LIMITS, DEFAULT_MODEL } = require('./lib/judge');

const ROOT = __dirname;

// ---- .env loader (tiny parser; never overrides existing env) ----------------
function loadDotEnv(file = path.join(ROOT, '.env')) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    else val = val.replace(/\s+#.*$/, '').trim(); // strip trailing "  # comment"
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ---- static serving --------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json', '.webmanifest': 'application/manifest+json',
};
// Never serve server-side sources or dotfiles, even though they hold no secrets.
// Case-insensitive: macOS/Windows filesystems would otherwise serve /LIB/judge.js.
const PRIVATE = /^\/(lib|netlify|api|functions|test|node_modules)(\/|$)|^\/(server\.js|package(-lock)?\.json|netlify\.toml|vercel\.json)$/i;

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src https://fonts.gstatic.com; img-src 'self' data: https://image.pollinations.ai; connect-src 'self'";

function sendJson(res, status, body) {
  const s = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(s),
    'Cache-Control': 'no-store',
  });
  res.end(s);
}

async function serveStatic(req, res, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return sendJson(res, 400, { error: 'Bad path' }); }
  // A percent-encoded backslash (%5c) survives URL parsing; on Windows path.resolve would treat it
  // as a separator, so "/decks%5c..%5cserver.js" could slip past the checks below. Refuse outright.
  if (decoded.includes('\0') || decoded.includes('\\')) return sendJson(res, 404, { error: 'Not found' });
  // Run the deny-list on the NORMALISED path so "/x/../lib/judge.js" style inputs can't dodge it.
  const norm = path.posix.normalize('/' + decoded);
  if (PRIVATE.test(norm) || norm.split('/').some(seg => seg.startsWith('.')))
    return sendJson(res, 404, { error: 'Not found' });

  // Resolve and make sure we are still inside ROOT (path traversal guard).
  const abs = path.resolve(ROOT, '.' + norm);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return sendJson(res, 404, { error: 'Not found' });

  let file = abs, st;
  try {
    st = await fsp.stat(file);
    if (st.isDirectory()) {
      if (norm !== '/') return sendJson(res, 404, { error: 'Not found' }); // no directory listing
      file = path.join(ROOT, 'index.html');
      st = await fsp.stat(file);
    }
  } catch { return sendJson(res, 404, { error: 'Not found' }); }

  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext];
  if (!type) return sendJson(res, 404, { error: 'Not found' });
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': st.size, // so HEAD is meaningful and GET isn't chunked
    'Cache-Control': ext === '.html' || ext === '.js' || ext === '.css' ? 'no-cache' : 'public, max-age=3600',
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

// ---- crude per-IP limiter for /api (laptop server only) ----------------------
const RATE = { windowMs: 60_000, max: 40 };
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const h = hits.get(ip) || { start: now, n: 0 };
  if (now - h.start > RATE.windowMs) { h.start = now; h.n = 0; }
  h.n += 1; hits.set(ip, h);
  if (hits.size > 1000) hits.clear();
  return h.n > RATE.max;
}

function readBody(req, limit) {
  // On overflow: reject early but keep draining (do NOT req.destroy() — that kills the
  // socket before the 413 response is flushed and the client sees "fetch failed").
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0, over = false;
    req.on('data', c => {
      if (over) return;
      size += c.length;
      if (size > limit) { over = true; reject(Object.assign(new Error('too large'), { code: 413 })); }
      else chunks.push(c);
    });
    req.on('end', () => { if (!over) resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

// ---- server factory (exported for tests) ------------------------------------
function createServer() {
  return http.createServer(async (req, res) => {
    try {
      // Inside the try: a request-target like "GET //[ HTTP/1.1" makes `new URL` throw, and an
      // uncaught throw in an async listener is an unhandled rejection that kills the whole server.
      let url;
      try { url = new URL(req.url, 'http://x'); } catch { return sendJson(res, 400, { error: 'Bad URL' }); }
      if (url.pathname === '/api/judge') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST' });
        if (rateLimited(req.socket.remoteAddress || '?')) return sendJson(res, 429, { error: 'Slow down — too many rounds per minute' });
        let raw;
        try { raw = await readBody(req, LIMITS.MAX_BODY_BYTES); }
        catch (e) { return sendJson(res, e.code === 413 ? 413 : 400, { error: e.code === 413 ? 'Request too large' : 'Bad request' }); }
        const { status, body } = await handleJudgeRequest({ method: 'POST', rawBody: raw });
        return sendJson(res, status, body);
      }
      if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Unknown API route' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' });
      return serveStatic(req, res, url.pathname);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) sendJson(res, 500, { error: 'Server error' });
    }
  });
}

function lanUrls(port) {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal) out.push(`http://${n.address}:${port}`);
  }
  return out;
}

if (require.main === module) {
  loadDotEnv();
  if (process.argv.includes('--mock')) process.env.MOCK_AI = '1';
  const mock = process.env.MOCK_AI === '1';
  if (!mock && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      '\nMissing ANTHROPIC_API_KEY.\n' +
      '  • put it in a .env file next to server.js (see .env.example), or\n' +
      '  • export it in your shell, or\n' +
      '  • run `npm run mock` (node server.js --mock) to play with a fake judge.\n',
    );
    process.exit(1);
  }
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  createServer().listen(port, host, () => {
    console.log(`\n🪿 Gaggle ${mock ? '(MOCK judge — no AI, no key)' : `(model ${process.env.ANTHROPIC_MODEL || DEFAULT_MODEL})`}`);
    console.log(`  Local:   http://localhost:${port}`);
    for (const u of lanUrls(port)) console.log(`  Phones:  ${u}   ← same Wi-Fi`);
    console.log('\nIf phones cannot connect: allow Node through the laptop firewall, and avoid guest Wi-Fi (client isolation).\n');
  });
}

module.exports = { createServer, loadDotEnv, lanUrls };
