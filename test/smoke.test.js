'use strict';
// Smoke + contract tests. No network, no API key. Run with `npm test` (node --test).
process.env.MOCK_AI = '1';
process.env.MOCK_DELAY_MS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, loadDotEnv, lanUrls } = require('../server');
const {
  judge, imageUrl, validateRequest, handleJudgeRequest, JudgeError, LIMITS,
  buildPrompts, extractJson, distinctScores, HITS, BADGES, DEFAULT_MODEL,
} = require('../lib/judge');

const FENCE = '`'.repeat(3);
const CARDS = ['Penguins', 'At a Funeral Service'];
const PARTY = [
  { name: 'Priya', answer: 'a bruising of avocados' },
  { name: 'Tom', answer: 'a guac of avocados' },
  { name: 'Sam', answer: 'a guacward of avocados' },
  { name: 'Lee', answer: 'a stone of avocados' },
];

let base, server;
test.before(async () => {
  server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const post = (path, body, raw) => fetch(base + path, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: raw !== undefined ? raw : JSON.stringify(body),
});

function assertContractShape(d, names) {
  assert.ok(Array.isArray(d.results) && d.results.length === names.length);
  d.results.forEach((r, i) => {
    assert.equal(r.name, names[i]);
    assert.equal(typeof r.answer, 'string');
    assert.ok(Array.isArray(r.hits) && r.hits.every(h => HITS.includes(h)), 'hits subset');
    assert.ok(Number.isInteger(r.score) && r.score >= 1 && r.score <= 10, 'score 1-10');
    assert.ok(typeof r.verdict === 'string' && r.verdict.length > 0 && r.verdict.length <= 40, 'verdict ≤40');
    assert.ok(typeof r.comment === 'string' && r.comment.length > 0 && r.comment.length <= 160, 'comment ≤160');
    assert.ok(BADGES.includes(r.badge), 'badge in set');
  });
  assert.ok(names.includes(d.winner), 'winner is a player');
  const top = Math.max(...d.results.map(r => r.score));
  assert.equal(d.results.find(r => r.name === d.winner).score, top, 'winner has top score');
  assert.equal(typeof d.bot.answer, 'string');
  assert.match(d.bot.answer, / of /);
  assert.ok(Number.isInteger(d.bot.score) && d.bot.score >= 1 && d.bot.score <= 10);
  assert.ok(d.imageUrl.startsWith('https://image.pollinations.ai/prompt/'), 'one pollinations imageUrl');
  assert.equal(typeof d.model, 'string');
  assert.equal(typeof d.mock, 'boolean');
}

// ---------------------------------------------------------------------------
// Static server
// ---------------------------------------------------------------------------
test('serves index.html at / with html mime + CSP allowing pollinations', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.match(r.headers.get('content-security-policy'), /img-src [^;]*https:\/\/image\.pollinations\.ai/);
  assert.match(r.headers.get('content-security-policy'), /connect-src 'self'(;|$)/);
  assert.match(await r.text(), /<title>[^<]*Gaggle/i);
});

test('correct mime for css/js/json', async () => {
  assert.match((await fetch(base + '/style.css')).headers.get('content-type'), /text\/css/);
  assert.match((await fetch(base + '/script.js')).headers.get('content-type'), /javascript/);
  assert.match((await fetch(base + '/decks/nouns/animals.json')).headers.get('content-type'), /application\/json/);
});

test('blocks traversal, dotfiles, private dirs, directory listing', async () => {
  for (const p of ['/../.env', '/..%2f..%2fetc%2fpasswd', '/.env', '/.git/config', '/lib/judge.js', '/lib',
                   '/server.js', '/package.json', '/netlify.toml', '/vercel.json', '/test/smoke.test.js',
                   '/api/judge.js', '/netlify/functions/judge.js', '/decks/', '/decks/nouns', '/nope.html']) {
    const r = await fetch(base + p);
    assert.equal(r.status, 404, p);
  }
});

test('backslash / case-variant / dot-segment paths are 404, never a leak', async () => {
  for (const p of ['/decks%5c..%5cserver.js', '/decks%5C..%5C.env', '/LIB/judge.js', '/SERVER.JS', '/Package.json',
                   '/index.html/../lib/judge.js', '/decks/%2e%2e/server.js', '/%2e%2e/%2e%2e/etc/passwd', '/.git/HEAD', '/%00']) {
    assert.equal((await fetch(base + p)).status, 404, p);
  }
});

