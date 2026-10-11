// Pintu air stoplog di saluran utama (X = 200, Z = −225): dinding & ambang beton, tumpukan papan (tween 250 ms),
// lantai/railing/portal angkat (ukuran asli), dan pita luapan (nappe) yang tebalnya ∝ head dan teksturnya bergulir ∝ Q.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD } from './layout.js';
import { PALETTE } from './palette.js';
import { streakTexture } from './textures.js';
import { withBoxCut } from './cutbox.js';

const GX = WORLD.gateX;
const GZ = WORLD.mainZ;
const WALL_TOP = 0.3; // m di atas datum
const PLANK_T = 0.4; // tebal papan (arah aliran; dibesarkan agar terlihat)
const TWEEN_MS = 250;

function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

export function createGate(params, { reducedMotion = () => false } = {}) {
  const weir = params.weir;
  const bay = weir.width;
  const sill = weir.zSill;
  const plank = weir.plank;
  const half = bay / 2;

  // ---- beton (di hydroGroup, terskala VE) ----
  const bot = sill - 0.6;
  const parts = [
    box(0.9, WALL_TOP - bot, 4.6, GX, (WALL_TOP + bot) / 2, GZ - half - 2.3), // dinding kiri
    box(0.9, WALL_TOP - bot, 4.6, GX, (WALL_TOP + bot) / 2, GZ + half + 2.3), // dinding kanan
    box(0.9, sill - bot, bay, GX, (sill + bot) / 2, GZ), // ambang
    box(3.4, 0.2, bay + 0.5, GX + 0.45 + 1.7, sill - 0.65, GZ), // lantai hilir (apron)
    box(3.4, WALL_TOP - bot + 0.1, 0.25, GX + 0.45 + 1.7, (WALL_TOP + bot) / 2 - 0.05, GZ - half - 0.12), // sayap hilir
    box(3.4, WALL_TOP - bot + 0.1, 0.25, GX + 0.45 + 1.7, (WALL_TOP + bot) / 2 - 0.05, GZ + half + 0.12),
    box(2.4, WALL_TOP - bot, 0.25, GX - 0.45 - 1.2, (WALL_TOP + bot) / 2, GZ - half - 0.12), // sayap hulu
    box(2.4, WALL_TOP - bot, 0.25, GX - 0.45 - 1.2, (WALL_TOP + bot) / 2, GZ + half + 0.12),
  ];
  const concreteGeo = mergeGeometries(parts.map((g) => g.toNonIndexed()));
  const concreteMat = withBoxCut(new THREE.MeshLambertMaterial({ color: PALETTE.concrete, side: THREE.DoubleSide }));
  const concrete = new THREE.Mesh(concreteGeo, concreteMat);
  concrete.name = 'pintu-air-beton';
  concrete.userData.pick = { type: 'gate', id: 'pintu-air' };
  concrete.castShadow = false;

  // ---- papan stoplog ----
  const nMax = weir.nMax;
  const plankGeo = new THREE.BoxGeometry(PLANK_T, plank - 0.018, bay + 0.18);
  const plankMat = withBoxCut(new THREE.MeshLambertMaterial({ color: PALETTE.plank, side: THREE.DoubleSide }));
  const planks = new THREE.InstancedMesh(plankGeo, plankMat, nMax);
  planks.name = 'stoplog';
  planks.userData.pick = { type: 'gate', id: 'pintu-air' };
  planks.frustumCulled = false;
  const pc = new THREE.Color();
  for (let i = 0; i < nMax; i++) planks.setColorAt(i, pc.setHSL(0.07 + 0.012 * Math.sin(i * 2.3), 0.45, 0.3 + 0.05 * Math.cos(i * 1.7)));

  // ---- lantai, railing, portal angkat (ruang root, ukuran asli) ----
  const deckParts = [
    box(1.6, 0.15, 9.4, GX, 0.075, GZ), // lantai
    box(0.08, 1.0, 0.08, GX - 0.75, 0.6, GZ - 4.6),
    box(0.08, 1.0, 0.08, GX - 0.75, 0.6, GZ + 4.6),
    box(0.08, 1.0, 0.08, GX + 0.75, 0.6, GZ - 4.6),
    box(0.08, 1.0, 0.08, GX + 0.75, 0.6, GZ + 4.6),
    box(0.06, 0.06, 9.2, GX - 0.75, 1.05, GZ), // pegangan
    box(0.06, 0.06, 9.2, GX + 0.75, 1.05, GZ),
    box(0.06, 0.06, 9.2, GX + 0.75, 0.55, GZ),
    box(0.06, 0.06, 9.2, GX - 0.75, 0.55, GZ),
    box(0.14, 2.6, 0.14, GX, 1.3, GZ - half - 0.25), // portal angkat
    box(0.14, 2.6, 0.14, GX, 1.3, GZ + half + 0.25),
    box(0.16, 0.16, bay + 0.9, GX, 2.6, GZ),
  ];
  const deckGeo = mergeGeometries(deckParts.map((g) => g.toNonIndexed()));
  const deckMat = withBoxCut(new THREE.MeshLambertMaterial({ color: PALETTE.steel, side: THREE.DoubleSide }));
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.name = 'pintu-air-lantai';
  deck.userData.pick = { type: 'gate', id: 'pintu-air' };

  // ---- nappe (ruang root) ----
  const SEG = 12;
  const npPos = new Float32Array((SEG + 1) * 4 * 3);
  const npUv = new Float32Array((SEG + 1) * 4 * 2);
  const npIdx = [];
  for (let i = 0; i < SEG; i++) {
    const a = i * 4;
    const b = a + 4;
    // atas (0,1), bawah (2,3), sisi (0,2) & (1,3)
    npIdx.push(a, b, a + 1, a + 1, b, b + 1);
    npIdx.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
    npIdx.push(a, a + 2, b, a + 2, b + 2, b);
    npIdx.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3);
  }
  for (let i = 0; i <= SEG; i++) {
    const v = i / SEG;
    npUv.set([0, v, 1, v, 0, v, 1, v], i * 8);
  }
  const npGeo = new THREE.BufferGeometry();
  npGeo.setAttribute('position', new THREE.BufferAttribute(npPos, 3));
  npGeo.setAttribute('uv', new THREE.BufferAttribute(npUv, 2));
  npGeo.setIndex(npIdx);
  const npTex = streakTexture();
  npTex.repeat.set(1, 2);
  const npMat = withBoxCut(new THREE.MeshBasicMaterial({ map: npTex, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  const nappe = new THREE.Mesh(npGeo, npMat);
  nappe.name = 'nappe';
  nappe.frustumCulled = false;
  nappe.visible = false;
  nappe.renderOrder = 6;

  const hydro = [concrete, planks];
  const root = [deck, nappe];

  const m4 = new THREE.Matrix4();
  const qq = new THREE.Quaternion();
  const pp = new THREE.Vector3();
  const ss = new THREE.Vector3(1, 1, 1);
  const anchor = new THREE.Vector3();

  let ve = 10;
  let target = 0;
  let from = 0;
  let shown = -1;
  let t0 = 0;
  let animating = false;
  let nappeOn = false;
  let flowQ = 0;
  let lastNappeKey = NaN;

  function placePlanks(nowMs) {
    let e = 1;
    if (animating) {
      e = Math.min(1, (nowMs - t0) / TWEEN_MS);
      if (e >= 1) animating = false;
    }
    const lo = Math.min(from, target);
    const hi = Math.max(from, target);
    const adding = target > from;
    const lift = 1.6; // m di atas posisi duduk (sebelum diskalakan)
    let count = 0;
    for (let i = 0; i < nMax; i++) {
      let y = sill + plank * i + plank / 2;
      let vis = i < lo;
      if (i >= lo && i < hi) {
        const k = adding ? 1 - e : e;
        y += k * lift;
        vis = adding || e < 1;
      }
      if (!vis) continue;
      m4.compose(pp.set(GX, y, GZ), qq, ss);
      planks.setMatrixAt(count, m4); // papan terlihat selalu berupa awalan [0, count)
      count++;
    }
    planks.count = count;
    planks.visible = count > 0;
    planks.instanceMatrix.needsUpdate = true;
    planks.computeBoundingSphere();
  }

  function updateNappe(view) {
    const st = view.structure;
    const H = st.headCm / 100;
    const on = nappeOn ? H > 0.003 && !st.submerged : H > 0.005 && !st.submerged;
    nappeOn = on && st.q_m3s > 0;
    nappe.visible = nappeOn;
    flowQ = st.q_m3s;
    if (!nappeOn) return;
    const key = Math.round(H * 1e4) * 1e7 + Math.round(view.river.levelM * 1e3) * 1e2 + ve + st.crestM * 1e-3;
    if (key === lastNappeKey) return;
    lastNappeKey = key;
    const crest = st.crestM;
    const x0 = GX + PLANK_T / 2;
    const yTop = (crest + 0.85 * H) * ve;
    const down = Math.max(view.river.levelM, sill - 0.55);
    const yEnd = down * ve;
    // tebal ∝ head (dibesarkan agar terbaca), lemparan horizontal ∝ √H (kecepatan di mercu)
    const t0v = Math.max(0.12, 0.9 * H) * ve;
    const throwL = 0.6 + 3.6 * Math.sqrt(H);
    for (let i = 0; i <= SEG; i++) {
      const s = i / SEG;
      const x = x0 + throwL * s;
      const yU = yTop - (yTop - yEnd) * s * s;
      const t = t0v * (1 - 0.45 * s);
      // sedikit lebih sempit dari bukaan (kontraksi samping) agar sisi pita tidak berimpit dengan dinding sayap
      const zl = GZ - half * (0.9 - 0.12 * s);
      const zr = GZ + half * (0.9 - 0.12 * s);
      const o = i * 12;
      npPos[o] = x;
      npPos[o + 1] = yU;
      npPos[o + 2] = zl;
      npPos[o + 3] = x;
      npPos[o + 4] = yU;
      npPos[o + 5] = zr;
      npPos[o + 6] = x - 0.05;
      npPos[o + 7] = yU - t;
      npPos[o + 8] = zl;
      npPos[o + 9] = x - 0.05;
      npPos[o + 10] = yU - t;
      npPos[o + 11] = zr;
    }
    npGeo.attributes.position.needsUpdate = true;
    npGeo.computeBoundingSphere();
  }

  return {
    hydro,
    root,
    anchor,
    pickables: [concrete, planks, deck],
    setVE(v) {
      ve = v;
      deck.position.y = WALL_TOP * ve;
      anchor.set(GX, WALL_TOP * ve + 3.4, GZ);
      lastNappeKey = NaN;
    },
    /** Target jumlah papan (tween 250 ms) dan nappe; true bila ada perubahan. */
    update(view, nowMs) {
      let changed = false;
      const n = view.structure.nLogs;
      if (shown < 0) {
        shown = target = from = n;
        placePlanks(nowMs);
        changed = true;
      } else if (n !== target) {
        from = animating ? target : shown;
        target = n;
        shown = n;
        if (reducedMotion()) {
          from = n;
          animating = false;
        } else {
          t0 = nowMs;
          animating = true;
        }
        placePlanks(nowMs);
        changed = true;
      }
      const before = nappe.visible;
      updateNappe(view);
      if (before !== nappe.visible || nappe.visible) changed = true;
      return changed;
    },
    /** Animasi per frame: tween papan & gulir nappe. true bila perlu render. */
    animate(dtSec, nowMs, playing) {
      let busy = false;
      if (animating) {
        placePlanks(nowMs);
        if (!animating) from = target;
        busy = true;
      }
      if (nappe.visible && playing) {
        npTex.offset.y -= dtSec * (0.6 + 6 * Math.sqrt(Math.max(flowQ, 0)));
        busy = true;
      }
      return busy;
    },
    get animating() {
      return animating;
    },
    debug() {
      return { target, shown, count: planks.count, animating };
    },
    dispose() {
      for (const g of [concreteGeo, plankGeo, deckGeo, npGeo]) g.dispose();
      for (const m of [concreteMat, plankMat, deckMat, npMat]) m.dispose();
      npTex.dispose();
    },
  };
}
