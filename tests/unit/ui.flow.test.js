// Tes besaran diagram Alur (konversi m³/hari → mm/hari, lebar panah) dan helper KPI/kartu viewport.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModel, advance, explain } from '../../js/model/index.js';
import { m3dToMmd, flowFluxes, edgeWidth, balanceTerms } from '../../js/ui/flowmath.js';
import { riseText, flowDirection, tensionNote } from '../../js/ui/kpi.js';
import { placeCard, pickContent } from '../../js/ui/overlay.js';
import { TMAT_CLASSES } from '../../js/model/index.js';

test('m3dToMmd: 306.240 m³/hari atas 306.240 m² = 1000 mm/hari', () => {
  assert.equal(m3dToMmd(306240, 306240), 1000);
  assert.equal(m3dToMmd(5, 0), 0);
  assert.equal(m3dToMmd(NaN, 10), 0);
});

test('flowFluxes konsisten dengan explain(): rembesan+parit+limpasan dalam mm/hari', () => {
  const m = createModel({ scenarioId: 'hujan' });
  const snap = advance(m, 24 * 20);
  const ex = explain(m);
  const fx = flowFluxes(snap, ex.canal.terms, ex.geometry.Atot);
  const t = ex.canal.terms;
  const expected = ((t.seepage + t.drains + t.runoff) / ex.geometry.Atot) * 1000;
  assert.ok(Math.abs(fx.toCanal.total - expected) < 1e-9);
  assert.equal(fx.rain, snap.today.rain_mm);
  assert.equal(fx.discharge, snap.structure.q_mmd);
  const b = balanceTerms(snap.today);
  assert.ok(Math.abs(b.rain - b.et - b.out - b.dS - b.residual) < 1e-6, 'baris neraca tertutup');
});

test('edgeWidth: monoton terhadap |fluks|, dengan batas bawah dan atas', () => {
  assert.equal(edgeWidth(0), edgeWidth(-0));
  assert.ok(edgeWidth(10) > edgeWidth(1));
  assert.equal(edgeWidth(-10), edgeWidth(10));
  assert.ok(edgeWidth(1e6) <= 22);
  assert.ok(edgeWidth(0) >= 1.5);
});

test('riseText memakai "muka air naik/turun", tidak pernah "TMAT naik"', () => {
  assert.equal(riseText(5), 'muka air turun 5 cm/24 jam'); // lebih dalam = turun
  assert.equal(riseText(-12.4), 'muka air naik 12 cm/24 jam');
  assert.match(riseText(0.2), /tetap/);
  assert.equal(riseText(NaN), '');
});

test('flowDirection & tensionNote', () => {
  assert.equal(flowDirection({ q_m3s: 0.02 }).label, 'ke sungai');
  assert.equal(flowDirection({ q_m3s: -0.02 }).label, 'aliran balik');
  assert.equal(flowDirection({ q_m3s: 0, flapGate: true, riverAboveCrest: true }).label, 'klep menutup');
  const normal = TMAT_CLASSES.find((c) => c.id === 'normal');
  const tergenang = TMAT_CLASSES.find((c) => c.id === 'tergenang');
  const kering = TMAT_CLASSES.find((c) => c.id === 'kering');
  assert.match(tensionNote(normal, false), /Normal.*PP 57\/2016/);
  assert.equal(tensionNote(normal, true), null);
  assert.equal(tensionNote(tergenang, true), null);
  assert.equal(tensionNote(kering, false), null);
});

test('placeCard menjaga kartu di dalam viewport', () => {
  assert.deepEqual(placeCard(10, 10, 200, 100, 800, 400), { x: 24, y: 24 });
  const r = placeCard(790, 390, 200, 100, 800, 400);
  assert.ok(r.x + 200 <= 800 - 8 && r.y + 100 <= 400 - 8 && r.x >= 8 && r.y >= 8);
  const tiny = placeCard(50, 50, 300, 300, 200, 200);
  assert.ok(tiny.x >= 8 && tiny.y >= 8);
});

test('pickContent: kartu untuk piezometer, papan duga, pintu air, penampang', () => {
  const m = createModel({ scenarioId: 'kemarau' });
  const snap = advance(m, 24 * 30);
  const pz = pickContent({ type: 'piezometer', id: 'P2' }, snap);
  assert.equal(pz.title, 'Piezometer P2');
  assert.ok(pz.rows.some(([, v]) => /cm$/.test(v)));
  assert.ok(pickContent({ type: 'gauge' }, snap).rows.length >= 2);
  const gate = pickContent({ type: 'gate' }, snap);
  assert.ok(gate.rows.some(([, v]) => /m³\/s/.test(v)));
  assert.ok(pickContent({ type: 'section' }, snap).rows.length >= 3);
  assert.equal(pickContent({ type: 'lain' }, snap), null);
  assert.equal(pickContent({ type: 'gate' }, null), null);
});
