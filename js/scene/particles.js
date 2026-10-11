// Partikel: garis hujan (jumlah ∝ √(min(I,30)/30), animasi di shader, tanpa alokasi per frame) dan
// partikel aliran di saluran (kecepatan ∝ √Q; arah berbalik bila aliran balik).
import * as THREE from 'three';
import { WORLD, RIVER, riverCenterX, COLLECTION_X, fieldDrainZs } from './layout.js';
import { mulberry32 } from './noise.js';
import { PALETTE } from './palette.js';

const RAIN_BOX = 440;
const RAIN_H = 150;

/** Jumlah garis hujan untuk intensitas I (mm/jam). */
export function rainCount(I, nMax) {
  if (!(I >= 0.1)) return 0;
  return Math.round(nMax * Math.sqrt(Math.min(I, 30) / 30));
}

export function createRain(cutPlane, maxCount = 3000) {
  const rnd = mulberry32(101);
  const pos = new Float32Array(maxCount * 2 * 3);
  const end = new Float32Array(maxCount * 2);
  for (let i = 0; i < maxCount; i++) {
    const x = (rnd() - 0.5) * RAIN_BOX;
    const z = (rnd() - 0.5) * RAIN_BOX;
    const ph = rnd() * RAIN_H;
    pos.set([x, ph, z, x, ph, z], i * 6);
    end[i * 2 + 1] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  geo.setDrawRange(0, 0);
  const uniforms = {
    uTime: { value: 0 },
    uSpeed: { value: 32 },
    uH: { value: RAIN_H },
    uLen: { value: 2.6 },
    uCenter: { value: new THREE.Vector3() },
    uWind: { value: new THREE.Vector2(0.12, 0.05) },
  };
  const mat = new THREE.LineBasicMaterial({ color: PALETTE.rain, transparent: true, opacity: 0.55, depthWrite: false, clippingPlanes: [cutPlane] });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aEnd;
uniform float uTime; uniform float uSpeed; uniform float uH; uniform float uLen; uniform vec3 uCenter; uniform vec2 uWind;`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 rdir = normalize(vec3(uWind.x, -1.0, uWind.y));
float fall = mod(position.y + uTime * uSpeed, uH);
vec3 head = vec3(uCenter.x + position.x, uCenter.y + uH, uCenter.z + position.z) + rdir * (fall / -rdir.y);
vec3 transformed = head - rdir * aEnd * uLen;`,
      );
  };
  mat.customProgramCacheKey = () => 'wm-rain';
  const lines = new THREE.LineSegments(geo, mat);
  lines.name = 'hujan';
  lines.frustumCulled = false;
  lines.renderOrder = 8;
  let n = 0;
  return {
    object: lines,
    /** Atur intensitas; kembalikan jumlah garis. */
    set(I, nMax, center, ve) {
      const k = Math.min(rainCount(I, nMax), maxCount);
      if (k !== n) {
        n = k;
        geo.setDrawRange(0, n * 2);
      }
      uniforms.uCenter.value.set(Math.max(-300, Math.min(300, center.x)), -3 * ve, Math.max(-360, Math.min(150, center.z)));
      lines.visible = n > 0;
      return n;
    },
    tick(dt) {
      uniforms.uTime.value = (uniforms.uTime.value + dt) % 1000;
    },
    get count() {
      return n;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** Partikel aliran di saluran. kind: 0 utama, 1 koleksi, 2 outlet (muka air sungai), 3 parit lapangan. */
export function createFlow(params, quality) {
  const rnd = mulberry32(202);
  const dens = quality === 'rendah' ? 0.5 : 1;
  const segs = [];
  const add = (sx, sz, ex, ez, kind, bed, count) => segs.push({ sx, sz, ex, ez, kind, bed, count: Math.max(2, Math.round(count * dens)) });
  const g = params.geom;
  for (const X of COLLECTION_X) {
    add(X, 200, X, WORLD.mainZ, 1, g.collection.zBed, X === -450 ? 30 : 60);
    add(X, WORLD.southEndZ + 4, X, WORLD.mainZ, 1, g.collection.zBed, 18);
  }
  add(WORLD.extent.xMin, WORLD.mainZ, WORLD.gateX - 0.5, WORLD.mainZ, 0, g.main.zBed, 140);
  add(WORLD.gateX + 0.6, WORLD.mainZ, riverCenterX(WORLD.mainZ) - RIVER.halfBottom, WORLD.mainZ, 2, g.main.zBed - 0.2, 22);
  if (params.fieldDrains.enabled) {
    const bedTop = g.Hd - params.fieldDrains.depth;
    for (const zd of fieldDrainZs(params.fieldDrains.spacing, -200, 200)) {
      add(0, zd, -148.6, zd, 3, bedTop, 10);
      add(0, zd, 148.6, zd, 3, bedTop, 10);
    }
  }
  const total = segs.reduce((s, x) => s + x.count, 0);
  const aStart = new Float32Array(total * 3);
  const aDir = new Float32Array(total * 3);
  const aLen = new Float32Array(total);
  const aPhase = new Float32Array(total);
  const aKind = new Float32Array(total);
  const aBed = new Float32Array(total);
  let k = 0;
  for (const s of segs) {
    const dx = s.ex - s.sx;
    const dz = s.ez - s.sz;
    const L = Math.hypot(dx, dz);
    for (let i = 0; i < s.count; i++) {
      aStart.set([s.sx, 0, s.sz], k * 3);
      aDir.set([dx / L, 0, dz / L], k * 3);
      aLen[k] = L;
      aPhase[k] = (i + rnd() * 0.8) / s.count;
      aKind[k] = s.kind;
      aBed[k] = s.bed;
      k++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 3), 3));
  geo.setAttribute('aStart', new THREE.BufferAttribute(aStart, 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(aDir, 3));
  geo.setAttribute('aLen', new THREE.BufferAttribute(aLen, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
  geo.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
  geo.setAttribute('aBed', new THREE.BufferAttribute(aBed, 1));
  const uniforms = {
    uDist: { value: new THREE.Vector4() },
    uCanal: { value: -0.5 },
    uRiver: { value: -1.5 },
    uVE: { value: 10 },
    uCut: { value: 1 },
    uSize: { value: 1 },
    uColor: { value: new THREE.Color(PALETTE.flow) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec3 aStart; attribute vec3 aDir; attribute float aLen; attribute float aPhase; attribute float aKind; attribute float aBed;
      uniform vec4 uDist; uniform float uCanal; uniform float uRiver; uniform float uVE; uniform float uCut; uniform float uSize;
      varying float vA;
      void main() {
        float d = aKind < 0.5 ? uDist.x : (aKind < 1.5 ? uDist.y : (aKind < 2.5 ? uDist.z : uDist.w));
        float s = mod(aPhase * aLen + d, aLen);
        vec3 p = aStart + aDir * s;
        float lvl = aKind > 1.5 && aKind < 2.5 ? uRiver : uCanal;
        p.y = lvl * uVE + 0.15;
        float hide = lvl <= aBed + 0.01 ? 1.0 : 0.0;
        if (uCut > 0.5 && p.z > 0.0) hide = 1.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = hide > 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
        gl_PointSize = hide > 0.5 ? 1.0 : clamp(uSize * 260.0 / max(-mv.z, 1.0), 1.5, 5.5);
        vA = smoothstep(0.0, 4.0, s) * smoothstep(0.0, 4.0, aLen - s);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c);
        if (r > 0.5) discard;
        gl_FragColor = vec4(uColor, vA * (1.0 - smoothstep(0.25, 0.5, r)) * 0.95);
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'aliran';
  points.frustumCulled = false;
  points.renderOrder = 7;
  const speed = new THREE.Vector4();
  return {
    object: points,
    set(view, ve, cut, pixelRatio) {
      uniforms.uCanal.value = view.canal.levelM;
      uniforms.uRiver.value = view.river.levelM;
      uniforms.uVE.value = ve;
      uniforms.uCut.value = cut ? 1 : 0;
      uniforms.uSize.value = pixelRatio;
      const Q = view.structure.q_m3s;
      const v = Math.abs(Q) < 1e-4 ? 0 : Math.sign(Q) * (0.6 + 6 * Math.sqrt(Math.abs(Q)));
      let fd = 0;
      const f = view.profile.fd;
      if (f && f.length) {
        for (let i = 0; i < f.length; i++) fd += Math.abs(f[i]);
        fd /= f.length;
      }
      speed.set(v, 0.55 * v, 1.2 * v, Math.min(1.6, 0.15 + 60 * fd));
    },
    tick(dt) {
      const d = uniforms.uDist.value;
      d.x = (d.x + speed.x * dt) % 1e5;
      d.y = (d.y + speed.y * dt) % 1e5;
      d.z = (d.z + speed.z * dt) % 1e5;
      d.w = (d.w + speed.w * dt) % 1e5;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
