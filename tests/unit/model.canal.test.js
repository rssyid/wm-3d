import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PARAMS,
  weirQ,
  villemonte,
  crestLevel,
  canalVolume,
  canalWetArea,
  canalLevelFromVolume,
  solveCanalLevel,
  channelSegments,
} from '../../js/model/index.js';

const weir = DEFAULT_PARAMS.weir;
const segs = channelSegments(DEFAULT_PARAMS.geom);
const zBank = 0;

test('ambang bebas: H = 0,2 m, L = 1,5 m → Q = 0,22807 m³/s', () => {
  const crest = -0.6;
  assert.ok(Math.abs(weirQ(crest + 0.2, -10, crest, weir) - 0.22807) < 1e-5);
  assert.ok(Math.abs(weirQ(crest + 0.22, -10, crest, weir) - 0.263) < 2e-3);
});

test('Q = 0 di bawah mercu dan saat muka air sama', () => {
  const crest = -0.6;
  assert.equal(weirQ(-0.7, -0.9, crest, weir), 0);
  assert.equal(weirQ(-0.6, -0.6, crest, weir), 0);
  assert.equal(weirQ(-0.3, -0.3, crest, weir), 0);
});

test('aliran terendam < aliran bebas; monoton terhadap hc; antisimetris; pintu klep', () => {
  const crest = -0.6;
  assert.ok(weirQ(-0.3, -0.45, crest, weir) < weirQ(-0.3, -2, crest, weir));
  assert.ok(villemonte(0.5) < 1 && villemonte(0) === 1 && villemonte(1) === 0);
  for (const hr of [-2, -0.5, -0.3, 0]) {
    let prev = -Infinity;
    for (let hc = -1.5; hc <= 0.5; hc += 0.01) {
      const q = weirQ(hc, hr, crest, weir);
      assert.ok(q >= prev - 1e-12, `tidak monoton pada hc=${hc}, hr=${hr}`);
      prev = q;
    }
  }
  for (const [a, b] of [[-0.3, -0.5], [-0.2, -1], [0, -0.55]]) {
    assert.ok(Math.abs(weirQ(a, b, crest, weir) + weirQ(b, a, crest, weir)) < 1e-12);
  }
  assert.ok(weirQ(-0.5, -0.2, crest, weir) < 0);
  assert.equal(weirQ(-0.5, -0.2, crest, weir, true), 0);
});

test('mercu = ambang + 0,2·n; volume dan luas kanal konsisten', () => {
  assert.ok(Math.abs(crestLevel(8, weir) - -0.4) < 1e-12);
  assert.ok(Math.abs(crestLevel(0, weir) - -2.0) < 1e-12);
  const Acp = segs.reduce((s, c) => s + c.L * c.B, 0);
  assert.ok(Math.abs(Acp - 6240) < 1e-9);
  // dV/dh = Aw
  for (const h of [-2.0, -1.2, -0.5, 0.2]) {
    const e = 1e-6;
    const dVdh = (canalVolume(h + e, segs, zBank) - canalVolume(h - e, segs, zBank)) / (2 * e);
    assert.ok(Math.abs(dVdh - canalWetArea(h, segs, zBank)) / dVdh < 1e-5, `h=${h}`);
    assert.ok(Math.abs(canalLevelFromVolume(canalVolume(h, segs, zBank), segs, zBank) - h) < 1e-9);
  }
});

test('solusi implisit kanal: surut monoton, tak di bawah mercu, volume lepas = V0 − Vakhir', () => {
  const crest = -0.6;
  for (const dt of [1, 1 / 24]) {
    let h = crest + 0.4;
    const V0 = canalVolume(h, segs, zBank);
    let V = V0;
    let released = 0;
    const steps = dt === 1 ? 20 : 24 * 20;
    for (let s = 0; s < steps; s++) {
      const hn = solveCanalLevel(V, dt, -10, crest, weir, false, segs, zBank);
      const q = weirQ(hn, -10, crest, weir);
      const vol = 86400 * dt * q;
      released += vol;
      V -= vol;
      assert.ok(hn <= h + 1e-12, 'muka air harus turun');
      assert.ok(hn >= crest - 1e-9, 'tidak boleh di bawah mercu');
      assert.ok(V >= 0);
      h = hn;
    }
    assert.ok(Math.abs(V0 - V - released) < 1e-6);
    assert.ok(Math.abs(canalVolume(h, segs, zBank) - V) / V0 < 1e-9);
  }
});