test('HEAD returns headers + Content-Length and no body; GET Content-Length matches file size', async () => {
  const size = fs.statSync(path.join(__dirname, '..', 'decks', 'nouns', 'animals.json')).size;
  const h = await fetch(base + '/decks/nouns/animals.json', { method: 'HEAD' });
  assert.equal(h.status, 200);
  assert.equal(Number(h.headers.get('content-length')), size);
  assert.equal((await h.arrayBuffer()).byteLength, 0);
  const g = await fetch(base + '/decks/nouns/animals.json');
  assert.equal(Number(g.headers.get('content-length')), size);
  assert.equal((await g.arrayBuffer()).byteLength, size);
});

test('malformed request-target ("GET //[") gets a 400 and does NOT kill the server', async () => {
  const raw = await new Promise((resolve, reject) => {
    const sock = net.connect(server.address().port, '127.0.0.1', () => sock.write('GET //[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
    let buf = ''; sock.on('data', d => { buf += d; }); sock.on('end', () => resolve(buf)); sock.on('error', reject);
  });
  assert.match(raw, /^HTTP\/1\.1 400/);
  assert.equal((await fetch(base + '/')).status, 200, 'server still alive');
});

test('405 on GET /api/judge, 404 on unknown api, 413 on huge body, 405 on PUT static', async () => {
  assert.equal((await fetch(base + '/api/judge')).status, 405);
  assert.equal((await fetch(base + '/api/nope')).status, 404);
  assert.equal((await post('/api/judge', null, '{"a":"' + 'x'.repeat(20000) + '"}')).status, 413);
  assert.equal((await fetch(base + '/', { method: 'PUT' })).status, 405);
});

// ---------------------------------------------------------------------------
// POST /api/judge in mock mode
// ---------------------------------------------------------------------------
test('POST /api/judge returns contract shape in mock mode (party of 3, distinct scores)', async () => {
  const r = await post('/api/judge', { cards: CARDS,
    answers: [{ name: 'Ade', answer: 'a tuxedo of penguins' }, { name: 'Mum', answer: 'a wake of penguins' }, { name: 'Dad', answer: 'a bunch' }],
    spicy: true });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.mock, true);
  assertContractShape(d, ['Ade', 'Mum', 'Dad']);
  assert.equal(new Set(d.results.map(x => x.score)).size, 3, 'distinct scores');
  assert.equal(d.results[0].answer, 'a tuxedo of penguins');
  assert.ok(d.results.every(x => !('imageUrl' in x)), 'imageUrl is per round, not per result');
});

test('single player in mock mode', async () => {
  const r = await post('/api/judge', { cards: CARDS, answers: [{ name: 'Ade', answer: 'a tuxedo of penguins' }] });
  assert.equal(r.status, 200);
  const d = await r.json();
  assertContractShape(d, ['Ade']);
  assert.equal(d.winner, 'Ade');
  assert.match(d.bot.answer, /^a mock-ery of penguins$/);
});

test('mock: party of 8 identical answers still yields 8 distinct scores', async () => {
  const answers = Array.from({ length: 8 }, (_, i) => ({ name: 'P' + i, answer: 'a bunch of penguins' }));
  const d = await (await post('/api/judge', { cards: CARDS, answers })).json();
  const scores = d.results.map(r => r.score);
  assert.equal(new Set(scores).size, 8);
  assert.ok(scores.every(s => s >= 1 && s <= 10));
  assert.equal(d.winner, 'P0', 'earlier player keeps the higher score on ties');
});

test('mock: scores spread across the scale, hits consistent with band', async () => {
  const answers = ['a wake', 'a tuxedo', 'a waddle', 'a colony', 'a black-tie', 'a pallbearing', 'a sad', 'a mourning']
    .map((a, i) => ({ name: 'N' + i, answer: `${a} of penguins` }));
  const d = await (await post('/api/judge', { cards: CARDS, answers })).json();
  const scores = d.results.map(r => r.score);
  assert.ok(Math.max(...scores) - Math.min(...scores) >= 5, 'scores are spread: ' + scores);
  assert.ok(new Set(d.results.map(r => r.verdict)).size >= 3, 'varied verdicts');
  for (const r of d.results) {
    assert.ok(r.comment.includes(r.answer), 'comment quotes the answer');
    const n = r.hits.length;
    if (n === 0) assert.ok(r.score <= 3);
    if (n === 4) assert.ok(r.score >= 9);
  }
});

test('mock scores are deterministic', async () => {
  const body = { cards: ['Cats'], answers: [{ name: 'A', answer: 'a purr' }] };
  const a = await (await post('/api/judge', body)).json();
  const b = await (await post('/api/judge', body)).json();
  assert.deepEqual(a, b);
});

test('empty answer is accepted (party players may skip) and scores 1', async () => {
  const r = await post('/api/judge', { cards: CARDS, answers: [{ name: 'Ade', answer: '' }, { name: 'Mum', answer: 'a wake of penguins' }] });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.results[0].answer, '');
  assert.equal(d.results[0].score, 1);
  assert.equal(d.results[0].badge, 'lazy');
  assert.equal(d.winner, 'Mum');
  const solo = await post('/api/judge', { cards: CARDS, answers: [{ answer: '   ' }] });
  assert.equal(solo.status, 200);
});

