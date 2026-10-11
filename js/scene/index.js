// STUB scene — akan diganti implementasi lengkap (M3/M4). Antarmuka: lihat docs/kontrak.md.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(container, { params, options } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 tidak tersedia');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb7d3e6);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 4000);
  camera.position.set(-260, 190, 300);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.addEventListener('change', () => (dirty = true));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, 2.0));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5a4632 }));
  scene.add(ground);
  const water = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 400), new THREE.MeshLambertMaterial({ color: 0x3f7fd0 }));
  water.position.x = -150;
  scene.add(water);
  let dirty = true;
  let ve = options?.ve ?? 10;
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  new ResizeObserver(resize).observe(container);
  resize();
  return {
    canvas: renderer.domElement,
    frame(view, dt, playing, force) {
      controls.update();
      if (view) water.position.y = view.canal.levelM * ve;
      if (dirty || playing || force) {
        renderer.render(scene, camera);
        dirty = false;
      }
    },
    render() {
      renderer.render(scene, camera);
    },
    resize,
    setOptions(o) {
      ve = o.ve ?? ve;
      dirty = true;
    },
    setCamera() {
      dirty = true;
    },
    rebuild() {
      dirty = true;
    },
    renderInfo: () => ({ webgl2: renderer.capabilities.isWebGL2, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    dispose() {
      renderer.dispose();
    },
  };
}
