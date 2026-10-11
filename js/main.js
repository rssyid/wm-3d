// main.js — akar komposisi (M0: scene placeholder untuk membuktikan import map + WebGL).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb7d3e6);
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 4000);
camera.position.set(-260, 190, 300);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, 2.0));
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 400).rotateX(-Math.PI / 2),
  new THREE.MeshLambertMaterial({ color: 0x5a4632 }),
);
scene.add(ground);

function resize() {
  const w = container.clientWidth || 1;
  const h = container.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container);
resize();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  if (!document.body.dataset.ready) document.body.dataset.ready = '1';
});

window.wmApp = {
  version: '0.1.0',
  renderInfo: () => ({
    webgl2: renderer.capabilities.isWebGL2 !== false,
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  }),
};
