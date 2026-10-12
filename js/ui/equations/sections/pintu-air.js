// Bagian 8 — Pintu air stoplog & pembuangan, plus muka air sungai dan aturan mode otomatis.
// Sumber angka: explain().weir, snapshot.structure/control, ratingCurve(), crestLevel(), weirQ(), classifyTmas().
import { fmtQ } from '../../format.js';
import {
  crestLevel,
  weirQ,
  classifyTmas,
  safeMaxLogs,
  emergencyTmasOf,
  CONTROL_RULES,
  CONTROL_TARGETS,
} from '../../../model/index.js';
import { mi, mn, mo, row, sup, eq, paren, cases, when, mtext, fn, space, sub, bar, frac } from '../mathml.js';
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
  Sfn,
  ratio,
  p32,
  m3dToMm,
} from '../common.js';

export const id = 'pintu-air';

const max0 = (x) => fn('max', [x, mn('0')], ';');

export function render(c) {
  const w = c.params.weir;
  const rv = c.params.river;
  return `
${p(`Pintu air di ujung saluran utama adalah <strong>ambang berpapan stoplog</strong>. Air saluran baru mengalir ke sungai bila muka air saluran ${im(S.hc)} lebih tinggi daripada <em>mercu</em> (puncak papan teratas). Setiap papan setebal ${fmt(w.plank, 2)} m; menambah satu papan menaikkan mercu sehingga air tertahan lebih lama di saluran, dan muka air tanah di blok ikut tertahan.`)}
${p(`Debit memakai rumus ambang standar ${im(row(S.Q, mo('∝'), sup(mi('H'), p32())))}. Bila muka air sungai ${im(S.hr)} naik di atas mercu, ambang menjadi <em>terendam</em> dan debit dikurangi faktor Villemonte ${im(Sfn(mi('r')))}. Bila sungai lebih tinggi daripada saluran, air mengalir <em>balik</em> ke saluran (debit negatif), kecuali pintu klep dipasang.`)}
${display(eq(S.crest, row(S.sill, mo('+'), S.dp, mo('·'), S.n)), '8.1')}
${display(row(eq(S.H1, row(S.hc, mo('−'), S.crest)), mo(','), space('1.5em'), eq(S.H2, row(S.hr, mo('−'), S.crest))), '8.2')}
${display(
  eq(
    S.Q,
    cases([
      [mn('0'), when(S.H1, mo('≤'), mn('0'), space('0.4em'), mtext('dan'), space('0.4em'), S.H2, mo('≤'), mn('0'))],
      [row(S.Cw, S.Lw, sup(S.H1, p32()), Sfn(ratio(S.H2, S.H1))), when(S.H1, mo('≥'), S.H2)],
      [row(mo('−'), S.Cw, S.Lw, sup(S.H2, p32()), Sfn(ratio(S.H1, S.H2))), when(S.H2, mo('>'), S.H1, space('0.6em'), mtext('(aliran balik)'))],
    ]),
  ),
  '8.3',
)}
${display(eq(Sfn(mi('r')), sup(paren(row(mn('1'), mo('−'), sup(max0(mi('r')), p32()))), mn('0,385'))), '8.4')}
${display(row(mtext('pintu klep: '), space('0.3em'), S.Q, mo('←'), fn('max', [S.Q, mn('0')], ';')), '8.5')}
${display(row(eq(sub(S.Q, mtext('mm/hari')), frac(row(mn('86 400'), mo('·'), mn('1000'), mo('·'), S.Q), S.Atot)), mo(','), space('1.5em'), eq(sub(S.Q, mtext('L/s')), row(mn('1000'), mo('·'), S.Q))), '8.6')}
${p(`Debit dihitung untuk muka air saluran hasil penyelesaian implisit (bagian 7), sehingga ${im(S.Q)} dan ${im(S.hc)} selalu konsisten dalam satu sub-langkah. Satuan internal ${im(S.Q)} adalah m³/s; dalam neraca harian dikalikan 86 400 s/hari.`)}
<div class="eq-live" data-live="pa-sym"></div>
${calcBox('pa-calc')}
<div class="eq-plots eq-plots-1">
${plot('pa-rating', 'Kurva rating Q(H₁) untuk mercu saat ini, dengan titik operasi sekarang', {
  legend: [
    legendItem('Q(H₁) aliran bebas', '--series-q'),
    legendItem('Q(H₁) dengan muka sungai saat ini (bila di atas mercu)', '--series-tmas', { dash: true }),
    legendItem('Titik operasi', '--accent', { dot: true }),
  ].join(''),
})}
</div>
${h3('Pengaruh jumlah stoplog')}
${p(`Mercu menentukan muka air saluran terendah yang masih bisa dibuang lewat pintu air. Tabel berikut memakai ${im(S.crest)} dari persamaan (8.1); TMAS minimum = muka air tepat di mercu (TMAS = 100·(${im(S.zbank)} − ${im(S.crest)}) cm).`)}
<div class="eq-live" data-live="pa-logs"></div>
${h3('Muka air sungai')}
${p(`Muka air sungai di hilir pintu air dimodelkan sebagai respons lambat terhadap hujan: rata-rata bergerak eksponensial curah hujan ${im(S.Er)} (mm/hari) dengan konstanta waktu ${im(S.tauR)} = ${fmt(rv.tauR, 0)} hari, dibatasi atas oleh ${im(S.zRmax)}. Pada mode Manual nilai ${im(S.hr)} langsung dari slider.`)}
${display(eq(S.hr, fn('min', [row(S.zR0, mo('+'), S.gR, mo('·'), S.Er), S.zRmax], ';')), '8.7')}
${display(eq(row(mi('d'), S.Er, mo('/'), mi('d'), S.t), row(paren(row(S.P, mo('−'), S.Er)), mo('/'), S.tauR)), '8.8')}
${display(row(sup(S.Er, mtext('baru')), mo('='), S.Er, mo('+'), paren(row(S.P, mo('−'), S.Er)), paren(row(mn('1'), mo('−'), sup(mi('e', { mathvariant: 'normal' }), row(mo('−'), S.dt, mo('/'), S.tauR))))), '8.9')}
${p(`Persamaan (8.9) adalah penyelesaian eksak (8.8) untuk satu sub-langkah ${im(S.dt)} dengan ${im(S.P)} tetap; ${im(S.P)} di sini dalam mm/hari.`)}
${calcBox('pa-river', 'Perhitungan saat ini — sungai')}
${h3('Mode otomatis (aturan harian)')}
${p(`Pada mode <em>Otomatis</em>, jumlah stoplog dievaluasi sekali sehari (pukul 24.00 simulasi) dari kedalaman muka air tanah rata-rata 24 jam terakhir di titik penaatan ${im(bar('d'))}, untuk kedua target. Histeresis ${fmt(CONTROL_RULES.hysteresisCm, 0)} cm dan jeda minimal ${fmt(CONTROL_RULES.minIntervalDays, 0)} hari mencegah papan naik-turun terus-menerus. Jumlah papan maksimum dibatasi agar mercu tetap ≥ (ambang darurat TMAS + 10 cm) di bawah tanggul, supaya penambahan papan tidak langsung memicu aturan darurat.`)}
${table(
  ['Target', 'Pita [b₁, b₂]', 'Darurat bila TMAS &lt;', 'Papan maks. otomatis'],
  Object.values(CONTROL_TARGETS).map((t) => [esc(t.label), `${t.band.join('–')} cm`, `${fmt(emergencyTmasOf(t.id), 0)} cm`, String(safeMaxLogs(w, c.params.geom.zBank, t.id))]),
  { num: [2, 3], cls: 'eq-compact', label: 'Target mode otomatis' },
)}
${table(
  ['Urutan', 'Syarat', 'Tindakan'],
  [
    ['1. Darurat', `TMAS &lt; ambang darurat <em>atau</em> ada genangan, dan ${im(row(S.hr, mo('<'), S.hc, mo('−'), mn(fmt(CONTROL_RULES.riverMarginM, 2))))} m`, `buang ${CONTROL_RULES.emergencyDrop} papan (minimal 0)`],
    ['1b. Tahan', `kondisi darurat tetapi sungai tinggi (${im(row(S.hr, mo('≥'), S.hc, mo('−'), mn(fmt(CONTROL_RULES.riverMarginM, 2))))} m)`, 'papan ditahan (membuka hanya memasukkan air sungai)'],
    ['2. Jeda', `kurang dari ${CONTROL_RULES.minIntervalDays} hari sejak perubahan terakhir`, 'tidak ada tindakan'],
    ['3. Terlalu basah', `${im(row(bar('d'), mo('<'), sub(mi('b'), mn('1')), mo('−'), mn(String(CONTROL_RULES.hysteresisCm))))} cm dan ${im(row(S.n, mo('>'), mn('0')))}`, 'kurangi 1 papan'],
    ['4. Terlalu kering', `${im(row(bar('d'), mo('>'), sub(mi('b'), mn('2')), mo('+'), mn(String(CONTROL_RULES.hysteresisCm))))} cm`, 'tambah 1 papan; bila sudah maksimum → catat "jenuh" (target tidak tercapai)'],
  ],
  { caption: 'Aturan otomatis, diperiksa berurutan', label: 'Aturan mode otomatis' },
)}
${calcBox('pa-auto', 'Status pintu air saat ini')}
`;
}

