// UI simulasi: merangkai bilah atas, panel kontrol, indikator + Alur, grafik/tabel, lapisan viewport,
// dan tab ponsel. Antarmuka: docs/kontrak.md §7. UI hanya menulis ke store / memanggil actions.
import { explain } from '../model/index.js';
import { S } from './strings.id.js';
import { createControls } from './controls.js';
import { createKpi } from './kpi.js';
import { createFlow } from './flow.js';
import { createChart } from './chart.js';
import { createTable } from './table.js';
import { createOverlay } from './overlay.js';

/**
 * Daftar tab (pola WAI-ARIA tablist): tombol role="tab", panah kiri/kanan/Home/End berpindah tab.
 * tabs: [{id, label, controls}] ; onSelect(id) dipanggil saat tab berganti.
 */
function createTablist(host, tabs, { label, prefix, initial, onSelect }) {
  host.setAttribute('role', 'tablist');
  host.setAttribute('aria-label', label);
  const btns = tabs.map((t) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `${prefix}-${t.id}`;
    b.className = 'tab';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', t.controls);
    b.dataset.tab = t.id;
    b.textContent = t.label;
    b.addEventListener('click', () => select(t.id, true));
    host.append(b);
    return b;
  });
  let current = null;
  function select(id, user = false) {
    if (id === current) return;
    current = id;
    for (const b of btns) {
      const on = b.dataset.tab === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    onSelect(id, user);
  }
  host.addEventListener('keydown', (e) => {
    const i = btns.findIndex((b) => b.dataset.tab === current);
    let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % btns.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + btns.length) % btns.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = btns.length - 1;
    if (j < 0) return;
    e.preventDefault();
    e.stopPropagation();
    select(btns[j].dataset.tab, true);
    btns[j].focus();
  });
  select(initial);
  return { select, get current() { return current; } };
}

export function createUI({ store, actions, meta, roots }) {
  // ---------- bilah atas + panel kiri ----------
  const controls = createControls({ store, actions, meta, simBar: roots.simBar, left: roots.left });

  // ---------- panel kanan: badge + KPI → Alur → risiko/subsidensi/log ----------
  const kpi = createKpi(roots.right, { meta, actions });
  const flow = createFlow(roots.right);
  roots.right.append(kpi.extra);

  // ---------- panel bawah: [Grafik | Tabel] ----------
  const C = S.chart;
  roots.bottom.innerHTML = `
    <div class="bp-head">
      <div class="bp-tabs"></div>
      <div class="bp-tools"></div>
    </div>
    <div class="bp-body">
      <div id="bp-grafik" class="bp-pane" role="tabpanel" aria-labelledby="tab-grafik"></div>
      <div id="bp-tabel" class="bp-pane" role="tabpanel" aria-labelledby="tab-tabel" hidden></div>
    </div>`;
  const paneChart = roots.bottom.querySelector('#bp-grafik');
  const paneTable = roots.bottom.querySelector('#bp-tabel');
  const tools = roots.bottom.querySelector('.bp-tools');
  const chart = createChart(paneChart, { meta });
  const table = createTable(paneTable, { meta });
  tools.append(chart.legend, table.tools);
  createTablist(roots.bottom.querySelector('.bp-tabs'), [
    { id: 'grafik', label: C.tabChart, controls: 'bp-grafik' },
    { id: 'tabel', label: C.tabTable, controls: 'bp-tabel' },
  ], {
    label: S.chart.tabsLabel,
    prefix: 'tab',
    initial: 'grafik',
    onSelect(id) {
      const isChart = id === 'grafik';
      paneChart.hidden = !isChart;
      paneTable.hidden = isChart;
      chart.legend.hidden = !isChart;
      table.tools.hidden = isChart;
      table.setVisible(!isChart);
      if (isChart) chart.redraw();
    },
  });

  // ---------- lapisan viewport ----------
  const overlay = createOverlay(roots.viewport, { store, actions, meta });

  // ---------- tab ponsel: [Kontrol | Indikator | Grafik] ----------
  const viewSim = roots.mobileTabs.closest('.view-sim') ?? roots.mobileTabs.parentElement;
  const M = S.mobile;
  createTablist(roots.mobileTabs, [
    { id: 'kontrol', label: M.controls, controls: roots.left.id || 'panel-left' },
    { id: 'indikator', label: M.indicators, controls: roots.right.id || 'panel-right' },
    { id: 'grafik', label: M.chart, controls: roots.bottom.id || 'panel-bottom' },
  ], {
    label: M.label,
    prefix: 'mtab',
    initial: 'indikator',
    onSelect(id) {
      viewSim.dataset.mtab = id;
      if (id === 'grafik') requestAnimationFrame(() => chart.redraw());
    },
  });

  // ---------- store → kontrol ----------
  let wasPlaying = store.get().playing;
  store.subscribe((s) => {
    controls.sync(s);
    overlay.sync(s);
    if (s.playing !== wasPlaying) {
      wasPlaying = s.playing;
      flow.setPlaying(s.playing);
    }
  });

  let last = null;
  let Atot = 0;
  const onSim = () => store.get().route.view === 'sim';

  function onStep(snap) {
    last = snap;
    let ex = null;
    try {
      ex = explain(actions.getModel());
      Atot = ex.geometry.Atot;
    } catch {
      ex = null;
    }
    kpi.onStep(snap, { Atot });
    flow.update(snap, ex, { playing: store.get().playing });
    overlay.update(snap);
  }

  function onDay(series) {
    chart.setData(series);
    table.setData(series);
  }

  return {
    onFrame(view) {
      controls.onFrame(view);
      if (!onSim()) return;
      kpi.onFrame(view);
      chart.setPlayhead(view.tDays);
    },
    onStep,
    onDay,
    onReset(snap, series) {
      kpi.onReset(snap);
      flow.reset();
      overlay.close();
      onStep(snap);
      kpi.onFrame(snap);
      onDay(series);
    },
    onPick(info) {
      if (!info) {
        overlay.close();
        return;
      }
      overlay.open(info, last ?? actions.getSnapshot());
    },
  };
}
