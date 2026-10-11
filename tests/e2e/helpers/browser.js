// Peluncur Chromium headless untuk tes e2e.
// - Memakai playwright-core lokal (devDependency) atau salinan global di /opt/node-tools.
// - WebGL2 lewat SwiftShader (flag wajib di Linux headless).
// - CDN three.js di-intercept dan dilayani dari node_modules/three (CDN diblokir di container ini).
// - Semua request eksternal lain dibatalkan dan dicatat.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from './server.js';

const THREE_VERSION = '0.185.1';
const CDN_RE = new RegExp(`^https://cdn\\.jsdelivr\\.net/npm/three@${THREE_VERSION.replace(/\./g, '\\.')}/(.+)$`);
// Font Google boleh gagal (fallback stack); jangan dihitung sebagai request eksternal liar.
const FONT_RE = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
const IGNORED_CONSOLE = /GPU stall due to ReadPixels|GL Driver Message|Automatic fallback to software WebGL|swiftshader/i;

async function loadChromium() {
  try {
    return (await import('playwright-core')).chromium;
  } catch {
    /* lanjut */
  }
  const tries = [
    () => createRequire(import.meta.url)('playwright'),
    () => createRequire('/opt/node-tools/node_modules/')('playwright-core'),
    () => createRequire('/opt/node-tools/node_modules/')('playwright'),
  ];
  for (const t of tries) {
    try {
      return t().chromium;
    } catch {
      /* lanjut */
    }
  }
  throw new Error('Playwright tidak ditemukan (npm i atau /opt/node-tools).');
}

const LAUNCH_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export async function launchBrowser() {
  const chromium = await loadChromium();
  try {
    return await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  } catch (e) {
    return await chromium.launch({ headless: true, args: LAUNCH_ARGS, executablePath: '/opt/pw-browsers/chromium' });
  }
}

/**
 * Membuat context + page dengan intercept CDN dan penangkap console.
 * Mengembalikan {context, page, logs:{errors, warnings, external}}.
 */
export async function newPage(browser, { viewport = { width: 1280, height: 800 }, colorScheme = 'light' } = {}) {
  const context = await browser.newContext({ viewport, colorScheme, deviceScaleFactor: 1 });
  const logs = { errors: [], warnings: [], external: [] };

  await context.route('**/*', async (route) => {
    const url = route.request().url();
    const m = url.match(CDN_RE);
    if (m) {
      const file = path.join(REPO_ROOT, 'node_modules', 'three', m[1]);
      try {
        const body = await fs.readFile(file);
        return route.fulfill({
          status: 200,
          body,
          contentType: 'text/javascript; charset=utf-8',
          headers: { 'access-control-allow-origin': '*' },
        });
      } catch {
        logs.errors.push(`CDN file tidak ada di node_modules: ${m[1]}`);
        return route.abort();
      }
    }
    if (url.startsWith('http://127.0.0.1') || url.startsWith('data:') || url.startsWith('blob:')) {
      return route.continue();
    }
    if (FONT_RE.test(url)) {
      // Font tidak bisa diunduh di container: kembalikan CSS kosong agar fallback dipakai tanpa error.
      return route.fulfill({ status: 200, body: '', contentType: 'text/css' });
    }
    logs.external.push(url);
    return route.abort();
  });

  const page = await context.newPage();
  page.on('pageerror', (err) => logs.errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    const text = msg.text();
    if (IGNORED_CONSOLE.test(text)) return;
    if (msg.type() === 'error') logs.errors.push(`console.error: ${text}`);
    else if (msg.type() === 'warning') logs.warnings.push(`console.warn: ${text}`);
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (FONT_RE.test(url) || logs.external.includes(url)) return;
    logs.errors.push(`requestfailed: ${url} (${req.failure()?.errorText})`);
  });
  return { context, page, logs };
}

export const SCREENSHOT_DIR = path.join(REPO_ROOT, 'test-results', 'screenshots');

export async function screenshot(page, name) {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}
