// Tes e2e scene 3D: anggaran render, preset kamera, skenario (genangan/kemarau), VE, close-up, label & picking,
// tween stoplog, tema gelap, ponsel, gerak dikurangi, dan bangun ulang geometri. Screenshot → test-results/screenshots.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer } from './helpers/server.js';
import { launchBrowser, newPage, screenshot, SCREENSHOT_DIR } from './helpers/browser.js';

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

async function openApp(opts = {}) {
  const ctx = await newPage(browser, opts);
  if (opts.reducedMotion) await ctx.page.emulateMedia({ reducedMotion: 'reduce' });
  await ctx.page.goto(server.url, { waitUntil: 'load' });
  await ctx.page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
  await ctx.page.evaluate(() => window.wmApp.ready);
  return ctx;
}

/** Info debug scene (modul ES yang sama dengan yang dimuat main.js). */
function sceneInfo(page) {
  return page.evaluate(async () => (await import('./js/scene/index.js')).sceneDebug.info());
}

async function vpShot(page, name) {
  await page.evaluate(() => window.wmApp.renderOnce());
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.locator('#viewport').screenshot({ path: file });
  return file;
}

function assertClean(logs) {
  assert.deepEqual(logs.errors, [], 'tidak boleh ada error console');
  assert.deepEqual(logs.warnings, [], 'tidak boleh ada warning console');
  assert.deepEqual(logs.external, [], 'tidak boleh ada request eksternal');
}

test('render: WebGL2, ≤ 60 draw call, ≤ 600 ribu segitiga (tinggi), ≤ 250 ribu (rendah), warna beragam', { timeout: 240000 }, async () => {
  const { context, page, logs } = await openApp();
  const info = await page.evaluate(() => {
    window.wmApp.renderOnce();
    return window.wmApp.renderInfo();
  });
  assert.equal(info.webgl2, true);
  assert.ok(info.calls > 0 && info.calls <= 60, `draw call ${info.calls}`);
  assert.ok(info.triangles <= 600000, `segitiga ${info.triangles}`);
  assert.ok((await page.evaluate(() => window.wmApp.sampleColors())) > 8, 'scene tidak kosong');
  const si = await sceneInfo(page);
  assert.equal(si.quality, 'tinggi');
  assert.equal(si.shadows, true, 'bayangan aktif di kualitas tinggi');
  assert.ok(si.palms.main >= 1400 && si.palms.main <= 1700, `sawit blok utama ${si.palms.main}`);
  assert.ok(si.palms.neighbours > 2000, `sawit tetangga ${si.palms.neighbours}`);
  assert.deepEqual(await page.evaluate(async () => (await import('./js/scene/index.js')).sceneDebug.nanGeometries()), []);
  await screenshot(page, 'scene-desktop');

  // cutaway mati: semua pohon & terrain digambar — tetap dalam anggaran
  const off = await page.evaluate(() => {
    window.wmApp.store.patch('view', { cutaway: false });
    window.wmApp.renderOnce();
    return window.wmApp.renderInfo();
  });
  assert.ok(off.calls <= 60, `draw call (cutaway mati) ${off.calls}`);
  assert.ok(off.triangles <= 600000, `segitiga (cutaway mati) ${off.triangles}`);
  assert.equal((await sceneInfo(page)).sectionVisible, false);

  // kualitas rendah (cutaway hidup lagi, lalu mati)
  const low = await page.evaluate(() => {
    window.wmApp.store.patch('view', { quality: 'rendah', cutaway: true });
    window.wmApp.renderOnce();
    return window.wmApp.renderInfo();
  });
  assert.ok(low.triangles <= 250000, `segitiga rendah ${low.triangles}`);
  const lowOff = await page.evaluate(() => {
    window.wmApp.store.patch('view', { cutaway: false });
    window.wmApp.renderOnce();
    return window.wmApp.renderInfo();
  });
  assert.ok(lowOff.triangles <= 250000, `segitiga rendah tanpa cutaway ${lowOff.triangles}`);
  const si2 = await sceneInfo(page);
  assert.equal(si2.shadows, false, 'tanpa bayangan di kualitas rendah');
  assert.ok((await page.evaluate(() => window.wmApp.sampleColors())) > 8);
  assertClean(logs);
  await context.close();
});

