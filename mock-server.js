// mock-server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8888;

http.createServer((req, res) => {
  // Serve static files
  if (req.method === 'GET') {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';

    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
    }[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
    return;
  }

  // Mock AI scoring
  if (req.url === '/.netlify/functions/score' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { answer } = JSON.parse(body);
      const score = Math.floor(Math.random() * 6) + 5; // 5–10
      const puns = [
        `A "${answer}" of cleverness!`,
        `Pure "${answer}" energy!`,
        `That's a "${answer}" I'd join!`,
        `Brilliant! A "${answer}" indeed!`,
        `I’m stealing "${answer}" for my résumé!`
      ];
      const comment = [
        "Nailed it!", "Hilarious!", "Genius!", "Solid pun!", "Creative!"
      ][Math.floor(Math.random() * 5)];

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        score,
        comment,
        pun: puns[Math.floor(Math.random() * puns.length)]
      }));
    });
    return;
  }

  res.writeHead(404);
  res.end();
}).listen(PORT, () => {
  console.log(`Mock server running at http://localhost:${PORT}`);
  console.log(`Open your game → it will use mock AI`);
});