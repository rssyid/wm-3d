// E2E tab "Persamaan & Perhitungan": navigasi (hash, sub-menu, <select> ponsel), MathML di 11 bagian,
// angka Q sama dengan snapshot/KPI, "Bekukan angka", piezometer pilihan, tema gelap, lebar ponsel.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers/server.js';
import { launchBrowser, newPage, screenshot } from './helpers/browser.js';

const T = { timeout: 180000 };
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

async function open(opts = {}) {
  const ctx = await newPage(browser, opts);
  await ctx.page.goto(server.url, { waitUntil: 'load' });
  await ctx.page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
  return ctx;
}

/** fmtQ(snapshot.structure.q_m3s) dihitung di halaman, sama dengan js/ui/format.js. */
function expectedQ(page) {
  return page.evaluate(() => {
    const q = window.wmApp.getSnapshot().structure.q_m3s;
    const nf = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const v = Math.abs(q) < 0.0005 ? 0 : q;
    return `${nf.format(v).replace('-', '−')} m³/s`;
  });
}

async function waitWeirQ(page, expected, timeout = 8000) {
  await page.waitForFunction((exp) => document.querySelector('[data-eq-value="weir-q"]')?.textContent === exp, expected, { timeout });
}

async function sectionVisible(page, id) {
  await page.waitForSelector(`[data-eq-section="${id}"]:not([hidden])`, { state: 'visible', timeout: 15000 });
}

