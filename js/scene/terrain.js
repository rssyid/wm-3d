// Terrain diorama: satu mesh ber-warna-vertex dari beberapa patch grid (blok utama rapat, sekeliling lebih kasar),
// di dalam hydroGroup (skala Y = VE). Detail prosedural di shader: piringan, pasar pikul, gawangan mati,
// variasi penutup tanah, dan penggelapan tanah basah ∝ clamp(1 − d/60, 0, 1) dari profil model.
import * as THREE from 'three';
import { groundAt, gridAxis, collectionBreaks, fieldBreaks, commonZBreaks, KIND } from './ground.js';
import { WORLD, PALM, palmRows } from './layout.js';
import { PALETTE } from './palette.js';
import { hash2 } from './noise.js';
import { withBoxCut, GATE_BOX } from './cutbox.js';

const MAX_CELLS = 64;

function concatAxes(parts) {
  const all = [];
  for (const a of parts) for (const v of a) if (!all.length || v - all[all.length - 1] > 1e-6) all.push(v);
  return Float64Array.from(all);
}

/** Definisi patch grid (langkah dalam m). `rendah` memakai langkah lebih kasar. */
export function terrainPatches(ctx, quality = 'tinggi') {
  const q = quality === 'rendah' ? 1.75 : 1;
  const ch = ctx.ch;
  const E = WORLD.extent;
  const bx = WORLD.blockEdgeX;
  const cz = commonZBreaks(ch);
  const fdNorth = fieldBreaks(ch, -200, 200);
  const fdSouth = fieldBreaks(ch, WORLD.southEndZ, WORLD.southStartZ);
  const colMid = collectionBreaks(ch, [-150, 150]);
  const colAll = collectionBreaks(ch);
  const riverX = concatAxes([gridAxis(bx, 196, 3.5 * q, [GATE_BOX.x0]), gridAxis(196, 204.5, 0.9 * q, [199.6, 200, 200.4]), gridAxis(204.5, 285, 2.0 * q, [GATE_BOX.x1])]);
  const zRiver = gridAxis(E.zMin, E.zMax, 5 * q, [...cz, GATE_BOX.z1, GATE_BOX.z0 + 1.2, GATE_BOX.z1 - 6]);
  return [
    { id: 'M', xs: gridAxis(-bx, bx, 2.4 * q, colMid), zs: gridAxis(-200, 200, 2.4 * q, [...fdNorth, 0]), outer: '' },
    { id: 'W', xs: gridAxis(E.xMin, -bx, 6.5 * q, colAll), zs: gridAxis(E.zMin, E.zMax, 6.5 * q, [...fdNorth, ...fdSouth, ...cz]), outer: 'wns' },
    { id: 'S', xs: gridAxis(-bx, bx, 6.5 * q, colMid), zs: gridAxis(E.zMin, -200, 6 * q, [...fdSouth, ...cz]), outer: 's' },
    { id: 'N', xs: gridAxis(-bx, bx, 8 * q, colMid), zs: gridAxis(200, E.zMax, 8 * q, cz), outer: 'n' },
    { id: 'R', xs: riverX, zs: zRiver, outer: 'ns' },
    { id: 'F', xs: gridAxis(285, E.xMax, 10 * q), zs: gridAxis(E.zMin, E.zMax, 10 * q, [0]), outer: 'ens' },
  ];
}

const KIND_COLORS = {
  [KIND.cover]: PALETTE.cover,
  [KIND.grass]: PALETTE.grass,
  [KIND.road]: PALETTE.road,
  [KIND.peat]: PALETTE.peat,
  [KIND.mud]: PALETTE.mud,
  [KIND.forest]: PALETTE.forest,
};

