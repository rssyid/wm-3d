// Bagian 2 — Curah hujan sintetis (rantai Markov, Weibull, skala bulanan, disagregasi per jam) dan ET.
// Sumber angka: SCENARIOS, ETP_DIURNAL, DAILY_CAP_MM, MONTH_NAMES_ID (model), forcing model (ctx.forcing),
// explain().forcing/cell/canal, peatCurves().beta.
import { SCENARIOS, SCENARIO_IDS, ETP_DIURNAL, DAILY_CAP_MM, MONTH_NAMES_ID, RAIN_MU_MM, classifyTmat } from '../../../model/index.js';
import { mi, mn, mo, row, sub, sup, eq, paren, frac, mtext, fn, cases, when, space, up, sum } from '../mathml.js';
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
  note,
  table,
  h3,
  p,
  im,
  ratio,
  cellCaption,
  unit,
} from '../common.js';

export const id = 'hujan-et';


const Pr = (a, b) => row(mi('Pr'), paren(row(a, mo('|'), b)));
const wet = (j) => sub(mtext('basah'), j);
const dry = (j) => sub(mtext('kering'), j);
const jm1 = row(mi('j'), mo('−'), mn('1'));
const Rj = sub(mi('R'), mi('j'));
const etp = (k) => sub(mi('ET'), row(mi('p'), mo(','), k));
const sinArg = (h) => fn(up('sin'), [row(frac(row(mi('π'), paren(row(h, mo('+'), mn('½'), mo('−'), mn('6')))), mn('12')))]);

