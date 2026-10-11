// Pembangun string MathML murni (tanpa DOM) untuk tab "Persamaan & Perhitungan".
// Semua fungsi mengembalikan string; teks selalu di-escape. Bisa dites di Node.
//
// Konvensi: argumen anak (basis, pangkat, pembilang, …) boleh berupa satu elemen atau beberapa elemen
// berurutan; bila lebih dari satu elemen, otomatis dibungkus <mrow> agar jumlah anak MathML tepat.

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

function el(tag, content, a) {
  return `<${tag}${attrs(a)}>${content}</${tag}>`;
}

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)[^>]*?(\/?)>/g;

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

/** Pastikan satu elemen: bungkus dengan <mrow> bila perlu. */
export function wrap(x) {
  const s = Array.isArray(x) ? x.join('') : String(x ?? '');
  return isSingleElement(s) ? s : `<mrow>${s}</mrow>`;
}

function textOf(v) {
  if (typeof v === 'number') return String(v).replace('-', '−').replace('.', ',');
  return String(v ?? '');
}

/** Identifier (variabel). Satu huruf → miring (bawaan MathML); multi-huruf → tegak. */
export const mi = (name, a) => el('mi', esc(textOf(name)), a);
/** Identifier tegak (mis. "ET", "e", "max"). */
export const mup = (name) => el('mi', esc(textOf(name)), { mathvariant: 'normal' });
/** Angka. Lebih baik kirim string yang sudah diformat (koma desimal). */
export const mn = (v, a) => el('mn', esc(textOf(v)), a);
/** Operator. */
export const mo = (op, a) => el('mo', esc(op), a);
/** Teks biasa di dalam rumus. */
export const mtext = (t, a) => el('mtext', esc(t), a);
/** Spasi horizontal. */
export const space = (width = '0.25em') => `<mspace width="${esc(width)}"></mspace>`;

/** Kelompok berurutan. */
export const row = (...items) => el('mrow', items.flat(Infinity).join(''));
export const frac = (num, den, a) => el('mfrac', wrap(num) + wrap(den), a);
export const sup = (base, exp) => el('msup', wrap(base) + wrap(exp));
export const sub = (base, s) => el('msub', wrap(base) + wrap(s));
export const msubsup = (base, s, p) => el('msubsup', wrap(base) + wrap(s) + wrap(p));
export const sqrt = (...x) => el('msqrt', x.flat(Infinity).join(''));
export const under = (base, u) => el('munder', wrap(base) + wrap(u));
export const over = (base, o, accent = true) => el('mover', wrap(base) + wrap(o), accent ? { accent: 'true' } : null);
export const underover = (base, u, o) => el('munderover', wrap(base) + wrap(u) + wrap(o));

/** Garis atas (rata-rata), mis. T̄. */
export const bar = (x) => over(x, mo('¯', { stretchy: 'true' }));

/** Tanda kurung yang meregang. */
export function paren(x, open = '(', close = ')') {
  return row(mo(open), x, mo(close));
}

/** lhs = rhs₁ = rhs₂ … */
export function eq(lhs, ...rhs) {
  const parts = [lhs];
  for (const r of rhs) parts.push(mo('='), r);
  return row(...parts);
}

/** Fungsi: f(arg₁, arg₂ …); nama string → <mi> (multi-huruf otomatis tegak). */
export function fn(name, ...args) {
  const f = typeof name === 'string' && !name.startsWith('<') ? mi(name) : name;
  const inner = args.flatMap((a, i) => (i ? [mo(','), a] : [a]));
  return row(f, mo('⁡'), paren(inner));
}

/** Tabel MathML: rows = [[sel, sel, …], …]. */
export function mtable(rows, a) {
  const body = rows.map((r) => el('mtr', r.map((c) => el('mtd', c)).join(''))).join('');
  return el('mtable', body, a);
}

/** Fungsi sepotong-sepotong: { ekspr₁ bila syarat₁ ; … }. cases = [[ekspr, syarat], …]. */
export function cases(list) {
  const t = mtable(
    list.map(([expr, cond]) => [expr, cond == null ? '' : row(space('1em'), cond)]),
    { columnalign: 'left left', rowspacing: '0.4em' },
  );
  return row(mo('{', { stretchy: 'true' }), t);
}

/**
 * Elemen <math> akar. display: 'block' | 'inline'. label → aria-label (deskripsi lisan opsional).
 */
export function math(content, { display = 'block', label } = {}) {
  const a = { display: display === 'block' ? 'block' : null, 'aria-label': label || null };
  return el('math', Array.isArray(content) ? content.join('') : content, a);
}

/** Pintasan rumus sebaris. */
export const imath = (...content) => math(content.flat(Infinity).join(''), { display: 'inline' });
