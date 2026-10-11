// Skenario cuaca sintetis dan penyedia forcing (hujan, ETp, sungai) per jam.
import { generateDailyRain, disaggregateHourly, ETP_DIURNAL, MONTH_DAYS, calendarDay } from './rain.js';

const NORMAL_MONTHLY = [210, 160, 230, 250, 190, 120, 110, 140, 180, 250, 290, 260];
const NORMAL_ETP = [3.6, 3.8, 3.9, 4.0, 4.1, 4.3, 4.5, 4.5, 4.4, 4.1, 3.8, 3.6];

export const SCENARIOS = Object.freeze({
  kemarau: Object.freeze({
    id: 'kemarau',
    label: 'Kemarau panjang (El Niño)',
    short: 'Kemarau',
    description: 'Empat bulan kering (±42 mm/bulan, Jun–Sep). Muka air tanah turun, risiko kebakaran naik.',
    days: 120,
    startMonth: 5,
    seed: 1101,
    rain: { p01: 0.12, p11: 0.35, monthly: [150, 120, 150, 140, 90, 42, 42, 42, 42, 90, 150, 150] },
    etp: 4.5,
    zR0: -2.4,
    init: { tmatCm: 45, nLogs: 7 },
  }),
  normal: Object.freeze({
    id: 'normal',
    label: 'Tahun normal',
    short: 'Normal',
    description: 'Satu tahun dengan pola hujan khas Riau (±2.390 mm/tahun), kemarau Jun–Agu.',
    days: 365,
    startMonth: 0,
    seed: 2202,
    rain: { p01: 0.45, p11: 0.7, monthly: NORMAL_MONTHLY },
    etp: NORMAL_ETP,
    zR0: -2.2,
    init: { tmatCm: 45, nLogs: 7 },
  }),
  hujan: Object.freeze({
    id: 'hujan',
    label: 'Musim hujan',
    short: 'Musim hujan',
    description: 'Empat bulan basah (±300 mm/bulan, Okt–Jan). Pembuangan sering terjadi.',
    days: 120,
    startMonth: 9,
    seed: 3303,
    rain: { p01: 0.5, p11: 0.75, monthly: [300, 220, 230, 250, 190, 120, 110, 140, 250, 300, 300, 300] },
    etp: 3.5,
    zR0: -2.0,
    init: { tmatCm: 50, nLogs: 7 },
  }),
  ekstrem: Object.freeze({
    id: 'ekstrem',
    label: 'Hujan ekstrem 3 hari',
    short: 'Ekstrem',
    description: 'Musim hujan dengan badai 110/170/70 mm pada hari ke-14–16: banjir, pintu air terendam, lalu surut.',
    days: 45,
    startMonth: 11,
    seed: 4404,
    rain: { p01: 0.5, p11: 0.75, monthly: [300, 220, 230, 250, 190, 120, 110, 140, 250, 300, 300, 300] },
    storms: [
      { day: 13, mm: 110 },
      { day: 14, mm: 170 },
      { day: 15, mm: 70 },
    ],
    etp: 3.5,
    zR0: -2.0,
    init: { tmatCm: 45, nLogs: 7 },
  }),
});

export const SCENARIO_IDS = Object.freeze(Object.keys(SCENARIOS));

function etpForMonth(etp, month) {
  return Array.isArray(etp) ? etp[month] : etp;
}

/** Rata-rata hujan harian (mm/hari) dari target bulanan untuk bulan-bulan skenario. */
function meanRain(sc) {
  let total = 0;
  for (let d = 0; d < sc.days; d++) {
    const { month } = calendarDay(d, sc.startMonth);
    total += sc.rain.monthly[month] / MONTH_DAYS[month];
  }
  return total / sc.days;
}

/**
 * Penyedia forcing skenario. hour(k) untuk k ∈ [−spinUpDays·24, days·24).
 * Mengembalikan {rain_mm, etp_mm} untuk jam tersebut (sebelum pengali hujan).
 */
export function scenarioForcing(id, { spinUpDays = 30, seed } = {}) {
  const sc = SCENARIOS[id];
  if (!sc) throw new Error(`Skenario tidak dikenal: ${id}`);
  const s = seed ?? sc.seed;
  const total = spinUpDays + sc.days;
  const daily = generateDailyRain({ seed: s, ...sc.rain }, -spinUpDays, total, sc.startMonth);
  for (const st of sc.storms ?? []) daily[spinUpDays + st.day] = st.mm;
  const hourly = disaggregateHourly(daily, s);
  const etpDaily = new Float64Array(total);
  for (let j = 0; j < total; j++) etpDaily[j] = etpForMonth(sc.etp, calendarDay(j - spinUpDays, sc.startMonth).month);
  const off = spinUpDays;
  return {
    kind: 'scenario',
    scenarioId: id,
    label: sc.label,
    startMonth: sc.startMonth,
    days: sc.days,
    spinUpDays,
    seed: s,
    zR0: sc.zR0,
    init: sc.init,
    meanRainMmd: meanRain(sc),
    daily,
    hourly,
    etpDaily,
    hour(k) {
      const j = Math.floor(k / 24) + off;
      const h = ((k % 24) + 24) % 24;
      if (j < 0 || j >= total) return { rain_mm: 0, etp_mm: 0, etpDaily_mm: 0 };
      return { rain_mm: hourly[(k + off * 24)], etp_mm: etpDaily[j] * ETP_DIURNAL[h], etpDaily_mm: etpDaily[j] };
    },
    dayRain(d) {
      const j = d + off;
      return j >= 0 && j < total ? daily[j] : 0;
    },
    dayEtp(d) {
      const j = d + off;
      return j >= 0 && j < total ? etpDaily[j] : 0;
    },
  };
}

/**
 * Forcing manual dari slider: hujan (mm/hari, disebar merata 24 jam — penyederhanaan),
 * ETp (mm/hari, bentuk harian), muka air sungai (m, menggantikan respons sungai).
 */
export function manualForcing(values = {}, { startMonth = 0 } = {}) {
  const v = { rainMmd: 0, etpMmd: 4, riverM: -2.0, ...values };
  return {
    kind: 'manual',
    scenarioId: 'manual',
    label: 'Manual',
    startMonth,
    days: Infinity,
    spinUpDays: 0,
    zR0: v.riverM,
    init: { tmatCm: 45, nLogs: 7 },
    meanRainMmd: v.rainMmd,
    values: v,
    hour(k) {
      const h = ((k % 24) + 24) % 24;
      return { rain_mm: v.rainMmd / 24, etp_mm: v.etpMmd * ETP_DIURNAL[h], etpDaily_mm: v.etpMmd, riverM: v.riverM };
    },
    dayRain() {
      return v.rainMmd;
    },
    dayEtp() {
      return v.etpMmd;
    },
  };
}