test('preset kamera ikhtisar / penampang / pintu-air / atas (tween 0,8 s)', { timeout: 240000 }, async () => {
  const { context, page, logs } = await openApp();
  for (const id of ['ikhtisar', 'penampang', 'pintu-air', 'atas']) {
    await page.evaluate((cid) => window.wmApp.actions.setCamera(cid), id);
    await page.waitForTimeout(1100);
    const si = await sceneInfo(page);
    assert.equal(si.preset, id);
    if (id === 'penampang') assert.equal(si.cutaway, true, 'penampang memaksa cutaway');
    await vpShot(page, `scene-${id}`);
  }
  const pressed = await page.locator('[data-camera="atas"]').getAttribute('aria-pressed').catch(() => null);
  if (pressed != null) assert.equal(pressed, 'true');
  assertClean(logs);
  await context.close();
});

test('skenario ekstrem hari 15: genangan terlihat, hujan, peringatan pintu terendam', { timeout: 240000 }, async () => {
  const { context, page, logs } = await openApp();
  const snap = await page.evaluate(() => {
    window.wmApp.setScenario('ekstrem');
    const s = window.wmApp.stepDays(15);
    return { pond: s.ponding.maxCm, rain: s.forcing.rain_mmh, riverAbove: s.structure.riverAboveCrest, q: s.structure.q_m3s };
  });
  assert.ok(snap.pond > 0, 'model tergenang');
  await page.waitForTimeout(1500); // langit menggelap (τ 0,6 s)
  const si = await sceneInfo(page);
  assert.equal(si.pond, true, 'lembar genangan tampil');
  if (snap.rain >= 0.1) assert.ok(si.rain > 0, 'garis hujan tampil');
  assert.ok(si.cloud > 0.5, `mendung ${si.cloud}`);
  const gateText = await page.locator('[data-scene="gate"]').textContent();
  // sungai di atas mercu: "Terendam" bila air masih keluar, "Aliran balik" hanya bila Q < 0
  if (snap.riverAbove) assert.match(gateText, snap.q < 0 ? /Aliran balik/ : /Terendam/);
  assert.doesNotMatch(gateText, /Air balik/);
  await vpShot(page, 'scene-ekstrem');
  await page.evaluate(() => window.wmApp.actions.setCamera('pintu-air'));
  await page.waitForTimeout(1100);
  await vpShot(page, 'scene-ekstrem-pintu-air');
  assertClean(logs);
  await context.close();
});

test('skenario kemarau 90 hari: muka air dalam, label sama dengan snapshot', { timeout: 240000 }, async () => {
  const { context, page, logs } = await openApp();
  const res = await page.evaluate(async () => {
    const { fmtElevCm } = await import('./js/ui/format.js');
    window.wmApp.setScenario('kemarau');
    const s = window.wmApp.stepDays(90);
    window.wmApp.renderOnce();
    return {
      expected: s.piezometers.map((p) => `${p.id} · ${fmtElevCm(p.depthCm)}`),
      tmas: `TMAS ${fmtElevCm(s.canal.tmasCm)}`,
      labels: s.piezometers.map((p) => document.querySelector(`[data-scene="pz-${p.id}"]`)?.textContent ?? ''),
      gauge: document.querySelector('[data-scene="gauge"]')?.textContent ?? '',
      pond: s.ponding.maxCm,
    };
  });
  res.expected.forEach((e, i) => assert.ok(res.labels[i].includes(e), `label ${res.labels[i]} memuat ${e}`));
  assert.ok(res.gauge.includes(res.tmas), `${res.gauge} memuat ${res.tmas}`);
  assert.equal((await sceneInfo(page)).pond, false, 'tanpa genangan di kemarau');
  await vpShot(page, 'scene-kemarau');
  await page.evaluate(() => window.wmApp.actions.setCamera('penampang'));
  await page.waitForTimeout(1100);
  await vpShot(page, 'scene-kemarau-penampang');
  assertClean(logs);
  await context.close();
});

test('eksagerasi vertikal ×1 dan ×20', { timeout: 240000 }, async () => {
  const { context, page, logs } = await openApp();
  for (const ve of [1, 20]) {
    await page.evaluate((v) => {
      window.wmApp.store.patch('view', { ve: v });
      window.wmApp.actions.setCamera('penampang');
    }, ve);
    await page.waitForTimeout(1100);
    assert.equal((await sceneInfo(page)).ve, ve);
    await vpShot(page, `scene-ve${ve}`);
  }
  await page.evaluate(() => window.wmApp.actions.setCamera('ikhtisar'));
  await page.waitForTimeout(1100);
  await vpShot(page, 'scene-ve20-ikhtisar');
  assertClean(logs);
  await context.close();
});

