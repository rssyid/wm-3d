// Bagian 10 — Klasifikasi & kepatuhan: kategori TMAT perusahaan, kewajiban PP 57/2016, kelas TMAS,
// indeks risiko kebakaran (heuristik), subsidensi (ilustratif).
// Sumber angka: TMAT_CLASSES, TMAS_CLASSES, FIRE_CLASSES, THRESHOLDS, PP_LIMIT_CM, PP_BASIS, classifyTmat,
// ppCompliant, cmykToHex (model), snapshot.ind/piezometers/profile.
import {
  TMAT_CLASSES,
  TMAS_CLASSES,
  FIRE_CLASSES,
  THRESHOLDS,
  PP_LIMIT_CM,
  PP_BASIS,
  classifyTmat,
  ppCompliant,
  cmykToHex,
} from '../../../model/index.js';
import { mi, mn, mo, row, sub, eq, paren, frac, mtext, fn, space, cases, when, bar } from '../mathml.js';
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
  plot,
  legendItem,
  note,
  table,
  h3,
  p,
  im,
  stBadge,
  ppBadge,
  unit,
} from '../common.js';

export const id = 'klasifikasi';

const EXAMPLE_CM = 50;
const dbar = bar('d');
const clamp01 = (x) => fn('clamp', [x, mn('0'), mn('1')], ';');

function rangeCond(c) {
  const d = S.d;
  if (!Number.isFinite(c.min)) return row(d, mo('<'), mn(fmt(c.max, 0)));
  if (!Number.isFinite(c.max)) return row(d, mo('>'), mn(fmt(c.min, 0)));
  if (c.min === 0) return row(mn('0'), mo('≤'), d, mo('≤'), mn(fmt(c.max, 0)));
  return row(mn(fmt(c.min, 0)), mo('<'), d, mo('≤'), mn(fmt(c.max, 0)));
}