export function render(c) {
  const et = c.params.et;
  return `
${p(`Hujan harian dibangkitkan secara <strong>stokastik tetapi deterministik</strong> (generator acak <em>mulberry32</em> dengan seed tetap per skenario), sehingga setiap kali skenario diulang hasilnya sama persis. Dua bilangan acak ${im(sub(mi('u'), mn('1')))}, ${im(sub(mi('u'), mn('2')))} ∈ [0, 1) dipakai per hari: yang pertama menentukan <em>apakah</em> hari itu hujan, yang kedua menentukan <em>berapa banyak</em>.`)}
${display(row(eq(Pr(wet(mi('j')), dry(jm1)), sub(mi('p'), mn('01'))), mo(','), space('1.2em'), eq(Pr(wet(mi('j')), wet(jm1)), sub(mi('p'), mn('11')))), '2.1')}
${display(eq(Rj, fn('min', [row(mi('μ'), mo('·'), sup(paren(row(mo('−'), up('ln'), paren(row(mn('1'), mo('−'), sub(mi('u'), mn('2')))))), mn('1,5'))), row(mn(String(DAILY_CAP_MM)), unit('mm'))], ';')), '2.2')}
${p(`Rantai Markov orde-1 (2.1) membuat hari hujan cenderung berurutan (${im(sub(mi('p'), mn('11')))} > ${im(sub(mi('p'), mn('01')))}). Jumlah hujan hari basah (2.2) mengikuti sebaran Weibull dengan parameter bentuk 1/1,5 ≈ 0,67 dan skala ${im(mi('μ'))} = ${RAIN_MU_MM} mm, sehingga hari hujan lebat lebih sering muncul dibanding sebaran eksponensial.`)}
${display(row(Rj, mo('←'), Rj, mo('·'), frac(row(sub(mi('R'), mtext('bln')), mo('·'), mi('n'), mo('/'), sub(mi('n'), mtext('bln'))), sum(row(mi('j'), mo('∈'), mtext('bln')), null, Rj))), '2.3')}
${p(`Setelah itu jumlah hujan setiap bulan kalender diskalakan (2.3) agar <strong>tepat sama</strong> dengan target bulanan skenario ${im(sub(mi('R'), mtext('bln')))} (diprorata bila bulan hanya terpakai ${im(mi('n'))} dari ${im(sub(mi('n'), mtext('bln')))} hari). Hari yang melebihi ${DAILY_CAP_MM} mm dipotong dan kelebihannya disebar proporsional ke hari basah lain. Badai rancangan skenario Ekstrem (110/170/70 mm) dipasang sesudah penskalaan.`)}
${h3('Disagregasi ke per jam')}
${display(
  eq(
    sub(mi('w'), mi('k')),
    cases([
      [ratio(sub(mi('t'), mi('k')), sub(mi('t'), mi('p'))), when(sub(mi('t'), mi('k')), mo('<'), sub(mi('t'), mi('p')))],
      [frac(row(mi('d'), mo('−'), sub(mi('t'), mi('k'))), row(mi('d'), mo('−'), sub(mi('t'), mi('p')))), when(sub(mi('t'), mi('k')), mo('≥'), sub(mi('t'), mi('p')))],
    ]),
  ),
  '2.4',
)}
${display(row(eq(sub(mi('t'), mi('k')), row(mi('k'), mo('+'), mn('½'))), mo(','), space('1em'), eq(sub(mi('t'), mi('p')), row(mi('d'), mo('/'), mn('3'))), mo(','), space('1em'), eq(sub(mi('R'), row(mi('j'), mo(','), mi('k'))), row(Rj, mo('·'), frac(sub(mi('w'), mi('k')), sum(mi('k'), null, sub(mi('w'), mi('k'))))))), '2.5')}
${p(`Hujan satu hari dibagi ke ${im(mi('d'))} jam berbentuk segitiga dengan puncak di sepertiga durasi (2.4–2.5); jumlah per jam selalu sama dengan total harian. Durasi dan jam mulai ditentukan oleh total harian dan dua bilangan acak lain (${im(sub(mi('u'), mn('3')))}, ${im(sub(mi('u'), mn('4')))}):`)}
${table(
  ['Total harian R', 'Durasi d (jam)', 'Jam mulai'],
  [
    ['R &lt; 10 mm', '1–2', '13–18 (sore)'],
    ['10 ≤ R &lt; 40 mm', '2–4', '13–18 (sore)'],
    ['40 ≤ R &lt; 100 mm', '4–8', '0–23'],
    ['R ≥ 100 mm', '8–16', '0–23'],
  ],
  { caption: 'Aturan badai harian (jam mulai dibatasi agar badai selesai dalam hari yang sama)', cls: 'eq-compact', label: 'Aturan durasi badai' },
)}
${display(eq(S.P, row(sub(mi('s'), mi('h')), mo('·'), sub(mi('R'), row(mi('j'), mo(','), mi('k'))), mo('·'), frac(mn('24'), mn('1000')))), '2.6')}
${p(`${im(S.P)} adalah laju hujan (m/hari) yang dipakai model selama jam tersebut; ${im(sub(mi('s'), mi('h')))} adalah "pengali hujan" (0,5–1,5). Pada mode Manual hujan disebar merata 24 jam (penyederhanaan).`)}
${h3('Evapotranspirasi')}
${display(eq(etp(mi('h')), row(etp(mtext('hari')), mo('·'), sub(mi('ω'), mi('h')))), '2.7')}
${display(eq(sub(mi('ω'), mi('h')), frac(fn('max', [mn('0'), sinArg(mi('h'))], ';'), sum(row(mi('h'), mo('′')), null, fn('max', [mn('0'), sinArg(row(mi('h'), mo('′')))], ';')))), '2.8')}
${display(eq(S.ETi, row(fn(S.beta, [S.zetai]), mo('·'), S.ETp)), '2.9')}
${display(
  eq(
    fn(S.beta, [S.zeta]),
    row(
      cases([
        [mn('1'), when(S.zeta, mo('≤'), S.zeta1)],
        [row(mn('1'), mo('−'), paren(row(mn('1'), mo('−'), S.betaMin)), frac(row(S.zeta, mo('−'), S.zeta1), row(S.zeta2, mo('−'), S.zeta1))), when(S.zeta1, mo('<'), S.zeta, mo('≤'), S.zeta2)],
        [S.betaMin, when(S.zeta, mo('>'), S.zeta2)],
      ]),
      space('0.4em'),
      mo('×'),
      space('0.2em'),
      fn('max', [mn('0'), fn('min', [mn('1'), frac(row(S.D, mo('−'), S.zeta), S.dg)], ';')], ';'),
    ),
  ),
  '2.10',
)}
${display(eq(S.Eow, row(S.cow, mo('·'), S.ETp)), '2.11')}
${p(`ETp harian berasal dari skenario (per bulan untuk Tahun normal) dan dibagi ke jam siang 06.00–18.00 dengan bobot sinus (2.7–2.8). ET aktual (2.9) berkurang bila muka air tanah dalam: penuh sampai ${im(S.zeta1)} = ${fmt(et.fullTo, 1)} m, turun linear sampai ${im(S.betaMin)} = ${fmt(et.betaMin, 1)} di ${im(S.zeta2)} = ${fmt(et.reduceTo, 1)} m, lalu menuju nol pada ${fmt(et.baseGuard, 1)} m terakhir di atas dasar gambut (faktor pengaman agar gambut tidak "kering habis"). Saluran menguap sebagai air terbuka ${im(S.Eow)} = ${fmt(et.eowFactor, 1)}·ETp (2.11).`)}
<div class="eq-live" data-live="he-sym"></div>
${calcBox('he-calc')}
<div class="eq-plots">
${plot('he-beta', 'Faktor ET β terhadap kedalaman ζ, dengan posisi piezometer saat ini', {
  legend: [legendItem('β(ζ)', '--series-tmat'), legendItem('Piezometer (warna kategori)', '--chart-ink', { dot: true })].join(''),
})}
${plot('he-diurnal', 'Bobot ETp per jam ωₕ·ETp hari ini (mm/jam); titik = jam terakhir', {
  legend: [legendItem('ETp per jam', '--series-tmas', { bar: true }), legendItem('Jam terakhir', '--accent', { dot: true })].join(''),
})}
</div>
${h3('Parameter skenario')}
<div class="eq-live" data-live="he-scen"></div>`;
}

