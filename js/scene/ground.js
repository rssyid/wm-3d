// Fungsi elevasi & jenis permukaan diorama (murni, tanpa three/DOM; dites di Node).
// Satu fungsi untuk semua mesh terrain dan penampang, supaya tepi antar-patch dan bidang potong selalu cocok.
// Elevasi dalam meter sebenarnya (sebelum eksagerasi vertikal); y = 0 = tanggul saluran koleksi.

import { surfaceAt } from '../model/params.js';
import { fbm2, smoothstep } from './noise.js';
import {
  SEED,
  WORLD,
  RIVER,
  riverCenterX,
  channelSpecs,
  COLLECTION_X,
  fieldDrainDistance,
  blockAt,
  reliefZeroSpots,
} from './layout.js';

/** Jenis permukaan (warna dasar dipilih di terrain.js). */
export const KIND = Object.freeze({ cover: 0, grass: 1, road: 2, peat: 3, mud: 4, forest: 5 });

/** Amplitudo mikro-relief (m): blok utama ±8 cm (hummock gambut), tetangga & lainnya lebih kecil. */
export const RELIEF = Object.freeze({ main: 0.08, block: 0.06, grass: 0.035, forest: 0.06 });

export function makeGroundCtx(params) {
  return {
    geom: params.geom,
    Lh: params.geom.Lh,
    ch: channelSpecs(params),
    zero: reliefZeroSpots(params),
    relief: true,
  };
}

/** Kubah gambut blok di kolom X (0 di luar kolom blok). */
export function domeAt(X, ctx) {
  if (X < -451.2 || X > 151.2) return 0;
  const xc = X < -150 ? -300 : 0;
  const x = ctx.Lh - Math.abs(X - xc);
  return surfaceAt(x < 0 ? 0 : x, ctx.geom);
}

/** Mikro-relief ber-seed (≈ [−1, 1]) — hummock 9 m + 4,5 m. */
export function reliefNoise(X, Z) {
  const n = fbm2(X / 9.3, Z / 9.3, SEED, 2) * 1.45;
  return n < -1 ? -1 : n > 1 ? 1 : n;
}

function trenchAbs(d, bed, b, m) {
  return bed + Math.max(0, d - b / 2) / m;
}

/** Profil jalan di atas tanggul (0 di luar). zs = [bahu, puncak, puncak, bahu]. */
function roadProfile(Z, zs, top) {
  if (Z <= zs[0] || Z >= zs[3]) return -Infinity;
  if (Z < zs[1]) return (top * (Z - zs[0])) / (zs[1] - zs[0]);
  if (Z > zs[2]) return (top * (zs[3] - Z)) / (zs[3] - zs[2]);
  return top;
}

/**
 * Elevasi dan jenis permukaan di (X, Z).
 * out: {h (m), surf (permukaan alami tanpa galian), kind, planted (0/1), wet (0/1), trench (0/1)}.
 */
