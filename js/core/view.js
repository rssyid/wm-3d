// Interpolasi dua snapshot model untuk animasi halus antar-langkah jam.
// Field kontinu diinterpolasi; kategori TMAT & status PP dihitung ulang dari kedalaman terinterpolasi
// (agar angka dan kategori selalu cocok); field diskret lain (stoplog, log) diambil dari snapshot b.
import { classifyTmat, ppCompliant } from '../model/indicators.js';

const lerp = (a, b, t) => a + (b - a) * t;

function lerpArray(a, b, t) {
  if (!a || !b || a.length !== b.length) return b;
  const out = new Float64Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = lerp(a[i], b[i], t);
  return out;
}

export function lerpSnapshot(a, b, alpha) {
  if (!a || !b) return b ?? a;
  const t = Math.min(Math.max(alpha, 0), 1);
  if (t >= 1 || a === b) return b;
  const piezometers = b.piezometers.map((p, i) => {
    const pa = a.piezometers[i];
    if (!pa) return p;
    const depthCm = lerp(pa.depthCm, p.depthCm, t);
    return { ...p, levelM: lerp(pa.levelM, p.levelM, t), depthCm, cls: classifyTmat(depthCm), ppCompliant: ppCompliant(depthCm) };
  });
  const tp = piezometers.find((p) => p.isTP) ?? piezometers[0];
  const meanDepthCm = piezometers.reduce((acc, p) => acc + p.depthCm, 0) / piezometers.length;
  const ind = {
    ...b.ind,
    tpDepthCm: tp.depthCm,
    cls: classifyTmat(tp.depthCm),
    meanDepthCm,
    meanCls: classifyTmat(meanDepthCm),
    pp: { ...b.ind.pp, now: ppCompliant(tp.depthCm) },
  };
  return {
    ...b,
    ind,
    tDays: lerp(a.tDays, b.tDays, t),
    forcing: { ...b.forcing, riverM: lerp(a.forcing.riverM, b.forcing.riverM, t) },
    profile: {
      ...b.profile,
      z: lerpArray(a.profile.z, b.profile.z, t),
      depthCm: lerpArray(a.profile.depthCm, b.profile.depthCm, t),
      q: lerpArray(a.profile.q, b.profile.q, t),
    },
    piezometers,
    canal: {
      ...b.canal,
      levelM: lerp(a.canal.levelM, b.canal.levelM, t),
      tmasCm: lerp(a.canal.tmasCm, b.canal.tmasCm, t),
      gaugeReadingCm: lerp(a.canal.gaugeReadingCm, b.canal.gaugeReadingCm, t),
    },
    structure: {
      ...b.structure,
      q_m3s: lerp(a.structure.q_m3s, b.structure.q_m3s, t),
      headCm: lerp(a.structure.headCm, b.structure.headCm, t),
    },
    river: { levelM: lerp(a.river.levelM, b.river.levelM, t) },
    ponding: { ...b.ponding, maxCm: lerp(a.ponding.maxCm, b.ponding.maxCm, t) },
  };
}
