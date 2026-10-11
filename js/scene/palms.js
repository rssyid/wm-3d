// Kelapa sawit: batang meruncing bertonjolan pangkal pelepah, 20–24 pelepah melengkung (strip bertekstur anak daun,
// alpha-test), tandan buah (TBS), 3 varian umur, rotasi/kemiringan/skala ber-seed. InstancedMesh per bagian.
// Blok tetangga (dan semua pohon pada kualitas "rendah") memakai LOD sederhana. Bayangan memakai proksi mahkota datar.
// Ukuran sebenarnya (tidak ikut VE), diletakkan di permukaan terrain yang diskalakan.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BLOCKS, palmLattice, countAtOrBelow, PALM, interRowKind, piezometerPositions, fieldDrainDistance } from './layout.js';
import { heightAt } from './ground.js';
import { hash2, mulberry32 } from './noise.js';
import { PALETTE } from './palette.js';
import { frondTexture, trunkTexture, lodAtlasTexture, crownStarTexture, stackTexture } from './textures.js';

/** Varian umur: tinggi batang (m), panjang & lebar pelepah, jumlah pelepah, segmen. */
export const VARIANTS = Object.freeze([
  Object.freeze({ id: 'muda', trunk: 2.2, n: 20, L: 4.4, W: 1.15, segs: 3, droop: [22, 55], rTrunk: 0.36 }),
  Object.freeze({ id: 'remaja', trunk: 4.8, n: 22, L: 6.0, W: 1.45, segs: 3, droop: [26, 66], rTrunk: 0.4 }),
  Object.freeze({ id: 'dewasa', trunk: 7.6, n: 24, L: 6.9, W: 1.6, segs: 3, droop: [28, 74], rTrunk: 0.42 }),
]);

const _v = new THREE.Vector3();
const _t = new THREE.Vector3();
const _l = new THREE.Vector3();
const _n = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Geometri mahkota: n pelepah sebagai strip melengkung (pangkal → ujung), filotaksis sudut emas.
 * uv.x = sepanjang pelepah, uv.y = melintang dipetakan ke [v0, v1] (atlas).
 */
