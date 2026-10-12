# Rencana: Simulasi 3D Tata Air Kebun Sawit Gambut (`wm-3d`)

## Catatan kalibrasi & review model
Nilai bawaan akhir (setelah review fisika, numerik, dan fakta):
- **K permukaan `Ks` 50 m/hari.** Ini nilai gambut kebun yang terdrainase; nilai hutan sekitar 200 (Kurnianto dkk. 2019).
- **Stoplog bawaan 7 papan (mercu −0,6 m).** TMAS sekitar 58 cm, masuk kisaran BMP 50–70 cm.
- **Kubah `Hd` 0,20 m.**
- **Sungai:** `gR` 0,04, `zRMax` −0,15. Pada badai ekstrem pintu air bisa terendam.
- **ETp kemarau** 4,5 mm/hari.
- **Jumlah hujan per hari basah** memakai sebaran Weibull (bentuk ≈ 0,67), supaya hari hujan lebat lebih realistis.

Titik penaatan bawaan = **P4 (tengah/sentroid petak)**, mengikuti ringkasan P.15/MENLHK/2017. Kepatuhan dinilai per rata-rata harian; ini **asumsi model** (`ind.pp.basis`).

Mode otomatis:
- Kedua target memakai kedalaman titik penaatan.
- **Target perusahaan:** stoplog maksimum aman 8, darurat bila TMAS < 20 cm.
- **Target PP:** pita [15, 37] cm, stoplog maksimum 9, darurat bila TMAS < 10 cm. Hasilnya, kepatuhan skenario normal naik dari 40 menjadi 217 hari/tahun.
- Bila target tidak tercapai di stoplog maksimum, model mencatat aksi "jenuh" sekali.

Kelas TMAS: hanya "Optimal 50–70" yang bersumber dari BMP RSPO; kelas lain ilustratif. "Siaga banjir" = 0–20 cm, sama dengan ambang darurat.

Perbaikan numerik:
- Saluran koleksi yang kering hanya berfungsi sebagai bidang rembesan.
- Batas sub-langkah tetap aman saat kanal kosong.
- Pembuangan dibatasi oleh air yang tersedia.
- `relError` ikut menghitung clamp.
- Forcing yang ditampilkan langsung diperbarui saat slider berubah.
- Jumlah stoplog NaN ditolak, dan `geom.N` tidak bisa diubah saat simulasi berjalan.

## Context
Repo `rssyid/wm-3d` masih kosong (belum ada commit), dan pekerjaan dilakukan di branch `claude/zealous-hawking-qtf0t8`.

User ingin simulasi 3D berbasis web yang menunjukkan rantai sebab-akibat berikut:

**curah hujan → TMAT (piezometer) → rembesan & parit lapangan → TMAS (saluran / papan duga) → stoplog pintu air → pembuangan ke sungai**

Hasil yang dituju:
- Situs statis tanpa build.
- Model proses sintetis yang deterministik, menggerakkan diorama Three.js.
- Dashboard berbahasa Indonesia: KPI, grafik, diagram "Alur hubungan", dan badge kepatuhan.

Desain ini disusun lewat workflow 7 agen (draf per sudut pandang → kritik adversarial → sintesis). Spesifikasi lengkapnya (sekitar 45 ribu karakter) ada di output workflow `wc8ow13n0`. Di M0, spesifikasi itu disalin ke `docs/desain.md` sebagai acuan implementasi.

## Keputusan (dari user + hasil verifikasi)
1. **Three.js tanpa build.** HTML + ES modules + import map yang dipin ke `three@0.185.1` di jsDelivr.
   - Versi 0.185.1 dipilih karena masih menyertakan `build/three.module.min.js` dan `three.core.min.js`, sedangkan 0.186.1 tidak.
   - Addon yang dipakai: `controls/OrbitControls.js`, `renderers/CSS2DRenderer.js`, `utils/BufferGeometryUtils.js`.
   - Semua path relatif, supaya jalan di GitHub Pages `/wm-3d/`. Tambahkan juga `.nojekyll`.
2. **Model sintetis ber-seed**, dengan 4 skenario: `kemarau`, `normal`, `hujan`, `ekstrem`. Ditambah mode **Manual** (slider). Tidak ada impor CSV.
3. **Lahan gambut**, dengan dua acuan yang **selalu ditampilkan sebagai dua badge terpisah**:
   - **Kategori perusahaan (masukan user)** untuk kedalaman TMAT d dalam cm (lihat Indikator):

     | Kategori | Rentang d (cm) |
     |---|---|
     | Banjir | < 0 |
     | Tergenang | 0–40 |
     | Agak Tergenang | 41–45 |
     | Normal | 46–60 |
     | Agak Kering | 61–65 |
     | Kering | > 65 |

   - **Kewajiban pemerintah, PP 71/2014 jo PP 57/2016 Ps. 23(3)a:** TMAT harus ≤ 40 cm di titik penaatan. Gambut dianggap rusak bila TMAT > 0,4 m.
   - UI menjelaskan bahwa kategori "Normal" perusahaan (46–60) berada di luar batas PP.
   - BMP RSPO hanya disebut sebagai referensi di tab Persamaan.
