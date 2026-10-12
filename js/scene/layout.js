// Tata letak dunia 3D (murni, tanpa DOM/three): koordinat, saluran, sungai, kisi sawit, instrumen.
// Konvensi: 1 unit = 1 m, Y ke atas, y = 0 = tanggul saluran koleksi (datum model).
// Blok utama X ∈ [−150, 150] (saluran koleksi A di X = −150, B di X = +150), Z ∈ [−200, 200] (blok asli 1 km).
// Koordinat model x = jarak dari saluran koleksi = 150 − |X|. Piezometer berada di sisi barat (X = x − 150).

import { VISUAL_SEED } from '../core/config.js';

export const SEED = VISUAL_SEED;

/** Batas blok utama dan diorama. */
export const WORLD = Object.freeze({
  halfZ: 200, // panjang blok yang digambar (Z ∈ [−200, 200])
  blockPitch: 300, // jarak antar-saluran koleksi (lebar blok)
  blockEdgeX: 152.4, // tepi luar mesh blok utama (tanggul luar saluran koleksi)
  mainZ: -225, // sumbu saluran utama (sejajar X)
  gateX: 200, // pintu air stoplog di saluran utama
  roadZ: Object.freeze([-216, -214, -208, -206]), // tanggul + jalan koleksi (bahu, puncak, puncak, bahu)
  roadTop: 0.5, // elevasi puncak jalan (m)
  northRoadZ: Object.freeze([201, 203, 209, 211]),
  northRoadTop: 0.3,
  southStartZ: -235, // awal blok tetangga selatan
  extent: Object.freeze({ xMin: -480, xMax: 480, zMin: -530, zMax: 420 }),
  southEndZ: -490, // ujung selatan blok tetangga selatan
  seamX: Object.freeze([-152.4, 152.4, 285]), // batas antar-patch terrain (relief dibuat nol agar tidak retak)
  farGround: 2600,
  sectionZ: 0, // bidang potong (cutaway)
  instrumentZ: 0.6, // piezometer & papan duga sedikit di depan bidang potong agar terlihat di penampang
});

/** Sungai berkelok: garis tengah, setengah lebar atas (y = 0) dan dasar. */
export const RIVER = Object.freeze({ x0: 240, halfTop: 25, halfBottom: 9, bed: -4.0, levee: 0.15 });

export function riverCenterX(Z) {
  return RIVER.x0 + 9 * Math.sin((2 * Math.PI * (Z + 225)) / 420) + 3 * Math.sin((2 * Math.PI * (Z + 40)) / 170);
}

/** Setengah lebar muka air sungai pada elevasi h. */
export function riverHalfWidthAt(h) {
  const t = Math.min(Math.max((h - RIVER.bed) / (0 - RIVER.bed), 0), 1.05);
  return RIVER.halfBottom + t * (RIVER.halfTop - RIVER.halfBottom);
}

// ---------- koordinat model ↔ scene ----------

/** Koordinat model x (m dari saluran koleksi) → X scene. side −1 = sisi barat (saluran A), +1 = timur (B). */
export function sceneXFromModel(x, side = -1, Lh = 150) {
  return side * (Lh - x);
}

/** X scene → koordinat model x = Lh − |X| (dibatasi 0…Lh). */
export function modelXFromScene(X, Lh = 150) {
  const x = Lh - Math.abs(X);
  return x < 0 ? 0 : x > Lh ? Lh : x;
}

// ---------- saluran ----------

/** Penampang saluran dari parameter model (trapesium). */
export function channelSpecs(params) {
  const g = params.geom;
  const c = g.collection;
  const m = g.main;
  return {
    collection: { bed: c.zBed, b: c.bottom, m: c.slope, halfTop: c.bottom / 2 + c.slope * (g.zBank - c.zBed) },
    main: { bed: m.zBed, b: m.bottom, m: m.slope, halfTop: m.bottom / 2 + m.slope * (g.zBank - m.zBed) },
    outfall: { bed: m.zBed - 0.1, bedEnd: m.zBed - 0.5, b: m.bottom, m: m.slope },
    field: { depth: params.fieldDrains.depth, b: 0.4, halfTop: 0.6, spacing: params.fieldDrains.spacing, enabled: !!params.fieldDrains.enabled },
  };
}

/** Garis saluran koleksi (sejajar Z) di seluruh diorama. */
export const COLLECTION_X = Object.freeze([-450, -150, 150]);

