import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScenario, createModel, advance, waterBalance, setControl, setParams, manualForcing } from '../../js/model/index.js';

for (const id of ['kemarau', 'normal', 'hujan', 'ekstrem']) {
  for (const stepHours of [1, 24]) {
    for (const mode of ['manual', 'auto']) {
      test(`neraca massa tertutup: ${id}, langkah ${stepHours} jam, ${mode}`, () => {
        const { balance } = runScenario(id, { control: { mode } }, { stepHours });
        assert.ok(balance.relError < 1e-9, `residu relatif ${balance.relError}`);
        assert.equal(balance.cum.clamp, 0);
      });
    }
  }
}

test('neraca tertutup dengan kanal dipatok (fixedCanalLevel)', () => {
  const { balance } = runScenario('hujan', { params: { fixedCanalLevel: -0.5 } }, { days: 60 });
  assert.ok(balance.relError < 1e-9);
});

test('neraca tetap tertutup setelah mengubah stoplog, kubah, Ks, dan parit di tengah jalan', () => {
  const m = createModel({ scenarioId: 'normal' });
  advance(m, 24 * 20);
  setControl(m, { nLogs: 4 });
  advance(m, 24 * 10);
  setParams(m, { 'geom.Hd': 0.6, 'peat.Ks': 80 });
  advance(m, 24 * 10);
  setParams(m, { 'fieldDrains.enabled': false });
  setControl(m, { mode: 'auto', target: 'pp' });
  advance(m, 24 * 20);
  const b = waterBalance(m);
  assert.ok(b.relError < 1e-9, `residu ${b.relError}`);
  assert.equal(b.cum.clamp, 0);
});

test('mode Manual: hujan lebat + sungai tinggi (aliran balik) tetap tertutup', () => {
  const m = createModel({ forcing: manualForcing({ rainMmd: 120, etpMmd: 3, riverM: -0.2 }) });
  advance(m, 24 * 10);
  const b = waterBalance(m);
  assert.ok(b.relError < 1e-9);
  assert.ok(b.cum.backflow >= 0);
});
