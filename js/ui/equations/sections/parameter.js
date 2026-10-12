// Bagian 11 — Parameter model (semua entri DEFAULT_PARAMS) dan daftar referensi.
// Nilai dari explain().params (parameter aktif) dibandingkan dengan DEFAULT_PARAMS dan DEFAULT_CONTROL.
import { DEFAULT_PARAMS, DEFAULT_CONTROL, getPath, crestLevel } from '../../../model/index.js';
import { mi, mn, mo, row, sub, mtext, up } from '../mathml.js';
import { SYM as S, esc, fmt, fmtSci, table, h3, p, im, note, display } from '../common.js';
import { eq, space, sum } from '../mathml.js';

export const id = 'parameter';

const s = (a, b) => sub(mi(a), mi(b));

/** Metadata per path: [simbol MathML, satuan, arti, sumber/asumsi, desimal]. */
const META = {
  'geom.Lh': [S.Lh, 'm', 'setengah lebar blok (tanggul → tengah blok, pemisah aliran)', 'geometri blok 300 m; ilustratif (blok 200–300 m umum)', 0],
  'geom.N': [S.N, '–', 'jumlah sel transek', 'pilihan numerik (Δx = 5 m)', 0],
  'geom.blockLength': [S.Lb, 'm', 'panjang blok sejajar saluran koleksi', 'blok 1 km, tata letak kebun gambut umum', 0],
  'geom.zBank': [S.zbank, 'm', 'datum: tepi tanggul saluran koleksi', 'definisi (z = 0)', 2],
  'geom.zBase': [S.zbase, 'm', 'elevasi dasar gambut (datar)', 'gambut dalam 4 m; asumsi', 2],
  'geom.Hd': [S.Hd, 'm', 'tinggi kubah gambut di tengah blok', 'asumsi; dapat diubah 0–1 m (Kontrol → Lahan)', 2],
  'geom.collection.count': [s('n', 'k'), '–', 'jumlah saluran koleksi (kedua sisi blok)', 'tata letak', 0],
  'geom.collection.length': [s('L', 'k'), 'm', 'panjang tiap saluran koleksi', 'tata letak', 0],
  'geom.collection.zBed': [S.zbed, 'm', 'elevasi dasar saluran koleksi', 'dimensi saluran kebun gambut (desain; belum diverifikasi lapangan)', 2],
  'geom.collection.bottom': [s('b', 'k'), 'm', 'lebar dasar saluran koleksi', 'idem', 2],
  'geom.collection.slope': [s('m', 'k'), '–', 'kemiringan talud saluran koleksi (H:V)', 'idem', 2],
  'geom.main.count': [s('n', 'u'), '–', 'jumlah saluran utama', 'tata letak', 0],
  'geom.main.length': [s('L', 'u'), 'm', 'panjang saluran utama ke pintu air', 'tata letak', 0],
  'geom.main.zBed': [s('z', 'b,u'), 'm', 'elevasi dasar saluran utama', 'dimensi saluran (desain; belum diverifikasi)', 2],
  'geom.main.bottom': [s('b', 'u'), 'm', 'lebar dasar saluran utama', 'idem', 2],
  'geom.main.slope': [s('m', 'u'), '–', 'kemiringan talud saluran utama (H:V)', 'idem', 2],
  'fieldDrains.enabled': [mtext('parit'), '–', 'parit lapangan aktif', 'pilihan pengguna (Kontrol → Lahan)', 0],
  'fieldDrains.spacing': [S.sfd, 'm', 'jarak antar-parit lapangan (± tiap 8 baris sawit)', 'tata letak kebun; asumsi', 0],
  'fieldDrains.depth': [S.dfd, 'm', 'kedalaman dasar parit dari permukaan', 'asumsi', 2],
  'peat.SyS': [S.SyS, '–', 'specific yield di permukaan', 'kisaran literatur gambut tropis; ilustratif', 2],
  'peat.SyD': [S.SyD, '–', 'specific yield di kedalaman', 'idem', 2],
  'peat.lamS': [S.lamS, 'm', 'skala peluruhan Sy terhadap kedalaman', 'idem', 2],
  'peat.Ks': [S.Ks, 'm/hari', 'konduktivitas hidrolik di permukaan', 'gambut kebun terdrainase (Kurnianto dkk. 2019; hutan ±200); dapat diubah 20–500', 0],
  'peat.Kd': [S.Kd, 'm/hari', 'konduktivitas hidrolik di kedalaman', 'kisaran literatur (gambut terdekomposisi); ilustratif', 2],
  'peat.lamK': [S.lamK, 'm', 'skala peluruhan K terhadap kedalaman', 'ilustratif (cocok dengan K tinggi di lapisan akar, Baird dkk. 2017)', 2],
  'et.fullTo': [S.zeta1, 'm', 'ET penuh sampai kedalaman ini', 'asumsi', 2],
  'et.reduceTo': [S.zeta2, 'm', 'kedalaman β mencapai minimum', 'asumsi', 2],
  'et.betaMin': [S.betaMin, '–', 'faktor ET minimum (akar sawit tetap menyerap)', 'asumsi', 2],
  'et.baseGuard': [S.dg, 'm', 'zona pengaman di atas dasar gambut (ET → 0)', 'pengaman numerik', 2],
  'et.eowFactor': [S.cow, '–', 'rasio evaporasi air terbuka terhadap ETp', 'umum 1,05–1,2; asumsi', 2],
  'runoff.ks': [S.ks, '1/hari', 'laju limpasan genangan ke saluran', 'asumsi', 1],
  'weir.zSill': [S.sill, 'm', 'elevasi ambang pintu air (tanpa papan)', 'desain pintu stoplog; asumsi', 2],
  'weir.width': [S.Lw, 'm', 'lebar ambang', 'asumsi', 2],
  'weir.plank': [S.dp, 'm', 'tebal satu papan stoplog', 'papan 20 cm umum di lapangan', 2],
  'weir.nMax': [s('n', 'maks'), '–', 'jumlah papan maksimum', 'desain', 0],
  'weir.Cw': [S.Cw, 'm½/s', 'koefisien debit ambang (ambang lebar ≈ 1,7)', 'hidraulika standar', 2],
  'river.gR': [S.gR, 'm per mm/hari', 'kepekaan muka sungai terhadap hujan rata-rata', 'ilustratif', 2],
  'river.tauR': [S.tauR, 'hari', 'konstanta waktu respons sungai terhadap hujan', 'ilustratif', 0],
  'river.zRMax': [S.zRmax, 'm', 'batas atas muka sungai', 'ilustratif (sungai bisa merendam pintu air saat ekstrem)', 2],
  'numerics.C': [S.C, '–', 'faktor aman stabilitas (Courant)', 'numerik', 2],
  'numerics.canalCoupling': [S.ck, '–', 'faktor batas kopling saluran', 'numerik', 2],
  'numerics.dtMin': [S.dtmin, 'hari', 'sub-langkah minimum', 'numerik', 5],
  'numerics.spinUpDays': [sub(mi('n'), mtext('spin‑up')), 'hari', 'lama pemanasan (spin-up) sebelum hari 1', 'numerik', 0],
  'numerics.bisectIter': [sub(mi('n'), mtext('bis')), '–', 'iterasi bisection muka air saluran', 'numerik', 0],
  fixedCanalLevel: [sub(mi('h'), mtext('tetap')), 'm', 'kait uji: muka air saluran dipatok (kosong = tidak dipakai)', 'hanya untuk uji unit', 2],
};

