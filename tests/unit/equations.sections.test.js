// Tes bagian-bagian tab Persamaan di Node (tanpa DOM): setiap bagian menghasilkan MathML,
// markup well-formed, tanpa NaN/undefined, dan angka kunci sama dengan snapshot model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createModel, advance, snapshot, setControl } from '../../js/model/index.js';
import { EQ_SECTIONS } from '../../js/core/config.js';
import { fmtQ } from '../../js/ui/format.js';
import { buildContext } from '../../js/ui/equations/context.js';
import * as neraca from '../../js/ui/equations/sections/neraca.js';
import * as hujanEt from '../../js/ui/equations/sections/hujan-et.js';
import * as gambut from '../../js/ui/equations/sections/gambut.js';
import * as kubah from '../../js/ui/equations/sections/kubah.js';
import * as airtanah from '../../js/ui/equations/sections/airtanah.js';
import * as parit from '../../js/ui/equations/sections/parit.js';
import * as kanal from '../../js/ui/equations/sections/kanal.js';
import * as pintuAir from '../../js/ui/equations/sections/pintu-air.js';
import * as numerik from '../../js/ui/equations/sections/numerik.js';
import * as klasifikasi from '../../js/ui/equations/sections/klasifikasi.js';
import * as parameter from '../../js/ui/equations/sections/parameter.js';
import { parseMarkup, findAll, MATHML_ARITY } from './equations.xml.js';

const MODULES = [neraca, hujanEt, gambut, kubah, airtanah, parit, kanal, pintuAir, numerik, klasifikasi, parameter];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function textOf(node) {
  return node.text + node.children.map(textOf).join('');
}

function checkMarkup(html, where) {
  let tree;
  try {
    tree = parseMarkup(html);
  } catch (e) {
    throw new Error(`${where}: ${e.message}`);
  }
  const text = textOf(tree);
  assert.doesNotMatch(text, /\bNaN\b|undefined|\[object Object\]|Infinity/, `${where}: teks memuat nilai tidak sah`);
  for (const [tag, n] of Object.entries(MATHML_ARITY)) {
    for (const node of findAll(tree, tag)) assert.equal(node.children.length, n, `${where}: <${tag}> harus punya ${n} anak`);
  }
  return tree;
}

function checkPlot(spec, where) {
  for (const ax of ['x', 'y']) {
    assert.ok(Number.isFinite(spec[ax].min) && Number.isFinite(spec[ax].max), `${where}: sumbu ${ax} terhingga`);
    assert.ok(spec[ax].max > spec[ax].min, `${where}: sumbu ${ax} max > min`);
  }
  for (const s of spec.series ?? []) assert.equal(s.x.length, s.y.length, `${where}: panjang seri`);
}

/** Model dalam berbagai keadaan (cabang persamaan berbeda). */
function cases() {
  const out = [];
  const mk = (name, opts, hours, after) => {
    const m = createModel(opts);
    advance(m, hours);
    if (after) after(m);
    out.push({ name, m });
  };
  mk('hujan hari 20', { scenarioId: 'hujan' }, 24 * 20);
  mk('ekstrem badai (genangan, terendam)', { scenarioId: 'ekstrem' }, 24 * 15 + 18);
  mk('kemarau hari 60', { scenarioId: 'kemarau' }, 24 * 60);
  mk('normal awal (k = 0)', { scenarioId: 'normal' }, 0);
  mk('manual aliran balik', { scenarioId: 'manual', manual: { rainMmd: 0, etpMmd: 4, riverM: -0.15 }, control: { nLogs: 0 } }, 30);
  mk('manual pintu klep', { scenarioId: 'manual', manual: { rainMmd: 0, etpMmd: 4, riverM: -0.15 }, control: { nLogs: 0, flapGate: true } }, 30);
  mk('tanpa parit, kubah datar, otomatis PP', { scenarioId: 'hujan', params: { 'fieldDrains.enabled': false, 'geom.Hd': 0 }, control: { mode: 'auto', target: 'pp' } }, 24 * 10);
  mk('stoplog 9 (saluran tinggi, parit mengisi)', { scenarioId: 'hujan' }, 24 * 5, (m) => {
    setControl(m, { nLogs: 9 });
    advance(m, 24 * 3);
  });
  return out;
}

