// Pembantu bersama bagian-bagian tab Persamaan: format angka (HTML & MathML), simbol baku,
// tabel, dan baris "Perhitungan saat ini". Murni (tanpa DOM) → bisa dites di Node.
// Catatan: di sini hanya ada konversi satuan & format; angka fisika berasal dari model (explain dkk.).
import { fmt, fmtSigned, MINUS } from '../format.js';
import { esc, mi, mn, mo, mtext, row, sub, sup, bar, math, imath, paren } from './mathml.js';

export { esc, fmt, fmtSigned, MINUS };

const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

/** Desimal untuk `sig` angka penting (dibatasi 0…max). */
export function digitsFor(v, sig = 3, max = 6) {
  if (!Number.isFinite(v) || v === 0) return Math.min(sig - 1, max);
  const e = Math.floor(Math.log10(Math.abs(v)));
  return Math.min(Math.max(sig - 1 - e, 0), max);
}

function sciParts(v, sig) {
  let e = Math.floor(Math.log10(Math.abs(v)));
  let m = v / 10 ** e;
  if (Math.abs(Number(m.toFixed(sig - 1))) >= 10) {
    e += 1;
    m = v / 10 ** e;
  }
  return { m, e };
}

/** Notasi ilmiah teks: "3,27 × 10⁻¹¹". */
export function fmtSci(v, sig = 3) {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const { m, e } = sciParts(v, sig);
  const exp = String(e).replace(/[-0-9]/g, (c) => SUP[c]);
  return `${fmt(m, sig - 1)} × 10${exp}`;
}

/** Angka dengan `sig` angka penting; notasi ilmiah untuk |v| < 1e-4 atau ≥ 1e7. */
export function fmtSig(v, sig = 3) {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 1e-4 || a >= 1e7) return fmtSci(v, sig);
  return fmt(v, digitsFor(v, sig));
}

// ---------- angka di dalam MathML ----------

/** <mn> dengan `d` desimal (koma desimal, minus tipografis). */
export function nm(v, d = 2) {
  return mn(fmt(v, d));
}

/** <mn> dengan angka penting; notasi ilmiah → 3,27 × 10^−11. */
export function ns(v, sig = 3) {
  if (!Number.isFinite(v)) return mn('—');
  const a = Math.abs(v);
  if (v !== 0 && (a < 1e-4 || a >= 1e7)) {
    const { m, e } = sciParts(v, sig);
    return row(mn(fmt(m, sig - 1)), mo('×'), sup(mn('10'), mn(fmt(e, 0))));
  }
  return mn(fmtSig(v, sig));
}

/** Seperti nm, tetapi bilangan negatif diberi kurung (untuk perkalian/pengurangan). */
export function nmp(v, d = 2) {
  return v < 0 && fmt(v, d) !== fmt(0, d) ? paren(nm(v, d)) : nm(v, d);
}

export function nsp(v, sig = 3) {
  return v < 0 ? paren(ns(v, sig)) : ns(v, sig);
}

// ---------- simbol baku (dipakai konsisten di semua bagian) ----------

const s = (a, b) => sub(mi(a), typeof b === 'string' && !b.startsWith('<') ? mi(b) : b);
const half = (sign) => row(mi('i'), mo(sign), mn('½'));

