// Penampang tanah di bidang potong z = 0: lapisan saprik/hemik/fibrik/lempung mineral (atas mengikuti kubah & relief),
// overlay zona jenuh dari muka air tanah z(x) ke dasar gambut, garis freatik, mistar kedalaman, panah rembesan.
import * as THREE from 'three';
import { groundAt, heightAt } from './ground.js';
import { WORLD } from './layout.js';
import { PALETTE } from './palette.js';
import { waterTableAt, faceX } from './profile.js';
import { terrainPatches } from './terrain.js';
import { GATE_BOX } from './cutbox.js';
import { makeCanvas, redrawCanvasTexture } from './textures.js';
import { fmt } from '../ui/format.js';

const LAYERS = [
  { id: 'saprik', top: 0, bot: -0.5, color: PALETTE.saprik, label: 'Saprik' },
  { id: 'hemik', top: -0.5, bot: -1.5, color: PALETTE.hemik, label: 'Hemik' },
  { id: 'fibrik', top: -1.5, bot: null, color: PALETTE.fibrik, label: 'Fibrik' },
  { id: 'mineral', top: null, bot: -5.5, color: PALETTE.mineral, label: 'Lempung mineral' },
];
export const MINERAL_BASE = -5.5;

/** Kolom X penampang: sama dengan kolom patch terrain di z = 0 (tepi atas cocok persis), + tanah jauh. */
function sectionColumns(ctx, quality) {
  const xs = new Set();
  for (const p of terrainPatches(ctx, quality)) {
    if (p.zs[0] <= 0 && p.zs[p.zs.length - 1] >= 0) for (const x of p.xs) xs.add(Math.round(x * 1e6) / 1e6);
  }
  const E = WORLD.extent;
  for (const x of [-WORLD.farGround, -1200, E.xMin - 0.001, E.xMax + 0.001, 1200, WORLD.farGround]) xs.add(x);
  return Float64Array.from([...xs].sort((a, b) => a - b));
}

/** Titik sepanjang garis potong: {X, Z, top, surf}. */
function linePoints(coords, ctx, axis, fixed) {
  const E = WORLD.extent;
  const g = {};
  return Array.from(coords, (v) => {
    const X = axis === 'x' ? v : fixed;
    const Z = axis === 'x' ? fixed : v;
    if (X < E.xMin || X > E.xMax || Z < E.zMin || Z > E.zMax) return { X, Z, top: -0.05, surf: 0 };
    groundAt(X, Z, ctx, g);
    return { X, Z, top: g.h, surf: g.surf };
  });
}

/** Muka lapisan tanah sepanjang garis (pts berurutan; normal = −(atas × arah)). */
function pushFace(acc, pts, normal, zBase) {
  const c = new THREE.Color();
  const n = pts.length;
  for (const L of LAYERS) {
    c.setHex(L.color);
    const b = acc.pos.length / 3;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const U = L.top == null ? zBase : p.surf + L.top;
      const B = L.bot == null ? zBase : L.id === 'mineral' ? L.bot : p.surf + L.bot;
      acc.pos.push(p.X, Math.min(U, p.top), p.Z, p.X, Math.min(B, p.top), p.Z);
      acc.col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      acc.nor.push(...normal, ...normal);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = b + i * 2;
      acc.idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  }
}

function toGeometry(acc) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(acc.col, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(acc.nor, 3));
  geo.setIndex(acc.idx);
  return geo;
}

function buildFaceGeometry(ctx, quality, zBase) {
  const acc = { pos: [], col: [], nor: [], idx: [] };
  pushFace(acc, linePoints(sectionColumns(ctx, quality), ctx, 'x', 0), [0, 0, 1], zBase);
  return toGeometry(acc);
}

