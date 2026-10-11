// Baris tabel harian dan pembangun CSV (tanpa DOM; dites di Node).
// Muka air ditulis sebagai elevasi bertanda relatif permukaan gambut (cm, negatif = di bawah permukaan).
import { classifyTmat, ppCompliant } from '../model/index.js';

/** Baris harian (objek angka mentah) dari dailySeries(); urutan kronologis. */
export function dailyRows(series) {
  const n = series?.n ?? 0;
  const ids = series?.piezometerIds ?? [];
  const rows = new Array(n);
  for (let i = 0; i < n; i++) {
    const tp = series.tpDepthCm[i];
    const elev = {};
    for (const id of ids) elev[id] = -series.depthCm[id][i];
    rows[i] = {
      day: series.day[i] + 1, // hari ke-1 = hari pertama skenario
      date: series.dateLabel[i],
      rain: series.rain_mm[i],
      elev,
      tmas: -series.tmasCm[i],
      q_m3s: series.q_m3s[i],
      q_mmd: series.q_mmd[i],
      nLogs: series.nLogs[i],
      cls: classifyTmat(tp),
      pp: ppCompliant(tp),
      partial: !!series.partial?.[i],
    };
  }
  return rows;
}

/** Kolom CSV: [judul, fungsi nilai]. Desimal titik, pemisah koma (CSV standar). */
export function csvColumns(ids) {
  const num = (d) => (v) => (Number.isFinite(v) ? Number(v.toFixed(d)) : '');
  return [
    ['hari', (r) => r.day],
    ['tanggal', (r) => r.date],
    ['hujan_mm', (r) => num(1)(r.rain)],
    ...ids.map((id) => [`${id}_cm`, (r) => num(1)(r.elev[id])]),
    ['TMAS_cm', (r) => num(1)(r.tmas)],
    ['Q_m3_s', (r) => num(4)(r.q_m3s)],
    ['Q_mm_hari', (r) => num(2)(r.q_mmd)],
    ['stoplog', (r) => r.nLogs],
    ['kategori_TP', (r) => r.cls.label],
    ['PP_57_2016', (r) => (r.pp ? 'patuh' : 'tidak patuh')],
    ['hari_lengkap', (r) => (r.partial ? 'tidak' : 'ya')],
  ];
}

/** Escape satu sel CSV (RFC 4180). */
export function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Teks CSV lengkap (CRLF) dari deret harian. */
export function buildCsv(series) {
  const ids = series?.piezometerIds ?? [];
  const cols = csvColumns(ids);
  const lines = [cols.map(([h]) => csvCell(h)).join(',')];
  for (const r of dailyRows(series)) lines.push(cols.map(([, f]) => csvCell(f(r))).join(','));
  return lines.join('\r\n') + '\r\n';
}