export const SYM = {
  x: mi('x'),
  z: mi('z'),
  zi: s('z', 'i'),
  zs: s('z', 's'),
  zeta: mi('ζ'),
  D: mi('D'),
  W: mi('W'),
  Sy: s('S', 'y'),
  SyS: sub(mi('S'), row(mi('y'), mo(','), mi('s'))),
  SyD: sub(mi('S'), row(mi('y'), mo(','), mi('d'))),
  lamS: s('λ', 'S'),
  K: mi('K'),
  Ks: s('K', 's'),
  Kd: s('K', 'd'),
  lamK: s('λ', 'K'),
  T: mi('T'),
  Tbar: bar(mi('T')),
  P: mi('P'),
  ET: mi('ET'),
  ETp: s('ET', 'p'),
  beta: mi('β'),
  q: mi('q'),
  qL: sub(mi('q'), half('−')),
  qR: sub(mi('q'), half('+')),
  qb: s('q', 'b'),
  f: mi('f'),
  r: mi('r'),
  dx: row(mo('Δ'), mi('x')),
  dt: row(mo('Δ'), mi('t')),
  hc: s('h', 'c'),
  hcs: s('h', 'cs'),
  hr: s('h', 'r'),
  hfd: s('h', 'fd'),
  zfd: s('z', 'fd'),
  zbank: s('z', 'tanggul'),
  zbase: s('z', 'dasar'),
  zbed: s('z', 'dk'),
  Vc: s('V', 'c'),
  Aw: s('A', 'w'),
  Acp: s('A', 'kanal'),
  Atot: s('A', 'tot'),
  Ablock: s('A', 'blok'),
  Lb: s('L', 'b'),
  Lh: s('L', 'h'),
  Hd: s('H', 'd'),
  Q: mi('Q'),
  Cw: s('C', 'w'),
  Lw: s('L', 'w'),
  H1: sub(mi('H'), mn('1')),
  H2: sub(mi('H'), mn('2')),
  crest: s('z', 'mercu'),
  sill: s('z', 'ambang'),
  Eow: s('E', 'ow'),
  Er: s('E', 'r'),
  tauR: s('τ', 'R'),
  gR: s('g', 'R'),
  zR0: sub(mi('z'), row(mi('R'), mn('0'))),
  zRmax: sub(mi('z'), row(mi('R'), mo(','), mi('maks'))),
  d: mi('d'),
};

/** Simbol sebaris (untuk sel tabel). */
export const sm = (x) => imath(x);

// ---------- konversi satuan (presentasi saja) ----------

export const toMm = (m) => m * 1000; // m → mm (atau m/hari → mm/hari)
export const toCm = (m) => m * 100;
export const m3dToMm = (v, A) => (v * 1000) / A; // m³/hari → mm/hari atas luas A
export const daysToHours = (d) => d * 24;
export const daysToMin = (d) => d * 1440;

// ---------- HTML ----------

/**
 * Tabel data. head: array string HTML; rows: array baris (array string HTML).
 * opts.num: indeks kolom angka (rata kanan, mono). opts.caption: teks keterangan. opts.cls: kelas tambahan.
 */