/** Muka potongan kotak pintu air: dinding z = −225 (menghadap utara), dua dinding samping, dan lantai. */
function buildNotchGeometry(ctx, quality, zBase) {
  const B = GATE_BOX;
  const patch = terrainPatches(ctx, quality).find((p) => p.id === 'R');
  const xs = [B.x0, ...Array.from(patch.xs).filter((x) => x > B.x0 && x < B.x1), B.x1];
  const zs = [B.z0, ...Array.from(patch.zs).filter((z) => z > B.z0 && z < B.z1), B.z1];
  const acc = { pos: [], col: [], nor: [], idx: [] };
  pushFace(acc, linePoints(xs, ctx, 'x', B.z0), [0, 0, 1], zBase);
  pushFace(acc, linePoints(zs, ctx, 'z', B.x1), [-1, 0, 0], zBase);
  pushFace(acc, linePoints(zs.slice().reverse(), ctx, 'z', B.x0), [1, 0, 0], zBase);
  const c = new THREE.Color(PALETTE.mineral).multiplyScalar(0.85);
  const b = acc.pos.length / 3;
  for (const [x, z] of [
    [B.x0, B.z0],
    [B.x1, B.z0],
    [B.x1, B.z1],
    [B.x0, B.z1],
  ]) {
    acc.pos.push(x, MINERAL_BASE, z);
    acc.col.push(c.r, c.g, c.b);
    acc.nor.push(0, 1, 0);
  }
  acc.idx.push(b, b + 3, b + 2, b, b + 2, b + 1);
  return toGeometry(acc);
}

function faceMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a2620 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLp = vec2(position.x + position.z, position.y);');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vLp;
float sHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float sNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float fib = sNoise(vec2(vLp.x * 0.35, vLp.y * 16.0)) * 0.6 + sNoise(vec2(vLp.x * 1.3, vLp.y * 40.0)) * 0.4;
  float grain = sNoise(vLp * vec2(2.0, 30.0));
  diffuseColor.rgb *= 0.86 + 0.22 * fib + 0.06 * grain;
}`,
      );
  };
  mat.customProgramCacheKey = () => 'wm-section-face';
  return mat;
}

/** Tekstur mistar kedalaman + nama lapisan (digambar ulang bila VE berubah agar huruf tidak gepeng). */
function drawRuler(canvas, ve, zBase) {
  const top = 0.4;
  const bot = MINERAL_BASE;
  const hM = top - bot;
  const pxPerM = Math.min(Math.max(12 * ve, 14), 180);
  const W = 320;
  const H = Math.max(32, Math.min(4096, Math.round(hM * pxPerM)));
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const y = (m) => ((top - m) / hM) * H;
  const rulerW = 40;
  ctx.fillStyle = 'rgba(250,250,245,0.95)';
  ctx.fillRect(0, 0, rulerW, H);
  ctx.strokeStyle = '#111';
  ctx.fillStyle = '#111';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, rulerW - 2, H - 2);
  for (let k = 0; k <= Math.round((top - bot) * 10); k++) {
    const m = Math.round((top - k * 0.1) * 10) / 10;
    if (m > top + 1e-9 || m < bot - 1e-9) continue;
    const yy = y(m);
    const major = Math.abs(m * 2 - Math.round(m * 2)) < 1e-6;
    ctx.fillRect(0, yy - (major ? 1.5 : 0.75), major ? rulerW * 0.7 : rulerW * 0.35, major ? 3 : 1.5);
  }
  const fs = Math.max(9, Math.min(22, pxPerM * 0.28));
  ctx.font = `600 ${fs}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (let m = 0; m >= bot - 1e-9; m -= ve >= 6 ? 0.5 : 1) {
    const yy = y(m);
    const txt = m === 0 ? '0 m' : `${fmt(m, 1)}`;
    ctx.fillStyle = 'rgba(250,250,245,0.92)';
    const w = ctx.measureText(txt).width;
    ctx.fillRect(rulerW + 3, yy - fs * 0.62, w + 8, fs * 1.24);
    ctx.fillStyle = '#111';
    ctx.fillText(txt, rulerW + 7, yy);
  }
  // nama lapisan (pada sisi kanan, di tengah tiap lapisan; relatif permukaan = 0 di posisi mistar)
  const bands = [
    ['Saprik', 0, -0.5],
    ['Hemik', -0.5, -1.5],
    ['Fibrik', -1.5, zBase],
    ['Lempung mineral', zBase, bot],
  ];
  const fs2 = Math.max(9, Math.min(24, pxPerM * 0.3));
  ctx.font = `600 ${fs2}px "IBM Plex Sans", system-ui, sans-serif`;
  for (const [name, a, b] of bands) {
    const yy = (y(a) + y(b)) / 2;
    if (y(b) - y(a) < fs2 * 1.1) continue;
    const x = 118;
    const lines = ctx.measureText(name).width > W - x - 10 ? name.split(' ') : [name];
    const lh = fs2 * 1.15;
    const w = Math.max(...lines.map((t) => ctx.measureText(t).width));
    const y0 = yy - ((lines.length - 1) * lh) / 2;
    ctx.fillStyle = 'rgba(20,16,12,0.62)';
    ctx.fillRect(x - 6, y0 - fs2 * 0.7, w + 12, fs2 * 1.4 + (lines.length - 1) * lh);
    ctx.fillStyle = '#fbf6ee';
    lines.forEach((t, i) => ctx.fillText(t, x, y0 + i * lh));
  }
  return { H, top, bot };
}

