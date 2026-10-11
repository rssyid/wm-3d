// Saluran (kanal) sebagai satu simpanan tergabung dan pintu air stoplog (ambang/weir).

/** Volume air di saluran V(h) (m³) untuk muka air h; di atas tanggul dihitung luapan selebar saluran. */
export function canalVolume(h, segments, zBank) {
  let V = 0;
  for (const s of segments) {
    const y = Math.min(Math.max(h - s.zb, 0), s.depth);
    V += s.L * (s.b * y + s.m * y * y);
    if (h > zBank) V += s.L * s.B * (h - zBank);
  }
  return V;
}

/** Luas muka air bebas Aw(h) (m²). */
export function canalWetArea(h, segments, zBank) {
  let A = 0;
  for (const s of segments) {
    if (h <= s.zb) continue;
    if (h >= zBank) A += s.L * s.B;
    else A += s.L * (s.b + 2 * s.m * (h - s.zb));
  }
  return A;
}

/** Muka air dari volume (kebalikan canalVolume) dengan bisection. */
export function canalLevelFromVolume(V, segments, zBank, iter = 60) {
  const zMin = Math.min(...segments.map((s) => s.zb));
  if (V <= 0) return zMin;
  let lo = zMin;
  let hi = zBank + 1;
  while (canalVolume(hi, segments, zBank) < V) hi += (hi - zMin);
  for (let i = 0; i < iter; i++) {
    const mid = 0.5 * (lo + hi);
    if (canalVolume(mid, segments, zBank) < V) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Elevasi mercu pintu air: ambang + tebal papan × jumlah papan stoplog. */
export function crestLevel(nLogs, weir) {
  return weir.zSill + weir.plank * nLogs;
}

/** Faktor peredaman Villemonte S(r) = (1 − r^1,5)^0,385, r = H hilir / H hulu. */
export function villemonte(r) {
  const x = Math.max(r, 0);
  return Math.pow(Math.max(1 - Math.pow(x, 1.5), 0), 0.385);
}

/**
 * Debit ambang stoplog (m³/s), positif ke sungai, negatif = aliran balik.
 * H1 = hc − mercu, H2 = hr − mercu. Q = Cw·Lw·H1^1,5·S(H2/H1) bila H1 ≥ H2, sebaliknya Q = −Cw·Lw·H2^1,5·S(H1/H2).
 */
export function weirQ(hc, hr, crest, weir, flapGate = false) {
  const H1 = hc - crest;
  const H2 = hr - crest;
  let Q = 0;
  if (H1 <= 0 && H2 <= 0) Q = 0;
  else if (H1 >= H2) Q = weir.Cw * weir.width * Math.pow(H1, 1.5) * villemonte(H2 / H1);
  else Q = -weir.Cw * weir.width * Math.pow(H2, 1.5) * villemonte(H1 / H2);
  if (flapGate && Q < 0) Q = 0;
  return Q;
}

/** Rincian perhitungan ambang (untuk tab Persamaan). */
export function weirDetail(hc, hr, crest, weir, flapGate = false) {
  const H1 = hc - crest;
  const H2 = hr - crest;
  const forward = H1 >= H2;
  const Hup = forward ? H1 : H2;
  const ratio = forward ? (H1 > 0 ? H2 / H1 : 0) : H2 > 0 ? H1 / H2 : 0;
  const S = Hup > 0 ? villemonte(ratio) : 1;
  const Q = weirQ(hc, hr, crest, weir, flapGate);
  return {
    H1,
    H2,
    Hup: Math.max(Hup, 0),
    ratio,
    S,
    Q,
    forward,
    submerged: H1 > 0 && H2 > 0,
    flapBlocked: flapGate && !forward && H2 > 0,
    Cw: weir.Cw,
    Lw: weir.width,
    crest,
  };
}

/**
 * Langkah implisit muka air kanal: cari h sehingga V(h) + 86400·dt·Q(h, hr) = Vtarget.
 * F(h) monoton naik (V naik, Q naik terhadap hc) → akar tunggal; bisection.
 */
export function solveCanalLevel(Vtarget, dt, hr, crest, weir, flapGate, segments, zBank, iter = 60) {
  const zMin = Math.min(...segments.map((s) => s.zb));
  const F = (h) => canalVolume(h, segments, zBank) - Vtarget + 86400 * dt * weirQ(h, hr, crest, weir, flapGate);
  if (F(zMin) >= 0) return zMin;
  let lo = zMin;
  let hi = zBank + 1;
  let guard = 0;
  while (F(hi) < 0 && guard++ < 60) hi += hi - zMin;
  for (let i = 0; i < iter; i++) {
    const mid = 0.5 * (lo + hi);
    if (F(mid) < 0) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}
