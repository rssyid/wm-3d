// Tes fungsi murni scene: pemetaan koordinat, derau ber-seed, kisi sawit, elevasi diorama, sampling profil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMS, mergeParams, surfaceAt, createModel, snapshot } from '../../js/model/index.js';
import {
  sceneXFromModel,
  modelXFromScene,
  palmLattice,
  palmRows,
  BLOCKS,
  PALM,
  fieldDrainZs,
  fieldDrainDistance,
  countAtOrBelow,
  piezometerPositions,
  presetPose,
  riverCenterX,
  riverHalfWidthAt,
  RIVER,
  WORLD,
  easeInOutCubic,
} from '../../js/scene/layout.js';
import { mulberry32, valueNoise2, fbm2, hash2 } from '../../js/scene/noise.js';
import { groundAt, heightAt, makeGroundCtx, gridAxis, KIND } from '../../js/scene/ground.js';
import { sampleCells, waterTableAt, wetness } from '../../js/scene/profile.js';

test('pemetaan x model ↔ X scene: x = 150 − |X|, piezometer P1–P4 di X = −135, −110, −75, 0', () => {
  assert.equal(sceneXFromModel(15), -135);
  assert.equal(sceneXFromModel(40), -110);
  assert.equal(sceneXFromModel(75), -75);
  assert.equal(sceneXFromModel(150), -0);
  assert.equal(sceneXFromModel(15, +1), 135);
  for (const X of [-150, -135, -75, 0, 42.5, 150]) assert.equal(modelXFromScene(X), 150 - Math.abs(X));
  assert.equal(modelXFromScene(-160), 0, 'di luar blok dibatasi 0');
  for (let x = 0; x <= 150; x += 7.5) {
    assert.ok(Math.abs(modelXFromScene(sceneXFromModel(x, -1)) - x) < 1e-12);
    assert.ok(Math.abs(modelXFromScene(sceneXFromModel(x, +1)) - x) < 1e-12);
  }
  const pz = piezometerPositions(DEFAULT_PARAMS);
  assert.deepEqual(
    pz.map((p) => p.X),
    [-135, -110, -75, -0],
  );
});

test('derau ber-seed deterministik dan terbatas', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
  assert.notEqual(mulberry32(7)(), mulberry32(8)());
  for (let i = 0; i < 2000; i++) {
    const x = i * 0.731 - 300;
    const z = i * 1.377 - 900;
    const v = valueNoise2(x, z, 7);
    assert.ok(v >= -1 && v <= 1);
    assert.equal(v, valueNoise2(x, z, 7));
    const f = fbm2(x / 9, z / 9, 7, 3);
    assert.ok(f >= -1 && f <= 1);
    const h = hash2(i, -i, 7);
    assert.ok(h >= 0 && h < 1);
  }
  assert.notEqual(valueNoise2(3.3, 4.4, 7), valueNoise2(3.3, 4.4, 8));
});

