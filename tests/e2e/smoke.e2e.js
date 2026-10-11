// Smoke test e2e: halaman dimuat, WebGL2 aktif, tanpa error console / request eksternal.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers/server.js';
import { launchBrowser, newPage, screenshot } from './helpers/browser.js';

let server;
let browser;

before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});

after(async () => {
  await browser?.close();
  await server?.stop();
});

test('halaman siap, WebGL2 aktif, tanpa error', async () => {
  const { context, page, logs } = await newPage(browser);
  await page.goto(server.url, { waitUntil: 'load' });
  await page.waitForSelector('body[data-ready="1"]', { timeout: 20000 });
  const info = await page.evaluate(() => window.wmApp.renderInfo());
  assert.equal(info.webgl2, true, 'WebGL2 harus aktif');
  assert.ok(info.calls > 0, `draw call > 0 (dapat ${info.calls})`);
  assert.equal(await page.locator('#webgl-fallback').isHidden(), true);
  await screenshot(page, 'm0-desktop');
  assert.deepEqual(logs.external, [], 'tidak boleh ada request eksternal selain CDN three');
  assert.deepEqual(logs.errors, []);
  assert.deepEqual(logs.warnings, []);
  await context.close();
});