/** Membangun BufferGeometry terrain (posisi dalam meter sebenarnya). */
export function buildTerrainGeometry(ctx, quality) {
  const patches = terrainPatches(ctx, quality);
  let nv = 0;
  let ni = 0;
  for (const p of patches) {
    const nx = p.xs.length;
    const nz = p.zs.length;
    nv += nx * nz + 4 * (nx + nz) * 1; // grid + rok (2 vertex per titik tepi, 4 sisi)
    ni += (nx - 1) * (nz - 1) * 6 + 2 * ((nx - 1) + (nz - 1)) * 6;
  }
  const pos = new Float32Array(nv * 3);
  const col = new Float32Array(nv * 3);
  const fx = new Float32Array(nv * 2);
  const idx = new Uint32Array(ni);
  const c = new THREE.Color();
  const g = {};
  let v = 0;
  let k = 0;
  const kindCol = {};
  for (const [kk, hex] of Object.entries(KIND_COLORS)) kindCol[kk] = new THREE.Color(hex);
  const skirtCol = new THREE.Color(PALETTE.peat);

  for (const p of patches) {
    const { xs, zs } = p;
    const nx = xs.length;
    const nz = zs.length;
    const base = v;
    const H = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const X = xs[i];
        const Z = zs[j];
        groundAt(X, Z, ctx, g);
        H[j * nx + i] = g.h;
        pos[v * 3] = X;
        pos[v * 3 + 1] = g.h;
        pos[v * 3 + 2] = Z;
        c.copy(kindCol[g.kind]);
        const jit = 0.92 + 0.16 * hash2(Math.round(X * 4), Math.round(Z * 4), 11);
        col[v * 3] = c.r * jit;
        col[v * 3 + 1] = c.g * jit;
        col[v * 3 + 2] = c.b * jit;
        fx[v * 2] = g.planted;
        fx[v * 2 + 1] = g.wet;
        v++;
      }
    }
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = base + j * nx + i;
        const b = a + 1;
        const d = a + nx;
        const e = d + 1;
        const h00 = H[j * nx + i];
        const h10 = H[j * nx + i + 1];
        const h01 = H[(j + 1) * nx + i];
        const h11 = H[(j + 1) * nx + i + 1];
        // diagonal dengan beda tinggi terkecil (galian tetap tajam)
        if (Math.abs(h00 - h11) <= Math.abs(h10 - h01)) {
          idx[k++] = a; idx[k++] = d; idx[k++] = e;
          idx[k++] = a; idx[k++] = e; idx[k++] = b;
        } else {
          idx[k++] = a; idx[k++] = d; idx[k++] = b;
          idx[k++] = b; idx[k++] = d; idx[k++] = e;
        }
      }
    }
    // rok (skirt) di keempat tepi: dalam → turun 0,3 m; tepi luar diorama → dinding sampai elevasi tanah jauh
    const edges = [
      { n: nx, at: (t) => t, side: 's' }, // z = zs[0]
      { n: nx, at: (t) => (nz - 1) * nx + t, side: 'n' },
      { n: nz, at: (t) => t * nx, side: 'w' },
      { n: nz, at: (t) => t * nx + nx - 1, side: 'e' },
    ];
    for (const ed of edges) {
      const outer = p.outer.includes(ed.side);
      const s0 = v;
      for (let t = 0; t < ed.n; t++) {
        const src = base + ed.at(t);
        const X = pos[src * 3];
        const h = pos[src * 3 + 1];
        const Z = pos[src * 3 + 2];
        const top = outer ? Math.max(h, -0.05) : h;
        const bot = outer ? Math.min(h, -0.05) - 0.4 : h - 0.3;
        for (const y of [top, bot]) {
          pos[v * 3] = X;
          pos[v * 3 + 1] = y;
          pos[v * 3 + 2] = Z;
          col[v * 3] = skirtCol.r;
          col[v * 3 + 1] = skirtCol.g;
          col[v * 3 + 2] = skirtCol.b;
          fx[v * 2] = 0;
          fx[v * 2 + 1] = 0;
          v++;
        }
      }
      for (let t = 0; t < ed.n - 1; t++) {
        const a = s0 + t * 2;
        idx[k++] = a; idx[k++] = a + 1; idx[k++] = a + 2;
        idx[k++] = a + 2; idx[k++] = a + 1; idx[k++] = a + 3;
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, v * 3), 3));
  geo.setAttribute('fx', new THREE.BufferAttribute(fx.subarray(0, v * 2), 2));
  geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, k), 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

const glslColor = (hex) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

