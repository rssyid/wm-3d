import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTmat,
  ppCompliant,
  cmykToHex,
  TMAT_CLASSES,
  classifyTmas,
  subsidenceRate,
  fireRiskIndex,
  classifyFire,
  autoGateDecision,
  createModel,
  advance,
  snapshot,
  explain,
  setParams,
  waterBalance,
  surfaceAt,
  DEFAULT_PARAMS,
} from '../../js/model/index.js';

test('kategori TMAT perusahaan pada batas-batasnya', () => {
  const cases = [
    [-0.01, 'banjir'],
    [-5, 'banjir'],
    [0, 'tergenang'],
    [40, 'tergenang'],
    [40.01, 'agak-tergenang'],
    [45, 'agak-tergenang'],
    [45.01, 'normal'],
    [60, 'normal'],
    [60.01, 'agak-kering'],
    [65, 'agak-kering'],
    [65.01, 'kering'],
    [150, 'kering'],
  ];
  for (const [d, id] of cases) assert.equal(classifyTmat(d).id, id, `d=${d}`);
});

test('kewajiban PP 57/2016: ≤ 40 cm patuh; 50 cm = Normal tetapi tidak patuh', () => {
  assert.equal(ppCompliant(40), true);
  assert.equal(ppCompliant(40.01), false);
  assert.equal(classifyTmat(50).id, 'normal');
  assert.equal(ppCompliant(50), false);
});

test('warna CMYK → hex sesuai ketentuan perusahaan', () => {
  assert.equal(cmykToHex([0, 0, 0, 100]), '#000000');
  assert.equal(cmykToHex([65, 42, 0, 23]), '#4572C4');
  assert.equal(cmykToHex([100, 20, 0, 0]), '#00CCFF');
  assert.equal(cmykToHex([19, 0, 59, 62]), '#4E6128');
  assert.equal(cmykToHex([0, 0, 60, 0]), '#FFFF66');
  assert.equal(cmykToHex([0, 100, 100, 0]), '#FF0000');
  assert.deepEqual(
    TMAT_CLASSES.map((c) => c.color),
    ['#000000', '#4572C4', '#00CCFF', '#4E6128', '#FFFF66', '#FF0000'],
  );
});

test('kelas TMAS, subsidensi, dan indeks kebakaran', () => {
  assert.equal(classifyTmas(0).id, 'meluap');
  assert.equal(classifyTmas(-3).id, 'meluap');
  assert.equal(classifyTmas(30).id, 'siaga-banjir');
  assert.equal(classifyTmas(50).id, 'tinggi');
  assert.equal(classifyTmas(60).id, 'optimal');
  assert.equal(classifyTmas(100).id, 'rendah');
  assert.equal(classifyTmas(101).id, 'sangat-rendah');
  assert.ok(Math.abs(subsidenceRate(70) - 5) < 1e-12);
  assert.ok(Math.abs(subsidenceRate(40) - 3.5) < 1e-12);
  let prev = -1;
  for (let d = 0; d <= 150; d += 5) {
    const f = fireRiskIndex(d, 10);
    assert.ok(f >= prev);
    prev = f;
  }
  assert.equal(classifyFire(10).id, 'rendah');
  assert.equal(classifyFire(80).id, 'sangat-tinggi');
});

test('aturan otomatis pintu air', () => {
  const base = { nLogs: 7, nMax: 9, tmasCm: 50, ponded: false, riverM: -2, canalM: -0.5, daysSinceLast: 10, target: 'perusahaan' };
  assert.equal(autoGateDecision({ ...base, dMeanCm: 30 }).nLogs, 6);
  assert.equal(autoGateDecision({ ...base, dMeanCm: 70 }).nLogs, 8);
  assert.equal(autoGateDecision({ ...base, dMeanCm: 50 }).nLogs, 7);
  assert.equal(autoGateDecision({ ...base, dMeanCm: 70, daysSinceLast: 1 }).nLogs, 7);
  assert.equal(autoGateDecision({ ...base, dMeanCm: 35, target: 'pp' }).nLogs, 7);
  assert.equal(autoGateDecision({ ...base, dMeanCm: 50, target: 'pp' }).nLogs, 8);
  // darurat: buang 2 papan bila sungai lebih rendah; tahan bila sungai tinggi
  assert.equal(autoGateDecision({ ...base, dMeanCm: 10, tmasCm: 10 }).nLogs, 5);
  const hold = autoGateDecision({ ...base, dMeanCm: 10, ponded: true, riverM: -0.3, canalM: -0.3 });
  assert.equal(hold.nLogs, 7);
  assert.equal(hold.action.type, 'tahan');
});

test('kubah gambut: zs(0) = tanggul, zs(Lh) = Hd; kedalaman = zs − z; genangan hanya bila z > zs', () => {
  const g = DEFAULT_PARAMS.geom;
  assert.equal(surfaceAt(0, g), 0);
  assert.ok(Math.abs(surfaceAt(g.Lh, g) - g.Hd) < 1e-12);
  const m = createModel({ scenarioId: 'ekstrem', params: { 'geom.Hd': 0.5 } });
  advance(m, 24 * 20);
  const s = snapshot(m);
  for (const p of s.piezometers) assert.ok(Math.abs(p.depthCm - 100 * (p.surfaceM - p.levelM)) < 1e-9);
  for (let i = 0; i < s.profile.z.length; i++) {
    const pondedNow = s.profile.z[i] - s.profile.zs[i] > 0.001;
    assert.equal(Boolean(s.profile.ponded[i]), pondedNow);
  }
  assert.ok(waterBalance(m).relError < 1e-9);
});

test('Hd = 0 → permukaan datar; mengubah Hd mempertahankan simpanan (kedalaman lokal)', () => {
  const m = createModel({ scenarioId: 'normal', params: { 'geom.Hd': 0 } });
  const s0 = snapshot(m);
  for (const v of s0.profile.zs) assert.equal(v, 0);
  const d0 = s0.piezometers.map((p) => p.depthCm);
  setParams(m, { 'geom.Hd': 0.4 });
  const d1 = snapshot(m).piezometers.map((p) => p.depthCm);
  for (let i = 0; i < d0.length; i++) assert.ok(Math.abs(d0[i] - d1[i]) < 1e-6);
});

test('explain() konsisten dengan engine', () => {
  const m = createModel({ scenarioId: 'hujan' });
  advance(m, 24 * 15 + 7);
  const s = snapshot(m);
  const e = explain(m, { piezometer: 'P3' });
  assert.ok(Math.abs(e.weir.Q - s.structure.q_m3s) < 1e-15);
  assert.ok(Math.abs(e.cell.dzdt * e.cell.Sy - e.cell.net) < 1e-12);
  const t = e.canal.terms;
  assert.ok(Math.abs(e.canal.net - (t.rain - t.evap + t.seepage + t.drains + t.runoff - t.weir)) < 1e-9);
  assert.ok(Math.abs(e.cell.zeta - (e.cell.zs - e.cell.z)) < 1e-12);
  assert.ok(e.numerics.dt > 0 && e.numerics.dt <= 1 / 24);
});