test('party of 8 OK, 9 rejected', async () => {
  const mk = n => Array.from({ length: n }, (_, i) => ({ name: 'p' + i, answer: 'x' + i }));
  assert.equal((await post('/api/judge', { cards: CARDS, answers: mk(8) })).status, 200);
  assert.equal((await post('/api/judge', { cards: CARDS, answers: mk(9) })).status, 400);
});

test('input guards -> 400 with {error}', async () => {
  const cases = [
    { cards: [], answers: [{ answer: 'x' }] },
    { cards: ['a'], answers: [] },
    { cards: ['a'], answers: 'nope' },
    { cards: ['a'], answers: [{ answer: 'y'.repeat(81) }] },
    { cards: ['a', 'b', 'c', 'd'], answers: [{ answer: 'x' }] },
    { cards: ['   '], answers: [{ answer: 'x' }] },
    [],
    'string',
  ];
  for (const c of cases) {
    const r = await post('/api/judge', c);
    assert.equal(r.status, 400, JSON.stringify(c));
    assert.equal(typeof (await r.json()).error, 'string');
  }
  assert.equal((await post('/api/judge', null, '{not json')).status, 400);
});

// ---------------------------------------------------------------------------
// lib/judge.js units
// ---------------------------------------------------------------------------
test('validateRequest: defaults names, dedupes, trims, keeps empties, throws JudgeError(400)', () => {
  assert.throws(() => validateRequest({}), e => e instanceof JudgeError && e.status === 400);
  const v = validateRequest({ cards: [' Penguins ', 'At a Wedding'], answers: [
    { answer: '  a   tuxedo ' }, { name: 'Ade', answer: '' }, { name: 'ade', answer: 'x' }, 'bare string', { name: 'x'.repeat(40), answer: 'y' },
  ], spicy: 'yes' });
  assert.deepEqual(v.cards, ['Penguins', 'At a Wedding']);
  assert.equal(v.spicy, false);
  assert.deepEqual(v.answers.map(a => a.name), ['Player 1', 'Ade', 'ade 2', 'Player 4', 'x'.repeat(24)]);
  assert.deepEqual(v.answers.map(a => a.answer), ['a tuxedo', '', 'x', 'bare string', 'y']);
  assert.ok(v.answers.every(a => a.name.length <= LIMITS.MAX_NAME_LEN));
});

test('imageUrl is pure, encoded, seeded, ≤300-char prompt, prefers image_idea', () => {
  const u = imageUrl({ cards: ['Penguins', 'at a wedding'], answer: 'a tuxedo & tails', seed: 42 });
  assert.match(u, /^https:\/\/image\.pollinations\.ai\/prompt\/[^?]+\?width=512&height=512&nologo=true&seed=42$/);
  assert.ok(!u.includes('&tails'), 'ampersand in the prompt was encoded');
  assert.equal(u, imageUrl({ cards: ['Penguins', 'at a wedding'], answer: 'a tuxedo & tails', seed: 42 }));
  const auto = imageUrl({ cards: ['Penguins', 'at a wedding'], answer: 'a tuxedo of penguins' });
  assert.match(auto, /seed=\d{1,5}$/);
  assert.equal(auto, imageUrl({ cards: ['Penguins', 'at a wedding'], answer: 'a tuxedo of penguins' }), 'seed is deterministic');
  const prompt = decodeURIComponent(new URL(auto).pathname.slice('/prompt/'.length));
  assert.ok(prompt.length <= 300);
  assert.match(prompt, /no text/);
  const withIdea = imageUrl({ cards: ['Penguins', 'at a wedding'], answer: 'a tuxedo', imageIdea: 'penguins in tiny tuxedos throwing confetti' });
  assert.match(decodeURIComponent(withIdea), /^https:\/\/image\.pollinations\.ai\/prompt\/penguins in tiny tuxedos throwing confetti, cute cartoon/);
  const long = imageUrl({ cards: ['x'], answer: 'y', imageIdea: 'z'.repeat(500) });
  assert.ok(decodeURIComponent(new URL(long).pathname.slice('/prompt/'.length)).length <= 300);
});

