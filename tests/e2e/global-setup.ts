import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import type { FullConfig } from '@playwright/test';

const host = '127.0.0.1';
const port = 4173;
const distRoot = resolve(process.cwd(), 'apps/mobile/dist');

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.woff2', 'font/woff2'],
]);

export default async function globalSetup(_config: FullConfig) {
  if (!existsSync(resolve(distRoot, 'index.html'))) {
    throw new Error('Build não encontrado. Execute npm run build antes do E2E.');
  }

  const server = createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }

    try {
      const url = new URL(request.url || '/', `http://${host}:${port}`);
      const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      let filePath = resolve(distRoot, relativePath);

      if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${sep}`)) {
        response.writeHead(400);
        response.end();
        return;
      }

      if (!existsSync(filePath) || !statSync(filePath).isFile()) filePath = resolve(distRoot, 'index.html');

      response.writeHead(200, {
        'Content-Type': contentTypes.get(extname(filePath)) || 'application/octet-stream',
        'Cache-Control': filePath.includes(`${sep}assets${sep}`)
          ? 'public, max-age=31536000, immutable'
          : 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });

      if (request.method === 'HEAD') {
        response.end();
        return;
      }

      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(400);
      response.end();
    }
  });

  await new Promise<void>((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolveReady();
    });
  });

  return async () => {
    await new Promise<void>((resolveClosed) => {
      server.close(() => resolveClosed());
      server.closeAllConnections();
    });
  };
}
