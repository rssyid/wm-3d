// Palet warna scene 3D. Warna kategori TMAT diambil dari model (TMAT_CLASSES[].color) — tidak didefinisikan ulang.
import { TMAT_CLASSES } from '../model/index.js';

export const PALETTE = Object.freeze({
  // langit & cahaya (cerah → mendung, dicampur dengan c = smoothstep(0, 60, hujan 24 jam))
  skyTop: [0x6fa6d6, 0x3c444c],
  skyHorizon: [0xc6dceb, 0x6b747c],
  skyBottom: [0xdfe7e4, 0x59625f],
  sun: [2.6, 0.55],
  hemi: [1.25, 1.0],
  hemiSky: 0xe8f2ff,
  hemiGround: 0x5a4a36,
  sunColor: 0xfff1dc,
  horizonFar: 0x8fa7a8,
  horizonNear: 0x55705a,

  // permukaan
  cover: 0x6e7f3c, // pakis/penutup tanah di gawangan
  coverAlt: 0x58702f,
  grass: 0x7d9148,
  road: 0xb06a3c, // laterit
  peat: 0x47321f, // dinding/dasar saluran (gambut)
  mud: 0x5e4a36,
  forest: 0x3e4a2a,
  bare: 0x5b402a, // tanah gambut terbuka (piringan)
  path: 0x8a6a48, // pasar pikul
  mulch: 0x4c4326,
  farGround: 0x5f7339,

  // penampang tanah
  saprik: 0x33241a,
  hemik: 0x6e4a2c,
  fibrik: 0x9c6b3f,
  mineral: 0xa3a59c,
  floor: 0xc3c8c1,
  saturated: 0x3d8bff,
  phreatic: 0x0b4fd6,

  // air
  water: 0x3f6e86, // air saluran (sedikit cokelat teh gambut)
  waterRiver: 0x5a7466,
  pond: 0x4f86b0,
  flow: 0xe9f6ff,
  rain: 0xc9d8e6,

  // sawit
  trunk: 0x6f5a43,
  frond: 0x3f6b23,
  frondDark: 0x2c5219,
  frondLight: 0x6b8f2c,
  bunch: 0x3c160b,
  stack: 0x6a5a32,

  // struktur
  concrete: 0xa9a59b,
  plank: 0x8a5a32,
  steel: 0x55595e,
  pipe: 0xe8eef2,
  pipeWater: 0x1e7bff,
  cap: 0xf2f2ee,
  outline: 0xffffff,
  tpOk: 0xffffff,
  tpBad: 0xff1a1a,
  nappe: 0xdcefff,
});

/** Warna kategori TMAT perusahaan (hex string, persis dari model). */
export function tmatColor(id) {
  return (TMAT_CLASSES.find((c) => c.id === id) ?? TMAT_CLASSES[1]).color;
}