4. **Cakupan: 1 blok + outlet.** Isinya: pohon sawit, 4 piezometer, saluran koleksi, parit lapangan, saluran utama, papan duga, pintu air stoplog → sungai, dan potongan melintang tanah.
5. **Bahasa UI: Indonesia.**
   - Semua teks ada di `js/ui/strings.id.js`.
   - Angka diformat dengan `Intl.NumberFormat('id-ID')`.
   - Muka air ditampilkan sebagai elevasi bertanda relatif permukaan gambut, misalnya "TMAT −45 cm (45 cm di bawah permukaan)".
6. **Blok tidak datar (masukan user).**
   - Permukaan gambut berbentuk kubah (masuk ke model, bukan hanya visual), ditambah mikro-relief.
   - Ada piringan, pasar pikul, jalan di atas tanggul, blok tetangga yang juga ditanami sawit, sungai berkelok, dan hutan riparian.
   - Pohon sawit dibuat lebih detail.
7. **Tab "Persamaan & Perhitungan" (masukan user)** dengan sub-menu per topik:
   - Persamaan ditulis dalam MathML native (tanpa library).
   - Ada tabel simbol, substitusi angka langsung dari kondisi simulasi saat ini, dan grafik mini.

**Fakta lingkungan yang sudah dicek di container ini**
- CDN (jsDelivr, unpkg, cdnjs, esm.sh) **diblokir proxy** (403). `registry.npmjs.org` bisa diakses.
  → Untuk tes, permintaan CDN di-intercept dan dilayani dari `node_modules/three`. Produksi tetap memakai CDN.