/** Geometri panah satuan (sepanjang +X, panjang 1): batang + kepala. */
function arrowGeometry() {
  const shaft = new THREE.BoxGeometry(0.72, 0.16, 0.05);
  shaft.translate(0.36, 0, 0);
  const head = new THREE.ConeGeometry(0.34, 0.3, 3);
  head.rotateZ(-Math.PI / 2);
  head.translate(0.85, 0, 0);
  const g = new THREE.BufferGeometry();
  const a = shaft.toNonIndexed();
  const b = head.toNonIndexed();
  const pos = new Float32Array(a.attributes.position.count * 3 + b.attributes.position.count * 3);
  pos.set(a.attributes.position.array, 0);
  pos.set(b.attributes.position.array, a.attributes.position.count * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

const ARROW_FACES = [1, 3, 6, 10, 16, 24];
const SIDES = [-1, 1];
const ZONE_X = -38; // posisi label zona (antara P3 dan P4)
const WT_X = -20;

export function createSection(ctx, params, quality) {
  let zoneSurface = heightAt(ZONE_X, 0, ctx);
  const zBase = params.geom.zBase;
  const Lh = params.geom.Lh;
  // ---- muka lapisan (statis, di hydroGroup) ----
  const faceMat = faceMaterial();
  const face = new THREE.Mesh(buildFaceGeometry(ctx, quality, zBase), faceMat);
  face.name = 'penampang';
  face.userData.pick = { type: 'section', id: 'penampang' };
  const notch = new THREE.Mesh(buildNotchGeometry(ctx, quality, zBase), faceMat);
  notch.name = 'penampang-pintu-air';
  notch.userData.pick = { type: 'gate', id: 'pintu-air' };

  // ---- overlay zona jenuh (blok utama, dinamis, di hydroGroup) ----
  const ovX = [];
  for (let X = -WORLD.blockEdgeX; X <= WORLD.blockEdgeX + 1e-6; X += 2.5) ovX.push(X);
  for (const x of [-150, 150, -148.8, 148.8, -151.2, 151.2]) ovX.push(x);
  ovX.sort((a, b) => a - b);
  const nOv = ovX.length;
  const ovPos = new Float32Array(nOv * 2 * 3);
  const ovIdx = [];
  for (let i = 0; i < nOv; i++) {
    ovPos[i * 6] = ovX[i];
    ovPos[i * 6 + 1] = zBase;
    ovPos[i * 6 + 2] = 0.05;
    ovPos[i * 6 + 3] = ovX[i];
    ovPos[i * 6 + 4] = zBase;
    ovPos[i * 6 + 5] = 0.05;
    if (i < nOv - 1) {
      const a = i * 2;
      ovIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const ovGeo = new THREE.BufferGeometry();
  ovGeo.setAttribute('position', new THREE.BufferAttribute(ovPos, 3));
  ovGeo.setIndex(ovIdx);
  const ovMat = new THREE.MeshBasicMaterial({ color: PALETTE.saturated, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
  // zona jenuh: rona biru tipis + garis putus-putus horizontal (simbol air tanah), lapisan tanah tetap terlihat
  ovMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOw;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float fy = fract(vOw.y / 3.2);
  float aay = fwidth(vOw.y / 3.2) * 1.2;
  float line = smoothstep(0.0, aay, fy) * (1.0 - smoothstep(0.16, 0.16 + aay, fy));
  float dash = step(fract((vOw.x + 2.0 * floor(vOw.y / 3.2)) / 7.0), 0.62);
  diffuseColor.a = 0.2 + 0.34 * line * dash;
}`,
      );
  };
  ovMat.customProgramCacheKey = () => 'wm-saturated';
  const overlay = new THREE.Mesh(ovGeo, ovMat);
  overlay.name = 'zona-jenuh';
  overlay.renderOrder = 2;
  overlay.frustumCulled = false;

  // ---- garis freatik (ruang root, tebal konstan) ----
  const rbPos = new Float32Array(nOv * 4 * 3);
  const rbCol = new Float32Array(nOv * 4 * 3);
  const rbIdx = [];
  const cw = new THREE.Color(0xffffff);
  const cb = new THREE.Color(PALETTE.phreatic);
  for (let i = 0; i < nOv; i++) {
    for (let r = 0; r < 4; r++) {
      const k = (i * 4 + r) * 3;
      rbPos[k] = ovX[i];
      rbPos[k + 2] = 0.12;
      const cc = r === 0 || r === 3 ? cw : cb;
      rbCol[k] = cc.r;
      rbCol[k + 1] = cc.g;
      rbCol[k + 2] = cc.b;
    }
    if (i < nOv - 1) {
      const a = i * 4;
      for (let r = 0; r < 3; r++) rbIdx.push(a + r, a + 4 + r, a + r + 1, a + r + 1, a + 4 + r, a + 5 + r);
    }
  }
  const rbGeo = new THREE.BufferGeometry();
  rbGeo.setAttribute('position', new THREE.BufferAttribute(rbPos, 3));
  rbGeo.setAttribute('color', new THREE.BufferAttribute(rbCol, 3));
  rbGeo.setIndex(rbIdx);
  const rbMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
  const ribbon = new THREE.Mesh(rbGeo, rbMat);
  ribbon.name = 'garis-freatik';
  ribbon.renderOrder = 3;
  ribbon.frustumCulled = false;

  // ---- mistar kedalaman + nama lapisan (ruang root) ----
  const rulerCanvas = makeCanvas(256, 64);
  const rulerHolder = { canvas: rulerCanvas, texture: null };
  const rulerMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
  const ruler = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), rulerMat);
  ruler.name = 'mistar';
  ruler.renderOrder = 3;
  const RULER_X0 = -181.7;
  const RULER_W = 27.5;

  // ---- panah rembesan ----
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const arrows = new THREE.InstancedMesh(arrowGeometry(), arrowMat, ARROW_FACES.length * 2);
  arrows.name = 'panah-rembesan';
  arrows.frustumCulled = false;
  arrows.renderOrder = 4;

  const m4 = new THREE.Matrix4();
  const qq = new THREE.Quaternion();
  const pp = new THREE.Vector3();
  const ss = new THREE.Vector3();
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const ident = new THREE.Quaternion();

  const anchors = {
    unsatThick: 1,
    unsat: new THREE.Vector3(),
    sat: new THREE.Vector3(),
    wt: new THREE.Vector3(),
  };
  let ve = 10;
  let lastVe = -1;
  const wt = new Float64Array(nOv);

  function updateRuler() {
    if (lastVe === ve) return;
    lastVe = ve;
    const { top, bot } = drawRuler(rulerCanvas, ve, zBase);
    redrawCanvasTexture(rulerHolder, rulerMat, { mipmaps: false });
    ruler.scale.set(RULER_W, (top - bot) * ve, 1);
    ruler.position.set(RULER_X0 + RULER_W / 2, ((top + bot) / 2) * ve, 0.25);
  }

  return {
    face,
    notch,
    overlay,
    ribbon,
    ruler,
    arrows,
    anchors,
    rebuild(ctx2, q) {
      zoneSurface = heightAt(ZONE_X, 0, ctx2);
      face.geometry.dispose();
      face.geometry = buildFaceGeometry(ctx2, q, zBase);
      notch.geometry.dispose();
      notch.geometry = buildNotchGeometry(ctx2, q, zBase);
    },
    setVE(v) {
      ve = v;
      updateRuler();
    },
    /** Profil → overlay, garis freatik, panah, posisi label. */
    update(view, showArrows) {
      const pr = view.profile;
      const hc = view.canal.levelM;
      for (let i = 0; i < nOv; i++) {
        const X = ovX[i];
        const z = waterTableAt(X, pr, hc, Lh);
        wt[i] = z;
        ovPos[i * 6 + 1] = Math.max(z, zBase);
        const yc = z * ve;
        const k = i * 12;
        rbPos[k + 1] = yc + 0.75;
        rbPos[k + 4] = yc + 0.32;
        rbPos[k + 7] = yc - 0.32;
        rbPos[k + 10] = yc - 0.75;
      }
      ovGeo.attributes.position.needsUpdate = true;
      rbGeo.attributes.position.needsUpdate = true;
      // panah rembesan: q > 0 = menuju saluran (|X| bertambah)
      let n = 0;
      if (showArrows) {
        const N = pr.q.length - 1;
        for (const fi of ARROW_FACES) {
          if (fi > N) continue;
          const q = pr.q[fi];
          const mag = Math.abs(q);
          if (mag < 0.004) continue;
          const len = Math.min(16, Math.max(1.4, 80 * mag)); // ∝ |q| (dibatasi)
          const x = faceX(fi, N, Lh);
          for (const side of SIDES) {
            const X = side * (Lh - x);
            const z = waterTableAt(X, pr, hc, Lh);
            const y = ((Math.max(z, zBase) + zBase) / 2) * ve;
            const toCanal = q > 0;
            const dirPos = side > 0 ? toCanal : !toCanal; // +X?
            const x0 = dirPos ? X - len / 2 : X + len / 2;
            const th = Math.min(2.4, 1 + len * 0.08);
            m4.compose(pp.set(x0, y, 0.2), dirPos ? ident : flip, ss.set(len, th, th));
            arrows.setMatrixAt(n++, m4);
          }
        }
      }
      arrows.count = n;
      arrows.visible = n > 0;
      if (n) arrows.instanceMatrix.needsUpdate = true;
      // jangkar label
      const zU = waterTableAt(ZONE_X, pr, hc, Lh);
      const sU = zoneSurface;
      anchors.unsat.set(ZONE_X, ((sU + Math.min(zU, sU)) / 2) * ve, 0.3);
      anchors.unsatThick = sU - zU;
      anchors.sat.set(ZONE_X, ((Math.min(zU, sU) + zBase) / 2) * ve, 0.3);
      const zW = waterTableAt(WT_X, pr, hc, Lh);
      anchors.wt.set(WT_X, zW * ve, 0.3);
      return anchors;
    },
    dispose() {
      for (const o of [face, notch, overlay, ribbon, ruler, arrows]) o.geometry.dispose();
      for (const m of [faceMat, ovMat, rbMat, rulerMat, arrowMat]) m.dispose();
      rulerHolder.texture?.dispose();
    },
  };
}