export function groundAt(X, Z, ctx, out = {}) {
  const ch = ctx.ch;
  const E = WORLD.extent;
  let base = 0;
  let kind = KIND.grass;
  let planted = 0;
  let wet = 0;
  let amp = RELIEF.grass;
  let mask = 1;

  const blk = blockAt(X, Z);
  const xcR = riverCenterX(Z);
  const dR = Math.abs(X - xcR);
  if (blk) {
    base = domeAt(X, ctx);
    kind = KIND.cover;
    planted = 1;
    wet = 1;
    amp = blk.main ? RELIEF.main : RELIEF.block;
    const dz = Math.min(Z - blk.z0, blk.z1 - Z);
    mask *= smoothstep(0, 4, dz);
  } else if (X >= -451.2 && X <= 151.2) {
    // transisi kubah → jalan di luar ujung blok
    const dome = domeAt(X, ctx);
    let t = 0;
    if (Z > 200 && Z < 206) t = 1 - (Z - 200) / 6;
    else if (Z < -200 && Z > -206) t = 1 - (-200 - Z) / 6;
    else if (Z > WORLD.southStartZ && Z < WORLD.southStartZ + 6) t = 1 - (Z - WORLD.southStartZ) / 6;
    else if (Z < WORLD.southEndZ && Z > WORLD.southEndZ - 6) t = 1 - (WORLD.southEndZ - Z) / 6;
    base = dome * Math.max(0, Math.min(1, t));
  } else if (X > xcR + RIVER.halfTop) {
    kind = KIND.forest;
    amp = RELIEF.forest;
  }
  // tanggul alami sungai
  if (dR > RIVER.halfTop && dR < RIVER.halfTop + 14) base += RIVER.levee * (1 - (dR - RIVER.halfTop) / 14);

  // masker relief: nol di dekat saluran, instrumen, sungai, jalan, dan tepi diorama
  for (let i = 0; i < COLLECTION_X.length; i++) {
    const d = Math.abs(X - COLLECTION_X[i]);
    if (d < 4) mask *= smoothstep(ch.collection.halfTop + 0.2, ch.collection.halfTop + 2.6, d);
  }
  if (blk && ch.field.enabled) {
    const dz = fieldDrainDistance(Z, ch.field.spacing);
    if (dz < 3) mask *= smoothstep(ch.field.halfTop + 0.1, 2.6, dz);
  }
  const dMain = Math.abs(Z - WORLD.mainZ);
  if (dMain < 14) mask *= smoothstep(ch.main.halfTop + 0.3, 14, dMain);
  if (dR < RIVER.halfTop + 6) mask *= smoothstep(RIVER.halfTop, RIVER.halfTop + 6, dR);
  const zero = ctx.zero;
  for (let i = 0; i < zero.length; i++) {
    const dx = X - zero[i][0];
    const dz = Z - zero[i][1];
    const d2 = dx * dx + dz * dz;
    if (d2 < 16) mask *= smoothstep(1.0, 4.0, Math.sqrt(d2));
  }
  for (let i = 0; i < WORLD.seamX.length; i++) {
    const d = Math.abs(X - WORLD.seamX[i]);
    if (d < 2.5) mask *= smoothstep(0, 2.5, d);
  }
  const dEdge = Math.min(X - E.xMin, E.xMax - X, Z - E.zMin, E.zMax - Z);
  if (dEdge < 12) mask *= smoothstep(0, 12, dEdge);

  const surf = base + (ctx.relief && mask > 0 ? amp * mask * reliefNoise(X, Z) : 0);
  let h = surf;

  // ---- galian: saluran koleksi, parit lapangan, saluran utama, outlet, sungai ----
  const c = ch.collection;
  if (Z < WORLD.northRoadZ[1]) {
    for (let i = 0; i < COLLECTION_X.length; i++) {
      const d = Math.abs(X - COLLECTION_X[i]);
      if (d < c.halfTop + 0.5) {
        const t = trenchAbs(d, c.bed, c.b, c.m);
        if (t < h) h = t;
      }
    }
  }
  if (blk && ch.field.enabled && Math.abs(X - blk.xc) <= ctx.Lh - c.halfTop + 0.2) {
    const f = ch.field;
    const dz = fieldDrainDistance(Z, f.spacing);
    if (dz < f.halfTop) {
      const depth = dz <= f.b / 2 ? f.depth : (f.depth * (f.halfTop - dz)) / (f.halfTop - f.b / 2);
      const t = surf - depth;
      if (t < h) h = t;
    }
  }
  const m = ch.main;
  if (X <= WORLD.gateX + 0.4 && dMain < m.halfTop + 0.5) {
    const t = trenchAbs(dMain, m.bed, m.b, m.m);
    if (t < h) h = t;
  }
  const xOutEnd = riverCenterX(WORLD.mainZ) - RIVER.halfBottom;
  if (X > WORLD.gateX - 0.4 && X < xOutEnd && dMain < 3.5) {
    const o = ch.outfall;
    const u = Math.min(Math.max((X - WORLD.gateX) / (xOutEnd - WORLD.gateX), 0), 1);
    const bed = o.bed + (o.bedEnd - o.bed) * u;
    const t = trenchAbs(dMain, bed, o.b, o.m);
    if (t < h) h = t;
  }
  if (dR < RIVER.halfTop + 0.5) {
    const t = dR <= RIVER.halfBottom ? RIVER.bed : RIVER.bed + ((dR - RIVER.halfBottom) * -RIVER.bed) / (RIVER.halfTop - RIVER.halfBottom);
    if (t < h) h = t;
  }
  const trench = h < surf - 0.04 ? 1 : 0;
  if (trench) {
    kind = dR < RIVER.halfTop + 0.5 ? KIND.mud : KIND.peat;
    planted = 0;
  }

  // ---- jalan di atas tanggul (menutup saluran koleksi dengan gorong-gorong) ----
  if (X < WORLD.gateX - 4) {
    let rp = roadProfile(Z, WORLD.roadZ, WORLD.roadTop);
    if (rp > -Infinity) {
      const taper = Math.min(1, (WORLD.gateX - 4 - X) / 6);
      rp *= taper;
      if (rp > h - 0.001) {
        h = Math.max(h, rp);
        kind = Z > WORLD.roadZ[1] && Z < WORLD.roadZ[2] && taper > 0.5 ? KIND.road : KIND.grass;
        planted = 0;
      }
    }
    rp = roadProfile(Z, WORLD.northRoadZ, WORLD.northRoadTop);
    if (rp > -Infinity && X < WORLD.gateX) {
      if (rp > h - 0.001) {
        h = Math.max(h, rp);
        kind = Z > WORLD.northRoadZ[1] && Z < WORLD.northRoadZ[2] ? KIND.road : KIND.grass;
        planted = 0;
      }
    }
  }

  out.h = h;
  out.surf = surf;
  out.kind = kind;
  out.planted = planted;
  out.wet = wet && !trench ? 1 : 0;
  out.trench = trench;
  return out;
}

