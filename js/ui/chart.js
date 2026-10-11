// Grafik Canvas 2D buatan sendiri (#chart): tiga panel bertumpuk berbagi sumbu hari —
// (a) curah hujan (batang menggantung), (b) muka air (P1–P4, TMAS, mercu, pita kategori perusahaan,
// batas PP 57/2016, permukaan gambut), (c) pembuangan (area + garis, mm/hari).
// Lapisan statis digambar ulang hanya saat data/ukuran/tema/emphasis berubah; playhead & crosshair
// di kanvas overlay (murah per frame).
import { fmt, fmtElevCm, fmtQ } from './format.js';
import { S } from './strings.id.js';
import { cssVar, onThemeChange } from './dom.js';
import {
  linearScale,
  niceTicks,
  xDomain,
  waterDomain,
  rainDomain,
  flowDomain,
  dayTicks,
  nearestIndex,
  chartLayout,
  classBands,
} from './chartmath.js';
import { classifyTmat, ppCompliant } from '../model/index.js';

const C = S.chart;

function readColors() {
  return {
    surface: cssVar('--surface', '#fbfbf8'),
    ink: cssVar('--ink', '#1b221d'),
    chartInk: cssVar('--chart-ink', '#3e4a42'),
    muted: cssVar('--muted', '#59655d'),
    grid: cssVar('--chart-grid', '#dfe4dc'),
    line: cssVar('--line-strong', '#aab4a8'),
    rain: cssVar('--series-rain', '#3d7fc9'),
    tmat: cssVar('--series-tmat', '#2f6fb8'),
    tmas: cssVar('--series-tmas', '#c2571d'),
    q: cssVar('--series-q', '#138a64'),
    crest: cssVar('--series-crest', '#6b6a65'),
    seriesMuted: cssVar('--series-muted', '#8c958e'),
    bad: cssVar('--bad', '#b3261e'),
    accent: cssVar('--accent', '#9b5418'),
    fontData: cssVar('--font-data', 'ui-monospace, monospace'),
    fontBody: cssVar('--font-body', 'system-ui, sans-serif'),
    dark: getComputedStyle(document.documentElement).colorScheme?.includes('dark') ?? false,
  };
}

function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function roundedBottomRect(ctx, x, y, w, h, r) {
  // persegi dengan sudut bawah membulat (ujung data batang menggantung)
  const rr = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.closePath();
  ctx.fill();
}

