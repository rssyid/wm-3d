// Tes e2e UI simulasi: KPI & badge, skenario, stoplog, play/pause & keyboard, grafik/tabel/CSV,
// tata letak ponsel, tema gelap, halaman Tentang. Juga memastikan tidak ada error/warning console.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers/server.js';
import { launchBrowser, newPage, screenshot } from './helpers/browser.js';

const T = { timeout: 180000 };
let server;
let browser;
let desk; // halaman desktop terang yang dipakai bersama oleh tes fungsional

async function openApp(opts) {
  const ctx = await newPage(browser, opts);
  await ctx.page.goto(server.url, { waitUntil: 'load' });
  await ctx.page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
  return ctx;
}

function assertClean(logs, where) {
  assert.deepEqual(logs.errors, [], `error console (${where})`);
  assert.deepEqual(logs.warnings, [], `warning console (${where})`);
  assert.deepEqual(logs.external, [], `request eksternal (${where})`);
}

const snap = (page, expr) => page.evaluate(expr);

before(async () => {
  server = await startServer();
  browser = await launchBrowser();
  desk = await openApp({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
});

after(async () => {
  await desk?.context.close();
  await browser?.close();
  await server?.stop();
});

test('elemen kontrak ada dan berlabel', T, async () => {
  const { page } = desk;
  for (const sel of ['#skenario', '#btn-play', '#btn-step', '#btn-reset', '#kecepatan', '#clock', '#stoplog-minus', '#stoplog-plus', '#stoplog-count', '#gate-mode', '[data-kpi="tmat"]', '[data-kpi="tmas"]', '[data-kpi="q"]', '[data-kpi="rain"]', '[data-badge="perusahaan"]', '[data-badge="pp"]', '#chart', '#alur', '#btn-copy-csv']) {
    assert.equal(await page.locator(sel).count(), 1, `elemen ${sel}`);
  }
  const opts = await page.$$eval('#skenario option', (o) => o.map((x) => x.value));
  assert.deepEqual(opts, ['kemarau', 'normal', 'hujan', 'ekstrem', 'manual']);
  const cams = await page.$$eval('[data-camera]', (b) => b.map((x) => x.dataset.camera));
  assert.ok(cams.includes('ikhtisar') && cams.includes('penampang'));
  assert.equal(await page.getAttribute('#alur', 'role'), 'img');
  assert.equal(await page.locator('.flow-narr[aria-live="polite"]').count(), 1);
});

test('kemarau 60 hari: titik penaatan P4 > 40 cm, badge PP "Tidak patuh", kategori Kering/Agak Kering, Q berformat', T, async () => {
  const { page } = desk;
  await page.evaluate(() => {
    wmApp.setScenario('kemarau');
    wmApp.stepDays(60);
  });
  const tp = await snap(page, () => wmApp.getSnapshot().piezometers.find((p) => p.isTP));
  assert.equal(tp.id, 'P4', 'titik penaatan bawaan');
  assert.ok(tp.depthCm > 40, `P4 = ${tp.depthCm}`);
  assert.match(await page.locator('[data-kpi="tmat"]').innerText(), /titik penaatan P4/);
  assert.match(await page.locator('.pp-strip').innerText(), /Hari patuh PP\s+\d+% \(\d+\/60 hari\)/);
  assert.match(await page.locator('.badge-basis').innerText(), /rerata harian/);
  const pp = await page.locator('[data-badge="pp"]').innerText();
  assert.match(pp, /Tidak patuh/);
  const comp = await page.locator('[data-badge="perusahaan"]').innerText();
  assert.match(comp, /Kering|Agak Kering/);
  const q = await page.locator('[data-kpi="q"]').innerText();
  assert.match(q, /\d,\d{3} m³\/s/);
  const tmat = await page.locator('[data-kpi="tmat"]').innerText();
  assert.match(tmat, /−\d+ cm/, 'TMAT sebagai elevasi negatif');
  assert.match(tmat, /di bawah permukaan/);
  assert.match(await page.locator('#clock').innerText(), /^Hari 61\/120/);
});

test('ekstrem menghasilkan puncak debit harian lebih besar daripada tahun normal (30 hari)', T, async () => {
  const { page } = desk;
  const peak = (id) =>
    page.evaluate((sid) => {
      wmApp.setScenario(sid);
      wmApp.stepDays(30);
      return Math.max(...wmApp.actions.dailySeries().q_m3s);
    }, id);
  const qe = await peak('ekstrem');
  const qn = await peak('normal');
  assert.ok(qe > qn, `ekstrem ${qe} > normal ${qn}`);
});

test('[+] stoplog dua kali membuat TMAS lebih dangkal setelah 5 hari', T, async () => {
  const { page } = desk;
  await page.evaluate(() => wmApp.setScenario('hujan'));
  await page.click('#btn-reset');
  const n0 = Number(await page.locator('#stoplog-count').innerText());
  const tmasA = await page.evaluate(() => wmApp.stepDays(5).canal.tmasCm);
  await page.click('#btn-reset');
  await page.click('#stoplog-plus');
  await page.click('#stoplog-plus');
  assert.equal(Number(await page.locator('#stoplog-count').innerText()), n0 + 2);
  assert.match(await page.locator('#stoplog-crest').innerText(), /^mercu [−+]?\d+ cm$/);
  const tmasB = await page.evaluate(() => wmApp.stepDays(5).canal.tmasCm);
  assert.ok(tmasB < tmasA, `TMAS dengan +2 stoplog (${tmasB}) < kontrol (${tmasA})`);
  await page.click('#stoplog-minus');
  await page.click('#stoplog-minus');
  assert.equal(Number(await page.locator('#stoplog-count').innerText()), n0);
});

test('▶ memajukan waktu, ⏸ membekukan; Spasi men-toggle', T, async () => {
  const { page } = desk;
  await page.evaluate(() => wmApp.setScenario('normal'));
  const t0 = await snap(page, () => wmApp.actions.getView().tDays);
  await page.click('#btn-play');
  assert.equal(await page.getAttribute('#btn-play', 'aria-pressed'), 'true');
  // SwiftShader bisa membutuhkan beberapa detik per frame saat banyak berkas diuji: tunggu waktu maju, jangan menebak durasi
  await page.waitForFunction((t) => wmApp.actions.getView().tDays > t, t0, { timeout: 30000 });
  const t1 = await snap(page, () => wmApp.actions.getView().tDays);
  assert.ok(t1 > t0, `waktu maju (${t0} → ${t1})`);
  await page.click('#btn-play');
  assert.equal(await page.getAttribute('#btn-play', 'aria-pressed'), 'false');
  await page.waitForTimeout(200); // satu frame: tampilan berhenti di snapshot terakhir
  const t2 = await snap(page, () => wmApp.actions.getView().tDays);
  await page.waitForTimeout(700);
  const t3 = await snap(page, () => wmApp.actions.getView().tDays);
  assert.equal(t3, t2, 'jeda membekukan waktu');

  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Space');
  assert.equal(await snap(page, () => wmApp.store.get().playing), true);
  await page.keyboard.press('Space');
  assert.equal(await snap(page, () => wmApp.store.get().playing), false);
  const before = await snap(page, () => wmApp.getSnapshot().hourIndex);
  await page.keyboard.press('ArrowRight');
  assert.equal(await snap(page, () => wmApp.getSnapshot().hourIndex), before + 24, '→ = +1 hari');
  // diabaikan bila fokus di input
  await page.focus('#kecepatan');
  await page.keyboard.press('r');
  assert.equal(await snap(page, () => wmApp.getSnapshot().hourIndex), before + 24, 'R diabaikan saat fokus di select');
});

test('saat dijeda, onFrame tidak menulis DOM (hanya bila teks berubah)', T, async () => {
  const { page } = desk;
  await page.evaluate(() => wmApp.stepDays(1));
  await page.waitForTimeout(300);
  const n = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let count = 0;
        const mo = new MutationObserver((list) => (count += list.length));
        for (const id of ['sim-bar', 'panel-left', 'panel-right', 'panel-bottom']) {
          mo.observe(document.getElementById(id), { subtree: true, childList: true, characterData: true, attributes: true });
        }
        setTimeout(() => {
          mo.disconnect();
          resolve(count);
        }, 1000);
      }),
  );
  assert.equal(n, 0, `mutasi DOM selama 1 detik dijeda = ${n}`);
});

