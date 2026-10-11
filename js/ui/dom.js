// Helper DOM kecil untuk modul UI (tanpa framework).

/** Escape teks untuk disisipkan ke template HTML. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Membuat elemen: el('div', {class: 'a', 'data-x': 1, text: '…', on: {click}}, [anak…]).
 * Anak berupa string menjadi text node (aman untuk data).
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    else if (k in node && typeof v !== 'string') node[k] = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Slot teks: menulis DOM hanya bila teks berubah. */
export function textSlot(node) {
  let last;
  return {
    node,
    set(text) {
      if (text !== last) {
        last = text;
        node.textContent = text;
      }
    },
    reset() {
      last = undefined;
    },
  };
}

/** Mengganti kelas status `st-<id>` pada elemen bila berubah. */
export function setStatusClass(node, id, prefix = 'st-') {
  const cur = node.dataset.st;
  if (cur === id) return;
  if (cur) node.classList.remove(prefix + cur);
  if (id) node.classList.add(prefix + id);
  node.dataset.st = id ?? '';
}

/** Atribut yang hanya ditulis bila nilainya berubah. */
export function setAttr(node, name, value) {
  const v = String(value);
  if (node.getAttribute(name) !== v) node.setAttribute(name, v);
}

/** Membaca token CSS (warna) dari :root. */
export function cssVar(name, fallback = '#888') {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Pemantau tema: memanggil fn saat skema warna OS atau atribut data-theme berubah. */
export function onThemeChange(fn) {
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  mq?.addEventListener?.('change', fn);
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  return () => {
    mq?.removeEventListener?.('change', fn);
    mo.disconnect();
  };
}

/** Apakah tampilan sempit (tata letak ponsel). */
export function isNarrow() {
  return typeof matchMedia === 'function' && matchMedia('(max-width: 899px)').matches;
}

/** Apakah pengguna meminta gerak dikurangi. */
export function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