- Playwright 1.56.1 terpasang global di `/opt/node-tools/node_modules`. Chromium-1194 ada di `/opt/pw-browsers`.
- **WebGL2 headless sudah terbukti jalan** dengan flag `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. Renderer yang terdeteksi: ANGLE/SwiftShader.
- ESM `import('playwright')` dari salinan global gagal. Yang berhasil: `createRequire(...)('playwright')`.

## Model hidrologi (`js/model/`, murni: tanpa DOM, tanpa three, tanpa `Math.random`/`Date`)

**Unit dan konvensi**
- Unit internal: hari, m, m/hari, m³. Konversi ke mm/jam, mm/hari, cm, L/s, dan m³/s hanya dilakukan di batas API.
- Datum: z = 0 di tepi tanggul saluran koleksi (`zBank = 0`), positif ke atas.

**Permukaan berkubah**
- Elevasi permukaan gambut: `zs(x) = Hd·(1 − (1 − x/Lh)²)`.
  - `Hd` adalah tinggi kubah, default 0,20 m (hasil kalibrasi). Ada slider "Kubah gambut" 0–1,0 m. Dengan `Hd = 0`, permukaan kembali datar.
- Dasar gambut datar di −4,0 m, sehingga tebal lokal `D_i = zs_i + 4,0`.

**Kedalaman dan muka air**
- Semua besaran "kedalaman" memakai kedalaman lokal `ζ_i = zs_i − z_i`. Ini berlaku untuk:
  - Sy, K, dan T;
  - faktor ET;
  - genangan, yaitu bila `z_i > zs_i`;
  - dasar parit lapangan, `zFd_i = zs_i − 0,9`.
- Gradien aliran tetap memakai head absolut z.
- `depthCm = 100·ζ` (positif ke bawah; negatif berarti banjir/genangan).
- `tmasCm = 100·(zBank − hc)`; nilai ≤ 0 berarti meluap.
- Bacaan papan duga = −TMAS, dengan nol di tanggul.

**Geometri dan parameter** (`params.js`: `DEFAULT_PARAMS` dibekukan; `PARAM_META` berisi label, unit, min/max/step)

| Komponen | Nilai |
|---|---|
| Blok | 1000 × 300 m (30 ha). Setengah transek `Lh = 150` m, `N = 30` sel, `dx = 5` m. Gambut `D = 4` m. |
| Saluran koleksi | 2 × 1000 m, dasar −1,6 m, lebar dasar 0,8 m, kemiringan 0,5 |
| Saluran utama | 300 m, dasar −2,2 m, lebar dasar 1,5 m, kemiringan 0,75 |
| Luas | `Acp = 6240` m², `Atot = 306240` m² |
| Parit lapangan | jarak `sFd = 59` m, dasar −0,9 m; bisa dimatikan dengan toggle |
| Gambut | `Sy_s 0,30`, `Sy_d 0,08`, `λS 0,6`; `Ks 50` (gambut kebun; nilai hutan ±200), `Kd 1,0` m/hari, `λK 0,25`. `Ks` dijadikan slider lanjutan 20–500. |
| Pintu air | ambang `zSill −2,0`, lebar `Lw 1,5`, papan 0,20 m, 0–9 papan, default **7 papan (mercu −0,6 m)** (hasil kalibrasi akhir), `Cw 1,7`, opsi pintu klep |
| Sungai | `hr = min(zR0 + 0,04·EMA_hujan(τ 5 hari), −0,15)`. Pada mode Manual, nilainya dari slider. |
| Piezometer | P1 x = 15, P2 x = 40, P3 x = 75, **P4 x = 150 (tengah petak = titik penaatan bawaan, P.15/2017; bisa diubah)** |

**Persamaan**

Sifat gambut (ζ = −z):
- `Sy(ζ) = Sy_d + (Sy_s−Sy_d)e^(−ζ/λS)`, dan Sy = 1 saat tergenang.
- Simpanan `W(z)` dihitung analitik. Kebalikannya, `Zinv(W)`, memakai Newton dengan fallback bisection.
- `T(z) = Kd(D−ζ) + (Ks−Kd)λK(e^(−ζ/λK) − e^(−D/λK))`. Nilai cek: T(0) = 16,25 m²/hari (Ks 50; = 53,75 bila Ks 200).

Neraca sel airtanah (Dupuit–Boussinesq 1D):
- `dW_i/dt = P − ET_i − r_i − f_i + (q_{i+½} − q_{i−½})/dx`
- Muka sisi kanal: `qb = ½(T(z0)+T(min(hcs,0)))(z0−hcs)/(dx/2)`, dengan `hcs = max(hc, zBedColl)`. Jika negatif, kanal mengisi gambut.
- Batas di tengah blok (pemisah aliran): q = 0.

Fluks lain:
- Parit lapangan (sink sub-grid): `f_i = 12·Tm·(z_i − max(hc,zFd))/sFd²`.
- Limpasan genangan: `r = min(ks(p−o), (p−o)/dt)` dengan `ks = 2`/hari. Bila kanal meluap, terjadi genangan balik.
- ET: `ETp` dari skenario, dikali faktor β(ζ). Evaporasi air terbuka `1,1·ETp`.

Kanal (satu simpanan tergabung, volume dari prisma trapesium):
- `dVc/dt = P·Acp − Eow·Aw + 2·Lb·qb + Σ(r+f)a − 86400·Qw`

Pintu air stoplog:
- H1 = hc − mercu, H2 = hr − mercu.
- Jika H1 ≥ H2: `Q = Cw·Lw·H1^1,5·S(H2/H1)`. Jika sebaliknya, Q bernilai negatif (aliran balik).
- Faktor peredaman Villemonte: `S(r) = (1 − r^1,5)^0,385`.
- Pintu klep: Q ≥ 0.
- Nilai cek: H = 0,2 m memberi Q = 0,22807 m³/s.

**Langkah waktu**
- Langkah luar 1 jam, dengan penghitung jam integer.
- Sub-step adaptif: `dt = min(0,5/maxΛ_i, batas kopling kanal, sisa jam)`, minimum 1e-5 hari.
- Level kanal diselesaikan implisit dengan bisection, karena Q monoton terhadap hc.
- Penarikan dari kanal dibatasi agar Vc ≥ 0.
- Neraca massa kumulatif: residu relatif harus < 1e-9.
- Spin-up 30 hari sebelum t = 0.

**Skenario** (`rain.js`, `scenarios.js`)
- PRNG `mulberry32`, kejadian hujan harian dengan rantai Markov, jumlah hujan hari basah bersebaran Weibull (bentuk ≈ 0,67; maks 250 mm), lalu diskalakan agar total bulanan tepat sesuai target.
- Disagregasi per jam dengan bentuk segitiga.

| id | Hari, awal | Seed | Ciri | ETp (mm/hari) | Target kalibrasi |
|---|---|---|---|---|---|
| `kemarau` | 120, Jun | 1101 | ±42 mm/bln | 4,5 | TMAT 90–120 cm di akhir ("Kering"), Q ≈ 0 |
| `normal` | 365, Jan | 2202 | bulanan [210,160,230,250,190,120,110,140,180,250,290,260] | 3,6–4,5 | musim hujan sebagian besar "Tergenang"/"Normal"; Jun–Agu menuju "Agak Kering"/"Kering" |
| `hujan` | 120, Okt | 3303 | ±300 mm/bln | 3,5 | 20–45 cm ("Tergenang"), Q sering |
| `ekstrem` | 45, Des | 4404 | basis `hujan`; hari 14/15/16 = 110/170/70 mm | 3,5 | puncak Q di hari 14–19, "Banjir" (genangan), pintu terendam |

- Mode Manual: hujan 0–200 mm/hari, ETp, dan muka air sungai.
- "Pengali hujan" ×0,5–1,5.

**Indikator** (`indicators.js`)

Kelas TMAT berdasarkan kedalaman d (cm). Ini kategori perusahaan dan bisa dikonfigurasi di `THRESHOLDS.tmat`.

Batas kelas memakai nilai kontinu, sehingga rentang bilangan bulat dari user (41–45, dst.) menjadi (40, 45] dst.:

Warna dari user diberikan dalam **CMYK %**. Konversinya ke RGB: R = 255·(1−C)(1−K), G = 255·(1−M)(1−K), B = 255·(1−Y)(1−K), dibulatkan. Hasil di bawah sudah dihitung dan dicek dengan node.

| Kelas | Rentang | CMYK % (user) | Hex | Teks di atasnya |
|---|---|---|---|---|
| Banjir | d < 0 | C0 M0 Y0 K100 (hitam) | `#000000` | putih |
| Tergenang | 0 ≤ d ≤ 40 | C65 M42 Y0 K23 (biru) | `#4572C4` | putih |
| Agak Tergenang | 40 < d ≤ 45 | C100 M20 Y0 K0 (cyan) | `#00CCFF` | hitam |
| Normal | 45 < d ≤ 60 | C19 M0 Y59 K62 (hijau zaitun) | `#4E6128` | putih |
| Agak Kering | 60 < d ≤ 65 | C0 M0 Y60 K0 (kuning) | `#FFFF66` | hitam |
| Kering | d > 65 | C0 M100 Y100 K0 (merah) | `#FF0000` | putih |

