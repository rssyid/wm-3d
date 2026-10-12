// Tes integrasi lintas-area: navigasi riwayat, penyegaran input, titik penaatan, Ulang, akhir skenario.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers/server.js';
import { launchBrowser, newPage } from './helpers/browser.js';

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

async function open(opts) {
  const ctx = await newPage(browser, opts);
  await ctx.page.goto(server.url, { waitUntil: 'load' });
  await ctx.page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
  return ctx;
}

test('tombol Kembali tetap di dalam aplikasi; judul halaman mengikuti tab; #/tentang dinormalkan', async () => {
  const { context, page, logs } = await open();
  await page.click('.main-nav a[data-route="persamaan"]');
  await page.waitForFunction(() => location.hash.startsWith('#persamaan.'));
  assert.match(await page.title(), /·/);
  await page.click('.main-nav a[data-route="tentang"]');
  await page.waitForFunction(() => location.hash === '#tentang');
  assert.match(await page.title(), /^Tentang Model/);
  await page.goBack();
  await page.waitForFunction(() => location.hash.startsWith('#persamaan.'));
  assert.equal(await page.evaluate(() => typeof window.wmApp), 'object', 'masih di aplikasi yang sama');
  assert.equal(await page.isVisible('#view-persamaan'), true);
  await page.goBack();
  await page.waitForFunction(() => !location.hash.startsWith('#persamaan.'));
  assert.equal(await page.isVisible('#view-sim'), true);
  await page.evaluate(() => {
    location.hash = '#/tentang';
  });
  await page.waitForFunction(() => location.hash === '#tentang');
  assert.deepEqual(logs.errors, []);
  await context.close();
});

test('mode Manual: slider hujan & sungai langsung menyegarkan snapshot dan KPI saat dijeda', async () => {
  const { context, page, logs } = await open();
  await page.evaluate(() => wmApp.setScenario('manual'));
  await page.evaluate(() => wmApp.store.patch('manual', { rainMmd: 120, riverM: -0.3 }));
  const s = await page.evaluate(() => {
    const snap = wmApp.getSnapshot();
    return { rain: snap.forcing.rain_mmh, river: snap.river.levelM };
  });
  assert.ok(Math.abs(s.rain - 5) < 1e-9, `hujan per jam ${s.rain}`);
  assert.ok(Math.abs(s.river - -0.3) < 1e-9, `sungai ${s.river}`);
  await page.waitForFunction(() => /5,0\s*mm\/jam/.test(document.querySelector('[data-kpi="rain"]')?.textContent ?? ''));
  assert.deepEqual(logs.errors, []);
  await context.close();
});

test('ganti titik penaatan di tengah jalan: statistik PP & tabel konsisten; tab Persamaan ikut', async () => {
  const { context, page, logs } = await open();
  await page.evaluate(() => wmApp.stepDays(10));
  await page.evaluate(() => wmApp.store.patch('land', { tpId: 'P2' }));
  const r = await page.evaluate(() => {
    const snap = wmApp.getSnapshot();
    const series = wmApp.actions.dailySeries();
    const done = series.partial.map((p, i) => (!p ? i : -1)).filter((i) => i >= 0);
    const expected = done.filter((i) => series.depthCm.P2[i] <= 40).length;
    return {
      compliant: snap.ind.pp.compliantDays,
      expected,
      tp: snap.ind.tpId,
      eqPz: wmApp.store.get().eq.piezometer,
      tpSeriesOk: done.every((i) => series.tpDepthCm[i] === series.depthCm.P2[i]),
    };
  });
  assert.equal(r.tp, 'P2');
  assert.equal(r.compliant, r.expected);
  assert.equal(r.tpSeriesOk, true);
  assert.equal(r.eqPz, 'P2', 'pilihan piezometer tab Persamaan mengikuti titik penaatan');
  assert.deepEqual(logs.errors, []);
  await context.close();
});

