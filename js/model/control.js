// Aturan otomatis pintu air (stoplog), dievaluasi sekali per hari simulasi.

export const CONTROL_TARGETS = Object.freeze({
  perusahaan: Object.freeze({ id: 'perusahaan', label: 'Perusahaan – Normal (46–60 cm)', band: Object.freeze([45, 60]) }),
  // target PP memakai kedalaman titik penaatan; pita di bawah 40 cm agar ada ruang sebelum melanggar
  pp: Object.freeze({ id: 'pp', label: 'PP 57/2016 (≤ 40 cm di titik penaatan)', band: Object.freeze([15, 37]) }),
});

export const CONTROL_RULES = Object.freeze({ hysteresisCm: 3, minIntervalDays: 2, emergencyTmasCm: 20, emergencyDrop: 2, riverMarginM: 0.05 });

/**
 * Jumlah stoplog maksimum yang aman untuk mode otomatis: mercu tetap ≥ (ambang darurat TMAS + 10 cm) di bawah tanggul,
 * supaya menambah papan tidak langsung memicu aturan darurat (osilasi tambah ↔ buang).
 */
export function safeMaxLogs(weir, zBank = 0) {
  const crestMax = zBank - (CONTROL_RULES.emergencyTmasCm + 10) / 100;
  return Math.max(0, Math.min(weir.nMax, Math.floor((crestMax - weir.zSill) / weir.plank + 1e-9)));
}

/**
 * Keputusan harian. Masukan: {nLogs, nMax, dMeanCm (rata-rata 24 jam semua piezometer), tmasCm, ponded,
 * riverM, canalM, daysSinceLast, target}. Keluaran: {nLogs, action|null} dengan action {type, text}.
 */
export function autoGateDecision(s) {
  const r = CONTROL_RULES;
  const band = (CONTROL_TARGETS[s.target] ?? CONTROL_TARGETS.perusahaan).band;
  const emergency = s.tmasCm < r.emergencyTmasCm || s.ponded;
  if (emergency) {
    if (s.riverM < s.canalM - r.riverMarginM) {
      if (s.nLogs > 0) {
        const n = Math.max(0, s.nLogs - r.emergencyDrop);
        return { nLogs: n, action: { type: 'darurat', text: `DARURAT: buang air (stoplog ${s.nLogs} → ${n})` } };
      }
      return { nLogs: s.nLogs, action: null };
    }
    return { nLogs: s.nLogs, action: { type: 'tahan', text: 'Sungai tinggi – stoplog ditahan' } };
  }
  if (s.daysSinceLast < r.minIntervalDays) return { nLogs: s.nLogs, action: null };
  if (s.dMeanCm < band[0] - r.hysteresisCm && s.nLogs > 0) {
    return { nLogs: s.nLogs - 1, action: { type: 'kurangi', text: `Terlalu basah: kurangi 1 stoplog (${s.nLogs} → ${s.nLogs - 1})` } };
  }
  if (s.dMeanCm > band[1] + r.hysteresisCm && s.nLogs < s.nMax) {
    return { nLogs: s.nLogs + 1, action: { type: 'tambah', text: `Terlalu kering: tambah 1 stoplog (${s.nLogs} → ${s.nLogs + 1})` } };
  }
  return { nLogs: s.nLogs, action: null };
}