- Nilai CMYK asli disimpan di `THRESHOLDS.tmat[].cmyk` sebagai dokumentasi; nilai hex diturunkan dengan fungsi `cmykToHex()`. Keduanya ditampilkan di tab Klasifikasi.
- Warna ini dipakai secara konsisten di semua tempat: badge, cincin piezometer 3D (material unlit, `toneMapped: false` agar warnanya persis), pita grafik, tabel, dan legenda.
- Supaya Banjir (hitam) tetap terlihat di tema gelap dan di 3D:
  - swatch dan badge diberi garis tepi terang;
  - cincin piezometer 3D diberi outline putih tipis.
- Setiap kelas selalu ditampilkan dengan ikon dan label, tidak hanya warna.

Kewajiban PP 57/2016:
- Patuh bila rata-rata harian di titik penaatan ≤ 40 cm.
- Ditampilkan: status saat ini, % hari patuh, dan rentetan hari tidak patuh terpanjang.
- Bila kelas "Normal" perusahaan tetapi tidak patuh PP, UI menampilkan catatan khusus.

Kelas TMAS (acuan BMP, bisa dikonfigurasi di `THRESHOLDS.tmas` bila perusahaan punya kategori sendiri):

| Kelas | Rentang (cm) |
|---|---|
| Meluap | ≤ 0 |
| Siaga banjir | 0–30 |
| Tinggi | 30–50 |
| Optimal | 50–70 |
| Rendah | 70–100 |
| Sangat rendah | > 100 |

Indeks risiko kebakaran (heuristik): `100·(0,7·clamp((d̄−40)/60) + 0,3·clamp(kemarau/21))`.

Subsidensi (kalibrasi ilustratif, tanpa umpan balik ke hidrologi): `1,5 + 0,05·d̄₃₀` cm/tahun.

**Mode otomatis pintu air** (`control.js`, dievaluasi harian)
- Pita target: **"Perusahaan – Normal" [45,60]** (default, rata-rata 4 piezometer) atau **"PP ≤ 40"** [15,37] (kedalaman harian di titik penaatan). Histeresis 3 cm, jeda minimal 2 hari antar-aksi.
- Stoplog maksimum mode otomatis = 8 (mercu ≥ 30 cm di bawah tanggul), agar menambah papan tidak memicu aturan darurat (osilasi).
- Darurat (TMAS < 20 atau tergenang): buang 2 papan, kecuali muka air sungai lebih tinggi.
- Setiap aksi dicatat di log kejadian dan menggerakkan animasi papan.

**API engine**
- Fungsi: `createModel(params,{scenarioId,seed,rainScale,control})`, `advance(m,hours)` → snapshot, `setControl`, `setParams`, `setForcing`, `snapshot`, `dailySeries`, `runScenario`.
- Snapshot berisi `forcing`, `profile{x,z,q}`, `piezometers[]`, `canal`, `structure{nLogs,crestM,headCm,q_*,submerged,backflow}`, `river`, `ponding`, `today` (neraca harian), `ind`, `balance`, dan `control`.
- Riwayat disimpan per jam dalam ring buffer (maks 8760 entri).
- `explain(m, {cell})` mengembalikan besaran antara untuk tab Persamaan, langsung dari fungsi model yang sama sehingga tidak ada rumus ganda di UI. Isinya:
  - per sel: `zs`, `z`, `ζ`, `Sy`, `K`, `T`, `q_kiri`, `q_kanan`, `f`, `ET`, `r`, `dt`;
  - per kanal: `V(h)`, `Aw`, suku-suku neraca;
  - per pintu air: `H1`, `H2`, `S`, `Q`.
- Fungsi murni seperti `weirQ`, `transmissivity`, `specificYield`, dan `classifyTmat` diekspor agar bisa dipakai tab Persamaan dan tes.

## Scene 3D (`js/scene/`) — 1 unit = 1 m, y = 0 adalah elevasi tanggul (datum model)

**Eksagerasi vertikal** ×10 (slider 1–20) hanya berlaku pada `hydroGroup`, yaitu geometri di bawah datum. Pohon, tutup pipa, label, dan hujan tetap berukuran asli.

**Komponen**
- **terrain (tidak datar):**
  - Permukaan blok mengikuti kubah model `zs(x)`, ditambah mikro-relief hummock ±8 cm (noise ber-seed `VISUAL_SEED`). Mikro-relief dibuat nol di titik piezometer dan papan duga, supaya visual tetap konsisten dengan model.
  - Detail permukaan: piringan (cekungan dangkal melingkar Ø 3,5 m di setiap pohon), pasar pikul (jalur panen setiap 2 baris), dan tumpukan pelepah (gawangan mati).
  - Tanggul dengan jalan koleksi (tanah/laterit) di atasnya, sejajar saluran utama.
  - Sekeliling blok: 3 blok tetangga dengan sawit dan salurannya, sungai berkelok dengan tebing, hutan riparian di seberang sungai, dan siluet bukit/hutan di horizon.
  - Warna tanah menggelap saat basah. Dipotong oleh `cutPlane` di z = 0.
