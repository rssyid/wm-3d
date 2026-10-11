// Besaran diagram "Alur hubungan" (tanpa DOM): fluks dalam mm/hari atas luas total (blok + saluran)
// dan pemetaan fluks → lebar panah. Angka diambil dari snapshot dan explain(); tidak ada rumus fisika baru,
// hanya konversi satuan m³/hari → mm/hari.

/** m³/hari → mm/hari atas luas `area` (m²). */
export function m3dToMmd(v, area) {
  return area > 0 && Number.isFinite(v) ? (v / area) * 1000 : 0;
}

/**
 * Fluks untuk diagram.
 * - rain, et: dari snapshot.today (jumlah 24 jam terakhir, mm).
 * - toCanal: rembesan + parit lapangan + limpasan dari explain().canal.terms (laju saat ini, mm/hari).
 * - discharge: snapshot.structure.q_mmd (laju saat ini, mm/hari; negatif = aliran balik).
 */
export function flowFluxes(snap, canalTerms, Atot) {
  const t = canalTerms ?? {};
  const seepage = m3dToMmd(t.seepage ?? 0, Atot);
  const drains = m3dToMmd(t.drains ?? 0, Atot);
  const runoff = m3dToMmd(t.runoff ?? 0, Atot);
  return {
    rain: Math.max(0, snap?.today?.rain_mm ?? 0),
    et: Math.max(0, snap?.today?.et_mm ?? 0),
    toCanal: { total: seepage + drains + runoff, seepage, drains, runoff },
    discharge: snap?.structure?.q_mmd ?? 0,
  };
}

/** Lebar panah (px) sebanding |fluks|, dengan batas bawah tipis dan batas atas agar diagram tetap terbaca. */
export function edgeWidth(mmd, { min = 1.5, perMm = 0.35, max = 22 } = {}) {
  const a = Math.abs(Number.isFinite(mmd) ? mmd : 0);
  return Math.min(max, min + a * perMm);
}

/** Rangkaian neraca dari snapshot.today: bagian-bagian teks yang sudah diformat oleh pemanggil. */
export function balanceTerms(today) {
  const t = today ?? {};
  return {
    rain: t.rain_mm ?? 0,
    et: t.et_mm ?? 0,
    out: t.out_mm ?? 0,
    dS: t.dS_mm ?? 0,
    residual: t.residual_mm ?? 0,
  };
}
