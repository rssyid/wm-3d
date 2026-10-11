// Pembangun string MathML murni (tanpa DOM) untuk tab "Persamaan & Perhitungan".
// Semua fungsi mengembalikan string; teks dan nilai atribut selalu di-escape. Bisa dites di Node.
//
// Konvensi: argumen anak (basis, pangkat, pembilang, …) boleh berupa satu elemen atau beberapa elemen
// berurutan (string gabungan atau array); bila lebih dari satu elemen, otomatis dibungkus <mrow>
// agar jumlah anak elemen MathML (msub, mfrac, …) selalu tepat.
//
// Catatan render (Chromium tanpa fon matematika OpenType): kurung kurawal tidak bisa meregang dan aksen
// <mover> bisa hilang. Karena itu `cases` memakai kurawal yang diskalakan CSS (kelas eq-brace) dan
// `bar` memakai text-decoration (kelas eq-ol); keduanya juga tampil benar bila fon matematika tersedia.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape teks untuk HTML/MathML (konten dan nilai atribut). */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

const ATTR_NAME = /^[a-zA-Z_][-a-zA-Z0-9_:.]*$/;

function attrs(a) {
  if (!a) return '';
  let s = '';
  for (const [k, v] of Object.entries(a)) {
    if (v == null || v === false) continue;
    if (!ATTR_NAME.test(k)) throw new Error(`Nama atribut MathML tidak sah: ${k}`);
    s += v === true ? ` ${k}` : ` ${k}="${esc(v)}"`;
  }
  return s;
}

/** Elemen generik <tag attrs>isi</tag> (isi sudah berupa markup). */
export function el(tag, content, a) {
  return `<${tag}${attrs(a)}>${content}</${tag}>`;
}

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^>]*?)?(\/?)>/g;

/** true bila string berisi tepat satu elemen tingkat atas (tanpa teks lepas). */
export function isSingleElement(s) {
  const str = String(s).trim();
  if (!str.startsWith('<') || !str.endsWith('>')) return false;
  let depth = 0;
  let tops = 0;
  let last = 0;
  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(str))) {
    if (depth === 0 && str.slice(last, m.index).trim() !== '') return false;
    const closing = m[1] === '/';
    const selfClosing = m[3] === '/';
    if (closing) depth--;
    else if (selfClosing) {
      if (depth === 0) tops++;
    } else {
      if (depth === 0) tops++;
      depth++;
    }
    if (depth < 0) return false;
    last = TAG_RE.lastIndex;
  }
  return depth === 0 && tops === 1 && str.slice(last).trim() === '';
}

function joinItems(x) {
  return Array.isArray(x) ? x.flat(Infinity).join('') : String(x ?? '');
}

/** Pastikan tepat satu elemen: bungkus dengan <mrow> bila perlu. */
export function wrap(x) {
  const s = joinItems(x);
  return isSingleElement(s) ? s : `<mrow>${s}</mrow>`;
}

/** Angka JS → teks gaya Indonesia (koma desimal, minus tipografis). Lebih baik kirim string terformat. */
function textOf(v) {
  if (typeof v === 'number') return String(v).replace(/-/g, '−').replace('.', ',');
  return String(v ?? '');
}

/** Identifier (variabel). Satu huruf → miring (bawaan MathML); multi-huruf → tegak. */
export const mi = (name, a) => el('mi', esc(textOf(name)), a);
/** Identifier tegak (mis. "e", "Δ", "max"). */
export const up = (name, a) => el('mi', esc(textOf(name)), { mathvariant: 'normal', ...(a || {}) });
/** Angka. Kirim string yang sudah diformat (koma desimal) bila perlu presisi tertentu. */
export const mn = (v, a) => el('mn', esc(textOf(v)), a);
/** Operator. */
export const mo = (op, a) => el('mo', esc(op), a);
/** Teks biasa di dalam rumus. */
export const mtext = (t, a) => el('mtext', esc(t), a);
/** Spasi horizontal. */
export const space = (width = '0.25em') => el('mspace', '', { width });
/** Garis miring rapat (a/b sebaris, tanpa spasi operator). */
export const slash = () => mo('/', { lspace: '0', rspace: '0' });
/** Tanda turunan parsial ∂ (tanpa spasi kanan). */
export const partial = () => mo('∂', { rspace: '0' });
/** Perkalian tak terlihat (U+2062) dan aplikasi fungsi (U+2061). */
export const times0 = () => mo('⁢');
export const apply0 = () => mo('⁡');

/** Kelompok berurutan. */
export const row = (...items) => el('mrow', joinItems(items));
export const frac = (num, den, a) => el('mfrac', wrap(num) + wrap(den), a);
export const sup = (base, exp) => el('msup', wrap(base) + wrap(exp));
export const sub = (base, s) => el('msub', wrap(base) + wrap(s));
export const msubsup = (base, s, p) => el('msubsup', wrap(base) + wrap(s) + wrap(p));
export const sqrt = (...x) => el('msqrt', joinItems(x));
export const under = (base, u) => el('munder', wrap(base) + wrap(u));
export const over = (base, o, accent = true) => el('mover', wrap(base) + wrap(o), accent ? { accent: 'true' } : null);
export const underover = (base, u, o) => el('munderover', wrap(base) + wrap(u) + wrap(o));