function betaLines(k, et) {
  const z = k.zeta;
  const out = [];
  if (z <= et.fullTo) {
    out.push(line(fn(S.beta, [S.zeta]), null, fmt(k.beta, 3), { note: `ζ = ${fmt(z, 3)} m ≤ ζ₁ = ${fmt(et.fullTo, 1)} m → ET penuh` }));
  } else if (z <= et.reduceTo) {
    out.push(
      line(
        fn(S.beta, [S.zeta]),
        row(mn('1'), mo('−'), paren(row(mn('1'), mo('−'), nm(et.betaMin, 1))), mo('·'), frac(row(nm(z, 3), mo('−'), nm(et.fullTo, 1)), row(nm(et.reduceTo, 1), mo('−'), nm(et.fullTo, 1)))),
        fmt(k.beta, 3),
      ),
    );
  } else {
    out.push(line(fn(S.beta, [S.zeta]), nm(et.betaMin, 2), fmt(k.beta, 3), { note: `ζ > ζ₂ = ${fmt(et.reduceTo, 1)} m` }));
  }
  if (z > k.D - et.baseGuard) out.push(textLine(`Faktor pengaman dasar gambut aktif: ζ > D − δ<sub>g</sub> = ${fmt(k.D - et.baseGuard, 2)} m.`));
  return out;
}

