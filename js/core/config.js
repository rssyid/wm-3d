// Konstanta aplikasi bersama (tanpa three/DOM).
export const APP_VERSION = '0.2.0';

/** Kecepatan simulasi dalam jam-simulasi per detik nyata. */
export const SPEEDS = Object.freeze([
  Object.freeze({ id: '6j', label: '6 jam/detik', hps: 6 }),
  Object.freeze({ id: '1h', label: '1 hari/detik', hps: 24 }),
  Object.freeze({ id: '3h', label: '3 hari/detik', hps: 72 }),
  Object.freeze({ id: '1m', label: '1 minggu/detik', hps: 168 }),
  Object.freeze({ id: '1b', label: '1 bulan/detik', hps: 720 }),
]);
export const DEFAULT_SPEED_HPS = 24;
export const MAX_STEPS_PER_FRAME = 240;

/** Eksagerasi vertikal (VE) tampilan 3D. */
export const VE = Object.freeze({ default: 10, min: 1, max: 20, step: 1 });
export const VISUAL_SEED = 7;

export const CAMERA_PRESETS = Object.freeze([
  Object.freeze({ id: 'ikhtisar', label: 'Ikhtisar' }),
  Object.freeze({ id: 'penampang', label: 'Penampang' }),
  Object.freeze({ id: 'pintu-air', label: 'Pintu air' }),
  Object.freeze({ id: 'atas', label: 'Atas' }),
]);

export const QUALITY = Object.freeze([
  Object.freeze({ id: 'tinggi', label: 'Tinggi' }),
  Object.freeze({ id: 'rendah', label: 'Rendah' }),
]);

/** Bagian tab "Persamaan & Perhitungan" (id dipakai di hash: #persamaan.<id>). */
export const EQ_SECTIONS = Object.freeze([
  Object.freeze({ id: 'neraca', title: 'Ringkasan & neraca air' }),
  Object.freeze({ id: 'hujan-et', title: 'Curah hujan & evapotranspirasi' }),
  Object.freeze({ id: 'gambut', title: 'Sifat hidrolik gambut' }),
  Object.freeze({ id: 'kubah', title: 'Permukaan berkubah' }),
  Object.freeze({ id: 'airtanah', title: 'Aliran air tanah' }),
  Object.freeze({ id: 'parit', title: 'Parit lapangan' }),
  Object.freeze({ id: 'kanal', title: 'Neraca saluran & TMAS' }),
  Object.freeze({ id: 'pintu-air', title: 'Pintu air & pembuangan' }),
  Object.freeze({ id: 'numerik', title: 'Numerik & stabilitas' }),
  Object.freeze({ id: 'klasifikasi', title: 'Klasifikasi & kepatuhan' }),
  Object.freeze({ id: 'parameter', title: 'Parameter & referensi' }),
]);