- **section:**
  - Permukaan atas penampang mengikuti kubah.
  - Lapisan saprik, hemik, fibrik, dan lempung mineral.
  - Overlay zona jenuh, garis muka air tanah ▽, mistar kedalaman, dan label.
- **water:** prisma air saluran pada y = hc, termasuk 6 parit lapangan. Ada pula sungai dan lembar genangan yang tampil hanya di sel dengan `z > zs`.
- **palms (lebih detail):**
  - Batang meruncing dengan tonjolan pangkal pelepah (noise vertex).
  - 20–24 pelepah melengkung berupa strip quad bertekstur anak daun (CanvasTexture + alphaTest).
  - Tandan buah (TBS) di ketiak pelepah.
  - 3 varian umur/tinggi, dengan rotasi, kemiringan, dan skala acak ber-seed.
  - InstancedMesh per bagian, sekitar 1600 pohon di blok utama pada grid segitiga 8,5 m.
  - Blok tetangga memakai varian LOD sederhana (sekitar 2400 pohon).
  - Kualitas "Rendah" memakai LOD sederhana untuk semua pohon.
- **instruments:**
  - Piezometer P1–P4: pipa transparan dengan kolom air setinggi `levelM` dan cincin berwarna status. P3 diberi outline merah bila tidak patuh.
  - Papan duga G1 dan G2 dengan CanvasTexture (tanda E setiap 5 cm).
- **gate:** tumpukan `nLogs` papan dengan animasi tween 250 ms, ribbon luapan (nappe) yang tebalnya sebanding dengan head, peringatan "Air balik", dan badge MANUAL/OTOMATIS.
- **particles:**
  - Hujan: hingga 3000 garis, `n ∝ sqrt(I/30)`.
  - Partikel aliran di saluran, kecepatannya sebanding dengan √Q.
  - Panah rembesan, panjangnya sebanding dengan |q|.
- **Langit/kabut:** menggelap mengikuti curah hujan 24 jam.
- **Kamera:** preset Ikhtisar, Penampang, Pintu air, dan Atas (tween 0,8 s). OrbitControls. Raycast untuk tooltip dan kartu detail. Label CSS2D berupa `<button>`.
- **Anggaran performa:** ≤ 60 draw call, ≤ 600 ribu segitiga (Tinggi) / ≤ 250 ribu (Rendah). Render on-demand saat dijeda, dan berhenti render saat tab Persamaan aktif.
- **Tanpa WebGL:** tampilkan pesan, sementara model dan dashboard tetap jalan.
- Hindari `Clock` dan `PCFSoftShadowMap` (deprecated di r185); gunakan `THREE.Timer` dan `PCFShadowMap`.

## UI (`js/ui/`, tidak pernah mengimpor three)

**Navigasi utama** (hash routing, tanpa reload; simulasi tetap berjalan di latar)
- Tab: **Simulasi 3D** (`#/sim`) | **Persamaan & Perhitungan** (`#/persamaan/<bagian>`) | **Tentang Model** (`#/tentang`).
- Kontrol play/pause dan skenario tetap terlihat di top bar pada semua tab.

**Tata letak tab Simulasi 3D**
- Desktop: grid `top / left view right / bottom`.
- < 900 px: top bar 2 baris, viewport 48vh, tab [Kontrol | Grafik | Alur], kualitas default Rendah.

**Kontrol**
- Skenario.
- ▶/⏸, ⏭ +1 hari, ↺.
- Kecepatan: 6 jam, 1 hari, 3 hari, 1 minggu, atau 1 bulan per detik.
- Pengali hujan / slider Manual.
- Pintu air: Manual/Otomatis, stoplog [−] n [+], pintu klep, target otomatis.
- Lahan: kubah gambut `Hd` 0–1,0 m, parit lapangan, K, titik penaatan.
- Tampilan: eksagerasi, label, irisan, partikel, kualitas.

**KPI**
- Curah hujan, TMAT (di titik penaatan dan rata-rata), TMAS + papan duga + mercu, pembuangan (m³/s, L/s, mm/hari, arah, terendam).
- Dua badge: **Kategori perusahaan** (Banjir … Kering, dengan ikon dan warna) dan **Kewajiban PP 57/2016 (≤ 40 cm)** (Patuh/Tidak patuh, % hari, rentetan).
- Risiko kebakaran dan subsidensi.
- Log aksi pintu air.

**Grafik** (Canvas 2D buatan sendiri di `chart.js`, tanpa library)
- 3 panel dengan sumbu hari bersama:
  1. Hujan (batang menggantung dari atas).
  2. Muka air: P1–P4, TMAS, dan garis mercu.
     - Latar pita tipis untuk 6 kategori perusahaan; pita "Normal" (−45…−60) ditonjolkan.
     - Garis putus merah "Batas PP 57/2016 (−40 cm)" dan garis permukaan 0.
  3. Pembuangan dalam mm/hari.
