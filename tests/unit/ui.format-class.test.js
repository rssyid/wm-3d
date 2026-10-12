import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classDigits, displayDepth, fmtElevClassCm, fmtDepthClass } from '../../js/ui/format.js';
import { classifyTmat, ppCompliant } from '../../js/model/index.js';
import { lerpSnapshot } from '../../js/core/view.js';

test('angka TMAT tidak pernah menyeberang ke kategori/PP lain saat dibulatkan', () => {
  // tepat di batas dan sedikit di atas/bawahnya, termasuk nilai yang membulat ke batas
  const edges = [0, 40, 45, 60, 65];
  for (const b of edges) {
    for (const eps of [-0.5, -0.07, -0.004, -0.0004, 0, 0.0004, 0.004, 0.0049, 0.07, 0.5]) {
      const d = b + eps;
      const { value } = displayDepth(d);
      assert.equal(classifyTmat(value).id, classifyTmat(d).id, `d=${d} → ${value}`);
      assert.equal(ppCompliant(value), ppCompliant(d), `PP d=${d} → ${value}`);
      assert.equal(value < 0, d < 0, `tanda d=${d}`);
    }
  }
});

test('contoh nyata dari audit: 40,0039 → −40,01; −0,003 → +0,01 (Banjir); 65,004 → −65,01', () => {
  assert.equal(fmtElevClassCm(40.0039), '−40,01 cm');
  assert.equal(fmtElevClassCm(-0.003), '+0,01 cm');
  assert.equal(fmtElevClassCm(65.004), '−65,01 cm');
  assert.equal(fmtElevClassCm(45.08), '−45,1 cm');
  assert.equal(fmtElevClassCm(52.4), '−52 cm');
  assert.equal(fmtDepthClass(40.0039), '40,01');
  assert.equal(classDigits(52.4), 0);
  assert.equal(classDigits(40.3), 1);
  assert.equal(classDigits(40.02), 2);
});

test('lerpSnapshot: kategori dan status PP dihitung ulang dari kedalaman terinterpolasi', () => {
  const mk = (depth) => ({
    tDays: 0,
    forcing: { riverM: -2 },
    profile: { z: new Float64Array([0]), depthCm: new Float64Array([depth]), q: new Float64Array([0]) },
    piezometers: [{ id: 'P4', levelM: -depth / 100, depthCm: depth, isTP: true, cls: classifyTmat(depth), ppCompliant: ppCompliant(depth) }],
    canal: { levelM: -0.5, tmasCm: 50, gaugeReadingCm: -50 },
    structure: { q_m3s: 0, headCm: 0 },
    river: { levelM: -2 },
    ponding: { maxCm: 0 },
    ind: { tpDepthCm: depth, cls: classifyTmat(depth), meanDepthCm: depth, meanCls: classifyTmat(depth), pp: { now: ppCompliant(depth), lastDayMeanCm: 50 } },
  });
  const a = mk(46.5);
  const b = mk(35.6);
  const v = lerpSnapshot(a, b, 0.1); // 46.5 → 35.6 : 45.41 (Normal, tidak patuh) walau b = Tergenang/patuh
  assert.ok(Math.abs(v.piezometers[0].depthCm - 45.41) < 1e-9);
  assert.equal(v.piezometers[0].cls.id, 'normal');
  assert.equal(v.piezometers[0].ppCompliant, false);
  assert.equal(v.ind.cls.id, 'normal');
  assert.equal(v.ind.pp.now, false);
  assert.equal(v.ind.tpDepthCm, v.piezometers[0].depthCm);
  const w = lerpSnapshot(a, b, 0.9);
  assert.equal(w.ind.cls.id, 'tergenang');
  assert.equal(w.ind.pp.now, true);
});
