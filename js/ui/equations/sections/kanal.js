// Bagian 7 — Neraca saluran (satu simpanan tergabung), volume prisma trapesium, TMAS.
// Sumber angka: explain().canal/geometry, canalVolume()/canalWetArea() per segmen (fungsi model), snapshot.canal.
import { canalVolume, canalWetArea } from '../../../model/index.js';
import { mi, mn, mo, row, sub, sup, eq, paren, frac, mtext, fn, space, cases, when, sum, up } from '../mathml.js';
import {
  SYM as S,
  esc,
  fmt,
  fmtSigned,
  display,
  symTable,
  calcBox,
  line,
  textLine,
  nm,
  nmp,
  plot,
  legendItem,
  table,
  h3,
  p,
  im,
  m3dToMm,
  unit,
} from '../common.js';

export const id = 'kanal';

const j = mi('j');
const yj = sub(mi('y'), j);
const Lj = sub(mi('L'), j);
const bj = sub(mi('b'), j);
const mj = sub(mi('m'), j);
const Bj = sub(mi('B'), j);
const zbj = sub(mi('z'), row(mi('b'), mo(','), j));
const Vstar = sup(mi('V'), mo('*'));

const SEG_NAMES = ['Saluran koleksi', 'Saluran utama'];

export function render(c) {
  const g = c.params.geom;
  return `
${p(`Saluran koleksi (${g.collection.count} × ${fmt(g.collection.length, 0)} m, di kedua sisi blok) dan saluran utama (${fmt(g.main.length, 0)} m, menuju pintu air) dianggap <strong>satu simpanan air</strong> dengan satu muka air ${im(S.hc)}: perbedaan muka air antar-ruas diabaikan. Penampang tiap segmen ${im(j)} berbentuk trapesium (lebar dasar ${im(bj)}, kemiringan talud ${im(mj)} horizontal : 1 vertikal); di atas tanggul air melimpas selebar bibir saluran ${im(Bj)}.`)}
${display(eq(fn(mi('V'), [S.hc]), sum(j, null, row(Lj, paren(row(bj, yj, mo('+'), mj, sup(yj, mn('2')), mo('+'), Bj, fn('max', [row(S.hc, mo('−'), S.zbank), mn('0')], ';')), '[', ']')))), '7.1')}
${display(row(eq(yj, fn('min', [fn('max', [row(S.hc, mo('−'), zbj), mn('0')], ';'), row(S.zbank, mo('−'), zbj)], ';')), mo(','), space('1.2em'), eq(Bj, row(bj, mo('+'), mn('2'), mj, paren(row(S.zbank, mo('−'), zbj))))), '7.2')}
${display(
  eq(
    fn(S.Aw, [S.hc]),
    sum(
      j,
      null,
      row(
        Lj,
        mo('·'),
        cases([
          [mn('0'), when(S.hc, mo('≤'), zbj)],
          [row(bj, mo('+'), mn('2'), mj, paren(row(S.hc, mo('−'), zbj))), when(zbj, mo('<'), S.hc, mo('<'), S.zbank)],
          [Bj, when(S.hc, mo('≥'), S.zbank)],
        ]),
      ),
    ),
  ),
  '7.3',
)}
${p(`Volume berubah karena hujan langsung di muka saluran, evaporasi air terbuka, rembesan dari kedua sisi blok (${im(row(mn('2'), S.Lb, S.qb))}, bagian 5), aliran parit lapangan dan limpasan dari seluruh sel (bagian 6), dikurangi pembuangan lewat pintu air (bagian 8, ${im(S.Q)} dalam m³/s):`)}
${display(eq(frac(row(mi('d'), S.Vc), row(mi('d'), S.t)), row(S.P, S.Acp, mo('−'), S.Eow, S.Aw, mo('+'), mn('2'), S.Lb, S.qb, mo('+'), sum(mi('i'), null, row(paren(row(S.ri, mo('+'), S.fi)), S.ai)), mo('−'), mn('86 400'), mo('·'), S.Q)), '7.4')}
${p(`Pembuangan ${im(S.Q)} sangat peka terhadap ${im(S.hc)} (pangkat 3/2), sehingga muka air saluran diselesaikan <strong>implisit</strong>: dicari ${im(S.hc)} di akhir sub-langkah sehingga volume baru konsisten dengan debit pada muka air baru itu. Karena ${im(row(mi('V'), paren(mi('h'))))} dan ${im(row(S.Q, paren(mi('h'))))} sama-sama naik terhadap ${im(mi('h'))}, akarnya tunggal dan dicari dengan <em>bisection</em>:`)}
${display(row(eq(fn('F', [mi('h')]), row(fn(mi('V'), [mi('h')]), mo('+'), mn('86 400'), S.dt, fn(S.Q, [mi('h'), S.hr], ';'), mo('−'), Vstar)), mo('='), mn('0')), '7.5')}
${display(row(eq(Vstar, row(S.Vc, mo('+'), S.dt, mo('·'), paren(row(S.P, S.Acp, mo('−'), S.Eow, S.Aw, mo('+'), mn('2'), S.Lb, S.qb, mo('+'), up('Σ'), paren(row(S.ri, mo('+'), S.fi)), S.ai)))), mo(','), space('1em'), sup(S.Vc, mtext('baru')), mo('='), Vstar, mo('−'), mn('86 400'), S.dt, S.Q), '7.6')}
${p(`Bila penarikan dari saluran (evaporasi, rembesan balik ke gambut, parit yang mengisi gambut) dalam satu sub-langkah melebihi air yang tersedia, semuanya diperkecil dengan satu faktor yang sama ${im(mi('φ'))} ≤ 1 agar ${im(row(S.Vc, mo('≥'), mn('0')))}; pembuangan juga dibatasi oleh air yang tersedia. Muka air saluran dilaporkan sebagai <strong>TMAS</strong>, jarak muka air di bawah tanggul:`)}
${display(row(eq(S.TMAS, row(mn('100'), mo('·'), paren(row(S.zbank, mo('−'), S.hc)))), unit('cm'), mo(','), space('1.2em'), mtext('bacaan papan duga'), mo('='), mo('−'), S.TMAS), '7.7')}
<div class="eq-live" data-live="kn-sym"></div>
${calcBox('kn-calc')}
${h3('Suku-suku neraca saluran saat ini')}
<div class="eq-live" data-live="kn-terms"></div>
<div class="eq-plots">
${plot('kn-v', 'Volume saluran V(h) dan keadaan saat ini', { legend: [legendItem('V(h)', '--series-tmas'), legendItem('Saat ini', '--accent', { dot: true })].join('') })}
${plot('kn-aw', 'Luas muka air Aw(h)', { legend: [legendItem('Aw(h)', '--series-rain'), legendItem('Saat ini', '--accent', { dot: true })].join('') })}
</div>`;
}

