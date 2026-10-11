// Derau ber-seed yang deterministik (tanpa Math.random) untuk detail visual: mikro-relief, variasi sawit, hutan.
// Murni: tanpa DOM dan tanpa three, bisa dites di Node.

/** PRNG mulberry32: fungsi () → [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash bilangan bulat 2D + seed → [0, 1). */
export function hash2(ix, iz, seed = 0) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Value noise 2D halus (interpolasi quintic) → [−1, 1]. */
export function valueNoise2(x, z, seed = 0) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const u = fade(fx);
  const v = fade(fz);
  const ab = a + (b - a) * u;
  const cd = c + (d - c) * u;
  return 2 * (ab + (cd - ab) * v) - 1;
}

/** fBm: jumlah oktaf value noise, dinormalisasi ke kira-kira [−1, 1]. */
export function fbm2(x, z, seed = 0, octaves = 3, lacunarity = 2.03, gain = 0.5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2(x * freq, z * freq, seed + o * 101);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

export function smoothstep(e0, e1, x) {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
