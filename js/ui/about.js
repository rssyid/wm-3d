// Tab "Tentang Model" (#view-tentang): tujuan, rantai sebab-akibat, satuan & tanda, ringkasan model,
// kategori perusahaan vs PP 57/2016, asumsi & keterbatasan, cara memakai, referensi.
import { DEFAULT_CONTROL, CONTROL_TARGETS, PP_BASIS } from '../model/index.js';
import { esc } from './dom.js';

const SECTIONS = [
  ['tujuan', 'Tujuan'],
  ['rantai', 'Rantai sebab-akibat'],
  ['satuan', 'Satuan & tanda'],
  ['model', 'Ringkasan model'],
  ['kategori', 'Kategori perusahaan vs PP 57/2016'],
  ['batasan', 'Asumsi & keterbatasan'],
  ['cara', 'Cara memakai'],
  ['referensi', 'Referensi'],
];

function classRows(classes) {
  return classes
    .map((c) => {
      const pp = c.max <= 40; // seluruh rentang kelas ≤ 40 cm
      const cmyk = Array.isArray(c.cmyk) ? `C${c.cmyk[0]} M${c.cmyk[1]} Y${c.cmyk[2]} K${c.cmyk[3]}` : '';
      return `<tr>
        <th scope="row"><span class="st st-${esc(c.id)}"><span aria-hidden="true">${esc(c.icon)}</span> ${esc(c.label)}</span></th>
        <td class="num">${esc(c.range)}</td>
        <td class="mono about-cmyk">${esc(cmyk)} → ${esc(c.color)}</td>
        <td class="${pp ? 'pp-ok' : 'pp-bad'}"><span aria-hidden="true">${pp ? '✓' : '✗'}</span> ${pp ? 'Patuh' : 'Tidak patuh'}</td>
      </tr>`;
    })
    .join('');
}

