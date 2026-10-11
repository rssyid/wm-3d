// Kalimat naratif "Alur hubungan" (tanpa DOM). Kunci berubah hanya bila kelas/regime berubah,
// sehingga region aria-live tidak berbicara setiap jam.
import { rainClass } from '../model/index.js';
import { S } from './strings.id.js';

/** Regime pembuangan di pintu air. */
export function dischargeRegime(snap) {
  const st = snap?.structure ?? {};
  const q = st.q_m3s ?? 0;
  if (snap?.canal?.overbank) return 'overbank';
  if (q < -1e-4) return 'back';
  if (st.flapGate && st.riverAboveCrest && (snap?.river?.levelM ?? -Infinity) > (snap?.canal?.levelM ?? Infinity)) return 'flapShut';
  if (q > 1e-4) return st.submerged ? 'submerged' : 'out';
  return 'hold';
}

/** {key, text}: key = gabungan kelas hujan, kategori TMAT, kepatuhan PP, genangan, regime pembuangan. */
export function narrativeOf(snap) {
  const rain = snap?.forcing?.rain24h_mm ?? 0;
  const rc = rainClass(rain);
  const ind = snap?.ind ?? {};
  const cls = ind.cls ?? { id: '?', label: '—' };
  const ok = !!ind.pp?.now;
  const flooded = (snap?.ponding?.maxCm ?? 0) > 0.5;
  const regime = dischargeRegime(snap);
  const key = [rc.id, cls.id, ok ? 'patuh' : 'tidak', flooded ? 'genang' : '-', regime, ind.tpId].join('|');

  const N = S.narrative;
  const first = rc.id === 'tidak-hujan' ? N.rainNone : N.rain(rc.label);
  const second = N.tmat(ind.tpId ?? '—', cls.label, ok) + (flooded ? `, ${N.flood}` : '');
  const third = N[regime] ?? N.hold;
  const text = `${first}; ${second}; ${third}.`;
  return { key, text };
}

/** Pemilih stateful: mengembalikan teks baru hanya bila kunci berubah, selain itu null. */
export function createNarrator() {
  let last = null;
  return {
    next(snap) {
      const n = narrativeOf(snap);
      if (n.key === last) return null;
      last = n.key;
      return n.text;
    },
    reset() {
      last = null;
    },
  };
}