test('kisi sawit blok utama: ~1500 pohon, ≥ 6 m dari saluran, terurut menurut Z', () => {
  const palms = palmLattice(BLOCKS[0], { fdSpacing: DEFAULT_PARAMS.fieldDrains.spacing });
  assert.ok(palms.length >= 1350 && palms.length <= 1700, `jumlah ${palms.length}`);
  const { r0, r1 } = palmRows();
  assert.equal(r1 - r0 + 1, 40, '40 baris tanam');
  const fd = fieldDrainZs(59, -200, 200);
  assert.deepEqual(fd, [-147.5, -88.5, -29.5, 29.5, 88.5, 147.5]);
  for (let i = 0; i < palms.length; i++) {
    const p = palms[i];
    assert.ok(Math.abs(p.X) <= 150 - PALM.buffer + 1e-9, `jarak ke saluran koleksi (${p.X})`);
    for (const z of fd) assert.ok(Math.abs(p.Z - z) >= PALM.buffer - 1e-9, `jarak ke parit lapangan (${p.Z})`);
    assert.ok(Math.abs(p.Z) <= 200 - PALM.edgeBuffer + 1e-9);
    assert.notEqual(p.Z, 0, 'tidak ada pohon tepat di bidang potong');
    if (i) assert.ok(palms[i - 1].Z <= p.Z);
  }
  // jarak antar-pohon minimum = 8,5 m (kisi segitiga)
  const byKey = new Map(palms.map((p) => [`${p.X.toFixed(2)}|${p.Z.toFixed(2)}`, p]));
  let minD = Infinity;
  for (const p of palms.slice(0, 400)) {
    for (const q of palms) {
      if (p === q) continue;
      const d = Math.hypot(p.X - q.X, p.Z - q.Z);
      if (d < minD) minD = d;
    }
  }
  assert.ok(Math.abs(minD - 8.5) < 1e-6, `jarak minimum ${minD}`);
  assert.equal(byKey.size, palms.length, 'tidak ada duplikat');
  // cutaway: hitungan Z ≤ 0 lewat pencarian biner
  const zs = Float64Array.from(palms.map((p) => p.Z));
  const n0 = countAtOrBelow(zs, 0);
  assert.equal(n0, palms.filter((p) => p.Z <= 0).length);
  assert.ok(Math.abs(n0 - palms.length / 2) < palms.length * 0.06);
  // instrumen tidak tertimpa pohon
  for (const pz of piezometerPositions(DEFAULT_PARAMS)) {
    for (const p of palms) assert.ok(Math.hypot(p.X - pz.X, p.Z - pz.Z) > 2.2, `pohon terlalu dekat ${pz.id}`);
  }
});

test('kisi blok tetangga memakai aturan sama dan jarak parit lapangan periodik', () => {
  const total = BLOCKS.slice(1).reduce((s, b) => s + palmLattice(b).length, 0);
  assert.ok(total > 2000 && total < 4000, `tetangga ${total}`);
  assert.equal(fieldDrainDistance(29.5, 59), 0);
  assert.equal(fieldDrainDistance(0, 59), 29.5);
  assert.equal(fieldDrainDistance(-265.5, 59), 0);
});

test('elevasi diorama: kubah model di piezometer, galian saluran, jalan, sungai', () => {
  const ctx = makeGroundCtx(DEFAULT_PARAMS);
  const g = DEFAULT_PARAMS.geom;
  for (const p of piezometerPositions(DEFAULT_PARAMS)) {
    const h = heightAt(p.X, p.Z, ctx);
    assert.ok(Math.abs(h - surfaceAt(p.x, g)) < 1e-9, `relief nol di ${p.id}: ${h}`);
    // penampang (z = 0) juga tepat di permukaan model di X piezometer
    assert.ok(Math.abs(heightAt(p.X, 0, ctx) - surfaceAt(p.x, g)) < 1e-9);
  }
  // relief ±8 cm di tengah blok (tidak datar)
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < 400; i++) {
    const X = -100 + (i % 20) * 9.7;
    const Z = -170 + Math.floor(i / 20) * 7.3;
    const d = heightAt(X, Z, ctx) - surfaceAt(150 - Math.abs(X), g);
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  assert.ok(hi > 0.03 && lo < -0.03, `relief ${lo}…${hi}`);
  assert.ok(hi <= 0.0801 && lo >= -0.0801);
  // saluran koleksi A: dasar −1,6 di sumbunya
  assert.ok(Math.abs(heightAt(-150, -50, ctx) - g.collection.zBed) < 1e-9);
  // parit lapangan: 0,9 m di bawah permukaan alami
  const fd = groundAt(-60, 29.5, ctx, {});
  assert.ok(Math.abs(fd.surf - fd.h - DEFAULT_PARAMS.fieldDrains.depth) < 1e-9);
  assert.equal(fd.trench, 1);
  // tanpa parit lapangan → tidak ada galian
  const ctxNo = makeGroundCtx(mergeParams(DEFAULT_PARAMS, { 'fieldDrains.enabled': false }));
  assert.equal(groundAt(-60, 29.5, ctxNo, {}).trench, 0);
  // saluran utama dan jalan di atas tanggul (gorong-gorong menutup saluran koleksi)
  assert.ok(Math.abs(heightAt(0, WORLD.mainZ, ctx) - g.main.zBed) < 1e-9);
  assert.ok(Math.abs(heightAt(-150, -211, ctx) - WORLD.roadTop) < 1e-9);
  assert.equal(groundAt(0, -211, ctx, {}).kind, KIND.road);
  // sungai
  const xr = riverCenterX(-50);
  assert.ok(Math.abs(heightAt(xr, -50, ctx) - RIVER.bed) < 1e-9);
  assert.equal(riverHalfWidthAt(RIVER.bed), RIVER.halfBottom);
  assert.equal(riverHalfWidthAt(0), RIVER.halfTop);
  // kubah lebih tinggi → permukaan naik
  const ctxHd = makeGroundCtx(mergeParams(DEFAULT_PARAMS, { 'geom.Hd': 0.5 }));
  assert.ok(heightAt(0, -0.3, ctxHd) > heightAt(0, -0.3, ctx) + 0.25);
});