export function live(c) {
  const f = c.forcing;
  const k = c.e.cell;
  const et = c.params.et;
  const ex = c.e.forcing;
  const out = {};
  out['he-sym'] = symTable([
    { sym: row(sub(mi('p'), mn('01')), mo(','), sub(mi('p'), mn('11'))), arti: 'peluang hujan setelah hari kering / basah', unit: '–', val: c.scenario ? `${fmt(c.scenario.rain.p01, 2)}; ${fmt(c.scenario.rain.p11, 2)}` : 'mode Manual' },
    { sym: mi('μ'), arti: 'skala Weibull jumlah hujan hari basah', unit: 'mm', val: fmt(RAIN_MU_MM, 0) },
    { sym: sub(mi('s'), mi('h')), arti: 'pengali hujan', unit: '–', val: fmt(f.rainScale, 2) },
    { sym: S.P, arti: 'laju hujan jam terakhir', unit: 'mm/hari', val: fmt(ex.P_mmd, 1) },
    { sym: etp(mtext('hari')), arti: 'ETp harian skenario', unit: 'mm/hari', val: fmt(f.etpDaily, 2) },
    { sym: sub(mi('ω'), mi('h')), arti: 'bobot ETp jam terakhir', unit: '–', val: fmt(f.wHour, 4) },
    { sym: S.ETp, arti: 'laju ETp jam terakhir', unit: 'mm/hari', val: fmt(ex.ETp_mmd, 2) },
    { sym: S.zeta1, arti: 'kedalaman batas ET penuh', unit: 'm', val: fmt(et.fullTo, 2) },
    { sym: S.zeta2, arti: 'kedalaman β mencapai minimum', unit: 'm', val: fmt(et.reduceTo, 2) },
    { sym: S.betaMin, arti: 'faktor ET minimum', unit: '–', val: fmt(et.betaMin, 2) },
    { sym: S.dg, arti: 'zona pengaman di atas dasar gambut', unit: 'm', val: fmt(et.baseGuard, 2) },
    { sym: S.cow, arti: 'faktor evaporasi air terbuka', unit: '–', val: fmt(et.eowFactor, 2) },
  ]);

  const L = [];
  const hh = (h) => `${String(h).padStart(2, '0')}.00`;
  L.push(`<p class="eq-calc-sub">Hari ${f.day + 1} (${esc(f.dateLabel)}) — hujan harian</p>`);
  if (f.kind === 'manual') {
    L.push(textLine(`Mode Manual: hujan ${fmt(f.dayRainMm, 1)} mm/hari disebar merata, ${fmt(f.dayRainMm / 24, 2)} mm per jam.`));
  } else {
    L.push(line(Rj, f.rainScale !== 1 ? row(nm(f.dayRainMm / f.rainScale, 1), mo('×'), nm(f.rainScale, 2)) : null, `${fmt(f.dayRainMm, 1)} mm`, { note: f.storm ? `badai ${hh(f.storm.start)}–${hh(f.storm.end)} (d = ${f.storm.dur} jam)` : 'hari kering' }));
    if (f.month && Number.isFinite(f.month.target)) {
      const tgt = (f.month.target * f.month.days) / f.month.monthDays;
      L.push(
        line(
          row(sub(mi('R'), mtext('bln')), mo('·'), mi('n'), mo('/'), sub(mi('n'), mtext('bln'))),
          row(mn(String(f.month.target)), mo('×'), mn(String(f.month.days)), mo('/'), mn(String(f.month.monthDays))),
          `${fmt(tgt, 1)} mm`,
          { note: `target ${MONTH_NAMES_ID[f.month.month]}` },
        ),
      );
      L.push(
        line(sum(row(mi('j'), mo('∈'), mtext('bln')), null, Rj), null, `${fmt(f.month.sum, 1)} mm`, {
          note: f.month.storms.length ? `termasuk badai rancangan ${f.month.storms.map((s) => s.mm).join('/')} mm yang dipasang sesudah penskalaan` : 'hasil generator = target (sebelum pengali hujan)',
        }),
      );
    }
  }
  L.push(`<p class="eq-calc-sub">Jam terakhir ${hh(f.hour)}–${hh((f.hour + 1) % 24 || 24)}</p>`);
  L.push(line(S.P, row(nm(f.rain_mmh, 3), mo('×'), mn('24')), `${fmt(ex.P_mmd, 1)} mm/hari`, { note: `= ${fmt(f.rain_mmh, 2)} mm dalam jam ini` }));
  L.push(line(S.ETp, row(nm(f.etpDaily, 2), mo('×'), nm(f.wHour, 4), mo('×'), mn('24')), `${fmt(ex.ETp_mmd, 2)} mm/hari`, { note: f.wHour === 0 ? 'malam: ETp = 0' : `= ${fmt(f.etp_mmh, 3)} mm dalam jam ini` }));
  L.push(`<p class="eq-calc-sub">ET aktual di sel pilihan</p>`);
  L.push(textLine(cellCaption(c)));
  L.push(...betaLines(k, et));
  L.push(line(S.ETi, row(nm(k.beta, 3), mo('×'), nm(ex.ETp_mmd, 2)), `${fmt(1000 * k.ET, 2)} mm/hari`));
  L.push(line(S.Eow, row(nm(et.eowFactor, 1), mo('×'), nm(ex.ETp_mmd, 2)), `${fmt(1000 * c.e.canal.Eow, 2)} mm/hari`));
  out['he-calc'] = L.join('');

  // tabel skenario
  const rows = SCENARIO_IDS.map((sid) => {
    const sc = SCENARIOS[sid];
    const mon = [];
    for (let d = 0, m = sc.startMonth; d < sc.days; m = (m + 1) % 12, d += 30) mon.push(sc.rain.monthly[m]);
    const etp = Array.isArray(sc.etp) ? `${fmt(Math.min(...sc.etp), 1)}–${fmt(Math.max(...sc.etp), 1)}` : fmt(sc.etp, 1);
    const storms = sc.storms ? `; badai ${sc.storms.map((s) => `h${s.day + 1}: ${s.mm}`).join(', ')} mm` : '';
    return [
      `${esc(sc.label)}${sid === c.snap.scenarioId ? ' <span class="eq-tag">aktif</span>' : ''}`,
      `${sc.days} hari, mulai ${MONTH_NAMES_ID[sc.startMonth]}`,
      String(sc.seed),
      fmt(sc.rain.p01, 2),
      fmt(sc.rain.p11, 2),
      `${Math.min(...mon) === Math.max(...mon) ? Math.min(...mon) : `${Math.min(...mon)}–${Math.max(...mon)}`}${storms}`,
      etp,
      fmt(sc.zR0, 1),
      fmt(sc.init.tmatCm, 0),
      String(sc.init.nLogs),
    ];
  });
  out['he-scen'] =
    table(['Skenario', 'Periode', 'Seed', 'p₀₁', 'p₁₁', 'Target hujan (mm/bln)', 'ETp (mm/hari)', 'z_R0 (m)', 'TMAT awal (cm)', 'Stoplog awal'], rows, {
      num: [2, 3, 4, 6, 7, 8, 9],
      cls: 'eq-compact',
      rowAttrs: (i) => (SCENARIO_IDS[i] === c.snap.scenarioId ? ' class="eq-row-current"' : ''),
      caption: 'Empat skenario sintetis (ditambah spin-up 30 hari sebelum hari 1)',
      label: 'Tabel parameter skenario',
    }) +
    (c.snap.scenarioId === 'manual' ? note('Mode Manual aktif: hujan, ETp, dan muka air sungai diatur langsung dengan slider; tabel di atas hanya acuan.') : '');
  return out;
}