/** Posisi Z parit lapangan di rentang [zMin, zMax] (global: Z = s/2 + k·s). */
export function fieldDrainZs(spacing, zMin, zMax, margin = 8) {
  const out = [];
  const k0 = Math.ceil((zMin + margin - spacing / 2) / spacing);
  for (let k = k0; ; k++) {
    const z = spacing / 2 + k * spacing;
    if (z > zMax - margin) break;
    out.push(z);
  }
  return out;
}

/** Jarak ke parit lapangan terdekat (pola periodik Z = s/2 + k·s). */
export function fieldDrainDistance(Z, spacing) {
  const r = (((Z - spacing / 2) % spacing) + spacing) % spacing;
  return Math.min(r, spacing - r);
}

/** Blok kebun (pusat X & rentang Z tanam). id M = blok utama (model). */
export const BLOCKS = Object.freeze([
  Object.freeze({ id: 'M', xc: 0, z0: -200, z1: 200, main: true }),
  Object.freeze({ id: 'W', xc: -300, z0: -200, z1: 200, main: false }),
  Object.freeze({ id: 'S', xc: 0, z0: WORLD.southEndZ, z1: WORLD.southStartZ, main: false }),
  Object.freeze({ id: 'SW', xc: -300, z0: WORLD.southEndZ, z1: WORLD.southStartZ, main: false }),
]);

/** Blok di posisi (X, Z), atau null (jalan, sungai, hutan). */
export function blockAt(X, Z) {
  if (X < -451.2 || X > 151.2) return null;
  const inNorth = Z >= -200 && Z <= 200;
  const inSouth = Z >= WORLD.southEndZ && Z <= WORLD.southStartZ;
  if (!inNorth && !inSouth) return null;
  const xc = X < -150 ? -300 : 0;
  if (inNorth) return xc === 0 ? BLOCKS[0] : BLOCKS[1];
  return xc === 0 ? BLOCKS[2] : BLOCKS[3];
}

// ---------- kisi sawit (segitiga 8,5 m) ----------

export const PALM = Object.freeze({
  spacing: 8.5,
  rowSpacing: (8.5 * Math.sqrt(3)) / 2, // 7,361 m antar-baris
  zOffset: 2.125, // geser agar tidak ada pohon tepat di bidang potong z = 0
  buffer: 6, // jarak minimum dari saluran (koleksi & parit lapangan)
  edgeBuffer: 4, // jarak dari ujung blok (jalan)
  piringanR: 1.75, // jari-jari piringan (Ø 3,5 m)
  halfWidth: 150,
});

const mod2 = (r) => ((r % 2) + 2) % 2;

/** Baris tanam (indeks r) yang muat di blok: |X − xc| ≤ halfWidth − buffer. */
export function palmRows(p = PALM) {
  const lim = p.halfWidth - p.buffer;
  const r0 = Math.ceil(-lim / p.rowSpacing - 0.5);
  const r1 = Math.floor(lim / p.rowSpacing - 0.5);
  return { r0, r1 };
}

/**
 * Posisi sawit di satu blok: [{X, Z, row}], diurutkan menurut Z (untuk cutaway: count = jumlah Z ≤ 0).
 * Baris sejajar Z di X = xc + (r + ½)·rowSpacing; dalam baris Z = zOffset + (r ganjil ? ½·spacing : 0) + k·spacing.
 * Pohon dilewati bila < buffer dari parit lapangan, atau di luar [z0 + edgeBuffer, z1 − edgeBuffer].
 */
export function palmLattice(block, { fdSpacing = 59, p = PALM } = {}) {
  const out = [];
  const { r0, r1 } = palmRows(p);
  const zLo = block.z0 + p.edgeBuffer;
  const zHi = block.z1 - p.edgeBuffer;
  for (let r = r0; r <= r1; r++) {
    const X = block.xc + (r + 0.5) * p.rowSpacing;
    const zo = p.zOffset + mod2(r) * (p.spacing / 2);
    const k0 = Math.ceil((zLo - zo) / p.spacing);
    const k1 = Math.floor((zHi - zo) / p.spacing);
    for (let k = k0; k <= k1; k++) {
      const Z = zo + k * p.spacing;
      if (fieldDrainDistance(Z, fdSpacing) < p.buffer) continue;
      out.push({ X, Z, row: r });
    }
  }
  out.sort((a, b) => a.Z - b.Z || a.X - b.X);
  return out;
}

