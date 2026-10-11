// Bagian 5 — Aliran air tanah Dupuit–Boussinesq 1D, bentuk volume hingga.
// Sumber angka: explain().cell/cells/canal per piezometer.
import { mi, mn, mo, row, sub, eq, paren, frac, mtext, fn, space, partial } from '../mathml.js';
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
  ns,
  nsp,
  fmtSig,
  plot,
  legendItem,
  table,
  h3,
  p,
  im,
  cellCaption,
  unit,
} from '../common.js';

export const id = 'airtanah';

const dd = (a, b) => frac(row(partial(), a), row(partial(), b));
const half = (sign) => row(mi('i'), mo(sign), mn('½'));

export function render(c) {
  const g = c.e.geometry;
  const zbed = g.segments[0].zb;
  return `
${p(`Air tanah di gambut mengalir hampir horizontal dari tengah blok (tinggi) ke saluran (rendah). Asumsi <strong>Dupuit</strong> (gradien hidrolik = kemiringan muka air) mengubah aliran 3D menjadi persamaan <strong>Boussinesq</strong> satu dimensi di sepanjang transek tanggul → tengah blok:`)}
${display(eq(row(S.Sy, dd(S.z, S.t)), row(frac(partial(), row(partial(), S.x)), paren(row(S.T, dd(S.z, S.x))), mo('+'), S.P, mo('−'), S.ET, mo('−'), S.f, mo('−'), S.r)), '5.1')}
${p(`${im(S.f)} adalah aliran ke parit lapangan (bagian 6) dan ${im(S.r)} limpasan genangan ke saluran (atau, bila saluran meluap, genangan balik dengan ${im(S.r)} negatif). Model tidak menyelesaikan (5.1) dalam ${im(S.z)}, tetapi dalam simpanan ${im(S.W)} per sel (volume hingga), sehingga air kekal persis meskipun ${im(S.Sy)} berubah tajam:`)}
${display(eq(frac(row(mi('d'), S.Wi), row(mi('d'), S.t)), row(S.P, mo('−'), S.ETi, mo('−'), S.ri, mo('−'), S.fi, mo('+'), frac(row(S.qR, mo('−'), S.qL), S.dx))), '5.2')}
${display(row(eq(S.qL, row(S.TbarL, frac(row(S.zi, mo('−'), S.zim1), S.dx))), mo(','), space('1.2em'), eq(S.TbarL, row(mn('½'), paren(row(S.Ti, mo('+'), S.Tim1))))), '5.3')}
${p(`Fluks muka sel ${im(mi('q'))} (m²/hari per meter panjang saluran) bertanda <strong>positif ke arah saluran</strong>. Transmisivitas di muka sel adalah rata-rata aritmetika dua sel tetangga. Di muka pertama (tanggul) jaraknya hanya setengah sel, dan muka air saluran ${im(S.hcs)} dibatasi bawah oleh dasar saluran koleksi ${im(S.zbed)} = ${fmt(zbed, 1)} m:`)}
${display(eq(S.qb, row(S.Tb, frac(row(sub(S.z, mn('0')), mo('−'), S.hcs), row(S.dx, mo('/'), mn('2'))))), '5.4')}
${display(row(eq(S.Tb, row(mn('½'), paren(row(sub(S.T, mn('0')), mo('+'), S.Tc)))), mo(','), space('1em'), eq(S.Tc, fn(S.T, [row(S.zbank, mo('−'), fn('min', [S.hcs, S.zbank], ';')), sub(S.D, mtext('tanggul'))], ';')), mo(','), space('1em'), eq(S.hcs, fn('max', [S.hc, S.zbed], ';'))), '5.5')}
${p(`Bila saluran koleksi kering (${im(row(S.hc, mo('≤'), S.zbed))}) dasarnya hanya menjadi bidang rembesan: ${im(S.qb)} tidak boleh negatif. Di tengah blok berlaku pemisah aliran (simetri), dan laju perubahan muka air mengikuti ${im(row(mi('d'), S.W, mo('='), S.Sy, mi('d'), S.z))}:`)}
${display(row(eq(S.qN, mn('0')), mo(','), space('1.5em'), eq(frac(row(mi('d'), S.zi), row(mi('d'), S.t)), frac(row(mi('d'), S.Wi, mo('/'), mi('d'), S.t), S.Syi))), '5.6')}
<div class="eq-live" data-live="at-sym"></div>
${calcBox('at-calc')}
<div class="eq-plots eq-plots-1">
${plot('at-q', 'Fluks muka sel q (m²/hari) sepanjang transek; + = menuju saluran', {
  legend: [legendItem('q di muka sel', '--series-q'), legendItem('Muka sel pilihan', '--accent', { dot: true })].join(''),
})}
</div>
${h3('Neraca sel di tiap piezometer')}
<div class="eq-live" data-live="at-table"></div>`;
}