test('loadDotEnv: export prefix, quotes, "=" in value, CRLF, comments, never overrides existing env', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gaggle-env-'));
  const file = path.join(dir, '.env');
  const keys = ['GAGGLE_T_A', 'GAGGLE_T_B', 'GAGGLE_T_C', 'GAGGLE_T_D', 'GAGGLE_T_E', 'GAGGLE_T_F', 'GAGGLE_T_G', 'GAGGLE_T_H'];
  try {
    process.env.GAGGLE_T_H = 'keep';
    fs.writeFileSync(file, [
      '# comment', '', 'export GAGGLE_T_A=', 'GAGGLE_T_B="a # b"', "GAGGLE_T_C='sq'", 'GAGGLE_T_D=x=y=z',
      'GAGGLE_T_E=sk-ant-abc#notacomment   # trailing comment', '  GAGGLE_T_F  =  spaced  ', 'GAGGLE_T_G=crlf', 'GAGGLE_T_H=override', 'NOEQUALS',
    ].join('\r\n'));
    loadDotEnv(file);
    assert.equal(process.env.GAGGLE_T_A, '');
    assert.equal(process.env.GAGGLE_T_B, 'a # b');
    assert.equal(process.env.GAGGLE_T_C, 'sq');
    assert.equal(process.env.GAGGLE_T_D, 'x=y=z');
    assert.equal(process.env.GAGGLE_T_E, 'sk-ant-abc#notacomment');
    assert.equal(process.env.GAGGLE_T_F, 'spaced');
    assert.equal(process.env.GAGGLE_T_G, 'crlf');
    assert.equal(process.env.GAGGLE_T_H, 'keep');
    assert.ok(!('NOEQUALS' in process.env));
    assert.doesNotThrow(() => loadDotEnv(path.join(dir, 'missing.env')));
  } finally {
    for (const k of keys) delete process.env[k];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('lanUrls: only non-internal IPv4 http URLs with the port', () => {
  for (const u of lanUrls(3000)) assert.match(u, /^http:\/\/(?!127\.)\d{1,3}(\.\d{1,3}){3}:3000$/);
});

test('distinctScores: keeps rank order and stays inside 1..10 for 8 clustered players', () => {
  const mk = scores => scores.map((score, i) => ({ name: 'p' + i, score }));
  const low = distinctScores(mk([1, 1, 1, 1, 1, 1, 1, 1]));
  assert.deepEqual(low.map(r => r.score), [8, 7, 6, 5, 4, 3, 2, 1]);
  const high = distinctScores(mk([10, 10, 10, 10, 10, 10, 10, 10]));
  assert.deepEqual(high.map(r => r.score), [10, 9, 8, 7, 6, 5, 4, 3]);
  const mixed = distinctScores(mk([7, 9, 7, 2, 9]));
  assert.deepEqual(mixed.map(r => r.score), [7, 9, 6, 2, 8]); // ties: earlier keeps higher
  const fine = distinctScores(mk([3, 9, 6]));
  assert.deepEqual(fine.map(r => r.score), [3, 9, 6]); // already distinct: untouched
  // A tie between an empty answer (submitted first) and a real one: the real answer stays on top.
  const tie = distinctScores([{ name: 'e', answer: '', score: 1 }, { name: 'r', answer: 'a wake', score: 1 }]);
  assert.deepEqual(tie.map(r => r.score), [1, 2]);
});

test('extractJson tolerates fences and prose, returns null on garbage', () => {
  assert.deepEqual(extractJson(FENCE + 'json\n{"a":1}\n' + FENCE), { a: 1 });
  assert.deepEqual(extractJson('Sure! Here you go:\n{"a":{"b":2}}\nHope that helps.'), { a: { b: 2 } });
  assert.equal(extractJson('no json here'), null);
  assert.equal(extractJson(''), null);
});

test('buildPrompts: single prompt for 1 answer, party prompt for ≥2, token budgets', () => {
  const one = buildPrompts({ cards: CARDS, answers: [{ name: 'A', answer: 'x' }], spicy: false });
  assert.equal(one.mode, 'single');
  assert.match(one.user, /PLAYER ANSWER: "x"/);
  assert.ok(!one.user.includes('PLAYER ANSWERS'));
  assert.equal(one.maxTokens, 350);
  const two = buildPrompts({ cards: CARDS, answers: [{ name: 'A', answer: 'x' }, { name: 'B', answer: 'y' }], spicy: true });
  assert.equal(two.mode, 'party');
  assert.match(two.user, /PLAYER ANSWERS:\n1\. "A": "x"\n2\. "B": "y"/);
  assert.match(two.user, /MODE: spicy/);
  assert.equal(two.maxTokens, 460);
  const eight = buildPrompts({ cards: CARDS, answers: Array.from({ length: 8 }, () => ({ name: 'n', answer: 'a' })) });
  assert.equal(eight.maxTokens, 1180);
  assert.match(one.system, /GAGGLE/);
});

// ---------------------------------------------------------------------------
// judge() against a fake fetch (real path, no network)
// ---------------------------------------------------------------------------
const single = { cards: CARDS, answers: [{ name: 'Ade', answer: 'a tuxedo of penguins' }], spicy: false };
const reply = (obj, extra = {}) => async () => ({
  ok: true, status: 200,
  json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }], ...extra }),
});
const SINGLE_REPLY = { hits: ['pun', 'image'], score: 6, verdict: 'Dressed For The Wrong Room', comment: '"a tuxedo" looks the part.', badge: 'wholesome',
  bot_answer: 'a pallbearing of penguins', bot_score: 8, image_idea: 'penguins in tuxedos carrying a coffin' };

