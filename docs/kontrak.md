# Kontrak antarmodul (wajib dibaca sebelum mengubah kode)

Dokumen ini mengikat modul UI (`js/ui/`), tab Persamaan (`js/ui/equations/`), dan scene 3D (`js/scene/`)
ke lapisan yang sudah jadi: model (`js/model/`), core (`js/core/`), dan akar komposisi (`js/main.js`).
Acuan desain: `docs/rencana.md` (berlaku), detail di `docs/desain.md`.

## 1. Kepemilikan berkas

| Area | Berkas | Pemilik |
|---|---|---|
| Model hidrologi | `js/model/**` | **beku** (hanya dibaca). Butuh field baru? Tulis di laporan akhir. |
| Core | `js/core/**`, `js/main.js`, `js/ui/router.js`, `js/ui/format.js` | **beku** (hanya dibaca) |
| Tema & tata letak | `css/base.css`, `index.html` | **beku**; pakai token yang ada |
| UI simulasi | `js/ui/*.js` (kecuali router/format), `css/ui.css`, `js/ui/about.js` | agen UI |
| Tab Persamaan | `js/ui/equations/**`, `css/equations.css` | agen Persamaan |
| Scene 3D | `js/scene/**`, `css/scene.css` | agen Scene |
| Tes | `tests/unit/<area>.*.test.js`, `tests/e2e/<area>.e2e.js` | masing-masing agen, berkas sendiri |

Jangan menyunting berkas milik agen lain. `tests/e2e/smoke.e2e.js` dan `tests/e2e/helpers/**` beku.

## 2. Aturan umum

- ES modules murni, tanpa build, tanpa dependensi baru. Hanya `three` dan `three/addons/...` (import map).
  `js/ui/**` **tidak boleh** mengimpor three. `js/scene/**` tidak menyentuh DOM UI (selain kontainer viewport
  dan label CSS2D miliknya).
- Semua path relatif. Tidak ada `fetch` eksternal. Tidak ada `alert/confirm/prompt`, tidak ada unduhan berkas
  (pakai "Salin" ke clipboard dengan cadangan seleksi teks). `localStorage` hanya untuk preferensi, dibungkus try/catch.
- Teks UI Bahasa Indonesia. Angka lewat `js/ui/format.js` (`fmt`, `fmtElevCm`, `depthPhrase`, `fmtQ`, …).
- Muka air ditampilkan sebagai **elevasi bertanda relatif permukaan**: kedalaman 45 cm → "−45 cm". Jangan menulis
  "TMAT naik" (ambigu); tulis "muka air naik/turun".
- Warna dari token CSS di `css/base.css` (`var(--…)`), tema terang & gelap. Kategori TMAT memakai kelas
  `.st .st-<id>` dan `--st-<id>` (warna CMYK perusahaan) — selalu dengan ikon + label, tidak hanya warna.
  Di kanvas/three, ambil warna dari `TMAT_CLASSES[].color` (model) atau `getComputedStyle`.
- Font: `--font-display` (Archivo), `--font-body` (IBM Plex Sans), `--font-data` (IBM Plex Mono, angka).
- Aksesibilitas: kontrol native berlabel, `id` stabil, fokus terlihat, `prefers-reduced-motion` dihormati.
- Lebar ponsel 390 px harus berfungsi tanpa scroll horizontal halaman.
- Tidak ada `console.warn`/`console.error` saat berjalan normal (tes e2e gagal bila ada).

## 3. Store (`js/core/store.js`)

`store.get()`, `store.set(partial)`, `store.patch(key, partial)`, `store.subscribe((state, prev) => …)`.