function regime(wd) {
  if (wd.H1 <= 0 && wd.H2 <= 0) return { text: 'Tidak ada aliran: muka air saluran dan sungai di bawah mercu.', kind: 'info' };
  if (wd.flapBlocked) return { text: 'Sungai lebih tinggi daripada saluran, tetapi pintu klep menutup sehingga tidak ada aliran balik.', kind: 'warn' };
  if (!wd.forward) return { text: 'ALIRAN BALIK: sungai lebih tinggi daripada saluran sehingga air sungai masuk ke saluran.', kind: 'bad' };
  if (wd.submerged) return { text: 'Aliran terendam: muka air sungai di atas mercu, debit dikurangi faktor Villemonte.', kind: 'warn' };
  return { text: 'Aliran bebas: muka air sungai di bawah mercu, S = 1.', kind: 'ok' };
}

export function live(c) {
  const wd = c.e.weir;
  const w = c.params.weir;
  const Atot = c.e.geometry.Atot;
  const st = c.snap.structure;
  const Qmmd = m3dToMm(86400 * wd.Q, Atot);
  const out = {};

  out['pa-sym'] = symTable([
    { sym: S.sill, arti: 'elevasi ambang (dasar papan)', unit: 'm', val: fmt(wd.sill, 2) },
    { sym: S.dp, arti: 'tebal satu papan stoplog', unit: 'm', val: fmt(wd.plank, 2) },
    { sym: S.n, arti: 'jumlah papan terpasang', unit: '–', val: `${wd.nLogs} dari ${w.nMax}` },
    { sym: S.crest, arti: 'elevasi mercu', unit: 'm', val: fmt(wd.crest, 2) },
    { sym: S.hc, arti: 'muka air saluran (hulu pintu)', unit: 'm', val: fmt(wd.hc, 3) },
    { sym: S.hr, arti: 'muka air sungai (hilir pintu)', unit: 'm', val: fmt(wd.hr, 3) },
    { sym: S.H1, arti: 'tinggi muka air hulu (saluran) di atas mercu; negatif = di bawah mercu', unit: 'm', val: fmt(wd.H1, 3) },
    { sym: S.H2, arti: 'tinggi muka air hilir (sungai) di atas mercu; negatif = di bawah mercu', unit: 'm', val: fmt(wd.H2, 3) },
    { sym: S.Cw, arti: 'koefisien debit ambang', unit: 'm½/s', val: fmt(wd.Cw, 2) },
    { sym: S.Lw, arti: 'lebar ambang', unit: 'm', val: fmt(wd.Lw, 2) },
    {
      sym: mi('r'),
      arti: wd.forward ? 'rasio terendam H₂/H₁ (hilir/hulu)' : 'rasio terendam H₁/H₂ (aliran balik)',
      unit: '–',
      val: wd.Hup > 0 ? (wd.ratio > 0 ? fmt(wd.ratio, 3) : `${fmt(wd.ratio, 2)} (≤ 0: bebas)`) : '–',
    },
    { sym: Sfn(mi('r')), arti: 'faktor peredaman Villemonte', unit: '–', val: fmt(wd.S, 3) },
    { sym: S.Q, arti: 'debit (+ ke sungai, − aliran balik)', unit: 'm³/s', val: fmt(wd.Q, 4) },
  ]);

  // --- perhitungan ---
  const lines = [];
  lines.push(line(S.crest, row(nmp(wd.sill, 2), mo('+'), nm(wd.plank, 2), mo('×'), mn(String(wd.nLogs))), `${fmt(wd.crest, 2)} m`));
  lines.push(line(S.H1, row(nm(wd.hc, 3), mo('−'), nmp(wd.crest, 2)), `${fmt(wd.H1, 3)} m`));
  lines.push(line(S.H2, row(nm(wd.hr, 3), mo('−'), nmp(wd.crest, 2)), `${fmt(wd.H2, 3)} m`));
  const qAttr = ' data-eq-value="weir-q"';
  const qNote = `= ${fmt(1000 * wd.Q, 1)} L/s = ${fmt(Qmmd, 1)} mm/hari`;
  if (wd.H1 <= 0 && wd.H2 <= 0) {
    lines.push(textLine(`${im(S.H1)} ≤ 0 dan ${im(S.H2)} ≤ 0 → air saluran tidak melimpas mercu.`));
    lines.push(line(S.Q, mn('0'), fmtQ(wd.Q), { resultAttrs: qAttr, note: qNote }));
  } else if (wd.forward) {
    if (wd.ratio <= 0) {
      lines.push(line(mi('r'), ratio(S.H2, S.H1), fmt(wd.ratio, 3)));
      lines.push(line(Sfn(mi('r')), sup(paren(row(mn('1'), mo('−'), sup(mn('0'), p32()))), mn('0,385')), fmt(wd.S, 3), { note: 'r ≤ 0: sungai di bawah mercu → aliran bebas' }));
    } else {
      lines.push(line(mi('r'), row(ratio(S.H2, S.H1)), fmt(wd.ratio, 3)));
      lines.push(line(Sfn(mi('r')), sup(paren(row(mn('1'), mo('−'), sup(nm(wd.ratio, 3), p32()))), mn('0,385')), fmt(wd.S, 3), { note: 'terendam' }));
    }
    lines.push(
      line(S.Q, row(nm(wd.Cw, 1), mo('×'), nm(wd.Lw, 1), mo('×'), sup(nm(wd.H1, 3), mn('1,5')), mo('×'), nm(wd.S, 3)), fmtQ(wd.Q), {
        resultAttrs: qAttr,
        note: qNote,
      }),
    );
  } else {
    lines.push(line(mi('r'), row(ratio(S.H1, S.H2)), fmt(wd.ratio, 3), { note: 'aliran balik: peran H₁ dan H₂ bertukar' }));
    lines.push(line(Sfn(mi('r')), sup(paren(row(mn('1'), mo('−'), sup(nm(Math.max(wd.ratio, 0), 3), p32()))), mn('0,385')), fmt(wd.S, 3)));
    const raw = weirQ(wd.hc, wd.hr, wd.crest, c.params.weir, false);
    if (wd.flapBlocked) {
      lines.push(line(sub(S.Q, mtext('tanpa klep')), row(mo('−'), nm(wd.Cw, 1), mo('×'), nm(wd.Lw, 1), mo('×'), sup(nm(wd.H2, 3), mn('1,5')), mo('×'), nm(wd.S, 3)), `${fmt(raw, 4)} m³/s`));
      lines.push(line(S.Q, fn('max', [nm(raw, 4), mn('0')], ';'), fmtQ(wd.Q), { resultAttrs: qAttr, note: 'pintu klep menutup' }));
    } else {
      lines.push(
        line(S.Q, row(mo('−'), nm(wd.Cw, 1), mo('×'), nm(wd.Lw, 1), mo('×'), sup(nm(wd.H2, 3), mn('1,5')), mo('×'), nm(wd.S, 3)), fmtQ(wd.Q), {
          resultAttrs: qAttr,
          note: qNote,
        }),
      );
    }
  }
  const rg = regime(wd);
  lines.push(`<p class="eq-calc-foot eq-tone-${rg.kind}">${esc(rg.text)}</p>`);
  out['pa-calc'] = lines.join('');

  // --- tabel stoplog ---
  const nAuto = safeMaxLogs(w, c.params.geom.zBank, c.snap.control.target);
  const rows = [];
  for (let n = 0; n <= w.nMax; n++) {
    const cr = crestLevel(n, w);
    const tm = 100 * (c.params.geom.zBank - cr);
    const cls = classifyTmas(tm);
    const tags = [];
    if (n === wd.nLogs) tags.push('<strong>saat ini</strong>');
    if (n === nAuto) tags.push('maks. otomatis');
    rows.push([String(n), fmt(cr, 2), fmt(tm, 0), `<span class="eq-chip" style="--chip:${esc(cls.color)};--chip-ink:${esc(cls.ink)}"><span aria-hidden="true">${esc(cls.icon)}</span> ${esc(cls.label)}</span>`, tags.join(', ')]);
  }
  out['pa-logs'] = table(['Papan n', 'Mercu (m)', 'TMAS min. (cm)', 'Kelas TMAS', 'Catatan'], rows, {
    num: [1, 2],
    cls: 'eq-compact',
    rowAttrs: (i) => (i === wd.nLogs ? ' class="eq-row-current"' : ''),
    label: 'Tabel jumlah stoplog',
  });

  // --- sungai ---
  const rv = c.params.river;
  const rl = [];
  if (c.river.manual) {
    rl.push(textLine(`Mode Manual: ${im(S.hr)} diambil langsung dari slider "Muka air sungai".`));
    rl.push(line(S.hr, null, `${fmt(wd.hr, 3)} m`));
  } else {
    const lin = c.river.zR0 + rv.gR * c.river.Er; // tampilan substitusi (8.7) sebelum dibatasi
    rl.push(line(S.Er, null, `${fmt(c.river.Er, 2)} mm/hari`, { note: `rata-rata eksponensial hujan, konstanta waktu ${im(S.tauR)} = ${fmt(rv.tauR, 0)} hari` }));
    rl.push(line(row(S.zR0, mo('+'), S.gR, S.Er), row(nmp(c.river.zR0, 2), mo('+'), nm(rv.gR, 2), mo('×'), nm(c.river.Er, 2)), `${fmt(lin, 3)} m`));
    rl.push(line(S.hr, fn('min', [nm(lin, 3), nm(rv.zRMax, 2)], ';'), `${fmt(wd.hr, 3)} m`, { note: wd.hr >= rv.zRMax - 1e-9 ? 'dibatasi z<sub>R,maks</sub>' : '' }));
  }
  rl.push(`<p class="eq-calc-foot">Mercu ${fmt(wd.crest, 2)} m → sungai ${wd.hr > wd.crest ? '<strong>di atas</strong>' : 'di bawah'} mercu (${fmt(100 * (wd.hr - wd.crest), 1)} cm).</p>`);
  out['pa-river'] = rl.join('');

  // --- mode otomatis ---
  const ctl = c.snap.control;
  const tgt = CONTROL_TARGETS[ctl.target] ?? CONTROL_TARGETS.perusahaan;
  const s = c.series;
  let lastFull = -1;
  for (let j = s.n - 1; j >= 0; j--) if (!s.partial[j]) {
    lastFull = j;
    break;
  }
  const dMean = lastFull >= 0 ? s.tpDepthCm[lastFull] : NaN;
  const al = [];
  al.push(
    textLine(
      `Mode: <strong>${st.mode === 'auto' ? 'Otomatis' : 'Manual'}</strong> · papan ${st.nLogs} · mercu ${fmt(st.crestM, 2)} m · pintu klep ${st.flapGate ? 'terpasang' : 'tidak terpasang'} · TMAS ${fmt(c.snap.canal.tmasCm, 1)} cm (${esc(c.snap.canal.tmasCls.label)})`,
    ),
  );
  if (st.mode === 'auto') {
    al.push(
      textLine(
        `Target: ${esc(tgt.label)} · pita [${tgt.band.join('; ')}] cm · darurat bila TMAS &lt; ${fmt(emergencyTmasOf(tgt.id), 0)} cm · ${im(bar('d'))} (${esc(c.snap.ind.tpId)}, hari terakhir) = ${Number.isFinite(dMean) ? `${fmt(dMean, 1)} cm` : 'belum ada (hari pertama)'}`,
      ),
    );
  } else {
    al.push(textLine('Mode Manual: jumlah papan hanya berubah bila diubah pengguna.'));
  }
  const log = ctl.log.slice(-5).reverse();
  if (log.length) {
    al.push(`<ul class="eq-log">${log.map((l) => `<li><span class="eq-log-d">${esc(l.dateLabel)}</span> ${esc(l.text)}</li>`).join('')}</ul>`);
  } else {
    al.push('<p class="eq-calc-foot">Belum ada perubahan papan.</p>');
  }
  out['pa-auto'] = al.join('');
  return out;
}

