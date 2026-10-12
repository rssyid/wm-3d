// Bagian 3 — Sifat hidrolik gambut: Sy(ζ), K(ζ), T(ζ), W(ζ).
// Sumber angka: explain().cell per piezometer, peatCurves(), parameter gambut.
import { classifyTmat } from '../../../model/index.js';
import { mi, mn, mo, row, sub, sup, eq, paren, frac, mtext, fn, cases, when, space, up, el } from '../mathml.js';
import {
  SYM as S,
  esc,
  fmt,
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
  ex,
  cellCaption,
  fmtSigned,
} from '../common.js';

export const id = 'gambut';

const neg = (a, b) => row(mo('−'), a, mo('/'), b);
const integral = (lo, hi, body) => row(el('msubsup', mo('∫') + lo + hi), body);

export function render(c) {
  const pt = c.params.peat;
  return `
${p(`Gambut tropis sangat berpori di bagian atas (akar, serat kasar) dan makin padat ke bawah. Karena itu dua sifat utama berubah eksponensial dengan kedalaman muka air tanah ${im(S.zeta)} (m, positif ke bawah): <strong>specific yield</strong> ${im(S.Sy)} (tinggi air yang dilepas per satuan luas bila muka air turun 1 m; ${im(row(S.Sy, mo('='), mn('0,1')))} berarti 100 mm air per 1 m penurunan) dan <strong>konduktivitas hidrolik</strong> ${im(S.K)}.`)}
${display(
  eq(
    fn(S.Sy, [S.zeta]),
    cases([
      [row(S.SyD, mo('+'), paren(row(S.SyS, mo('−'), S.SyD)), ex(neg(S.zeta, S.lamS))), when(S.zeta, mo('≥'), mn('0'))],
      [mn('1'), when(S.zeta, mo('<'), mn('0'), space('0.5em'), mtext('(tergenang)'))],
    ]),
  ),
  '3.1',
)}
${display(eq(fn(S.K, [S.zeta]), row(S.Kd, mo('+'), paren(row(S.Ks, mo('−'), S.Kd)), ex(neg(fn('max', [S.zeta, mn('0')], ';'), S.lamK)))), '3.2')}
${p(`<strong>Transmisivitas</strong> ${im(S.T)} adalah kemampuan seluruh kolom jenuh air mengalirkan air secara horizontal: integral ${im(S.K)} dari dasar gambut sampai muka air tanah. Karena ${im(S.K)} berbentuk eksponensial, integralnya punya bentuk tertutup (3.3). Di sini ${im(S.D)} adalah tebal gambut lokal (bagian 4).`)}
${display(
  eq(
    fn(S.T, [S.zeta]),
    integral(S.zbase, S.z, row(S.K, mi('d'), mi('z'))),
    row(S.Kd, paren(row(S.D, mo('−'), S.zeta)), mo('+'), paren(row(S.Ks, mo('−'), S.Kd)), S.lamK, paren(row(ex(neg(S.zeta, S.lamK)), mo('−'), ex(neg(S.D, S.lamK))))),
  ),
  '3.3',
)}
${p(`Berlaku untuk 0 ≤ ${im(S.zeta)} &lt; ${im(S.D)}; saat tergenang (${im(row(S.zeta, mo('<'), mn('0')))}) dipakai ${im(row(fn(S.T, [mn('0')])))}, dan ${im(row(S.T, mo('='), mn('0')))} bila muka air mencapai dasar gambut. Simpanan air ${im(S.W)} (m, relatif terhadap "muka air tepat di permukaan") adalah integral ${im(S.Sy)}:`)}
${display(
  eq(
    fn(S.W, [S.zeta]),
    cases([
      [row(mo('−'), S.zeta), when(S.zeta, mo('≤'), mn('0'), space('0.5em'), mtext('(tinggi genangan)'))],
      [row(mo('−'), paren(row(S.SyD, S.zeta, mo('+'), paren(row(S.SyS, mo('−'), S.SyD)), S.lamS, paren(row(mn('1'), mo('−'), ex(neg(S.zeta, S.lamS))))), '[', ']')), when(S.zeta, mo('>'), mn('0'))],
    ]),
  ),
  '3.4',
)}
${display(row(eq(frac(row(mi('d'), S.W), row(mi('d'), S.z)), S.Sy), mo(','), space('1.2em'), eq(S.zeta, row(sup(S.W, mn('−1')), paren(S.W)))), '3.5')}
${p(`Model menyimpan ${im(S.W)} per sel sebagai variabel keadaan (sehingga massa air kekal persis) dan menghitung ${im(S.zeta)} kembali dengan iterasi Newton (konvergen monoton, cadangan bisection). Nilai parameter: ${im(S.SyS)} = ${fmt(pt.SyS, 2)}, ${im(S.SyD)} = ${fmt(pt.SyD, 2)}, ${im(S.lamS)} = ${fmt(pt.lamS, 2)} m, ${im(S.Ks)} = ${fmt(pt.Ks, 0)} m/hari, ${im(S.Kd)} = ${fmt(pt.Kd, 1)} m/hari, ${im(S.lamK)} = ${fmt(pt.lamK, 2)} m.`)}
<div class="eq-live" data-live="gb-sym"></div>
${calcBox('gb-calc')}
<div class="eq-plots">
${plot('gb-sy', 'Specific yield Sy(ζ)', { tall: true })}
${plot('gb-k', 'Konduktivitas K(ζ), skala log', { tall: true })}
${plot('gb-t', 'Transmisivitas T(ζ), skala log', { tall: true })}
</div>
<p class="eq-calc-foot">Kurva untuk tebal gambut di tepi saluran (D = ${fmt(c.curves.D, 1)} m). Titik = sel hitung tiap piezometer (warna kategori TMAT perusahaan, cincin = pilihan); titik T memakai D lokal sehingga bisa sedikit di luar kurva. ${legendItem('kurva', '--series-tmat')}</p>
${h3('Sifat gambut di tiap piezometer')}
<div class="eq-live" data-live="gb-table"></div>`;
}

