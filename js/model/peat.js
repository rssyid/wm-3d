// Sifat hidrolik gambut sebagai fungsi kedalaman muka air tanah lokal ζ = zs − z (m, positif ke bawah).

/** Specific yield Sy(ζ) = SyD + (SyS − SyD)·e^(−ζ/λS); Sy = 1 saat tergenang (ζ < 0). */
export function specificYield(zeta, peat) {
  if (zeta < 0) return 1;
  return peat.SyD + (peat.SyS - peat.SyD) * Math.exp(-zeta / peat.lamS);
}

/** Konduktivitas hidrolik K(ζ) = Kd + (Ks − Kd)·e^(−ζ/λK) (m/hari). */
export function conductivity(zeta, peat) {
  const z = Math.max(zeta, 0);
  return peat.Kd + (peat.Ks - peat.Kd) * Math.exp(-z / peat.lamK);
}

/**
 * Transmisivitas zona jenuh T(ζ) = ∫ K dz dari dasar gambut ke muka air tanah (m²/hari):
 * T = Kd·(D − ζ) + (Ks − Kd)·λK·(e^(−ζ/λK) − e^(−D/λK)), untuk 0 ≤ ζ ≤ D. Saat tergenang T = T(0).
 */
export function transmissivity(zeta, D, peat) {
  const z = Math.max(zeta, 0);
  if (z >= D) return 0;
  return peat.Kd * (D - z) + (peat.Ks - peat.Kd) * peat.lamK * (Math.exp(-z / peat.lamK) - Math.exp(-D / peat.lamK));
}

/**
 * Simpanan air W (m) relatif terhadap "muka air tepat di permukaan":
 * W = −ζ (genangan) bila ζ ≤ 0; W = −[SyD·ζ + (SyS − SyD)·λS·(1 − e^(−ζ/λS))] bila ζ > 0.
 * dW/dz = Sy.
 */
export function storageFromDepth(zeta, peat) {
  if (zeta <= 0) return -zeta;
  return -(peat.SyD * zeta + (peat.SyS - peat.SyD) * peat.lamS * (1 - Math.exp(-zeta / peat.lamS)));
}

/** Kebalikan storageFromDepth: ζ dari W. Newton (konvergen monoton karena g cekung naik) + cadangan bisection. */
export function depthFromStorage(W, peat, guess = NaN) {
  if (W >= 0) return -W;
  const target = -W;
  const g = (z) => peat.SyD * z + (peat.SyS - peat.SyD) * peat.lamS * (1 - Math.exp(-z / peat.lamS));
  let z = guess > 0 && Number.isFinite(guess) ? guess : target / peat.SyS;
  for (let it = 0; it < 50; it++) {
    const f = g(z) - target;
    const d = specificYield(z, peat);
    let zn = z - f / d;
    if (zn < 0) zn = 0;
    if (Math.abs(zn - z) <= 1e-13 * Math.max(1, z)) return zn;
    z = zn;
  }
  // cadangan: bisection pada [0, target/SyD]
  let lo = 0;
  let hi = target / peat.SyD + 1;
  for (let it = 0; it < 200; it++) {
    const mid = 0.5 * (lo + hi);
    if (g(mid) < target) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Faktor reduksi ET β(ζ): 1 sampai ζ = fullTo, turun linear ke betaMin di ζ = reduceTo, tetap betaMin,
 * lalu → 0 pada baseGuard terakhir di atas dasar gambut (D).
 */
export function etBeta(zeta, D, et) {
  let b;
  if (zeta <= et.fullTo) b = 1;
  else if (zeta <= et.reduceTo) b = 1 - ((1 - et.betaMin) * (zeta - et.fullTo)) / (et.reduceTo - et.fullTo);
  else b = et.betaMin;
  const guardTop = D - et.baseGuard;
  if (zeta > guardTop) b *= Math.max(0, (D - zeta) / et.baseGuard);
  return b;
}
