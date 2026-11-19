// static.mjs — крошечный статический сервер для страницы панели.
// Живёт внутри нашего аддона (host network), отдаёт /data/panel без авторизации,
// чтобы панель могла открыть страницу без сессии Home Assistant.
// Порт задаётся PANEL_HTTP_PORT (по умолчанию 8099).

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PANEL_HTTP_PORT || 8099);
const ROOT = process.env.PANEL_HTTP_ROOT || '/data/panel';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/' || path === '') path = '/index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Length': body.length,
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[panel-http] serving ${ROOT} on :${PORT}`);
});
