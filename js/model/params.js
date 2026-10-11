// Parameter model tata air satu blok kebun sawit gambut.
// Satuan internal: hari (d), meter (m), m/hari, m³. Datum z = 0 di tepi tanggul saluran koleksi.

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

export const DEFAULT_PARAMS = deepFreeze({
  geom: {
    Lh: 150, // setengah lebar blok (m): tanggul saluran koleksi → tengah blok
    N: 30, // jumlah sel transek
    blockLength: 1000, // panjang blok sejajar saluran koleksi (m)
    zBank: 0, // elevasi tanggul / tepi saluran koleksi (datum)
    zBase: -4.0, // dasar gambut (m), datar
    Hd: 0.2, // tinggi kubah gambut di tengah blok relatif tanggul (m)
    collection: { count: 2, length: 1000, zBed: -1.6, bottom: 0.8, slope: 0.5 },
    main: { count: 1, length: 300, zBed: -2.2, bottom: 1.5, slope: 0.75 },
  },
  fieldDrains: { enabled: true, spacing: 59, depth: 0.9 },
  // Ks 50 m/hari: gambut kebun terdrainase (lebih rendah dari nilai hutan ±200; Kurnianto dkk. 2019)
  peat: { SyS: 0.3, SyD: 0.08, lamS: 0.6, Ks: 50, Kd: 1.0, lamK: 0.25 },
  et: { fullTo: 0.4, reduceTo: 1.2, betaMin: 0.3, baseGuard: 0.2, eowFactor: 1.1 },
  runoff: { ks: 2 },
  weir: { zSill: -2.0, width: 1.5, plank: 0.2, nMax: 9, Cw: 1.7 },
  river: { gR: 0.04, tauR: 5, zRMax: -0.15 },
  piezometers: [
    { id: 'P1', x: 15, name: 'P1', note: 'dekat saluran' },
    { id: 'P2', x: 40, name: 'P2', note: '' },
    { id: 'P3', x: 75, name: 'P3', note: '' },
    // titik penaatan di tengah (sentroid) petak, sesuai ringkasan P.15/MENLHK/2017
    { id: 'P4', x: 150, name: 'P4', note: 'tengah blok · titik penaatan' },
  ],
  numerics: { C: 0.5, canalCoupling: 0.4, dtMin: 1e-5, spinUpDays: 30, bisectIter: 60 },
  fixedCanalLevel: null, // hook tes: bila angka, muka air kanal dipatok (kanal = batas tak hingga)
});

export const DEFAULT_CONTROL = deepFreeze({
  nLogs: 7,
  flapGate: false,
  mode: 'manual', // 'manual' | 'auto'
  target: 'perusahaan', // 'perusahaan' | 'pp'
  tpId: 'P4',
});

/** Metadata parameter yang bisa diubah lewat UI (path bertitik → label, satuan, rentang). */
export const PARAM_META = deepFreeze([
  { path: 'geom.Hd', label: 'Kubah gambut', unit: 'm', min: 0, max: 1, step: 0.05 },
  { path: 'peat.Ks', label: 'K permukaan', unit: 'm/hari', min: 20, max: 500, step: 10 },
  { path: 'fieldDrains.enabled', label: 'Parit lapangan', unit: '', type: 'boolean' },
]);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function mergeDeep(base, patch) {
  if (!isPlainObject(patch)) return patch === undefined ? base : patch;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(base?.[k]) ? mergeDeep(base[k], v) : v;
  }
  return out;
}

/** Menggabungkan patch (objek bersarang atau {'a.b': v}) ke parameter, hasil dibekukan. */
export function mergeParams(base = DEFAULT_PARAMS, patch = {}) {
  let nested = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (k.includes('.')) {
      const parts = k.split('.');
      let o = nested;
      for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] ??= {};
      o[parts.at(-1)] = v;
    } else {
      nested = mergeDeep(nested, { [k]: v });
    }
  }
  return deepFreeze(mergeDeep(base, nested));
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Elevasi permukaan gambut berkubah zs(x) = Hd·(1 − (1 − x/Lh)²), x dari tanggul (0) ke tengah blok (Lh). */
export function surfaceAt(x, geom) {
  const u = Math.min(Math.max(x / geom.Lh, 0), 1);
  return geom.zBank + geom.Hd * (1 - (1 - u) * (1 - u));
}

/** Penampang saluran sebagai prisma trapesium. */
export function channelSegments(geom) {
  return [geom.collection, geom.main].map((c) => {
    const depth = geom.zBank - c.zBed;
    return {
      L: c.count * c.length,
      zb: c.zBed,
      b: c.bottom,
      m: c.slope,
      depth,
      B: c.bottom + 2 * c.slope * depth, // lebar atas di elevasi tanggul
    };
  });
}

/** Geometri turunan: sel transek, luas, permukaan kubah, segmen saluran. */
export function deriveGeometry(params) {
  const g = params.geom;
  const N = g.N;
  const dx = g.Lh / N;
  const x = new Float64Array(N);
  const zs = new Float64Array(N);
  const D = new Float64Array(N);
  const area = new Float64Array(N);
  const zFd = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    x[i] = (i + 0.5) * dx;
    zs[i] = surfaceAt(x[i], g);
    D[i] = zs[i] - g.zBase;
    area[i] = 2 * dx * g.blockLength; // dua sisi simetris
    zFd[i] = zs[i] - params.fieldDrains.depth;
  }
  const segments = channelSegments(g);
  const Acp = segments.reduce((s, c) => s + c.L * c.B, 0);
  const Ablock = 2 * g.Lh * g.blockLength;
  return {
    N,
    dx,
    x,
    zs,
    D,
    area,
    zFd,
    segments,
    Acp,
    Ablock,
    Atot: Ablock + Acp,
    Lb: g.blockLength,
    zBank: g.zBank,
    zBase: g.zBase,
    zBedColl: g.collection.zBed,
    zBedMin: Math.min(...segments.map((c) => c.zb)),
    Dbank: g.zBank - g.zBase,
  };
}