test('akhir skenario: chip "Selesai" tampil dan ▶ dinonaktifkan; ↺ memulai ulang', T, async () => {
  const { page } = desk;
  await page.evaluate(() => {
    wmApp.setScenario('ekstrem');
    wmApp.stepDays(46);
  });
  await page.waitForSelector('#chip-selesai:not([hidden])', { timeout: 5000 });
  assert.equal(await page.locator('#btn-play').isDisabled(), true);
  assert.match(await page.locator('#clock').innerText(), /^Hari 45\/45|^Hari 46\/45/);
  await page.click('#btn-reset');
  assert.equal(await page.locator('#chip-selesai').isHidden(), true);
  assert.equal(await page.locator('#btn-play').isDisabled(), false);
  assert.equal(await snap(page, () => wmApp.getSnapshot().hourIndex), 0);
});

test('grafik: tooltip saat hover, legenda menonjolkan seri; tabel & Salin CSV', T, async () => {
  const { page } = desk;
  await page.evaluate(() => {
    wmApp.setScenario('normal');
    wmApp.stepDays(120);
  });
  const box = await page.locator('.chart-wrap').boundingBox();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5);
  await page.waitForSelector('.chart-tip:not([hidden])', { timeout: 5000 });
  const tip = await page.locator('.chart-tip').innerText();
  assert.match(tip, /hari \d+/);
  assert.match(tip, /TMAS/);
  assert.match(tip, /mm\/hari/);
  await page.mouse.move(box.x + box.width * 0.25, box.y - 200);
  const p1 = page.locator('.chart-legend [data-series="P1"]');
  assert.equal(await p1.getAttribute('aria-pressed'), 'false');
  await p1.click();
  assert.equal(await p1.getAttribute('aria-pressed'), 'true');
  await p1.click();

  await page.click('#tab-tabel');
  assert.equal(await page.getAttribute('#tab-tabel', 'aria-selected'), 'true');
  await page.waitForSelector('#bp-tabel .data-table tbody tr', { timeout: 5000 });
  const rows = await page.locator('#bp-tabel .data-table tbody tr').count();
  assert.ok(rows >= 120, `baris tabel = ${rows}`);
  assert.match(await page.locator('#bp-tabel thead').innerText(), /Kategori TP/);
  await page.click('#btn-copy-csv');
  await page.waitForFunction(
    () => /Tersalin/.test(document.querySelector('.tbl-status')?.textContent ?? '') || !document.querySelector('.tbl-fallback')?.hidden,
    null,
    { timeout: 5000 },
  );
  const fbVisible = await page.locator('.tbl-fallback').isVisible();
  if (fbVisible) assert.match(await page.inputValue('#csv-text'), /^hari,tanggal,hujan_mm/);
  await page.click('#tab-grafik');
  await page.waitForSelector('#chart', { state: 'visible', timeout: 5000 });
});