- Playhead, crosshair, dan legenda yang bisa diklik.
- Tab Tabel + tombol "Unduh CSV".

**Alur hubungan** (`flow.js`, SVG)
- Node: Hujan → Air tanah/TMAT (→ ET) → Saluran/TMAS → Pintu air → Sungai.
- Lebar panah sebanding dengan fluks.
- Baris neraca: "Hujan − ET − Pembuangan = ΔSimpanan (residu)".
- Kalimat naratif di region `aria-live`.

**Tab Persamaan & Perhitungan** (`js/ui/equations/`, masukan user "agar lebih saintifik")

*Sub-menu:* sidebar di desktop, `<select>` di ponsel. Isinya:
1. **Ringkasan & neraca air:**
   - Persamaan neraca blok: `ΔS = P − ET − Q·86400/A`.
   - Tabel neraca harian (mm) dengan residu.
2. **Curah hujan & ET:**
   - Rantai Markov (p01, p11), sebaran Weibull, dan skala bulanan.
   - Disagregasi per jam.
   - Faktor β(ζ) untuk ET.
3. **Sifat gambut:**
   - Persamaan `Sy(ζ)`, `K(ζ)`, `T(ζ)`, dan `W(z)`.
   - Grafik mini profil terhadap kedalaman, dengan penanda kondisi saat ini per piezometer.
4. **Permukaan berkubah:** `zs(x)`, kedalaman lokal `ζ = zs − z`, dan tebal gambut lokal.
5. **Aliran air tanah:**
   - Dupuit–Boussinesq 1D: `Sy ∂z/∂t = ∂/∂x(T ∂z/∂x) + P − ET − f`.
   - Bentuk diskret volume-hingga.
   - Fluks Darcy ke kanal `qb`.
   - Tabel langsung per piezometer: `zs`, `z`, `ζ`, `Sy`, `T`, `q`, dan `dz/dt`.
6. **Parit lapangan:** pendekatan tipe Hooghoudt `f = 12·T·Δ/s²`.
7. **Neraca kanal & TMAS:**
   - Volume prisma trapesium `V(h)`.
   - `dVc/dt` beserta tiap sukunya (angka saat ini).
   - Penyelesaian implisit h dengan bisection.
8. **Pintu air & pembuangan:**
   - `Q = Cw·Lw·H^1,5·S(H2/H1)`, faktor Villemonte, dan mercu = ambang + 0,20·n.
   - Contoh substitusi langsung, misalnya "Q = 1,7 × 1,5 × 0,182^1,5 × 1,00 = 0,198 m³/s = 55,9 mm/hari".
   - Kurva rating Q–H dengan titik operasi saat ini.
9. **Numerik & stabilitas:**
   - Kriteria sub-step `Δt = C / max Λ_i` (Λ memuat suku aliran, parit lapangan, dan limpasan; sederhananya `dt ≤ 0,5·Sy·dx²/T`).
   - Jumlah sub-step jam terakhir.
   - Galat neraca massa kumulatif.
10. **Klasifikasi & kepatuhan:**
    - Tabel kategori perusahaan, aturan PP 57/2016, contoh kasus "Normal tetapi tidak patuh PP".
    - Indeks risiko kebakaran dan subsidensi (ditandai heuristik).
11. **Parameter & referensi:** tabel semua parameter (simbol, nilai, satuan, sumber), PP 71/2014 jo 57/2016, BMP RSPO, dan literatur gambut.

*Tiap bagian berisi:*
- Persamaan **MathML native**, dibangun dengan helper kecil `mathml.js`, tanpa library.
- Tabel simbol (simbol, arti, satuan, nilai saat ini).
- Blok "Perhitungan saat ini" yang diperbarui setiap langkah simulasi; tombol "Bekukan" untuk menahan angka.
- Pilihan piezometer (P1–P4) untuk perhitungan per sel.

*Sumber angka:*
- Semua angka berasal dari `explain()` atau fungsi model yang diekspor; UI hanya memformat.
- Grafik mini memakai primitif kanvas yang sama dengan `chart.js`.

**Tema**
- Warna didefinisikan sebagai token CSS di `:root`, dengan mode gelap lewat `prefers-color-scheme` / `[data-theme]`. Ini sesuai kontrak Artifact.
- Palet status selalu disertai ikon dan label, tidak hanya warna.

**Loop** (`main.js`)
- `stepper.tick` menghasilkan jumlah jam bulat (maks 240 per frame).
- `lerpSnapshot` menghaluskan nilai antar-langkah.
- Pembaruan: scene, KPI, dan label setiap frame; grafik per hari; Alur per langkah.
- Hook tes `window.wmApp` dan penanda `body.dataset.ready`.

## Struktur file
```
index.html  .nojekyll  .gitignore  package.json  README.md (ID)  docs/desain.md
css/style.css
js/main.js
js/core/   config status view stepper store            (tanpa three/DOM → bisa dites di node)
js/model/  params peat canal rain scenarios indicators control engine index
js/scene/  index layout palette noise terrain surroundings section water palms instruments gate particles labels camera
js/ui/     strings.id format router controls kpi flow chart table tooltip about
js/ui/equations/  index mathml miniplot sections/{neraca,hujan-et,gambut,kubah,airtanah,parit,kanal,pintu-air,numerik,klasifikasi,parameter}.js
scripts/run-scenario.js      (CLI tabel harian untuk kalibrasi)
tests/unit/*.test.js   tests/e2e/helpers/{server,browser}.js   tests/e2e/smoke.e2e.js
```

