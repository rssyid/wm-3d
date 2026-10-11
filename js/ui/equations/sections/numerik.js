// Bagian 9 — Numerik & stabilitas: langkah waktu adaptif, kopling saluran, neraca massa, bisection.
// Sumber angka: explain().numerics/balance/geometry, parameter numerik.
import { mi, mn, mo, row, sub, sup, eq, paren, frac, mtext, fn, space, under, up } from '../mathml.js';
import {
  SYM as S,
  esc,
  fmt,
  fmtSci,
  fmtSig,
  display,
  symTable,
  calcBox,
  line,
  textLine,
  nm,
  ns,
  table,
  h3,
  p,
  im,
  daysToMin,
  unit,
} from '../common.js';

export const id = 'numerik';

const ind = (x) => row(mo('['), x, mo(']'));
const dx2 = sup(S.dx, mn('2'));

export function render(c) {
  const nu = c.params.numerics;
  const seg = c.e.geometry.segments;
  const zMin = Math.min(...seg.map((s) => s.zb));
  const width = c.e.geometry.zBank + 1 - zMin;
  return `
${p(`Model berjalan dengan <strong>langkah luar 1 jam</strong> (penghitung jam bilangan bulat, sehingga waktu tidak "melantur" karena pembulatan). Di dalam setiap jam, air tanah diintegrasi secara eksplisit (Euler maju) dengan <strong>sub-langkah adaptif</strong> ${im(S.dt)}, sedangkan muka air saluran diselesaikan implisit (bagian 7). Skema eksplisit hanya stabil bila ${im(S.dt)} cukup kecil dibanding waktu respons tercepat sel gambut:`)}
${display(
  eq(
    S.Lam,
    frac(
      row(frac(S.TbarL, dx2), mo('+'), frac(S.TbarR, dx2), mo('+'), frac(row(mn('12'), S.Tm), sup(S.sfd, mn('2'))), ind(mtext('parit aktif')), mo('+'), S.ks, ind(mtext('limpasan aktif'))),
      S.Syi,
    ),
  ),
  '9.1',
)}
${p(`Untuk sel pertama, suku muka tanggul memakai ${im(frac(row(mn('2'), S.Tb), dx2))} (jarak setengah sel); untuk sel terakhir ${im(row(S.TbarR, mo('=')))} 0 (pemisah aliran). ${im(S.Lam)} adalah laju relaksasi sel (1/hari): kebalikan waktu yang dibutuhkan sel untuk menyamakan muka airnya dengan tetangga, parit, dan saluran. Syarat stabilitas difusi eksplisit klasik ${im(row(S.dt, mo('≤'), S.Sy, dx2, mo('/'), paren(row(mn('2'), S.T))))} adalah kasus khususnya.`)}
${display(eq(S.dtgw, frac(S.C, row(under(mi('max'), mi('i')), S.Lam))), '9.2')}
${display(
  eq(
    S.dtc,
    frac(
      row(S.ck, S.Aw),
      row(
        ind(row(S.hc, mo('>'), S.zbed)),
        frac(row(mn('2'), S.Lb, mo('·'), mn('2'), S.Tb), S.dx),
        mo('+'),
        up('Σ'),
        ind(row(S.hc, mo('>'), S.zfdi)),
        S.ai,
        frac(row(mn('12'), S.Tm), sup(S.sfd, mn('2'))),
        mo('+'),
        up('Σ'),
        ind(row(S.hc, mo('>'), S.zbank)),
        S.ai,
        S.ks,
      ),
    ),
  ),
  '9.3',
)}
${p(`${im(S.dtc)} membatasi pertukaran air antara gambut dan saluran: tanpa batas ini, satu sub-langkah bisa memindahkan lebih banyak air daripada yang "muat" di muka saluran (${im(S.Aw)}), sehingga muka air berosilasi. Penyebutnya adalah turunan total aliran masuk saluran terhadap ${im(S.hc)}.`)}
${display(eq(S.dt, fn('min', [sub(S.dt, mtext('sisa jam')), fn('max', [S.dtmin, fn('min', [S.dtgw, S.dtc], ';')], ';')], ';')), '9.4')}
${display(row(eq(sup(S.Wi, row(mi('n'), mo('+'), mn('1'))), row(sup(S.Wi, mi('n')), mo('+'), S.dt, mo('·'), sup(paren(frac(row(mi('d'), S.Wi), row(mi('d'), S.t))), mi('n')))), mo(','), space('1.2em'), eq(S.zi, row(S.zsi, mo('−'), fn(sup(S.W, mn('−1')), [S.Wi])))), '9.5')}
${p(`Kebalikan ${im(fn(S.W, [S.zeta]))} dihitung dengan Newton (toleransi relatif 10⁻¹³, maks. 50 iterasi; cadangan bisection 200 iterasi). Muka air saluran dicari dengan bisection ${nu.bisectIter} iterasi pada selang awal [${fmt(zMin, 1)}; ${fmt(c.e.geometry.zBank + 1, 1)}] m (diperlebar bila perlu), sehingga galat ${im(S.hc)} ≤ ${fmt(width, 1)} m / 2${'<sup>'}${nu.bisectIter}${'</sup>'} ≈ ${fmtSci(width / 2 ** nu.bisectIter, 1)} m — praktis sama dengan presisi bilangan titik-mengambang.`)}
${display(eq(mi('ε'), frac(row(mo('|', { lspace: '0', rspace: '0' }), mtext('residu'), mo('|', { lspace: '0', rspace: '0' }), mo('+'), sub(mi('V'), mtext('klem'))), row(mi('max'), paren(row(mtext('masuk'), mo(';'), mtext('keluar'), mo(';'), sup(mn('10'), mn('−9'))))))), '9.6')}
${p(`Neraca massa (bagian 1) dihitung ulang setiap langkah dari volume kumulatif; uji unit model mensyaratkan ${im(row(mi('ε'), mo('<'), sup(mn('10'), mn('−9'))))} untuk semua skenario. Sebelum hari 1, model menjalankan <em>spin-up</em> ${nu.spinUpDays} hari dengan hujan yang sama agar keadaan awal tidak artifisial.`)}
${h3('Urutan satu sub-langkah')}
<ol class="eq-list">
  <li>Hitung untuk setiap sel: ${im(S.zeta)}, ${im(S.T)}, ${im(S.Sy)}, ET, parit ${im(S.fi)}, limpasan ${im(S.ri)}; fluks muka ${im(mi('q'))}; lalu ${im(S.Lam)}, ${im(S.dtgw)}, ${im(S.dtc)} → ${im(S.dt)} (9.1–9.4).</li>
  <li>Perbarui sungai: ${im(S.Er)} dan ${im(S.hr)} (bagian 8).</li>
  <li>Batasi penarikan dari saluran dengan faktor ${im(mi('φ'))} ≤ 1 agar volume saluran tidak negatif.</li>
  <li>Perbarui simpanan ${im(S.Wi)} (9.5) dan hitung ${im(S.zi)} baru; catat volume hujan, ET, evaporasi.</li>
  <li>Selesaikan ${im(S.hc)} implisit (7.5), hitung ${im(S.Q)}, perbarui ${im(S.Vc)}; pembuangan dibatasi air tersedia.</li>
  <li>Ulangi sampai satu jam penuh; lalu catat statistik jam, dan setiap 24 jam: rata-rata harian, kepatuhan PP, aturan pintu air otomatis.</li>
</ol>
<div class="eq-live" data-live="nu-sym"></div>
${calcBox('nu-calc')}`;
}

