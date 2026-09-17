// Landfall — serve docs/ the way GitHub Pages will, at a SUBPATH.
//
//   node build/serve-subpath.mjs        →  http://localhost:8797/landfall/
//
// A project site lives at /landfall/, not at the root, and that is the one
// difference between the local server and the real host. It is also the one
// that breaks silently: a service worker registered from '/sw.js' scopes to the
// whole origin and is rejected, a manifest start_url of '/' walks off the site,
// and any absolute href loads nothing. Halyard shipped only after this exact
// check, so Landfall gets it too.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const BASE = '/landfall/';
const PORT = 8797;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') { res.writeHead(302, { location: BASE }).end(); return; }
  if (!p.startsWith(BASE)) { res.writeHead(404).end('not on this project site'); return; }
  p = p.slice(BASE.length - 1);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      // Modules are no-store because this server sends no ETag and no
      // Last-Modified, so 'no-cache' gives the browser nothing to revalidate
      // against and it happily serves a stale copy through every edit.
      //
      // sw.js is the exception: a worker script should be revalidated, not
      // un-storable. Note that service workers do NOT register from this server
      // at all in some embedded browsers, whatever the headers — the real check
      // is against the live host, where the same code registers fine.
      'cache-control': file.endsWith('sw.js') ? 'no-cache' : 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
}).listen(PORT, () => console.log(`docs/ served as a project site →  http://localhost:${PORT}${BASE}`));
