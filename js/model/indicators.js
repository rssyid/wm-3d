// Indikator dan klasifikasi: kategori TMAT perusahaan, kewajiban PP 57/2016, kelas TMAS,
// indeks risiko kebakaran (heuristik), dan laju subsidensi (kalibrasi ilustratif).

/** CMYK (%) → hex RGB: R = 255·(1−C)(1−K), G = 255·(1−M)(1−K), B = 255·(1−Y)(1−K). */
export function cmykToHex([c, m, y, k]) {
  const ch = (v) =>
    Math.round(255 * (1 - v / 100) * (1 - k / 100))
      .toString(16)
      .padStart(2, '0');
  return `#${ch(c)}${ch(m)}${ch(y)}`.toUpperCase();
}

function freezeAll(list) {
  return Object.freeze(list.map((o) => Object.freeze(o)));
}

/**
 * Kategori TMAT perusahaan (kedalaman d, cm di bawah permukaan gambut, positif ke bawah).
 * Batas atas inklusif: Banjir d < 0; Tergenang 0–40; Agak Tergenang (40,45]; Normal (45,60]; Agak Kering (60,65]; Kering > 65.
 */
export const TMAT_CLASSES = freezeAll(
  [
    { id: 'banjir', label: 'Banjir', range: '< 0 cm', min: -Infinity, max: 0, maxInclusive: false, cmyk: [0, 0, 0, 100], ink: '#FFFFFF', icon: '≋' },
    { id: 'tergenang', label: 'Tergenang', range: '0–40 cm', min: 0, max: 40, maxInclusive: true, cmyk: [65, 42, 0, 23], ink: '#FFFFFF', icon: '▼' },
    { id: 'agak-tergenang', label: 'Agak Tergenang', range: '41–45 cm', min: 40, max: 45, maxInclusive: true, cmyk: [100, 20, 0, 0], ink: '#000000', icon: '▽' },
    { id: 'normal', label: 'Normal', range: '46–60 cm', min: 45, max: 60, maxInclusive: true, cmyk: [19, 0, 59, 62], ink: '#FFFFFF', icon: '●' },
    { id: 'agak-kering', label: 'Agak Kering', range: '61–65 cm', min: 60, max: 65, maxInclusive: true, cmyk: [0, 0, 60, 0], ink: '#000000', icon: '△' },
    { id: 'kering', label: 'Kering', range: '> 65 cm', min: 65, max: Infinity, maxInclusive: true, cmyk: [0, 100, 100, 0], ink: '#FFFFFF', icon: '▲' },
  ].map((c) => ({ ...c, color: cmykToHex(c.cmyk) })),
);

/** Kewajiban PP 71/2014 jo PP 57/2016 Ps. 23(3)a: gambut rusak bila TMAT > 0,4 m di titik penaatan. */
export const PP_LIMIT_CM = 40;

/** Dasar penilaian kepatuhan di model. P.15/2017 tidak menetapkan rata-rata harian; ini asumsi model. */
export const PP_BASIS = 'rata-rata harian di titik penaatan (asumsi model)';

export const TMAS_CLASSES = freezeAll([
  { id: 'meluap', label: 'Meluap', range: '≤ 0 cm', max: 0, color: '#1D3F8F', ink: '#FFFFFF', icon: '≋', source: 'ilustratif' },
  { id: 'siaga-banjir', label: 'Siaga banjir', range: '0–20 cm', max: 20, color: '#3F7FD0', ink: '#FFFFFF', icon: '▼', source: 'ilustratif (= ambang darurat pintu air otomatis)' },
  { id: 'tinggi', label: 'Tinggi', range: '20–50 cm', max: 50, color: '#7FB2E6', ink: '#000000', icon: '▽', source: 'ilustratif' },
  { id: 'optimal', label: 'Optimal', range: '50–70 cm', max: 70, color: '#2E8B57', ink: '#FFFFFF', icon: '●', source: 'BMP RSPO (saluran koleksi 50–70 cm)' },
  { id: 'rendah', label: 'Rendah', range: '70–100 cm', max: 100, color: '#D8A300', ink: '#000000', icon: '△', source: 'ilustratif' },
  { id: 'sangat-rendah', label: 'Sangat rendah', range: '> 100 cm', max: Infinity, color: '#C0392B', ink: '#FFFFFF', icon: '▲', source: 'ilustratif' },
]);

export const FIRE_CLASSES = freezeAll([
  { id: 'rendah', label: 'Rendah', max: 25, color: '#2E8B57' },
  { id: 'sedang', label: 'Sedang', max: 50, color: '#D8A300' },
  { id: 'tinggi', label: 'Tinggi', max: 75, color: '#E06A1B' },
  { id: 'sangat-tinggi', label: 'Sangat tinggi', max: Infinity, color: '#C0392B' },
]);

export const THRESHOLDS = Object.freeze({
  tmat: TMAT_CLASSES,
  tmas: TMAS_CLASSES,
  ppLimitCm: PP_LIMIT_CM,
  fire: FIRE_CLASSES,
  fireDepthStartCm: 40,
  fireDepthSpanCm: 60,
  fireDrySpellDays: 21,
  dryDayMm: 5,
  subsidence: { a: 1.5, b: 0.05 },
});

/** Kategori perusahaan untuk kedalaman d (cm). */
export function classifyTmat(depthCm) {
  if (!(depthCm >= 0)) return TMAT_CLASSES[0];
  for (let i = 1; i < TMAT_CLASSES.length; i++) {
    if (depthCm <= TMAT_CLASSES[i].max) return TMAT_CLASSES[i];
  }
  return TMAT_CLASSES.at(-1);
}

export function ppCompliant(depthCm) {
  return depthCm <= PP_LIMIT_CM;
}

/** Kelas TMAS (cm di bawah tanggul; ≤ 0 = meluap). */
export function classifyTmas(tmasCm) {
  for (const c of TMAS_CLASSES) {
    if (c.id === 'meluap' ? tmasCm <= 0 : tmasCm <= c.max) return c;
  }
  return TMAS_CLASSES.at(-1);
}

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

/** Indeks risiko kebakaran (0–100, heuristik): 70% dari kedalaman rata-rata, 30% dari hari kering beruntun. */
export function fireRiskIndex(meanDepthCm, drySpellDays) {
  const t = THRESHOLDS;
  return 100 * (0.7 * clamp01((meanDepthCm - t.fireDepthStartCm) / t.fireDepthSpanCm) + 0.3 * clamp01(drySpellDays / t.fireDrySpellDays));
}

export function classifyFire(index) {
  return FIRE_CLASSES.find((c) => index < c.max) ?? FIRE_CLASSES.at(-1);
}

/** Laju subsidensi (cm/tahun) = a + b·max(d̄₃₀, 0); d̄₃₀ = rata-rata kedalaman 30 hari (cm). Kalibrasi ilustratif. */
export function subsidenceRate(meanDepth30Cm) {
  const { a, b } = THRESHOLDS.subsidence;
  return a + b * Math.max(meanDepth30Cm, 0);
}