export function plots(c) {
  const wd = c.e.weir;
  const r = c.rating;
  const series = [{ x: r.H, y: r.Q, color: '--series-q', width: 2 }];
  // sungai di atas mercu: kurva Q(H₁) untuk muka air sungai saat ini (terendam / aliran balik), dari weirQ model
  let qLo = Math.min(0, wd.Q);
  if (wd.H2 > 0) {
    // grid H ditambah H₁ dan H₂ saat ini: kurva melewati titik operasi dan titik Q = 0 dengan tepat (Villemonte curam di r → 1)
    const top = r.H.at(-1);
    const hs = [...new Set([...r.H, wd.H1, wd.H2].filter((h) => h >= 0 && h <= top))].sort((a, b) => a - b);
    const qs = hs.map((h) => weirQ(wd.crest + h, wd.hr, wd.crest, c.params.weir, wd.flapGate));
    series.push({ x: hs, y: qs, color: '--series-tmas', width: 2, dash: true });
    qLo = Math.min(qLo, ...qs);
  }
  const qMax = Math.max(...r.Q, wd.Q, 0.01);
  const qMin = qLo < 0 ? qLo - 0.05 * (qMax - qLo) : 0;
  const lines = [];
  if (qMin < 0) lines.push({ y: 0, color: '--series-muted' });
  return {
    'pa-rating': {
      x: { min: 0, max: r.H.at(-1), label: 'H₁ = hc − mercu (m)' },
      y: { min: qMin, max: qMax * 1.08, label: 'Q (m³/s)' },
      series,
      hlines: lines,
      vlines: wd.H2 > 0 ? [{ x: wd.H2, color: '--series-tmas', dash: true, label: 'H₂ (sungai)' }] : [],
      points: [
        {
          x: Math.max(wd.H1, 0),
          y: wd.Q,
          color: '--accent',
          r: 5,
          ring: true,
          label: `${fmt(wd.Q, 3)} m³/s`,
        },
      ],
    },
  };
}
