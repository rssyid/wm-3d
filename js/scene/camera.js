// Kamera: preset Ikhtisar / Penampang / Pintu air / Atas dengan tween 0,8 s easeInOutCubic
// (langsung bila {instant:true} atau prefers-reduced-motion), OrbitControls dengan redaman dan batas wajar.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { presetPose, easeInOutCubic } from './layout.js';

const TWEEN_MS = 800;

export function prefersReducedMotion() {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function createCameraRig(canvas) {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 4000);
  camera.position.set(-260, 190, 300);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 15;
  controls.maxDistance = 900;
  controls.maxPolarAngle = 0.56 * Math.PI; // penampang dilihat sedikit dari bawah (lantai potongan tidak terlihat)
  controls.maxTargetRadius = 320;
  controls.target.set(10, -5, -40);
  controls.zoomSpeed = 0.9;
  controls.update();

  const from = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 45 };
  const to = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 45 };
  let tweenStart = 0;
  let tweening = false;
  let preset = 'ikhtisar';

  controls.addEventListener('start', () => {
    tweening = false;
  });

  function apply(pos, target, fov) {
    camera.position.copy(pos);
    controls.target.copy(target);
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(target);
  }

  return {
    camera,
    controls,
    get preset() {
      return preset;
    },
    get tweening() {
      return tweening;
    },
    /** Pindah ke preset; instant bila diminta atau gerak dikurangi. */
    setPreset(id, ve, aspect, { instant = false, cutaway = true } = {}) {
      preset = id;
      const pose = presetPose(id, ve, aspect, cutaway);
      to.pos.fromArray(pose.pos);
      to.target.fromArray(pose.target);
      to.fov = pose.fov;
      if (instant || prefersReducedMotion()) {
        tweening = false;
        apply(to.pos, to.target, to.fov);
        controls.update();
        return pose;
      }
      from.pos.copy(camera.position);
      from.target.copy(controls.target);
      from.fov = camera.fov;
      tweenStart = performance.now();
      tweening = true;
      return pose;
    },
    /** Skala y kamera & target saat VE berubah (pandangan tetap). */
    rescaleVE(oldVe, newVe) {
      const k = newVe / oldVe;
      const dy = controls.target.y * (k - 1);
      controls.target.y += dy;
      camera.position.y += dy;
      if (tweening) {
        to.target.y *= k;
        to.pos.y += to.target.y - to.target.y / k;
      }
      controls.update();
    },
    setPose(pos, target) {
      tweening = false;
      camera.position.set(pos[0], pos[1], pos[2]);
      controls.target.set(target[0], target[1], target[2]);
      camera.lookAt(controls.target);
      controls.update();
    },
    /** Per frame: tween atau redaman OrbitControls. true bila kamera bergerak. */
    update(nowMs) {
      if (tweening) {
        const t = Math.min(1, (nowMs - tweenStart) / TWEEN_MS);
        const e = easeInOutCubic(t);
        _p.lerpVectors(from.pos, to.pos, e);
        _t.lerpVectors(from.target, to.target, e);
        apply(_p, _t, from.fov + (to.fov - from.fov) * e);
        if (t >= 1) {
          tweening = false;
          controls.update();
        }
        return true;
      }
      return controls.update();
    },
    setAspect(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    dispose() {
      controls.dispose();
    },
  };
}
const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