test('judge() without key and without mock -> 500, never calls network', async () => {
  await assert.rejects(
    judge(single, { mock: false, apiKey: undefined, fetch: () => { throw new Error('must not be called'); } }),
    e => e instanceof JudgeError && e.status === 500);
});

test('judge() error mapping: 504 timeout, 429, 503 overloaded, 500 bad key, 500 model 404, 502 refusal/garbage', async () => {
  const hang = (_u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  await assert.rejects(judge(single, { mock: false, apiKey: 'k', timeoutMs: 20, fetch: hang }), e => e.status === 504);
  const httpErr = status => async () => ({ ok: false, status, json: async () => ({ error: { message: 'm' } }) });
  await assert.rejects(judge(single, { mock: false, apiKey: 'k', fetch: httpErr(429) }), e => e.status === 429);
  await assert.rejects(judge(single, { mock: false, apiKey: 'k', fetch: httpErr(529) }), e => e.status === 503);
  await assert.rejects(judge(single, { mock: false, apiKey: 'k', fetch: httpErr(401) }), e => e.status === 500);
  await assert.rejects(judge(single, { mock: false, apiKey: 'k', fetch: httpErr(404) }), e => e.status === 500 && /model/.test(e.message));
  await assert.rejects(judge(single, { mock: false, apiKey: 'k', fetch: httpErr(400) }), e => e.status === 500);
  await assert.rejects(judge(single, { mock: false, apiKey: 'k', fetch: async () => { throw new Error('ECONNRESET'); } }), e => e.status === 502);
  await assert.rejects(judge(single, { mock: false, apiKey: 'k', fetch: reply(SINGLE_REPLY, { stop_reason: 'refusal' }) }), e => e.status === 502);
  await assert.rejects(judge(single, { mock: false, apiKey: 'k', fetch: reply(SINGLE_REPLY, { stop_reason: 'max_tokens' }) }), e => e.status === 502);
  await assert.rejects(judge(single, { mock: false, apiKey: 'k', fetch: reply('I refuse to answer in JSON.') }), e => e.status === 502);
});

test('judge() single: request shape (model, temperature, single prompt) and normalised response', async () => {
  let captured;
  const spy = async (url, init) => {
    captured = { url, headers: init.headers, body: JSON.parse(init.body) };
    return reply(FENCE + 'json\n' + JSON.stringify(SINGLE_REPLY) + '\n' + FENCE)();
  };
  const out = await judge(single, { mock: false, apiKey: 'sk-test', fetch: spy });
  assert.equal(captured.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(captured.headers['x-api-key'], 'sk-test');
  assert.equal(captured.headers['anthropic-version'], '2023-06-01');
  assert.equal(captured.body.model, DEFAULT_MODEL);
  assert.equal(captured.body.temperature, 0.7);
  assert.equal(captured.body.max_tokens, 350);
  assert.equal(typeof captured.body.system, 'string');
  assert.equal(captured.body.messages.length, 1);
  assert.match(captured.body.messages[0].content, /PLAYER ANSWER: "a tuxedo of penguins"/);
  assert.ok(!captured.body.messages[0].content.includes('PLAYER ANSWERS'));
  assert.ok(!('output_config' in captured.body));

  assertContractShape(out, ['Ade']);
  assert.equal(out.mock, false);
  assert.equal(out.model, DEFAULT_MODEL);
  assert.deepEqual(out.results[0].hits, ['pun', 'image']);
  assert.equal(out.results[0].score, 6);
  assert.equal(out.results[0].verdict, 'Dressed For The Wrong Room');
  assert.deepEqual(out.bot, { answer: 'a pallbearing of penguins', score: 8 });
  // bot scored higher -> the round's picture is the bot's idea, from image_idea
  assert.match(decodeURIComponent(out.imageUrl), /penguins in tuxedos carrying a coffin/);
});

test('judge() party: party prompt selected, model override, temperature dropped for Opus 5, clamps + defaults', async () => {
  const party = { cards: CARDS, answers: PARTY, spicy: false };
  let captured;
  const spy = async (_u, init) => {
    captured = JSON.parse(init.body);
    return reply({ results: [
      { name: 'Priya', hits: ['scenario', 'image', 'bogus'], score: 99, verdict: 'v'.repeat(80), comment: 'c'.repeat(300), badge: 'nope' },
      { name: 'Tom', hits: 'not-an-array', score: -3, verdict: '', comment: '', badge: 'wholesome' },
      { name: 'Sam', hits: ['pun', 'sound', 'scenario', 'image'], score: 9, verdict: 'Portmanteau, Stat!', comment: 'x', badge: 'wordsmith' },
      { name: 'Lee', hits: ['pun'], score: '5', verdict: 'Pit Or Miss', comment: 'y', badge: 'groaner' },
    ], winner: 'Sam', bot_answer: 'a code green of avocados', bot_score: 8, image_idea: 'a hospital ward full of avocados' })();
  };
  const out = await judge(party, { mock: false, apiKey: 'k', model: 'claude-opus-5', fetch: spy });
  assert.equal(captured.model, 'claude-opus-5');
  assert.ok(!('temperature' in captured), 'no sampling params on Opus 5');
  assert.equal(captured.max_tokens, 700);
  assert.match(captured.messages[0].content, /PLAYER ANSWERS:/);
  assertContractShape(out, ['Priya', 'Tom', 'Sam', 'Lee']);
  assert.equal(out.model, 'claude-opus-5');
  assert.deepEqual(out.results[0].hits, ['scenario', 'image']);
  assert.equal(out.results[0].score, 10);                       // clamped 99 -> 10
  assert.equal(out.results[0].verdict.length, 40);
  assert.equal(out.results[0].comment.length, 160);
  assert.equal(out.results[0].badge, 'chaos');                  // unknown badge -> chaos
  assert.deepEqual(out.results[1].hits, []);
  assert.equal(out.results[1].score, 1);                        // clamped -3 -> 1
  assert.equal(out.results[1].verdict, 'The Jury Is Out');
  assert.equal(out.results[2].score, 9);
  assert.equal(out.results[3].score, 5);
  assert.equal(out.winner, 'Priya');                            // winner recomputed from clamped scores
  assert.equal(new Set(out.results.map(r => r.score)).size, 4);
  assert.match(decodeURIComponent(out.imageUrl), /a hospital ward full of avocados/);
});

test('judge() party: dropped player does not steal the next entry; ties become distinct; tolerant single shape', async () => {
  const party = { cards: CARDS, answers: PARTY, spicy: false };
  const dropped = reply({ results: [
    { name: 'Tom', hits: ['image'], score: 4, verdict: 'Mild', comment: 't', badge: 'wholesome' },
    { name: 'Sam', hits: ['pun', 'sound', 'scenario', 'image'], score: 9, verdict: 'Stat', comment: 's', badge: 'wordsmith' },
    { name: 'Lee', hits: ['pun'], score: 4, verdict: 'Pit', comment: 'l', badge: 'groaner' },
  ], bot_answer: 'a code green of avocados', bot_score: 8, image_idea: '' });
  const out = await judge(party, { mock: false, apiKey: 'k', fetch: dropped });
  assert.equal(out.results[0].name, 'Priya');
  assert.equal(out.results[0].verdict, 'The Jury Is Out');      // Priya missing -> defaults, not Tom's entry
  assert.equal(out.results[1].name, 'Tom');
  assert.equal(out.results[1].verdict, 'Mild');
  assert.equal(out.results[2].score, 9);
  assert.equal(out.winner, 'Sam');
  assert.equal(new Set(out.results.map(r => r.score)).size, 4);
  assert.ok(out.results.every(r => r.score >= 1 && r.score <= 10));
  // bot_score 8 < Sam 9 -> picture is Sam's answer, fallback description since image_idea empty
  assert.match(decodeURIComponent(out.imageUrl), /a guacward of avocados/);

  // Single player but the model answered in party shape.
  const partyShaped = reply({ results: [{ name: 'Ade', hits: ['pun'], score: 5, verdict: 'Meh', comment: 'm', badge: 'lazy' }], bot_answer: 'a wake of penguins', bot_score: 9 });
  const s = await judge(single, { mock: false, apiKey: 'k', fetch: partyShaped });
  assert.equal(s.results[0].score, 5);
  assert.equal(s.results[0].verdict, 'Meh');
});

test('judge() real path: empty answer is forced to 1/no hits and can never outrank a real answer', async () => {
  // Model over-scores the skipped player and ties/under-scores the real ones.
  const input = { cards: CARDS, answers: [{ name: 'Skip', answer: '' }, { name: 'Ade', answer: 'a wake of penguins' }, { name: 'Bo', answer: 'penguins' }], spicy: false };
  const out = await judge(input, { mock: false, apiKey: 'k', fetch: reply({ results: [
    { name: 'Skip', hits: ['pun', 'image'], score: 7, verdict: 'Bold', comment: 'c', badge: 'chaos' },
    { name: 'Ade', hits: ['pun'], score: 1, verdict: 'Low', comment: 'c', badge: 'lazy' },
    { name: 'Bo', hits: [], score: 1, verdict: 'Low', comment: 'c', badge: 'lazy' },
  ], winner: 'Skip', bot_answer: 'a pallbearing of penguins', bot_score: 8, image_idea: 'penguins carrying a coffin' }) });
  const by = Object.fromEntries(out.results.map(r => [r.name, r]));
  assert.equal(by.Skip.score, 1);
  assert.deepEqual(by.Skip.hits, []);
  assert.ok(by.Ade.score > by.Skip.score && by.Bo.score > by.Skip.score, 'real answers outrank the empty one');
  assert.ok(by.Ade.score > by.Bo.score, 'earlier player keeps the higher score on a real tie');
  assert.equal(out.winner, 'Ade');
  assert.equal(new Set(out.results.map(r => r.score)).size, 3);
  const solo = await judge({ cards: CARDS, answers: [{ name: 'A', answer: '' }] }, { mock: false, apiKey: 'k', fetch: reply({ ...SINGLE_REPLY, score: 9 }) });
  assert.equal(solo.results[0].score, 1);
});

test('judge() real-shaped Anthropic reply: multiple content blocks joined, usage ignored, timer cleared; JSON array -> 502', async () => {
  const half = JSON.stringify(SINGLE_REPLY);
  const cut = Math.floor(half.length / 2);
  const realShaped = async () => ({ ok: true, status: 200, json: async () => ({
    id: 'msg_01', type: 'message', role: 'assistant', model: DEFAULT_MODEL, stop_reason: 'end_turn', stop_sequence: null,
    content: [{ type: 'text', text: half.slice(0, cut) }, { type: 'tool_use', id: 'x', name: 'n', input: {} }, { type: 'text', text: half.slice(cut) }],
    usage: { input_tokens: 900, output_tokens: 150 },
  }) });
  const t0 = Date.now();
  const out = await judge(single, { mock: false, apiKey: 'k', fetch: realShaped, timeoutMs: 5000 });
  assert.equal(out.results[0].score, 6);
  assert.deepEqual(out.bot, { answer: 'a pallbearing of penguins', score: 8 });
  assert.ok(Date.now() - t0 < 1000, 'resolved immediately; the abort timer did not hold the call');
  await assert.rejects(judge(single, { mock: false, apiKey: 'k', fetch: reply('[{"score": 9}]') }), e => e.status === 502);
  await assert.rejects(judge(single, { mock: false, apiKey: 'k', fetch: reply('42') }), e => e.status === 502);
});

test('judge() party: when the bot beats every player the picture is the bot answer (image_idea still wins the scene)', async () => {
  const party = { cards: CARDS, answers: PARTY.slice(0, 2), spicy: false };
  const out = await judge(party, { mock: false, apiKey: 'k', fetch: reply({ results: [
    { name: 'Priya', hits: ['image'], score: 4, verdict: 'v', comment: 'c', badge: 'wholesome' },
    { name: 'Tom', hits: [], score: 2, verdict: 'v', comment: 'c', badge: 'lazy' },
  ], winner: 'Priya', bot_answer: 'a code green of avocados', bot_score: 9, image_idea: '' }) });
  assert.equal(out.winner, 'Priya', 'winner is a player even when the bot scores higher');
  assert.match(decodeURIComponent(out.imageUrl), /a code green of avocados/);
  const seeded = imageUrl({ cards: CARDS, answer: 'a code green of avocados' });
  assert.equal(new URL(out.imageUrl).searchParams.get('seed'), new URL(seeded).searchParams.get('seed'), 'seed derives from the pictured answer');
});

test('alternatives are capped at 2, deduped, and never echo the bot or a player', async () => {
  const input = { cards: ['Plumbers', 'At a Press Conference'], answers: [{ name: 'Ade', answer: 'a leak of plumbers' }], spicy: false };
  const out = await judge(input, { mock: false, apiKey: 'k', fetch: reply({
    ...SINGLE_REPLY,
    bot_answer: 'a blockage of plumbers',
    alternatives: ['a flush of plumbers', 'A LEAK OF PLUMBERS', 'a blockage of plumbers', 'a flush of plumbers', 'a drain of plumbers'],
  }) });
  assert.deepEqual(out.alternatives, ['a flush of plumbers', 'a drain of plumbers'], 'player echo, bot echo and duplicate removed');
  // absent / malformed / non-string entries degrade to an empty list, never undefined
  for (const alt of [undefined, 'not an array', [], [null, 42, '   ']]) {
    const r = await judge(input, { mock: false, apiKey: 'k', fetch: reply({ ...SINGLE_REPLY, alternatives: alt }) });
    assert.deepEqual(r.alternatives, [], `alternatives: ${JSON.stringify(alt)}`);
  }
  // and the prompt actually asks for them
  assert.match(buildPrompts(input).user, /alternatives/);
});

test('mock mode supplies alternatives so the reveal can be exercised without a key', async () => {
  const d = await (await post('/api/judge', { cards: CARDS, answers: [{ name: 'A', answer: 'a wake of penguins' }] })).json();
  assert.ok(Array.isArray(d.alternatives) && d.alternatives.length === 2, 'two mock alternatives');
  assert.ok(d.alternatives.every((a) => typeof a === 'string' && a.includes(' of ')));
});

// ---------------------------------------------------------------------------
// handleJudgeRequest + serverless wrappers
// ---------------------------------------------------------------------------
test('handleJudgeRequest: 405, object bodies pass through, mock option', async () => {
  assert.equal((await handleJudgeRequest({ method: 'GET', rawBody: '' })).status, 405);
  const r = await handleJudgeRequest({ method: 'POST', rawBody: { cards: CARDS, answers: [{ answer: 'a wake' }] }, options: { mock: true, noDelay: true } });
  assert.equal(r.status, 200);
  assert.equal(r.body.mock, true);
  assert.equal((await handleJudgeRequest({ method: 'POST', rawBody: 'x'.repeat(LIMITS.MAX_BODY_BYTES + 1) })).status, 413);
});

test('netlify wrapper adapts event -> {statusCode, headers, body}', async () => {
  const { handler } = require('../netlify/functions/judge');
  const bad = await handler({ httpMethod: 'GET' });
  assert.equal(bad.statusCode, 405);
  assert.equal(typeof JSON.parse(bad.body).error, 'string');
  const payload = JSON.stringify({ cards: CARDS, answers: PARTY });
  const ok = await handler({ httpMethod: 'POST', body: payload });
  assert.equal(ok.statusCode, 200);
  assert.match(ok.headers['Content-Type'], /application\/json/);
  assert.equal(JSON.parse(ok.body).mock, true);
  const b64 = await handler({ httpMethod: 'POST', isBase64Encoded: true, body: Buffer.from(payload).toString('base64') });
  assert.equal(b64.statusCode, 200);
});

test('vercel wrapper adapts (req, res)', async () => {
  const handler = require('../api/judge');
  const mkRes = () => ({ headers: {}, statusCode: 0, setHeader(k, v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(b) { this.body = b; } });
  const res = mkRes();
  await handler({ method: 'POST', body: { cards: CARDS, answers: PARTY } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mock, true);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  const res2 = mkRes();
  await handler({ method: 'GET' }, res2);
  assert.equal(res2.statusCode, 405);
});
