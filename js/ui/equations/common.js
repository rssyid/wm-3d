// Pembantu bersama bagian-bagian tab Persamaan: format angka (HTML & MathML), simbol baku,
// tabel, dan baris "Perhitungan saat ini". Murni (tanpa DOM) → bisa dites di Node.
// Di sini hanya ada format & konversi satuan; angka fisika berasal dari model (explain dkk.).
import { fmt, fmtSigned, MINUS } from '../format.js';
import { esc, mi, up, mn, mo, mtext, row, sub, sup, bar, math, imath, paren, fn, space, slash, splitParts } from './mathml.js';

export { esc, fmt, fmtSigned, MINUS };

const SUP = { '-': '⁻', '−': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

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

/** Angka dengan `sig` angka penting; notasi ilmiah untuk |v| < 1e-3 atau ≥ 1e7. */
export function fmtSig(v, sig = 3) {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 1e-3 || a >= 1e7) return fmtSci(v, sig);
  return fmt(v, digitsFor(v, sig));
}

// ---------- angka di dalam MathML ----------

/** <mn> dengan `d` desimal (koma desimal, minus tipografis). Negatif → <mo>−</mo><mn>…</mn>. */
export function nm(v, d = 2) {
  const s = fmt(v, d);
  if (s.startsWith(MINUS)) return row(mo(MINUS), mn(s.slice(1)));
  return mn(s);
}

/** <mn> dengan angka penting; notasi ilmiah → 3,27 × 10^−11. */
export function ns(v, sig = 3) {
  if (!Number.isFinite(v)) return mn('—');
  const a = Math.abs(v);
  if (v !== 0 && (a < 1e-3 || a >= 1e7)) {
    const { m, e } = sciParts(v, sig);
    return row(nm(m, sig - 1), mo('×'), sup(mn('10'), nm(e, 0)));
  }
  return nm(v, digitsFor(v, sig));
}

const isNeg = (v, d) => v < 0 && fmt(v, d) !== fmt(0, d);

/** Seperti nm, tetapi bilangan negatif diberi kurung (untuk perkalian/pengurangan). */
export function nmp(v, d = 2) {
  return isNeg(v, d) ? paren(nm(v, d)) : nm(v, d);
}

export function nsp(v, sig = 3) {
  return v < 0 && fmtSig(v, sig) !== '0' ? paren(ns(v, sig)) : ns(v, sig);
}

/** Satuan kecil di dalam rumus (teks tegak, didahului spasi tipis). */
export const unit = (u) => row(space('0.2em'), mtext(u, { class: 'eq-unit' }));

/** Nilai + satuan di dalam rumus. */
export const nmu = (v, d, u) => row(nm(v, d), unit(u));

// ---------- simbol baku (dipakai konsisten di semua bagian) ----------

const s = (a, b) => sub(mi(a), typeof b === 'string' && !b.startsWith('<') ? mi(b) : b);
const half = (sign) => row(mi('i'), mo(sign), mn('½'));
const Delta = (x) => row(up('Δ'), x);

