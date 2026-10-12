// Bagian 1 — Ringkasan & neraca air blok + saluran.
// Sumber angka: explain().balance (= waterBalance), snapshot.today, dailySeries, geometri explain().
import { classifyTmat } from '../../../model/index.js';
import { mi, mn, mo, row, sub, sup, eq, paren, frac, mtext, sum, space, up } from '../mathml.js';
import {
  SYM as S,
  esc,
  fmt,
  fmtSigned,
  fmtSci,
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
  m3dToMm,
  ppBadge,
} from '../common.js';

export const id = 'neraca';

const V = (name) => sub(mi('V'), mtext(name));
const dS = row(up('Δ'), mi('S'));
const abs = (x) => row(mo('|', { lspace: '0', rspace: '0' }), x, mo('|', { lspace: '0', rspace: '0' }));

export function render(c) {
  const g = c.e.geometry;
  return `
${p(`Simulasi ini mengikuti satu rantai sebab-akibat: <strong>curah hujan</strong> masuk ke gambut dan menaikkan <strong>muka air tanah (TMAT)</strong>; air tanah merembes ke saluran dan parit lapangan sehingga <strong>muka air saluran (TMAS)</strong> naik; bila TMAS melampaui mercu stoplog, air <strong>dibuang</strong> lewat pintu air ke sungai. Evapotranspirasi (ET) mengambil air di sepanjang jalan.`)}
<ol class="eq-list">
  <li>Hujan &amp; ET → <a href="#persamaan.hujan-et">bagian 2</a></li>
  <li>Simpanan &amp; aliran air tanah (gambut, kubah, Dupuit–Boussinesq) → <a href="#persamaan.gambut">bagian 3</a>, <a href="#persamaan.kubah">4</a>, <a href="#persamaan.airtanah">5</a></li>
  <li>Parit lapangan → <a href="#persamaan.parit">bagian 6</a>; saluran &amp; TMAS → <a href="#persamaan.kanal">bagian 7</a></li>
  <li>Pintu air &amp; sungai → <a href="#persamaan.pintu-air">bagian 8</a>; cara menghitung langkah waktu → <a href="#persamaan.numerik">bagian 9</a></li>
  <li>Kategori TMAT perusahaan dan kewajiban PP 57/2016 → <a href="#persamaan.klasifikasi">bagian 10</a>; parameter &amp; referensi → <a href="#persamaan.parameter">bagian 11</a></li>
</ol>
${p(`Neraca ditutup untuk seluruh sistem: blok gambut (${fmt(g.Ablock / 10000, 1)} ha) ditambah muka saluran (${fmt(g.Acp, 0)} m²). Semua volume dapat dinyatakan sebagai tinggi air (mm) atas luas total ${im(S.Atot)} = ${fmt(g.Atot, 0)} m², sehingga 1 mm setara ${fmt(g.Atot / 1000, 1)} m³.`)}
${display(eq(dS, row(S.P, mo('−'), S.ET, mo('−'), sub(S.Q, mtext('buang')), mo('+'), sub(S.Q, mtext('balik')))), '1.1')}
${display(row(eq(mi('S'), row(sum(mi('i'), null, row(S.Wi, S.ai)), mo('+'), S.Vc)), mo(','), space('1.2em'), eq(S.ai, row(mn('2'), S.dx, S.Lb))), '1.2')}
${display(
  row(
    eq(mtext('masuk'), row(V('hujan,blok'), mo('+'), V('hujan,sal'), mo('+'), V('balik'), mo('+'), V('klem'))),
    mo(','),
    space('1.2em'),
    eq(mtext('keluar'), row(V('ET'), mo('+'), V('evap,sal'), mo('+'), V('buang'), mo('+'), V('batas'))),
    mo(','),
    space('1.2em'),
    eq(mtext('residu'), row(mtext('masuk'), mo('−'), mtext('keluar'), mo('−'), dS)),
  ),
  '1.3',
)}
${display(row(eq(sub(mi('X'), mtext('mm')), frac(row(mn('1000'), mo('·'), mi('X')), S.Atot)), mo(','), space('1.2em'), eq(mi('ε'), frac(row(abs(mtext('residu')), mo('+'), V('klem')), row(mi('max'), paren(row(mtext('masuk'), mo(';'), mtext('keluar'), mo(';'), sup(mn('10'), mn('−9'))))))) ), '1.4')}
${p(`${im(dS)} adalah perubahan simpanan sejak awal skenario: air di gambut (${im(S.Wi)}, m) dikali luas sel ${im(S.ai)} (kedua sisi blok simetris), ditambah volume saluran ${im(S.Vc)}. ${im(V('klem'))} adalah air yang "dibuat" bila volume saluran harus dipotong ke nol (seharusnya 0) dan ${im(V('batas'))} hanya dipakai pada uji dengan muka saluran tetap. Galat ${im(mi('ε'))} di bawah 10⁻⁹ berarti neraca tertutup sampai presisi mesin.`)}
<div class="eq-live" data-live="nr-sym"></div>
${calcBox('nr-calc')}
${h3('Neraca 14 hari terakhir')}
${p(`Rata-rata harian dari model (hari terakhir bisa belum lengkap). Pembuangan bersih = pembuangan − aliran balik, dalam mm atas ${im(S.Atot)}. ETp adalah evapotranspirasi <em>potensial</em>; ET aktual lebih kecil saat muka air tanah dalam (bagian 2).`)}
<div class="eq-live" data-live="nr-table"></div>
<div class="eq-plots eq-plots-1">
${plot('nr-daily', 'Hujan, ETp, dan pembuangan harian (mm/hari), 30 hari terakhir', {
  legend: [legendItem('Hujan', '--series-rain', { bar: true }), legendItem('Pembuangan', '--series-q'), legendItem('ETp', '--series-tmas', { dash: true })].join(''),
})}
</div>`;
}