test('sumbu grid memuat titik patah dan tidak punya irisan tipis', () => {
  const ax = gridAxis(-10, 10, 2, [-0.1, 0, 3.3]);
  assert.equal(ax[0], -10);
  assert.equal(ax[ax.length - 1], 10);
  for (const b of [-0.1, 0, 3.3]) assert.ok(ax.includes(b));
  for (let i = 1; i < ax.length; i++) assert.ok(ax[i] > ax[i - 1]);
});

test('sampling profil: muka air tanah di X scene, kanal di tepi saluran', () => {
  const m = createModel({ scenarioId: 'normal' });
  const s = snapshot(m);
  const pr = s.profile;
  const hc = s.canal.levelM;
  assert.equal(waterTableAt(-150, pr, hc), hc);
  assert.equal(waterTableAt(160, pr, hc), hc);
  assert.ok(Math.abs(waterTableAt(-(150 - pr.x[3]), pr, hc) - pr.z[3]) < 1e-12);
  assert.ok(Math.abs(waterTableAt(150 - pr.x[3], pr, hc) - pr.z[3]) < 1e-12, 'simetris');
  assert.equal(waterTableAt(0, pr, hc), pr.z[pr.z.length - 1]);
  const mid = sampleCells([1, 3], [10, 20], 2);
  assert.equal(mid, 15);
  assert.equal(sampleCells([2.5, 7.5], [1, 2], 0, 0), 0);
  assert.equal(wetness(0), 1);
  assert.equal(wetness(60), 0);
  assert.equal(wetness(30), 0.5);
});

test('preset kamera: target y diskalakan VE, jarak bertambah di viewport sempit', () => {
  const a = presetPose('penampang', 10, 1.6);
  assert.equal(a.target[1], -36);
  assert.ok(a.pos[1] < a.target[1] && a.pos[1] < -55 && a.pos[1] > -56, 'kamera tepat di bawah lantai potongan (lantai tidak terlihat)');
  assert.equal(a.fov, 35);
  assert.equal(a.cutaway, true);
  const b = presetPose('penampang', 20, 1.6);
  assert.equal(b.target[1], -72);
  const ratio = (b.pos[1] - b.target[1]) / (a.pos[1] - a.target[1]);
  assert.ok(Math.abs(ratio - 2) < 0.05, `selisih tinggi ikut VE (${ratio})`);
  const c1 = presetPose('penampang', 1, 1.6);
  assert.ok(c1.pos[1] < -5.5 && c1.pos[1] > -5.6, 'VE 1: kamera tetap tepat di bawah lantai potongan');
  const top = presetPose('atas', 10, 1.6, true);
  assert.ok(top.target[2] < -80, 'pandangan atas berpusat di setengah blok yang tersisa saat cutaway');
  assert.ok(presetPose('atas', 10, 1.6, false).target[2] > -40);
  const narrow = presetPose('penampang', 10, 0.8);
  assert.ok(narrow.pos[2] > a.pos[2] * 1.3, 'mundur pada layar ponsel');
  const ik = presetPose('ikhtisar', 10, 1.6);
  assert.deepEqual(ik.target, [-5, -30, -45]);
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
});
