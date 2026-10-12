// Diagram "Alur hubungan" (#alur): Hujan → Air tanah (TMAT) → Saluran (TMAS) → Pintu air → Sungai, ET keluar
// dari air tanah. Lebar panah ∝ fluks (mm/hari), garis putus beranimasi (statis bila gerak dikurangi / dijeda).
import { fmt, fmtSigned, fmtElevCm, fmtQ } from './format.js';
import { S } from './strings.id.js';
import { flowFluxes, edgeWidth, balanceTerms } from './flowmath.js';
import { createNarrator } from './narrative.js';
import { textSlot } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 322;
const NODE = { x: 26, w: 178, h: 38 };
const GAP = 42;
const CX = NODE.x + NODE.w / 2;
const ROWS = ['rain', 'soil', 'canal', 'gate', 'river'];
const rowY = (i) => 6 + i * (NODE.h + GAP);
const H = rowY(ROWS.length - 1) + NODE.h + 6;

function svgEl(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (parent) parent.append(n);
  return n;
}

function setA(node, k, v) {
  const s = String(v);
  if (node.getAttribute(k) !== s) node.setAttribute(k, s);
}

/** Panah vertikal: poros persegi + kepala segitiga; arah +1 = ke bawah, −1 = ke atas. */
function arrowPath(cx, y0, y1, w, dir) {
  const head = 7;
  const hw = w / 2;
  const hh = hw + 4.5;
  if (dir >= 0) {
    const yh = y1 - head;
    return `M${cx - hw},${y0} L${cx + hw},${y0} L${cx + hw},${yh} L${cx + hh},${yh} L${cx},${y1} L${cx - hh},${yh} L${cx - hw},${yh} Z`;
  }
  const yh = y0 + head;
  return `M${cx - hw},${y1} L${cx + hw},${y1} L${cx + hw},${yh} L${cx + hh},${yh} L${cx},${y0} L${cx - hh},${yh} L${cx - hw},${yh} Z`;
}

/** Panah horizontal ke kanan (ET keluar dari air tanah). */
function arrowPathH(x0, x1, cy, w) {
  const head = 7;
  const hw = w / 2;
  const hh = hw + 4.5;
  const xh = x1 - head;
  return `M${x0},${cy - hw} L${xh},${cy - hw} L${xh},${cy - hh} L${x1},${cy} L${xh},${cy + hh} L${xh},${cy + hw} L${x0},${cy + hw} Z`;
}