export function live(c) {
  const b = c.e.balance;
  const cum = b.cum;
  const A = c.e.geometry.Atot;
  const mm = (v) => m3dToMm(v, A); // m³ → mm atas A_tot
  const out = {};
  out['nr-sym'] = symTable([
    { sym: S.Atot, arti: 'luas total (blok + muka saluran)', unit: 'm²', val: fmt(A, 0) },
    { sym: V('hujan,blok'), arti: 'hujan di atas blok gambut', unit: 'mm', val: fmt(mm(cum.rainBlock), 2) },
    { sym: V('hujan,sal'), arti: 'hujan langsung ke muka saluran', unit: 'mm', val: fmt(mm(cum.rainCanal), 2) },
    { sym: V('ET'), arti: 'evapotranspirasi aktual blok', unit: 'mm', val: fmt(mm(cum.et), 2) },
    { sym: V('evap,sal'), arti: 'evaporasi air terbuka saluran', unit: 'mm', val: fmt(mm(cum.evapCanal), 2) },
    { sym: V('buang'), arti: 'pembuangan lewat pintu air', unit: 'mm', val: fmt(mm(cum.outWeir), 2) },
    { sym: V('balik'), arti: 'aliran balik dari sungai', unit: 'mm', val: fmt(mm(cum.backflow), 2) },
    { sym: V('klem'), arti: 'koreksi volume negatif (harus 0)', unit: 'mm', val: fmt(mm(cum.clamp), 3) },
    { sym: dS, arti: 'perubahan simpanan sejak awal', unit: 'mm', val: fmtSigned(mm(b.dS), 2) },
  ]);

  const lines = [];
  lines.push(`<p class="eq-calc-sub">Kumulatif sejak awal skenario (${fmt(c.snap.tDays, 2)} hari simulasi), mm atas A<sub>tot</sub></p>`);
  lines.push(
    line(
      mtext('masuk'),
      row(nm(mm(cum.rainBlock), 1), mo('+'), nm(mm(cum.rainCanal), 1), mo('+'), nm(mm(cum.backflow), 1), mo('+'), nm(mm(cum.clamp), 1)),
      `${fmt(mm(b.in), 1)} mm`,
    ),
  );
  lines.push(
    line(
      mtext('keluar'),
      row(nm(mm(cum.et), 1), mo('+'), nm(mm(cum.evapCanal), 1), mo('+'), nm(mm(cum.outWeir), 1), mo('+'), nm(mm(cum.boundary), 1)),
      `${fmt(mm(b.out), 1)} mm`,
    ),
  );
  lines.push(line(dS, row(mi('S'), mo('−'), sub(mi('S'), mn('0'))), `${fmtSigned(mm(b.dS), 1)} mm`, { note: `= ${fmt(b.dS, 0)} m³` }));
  lines.push(line(mtext('residu'), row(nm(mm(b.in), 1), mo('−'), nm(mm(b.out), 1), mo('−'), paren(nm(mm(b.dS), 1))), `${fmtSci(mm(b.residual), 2)} mm`));
  lines.push(line(mi('ε'), null, fmtSci(b.relError, 2), { note: b.relError < 1e-9 ? 'neraca tertutup (&lt; 10⁻⁹)' : 'periksa neraca' }));
  const t = c.snap.today;
  if (t.hours > 0) {
    lines.push(`<p class="eq-calc-sub">${t.hours} jam terakhir (jendela bergulir), mm atas A<sub>tot</sub></p>`);
    lines.push(
      line(
        row(S.P, mo('−'), S.ET, mo('−'), sub(S.Q, mtext('bersih'))),
        row(nm(t.rain_mm, 1), mo('−'), nm(t.et_mm, 1), mo('−'), nmp(t.out_mm, 1)),
        `${fmtSigned(t.dS_mm, 1)} mm`,
        { note: `= ΔS (residu ${fmtSci(t.residual_mm, 1)} mm)` },
      ),
    );
  } else {
    lines.push(textLine('Belum ada jam yang dihitung: jalankan simulasi (▶ atau +1 hari) untuk melihat neraca 24 jam terakhir.'));
  }
  out['nr-calc'] = lines.join('');

  // tabel 14 hari
  const s = c.series;
  const pz = c.pz;
  const rows = [];
  const j0 = Math.max(0, s.n - 14);
  for (let j = s.n - 1; j >= j0; j--) {
    const d = s.depthCm[pz]?.[j];
    const cls = classifyTmat(d);
    rows.push([
      `${esc(s.dateLabel[j])}${s.partial[j] ? ' <span class="eq-tag">berjalan</span>' : ''}`,
      fmt(s.rain_mm[j], 1),
      fmt(s.etp_mm[j], 1),
      fmt(s.out_mm[j], 1),
      `${fmtSigned(-d, 1)}`,
      `<span class="st st-${esc(cls.id)}"><span aria-hidden="true">${esc(cls.icon)}</span> ${esc(cls.label)}</span>`,
      fmtSigned(-s.tmasCm[j], 0),
      ppBadge(s.ppCompliant[j], true),
    ]);
  }
  out['nr-table'] = rows.length
    ? table(['Tanggal', 'Hujan (mm)', 'ETp (mm)', 'Pembuangan (mm)', `TMAT ${esc(pz)} (cm)`, `Kategori ${esc(pz)}`, 'TMAS (cm, elevasi)', `PP (${esc(s.tpId)})`], rows, {
        num: [1, 2, 3, 4, 6],
        cls: 'eq-compact',
        caption: `TMAT = elevasi muka air relatif permukaan (−45 = 45 cm di bawah permukaan); PP dinilai dari rata-rata harian di titik penaatan ${esc(s.tpId)}`,
        label: 'Tabel neraca harian',
      })
    : note('Belum ada data harian: jalankan simulasi (▶ atau +1 hari).');
  return out;
}

export function plots(c) {
  const s = c.series;
  const j0 = Math.max(0, s.n - 30);
  const x = s.day.slice(j0).map((d) => d + 1);
  const rain = s.rain_mm.slice(j0);
  const outMm = s.out_mm.slice(j0);
  const etp = s.etp_mm.slice(j0);
  const top = Math.max(10, ...rain, ...outMm, ...etp) * 1.1;
  const lo = Math.min(0, ...outMm);
  const xmin = x.length ? x[0] - 0.5 : 0.5;
  const xmax = x.length ? x.at(-1) + 0.5 : 1.5;
  return {
    'nr-daily': {
      x: { min: xmin, max: xmax, label: 'hari simulasi', integer: true, fmt: (v) => fmt(v, 0) },
      y: { min: lo, max: top, label: 'mm/hari' },
      bars: [{ x, y: rain, color: '--series-rain', w: 0.7, alpha: 0.75 }],
      series: [
        { x, y: outMm, color: '--series-q', width: 2 },
        { x, y: etp, color: '--series-tmas', width: 1.5, dash: true },
      ],
    },
  };
}
