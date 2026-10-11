// Grafik mini Canvas 2D untuk tab Persamaan (tanpa library). DPR-aware; warna dari token CSS (--…).
// Fungsi tick murni (niceTicks, logTicks) bisa dites di Node; drawPlot butuh DOM.
import { fmt } from '../format.js';

/** Tick "bagus" (1–2–5 × 10ⁿ) antara min dan max, kira-kira `count` buah. */
export function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return { ticks: [min], step: 1 };
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const raw = (hi - lo) / Math.max(count, 1);
  const p = 10 ** Math.floor(Math.log10(raw));
  const r = raw / p;
  const step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * p;
  const ticks = [];
  const start = Math.ceil(lo / step - 1e-9) * step;
  for (let v = start; v <= hi + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return { ticks, step };
}

/** Tick dekade untuk sumbu log (1, 2, 5 × 10ⁿ bila rentang sempit). */
export function logTicks(min, max) {
  const out = [];
  const e0 = Math.floor(Math.log10(min));
  const e1 = Math.ceil(Math.log10(max));
  const mults = e1 - e0 <= 2 ? [1, 2, 5] : [1];
  for (let e = e0; e <= e1; e++) for (const k of mults) {
    const v = k * 10 ** e;
    if (v >= min * (1 - 1e-9) && v <= max * (1 + 1e-9)) out.push(v);
  }
  return out;
}

/** Desimal label untuk langkah tick. */
export function tickDigits(step) {
  if (!(step > 0)) return 0;
  return Math.max(0, Math.min(4, -Math.floor(Math.log10(step) + 1e-9) + (String(step).includes('25') ? 1 : 0)));
}

function cssVar(el, name, fallback) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

function color(el, c, fallback = '#888') {
  if (!c) return fallback;
  return c.startsWith('--') ? cssVar(el, c, fallback) : c;
}

/** Peta nilai sumbu → piksel: min → a, max → b (linear atau log). */
function axisMap(ax, a, b) {
  const { min, max, log } = ax;
  const f = log
    ? (v) => (Math.log10(Math.max(v, 1e-12)) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))
    : (v) => (v - min) / (max - min);
  return (v) => a + (b - a) * f(v);
}

/**
 * Gambar grafik. Mengembalikan false bila kanvas belum punya ukuran (tersembunyi) → panggil ulang nanti.
 * spec: {x:{min,max,label,log,ticks,fmt,invert}, y:{…}, series:[{x,y,color,width,dash,fill}], bars:[{x,y,color,w}],
 *        hlines:[{y,color,dash,label}], vlines:[{x,color,dash,label}], hbands:[{y0,y1,color,alpha,label}],
 *        points:[{x,y,color,r,label,shape}], height}
 */
