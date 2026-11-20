import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, sep } from 'node:path';

const BASE = '/whimigo/';

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * Serves one build of the Arcade under /whimigo/, as GitHub Pages does, and can be switched to
 * another build at the same address while a page is open: a deployment, as the tablet sees it.
 */
export interface BuildServer {
  /** The Arcade's address, ending in /whimigo/. */
  readonly url: string;
  /** Serves the build in `dir` from now on. */
  serve(dir: string): void;
  /** How many requests have been made for a file beneath the base path, such as 'sw.js'. */
  requests(file: string): number;
  close(): Promise<void>;
}

export async function startBuildServer(dir: string): Promise<BuildServer> {
  let root = dir;
  const counts = new Map<string, number>();
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const file = path.startsWith(BASE) ? path.slice(BASE.length) || 'index.html' : null;
    const local = file === null ? null : normalize(join(root, file));
    if (file === null || local === null || !local.startsWith(root + sep)) {
      response.writeHead(404).end();
      return;
    }
    counts.set(file, (counts.get(file) ?? 0) + 1);
    readFile(local).then(
      (body) => {
        response.writeHead(200, {
          'content-type': TYPES[extname(local)] ?? 'application/octet-stream',
          'cache-control': 'no-cache',
        });
        response.end(body);
      },
      () => response.writeHead(404).end(),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://localhost:${port}${BASE}`,
    serve(next) {
      root = next;
    },
    requests: (file) => counts.get(file) ?? 0,
    close() {
      server.closeAllConnections();
      return new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
