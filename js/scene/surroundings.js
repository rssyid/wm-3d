// Sekeliling diorama: kubah langit (gradien), siluet horizon, tanah jauh, dan hutan riparian di seberang sungai.
import * as THREE from 'three';
import { WORLD, RIVER, riverCenterX } from './layout.js';
import { heightAt } from './ground.js';
import { hash2 } from './noise.js';
import { PALETTE } from './palette.js';
import { horizonTexture, farGroundTexture } from './textures.js';

/** Kubah langit: gradien vertikal, mengikuti kamera. */
export function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Color(PALETTE.skyTop[0]) },
    uHorizon: { value: new THREE.Color(PALETTE.skyHorizon[0]) },
    uBottom: { value: new THREE.Color(PALETTE.skyBottom[0]) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 c = y > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.55, y), 0.8)) : mix(uHorizon, uBottom, smoothstep(0.0, 0.08, -y));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(3400, 32, 16), mat);
  mesh.name = 'langit';
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return {
    mesh,
    setCloud(c) {
      uniforms.uTop.value.setHex(PALETTE.skyTop[0]).lerp(_tmp.setHex(PALETTE.skyTop[1]), c);
      uniforms.uHorizon.value.setHex(PALETTE.skyHorizon[0]).lerp(_tmp.setHex(PALETTE.skyHorizon[1]), c);
      uniforms.uBottom.value.setHex(PALETTE.skyBottom[0]).lerp(_tmp.setHex(PALETTE.skyBottom[1]), c);
    },
    horizonColor: () => uniforms.uHorizon.value,
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}
const _tmp = new THREE.Color();

/** Cincin siluet bukit & hutan di horizon (tanpa kabut, diwarnai mengikuti mendung). */
export function createHorizon() {
  const tex = horizonTexture();
  tex.repeat.set(3, 1);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide });
  const geo = new THREE.CylinderGeometry(1750, 1750, 150, 96, 1, true);
  geo.translate(0, 60, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'horizon';
  mesh.position.set(0, 0, -120);
  mesh.renderOrder = -5;
  return {
    mesh,
    setCloud(c, horizon) {
      mat.color.setRGB(1, 1, 1).lerp(horizon, 0.25 + 0.45 * c);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}

/** Tanah jauh berlubang seukuran diorama (di hydroGroup, y = −0,05 m). */
export function createFarGround(cutPlane) {
  const E = WORLD.extent;
  const F = WORLD.farGround;
  const y = -0.05;
  const rects = [
    [-F, F, -F, E.zMin, PALETTE.farGround],
    [-F, F, E.zMax, F, PALETTE.farGround],
    [-F, E.xMin, E.zMin, E.zMax, PALETTE.farGround],
    [E.xMax, F, E.zMin, E.zMax, PALETTE.forest],
  ];
  const pos = [];
  const col = [];
  const uv = [];
  const idx = [];
  const c = new THREE.Color();
  for (const [x0, x1, z0, z1, hex] of rects) {
    const b = pos.length / 3;
    c.setHex(hex);
    for (const [x, z] of [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ]) {
      pos.push(x, y, z);
      col.push(c.r, c.g, c.b);
      uv.push(x / 40, z / 40);
    }
    idx.push(b, b + 3, b + 2, b, b + 2, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const tex = farGroundTexture();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex, clippingPlanes: [cutPlane] });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'tanah-jauh';
  mesh.receiveShadow = false;
  return {
    mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}

/** Lantai galian di depan bidang potong (z > 0) pada dasar lempung mineral; tampil hanya saat cutaway. */
export function createCutFloor(baseY) {
  const F = WORLD.farGround;
  const geo = new THREE.PlaneGeometry(2 * F, F).rotateX(-Math.PI / 2);
  geo.translate(0, baseY, F / 2);
  const mat = new THREE.MeshLambertMaterial({ color: PALETTE.floor });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'lantai-potongan';
  return {
    mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** Geometri pohon hutan: batang + tajuk ikosahedron (warna vertex). */
function treeGeometry() {
  const trunk = new THREE.CylinderGeometry(0.07, 0.13, 1, 4, 1, true).toNonIndexed();
  trunk.translate(0, 0.5, 0);
  const crown = new THREE.IcosahedronGeometry(1, 0);
  crown.scale(1, 0.62, 1);
  crown.translate(0, 1.45, 0);
  const parts = [
    [trunk, 0x4a3b2c],
    [crown, 0xffffff],
  ];
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  for (const [g, hex] of parts) {
    const ng = g.index ? g.toNonIndexed() : g;
    const p = ng.attributes.position;
    c.setHex(hex);
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      col.push(c.r, c.g, c.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Hutan riparian di seberang sungai + pohon jarang di sempadan sisi kebun. */
export function createForest(ctx, quality, cutPlane) {
  const rendah = quality === 'rendah';
  const step = rendah ? 16 : 11.5;
  const recs = [];
  const E = WORLD.extent;
  for (let Z = E.zMin + 6; Z < E.zMax - 4; Z += step) {
    const xr = riverCenterX(Z);
    for (let X = xr + RIVER.halfTop + 5; X < E.xMax - 3; X += step) {
      const h = hash2(Math.round(X), Math.round(Z), 41);
      const dist = X - xr;
      if (dist > 120 && h < 0.35) continue;
      const jx = (hash2(Math.round(X), Math.round(Z), 42) - 0.5) * step * 0.9;
      const jz = (hash2(Math.round(X), Math.round(Z), 43) - 0.5) * step * 0.9;
      recs.push({ X: X + jx, Z: Z + jz, s: 0.8 + 0.5 * h, t: hash2(Math.round(Z), Math.round(X), 44) });
    }
    // sempadan sisi kebun (jarang)
    if (hash2(Math.round(Z), 3, 45) < 0.45) {
      const X = xr - RIVER.halfTop - 6 - 8 * hash2(Math.round(Z), 4, 46);
      if (X > 206 && Math.abs(Z - WORLD.mainZ) > 32) recs.push({ X, Z, s: 0.7 + 0.4 * hash2(Math.round(Z), 5, 47), t: hash2(7, Math.round(Z), 48) });
    }
  }
  recs.sort((a, b) => a.Z - b.Z);
  const geo = treeGeometry();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, clippingPlanes: [cutPlane] });
  const mesh = new THREE.InstancedMesh(geo, mat, recs.length);
  mesh.name = 'hutan-riparian';
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  const zs = Float64Array.from(recs, (r) => r.Z);
  for (const r of recs) r.h = heightAt(r.X, r.Z, ctx);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  recs.forEach((r, i) => {
    c.setHSL(0.25 + 0.08 * (r.t - 0.5), 0.42 + 0.15 * r.t, 0.2 + 0.1 * r.t);
    mesh.setColorAt(i, c);
  });
  return {
    mesh,
    zs,
    count: recs.length,
    place(ve) {
      recs.forEach((r, i) => {
        const H = 9 * r.s;
        const R = 5.2 * r.s;
        q.setFromAxisAngle(_up, r.t * 6.283);
        m4.compose(p.set(r.X, r.h * ve - 0.3, r.Z), q, s.set(R, H, R));
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose?.();
    },
  };
}
const _up = new THREE.Vector3(0, 1, 0);
