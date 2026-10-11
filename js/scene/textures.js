// Tekstur kanvas prosedural (deterministik): pelepah sawit, batang, papan duga, mistar, siluet horizon, dll.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function canvasTexture(canvas, { repeat = false, srgb = true, mipmaps = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = mipmaps;
  t.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.anisotropy = aniso;
  return t;
}

/**
 * Tekstur kanvas yang ukurannya bisa berubah (mis. mistar/papan duga digambar ulang saat VE berubah).
 * three memakai penyimpanan tekstur tetap, jadi bila ukuran kanvas berubah tekstur dibuat ulang.
 */
export function redrawCanvasTexture(holder, material, opts) {
  const c = holder.canvas;
  if (holder.texture && holder.w === c.width && holder.h === c.height) {
    holder.texture.needsUpdate = true;
    return holder.texture;
  }
  holder.texture?.dispose();
  holder.texture = canvasTexture(c, opts);
  holder.w = c.width;
  holder.h = c.height;
  material.map = holder.texture;
  material.needsUpdate = true;
  return holder.texture;
}

const hsl = (h, s, l, a = 1) => `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a})`;

/**
 * Pelepah (u = pangkal → ujung sepanjang x, v = melintang sepanjang y), latar transparan.
 * Anak daun rapat dua bidang (khas kelapa sawit), rakis kekuningan, pangkal (petiol) berduri tanpa anak daun.
 */
export function drawFrond(ctx, x0, y0, W, H, seed = 3) {
  const rnd = mulberry32(seed);
  const cy = y0 + H / 2;
  ctx.save();
  ctx.lineCap = 'round';
  // anak daun
  for (let x = x0 + 0.17 * W; x < x0 + W * 0.995; x += W / 128) {
    const u = (x - x0) / W;
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, (u - 0.15) / 0.86)), 0.45);
    for (const side of [-1, 1]) {
      for (let layer = 0; layer < 2; layer++) {
        const len = (H / 2 - 1) * (0.62 + 0.38 * env) * (0.82 + 0.18 * rnd()) * (layer ? 0.86 : 1);
        const ang = ((layer ? 58 : 44) + 8 * rnd()) * (Math.PI / 180);
        const dx = Math.cos(ang) * len * 0.9;
        const dy = Math.sin(ang) * len;
        const ex = x + dx;
        const ey = cy + side * dy;
        const light = layer ? 22 + 10 * rnd() : 28 + 12 * rnd();
        ctx.strokeStyle = hsl(88 + 14 * rnd(), 48 + 14 * rnd(), light + 4 * (1 - u));
        ctx.lineWidth = (layer ? 2.2 : 2.8) * (W / 512);
        ctx.beginPath();
        ctx.moveTo(x, cy + side * 1.5);
        ctx.quadraticCurveTo(x + dx * 0.45, cy + side * dy * 0.62, ex, ey);
        ctx.stroke();
      }
    }
  }
  // rakis
  for (let i = 0; i < 3; i++) {
    const t0 = i / 3;
    ctx.strokeStyle = hsl(70, 38, 42 - i * 4);
    ctx.lineWidth = (5 - i * 1.4) * (W / 512);
    ctx.beginPath();
    ctx.moveTo(x0 + t0 * W, cy);
    ctx.lineTo(x0 + W, cy);
    ctx.stroke();
  }
  // duri pangkal
  ctx.strokeStyle = hsl(60, 25, 28);
  ctx.lineWidth = 1.2 * (W / 512);
  for (let x = x0 + 4; x < x0 + 0.17 * W; x += 6) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, cy + side * 2);
      ctx.lineTo(x + 3, cy + side * 7);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Tekstur pelepah tunggal 512×128. */
export function frondTexture() {
  const c = makeCanvas(512, 128);
  drawFrond(c.getContext('2d'), 0, 0, 512, 128, 3);
  return canvasTexture(c);
}