export function crownGeometry({ n, L, W, segs, droop, seed = 1, v0 = 0, v1 = 1, spear = false }) {
  const rnd = mulberry32(seed);
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const us = segs === 4 ? [0, 0.22, 0.48, 0.75, 1] : segs === 3 ? [0, 0.3, 0.64, 1] : [0, 0.45, 1];
  const width = (u) => {
    if (u < 0.3) return 0.12 + (0.88 * u) / 0.3;
    if (u < 0.7) return 1 - (0.15 * (u - 0.3)) / 0.4;
    return 0.85 - (0.65 * (u - 0.7)) / 0.3;
  };
  const fronds = [];
  for (let i = 0; i < n; i++) fronds.push({ i, age: n > 1 ? i / (n - 1) : 0.5 });
  if (spear) fronds.push({ i: -1, age: -0.15 }, { i: -2, age: -0.1 });
  for (const f of fronds) {
    const age = Math.max(0, f.age);
    const phi = f.i * 2.39996323 + seed * 0.7 + (rnd() - 0.5) * 0.25;
    const th0 = ((f.i < 0 ? 84 : 70 - 78 * age) + (rnd() - 0.5) * 10) * (Math.PI / 180);
    const dth = ((f.i < 0 ? 4 : droop[0] + (droop[1] - droop[0]) * age) + (rnd() - 0.5) * 10) * (Math.PI / 180);
    const len = L * (f.i < 0 ? 0.55 : 0.78 + 0.22 * Math.min(1, age * 2.2)) * (0.92 + 0.16 * rnd());
    const wid = W * (f.i < 0 ? 0.25 : 0.9 + 0.2 * rnd());
    const roll = (rnd() - 0.5) * 0.9;
    const dir = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
    const lat0 = new THREE.Vector3(-Math.sin(phi), 0, Math.cos(phi));
    const base = new THREE.Vector3(dir.x * 0.22, -0.75 * age, dir.z * 0.22);
    // integrasi rakis
    const steps = 24;
    const ds = len / steps;
    const pts = [base.clone()];
    const tans = [];
    const p = base.clone();
    for (let k = 0; k < steps; k++) {
      const s = (k + 0.5) / steps;
      const th = th0 - dth * Math.pow(s, 1.5);
      _t.set(dir.x * Math.cos(th), Math.sin(th), dir.z * Math.cos(th));
      p.addScaledVector(_t, ds);
      pts.push(p.clone());
      tans.push(_t.clone());
    }
    tans.push(tans[tans.length - 1].clone());
    const vb = pos.length / 3;
    for (const u of us) {
      const k = Math.round(u * steps);
      const P = pts[k];
      const T = tans[Math.min(k, steps)];
      // lateral diputar (roll) sekitar tangen
      _l.copy(lat0).applyAxisAngle(T, roll * u);
      const hw = (wid * width(u)) / 2;
      // normal: tegak lurus strip, dicondongkan ke atas agar pencahayaan dua sisi konsisten
      _n.crossVectors(_l, T).normalize();
      if (_n.y < 0) _n.negate();
      _n.add(UP).normalize();
      for (const side of [1, -1]) {
        _v.copy(P).addScaledVector(_l, side * hw);
        pos.push(_v.x, _v.y, _v.z);
        nor.push(_n.x, _n.y, _n.z);
        uv.push(u, side > 0 ? v0 : v1);
      }
    }
    for (let s = 0; s < us.length - 1; s++) {
      const L0 = vb + s * 2;
      const R0 = L0 + 1;
      const L1 = L0 + 2;
      const R1 = L0 + 3;
      idx.push(L0, L1, R0, R0, L1, R1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Batang satuan (tinggi 1, pangkal di y = 0) dengan tonjolan pangkal pelepah. */
export function trunkGeometry(radial = 6, hseg = 3, rTop = 0.78, flare = 1.25) {
  const g = new THREE.CylinderGeometry(rTop, 1, 1, radial, hseg, true);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const bump = 1 + 0.07 * Math.sin(a * 3 + y * 19) + 0.05 * Math.sin(a * 5 - y * 31);
    const base = 1 + (flare - 1) * Math.max(0, 1 - y * 6);
    p.setXYZ(i, x * bump * base, y, z * bump * base);
  }
  g.computeVertexNormals();
  return g;
}

/** Dua tandan buah (TBS) di ketiak pelepah, di bawah pangkal mahkota. */
export function bunchGeometry() {
  const parts = [];
  for (const [a, y, s] of [
    [0.6, -0.95, 1],
    [3.4, -1.2, 0.85],
  ]) {
    const g = new THREE.OctahedronGeometry(0.34 * s, 0);
    g.scale(1, 1.3, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const j = 1 + 0.22 * Math.sin(i * 12.9898 + a);
      p.setXYZ(i, p.getX(i) * j, p.getY(i) * j, p.getZ(i) * j);
    }
    g.translate(Math.cos(a) * 0.4, y, Math.sin(a) * 0.4);
    parts.push(g);
  }
  const m = mergeGeometries(parts);
  m.computeVertexNormals();
  return m;
}

/** LOD: batang 4 sisi + 6 pelepah 2 segmen, uv dalam atlas (pelepah v 0,5–1, batang v 0–0,5). */
export function lodGeometry() {
  const crown = crownGeometry({ n: 5, L: 5.8, W: 1.9, segs: 2, droop: [30, 70], seed: 4, v0: 0.5, v1: 1, spear: false });
  crown.translate(0, 4.8, 0);
  const trunk = new THREE.CylinderGeometry(0.3, 0.42, 4.9, 3, 1, true);
  trunk.translate(0, 2.45, 0);
  const uv = trunk.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.45);
  const nonIdx = [crown.toNonIndexed(), trunk.toNonIndexed()];
  for (const g of nonIdx) {
    if (!g.attributes.normal) g.computeVertexNormals();
  }
  return mergeGeometries(nonIdx);
}

/** Gundukan memanjang tumpukan pelepah (panjang 1 sepanjang Z, lebar 1, tinggi 1; diskalakan per instance). */
export function stackGeometry() {
  const prof = [
    [-0.5, 0],
    [-0.36, 0.55],
    [0, 1],
    [0.36, 0.55],
    [0.5, 0],
  ];
  const pos = [];
  const uv = [];
  const idx = [];
  for (const z of [-0.5, 0.5]) {
    prof.forEach(([x, y], i) => {
      const taper = 1;
      pos.push(x * taper, y, z);
      uv.push(i / 4, z + 0.5);
    });
  }
  for (let i = 0; i < 4; i++) idx.push(i, i + 6, i + 1, i, i + 5, i + 6);
  // tutup ujung
  const capBase = pos.length / 3;
  for (const z of [-0.5, 0.5]) {
    for (const [x, y] of prof) {
      pos.push(x * 0.7, y * 0.7, z * 1.08);
      uv.push(x + 0.5, y);
    }
  }
  for (const [o, flip] of [
    [capBase, true],
    [capBase + 5, false],
  ]) {
    for (let i = 1; i < 4; i++) {
      if (flip) idx.push(o, o + i + 1, o + i);
      else idx.push(o, o + i, o + i + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Daun dua sisi tanpa pembalikan normal di sisi belakang: normal pelepah sudah condong ke atas, jadi kedua sisi
 * diterangi seperti tajuk (tidak hitam saat dilihat dari bawah).
 */
function foliage(mat, key) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.74;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

/** Varian per blok: blok utama campuran (sisipan muda, sebagian tua), tetangga berbeda umur. */
function pickVariant(blockId, X, Z) {
  const h = hash2(Math.round(X * 10), Math.round(Z * 10), 77);
  if (blockId === 'M') return h < 0.1 ? 0 : h < 0.32 ? 2 : 1;
  if (blockId === 'W') return h < 0.85 ? 2 : 1;
  if (blockId === 'S') return h < 0.8 ? 0 : 1;
  return h < 0.85 ? 1 : 2;
}

/** Data pohon (murni-ish): posisi, varian, yaw, kemiringan, skala, untuk satu atau lebih blok. */
export function palmRecords(blocks, fdSpacing) {
  const out = [];
  for (const b of blocks) {
    for (const p of palmLattice(b, { fdSpacing })) {
      const rnd = mulberry32((Math.round(p.X * 100) * 73856093) ^ (Math.round(p.Z * 100) * 19349663) ^ 7);
      out.push({
        X: p.X,
        Z: p.Z,
        block: b.id,
        variant: pickVariant(b.id, p.X, p.Z),
        yaw: rnd() * Math.PI * 2,
        leanDir: rnd() * Math.PI * 2,
        lean: rnd() * 0.07,
        s: 0.9 + rnd() * 0.2,
        tint: rnd(),
      });
    }
  }
  out.sort((a, b) => a.Z - b.Z || a.X - b.X);
  return out;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qy = new THREE.Quaternion();
const _ql = new THREE.Quaternion();
const _ax = new THREE.Vector3();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

function orient(r) {
  _qy.setFromAxisAngle(UP, r.yaw);
  _ax.set(Math.cos(r.leanDir), 0, Math.sin(r.leanDir));
  _ql.setFromAxisAngle(_ax, r.lean);
  return _q.multiplyQuaternions(_ql, _qy);
}

/**
 * Membuat semua mesh sawit. Kembalian: {group, place(ve), setCutaway(on), setQuality(q), counts(), dispose()}.
 */
export function createPalms(ctx, params, { quality = 'tinggi' } = {}) {
  const group = new THREE.Group();
  group.name = 'palms';
  const fdSpacing = params.fieldDrains.spacing;
  const main = palmRecords([BLOCKS[0]], fdSpacing);
  const nb = palmRecords(BLOCKS.slice(1), fdSpacing);
  for (const r of main) r.h = heightAt(r.X, r.Z, ctx);
  for (const r of nb) r.h = heightAt(r.X, r.Z, ctx);

  const texFrond = frondTexture();
  const texTrunk = trunkTexture();
  texTrunk.repeat.set(2, 1);
  const texLod = lodAtlasTexture();
  const texStar = crownStarTexture();
  const texStack = stackTexture();

  const frondMat = foliage(new THREE.MeshLambertMaterial({ map: texFrond, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide }), 'wm-frond');
  const trunkMat = new THREE.MeshLambertMaterial({ map: texTrunk });
  trunkMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace(
      '#include <uv_vertex>',
      '#include <uv_vertex>\n#ifdef USE_INSTANCING\n vMapUv.y *= length(instanceMatrix[1].xyz) * 0.55;\n#endif',
    );
  };
  trunkMat.customProgramCacheKey = () => 'wm-trunk';
  const bunchMat = new THREE.MeshLambertMaterial({ color: PALETTE.bunch, emissive: 0x160500, flatShading: true });
  const lodMat = foliage(new THREE.MeshLambertMaterial({ map: texLod, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide }), 'wm-frond-lod');
  const proxyMat = new THREE.MeshBasicMaterial({ map: texStar, alphaTest: 0.5, colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
  const stackMat = new THREE.MeshLambertMaterial({ map: texStack, color: 0xb8ad8a, side: THREE.DoubleSide });

  const byVar = [0, 1, 2].map((v) => main.filter((r) => r.variant === v));
  const crownGeos = VARIANTS.map((v, i) => crownGeometry({ ...v, seed: 11 + i * 5, spear: i === 0 }));
  const crowns = crownGeos.map((g, i) => {
    const m = new THREE.InstancedMesh(g, frondMat, Math.max(1, byVar[i].length));
    m.name = `sawit-mahkota-${VARIANTS[i].id}`;
    return m;
  });
  const trunks = new THREE.InstancedMesh(trunkGeometry(), trunkMat, main.length);
  trunks.name = 'sawit-batang';
  const bunches = new THREE.InstancedMesh(bunchGeometry(), bunchMat, main.length);
  bunches.name = 'sawit-tandan';
  const lodGeo = lodGeometry();
  const lodMain = new THREE.InstancedMesh(lodGeo, lodMat, main.length);
  lodMain.name = 'sawit-lod-utama';
  const lodNb = new THREE.InstancedMesh(lodGeo, lodMat, nb.length);
  lodNb.name = 'sawit-lod-tetangga';
  const all = [...main, ...nb].sort((a, b) => a.Z - b.Z);
  const proxyGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const proxy = new THREE.InstancedMesh(proxyGeo, proxyMat, all.length);
  proxy.name = 'sawit-bayangan';
  proxy.castShadow = true;
  proxy.frustumCulled = false;

  // gawangan mati: tumpukan pelepah di antar-baris ganjil (blok utama)
  const stacks = [];
  const pz = piezometerPositions(params);
  for (let m = -20; m <= 20; m++) {
    if (interRowKind(m) !== 'gawangan-mati') continue;
    const X = m * PALM.rowSpacing;
    if (Math.abs(X) > PALM.halfWidth - PALM.buffer) continue;
    for (let k = -24; k <= 24; k++) {
      const Z = PALM.zOffset + 2.125 + k * PALM.spacing;
      if (Math.abs(Z) > 192) continue;
      if (fieldDrainDistance(Z, fdSpacing) < 6) continue;
      if (pz.some((p) => Math.hypot(p.X - X, p.Z - Z) < 7)) continue;
      const h = hash2(m, k, 5);
      stacks.push({ X: X + (h - 0.5) * 0.5, Z, len: 6.6 + 1.2 * h, wid: 1.5 + 0.6 * hash2(k, m, 6), hgt: 0.45 + 0.3 * hash2(m + 3, k, 8), h: heightAt(X, Z, ctx) });
    }
  }
  stacks.sort((a, b) => a.Z - b.Z);
  const stackMesh = new THREE.InstancedMesh(stackGeometry(), stackMat, Math.max(1, stacks.length));
  stackMesh.name = 'gawangan-mati';

  const meshes = [...crowns, trunks, bunches, lodMain, lodNb, proxy, stackMesh];
  for (const m of meshes) {
    m.matrixAutoUpdate = false;
    group.add(m);
  }
  for (const m of [...crowns, trunks, bunches, lodMain, lodNb, stackMesh]) m.frustumCulled = false;

  // warna instance (variasi hijau)
  byVar.forEach((list, i) => {
    list.forEach((r, j) => {
      _c.setHSL(0.24 + 0.05 * (r.tint - 0.5), 0.35, 0.82 + 0.18 * r.tint);
      crowns[i].setColorAt(j, _c);
    });
  });
  nb.forEach((r, j) => {
    _c.setHSL(0.24 + 0.05 * (r.tint - 0.5), 0.3, 0.78 + 0.2 * r.tint);
    lodNb.setColorAt(j, _c);
  });
  main.forEach((r, j) => {
    _c.setHSL(0.24 + 0.05 * (r.tint - 0.5), 0.3, 0.8 + 0.2 * r.tint);
    lodMain.setColorAt(j, _c);
  });

  const zsVar = byVar.map((l) => Float64Array.from(l, (r) => r.Z));
  const zsMain = Float64Array.from(main, (r) => r.Z);
  const zsNb = Float64Array.from(nb, (r) => r.Z);
  const zsAll = Float64Array.from(all, (r) => r.Z);
  const zsStack = Float64Array.from(stacks, (r) => r.Z);

  let curQuality = quality;
  let cut = true;

  function place(ve) {
    const lodScale = [0.55, 1.0, 1.3];
    byVar.forEach((list, vi) => {
      const V = VARIANTS[vi];
      list.forEach((r, j) => {
        const y = r.h * ve - 0.15;
        const q = orient(r);
        const H = V.trunk * r.s;
        _p.set(0, H, 0).applyQuaternion(q).add(_s.set(r.X, y, r.Z));
        _m.compose(_p, q, _v.set(r.s, r.s, r.s));
        crowns[vi].setMatrixAt(j, _m);
      });
    });
    main.forEach((r, j) => {
      const V = VARIANTS[r.variant];
      const y = r.h * ve - 0.15;
      const q = orient(r);
      const H = V.trunk * r.s;
      const rt = V.rTrunk * r.s;
      _m.compose(_p.set(r.X, y, r.Z), q, _s.set(rt, H, rt));
      trunks.setMatrixAt(j, _m);
      _p.set(0, H, 0).applyQuaternion(q).add(_v.set(r.X, y, r.Z));
      const bs = r.variant === 0 ? 0.75 : r.s;
      _m.compose(_p, q, _s.set(bs, bs, bs));
      bunches.setMatrixAt(j, _m);
      _qy.setFromAxisAngle(UP, r.yaw);
      const ls = lodScale[r.variant] * r.s;
      _m.compose(_p.set(r.X, y, r.Z), _qy, _s.set(ls, ls, ls));
      lodMain.setMatrixAt(j, _m);
    });
    nb.forEach((r, j) => {
      const y = r.h * ve - 0.15;
      _qy.setFromAxisAngle(UP, r.yaw);
      const ls = lodScale[r.variant] * r.s;
      _m.compose(_p.set(r.X, y, r.Z), _qy, _s.set(ls, ls, ls));
      lodNb.setMatrixAt(j, _m);
    });
    all.forEach((r, j) => {
      const isMain = r.block === 'M';
      const V = VARIANTS[r.variant];
      const top = (isMain ? V.trunk : 4.8 * lodScale[r.variant]) * r.s;
      const D = (isMain ? 1.55 * V.L : 1.55 * 5.8 * lodScale[r.variant]) * r.s;
      _qy.setFromAxisAngle(UP, r.yaw);
      _m.compose(_p.set(r.X, r.h * ve - 0.15 + top - 0.6, r.Z), _qy, _s.set(D, 1, D));
      proxy.setMatrixAt(j, _m);
    });
    stacks.forEach((r, j) => {
      _qy.setFromAxisAngle(UP, 0);
      _m.compose(_p.set(r.X, r.h * ve - 0.05, r.Z), _qy, _s.set(r.wid, r.hgt, r.len));
      stackMesh.setMatrixAt(j, _m);
    });
    for (const m of meshes) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    applyCounts();
  }

  function applyCounts() {
    const lim = (zs) => (cut ? countAtOrBelow(zs, 0) : zs.length);
    const hi = curQuality !== 'rendah';
    crowns.forEach((m, i) => {
      m.count = lim(zsVar[i]);
      m.visible = hi && m.count > 0;
    });
    trunks.count = lim(zsMain);
    bunches.count = trunks.count;
    trunks.visible = bunches.visible = hi && trunks.count > 0;
    lodMain.count = lim(zsMain);
    lodMain.visible = !hi && lodMain.count > 0;
    lodNb.count = lim(zsNb);
    lodNb.visible = lodNb.count > 0;
    proxy.count = lim(zsAll);
    proxy.visible = hi && proxy.count > 0;
    stackMesh.count = lim(zsStack);
    stackMesh.visible = stackMesh.count > 0;
  }

  return {
    group,
    meshes,
    counts: () => ({ main: main.length, neighbours: nb.length, stacks: stacks.length }),
    place,
    setCutaway(on) {
      cut = on;
      applyCounts();
    },
    setQuality(q) {
      curQuality = q;
      applyCounts();
    },
    dispose() {
      for (const m of meshes) {
        m.geometry.dispose();
        m.dispose?.();
      }
      for (const t of [texFrond, texTrunk, texLod, texStar, texStack]) t.dispose();
      for (const mt of [frondMat, trunkMat, bunchMat, lodMat, proxyMat, stackMat]) mt.dispose();
    },
  };
}
