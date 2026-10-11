// Tes matematika grafik (tanpa DOM): skala, tick, domain, jendela bergulir, tata letak, pita kategori.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  linearScale,
  niceStep,
  niceTicks,
  niceCeil,
  xDomain,
  visibleRange,
  sliceSeries,
  waterDomain,
  rainDomain,
  flowDomain,
  dayTicks,
  nearestIndex,
  chartLayout,
  classBands,
} from '../../js/ui/chartmath.js';
import { TMAT_CLASSES } from '../../js/model/index.js';

test('linearScale memetakan dan membalik (termasuk sumbu terbalik)', () => {
  const s = linearScale(0, 100, 10, 210);
  assert.equal(s(0), 10);
  assert.equal(s(50), 110);
  assert.equal(s.invert(210), 100);
  const y = linearScale(-120, 20, 200, 60); // nilai besar di atas
  assert.equal(y(20), 60);
  assert.equal(y(-120), 200);
  assert.ok(Math.abs(y.invert(y(-40)) + 40) < 1e-9);
});

test('niceStep/niceTicks memberi kelipatan 1–2–2,5–5 × 10^k dan memuat 0', () => {
  assert.equal(niceStep(140, 5), 50);
  assert.equal(niceStep(10, 4), 2.5);
  assert.equal(niceStep(0, 4), 1);
  const t = niceTicks(-120, 20, 5);
  assert.deepEqual(t, [-100, -50, 0]);
  for (const v of niceTicks(-0.3, 0.7, 5)) assert.ok(Number.isFinite(v));
  assert.deepEqual(niceTicks(5, 1, 2), [2, 4]); // urutan terbalik ditangani
  assert.deepEqual(niceTicks(NaN, 1), []);
  assert.equal(niceCeil(17), 20);
  assert.equal(niceCeil(0), 0);
});

test('xDomain: skenario 0..hari; Manual memakai jendela 60 hari terakhir', () => {
  assert.deepEqual(xDomain({ n: 10, day: [], scenarioDays: 120 }), [0, 120]);
  assert.deepEqual(xDomain({ n: 5, day: [0, 1, 2, 3, 4], scenarioDays: Infinity }), [0, 60]);
  const day = Array.from({ length: 90 }, (_, i) => i);
  assert.deepEqual(xDomain({ n: 90, day, scenarioDays: Infinity }), [30, 90]);
  assert.deepEqual(xDomain(null), [0, 60]);
});

test('visibleRange + sliceSeries memotong semua deret dengan konsisten', () => {
  const day = Array.from({ length: 90 }, (_, i) => i);
  const [i0, i1] = visibleRange(day, 30, 90);
  assert.equal(i0, 30);
  assert.equal(i1, 90);
  assert.deepEqual(visibleRange(day, 0, 200), [0, 90]);
  const series = {
    n: 90,
    scenarioDays: Infinity,
    piezometerIds: ['P1'],
    day,
    rain_mm: day.map((d) => d * 2),
    depthCm: { P1: day.map((d) => d + 0.5) },
  };
  const s = sliceSeries(series, i0, i1);
  assert.equal(s.n, 60);
  assert.equal(s.day[0], 30);
  assert.equal(s.rain_mm[0], 60);
  assert.equal(s.depthCm.P1.length, 60);
  assert.equal(s.depthCm.P1[59], 89.5);
  assert.deepEqual(s.piezometerIds, ['P1']);
  assert.equal(sliceSeries(series, 0, 90), series);
});

test('domain panel: muka air ≥ [−120, +20], hujan ≥ 20, pembuangan memuat 0 dan aliran balik', () => {
  assert.deepEqual(waterDomain([[-30, -50], [-10]]), [-120, 20]);
  const [lo, hi] = waterDomain([[-150, 12]]);
  assert.ok(lo <= -150 && lo % 20 === 0);
  assert.equal(hi, 20);
  assert.deepEqual(waterDomain([[NaN]]), [-120, 20]);
  assert.deepEqual(rainDomain([0, 3]), [0, 20]);
  assert.ok(rainDomain([0, 170])[1] >= 170);
  const [f0, f1] = flowDomain([0, 1]);
  assert.ok(f0 === 0 && f1 >= 5);
  const [b, t] = flowDomain([-3, 42]);
  assert.ok(b <= -3 && t >= 42);
});

test('dayTicks: nama bulan Indonesia pada tanggal 1, tick tambahan untuk rentang pendek', () => {
  const t = dayTicks(0, 365, 0, 600);
  const months = t.filter((x) => x.major).map((x) => x.label);
  assert.equal(months[0], 'Jan');
  assert.ok(months.includes('Agu'));
  assert.ok(months.includes('Des'));
  const short = dayTicks(0, 20, 0, 600);
  assert.ok(short.length >= 2, 'rentang pendek tetap punya tick');
  for (let i = 1; i < short.length; i++) assert.ok(short[i].day > short[i - 1].day);
});

test('nearestIndex memilih hari yang menampung posisi kursor', () => {
  const days = [0, 1, 2, 3];
  assert.equal(nearestIndex(days, 0.2), 0);
  assert.equal(nearestIndex(days, 2.6), 2);
  assert.equal(nearestIndex(days, 99), 3);
  assert.equal(nearestIndex([], 1), -1);
});

test('chartLayout: tiga panel tidak tumpang tindih dan muat di tinggi kanvas', () => {
  for (const [w, h] of [[640, 210], [360, 330], [900, 180]]) {
    const L = chartLayout(w, h, { left: 40, right: 52, top: 14, gap: 15, axis: 16 });
    assert.ok(L.rain.y + L.rain.h < L.water.y);
    assert.ok(L.water.y + L.water.h < L.flow.y);
    assert.ok(L.axisY + 12 <= h + 1, `sumbu-x muat (${w}×${h})`);
    assert.ok(L.water.h >= L.rain.h, 'panel muka air paling tinggi');
    assert.ok(L.plot.w > 0);
  }
});

test('classBands: pita kategori perusahaan dalam elevasi; Normal = −60…−45 cm', () => {
  const bands = classBands(TMAT_CLASSES, [-120, 20]);
  const normal = bands.find((b) => b.id === 'normal');
  assert.deepEqual([normal.bottom, normal.top], [-60, -45]);
  const banjir = bands.find((b) => b.id === 'banjir');
  assert.deepEqual([banjir.bottom, banjir.top], [0, 20]);
  const kering = bands.find((b) => b.id === 'kering');
  assert.deepEqual([kering.bottom, kering.top], [-120, -65]);
  assert.equal(bands.length, 6);
  // urutan tanpa celah: tiap pita berbatasan dengan pita berikutnya
  for (let i = 1; i < bands.length; i++) assert.equal(bands[i].top, bands[i - 1].bottom);
});
