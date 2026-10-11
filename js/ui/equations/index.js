// Tab "Persamaan & Perhitungan": sub-menu per topik, persamaan MathML native, tabel simbol,
// substitusi angka langsung dari kondisi simulasi, dan grafik mini. Antarmuka: docs/kontrak.md §8.
//
// Alur angka: buildContext(model, snapshot) → section.live(ctx) / section.plots(ctx). Hanya bagian yang
// sedang tampil yang diperbarui, paling sering 4×/detik, dan tidak sama sekali saat "Bekukan angka" aktif.
import { fmtDay } from '../format.js';
import { buildContext } from './context.js';
import { drawPlot } from './miniplot.js';
import { esc, sectionHead } from './common.js';
import * as neraca from './sections/neraca.js';
import * as hujanEt from './sections/hujan-et.js';
import * as gambut from './sections/gambut.js';
import * as kubah from './sections/kubah.js';
import * as airtanah from './sections/airtanah.js';
import * as parit from './sections/parit.js';
import * as kanal from './sections/kanal.js';
import * as pintuAir from './sections/pintu-air.js';
import * as numerik from './sections/numerik.js';
import * as klasifikasi from './sections/klasifikasi.js';
import * as parameter from './sections/parameter.js';

const MODULES = [neraca, hujanEt, gambut, kubah, airtanah, parit, kanal, pintuAir, numerik, klasifikasi, parameter];
const MIN_INTERVAL_MS = 250; // ≤ 4 Hz

const LEADS = {
  neraca: 'Neraca air blok dan saluran: semua air yang masuk, keluar, dan tersimpan, dalam milimeter atas luas total.',
  'hujan-et': 'Bagaimana hujan sintetis dibangkitkan dan dibagi per jam, serta bagaimana evapotranspirasi bergantung pada kedalaman muka air tanah.',
  gambut: 'Kemampuan gambut menyimpan dan mengalirkan air berubah tajam dengan kedalaman: lapisan atas sangat lulus air, lapisan bawah rapat.',
  kubah: 'Permukaan gambut berbentuk kubah: lebih tinggi di tengah blok daripada di tepi saluran. Semua kedalaman diukur dari permukaan lokal.',
  'airtanah': 'Muka air tanah di transek tepi saluran → tengah blok dihitung dengan persamaan Dupuit–Boussinesq satu dimensi, bentuk volume hingga.',
  parit: 'Parit lapangan di antara baris sawit menguras (atau mengisi) gambut di setiap sel sebagai sink sub-grid.',
  kanal: 'Saluran koleksi dan saluran utama diperlakukan sebagai satu simpanan; muka airnya (TMAS) dari neraca volume.',
  'pintu-air': 'Stoplog menentukan mercu ambang; debit ke sungai bergantung pada tinggi air di atas mercu dan muka air sungai.',
  numerik: 'Langkah waktu adaptif menjaga skema eksplisit tetap stabil, dan neraca massa diperiksa setiap langkah.',
  klasifikasi: 'Kategori TMAT perusahaan dan kewajiban PP 57/2016 adalah dua ukuran berbeda yang selalu ditampilkan terpisah.',
  parameter: 'Semua parameter model beserta satuan, arti, dan sumber/asumsinya.',
};

let paramIds = new WeakMap();
let paramSeq = 0;
function paramKey(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  if (!paramIds.has(obj)) paramIds.set(obj, ++paramSeq);
  return paramIds.get(obj);
}