```js
{
  route: { view: 'sim' | 'persamaan' | 'tentang', section: null | '<id bagian persamaan>' },
  scenarioId: 'kemarau' | 'normal' | 'hujan' | 'ekstrem' | 'manual',
  playing: false,
  speedHps: 24,                      // jam simulasi per detik (lihat SPEEDS di core/config.js)
  rainScale: 1,                      // pengali hujan 0,5–1,5 (skenario)
  manual: { rainMmd: 20, etpMmd: 4, riverM: -2.0 },   // mode Manual: 0–200 mm/hari, 2–6 mm/hari, −3,0…−0,15 m
  gate: { mode: 'manual' | 'auto', nLogs: 7, flapGate: false, target: 'perusahaan' | 'pp' },
  land: { Hd: 0.2, fieldDrains: true, Ks: 50, tpId: 'P4' },     // P4 = tengah petak = titik penaatan bawaan
  view: { ve: 10, labels: true, cutaway: true, particles: true, quality: 'tinggi' | 'rendah', camera: 'ikhtisar' },
  eq: { piezometer: 'P4', frozen: false },             // milik tab Persamaan
  status: { finished: false, slow: false },            // diisi main.js
}
```

UI cukup mengubah store; `main.js` yang menerapkan ke model/scene. Mengubah `gate.nLogs` saat mode otomatis
tetap diizinkan (model akan menimpanya pada evaluasi harian berikutnya).

## 4. `actions` (dari main.js)

`play()`, `pause()`, `togglePlay()`, `stepDay()`, `stepHours(n)`, `reset()`, `setScenario(id)`, `setCamera(id)`,
`getModel()`, `getSnapshot()`, `getView()`, `dailySeries()`.

## 5. Snapshot model (`snapshot(m)`; `view` = snapshot terinterpolasi `lerpSnapshot`)

Contoh nyata (skenario `hujan`, hari 21, array dipotong):

```json
{"tDays":20.21,"hourIndex":485,"day":20,"hourOfDay":5,"dateLabel":"21 Okt","scenarioId":"hujan","scenarioLabel":"Musim hujan","scenarioDays":120,"finished":false,
 "forcing":{"rain_mmh":0,"rain24h_mm":16.9,"etp_mmd":3.5,"rainScale":1,"riverM":-1.537},
 "profile":{"x":"Float64Array(30) [2.5, 7.5, …]","zs":"Float64Array(30) permukaan (m)","z":"Float64Array(30) muka air tanah (m)","depthCm":"Float64Array(30)","ponded":"Uint8Array(30)","q":"Float64Array(31) fluks muka sel m²/hari, + ke arah kanal; q[0]=ke saluran","fd":"Float64Array(30) parit lapangan m/hari","peatBaseZ":-4,"fieldDrainDepth":0.9,"fieldDrains":true,"Lh":150,"Hd":0.2},
 "piezometers":[{"id":"P3","name":"P3","note":"titik penaatan (asumsi)","x":75,"surfaceM":0.15,"levelM":-0.176,"depthCm":32.6,
   "cls":{"id":"tergenang","label":"Tergenang","range":"0–40 cm","color":"#4572C4","ink":"#FFFFFF","icon":"▼","cmyk":[65,42,0,23]},"ppCompliant":true,"isTP":true}, "… P1, P2, P4"],
 "canal":{"levelM":-0.348,"tmasCm":34.8,"tmasCls":{"id":"tinggi","label":"Tinggi","color":"#7FB2E6","ink":"#000000","icon":"▽"},"gaugeReadingCm":-34.8,"volumeM3":5175.6,"overbank":false,"bankM":0},
 "structure":{"nLogs":8,"nMax":9,"plankM":0.2,"sillM":-2,"crestM":-0.4,"widthM":1.5,"headCm":5.2,"flapGate":false,"mode":"manual","q_m3s":0.0302,"q_Ls":30.2,"q_mmd":8.52,"submerged":false,"backflow":false,"riverAboveCrest":false},
 "river":{"levelM":-1.537},"ponding":{"maxCm":0,"areaFrac":0},
 "today":{"rain_mm":16.9,"et_mm":3.5,"out_mm":8.12,"dS_mm":5.27,"residual_mm":0,"hours":24},
 "ind":{"meanDepthCm":31.9,"tpId":"P3","tpDepthCm":32.6,"cls":{"…":"kategori perusahaan di titik penaatan"},"meanCls":{},
   "pp":{"now":true,"limitCm":40,"lastDayMeanCm":33.9,"lastDayCompliant":true,"daysCounted":20,"compliantDays":6,"pctDays":30,"streak":0,"longestStreak":14},
   "fire":{"index":0,"cls":{"id":"rendah","label":"Rendah","color":"#2E8B57"},"drySpellDays":0},"subs":{"rate":3.67,"cumCm":0.21}},
 "balance":{"in":44539.7,"out":41745.1,"dS":2794.7,"residual":0,"relError":0,"cum":{"rainBlock":0,"rainCanal":0,"et":0,"evapCanal":0,"outWeir":0,"backflow":0,"clamp":0,"boundary":0}},
 "control":{"mode":"manual","target":"perusahaan","tpId":"P3","lastAction":null,"log":[{"day":12,"dateLabel":"13 Okt","type":"kurangi|tambah|darurat|tahan|manual","text":"…","from":8,"to":7,"auto":true}]},
 "substepsLastHour":1}
```

