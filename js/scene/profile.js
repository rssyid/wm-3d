// Sampling profil transek model (murni): muka air tanah z(x), kedalaman, genangan, fluks — di koordinat scene.

import { modelXFromScene } from './layout.js';

/**
 * Interpolasi linear nilai per sel (pusat sel x[i]) pada koordinat model xm.
 * Di antara tepi saluran (x = 0) dan sel pertama dipakai `edgeValue` bila diberikan (mis. muka air kanal),
 * di luar sel terakhir (tengah blok) nilainya tetap (simetri).
 */
export function sampleCells(xs, values, xm, edgeValue = null) {
  const n = xs.length;
  if (!n) return NaN;
  if (xm <= xs[0]) {
    if (edgeValue == null || xs[0] <= 0) return values[0];
    if (xm <= 0) return edgeValue;
    return edgeValue + ((values[0] - edgeValue) * xm) / xs[0];
  }
  if (xm >= xs[n - 1]) return values[n - 1];
  // sel seragam: tebak indeks langsung, lalu koreksi
  const dx = xs[1] - xs[0];
  let i = Math.min(n - 2, Math.max(0, Math.floor((xm - xs[0]) / dx)));
  while (i > 0 && xs[i] > xm) i--;
  while (i < n - 2 && xs[i + 1] < xm) i++;
  const t = (xm - xs[i]) / (xs[i + 1] - xs[i]);
  return values[i] + (values[i + 1] - values[i]) * t;
}

/** Muka air tanah (m) di X scene; di saluran (|X| ≥ Lh) = muka air kanal. */
export function waterTableAt(X, profile, canalLevel, Lh = 150) {
  if (Math.abs(X) >= Lh) return canalLevel;
  return sampleCells(profile.x, profile.z, modelXFromScene(X, Lh), canalLevel);
}

/** Kedalaman muka air tanah (cm, positif ke bawah) di X scene. */
export function depthAt(X, profile, Lh = 150) {
  return sampleCells(profile.x, profile.depthCm, modelXFromScene(X, Lh));
}

/** Indeks muka sel untuk fluks q (N+1 nilai, q[0] = ke saluran). */
export function faceX(i, N, Lh = 150) {
  return (i * Lh) / N;
}

/** Wetness tanah untuk penggelapan warna: clamp(1 − d/60, 0, 1). */
export function wetness(depthCm) {
  const w = 1 - depthCm / 60;
  return w < 0 ? 0 : w > 1 ? 1 : w;
}