/** Pola batang sawit: pangkal pelepah (petiol terpotong) tersusun spiral, celah gelap, kadang paku-pakuan epifit. */
export function drawTrunk(ctx, x0, y0, W, H, seed = 5) {
  const rnd = mulberry32(seed);
  ctx.fillStyle = '#3d3226';
  ctx.fillRect(x0, y0, W, H);
  const rows = 10;
  const cols = 4;
  const rh = H / rows;
  const cw = W / cols;
  for (let r = -1; r <= rows; r++) {
    for (let k = -1; k <= cols; k++) {
      const cx = x0 + ((k * cw + r * cw * 0.37) % (W + cw)) - cw / 2;
      const cy = y0 + r * rh;
      const w = cw * (0.42 + 0.08 * rnd());
      const l = 34 + 12 * rnd();
      // sisi petiol (menyempit ke bawah)
      ctx.fillStyle = hsl(30 + 8 * rnd(), 20 + 8 * rnd(), l);
      ctx.beginPath();
      ctx.moveTo(cx - w, cy + rh * 0.05);
      ctx.quadraticCurveTo(cx, cy - rh * 0.12, cx + w, cy + rh * 0.05);
      ctx.lineTo(cx + w * 0.28, cy + rh * 1.05);
      ctx.lineTo(cx - w * 0.28, cy + rh * 1.05);
      ctx.closePath();
      ctx.fill();
      // bidang potong terang di atas
      ctx.fillStyle = hsl(36, 26, l + 16, 0.9);
      ctx.beginPath();
      ctx.ellipse(cx, cy + rh * 0.06, w * 0.86, rh * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      // bayang di sela
      ctx.fillStyle = 'rgba(15,10,5,0.45)';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.3, cy + rh * 0.95);
      ctx.lineTo(cx + w * 0.3, cy + rh * 0.95);
      ctx.lineTo(cx, cy + rh * 1.25);
      ctx.closePath();
      ctx.fill();
      if (rnd() < 0.09) {
        ctx.fillStyle = hsl(95 + 15 * rnd(), 45, 28, 0.9);
        for (let f = 0; f < 5; f++) {
          ctx.beginPath();
          ctx.ellipse(cx + (rnd() - 0.5) * cw * 0.6, cy + rh * (0.3 + 0.5 * rnd()), cw * 0.16, rh * 0.08, rnd() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}

export function trunkTexture() {
  const c = makeCanvas(128, 256);
  drawTrunk(c.getContext('2d'), 0, 0, 128, 256, 5);
  return canvasTexture(c, { repeat: true });
}

/** Atlas LOD 256×128: pelepah di setengah atas (v 0,5–1), batang polos di setengah bawah. */
export function lodAtlasTexture() {
  const c = makeCanvas(256, 128);
  const ctx = c.getContext('2d');
  drawFrond(ctx, 0, 0, 256, 64, 9);
  ctx.fillStyle = '#5a4734';
  ctx.fillRect(0, 64, 256, 64);
  return canvasTexture(c);
}

/** Bintang mahkota (proyeksi atas) untuk bayangan proksi: baji pelepah padat (tanpa mipmap agar alpha-test utuh). */
export function crownStarTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(21);
  ctx.translate(64, 64);
  ctx.fillStyle = '#fff';
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + rnd() * 0.2;
    const len = 44 + 18 * rnd();
    const w = 5 + 3 * rnd();
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.quadraticCurveTo(len * 0.45, -w, len, 0);
    ctx.quadraticCurveTo(len * 0.45, w, 6, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  return canvasTexture(c, { srgb: false, mipmaps: false });
}

/** Tumpukan pelepah (gawangan mati): serat cokelat-zaitun. */
export function stackTexture() {
  const c = makeCanvas(128, 64);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(13);
  ctx.fillStyle = '#4d4128';
  ctx.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 220; i++) {
    const x = rnd() * 128;
    const y = rnd() * 64;
    const len = 8 + rnd() * 26;
    const a = (rnd() - 0.5) * 0.9;
    ctx.strokeStyle = rnd() < 0.55 ? hsl(40 + 20 * rnd(), 35, 22 + 16 * rnd()) : hsl(80 + 20 * rnd(), 30, 20 + 12 * rnd());
    ctx.lineWidth = 1 + rnd() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  return canvasTexture(c, { repeat: true });
}

/** Tekstur tanah jauh (semak/kebun samar) yang diulang. */
export function farGroundTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(17);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 128;
    const y = rnd() * 128;
    const r = 2 + rnd() * 7;
    ctx.fillStyle = `rgba(${40 + rnd() * 40}, ${60 + rnd() * 50}, ${20 + rnd() * 20}, ${0.12 + rnd() * 0.2})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasTexture(c, { repeat: true });
}

/** Siluet horizon: bukit jauh (pucat) + garis hutan dekat (gelap), alpha di luar siluet. */
export function horizonTexture() {
  const W = 2048;
  const H = 128;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(29);
  const noise = (n, amp) => {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(rnd() * amp);
    return (x) => {
      const f = (x / W) * n;
      const i = Math.floor(f) % n;
      const t = f - Math.floor(f);
      const s = t * t * (3 - 2 * t);
      return pts[i] + (pts[(i + 1) % n] - pts[i]) * s;
    };
  };
  const hills = noise(9, 55);
  const hills2 = noise(23, 18);
  ctx.fillStyle = 'rgba(150,170,175,0.9)';
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H - 30 - hills(x) - hills2(x));
  ctx.lineTo(W, H);
  ctx.fill();
  const tree = noise(160, 9);
  const tree2 = noise(41, 16);
  ctx.fillStyle = 'rgba(70,95,80,1)';
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 3) ctx.lineTo(x, H - 18 - tree(x) - tree2(x));
  ctx.lineTo(W, H);
  ctx.fill();
  const t = canvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Garis arus (nappe) bergaris untuk digulir. */
export function streakTexture() {
  const c = makeCanvas(64, 128);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(31);
  ctx.fillStyle = 'rgba(120,185,235,0.9)';
  ctx.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 64;
    const y = rnd() * 128;
    ctx.fillStyle = rnd() < 0.55 ? 'rgba(255,255,255,0.95)' : 'rgba(40,110,190,0.75)';
    ctx.fillRect(x, y, 1 + rnd() * 2.5, 8 + rnd() * 26);
  }
  return canvasTexture(c, { repeat: true });
}
