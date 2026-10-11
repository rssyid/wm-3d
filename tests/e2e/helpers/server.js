// Server statis untuk tes e2e: python3 -m http.server pada port bebas, dibind ke 127.0.0.1.
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitFor(url, timeoutMs = 10000) {
  const t0 = performance.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* belum siap */
    }
    if (performance.now() - t0 > timeoutMs) throw new Error(`Server tidak siap: ${url}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Menjalankan server; `directory` default = akar repo. Mengembalikan {url, port, stop()}. */
export async function startServer({ directory = REPO_ROOT } = {}) {
  const port = await freePort();
  const proc = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', directory], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  proc.stderr.on('data', (d) => {
    stderr += d;
    if (stderr.length > 20000) stderr = stderr.slice(-10000);
  });
  const url = `http://127.0.0.1:${port}/`;
  try {
    await waitFor(url);
  } catch (e) {
    proc.kill();
    throw new Error(`${e.message}\n${stderr}`);
  }
  return {
    url,
    port,
    stop: () =>
      new Promise((resolve) => {
        if (proc.exitCode !== null) return resolve();
        proc.once('exit', () => resolve());
        proc.kill();
      }),
  };
}