test('Ulang setelah mode otomatis memutar ulang skenario dari stoplog awal', async () => {
  const { context, page, logs } = await open();
  await page.evaluate(() => {
    wmApp.setScenario('kemarau');
    wmApp.store.patch('gate', { mode: 'auto' });
    wmApp.stepDays(30);
  });
  const before = await page.evaluate(() => wmApp.store.get().gate.nLogs);
  assert.notEqual(before, 7, 'mode otomatis sudah mengubah stoplog');
  await page.click('#btn-reset');
  const after = await page.evaluate(() => ({ n: wmApp.store.get().gate.nLogs, model: wmApp.model.control.nLogs, t: wmApp.getSnapshot().tDays }));
  assert.equal(after.n, 7);
  assert.equal(after.model, 7);
  assert.equal(after.t, 0);
  assert.deepEqual(logs.errors, []);
  await context.close();
});

test('akhir skenario: jam "Hari 45/45 … 24.00" dan +1 hari nonaktif', async () => {
  const { context, page, logs } = await open();
  await page.evaluate(() => {
    wmApp.setScenario('ekstrem');
    wmApp.stepDays(46);
  });
  await page.waitForFunction(() => /Hari 45\/45/.test(document.querySelector('#clock')?.textContent ?? ''));
  const clock = await page.textContent('#clock');
  assert.match(clock, /24\.00/);
  assert.equal(await page.isDisabled('#btn-step'), true);
  assert.equal(await page.isDisabled('#btn-play'), true);
  assert.deepEqual(logs.errors, []);
  await context.close();
});

test('angka TMAT di dekat batas kategori memakai desimal', async () => {
  const { context, page } = await open();
  const out = await page.evaluate(async () => {
    const f = await import('./js/ui/format.js');
    return [f.fmtElevClassCm(45.08), f.fmtElevClassCm(40.19), f.fmtElevClassCm(52.4), f.fmtElevClassCm(60.02)];
  });
  assert.deepEqual(out, ['−45,1 cm', '−40,2 cm', '−52 cm', '−60,02 cm']);
  await context.close();
});

test('hari terakhir skenario masuk ke tabel/grafik; ▶ setelah +1 hari tidak memutar ulang tampilan', async () => {
  const { context, page, logs } = await open();
  await page.evaluate(() => {
    wmApp.setScenario('ekstrem');
    wmApp.stepDays(44);
    wmApp.stepHours(24);
  });
  const n = await page.evaluate(() => ({ n: wmApp.actions.dailySeries().n }));
  assert.equal(n.n, 45);
  await page.click('.bottom-tabs [data-tab="tabel"], [data-tab="tabel"]').catch(() => {});
  const rows = await page.evaluate(() => document.querySelectorAll('.tbl-view tbody tr').length);
  assert.equal(rows, 45, 'tabel memuat hari ke-45');
  // ▶ setelah lompatan: tampilan tidak mundur
  await page.evaluate(() => {
    wmApp.reset?.();
    wmApp.actions.reset();
    wmApp.setScenario('normal');
    wmApp.stepHours(1440);
    wmApp.actions.stepDay();
  });
  const t0 = await page.evaluate(() => wmApp.actions.getView().tDays);
  await page.evaluate(() => wmApp.actions.play());
  const samples = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const out = [];
        let c = 0;
        const tick = () => {
          out.push(wmApp.actions.getView().tDays);
          if (++c < 12) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      }),
  );
  for (const t of samples) assert.ok(t >= t0 - 1e-9, `tampilan mundur: ${t} < ${t0}`);
  assert.deepEqual(logs.errors, []);
  await context.close();
});

test('tren "muka air naik/turun per 24 jam" mengikuti titik penaatan baru', async () => {
  const { context, page, logs } = await open();
  const r = await page.evaluate(async () => {
    wmApp.stepHours(24 * 50 + 7);
    wmApp.store.patch('land', { tpId: 'P1' });
    const h = (await import('./js/model/index.js')).hourlySeries(wmApp.model, 25);
    const snap = wmApp.getSnapshot();
    const p1Now = snap.piezometers.find((p) => p.id === 'P1').depthCm;
    return { tpNow: h.tpDepthCm.at(-1), p1Now, tp24: h.tpDepthCm[0], pz24: h.pz0[0] };
  });
  assert.ok(Math.abs(r.tpNow - r.p1Now) < 1.5, `riwayat jam terakhir mengikuti P1 (${r.tpNow} vs ${r.p1Now})`);
  assert.equal(r.tp24, r.pz24, 'riwayat 24 jam lalu juga dari P1');
  assert.deepEqual(logs.errors, []);
  await context.close();
});
