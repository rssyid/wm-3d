import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarioForcing, SCENARIOS, MONTH_DAYS, calendarDay, generateDailyRain, dateLabel, ETP_DIURNAL } from '../../js/model/index.js';

test('deterministik per seed', () => {
  const a = scenarioForcing('normal');
  const b = scenarioForcing('normal');
  assert.deepEqual(Array.from(a.hourly), Array.from(b.hourly));
  const c = scenarioForcing('normal', { seed: 99 });
  assert.notDeepEqual(Array.from(a.daily), Array.from(c.daily));
});

test('jumlah per jam = total harian (1e-9)', () => {
  for (const id of Object.keys(SCENARIOS)) {
    const f = scenarioForcing(id);
    for (let j = 0; j < f.daily.length; j++) {
      let s = 0;
      for (let h = 0; h < 24; h++) s += f.hourly[j * 24 + h];
      assert.ok(Math.abs(s - f.daily[j]) < 1e-9, `${id} hari ${j}`);
    }
  }
});

test('total bulanan skenario normal tepat sama dengan target (1e-9)', () => {
  const f = scenarioForcing('normal');
  const sc = SCENARIOS.normal;
  const totals = new Array(12).fill(0);
  for (let d = 0; d < sc.days; d++) totals[calendarDay(d, sc.startMonth).month] += f.dayRain(d);
  for (let mth = 0; mth < 12; mth++) assert.ok(Math.abs(totals[mth] - sc.rain.monthly[mth]) < 1e-9, `bulan ${mth}`);
  assert.ok(Math.abs(totals.reduce((a, b) => a + b, 0) - 2390) < 1e-6);
});

test('bulan parsial diprorata, batas 250 mm/hari dihormati', () => {
  const amt = generateDailyRain({ seed: 5, p01: 0.1, p11: 0.2, monthly: new Array(12).fill(900) }, 0, 59, 0);
  for (const v of amt) assert.ok(v <= 250 + 1e-9);
  const jan = amt.slice(0, 31).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(jan - 900) < 1e-6);
});

test('urutan rata-rata hujan: kemarau < normal < hujan; maksimum ekstrem = 170 mm', () => {
  const mean = (id) => {
    const f = scenarioForcing(id);
    let s = 0;
    for (let d = 0; d < f.days; d++) s += f.dayRain(d);
    return s / f.days;
  };
  assert.ok(mean('kemarau') < mean('normal'));
  assert.ok(mean('normal') < mean('hujan'));
  const e = scenarioForcing('ekstrem');
  let max = 0;
  for (let d = 0; d < e.days; d++) max = Math.max(max, e.dayRain(d));
  assert.equal(max, 170);
  assert.equal(e.dayRain(14), 170);
});

test('kalender & bobot ETp', () => {
  assert.equal(dateLabel(0, 0), '1 Jan');
  assert.equal(dateLabel(31, 0), '1 Feb');
  assert.equal(dateLabel(-1, 5), '31 Mei');
  assert.equal(dateLabel(364, 0), '31 Des');
  assert.equal(MONTH_DAYS.reduce((a, b) => a + b, 0), 365);
  assert.ok(Math.abs(ETP_DIURNAL.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.equal(ETP_DIURNAL[2], 0);
});