function flatten(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (k === 'piezometers') continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, path, out);
    else out.push(path);
  }
  return out;
}

function fmtVal(v, d) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'ya' : 'tidak';
  if (typeof v === 'number') return Math.abs(v) > 0 && Math.abs(v) < 1e-3 ? fmtSci(v, 1) : fmt(v, d);
  return esc(String(v));
}

export function render() {
  return `
${p(`Tabel berikut memuat <strong>semua</strong> parameter model (<code>DEFAULT_PARAMS</code>) dengan nilai yang sedang dipakai. Baris yang berbeda dari nilai bawaan (karena diubah di Kontrol → Lahan) ditandai. Model ini <strong>sintetis dan belum dikalibrasi</strong> terhadap data lapangan: banyak nilai adalah asumsi yang masuk akal untuk menunjukkan hubungan sebab-akibat, bukan untuk keputusan operasional.`)}
<div class="eq-live" data-live="pm-table"></div>
${h3('Turunan geometri')}
${display(row(eq(S.Atot, row(S.Ablock, mo('+'), S.Acp), row(mn('2'), S.Lh, S.Lb, mo('+'), sum(mi('j'), null, row(sub(mi('L'), mi('j')), sub(mi('B'), mi('j')))))), mo(','), space('1.2em'), eq(S.dx, row(S.Lh, mo('/'), S.N))), '11.1')}
<div class="eq-live" data-live="pm-derived"></div>
${h3('Referensi')}
<ol class="eq-refs">
  <li><strong>PP No. 71 Tahun 2014 jo PP No. 57 Tahun 2016</strong> tentang Perlindungan dan Pengelolaan Ekosistem Gambut — Pasal 23 ayat (3) huruf a: ekosistem gambut fungsi budidaya dinyatakan rusak bila muka air tanah di titik penaatan lebih dari 0,4 m di bawah permukaan gambut. <span class="eq-tag">dipakai: batas 40 cm</span></li>
  <li><strong>Permen LHK P.15/MENLHK/SETJEN/KUM.1/2/2017</strong> tentang tata cara pengukuran muka air tanah di titik penaatan ekosistem gambut. <span class="eq-tag">titik penaatan di tengah petak; rata-rata harian = asumsi model</span></li>
  <li>Status PP 71/2014 setelah PP 22/2021 dan rincian penempatan titik penaatan <em>belum diverifikasi</em> untuk aplikasi ini.</li>
  <li><strong>RSPO (2019)</strong>. <em>RSPO Manual on Best Management Practices (BMPs) for Existing Oil Palm Cultivation on Peat</em>, ed. 2. <span class="eq-tag">TMAS optimal 50–70 cm</span></li>
  <li><strong>Wösten, J.H.M., Clymans, E., Page, S.E., Rieley, J.O., Limin, S.H. (2008)</strong>. Peat–water interrelationships in a tropical peatland ecosystem in Southeast Asia. <em>Catena</em> 73: 212–224. <span class="eq-tag">kedalaman kritis 40 cm</span></li>
  <li><strong>Baird, A.J., Low, R., Young, D., Swindles, G.T., Lopez, O.R., Page, S. (2017)</strong>. High permeability explains the vulnerability of the carbon store in drained tropical peatlands. <em>Geophysical Research Letters</em> 44. <span class="eq-tag">K tinggi di lapisan atas</span></li>
  <li><strong>Kurnianto, S., Selker, J., Kauffman, J.B., Murdiyarso, D., Peterson, J.T. (2019)</strong>. The influence of land-cover changes on the variability of saturated hydraulic conductivity in tropical peatlands. <em>Mitigation and Adaptation Strategies for Global Change</em> 24: 535–555. <span class="eq-tag">Ks kebun vs hutan</span></li>
  <li><strong>Ingram, H.A.P. (1982)</strong>. Size and shape in raised mire ecosystems: a geophysical model. <em>Nature</em> 297: 300–303. <span class="eq-tag">kubah gambut / mound air tanah</span></li>
  <li><strong>Boussinesq, J. (1904)</strong>; <strong>Dupuit, J. (1863)</strong> — persamaan aliran air tanah bebas dengan asumsi Dupuit. <span class="eq-tag">persamaan 5.1</span></li>
  <li><strong>Hooghoudt, S.B. (1940)</strong> — persamaan jarak drainase parit sejajar. <span class="eq-tag">persamaan 6.1</span></li>
  <li><strong>Villemonte, J.R. (1947)</strong>. Submerged weir discharge studies. <em>Engineering News-Record</em> 139: 866–869. <span class="eq-tag">persamaan 8.4</span></li>
  <li><strong>Richardson, C.W. (1981)</strong>. Stochastic simulation of daily precipitation, temperature, and solar radiation. <em>Water Resources Research</em> 17(1): 182–190. <span class="eq-tag">rantai Markov hujan</span></li>
  <li><strong>Hooijer, A. dkk. (2012)</strong>. Subsidence and carbon loss in drained tropical peatlands. <em>Biogeosciences</em> 9: 1053–1071. <span class="eq-tag">pembanding laju subsidensi; rumus model ilustratif</span></li>
</ol>
${note('Kelas hujan harian (ringan … ekstrem) dan kelas TMAS selain "Optimal" adalah ilustratif. Ukuran instrumen di tampilan 3D dibesar-besarkan agar terlihat.', 'warn')}`;
}

