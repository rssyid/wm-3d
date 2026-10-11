// Matematika grafik tanpa DOM (bisa dites di Node): skala linear, tick "bagus", domain, tick tanggal,
// dan tata letak tiga panel. Dipakai js/ui/chart.js.
import { calendarDay, MONTH_NAMES_ID } from '../model/index.js';

/** Skala linear d0..d1 → r0..r1 (fungsi dengan .invert). */
export function linearScale(d0, d1, r0, r1) {
  const span = d1 - d0 || 1;
  const k = (r1 - r0) / span;
  const f = (v) => r0 + (v - d0) * k;
  f.invert = (p) => d0 + (p - r0) / k;
  f.domain = [d0, d1];
  f.range = [r0, r1];
  return f;
}

/** Langkah tick "bagus" (1, 2, 2,5, 5 × 10^k) untuk rentang `span` dengan paling banyak ~`maxTicks` tick. */
export function niceStep(span, maxTicks = 5) {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / Math.max(1, maxTicks);
  const p = 10 ** Math.floor(Math.log10(raw));
  const r = raw / p;
  const m = r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10;
  return m * p;
}

/** Tick kelipatan langkah bagus di dalam [min, max] (inklusif, toleran galat pembulatan). */
export function niceTicks(min, max, maxTicks = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max < min) [min, max] = [max, min];
  const step = niceStep(max - min, maxTicks);
  const eps = step * 1e-9;
  const out = [];
  for (let v = Math.ceil((min - eps) / step) * step; v <= max + eps; v += step) {
    out.push(Math.abs(v) < eps ? 0 : Number(v.toPrecision(12)));
    if (out.length > 1000) break;
  }
  return out;
}

/** Batas atas "bagus" ≥ v. */
export function niceCeil(v, maxTicks = 4) {
  if (!(v > 0)) return 0;
  const step = niceStep(v, maxTicks);
  return Math.ceil(v / step - 1e-9) * step;
}

