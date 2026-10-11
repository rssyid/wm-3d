// Bagian 4 — Permukaan gambut berkubah, kedalaman lokal ζ, tebal gambut lokal D.
// Sumber angka: explain().cell/cells/geometry, snapshot.piezometers/profile.
import { surfaceAt } from '../../../model/index.js';
import { mi, mn, mo, row, sub, sup, eq, paren, fn, space } from '../mathml.js';
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
  stBadge,
  ppBadge,
  cellCaption,
} from '../common.js';

export const id = 'kubah';

const u = mi('u');

export function render(c) {
  const g = c.e.geometry;
  const fd = c.params.fieldDrains;
  return `
${p(`Lahan gambut alami membentuk <strong>kubah</strong>: tengah blok lebih tinggi daripada tepi saluran karena gambut terbentuk dari air hujan yang tertahan. Di model ini kubah adalah bagian dari fisika, bukan hanya tampilan: permukaan ${im(S.zs)} menentukan kedalaman lokal muka air tanah, sedangkan aliran digerakkan oleh <em>elevasi absolut</em> muka air ${im(S.z)}.`)}
${display(row(eq(fn(S.zs, [S.x]), row(S.zbank, mo('+'), S.Hd, mo('·'), paren(row(mn('1'), mo('−'), sup(paren(row(mn('1'), mo('−'), u)), mn('2')))))), mo(','), space('1.2em'), eq(u, fn('min', [fn('max', [row(S.x, mo('/'), S.Lh), mn('0')], ';'), mn('1')], ';'))), '4.1')}
${display(row(eq(sub(S.x, mi('i')), row(paren(row(mi('i'), mo('+'), mn('½'))), S.dx)), mo(','), space('1.2em'), eq(S.dx, row(S.Lh, mo('/'), S.N))), '4.2')}
${display(row(eq(S.zetai, row(S.zsi, mo('−'), S.zi)), mo(','), space('1.2em'), eq(S.d, row(mn('100'), mo('·'), S.zeta)), mo(','), space('1.2em'), eq(S.Di, row(S.zsi, mo('−'), S.zbase))), '4.3')}
${display(eq(S.zfdi, row(S.zsi, mo('−'), S.dfd)), '4.4')}
${p(`Datum ${im(row(S.z, mo('='), mn('0')))} adalah tepi tanggul saluran koleksi (${im(row(S.x, mo('='), mn('0')))}); ${im(S.x)} diukur ke arah tengah blok (${im(S.Lh)} = ${fmt(g.Lh, 0)} m, pemisah aliran). Transek dibagi ${g.N} sel selebar ${fmt(g.dx, 1)} m. Dengan ${im(S.Hd)} = ${fmt(g.Hd, 2)} m, permukaan di tengah blok ${fmt(100 * g.Hd, 0)} cm lebih tinggi daripada tanggul. Kedalaman ${im(S.d)} (cm, positif ke bawah) inilah yang dipakai untuk kategori perusahaan, kepatuhan PP, ${im(S.Sy)}, ${im(S.K)}, ${im(S.T)}, dan ET; dasar parit lapangan (${fmt(fd.depth, 1)} m di bawah permukaan) juga mengikuti kubah.`)}
${p(`Piezometer tidak selalu tepat di pusat sel. Kedalaman yang ditampilkan di KPI, badge, dan grafik adalah interpolasi linear ${im(S.zeta)} antara dua pusat sel terdekat:`)}
${display(row(eq(sub(S.d, mi('P')), row(mn('100'), mo('·'), paren(row(paren(row(mn('1'), mo('−'), mi('t'))), S.zetai, mo('+'), mi('t'), sub(S.zeta, row(mi('i'), mo('+'), mn('1'))))))), mo(','), space('1.2em'), eq(mi('t'), row(sub(S.x, mi('P')), mo('/'), S.dx, mo('−'), mn('½'), mo('−'), mi('i')))), '4.5')}
${p(`Di luar pusat sel pertama/terakhir (x &lt; ${fmt(g.dx / 2, 1)} m atau x &gt; ${fmt(g.Lh - g.dx / 2, 1)} m) dipakai ${im(S.zeta)} sel terdekat; contohnya P4 di x = ${fmt(g.Lh, 0)} m memakai sel terakhir.`)}
<div class="eq-live" data-live="kb-sym"></div>
${calcBox('kb-calc')}
<div class="eq-plots eq-plots-1">
${plot('kb-transect', 'Penampang transek tanggul → tengah blok (elevasi, m)', {
  tall: true,
  legend: [
    legendItem('Permukaan gambut zₛ(x)', '--accent'),
    legendItem('Muka air tanah z(x)', '--series-tmat'),
    legendItem('Dasar parit lapangan', '--series-muted', { dash: true }),
    legendItem('Muka air saluran hc', '--series-tmas'),
    legendItem('Piezometer (warna kategori)', '--chart-ink', { dot: true }),
  ].join(''),
})}
</div>
${h3('Piezometer')}
<div class="eq-live" data-live="kb-table"></div>`;
}