Catatan nilai bawaan terbaru: stoplog 7 (mercu −0,6 m), Ks 50, titik penaatan **P4** (`isTP`), `ind.pp.basis` = "rata-rata harian di titik penaatan (asumsi model)";
log kontrol bisa berisi `type: 'jenuh'` (target tidak tercapai di stoplog maksimum) dan membawa `riverM`/`canalM`.
`explain().cell` juga memuat `piezometerId`, `piezometerX`, `piezometerDepthCm` (interpolasi, sama dengan KPI).

Konvensi: z = 0 di tanggul saluran koleksi, positif ke atas. `depthCm` positif ke bawah (negatif = banjir).
`tmasCm` = cm di bawah tanggul (≤ 0 = meluap). Kategori TMAT: `cls.id ∈ {banjir, tergenang, agak-tergenang,
normal, agak-kering, kering}`. Kewajiban PP 57/2016: patuh bila ≤ 40 cm (`ind.pp`).

## 6. Fungsi model lain (impor dari `js/model/index.js`)

- `dailySeries(m)` → `{n, scenarioDays, startMonth, piezometerIds, tpId, day[], dateLabel[], rain_mm[], etp_mm[],
  depthCm:{P1:[],…}, tpDepthCm[], meanDepthCm[], tmasCm[], q_m3s[], q_mmd[], out_mm[], crestM[], nLogs[], riverM[],
  pondedHours[], maxPondCm[], ppCompliant[], partial[]}` (hari terakhir bisa parsial).
- `explain(m, {piezometer:'P3'} | {cell:i})` → besaran antara (sumber tunggal angka tab Persamaan):
  `forcing{P_mmd, ETp_mmd, rain_mmh, rainScale}`, `geometry{N, dx, Lh, Lb, Hd, zBase, zBank, Ablock, Acp, Atot, cellArea, segments[]}`,
  `cells{x, zs, z, zeta, Sy, T, et, f, r, qf}` (Float64Array),
  `cell{i, x, zs, z, zeta, D, W, Sy, K, T, Tleft, Tright, zLeft, zRight, qLeft, qRight, lateral, P, ET, beta, f, fdActive, fdSpacing, fdBed, fdLevel, fdTm, r, net, dzdt}` (m, m/hari, m²/hari),
  `canal{h, hcs, V, Aw, Tb, Tc, qb, Eow, terms{rain, evap, seepage, drains, runoff, weir} (m³/hari), net, fixed}`,
  `weir{H1, H2, Hup, ratio, S, Q, forward, submerged, flapBlocked, Cw, Lw, crest, hc, hr, nLogs, sill, plank, flapGate}`,
  `numerics{C, canalCoupling, dtGw, dtC, dt, lamMax, substepsLastHour}` (hari), `balance{…}`, `params`.
- `peatCurves(m, {n, maxDepth})` → `{depth[], Sy[], K[], T[], W[], beta[], D}`; `ratingCurve(m)` → `{H[], Q[], crest}`.
- Fungsi murni: `specificYield, conductivity, transmissivity, storageFromDepth, etBeta, weirQ, weirDetail, villemonte,
  crestLevel, canalVolume, canalWetArea, surfaceAt, classifyTmat, classifyTmas, ppCompliant, fireRiskIndex,
  subsidenceRate, cmykToHex, autoGateDecision`.
