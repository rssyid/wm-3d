// Label CSS2D sebagai <button> (bisa difokus): piezometer, papan duga (TMAS), pintu air, sungai, zona penampang.
// Teks hanya ditulis ulang bila berubah. Tumpang-tindih dihindari dengan menggeser label ke atas (garis penunjuk).
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const _v = new THREE.Vector3();

/** Peringatan pintu air (teks label; istilah sama dengan KPI): 0 tidak ada, 1 terendam, 2 aliran balik, 3 klep menutup. */
export const GATE_WARN = Object.freeze(['', 'Terendam', 'Aliran balik ke saluran', 'Klep menutup']);

/**
 * Kode peringatan pintu air dari snapshot `structure` dan muka air sungai/saluran (m).
 * Aliran balik (Q < 0) didahulukan; klep menutup bila pintu klep aktif dan sungai di atas saluran (Q ≈ 0);
 * terendam bila muka air hilir di atas mercu sementara air masih keluar (aliran diperlambat, Villemonte).
 */
export function gateWarnCode(st, riverM, canalM) {
  if (st.q_m3s < -1e-5) return 2;
  if (st.flapGate && riverM > canalM && riverM > st.crestM) return 3;
  if (st.submerged || st.riverAboveCrest) return 1;
  return 0;
}

/** Teks tag kepatuhan PP 57/2016 di label piezometer titik penaatan (TP). */
export function tpTagText(ok) {
  return ok ? 'TP · PP ✓ patuh' : 'TP · PP ✗ tidak patuh';
}

/**
 * Penempatan rakus (murni). items: {x, y, w, h, fixed, base, priority, visible} (px layar).
 * Bila `width` diberikan, label 'pin' lebih dulu digeser ke dalam viewport (≤ ½·lebar − 6 px, garis penunjuk tetap
 * menyentuh label) — sebelum uji tabrakan, supaya penjepitan tidak membuat label kembali bertumpuk.
 * Label 'pin' lalu dicoba di ketinggian dasar dengan geseran horizontal kecil (≤ 0,4·lebar); bila masih bertabrakan,
 * label dinaikkan. Label tetap ('zone') yang bertabrakan disembunyikan.
 * Kembalian: offset vertikal per label (−1 = sembunyikan); geseran horizontal di `declutter.dx` (larik paralel).
 */