**package.json**
- `type: module`; hanya devDependencies: `three@0.185.1` dan `playwright-core@1.56.1`.
- Script:
  - `start`: `python3 -m http.server 8000`
  - `test`: `node --test tests/unit`
  - `test:e2e`
  - `check`

## Milestone (setiap milestone bisa dijalankan, di-commit, dan di-push)

| M | Isi |
|---|---|
| **M0** | Kerangka: `index.html` + import map, scene placeholder, `package.json`, harness e2e (server Python, intercept CDN, flag SwiftShader, tangkap console, screenshot), `docs/desain.md`. |
| **M1** | Model (termasuk kubah `zs(x)`, kategori perusahaan + PP, `explain()`) + tes unit 1–9. Kalibrasi parameter **skenario** (bukan fisika) sampai tes kalibrasi lulus. Tulis `scripts/run-scenario.js`. |
| **M2** | Aplikasi 2D: `core/*`, router + `ui/*` (kontrol, KPI, Alur, grafik, tabel) dijalankan di atas scene placeholder. |
| **M2b** | Tab **Persamaan & Perhitungan**: 11 bagian, MathML, perhitungan langsung, grafik mini. |
| **M3** | Scene statis: terrain berkubah + mikro-relief, piringan/pasar pikul/jalan, blok tetangga, sungai/hutan, penampang, saluran, sawit detail + LOD, instrumen, pintu air, label, kamera, eksagerasi vertikal. |
| **M4** | Pengikatan dinamis: muka air, genangan, kolom piezometer, papan duga, animasi stoplog + nappe, hujan/aliran/rembesan, warna status, picking/tooltip. |
| **M5** | Polishing: layout ponsel, a11y, reduced-motion, kualitas, tab "Tentang Model", README lengkap. Jalankan `npm run check`, lalu terbitkan Artifact. |

**Cara eksekusi (ultracode)**
- M0–M1 dikerjakan berurutan.
- Setelah kontrak snapshot, `explain()`, dan API engine terkunci, tiga bagian dikerjakan paralel oleh agen workflow di direktori terpisah:
  - M2 (UI),
  - M2b (Persamaan),
  - M3–M4 (scene).
- Lalu workflow review adversarial (domain hidrologi, kebenaran persamaan vs kode, visual/a11y), dilanjutkan perbaikan.

## Verifikasi

**Tes unit** (`node --test`)
1. **peat:** round-trip W↔z sampai 1e-10, dW/dz = Sy, T monoton.
2. **weir:** Q(H = 0,2) = 0,22807, aliran terendam lebih kecil dari aliran bebas, monoton, antisimetris, pintu klep.
3. **solve kanal:** level turun monoton dan tidak di bawah mercu; volume konsisten.
4. **rain:** deterministik per seed; jumlah per jam = harian; total bulanan tepat; urutan kemarau < normal < hujan; maks ekstrem = 170.
5. **neraca massa:** semua skenario, langkah 1 jam dan 24 jam, termasuk mode otomatis: residu relatif < 1e-9 dan `clamp === 0`.
6. **respons:**
   - Hujan lebih banyak → TMAT dan TMAS lebih dangkal, ΣQ lebih besar.
   - Mercu lebih tinggi → lebih basah.
   - Kanal tinggi → mengisi gambut.
   - Parit lapangan dimatikan → lebih basah.
7. **kalibrasi skenario dan mode otomatis:**
   - Kemarau: P3 > 40, kepatuhan PP < 50%.
   - Ekstrem: puncak Q di hari 14–19, genangan, dan pulih sebelum hari 40.
8. **stabilitas:**
   - Ks = 1000 dengan hujan 300 mm/hari tetap stabil.
   - Steady-state analitik `b² = b0² + (R/K)(2Lh·x − x²)` (dengan `Hd = 0`) cocok dalam 1 cm.
   - Langkah 1 jam vs 24 jam: selisih < 2 cm.
9. **indikator:**
   - Kategori perusahaan: −0,01 → Banjir; 0 dan 40 → Tergenang; 40,01 dan 45 → Agak Tergenang; 45,01 dan 60 → Normal; 60,01 dan 65 → Agak Kering; 65,01 → Kering.
   - PP: 40 → patuh; 40,01 → tidak patuh.
   - `cmykToHex` untuk keenam kelas:
     - K100 → `#000000`
     - C65 M42 Y0 K23 → `#4572C4`
     - C100 M20 → `#00CCFF`
     - C19 M0 Y59 K62 → `#4E6128`
     - Y60 → `#FFFF66`
     - M100 Y100 → `#FF0000`
   - Contoh 50 cm → "Normal" tetapi tidak patuh PP.
10. **kubah:**
    - `Hd = 0` menghasilkan hasil yang identik dengan permukaan datar.
    - Dengan `Hd = 0,5`, neraca massa tetap tertutup.
    - Kedalaman lokal = `zs − z` di setiap piezometer.
    - Genangan hanya terjadi di sel dengan `z > zs`.
