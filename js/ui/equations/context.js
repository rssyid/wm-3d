// Konteks angka untuk satu "saat" simulasi: semua angka tab Persamaan diambil dari sini.
// Sumber: explain() per piezometer, snapshot, dailySeries, peatCurves, ratingCurve, dan fungsi murni model.
// Murni (tanpa DOM). Objek yang dihasilkan tidak berubah lagi → bisa "dibekukan".
import {
  explain,
  dailySeries,
  peatCurves,
  ratingCurve,
  canalVolume,
  canalWetArea,
  SCENARIOS,
} from '../../model/index.js';

/** Kurva V(h) dan Aw(h) saluran dari fungsi model (untuk grafik mini). */
function canalCurves(geometry, n = 81) {
  const segs = geometry.segments;
  const zMin = Math.min(...segs.map((s) => s.zb));
  const top = geometry.zBank + 0.3;
  const h = [];
  const V = [];
  const Aw = [];
  for (let j = 0; j < n; j++) {
    const hj = zMin + ((top - zMin) * j) / (n - 1);
    h.push(hj);
    V.push(canalVolume(hj, segs, geometry.zBank));
    Aw.push(canalWetArea(hj, segs, geometry.zBank));
  }
  return { h, V, Aw, zMin, top };
}

/**
 * Bangun konteks lengkap dari model saat ini.
 * opts.piezometer: id piezometer pilihan (default titik penaatan).
 */
export function buildContext(model, snap, { piezometer } = {}) {
  const ids = model.params.piezometers.map((p) => p.id);
  const pz = ids.includes(piezometer) ? piezometer : snap.ind.tpId;
  const ex = {};
  for (const id of ids) ex[id] = explain(model, { piezometer: id });
  const e = ex[pz];
  const D0 = e.geometry.zBank - e.geometry.zBase;
  const scenario = SCENARIOS[snap.scenarioId] ?? null;
  // Keadaan sungai: pakai field explain bila kelak tersedia, jika tidak baca keadaan model (hanya dibaca).
  const river = {
    zR0: e.river?.zR0 ?? model.forcing?.zR0 ?? NaN,
    Er: e.river?.Er ?? model.Er ?? NaN,
    manual: snap.scenarioId === 'manual',
  };
  const meanDepth30Cm =
    snap.ind?.subs?.meanDepth30Cm ??
    (Array.isArray(model.depth30) && model.depth30.length
      ? model.depth30.reduce((a, b) => a + b, 0) / model.depth30.length
      : snap.ind.meanDepthCm);
  return {
    t: snap.hourIndex,
    snap,
    e,
    ex,
    pz,
    ids,
    params: e.params,
    scenario,
    river,
    meanDepth30Cm,
    series: dailySeries(model),
    curves: peatCurves(model, { n: 121, maxDepth: 3 }),
    curvesFull: peatCurves(model, { n: 161, maxDepth: D0 }),
    rating: ratingCurve(model, { n: 81, maxHead: 0.8 }),
    canal: canalCurves(e.geometry),
  };
}