export function plots(c) {
  const cv = c.curvesFull;
  const pts = c.ids.map((pid) => {
    const k = c.ex[pid].cell;
    const cls = classifyTmat(100 * k.zeta);
    return { x: k.beta, y: k.zeta, color: cls.color, r: pid === c.pz ? 6 : 4.5, ring: pid === c.pz, label: pid };
  });
  const f = c.forcing;
  const hours = Array.from({ length: 24 }, (_, h) => h + 0.5);
  const etpH = ETP_DIURNAL.map((w) => w * f.etpDaily);
  const et = c.params.et;
  return {
    'he-beta': {
      x: { min: 0, max: 1.05, label: 'β (–)' },
      y: { min: 0, max: cv.D, invert: true, label: 'ζ (m, ke bawah)' },
      series: [{ x: cv.beta, y: cv.depth, color: '--series-tmat', width: 2 }],
      hlines: [
        { y: et.fullTo, color: '--series-muted', dash: true, label: 'ζ₁', align: 'left' },
        { y: et.reduceTo, color: '--series-muted', dash: true, label: 'ζ₂', align: 'left' },
      ],
      points: pts,
    },
    'he-diurnal': {
      x: { min: 0, max: 24, label: 'jam', ticks: [0, 6, 12, 18, 24], fmt: (v) => `${String(v).padStart(2, '0')}.00` },
      y: { min: 0, max: Math.max(0.05, ...etpH) * 1.15, label: 'mm/jam' },
      bars: [{ x: hours, y: etpH, color: '--series-tmas', w: 0.8, alpha: 0.7 }],
      points: [{ x: f.hour + 0.5, y: etpH[f.hour], color: '--accent', r: 5, ring: true, label: `${fmt(f.etp_mmh, 3)} mm` }],
    },
  };
}