export function render(c) {
  const T = THRESHOLDS;
  const exCls = classifyTmat(EXAMPLE_CM);
  const exPP = ppCompliant(EXAMPLE_CM);
  const catRows = TMAT_CLASSES.map((k) => {
    const [C, M, Y, K] = k.cmyk;
    const ok = ppCompliant(Number.isFinite(k.max) ? k.max : 1e9);
    return [
      stBadge(k),
      esc(k.range),
      im(rangeCond(k)),
      `C${C} M${M} Y${Y} K${K}`,
      `<span class="eq-swatch" style="--sw:${esc(k.color)}"></span><code>${esc(cmykToHex(k.cmyk))}</code>`,
      ppBadge(ok, true),
    ];
  });
  const tmasRows = TMAS_CLASSES.map((k) => [
    `<span class="eq-chip" style="--chip:${esc(k.color)};--chip-ink:${esc(k.ink)}"><span aria-hidden="true">${esc(k.icon)}</span> ${esc(k.label)}</span>`,
    esc(k.range),
    esc(k.source ?? ''),
  ]);
  const fireRows = FIRE_CLASSES.map((k, i) => [
    `<span class="eq-chip" style="--chip:${esc(k.color)};--chip-ink:#FFFFFF">${esc(k.label)}</span>`,
    i === 0 ? `&lt; ${k.max}` : Number.isFinite(k.max) ? `${FIRE_CLASSES[i - 1].max}–${k.max}` : `≥ ${FIRE_CLASSES[i - 1].max}`,
  ]);
  return `
${p(`Kedalaman muka air tanah ${im(S.d)} (cm di bawah permukaan gambut, positif ke bawah; negatif = banjir/genangan) dinilai dengan <strong>dua ukuran yang berbeda dan selalu ditampilkan terpisah</strong>:`)}
<div class="eq-pair">
  <div><h4>Kategori perusahaan</h4><p>Pita pengelolaan internal kebun (masukan pengguna), enam kelas dari Banjir sampai Kering, untuk menilai apakah air "pas" bagi tanaman.</p></div>
  <div><h4>Kewajiban PP 57/2016</h4><p>Ketentuan pemerintah (PP 71/2014 jo PP 57/2016 Ps. 23 ayat 3 huruf a): gambut budidaya dinyatakan rusak bila muka air tanah lebih dalam dari <strong>0,4 m</strong> di titik penaatan.</p></div>
</div>
${h3('Kategori TMAT perusahaan')}
${display(
  eq(
    fn(mtext('kategori'), [S.d]),
    cases(TMAT_CLASSES.map((k) => [mtext(k.label), when(rangeCond(k))])),
  ),
  '10.1',
)}
${p(`Rentang bilangan bulat dari pengguna (mis. 41–45 cm) diterapkan sebagai selang kontinu (40, 45] agar setiap kedalaman punya tepat satu kategori. Warna diberikan pengguna dalam CMYK (%) dan dikonversi ke RGB layar dengan rumus sederhana tanpa profil warna:`)}
${display(row(eq(mi('R'), row(mn('255'), paren(row(mn('1'), mo('−'), mi('C'))), paren(row(mn('1'), mo('−'), mi('K'))))), mo(','), space('1em'), eq(mi('G'), row(mn('255'), paren(row(mn('1'), mo('−'), mi('M'))), paren(row(mn('1'), mo('−'), mi('K'))))), mo(','), space('1em'), eq(mi('B'), row(mn('255'), paren(row(mn('1'), mo('−'), mi('Y'))), paren(row(mn('1'), mo('−'), mi('K')))))), '10.2')}
${table(['Kategori', 'Rentang (pengguna)', 'Batas di model', 'CMYK (%)', 'Warna (hex)', `PP ≤ ${PP_LIMIT_CM} cm`], catRows, {
  cls: 'eq-compact',
  caption: 'Kategori perusahaan — ikon + label selalu menyertai warna',
  label: 'Tabel kategori TMAT perusahaan',
})}
${h3('Kewajiban PP 57/2016')}
${display(row(mtext('patuh'), space('0.4em'), mo('⇔'), space('0.4em'), sub(dbar, mtext('TP')), mo('≤'), mn(String(PP_LIMIT_CM)), unit('cm')), '10.3')}
${p(`${im(sub(dbar, mtext('TP')))} = ${esc(PP_BASIS)}. Titik penaatan bawaan adalah piezometer di tengah petak (P4), mengikuti ringkasan P.15/MENLHK/2017; dapat diganti di Kontrol → Lahan. Model juga menampilkan status sesaat (jam ini), persentase hari patuh, dan rentetan hari tidak patuh terpanjang.`)}
${note(
  `<p><strong>Contoh: ${EXAMPLE_CM} cm = ${esc(exCls.label)} tetapi ${exPP ? 'patuh' : 'TIDAK patuh'} PP.</strong> ${stBadge(exCls)} ${ppBadge(exPP)}</p>
<p>Seluruh kategori "Normal" perusahaan (46–60 cm), dan juga "Agak Tergenang" (41–45 cm), berada di luar batas PP ≤ 40 cm. Artinya, kebun yang dikelola "Normal" menurut pita internal tetap melanggar kewajiban pemerintah di titik penaatan. Hanya "Tergenang" (0–40 cm) dan "Banjir" yang memenuhi PP — padahal bagi tanaman keduanya terlalu basah. Ketegangan ini sengaja ditampilkan apa adanya.</p>`,
  exPP ? 'info' : 'bad',
)}
<div class="eq-plots eq-plots-1">
${plot('kl-map', 'Kedalaman muka air saat ini sepanjang transek di atas pita kategori perusahaan dan batas PP', {
  tall: true,
  legend: [legendItem('Kedalaman d(x)', '--chart-ink'), legendItem(`Batas PP ${PP_LIMIT_CM} cm`, '--bad', { dash: true }), legendItem('Piezometer', '--chart-ink', { dot: true })].join(''),
})}
</div>
${calcBox('kl-now', 'Status saat ini')}
${h3('Kelas TMAS (saluran)')}
${p(`TMAS = jarak muka air saluran di bawah tanggul (bagian 7). Hanya kelas "Optimal 50–70 cm" yang bersumber dari BMP RSPO untuk saluran koleksi; kelas lain ilustratif dan dapat diganti di satu tempat (<code>THRESHOLDS.tmas</code>).`)}
${table(['Kelas', 'TMAS (cm di bawah tanggul)', 'Sumber'], tmasRows, { cls: 'eq-compact', label: 'Tabel kelas TMAS' })}
${h3('Indeks risiko kebakaran (heuristik)')}
${display(eq(mtext('IRK'), row(mn('100'), mo('·'), paren(row(mn('0,7'), mo('·'), clamp01(frac(row(dbar, mo('−'), mn(String(T.fireDepthStartCm))), mn(String(T.fireDepthSpanCm)))), mo('+'), mn('0,3'), mo('·'), clamp01(frac(sub(mi('n'), mtext('kering')), mn(String(T.fireDrySpellDays)))))))), '10.4')}
${p(`${im(dbar)} = kedalaman sesaat rata-rata empat piezometer (cm); ${im(sub(mi('n'), mtext('kering')))} = jumlah hari berturut-turut dengan hujan &lt; ${T.dryDayMm} mm. Bobot 0,7/0,3 dan batas 40 cm (kedalaman kritis kebakaran menurut Wösten dkk. 2008) adalah <strong>heuristik</strong> untuk pengajaran, bukan model kebakaran yang dikalibrasi.`)}
${table(['Kelas', 'IRK'], fireRows, { cls: 'eq-compact', label: 'Kelas risiko kebakaran' })}
${h3('Subsidensi (kalibrasi ilustratif)')}
${display(eq(mi('s'), row(mn(fmt(T.subsidence.a, 1)), mo('+'), mn(fmt(T.subsidence.b, 2)), mo('·'), fn('max', [sub(dbar, mn('30')), mn('0')], ';'), unit('cm/tahun'))), '10.5')}
${p(`${im(sub(dbar, mn('30')))} = rata-rata kedalaman harian (empat piezometer) 30 hari terakhir. Akumulasi dihitung harian (${im(row(mi('s'), mo('/'), mn('365')))} per hari) dan <strong>tidak</strong> mengubah hidrologi (permukaan tidak benar-benar turun di model). Koefisien dipilih agar memberi besaran yang wajar (≈ 3,5 cm/tahun pada 40 cm; ≈ 5 cm/tahun pada 70 cm), bukan regresi terbitan.`)}
${calcBox('kl-fire', 'Perhitungan saat ini — kebakaran & subsidensi')}`;
}