export function live(c) {
  const cn = c.e.canal;
  const g = c.e.geometry;
  const h = cn.h;
  const A = g.Atot;
  const out = {};
  out['kn-sym'] = symTable([
    { sym: S.hc, arti: 'muka air saluran', unit: 'm', val: fmt(h, 3) },
    { sym: S.zbank, arti: 'elevasi tanggul (datum)', unit: 'm', val: fmt(g.zBank, 2) },
    { sym: S.Vc, arti: 'volume air saluran (keadaan model)', unit: 'm³', val: fmt(cn.V, 1) },
    { sym: S.Aw, arti: 'luas muka air bebas', unit: 'm²', val: fmt(cn.Aw, 0) },
    { sym: S.Acp, arti: 'luas saluran di elevasi tanggul', unit: 'm²', val: fmt(g.Acp, 0) },
    { sym: S.Lb, arti: 'panjang blok sejajar saluran koleksi', unit: 'm', val: fmt(g.Lb, 0) },
    { sym: S.qb, arti: 'rembesan per meter tepi saluran', unit: 'm²/hari', val: fmt(cn.qb, 4) },
    { sym: S.Eow, arti: 'laju evaporasi air terbuka', unit: 'mm/hari', val: fmt(1000 * cn.Eow, 2) },
    { sym: S.Q, arti: 'debit pintu air', unit: 'm³/s', val: fmt(c.e.weir.Q, 4) },
    { sym: S.TMAS, arti: 'tinggi muka air saluran di bawah tanggul', unit: 'cm', val: fmt(c.snap.canal.tmasCm, 1) },
  ]);

  // tabel segmen
  const segRows = g.segments.map((s, k) => {
    const y = Math.min(Math.max(h - s.zb, 0), s.depth);
    return [
      esc(SEG_NAMES[k] ?? `Segmen ${k + 1}`),
      fmt(s.L, 0),
      fmt(s.zb, 2),
      fmt(s.b, 2),
      fmt(s.m, 2),
      fmt(s.B, 2),
      fmt(y, 3),
      fmt(canalVolume(h, [s], g.zBank), 1),
      fmt(canalWetArea(h, [s], g.zBank), 0),
    ];
  });
  const L = [];
  L.push(
    table(['Segmen j', `${im(Lj)} (m)`, `${im(zbj)} (m)`, `${im(bj)} (m)`, im(mj), `${im(Bj)} (m)`, `${im(yj)} (m)`, `${im(sub(mi('V'), j))} (m³)`, `${im(sub(S.Aw, j))} (m²)`], segRows, {
      num: [1, 2, 3, 4, 5, 6, 7, 8],
      cls: 'eq-compact',
      caption: `Penampang di muka air saat ini h = ${fmt(h, 3)} m`,
      label: 'Tabel segmen saluran',
    }),
  );
  const s0 = g.segments[0];
  const y0 = Math.min(Math.max(h - s0.zb, 0), s0.depth);
  L.push(
    line(
      sub(mi('V'), mn('1')),
      row(nm(s0.L, 0), mo('×'), paren(row(nm(s0.b, 1), mo('×'), nm(y0, 3), mo('+'), nm(s0.m, 1), mo('×'), sup(nm(y0, 3), mn('2')), ...(h > g.zBank ? [mo('+'), nm(s0.B, 2), mo('×'), nm(h - g.zBank, 3)] : [])), '[', ']')),
      `${fmt(canalVolume(h, [s0], g.zBank), 1)} m³`,
      { note: 'contoh: saluran koleksi' },
    ),
  );
  L.push(line(fn(mi('V'), [S.hc]), null, `${fmt(canalVolume(h, g.segments, g.zBank), 1)} m³`, { note: `Σ semua segmen; keadaan model V<sub>c</sub> = ${fmt(cn.V, 1)} m³` }));
  L.push(line(S.TMAS, row(mn('100'), mo('×'), paren(row(nm(g.zBank, 0), mo('−'), nmp(h, 3)))), `${fmt(c.snap.canal.tmasCm, 1)} cm`, { note: `papan duga ${fmtSigned(c.snap.canal.gaugeReadingCm, 1)} cm · kelas ${esc(c.snap.canal.tmasCls.label)}` }));
  if (cn.fixed) L.push(textLine('Uji dengan muka air saluran tetap: neraca saluran tidak diintegrasi.'));
  out['kn-calc'] = L.join('');

  const t = cn.terms;
  const tr = (sym, label, v, sign) => {
    const mag = fmt(Math.abs(v), 1);
    return [im(sym), esc(label), mag === fmt(0, 1) ? mag : `${sign}${mag}`, fmtSigned((sign === '−' ? -1 : 1) * Math.abs(m3dToMm(v, A)), 2)];
  };
  const rows = [
    tr(row(S.P, S.Acp), 'hujan langsung ke saluran', t.rain, '+'),
    tr(row(S.Eow, S.Aw), 'evaporasi air terbuka', t.evap, '−'),
    tr(row(mn('2'), S.Lb, S.qb), 'rembesan dari gambut (− = saluran mengisi gambut)', t.seepage, t.seepage < 0 ? '−' : '+'),
    tr(row(up('Σ'), S.fi, S.ai), 'parit lapangan', t.drains, t.drains < 0 ? '−' : '+'),
    tr(row(up('Σ'), S.ri, S.ai), 'limpasan genangan (− = genangan balik)', t.runoff, t.runoff < 0 ? '−' : '+'),
    tr(row(mn('86 400'), S.Q), 'pembuangan pintu air (− = aliran balik masuk)', t.weir, t.weir < 0 ? '+' : '−'),
  ];
  rows.push([im(frac(row(mi('d'), S.Vc), row(mi('d'), S.t))), '<strong>jumlah (perubahan volume)</strong>', `<strong>${fmtSigned(cn.net, 1)}</strong>`, `<strong>${fmtSigned(m3dToMm(cn.net, A), 2)}</strong>`]);
  out['kn-terms'] =
    table(['Suku', 'Arti', 'm³/hari', 'mm/hari atas A<sub>tot</sub>'], rows, { num: [2, 3], cls: 'eq-compact', label: 'Suku neraca saluran' }) +
    `<p class="eq-calc-foot">Laju sesaat dengan forcing jam terakhir (sebelum faktor pembatas φ). Jumlah positif berarti saluran terisi dan TMAS mengecil; negatif berarti saluran surut.</p>`;
  return out;
}

