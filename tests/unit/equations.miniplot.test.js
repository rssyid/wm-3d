// Tes fungsi murni grafik mini & pembantu tabel tab Persamaan (regresi hasil review).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { niceTicks, logTicks, tickDigits } from '../../js/ui/equations/miniplot.js';
import { table, stripTags } from '../../js/ui/equations/common.js';
import { fmt } from '../../js/ui/format.js';
import { createModel, snapshot, advance } from '../../js/model/index.js';
import { buildContext } from '../../js/ui/equations/context.js';
import * as neraca from '../../js/ui/equations/sections/neraca.js';
import * as pintuAir from '../../js/ui/equations/sections/pintu-air.js';

test('tickDigits: desimal cukup untuk setiap kelipatan langkah (2,5 → 1; 0,25 → 2)', () => {
  assert.equal(tickDigits(2.5), 1);
  assert.equal(tickDigits(0.25), 2);
  assert.equal(tickDigits(25), 0);
  assert.equal(tickDigits(0.5), 1);
  assert.equal(tickDigits(1), 0);
  assert.equal(tickDigits(0.025), 3);
  assert.equal(tickDigits(0.2), 1);
  // label tick tidak boleh membulatkan nilai (dulu 7,5 tampil sebagai "8")
  const { ticks, step } = niceTicks(0, 11, 5);
  const labels = ticks.map((v) => fmt(v, tickDigits(step)));
  assert.equal(new Set(labels).size, labels.length, `label unik: ${labels}`);
  for (const [j, v] of ticks.entries()) assert.equal(Number(labels[j].replace(',', '.')), v);
});

test('niceTicks: sumbu bilangan bulat (hari) tidak memberi tick pecahan', () => {
  const one = niceTicks(0.5, 1.5, 6, 1);
  assert.deepEqual(one.ticks, [1]);
  for (const [lo, hi] of [[0.5, 15.5], [31.5, 60.5], [0.5, 3.5]]) {
    const t = niceTicks(lo, hi, 6, 1);
    assert.ok(t.step >= 1 && Number.isInteger(t.step), `langkah bulat (${t.step})`);
    for (const v of t.ticks) assert.ok(Number.isInteger(v), `tick bulat ${v}`);
  }
  assert.deepEqual(niceTicks(0, 10, 5).ticks, [0, 2, 4, 6, 8, 10]);
});

test('logTicks: dekade dalam rentang', () => {
  assert.deepEqual(logTicks(1, 100), [1, 2, 5, 10, 20, 50, 100]);
  assert.ok(logTicks(0.8, 62.5).every((v) => v >= 0.8 && v <= 62.5));
});

test('table: keterangan di luar kotak gulir, tabel diberi nama aksesibel teks polos', () => {
  const html = table(['A', 'B'], [['x', '1']], { caption: 'Luas A<sub>tot</sub> &amp; mm', label: 'Tabel uji' });
  assert.match(html, /^<p class="eq-table-cap"[^>]*>Luas A<sub>tot<\/sub> &amp; mm<\/p><div class="eq-scroll"/);
  assert.match(html, /<table class="eq-table [^"]*" aria-label="Luas Atot &amp; mm">/);
  assert.doesNotMatch(html, /<caption>/);
  assert.equal(stripTags('a <b>b</b> &lt;c&gt;'), 'a b <c>');
});

test('neraca saat k = 0: tidak menulis "0 jam terakhir", grafik harian bersumbu hari bulat', () => {
  const m = createModel({ scenarioId: 'normal' });
  const c = buildContext(m, snapshot(m), {});
  const live = neraca.live(c);
  assert.doesNotMatch(live['nr-calc'], /\b0 jam terakhir/);
  assert.match(live['nr-calc'], /Belum ada jam yang dihitung/);
  const spec = neraca.plots(c)['nr-daily'];
  assert.equal(spec.x.integer, true);
});

test('pintu-air: rasio r ≤ 0 ditandai aliran bebas; kurva sungai saat ini bila sungai di atas mercu', () => {
  const free = createModel({ scenarioId: 'kemarau' });
  advance(free, 24 * 5);
  const cf = buildContext(free, snapshot(free), {});
  assert.doesNotMatch(pintuAir.live(cf)['pa-sym'], /tinggi energi/);
  assert.equal(pintuAir.plots(cf)['pa-rating'].series.length, 1, 'tanpa kurva sungai bila sungai di bawah mercu');

  const back = createModel({ scenarioId: 'manual', manual: { rainMmd: 0, etpMmd: 4, riverM: -0.15 }, control: { nLogs: 2 } });
  advance(back, 24);
  const cb = buildContext(back, snapshot(back), {});
  const spec = pintuAir.plots(cb)['pa-rating'];
  assert.equal(spec.series.length, 2, 'kurva Q(H₁) dengan muka sungai saat ini');
  assert.ok(spec.y.min < 0, 'sumbu Q memuat aliran balik');
  const w = cb.e.weir;
  const pt = spec.points[0];
  // titik operasi tepat pada kurva sungai saat ini (H₁ disisipkan ke grid), dan Q = 0 tepat di H₁ = H₂
  const H = spec.series[1].x;
  const Q = spec.series[1].y;
  const j = H.indexOf(pt.x);
  assert.ok(j >= 0, 'H₁ ada di grid kurva');
  assert.equal(Q[j], w.Q);
  assert.equal(pt.y, w.Q);
  const j2 = H.indexOf(w.H2);
  assert.ok(j2 >= 0 && Math.abs(Q[j2]) < 1e-12, 'Q = 0 saat H₁ = H₂');
  for (let k = 0; k < H.length; k++) if (H[k] < w.H2 - 1e-9) assert.ok(Q[k] < 0, 'aliran balik saat H₁ < H₂');
});
