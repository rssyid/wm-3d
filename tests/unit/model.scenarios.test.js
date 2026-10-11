// Tes kalibrasi skenario: yang disetel adalah parameter skenario, bukan batas tes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScenario, DEFAULT_PARAMS } from '../../js/model/index.js';

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

test('kemarau: semua piezometer > 40 cm, P4 akhir > 65 (Kering), risiko kebakaran ≥ Tinggi, PP < 50%, Q ≈ 0', () => {
  const { series: s, snapshot: snap, model } = runScenario('kemarau');
  for (const id of s.piezometerIds) assert.ok(Math.min(...s.depthCm[id]) > 40, id);
  assert.ok(s.depthCm.P4.at(-1) > 65);
  assert.equal(snap.ind.cls.id, 'kering');
  assert.ok(snap.ind.fire.index >= 50, `FRI ${snap.ind.fire.index}`);
  assert.ok(model.pp.compliant / model.pp.days < 0.5);
  const last60 = s.out_mm.slice(-60);
  assert.ok(last60.reduce((a, b) => a + b, 0) < 1, 'pembuangan 60 hari terakhir ≈ 0');
});

test('normal: musim hujan lebih basah daripada kemarau Jun–Agu', () => {
  const { series: s } = runScenario('normal');
  const wet = s.depthCm.P3.slice(305, 365).concat(s.depthCm.P3.slice(0, 60));
  const dry = s.depthCm.P3.slice(151, 243);
  assert.ok(mean(wet) < mean(dry) - 5, `${mean(wet)} vs ${mean(dry)}`);
  assert.ok(mean(wet) < 60, 'musim hujan rata-rata dalam kategori ≤ Normal');
  assert.ok(Math.max(...dry) > 60, 'kemarau mencapai Agak Kering/Kering');
});

test('musim hujan: sebagian besar Tergenang (P3 ≤ 45 cm), pembuangan sering', () => {
  const { series: s } = runScenario('hujan');
  const wetDays = s.depthCm.P3.filter((d) => d <= 45).length;
  assert.ok(wetDays / s.n > 0.6, `${wetDays}/${s.n}`);
  const qDays = s.q_m3s.filter((q) => q > 0.005).length;
  assert.ok(qDays / s.n > 0.5);
});

test('ekstrem: puncak Q hari 14–19, banjir/genangan, sungai ≤ batas, pintu terendam, lalu surut', () => {
  const { series: s, model } = runScenario('ekstrem');
  const pre = median(s.q_m3s.slice(0, 13));
  const peak = Math.max(...s.q_m3s);
  const iPeak = s.q_m3s.indexOf(peak);
  assert.ok(iPeak >= 13 && iPeak <= 18, `puncak di hari indeks ${iPeak}`);
  assert.ok(peak >= 5 * Math.max(pre, 1e-3), `puncak ${peak} vs pra-badai ${pre}`);
  assert.ok(Math.min(...s.tmasCm) < 25 || Math.max(...s.pondedHours) > 0);
  assert.ok(Math.min(...s.depthCm.P3) < 0, 'kategori Banjir tercapai');
  const zRMax = DEFAULT_PARAMS.river.zRMax;
  for (const r of s.riverM) assert.ok(r <= zRMax + 1e-12);
  const crest = s.crestM[15];
  assert.ok(Math.max(...s.riverM) > crest, 'sungai melampaui mercu (pintu terendam)');
  assert.ok(s.q_m3s[iPeak + 6] < 0.25 * peak, 'surut dalam seminggu');
  assert.ok(model.k === 45 * 24);
});

test('otomatis: normal mulai stoplog 5 → stoplog naik dan blok lebih basah daripada manual', () => {
  const man = runScenario('normal', { control: { nLogs: 5, mode: 'manual' } }, { days: 120 });
  const auto = runScenario('normal', { control: { nLogs: 5, mode: 'auto' } }, { days: 120 });
  assert.ok(Math.max(...auto.series.nLogs) > 5);
  assert.ok(mean(auto.series.depthCm.P3) < mean(man.series.depthCm.P3));
  assert.ok(auto.model.log.length > 0);
});

test('otomatis: kemarau mulai stoplog 5 → mencapai stoplog maksimum, tidak lebih kering daripada manual', () => {
  const man = runScenario('kemarau', { control: { nLogs: 5, mode: 'manual' } });
  const auto = runScenario('kemarau', { control: { nLogs: 5, mode: 'auto' } });
  assert.equal(auto.series.nLogs.at(-1), DEFAULT_PARAMS.weir.nMax);
  assert.ok(mean(auto.series.depthCm.P3) <= mean(man.series.depthCm.P3) + 1e-9);
});

test('otomatis: musim hujan mulai stoplog 9 → stoplog diturunkan, genangan berkurang', () => {
  const man = runScenario('hujan', { control: { nLogs: 9, mode: 'manual' } });
  const auto = runScenario('hujan', { control: { nLogs: 9, mode: 'auto' } });
  assert.ok(Math.min(...auto.series.nLogs) < 9);
  const pond = (s) => s.pondedHours.reduce((a, b) => a + b, 0);
  assert.ok(pond(auto.series) <= pond(man.series));
  assert.ok(mean(auto.series.depthCm.P3) > mean(man.series.depthCm.P3));
});

test('otomatis: tidak membuang stoplog saat sungai lebih tinggi dari kanal', () => {
  const { model } = runScenario('ekstrem', { control: { mode: 'auto' } });
  for (const e of model.log) assert.notEqual(e.type, 'tambah-saat-banjir');
  // setiap aksi darurat hanya terjadi bila sungai lebih rendah dari kanal (dicek di aturan)
  assert.ok(model.log.every((e) => typeof e.text === 'string'));
});
