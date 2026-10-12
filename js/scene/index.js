// Scene 3D tata air blok sawit gambut (kontrak: docs/kontrak.md §9).
// 1 unit = 1 m, Y ke atas, y = 0 = tanggul saluran koleksi. hydroGroup (skala Y = VE) berisi relief terrain,
// penampang tanah, prisma & air saluran, dasar sungai, beton/papan pintu air. Sawit, tutup pipa, label, dan hujan
// berukuran asli dan diletakkan di permukaan yang diskalakan. Render on-demand saat dijeda.
import * as THREE from 'three';
import { fmt, fmtElevCm, fmtElevClassCm, fmtQ, fmtSigned, depthPhrase, depthPhraseClass } from '../ui/format.js';
import { makeGroundCtx, heightAt } from './ground.js';
import { WORLD, riverCenterX } from './layout.js';
import { PALETTE } from './palette.js';
import { createTerrain } from './terrain.js';
import { createSky, createHorizon, createFarGround, createForest, createCutFloor } from './surroundings.js';
import { createSection, MINERAL_BASE } from './section.js';
import { createWater } from './water.js';
import { createPalms } from './palms.js';
import { createInstruments } from './instruments.js';
import { createGate } from './gate.js';
import { createRain, createFlow } from './particles.js';
import { createLabels, gateWarnCode, GATE_WARN, tpTagText } from './labels.js';
import { createCameraRig, prefersReducedMotion } from './camera.js';
import { setBoxCut } from './cutbox.js';

const SUN_DIR = new THREE.Vector3(0.42, 0.82, 0.38).normalize();
const _proj = new THREE.Vector3();
let active = null;

/** Hook debug/tes: pose kamera bebas (mis. close-up sawit) dan info scene aktif. */
export const sceneDebug = {
  get active() {
    return active;
  },
  setPose(pos, target) {
    active?.setPose(pos, target);
  },
  info() {
    return active?.debugInfo() ?? null;
  },
  project(p) {
    return active?.project(p) ?? null;
  },
  anchors() {
    return active?.anchors() ?? null;
  },
  nanGeometries() {
    return active?.debugNaN() ?? [];
  },
};

