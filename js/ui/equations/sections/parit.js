// Bagian 6 — Parit lapangan sebagai sink sub-grid (tipe Hooghoudt).
// Sumber angka: explain().cell (fdActive, fdSpacing, fdBed, fdLevel, fdTm, f) per piezometer, explain().canal.terms.drains.
import { mi, mn, mo, row, sub, sup, eq, paren, frac, mtext, fn, space, cases, when, up } from '../mathml.js';
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
  note,
  table,
  h3,
  p,
  im,
  cellCaption,
  m3dToMm,
} from '../common.js';

export const id = 'parit';

const delta = row(S.zi, mo('−'), S.hfd);

export function render(c) {
  const fd = c.params.fieldDrains;
  return `
${p(`Parit lapangan (saluran tersier) digali setiap ${fmt(fd.spacing, 0)} m di antara baris sawit, tegak lurus saluran koleksi, sedalam ${fmt(fd.depth, 1)} m di bawah permukaan. Parit terlalu rapat untuk digambar sebagai sel tersendiri, sehingga pengaruhnya dihitung sebagai <strong>sink sub-grid</strong> ${im(S.fi)} (m/hari) di setiap sel transek. Bentuknya mengikuti persamaan jarak drainase <strong>Hooghoudt</strong> untuk aliran tunak di antara dua parit sejajar:`)}
${display(eq(S.fi, frac(row(mn('12'), mo('·'), S.Tm, mo('·'), paren(delta)), sup(S.sfd, mn('2')))), '6.1')}
${display(row(eq(S.hfd, fn('max', [S.hc, S.zfdi], ';')), mo(','), space('1.2em'), eq(S.zfdi, row(S.zsi, mo('−'), S.dfd))), '6.2')}
${display(eq(S.Tm, row(mn('½'), paren(row(fn(S.T, [S.zetai]), mo('+'), fn(S.T, [row(S.zsi, mo('−'), S.hfd)]))))), '6.3')}
${display(
  eq(
    S.fi,
    cases([
      [mtext('rumus (6.1), menguras'), when(S.zi, mo('>'), S.hfd)],
      [mtext('rumus (6.1), mengisi dari saluran'), when(S.zi, mo('<'), S.hfd, space('0.4em'), mtext('dan'), space('0.4em'), S.hc, mo('>'), S.zfdi)],
      [mn('0'), mtext('lainnya, atau parit dimatikan')],
    ]),
  ),
  '6.4',
)}
${p(`Faktor 12 berasal dari Hooghoudt ${im(row(mi('q'), mo('='), mn('8'), mi('T'), mi('h'), mo('/'), sup(S.sfd, mn('2'))))} dengan ${im(mi('h'))} tinggi muka air di tengah antara dua parit; untuk muka air berbentuk parabola, tinggi rata-ratanya ⅔ ${im(mi('h'))}, sehingga dalam tinggi rata-rata ${im(delta)} faktornya 8 × 3/2 = 12. Muka air di parit ${im(S.hfd)} sama dengan muka air saluran bila saluran lebih tinggi daripada dasar parit; jika tidak, parit kering dan berfungsi sebagai bidang rembesan di dasarnya. Saat saluran tinggi (stoplog banyak), parit justru dapat <em>mengisi</em> gambut (${im(row(S.fi, mo('<'), mn('0')))}).`)}
<div class="eq-live" data-live="pr-off"></div>
<div class="eq-live" data-live="pr-sym"></div>
${calcBox('pr-calc')}
<div class="eq-plots eq-plots-1">
${plot('pr-f', 'Aliran ke parit lapangan f (mm/hari) sepanjang transek; + = menguras gambut', {
  legend: [legendItem('f(x)', '--series-q'), legendItem('Sel pilihan', '--accent', { dot: true })].join(''),
})}
</div>
${h3('Parit lapangan di tiap piezometer')}
<div class="eq-live" data-live="pr-table"></div>`;
}

function status(q) {
  if (!q.fdActive || q.f === 0) return '<span class="eq-muted">tidak aktif</span>';
  if (q.f > 0) return 'menguras';
  return '<strong>mengisi dari saluran</strong>';
}

/** Alasan parit tidak mengalirkan air (syarat 6.4). */
function inactiveReason(k, hc) {
  if (k.z <= k.fdLevel && hc <= k.fdBed) return 'muka air tanah di bawah dasar parit dan parit kering: tidak ada aliran (6.4)';
  return 'muka air tanah sama dengan muka air parit: tidak ada aliran (6.4)';
}

