// Instrumen: piezometer P1–P4 (pipa transparan, kolom air, cincin status kategori perusahaan + garis putih,
// cincin titik penaatan merah bila tidak patuh PP) dan papan duga G1/G2 (tanda E tiap 5 cm, angka tiap 10 cm).
// Bagian bawah tanah diskalakan VE secara manual (ruang root); tutup pipa & kepala papan berukuran asli.
import * as THREE from 'three';
import { piezometerPositions, gaugePositions } from './layout.js';
import { PALETTE } from './palette.js';
import { makeCanvas, redrawCanvasTexture } from './textures.js';
import { fmt } from '../ui/format.js';

const PIPE_BOTTOM = -3.0; // m (kedalaman pipa piezometer)
const STICK_UP = 0.5; // m di atas permukaan (tidak diskalakan)
const GAUGE_BOTTOM = -2.5;
const GAUGE_W = 1.3;

/** Gambar papan duga: 0 di tanggul, negatif ke bawah; E tiap 5 cm, angka (cm) tiap 10 cm. */
function drawGauge(canvas, ve) {
  const hM = 0 - GAUGE_BOTTOM;
  const W = 96;
  const pxPerM = Math.min(Math.max((W / GAUGE_W) * ve, 40), 1600);
  const H = Math.max(64, Math.min(4096, Math.round(hM * pxPerM)));
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f7f7f2';
  ctx.fillRect(0, 0, W, H);
  const y = (cm) => (-cm / (hM * 100)) * H; // cm ≤ 0
  const cmPx = H / (hM * 100);
  // E: tiap 5 cm, bergantian kiri/kanan; meter pertama merah
  for (let cm = 0; cm > GAUGE_BOTTOM * 100; cm -= 5) {
    const top = y(cm);
    const left = (Math.round(-cm / 5) % 2 === 0);
    ctx.fillStyle = cm > -100 ? '#c8261e' : '#151515';
    const x0 = left ? 4 : 30;
    const ew = 26;
    if (cmPx * 5 < 6) {
      ctx.fillRect(x0, top, ew, Math.max(1, cmPx * 5 * 0.5));
      continue;
    }
    ctx.fillRect(left ? x0 : x0 + ew - 5, top, 5, cmPx * 5); // tulang
    for (let b = 0; b < 3; b++) ctx.fillRect(x0, top + b * 2 * cmPx, ew, cmPx);
  }
  // angka tiap 10 cm (atau 50 cm bila terlalu rapat)
  const stepCm = cmPx * 10 >= 18 ? 10 : cmPx * 50 >= 18 ? 50 : 100;
  const fs = Math.max(9, Math.min(26, cmPx * stepCm * 0.62));
  ctx.font = `600 ${fs}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  for (let cm = 0; cm > GAUGE_BOTTOM * 100 + 1e-9; cm -= stepCm) {
    ctx.fillStyle = cm > -100 ? '#c8261e' : '#151515';
    ctx.fillText(cm === 0 ? '0' : fmt(cm, 0), W - 4, y(cm) + 2);
  }
  ctx.strokeStyle = '#151515';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
}

export function createInstruments(params, ctxSurface) {
  const group = new THREE.Group();
  group.name = 'instrumen';
  const pz = piezometerPositions(params);
  const n = pz.length;

  const pipeGeo = new THREE.CylinderGeometry(0.42, 0.42, 1, 14, 1, true);
  pipeGeo.translate(0, 0.5, 0);
  const colGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 12, 1, false);
  colGeo.translate(0, 0.5, 0);
  const bandGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.55, 28, 1, true);
  bandGeo.translate(0, 0.42, 0);
  const lineGeo = new THREE.CylinderGeometry(1.44, 1.44, 0.85, 28, 1, true);
  lineGeo.translate(0, 0.42, 0);
  const tpGeo = new THREE.CylinderGeometry(2.35, 2.35, 0.32, 32, 1, true);
  tpGeo.translate(0, 0.2, 0);
  const capGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.22, 14);

  const pipeMat = new THREE.MeshPhongMaterial({ color: PALETTE.pipe, emissive: 0x3a3a3a, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, shininess: 80 });
  const colMat = new THREE.MeshLambertMaterial({ color: PALETTE.pipeWater, emissive: 0x0b3fae });
  const bandMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide });
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.outline, toneMapped: false, side: THREE.DoubleSide });
  const tpMat = new THREE.MeshBasicMaterial({ color: PALETTE.tpOk, toneMapped: false, side: THREE.DoubleSide });
  const capMat = new THREE.MeshLambertMaterial({ color: PALETTE.cap });

  const pipes = new THREE.InstancedMesh(pipeGeo, pipeMat, n);
  pipes.name = 'piezometer-pipa';
  pipes.renderOrder = 5;
  const cols = new THREE.InstancedMesh(colGeo, colMat, n);
  cols.name = 'piezometer-kolom-air';
  const bands = new THREE.InstancedMesh(bandGeo, bandMat, n);
  bands.name = 'piezometer-cincin';
  const lines = new THREE.InstancedMesh(lineGeo, lineMat, n);
  lines.name = 'piezometer-garis';
  const caps = new THREE.InstancedMesh(capGeo, capMat, n);
  caps.name = 'piezometer-tutup';
  const tp = new THREE.Mesh(tpGeo, tpMat);
  tp.name = 'titik-penaatan';
  for (const m of [pipes, cols, bands, lines, caps]) {
    m.frustumCulled = false;
    m.userData.pick = { type: 'piezometer', ids: pz.map((p) => p.id) };
  }
  tp.userData.pick = { type: 'piezometer', id: null };
  group.add(cols, lines, bands, tp, caps, pipes);

  // ---- papan duga ----
  const gauges = gaugePositions();
  const gCanvas = makeCanvas(96, 256);
  const gHolder = { canvas: gCanvas, texture: null };
  const gMat = new THREE.MeshLambertMaterial({ emissive: 0x202020 });
  const boardGeo = new THREE.PlaneGeometry(GAUGE_W, 1);
  boardGeo.translate(0, -0.5, 0);
  const headGeo = new THREE.BoxGeometry(GAUGE_W + 0.2, 0.5, 0.18);
  headGeo.translate(0, 0.25, -0.02);
  const postGeo = new THREE.BoxGeometry(0.22, 1, 0.22);
  postGeo.translate(0, -0.5, -0.12);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xc8261e });
  const postMat = new THREE.MeshLambertMaterial({ color: 0x6b6b66 });
  const boards = gauges.map((g) => {
    const grp = new THREE.Group();
    grp.name = `papan-duga-${g.id}`;
    const board = new THREE.Mesh(boardGeo, gMat);
    board.userData.pick = { type: 'gauge', id: g.id };
    const head = new THREE.Mesh(headGeo, headMat);
    head.userData.pick = { type: 'gauge', id: g.id };
    const post = new THREE.Mesh(postGeo, postMat);
    grp.add(post, board, head);
    grp.position.set(g.X, 0, g.Z);
    group.add(grp);
    return { g, grp, board, head, post };
  });

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  const surf = pz.map((pp) => ctxSurface(pp.X, pp.Z));
  const anchors = pz.map(() => new THREE.Vector3());
  const gaugeAnchors = gauges.map(() => new THREE.Vector3());
  let ve = 10;
  let lastVe = -1;
  const last = { levels: new Float64Array(n).fill(NaN), cls: new Array(n).fill(''), tp: NaN };

  function placeStatic() {
    for (let i = 0; i < n; i++) {
      const ys = surf[i] * ve;
      const yb = PIPE_BOTTOM * ve;
      m4.compose(p.set(pz[i].X, yb, pz[i].Z), q, s.set(1, ys - yb + STICK_UP, 1));
      pipes.setMatrixAt(i, m4);
      m4.compose(p.set(pz[i].X, ys, pz[i].Z), q, s.set(1, 1, 1));
      bands.setMatrixAt(i, m4);
      lines.setMatrixAt(i, m4);
      m4.compose(p.set(pz[i].X, ys + STICK_UP + 0.11, pz[i].Z), q, s.set(1, 1, 1));
      caps.setMatrixAt(i, m4);
      anchors[i].set(pz[i].X, ys + STICK_UP + 0.4, pz[i].Z);
    }
    for (const m of [pipes, bands, lines, caps]) {
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
    // papan duga: dari −2,5 m (×VE) sampai tanggul (0), kepala 0,5 m tidak diskalakan
    if (lastVe !== ve) {
      drawGauge(gCanvas, ve);
      redrawCanvasTexture(gHolder, gMat, { mipmaps: true });
      lastVe = ve;
    }
    boards.forEach((b, i) => {
      b.board.scale.set(1, -GAUGE_BOTTOM * ve, 1);
      b.post.scale.set(1, -GAUGE_BOTTOM * ve + 0.3, 1);
      b.board.position.set(0, 0, 0);
      b.head.position.set(0, 0.02, 0);
      gaugeAnchors[i].set(b.g.X, 0.9, b.g.Z);
    });
    last.levels.fill(NaN);
  }
  placeStatic();

  return {
    group,
    pipes,
    anchors,
    gaugeAnchors,
    ids: pz.map((pp) => pp.id),
    gauges,
    pickables: [pipes, cols, bands, lines, caps, tp, ...boards.flatMap((b) => [b.board, b.head])],
    setVE(v) {
      ve = v;
      placeStatic();
    },
    /** Kolom air & warna status dari snapshot; true bila berubah. */
    update(view) {
      let changed = false;
      const list = view.piezometers;
      let tpIndex = -1;
      for (let i = 0; i < n && i < list.length; i++) {
        const pzv = list[i];
        if (pzv.isTP) tpIndex = i;
        const lv = pzv.levelM;
        if (!(Math.abs(lv - last.levels[i]) < 5e-4)) {
          last.levels[i] = lv;
          const ys = surf[i] * ve;
          const top = Math.min(lv * ve, ys + STICK_UP - 0.05);
          const yb = PIPE_BOTTOM * ve;
          m4.compose(p.set(pz[i].X, yb, pz[i].Z), q, s.set(1, Math.max(0.01, top - yb), 1));
          cols.setMatrixAt(i, m4);
          cols.instanceMatrix.needsUpdate = true;
          changed = true;
        }
        const cid = pzv.cls.color;
        if (cid !== last.cls[i]) {
          last.cls[i] = cid;
          bands.setColorAt(i, c.set(cid));
          bands.instanceColor.needsUpdate = true;
          changed = true;
        }
      }
      if (changed) cols.computeBoundingSphere();
      const tpState = tpIndex < 0 ? -1 : tpIndex * 1000 + (list[tpIndex].ppCompliant ? 100 : 0) + ve;
      if (tpState !== last.tp) {
        last.tp = tpState;
        tp.visible = tpIndex >= 0;
        if (tpIndex >= 0) {
          tp.position.set(pz[tpIndex].X, surf[tpIndex] * ve, pz[tpIndex].Z);
          tpMat.color.setHex(list[tpIndex].ppCompliant ? PALETTE.tpOk : PALETTE.tpBad);
          tp.userData.pick.id = pz[tpIndex].id;
        }
        changed = true;
      }
      return changed;
    },
    dispose() {
      for (const g of [pipeGeo, colGeo, bandGeo, lineGeo, tpGeo, capGeo, boardGeo, headGeo, postGeo]) g.dispose();
      for (const m of [pipeMat, colMat, bandMat, lineMat, tpMat, capMat, gMat, headMat, postMat]) m.dispose();
      gHolder.texture?.dispose();
    },
  };
}