export const SYM = {
  x: mi('x'),
  i: mi('i'),
  N: mi('N'),
  n: mi('n'),
  t: mi('t'),
  z: mi('z'),
  zi: s('z', 'i'),
  zim1: sub(mi('z'), row(mi('i'), mo('−'), mn('1'))),
  zip1: sub(mi('z'), row(mi('i'), mo('+'), mn('1'))),
  z0: sub(mi('z'), mn('0')),
  zs: s('z', 's'),
  zsi: sub(mi('z'), row(mi('s'), mo(','), mi('i'))),
  zeta: mi('ζ'),
  zetai: s('ζ', 'i'),
  D: mi('D'),
  Di: s('D', 'i'),
  W: mi('W'),
  Wi: s('W', 'i'),
  Sy: s('S', 'y'),
  Syi: sub(mi('S'), row(mi('y'), mo(','), mi('i'))),
  SyS: sub(mi('S'), row(mi('y'), mo(','), mi('s'))),
  SyD: sub(mi('S'), row(mi('y'), mo(','), mi('d'))),
  lamS: s('λ', 'S'),
  K: mi('K'),
  Ks: s('K', 's'),
  Kd: s('K', 'd'),
  lamK: s('λ', 'K'),
  T: mi('T'),
  Ti: s('T', 'i'),
  Tim1: sub(mi('T'), row(mi('i'), mo('−'), mn('1'))),
  Tbar: bar('T'),
  TbarL: sub(bar('T'), half('−')),
  TbarR: sub(bar('T'), half('+')),
  Tb: sub(bar('T'), mi('b')),
  Tc: s('T', 'c'),
  Tm: sub(bar('T'), mi('m')),
  P: mi('P'),
  ET: mi('ET'),
  ETi: s('ET', 'i'),
  ETp: s('ET', 'p'),
  beta: mi('β'),
  betaMin: s('β', 'min'),
  zeta1: sub(mi('ζ'), mn('1')),
  zeta2: sub(mi('ζ'), mn('2')),
  dg: s('δ', 'g'),
  q: mi('q'),
  qL: sub(mi('q'), half('−')),
  qR: sub(mi('q'), half('+')),
  qb: s('q', 'b'),
  qN: sub(mi('q'), row(mi('N'), mo('−'), mn('½'))),
  f: mi('f'),
  fi: s('f', 'i'),
  r: mi('r'),
  ri: s('r', 'i'),
  ks: s('k', 's'),
  dx: Delta(mi('x')),
  dt: Delta(mi('t')),
  hc: s('h', 'c'),
  hcs: s('h', 'cs'),
  hr: s('h', 'r'),
  hfd: s('h', 'fd'),
  zfd: s('z', 'fd'),
  zfdi: sub(mi('z'), row(mi('fd'), mo(','), mi('i'))),
  dfd: s('d', 'fd'),
  sfd: mi('s'),
  zbank: s('z', 'tanggul'),
  zbase: s('z', 'dasar'),
  zbed: s('z', 'dk'),
  zb: s('z', 'b'),
  Vc: s('V', 'c'),
  V: mi('V'),
  Aw: s('A', 'w'),
  Acp: s('A', 'cp'),
  Atot: s('A', 'tot'),
  Ablock: s('A', 'blok'),
  ai: s('a', 'i'),
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
  dp: s('δ', 'p'),
  Eow: s('E', 'ow'),
  cow: s('c', 'ow'),
  Er: s('E', 'r'),
  tauR: s('τ', 'R'),
  gR: s('g', 'R'),
  zR0: sub(mi('z'), row(mi('R'), mn('0'))),
  zRmax: sub(mi('z'), row(mi('R'), mo(','), mi('maks'))),
  d: mi('d'),
  C: mi('C'),
  ck: s('c', 'k'),
  Lam: s('Λ', 'i'),
  dtgw: sub(Delta(mi('t')), mi('gw')),
  dtc: sub(Delta(mi('t')), mi('c')),
  dtmin: sub(Delta(mi('t')), mi('min')),
  TMAS: mi('TMAS'),
  TMAT: mi('d'),
};

/** S(r) sebagai fungsi. */
export const Sfn = (arg) => fn(mi('S'), [arg]);
/** Rasio a/b sebaris. */
export const ratio = (a, b) => row(a, slash(), b);
/** Pangkat 3/2 rapat. */
export const p32 = () => row(mn('3'), slash(), mn('2'));
/** e pangkat (tegak). */
export const ex = (power) => sup(up('e'), power);

/** Simbol sebaris (untuk sel tabel). */
export const sm = (x) => imath(x);

// ---------- konversi satuan (presentasi saja) ----------

export const toMm = (m) => m * 1000; // m → mm (atau m/hari → mm/hari)
export const toCm = (m) => m * 100;
export const m3dToMm = (v, A) => (v * 1000) / A; // m³/hari → mm/hari atas luas A
export const daysToMin = (d) => d * 1440;
export const daysToHours = (d) => d * 24;

// ---------- HTML ----------