/** Elevasi saja (m). */
export function heightAt(X, Z, ctx) {
  return groundAt(X, Z, ctx, _tmp).h;
}
const _tmp = {};

// ---------- sumbu grid (rectilinear) ----------

/**
 * Koordinat terurut unik dari rentang [a, b] dengan langkah `step` + titik patah `breaks`.
 * Titik grid yang terlalu dekat (< 0,3·step) dengan titik patah dibuang agar tidak ada segitiga tipis.
 */
export function gridAxis(a, b, step, breaks = []) {
  const bs = breaks.filter((v) => v > a + 1e-6 && v < b - 1e-6).sort((p, q) => p - q);
  const out = [a];
  const n = Math.max(1, Math.round((b - a) / step));
  const st = (b - a) / n;
  for (let i = 1; i < n; i++) {
    const v = a + i * st;
    let near = false;
    for (const q of bs) {
      if (Math.abs(q - v) < 0.3 * st) {
        near = true;
        break;
      }
    }
    if (!near) out.push(v);
  }
  out.push(...bs, b);
  out.sort((p, q) => p - q);
  const uniq = [];
  for (const v of out) if (!uniq.length || v - uniq[uniq.length - 1] > 1e-6) uniq.push(v);
  return Float64Array.from(uniq);
}

/** Titik patah X untuk saluran koleksi. */
export function collectionBreaks(ch, xs = COLLECTION_X) {
  const c = ch.collection;
  const out = [];
  for (const x of xs) out.push(x - c.halfTop, x - c.b / 2, x, x + c.b / 2, x + c.halfTop);
  return out;
}

/** Titik patah Z untuk parit lapangan di rentang [z0, z1]. */
export function fieldBreaks(ch, z0, z1) {
  const f = ch.field;
  const out = [];
  if (!f.enabled) return out;
  const s = f.spacing;
  for (let k = Math.ceil((z0 - s / 2) / s) - 1; ; k++) {
    const z = s / 2 + k * s;
    if (z > z1 + s) break;
    out.push(z - f.halfTop, z - f.b / 2, z, z + f.b / 2, z + f.halfTop);
  }
  return out;
}

/** Titik patah Z untuk saluran utama, jalan, ujung blok, dan bidang potong. */
export function commonZBreaks(ch) {
  const m = ch.main;
  return [
    WORLD.mainZ - m.halfTop,
    WORLD.mainZ - m.b / 2,
    WORLD.mainZ,
    WORLD.mainZ + m.b / 2,
    WORLD.mainZ + m.halfTop,
    ...WORLD.roadZ,
    ...WORLD.northRoadZ,
    -200,
    200,
    WORLD.southStartZ,
    0,
  ];
}
