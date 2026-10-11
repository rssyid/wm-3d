// Tes penempatan label (fungsi murni declutter) dan jumlah partikel hujan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { declutter } from '../../js/scene/labels.js';
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