export function plots(c) {
  const cv = c.canal;
  const h = c.e.canal.h;
  return {
    'kn-v': {
      x: { min: cv.zMin, max: cv.top, label: 'h (m)' },
      y: { min: 0, max: Math.max(...cv.V) * 1.05, label: 'V (m³)', fmt: (v) => fmt(v / 1000, 0) + 'k' },
      series: [{ x: cv.h, y: cv.V, color: '--series-tmas', width: 2 }],
      vlines: [{ x: c.e.geometry.zBank, color: '--series-muted', dash: true, label: 'tanggul' }],
      points: [{ x: h, y: c.e.canal.V, color: '--accent', r: 5, ring: true, label: `${fmt(h, 2)} m` }],
    },
    'kn-aw': {
      x: { min: cv.zMin, max: cv.top, label: 'h (m)' },
      y: { min: 0, max: Math.max(...cv.Aw) * 1.08, label: 'Aw (m²)', fmt: (v) => fmt(v / 1000, 1) + 'k' },
      series: [{ x: cv.h, y: cv.Aw, color: '--series-rain', width: 2 }],
      vlines: [{ x: c.e.geometry.zBank, color: '--series-muted', dash: true, label: 'tanggul' }],
      points: [{ x: h, y: c.e.canal.Aw, color: '--accent', r: 5, ring: true }],
    },
  };
}