test('setiap id bagian EQ_SECTIONS punya modul dengan id yang sama', () => {
  assert.deepEqual(
    MODULES.map((m) => m.id),
    EQ_SECTIONS.map((s) => s.id),
  );
  for (const m of MODULES) for (const fn of ['render', 'live', 'plots']) assert.equal(typeof m[fn], 'function', `${m.id}.${fn}`);
});

for (const { name, m } of cases()) {
  test(`semua bagian: ${name}`, () => {
    const snap = snapshot(m);
    for (const pz of ['P1', 'P2', 'P3', 'P4']) {
      const c = buildContext(m, snap, { piezometer: pz });
      assert.equal(c.pz, pz);
      for (const mod of MODULES) {
        const where = `${name} / ${pz} / ${mod.id}`;
        const html = mod.render(c);
        assert.match(html, /<math[\s>]/, `${where}: render memuat <math>`);
        checkMarkup(html, `${where} render`);
        // setiap data-live di render terisi oleh live()
        const keys = [...html.matchAll(/data-live="([^"]+)"/g)].map((x) => x[1]);
        const live = mod.live(c);
        for (const k of keys) assert.equal(typeof live[k], 'string', `${where}: live['${k}']`);
        for (const [k, v] of Object.entries(live)) checkMarkup(v, `${where} live ${k}`);
        const plotKeys = [...html.matchAll(/data-plot="([^"]+)"/g)].map((x) => x[1]);
        const plots = mod.plots(c);
        for (const k of plotKeys) {
          assert.ok(plots[k], `${where}: spesifikasi plot '${k}'`);
          checkPlot(plots[k], `${where} plot ${k}`);
        }
      }
    }
  });
}

test('pintu-air: [data-eq-value="weir-q"] = fmtQ(snapshot.structure.q_m3s) di semua cabang', () => {
  for (const { name, m } of cases()) {
    const snap = snapshot(m);
    const c = buildContext(m, snap, {});
    const html = pintuAir.live(c)['pa-calc'];
    const tree = parseMarkup(html);
    const hits = [];
    (function walk(n) {
      if (n.attrs?.['data-eq-value'] === 'weir-q') hits.push(n);
      n.children.forEach(walk);
    })(tree);
    assert.equal(hits.length, 1, `${name}: tepat satu elemen weir-q`);
    assert.equal(textOf(hits[0]), fmtQ(snap.structure.q_m3s), name);
  }
});

test('cabang pintu air yang diuji benar-benar berbeda', () => {
  const regimes = new Set();
  for (const { m } of cases()) {
    const w = buildContext(m, snapshot(m), {}).e.weir;
    regimes.add(w.H1 <= 0 && w.H2 <= 0 ? 'nol' : w.flapBlocked ? 'klep' : !w.forward ? 'balik' : w.submerged ? 'terendam' : 'bebas');
  }
  for (const r of ['bebas', 'balik', 'klep']) assert.ok(regimes.has(r), `cabang '${r}' tercakup (dapat: ${[...regimes]})`);
});

test('arsitektur: js/ui/equations tidak mengimpor three, tidak fetch, tidak console/alert', () => {
  const dir = path.join(ROOT, 'js/ui/equations');
  const files = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.js')) files.push(p);
    }
  })(dir);
  assert.ok(files.length >= 16);
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);
    assert.doesNotMatch(src, /from\s+['"]three/, `${rel}: tidak boleh mengimpor three`);
    assert.doesNotMatch(src, /\bfetch\(|\bconsole\.|\balert\(|\bconfirm\(|\bprompt\(|localStorage/, `${rel}: API terlarang`);
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      assert.ok(m[1].startsWith('.'), `${rel}: impor relatif saja (${m[1]})`);
    }
  }
});