export function live(c) {
  const ind = c.snap.ind;
  const pp = ind.pp;
  const T = THRESHOLDS;
  const out = {};
  const tpCls = classifyTmat(ind.tpDepthCm);
  const L = [];
  L.push(
    textLine(
      `Titik penaatan <strong>${esc(ind.tpId)}</strong>: kedalaman sesaat ${fmt(ind.tpDepthCm, 1)} cm (elevasi ${fmtSigned(-ind.tpDepthCm, 0)} cm) → ${stBadge(tpCls)} ${ppBadge(pp.now)}`,
    ),
  );
  L.push(
    line(sub(dbar, mtext('TP')), null, Number.isFinite(pp.lastDayMeanCm) ? `${fmt(pp.lastDayMeanCm, 1)} cm` : '—', {
      note: Number.isFinite(pp.lastDayMeanCm) ? `rata-rata hari terakhir yang lengkap → ${pp.lastDayCompliant ? 'patuh' : 'tidak patuh'} (batas ≤ ${pp.limitCm} cm)` : 'belum ada hari lengkap',
    }),
  );
  L.push(line(mtext('hari patuh'), pp.daysCounted ? row(mn(String(pp.compliantDays)), mo('/'), mn(String(pp.daysCounted))) : null, Number.isFinite(pp.pctDays) ? `${fmt(pp.pctDays, 0)}%` : '—', { note: `rentetan tidak patuh sekarang ${pp.streak} hari, terpanjang ${pp.longestStreak} hari` }));
  if (tpCls.id === 'normal' && !pp.now) {
    L.push(`<p class="eq-calc-foot eq-tone-bad">Sekarang: kategori perusahaan "Normal" tetapi TIDAK patuh PP — contoh nyata ketegangan dua ukuran.</p>`);
  }
  L.push(textLine(`Rata-rata empat piezometer: ${fmt(ind.meanDepthCm, 1)} cm → ${stBadge(ind.meanCls)}`));
  out['kl-now'] = L.join('');

  const fire = ind.fire;
  const F = [];
  F.push(
    line(
      mtext('IRK'),
      row(
        mn('100'),
        mo('·'),
        paren(
          row(
            mn('0,7'),
            mo('·'),
            clamp01(frac(row(nm(ind.meanDepthCm, 1), mo('−'), mn(String(T.fireDepthStartCm))), mn(String(T.fireDepthSpanCm)))),
            mo('+'),
            mn('0,3'),
            mo('·'),
            clamp01(frac(mn(String(fire.drySpellDays)), mn(String(T.fireDrySpellDays)))),
          ),
        ),
      ),
      fmt(fire.index, 1),
      { note: `kelas ${esc(fire.cls.label)}` },
    ),
  );
  F.push(line(mi('s'), row(mn(fmt(T.subsidence.a, 1)), mo('+'), mn(fmt(T.subsidence.b, 2)), mo('×'), fn('max', [nm(c.meanDepth30Cm, 1), mn('0')], ';')), `${fmt(ind.subs.rate, 2)} cm/tahun`, { note: `akumulasi sejak awal ${fmt(ind.subs.cumCm, 2)} cm` }));
  out['kl-fire'] = F.join('');
  return out;
}