11. **explain/persamaan:**
    - `explain()` konsisten dengan engine: Q dari `weirQ(H1, H2)` sama dengan `snapshot.structure.q_m3s`, dan Σ suku neraca kanal = dVc/dt.
    - Setiap bagian tab Persamaan menghasilkan elemen `<math>` dan tidak memakai rumus lokal (diperiksa di tes arsitektur: `js/ui/equations/**` hanya mengimpor model, tanpa aritmetika fisika).
12. **core:** `view`/`stepper`/`store`.
13. **arsitektur:**
    - Import map memakai `three@0.185.1`.
    - `model/` dan `core/` tidak memuat three, DOM, `Math.random`, atau `Date`.
    - `ui/` tidak mengimpor three.
    - Tidak ada path absolut.
    - Dua run identik menghasilkan output yang sama persis.

**Smoke test e2e** (Playwright + Chromium headless + SwiftShader)
- Python `http.server` di port bebas. `context.route` melayani `cdn.jsdelivr.net/npm/three@0.185.1/*` dari `node_modules/three`; request eksternal lain diblokir.
- Cek 1 — halaman siap: `data-ready`, WebGL2 aktif, `calls > 0`, tidak ada error/warning console, tidak ada request eksternal.
- Cek 2 — kemarau 60 hari: P3 > 40, badge PP "Tidak patuh", dan badge perusahaan "Kering"/"Agak Kering".
- Cek 3 — puncak Q skenario ekstrem lebih besar daripada normal.
- Cek 4 — stoplog [+] dua kali membuat TMAS lebih dangkal.
- Cek 5 — tombol play/pause berfungsi.
- Cek 6 — buka `#/persamaan/pintu-air`:
  - ada elemen `<math>`;
  - angka Q pada "Perhitungan saat ini" sama dengan KPI;
  - setelah `stepDays(1)`, angkanya berubah.
  - Kembali ke `#/sim`: canvas tetap merender.
- Cek 7 — semua 11 sub-menu terbuka tanpa error console.
- Screenshot:
  - desktop 1280×800 dan ponsel 390×844;
  - preset Penampang dan close-up sawit/terrain;
  - satu per skenario;
  - tab Persamaan (desktop dan ponsel).
  - Disimpan ke `test-results/screenshots/` lalu diperiksa visual dengan Read.

**Cek manual dari screenshot**
- Kolom air piezometer sejajar dengan garis muka air tanah di penampang.
- Jumlah papan sesuai label mercu.
- Nappe muncul hanya bila head > 0.
- Genangan muncul pada skenario ekstrem, mulai dari bagian rendah dekat saluran.
- Blok jelas tidak datar: kubah, mikro-relief, piringan, dan pasar pikul terlihat.
- Sawit terlihat realistis: pelepah melengkung dan tandan. Blok tetangga mengisi pandangan.
- Persamaan MathML terbaca rapi di tema terang dan gelap.
- KPI, grafik, dan 3D menunjukkan nilai yang sama.
- Path relatif tetap jalan saat dilayani dari subpath.

## Delivery
- Satu commit per milestone di `claude/zealous-hawking-qtf0t8`, push dengan `git push -u origin claude/zealous-hawking-qtf0t8` (retry backoff hanya bila gagal karena jaringan).
- Tidak membuat PR kecuali diminta.
- GitHub Pages: Settings → Pages → branch, root. README menyertakan contoh `pages.yml` tanpa menambahkan workflow.
- Screenshot akhir dikirim dengan SendUserFile.
- **Artifact:**
  - Muat skill `artifact-design` terlebih dahulu.
  - Terbitkan aplikasi sebagai Artifact multi-file: `index.html` + `files` untuk css/js, dengan import map jsDelivr yang versinya tepat (diizinkan oleh kontrak Artifact).
  - Bila CSP Artifact memblokir import map, cukup kirim screenshot; jangan menambah bundler.

## Risiko / fakta yang belum terverifikasi
- **CDN tidak bisa diakses dari container ini.** Produksi bergantung pada jsDelivr, jadi pengguna dan GitHub Pages butuh internet. README mencatat opsi vendor offline.
- **Kategori perusahaan vs PP:** "Normal" perusahaan (46–60 cm) secara definisi tidak patuh PP (≤ 40 cm). Ini sengaja ditampilkan apa adanya sebagai dua badge. Batas kategori bisa diubah di satu tempat (`THRESHOLDS.tmat`).
- **Regulasi yang belum diverifikasi:**
  - aturan penempatan titik penaatan menurut P.15/2017 (karena itu P3 diberi label "asumsi");
  - status PP 71/2014 setelah PP 22/2021;
  - kelas hujan harian BMKG.
- **Parameter ilustratif:** K permukaan, kurva ET, respons sungai, kalibrasi subsidensi, dan besaran badai. Ini disebutkan di panel "Tentang model" sebagai model sintetis yang belum dikalibrasi dan **bukan untuk keputusan operasional**.
- **Keterbatasan model:**
  - satu TMAS untuk seluruh jaringan saluran;
  - transek 1D;
  - parit lapangan sebagai sub-grid;
  - blok digambar 400 m (aslinya 1 km);
  - ukuran instrumen dibesar-besarkan.
