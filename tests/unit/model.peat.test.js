import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMS, specificYield, storageFromDepth, depthFromStorage, transmissivity, conductivity, etBeta } from '../../js/model/index.js';

const peat = DEFAULT_PARAMS.peat;
const forest = { ...DEFAULT_PARAMS.peat, Ks: 200 }; // nilai acuan T(0) = 53,75 dihitung dengan Ks 200
const D = 4;

test('W ↔ ζ bolak-balik sampai 1e-10 untuk ζ ∈ [−0,5; 3,95]', () => {
  for (let zeta = -0.5; zeta <= 3.95; zeta += 0.01) {
    const W = storageFromDepth(zeta, peat);
    const back = depthFromStorage(W, peat);
    assert.ok(Math.abs(back - zeta) < 1e-10, `ζ=${zeta} → ${back}`);
    const warm = depthFromStorage(W, peat, zeta + 0.3);
    assert.ok(Math.abs(warm - zeta) < 1e-10);
  }
});

test('dW/dz = Sy (turunan numerik)', () => {
  const h = 1e-6;
  for (const zeta of [0.05, 0.2, 0.5, 1, 2, 3.5]) {
    const dWdz = (storageFromDepth(zeta - h, peat) - storageFromDepth(zeta + h, peat)) / (2 * h);
    assert.ok(Math.abs(dWdz - specificYield(zeta, peat)) < 1e-6, `ζ=${zeta}`);
  }
  assert.equal(specificYield(-0.1, peat), 1);
});

test('T(0) = 53,75 m²/hari, T(D) = 0, T menurun monoton, K(0) = Ks', () => {
  assert.ok(Math.abs(transmissivity(0, D, forest) - 53.75) < 0.01);
  assert.ok(Math.abs(transmissivity(0, D, peat) - (4 + 49 * 0.25 * (1 - Math.exp(-16)))) < 1e-9);
  assert.equal(transmissivity(D, D, peat), 0);
  assert.equal(transmissivity(-0.2, D, peat), transmissivity(0, D, peat));
  let prev = Infinity;
  for (let z = 0; z <= D; z += 0.05) {
    const T = transmissivity(z, D, peat);
    assert.ok(T <= prev + 1e-12);
    prev = T;
  }
  assert.equal(conductivity(0, peat), peat.Ks);
  // cek nilai acuan
  assert.ok(Math.abs(transmissivity(0.3, D, forest) - 18.7) < 0.1);
  assert.ok(Math.abs(transmissivity(0.6, D, forest) - 7.9) < 0.1);
});

test('faktor ET β: 1 sampai 0,4 m, 0,3 di 1,2 m, nol di dasar gambut', () => {
  const et = DEFAULT_PARAMS.et;
  assert.equal(etBeta(0.3, D, et), 1);
  assert.ok(Math.abs(etBeta(1.2, D, et) - 0.3) < 1e-12);
  assert.ok(Math.abs(etBeta(0.8, D, et) - 0.65) < 1e-12);
  assert.equal(etBeta(D, D, et), 0);
  assert.ok(etBeta(D - 0.1, D, et) < 0.3);
});