export function live(c) {
  const k = c.e.cell;
  const g = c.e.geometry;
  const fd = c.params.fieldDrains;
  const out = {};
  out['kb-sym'] = symTable([
    { sym: S.Hd, arti: 'tinggi kubah di tengah blok', unit: 'm', val: fmt(g.Hd, 2) },
    { sym: S.Lh, arti: 'setengah lebar blok (tanggul → tengah)', unit: 'm', val: fmt(g.Lh, 0) },
    { sym: S.N, arti: 'jumlah sel transek', unit: '–', val: String(g.N) },
    { sym: S.dx, arti: 'lebar sel', unit: 'm', val: fmt(g.dx, 1) },
    { sym: S.zbank, arti: 'elevasi tanggul (datum)', unit: 'm', val: fmt(g.zBank, 2) },
    { sym: S.zbase, arti: 'elevasi dasar gambut (datar)', unit: 'm', val: fmt(g.zBase, 2) },
    { sym: S.dfd, arti: 'kedalaman dasar parit lapangan', unit: 'm', val: fmt(fd.depth, 2) },
    { sym: sub(S.x, mi('i')), arti: 'posisi pusat sel pilihan', unit: 'm', val: fmt(k.x, 1) },
    { sym: S.zsi, arti: 'elevasi permukaan sel', unit: 'm', val: fmt(k.zs, 3) },
    { sym: S.zi, arti: 'elevasi muka air tanah sel', unit: 'm', val: fmt(k.z, 3) },
    { sym: S.zetai, arti: 'kedalaman muka air lokal', unit: 'm', val: fmt(k.zeta, 3) },
    { sym: S.Di, arti: 'tebal gambut lokal', unit: 'm', val: fmt(k.D, 3) },
  ]);

  const uu = Math.min(Math.max(k.x / g.Lh, 0), 1);
  const L = [textLine(cellCaption(c))];
  L.push(line(u, row(nm(k.x, 1), mo('/'), nm(g.Lh, 0)), fmt(uu, 4)));
  L.push(line(S.zsi, row(nm(g.zBank, 0), mo('+'), nm(g.Hd, 2), mo('×'), paren(row(mn('1'), mo('−'), sup(paren(row(mn('1'), mo('−'), nm(uu, 4))), mn('2'))))), `${fmt(k.zs, 3)} m`));
  L.push(line(S.zetai, row(nm(k.zs, 3), mo('−'), nmp(k.z, 3)), `${fmt(k.zeta, 3)} m`, { note: `d = ${fmt(100 * k.zeta, 1)} cm → elevasi ${fmtSigned(-100 * k.zeta, 0)} cm` }));
  L.push(line(S.Di, row(nm(k.zs, 3), mo('−'), nmp(g.zBase, 1)), `${fmt(k.D, 3)} m`));
  L.push(line(S.zfdi, row(nm(k.zs, 3), mo('−'), nm(fd.depth, 1)), `${fmt(k.fdBed, 3)} m`));
  if (k.piezometerDepthCm != null) {
    L.push(line(sub(S.d, mi('P')), null, `${fmt(k.piezometerDepthCm, 1)} cm`, { note: `interpolasi (4.5) di x = ${fmt(k.piezometerX, 0)} m; nilai yang tampil di KPI` }));
  }
  const ps = c.snap.piezometers;
  if (ps.length > 1) {
    const a = ps[0];
    const b = ps[ps.length - 1];
    L.push(
      `<p class="eq-calc-foot">Efek kubah: permukaan di ${esc(b.id)} ${fmt(100 * (b.surfaceM - a.surfaceM), 0)} cm lebih tinggi daripada di ${esc(a.id)}. Elevasi muka air ${esc(b.id)} ${fmt(b.levelM, 3)} m vs ${esc(a.id)} ${fmt(a.levelM, 3)} m; kategori ditentukan oleh kedalaman dari permukaan lokal: ${esc(b.id)} ${fmtSigned(-b.depthCm, 0)} cm vs ${esc(a.id)} ${fmtSigned(-a.depthCm, 0)} cm.</p>`,
    );
  }
  out['kb-calc'] = L.join('');

  const rows = c.snap.piezometers.map((q) => [
    `${esc(q.id)}${q.isTP ? ' <span class="eq-tag">titik penaatan</span>' : ''}`,
    fmt(q.x, 0),
    fmt(q.surfaceM, 3),
    fmt(q.levelM, 3),
    fmt(q.depthCm, 1),
    `${fmtSigned(-q.depthCm, 0)} cm`,
    stBadge(q.cls),
    ppBadge(q.ppCompliant, true),
  ]);
  out['kb-table'] = table(['Piezometer', 'x (m)', 'zₛ (m)', 'Muka air z (m)', 'd (cm)', 'Elevasi', 'Kategori perusahaan', 'PP ≤ 40 cm'], rows, {
    num: [1, 2, 3, 4, 5],
    cls: 'eq-compact',
    caption: 'Nilai sesaat (jam ini); badge PP di KPI memakai titik penaatan',
    label: 'Tabel piezometer',
  });
  return out;
}