export function createChart(container, { meta }) {
  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  wrap.tabIndex = 0;
  wrap.setAttribute('aria-describedby', 'chart-help');
  const canvas = document.createElement('canvas');
  canvas.id = 'chart';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', C.ariaChart);
  const overlay = document.createElement('canvas');
  overlay.className = 'chart-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  const help = document.createElement('p');
  help.id = 'chart-help';
  help.className = 'visually-hidden';
  help.textContent = 'Gunakan panah kiri/kanan untuk membaca nilai per hari.';
  wrap.append(canvas, overlay, tip, help);
  container.append(wrap);

  // ---- legenda (dipasang oleh index.js di kepala panel) ----
  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.setAttribute('role', 'group');
  legend.setAttribute('aria-label', `Legenda grafik. ${C.legendHint}`);

  const pids = (meta.piezometers ?? []).map((p) => p.id);
  const seriesIds = [...pids, 'TMAS', 'Mercu'];
  let emph = new Set(['P3', 'TMAS', 'Mercu']);
  let tpId = 'P3';
  let userTouched = false;
  const legendBtns = {};
  for (const id of seriesIds) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `lg-item lg-${id === 'TMAS' ? 'tmas' : id === 'Mercu' ? 'crest' : 'pz'}`;
    b.dataset.series = id;
    b.title = C.legendHint;
    const key = document.createElement('span');
    key.className = 'lg-key';
    key.setAttribute('aria-hidden', 'true');
    const lbl = document.createElement('span');
    lbl.className = 'lg-lbl';
    lbl.textContent = id === 'Mercu' ? C.crest : id;
    b.append(key, lbl);
    b.addEventListener('click', () => {
      userTouched = true;
      if (emph.has(id)) emph.delete(id);
      else emph.add(id);
      syncLegend();
      drawStatic();
      drawOverlay(true);
    });
    legend.append(b);
    legendBtns[id] = b;
  }
  const keyPP = document.createElement('span');
  keyPP.className = 'lg-static lg-pp';
  keyPP.innerHTML = '<span class="lg-key" aria-hidden="true"></span><span class="lg-lbl">PP ≤ 40 cm</span>';
  const keyNormal = document.createElement('span');
  keyNormal.className = 'lg-static lg-normal';
  keyNormal.innerHTML = `<span class="lg-key" aria-hidden="true"></span><span class="lg-lbl">${C.normalBand}</span>`;
  legend.append(keyPP, keyNormal);

  function syncLegend() {
    for (const id of seriesIds) {
      const on = emph.has(id);
      legendBtns[id].setAttribute('aria-pressed', String(on));
      legendBtns[id].classList.toggle('is-tp', id === tpId);
    }
  }
  syncLegend();

  // ---- state ----
  let series = null;
  let colors = readColors();
  let size = { w: 0, h: 0, dpr: 1 };
  let L = null;
  let sx = null;
  let syRain = null;
  let syWater = null;
  let syFlow = null;
  let xDom = [0, 1];
  let playT = 0;
  let lastPlayPx = NaN;
  let hoverIdx = -1;
  let dirty = true;

  const ctx = canvas.getContext('2d');
  const octx = overlay.getContext('2d');

  function measure() {
    const r = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (w === size.w && h === size.h && dpr === size.dpr) return false;
    size = { w, h, dpr };
    for (const c of [canvas, overlay]) {
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    return true;
  }

  function elevArrays() {
    if (!series || !series.n) return [];
    const arr = pids.map((id) => series.depthCm[id].map((d) => -d));
    arr.push(series.tmasCm.map((t) => -t));
    arr.push(series.crestM.map((c) => c * 100));
    return arr;
  }

  function drawStatic() {
    dirty = false;
    if (size.w < 40 || size.h < 60) return;
    const { w, h, dpr } = size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const col = colors;
    L = chartLayout(w, h, { left: 44, right: w < 480 ? 40 : 50 });
    const px = L.plot.x;
    const pw = L.plot.w;
    xDom = xDomain(series ?? { n: 0, scenarioDays: 60 });
    sx = linearScale(xDom[0], xDom[1], px, px + pw);
    const n = series?.n ?? 0;
    const elev = elevArrays();
    const wDom = waterDomain(elev);
    syRain = linearScale(0, rainDomain(series?.rain_mm ?? [])[1], L.rain.y, L.rain.y + L.rain.h);
    syWater = linearScale(wDom[0], wDom[1], L.water.y + L.water.h, L.water.y);
    const fDom = flowDomain(series?.q_mmd ?? []);
    syFlow = linearScale(fDom[0], fDom[1], L.flow.y + L.flow.h, L.flow.y);

    const tickFont = `10.5px ${col.fontData}`;
    const titleFont = `600 11px ${col.fontBody}`;
    const smallFont = `10px ${col.fontBody}`;

    // ---------- sumbu-x: garis bantu bulan menembus semua panel ----------
    const ticks = dayTicks(xDom[0], xDom[1], series?.startMonth ?? 0, pw);
    ctx.lineWidth = 1;
    ctx.strokeStyle = col.grid;
    ctx.beginPath();
    for (const t of ticks) {
      if (!t.major) continue;
      const x = Math.round(sx(t.day)) + 0.5;
      ctx.moveTo(x, L.rain.y);
      ctx.lineTo(x, L.flow.y + L.flow.h);
    }
    ctx.stroke();
    ctx.font = tickFont;
    ctx.fillStyle = col.muted;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    let lastRight = -Infinity;
    for (const t of ticks) {
      const x = sx(t.day);
      const tw = ctx.measureText(t.label).width;
      if (x - tw / 2 < lastRight + 6 || x + tw / 2 > px + pw + 20) continue;
      ctx.fillText(t.label, x, L.axisY + 2);
      lastRight = x + tw / 2;
      ctx.fillRect(Math.round(x), L.axisY - 3, 1, 3);
    }

    // ---------- (a) curah hujan ----------
    drawTitle(C.rainTitle, L.rain.y, titleFont);
    ctx.strokeStyle = col.line;
    hline(L.rain.y, px, px + pw);
    const rTop = syRain.domain[1];
    ctx.font = tickFont;
    ctx.fillStyle = col.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(fmt(rTop, 0), px - 6, L.rain.y + L.rain.h);
    ctx.fillText('0', px - 6, L.rain.y + 1);
    ctx.strokeStyle = col.grid;
    hline(L.rain.y + L.rain.h, px, px + pw);
    if (n) {
      const dayW = pw / (xDom[1] - xDom[0]);
      const gap = dayW >= 5 ? 2 : dayW >= 2.5 ? 1 : 0;
      const bw = Math.max(0.8, Math.min(24, dayW - gap));
      ctx.fillStyle = col.rain;
      for (let i = 0; i < n; i++) {
        const d = series.day[i];
        if (d + 1 < xDom[0] || d > xDom[1]) continue;
        const v = series.rain_mm[i];
        if (!(v > 0)) continue;
        const x = sx(d + 0.5) - bw / 2;
        const bh = Math.max(1, syRain(v) - L.rain.y);
        roundedBottomRect(ctx, x, L.rain.y, bw, bh, bw >= 6 ? 3 : 0);
      }
    }

    // ---------- (b) muka air ----------
    drawTitle(C.waterTitle, L.water.y, titleFont);
    const wy = L.water.y;
    const wh = L.water.h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, wy, pw, wh);
    ctx.clip();
    // pita kategori perusahaan (tipis), "Normal" ditonjolkan
    for (const b of classBands(meta.tmatClasses ?? [], wDom)) {
      const y0 = syWater(b.top);
      const y1 = syWater(b.bottom);
      const a = b.id === 'normal' ? (col.dark ? 0.42 : 0.24) : b.id === 'banjir' ? (col.dark ? 0.0 : 0.05) : b.id === 'kering' ? 0.06 : 0.11;
      ctx.fillStyle = hexA(b.color, a);
      ctx.fillRect(px, y0, pw, y1 - y0);
      if (b.id === 'normal') {
        ctx.strokeStyle = hexA(b.color, col.dark ? 0.9 : 0.55);
        ctx.lineWidth = 1;
        hline(y0, px, px + pw);
        hline(y1, px, px + pw);
      }
    }
    ctx.restore();
    // grid & tick
    const yt = niceTicks(wDom[0], wDom[1], Math.max(3, Math.floor(wh / 26)));
    ctx.strokeStyle = col.grid;
    ctx.lineWidth = 1;
    ctx.font = tickFont;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of yt) {
      const y = syWater(v);
      if (v !== 0) {
        ctx.strokeStyle = col.grid;
        hline(y, px, px + pw);
      }
      ctx.fillStyle = col.muted;
      ctx.fillText(fmt(v, 0), px - 6, y);
    }
    // label pita Normal
    const nb = classBands(meta.tmatClasses ?? [], wDom).find((b) => b.id === 'normal');
    if (nb) {
      const yMid = (syWater(nb.top) + syWater(nb.bottom)) / 2;
      ctx.font = smallFont;
      ctx.textAlign = 'left';
      ctx.fillStyle = col.chartInk;
      ctx.fillText(`${C.normalBand} −45…−60`, px + 6, yMid);
    }
    // permukaan gambut (0)
    ctx.strokeStyle = col.chartInk;
    ctx.lineWidth = 1;
    const y0w = syWater(0);
    hline(y0w, px, px + pw);
    ctx.font = smallFont;
    ctx.fillStyle = col.chartInk;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(C.surface, px + 6, y0w - 2);
    // batas PP −40 cm
    const yPP = syWater(-40);
    ctx.save();
    ctx.strokeStyle = col.bad;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    hline(yPP, px, px + pw);
    ctx.restore();
    ctx.fillStyle = col.bad;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = `600 10px ${col.fontBody}`;
    ctx.fillText(C.ppLine, px + pw - 4, yPP - 2);

    const ends = [];
    if (n) {
      const xs = series.day.map((d) => sx(d + 0.5));
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, wy - 2, pw, wh + 4);
      ctx.clip();
      // mercu (garis bertangga)
      const crestOn = emph.has('Mercu');
      ctx.strokeStyle = crestOn ? col.crest : hexA(col.seriesMuted, 0.6);
      ctx.lineWidth = crestOn ? 1.5 : 1;
      ctx.lineJoin = 'miter';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const xL = sx(series.day[i]);
        const xR = sx(series.day[i] + 1);
        const y = syWater(series.crestM[i] * 100);
        if (i === 0) ctx.moveTo(xL, y);
        else ctx.lineTo(xL, y);
        ctx.lineTo(xR, y);
      }
      ctx.stroke();
      ends.push({ id: 'Mercu', label: C.crest, y: syWater(series.crestM[n - 1] * 100), x: sx(series.day[n - 1] + 1), color: crestOn ? col.crest : col.seriesMuted, on: crestOn });
      // piezometer: yang tidak ditonjolkan dulu (abu), lalu yang ditonjolkan
      const order = [...pids].sort((a, b) => Number(emph.has(a)) - Number(emph.has(b)));
      for (const id of order) {
        const on = emph.has(id);
        const ys = series.depthCm[id].map((d) => syWater(-d));
        line(xs, ys, on ? col.tmat : col.seriesMuted, on ? (id === tpId ? 2.25 : 1.75) : 1.1);
        ends.push({ id, label: id === tpId ? `${id} TP` : id, y: ys[n - 1], x: xs[n - 1], color: on ? col.tmat : col.seriesMuted, on });
      }
      // TMAS
      const tOn = emph.has('TMAS');
      const yT = series.tmasCm.map((t) => syWater(-t));
      line(xs, yT, tOn ? col.tmas : col.seriesMuted, tOn ? 2 : 1.1);
      ends.push({ id: 'TMAS', label: C.tmas, y: yT[n - 1], x: xs[n - 1], color: tOn ? col.tmas : col.seriesMuted, on: tOn });
      ctx.restore();
      drawEndLabels(ends, wy, wy + wh, smallFont);
    } else {
      ctx.font = `12px ${col.fontBody}`;
      ctx.fillStyle = col.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(C.empty, px + pw / 2, wy + wh / 2 + 14);
    }

    // ---------- (c) pembuangan ----------
    drawTitle(C.qTitle, L.flow.y, titleFont);
    const fTop = syFlow.domain[1];
    const fBot = syFlow.domain[0];
    ctx.font = tickFont;
    ctx.fillStyle = col.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(fmt(fTop, 0), px - 6, L.flow.y);
    ctx.fillText(fmt(fBot, 0), px - 6, L.flow.y + L.flow.h);
    ctx.strokeStyle = col.grid;
    hline(L.flow.y, px, px + pw);
    ctx.strokeStyle = col.line;
    const yZero = syFlow(0);
    hline(yZero, px, px + pw);
    if (n) {
      const xs = series.day.map((d) => sx(d + 0.5));
      const ys = series.q_mmd.map((v) => syFlow(v));
      ctx.fillStyle = hexA(col.q, col.dark ? 0.22 : 0.14);
      ctx.beginPath();
      ctx.moveTo(xs[0], yZero);
      for (let i = 0; i < n; i++) ctx.lineTo(xs[i], ys[i]);
      ctx.lineTo(xs[n - 1], yZero);
      ctx.closePath();
      ctx.fill();
      line(xs, ys, col.q, 2);
      if (n === 1) dot(xs[0], ys[0], col.q);
    }
  }

  function drawTitle(text, y, font) {
    ctx.font = font;
    ctx.fillStyle = colors.chartInk;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, L.plot.x, y - 3);
  }

  function hline(y, x0, x1) {
    const yy = Math.round(y) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x0, yy);
    ctx.lineTo(x1, yy);
    ctx.stroke();
  }

  function line(xs, ys, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      if (!Number.isFinite(ys[i])) continue;
      if (i === 0) ctx.moveTo(xs[i], ys[i]);
      else ctx.lineTo(xs[i], ys[i]);
    }
    ctx.stroke();
    if (xs.length === 1) dot(xs[0], ys[0], color);
  }

  function dot(x, y, color, c = ctx) {
    c.beginPath();
    c.arc(x, y, 5.5, 0, Math.PI * 2);
    c.fillStyle = colors.surface;
    c.fill();
    c.beginPath();
    c.arc(x, y, 3.5, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
  }

  /** Label ujung seri: ditaruh setelah titik terakhir, dirapikan vertikal dengan garis penghubung pendek. */
  function drawEndLabels(ends, top, bottom, font) {
    ctx.font = font;
    const items = ends
      .filter((e) => Number.isFinite(e.y))
      .map((e) => ({ ...e, ly: Math.min(bottom - 4, Math.max(top + 4, e.y)) }))
      .sort((a, b) => a.ly - b.ly);
    const gap = 11;
    for (let i = 1; i < items.length; i++) if (items[i].ly - items[i - 1].ly < gap) items[i].ly = items[i - 1].ly + gap;
    for (let i = items.length - 2; i >= 0; i--) {
      if (items[i].ly > bottom - 4 - (items.length - 1 - i) * gap) items[i].ly = Math.min(items[i].ly, items[i + 1].ly - gap);
    }
    const xMax = L.plot.x + L.plot.w;
    for (const it of items) {
      const tw = ctx.measureText(it.label).width;
      let x = it.x + 8;
      if (x + tw > size.w - 2) x = size.w - 2 - tw;
      if (x < xMax - 4 && it.x > xMax - 30) x = xMax + 6;
      if (Math.abs(it.ly - it.y) > 2) {
        ctx.strokeStyle = hexA(it.on ? it.color : colors.seriesMuted, 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(it.x + 2, it.y);
        ctx.lineTo(x - 2, it.ly);
        ctx.stroke();
      }
      ctx.fillStyle = it.on ? colors.ink : colors.muted;
      ctx.font = it.on ? `600 ${font.replace(/^\d+(\.\d+)?px /, '10px ')}` : font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.label, x, it.ly);
      ctx.font = font;
    }
  }

  // ---------- overlay: playhead & crosshair ----------
  function drawOverlay(force = false) {
    if (!L || !sx || size.w < 40) return;
    const xp = Math.round(sx(Math.min(Math.max(playT, xDom[0]), xDom[1])));
    if (!force && xp === lastPlayPx) return;
    lastPlayPx = xp;
    const { w, h, dpr } = size;
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, w, h);
    const top = L.rain.y;
    const bottom = L.flow.y + L.flow.h;
    // playhead
    if (playT >= xDom[0] && playT <= xDom[1]) {
      octx.fillStyle = colors.accent;
      octx.fillRect(xp - 0.75, top - 2, 1.5, bottom - top + 4);
      octx.beginPath();
      octx.moveTo(xp - 4.5, top - 7);
      octx.lineTo(xp + 4.5, top - 7);
      octx.lineTo(xp, top - 1);
      octx.closePath();
      octx.fill();
    }
    // crosshair
    if (hoverIdx >= 0 && series && hoverIdx < series.n) {
      const d = series.day[hoverIdx];
      const x = Math.round(sx(d + 0.5)) + 0.5;
      octx.strokeStyle = colors.chartInk;
      octx.globalAlpha = 0.55;
      octx.lineWidth = 1;
      octx.beginPath();
      octx.moveTo(x, top);
      octx.lineTo(x, bottom);
      octx.stroke();
      octx.globalAlpha = 1;
      for (const id of pids) {
        const on = emph.has(id);
        if (!on) continue;
        dot(x, syWater(-series.depthCm[id][hoverIdx]), colors.tmat, octx);
      }
      if (emph.has('TMAS')) dot(x, syWater(-series.tmasCm[hoverIdx]), colors.tmas, octx);
      dot(x, syFlow(series.q_mmd[hoverIdx]), colors.q, octx);
    }
  }

  // ---------- tooltip ----------
  function row(keyClass, value, label, strong = true) {
    const r = document.createElement('div');
    r.className = 'tip-row';
    const k = document.createElement('span');
    k.className = `tip-key ${keyClass}`;
    const v = document.createElement(strong ? 'strong' : 'span');
    v.className = 'tip-v';
    v.textContent = value;
    const l = document.createElement('span');
    l.className = 'tip-l';
    l.textContent = label;
    r.append(k, v, l);
    return r;
  }

  function showTip(i, anchorX) {
    if (!series || i < 0 || i >= series.n) {
      tip.hidden = true;
      return;
    }
    tip.textContent = '';
    const head = document.createElement('div');
    head.className = 'tip-head';
    head.textContent = `${series.dateLabel[i]} · hari ${series.day[i] + 1}${series.partial?.[i] ? ` (${C.running})` : ''}`;
    tip.append(head);
    tip.append(row('k-rain', `${fmt(series.rain_mm[i], 1)} mm`, 'hujan'));
    const tp = series.tpId ?? tpId;
    const ordered = [tp, ...pids.filter((p) => p !== tp)];
    for (const id of ordered) {
      const d = series.depthCm[id][i];
      tip.append(row(id === tp ? 'k-tmat' : 'k-muted', fmtElevCm(d), id === tp ? `${id} (titik penaatan)` : id, id === tp));
    }
    const tpd = series.depthCm[tp][i];
    const cls = classifyTmat(tpd);
    const catRow = document.createElement('div');
    catRow.className = 'tip-row tip-cat';
    const chip = document.createElement('span');
    chip.className = `st st-${cls.id}`;
    chip.textContent = `${cls.icon} ${cls.label}`;
    const pp = document.createElement('span');
    pp.className = ppCompliant(tpd) ? 'tip-pp ok' : 'tip-pp bad';
    pp.textContent = ppCompliant(tpd) ? 'patuh PP' : 'tidak patuh PP';
    catRow.append(chip, pp);
    tip.append(catRow);
    tip.append(row('k-tmas', fmtElevCm(series.tmasCm[i]), 'TMAS'));
    tip.append(row('k-crest', fmtElevCm(-series.crestM[i] * 100), `mercu (${series.nLogs[i]} stoplog)`, false));
    tip.append(row('k-q', `${fmt(series.q_mmd[i], 1)} mm/hari`, fmtQ(series.q_m3s[i]), true));
    tip.hidden = false;
    // posisi: di samping crosshair, dibalik bila mepet kanan
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let x = anchorX + 14;
    if (x + tw > size.w - 4) x = anchorX - 14 - tw;
    x = Math.max(4, x);
    const y = Math.max(2, Math.min(size.h - th - 2, (L?.water.y ?? 20) - 10));
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  function hoverAt(clientX) {
    if (!series || !series.n || !sx) return;
    const r = wrap.getBoundingClientRect();
    const x = clientX - r.left;
    if (x < L.plot.x - 10 || x > L.plot.x + L.plot.w + 10) {
      clearHover();
      return;
    }
    setHover(nearestIndex(series.day, sx.invert(x)));
  }

  function setHover(i) {
    if (!series || !series.n) return;
    i = Math.max(0, Math.min(series.n - 1, i));
    hoverIdx = i;
    drawOverlay(true);
    showTip(i, sx(series.day[i] + 0.5));
  }

  function clearHover() {
    if (hoverIdx < 0 && tip.hidden) return;
    hoverIdx = -1;
    tip.hidden = true;
    drawOverlay(true);
  }

  wrap.addEventListener('pointermove', (e) => hoverAt(e.clientX));
  wrap.addEventListener('pointerleave', clearHover);
  wrap.addEventListener('blur', clearHover);
  wrap.addEventListener('keydown', (e) => {
    if (!series || !series.n) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      const cur = hoverIdx < 0 ? series.n - 1 : hoverIdx + (e.key === 'ArrowRight' ? 1 : -1);
      setHover(cur);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setHover(e.key === 'Home' ? 0 : series.n - 1);
    } else if (e.key === 'Escape') {
      clearHover();
    }
  });

  // ---------- ukuran & tema ----------
  const ro = new ResizeObserver(() => {
    if (measure() || dirty) {
      drawStatic();
      drawOverlay(true);
    }
  });
  ro.observe(wrap);
  onThemeChange(() => {
    colors = readColors();
    drawStatic();
    drawOverlay(true);
  });

  function visible() {
    return wrap.offsetParent !== null && size.w > 0;
  }

  return {
    canvas,
    legend,
    /** Data harian baru: gambar ulang lapisan statis. */
    setData(s) {
      series = s;
      if (s?.tpId && s.tpId !== tpId) {
        const old = tpId;
        tpId = s.tpId;
        if (!userTouched) {
          emph.delete(old);
          emph.add(tpId);
        }
        syncLegend();
      }
      if (hoverIdx >= (s?.n ?? 0)) hoverIdx = -1;
      measure();
      if (!visible()) {
        dirty = true;
        return;
      }
      drawStatic();
      drawOverlay(true);
      if (hoverIdx >= 0) showTip(hoverIdx, sx(series.day[hoverIdx] + 0.5));
    },
    /** Posisi playhead (hari kontinu); murah bila piksel tidak berubah. */
    setPlayhead(t) {
      playT = t;
      if (dirty && visible()) {
        measure();
        drawStatic();
      }
      drawOverlay(false);
    },
    redraw() {
      measure();
      colors = readColors();
      drawStatic();
      drawOverlay(true);
    },
    resetEmphasis() {
      userTouched = false;
      emph = new Set([tpId, 'TMAS', 'Mercu']);
      syncLegend();
    },
  };
}