export function live(c) {
  const k = c.e.cell;
  const fd = c.params.fieldDrains;
  const cn = c.e.canal;
  const A = c.e.geometry.Atot;
  const mmd = (v) => 1000 * v;
  const out = {};
  out['pr-off'] = fd.enabled ? '' : note('Parit lapangan sedang <strong>dimatikan</strong> (Kontrol → Lahan). Semua f<sub>i</sub> = 0: blok hanya terdrainase lewat rembesan ke saluran koleksi, sehingga tengah blok jauh lebih basah.', 'warn');
  out['pr-sym'] = symTable([
    { sym: S.sfd, arti: 'jarak antar-parit lapangan', unit: 'm', val: fmt(k.fdSpacing, 0) },
    { sym: S.dfd, arti: 'kedalaman dasar parit dari permukaan', unit: 'm', val: fmt(fd.depth, 2) },
    { sym: S.zfdi, arti: 'elevasi dasar parit di sel', unit: 'm', val: fmt(k.fdBed, 3) },
    { sym: S.hc, arti: 'muka air saluran', unit: 'm', val: fmt(cn.h, 3) },
    { sym: S.hfd, arti: 'muka air efektif di parit', unit: 'm', val: fmt(k.fdLevel, 3) },
    { sym: S.zi, arti: 'muka air tanah sel', unit: 'm', val: fmt(k.z, 3) },
    { sym: S.Tm, arti: 'transmisivitas rata-rata', unit: 'm²/hari', val: k.fdActive ? fmt(k.fdTm, 2) : '–' },
    { sym: S.fi, arti: 'aliran ke parit (+ menguras)', unit: 'mm/hari', val: fmt(mmd(k.f), 2) },
  ]);

  const L = [textLine(cellCaption(c))];
  L.push(line(S.zfdi, row(nm(k.zs, 3), mo('−'), nm(fd.depth, 1)), `${fmt(k.fdBed, 3)} m`));
  L.push(line(S.hfd, fn('max', [nm(cn.h, 3), nm(k.fdBed, 3)], ';'), `${fmt(k.fdLevel, 3)} m`, { note: cn.h > k.fdBed ? 'muka air saluran di atas dasar parit' : 'parit kering: dasar parit sebagai bidang rembesan' }));
  L.push(line(delta, row(nm(k.z, 3), mo('−'), nmp(k.fdLevel, 3)), `${fmtSigned(100 * (k.z - k.fdLevel), 1)} cm`));
  if (!fd.enabled) {
    L.push(line(S.fi, null, '0 mm/hari', { note: 'parit dimatikan' }));
  } else if (!k.fdActive) {
    L.push(line(S.fi, null, '0 mm/hari', { note: inactiveReason(k, cn.h) }));
  } else {
    L.push(line(S.Tm, null, `${fmt(k.fdTm, 2)} m²/hari`, { note: `rata-rata T di muka air tanah (${fmt(k.T, 2)}) dan di muka air parit` }));
    L.push(
      line(S.fi, frac(row(mn('12'), mo('×'), nm(k.fdTm, 2), mo('×'), paren(row(nm(k.z, 3), mo('−'), nmp(k.fdLevel, 3)))), sup(nm(k.fdSpacing, 0), mn('2'))), `${fmt(mmd(k.f), 2)} mm/hari`, {
        note: `= ${fmt(k.f, 5)} m/hari`,
      }),
    );
  }
  L.push(
    line(row(up('Σ'), S.fi, S.ai), null, `${fmt(cn.terms.drains, 0)} m³/hari`, {
      note: `seluruh blok ke saluran = ${fmt(m3dToMm(cn.terms.drains, A), 2)} mm/hari atas A<sub>tot</sub>`,
    }),
  );
  out['pr-calc'] = L.join('');

  const rows = c.ids.map((pid) => {
    const q = c.ex[pid].cell;
    return [
      `${esc(pid)}${pid === c.snap.ind.tpId ? ' <span class="eq-tag">TP</span>' : ''}`,
      String(q.i),
      fmt(q.fdBed, 3),
      fmt(q.fdLevel, 3),
      fmtSigned(100 * (q.z - q.fdLevel), 1),
      q.fdActive ? fmt(q.fdTm, 2) : '–',
      fmt(mmd(q.f), 2),
      status(q),
    ];
  });
  out['pr-table'] = table(['Piezometer', 'Sel i', 'z<sub>fd</sub> (m)', 'h<sub>fd</sub> (m)', 'z − h<sub>fd</sub> (cm)', 'T̄<sub>m</sub> (m²/hari)', 'f (mm/hari)', 'Keadaan'], rows, {
    num: [1, 2, 3, 4, 5, 6],
    cls: 'eq-compact',
    rowAttrs: (j) => (c.ids[j] === c.pz ? ' class="eq-row-current"' : ''),
    label: 'Parit lapangan per piezometer',
  });
  return out;
}

export function plots(c) {
  const x = Array.from(c.e.cells.x);
  const f = Array.from(c.e.cells.f, (v) => 1000 * v);
  const lo = Math.min(0, ...f);
  const hi = Math.max(1, ...f);
  const pad = (hi - lo) * 0.12;
  const k = c.e.cell;
  return {
    'pr-f': {
      x: { min: 0, max: c.e.geometry.Lh, label: 'x (m) dari tanggul' },
      y: { min: lo - (lo < 0 ? pad : 0), max: hi + pad, label: 'f (mm/hari)' },
      series: [{ x, y: f, color: '--series-q', width: 2, fill: 0, fillAlpha: 0.12 }],
      hlines: lo < 0 ? [{ y: 0, color: '--series-muted' }] : [],
      points: [{ x: k.x, y: 1000 * k.f, color: '--accent', r: 5, ring: true, label: c.pz }],
    },
  };
}
