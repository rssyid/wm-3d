// Air: prisma saluran (koleksi A/B + tetangga, saluran utama), parit lapangan, outlet, sungai, lembar genangan,
// dan tutup penampang air di bidang potong z = 0. Semua di hydroGroup (y = elevasi sebenarnya × VE oleh grup).
import * as THREE from 'three';
import { WORLD, RIVER, BLOCKS, COLLECTION_X, riverCenterX, riverHalfWidthAt, fieldDrainZs } from './layout.js';
import { groundAt } from './ground.js';
import { PALETTE } from './palette.js';
import { withBoxCut, GATE_BOX } from './cutbox.js';

/** Daftar saluran berdasar konstan: {axis:'x'|'z', c, a, b, bed, b0 (lebar dasar), m, halfTop, source}. */
export function channelList(ctx) {
  const ch = ctx.ch;
  const E = WORLD.extent;
  const out = [];
  for (const X of COLLECTION_X) {
    out.push({ id: `koleksi${X}`, axis: 'z', c: X, a: E.zMin, b: WORLD.northRoadZ[1], bed: ch.collection.bed, w0: ch.collection.b, m: ch.collection.m, halfTop: ch.collection.halfTop, cut: true });
  }
  out.push({ id: 'utama', axis: 'x', c: WORLD.mainZ, a: E.xMin, b: WORLD.gateX - 0.35, bed: ch.main.bed, w0: ch.main.b, m: ch.main.m, halfTop: ch.main.halfTop, cut: false });
  return out;
}

/** Parit lapangan (dasar mengikuti kubah): {zd, xs[], beds[]} per blok. */
export function fieldDrainList(ctx) {
  const ch = ctx.ch;
  if (!ch.field.enabled) return [];
  const out = [];
  const g = {};
  for (const b of BLOCKS) {
    for (const zd of fieldDrainZs(ch.field.spacing, b.z0, b.z1)) {
      const xs = [];
      const beds = [];
      const x0 = b.xc - 150 + ch.collection.halfTop - 0.3;
      const x1 = b.xc + 150 - ch.collection.halfTop + 0.3;
      const n = Math.max(2, Math.round((x1 - x0) / 6));
      for (let i = 0; i <= n; i++) {
        const X = x0 + ((x1 - x0) * i) / n;
        groundAt(X, zd, ctx, g);
        xs.push(X);
        beds.push(g.surf - ch.field.depth);
      }
      out.push({ zd, xs, beds, main: b.main });
    }
  }
  return out;
}

function waterMaterial(color, cutPlane, opts = {}) {
  return new THREE.MeshPhongMaterial({
    color,
    specular: 0x4a5a66,
    shininess: 70,
    clippingPlanes: cutPlane ? [cutPlane] : null,
    ...opts,
  });
}

/** Titik k prisma saluran: sepanjang sumbu (along) dan melintang (lat). */
function putCh(a, base, k, ch, along, lat, y) {
  const o = base + k * 3;
  if (ch.axis === 'z') {
    a[o] = ch.c + lat;
    a[o + 1] = y;
    a[o + 2] = along;
  } else {
    a[o] = along;
    a[o + 1] = y;
    a[o + 2] = ch.c + lat;
  }
}

function put3(a, o, x, y, z) {
  a[o] = x;
  a[o + 1] = y;
  a[o + 2] = z;
}

/** Empat titik (bawah-kiri, bawah-kanan, atas-kanan, atas-kiri) pada bidang z tetap. */
function quad(a, o, x0, y0, x1, y1, x2, y2, x3, y3, z) {
  put3(a, o, x0, y0, z);
  put3(a, o + 3, x1, y1, z);
  put3(a, o + 6, x2, y2, z);
  put3(a, o + 9, x3, y3, z);
}

/** Kolom j lembar genangan dari sel i: di muka air bila tergenang, selain itu jauh di bawah tanah (di bawah dasar parit). */
function setPond(a, j, pr, i) {
  const ponded = pr.z[i] > pr.zs[i] + 0.001;
  const y = ponded ? pr.z[i] : pr.zs[i] - 1.5;
  a[j * 6 + 1] = y;
  a[j * 6 + 4] = y;
}

