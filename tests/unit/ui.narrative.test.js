// Tes pemilihan kalimat naratif "Alur hubungan": hanya berganti bila kelas/regime berubah.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModel, advance, snapshot } from '../../js/model/index.js';
import { dischargeRegime, narrativeOf, createNarrator } from '../../js/ui/narrative.js';

const base = () => {
  const s = snapshot(createModel({ scenarioId: 'normal' }));
  return structuredClone({ ...s, profile: null });
};

test('dischargeRegime membedakan luapan, aliran balik, klep, terendam, menahan', () => {
  const s = base();
  s.canal.overbank = false;
  s.structure.q_m3s = 0.05;
  s.structure.submerged = false;
  assert.equal(dischargeRegime(s), 'out');
  s.structure.submerged = true;
  assert.equal(dischargeRegime(s), 'submerged');
  s.structure.q_m3s = -0.01;
  assert.equal(dischargeRegime(s), 'back');
  s.structure.q_m3s = 0;
  assert.equal(dischargeRegime(s), 'hold');
  s.structure.flapGate = true;
  s.structure.riverAboveCrest = true;
  s.river.levelM = 0.1;
  s.canal.levelM = -0.3;
  assert.equal(dischargeRegime(s), 'flapShut');
  s.canal.overbank = true;
  assert.equal(dischargeRegime(s), 'overbank');
});

test('narrativeOf: kalimat Indonesia memuat titik penaatan, kategori, dan status PP', () => {
  const s = base();
  const n = narrativeOf(s);
  assert.ok(n.text.includes(s.ind.tpId));
  assert.ok(n.text.includes(s.ind.cls.label));
  assert.match(n.text, /patuh PP 57\/2016/);
  assert.ok(n.text.endsWith('.'));
  assert.equal(n.text[0], n.text[0].toUpperCase());
});

test('createNarrator: null bila kunci sama; teks baru bila kategori/regime berubah', () => {
  const nar = createNarrator();
  const s = base();
  assert.ok(nar.next(s));
  const s2 = structuredClone(s);
  s2.tDays += 0.5;
  s2.piezometers[0].depthCm += 0.2; // perubahan kecil tanpa ganti kelas
  assert.equal(nar.next(s2), null);
  const s3 = structuredClone(s);
  s3.ind.cls = { id: 'kering', label: 'Kering' };
  s3.ind.pp.now = false;
  const t = nar.next(s3);
  assert.ok(t && t.includes('Kering') && t.includes('tidak patuh'));
  nar.reset();
  assert.ok(nar.next(s3), 'setelah reset kalimat dikirim lagi');
});

test('selama kemarau 30 hari narasi tidak berganti setiap jam', () => {
  const m = createModel({ scenarioId: 'kemarau' });
  const nar = createNarrator();
  let changes = 0;
  for (let h = 0; h < 24 * 30; h++) if (nar.next(advance(m, 1))) changes++;
  assert.ok(changes >= 1 && changes < 60, `perubahan narasi = ${changes}`);
});
