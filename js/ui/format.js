// Format angka Bahasa Indonesia (koma desimal, titik ribuan, tanda minus tipografis).
const cache = new Map();
function nf(digits) {
  let f = cache.get(digits);
  if (!f) {
    f = new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    cache.set(digits, f);
  }
  return f;
}

export const MINUS = '−';

/** Angka dengan `digits` desimal; '—' bila tidak terhingga. */
export function fmt(v, digits = 0) {
  if (!Number.isFinite(v)) return '—';
  const s = nf(digits).format(Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v);
  return s.replace('-', MINUS);
}

/** Angka bertanda eksplisit (+/−). */
export function fmtSigned(v, digits = 0) {
  if (!Number.isFinite(v)) return '—';
  const s = fmt(Math.abs(v), digits);
  if (s === fmt(0, digits)) return s;
  return (v > 0 ? '+' : MINUS) + s;
}

/** Elevasi muka air relatif permukaan (cm), dari kedalaman positif-ke-bawah: 45 → "−45 cm". */
export function fmtElevCm(depthCm, digits = 0) {
  return `${fmtSigned(-depthCm, digits)} cm`;
}

/** Frasa kedalaman: "45 cm di bawah permukaan" atau "3 cm di atas permukaan (banjir)". */
export function depthPhrase(depthCm, digits = 0) {
  if (!Number.isFinite(depthCm)) return '—';
  if (depthCm < 0) return `${fmt(-depthCm, digits)} cm di atas permukaan`;
  return `${fmt(depthCm, digits)} cm di bawah permukaan`;
}

export function fmtQ(q_m3s, digits = 3) {
  return `${fmt(q_m3s, digits)} m³/s`;
}

export function fmtMm(v, digits = 1) {
  return `${fmt(v, digits)} mm`;
}

export function fmtPct(v, digits = 0) {
  return Number.isFinite(v) ? `${fmt(v, digits)}%` : '—';
}

/** Nama hari simulasi: "Hari 34/365 · 3 Feb". */
export function fmtDay(snap) {
  const total = Number.isFinite(snap.scenarioDays) ? `/${snap.scenarioDays}` : '';
  const hh = String(snap.hourOfDay).padStart(2, '0');
  return `Hari ${snap.day + 1}${total} · ${snap.dateLabel}, ${hh}.00`;
}