export function live(c) {
  const k = c.e.cell;
  const pt = c.params.peat;
  const out = {};
  out['gb-sym'] = symTable([
    { sym: S.zeta, arti: 'kedalaman muka air tanah lokal', unit: 'm', val: fmt(k.zeta, 3) },
    { sym: S.D, arti: 'tebal gambut lokal', unit: 'm', val: fmt(k.D, 3) },
    { sym: S.SyS, arti: 'specific yield di permukaan', unit: '–', val: fmt(pt.SyS, 2) },
    { sym: S.SyD, arti: 'specific yield di kedalaman', unit: '–', val: fmt(pt.SyD, 2) },
    { sym: S.lamS, arti: 'skala peluruhan Sy', unit: 'm', val: fmt(pt.lamS, 2) },
    { sym: S.Ks, arti: 'K di permukaan (bisa diubah di Kontrol)', unit: 'm/hari', val: fmt(pt.Ks, 0) },
    { sym: S.Kd, arti: 'K di kedalaman', unit: 'm/hari', val: fmt(pt.Kd, 1) },
    { sym: S.lamK, arti: 'skala peluruhan K', unit: 'm', val: fmt(pt.lamK, 2) },
    { sym: S.Sy, arti: 'specific yield saat ini', unit: '–', val: fmt(k.Sy, 4) },
    { sym: S.K, arti: 'konduktivitas di muka air', unit: 'm/hari', val: fmt(k.K, 2) },
    { sym: S.T, arti: 'transmisivitas kolom jenuh', unit: 'm²/hari', val: fmt(k.T, 2) },
    { sym: S.W, arti: 'simpanan relatif permukaan', unit: 'mm', val: fmtSigned(1000 * k.W, 1) },
  ]);

  const L = [textLine(cellCaption(c))];
  const z = k.zeta;
  if (z < 0) {
    L.push(textLine(`Sel tergenang (ζ = ${fmt(z, 3)} m &lt; 0): Sy = 1, K = K<sub>s</sub>, T = T(0), W = tinggi genangan.`));
    L.push(line(S.Sy, null, fmt(k.Sy, 3)));
    L.push(line(S.K, null, `${fmt(k.K, 2)} m/hari`));
    L.push(line(S.T, null, `${fmt(k.T, 2)} m²/hari`));
    L.push(line(S.W, row(mo('−'), paren(nm(z, 3))), `${fmt(1000 * k.W, 1)} mm`));
  } else {
    L.push(line(S.Sy, row(nm(pt.SyD, 2), mo('+'), paren(row(nm(pt.SyS, 2), mo('−'), nm(pt.SyD, 2))), ex(row(mo('−'), nm(z, 3), mo('/'), nm(pt.lamS, 2)))), fmt(k.Sy, 4)));
    L.push(line(S.K, row(nm(pt.Kd, 1), mo('+'), paren(row(nm(pt.Ks, 0), mo('−'), nm(pt.Kd, 1))), ex(row(mo('−'), nm(z, 3), mo('/'), nm(pt.lamK, 2)))), `${fmt(k.K, 2)} m/hari`));
    L.push(
      line(
        S.T,
        row(
          nm(pt.Kd, 1),
          mo('×'),
          paren(row(nm(k.D, 3), mo('−'), nm(z, 3))),
          mo('+'),
          paren(row(nm(pt.Ks, 0), mo('−'), nm(pt.Kd, 1))),
          mo('×'),
          nm(pt.lamK, 2),
          mo('×'),
          paren(row(ex(row(mo('−'), nm(z, 3), mo('/'), nm(pt.lamK, 2))), mo('−'), ex(row(mo('−'), nm(k.D, 3), mo('/'), nm(pt.lamK, 2))))),
        ),
        `${fmt(k.T, 2)} m²/hari`,
      ),
    );
    L.push(
      line(
        S.W,
        row(mo('−'), paren(row(nm(pt.SyD, 2), mo('×'), nm(z, 3), mo('+'), paren(row(nm(pt.SyS, 2), mo('−'), nm(pt.SyD, 2))), mo('×'), nm(pt.lamS, 2), mo('×'), paren(row(mn('1'), mo('−'), ex(row(mo('−'), nm(z, 3), mo('/'), nm(pt.lamS, 2)))))), '[', ']')),
        `${fmtSigned(1000 * k.W, 1)} mm`,
        { note: `air yang sudah dilepas gambut sejak muka air berada di permukaan sampai turun ${fmt(100 * z, 1)} cm` },
      ),
    );
  }
  out['gb-calc'] = L.join('');

  const pzById = Object.fromEntries(c.snap.piezometers.map((q) => [q.id, q]));
  const rows = c.ids.map((pid) => {
    const q = c.ex[pid].cell;
    // kategori dari kedalaman di posisi piezometer (interpolasi; sama dengan KPI & badge)
    const cls = pzById[pid]?.cls ?? classifyTmat(q.piezometerDepthCm ?? 100 * q.zeta);
    return [
      `${esc(pid)}${pid === c.snap.ind.tpId ? ' <span class="eq-tag">TP</span>' : ''}`,
      `${q.i} (${fmt(q.x, 1)})`,
      fmt(100 * q.zeta, 1),
      `<span class="st st-${esc(cls.id)}"><span aria-hidden="true">${esc(cls.icon)}</span> ${esc(cls.label)}</span>`,
      fmt(q.Sy, 3),
      fmt(q.K, 1),
      fmt(q.T, 2),
      fmtSigned(1000 * q.W, 0),
    ];
  });
  out['gb-table'] = table(['Piezometer', 'Sel i (x, m)', 'ζ sel (cm)', 'Kategori (KPI)', 'Sy', 'K (m/hari)', 'T (m²/hari)', 'W (mm)'], rows, {
    num: [1, 2, 4, 5, 6, 7],
    cls: 'eq-compact',
    rowAttrs: (i) => (c.ids[i] === c.pz ? ' class="eq-row-current"' : ''),
    label: 'Sifat gambut per piezometer',
  });
  return out;
}