export function plots(c) {
  const prof = c.snap.profile;
  const x = Array.from(prof.x);
  const d = Array.from(prof.depthCm);
  const yMin = Math.min(-10, ...d) - 5;
  const yMax = Math.max(90, ...d) + 5;
  const bands = TMAT_CLASSES.map((k) => ({
    y0: Number.isFinite(k.min) ? k.min : yMin,
    y1: Number.isFinite(k.max) ? k.max : yMax,
    color: k.color,
    alpha: 0.32,
  }));
  return {
    'kl-map': {
      x: { min: 0, max: prof.Lh, label: 'x (m) dari tanggul' },
      y: { min: yMin, max: yMax, invert: true, label: 'd (cm, ke bawah)' },
      hbands: bands,
      series: [{ x, y: d, color: '--chart-ink', width: 2 }],
      hlines: [
        { y: PP_LIMIT_CM, color: '--bad', dash: true, width: 2, label: `Batas PP ${PP_LIMIT_CM} cm`, align: 'left', below: true },
        { y: 0, color: '--series-muted', label: 'permukaan', align: 'left', below: true },
      ],
      points: c.snap.piezometers.map((q) => ({ x: q.x, y: q.depthCm, color: q.cls.color, r: q.isTP ? 6.5 : 5, ring: q.isTP, label: `${q.id}${q.isTP ? ' (TP)' : ''}` })),
      texts: TMAT_CLASSES.filter((k) => !Number.isFinite(k.max) || k.max <= yMax).map((k) => ({
        x: prof.Lh,
        y: Number.isFinite(k.max) ? k.max : yMax,
        text: k.label,
        align: 'right',
        base: 'bottom',
        dx: -4,
        dy: -2,
      })),
    },
  };
}