test('pintu-air lewat hash: MathML, Q = snapshot, berubah tiap langkah, dan bisa dibekukan', T, async (t) => {
  const { context, page, logs } = await open();
  await page.evaluate(() => {
    location.hash = '#persamaan.pintu-air';
  });
  await sectionVisible(page, 'pintu-air');
  assert.ok((await page.locator('[data-eq-section="pintu-air"] math').count()) > 0, 'ada elemen <math>');
  assert.equal(await page.locator('#eq-nav a[aria-current="page"]').getAttribute('data-section'), 'pintu-air');

  await page.evaluate(() => {
    window.wmApp.setScenario('hujan');
    window.wmApp.stepDays(20);
  });
  const q20 = await expectedQ(page);
  await waitWeirQ(page, q20);
  // silang-cek dengan KPI (milik modul UI; diperbarui per frame) — dicatat, tidak menggagalkan tes ini
  const kpiOk = await page
    .waitForFunction((exp) => (document.querySelector('[data-kpi="q"]')?.textContent ?? '').includes(exp), q20, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  t.diagnostic(kpiOk ? `KPI [data-kpi="q"] memuat ${q20}` : `Catatan: KPI [data-kpi="q"] belum memuat ${q20} (modul UI tidak memperbarui KPI selama tab Simulasi tersembunyi)`);

  // satu hari lagi → angka mengikuti snapshot baru
  const cond0 = await page.locator('#eq-cond').textContent();
  await page.evaluate(() => window.wmApp.stepDays(1));
  const q21 = await expectedQ(page);
  await waitWeirQ(page, q21);
  await page.waitForFunction((c) => document.querySelector('#eq-cond').textContent !== c, cond0, { timeout: 8000 });

  // layar desktop terang: tampilkan blok perhitungan
  await page.evaluate(() => document.querySelector('[data-live="pa-calc"]').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await screenshot(page, 'eq-pintu-air-desktop');

  // Bekukan angka
  await page.locator('#eq-freeze').check();
  assert.equal(await page.evaluate(() => window.wmApp.store.get().eq.frozen), true);
  const frozenQ = await page.locator('[data-eq-value="weir-q"]').textContent();
  const frozenCond = await page.locator('#eq-cond').textContent();
  assert.match(frozenCond, /dibekukan/);
  await page.evaluate(() => window.wmApp.stepDays(2));
  await page.waitForTimeout(900);
  assert.equal(await page.locator('[data-eq-value="weir-q"]').textContent(), frozenQ, 'angka tidak berubah saat dibekukan');
  assert.equal(await page.locator('#eq-cond').textContent(), frozenCond, 'kondisi tidak berubah saat dibekukan');

  // lepas → kembali mengikuti snapshot
  await page.locator('#eq-freeze').uncheck();
  await waitWeirQ(page, await expectedQ(page));
  assert.doesNotMatch(await page.locator('#eq-cond').textContent(), /dibekukan/);

  assert.deepEqual(logs.errors, []);
  assert.deepEqual(logs.warnings, []);
  await context.close();
});

test('11 bagian lewat sub-menu: MathML + grafik, tanpa error console; kembali ke #sim tetap merender', T, async () => {
  const { context, page, logs } = await open();
  // dari tab simulasi lewat navigasi utama
  await page.locator('.main-nav a[data-route="persamaan"]').click();
  await sectionVisible(page, 'neraca');
  await page.evaluate(() => {
    window.wmApp.setScenario('ekstrem');
    window.wmApp.stepDays(15);
  });
  const ids = await page.$$eval('#eq-nav a[data-section]', (as) => as.map((a) => a.dataset.section));
  assert.equal(ids.length, 11);
  for (const id of ids) {
    await page.locator(`#eq-nav a[data-section="${id}"]`).click();
    await sectionVisible(page, id);
    await page.waitForFunction((s) => location.hash === `#persamaan.${s}`, id, { timeout: 5000 });
    const info = await page.evaluate((s) => {
      const el = document.querySelector(`[data-eq-section="${s}"]`);
      const canvases = [...el.querySelectorAll('canvas[data-plot]')];
      return {
        math: el.querySelectorAll('math').length,
        live: [...el.querySelectorAll('[data-live]')].filter((n) => n.innerHTML.trim() === '' && n.dataset.live !== 'pr-off').length,
        canvases: canvases.length,
        drawn: canvases.filter((c) => c.width > 0 && c.height > 0).length,
        focus: document.activeElement?.id,
        visibleOthers: [...document.querySelectorAll('[data-eq-section]')].filter((n) => !n.hidden && n !== el).length,
      };
    }, id);
    assert.ok(info.math > 0, `${id}: ada <math>`);
    assert.equal(info.live, 0, `${id}: semua blok "Perhitungan saat ini" terisi`);
    assert.equal(info.visibleOthers, 0, `${id}: hanya satu bagian tampil`);
    assert.equal(info.focus, `eq-h-${id}`, `${id}: fokus pindah ke judul bagian`);
    if (info.canvases) {
      await page.waitForFunction(
        (s) => [...document.querySelectorAll(`[data-eq-section="${s}"] canvas[data-plot]`)].every((c) => c.width > 0),
        id,
        { timeout: 5000 },
      );
    }
  }
  assert.deepEqual(logs.errors, [], 'tanpa console.error');
  assert.deepEqual(logs.warnings, [], 'tanpa console.warn');

  // piezometer pilihan → store.eq.piezometer dan keterangan sel
  await page.locator('#eq-nav a[data-section="airtanah"]').click();
  await sectionVisible(page, 'airtanah');
  await page.selectOption('#eq-piezometer', 'P1');
  assert.equal(await page.evaluate(() => window.wmApp.store.get().eq.piezometer), 'P1');
  await page.waitForFunction(() => /terdekat dengan P1/.test(document.querySelector('[data-live="at-calc"]').textContent), null, { timeout: 5000 });

  // kembali ke Simulasi 3D
  await page.locator('.main-nav a[data-route="sim"]').click();
  await page.waitForSelector('#view-sim:not([hidden])', { timeout: 10000 });
  assert.equal(await page.locator('#view-persamaan').isHidden(), true);
  await page.evaluate(() => window.wmApp.renderOnce());
  const ri = await page.evaluate(() => window.wmApp.renderInfo());
  assert.equal(ri.webgl2, true, 'WebGL2 aktif');
  assert.ok(ri.calls > 0, `canvas 3D merender lagi (calls ${ri.calls})`);
  assert.deepEqual(logs.errors, []);
  await context.close();
});

test('tema gelap: MathML terang di atas latar gelap (airtanah)', T, async () => {
  const { context, page, logs } = await open({ colorScheme: 'dark' });
  await page.evaluate(() => {
    window.wmApp.setScenario('hujan');
    window.wmApp.stepDays(25);
    location.hash = '#persamaan.airtanah';
  });
  await sectionVisible(page, 'airtanah');
  await page.waitForTimeout(400);
  const lum = await page.evaluate(() => {
    const L = (c) => {
      const m = c.match(/\d+(\.\d+)?/g).map(Number);
      return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    };
    const math = document.querySelector('[data-eq-section="airtanah"] .eq-display math');
    return { ink: L(getComputedStyle(math).color), bg: L(getComputedStyle(document.body).backgroundColor) };
  });
  assert.ok(lum.ink > 150 && lum.bg < 60, `kontras tema gelap (tinta ${lum.ink.toFixed(0)}, latar ${lum.bg.toFixed(0)})`);
  await page.evaluate(() => document.querySelector('[data-live="at-calc"]').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(300);
  await screenshot(page, 'eq-airtanah-dark');
  assert.deepEqual(logs.errors, []);
  assert.deepEqual(logs.warnings, []);
  await context.close();
});

test('ponsel 390×844: sub-menu <select>, tanpa scroll horizontal halaman di semua bagian', T, async () => {
  const { context, page, logs } = await open({ viewport: { width: 390, height: 844 } });
  await page.evaluate(() => {
    window.wmApp.setScenario('hujan');
    window.wmApp.stepDays(20);
    location.hash = '#persamaan.neraca';
  });
  await sectionVisible(page, 'neraca');
  assert.equal(await page.locator('#eq-nav-select').isVisible(), true, '<select> tampil di ponsel');
  assert.equal(await page.locator('.eq-nav-list').isVisible(), false, 'daftar sidebar disembunyikan');
  const ids = await page.$$eval('#eq-nav-select option', (os) => os.map((o) => o.value));
  for (const id of ids) {
    await page.selectOption('#eq-nav-select', id);
    await sectionVisible(page, id);
    await page.waitForTimeout(150);
    const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert.ok(w.sw <= w.cw, `${id}: tanpa scroll horizontal (${w.sw} > ${w.cw})`);
  }
  await page.selectOption('#eq-nav-select', 'pintu-air');
  await sectionVisible(page, 'pintu-air');
  await waitWeirQ(page, await expectedQ(page));
  await page.evaluate(() => document.querySelector('[data-live="pa-calc"]').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(300);
  await screenshot(page, 'eq-phone');
  assert.deepEqual(logs.errors, []);
  assert.deepEqual(logs.warnings, []);
  await context.close();
});

test('saat berjalan: pembaruan ≤ 4 Hz, hanya bagian yang tampil, nol saat dibekukan', T, async () => {
  const { context, page, logs } = await open();
  await page.evaluate(() => {
    window.wmApp.setScenario('normal');
    location.hash = '#persamaan.neraca';
  });
  await sectionVisible(page, 'neraca');
  await page.locator('#eq-nav a[data-section="pintu-air"]').click();
  await sectionVisible(page, 'pintu-air');
  const run = (ms) =>
    page.evaluate(async (dur) => {
      const count = (sel) => {
        const box = { n: 0 };
        const mo = new MutationObserver(() => box.n++);
        mo.observe(document.querySelector(sel), { childList: true, subtree: true, characterData: true });
        return { box, mo };
      };
      const vis = count('[data-eq-section="pintu-air"] [data-live="pa-calc"]');
      const hid = count('[data-eq-section="neraca"]');
      const h0 = window.wmApp.getSnapshot().hourIndex;
      window.wmApp.store.set({ speedHps: 720 });
      window.wmApp.actions.play();
      await new Promise((r) => setTimeout(r, dur));
      window.wmApp.actions.pause();
      await new Promise((r) => setTimeout(r, 400));
      vis.mo.disconnect();
      hid.mo.disconnect();
      return { visible: vis.box.n, hidden: hid.box.n, hours: window.wmApp.getSnapshot().hourIndex - h0 };
    }, ms);
  const r = await run(2000);
  assert.ok(r.hours > 24, `simulasi berjalan (${r.hours} jam)`);
  assert.ok(r.visible >= 2, `bagian tampil diperbarui (${r.visible}×)`);
  assert.ok(r.visible <= 11, `≤ 4 Hz: ${r.visible} pembaruan dalam ~2,4 s`);
  assert.equal(r.hidden, 0, 'bagian tersembunyi tidak diperbarui');

  await page.locator('#eq-freeze').check();
  const f = await run(1200);
  assert.ok(f.hours > 0, 'simulasi tetap berjalan saat dibekukan');
  assert.equal(f.visible, 0, 'tidak ada pembaruan saat dibekukan');
  await page.locator('#eq-freeze').uncheck();
  assert.deepEqual(logs.errors, []);
  assert.deepEqual(logs.warnings, []);
  await context.close();
});