export function declutter(items, gap = 3, maxIter = 10, width = 0, margin = 4) {
  const placed = [];
  const out = new Array(items.length).fill(0);
  const dxs = new Array(items.length).fill(0);
  const order = items.map((_, i) => i).sort((a, b) => (items[b].fixed ? 1 : 0) - (items[a].fixed ? 1 : 0) || items[a].priority - items[b].priority);
  const hitAt = (l, r, t, b) => {
    for (const p of placed) if (l < p.r + gap && r > p.l - gap && t < p.b + gap && b > p.t - gap) return p;
    return null;
  };
  const lim = (it) => Math.max(0, it.w / 2 - 6);
  /** Geseran agar [x − w/2, x + w/2] di dalam [margin, width − margin], dibatasi ±(w/2 − 6). */
  const clampDx = (it, d) => {
    if (!(width > 0)) return d;
    const x = it.x + d;
    if (x - it.w / 2 < margin) d += margin - (x - it.w / 2);
    else if (x + it.w / 2 > width - margin) d += width - margin - (x + it.w / 2);
    return Math.max(-lim(it), Math.min(lim(it), d));
  };
  const inside = (it, d) => !(width > 0) || (it.x + d - it.w / 2 >= margin - 0.5 && it.x + d + it.w / 2 <= width - margin + 0.5);
  for (const i of order) {
    const it = items[i];
    if (!it.visible) continue;
    if (it.fixed) {
      const rect = { l: it.x - it.w / 2, r: it.x + it.w / 2, t: it.y - it.h / 2, b: it.y + it.h / 2 };
      if (placed.some((p) => rect.l < p.r && rect.r > p.l && rect.t < p.b && rect.b > p.t)) {
        out[i] = -1;
        continue;
      }
      placed.push(rect);
      continue;
    }
    const dx0 = clampDx(it, 0);
    const maxShift = 0.4 * it.w;
    let off = it.base;
    let dx = dx0;
    const b0 = it.y - off;
    const x0 = it.x + dx0;
    const first = hitAt(x0 - it.w / 2, x0 + it.w / 2, b0 - it.h, b0);
    if (first) {
      // coba geser kanan/kiri secukupnya pada ketinggian dasar (tetap di dalam viewport & dekat jangkar)
      const right = first.r + gap - (x0 - it.w / 2) + 1;
      const left = first.l - gap - (x0 + it.w / 2) - 1;
      const cands = [right, left]
        .map((d) => dx0 + d)
        .filter((d) => Math.abs(d) <= Math.max(maxShift, Math.abs(dx0)) && Math.abs(d) <= lim(it) + 0.5 && inside(it, d))
        .sort((p, q) => Math.abs(p - dx0) - Math.abs(q - dx0));
      let ok = false;
      for (const d of cands) {
        if (!hitAt(it.x + d - it.w / 2, it.x + d + it.w / 2, b0 - it.h, b0)) {
          dx = d;
          ok = true;
          break;
        }
      }
      if (!ok) {
        for (let k = 0; k < maxIter; k++) {
          const b = it.y - off;
          const hit = hitAt(x0 - it.w / 2, x0 + it.w / 2, b - it.h, b);
          if (!hit) break;
          off = it.y - hit.t + gap;
        }
      }
    }
    out[i] = off;
    dxs[i] = dx;
    placed.push({ l: it.x + dx - it.w / 2, r: it.x + dx + it.w / 2, t: it.y - off - it.h, b: it.y - off });
  }
  declutter.dx = dxs;
  return out;
}