test('kamera, mode Manual, dan kontrol lahan menulis ke store', T, async () => {
  const { page } = desk;
  await page.click('[data-camera="penampang"]');
  assert.equal(await snap(page, () => wmApp.store.get().view.camera), 'penampang');
  assert.equal(await page.getAttribute('[data-camera="penampang"]', 'aria-pressed'), 'true');
  await page.click('[data-camera="ikhtisar"]');

  await page.selectOption('#skenario', 'manual');
  assert.equal(await snap(page, () => wmApp.store.get().scenarioId), 'manual');
  assert.equal(await page.locator('#manual-rain').isVisible(), true);
  assert.equal(await page.locator('#rain-scale').isVisible(), false);
  // label slider Manual tidak terjepit di samping legend grup (bug float/clear)
  const lw = await page.evaluate(() => document.querySelector('label[for="manual-rain"]').getBoundingClientRect().width);
  assert.ok(lw > 60, `lebar label Curah hujan = ${lw}`);
  await page.locator('#manual-rain').fill('120');
  assert.equal(await snap(page, () => wmApp.store.get().manual.rainMmd), 120);
  await page.evaluate(() => wmApp.stepDays(3));
  assert.match(await page.locator('#clock').innerText(), /^Hari 4 ·/);

  await page.selectOption('#gate-mode', 'auto');
  assert.equal(await snap(page, () => wmApp.store.get().gate.mode), 'auto');
  assert.equal(await page.locator('#auto-note').isVisible(), true);
  await page.selectOption('#gate-mode', 'manual');
  await page.selectOption('#skenario', 'normal');
  await screenshot(page, 'ui-desktop-light-manual');
  assertClean(desk.logs, 'desktop');
});

