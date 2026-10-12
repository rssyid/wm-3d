// Tes penempatan label (fungsi murni declutter) dan jumlah partikel hujan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { declutter, gateWarnCode, GATE_WARN, tpTagText } from '../../js/scene/labels.js';
import { rainCount } from '../../js/scene/particles.js';

const pin = (x, y, w = 80, h = 20, priority = 5) => ({ x, y, w, h, priority, base: 10, fixed: false, visible: true });

test('declutter: label yang bertumpuk digeser (samping bila cukup, atas bila tidak), yang terpisah tetap', () => {
  const items = [pin(100, 200), pin(110, 200), pin(400, 200), pin(170, 200)];
  const off = declutter(items);
  const dx = declutter.dx;
  assert.equal(off[0], 10);
  assert.equal(off[2], 10);
  assert.equal(dx[2], 0);
  assert.ok(off[1] > off[0] + 15, `label kedua (terlalu dekat) naik (${off[1]})`);
  assert.equal(off[3], 10, 'label keempat cukup digeser ke samping');
  assert.ok(dx[3] > 0 && dx[3] <= 0.4 * 80, `geser ${dx[3]}`);
  // tidak ada tumpang-tindih setelah penempatan
  const rects = items.map((it, i) => ({ l: it.x + dx[i] - it.w / 2, r: it.x + dx[i] + it.w / 2, t: it.y - off[i] - it.h, b: it.y - off[i] }));
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      assert.ok(!(a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t), `label ${i} dan ${j} bertumpuk`);
    }
});

test('declutter: label tetap yang bertabrakan disembunyikan (−1), prioritas kecil menang', () => {
  const zone = (x, y, priority) => ({ x, y, w: 90, h: 18, priority, base: 0, fixed: true, visible: true });
  const off = declutter([zone(200, 100, 6), zone(205, 104, 4), zone(600, 100, 5)]);
  assert.equal(off[0], -1);
  assert.equal(off[1], 0);
  assert.equal(off[2], 0);
});

test('jumlah garis hujan ∝ √(min(I,30)/30), nol di bawah 0,1 mm/jam', () => {
  assert.equal(rainCount(0, 3000), 0);
  assert.equal(rainCount(0.05, 3000), 0);
  assert.equal(rainCount(30, 3000), 3000);
  assert.equal(rainCount(120, 3000), 3000);
  assert.equal(rainCount(7.5, 3000), 1500);
  assert.equal(rainCount(30, 1000), 1000);
  assert.ok(rainCount(1, 3000) < rainCount(2, 3000));
});

test('peringatan pintu air: terendam ≠ aliran balik; klep menutup', () => {
  const st = (o) => ({ q_m3s: 0.2, crestM: -0.6, flapGate: false, submerged: false, riverAboveCrest: false, ...o });
  assert.equal(gateWarnCode(st(), -1.8, -0.5), 0, 'sungai di bawah mercu: tanpa peringatan');
  // sungai di atas mercu tetapi air tetap keluar (Q > 0): terendam, bukan "aliran balik"
  assert.equal(GATE_WARN[gateWarnCode(st({ submerged: true, riverAboveCrest: true }), -0.15, -0.06)], 'Terendam');
  assert.equal(GATE_WARN[gateWarnCode(st({ q_m3s: -0.05, riverAboveCrest: true }), -0.1, -0.5)], 'Aliran balik ke saluran');
  assert.equal(GATE_WARN[gateWarnCode(st({ q_m3s: 0, flapGate: true, riverAboveCrest: true }), -0.1, -0.5)], 'Klep menutup');
  assert.match(tpTagText(true), /TP.*PP.*patuh/);
  assert.match(tpTagText(false), /tidak patuh/);
});

test('declutter: label di tepi viewport dijepit ke dalam SEBELUM uji tabrakan (tidak menimpa tetangga)', () => {
  // P3 di x = 480 (lebar 110), P4 di x = 640 (lebar 260) pada viewport 668 px: P4 harus digeser ke kiri
  // dan tidak boleh lagi menimpa P3 di ketinggian yang sama
  const items = [pin(480, 100, 110, 22, 3), pin(640, 100, 260, 22, 4)];
  const off = declutter(items, 3, 10, 668);
  const dx = declutter.dx;
  const r = items.map((it, i) => ({ l: it.x + dx[i] - it.w / 2, r: it.x + dx[i] + it.w / 2, t: it.y - off[i] - it.h, b: it.y - off[i] }));
  assert.ok(r[1].r <= 668 - 4 + 0.5, `P4 di dalam viewport (${r[1].r})`);
  assert.ok(Math.abs(dx[1]) <= 260 / 2 - 6, 'garis penunjuk tetap menyentuh label');
  const overlap = r[0].l < r[1].r && r[0].r > r[1].l && r[0].t < r[1].b && r[0].b > r[1].t;
  assert.equal(overlap, false, 'tidak bertumpuk setelah dijepit');
  // tanpa lebar viewport: perilaku lama (tanpa penjepitan)
  declutter([pin(640, 100, 260, 22, 4)]);
  assert.equal(declutter.dx[0], 0);
});
