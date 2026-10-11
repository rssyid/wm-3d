// Status tampilan dari kategori model (satu sumber untuk UI dan scene).
import { classifyTmat, classifyTmas, TMAT_CLASSES, TMAS_CLASSES, PP_LIMIT_CM, ppCompliant } from '../model/indicators.js';

/** Kategori perusahaan untuk kedalaman TMAT (cm): {id, label, range, color, ink, icon, cssClass}. */
export function statusOf(depthCm) {
  const c = classifyTmat(depthCm);
  return { ...c, cssClass: `st-${c.id}` };
}

export function tmasStatusOf(tmasCm) {
  return classifyTmas(tmasCm);
}

export function ppStatusOf(depthCm) {
  const ok = ppCompliant(depthCm);
  return { ok, label: ok ? 'Patuh' : 'Tidak patuh', limitCm: PP_LIMIT_CM };
}

export { TMAT_CLASSES, TMAS_CLASSES, PP_LIMIT_CM };