export function live(c) {
  const k = c.e.cell;
  const cells = c.e.cells;
  const cn = c.e.canal;
  const g = c.e.geometry;
  const N = g.N;
  const i = k.i;
  const zbed = g.segments[0].zb;
  const out = {};
  const mmd = (v) => 1000 * v;
  out['at-sym'] = symTable([
    { sym: S.dx, arti: 'lebar sel', unit: 'm', val: fmt(g.dx, 1) },
    { sym: S.Ti, arti: 'transmisivitas sel pilihan', unit: 'm²/hari', val: fmt(k.T, 2) },
    { sym: i === 0 ? S.Tb : S.TbarL, arti: i === 0 ? 'transmisivitas muka tanggul' : 'transmisivitas muka kiri', unit: 'm²/hari', val: fmt(k.Tleft, 2) },
    { sym: S.TbarR, arti: i === N - 1 ? 'transmisivitas muka kanan (tidak ada: pemisah aliran)' : 'transmisivitas muka kanan', unit: 'm²/hari', val: i === N - 1 ? '–' : fmt(k.Tright, 2) },
    { sym: S.zi, arti: 'muka air tanah sel', unit: 'm', val: fmt(k.z, 4) },
    { sym: S.hcs, arti: 'muka air saluran efektif', unit: 'm', val: fmt(cn.hcs, 3) },
    { sym: i === 0 ? S.qb : S.qL, arti: 'fluks muka kiri (ke saluran)', unit: 'm²/hari', val: fmtSig(k.qLeft, 3) },
    { sym: S.qR, arti: 'fluks muka kanan (masuk dari arah tengah)', unit: 'm²/hari', val: fmtSig(k.qRight, 3) },
    { sym: S.P, arti: 'laju hujan', unit: 'mm/hari', val: fmt(mmd(k.P), 2) },
    { sym: S.ETi, arti: 'ET aktual', unit: 'mm/hari', val: fmt(mmd(k.ET), 2) },
    { sym: S.fi, arti: 'aliran ke parit lapangan', unit: 'mm/hari', val: fmt(mmd(k.f), 2) },
    { sym: S.ri, arti: 'limpasan genangan', unit: 'mm/hari', val: fmt(mmd(k.r), 2) },
    { sym: S.Syi, arti: 'specific yield sel', unit: '–', val: fmt(k.Sy, 4) },
  ]);

  const L = [textLine(cellCaption(c))];
  // muka kiri
  if (i === 0) {
    L.push(line(S.Tb, row(mn('½'), paren(row(nm(k.T, 2), mo('+'), nm(cn.Tc, 2)))), `${fmt(k.Tleft, 2)} m²/hari`));
    L.push(line(S.hcs, fn('max', [nm(cn.h, 3), nm(zbed, 2)], ';'), `${fmt(cn.hcs, 3)} m`));
    const clamped = cn.h <= zbed && k.z < cn.hcs;
    L.push(
      line(S.qb, row(nm(k.Tleft, 2), mo('×'), frac(row(nm(k.z, 4), mo('−'), nmp(cn.hcs, 3)), row(nm(g.dx, 1), mo('/'), mn('2')))), `${fmtSig(k.qLeft, 3)} m²/hari`, {
        note: clamped ? 'saluran kering: q<sub>b</sub> dibatasi ≥ 0' : '',
      }),
    );
  } else {
    L.push(line(S.TbarL, row(mn('½'), paren(row(nm(k.T, 2), mo('+'), nm(cells.T[i - 1], 2)))), `${fmt(k.Tleft, 2)} m²/hari`));
    L.push(line(S.qL, row(nm(k.Tleft, 2), mo('×'), frac(row(nm(k.z, 4), mo('−'), nmp(k.zLeft, 4)), nm(g.dx, 1))), `${fmtSig(k.qLeft, 3)} m²/hari`));
  }
  // muka kanan
  if (i === N - 1) {
    L.push(line(S.qR, null, '0 m²/hari', { note: 'pemisah aliran di tengah blok (5.6)' }));
  } else {
    L.push(line(S.TbarR, row(mn('½'), paren(row(nm(k.T, 2), mo('+'), nm(cells.T[i + 1], 2)))), `${fmt(k.Tright, 2)} m²/hari`));
    L.push(line(S.qR, row(nm(k.Tright, 2), mo('×'), frac(row(nm(k.zRight, 4), mo('−'), nmp(k.z, 4)), nm(g.dx, 1))), `${fmtSig(k.qRight, 3)} m²/hari`));
  }
  L.push(line(frac(row(S.qR, mo('−'), S.qL), S.dx), row(paren(row(ns(k.qRight, 3), mo('−'), nsp(k.qLeft, 3))), mo('/'), nm(g.dx, 1)), `${fmt(mmd(k.lateral), 2)} mm/hari`, { note: k.lateral < 0 ? 'sel kehilangan air ke arah saluran' : 'sel menerima air bersih dari tetangga' }));
  L.push(
    line(
      frac(row(mi('d'), S.Wi), row(mi('d'), S.t)),
      row(nm(mmd(k.P), 2), mo('−'), nm(mmd(k.ET), 2), mo('−'), nmp(mmd(k.r), 2), mo('−'), nmp(mmd(k.f), 2), mo('+'), nmp(mmd(k.lateral), 2)),
      `${fmt(mmd(k.net), 2)} mm/hari`,
    ),
  );
  L.push(line(frac(row(mi('d'), S.zi), row(mi('d'), S.t)), frac(row(nm(mmd(k.net), 2), unit('mm/hari')), nm(k.Sy, 4)), `${fmtSigned(100 * k.dzdt, 2)} cm/hari`, { note: k.dzdt > 0 ? 'muka air naik' : k.dzdt < 0 ? 'muka air turun' : 'tetap' }));
  out['at-calc'] = L.join('');

  const rows = c.ids.map((pid) => {
    const q = c.ex[pid].cell;
    return [
      `${esc(pid)}${pid === c.snap.ind.tpId ? ' <span class="eq-tag">TP</span>' : ''}`,
      String(q.i),
      fmt(q.z, 3),
      fmt(q.T, 1),
      fmtSig(q.qLeft, 3),
      fmtSig(q.qRight, 3),
      fmt(mmd(q.lateral), 2),
      fmt(mmd(q.ET), 2),
      fmt(mmd(q.f), 2),
      fmt(mmd(q.r), 2),
      fmt(mmd(q.net), 2),
      fmtSigned(100 * q.dzdt, 2),
    ];
  });
  out['at-table'] = table(
    ['Piezometer', 'Sel i', 'z (m)', 'T (m²/hari)', 'q kiri (m²/hari)', 'q kanan (m²/hari)', 'Lateral (mm/hari)', 'ET (mm/hari)', 'f (mm/hari)', 'r (mm/hari)', 'dW/dt (mm/hari)', 'dz/dt (cm/hari)'],
    rows,
    { num: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], cls: 'eq-compact', rowAttrs: (j) => (c.ids[j] === c.pz ? ' class="eq-row-current"' : ''), label: 'Neraca sel per piezometer' },
  );
  return out;
}

export function plots(c) {
  const g = c.e.geometry;
  const qf = Array.from(c.e.cells.qf);
  const xf = qf.map((_, j) => j * g.dx);
  const i = c.e.cell.i;
  const lo = Math.min(0, ...qf);
  const hi = Math.max(0.001, ...qf);
  const pad = (hi - lo) * 0.12;
  return {
    'at-q': {
      x: { min: 0, max: g.Lh, label: 'x (m) dari tanggul' },
      y: { min: lo - (lo < 0 ? pad : 0), max: hi + pad, label: 'q (m²/hari)', fmt: (v) => fmtSig(v, 2) },
      series: [{ x: xf, y: qf, color: '--series-q', width: 2, fill: 0, fillAlpha: 0.12 }],
      hlines: lo < 0 ? [{ y: 0, color: '--series-muted' }] : [],
      points: [
        { x: xf[i], y: qf[i], color: '--accent', r: 4.5, ring: true },
        { x: xf[i + 1], y: qf[i + 1], color: '--accent', r: 4.5, ring: true, label: `sel ${i}` },
      ],
    },
  };
}
