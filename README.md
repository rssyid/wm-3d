# Simulasi Tata Air Kebun Sawit Gambut (wm-3d)

Simulasi 3D berbasis web untuk menunjukkan **hubungan curah hujan, TMAT (tinggi muka air tanah, piezometer),
TMAS (tinggi muka air saluran), dan pembuangan lewat pintu air** pada satu blok kebun kelapa sawit di lahan gambut.

```
curah hujan → TMAT (piezometer) → rembesan & parit lapangan → TMAS (saluran, papan duga) → pintu air stoplog → pembuangan ke sungai
```

Aplikasi ini adalah **model sintetis untuk edukasi dan diskusi**. Modelnya belum dikalibrasi dengan data lapangan dan
**tidak boleh dipakai untuk keputusan operasional**.

## Fitur

- **Simulasi 3D** (Three.js):
  - blok 30 ha dengan permukaan gambut berkubah, mikro-relief, piringan, pasar pikul, dan gawangan mati;
  - blok tetangga, sungai, dan hutan;
  - pohon sawit detail;
  - potongan melintang tanah dengan zona jenuh dan garis muka air tanah;
  - piezometer P1–P4, papan duga, dan pintu air stoplog dengan luapan (nappe);
  - partikel hujan, aliran saluran, dan panah rembesan.
- **Model hidrologi** yang dihitung tiap jam:
  - transek air tanah Dupuit–Boussinesq dengan sifat gambut yang bergantung kedalaman;
  - parit lapangan, limpasan dan genangan, serta ET;
  - simpanan saluran dan ambang stoplog (aliran bebas, terendam, dan aliran balik);
  - respons sungai.
  - Neraca air selalu tertutup (galat relatif < 10⁻⁹).
- **Skenario**: kemarau panjang, tahun normal, musim hujan, hujan ekstrem 3 hari, dan mode **Manual** dengan slider.
- **Pintu air** manual atau **otomatis**, dengan target kategori perusahaan atau kewajiban PP.
- **Dua acuan kepatuhan**, selalu ditampilkan terpisah:
  - **Kategori TMAT perusahaan**, warna sesuai ketentuan perusahaan (CMYK):

    | Kategori | Kedalaman TMAT | Warna |
    |---|---|---|
    | Banjir | < 0 cm | hitam |
    | Tergenang | 0–40 cm | biru |
    | Agak Tergenang | 41–45 cm | cyan |
    | Normal | 46–60 cm | hijau zaitun |
    | Agak Kering | 61–65 cm | kuning |
    | Kering | > 65 cm | merah |

  - **Kewajiban PP 71/2014 jo PP 57/2016**: TMAT ≤ 40 cm di titik penaatan. Bawaannya P4, di tengah petak.
    Kategori "Normal" perusahaan berada di luar batas PP, dan aplikasi menampilkan perbedaan ini apa adanya.
- **Indikator dan grafik**:
  - KPI, diagram *Alur hubungan* dengan neraca harian;
  - grafik 3 panel: hujan, muka air dengan pita kategori dan batas PP, serta pembuangan;
  - tabel harian dengan tombol Salin CSV;
  - risiko kebakaran dan subsidensi (keduanya heuristik).
- **Tab Persamaan & Perhitungan** dengan 11 sub-menu:
  - persamaan dalam MathML dan tabel simbol;
  - **perhitungan langsung dari kondisi simulasi saat ini**;
  - grafik mini, pilihan piezometer, dan tombol "Bekukan angka".
- **Tab Tentang Model**: konvensi satuan, asumsi, keterbatasan, dan referensi.
- Tema terang/gelap mengikuti sistem. Tampilan ponsel memakai tab Kontrol / Indikator / Grafik.

## Menjalankan

Tidak ada tahap build. Cukup jalankan server statis apa saja:

```bash
python3 -m http.server 8000      # lalu buka http://localhost:8000/
```

Membuka `index.html` langsung lewat `file://` tidak akan berjalan, karena ES modules butuh server.
Three.js (`three@0.185.1`) dimuat dari jsDelivr lewat *import map*, jadi peramban perlu akses internet.
Bila tidak ada WebGL atau CDN, model, indikator, dan grafik tetap berjalan tanpa tampilan 3D.

**Pintasan keyboard:** Spasi = jalankan/jeda, → = maju 1 hari, R = ulang.

## Konvensi satuan

| Besaran | Konvensi |
|---|---|
| Datum | z = 0 di tepi tanggul saluran koleksi, positif ke atas. Permukaan gambut berkubah: zs(x) = Hd·(1 − (1 − x/Lh)²). |
| TMAT | Kedalaman muka air tanah di bawah permukaan gambut setempat, ditampilkan sebagai elevasi bertanda. Contoh: "−46 cm" berarti 46 cm di bawah permukaan; nilai positif berarti banjir/genangan. |
| TMAS | Muka air saluran relatif tanggul, ditampilkan sebagai elevasi bertanda (mis. "−56 cm" = 56 cm di bawah tanggul). Papan duga (nol di tanggul) menunjukkan angka yang sama. Di tab Persamaan, rumus menulis TMAS sebagai kedalaman positif lalu dikonversi ke elevasi. |
| Pembuangan | Debit melewati pintu air: m³/s, L/s, dan mm/hari setara di atas luas blok + saluran (30,6 ha). |

