// Serve the Angular production output on loopback with the same API paths as ng serve.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, request as requestHttp } from 'node:http';
import { request as requestHttps } from 'node:https';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const host = '127.0.0.1';
const port = Number(process.env.PREVIEW_PORT ?? 4200);
const api = new URL(process.env.PREVIEW_API ?? 'http://127.0.0.1:3000');
const root = fileURLToPath(new URL('../dist/apaar-garage/browser', import.meta.url));
const fileType = {
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
};
const compressible = new Set(['.css', '.html', '.js', '.json', '.svg', '.txt', '.xml']);
if (
  !['http:', 'https:'].includes(api.protocol) ||
  api.pathname !== '/' ||
  api.username ||
  api.password ||
  api.search ||
  api.hash
) {
  throw new Error('PREVIEW_API must be an HTTP(S) origin.');
}

async function details(path) {
  const entry = await stat(path).catch((error) => {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
  });
  return entry?.isFile() ? entry : undefined;
}

function proxy(request, response, url) {
  const send = api.protocol === 'https:' ? requestHttps : requestHttp;
  const path = url.pathname.replace(/^\/api(?=\/)/, '') + url.search;
  const upstream = send(
    api,
    { path, method: request.method, headers: { ...request.headers, host: api.host } },
    (result) => {
      if (response.destroyed) {
        result.destroy();
        return;
      }
      response.writeHead(result.statusCode, result.headers);
      pipeline(result, response, () => {});
    },
  );
  response.once('close', () => {
    if (!response.writableFinished) upstream.destroy();
  });
  upstream.on('error', () => {
    if (response.destroyed) return;
    if (!response.headersSent) response.writeHead(502);
    response.end('The local API is unavailable.');
  });
  request.pipe(upstream);
}

async function serve(request, response) {
  const url = new URL(request.url, 'http://' + host);
  if (/^\/(?:products(?:\/|$)|api\/)/.test(url.pathname)) return proxy(request, response, url);
  if (request.method !== 'GET' && request.method !== 'HEAD') return response.writeHead(405).end();
  const filePath = resolve(root, '.' + decodeURIComponent(url.pathname));
  if (filePath !== root && !filePath.startsWith(root + sep)) return response.writeHead(404).end();
  const candidate = extname(filePath) ? filePath : resolve(filePath, 'index.html');
  const entry = await details(candidate);
  const file = entry ? candidate : resolve(root, 'index.html');
  const info = entry ?? (extname(filePath) ? undefined : await details(file));
  if (!info) return response.writeHead(404).end();
  const extension = extname(file);
  const headers = { 'Content-Type': fileType[extension] ?? 'application/octet-stream' };
  if (/^\/admin(?:\/|$)/.test(url.pathname)) headers['Cache-Control'] = 'no-store';
  const gzip =
    compressible.has(extension) &&
    /(?:^|,)\s*gzip\s*(?:,|$)/i.test(request.headers['accept-encoding'] ?? '');
  if (compressible.has(extension)) headers.Vary = 'Accept-Encoding';
  if (gzip) headers['Content-Encoding'] = 'gzip';
  else headers['Content-Length'] = info.size;
  response.writeHead(200, headers);
  if (request.method === 'HEAD') return response.end();
  const source = createReadStream(file);
  if (gzip) pipeline(source, createGzip(), response, () => {});
  else pipeline(source, response, () => {});
}

if (!(await details(resolve(root, 'index.html'))))
  throw new Error('Run npm run build before npm run preview.');
createServer((request, response) => {
  void serve(request, response).catch(() => {
    if (!response.headersSent) response.writeHead(400);
    response.end();
  });
}).listen(port, host, () =>
  process.stdout.write('Production preview at http://' + host + ':' + port + '\n'),
);