test('screenshot desktop terang (Tahun normal, 150 hari)', T, async () => {
  const { page, logs } = desk;
  await page.evaluate(() => {
    wmApp.setScenario('normal');
    wmApp.stepDays(150);
  });
  await page.waitForTimeout(300);
  // teks simpul Alur tidak keluar dari kotaknya
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll('#alur .flow-node')].flatMap((g) => {
      const box = g.querySelector('rect.flow-box').getBBox();
      return [...g.querySelectorAll('text')].filter((t) => { const b = t.getBBox(); return b.x + b.width > box.x + box.width + 0.5; }).map((t) => t.textContent);
    }),
  );
  assert.deepEqual(overflow, [], 'teks simpul Alur meluap');
  // Normal perusahaan + tidak patuh PP → catatan ketegangan
  const st = await snap(page, () => ({ cls: wmApp.getSnapshot().ind.cls.id, ok: wmApp.getSnapshot().ind.pp.now }));
  if (st.cls === 'normal' && !st.ok) assert.match(await page.locator('.tension').innerText(), /Normal.*tidak patuh/s);
  await screenshot(page, 'ui-desktop-light');
  assertClean(logs, 'desktop');
});

test('tema gelap: warna token terbaca ulang, tanpa error', T, async () => {
  const { context, page, logs } = await openApp({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  await page.evaluate(() => {
    wmApp.setScenario('ekstrem');
    wmApp.stepDays(18);
  });
  await page.waitForTimeout(300);
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.panel-right')).backgroundColor);
  assert.notEqual(bg, 'rgb(251, 251, 248)', 'panel memakai permukaan gelap');
  await screenshot(page, 'ui-desktop-dark');
  assertClean(logs, 'gelap');
  await context.close();
});

test('ponsel 390×844: tanpa scroll horizontal, tab panel bekerja', T, async () => {
  const { context, page, logs } = await openApp({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  await page.evaluate(() => {
    wmApp.setScenario('kemarau');
    wmApp.stepDays(45);
  });
  const noHScroll = () => page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth);
  assert.equal(await noHScroll(), true, 'tab Indikator');
  assert.equal(await page.getAttribute('#mtab-indikator', 'aria-selected'), 'true');
  assert.equal(await page.locator('#panel-right').isVisible(), true);
  assert.equal(await page.locator('#panel-left').isVisible(), false);
  await page.waitForTimeout(300);
  // cap skala viewport tidak menutupi bilah kamera/label atas di ponsel
  const stamp = await page.evaluate(() => {
    const r = document.querySelector('.vp-stamp').getBoundingClientRect();
    const v = document.getElementById('viewport').getBoundingClientRect();
    return { top: r.top - v.top, h: v.height };
  });
  assert.ok(stamp.top > stamp.h / 2, `cap skala di separuh bawah viewport (${stamp.top}/${stamp.h})`);
  await screenshot(page, 'ui-phone');
  await page.click('#mtab-kontrol');
  assert.equal(await page.locator('#panel-left').isVisible(), true);
  assert.equal(await page.locator('#panel-right').isVisible(), false);
  assert.equal(await noHScroll(), true, 'tab Kontrol');
  await page.click('#mtab-grafik');
  await page.waitForSelector('#chart', { state: 'visible', timeout: 5000 });
  assert.equal(await noHScroll(), true, 'tab Grafik');
  const h = await page.evaluate(() => document.getElementById('chart').getBoundingClientRect().height);
  assert.ok(h > 200, `tinggi grafik ponsel ${h}`);
  await page.locator('#panel-bottom').scrollIntoViewIfNeeded();
  await screenshot(page, 'ui-phone-grafik');
  assertClean(logs, 'ponsel');
  await context.close();
});

test('halaman Tentang Model', T, async () => {
  const { context, page, logs } = await openApp({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  await page.click('.main-nav a[data-route="tentang"]');
  await page.waitForSelector('#view-tentang:not([hidden])');
  const text = await page.locator('#view-tentang').innerText();
  for (const s of ['PP 57/2016', 'P.15/2017', 'RSPO', 'Wösten', 'Hooijer', 'Baird', 'operasional', '400 m']) {
    assert.ok(text.includes(s), `memuat "${s}"`);
  }
  assert.equal(await page.locator('#view-tentang .about-table tbody tr').count(), 6);
  await screenshot(page, 'ui-tentang');
  await page.click('.about-toc a[data-target="tentang-kategori"]');
  await page.waitForTimeout(200);
  assert.equal(await snap(page, () => wmApp.store.get().route.view), 'tentang', 'daftar isi tidak mengubah rute');
  await page.click('.main-nav a[data-route="sim"]');
  await page.waitForSelector('#view-sim:not([hidden])');
  assertClean(logs, 'tentang');
  await context.close();
});