function webgl2Available() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function createScene(container, { params, options = {}, onPick } = {}) {
  if (!webgl2Available()) throw new Error('WebGL2 tidak tersedia');
  const opts = { ve: 10, labels: true, cutaway: true, particles: true, quality: 'tinggi', camera: 'ikhtisar', ...options };

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    throw new Error('WebGL2 tidak tersedia');
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const dprFor = (q) => Math.min(window.devicePixelRatio || 1, q === 'rendah' ? 1 : 2);
  renderer.setPixelRatio(dprFor(opts.quality));
  const canvas = renderer.domElement;
  canvas.className = 'sc-canvas';
  canvas.setAttribute('aria-label', 'Tampilan 3D blok kebun sawit gambut: saluran, piezometer, pintu air, dan penampang tanah');
  canvas.setAttribute('role', 'img');
  container.prepend(canvas);

  // ---------- scene, grup, cahaya ----------
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.skyHorizon[0], 400, 1400);
  const hydro = new THREE.Group();
  hydro.name = 'hydroGroup';
  scene.add(hydro);
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

  const hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, PALETTE.hemi[0]);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sunColor, PALETTE.sun[0]);
  const sunTarget = new THREE.Object3D();
  sunTarget.position.set(10, 0, -70);
  sun.target = sunTarget;
  sun.position.copy(sunTarget.position).addScaledVector(SUN_DIR, 700);
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -300;
  sc.right = 300;
  sc.top = 280;
  sc.bottom = -280;
  sc.near = 200;
  sc.far = 1300;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sunTarget);

  const sky = createSky();
  const horizon = createHorizon();
  scene.add(sky.mesh, horizon.mesh);

  // ---------- kamera ----------
  const rig = createCameraRig(canvas);
  const camera = rig.camera;
  let needsRender = true;
  rig.controls.addEventListener('change', () => {
    needsRender = true;
  });

  // ---------- label ----------
  const labels = createLabels(container, { onPick: (info) => onPick?.(info) });
  scene.add(labels.root);

  // ---------- dunia (bergantung parameter) ----------
  let P = params;
  let ctx = makeGroundCtx(P);
  let ve = opts.ve;
  let quality = opts.quality;
  const world = {};
  const farGround = createFarGround(cutPlane);
  hydro.add(farGround.mesh);
  const cutFloor = createCutFloor(MINERAL_BASE);
  hydro.add(cutFloor.mesh);
  const gate = createGate(P, { reducedMotion: prefersReducedMotion });
  for (const o of gate.hydro) hydro.add(o);
  for (const o of gate.root) scene.add(o);
  let rain = createRain(cutPlane, 3000);
  scene.add(rain.object);

  function buildWorld() {
    world.terrain = createTerrain(ctx, quality, cutPlane);
    hydro.add(world.terrain.mesh);
    world.section = createSection(ctx, P, quality);
    hydro.add(world.section.face, world.section.notch, world.section.overlay);
    scene.add(world.section.ribbon, world.section.ruler, world.section.arrows);
    world.water = createWater(ctx, cutPlane);
    hydro.add(world.water.group);
    world.palms = createPalms(ctx, P, { quality, cutPlane });
    scene.add(world.palms.group);
    world.forest = createForest(ctx, quality, cutPlane);
    scene.add(world.forest.mesh);
    world.instruments = createInstruments(P, (X, Z) => heightAt(X, Z, ctx));
    scene.add(world.instruments.group);
    world.flow = createFlow(P, quality);
    scene.add(world.flow.object);
  }
  function disposeWorld() {
    hydro.remove(world.terrain.mesh, world.section.face, world.section.notch, world.section.overlay, world.water.group);
    scene.remove(world.section.ribbon, world.section.ruler, world.section.arrows, world.palms.group, world.forest.mesh, world.instruments.group, world.flow.object);
    for (const k of ['terrain', 'section', 'water', 'palms', 'forest', 'instruments', 'flow']) world[k].dispose();
  }
  buildWorld();

  // ---------- label objek ----------
  const L = {};
  function buildLabels() {
    const pz = world.instruments.ids;
    L.pz = pz.map((id, i) => {
      const it = labels.add({ key: `pz-${id}`, pick: { type: 'piezometer', id }, priority: 2 + i, className: 'sc-pz' });
      it.obj.position.copy(world.instruments.anchors[i]);
      return it;
    });
    L.gauge = labels.add({ key: 'gauge', pick: { type: 'gauge', id: 'G2' }, priority: 1, className: 'sc-gauge' });
    L.gate = labels.add({ key: 'gate', pick: { type: 'gate', id: 'pintu-air' }, priority: 0, className: 'sc-gate', base: 10 });
    L.river = labels.add({ key: 'river', pick: { type: 'gate', id: 'sungai' }, priority: 9, className: 'sc-river' });
    L.unsat = labels.add({ key: 'zona-tak-jenuh', kind: 'zone', pick: { type: 'section', id: 'tak-jenuh' }, className: 'sc-zone-unsat', section: true, priority: 6 });
    L.sat = labels.add({ key: 'zona-jenuh', kind: 'zone', pick: { type: 'section', id: 'jenuh' }, className: 'sc-zone-sat', section: true, priority: 4 });
    L.wt = labels.add({ key: 'muka-air-tanah', kind: 'pin', pick: { type: 'section', id: 'muka-air-tanah' }, priority: 8, className: 'sc-wt', base: 4, section: true });
    L.up = labels.add({ key: 'pintu-hulu', kind: 'zone', pick: { type: 'gate', id: 'pintu-air' }, className: 'sc-gate-up', maxDist: 170 });
    L.down = labels.add({ key: 'pintu-hilir', kind: 'zone', pick: { type: 'gate', id: 'pintu-air' }, className: 'sc-gate-down', maxDist: 170 });
    L.crest = labels.add({ key: 'pintu-mercu', kind: 'pin', pick: { type: 'gate', id: 'pintu-air' }, priority: 1, className: 'sc-crest', base: 8, maxDist: 170 });
    labels.setContent(L.unsat, 'u', () => [labels.span('sc-txt', 'Zona tak jenuh')], 'Zona tak jenuh (di atas muka air tanah)');
    labels.setContent(L.sat, 's', () => [labels.span('sc-txt', 'Zona jenuh air')], 'Zona jenuh air (di bawah muka air tanah)');
  }
  buildLabels();

  function placeAnchors() {
    world.instruments.anchors.forEach((a, i) => L.pz[i].obj.position.copy(a));
    const g2 = world.instruments.gaugeAnchors[0];
    L.gauge.obj.position.set(g2.x, 0.6, g2.z);
    L.gate.obj.position.copy(gate.anchor);
    const zr = -60;
    L.river.obj.position.set(riverCenterX(zr), 1.2, zr);
  }

  // ---------- tema (lantai potongan mengikuti latar halaman terang/gelap) ----------
  const _floorBase = new THREE.Color(PALETTE.floor);
  const _bg = new THREE.Color();
  function applyTheme() {
    try {
      const bg = getComputedStyle(container).getPropertyValue('--bg').trim();
      if (bg) {
        _bg.setStyle(bg);
        cutFloor.mesh.material.color.copy(_bg).lerp(_floorBase, 0.3);
      } else cutFloor.mesh.material.color.copy(_floorBase);
    } catch {
      cutFloor.mesh.material.color.copy(_floorBase);
    }
    needsRender = true;
  }
  const mqDark = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const mqReduce = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduceMotion = !!mqReduce?.matches;
  const onReduce = () => {
    reduceMotion = !!mqReduce?.matches;
  };
  mqReduce?.addEventListener?.('change', onReduce);
  mqDark?.addEventListener?.('change', applyTheme);
  const themeObserver = typeof MutationObserver === 'function' ? new MutationObserver(applyTheme) : null;
  themeObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  applyTheme();

  // ---------- status ----------
  let lastView = null;
  let cloud = 0;
  let cloudTarget = 0;
  let lastCloudMs = performance.now();
  let size = { w: 1, h: 1 };
  let cutEff = true;

  function effectiveCutaway() {
    return !!opts.cutaway || rig.preset === 'penampang';
  }

  function applyCut() {
    cutEff = effectiveCutaway();
    cutPlane.constant = cutEff ? 0 : 1e6;
    world.palms.setCutaway(cutEff);
    world.forest.mesh.count = cutEff ? countZ(world.forest.zs) : world.forest.count;
    world.section.face.visible = cutEff;
    world.section.notch.visible = cutEff;
    world.water.gateCaps.visible = cutEff;
    setBoxCut(cutEff);
    cutFloor.mesh.visible = cutEff;
    world.section.overlay.visible = cutEff;
    world.section.ribbon.visible = cutEff;
    world.section.ruler.visible = cutEff;
    world.water.caps.visible = cutEff;
    world.section.arrows.visible = cutEff && opts.particles && world.section.arrows.count > 0;
    for (const it of [L.unsat, L.sat, L.wt, L.up, L.down, L.crest]) labels.setVisible(it, cutEff);
    renderer.shadowMap.needsUpdate = true;
    needsRender = true;
  }
  function countZ(zs) {
    let lo = 0;
    let hi = zs.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (zs[m] <= 0) lo = m + 1;
      else hi = m;
    }
    return lo;
  }

  function applyVE(v) {
    const old = ve;
    ve = v;
    hydro.scale.y = ve;
    hydro.updateMatrixWorld(true);
    world.palms.place(ve);
    world.forest.place(ve);
    world.instruments.setVE(ve);
    world.section.setVE(ve);
    gate.setVE(ve);
    world.terrain.uniforms.uVE.value = ve;
    placeAnchors();
    if (old !== ve) rig.rescaleVE(old, ve);
    renderer.shadowMap.needsUpdate = true;
    lastView = null;
    needsRender = true;
  }

  function applyQualityDeps() {
    renderer.setPixelRatio(dprFor(quality));
    sun.castShadow = quality !== 'rendah';
    renderer.shadowMap.needsUpdate = true;
  }

  function applyParticles() {
    const on = !!opts.particles;
    rain.object.visible = on && rain.count > 0;
    world.flow.object.visible = on;
    world.section.arrows.visible = on && cutEff && world.section.arrows.count > 0;
  }

  // ---------- pembaruan dari snapshot ----------
  // kunci numerik (tanpa membuat string tiap frame); teks hanya diformat & ditulis bila berubah
  const LS = { pzD: new Float64Array(8).fill(NaN), pzCls: [], pzTp: new Int8Array(8).fill(-1), tmas: NaN, gN: -1, gQ: NaN, gMode: '', gWarn: -1, river: NaN, dCrest: NaN, dHead: NaN, tmasD: NaN, wt: false };
  function updateLabels(view) {
    const pzs = view.piezometers;
    for (let i = 0; i < L.pz.length && i < pzs.length; i++) {
      const p = pzs[i];
      const d = Math.round(p.depthCm * 10);
      const tp = p.isTP ? (p.ppCompliant ? 1 : 0) : 2;
      if (LS.pzD[i] === d && LS.pzCls[i] === p.cls && LS.pzTp[i] === tp) continue;
      LS.pzD[i] = d;
      LS.pzCls[i] = p.cls;
      LS.pzTp[i] = tp;
      const txt = `${p.id} · ${fmtElevClassCm(p.depthCm)}`;
      const aria = `Piezometer ${p.id}: muka air ${fmtElevClassCm(p.depthCm)} (${depthPhraseClass(p.depthCm)}), kategori ${p.cls.label}` +
        (p.isTP ? `, titik penaatan: ${p.ppCompliant ? 'patuh' : 'tidak patuh'} PP 57/2016 (≤ 40 cm)` : '');
      labels.setContent(
        L.pz[i],
        `${txt}|${p.cls.id}|${tp}`,
        () => {
          const sw = labels.span(`sc-sw st-${p.cls.id}`, p.cls.icon);
          sw.setAttribute('aria-hidden', 'true');
          // nama kategori: selalu di titik penaatan (berdampingan dengan tag PP), piezometer lain hanya di layar lebar
          const parts = [sw, labels.span('sc-txt', txt), labels.span(`sc-cat${p.isTP ? ' is-tp' : ''}`, p.cls.label)];
          if (p.isTP) parts.push(labels.span(`sc-tag ${p.ppCompliant ? 'is-ok' : 'is-bad'}`, tpTagText(p.ppCompliant)));
          return parts;
        },
        aria,
      );
    }
    const c = view.canal;
    const t = Math.round(c.tmasCm * 10);
    if (LS.tmas !== t) {
      LS.tmas = t;
      const txt = `TMAS ${fmtElevCm(c.tmasCm)}`;
      labels.setContent(L.gauge, txt, () => [labels.span('sc-txt', txt)], `Papan duga G2: TMAS ${fmtElevCm(c.tmasCm)} dari tanggul`);
    }
    const st = view.structure;
    const q = Math.round(st.q_m3s * 1e4);
    const warnCode = gateWarnCode(st, view.river.levelM, view.canal.levelM);
    if (LS.gN !== st.nLogs || LS.gQ !== q || LS.gMode !== st.mode || LS.gWarn !== warnCode) {
      LS.gN = st.nLogs;
      LS.gQ = q;
      LS.gMode = st.mode;
      LS.gWarn = warnCode;
      const qs = fmtQ(st.q_m3s);
      const warn = GATE_WARN[warnCode];
      const mode = st.mode === 'auto' ? 'OTOMATIS' : 'MANUAL';
      labels.setContent(
        L.gate,
        `${st.nLogs}|${qs}|${mode}|${warn}`,
        () => {
          const parts = [labels.span('sc-txt', `Stoplog ${st.nLogs} · Q ${qs}`), labels.span(`sc-mode ${st.mode === 'auto' ? 'is-auto' : ''}`, mode)];
          if (warn) parts.push(labels.span('sc-warn', `⚠ ${warn}`));
          return parts;
        },
        `Pintu air: ${st.nLogs} stoplog, debit ${qs}, mode ${mode.toLowerCase()}${warn ? `, peringatan: ${warn.toLowerCase()}` : ''}`,
      );
    }
    const r = Math.round(view.river.levelM * 1000);
    const h10 = Math.round(st.headCm * 10);
    if (LS.river !== r || LS.dCrest !== st.crestM || LS.dHead !== h10 || LS.tmasD !== t) {
      const riverChanged = LS.river !== r;
      LS.river = r;
      LS.dCrest = st.crestM;
      LS.dHead = h10;
      LS.tmasD = t;
      const riv = `${fmtSigned(view.river.levelM * 100, 0)} cm`;
      const up = `Hulu · TMAS ${fmtElevCm(c.tmasCm)}`;
      const down = `Hilir · sungai ${riv}`;
      const crest = `Mercu ${fmtElevCm(-st.crestM * 100)} · H ${fmt(st.headCm, 1)} cm`;
      labels.setContent(L.up, up, () => [labels.span('sc-txt', up)], `Muka air hulu pintu air (TMAS) ${fmtElevCm(c.tmasCm)} dari tanggul`);
      labels.setContent(L.down, down, () => [labels.span('sc-txt', down)], `Muka air hilir (sungai) ${riv} terhadap tanggul`);
      labels.setContent(L.crest, crest, () => [labels.span('sc-txt', crest)], `Mercu stoplog ${fmtElevCm(-st.crestM * 100)} dari tanggul, tinggi luapan H ${fmt(st.headCm, 1)} cm`);
      if (riverChanged) {
        const rt = `Sungai · ${riv}`;
        labels.setContent(L.river, rt, () => [labels.span('sc-txt', rt)], `Sungai: muka air ${riv} terhadap tanggul`);
      }
    }
    if (!LS.wt) {
      LS.wt = true;
      labels.setContent(L.wt, 'wt', () => [labels.span('sc-ico', '▽'), labels.span('sc-txt', 'Muka air tanah')], 'Muka air tanah (garis freatik)');
    }
  }

  function applyView(view, nowMs) {
    world.terrain.update(view, ve);
    world.water.update(view);
    const anchors = world.section.update(view, !!opts.particles);
    L.unsat.obj.position.copy(anchors.unsat);
    labels.setVisible(L.unsat, cutEff && anchors.unsatThick > 0.06);
    L.sat.obj.position.copy(anchors.sat);
    L.wt.obj.position.copy(anchors.wt);
    const gz = WORLD.mainZ + 0.4;
    L.up.obj.position.set(WORLD.gateX - 15, Math.max(view.canal.levelM, P.geom.main.zBed) * ve + 2.2, gz);
    L.down.obj.position.set(WORLD.gateX + 10.5, view.river.levelM * ve + 2.2, gz);
    L.crest.obj.position.set(WORLD.gateX - 0.2, view.structure.crestM * ve, gz);
    world.instruments.update(view);
    gate.update(view, nowMs);
    rain.set(view.forcing.rain_mmh, quality === 'rendah' ? 1000 : 3000, rig.controls.target, ve);
    world.flow.set(view, ve, cutEff, renderer.getPixelRatio());
    applyParticles();
    const r24 = view.forcing.rain24h_mm;
    const x = Math.min(Math.max(r24 / 60, 0), 1);
    cloudTarget = x * x * (3 - 2 * x);
    updateLabels(view);
  }

  function applyCloud(c) {
    sky.setCloud(c);
    const hz = sky.horizonColor();
    horizon.setCloud(c, hz);
    scene.fog.color.copy(hz);
    sun.intensity = PALETTE.sun[0] + (PALETTE.sun[1] - PALETTE.sun[0]) * c;
    hemi.intensity = PALETTE.hemi[0] + (PALETTE.hemi[1] - PALETTE.hemi[0]) * c;
  }

  function updateFog() {
    // kabut relatif jarak kamera–target (desain), dengan batas bawah agar pandangan dekat tidak pudar
    const dist = camera.position.distanceTo(rig.controls.target);
    scene.fog.near = 0.9 * dist + 120;
    scene.fog.far = scene.fog.near + (2.2 * dist + 500) * (1 - 0.45 * cloud);
    sky.mesh.position.copy(camera.position);
  }

  // ---------- render ----------
  const lastInfo = { calls: 0, triangles: 0 };
  function render() {
    updateFog();
    renderer.render(scene, camera);
    lastInfo.calls = renderer.info.render.calls;
    lastInfo.triangles = renderer.info.render.triangles;
    labels.render(scene, camera, size.w, size.h, occluded);
  }

  /** Label di belakang bidang potong (dilihat dari depan saat cutaway) disembunyikan. */
  function occluded(pos, it) {
    const c = camera.position;
    if (it.maxDist && c.distanceTo(pos) > it.maxDist) return true;
    if (it.section) {
      // label zona penampang hanya bila kamera berada di depan muka potong (bukan dari atas)
      const d = c.distanceTo(pos);
      return c.z < 15 || (c.z - pos.z) / d < 0.3;
    }
    if (!cutEff || it.kind !== 'pin') return false;
    if (c.z <= 0.5 || pos.z >= -1) return false;
    const t = c.z / (c.z - pos.z);
    const y = c.y + (pos.y - c.y) * t;
    return y < 0.3 * ve + 11 && y > MINERAL_BASE * ve - 1;
  }

  function resize() {
    // kontainer tersembunyi (tab lain aktif) → ukuran 0: biarkan ukuran lama
    if (!container.clientWidth || !container.clientHeight) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === size.w && h === size.h) return;
    size = { w, h };
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    rig.setAspect(w / h);
    needsRender = true;
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    resize();
    if (needsRender) render();
  }) : null;
  ro?.observe(container);
  resize();

  // ---------- picking ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  let hoverPending = null;
  function pickables() {
    const list = [...world.instruments.pickables, ...gate.pickables];
    if (cutEff) list.push(world.section.face, world.section.notch);
    return list;
  }
  function hitAt(clientX, clientY, withOcclusion) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables(), false);
    if (!hits.length) return null;
    const h = hits[0];
    if (withOcclusion) {
      const t = raycaster.intersectObject(world.terrain.mesh, false);
      if (t.length && t[0].distance < h.distance - 2 && h.object !== world.section.face) return null;
    }
    const pk = h.object.userData.pick;
    if (!pk) return null;
    let id = pk.id;
    if (pk.ids && h.instanceId != null) id = pk.ids[h.instanceId];
    return { type: pk.type, id };
  }
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const dt = performance.now() - down.t;
    down = null;
    if (moved > 6 || dt > 700) return;
    const hit = hitAt(e.clientX, e.clientY, true);
    if (!hit) return;
    const c = container.getBoundingClientRect();
    onPick?.({ ...hit, screenX: e.clientX - c.left, screenY: e.clientY - c.top, clientX: e.clientX, clientY: e.clientY, source: 'raycast' });
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons) return;
    hoverPending = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerleave', () => {
    hoverPending = null;
    canvas.style.cursor = '';
  });

  // ---------- inisialisasi ----------
  applyQualityDeps();
  applyVE(ve);
  applyCut();
  applyCloud(0);
  labels.setEnabled(!!opts.labels);
  rig.setPreset(opts.camera ?? 'ikhtisar', ve, size.w / size.h, { instant: true, cutaway: !!opts.cutaway });
  applyCut();

  const api = {
    canvas,
    frame(view, dtSec = 0, playing = false, force = false) {
      const now = performance.now();
      let dirty = needsRender;
      needsRender = false;
      if (view && (view !== lastView || force)) {
        applyView(view, now);
        // lompatan waktu (⏭, ganti skenario, Ulang) saat dijeda: langit langsung ke keadaan baru tanpa transisi
        if (force && !playing && Math.abs(cloudTarget - cloud) > 0.002) {
          cloud = cloudTarget;
          applyCloud(cloud);
        }
        lastView = view;
        dirty = true;
      }
      if (rig.update(now)) dirty = true;
      // gerak dikurangi: garis hujan, partikel aliran, dan gulir nappe diam (tetap tampil sebagai penanda)
      const moving = playing && !reduceMotion;
      if (gate.animate(dtSec, now, moving)) dirty = true;
      // mendung dihaluskan (τ 0,6 s, waktu nyata)
      const wall = Math.min(1, Math.max(0, (now - lastCloudMs) / 1000));
      lastCloudMs = now;
      if (Math.abs(cloudTarget - cloud) > 0.002) {
        const k = wall > 0 ? 1 - Math.exp(-wall / 0.6) : 0;
        cloud += (cloudTarget - cloud) * k;
        if (Math.abs(cloudTarget - cloud) <= 0.002) cloud = cloudTarget;
        if (k > 0) {
          applyCloud(cloud);
          dirty = true;
        }
      }
      if (playing) {
        if (opts.particles && moving) {
          rain.tick(dtSec);
          world.flow.tick(dtSec);
        }
        dirty = true;
      }
      if (hoverPending) {
        const hp = hoverPending;
        hoverPending = null;
        canvas.style.cursor = hitAt(hp.x, hp.y, false) ? 'pointer' : '';
      }
      if (dirty || force) render();
    },
    render,
    resize() {
      resize();
      needsRender = true;
    },
    setOptions(o = {}) {
      const prev = { ...opts };
      Object.assign(opts, o);
      if (opts.quality !== quality) {
        quality = opts.quality;
        disposeWorld();
        buildWorld();
        scene.remove(rain.object);
        rain.dispose();
        rain = createRain(cutPlane, quality === 'rendah' ? 1000 : 3000);
        scene.add(rain.object);
        applyQualityDeps();
        rebindLabels();
        applyVE(ve);
        applyCut();
      }
      if (opts.ve !== ve) applyVE(opts.ve);
      if (opts.cutaway !== prev.cutaway) applyCut();
      if (opts.labels !== prev.labels) labels.setEnabled(!!opts.labels);
      if (opts.particles !== prev.particles) applyParticles();
      lastView = null;
      needsRender = true;
    },
    setCamera(id, { instant = false } = {}) {
      rig.setPreset(id, ve, size.w / size.h, { instant, cutaway: !!opts.cutaway || id === 'penampang' });
      applyCut();
      needsRender = true;
    },
    rebuild(params2) {
      // bangun ulang hanya bila geometri yang digambar berubah (mahal: mesh + kompilasi shader)
      const key = (q) => `${q.geom.Hd}|${q.fieldDrains.enabled}|${q.fieldDrains.spacing}|${q.fieldDrains.depth}|${q.geom.Lh}|${q.geom.zBase}`;
      if (params2 && key(params2) === key(P)) {
        P = params2;
        needsRender = true;
        return;
      }
      P = params2 ?? P;
      ctx = makeGroundCtx(P);
      disposeWorld();
      buildWorld();
      rebindLabels();
      applyVE(ve);
      applyCut();
      LS.pzD.fill(NaN);
      lastView = null;
      needsRender = true;
    },
    renderInfo() {
      return { webgl2: renderer.capabilities.isWebGL2, calls: lastInfo.calls, triangles: lastInfo.triangles };
    },
    setPose(pos, target) {
      rig.setPose(pos, target);
      needsRender = true;
      render();
    },
    debugNaN() {
      const bad = [];
      scene.traverse((o) => {
        const p = o.geometry?.attributes?.position;
        if (!p) return;
        for (let i = 0; i < p.array.length; i++) {
          if (!Number.isFinite(p.array[i])) {
            bad.push(`${o.name || o.type}@${i}`);
            break;
          }
        }
      });
      return bad;
    },
    debugInfo() {
      const tris = {};
      scene.traverseVisible((o) => {
        if (!o.isMesh || !o.geometry) return;
        const g = o.geometry;
        const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
        const inst = o.isInstancedMesh ? o.count : 1;
        tris[o.name || o.type] = (tris[o.name || o.type] ?? 0) + Math.round(n * inst);
      });
      return {
        tris,
        ve,
        quality,
        cutaway: cutEff,
        preset: rig.preset,
        palms: world.palms.counts(),
        camera: camera.position.toArray(),
        target: rig.controls.target.toArray(),
        rain: rain.count,
        rainTime: rain.time,
        reduceMotion,
        cloud,
        shadows: sun.castShadow,
        pond: !!world.water.pond?.visible,
        planks: gate.debug(),
        nappe: gate.root[1].visible,
        flow: world.flow.object.visible,
        sectionVisible: world.section.face.visible,
      };
    },
    /** Proyeksi titik dunia → piksel CSS relatif kanvas (untuk tes klik/raycast). */
    project(p) {
      _proj.set(p[0], p[1], p[2]).project(camera);
      return { x: (_proj.x * 0.5 + 0.5) * size.w, y: (-_proj.y * 0.5 + 0.5) * size.h, inFront: _proj.z < 1 };
    },
    /** Titik jangkar instrumen (dunia) untuk tes. */
    anchors() {
      return {
        piezometers: world.instruments.anchors.map((a) => a.toArray()),
        gate: gate.anchor.toArray(),
      };
    },
    dispose() {
      ro?.disconnect();
      themeObserver?.disconnect();
      mqDark?.removeEventListener?.('change', applyTheme);
      mqReduce?.removeEventListener?.('change', onReduce);
      rig.dispose();
      disposeWorld();
      gate.dispose();
      farGround.dispose();
      cutFloor.dispose();
      sky.dispose();
      horizon.dispose();
      rain.dispose();
      labels.dispose();
      renderer.dispose();
      canvas.remove();
      if (active === api) active = null;
    },
  };

  function rebindLabels() {
    placeAnchors();
  }

  active = api;
  return api;
}