test('close-up sawit & terrain (piringan, pasar pikul, gawangan mati, mikro-relief)', { timeout: 240000 }, async () => {
  const { context, page, logs } = await openApp();
  await page.evaluate(async () => {
    const m = await import('./js/scene/index.js');
    m.sceneDebug.setPose([-62, 9, 20], [-46, 1, -12]);
  });
  await page.waitForTimeout(300);
  await vpShot(page, 'scene-closeup');
  await page.evaluate(async () => {
    const m = await import('./js/scene/index.js');
    m.sceneDebug.setPose([-40, 4, -30], [-36, 5, -60]);
  });
  await page.waitForTimeout(300);
  await vpShot(page, 'scene-closeup-kebun');
  assertClean(logs);
  await context.close();
});

test('label tombol & picking: klik label dan raycast memanggil onPick', { timeout: 240000 }, async () => {
  const { context, page, logs } = await openApp();
  const btn = page.locator('[data-scene="pz-P3"]');
  assert.equal(await btn.evaluate((el) => el.tagName), 'BUTTON');
  // label bisa difokus (aksesibilitas)
  await btn.focus();
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.scene), 'pz-P3');
  await btn.click();
  const card = page.locator('.vp-card');
  if ((await card.count()) > 0) {
    await card.waitFor({ state: 'visible', timeout: 5000 });
    assert.match(await card.textContent(), /P3/);
    await page.keyboard.press('Escape');
  }
  // raycast: klik pada kolom air/pipa piezometer P2 di penampang
  await page.evaluate(() => window.wmApp.actions.setCamera('penampang'));
  await page.waitForTimeout(1100);
  const pt = await page.evaluate(async () => {
    window.wmApp.renderOnce(); // selesaikan tween kamera sebelum proyeksi
    const m = await import('./js/scene/index.js');
    const a = m.sceneDebug.anchors().piezometers[1];
    return m.sceneDebug.project([a[0], -12, 0.6]);
  });
  const box = await page.locator('#viewport canvas').first().boundingBox();
  assert.ok(pt.inFront && pt.x > 0 && pt.y > 0 && pt.x < box.width && pt.y < box.height, 'P2 terlihat');
  await page.mouse.click(box.x + pt.x, box.y + pt.y);
  if ((await card.count()) > 0) {
    await card.waitFor({ state: 'visible', timeout: 5000 });
    assert.match(await card.textContent(), /P2/);
  }
  // label bisa disembunyikan
  await page.evaluate(() => window.wmApp.store.patch('view', { labels: false }));
  await page.evaluate(() => window.wmApp.renderOnce());
  assert.equal(await page.locator('.sc-labels').isHidden(), true);
  assertClean(logs);
  await context.close();
});

test('stoplog: tween papan 250 ms, nappe muncul bila ada luapan', { timeout: 240000 }, async () => {
  const { context, page, logs } = await openApp();
  await page.evaluate(() => window.wmApp.actions.setCamera('pintu-air'));
  await page.waitForTimeout(1100);
  const n0 = await page.evaluate(() => window.wmApp.getSnapshot().structure.nLogs);
  const before0 = await sceneInfo(page);
  assert.equal(before0.planks.count, n0);
  await page.evaluate(() => {
    window.wmApp.store.patch('gate', { nLogs: 5 });
    window.wmApp.renderOnce();
  });
  const mid = await sceneInfo(page);
  assert.equal(mid.planks.target, 5);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.wmApp.renderOnce());
  const after = await sceneInfo(page);
  assert.equal(after.planks.target, 5);
  assert.equal(after.planks.count, 5);
  assert.equal(after.planks.animating, false);
  const head = await page.evaluate(() => window.wmApp.getSnapshot().structure.headCm);
  assert.equal(after.nappe, head > 0.5, `nappe sesuai head ${head}`);
  await vpShot(page, 'scene-pintu-air-5');
  assertClean(logs);
  await context.close();
});

test('tema gelap dan ponsel 390 px (tanpa scroll horizontal)', { timeout: 240000 }, async () => {
  {
    const { context, page, logs } = await openApp({ colorScheme: 'dark' });
    await screenshot(page, 'scene-dark');
    assertClean(logs);
    await context.close();
  }
  {
    const { context, page, logs } = await openApp({ viewport: { width: 390, height: 844 } });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(sw <= 390, `scrollWidth ${sw}`);
    const info = await page.evaluate(() => window.wmApp.renderInfo());
    assert.ok(info.triangles <= 250000, `ponsel (rendah) ${info.triangles}`);
    await screenshot(page, 'scene-phone');
    await vpShot(page, 'scene-phone-viewport');
    assertClean(logs);
    await context.close();
  }
});