export function live(c) {
  const nu = c.e.numerics;
  const b = c.e.balance;
  const out = {};
  out['nu-sym'] = symTable([
    { sym: S.C, arti: 'bilangan Courant (faktor aman)', unit: '–', val: fmt(nu.C, 2) },
    { sym: S.ck, arti: 'faktor kopling saluran', unit: '–', val: fmt(nu.canalCoupling, 2) },
    { sym: S.dtmin, arti: 'sub-langkah minimum', unit: 'hari', val: fmtSci(c.params.numerics.dtMin, 1) },
    { sym: row(under(mi('max'), mi('i')), S.Lam), arti: 'laju relaksasi tercepat', unit: '1/hari', val: fmt(nu.lamMax, 3) },
    { sym: S.dtgw, arti: 'batas stabilitas air tanah', unit: 'menit', val: Number.isFinite(nu.dtGw) ? fmt(daysToMin(nu.dtGw), 2) : '∞' },
    { sym: S.dtc, arti: 'batas kopling saluran', unit: 'menit', val: Number.isFinite(nu.dtC) ? fmt(daysToMin(nu.dtC), 2) : '∞' },
    { sym: S.dt, arti: 'sub-langkah (bila sisa jam penuh)', unit: 'menit', val: fmt(daysToMin(nu.dt), 2) },
    { sym: mi('n'), arti: 'jumlah sub-langkah jam terakhir', unit: '–', val: String(nu.substepsLastHour) },
  ]);
  const L = [];
  L.push(line(S.dtgw, row(nm(nu.C, 1), mo('/'), nm(nu.lamMax, 3)), Number.isFinite(nu.dtGw) ? `${fmtSig(nu.dtGw, 3)} hari` : '∞', { note: Number.isFinite(nu.dtGw) ? `= ${fmt(daysToMin(nu.dtGw), 1)} menit` : '' }));
  L.push(line(S.dtc, null, Number.isFinite(nu.dtC) ? `${fmtSig(nu.dtC, 3)} hari` : '∞', { note: Number.isFinite(nu.dtC) ? `= ${fmt(daysToMin(nu.dtC), 1)} menit` : 'tidak membatasi (saluran kering atau muka air tetap)' }));
  const binding = nu.dt >= 1 / 24 - 1e-12 ? 'sisa jam (60 menit)' : nu.dt === nu.dtGw ? 'stabilitas air tanah' : nu.dt === nu.dtC ? 'kopling saluran' : 'batas minimum';
  L.push(
    line(
      S.dt,
      fn('min', [row(nm(60, 0), unit('mnt')), fn('max', [row(ns(daysToMin(c.params.numerics.dtMin), 2), unit('mnt')), fn('min', [Number.isFinite(nu.dtGw) ? nm(daysToMin(nu.dtGw), 1) : mi('∞'), Number.isFinite(nu.dtC) ? nm(daysToMin(nu.dtC), 1) : mi('∞')], ';')], ';')], ';'),
      `${fmt(daysToMin(nu.dt), 1)} menit`,
      { note: `pembatas: ${binding}` },
    ),
  );
  L.push(line(mi('n'), null, `${nu.substepsLastHour} sub-langkah`, { note: 'pada jam terakhir yang dihitung' }));
  L.push(line(mi('ε'), row(paren(row(ns(Math.abs(b.residual), 2), mo('+'), ns(b.cum.clamp, 2))), mo('/'), ns(Math.max(b.in, b.out), 4)), fmtSci(b.relError, 2), { note: b.relError < 1e-9 ? 'lulus (&lt; 10⁻⁹)' : 'melebihi 10⁻⁹' }));
  L.push(textLine(`Volume dalam m³ sejak awal skenario. Residu ${fmtSci(b.residual, 2)} m³ = galat pembulatan bilangan titik-mengambang.`));
  out['nu-calc'] = L.join('');
  return out;
}

export function plots() {
  return {};
}
