// Konteks angka untuk satu "saat" simulasi: semua angka tab Persamaan diambil dari sini.
// Sumber: explain() per piezometer, snapshot, dailySeries, peatCurves, ratingCurve, dan fungsi murni model.
// Murni (tanpa DOM). Objek hasil tidak diubah lagi → bisa dipakai saat angka "dibekukan".
// Beberapa besaran yang belum ada di explain() dibaca langsung dari keadaan model (hanya baca):
// m.Er (EMA hujan sungai), m.forcing (penyedia hujan), m.depth30 (rata-rata 30 hari), m.lastForcing.
import {
  explain,
  dailySeries,
  peatCurves,
  ratingCurve,
  canalVolume,
  canalWetArea,
  calendarDay,
  ETP_DIURNAL,
  MONTH_DAYS,
  SCENARIOS,
} from '../../model/index.js';

/** Kurva V(h) dan Aw(h) saluran dari fungsi model (untuk grafik mini). */
function canalCurves(geometry, n = 81) {
  const segs = geometry.segments;
  const zMin = Math.min(...segs.map((s) => s.zb));
  const top = geometry.zBank + 0.3;
  const h = [];
  const V = [];
  const Aw = [];
  for (let j = 0; j < n; j++) {
    const hj = zMin + ((top - zMin) * j) / (n - 1);
    h.push(hj);
    V.push(canalVolume(hj, segs, geometry.zBank));
    Aw.push(canalWetArea(hj, segs, geometry.zBank));
  }
  return { h, V, Aw, zMin, top };
}

/** Rincian hujan & ETp pada jam terakhir yang disimulasikan (dibaca dari penyedia forcing model). */
function forcingInfo(model, snap) {
  const prov = model.forcing;
  const lf = model.lastForcing ?? {};
  const kLast = model.k - 1; // jam terakhir yang sudah dihitung: [k−1, k)
  const day = Math.floor(kLast / 24);
  const hour = ((kLast % 24) + 24) % 24;
  const scale = model.rainScale ?? 1;
  const info = {
    kind: prov.kind,
    kLast,
    day,
    hour,
    started: model.k > 0,
    rainScale: scale,
    rain_mmh: lf.rain_mm ?? 0,
    etp_mmh: lf.etp_mm ?? 0,
    etpDaily: lf.etpDaily_mm ?? 0,
    wHour: ETP_DIURNAL[hour],
    dayRainMm: (prov.dayRain?.(day) ?? 0) * scale,
    storm: null,
    month: null,
  };
  if (prov.kind === 'scenario' && prov.hourly && prov.daily) {
    const off = prov.spinUpDays ?? 0;
    const j = day + off;
    if (j >= 0 && j < prov.daily.length) {
      let first = -1;
      let last = -1;
      for (let h = 0; h < 24; h++) {
        if (prov.hourly[j * 24 + h] > 0) {
          if (first < 0) first = h;
          last = h;
        }
      }
      if (first >= 0) info.storm = { start: first, end: last + 1, dur: last - first + 1 };
      // kelompok bulan kalender di larik harian generator (termasuk hari spin-up)
      const cal = calendarDay(day, prov.startMonth);
      let j0 = j;
      let j1 = j;
      while (j0 > 0 && calendarDay(j0 - 1 - off, prov.startMonth).month === cal.month) j0--;
      while (j1 + 1 < prov.daily.length && calendarDay(j1 + 1 - off, prov.startMonth).month === cal.month) j1++;
      let sum = 0;
      for (let q = j0; q <= j1; q++) sum += prov.daily[q];
      const sc = SCENARIOS[prov.scenarioId];
      const days = j1 - j0 + 1;
      info.month = {
        month: cal.month,
        days,
        monthDays: MONTH_DAYS[cal.month],
        target: sc ? sc.rain.monthly[cal.month] : NaN,
        sum,
        storms: (sc?.storms ?? []).filter((st) => st.day + off >= j0 && st.day + off <= j1),
      };
    }
  }
  return info;
}

/**
 * Bangun konteks lengkap dari model saat ini.
 * opts.piezometer: id piezometer pilihan (default titik penaatan).
 */
export function buildContext(model, snap, { piezometer } = {}) {
  const ids = model.params.piezometers.map((p) => p.id);
  const pz = ids.includes(piezometer) ? piezometer : snap.ind.tpId;
  const ex = {};
  for (const id of ids) ex[id] = explain(model, { piezometer: id });
  const e = ex[pz];
  const D0 = e.geometry.zBank - e.geometry.zBase;
  const scenario = SCENARIOS[snap.scenarioId] ?? null;
  const river = {
    zR0: model.forcing?.zR0 ?? NaN,
    Er: model.Er ?? NaN,
    manual: model.forcing?.kind === 'manual',
    riverManual: model.forcing?.values?.riverM ?? NaN,
  };
  const meanDepth30Cm =
    Array.isArray(model.depth30) && model.depth30.length
      ? model.depth30.reduce((a, b) => a + b, 0) / model.depth30.length
      : snap.ind.meanDepthCm;
  const maxHead = Math.max(0.8, Math.ceil((Math.max(e.weir.H1, e.weir.H2, 0) * 1.25) * 10) / 10);
  return {
    t: snap.hourIndex,
    snap,
    e,
    ex,
    pz,
    ids,
    params: e.params,
    scenario,
    river,
    meanDepth30Cm,
    forcing: forcingInfo(model, snap),
    series: dailySeries(model),
    curves: peatCurves(model, { n: 121, maxDepth: 3 }),
    curvesFull: peatCurves(model, { n: 201, maxDepth: D0 }),
    rating: ratingCurve(model, { n: 81, maxHead }),
    canal: canalCurves(e.geometry),
  };
}