export function createAbout(root, { meta } = {}) {
  const classes = meta?.tmatClasses ?? [];
  const tp = (meta?.piezometers ?? []).find((p) => p.id === DEFAULT_CONTROL.tpId);
  const targets = Object.values(meta?.controlTargets ?? CONTROL_TARGETS);
  const version = meta?.version ? `Versi ${esc(meta.version)}` : '';

  root.innerHTML = `
  <div class="about">
    <nav class="about-toc" aria-label="Isi halaman">
      <p class="about-toc-title">Isi</p>
      <ol>${SECTIONS.map(([id, t]) => `<li><a href="#tentang" data-target="tentang-${id}">${t}</a></li>`).join('')}</ol>
    </nav>

    <article class="about-body">
      <header class="about-head">
        <p class="about-kicker">Tentang Model</p>
        <h2>Simulasi tata air satu blok kebun sawit di lahan gambut</h2>
        <p class="about-lead">Model proses sederhana yang memperlihatkan bagaimana curah hujan, muka air tanah (TMAT),
        muka air saluran (TMAS), dan stoplog di pintu air saling terkait — dan apa akibatnya terhadap kategori TMAT
        perusahaan serta kewajiban PP 57/2016.</p>
        <p class="about-callout" role="note"><strong>Bukan untuk keputusan operasional.</strong>
        Data hujan sintetis dan parameter belum dikalibrasi terhadap pengukuran lapangan. Gunakan untuk belajar,
        berdiskusi, dan membandingkan strategi secara kualitatif.</p>
      </header>

      <section id="tentang-tujuan" aria-labelledby="h-tujuan">
        <h3 id="h-tujuan" tabindex="-1">Tujuan</h3>
        <p>Di kebun sawit pada lahan gambut, air harus ditahan cukup tinggi agar gambut tidak kering, mudah terbakar,
        dan terus amblas (subsidensi), tetapi tidak terlalu tinggi sampai akar tanaman tergenang. Alat yang dipakai
        sehari-hari adalah <em>pintu air stoplog</em>: menambah papan menahan air di saluran, membuang papan
        mengalirkan air ke sungai.</p>
        <p>Simulasi ini memperlihatkan rantai hubungan tersebut untuk satu blok 30 ha secara langsung: setiap jam
        simulasi, hujan dan penguapan mengubah simpanan air gambut, air tanah mengalir ke saluran, dan saluran
        membuang kelebihannya lewat pintu air. Semua angka di panel, grafik, diagram, dan tampilan 3D berasal dari
        model yang sama.</p>
      </section>

      <section id="tentang-rantai" aria-labelledby="h-rantai">
        <h3 id="h-rantai" tabindex="-1">Rantai sebab-akibat</h3>
        <ol class="about-chain">
          <li><strong>Curah hujan</strong> jatuh ke permukaan gambut dan saluran. Sebagian kembali ke udara sebagai
          evapotranspirasi (ET) — lebih kecil bila muka air tanah dalam.</li>
          <li><strong>Air tanah (TMAT)</strong> naik saat gambut menyimpan air hujan dan turun karena ET serta aliran
          ke saluran. Diukur dengan piezometer P1–P4.</li>
          <li><strong>Rembesan dan parit lapangan</strong> mengalirkan air tanah ke saluran koleksi; makin tinggi muka
          air tanah di atas muka air saluran, makin besar alirannya.</li>
          <li><strong>Saluran (TMAS)</strong> menampung air dari seluruh blok; tingginya dibaca pada papan duga.</li>
          <li><strong>Pintu air stoplog</strong> hanya meloloskan air bila muka air saluran di atas mercu (puncak
          tumpukan papan). Tiap papan menaikkan mercu 20 cm.</li>
          <li><strong>Sungai</strong> menerima pembuangan. Bila sungai lebih tinggi dari saluran, air dapat masuk
          balik — kecuali dipasang pintu klep.</li>
        </ol>
        <p class="about-feedback"><strong>Umpan balik:</strong> stoplog menahan TMAS, dan TMAS menahan TMAT.
        Menambah papan membuat lahan lebih basah; membuang papan membuat lahan lebih kering. Karena itu pada musim
        kemarau, air sebaiknya sudah “ditabung” sebelum hujan berhenti.</p>
      </section>

      <section id="tentang-satuan" aria-labelledby="h-satuan">
        <h3 id="h-satuan" tabindex="-1">Satuan & tanda</h3>
        <dl class="about-dl">
          <div><dt>Datum</dt><dd>z = 0 di tepi tanggul saluran koleksi, positif ke atas. Permukaan gambut sedikit di
          atasnya (kubah), dasar gambut −4,0 m.</dd></div>
          <div><dt>TMAT</dt><dd>Ditulis sebagai <em>elevasi bertanda relatif permukaan gambut setempat</em>:
          “−45 cm” berarti muka air 45 cm di bawah permukaan; nilai positif berarti air menggenang di atas permukaan.
          Kategori dan PP memakai kedalaman d = 45 cm.</dd></div>
          <div><dt>Naik / turun</dt><dd>“Muka air naik” berarti air makin dekat ke permukaan (kedalaman berkurang).
          Istilah “TMAT naik” tidak dipakai karena ambigu.</dd></div>
          <div><dt>TMAS</dt><dd>Muka air saluran relatif tanggul, mis. “−35 cm”. Papan duga dibaca dengan nol di
          tanggul, jadi bacaannya sama.</dd></div>
          <div><dt>Mercu</dt><dd>Elevasi puncak stoplog relatif tanggul: ambang −2,00 m + 0,20 m × jumlah papan
          (7 papan → −60 cm; 8 papan → −40 cm).</dd></div>
          <div><dt>Pembuangan</dt><dd>Q dalam m³/s dan L/s, juga mm/hari — volume per hari dibagi luas blok + saluran
          (±30,6 ha) — agar bisa dibandingkan langsung dengan curah hujan.</dd></div>
          <div><dt>Waktu & angka</dt><dd>Langkah model 1 jam; grafik, tabel, dan kepatuhan memakai rata-rata harian.
          Angka berformat Indonesia (koma desimal, titik ribuan).</dd></div>
        </dl>
      </section>

      <section id="tentang-model" aria-labelledby="h-model">
        <h3 id="h-model" tabindex="-1">Ringkasan model</h3>
        <ul class="about-list">
          <li><strong>Air tanah:</strong> transek 1D Dupuit–Boussinesq dari tanggul saluran ke tengah blok (150 m,
          30 sel × 5 m), simetris untuk kedua sisi blok.</li>
          <li><strong>Permukaan berkubah:</strong> zs(x) = Hd·(1 − (1 − x/Lh)²), Hd = 0,20 m (bisa diubah di
          Lahan → Lanjutan). Kedalaman dihitung terhadap permukaan setempat, jadi blok tidak datar dalam model maupun
          tampilan.</li>
          <li><strong>Sifat gambut:</strong> hasil jenis Sy dan konduktivitas K menurun eksponensial terhadap
          kedalaman; transmisivitas T adalah integral K sampai dasar gambut. Lapisan atas yang sangat permeabel
          membuat muka air dekat permukaan cepat surut.</li>
          <li><strong>Evapotranspirasi:</strong> ETp skenario dikalikan faktor β yang mengecil bila muka air dalam.</li>
          <li><strong>Parit lapangan:</strong> dihitung sebagai aliran sub-grid tipe Hooghoudt, f = 12·T·Δ/s²
          (jarak 59 m).</li>
          <li><strong>Saluran:</strong> satu simpanan untuk seluruh jaringan (prisma trapesium); TMAS diturunkan dari
          volume.</li>
          <li><strong>Pintu air:</strong> ambang stoplog Q = Cw·Lw·H<sup>1,5</sup>, dikoreksi faktor Villemonte bila
          hilir terendam; aliran balik bila sungai lebih tinggi, dicegah pintu klep.</li>
          <li><strong>Sungai:</strong> naik mengikuti rata-rata hujan beberapa hari terakhir; di mode Manual diatur
          dengan slider.</li>
          <li><strong>Mode Otomatis:</strong> dievaluasi sekali sehari; tambah/kurangi 1 stoplog bila rata-rata
          harian TMAT di titik penaatan keluar dari pita target (${targets
            .map((t) => `${esc(t.id === 'pp' ? 'PP' : 'perusahaan')} ${t.band[0]}–${t.band[1]} cm`)
            .join('; ')}), dengan histeresis 3 cm dan jeda ≥ 2 hari. Jumlah papan dibatasi agar mercu tidak terlalu
          dekat ke tanggul. Darurat (TMAS terlalu dangkal atau ada genangan): buang 2 papan bila sungai lebih rendah
          dari saluran.</li>
          <li><strong>Numerik:</strong> langkah 1 jam dengan sub-langkah adaptif untuk stabilitas; neraca massa
          tertutup (residu relatif &lt; 10<sup>−9</sup>).</li>
        </ul>
        <p>Semua persamaan, simbol, dan substitusi angka saat ini ada di tab
        <a href="#persamaan.neraca">Persamaan &amp; Perhitungan</a>.</p>
      </section>

      <section id="tentang-kategori" aria-labelledby="h-kategori">
        <h3 id="h-kategori" tabindex="-1">Kategori perusahaan vs PP 57/2016</h3>
        <p>Dua acuan yang berbeda selalu ditampilkan sebagai <strong>dua badge terpisah</strong>:</p>
        <div class="about-table-wrap">
          <table class="about-table">
            <caption>Kategori TMAT perusahaan (kedalaman d, cm di bawah permukaan) dan kepatuhan PP 57/2016</caption>
            <thead><tr><th scope="col">Kategori</th><th scope="col">Kedalaman d</th><th scope="col">Warna (CMYK → RGB)</th><th scope="col">PP ≤ 40 cm</th></tr></thead>
            <tbody>${classRows(classes)}</tbody>
          </table>
        </div>
        <p><strong>Kewajiban pemerintah</strong> (PP 71/2014 jo PP 57/2016 Pasal 23 ayat 3 huruf a): ekosistem
        gambut fungsi budidaya dinyatakan rusak bila muka air tanah lebih dari 0,4 m di bawah permukaan di titik
        penaatan. Titik penaatan di sini ${tp ? `${esc(tp.id)}, ${esc(String(tp.x))} m dari saluran (tengah petak)` : 'satu piezometer'}
        — dapat diganti di Lahan → Lanjutan. Dasar penilaian: ${esc(PP_BASIS)}.</p>
        <p class="about-callout about-callout-warn" role="note"><strong>Perhatikan:</strong> kategori
        “Normal” perusahaan (46–60 cm) dan “Agak Tergenang” (41–45 cm) berada di luar batas PP. Kebun yang dikelola
        “Normal” menurut perusahaan berarti <em>tidak patuh</em> PP 57/2016. Badge PP menampilkan status saat ini,
        persentase hari patuh, dan rentetan hari tidak patuh terpanjang.</p>
      </section>

      <section id="tentang-batasan" aria-labelledby="h-batasan">
        <h3 id="h-batasan" tabindex="-1">Asumsi & keterbatasan</h3>
        <ul class="about-list">
          <li><strong>Sintetis:</strong> hujan dibangkitkan acak ber-seed (rantai Markov hari basah/kering,
          jumlah hujan bersebaran Weibull) lalu diskalakan ke pola bulanan — bukan data stasiun.</li>
          <li><strong>Belum dikalibrasi:</strong> sifat gambut, kurva ET, respons sungai, dan besaran badai bersifat
          ilustratif.</li>
          <li><strong>Transek 1D:</strong> air tanah hanya mengalir tegak lurus saluran koleksi; variasi sepanjang
          blok diabaikan.</li>
          <li><strong>Satu TMAS</strong> untuk seluruh jaringan saluran, tanpa kemiringan muka air antar-saluran.</li>
          <li><strong>Parit lapangan</strong> dihitung sebagai aliran sub-grid, bukan saluran yang dimodelkan satu
          per satu.</li>
          <li><strong>Tampilan 3D:</strong> blok sepanjang 1 km digambar 400 m; piezometer, papan duga, dan pintu air
          diperbesar agar terlihat; eksagerasi vertikal hanya untuk tampilan.</li>
          <li><strong>Heuristik:</strong> indeks risiko kebakaran dan laju subsidensi adalah pendekatan ilustratif
          tanpa umpan balik ke hidrologi.</li>
          <li><strong>Di luar cakupan:</strong> pasang surut, aliran dari hulu, pintu sorong, emisi CO₂.</li>
          <li><strong>Regulasi:</strong> titik penaatan diletakkan di tengah petak mengikuti ringkasan P.15/2017;
          penilaian per rata-rata harian adalah asumsi model (P.15/2017 mengatur cara pengukuran, bukan rata-rata
          harian). Status PP 71/2014 setelah PP 22/2021 belum diverifikasi.</li>
        </ul>
        <p class="about-callout" role="note">Hasil simulasi <strong>tidak boleh</strong> dipakai untuk keputusan
        operasional pengelolaan air atau pelaporan kepatuhan.</p>
      </section>

      <section id="tentang-cara" aria-labelledby="h-cara">
        <h3 id="h-cara" tabindex="-1">Cara memakai</h3>
        <ol class="about-steps">
          <li>Pilih <strong>skenario</strong> di bilah atas: Kemarau panjang, Tahun normal, Musim hujan, Hujan ekstrem
          3 hari, atau Manual (hujan, ETp, dan muka air sungai diatur sendiri).</li>
          <li>Tekan <strong>▶ Jalankan</strong>, atau <strong>⏭ +1 hari</strong> untuk maju satu hari. Kecepatan
          bisa diubah.</li>
          <li>Ubah jumlah <strong>stoplog</strong> dengan − / + di panel Pintu air, atau pilih mode Otomatis beserta
          targetnya. Amati TMAS berubah lebih dulu, lalu TMAT.</li>
          <li>Baca dua badge di panel Indikator: <strong>kategori perusahaan</strong> dan <strong>kewajiban PP
          57/2016</strong>.</li>
          <li>Ikuti <strong>Alur hubungan</strong>: lebar panah sebanding dengan aliran (mm/hari), disertai neraca
          air 24 jam.</li>
          <li><strong>Grafik</strong> menampilkan riwayat harian; arahkan kursor untuk membaca nilai dan klik legenda
          untuk menonjolkan seri. Tab <strong>Tabel</strong> memuat angka yang sama; “Salin CSV” menyalinnya ke
          clipboard.</li>
          <li>Klik objek 3D (piezometer, papan duga, pintu air, penampang) untuk kartu detail; pilih sudut pandang
          di pojok kiri atas viewport.</li>
        </ol>
        <p class="about-keys">Pintasan keyboard: <kbd>Spasi</kbd> jalankan/jeda · <kbd>→</kbd> +1 hari ·
        <kbd>R</kbd> ulang · <kbd>C</kbd> ganti kamera · <kbd>Esc</kbd> tutup kartu.</p>
      </section>

      <section id="tentang-referensi" aria-labelledby="h-referensi">
        <h3 id="h-referensi" tabindex="-1">Referensi</h3>
        <ol class="about-refs">
          <li>Peraturan Pemerintah RI No. 71 Tahun 2014 tentang Perlindungan dan Pengelolaan Ekosistem Gambut,
          sebagaimana diubah dengan PP No. 57 Tahun 2016 (Pasal 23 ayat 3 huruf a).</li>
          <li>Peraturan Menteri LHK No. P.15/MENLHK/SETJEN/KUM.1/2/2017 tentang Tata Cara Pengukuran Muka Air Tanah
          di Titik Penaatan Ekosistem Gambut.</li>
          <li>Lim, K.H., Lim, S.S., Parish, F., Suharto, R. (ed.) (2012). <cite>RSPO Manual on Best Management
          Practices (BMPs) for Existing Oil Palm Cultivation on Peat</cite>. RSPO, Kuala Lumpur.</li>
          <li>Wösten, J.H.M., Clymans, E., Page, S.E., Rieley, J.O., Limin, S.H. (2008). Peat–water
          interrelationships in a tropical peatland ecosystem in Southeast Asia. <cite>Catena</cite> 73: 212–224.</li>
          <li>Hooijer, A., Page, S., Jauhiainen, J., Lee, W.A., Lu, X.X., Idris, A., Anshari, G. (2012). Subsidence
          and carbon loss in drained tropical peatlands. <cite>Biogeosciences</cite> 9: 1053–1071.</li>
          <li>Baird, A.J., Low, R., Young, D., Swindles, G.T., Lopez, O.R., Page, S. (2017). High permeability
          explains the vulnerability of the carbon store in drained tropical peatlands. <cite>Geophysical Research
          Letters</cite> 44: 1333–1339.</li>
        </ol>
        ${version ? `<p class="about-version">${version}</p>` : ''}
      </section>
    </article>
  </div>`;

  // Daftar isi: gulir ke bagian tanpa mengubah hash (hash dipakai router).
  root.querySelector('.about-toc').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-target]');
    if (!a) return;
    e.preventDefault();
    const sec = root.querySelector(`#${a.dataset.target}`);
    if (!sec) return;
    sec.scrollIntoView({ block: 'start' });
    sec.querySelector('h3')?.focus({ preventScroll: true });
  });
}
