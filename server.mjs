// Minimal static server for Landfall — no dependencies.
// Serves /app on http://localhost:8796. localhost is a secure context, so the
// service worker registers and the PWA installs on this machine.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'app');
const PORT = 8796;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.css': 'text/css; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    // Serve a directory index for any folder URL, not just the root — static
    // hosts do this, so without it a subpath deploy behaves differently here.
    if (p.endsWith('/')) p += 'index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      // no-store, not no-cache: this server sends no ETag and no Last-Modified,
      // so with only 'no-cache' the browser has nothing to revalidate against
      // and happily keeps serving a stale module. Every edit then appears not to
      // have happened, which is an hour of debugging the wrong thing.
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
}).listen(PORT, () => console.log(`Landfall running →  http://localhost:${PORT}`));