/** Material terrain bersama (Lambert + detail prosedural). */
export function createTerrainMaterial(cutPlane) {
  const uniforms = {
    uDepth: { value: new Float32Array(MAX_CELLS).fill(60) },
    uN: { value: 30 },
    uLh: { value: 150 },
    uWetOn: { value: 1 },
    uFd: { value: 59 },
    uVE: { value: 10 },
  };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, clippingPlanes: [cutPlane] });
  const { r0, r1 } = palmRows();
  const lim = (PALM.halfWidth - PALM.buffer).toFixed(3);
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 fx;\nvarying vec2 vFx;\nvarying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFx = fx;\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vFx;
varying vec3 vWp;
uniform float uDepth[${MAX_CELLS}];
uniform float uN;
uniform float uLh;
uniform float uWetOn;
uniform float uFd;
uniform float uVE;
const float DROW = ${PALM.rowSpacing.toFixed(6)};
const float DPALM = ${PALM.spacing.toFixed(4)};
const float ZOFF = ${PALM.zOffset.toFixed(4)};
const float PIR = ${PALM.piringanR.toFixed(3)};
float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
bool tInBlockZ(float z) { return (z >= -196.0 && z <= 196.0) || (z >= ${(WORLD.southEndZ + PALM.edgeBuffer).toFixed(1)} && z <= ${(WORLD.southStartZ - PALM.edgeBuffer).toFixed(1)}); }
float tFdDist(float z) { float r = mod(z - 0.5 * uFd, uFd); return min(r, uFd - r); }
float tDepthAt(float lx) {
  float x = clamp(uLh - abs(lx), 0.0, uLh);
  float fi = x / (uLh / uN) - 0.5;
  int i0 = int(clamp(floor(fi), 0.0, uN - 1.0));
  int i1 = int(clamp(floor(fi) + 1.0, 0.0, uN - 1.0));
  return mix(uDepth[i0], uDepth[i1], clamp(fi - floor(fi), 0.0, 1.0));
}
vec2 tPirGrad = vec2(0.0);`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 p = vWp.xz;
  float cov = tNoise(p * 0.11) * 0.6 + tNoise(p * 0.37) * 0.4;
  if (vFx.x > 0.5) {
    diffuseColor.rgb = mix(${glslColor(PALETTE.cover)}, ${glslColor(PALETTE.coverAlt)}, smoothstep(0.35, 0.75, cov));
    diffuseColor.rgb = mix(diffuseColor.rgb, ${glslColor(PALETTE.bare)}, 0.35 * smoothstep(0.72, 0.9, tNoise(p * 0.21 + 7.0)));
    float xc = p.x < -150.0 ? -300.0 : 0.0;
    float lx = p.x - xc;
    float wet = 0.0;
    if (vFx.y > 0.5) wet = uWetOn * clamp(1.0 - tDepthAt(lx) / 60.0, 0.0, 1.0);
    // gawangan: m genap = pasar pikul, m ganjil = gawangan mati (mulsa pelepah)
    float mI = floor(lx / DROW + 0.5);
    float dm = abs(lx - mI * DROW);
    float aa = fwidth(lx) * 0.75 + 0.02;
    if (abs(mI * DROW) < ${lim} && tInBlockZ(p.y)) {
      if (mod(mI, 2.0) < 0.5) {
        float k = 1.0 - smoothstep(0.7 - aa, 0.7 + aa, dm);
        diffuseColor.rgb = mix(diffuseColor.rgb, ${glslColor(PALETTE.path)} * (0.9 + 0.2 * tNoise(p * 1.7)), k * 0.9);
      } else {
        float k = 1.0 - smoothstep(1.5 - aa, 1.5 + aa, dm);
        diffuseColor.rgb = mix(diffuseColor.rgb, ${glslColor(PALETTE.mulch)}, k * 0.85);
      }
    }
    // piringan Ø 3,5 m di setiap pohon (kisi segitiga, sama dengan layout.js)
    float r = floor(lx / DROW);
    if (r >= ${r0.toFixed(1)} && r <= ${r1.toFixed(1)}) {
      float rowX = (r + 0.5) * DROW;
      float zo = ZOFF + mod(r, 2.0) * 0.5 * DPALM;
      float pz = zo + floor((p.y - zo) / DPALM + 0.5) * DPALM;
      if (tFdDist(pz) >= ${PALM.buffer.toFixed(1)} && tInBlockZ(pz)) {
        vec2 d = vec2(lx - rowX, p.y - pz);
        float dist = length(d);
        float fw = fwidth(dist) + 0.03;
        float inside = 1.0 - smoothstep(PIR - fw, PIR + fw, dist);
        float rim = smoothstep(PIR - 0.45, PIR - 0.1, dist) * (1.0 - smoothstep(PIR - 0.1, PIR + 0.25, dist));
        vec3 bare = ${glslColor(PALETTE.bare)} * (0.82 + 0.18 * smoothstep(0.0, PIR, dist));
        diffuseColor.rgb = mix(diffuseColor.rgb, bare, inside);
        diffuseColor.rgb = mix(diffuseColor.rgb, ${glslColor(PALETTE.path)}, rim * 0.55);
        // cekungan dangkal: kemiringan radial untuk normal (efek cahaya)
        if (dist < PIR) tPirGrad = d / max(dist, 1e-3) * (dist / PIR) * 0.09 * inside;
      }
    }
    diffuseColor.rgb *= mix(1.0, 0.58, wet);
  }
  diffuseColor.rgb *= 0.94 + 0.12 * tNoise(p * 0.9);
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
if (tPirGrad.x != 0.0 || tPirGrad.y != 0.0) {
  vec3 gw = vec3(-tPirGrad.x * uVE * 0.6, 0.0, -tPirGrad.y * uVE * 0.6);
  normal = normalize(normal + (viewMatrix * vec4(gw, 0.0)).xyz);
}`,
      );
  };
  mat.customProgramCacheKey = () => 'wm-terrain-v1';
  withBoxCut(mat);
  return { material: mat, uniforms };
}

/** Membuat mesh terrain + pembaru (profil → penggelapan basah). */
export function createTerrain(ctx, quality, cutPlane) {
  const { material, uniforms } = createTerrainMaterial(cutPlane);
  const mesh = new THREE.Mesh(buildTerrainGeometry(ctx, quality), material);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return {
    mesh,
    uniforms,
    setGeometry(ctx2, q) {
      mesh.geometry.dispose();
      mesh.geometry = buildTerrainGeometry(ctx2, q);
    },
    /** Kedalaman profil (cm) → uniform; hanya bila berubah. */
    update(view, ve) {
      uniforms.uVE.value = ve;
      const d = view.profile.depthCm;
      const n = Math.min(d.length, MAX_CELLS);
      uniforms.uN.value = n;
      uniforms.uLh.value = view.profile.Lh;
      let changed = false;
      const arr = uniforms.uDepth.value;
      for (let i = 0; i < n; i++) {
        if (Math.abs(arr[i] - d[i]) > 0.05) {
          arr[i] = d[i];
          changed = true;
        }
      }
      return changed;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