export function createEquations(root, { store, actions, meta }) {
  const list = meta.eqSections;
  const byId = Object.fromEntries(MODULES.map((m) => [m.id, m]));
  const titleOf = Object.fromEntries(list.map((s) => [s.id, s.title]));
  const validId = (id) => (list.some((s) => s.id === id) ? id : list[0].id);
  const pzList = meta.piezometers;

  root.innerHTML = `
<div class="eq-layout">
  <nav id="eq-nav" class="eq-nav" aria-label="Sub-menu persamaan">
    <p class="eq-nav-title">Persamaan &amp; Perhitungan</p>
    <div class="eq-nav-select">
      <label for="eq-nav-select">Bagian</label>
      <select id="eq-nav-select">${list.map((s, i) => `<option value="${esc(s.id)}">${i + 1}. ${esc(s.title)}</option>`).join('')}</select>
    </div>
    <ol class="eq-nav-list">
      ${list.map((s, i) => `<li><a href="#persamaan.${esc(s.id)}" data-section="${esc(s.id)}"><span class="eq-nav-n" aria-hidden="true">${i + 1}</span><span>${esc(s.title)}</span></a></li>`).join('')}
    </ol>
    <p class="eq-nav-foot">Semua angka dihitung oleh model simulasi yang sama dengan tab Simulasi 3D. Model sintetis, bukan untuk keputusan operasional.</p>
  </nav>
  <div class="eq-main">
    <div class="eq-bar" role="group" aria-label="Kondisi perhitungan">
      <p class="eq-cond"><span class="eq-dot" aria-hidden="true"></span><span class="eq-cond-k">Kondisi:</span> <strong class="eq-cond-v" id="eq-cond">—</strong> <span class="eq-cond-sc" id="eq-cond-sc"></span></p>
      <div class="eq-bar-controls">
        <label class="eq-field" for="eq-piezometer"><span>Piezometer</span>
          <select id="eq-piezometer">${pzList.map((p) => `<option value="${esc(p.id)}">${esc(p.id)} (x = ${p.x} m)</option>`).join('')}</select>
        </label>
        <label class="eq-toggle" for="eq-freeze"><input type="checkbox" id="eq-freeze"><span>Bekukan angka</span></label>
      </div>
    </div>
    <div class="eq-sections" id="eq-sections"></div>
  </div>
</div>`;

  const navEl = root.querySelector('#eq-nav');
  const navSelect = root.querySelector('#eq-nav-select');
  const links = [...navEl.querySelectorAll('a[data-section]')];
  const pzSelect = root.querySelector('#eq-piezometer');
  const freeze = root.querySelector('#eq-freeze');
  const condEl = root.querySelector('#eq-cond');
  const condScEl = root.querySelector('#eq-cond-sc');
  const mainEl = root.querySelector('.eq-main');
  const sectionsEl = root.querySelector('#eq-sections');

  const state = {
    current: null,
    visible: false,
    ctx: null, // konteks terakhir (dibekukan bila store.eq.frozen)
    lastUpdate: -Infinity,
    timer: 0,
    focusNext: false,
    els: new Map(), // id → {el, staticKey, last: Map}
    plotRaf: 0,
  };

  // ---------- kontrol ----------
  function go(id) {
    state.focusNext = true;
    store.set({ route: { view: 'persamaan', section: id } });
  }
  for (const a of links) {
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      go(a.dataset.section);
    });
  }
  navSelect.addEventListener('change', () => go(navSelect.value));
  pzSelect.addEventListener('change', () => store.patch('eq', { piezometer: pzSelect.value }));
  freeze.addEventListener('change', () => store.patch('eq', { frozen: freeze.checked }));

  function syncControls() {
    const eq = store.get().eq;
    if (pzSelect.value !== eq.piezometer) pzSelect.value = eq.piezometer;
    if (freeze.checked !== !!eq.frozen) freeze.checked = !!eq.frozen;
    root.classList.toggle('eq-is-frozen', !!eq.frozen);
  }
  syncControls();

  store.subscribe((s, prev) => {
    if (s.eq === prev.eq) return;
    syncControls();
    if (!state.visible) return;
    if (s.eq.frozen !== prev.eq.frozen && !s.eq.frozen) {
      update(true);
    } else if (s.eq.piezometer !== prev.eq.piezometer) {
      update(true);
    } else {
      renderStatus();
    }
  });

  // ---------- konteks ----------
  function baseContext(rebuild) {
    const eq = store.get().eq;
    if (!state.ctx || (rebuild && !eq.frozen)) {
      state.ctx = buildContext(actions.getModel(), actions.getSnapshot(), { piezometer: eq.piezometer });
    }
    return state.ctx;
  }

  /** Konteks dengan piezometer pilihan (bisa diganti walau angka dibekukan: semua piezometer sudah dihitung). */
  function withPiezometer(base) {
    const want = store.get().eq.piezometer;
    const pz = base.ids.includes(want) ? want : base.pz;
    if (pz === base.pz) return base;
    return { ...base, pz, e: base.ex[pz] };
  }

  // ---------- render ----------
  function sectionEl(id) {
    let rec = state.els.get(id);
    if (!rec) {
      const el = document.createElement('section');
      el.className = 'eq-section';
      el.dataset.eqSection = id;
      el.setAttribute('aria-labelledby', `eq-h-${id}`);
      el.hidden = true;
      sectionsEl.appendChild(el);
      rec = { el, staticKey: null, last: new Map() };
      state.els.set(id, rec);
    }
    return rec;
  }

  function renderStatic(rec, id, c) {
    const key = `${paramKey(c.params)}|${c.snap.scenarioId}|${c.snap.ind.tpId}`;
    if (rec.staticKey === key) return;
    const mod = byId[id];
    const n = list.findIndex((s) => s.id === id) + 1;
    rec.el.innerHTML = `${sectionHead({ id, n, total: list.length, title: titleOf[id] })}
<p class="eq-lead">${esc(LEADS[id] ?? '')}</p>
${mod.render(c)}`;
    rec.staticKey = key;
    rec.last = new Map();
  }

  function renderLive(rec, id, c) {
    const mod = byId[id];
    const parts = mod.live ? mod.live(c) : {};
    for (const node of rec.el.querySelectorAll('[data-live]')) {
      const k = node.dataset.live;
      const html = parts[k];
      if (html == null) continue;
      if (rec.last.get(k) !== html) {
        node.innerHTML = html;
        rec.last.set(k, html);
      }
    }
  }

  function drawPlots() {
    state.plotRaf = 0;
    if (!state.visible || !state.current || !state.ctx) return;
    const rec = state.els.get(state.current);
    const mod = byId[state.current];
    if (!rec || !mod.plots) return;
    const specs = mod.plots(withPiezometer(state.ctx));
    let pending = false;
    for (const cv of rec.el.querySelectorAll('canvas[data-plot]')) {
      const spec = specs[cv.dataset.plot];
      if (!spec) continue;
      if (!drawPlot(cv, spec)) pending = true;
    }
    if (pending && !state.retry) {
      state.retry = true;
      requestPlots();
    } else {
      state.retry = false;
    }
  }

  function requestPlots() {
    if (!state.plotRaf) state.plotRaf = requestAnimationFrame(drawPlots);
  }

  function renderStatus() {
    const c = state.ctx;
    if (!c) return;
    const frozen = !!store.get().eq.frozen;
    const t = fmtDay(c.snap);
    condEl.textContent = frozen ? `${t} (dibekukan)` : t;
    condScEl.textContent = `· ${c.snap.scenarioLabel}`;
    for (const opt of pzSelect.options) {
      const p = pzList.find((q) => q.id === opt.value);
      const tp = opt.value === c.snap.ind.tpId ? ' · titik penaatan' : '';
      const label = `${p.id} (x = ${p.x} m)${tp}`;
      if (opt.textContent !== label) opt.textContent = label;
    }
  }

  function update(rebuild) {
    if (!state.visible || !state.current) return;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = 0;
    }
    state.lastUpdate = performance.now();
    const c = withPiezometer(baseContext(rebuild));
    const rec = sectionEl(state.current);
    renderStatic(rec, state.current, c);
    renderLive(rec, state.current, c);
    renderStatus();
    requestPlots();
  }

  function schedule() {
    if (!state.visible || store.get().eq.frozen) return;
    const wait = MIN_INTERVAL_MS - (performance.now() - state.lastUpdate);
    if (wait <= 0) update(true);
    else if (!state.timer) {
      state.timer = setTimeout(() => {
        state.timer = 0;
        update(true);
      }, wait);
    }
  }

  function setCurrent(id) {
    const prev = state.current;
    state.current = id;
    for (const [k, rec] of state.els) rec.el.hidden = k !== id;
    sectionEl(id).el.hidden = false;
    for (const a of links) {
      if (a.dataset.section === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    if (navSelect.value !== id) navSelect.value = id;
    return prev !== id;
  }

  // ---------- ukuran & tema ----------
  if (typeof ResizeObserver === 'function') {
    let lastW = 0;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w !== lastW) {
        lastW = w;
        if (state.visible) requestPlots();
      }
    });
    ro.observe(mainEl);
  }
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => state.visible && requestPlots());
  } catch {
    /* peramban lama */
  }
  if (typeof MutationObserver === 'function') {
    new MutationObserver(() => state.visible && requestPlots()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // ---------- antarmuka publik ----------
  return {
    show(sectionId) {
      const id = validId(sectionId);
      state.visible = true;
      const changed = setCurrent(id);
      update(!store.get().eq.frozen);
      if (changed && state.focusNext) {
        root.scrollTop = 0;
        if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start' });
        const h = root.querySelector(`#eq-h-${CSS.escape(id)}`);
        h?.focus({ preventScroll: true });
      }
      state.focusNext = false;
    },
    hide() {
      state.visible = false;
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = 0;
      }
    },
    onStep() {
      schedule();
    },
  };
}
