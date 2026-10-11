import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModel, advance, snapshot, waterBalance, manualForcing, runScenario } from '../../js/model/index.js';

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sum = (a) => a.reduce((x, y) => x + y, 0);

test('stabil pada Ks = 1000, dx = 2 m, hujan 300 mm/hari selama 5 hari', () => {
  const m = createModel({
    forcing: manualForcing({ rainMmd: 300, etpMmd: 0, riverM: -2 }),
    params: { 'peat.Ks': 1000, 'geom.N': 75 },
  });
  let prev = snapshot(m).profile.depthCm;
  for (let d = 0; d < 5; d++) {
    for (let h = 0; h < 24; h++) {
      const s = advance(m, 1);
      for (let i = 0; i < s.profile.depthCm.length; i++) {
        assert.ok(Number.isFinite(s.profile.z[i]));
        assert.ok(s.profile.depthCm[i] <= prev[i] + 1e-4, `sel ${i} makin dalam saat hujan`);
      }
      assert.ok(s.canal.volumeM3 >= 0);
      prev = s.profile.depthCm;
    }
  }
  assert.ok(waterBalance(m).relError < 1e-9);
});

test('solusi analitik keadaan tunak (K seragam, R = 1 mm/hari, kanal −0,8 m)', () => {
  const m = createModel({
    forcing: manualForcing({ rainMmd: 1, etpMmd: 0, riverM: -3 }),
    params: { 'peat.Ks': 5, 'peat.Kd': 5, 'geom.Hd': 0, 'fieldDrains.enabled': false, fixedCanalLevel: -0.8 },
    init: { tmatCm: 30 },
  });
  advance(m, 24 * 1500);
  const s = snapshot(m);
  const K = 5;
  const R = 0.001;
  const Lh = 150;
  const b0 = -0.8 - -4.0;
  for (let i = 0; i < s.profile.x.length; i++) {
    const x = s.profile.x[i];
    const b = Math.sqrt(b0 * b0 + (R / K) * (2 * Lh * x - x * x));
    const zAnalytic = b - 4.0;
    assert.ok(Math.abs(s.profile.z[i] - zAnalytic) < 0.01, `x=${x}: ${s.profile.z[i]} vs ${zAnalytic}`);
  }
  assert.ok(Math.abs(s.profile.z.at(-1) - -0.161) < 0.01);
  assert.ok(Math.abs(s.profile.q[0] - R * Lh) / (R * Lh) < 0.01, `qb = ${s.profile.q[0]}`);
});

test('langkah forcing 1 jam vs 24 jam: rata-rata kedalaman < 2 cm, ΣQ < 10%', () => {
  const a = runScenario('normal', {}, { stepHours: 1 }).series;
  const b = runScenario('normal', {}, { stepHours: 24 }).series;
  for (const id of a.piezometerIds) assert.ok(Math.abs(mean(a.depthCm[id]) - mean(b.depthCm[id])) < 2, id);
  assert.ok(Math.abs(sum(a.q_m3s) - sum(b.q_m3s)) / sum(a.q_m3s) < 0.1);
});

test('kepekaan bilangan Courant: C = 0,5 vs 0,1 berbeda < 0,5 cm', () => {
  const a = runScenario('hujan', {}, { days: 60 }).series;
  const b = runScenario('hujan', { params: { 'numerics.C': 0.1 } }, { days: 60 }).series;
  for (const id of a.piezometerIds) assert.ok(Math.abs(mean(a.depthCm[id]) - mean(b.depthCm[id])) < 0.5, id);
});

test('dua run identik menghasilkan keluaran persis sama', () => {
  const a = runScenario('ekstrem').series;
  const b = runScenario('ekstrem').series;
  assert.deepEqual(a, b);
});
