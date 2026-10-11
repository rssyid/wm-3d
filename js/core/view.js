// Interpolasi dua snapshot model untuk animasi halus antar-langkah jam.
// Field kontinu diinterpolasi; field diskret (kelas, jumlah stoplog, log) diambil dari snapshot b.

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
  return {
    ...b,
    tDays: lerp(a.tDays, b.tDays, t),
    forcing: { ...b.forcing, riverM: lerp(a.forcing.riverM, b.forcing.riverM, t) },
    profile: {
      ...b.profile,
      z: lerpArray(a.profile.z, b.profile.z, t),
      depthCm: lerpArray(a.profile.depthCm, b.profile.depthCm, t),
      q: lerpArray(a.profile.q, b.profile.q, t),
    },
    piezometers: b.piezometers.map((p, i) => {
      const pa = a.piezometers[i];
      if (!pa) return p;
      return { ...p, levelM: lerp(pa.levelM, p.levelM, t), depthCm: lerp(pa.depthCm, p.depthCm, t) };
    }),
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