export function drawPlot(canvas, spec) {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight || spec.height || 200;
  if (!cssW || !cssH) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const W = Math.round(cssW * dpr);
  const H = Math.round(cssH * dpr);
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const ink = cssVar(canvas, '--chart-ink', '#3e4a42');
  const grid = cssVar(canvas, '--chart-grid', '#dfe4dc');
  const surface = cssVar(canvas, '--surface', '#ffffff');
  const fontData = cssVar(canvas, '--font-data', 'monospace');
  const fontBody = cssVar(canvas, '--font-body', 'sans-serif');
  const small = cssW < 300;
  const fs = small ? 10 : 11;

  const pad = { l: small ? 40 : 48, r: 12, t: spec.y?.label ? 22 : 10, b: spec.x?.label ? 36 : 22, ...(spec.pad || {}) };
  const L = pad.l;
  const R = cssW - pad.r;
  const T = pad.t;
  const B = cssH - pad.b;
  if (R - L < 20 || B - T < 20) return false;
  const X = axisMap(spec.x, L, R);
  const Y = spec.y.invert ? axisMap(spec.y, T, B) : axisMap(spec.y, B, T);

  // tick
  const xt = spec.x.ticks ? { ticks: spec.x.ticks, step: NaN } : spec.x.log ? { ticks: logTicks(spec.x.min, spec.x.max), step: NaN } : niceTicks(spec.x.min, spec.x.max, small ? 4 : 6);
  const yt = spec.y.ticks ? { ticks: spec.y.ticks, step: NaN } : spec.y.log ? { ticks: logTicks(spec.y.min, spec.y.max), step: NaN } : niceTicks(spec.y.min, spec.y.max, 5);
  const fmtTick = (ax, t, v) => {
    if (ax.fmt) return ax.fmt(v);
    if (ax.log) return fmt(v, v < 1 ? Math.min(3, -Math.floor(Math.log10(v))) : 0);
    return fmt(v, Number.isFinite(t.step) ? tickDigits(t.step) : 2);
  };

  ctx.lineWidth = 1;
  ctx.font = `${fs}px ${fontData}`;
  ctx.textBaseline = 'middle';

  // pita horizontal
  for (const b of spec.hbands || []) {
    const y0 = Y(b.y0);
    const y1 = Y(b.y1);
    ctx.globalAlpha = b.alpha ?? 0.18;
    ctx.fillStyle = color(canvas, b.color);
    ctx.fillRect(L, Math.min(y0, y1), R - L, Math.abs(y1 - y0));
    ctx.globalAlpha = 1;
  }

  // grid + label tick
  ctx.strokeStyle = grid;
  ctx.fillStyle = ink;
  ctx.textAlign = 'right';
  for (const v of yt.ticks) {
    const y = Math.round(Y(v)) + 0.5;
    if (y < T - 0.5 || y > B + 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(L, y);
    ctx.lineTo(R, y);
    ctx.stroke();
    ctx.fillText(fmtTick(spec.y, yt, v), L - 5, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let lastRight = -Infinity;
  for (const v of xt.ticks) {
    const x = Math.round(X(v)) + 0.5;
    if (x < L - 0.5 || x > R + 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(x, T);
    ctx.lineTo(x, B);
    ctx.stroke();
    const label = fmtTick(spec.x, xt, v);
    const w = ctx.measureText(label).width;
    if (x - w / 2 > lastRight + 4) {
      ctx.fillText(label, x, B + 5);
      lastRight = x + w / 2;
    }
  }
  // bingkai
  ctx.strokeStyle = cssVar(canvas, '--line-strong', '#aab4a8');
  ctx.strokeRect(L + 0.5, T + 0.5, R - L - 1, B - T - 1);

  // label sumbu
  ctx.font = `${fs}px ${fontBody}`;
  ctx.fillStyle = ink;
  if (spec.x.label) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(spec.x.label, (L + R) / 2, cssH - 2);
  }
  if (spec.y.label) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(spec.y.label, 4, 3);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(L, T, R - L, B - T);
  ctx.clip();

  // batang
  for (const b of spec.bars || []) {
    ctx.fillStyle = color(canvas, b.color);
    ctx.globalAlpha = b.alpha ?? 0.85;
    for (let j = 0; j < b.x.length; j++) {
      const v = b.y[j];
      if (!Number.isFinite(v)) continue;
      const x0 = X(b.x[j] - b.w / 2);
      const x1 = X(b.x[j] + b.w / 2);
      const y0 = Y(b.base ?? 0);
      const y1 = Y(v);
      ctx.fillRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1), Math.max(Math.abs(x1 - x0) - 1, 1), Math.abs(y1 - y0));
    }
    ctx.globalAlpha = 1;
  }

  // garis referensi
  const refLine = (x0, y0, x1, y1, l) => {
    ctx.strokeStyle = color(canvas, l.color, ink);
    ctx.lineWidth = l.width ?? 1.25;
    ctx.setLineDash(l.dash ? [5, 4] : []);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  for (const l of spec.hlines || []) refLine(L, Y(l.y), R, Y(l.y), l);
  for (const l of spec.vlines || []) refLine(X(l.x), T, X(l.x), B, l);

  // seri
  for (const s of spec.series || []) {
    const c = color(canvas, s.color, ink);
    const pts = [];
    for (let j = 0; j < s.x.length; j++) {
      if (Number.isFinite(s.x[j]) && Number.isFinite(s.y[j])) pts.push([X(s.x[j]), Y(s.y[j])]);
    }
    if (pts.length < 2) continue;
    if (s.fill != null && s.fill !== false) {
      const base = Y(typeof s.fill === 'number' ? s.fill : spec.y.invert ? spec.y.max : spec.y.min);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], base);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(pts.at(-1)[0], base);
      ctx.closePath();
      ctx.globalAlpha = s.fillAlpha ?? 0.15;
      ctx.fillStyle = c;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = c;
    ctx.lineWidth = s.width ?? 2;
    ctx.lineJoin = 'round';
    ctx.setLineDash(s.dash ? [6, 4] : []);
    ctx.beginPath();
    pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  // label garis referensi (di luar clip agar tidak terpotong)
  ctx.font = `${fs}px ${fontBody}`;
  const halo = (text, x, y) => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = surface;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  };
  for (const l of spec.hlines || []) {
    if (!l.label) continue;
    const y = Y(l.y);
    if (y < T || y > B) continue;
    ctx.fillStyle = color(canvas, l.color, ink);
    ctx.textAlign = l.align === 'left' ? 'left' : 'right';
    ctx.textBaseline = l.below ? 'top' : 'bottom';
    halo(l.label, l.align === 'left' ? L + 4 : R - 4, y + (l.below ? 2 : -2));
  }
  for (const l of spec.vlines || []) {
    if (!l.label) continue;
    const x = X(l.x);
    ctx.fillStyle = color(canvas, l.color, ink);
    ctx.textAlign = x > (L + R) / 2 ? 'right' : 'left';
    ctx.textBaseline = 'top';
    halo(l.label, x + (x > (L + R) / 2 ? -4 : 4), T + 3);
  }

  // titik
  for (const p of spec.points || []) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const x = X(p.x);
    const y = Y(p.y);
    const r = p.r ?? 5;
    ctx.beginPath();
    if (p.shape === 'diamond') {
      ctx.moveTo(x, y - r - 1);
      ctx.lineTo(x + r + 1, y);
      ctx.lineTo(x, y + r + 1);
      ctx.lineTo(x - r - 1, y);
      ctx.closePath();
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = color(canvas, p.color, ink);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = p.stroke ? color(canvas, p.stroke) : surface;
    ctx.stroke();
    if (p.ring) {
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (p.label) {
      ctx.fillStyle = ink;
      ctx.font = `600 ${fs}px ${fontBody}`;
      const right = x < R - 60;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.textBaseline = p.labelBelow ? 'top' : 'bottom';
      halo(p.label, x + (right ? r + 3 : -(r + 3)), y + (p.labelBelow ? 2 : -2));
    }
  }
  return true;
}