export function createLabels(container, { onPick } = {}) {
  const css = new CSS2DRenderer();
  css.domElement.className = 'sc-labels';
  css.domElement.setAttribute('role', 'group');
  css.domElement.setAttribute('aria-label', 'Label objek 3D (klik untuk rincian)');
  container.appendChild(css.domElement);
  const root = new THREE.Group();
  root.name = 'label';
  const items = [];
  let enabled = true;

  /**
   * Tambah label. kind 'pin' (di atas jangkar, dengan garis penunjuk) atau 'zone' (berpusat).
   * pick: {type, id}; priority kecil = ditempatkan dulu.
   */
  function add({ key, kind = 'pin', pick, priority = 5, className = '', base = 12, maxDist = 0, section = false }) {
    const anchor = document.createElement('div');
    anchor.className = `sc-anchor sc-${kind} ${className}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sc-label';
    btn.dataset.scene = key;
    if (kind === 'pin') {
      const leader = document.createElement('span');
      leader.className = 'sc-leader';
      leader.setAttribute('aria-hidden', 'true');
      anchor.append(leader);
    }
    anchor.append(btn);
    btn.addEventListener('click', (e) => {
      if (!pick || !onPick) return;
      const r = btn.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      e.stopPropagation();
      onPick({ type: pick.type, id: pick.id, screenX: cx - c.left, screenY: cy - c.top, clientX: cx, clientY: cy, source: 'label' });
    });
    const obj = new CSS2DObject(anchor);
    obj.center.set(0, 0);
    root.add(obj);
    const it = { key, kind, obj, anchor, btn, pick, priority, base, maxDist, section, text: '', html: '', w: 0, h: 22, wDirty: true, off: -1, visible: true, want: true, occ: false, dx: 0, col: false };
    items.push(it);
    return it;
  }

  /** Isi tombol: parts = [{cls, text, style?}] — hanya ditulis bila berubah. */
  function setContent(it, key, build, ariaLabel) {
    if (it.html === key) return false;
    it.html = key;
    it.btn.replaceChildren(...build());
    if (ariaLabel) it.btn.setAttribute('aria-label', ariaLabel);
    it.wDirty = true;
    return true;
  }

  function span(cls, text) {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  }

  function setVisible(it, v) {
    it.want = v;
    const vis = v && enabled;
    if (it.obj.visible !== vis) it.obj.visible = vis;
  }

  function measure() {
    for (const it of items) {
      if (it.wDirty && it.obj.visible && it.anchor.style.display !== 'none') {
        it.w = it.btn.offsetWidth || it.w;
        it.h = it.btn.offsetHeight || it.h;
        it.wDirty = false;
      }
    }
  }

  const layoutBuf = [];
  /** Setelah render CSS2D: hitung posisi layar dan geser label agar tidak bertumpuk. */
  let lastSig = NaN;
  function layout(camera, width, height, occluded) {
    measure();
    let sig = width * 7 + height * 13;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let vis = it.obj.visible && it.anchor.style.display !== 'none';
      _v.setFromMatrixPosition(it.obj.matrixWorld);
      const occ = vis && occluded ? occluded(_v, it) : false;
      if (occ !== it.occ) {
        it.occ = occ;
        it.anchor.classList.toggle('is-occluded', occ);
      }
      if (occ) vis = false;
      _v.project(camera);
      // objek tata letak dipakai ulang (tanpa alokasi per frame)
      const b = (layoutBuf[i] ??= { x: 0, y: 0, w: 0, h: 0, fixed: false, priority: 0, base: 0, visible: false });
      b.x = (_v.x * 0.5 + 0.5) * width;
      b.y = (-_v.y * 0.5 + 0.5) * height;
      b.w = it.w;
      b.h = it.h;
      b.fixed = it.kind === 'zone';
      b.priority = it.priority;
      b.base = it.base;
      b.visible = vis && _v.z < 1;
      sig += (b.visible ? 1 : 0) * (i + 1) * 0.37 + Math.round(b.x) * (i + 3) + Math.round(b.y) * (i + 5) * 1.3 + b.w * 0.11 + b.h * 0.07;
    }
    if (sig === lastSig) return; // kamera & label tidak berubah → tata letak tetap
    lastSig = sig;
    const offs = declutter(layoutBuf, 3, 10, width);
    const shifts = declutter.dx;
    items.forEach((it, i) => {
      const col = offs[i] === -1;
      if (col !== !!it.col) {
        it.col = col;
        it.anchor.classList.toggle('is-collide', col);
      }
      // label 'pin' sudah dijepit ke viewport oleh declutter; label zona digeser ke dalam di sini
      const b = layoutBuf[i];
      let dx = Math.round(shifts[i] || 0);
      if (b.fixed && b.visible && b.w > 0) {
        const m = 4;
        const x = b.x + dx;
        if (x - b.w / 2 < m) dx += m - (x - b.w / 2);
        else if (x + b.w / 2 > width - m) dx += width - m - (x + b.w / 2);
        dx = Math.round(Math.max(-b.w / 2 + 6, Math.min(b.w / 2 - 6, dx)));
      }
      if (dx !== it.dx) {
        it.dx = dx;
        it.anchor.style.setProperty('--dx', `${dx}px`);
      }
      if (it.kind !== 'pin') return;
      const o = Math.round(offs[i]);
      if (o !== it.off) {
        it.off = o;
        it.anchor.style.setProperty('--off', `${o}px`);
      }
    });
  }

  return {
    css,
    root,
    items,
    add,
    setContent,
    span,
    setVisible,
    setEnabled(v) {
      enabled = v;
      for (const it of items) setVisible(it, it.want);
      css.domElement.hidden = !v;
    },
    setSize(w, h) {
      css.setSize(w, h);
      // lebar tombol bisa berubah lewat container query (mis. nama kategori disembunyikan) → ukur ulang
      for (const it of items) it.wDirty = true;
    },
    render(scene, camera, width, height, occluded) {
      if (!enabled) return;
      css.render(scene, camera);
      layout(camera, width, height, occluded);
    },
    dispose() {
      for (const it of items) root.remove(it.obj);
      css.domElement.remove();
    },
  };
}