- Konstanta: `DEFAULT_PARAMS`, `PARAM_META`, `SCENARIOS`, `SCENARIO_IDS`, `TMAT_CLASSES`, `TMAS_CLASSES`, `FIRE_CLASSES`,
  `THRESHOLDS`, `PP_LIMIT_CM`, `CONTROL_TARGETS`, `CONTROL_RULES`, `ETP_DIURNAL`, `MONTH_NAMES_ID`.

## 7. Antarmuka UI (`js/ui/index.js`)

```js
export function createUI({ store, actions, meta, roots }) → {
  onFrame(view),            // tiap frame: jam, KPI, playhead grafik (hemat: tulis DOM hanya bila teks berubah)
  onStep(snapshot),         // setelah model maju ≥ 1 jam atau kontrol berubah: badge, log, Alur
  onDay(series),            // hari berganti / parameter berubah: gambar ulang grafik & tabel
  onReset(snapshot, series),// model dibangun ulang
  onPick?(info),            // klik objek 3D: {type:'piezometer'|'gauge'|'gate'|'section', id?, screenX, screenY}
}
```
`roots = {simBar, left, right, bottom, mobileTabs, viewport}`; `meta` = lihat `main.js`
(scenarios, speeds, ve, cameras, quality, paramMeta, piezometers, weir, tmatClasses, tmasClasses, controlTargets, eqSections).

Elemen yang dipakai tes e2e (wajib ada, id persis):
`#skenario` (select, nilai = id skenario termasuk `manual`), `#btn-play`, `#btn-step`, `#btn-reset`, `#kecepatan`,
`#clock`, `#stoplog-minus`, `#stoplog-plus`, `#stoplog-count`, `#gate-mode` (select manual/auto),
`[data-kpi="tmat"]`, `[data-kpi="tmas"]`, `[data-kpi="q"]` (berisi teks `fmtQ(q_m3s)`, mis. "0,030 m³/s"),
`[data-kpi="rain"]`, `[data-badge="perusahaan"]` (berisi label kategori), `[data-badge="pp"]` (berisi "Patuh"
atau "Tidak patuh"), `#chart` (kanvas grafik), `#alur` (diagram Alur).
Tombol kamera: `[data-camera="<id>"]` → `actions.setCamera(id)`.

## 8. Antarmuka tab Persamaan (`js/ui/equations/index.js`)

```js
export function createEquations(root, { store, actions, meta }) → {
  show(sectionId), // tampilkan bagian; root berisi sub-menu #eq-nav + konten
  hide(),
  onStep(snapshot), // perbarui angka "Perhitungan saat ini" (kecuali store.eq.frozen)
}
```
Id bagian = `meta.eqSections` (`neraca, hujan-et, gambut, kubah, airtanah, parit, kanal, pintu-air, numerik,
klasifikasi, parameter`), hash `#persamaan.<id>`. Elemen untuk tes: `#eq-nav`, `[data-eq-section="<id>"]`,
`[data-eq-value="weir-q"]` (teks `fmtQ(weir.Q)` sama dengan KPI), `#eq-freeze`, `#eq-piezometer`.
Ambil model dengan `actions.getModel()`; semua angka dari `explain()`/fungsi model, UI hanya memformat.

## 9. Antarmuka scene (`js/scene/index.js`)

```js
export function createScene(container, { params, options, onPick }) → {
  canvas,                         // elemen <canvas> renderer
  frame(view, dtSec, playing, force), // perbarui animasi & render bila perlu (render on-demand saat jeda)
  render(), resize(),
  setOptions(viewOptions),        // {ve, labels, cutaway, particles, quality, camera}
  setCamera(id, {instant}?),      // 'ikhtisar' | 'penampang' | 'pintu-air' | 'atas'
  rebuild(params),                // geometri berubah (Hd, parit lapangan)
  renderInfo() → {webgl2, calls, triangles},
  dispose(),
}
```
Lempar Error bila WebGL2 tidak tersedia (main.js menampilkan `#webgl-fallback`).
