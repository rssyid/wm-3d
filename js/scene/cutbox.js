// Potongan kotak di sekitar pintu air (saat cutaway): tanah, air, dan struktur di sisi utara sumbu saluran utama
// dibuang di shader (discard), sehingga pintu air terlihat sebagai penampang memanjang: muka air hulu (TMAS),
// mercu stoplog, luapan (nappe), dan muka air hilir/sungai.
import * as THREE from 'three';
import { WORLD } from './layout.js';

export const GATE_BOX = Object.freeze({ x0: 172, x1: 218, z0: WORLD.mainZ, z1: -185 });

export const boxUniforms = {
  uBox: { value: new THREE.Vector4(GATE_BOX.x0, GATE_BOX.x1, GATE_BOX.z0, GATE_BOX.z1) },
  uBoxOn: { value: 1 },
};

/** Tambahkan discard kotak ke material bawaan three (berantai dengan onBeforeCompile yang sudah ada). */
export function withBoxCut(material) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    if (typeof prev === 'function') prev.call(material, sh, r);
    sh.uniforms.uBox = boxUniforms.uBox;
    sh.uniforms.uBoxOn = boxUniforms.uBoxOn;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBoxW;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  vBoxW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vBoxW = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBoxW;\nuniform vec4 uBox;\nuniform float uBoxOn;')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
if (uBoxOn > 0.5 && vBoxW.x > uBox.x && vBoxW.x < uBox.y && vBoxW.z > uBox.z && vBoxW.z < uBox.w) discard;`,
      );
  };
  const prevKey = typeof material.customProgramCacheKey === 'function' ? material.customProgramCacheKey.bind(material) : null;
  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|boxcut`;
  return material;
}

export function setBoxCut(on) {
  boxUniforms.uBoxOn.value = on ? 1 : 0;
}