export function plots(c) {
  const cells = c.e.cells;
  const g = c.e.geometry;
  const x = Array.from(cells.x);
  const zs = Array.from(cells.zs);
  const z = Array.from(cells.z);
  const xs = [0, ...x, g.Lh];
  const zsFull = [surfaceAt(0, c.params.geom), ...zs, surfaceAt(g.Lh, c.params.geom)];
  const fdOn = c.params.fieldDrains.enabled;
  const fdBed = zs.map((v) => v - c.params.fieldDrains.depth);
  const hc = c.e.canal.h;
  const zbed = g.segments[0].zb;
  const yMin = Math.min(zbed - 0.15, hc - 0.15, ...z) - 0.05;
  const yMax = Math.max(g.Hd, ...z) + 0.15;
  const series = [
    { x: xs, y: zsFull, color: '--accent', width: 2.5 },
    { x, y: z, color: '--series-tmat', width: 2 },
    { x: [-12, 0], y: [hc, hc], color: '--series-tmas', width: 2.5 },
    { x: [-12, -1.5, -0.2, 0], y: [zbed, zbed, g.zBank, g.zBank], color: '--series-muted', width: 1 },
  ];
  if (fdOn) series.push({ x, y: fdBed, color: '--series-muted', width: 1.25, dash: true });
  return {
    'kb-transect': {
      x: { min: -12, max: g.Lh, label: 'x (m) dari tanggul saluran koleksi' },
      y: { min: yMin, max: yMax, label: 'elevasi (m)' },
      areas: [
        { x, y0: yMin, y1: z, color: '--series-tmat', alpha: 0.12 },
        { x: [-12, 0], y0: zbed, y1: [hc, hc], color: '--series-tmas', alpha: 0.18 },
      ],
      series,
      hlines: [{ y: g.zBank, color: '--series-muted', dash: true, label: 'tanggul z = 0', align: 'left', below: true }],
      points: c.snap.piezometers.map((q) => ({ x: q.x, y: q.levelM, color: q.cls.color, r: q.id === c.pz ? 6 : 4.5, ring: q.id === c.pz, label: q.id })),
      texts: [{ x: g.Lh, y: yMin, text: `dasar gambut ${fmt(g.zBase, 1)} m (di bawah skala)`, align: 'right', base: 'bottom', dx: -4, dy: -3, color: '--series-muted' }],
    },
  };
}