export function live(c) {
  const P = c.params;
  const rows = [];
  for (const path of flatten(DEFAULT_PARAMS)) {
    const meta = META[path];
    const cur = getPath(P, path);
    const def = getPath(DEFAULT_PARAMS, path);
    const d = meta ? meta[4] : 2;
    const changed = cur !== def;
    rows.push([
      meta ? im(meta[0]) : `<code>${esc(path)}</code>`,
      `${fmtVal(cur, d)}${changed ? ` <span class="eq-tag">bawaan ${fmtVal(def, d)}</span>` : ''}`,
      esc(meta ? meta[1] : ''),
      `${esc(meta ? meta[2] : '')} <code class="eq-muted">${esc(path)}</code>`,
      esc(meta ? meta[3] : ''),
    ]);
  }
  for (const pz of P.piezometers) {
    rows.push([
      im(sub(mi('x'), mtext(pz.id))),
      fmt(pz.x, 0),
      'm',
      `posisi piezometer ${esc(pz.id)}${pz.note ? ` (${esc(pz.note)})` : ''} <code class="eq-muted">piezometers</code>`,
      pz.id === c.snap.ind.tpId ? 'titik penaatan aktif' : 'tata letak instrumen',
    ]);
  }
  const ctl = c.snap.control;
  rows.push([im(mtext('TP')), esc(ctl.tpId), '–', 'titik penaatan aktif <code class="eq-muted">control.tpId</code>', `bawaan ${esc(DEFAULT_CONTROL.tpId)} (tengah petak, P.15/2017)`]);
  const crest0 = crestLevel(DEFAULT_CONTROL.nLogs, DEFAULT_PARAMS.weir);
  rows.push([
    im(S.n),
    String(c.snap.structure.nLogs),
    '–',
    'jumlah papan stoplog saat ini <code class="eq-muted">control.nLogs</code>',
    `bawaan ${DEFAULT_CONTROL.nLogs} (mercu ${fmt(crest0, 1)} m: air dibuang bila TMAS &lt; ${fmt(100 * (DEFAULT_PARAMS.geom.zBank - crest0), 0)} cm; kisaran BMP 50–70 cm)`,
  ]);
  const out = {};
  out['pm-table'] = table(['Simbol', 'Nilai', 'Satuan', 'Arti', 'Sumber / asumsi'], rows, {
    num: [1],
    cls: 'eq-compact eq-params',
    caption: 'Parameter model (nilai aktif)',
    label: 'Tabel parameter model',
  });
  const g = c.e.geometry;
  out['pm-derived'] = table(
    ['Besaran', 'Nilai', 'Satuan', 'Rumus'],
    [
      [im(S.dx), fmt(g.dx, 2), 'm', im(row(S.Lh, mo('/'), S.N))],
      [im(S.Ablock), fmt(g.Ablock, 0), 'm²', im(row(mn('2'), S.Lh, S.Lb))],
      [im(S.Acp), fmt(g.Acp, 0), 'm²', im(row(up('Σ'), sub(mi('L'), mi('j')), sub(mi('B'), mi('j'))))],
      [im(S.Atot), fmt(g.Atot, 0), 'm²', im(row(S.Ablock, mo('+'), S.Acp))],
      [im(row(sub(mi('a'), mi('i')))), fmt(g.cellArea, 0), 'm²', im(row(mn('2'), S.dx, S.Lb))],
      ['1 mm atas A<sub>tot</sub>', fmt(g.Atot / 1000, 1), 'm³', im(row(S.Atot, mo('/'), mn('1000')))],
    ],
    { num: [1], cls: 'eq-compact', label: 'Turunan geometri' },
  );
  return out;
}

export function plots() {
  return {};
}