export function plots(c) {
  const cv = c.curves;
  const yAxis = { min: 0, max: cv.depth.at(-1), invert: true, label: 'ζ (m)' };
  const pzById = Object.fromEntries(c.snap.piezometers.map((q) => [q.id, q]));
  const pts = (key) =>
    c.ids.map((pid) => {
      const q = c.ex[pid].cell;
      const cls = pzById[pid]?.cls ?? classifyTmat(100 * q.zeta);
      return { x: q[key], y: Math.max(q.zeta, 0), color: cls.color, r: pid === c.pz ? 6 : 4.5, ring: pid === c.pz, label: pid };
    });
  const pt = c.params.peat;
  const kMin = Math.min(pt.Kd, ...cv.K) * 0.8;
  const kMax = Math.max(pt.Ks, ...cv.K) * 1.25;
  const tPos = cv.T.filter((v) => v > 0);
  return {
    'gb-sy': {
      x: { min: 0, max: Math.max(pt.SyS, 0.3) * 1.1, label: 'Sy (–)' },
      y: yAxis,
      series: [{ x: cv.Sy, y: cv.depth, color: '--series-tmat', width: 2 }],
      points: pts('Sy'),
    },
    'gb-k': {
      x: { min: kMin, max: kMax, log: true, label: 'K (m/hari)' },
      y: yAxis,
      series: [{ x: cv.K, y: cv.depth, color: '--series-tmat', width: 2 }],
      points: pts('K'),
    },
    'gb-t': {
      x: { min: Math.min(...tPos) * 0.8, max: Math.max(...tPos, ...c.ids.map((pid) => c.ex[pid].cell.T)) * 1.25, log: true, label: 'T (m²/hari)' },
      y: yAxis,
      series: [{ x: cv.T, y: cv.depth, color: '--series-tmat', width: 2 }],
      points: pts('T'),
    },
  };
}