## Parameter bawaan (ringkas)

| Komponen | Nilai |
|---|---|
| Blok | 1000 × 300 m, gambut 4 m, kubah 0,20 m |
| Saluran koleksi | 2 × 1000 m, dasar −1,6 m |
| Saluran utama | 300 m, dasar −2,2 m |
| Parit lapangan | setiap 59 m, dalam 0,9 m |
| Gambut | Sy 0,30 → 0,08 terhadap kedalaman; K permukaan 50 m/hari → 1 m/hari |
| Pintu air | ambang −2,0 m, lebar 1,5 m, papan 0,20 m, bawaan 7 papan (mercu −0,60 m) |

Rincian lengkap ada di tab **Persamaan & Perhitungan → Parameter & referensi**, `docs/rencana.md`, dan `docs/desain.md`.

## Pengujian

```bash
npm install          # hanya devDependencies: three (untuk tes) dan playwright-core
npm test             # tes unit (node --test): model, UI, persamaan, scene
npm run test:e2e     # tes peramban headless (Playwright + Chromium + SwiftShader)
npm run check        # keduanya
npm run scenario -- kemarau --every 10   # tabel harian satu skenario di terminal
```

Tes e2e melayani `three` dari `node_modules`, sehingga bisa berjalan tanpa akses CDN.

## Deploy ke GitHub Pages

Cara termudah: **Settings → Pages → Deploy from a branch**, pilih branch dan folder `/ (root)`.
Berkas `.nojekyll` sudah tersedia dan semua path relatif, sehingga situs berjalan di `https://<user>.github.io/wm-3d/`.

Bila ingin memakai GitHub Actions, contoh `.github/workflows/pages.yml`:

```yaml
name: Pages
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.d.outputs.page_url }}' }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-pages-artifact@v3
        with: { path: . }
      - id: d
        uses: actions/deploy-pages@v4
```

**Opsi offline:** salin `node_modules/three/build/three.module.min.js`, `three.core.min.js`, dan
`examples/jsm/{controls/OrbitControls.js,renderers/CSS2DRenderer.js,utils/BufferGeometryUtils.js}` ke folder
`vendor/three/`. Lalu ubah alamat di *import map* `index.html` ke `./vendor/three/...`.

## Struktur

```
index.html            import map, kerangka halaman
css/                  base.css (token tema), ui.css, scene.css, equations.css
js/main.js            akar komposisi: store, loop waktu, model ↔ UI ↔ scene
js/core/              store, stepper, interpolasi snapshot, konfigurasi (tanpa DOM/three)
js/model/             model hidrologi murni (tanpa DOM/three/Math.random/Date)
js/ui/                dashboard, grafik, tabel, Alur, halaman Tentang, router, format angka
js/ui/equations/      tab Persamaan & Perhitungan (MathML)
js/scene/             scene Three.js
scripts/              CLI skenario
tests/unit, tests/e2e
docs/                 rencana.md (rencana disetujui), desain.md (spesifikasi detail), kontrak.md (antarmuka modul)
```

## Asumsi & keterbatasan

- Model sintetis yang belum dikalibrasi. Cuaca dibangkitkan secara acak tetapi ber-seed, sehingga hasilnya dapat diulang.
- Transek 1D simetris: satu TMAS untuk seluruh jaringan saluran, dan parit lapangan dihitung sebagai sub-grid.
- Kepatuhan PP dinilai dari rata-rata harian di titik penaatan. Ini **asumsi model**, karena P.15/2017 mengatur
  cara pengukuran, bukan rata-rata harian.
- Hanya kelas TMAS "Optimal 50–70 cm" yang bersumber dari BMP RSPO; kelas lainnya ilustratif.
- Risiko kebakaran dan subsidensi adalah heuristik. Subsidensi tidak memengaruhi hidrologi.
- Blok digambar sepanjang 400 m (aslinya 1 km). Ukuran instrumen dibesar-besarkan, dan elevasi
  dieksagerasi (bawaan ×10).

## Referensi

- PP No. 71/2014 jo PP No. 57/2016 tentang Perlindungan dan Pengelolaan Ekosistem Gambut (Ps. 23 ayat 3 huruf a).
- Permen LHK No. P.15/MENLHK/SETJEN/KUM.1/2/2017 tentang Tata Cara Pengukuran Muka Air Tanah di Titik Penaatan.
- RSPO, *Manual on Best Management Practices for Existing Oil Palm Cultivation on Peat*.
- Wösten, J.H.M. dkk. (2008). Peat–water interrelationships in a tropical peatland ecosystem in Southeast Asia. *Catena*.
- Hooijer, A. dkk. (2012). Subsidence and carbon loss in drained tropical peatlands. *Biogeosciences* 9.
- Baird, A.J. dkk. (2017). High permeability explains the vulnerability of the carbon store in drained tropical peatlands. *GRL*.
- Kurnianto, S. dkk. (2019). Influence of land use on hydraulic properties of tropical peat (Kalimantan Barat).

## Lisensi

Kode aplikasi: MIT. Three.js © penulis three.js (MIT).
