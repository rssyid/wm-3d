// Router hash sederhana. Hash hanya memakai huruf, angka, titik, dan tanda hubung
// (aman untuk artifact): #sim, #persamaan, #persamaan.<bagian>, #tentang.
import { EQ_SECTIONS } from '../core/config.js';

const VIEWS = ['sim', 'persamaan', 'tentang'];

export function parseHash(hash) {
  const h = (hash || '').replace(/^#\/?/, '');
  const [view, section] = h.split(/[./]/);
  if (!VIEWS.includes(view)) return null;
  if (view === 'persamaan') {
    const id = EQ_SECTIONS.some((s) => s.id === section) ? section : EQ_SECTIONS[0].id;
    return { view, section: id };
  }
  return { view, section: null };
}

export function routeHash(route) {
  if (route.view === 'persamaan') return `#persamaan.${route.section ?? EQ_SECTIONS[0].id}`;
  return `#${route.view}`;
}

/**
 * Menghubungkan hash ↔ store.route dan menampilkan/menyembunyikan tampilan.
 * Navigasi oleh pengguna menambah riwayat (pushState) sehingga tombol Kembali tetap di dalam aplikasi;
 * perubahan yang berasal dari URL (muat awal, Kembali/Maju) hanya menormalkan hash (replaceState).
 */
export function createRouter(store, doc = document) {
  const views = Object.fromEntries(VIEWS.map((v) => [v, doc.getElementById(`view-${v}`)]));
  const links = [...doc.querySelectorAll('.main-nav a[data-route]')];
  const baseTitle = doc.title || 'Simulasi Tata Air Gambut';
  let fromUrlChange = false;

  function titleFor(route) {
    if (route.view === 'tentang') return `Tentang Model · ${baseTitle}`;
    if (route.view === 'persamaan') {
      const sec = EQ_SECTIONS.find((x) => x.id === route.section);
      return `${sec ? sec.title : 'Persamaan'} · ${baseTitle}`;
    }
    return baseTitle;
  }

  function apply(route) {
    for (const v of VIEWS) if (views[v]) views[v].hidden = v !== route.view;
    for (const a of links) {
      if (a.dataset.route === route.view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
      if (a.dataset.route === 'persamaan') a.setAttribute('href', routeHash({ view: 'persamaan', section: route.view === 'persamaan' ? route.section : store.get().route.section ?? EQ_SECTIONS[0].id }));
    }
    doc.title = titleFor(route);
  }

  function writeHash(h, replace) {
    if (location.hash === h) return;
    try {
      history[replace ? 'replaceState' : 'pushState'](null, '', h);
    } catch {
      location.hash = h; // bingkai yang membatasi History API
    }
  }

  function fromUrl() {
    // hash kosong (mis. kembali ke entri riwayat awal) = tab Simulasi
    const r = location.hash === '' || location.hash === '#' ? { view: 'sim', section: null } : parseHash(location.hash);
    if (!r) return false;
    fromUrlChange = true;
    try {
      const cur = store.get().route;
      if (cur.view !== r.view || cur.section !== r.section) store.set({ route: r });
      else apply(r);
      if (location.hash !== '') writeHash(routeHash(r), true); // normalkan mis. #/tentang → #tentang
    } finally {
      fromUrlChange = false;
    }
    return true;
  }

  store.subscribe((s, prev) => {
    if (s.route !== prev.route) {
      apply(s.route);
      writeHash(routeHash(s.route), fromUrlChange);
    }
  });
  window.addEventListener('hashchange', fromUrl);
  window.addEventListener('popstate', fromUrl);
  for (const a of links) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const r = parseHash(a.getAttribute('href'));
      if (r) store.set({ route: r });
    });
  }
  // tautan "Lewati ke konten": pindahkan fokus tanpa mengubah hash/riwayat
  const skip = doc.querySelector('.skip-link');
  if (skip) {
    skip.addEventListener('click', (e) => {
      e.preventDefault();
      const target = doc.getElementById('app');
      if (!target) return;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus();
    });
  }
  if (!fromUrl()) apply(store.get().route);
  return {
    go(view, section = null) {
      store.set({ route: { view, section: view === 'persamaan' ? section ?? EQ_SECTIONS[0].id : null } });
    },
  };
}
