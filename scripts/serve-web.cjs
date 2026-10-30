// Serves the exported web app (`npm run build:web` → dist/) the way Vercel will: with the
// cross-origin isolation headers, and index.html for any app route. For checking locally only.
const { createReadStream, existsSync, statSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, join, normalize } = require('node:path');

const ROOT = join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 8080;
const HEADERS = require('./isolation-headers.json');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
};

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  let file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  res.writeHead(200, { ...HEADERS, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Steady web: http://localhost:${PORT}`));
