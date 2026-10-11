import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScenario, createModel, advance, snapshot, manualForcing, explain } from '../../js/model/index.js';

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sum = (a) => a.reduce((x, y) => x + y, 0);

test('hujan lebih banyak → TMAT & TMAS lebih dangkal, pembuangan lebih besar', () => {
  const dry = runScenario('normal', { rainScale: 0.7 }, { days: 120 }).series;
  const wet = runScenario('normal', { rainScale: 1.3 }, { days: 120 }).series;
  for (const id of dry.piezometerIds) assert.ok(mean(wet.depthCm[id]) < mean(dry.depthCm[id]), id);
  assert.ok(mean(wet.tmasCm) < mean(dry.tmasCm));
  assert.ok(sum(wet.q_m3s) > sum(dry.q_m3s));
});

test('mercu lebih tinggi (stoplog 8 vs 5) → lebih basah, pembuangan tidak bertambah', () => {
  const low = runScenario('normal', { control: { nLogs: 5 } }, { days: 120 }).series;
  const high = runScenario('normal', { control: { nLogs: 8 } }, { days: 120 }).series;
  for (const id of low.piezometerIds) assert.ok(mean(high.depthCm[id]) < mean(low.depthCm[id]), id);
  assert.ok(mean(high.tmasCm) < mean(low.tmasCm));
  assert.ok(sum(high.q_m3s) <= 1.01 * sum(low.q_m3s));
});

test('kanal tinggi mengisi gambut: qb < 0 dan muka air menurun ke tengah blok', () => {
  const m = createModel({
    forcing: manualForcing({ rainMmd: 0, etpMmd: 0, riverM: -3 }),
    params: { fixedCanalLevel: -0.2, 'geom.Hd': 0 },
    init: { tmatCm: 80 },
  });
  advance(m, 24 * 3);
  const s = snapshot(m);
  assert.ok(s.profile.q[0] < 0, `qb = ${s.profile.q[0]}`);
  assert.ok(s.profile.z[0] > s.profile.z[s.profile.z.length - 1]);
  assert.ok(explain(m).canal.terms.seepage < 0);
});

test('parit lapangan dimatikan → blok lebih basah pada musim hujan', () => {
  const on = runScenario('hujan', {}, { days: 60 }).series;
  const off = runScenario('hujan', { params: { 'fieldDrains.enabled': false } }, { days: 60 }).series;
  assert.ok(mean(off.depthCm.P3) < mean(on.depthCm.P3));
  assert.ok(sum(off.pondedHours) >= sum(on.pondedHours));
});

test('respons berurutan: hujan → TMAT naik → TMAS naik → pembuangan naik', () => {
  const m = createModel({ forcing: manualForcing({ rainMmd: 0, etpMmd: 4, riverM: -2 }) });
  advance(m, 24 * 10);
  const before = snapshot(m);
  m.forcing.values.rainMmd = 80;
  advance(m, 24);
  const after = snapshot(m);
  assert.ok(after.ind.meanDepthCm < before.ind.meanDepthCm);
  assert.ok(after.canal.levelM > before.canal.levelM);
  assert.ok(after.structure.q_m3s > before.structure.q_m3s);
});