/**
 * Tabel data. head: array string HTML; rows: array baris (array string HTML).
 * opts.num: indeks kolom angka (rata kanan, mono). opts.caption: teks keterangan. opts.cls: kelas tambahan.
 * opts.rowAttrs(i): atribut tambahan untuk <tr>.
 */
export function table(head, rows, { num = [], caption = '', cls = '', rowAttrs, label = '' } = {}) {
  const numSet = new Set(num);
  const th = head.map((h, j) => `<th scope="col"${numSet.has(j) ? ' class="n"' : ''}>${h}</th>`).join('');
  const body = rows
    .map((r, i) => {
      const ra = rowAttrs ? rowAttrs(i) : '';
      return `<tr${ra}>${r.map((c, j) => (j === 0 ? `<th scope="row">${c}</th>` : `<td${numSet.has(j) ? ' class="n"' : ''}>${c}</td>`)).join('')}</tr>`;
    })
    .join('');
  // Keterangan ditulis di luar kotak gulir (tabel lebar di ponsel tidak memotongnya); nama aksesibel tabel = teks keterangan.
  const capText = caption ? stripTags(caption) : '';
  const cap = caption ? `<p class="eq-table-cap" aria-hidden="true">${caption}</p>` : '';
  const aria = label ? ` role="region" aria-label="${esc(label)}" tabindex="0"` : '';
  const tAria = capText ? ` aria-label="${esc(capText)}"` : '';
  return `${cap}<div class="eq-scroll"${aria}><table class="eq-table ${cls}"${tAria}><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
/** Teks polos dari potongan HTML sederhana (untuk aria-label). */
export function stripTags(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENT[m])
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tabel simbol: [{sym (isi MathML), arti, unit, val | valHtml}] → Simbol | Arti | Satuan | Nilai saat ini. */
export function symTable(rows, { caption = 'Simbol' } = {}) {
  return table(
    ['Simbol', 'Arti', 'Satuan', 'Nilai saat ini'],
    rows.map((r) => {
      const u = r.unitHtml ?? esc(r.unit || '–');
      const uInline = u && u !== '–' ? `<span class="eq-u"> ${u}</span>` : '';
      return [sm(r.sym), r.artiHtml ?? esc(r.arti), u, `${r.valHtml ?? esc(r.val ?? '–')}${uInline}`];
    }),
    { num: [3], cls: 'eq-sym', caption: esc(caption), label: caption },
  );
}

/**
 * Satu baris perhitungan: lhs = substitusi = hasil [catatan].
 * lhs & subst: isi MathML (tanpa <math>); result: HTML (sudah di-escape); resultAttrs: atribut tambahan.
 */
export function line(lhs, subst, result, { note = '', resultAttrs = '' } = {}) {
  let html = `<span class="eq-l">${imath(lhs)}</span><span class="eq-op">=</span>`;
  if (subst) html += `<span class="eq-s">${imath(subst)}</span><span class="eq-op">=</span>`;
  html += `<strong class="eq-res"${resultAttrs}>${result}</strong>`;
  if (note) html += `<span class="eq-note">${note}</span>`;
  return `<div class="eq-line">${html}</div>`;
}

/** Baris teks bebas di dalam blok perhitungan. */
export const textLine = (html) => `<p class="eq-line eq-line-text">${html}</p>`;

/** Blok perhitungan berisi judul kecil + baris-baris. */
export function calc(lines, { title = '', foot = '' } = {}) {
  const t = title ? `<p class="eq-calc-sub">${title}</p>` : '';
  const f = foot ? `<p class="eq-calc-foot">${foot}</p>` : '';
  return `${t}${lines.join('')}${f}`;
}

/** Kotak "Perhitungan saat ini" (isi diisi lewat data-live). */
export function calcBox(key, title = 'Perhitungan saat ini') {
  return `<section class="eq-calc" aria-label="${esc(title)}"><h3 class="eq-calc-title"><span class="eq-dot" aria-hidden="true"></span>${esc(title)}</h3><div class="eq-live" data-live="${esc(key)}"></div></section>`;
}

/**
 * Persamaan bernomor (blok). Rumus "A, B" (dipisah koma + spasi di tingkat atas) dipecah menjadi beberapa
 * <math> yang berdampingan di layar lebar dan turun ke baris baru di layar sempit.
 */
export function display(content, num, label) {
  const parts = splitParts(Array.isArray(content) ? content.join('') : content);
  const body = parts.length > 1 ? parts.map((p, i) => math(p, { label: i === 0 ? label : undefined })).join('') : math(parts[0], { label });
  return `<div class="eq-display"><div class="eq-display-math${parts.length > 1 ? ' eq-parts' : ''}">${body}</div>${num ? `<span class="eq-num">(${esc(num)})</span>` : ''}</div>`;
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
export function ppBadge(ok, short = false) {
  if (ok == null) return '–';
  const t = short ? (ok ? 'Patuh' : 'Tidak patuh') : ok ? 'Patuh PP' : 'Tidak patuh PP';
  return ok
    ? `<span class="eq-pp eq-pp-ok"><span aria-hidden="true">✓</span> ${t}</span>`
    : `<span class="eq-pp eq-pp-bad"><span aria-hidden="true">✕</span> ${t}</span>`;
}

/** Kerangka bagian: judul, pengantar. */
export function sectionHead({ id, n, total, title }) {
  return `<header class="eq-sec-head">
  <p class="eq-kicker">Bagian ${n} dari ${total}</p>
  <h2 id="eq-h-${esc(id)}" tabindex="-1">${esc(title)}</h2>
</header>`;
}

/** Placeholder untuk konten dinamis. */
export const live = (key, cls = '') => `<div class="eq-live ${cls}" data-live="${esc(key)}"></div>`;

/** Kanvas grafik mini + keterangan. */
export function plot(key, caption, { legend = '', tall = false } = {}) {
  return `<figure class="eq-plot${tall ? ' eq-plot-tall' : ''}"><div class="eq-canvas-wrap"><canvas data-plot="${esc(key)}" role="img" aria-label="${esc(caption)}"></canvas></div><figcaption>${esc(caption)}${legend ? `<span class="eq-legend">${legend}</span>` : ''}</figcaption></figure>`;
}

/** Item legenda: warna token (--nama) atau hex. */
export function legendItem(label, color, { dash = false, dot = false, bar: isBar = false } = {}) {
  const c = color.startsWith('--') ? `var(${color})` : color;
  const k = dot ? 'eq-key-dot' : isBar ? 'eq-key-bar' : dash ? 'eq-key-dash' : 'eq-key-line';
  return `<span class="eq-key"><span class="${k}" style="--key:${esc(c)}"></span>${esc(label)}</span>`;
}

/** Elevasi bertanda relatif permukaan dari kedalaman (m, positif ke bawah): 0,33 → "−33 cm". */
export function elevCm(depthM, d = 0) {
  return `${fmtSigned(-depthM * 100, d)} cm`;
}

/** Nilai dengan satuan (HTML). */
export const vu = (v, d, u) => `${fmt(v, d)}${u ? ` ${u}` : ''}`;
export const m = (v, d = 3) => `${fmt(v, d)} m`;

/** Sub-judul dalam bagian. */
export const h3 = (t, id) => `<h3 class="eq-h3"${id ? ` id="${esc(id)}"` : ''}>${esc(t)}</h3>`;

/** Paragraf (isi HTML tepercaya dari kode sendiri). */
export const p = (html) => `<p>${html}</p>`;

/** Simbol sebaris di dalam paragraf. */
export const im = (...x) => imath(...x);

/** Keterangan sel hitung untuk piezometer pilihan: "sel i = 15 (x = 77,5 m), terdekat dengan P3 (x = 75 m)". */
export function cellCaption(c) {
  const k = c.e.cell;
  const pz = k.piezometerId ?? c.pz;
  const px = k.piezometerX ?? NaN;
  const tp = pz === c.snap.ind.tpId ? ' · titik penaatan' : '';
  return `Sel hitung <strong>i = ${k.i}</strong> (x = ${fmt(k.x, 1)} m), sel terdekat dengan <strong>${esc(pz)}</strong> (x = ${fmt(px, 0)} m${tp}).`;
}
