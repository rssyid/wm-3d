// Generator curah hujan sintetis ber-seed: kejadian harian rantai Markov, jumlah eksponensial,
// diskalakan ke target bulanan, lalu didisagregasi ke per jam (bentuk badai segitiga).

export const MONTH_DAYS = Object.freeze([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
export const MONTH_NAMES_ID = Object.freeze(['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']);
export const DAILY_CAP_MM = 250;

/** PRNG mulberry32 (deterministik, 32-bit). */
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

/** Tanggal kalender (bulan, hari) untuk indeks hari relatif terhadap tanggal 1 bulan `startMonth` (tahun non-kabisat). */
export function calendarDay(dayIndex, startMonth) {
  let month = startMonth;
  let d = dayIndex;
  while (d < 0) {
    month = (month + 11) % 12;
    d += MONTH_DAYS[month];
  }
  while (d >= MONTH_DAYS[month]) {
    d -= MONTH_DAYS[month];
    month = (month + 1) % 12;
  }
  return { month, day: d + 1 };
}

export function dateLabel(dayIndex, startMonth) {
  const { month, day } = calendarDay(dayIndex, startMonth);
  return `${day} ${MONTH_NAMES_ID[month]}`;
}

/**
 * Batasi hujan harian di `cap` sambil mempertahankan total kelompok: kelebihan disebar proporsional ke hari
 * basah lain; bila tidak ada ruang, hari kering dengan u2 terbesar dijadikan hari basah.
 */
function capAndRedistribute(arr, idx, cap, target, u2s) {
  for (let iter = 0; iter < 100; iter++) {
    for (const j of idx) if (arr[j] > cap) arr[j] = cap;
    let sum = 0;
    let room = 0;
    for (const j of idx) {
      sum += arr[j];
      if (arr[j] > 0 && arr[j] < cap) room += arr[j];
    }
    const deficit = target - sum;
    if (deficit <= 1e-9 * Math.max(target, 1)) return;
    if (room > 0) {
      const k = deficit / room;
      for (const j of idx) if (arr[j] > 0 && arr[j] < cap) arr[j] *= 1 + k;
    } else {
      let best = -1;
      for (const j of idx) if (arr[j] === 0 && (best < 0 || u2s[j] > u2s[best])) best = j;
      if (best < 0) return;
      arr[best] = Math.min(deficit, cap);
    }
  }
}

/**
 * Hujan harian (mm) untuk `totalDays` hari mulai dari hari ke-`firstDay` relatif tanggal 1 `startMonth`
 * (firstDay negatif = hari spin-up sebelum awal skenario).
 * cfg: {seed, p01, p11, monthly[12] (mm/bulan), mu?}
 * Tepat 2 bilangan acak per hari. Setiap kelompok bulan diskalakan ke target (diprorata untuk bulan parsial).
 */
/** Skala jumlah hujan hari basah (mm) sebelum penskalaan bulanan. */
export const RAIN_MU_MM = 15;

export function generateDailyRain({ seed, p01, p11, monthly, mu = RAIN_MU_MM }, firstDay, totalDays, startMonth) {
  const rng = mulberry32(seed);
  const amt = new Float64Array(totalDays);
  const u2s = new Float64Array(totalDays);
  const months = new Int8Array(totalDays);
  let wet = false;
  for (let j = 0; j < totalDays; j++) {
    const u1 = rng();
    const u2 = rng();
    wet = u1 < (wet ? p11 : p01);
    // jumlah hari basah: Weibull (bentuk ≈ 0,67) agar ekor hujan lebat lebih realistis dibanding eksponensial
    amt[j] = wet ? Math.min(mu * Math.pow(-Math.log(1 - u2), 1.5), DAILY_CAP_MM) : 0;
    u2s[j] = u2;
    months[j] = calendarDay(firstDay + j, startMonth).month;
  }
  // kelompok bulan berurutan
  let j0 = 0;
  while (j0 < totalDays) {
    let j1 = j0;
    while (j1 < totalDays && months[j1] === months[j0]) j1++;
    const m = months[j0];
    const days = j1 - j0;
    const target = (monthly[m] * days) / MONTH_DAYS[m];
    const idx = [];
    let sum = 0;
    for (let j = j0; j < j1; j++) {
      idx.push(j);
      sum += amt[j];
    }
    if (target > 0) {
      if (sum <= 0) {
        let best = j0;
        for (let j = j0; j < j1; j++) if (u2s[j] > u2s[best]) best = j;
        amt[best] = target;
      } else {
        const s = target / sum;
        for (let j = j0; j < j1; j++) amt[j] *= s;
      }
      capAndRedistribute(amt, idx, DAILY_CAP_MM, target, u2s);
    } else {
      for (let j = j0; j < j1; j++) amt[j] = 0;
    }
    j0 = j1;
  }
  return amt;
}

/** Durasi & awal badai (jam) dari total harian (mm) dan dua bilangan acak. */
export function stormWindow(total, u3, u4) {
  let dur;
  if (total < 10) dur = 1 + Math.floor(u3 * 2);
  else if (total < 40) dur = 2 + Math.floor(u3 * 3);
  else if (total < 100) dur = 4 + Math.floor(u3 * 5);
  else dur = 8 + Math.floor(u3 * 9);
  let start = total < 40 ? 13 + Math.floor(u4 * 6) : Math.floor(u4 * 24);
  start = Math.min(start, 24 - dur);
  return { dur, start };
}

/** Disagregasi ke per jam: bentuk segitiga, puncak di 1/3 durasi, jumlah per hari tepat sama. */
export function disaggregateHourly(daily, seed) {
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const hourly = new Float64Array(daily.length * 24);
  for (let d = 0; d < daily.length; d++) {
    const u3 = rng();
    const u4 = rng();
    const total = daily[d];
    if (!(total > 0)) continue;
    const { dur, start } = stormWindow(total, u3, u4);
    const tp = dur / 3;
    let wsum = 0;
    const w = new Float64Array(dur);
    for (let j = 0; j < dur; j++) {
      const t = j + 0.5;
      w[j] = t < tp ? t / tp : (dur - t) / (dur - tp);
      if (w[j] < 0) w[j] = 0;
      wsum += w[j];
    }
    for (let j = 0; j < dur; j++) hourly[d * 24 + start + j] = (total * w[j]) / wsum;
  }
  return hourly;
}

/** Bobot harian ETp per jam: sin(π(t − 6)/12) untuk jam 06–18, dinormalisasi (jumlah = 1). */
export const ETP_DIURNAL = Object.freeze(
  (() => {
    const w = [];
    let s = 0;
    for (let h = 0; h < 24; h++) {
      const v = Math.max(0, Math.sin((Math.PI * (h + 0.5 - 6)) / 12));
      w.push(v);
      s += v;
    }
    return w.map((v) => v / s);
  })(),
);

export function rainClass(mmPerDay) {
  if (mmPerDay < 0.5) return { id: 'tidak-hujan', label: 'Tidak hujan' };
  if (mmPerDay < 20) return { id: 'ringan', label: 'Ringan' };
  if (mmPerDay < 50) return { id: 'sedang', label: 'Sedang' };
  if (mmPerDay < 100) return { id: 'lebat', label: 'Lebat' };
  if (mmPerDay < 150) return { id: 'sangat-lebat', label: 'Sangat lebat' };
  return { id: 'ekstrem', label: 'Ekstrem' };
}