export function createFlow(container) {
  const F = S.flow;
  const wrap = document.createElement('section');
  wrap.className = 'rp-section flow';
  wrap.setAttribute('aria-labelledby', 'alur-title');
  wrap.innerHTML = `
    <h3 class="rp-h" id="alur-title">${F.title}</h3>
    <p class="flow-sub">${F.sub}</p>
    <div class="flow-svg-wrap"></div>
    <p class="flow-balance"><span class="flow-balance-label">${F.balance}</span><span class="flow-balance-eq" data-f="eq"></span></p>
    <p class="flow-narr" aria-live="polite" aria-atomic="true"><span class="visually-hidden">${F.narrativeLabel}: </span><span data-f="narr"></span></p>`;
  container.append(wrap);

  const svg = svgEl('svg', {
    id: 'alur',
    viewBox: `0 0 ${W} ${H}`,
    width: '100%',
    role: 'img',
    'aria-labelledby': 'alur-title alur-desc',
    class: 'flow-svg is-paused',
  });
  const desc = svgEl('desc', { id: 'alur-desc' }, svg);
  wrap.querySelector('.flow-svg-wrap').append(svg);

  // umpan balik: stoplog menahan muka air (garis putus statis di kiri)
  const yGate = rowY(3) + NODE.h / 2;
  const ySoil = rowY(1) + NODE.h / 2;
  const fbX = 11;
  svgEl('path', { d: `M${NODE.x},${yGate} H${fbX} V${ySoil} H${NODE.x - 7}`, class: 'flow-feedback' }, svg);
  svgEl('path', { d: `M${NODE.x - 7},${ySoil - 4} L${NODE.x},${ySoil} L${NODE.x - 7},${ySoil + 4} Z`, class: 'flow-feedback-head' }, svg);
  const fbText = svgEl('text', { x: fbX - 4, y: (yGate + ySoil) / 2, class: 'flow-feedback-txt', transform: `rotate(-90 ${fbX - 4} ${(yGate + ySoil) / 2})`, 'text-anchor': 'middle' }, svg);
  fbText.textContent = F.hold;

  // tepi (di bawah simpul)
  const edges = {};
  const edgeDefs = [
    { id: 'rain', from: 0, cls: 'e-rain' },
    { id: 'seep', from: 1, cls: 'e-seep' },
    { id: 'over', from: 2, cls: 'e-q' },
    { id: 'out', from: 3, cls: 'e-q' },
  ];
  for (const d of edgeDefs) {
    const y0 = rowY(d.from) + NODE.h;
    const y1 = rowY(d.from + 1);
    const g = svgEl('g', { class: `flow-edge ${d.cls}` }, svg);
    const shaft = svgEl('path', { class: 'flow-shaft' }, g);
    const dash = svgEl('line', { x1: CX, x2: CX, y1: y0 + 2, y2: y1 - 9, class: 'flow-dash' }, g);
    const val = svgEl('text', { x: CX + 22, y: (y0 + y1) / 2 - 2, class: 'flow-val' }, g);
    const cap = svgEl('text', { x: CX + 22, y: (y0 + y1) / 2 + 11, class: 'flow-cap' }, g);
    edges[d.id] = { g, shaft, dash, val, cap, y0, y1, w: -1, dir: 0 };
  }

  // ET: panah horizontal dari simpul air tanah
  const etY = rowY(1) + NODE.h / 2;
  const etX0 = NODE.x + NODE.w;
  const etX1 = etX0 + 30;
  const etG = svgEl('g', { class: 'flow-edge e-et' }, svg);
  const etShaft = svgEl('path', { class: 'flow-shaft' }, etG);
  const etDash = svgEl('line', { x1: etX0 + 2, x2: etX1 - 9, y1: etY, y2: etY, class: 'flow-dash' }, etG);
  const etLbl = svgEl('text', { x: etX1 + 5, y: etY - 4, class: 'flow-cap' }, etG);
  etLbl.textContent = `${F.et} (keluar)`;
  const etVal = svgEl('text', { x: etX1 + 5, y: etY + 10, class: 'flow-val' }, etG);
  const et = { shaft: etShaft, dash: etDash, val: etVal, w: -1 };

  // simpul
  const nodes = {};
  const titles = { rain: F.rain, soil: `${F.soil} · TMAT`, canal: `${F.canal} · TMAS`, gate: F.gate, river: F.river };
  ROWS.forEach((id, i) => {
    const y = rowY(i);
    const g = svgEl('g', { class: `flow-node n-${id}` }, svg);
    svgEl('rect', { x: NODE.x, y, width: NODE.w, height: NODE.h, rx: 5, class: 'flow-box' }, g);
    const t = svgEl('text', { x: NODE.x + 9, y: y + 15, class: 'flow-title' }, g);
    t.textContent = titles[id];
    const v = svgEl('text', { x: NODE.x + 9, y: y + 30, class: 'flow-nval' }, g);
    let sw = null;
    if (id === 'soil') sw = svgEl('rect', { x: NODE.x + NODE.w - 20, y: y + 9, width: 12, height: 12, rx: 2.5, class: 'flow-sw' }, g);
    nodes[id] = { t, v, sw };
  });

  const eq = textSlot(wrap.querySelector('[data-f="eq"]'));
  const narr = wrap.querySelector('[data-f="narr"]');
  const narrator = createNarrator();
  const txt = new Map();
  const setT = (node, s) => {
    if (txt.get(node) !== s) {
      txt.set(node, s);
      node.textContent = s;
    }
  };

  function setEdge(e, flux, valText, capText) {
    const w = edgeWidth(flux);
    const zero = Math.abs(flux) < 0.05; // < 0,05 mm/hari: tampil "0,0", panah pudar tanpa arah balik
    const dir = !zero && flux < 0 ? -1 : 1;
    if (Math.abs(w - e.w) > 0.05 || dir !== e.dir) {
      e.w = w;
      e.dir = dir;
      setA(e.shaft, 'd', arrowPath(CX, e.y0 + 1, e.y1 - 1, w, dir));
    }
    e.g.classList.toggle('is-zero', zero);
    e.g.classList.toggle('is-rev', dir < 0);
    setT(e.val, valText);
    setT(e.cap, capText);
  }

  function update(snap, explained, { playing = false } = {}) {
    const Atot = explained?.geometry?.Atot ?? 306240;
    const fx = flowFluxes(snap, explained?.canal?.terms, Atot);
    const st = snap.structure;
    const mm = (v) => `${fmt(v, 1)} mm/hari`;

    const rev = (v) => v <= -0.05;
    setEdge(edges.rain, fx.rain, `${fmt(fx.rain, 1)} mm/24 jam`, F.infil);
    setEdge(edges.seep, fx.toCanal.total, mm(fx.toCanal.total), rev(fx.toCanal.total) ? F.feedFromCanal : F.seep);
    setEdge(edges.over, fx.discharge, mm(fx.discharge), rev(fx.discharge) ? F.back : F.over);
    setEdge(edges.out, fx.discharge, fmtQ(st.q_m3s), rev(fx.discharge) ? F.back : S.kpi.toRiver);

    const w = edgeWidth(fx.et);
    if (Math.abs(w - et.w) > 0.05) {
      et.w = w;
      setA(et.shaft, 'd', arrowPathH(etX0 + 1, etX1, etY, w));
    }
    setT(et.val, `${fmt(fx.et, 1)} mm/24 jam`);

    const tp = snap.piezometers.find((p) => p.isTP) ?? snap.piezometers[0];
    setT(nodes.rain.v, `${fmt(snap.forcing.rain24h_mm, 1)} mm · ${fmt(snap.forcing.rain_mmh, 1)} mm/jam`);
    setT(nodes.soil.v, `${tp.id} ${fmtElevCm(tp.depthCm)} · ${snap.ind.cls.label}`);
    if (nodes.soil.sw) setA(nodes.soil.sw, 'fill', snap.ind.cls.color);
    setT(nodes.canal.v, `${fmtElevCm(snap.canal.tmasCm)} · ${snap.canal.tmasCls.label}`);
    setT(nodes.gate.t, st.submerged && Math.abs(st.q_m3s) > 1e-5 ? `${F.gate} · ${F.submerged}` : F.gate);
    setT(nodes.gate.v, `${st.nLogs} stoplog · mercu ${fmtElevCm(-st.crestM * 100)}`);
    setT(nodes.river.v, F.riverLevel(fmtSigned(snap.river.levelM * 100, 0)));

    svg.classList.toggle('is-paused', !playing);

    const b = balanceTerms(snap.today);
    const out = b.out < 0 ? `(${fmt(b.out, 1)})` : fmt(b.out, 1);
    eq.set(`Hujan ${fmt(b.rain, 1)} − ET ${fmt(b.et, 1)} − Pembuangan ${out} = ΔSimpanan ${fmtSigned(b.dS, 1)} mm (residu ${fmt(b.residual, 3)})`);

    const n = narrator.next(snap);
    if (n) {
      narr.textContent = n;
      desc.textContent = `${F.title}: ${n}`;
    }
  }

  function setPlaying(playing) {
    svg.classList.toggle('is-paused', !playing);
  }

  function reset() {
    narrator.reset();
  }

  return { update, setPlaying, reset, root: wrap };
}
