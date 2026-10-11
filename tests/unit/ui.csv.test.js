// Tes pembangun CSV dan baris tabel harian (tanpa DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModel, advance, dailySeries } from '../../js/model/index.js';
import { dailyRows, buildCsv, csvCell, csvColumns } from '../../js/ui/csv.js';
import { rowHtml } from '../../js/ui/table.js';

function series(id = 'kemarau', hours = 24 * 20 + 5) {
  const m = createModel({ scenarioId: id });
  advance(m, hours);
  return dailySeries(m);
}

test('csvCell meng-escape koma, kutip, dan baris baru (RFC 4180)', () => {
  assert.equal(csvCell('a'), 'a');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('kata "kutip"'), '"kata ""kutip"""');
  assert.equal(csvCell('x\ny'), '"x\ny"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(0), '0');
});

test('buildCsv: kepala kolom, satu baris per hari, CRLF, titik desimal', () => {
  const s = series();
  const csv = buildCsv(s);
  const lines = csv.split('\r\n');
  assert.equal(lines.at(-1), '', 'diakhiri CRLF');
  const head = lines[0].split(',');
  assert.deepEqual(head.slice(0, 3), ['hari', 'tanggal', 'hujan_mm']);
  for (const id of s.piezometerIds) assert.ok(head.includes(`${id}_cm`));
  assert.ok(head.includes('TMAS_cm') && head.includes('Q_m3_s') && head.includes('PP_57_2016'));
  assert.equal(lines.length - 2, s.n, 'satu baris per hari (termasuk hari parsial)');
  const row = lines[1].split(',');
  assert.equal(row.length, head.length);
  assert.equal(row[0], '1', 'hari pertama = 1');
  assert.ok(!/\d,\d/.test(lines[1].split(',').slice(2, 3).join()), 'angka memakai titik desimal');
});

test('dailyRows: muka air sebagai elevasi negatif, kategori & PP dari titik penaatan', () => {
  const s = series('kemarau', 24 * 40);
  const rows = dailyRows(s);
  assert.equal(rows.length, s.n);
  const r = rows[rows.length - 1];
  for (const id of s.piezometerIds) assert.equal(r.elev[id], -s.depthCm[id][s.n - 1]);
  assert.equal(r.tmas, -s.tmasCm[s.n - 1]);
  const tp = s.tpDepthCm[s.n - 1];
  assert.equal(r.pp, tp <= 40);
  assert.ok(['agak-kering', 'kering', 'normal', 'agak-tergenang', 'tergenang'].includes(r.cls.id));
  const cols = csvColumns(s.piezometerIds).map(([h]) => h);
  assert.equal(new Set(cols).size, cols.length, 'judul kolom unik');
});

test('rowHtml: angka berformat Indonesia, tanda minus tipografis, label kategori ter-escape', () => {
  const s = series('kemarau', 24 * 10);
  const [r] = dailyRows(s);
  const html = rowHtml(r, s.piezometerIds, s.tpId);
  assert.match(html, /^<tr/);
  assert.ok(html.includes('−'), 'elevasi negatif memakai minus U+2212');
  assert.ok(html.includes(r.cls.label));
  const evil = { ...r, date: '<b>x</b>', cls: { id: 'normal', label: 'A&B' } };
  const h2 = rowHtml(evil, s.piezometerIds, s.tpId);
  assert.ok(h2.includes('&lt;b&gt;x&lt;/b&gt;') && h2.includes('A&amp;B'));
});