/**
 * Garis atas (rata-rata), mis. T̄. Nama string → <mi class="eq-ol">; markup → <mrow class="eq-ol">.
 * Garis digambar dengan CSS text-decoration (lihat css/equations.css).
 */
export function bar(x) {
  if (typeof x === 'string' && !x.startsWith('<')) return mi(x, { class: 'eq-ol' });
  return el('mrow', joinItems(x), { class: 'eq-ol' });
}

/** Tanda kurung. */
export function paren(x, open = '(', close = ')') {
  return row(mo(open), joinItems(x), mo(close));
}

/** lhs = rhs₁ = rhs₂ … */
export function eq(lhs, ...rhs) {
  const parts = [lhs];
  for (const r of rhs) parts.push(mo('='), r);
  return row(...parts);
}

/** Fungsi: f(arg₁, arg₂ …); nama string → <mi> (multi-huruf otomatis tegak). sep: pemisah argumen. */
export function fn(name, args, sep = ',') {
  const f = typeof name === 'string' && !name.startsWith('<') ? mi(name) : name;
  const list = Array.isArray(args) ? args : [args];
  const inner = list.flatMap((a, i) => (i ? [mo(sep), a] : [a]));
  return row(f, apply0(), paren(inner));
}

/** Penjumlahan dengan batas: Σ_{bawah}^{atas} isi. */
export function sum(lower, upper, body) {
  const op = mo('∑');
  const s = upper == null ? under(op, lower) : underover(op, lower, upper);
  return row(s, body);
}

/** Tabel MathML: rows = [[sel, sel, …], …]. */
export function mtable(rows, a) {
  const body = rows.map((r) => el('mtr', r.map((c) => el('mtd', joinItems(c))).join(''))).join('');
  return el('mtable', body, a);
}

/**
 * Fungsi sepotong-sepotong: { ekspr₁  bila syarat₁ ; … }. list = [[ekspr, syarat], …].
 * Kurawal diskalakan sesuai jumlah baris (CSS var --rows).
 */
export function cases(list) {
  const t = mtable(
    list.map(([expr, cond]) => [expr, cond == null ? '' : cond]),
    { class: 'eq-cases' },
  );
  const n = Math.max(1, list.length);
  return row(mo('{', { stretchy: 'false', class: 'eq-brace', style: `--rows:${n}` }), t);
}

/** Syarat "bila …" untuk cases. */
export const when = (...cond) => row(mtext('bila'), space('0.4em'), ...cond);

/** Elemen <math> akar. display: 'block' | 'inline'. label → aria-label (deskripsi lisan opsional). */
export function math(content, { display = 'block', label } = {}) {
  const a = { display: display === 'block' ? 'block' : null, 'aria-label': label || null };
  return el('math', joinItems(content), a);
}

/** Pintasan rumus sebaris. */
export const imath = (...content) => math(joinItems(content), { display: 'inline' });

/** Anak-anak elemen tingkat atas dari satu elemen pembungkus (mis. isi <mrow>…</mrow>). */
export function topChildren(markup) {
  const str = String(markup).trim();
  const open = /^<([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^>]*)?>/.exec(str);
  if (!open || !str.endsWith(`</${open[1]}>`)) return null;
  const inner = str.slice(open[0].length, str.length - open[1].length - 3);
  const out = [];
  let depth = 0;
  let start = 0;
  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(inner))) {
    const closing = m[1] === '/';
    const selfClosing = m[3] === '/';
    if (closing) {
      depth--;
      if (depth === 0) {
        out.push(inner.slice(start, TAG_RE.lastIndex));
        start = TAG_RE.lastIndex;
      }
    } else if (selfClosing) {
      if (depth === 0) {
        out.push(inner.slice(start, TAG_RE.lastIndex));
        start = TAG_RE.lastIndex;
      }
    } else {
      if (depth === 0) start = m.index;
      depth++;
    }
  }
  return depth === 0 ? out : null;
}

/**
 * Pecah rumus "A, B, C" (mrow tingkat atas dengan pemisah <mo>,</mo><mspace>) menjadi bagian-bagian
 * agar bisa dibungkus ke baris baru di layar sempit. Mengembalikan [isi] bila tidak ada pemisah.
 */
export function splitParts(markup) {
  const kids = String(markup).startsWith('<mrow>') ? topChildren(markup) : null;
  if (!kids) return [markup];
  const parts = [];
  let cur = [];
  for (let i = 0; i < kids.length; i++) {
    if (kids[i] === '<mo>,</mo>' && kids[i + 1]?.startsWith('<mspace')) {
      parts.push(cur);
      cur = [];
      i++;
      continue;
    }
    cur.push(kids[i]);
  }
  parts.push(cur);
  if (parts.length < 2 || parts.some((p) => p.length === 0)) return [markup];
  return parts.map((p) => (p.length === 1 ? p[0] : `<mrow>${p.join('')}</mrow>`));
}