test('prefers-reduced-motion: preset kamera langsung tanpa tween', { timeout: 240000 }, async () => {
  const { context, page, logs } = await openApp({ reducedMotion: true });
  const r = await page.evaluate(async () => {
    const m = await import('./js/scene/index.js');
    window.wmApp.actions.setCamera('atas');
    window.wmApp.renderOnce();
    return m.sceneDebug.info();
  });
  assert.equal(r.preset, 'atas');
  assert.ok(r.camera[1] > 250, `kamera langsung di atas (${r.camera[1]})`);
  assert.equal(r.reduceMotion, true);
  // garis hujan tetap tampil tetapi tidak bergerak saat simulasi berjalan
  await page.evaluate(() => {
    window.wmApp.setScenario('ekstrem');
    window.wmApp.stepDays(14);
    window.wmApp.actions.play();
  });
  await page.waitForTimeout(800);
  const m = await sceneInfo(page);
  await page.evaluate(() => window.wmApp.actions.pause());
  assert.equal(m.rainTime, 0, 'animasi hujan diam di mode gerak dikurangi');
  assertClean(logs);
  await context.close();
});

test('bangun ulang geometri: kubah 0,6 m dan parit lapangan dimatikan', { timeout: 240000 }, async () => {
  const { context, page, logs } = await openApp();
  await page.evaluate(() => {
    window.wmApp.store.patch('land', { Hd: 0.6 });
    window.wmApp.renderOnce();
  });
  await page.evaluate(() => window.wmApp.actions.setCamera('penampang'));
  await page.waitForTimeout(1100);
  await vpShot(page, 'scene-kubah-60');
  await page.evaluate(() => {
    window.wmApp.store.patch('land', { fieldDrains: false });
    window.wmApp.renderOnce();
  });
  assert.deepEqual(await page.evaluate(async () => (await import('./js/scene/index.js')).sceneDebug.nanGeometries()), []);
  const info = await page.evaluate(() => window.wmApp.renderInfo());
  assert.ok(info.calls > 0 && info.calls <= 60);
  assertClean(logs);
  await context.close();
});

test('skenario normal (60 hari, berjalan) dan Manual (hujan lebat, sungai tinggi): label konsisten dengan snapshot', { timeout: 300000 }, async () => {
  const { context, page, logs } = await openApp();
  // normal: jalankan sebentar dengan play (partikel & interpolasi aktif), lalu jeda
  await page.evaluate(() => {
    window.wmApp.stepDays(60);
    window.wmApp.actions.play();
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.wmApp.actions.pause());
  await page.waitForTimeout(200);
  const tp = await page.evaluate(() => {
    window.wmApp.renderOnce();
    const s = window.wmApp.getSnapshot();
    const p = s.piezometers.find((x) => x.isTP);
    return { id: p.id, ok: p.ppCompliant, text: document.querySelector(`[data-scene="pz-${p.id}"]`)?.textContent ?? '' };
  });
  assert.match(tp.text, tp.ok ? /PP ✓ patuh/ : /PP ✗ tidak patuh/, `tag TP ${tp.text}`);
  await vpShot(page, 'scene-normal-60');
  // Manual: hujan 150 mm/hari, sungai −0,3 m
  await page.selectOption('#skenario', 'manual');
  await page.evaluate(() => {
    window.wmApp.store.patch('manual', { rainMmd: 150, riverM: -0.3 });
    window.wmApp.stepDays(5);
  });
  await page.waitForTimeout(1500);
  const man = await page.evaluate(async () => {
    const { fmtElevCm } = await import('./js/ui/format.js');
    window.wmApp.renderOnce();
    const s = window.wmApp.getSnapshot();
    return {
      scen: s.scenarioId,
      rain: s.forcing.rain_mmh,
      gauge: document.querySelector('[data-scene="gauge"]')?.textContent ?? '',
      tmas: `TMAS ${fmtElevCm(s.canal.tmasCm)}`,
    };
  });
  assert.equal(man.scen, 'manual');
  assert.ok(man.gauge.includes(man.tmas), `${man.gauge} memuat ${man.tmas}`);
  const si = await sceneInfo(page);
  if (man.rain >= 0.1) assert.ok(si.rain > 0, 'hujan tampil di mode Manual');
  await vpShot(page, 'scene-manual');
  await page.evaluate(() => window.wmApp.actions.setCamera('pintu-air'));
  await page.waitForTimeout(1100);
  await vpShot(page, 'scene-manual-pintu-air');
  await page.evaluate(() => window.wmApp.actions.setCamera('atas'));
  await page.waitForTimeout(1100);
  await vpShot(page, 'scene-manual-atas');
  assertClean(logs);
  await context.close();
});