export function table(head, rows, { num = [], caption = '', cls = '', rowAttrs } = {}) {
  const numSet = new Set(num);
  const th = head.map((h, j) => `<th scope="col"${numSet.has(j) ? ' class="n"' : ''}>${h}</th>`).join('');
  const body = rows
    .map((r, i) => {
      const ra = rowAttrs ? rowAttrs(i) : '';
      return `<tr${ra}>${r.map((c, j) => (j === 0 ? `<th scope="row">${c}</th>` : `<td${numSet.has(j) ? ' class="n"' : ''}>${c}</td>`)).join('')}</tr>`;
    })
    .join('');
  const cap = caption ? `<caption>${caption}</caption>` : '';
  return `<div class="eq-scroll"><table class="eq-table ${cls}">${cap}<thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** Tabel simbol: [{sym (MathML isi), arti, unit, val}] → Simbol | Arti | Satuan | Nilai saat ini. */
export function symTable(rows) {
  return table(
    ['Simbol', 'Arti', 'Satuan', 'Nilai saat ini'],
    rows.map((r) => [sm(r.sym), esc(r.arti), r.unitHtml ?? esc(r.unit ?? '–'), r.valHtml ?? esc(r.val ?? '–')]),
    { num: [3], cls: 'eq-sym' },
  );
}

/**
 * Satu baris perhitungan: lhs = substitusi = hasil [catatan].
 * lhs & subst: isi MathML (tanpa <math>); result: HTML (sudah di-escape); attrs opsional untuk elemen hasil.
 */
export function line(lhs, subst, result, { note = '', resultAttrs = '' } = {}) {
  const parts = [`<span class="eq-l">${imath(lhs)}</span>`, '<span class="eq-op">=</span>'];
  let rhs = '';
  if (subst) rhs += `${imath(subst)} <span class="eq-op">=</span> `;
  rhs += `<strong class="eq-res"${resultAttrs}>${result}</strong>`;
  if (note) rhs += ` <span class="eq-note">${note}</span>`;
  parts.push(`<span class="eq-r">${rhs}</span>`);
  return `<div class="eq-line">${parts.join('')}</div>`;
}

/** Blok perhitungan berisi judul kecil + baris-baris. */
export function calc(title, lines, foot = '') {
  const t = title ? `<p class="eq-calc-title">${title}</p>` : '';
  const f = foot ? `<p class="eq-calc-foot">${foot}</p>` : '';
  return `<div class="eq-calc">${t}${lines.join('')}${f}</div>`;
}

/** Persamaan bernomor (blok). */
export function display(content, num, label) {
  return `<div class="eq-display"><div class="eq-display-math">${math(content, { label })}</div>${num ? `<span class="eq-num">(${esc(num)})</span>` : ''}</div>`;
}

/** Kotak catatan (info | warn | bad | ok). */
export function note(html, kind = 'info') {
  return `<div class="eq-note-box eq-note-${kind}">${html}</div>`;
}

/** Badge kategori TMAT perusahaan (ikon + label + warna kelas .st-<id>). */
export function stBadge(cls) {
  if (!cls) return '–';
  return `<span class="st st-${esc(cls.id)}"><span aria-hidden="true">${esc(cls.icon)}</span> ${esc(cls.label)}</span>`;
}

/** Badge kepatuhan PP 57/2016. */
export function ppBadge(ok) {
  return ok
    ? '<span class="eq-pp eq-pp-ok"><span aria-hidden="true">✓</span> Patuh PP</span>'
    : '<span class="eq-pp eq-pp-bad"><span aria-hidden="true">✕</span> Tidak patuh PP</span>';
}

/** Kerangka bagian: judul, pengantar, isi. */
export function sectionShell({ id, n, total, title, lead, body }) {
  return `<header class="eq-sec-head">
  <p class="eq-kicker">Bagian ${n} dari ${total}</p>
  <h2 id="eq-h-${esc(id)}" tabindex="-1">${esc(title)}</h2>
  ${lead ? `<p class="eq-lead">${lead}</p>` : ''}
</header>
${body}`;
}

/** Placeholder untuk konten dinamis. */
export const live = (key, cls = '') => `<div class="eq-live ${cls}" data-live="${esc(key)}"></div>`;

/** Kanvas grafik mini + keterangan. */
export function plot(key, caption, { legend = '', tall = false } = {}) {
  return `<figure class="eq-plot${tall ? ' eq-plot-tall' : ''}"><canvas data-plot="${esc(key)}" role="img" aria-label="${esc(caption)}"></canvas><figcaption>${esc(caption)}${legend ? `<span class="eq-legend">${legend}</span>` : ''}</figcaption></figure>`;
}

/** Item legenda: warna token (var) atau hex. */
export function legendItem(label, color, { dash = false, dot = false } = {}) {
  const c = color.startsWith('--') ? `var(${color})` : color;
  const k = dot ? 'eq-key-dot' : dash ? 'eq-key-dash' : 'eq-key-line';
  return `<span class="eq-key"><span class="${k}" style="--key:${esc(c)}"></span>${esc(label)}</span>`;
}

/** Elevasi bertanda relatif permukaan dari kedalaman (m, positif ke bawah): 0,33 → "−33 cm". */
export function elevCm(depthM, d = 0) {
  return `${fmtSigned(-depthM * 100, d)} cm`;
}

/** Nilai m dengan satuan. */
export const m = (v, d = 3) => `${fmt(v, d)} m`;

/** Aplikasi fungsi dengan pemisah argumen (pakai ';' untuk argumen berangka desimal koma). */
export function fx(name, args, sep = ',') {
  const f = typeof name === 'string' && !name.startsWith('<') ? mi(name) : name;
  return row(f, mo('⁡'), paren(args.flatMap((a, i) => (i ? [mo(sep), a] : [a]))));
}

/** e pangkat (tegak). */
export const ex = (power) => sup(mi('e', { mathvariant: 'normal' }), power);

/** Teks satuan kecil di dalam rumus. */
export const unit = (u) => mtext(` ${u}`);
