// Pembantu tes (bukan berkas tes): parser markup sederhana untuk memeriksa HTML/MathML hasil tab Persamaan.
// Melempar Error bila tag tidak seimbang, ada '<' atau '&' mentah di teks, atau atribut rusak ('>' di teks sah di HTML).
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'col', 'wbr', 'source']);
const TAG = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:="[^"<]*")?)*)\s*(\/?)>/;
const ENTITY = /^&(?:[a-zA-Z][a-zA-Z0-9]*|#[0-9]+|#x[0-9a-fA-F]+);/;

export function parseMarkup(src) {
  const root = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '<') {
      const m = TAG.exec(src.slice(i));
      if (!m) throw new Error(`Tag rusak di posisi ${i}: ${src.slice(i, i + 40)}`);
      const [all, closing, name, attrStr, selfClose] = m;
      const tag = name.toLowerCase();
      if (closing) {
        const top = stack.pop();
        if (!top || top.tag !== tag) throw new Error(`Tag penutup </${tag}> tidak cocok dengan <${top?.tag}> di posisi ${i}`);
      } else {
        const attrs = {};
        for (const a of attrStr.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? true;
        const node = { tag, attrs, children: [], text: '' };
        stack.at(-1).children.push(node);
        if (!selfClose && !VOID.has(tag)) stack.push(node);
      }
      i += all.length;
    } else if (ch === '&') {
      const m = ENTITY.exec(src.slice(i, i + 12));
      if (!m) throw new Error(`'&' mentah di posisi ${i}: ${src.slice(i, i + 20)}`);
      stack.at(-1).text += m[0];
      i += m[0].length;
    } else {
      stack.at(-1).text += ch;
      i++;
    }
  }
  if (stack.length !== 1) throw new Error(`Tag tidak ditutup: <${stack.at(-1).tag}>`);
  return root;
}

/** Semua node dengan tag tertentu (rekursif). */
export function findAll(node, tag, out = []) {
  for (const c of node.children) {
    if (c.tag === tag) out.push(c);
    findAll(c, tag, out);
  }
  return out;
}

/** Jumlah anak elemen yang wajib untuk elemen MathML berstruktur tetap. */
export const MATHML_ARITY = { mfrac: 2, msup: 2, msub: 2, msubsup: 3, munder: 2, mover: 2, munderover: 3, mroot: 2 };