function finiteExtent(arrays) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const a of arrays) {
    if (!a) continue;
    for (const v of a) {
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return [lo, hi];
}

/**
 * Domain sumbu-x (hari) dari deret harian: 0..scenarioDays untuk skenario; mode Manual (tanpa batas)
 * memakai jendela bergulir `window` hari terakhir.
 */
export function xDomain(series, window = 60) {
  const total = series?.scenarioDays;
  if (Number.isFinite(total) && total > 0) return [0, total];
  const n = series?.n ?? 0;
  const last = n && series.day ? series.day[n - 1] + 1 : n;
  const end = Math.max(window, last);
  return [end - window, end];
}

/** Indeks [i0, i1) rekaman harian yang (sebagian) tampak di domain hari [x0, x1]. */
export function visibleRange(days, x0, x1) {
  const n = days?.length ?? 0;
  let i0 = 0;
  while (i0 < n && days[i0] + 1 <= x0) i0++;
  let i1 = n;
  while (i1 > i0 && days[i1 - 1] >= x1) i1--;
  return [i0, i1];
}

/** Potongan deret harian [i0, i1) dengan bentuk sama seperti dailySeries(). */
export function sliceSeries(series, i0, i1) {
  if (!series) return series;
  if (i0 === 0 && i1 === series.n) return series;
  const out = { ...series, n: Math.max(0, i1 - i0) };
  for (const [k, v] of Object.entries(series)) {
    if (Array.isArray(v) && v.length === series.n) out[k] = v.slice(i0, i1);
  }
  out.depthCm = Object.fromEntries(Object.entries(series.depthCm ?? {}).map(([id, a]) => [id, a.slice(i0, i1)]));
  return out;
}

/** Domain panel muka air (cm relatif permukaan): [min(−120, data), +20], dibulatkan ke 20 cm. */
export function waterDomain(arrays) {
  const [lo, hi] = finiteExtent(arrays);
  const low = Number.isFinite(lo) ? Math.min(-120, Math.floor((lo - 5) / 20) * 20) : -120;
  const high = Number.isFinite(hi) ? Math.max(20, Math.ceil((hi + 5) / 20) * 20) : 20;
  return [low, high];
}

/** Domain panel hujan (mm/hari): [0, ≥ 20]. */
export function rainDomain(values) {
  const [, hi] = finiteExtent([values]);
  return [0, niceCeil(Math.max(20, Number.isFinite(hi) ? hi : 0))];
}

/** Domain panel pembuangan (mm/hari): termasuk 0, minimal [0, 5]; aliran balik membuat batas bawah negatif. */
export function flowDomain(values) {
  const [lo, hi] = finiteExtent([values]);
  const top = niceCeil(Math.max(5, Number.isFinite(hi) ? hi : 0));
  const bottom = Number.isFinite(lo) && lo < 0 ? -niceCeil(-lo) : 0;
  return [bottom, top];
}

/**
 * Tick tanggal untuk hari x0..x1 (indeks hari relatif tanggal 1 `startMonth`).
 * Awal bulan diberi nama bulan; tanggal 15 ditambahkan bila ruang cukup. Bila rapat, bulan dilompati.
 * Keluaran: [{day, label, major}] dengan `day` = posisi awal hari tersebut.
 */
export function dayTicks(x0, x1, startMonth, widthPx, minGapPx = 34) {
  const span = Math.max(1e-9, x1 - x0);
  const pxPerDay = widthPx / span;
  const monthPx = pxPerDay * 30.4;
  const monthEvery = Math.max(1, Math.ceil(minGapPx / Math.max(monthPx, 1e-9)));
  const withMid = monthPx >= 2 * minGapPx;
  const out = [];
  let monthCount = 0;
  for (let d = Math.ceil(x0); d <= Math.floor(x1); d++) {
    const cd = calendarDay(d, startMonth);
    if (cd.day === 1) {
      if (monthCount % monthEvery === 0) out.push({ day: d, label: MONTH_NAMES_ID[cd.month], major: true });
      monthCount++;
    } else if (withMid && cd.day === 15) {
      out.push({ day: d, label: '15', major: false });
    }
  }
  // Rentang pendek tanpa awal bulan: beri tick tiap minggu agar sumbu tetap terbaca.
  if (out.length < 2) {
    const step = Math.max(1, niceStep(span, Math.max(2, Math.floor(widthPx / (minGapPx * 1.6)))));
    const extra = [];
    for (let d = Math.ceil(x0 / step) * step; d <= x1; d += step) {
      if (out.some((t) => Math.abs(t.day - d) * pxPerDay < minGapPx)) continue;
      const cd = calendarDay(d, startMonth);
      extra.push({ day: d, label: `${cd.day} ${MONTH_NAMES_ID[cd.month]}`, major: false });
    }
    out.push(...extra);
    out.sort((a, b) => a.day - b.day);
  }
  return out;
}

/** Indeks rekaman harian terdekat untuk posisi hari kontinu `t` (rekaman i menempati [day_i, day_i+1)). */
export function nearestIndex(days, t) {
  if (!days || days.length === 0) return -1;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < days.length; i++) {
    const d = Math.abs(days[i] + 0.5 - t);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Tata letak tiga panel bertumpuk berbagi sumbu-x.
 * Keluaran: {plot:{x,w}, rain:{y,h}, water:{y,h}, flow:{y,h}, axisY}.
 */
export function chartLayout(width, height, { left = 46, right = 40, top = 16, gap = 18, axis = 18 } = {}) {
  const w = Math.max(10, width - left - right);
  const avail = Math.max(60, height - top - axis - 2 * gap);
  const small = Math.max(22, Math.min(64, Math.round(avail * 0.2)));
  const rainH = small;
  const flowH = small;
  const waterH = Math.max(30, avail - rainH - flowH);
  const rainY = top;
  const waterY = rainY + rainH + gap;
  const flowY = waterY + waterH + gap;
  return {
    plot: { x: left, w },
    rain: { y: rainY, h: rainH },
    water: { y: waterY, h: waterH },
    flow: { y: flowY, h: flowH },
    axisY: flowY + flowH + 4,
  };
}

/** Segmen kelas TMAT perusahaan dalam elevasi (cm relatif permukaan, positif ke atas) untuk pita latar. */
export function classBands(classes, [lo, hi]) {
  return classes.map((c) => {
    // kedalaman d ∈ (min, max] → elevasi e = −d ∈ [−max, −min)
    const top = Math.min(hi, Number.isFinite(c.min) ? 0 - c.min : hi);
    const bottom = Math.max(lo, Number.isFinite(c.max) ? 0 - c.max : lo);
    return { id: c.id, label: c.label, color: c.color, top, bottom };
  }).filter((b) => b.top > b.bottom);
}