/** Jumlah elemen dengan Z ≤ zCut pada larik terurut menurut Z. */
export function countAtOrBelow(sortedZ, zCut) {
  let lo = 0;
  let hi = sortedZ.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedZ[mid] <= zCut) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Gawangan: titik tengah antar-baris m·rowSpacing; m genap = pasar pikul, m ganjil = gawangan mati (tumpukan pelepah). */
export function interRowKind(m) {
  return mod2(m) === 0 ? 'pasar-pikul' : 'gawangan-mati';
}

// ---------- instrumen ----------

/** Posisi piezometer dari parameter model (sisi barat, di depan bidang potong). */
export function piezometerPositions(params) {
  return params.piezometers.map((p) => ({ id: p.id, x: p.x, X: sceneXFromModel(p.x, -1, params.geom.Lh), Z: WORLD.instrumentZ }));
}

/** Papan duga: G2 di saluran A (penampang), G1 di hulu pintu air. */
export function gaugePositions() {
  return [
    { id: 'G2', X: -149.15, Z: WORLD.instrumentZ - 0.1, facing: 'z' },
    { id: 'G1', X: WORLD.gateX - 3.4, Z: WORLD.mainZ - 1.2, facing: 'z' },
  ];
}

/** Titik yang mikro-reliefnya dibuat nol (piezometer & papan duga) agar visual konsisten dengan model. */
export function reliefZeroSpots(params) {
  return [...piezometerPositions(params).map((p) => [p.X, p.Z * 0.5]), ...gaugePositions().map((g) => [g.X, g.Z])];
}

// ---------- kamera ----------

/** Preset kamera pada VE ×10 (y target diskalakan dengan VE). fitW = lebar adegan (m) yang harus muat. */
export const CAMERA_PRESETS = Object.freeze({
  // target dekat permukaan (bukan di bawah tanah) agar zoom roda tidak menembus tanah
  ikhtisar: Object.freeze({ pos: [-175, 150, 240], target: [-5, -5, -45], fov: 45, fitW: 330 }),
  // kamera tepat di bawah lantai potongan (lantai tidak terlihat); target dinaikkan agar penampang lebih ke tengah bingkai
  penampang: Object.freeze({ pos: [-84, -55.3, 200], target: [-84, -26, 0], fov: 35, fitW: 206, cutaway: true, scaleOffY: true }),
  // dilihat serong dari hulu-samping (±45°) agar muka papan stoplog dan luapan di atas mercu terlihat
  'pintu-air': Object.freeze({ pos: [172, 16, -201], target: [198, -12, -225], fov: 48, fitW: 52, scaleOff: true }),
  atas: Object.freeze({ pos: [20, 520, -19], target: [20, 0, -20], fov: 45, fitW: 420, cut: Object.freeze({ pos: [40, 380, -104], target: [40, 0, -105] }) }),
});

/**
 * Pose kamera untuk preset pada VE dan rasio aspek tertentu. Jarak diperbesar bila viewport sempit
 * supaya lebar `fitW` tetap terlihat. Murni (dites di Node).
 */
export function presetPose(id, ve = 10, aspect = 1.6, cutaway = true) {
  const p = CAMERA_PRESETS[id] ?? CAMERA_PRESETS.ikhtisar;
  const s = ve / 10;
  const q = cutaway && p.cut ? p.cut : p;
  const target = [q.target[0], q.target[1] * s, q.target[2]];
  const k = p.scaleOff ? Math.sqrt(s) : 1; // pandangan pintu air mundur/maju mengikuti tinggi struktur (VE)
  const off = [(q.pos[0] - q.target[0]) * k, (q.pos[1] - q.target[1]) * (p.scaleOffY ? s : k), (q.pos[2] - q.target[2]) * k];
  const dist = Math.hypot(off[0], off[1], off[2]);
  const halfV = ((p.fov * Math.PI) / 180) / 2;
  const visW = 2 * dist * Math.tan(halfV) * aspect;
  const f = Math.min(Math.max((p.fitW * k) / visW, 1), 2.4);
  const pos = [target[0] + off[0] * f, target[1] + off[1] * f, target[2] + off[2] * f];
  return { pos, target, fov: p.fov, cutaway: !!p.cutaway };
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