export function createWater(ctx, cutPlane) {
  const group = new THREE.Group();
  group.name = 'air';
  const mat = withBoxCut(waterMaterial(PALETTE.water, cutPlane));
  const capMat = waterMaterial(PALETTE.water, null, { side: THREE.DoubleSide, emissive: 0x0d2533 });
  const riverMat = withBoxCut(waterMaterial(PALETTE.waterRiver, cutPlane));
  const pondMat = waterMaterial(PALETTE.pond, cutPlane, {
    transparent: true,
    opacity: 0.82,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  let channels = channelList(ctx);
  let cutChannels = channels.filter((c) => c.cut);
  let fds = fieldDrainList(ctx);

  // ---- prisma saluran + parit lapangan + outlet dalam satu geometri ----
  let geo;
  let pos;
  let nPrism = 0;
  let fdStart = 0;
  let outStart = 0;
  const outXs = [];
  const outBeds = [];
  function buildChannels() {
    channels = channelList(ctx);
    cutChannels = channels.filter((c) => c.cut);
    fds = fieldDrainList(ctx);
    outXs.length = 0;
    outBeds.length = 0;
    const xEnd = riverCenterX(WORLD.mainZ) - RIVER.halfBottom + 1;
    const g = {};
    for (let i = 0; i <= 8; i++) {
      const X = WORLD.gateX + 0.45 + ((xEnd - WORLD.gateX - 0.45) * i) / 8;
      outXs.push(X);
      groundAt(X, WORLD.mainZ, ctx, g);
      outBeds.push(g.h);
    }
    nPrism = channels.length;
    const vPrism = nPrism * 12;
    const vFd = fds.reduce((s, f) => s + f.xs.length * 2, 0);
    const vOut = outXs.length * 2;
    pos = new Float32Array((vPrism + vFd + vOut) * 3);
    const idx = [];
    for (let p = 0; p < nPrism; p++) {
      const b = p * 12;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3); // atas
      idx.push(b + 4, b + 5, b + 6, b + 4, b + 6, b + 7); // ujung a
      idx.push(b + 8, b + 10, b + 9, b + 8, b + 11, b + 10); // ujung b
    }
    fdStart = vPrism;
    let v = vPrism;
    for (const f of fds) {
      for (let i = 0; i < f.xs.length - 1; i++) {
        const a = v + i * 2;
        idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
      v += f.xs.length * 2;
    }
    outStart = v;
    for (let i = 0; i < outXs.length - 1; i++) {
      const a = v + i * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ng.setIndex(idx);
    const nor = new Float32Array(pos.length);
    for (let k = 1; k < nor.length; k += 3) nor[k] = 1;
    ng.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (geo) geo.dispose();
    geo = ng;
  }
  buildChannels();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'air-saluran';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  // ---- tutup penampang air di z = 0 (saluran koleksi + sungai) ----
  const capPos = new Float32Array((COLLECTION_X.length + 1) * 4 * 3);
  const capIdx = [];
  for (let i = 0; i < COLLECTION_X.length + 1; i++) {
    const b = i * 4;
    capIdx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const capGeo = new THREE.BufferGeometry();
  capGeo.setAttribute('position', new THREE.BufferAttribute(capPos, 3));
  const capNor = new Float32Array(capPos.length);
  for (let k = 2; k < capNor.length; k += 3) capNor[k] = 1;
  capGeo.setAttribute('normal', new THREE.BufferAttribute(capNor, 3));
  capGeo.setIndex(capIdx);
  const caps = new THREE.Mesh(capGeo, capMat);
  caps.name = 'air-penampang';
  caps.frustumCulled = false;

  // ---- sungai ----
  const E = WORLD.extent;
  const rZ = [];
  for (let Z = E.zMin; Z <= E.zMax + 1e-6; Z += 6) rZ.push(Z);
  const rPos = new Float32Array(rZ.length * 2 * 3);
  const rIdx = [];
  for (let i = 0; i < rZ.length - 1; i++) {
    const a = i * 2;
    rIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  const rNor = new Float32Array(rPos.length);
  for (let k = 1; k < rNor.length; k += 3) rNor[k] = 1;
  rGeo.setAttribute('normal', new THREE.BufferAttribute(rNor, 3));
  rGeo.setIndex(rIdx);
  const river = new THREE.Mesh(rGeo, riverMat);
  river.name = 'sungai';
  river.frustumCulled = false;
  river.renderOrder = 1;

  // ---- lembar genangan (blok utama) ----
  const pondX = [];
  let pond = null;
  let pondPos = null;
  function buildPond(profile) {
    pondX.length = 0;
    const Lh = profile.Lh;
    const lim = Lh - ctx.ch.collection.halfTop;
    pondX.push(-lim);
    for (let i = 0; i < profile.x.length; i++) pondX.push(-(Lh - profile.x[i]));
    for (let i = profile.x.length - 1; i >= 0; i--) pondX.push(Lh - profile.x[i]);
    pondX.push(lim);
    const n = pondX.length;
    pondPos = new Float32Array(n * 2 * 3);
    const idx = [];
    for (let i = 0; i < n; i++) {
      pondPos[i * 6] = pondX[i];
      pondPos[i * 6 + 2] = -200;
      pondPos[i * 6 + 3] = pondX[i];
      pondPos[i * 6 + 5] = 200;
      if (i < n - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pondPos, 3));
    const nor = new Float32Array(pondPos.length);
    for (let k = 1; k < nor.length; k += 3) nor[k] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(idx);
    if (pond) {
      pond.geometry.dispose();
      pond.geometry = g;
    } else {
      pond = new THREE.Mesh(g, pondMat);
      pond.name = 'genangan';
      pond.frustumCulled = false;
      pond.renderOrder = 2;
      group.add(pond);
    }
  }

  // ---- penampang air di potongan pintu air (z = −225): hulu (TMAS) dan hilir (sungai) ----
  const GZ = WORLD.mainZ + 0.03;
  const gcN = 2 + 9 * 2;
  const gcPos = new Float32Array(gcN * 2 * 3);
  const gcIdx = [];
  gcIdx.push(0, 1, 2, 2, 1, 3);
  for (let i = 0; i < 8; i++) {
    const a = 4 + i * 2;
    gcIdx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const gcGeo = new THREE.BufferGeometry();
  gcGeo.setAttribute('position', new THREE.BufferAttribute(gcPos, 3));
  const gcNor = new Float32Array(gcPos.length);
  for (let k = 2; k < gcNor.length; k += 3) gcNor[k] = 1;
  gcGeo.setAttribute('normal', new THREE.BufferAttribute(gcNor, 3));
  gcGeo.setIndex(gcIdx);
  const gateCaps = new THREE.Mesh(gcGeo, capMat);
  gateCaps.name = 'air-penampang-pintu';
  gateCaps.frustumCulled = false;

  function updateGateCaps(h, hr) {
    const m = ctx.ch.main;
    const top = Math.max(h, m.bed);
    const x1 = WORLD.gateX - 0.21;
    // urutan (atas, bawah) per kolom → normal +z
    put3(gcPos, 0, GATE_BOX.x0, top, GZ);
    put3(gcPos, 3, GATE_BOX.x0, m.bed, GZ);
    put3(gcPos, 6, x1, top, GZ);
    put3(gcPos, 9, x1, m.bed, GZ);
    for (let i = 0; i < 9; i++) {
      const X = Math.min(outXs[i], GATE_BOX.x1);
      const bed = outBeds[i];
      const o = (4 + i * 2) * 3;
      put3(gcPos, o, X, Math.max(hr, bed), GZ);
      put3(gcPos, o + 3, X, bed, GZ);
    }
    gcGeo.attributes.position.needsUpdate = true;
  }

  group.add(mesh, caps, gateCaps, river);

  const last = { canal: NaN, river: NaN, pondKey: NaN };

  function setPrism(p, ch, h) {
    const b = p * 12 * 3;
    const dry = h <= ch.bed + 0.003;
    const hh = dry ? ch.bed : Math.min(h, 0.02);
    const w = dry ? 0 : Math.min(ch.w0 / 2 + ch.m * (hh - ch.bed), ch.halfTop);
    const bw = dry ? 0 : ch.w0 / 2;
    // atas: a-kiri, a-kanan, b-kanan, b-kiri (urutan agar normal ke atas)
    const s0 = ch.axis === 'z' ? 1 : -1;
    putCh(pos, b, 0, ch, ch.a, s0 * w, hh);
    putCh(pos, b, 1, ch, ch.a, -s0 * w, hh);
    putCh(pos, b, 2, ch, ch.b, -s0 * w, hh);
    putCh(pos, b, 3, ch, ch.b, s0 * w, hh);
    putCh(pos, b, 4, ch, ch.a, -bw, ch.bed);
    putCh(pos, b, 5, ch, ch.a, bw, ch.bed);
    putCh(pos, b, 6, ch, ch.a, w, hh);
    putCh(pos, b, 7, ch, ch.a, -w, hh);
    putCh(pos, b, 8, ch, ch.b, -bw, ch.bed);
    putCh(pos, b, 9, ch, ch.b, bw, ch.bed);
    putCh(pos, b, 10, ch, ch.b, w, hh);
    putCh(pos, b, 11, ch, ch.b, -w, hh);
  }

  function setStrip(start, xs, beds, h, zc, b0, m, maxHalf) {
    for (let i = 0; i < xs.length; i++) {
      const bed = beds[i];
      const wet = h > bed + 0.003;
      const y = wet ? h : bed;
      const w = wet ? Math.min(b0 / 2 + m * (h - bed), maxHalf) : 0;
      const o = (start + i * 2) * 3;
      pos[o] = xs[i];
      pos[o + 1] = y;
      pos[o + 2] = zc - w;
      pos[o + 3] = xs[i];
      pos[o + 4] = y;
      pos[o + 5] = zc + w;
    }
  }

  function updateCanal(h, hr) {
    channels.forEach((c, i) => setPrism(i, c, h));
    let v = fdStart;
    const f = ctx.ch.field;
    for (const fd of fds) {
      setStrip(v, fd.xs, fd.beds, h, fd.zd, f.b, (f.halfTop - f.b / 2) / f.depth, f.halfTop);
      v += fd.xs.length * 2;
    }
    const o = ctx.ch.outfall;
    setStrip(outStart, outXs, outBeds, hr, WORLD.mainZ, o.b, o.m, 3.2);
    geo.attributes.position.needsUpdate = true;
    // tutup penampang
    for (let i = 0; i < cutChannels.length; i++) {
      const c = cutChannels[i];
      const dry = h <= c.bed + 0.003;
      const hh = dry ? c.bed : Math.min(h, 0);
      const w = dry ? 0 : Math.min(c.w0 / 2 + c.m * (hh - c.bed), c.halfTop);
      const bw = dry ? 0 : c.w0 / 2;
      quad(capPos, i * 12, c.c - bw, c.bed, c.c + bw, c.bed, c.c + w, hh, c.c - w, hh, 0.02);
    }
  }

  function updateRiver(hr) {
    const hw = riverHalfWidthAt(hr);
    for (let i = 0; i < rZ.length; i++) {
      const xc = riverCenterX(rZ[i]);
      const o = i * 6;
      rPos[o] = xc - hw;
      rPos[o + 1] = hr;
      rPos[o + 2] = rZ[i];
      rPos[o + 3] = xc + hw;
      rPos[o + 4] = hr;
      rPos[o + 5] = rZ[i];
    }
    rGeo.attributes.position.needsUpdate = true;
    const xc0 = riverCenterX(0);
    quad(capPos, COLLECTION_X.length * 12, xc0 - RIVER.halfBottom, RIVER.bed, xc0 + RIVER.halfBottom, RIVER.bed, xc0 + hw, hr, xc0 - hw, hr, 0.02);
  }

  return {
    group,
    mesh,
    caps,
    gateCaps,
    river,
    get pond() {
      return pond;
    },
    rebuild(ctx2) {
      ctx = ctx2;
      buildChannels();
      mesh.geometry = geo;
      last.canal = NaN;
      last.river = NaN;
      last.pondKey = NaN;
      pondX.length = 0;
    },
    /** Muka air kanal/sungai dan genangan; true bila ada yang berubah. */
    update(view) {
      let changed = false;
      const h = view.canal.levelM;
      const hr = view.river.levelM;
      if (!(Math.abs(h - last.canal) < 2e-4) || !(Math.abs(hr - last.river) < 2e-4)) {
        updateCanal(h, hr);
        updateRiver(hr);
        updateGateCaps(h, hr);
        capGeo.attributes.position.needsUpdate = true;
        last.canal = h;
        last.river = hr;
        changed = true;
      }
      const pr = view.profile;
      if (!pondX.length) buildPond(pr);
      const n = pr.x.length;
      let any = false;
      let key = 0;
      for (let i = 0; i < n; i++) {
        const ponded = pr.z[i] > pr.zs[i] + 0.001;
        if (ponded) any = true;
        key += (ponded ? pr.z[i] : -1) * (i + 1);
      }
      const k = any ? Math.round(key * 1e4) : -1e9;
      if (k !== last.pondKey) {
        last.pondKey = k;
        changed = true;
        setPond(pondPos, 0, pr, 0);
        for (let i = 0; i < n; i++) setPond(pondPos, 1 + i, pr, i);
        for (let i = 0; i < n; i++) setPond(pondPos, 1 + n + i, pr, n - 1 - i);
        setPond(pondPos, 2 * n + 1, pr, 0);
        pond.geometry.attributes.position.needsUpdate = true;
        pond.visible = any;
      }
      return changed;
    },
    dispose() {
      geo.dispose();
      capGeo.dispose();
      gcGeo.dispose();
      rGeo.dispose();
      pond?.geometry.dispose();
      for (const m of [mat, capMat, riverMat, pondMat]) m.dispose();
    },
  };
}
