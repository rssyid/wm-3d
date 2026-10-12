# Desain detail (hasil workflow desain)

> **Catatan:** dokumen ini adalah spesifikasi detail hasil sintesis workflow desain. Bila ada yang
> bertentangan dengan `docs/rencana.md` (rencana yang disetujui user), **`docs/rencana.md` yang berlaku**.
> Perubahan dari user setelah sintesis: kategori TMAT perusahaan (Banjir/Tergenang/Agak Tergenang/Normal/
> Agak Kering/Kering, warna CMYK), badge RSPO diganti badge kategori perusahaan, permukaan gambut berkubah
> (zs(x)), terrain tidak datar + sawit detail, dan tab "Persamaan & Perhitungan".
> Kalibrasi M1 mengubah default: stoplog 8 (mercu −0,4 m), Hd 0,2 m, sungai gR 0,04 / zRMax −0,15 m, ETp kemarau 4,5;
> aturan otomatis: stoplog maks aman 8, target PP [15,37] pada titik penaatan (lihat docs/rencana.md "Catatan kalibrasi").

## Context

The task is a static web app, with no build step, that shows how water moves through one oil-palm block on deep peat (gambut). The causal chain it must make visible:

**curah hujan** → peat storage (**TMAT**, read by piezometers) → seepage and field drains → collection drain and main canal (**TMAS**, read on the papan duga) → stoplog **pintu air** → **pembuangan** (discharge) to the river.

- **Model and view:** a deterministic synthetic process model drives a Three.js diorama, together with a Bahasa Indonesia dashboard (KPIs, charts and an "Alur hubungan" flow diagram).
- **Repo state:** `/home/user/wm-3d` has no commits. Branch is `claude/zealous-hawking-qtf0t8`, origin is `https://github.com/rssyid/wm-3d`.
- **GitHub Pages:** the site will be served under `/wm-3d/`, so every path must be relative.

**Facts verified in this container (read-only):**
- **three.js versions:** `three` latest is 0.186.1 (2026-09-24). 0.186.1 ships **no** `.min.js` builds. **0.185.1 does ship them:** `build/three.module.min.js` (about 366 KB) imports `./three.core.min.js` (about 385 KB).
  - Both versions have `examples/jsm/{controls/OrbitControls,renderers/CSS2DRenderer,utils/BufferGeometryUtils}.js`.
  - The addons import the bare specifier `'three'`.
- **Network:** `cdn.jsdelivr.net`, unpkg and esm.sh are blocked by the egress proxy (connect rejected or 403). `registry.npmjs.org` is reachable.
- **Tooling:** Node is v22.22.0 and Python is 3.13 (serves `.js` as `text/javascript`).
- **Playwright:** 1.56.1 is installed globally at `/opt/node-tools/node_modules/{playwright,playwright-core}`. The browsers `chromium-1194` and `chromium_headless_shell-1194` are in `/opt/pw-browsers`, which matches that version.
  - Playwright adds `--enable-unsafe-swiftshader` only on macOS, so it must be passed explicitly here.
  - ESM `import('playwright')` of the global copy fails, because `NODE_PATH` is ignored for ESM. `createRequire(import.meta.url)('playwright')` works.
  - **Headless WebGL2 has not been proven yet.** M0 has to prove it.

**How the three section drafts were reconciled:**

| Topic | Decision |
|---|---|
| three.js version | **0.185.1** (has the min builds), not 0.186.1. |
| How three.js is loaded | CDN import map in production. Tests intercept the CDN and serve from `node_modules/three`. Vendoring is not used (it would contradict decision 1). |
| Model location | The model lives in `js/model/` and uses the physics of the hydrology section. The architecture section's simpler model is dropped. |
| Gate geometry | Comes from the model: sill −2.0 m, 0.20 m planks, 0–9 planks, default 7 planks (crest −0.6 m; final calibration), bay width 1.5 m. The catchment is the block itself (30.6 ha). |
| Piezometers | 4 piezometers on one half-transect. The titik penaatan is P4 (block centre, per P.15/2017 summaries) — updated after review. |
| Papan duga | Zero at the bank. |
| River | Rises with an exponential moving average (EMA) of rain, capped at −0.15 m (gR 0.04) — updated after calibration. |
| Field drains | Modelled and drawn. |
| Display of water levels | Signed elevation in cm relative to the peat surface (negative = below), e.g. "TMAT −45 cm (45 cm di bawah permukaan)". |

## Keputusan (decisions already made)

1. Three.js with **no build step**: plain HTML, ES modules, and an import map pinned to `three@0.185.1` on jsDelivr. It runs from `python3 -m http.server` and on GitHub Pages.
2. Data: a synthetic, seeded process model. 4 scenarios (`kemarau`, `normal`, `hujan`, `ekstrem`) plus a "Manual" mode with sliders. No CSV import.
3. Land type is peat.
   - Regulation: PP 71/2014 jo PP 57/2016, Pasal 23(3)a. Peat counts as damaged when TMAT is **> 0.4 m** below the surface at the titik penaatan, so exactly 40 cm is still compliant.
   - RSPO BMP targets: TMAT 40–60 cm (piezometer), TMAS 50–70 cm below the bank (collection drain).
   - These two standards are always shown as **two separate badges**.
4. Scope is one block plus its outlet: palms, piezometers, collection drains, field drains, main drain, papan duga, stoplog pintu air to a river, and a soil cutaway.
5. All UI text is in Bahasa Indonesia, kept in `js/ui/strings.id.js`. Numbers are formatted with `Intl.NumberFormat('id-ID')`.

## Model hidrologi

All model code lives in `js/model/`. These modules are pure: no DOM, no `three`, no `Math.random`, no `Date`. Calendar labels come from a fixed table of month lengths and Indonesian month names.

### State variables, units, sign convention

- **Internal units:** days (d), m, m/d, m³. Conversions happen only at the API boundary (mm/jam, mm/hari, cm, L/s, m³/s).
- **Datum:** z = 0 at the peat surface. Up is positive. Bank `zBank = 0`.

| Symbol (code) | Meaning | Unit / sign |
|---|---|---|
| `W[i]` | storage of cell i relative to "water table at surface" | m; W > 0 means ponding depth |
| `z[i] = Zinv(W[i])` | water-table elevation | m, up positive |
| `depthCm = −100·z` | TMAT depth | cm, **positive downward**; < 0 means ponded. The UI shows elevation `−depthCm`. |
| `Vc`, `hc` | canal volume (one lumped store) and its level | m³, m |
| `tmasCm = 100·(zBank − hc)` | TMAS | cm below bank; ≤ 0 means meluap (overflowing) |
| `gaugeReadingCm = 100·(hc − gaugeZeroM)` | papan duga reading, with `gaugeZeroM = 0` | cm, negative below the zero, equals −TMAS |
| `hr`, `Er` | river level; rain EMA | m; mm/d |
| `nLogs`, `crest = zSill + plank·nLogs` | stoplog count and crest elevation | –, m |
| `Qw` | weir discharge | m³/s, + toward the river; − is **aliran balik** (backflow) |
| `cum.{rainBlock, rainCanal, et, evapCanal, outWeir, backflow, clamp}` | cumulative water volumes | m³ |

### Geometry and parameters (`params.js` → `DEFAULT_PARAMS`, frozen; `PARAM_META` gives the label, unit and min/max/step)

| Param | Default | Note |
|---|---|---|
| Block | 1000 m along the drains × 300 m = 30 ha. `Lh = 150`, `N = 30`, `dx = 5`, `x_i = (i+½)dx` from the drain bank. Node area 1 ha. | ⚠ Width is plausible only; 200 m blocks also exist. |
| Peat depth `D` | 4.0 m (base −4.0) | deep peat |
| Collection drains | 2 × 1000 m. Bed −1.6, bottom width 0.8, side slope 0.5 (top width 2.4) | Gurmit Singh 1983 (Better Crops) |
| Main drain | 300 m. Bed −2.2, bottom width 1.5, side slope 0.75 (top width 4.8) | same source |
| `Acp`, `Atot` | 6240 m², 306 240 m² | 1 mm ≈ 306 m³; 0.1 m³/s ≈ 28.2 mm/d |
| Field drains (parit lapangan) | `sFd = 59` m (every 8 rows), bed `zFd = −0.9`. They run perpendicular to the collection drains. `sFd = 0` turns them off. | Better Crops |
| Palms | triangular 8.5 m spacing, 160/ha, row spacing 7.36 m | |
| Peat hydraulics | `Sy_s .30`, `Sy_d .08`, `λS .6`; `Ks 50` (updated; forest ≈ 200), `Kd 1.0` m/d, `λK .25` | Ismail 2021; Baird 2017; Kurnianto 2019. ⚠ `Ks` is uncertain and exposed as an advanced slider (20–500). |
| ET | `ETp` comes from the scenario. β = 1 down to ζ = 0.4 m, linear to 0.3 at 1.2 m, and → 0 in the last 0.2 m above the peat base. Open-water evaporation `Eow = 1.1·ETp`. | ⚠ assumption |
| Surface runoff | `ks = 2` d⁻¹ | assumption |
| Weir | `zSill −2.0`, `Lw 1.5`, `plank 0.20`, `nMax 9`, **`nLogs 7` (crest −0.6)**, `Cw 1.7`, `flapGate false` | A crest of −0.6 matches the RSPO drain target (50–70 cm). |
| River | `zR0` per scenario, `gR 0.03` m/(mm/d), `τR 5` d, `zRMax −0.4` | ⚠ illustrative; the cap keeps the river below the bank |
| Piezometers | P1 x = 15 ("dekat kanal"), P2 x = 40, P3 x = 75, **P4 x = 150 ("tengah blok", titik penaatan bawaan)** | ⚠ P.15/2017 rules for siting the compliance point are not verified; it is configurable. |
| Numerics | `C = 0.5`, canal coupling factor 0.4, dt floor 1e-5 d, `spinUpDays 30` | |

### Equations (ζ = −z ≥ 0)

**Peat properties**
- Specific yield: `Sy(ζ) = Sy_d + (Sy_s − Sy_d)e^(−ζ/λS)`, and Sy = 1 when ponded.
- Storage:
  - `W(z) = z` for z ≥ 0.
  - Otherwise `W(z) = −[Sy_d ζ + (Sy_s−Sy_d)λS(1−e^(−ζ/λS))]`.
- `Zinv` (z from W): Newton iteration with a warm start, tolerance 1e-12, at most 50 iterations, bisection fallback.
- Conductivity: `K(ζ) = Kd + (Ks−Kd)e^(−ζ/λK)`.
- Transmissivity:
  - `T(z) = Kd(D−ζ) + (Ks−Kd)λK(e^(−ζ/λK) − e^(−D/λK))` for −D ≤ z ≤ 0.
  - `T(z>0) = T(0)`.
  - Checks: T(0) = 53.8, T(−0.3) = 18.7, T(−0.6) = 7.9, T(−1) = 3.9 m²/d.

**Groundwater (cell storage)**
- Cell balance: `dW_i/dt = P − ET_i − r_i − f_i + (q_{i+½} − q_{i−½})/dx`.
- Internal faces, positive toward the canal: `q_{i−½} = ½(T_i+T_{i−1})(z_i−z_{i−1})/dx`.
- Canal face:
  - `hcs = max(hc, zBedColl)`.
  - `qb = ½(T(z0)+T(min(hcs,0)))(z0−hcs)/(dx/2)`. A negative value means the canal recharges the peat.
- Divide (block centre): `q_{N−½} = 0`.

**Field drains (sub-grid sink)**
- `hFd = max(hc, zFd)`, `Δ = z_i − hFd`, `Tm = ½(T(z_i)+T(hFd))`.
- `f_i = 12·Tm·Δ/sFd²`. It applies when Δ > 0 (draining), or when Δ < 0 and hc > zFd (recharge from the canal). Otherwise f_i = 0.

**Ponding and overbank**
- `p = max(z_i, 0)`, `o = max(hc − zBank, 0)`.
- If p > o: `r_i = min(ks(p−o), (p−o)/dt)` (runoff to the canal).
- If o > p: `r_i = −ks(o−p)` (inundation from the canal).

**Canal store**
- Per segment j: `y = clamp(h−zb_j, 0, zBank−zb_j)`; `V_j = L_j(b_j y + m_j y²) + L_j B_j max(h−zBank, 0)`.
- Wetted area `Aw`.
- Balance: `dVc/dt = P·Acp − Eow·Aw + 2·Lb·qb + Σ(r_i+f_i)a_i − 86400·Qw`.

**Stoplog weir**
- `H1 = hc − crest`, `H2 = hr − crest`.
- If H1 ≤ 0 and H2 ≤ 0: Q = 0.
- If H1 ≥ H2: `Q = Cw·Lw·H1^1.5·S(H2/H1)`.
- Otherwise: `Q = −Cw·Lw·H2^1.5·S(H1/H2)`.
- Villemonte submergence factor: `S(r) = (1 − max(r,0)^1.5)^0.385`.
- With `flapGate`: Q = max(Q, 0).
- Q is monotone in hc, so the implicit solve has a unique root.
- Check: 0.26 m³/s (73 mm/d) needs H = 0.22 m.

**River**
- `dEr/dt = (P_mm/d − Er)/τR`.
- `hr = min(zR0 + gR·Er, zRMax)`.
- In Manual mode the slider "Muka air sungai" (−3.0 … −0.4 m) overrides hr.
- No tide and no pulse.

### Time step, stability and mass balance

**Time keeping**
- The outer step is **1 hour**, the forcing step.
- Time is an integer hour counter `k` plus an intra-step offset `τ`, so it does not drift in floating point.

**Substep size (recomputed every substep)**
- Per-node rate: `Λ_i = [(T₋+T₊)/dx² + 12Tm/sFd²·[fd active] + ks·[ponded or overbank]] / Sy_i`, using `2·Tb` for the canal face.
- Groundwater limit: `dt_gw = 0.5 / max Λ_i`.
- Canal-coupling limit: `dt_c = 0.4·Aw(hc) / (2Lb·2Tb/dx + Σa_i·12Tm/sFd²·[hc>zFd] + Σa_i·ks·[hc>zBank])`.
- `dt = min(dt_gw, dt_c, time left in the hour)`, floor 1e-5 d.
- Typical: 1–3 substeps per hour. The count is exposed as `substepsLastHour`.

**Substep order**
1. Update the river.
2. Compute `z` and `T` for every cell.
3. Compute face fluxes, ET, `r` and `fd`. The peat-base guard reduces ET first.
4. **Limit canal withdrawals.** Total withdrawals are `Eow·Aw + max(0,−2Lb·qb) + Σmax(0,−(r+fd))a`. Scale all of them by one factor ≤ 1 so they cannot exceed `Vc + dt·inflows`. Apply the same factor to the peat side and the canal side.
5. Apply `dW` to the cells.
6. Solve the canal level implicitly: `F(h) = V(h) − (Vc+Vin) + 86400·dt·Qw(h,hr)`, by bisection on `[zBedMain, zBank+5]`. If `F(zBedMain) > 0`, set h = zBedMain and book the shortfall to `cum.clamp`.
7. Update `Vc` from the booked fluxes, set `hc = Vinv(Vc)`, and split the weir volume into `outWeir` or `backflow` by its sign.

**Mass balance**
- `residual = (rainBlock + rainCanal + backflow) − (et + evapCanal + outWeir + clamp) − (S − S0)`, with `S = ΣW_i a_i + Vc`.
- Tests require `|res|/in < 1e-9` and `cum.clamp === 0`.

**Initial state and spin-up**
- Start with uniform z = −`init.tmatCm`/100, `hc = crest`, and `Er` = the scenario mean rain.
- Run 30 spin-up days taken from extra leading days of the same generator.
- Then reset `t`, the `cum` counters and `S0`. Tests may set `spinUpDays: 0`.

**Drainage capacity note:** without field drains the block can drain only about 0.5–1 mm/d, so the block centre ponds all wet season. With them it drains about 3–10 mm/d. The "Parit lapangan" toggle exists to show this.

### Scenarios (`rain.js`, `scenarios.js`)

**PRNG and daily rain**
- `mulberry32` exactly as in the hydrology draft. The hourly stream uses `mulberry32(seed ^ 0x9E3779B9)`.
- Daily occurrence: Markov chain with parameters p01/p11.
- Wet-day amount: `−μ·ln(1−u)`, capped at 250 mm. Draw exactly 2 uniforms per day.
- **Rescale the wet-day amounts so each calendar month hits its target exactly.** Apply design-storm overrides after rescaling.

**Hourly disaggregation**
- Draw exactly 2 uniforms per day.
- Storm duration by daily total: < 10 mm → 1–2 h; < 40 mm → 2–4 h; < 100 mm → 4–8 h; otherwise 8–16 h.
- Start hour: 13–18 when the total is < 40 mm, otherwise 0–23, clamped so the storm stays inside the day.
- Shape: triangular with the peak at ⅓ of the duration, renormalised so the hours sum to the daily total.
- ETp diurnal weights: `sin(π(h−6)/12)` for hours 06–18.

| id (label) | Days, start month | Seed | Rain | ETp mm/d | zR0 | Init | Calibration targets |
|---|---|---|---|---|---|---|---|
| `kemarau` (Kemarau panjang / El Niño) | 120, Jun | 1101 | p01 .12, p11 .35, about 42 mm/month | 4.8 | −2.4 | 45 cm, n = 7 | TMAT about 90–120 cm at the end; Q ≈ 0; fire risk ≥ Tinggi |
| `normal` (Tahun normal) | 365, Jan | 2202 | p01 .45, p11 .70; monthly [210,160,230,250,190,120,110,140,180,250,290,260] = 2390 | 3.6–4.5 by month | −2.2 | 45, n = 7 | about 40–55 cm in the wet season, 60–80 cm in Jun–Aug |
| `hujan` (Musim hujan) | 120, Oct | 3303 | p01 .50, p11 .75, about 300 mm/month | 3.5 | −2.0 | 50, n = 7 | about 20–45 cm, frequent Q |
| `ekstrem` (Hujan ekstrem 3 hari) | 45, Dec | 4404 | `hujan` base; days 14/15/16 = 110/170/70 mm | 3.5 | −2.0 | 45, n = 7 | Q peaks in days 14–19; TMAS < 25 cm or ponding; river reaches the cap (submerged weir); recession over 2–3 weeks |

- **Manual mode** (`manualForcing(getSliders)`) has three sliders:
  - Curah hujan 0–200 mm/hari, spread uniformly over the 24 hours. ⚠ This is a simplification.
  - ETp 2–6 mm/hari, with the diurnal shape.
  - Muka air sungai.
- **"Pengali hujan"** (rain multiplier, `rainScale` 0.5–1.5) scales a scenario's rain.
- When a scenario reaches its end, the run auto-pauses.

### Indicators and thresholds (`indicators.js` exports `THRESHOLDS`; `js/core/status.js` adds colour, icon and label)

**TMAT class** (d = depth in cm, positive downward)

| Class | Range |
|---|---|
| **Tergenang** | d ≤ 0 |
| **Terlalu basah** | 0 < d < 40 |
| **Optimal (RSPO)** | 40 ≤ d ≤ 60 |
| **Kering – risiko kebakaran & subsidensi meningkat** | 60 < d ≤ 100 |
| **Sangat kering – rawan kebakaran** | d > 100 (configurable, not regulatory) |

The UI also notes that Wösten et al. 2008 give 40 cm as the critical depth for fire and subsidence.

**PP 57/2016 compliance**
- **Patuh** means the daily-mean depth at the titik penaatan is ≤ 40.
- Report the current status, the % of compliant days, and the longest non-compliant streak.
- The UI explains that 41–60 cm is "Optimal RSPO" but "Tidak patuh PP".

**TMAS class** (cm below bank)

| Class | Range |
|---|---|
| Meluap | ≤ 0 |
| Siaga banjir | 0–30 |
| Tinggi | 30–50 |
| Optimal (RSPO) | 50–70 |
| Rendah | 70–100 |
| Sangat rendah | > 100 |

**Fire risk index (FRI)**, heuristic ⚠
- `FRI = 100·(0.7·clamp((d̄−40)/60, 0, 1) + 0.3·clamp(drySpell/21, 0, 1))`.
- d̄ = mean piezometer depth; drySpell = consecutive days with rain < 5 mm.
- Classes: < 25 Rendah, < 50 Sedang, < 75 Tinggi, otherwise Sangat tinggi.

**Subsidence**
- `S = 1.5 + 0.05·max(d̄₃₀, 0)` cm/yr, where d̄₃₀ is the 30-day running mean depth.
- This gives S(70) = 5.0 and S(40) = 3.5. ⚠ It is a calibration, not a published regression.
- The UI also shows cumulative subsidence. There is no feedback into the hydrology.

**Rain classes** (config only, ⚠ verify against BMKG)
- ringan < 20, sedang 20–50, lebat 50–100, sangat lebat 100–150, ekstrem > 150 mm/hari.

**Deferred to v2:** CO₂, sluice gate, tides, upstream inflow.

### Auto gate rule (`control.js`, evaluated once per sim day, mode `'auto'`)

```js
band = target==='PP' ? [20,40] : [40,60]; hyst = 5; minInterval = 2;   // dMean = 24h mean depth over piezometers
if ((tmas < 20 || ponded) && hr < hc - 0.05) { n = Math.max(0, n-2); log('DARURAT: buang air'); last = t; return; }
if ((tmas < 20 || ponded))                    { log('Sungai tinggi – stoplog ditahan'); return; }
if (t - last < minInterval) return;
if (dMean < band[0]-hyst && n > 0)            { n--; log('Kurangi 1 stoplog'); last = t; }
else if (dMean > band[1]+hyst && n < nMax)    { n++; log('Tambah 1 stoplog'); last = t; }
```

- Each action is emitted in `snapshot.control.lastAction`, which drives the 3D plank animation and the event log.
- Teaching point for `kemarau`: "menabung air sebelum kemarau" (store water before the dry season).

### Engine API (`engine.js`; `index.js` is the barrel)

**Functions**
- `createModel(params, {scenarioId|forcing, seed?, rainScale?, control?})`
- `advance(m, hours)` → snapshot
- `setControl(m, {nLogs, flapGate, mode, target, tpId})`
- `setParams(m, patch)`: keeps W and recomputes derived values (used for `Ks` and field drains).
- `setForcing(m, provider)`
- `snapshot(m)`
- `dailySeries(m)`
- `runScenario(id, overrides, {stepHours: 1|24, recordEvery})` → `{series, summary}`
- Test hook: `params.fixedCanalLevel`.

**Snapshot** (plain object, created once per frame):
```text
{ tDays, day, hour, dateLabel, scenarioDays,
  forcing:{rain_mmh, rain24h_mm, etp_mmd, riverM},
  profile:{x:Float64Array(N), z, q(faces, m²/d), fd, peatBaseZ, fieldDrainZ},
  piezometers:[{id,x,levelM,depthCm,cls,ppCompliant,isTP}],
  canal:{levelM,tmasCm,tmasCls,gaugeReadingCm,volumeM3,overbank},
  structure:{nLogs,crestM,headCm,flapGate,q_m3s,q_Ls,q_mmd,submerged,backflow},
  river:{levelM}, ponding:{maxCm,areaFrac},
  today:{rain_mm, et_mm, out_mm, dS_mm, residual_mm},            // for the Neraca row
  ind:{meanDepthCm, tpDepthCm, cls, pp:{now,pctDays,streak}, fire:{index,cls}, subs:{rate,cumCm}},
  balance:{in,out,dS,residual,relError}, control:{mode,target,lastAction,log[]}, substepsLastHour }
```

**History:** an hourly ring buffer of up to 8760 entries (t, P, ET, depth per piezometer, TMAS, Q, hr, crest). `dailySeries()` aggregates it for the charts.

## Scene 3D & visual mapping

**Conventions**
- 1 scene unit = 1 m. Y is up, and y = 0 is the peat surface.
- Block coordinates: X ∈ [−150, 150], with the collection drains at X = ±150. The model coordinate is `x = 150 − |X|`.

**Vertical exaggeration (VE)**
- Default ×10, slider 1–20.
- `hydroGroup.scale.y = VE` contains **only geometry at or below the datum**: terrain relief, soil section, channel prisms and water, river bed, the below-ground parts of pipes and gauges, and the gate sill, walls and planks.
- These stay at true height, placed on the surface: piezometer caps (+0.5 m), gauge head (+0.5), gate deck and handrail (+0.8), palms, labels and rain.
- `onVEChange()` repositions anchors and scales the camera target's y by the VE ratio.
- A corner stamp reads "Eksagerasi vertikal ×10", next to a 100 m scale bar.

**Layout**
- Diorama footprint: x ∈ [−170, 260], z ∈ [−245, 200].
- The block is truncated to 400 m along z (z ∈ [−200, 200]). The "Tentang model" panel states that the real block is 1 km long.

**Components**, under `js/scene/`; they read geometry from `params`:

1. **SceneManager** (`index.js`): `createScene(container, {params, palette, quality}) → {update(view, dt, playing), render(), resize(), setVE(), setCamera(preset), info(), dispose()}`.
   - Renderer: antialias; DPR clamped to 2 (1 on Rendah). `NoToneMapping`, sRGB output, `localClippingEnabled = true`.
   - Camera: PerspectiveCamera, FOV 45, near 0.5, far 4000.
   - OrbitControls: damping 0.08, `maxPolarAngle` 0.52π, distance 15–900, `maxTargetRadius` 320.
   - Lights: HemisphereLight plus a DirectionalLight with a 2048 `PCFShadowMap` shadow (Tinggi only).
   - Fog follows the camera–target distance: `near = 0.9·dist`, `far = dist·(3.0 − 1.6c)`, where c is cloudiness.
   - Timing: `THREE.Timer` connected to the document. **No `Clock` and no `PCFSoftShadowMap`**, both of which print warnings.
   - A ResizeObserver on the viewport element resizes both renderers.
2. **terrain.js**
   - One vertex-coloured mesh covering the block, the surround, the tanggul (embankments) and the river banks.
   - Micro-relief ±5 cm, seeded with `VISUAL_SEED = 7`.
   - "Wet darkening" ∝ `clamp(1 − d/60, 0, 1)`.
   - Clipped by `cutPlane` (z > 0 removed).
3. **section.js** (dynamic face at z = 0)
   - Soil layers: saprik 0 to −0.5, hemik −0.5 to −1.5, fibrik −1.5 to −D, mineral clay down to −5.5.
   - Notches for the collection drains, filled with water up to `hc`.
   - Saturated overlay (#4aa3ff, α 0.28, `depthWrite: false`) from z(x) down to the base.
   - Phreatic ribbon, a ▽ symbol at mid-block, and a depth ruler every 0.5 m.
   - CSS2D labels: "Zona tak jenuh", "Zona jenuh air", "Muka air tanah".
   - The other three sides are static layer faces.
4. **Seepage arrows**
   - An InstancedMesh of 12 cones at z = +0.05.
   - Length and direction come from `profile.q`; the direction flips when the canal recharges the peat.
5. **water.js**
   - Channel prisms (8-vertex trapezoids sized from the model's b, m and bed) for drains A and B, the main drain, the outfall, and 6 field drains at `z = ±29.5, ±88.5, ±147.5`. The section at z = 0 falls between two field drains.
   - River plane: centre x = 240, width 30, bed −4.0.
   - Groundwater/ponding sheet: a 60×4 plane with vertex y = z(x) and polygonOffset. The terrain hides it until it rises above the surface, where it shows as genangan (ponding).
6. **palms.js**
   - Trunk: 6-sided cylinder.
   - Crown: 12 bent fronds merged with `BufferGeometryUtils.mergeGeometries` (about 100 triangles).
   - 2 InstancedMeshes; triangular 8.5 m grid with a 6 m buffer from drains, about 1,600 instances; seeded colour jitter.
   - Cutaway: instances are sorted by z and `count = upperBound(0)`.
7. **instruments.js**
   - Piezometers P1–P4 at X = −135, −110, −75, 0 and z = −0.6. Each uses 3 InstancedMeshes:
     - pipe from −3.0 to 0 (α 0.35);
     - water column from −3.0 up to `levelM`;
     - unlit status ring.
   - Each has an unscaled cap. The TP piezometer gets an extra static outline ring, red when non-compliant.
   - Papan duga:
     - G2 on drain A at (−148.8, −0.6), the primary gauge for the section;
     - G1 at the gate (196, −222).
     - Board from −2.5 to 0 with a CanvasTexture of 128×1024 (`SRGBColorSpace`): E-marks every 5 cm, numbers every 10 cm, 0 at the bank, negative downward.
8. **gate.js**
   - One bay 1.5 m wide between wingwalls that fill the 4.8 m section, at x = 200, z = −225.
   - Plank stack of `nLogs`, 0.20 m each, with a 250 ms drop or lift tween.
   - The geometry follows the UI in Manual mode and `view.nLogs` in Otomatis mode.
   - Nappe ribbon (12 segments) shown when `headCm > 0.5` (with hysteresis); thickness ∝ head, texture scroll ∝ Q.
   - Badge "MANUAL" / "OTOMATIS". Warnings: "Air balik" when hr > crest, "Aliran balik ke kanal" when Q < 0.
9. **particles.js**
   - Rain: `LineSegments` updated in JS, ≤ 3,000 streaks (1,000 on Rendah), in a 420×420×120 box, z ≤ 0 while the cutaway is on.
   - Flow: Points (≤ 600) advected along the channel polylines.
10. **labels.js**: CSS2D labels as `<button>` elements, at most 12. Text is rewritten only when the formatted string changes.
11. **camera.js**: presets with a 0.8 s easeInOutCubic tween; instant under `prefers-reduced-motion`.
12. **Picking**: a Raycaster over pipes (`instanceId`), gauges, the gate and the section face. Hover shows a tooltip, click pins a detail card, and keyboard focus on a label does the same.

**Model variable → visual**

| Variable | Visual | Rule |
|---|---|---|
| `forcing.rain_mmh` | rain streak count and slant | `n = Nmax·sqrt(min(I,30)/30)`; 0 when I < 0.1 mm/jam |
| `forcing.rain24h_mm` | cloudiness `c = smoothstep(0, 60, R24)`, smoothed with τ 0.6 s | background #9ccbe8 → #4a535b; sun 2.2 → 0.5; fog |
| `profile.z[]` | ponding sheet, saturated fill, ribbon, ▽, terrain darkening | y = z (inside hydroGroup) |
| `profile.q[]` | seepage arrows | length ∝ \|q\| (clamped), sign gives direction |
| `piezometers[i].levelM`, `cls` | water column, ring colour, label "P3 · −47 cm" + icon | `statusOf()` |
| `canal.levelM` | all channel water tops, gauge waterline, section drain fill, flow y | y = hc |
| `structure.nLogs`, `crestM` | plank stack | crest = zSill + 0.2n |
| `structure.headCm`, `q_m3s` | nappe; flow speed and count | `v = 0.3 + 2.5·sqrt(Q/Qmax)` (visual only) |
| `river.levelM` | river plane | warnings as listed under gate.js |
| `ponding.maxCm` | (the sheet shows it automatically) | |

**Status palette** (always icon + label, never colour alone)

| Class | Colour |
|---|---|
| Tergenang | #256abf |
| Terlalu basah | #6da7ec |
| Optimal | #0ca30c |
| Kering | #fab219 |
| Sangat kering | #d03b3b |

- Chart series: TMAT #3987e5, TMAS #d95926, Q #199e70; non-emphasised piezometers #6b6a65.
- Dark chrome: page #0d0d0d, panels #1a1a19, ink #f0efec.
- Status marks use unlit `MeshBasicMaterial` with `toneMapped: false`, so they match the CSS legend.

**Camera presets** (at VE ×10; target y scales with VE). The cutaway is on at load.

| Preset | Position | Target | Notes |
|---|---|---|---|
| 1 Ikhtisar | (−260, 190, 300) | (10, −5, −40) | |
| 2 Penampang | (0, −12, 330) | (0, −0.3·D·VE, 0) | FOV 35; forces the cutaway on |
| 3 Pintu air | (255, 25, −160) | (200, −8, −225) | |
| 4 Atas | (0, 520, 1) | (0, 0, −20) | |

**Performance budget**
- ≤ 45 draw calls, ≤ 300k triangles, ≤ 3 ms JS per frame, no per-frame allocations in the scene.
- Render on demand while paused.
- No WebGL: show "Peramban Anda tidak mendukung WebGL". The model, KPIs, charts and Alur keep running.

## UI

**Layout, desktop (≥ 900 px)**
- CSS grid with areas `top / left view right / bottom`.
- Columns 280px / 1fr / 300px; top bar 56px; bottom 230px.

```
Simulasi Tata Air Kebun Sawit Gambut │ Skenario [Tahun normal▾] │ ↺ ⏭ ▶/⏸ │ [1 hari/detik▾] │ Hari 34/365 · 3 Feb
KONTROL │ [Ikhtisar][Penampang][Pintu air][Atas]            │ INDIKATOR + Alur hubungan
[Grafik][Tabel]  3 panel: hujan / muka air / pembuangan                      Unduh CSV
```

**Layout, below 900 px**
- Two-row top bar.
- Viewport 48vh.
- KPIs in a 2×2 grid.
- Bottom tabs [Kontrol | Grafik | Alur].
- Chart 170 px tall.
- Quality defaults to Rendah.

**Controls** (`controls.js`; native labelled inputs)

| Group | Controls |
|---|---|
| Skenario | Kemarau panjang / Tahun normal / Musim hujan / Hujan ekstrem / Manual |
| Simulation | play/pause, ⏭ +1 hari, ↺ reset; Kecepatan [6 jam/dtk, **1 hari/dtk (24)**, 3 hari/dtk, 1 minggu/dtk, 1 bulan/dtk (720)] in sim-hours per second |
| Hujan | Pengali hujan ×0,5–1,5. Manual mode: Curah hujan 0–200 mm/hari, ETp, Muka air sungai |
| Pintu air | [Manual\|Otomatis]; Stoplog [−] n [+] (0–9) → "mercu −60 cm"; ☐ Pintu klep; Target otomatis [RSPO 40–60 \| PP ≤40] |
| Lahan (lanjutan) | ☑ Parit lapangan; K permukaan; Titik penaatan [P1–P4] |
| Tampilan | Eksagerasi ×1–20; ☑ Label ☑ Irisan ☑ Partikel; Kualitas [Rendah\|Tinggi] |

**Control behaviour**
- Control changes take effect at the next hour step. Manual planks animate immediately.
- While paused, a hint reads "Tekan ▶ atau ⏭ untuk melihat respons air".
- Shortcuts: Space, →, R, C, Esc. They are ignored while focus is in an input, select or button.
- URL parameters: `?skenario=&seed=&ve=&cam=&autoplay=0`.

**KPIs** (`kpi.js`, rewritten only when the text changes)
- **Curah hujan:** today in mm, the class, and intensity in mm/jam.
- **TMAT:** at the titik penaatan and the average, e.g. "−47 cm (47 cm di bawah permukaan)", with class icon and label, and "Muka air naik/turun X cm/24 jam" where Δlevel = −Δdepth. The UI never says "TMAT naik".
- **TMAS:** "−35 cm" with class, papan duga reading, target 50–70, and crest with plank count.
- **Pembuangan:** m³/s, L/s and mm/hari, plus direction (pembuangan or aliran balik) and a "terendam" (submerged) flag.
- **Badges:** RSPO and PP 57/2016 (patuh/tidak patuh at P3 "asumsi", % of days, streak); Risiko kebakaran; Subsidensi (cm/th, cumulative).
- Event log of gate actions.

**Charts** (hand-rolled Canvas 2D in `chart.js`, about 350 LOC; no library to pin or intercept)
- Three stacked panels on a shared day axis:
  1. Curah hujan: daily bars hanging from the top, mm/hari, 56 px.
  2. Muka air: **signed elevation in cm relative to the peat surface**, domain [min(−120, floor), +20], 120 px.
     - Series: P1–P4 (the emphasised one in #3987e5), TMAS = −tmasCm, and a stepped crest line.
     - RSPO band −40…−60 "Target RSPO", a −40 line "Batas PP 57/2016 (0,4 m)", and a 0 line "Permukaan gambut".
  3. Pembuangan: area plus line in mm/hari, 50 px; the tooltip also shows m³/s.
- Rendering: the static layer is redrawn once per new day. A playhead and crosshair go on an overlay canvas.
- The legend is clickable to set emphasis.
- The Tabel tab holds the same data, plus "Unduh CSV".

**Alur hubungan** (`flow.js`, SVG with live values; delivered in M2)
```
Hujan → (infiltrasi) → Air tanah / TMAT ─→ ET (keluar)
  → (rembesan + parit lapangan) → Saluran / TMAS → (luapan di atas mercu, Q = Cw·L·h^1,5) → Pintu air → Sungai
  ⟲ Stoplog menahan TMAS → menahan muka air tanah
```
- Edge width ∝ flux in mm/hari (everything expressed over `Atot`). Animated dashes, static under reduced motion.
- **Neraca row**, taken from `snapshot.today` and never recomputed: "Hujan 63 − ET 4 − Pembuangan 12 = ΔSimpanan +47 mm (residu 0,000)".
- Narrative sentence in an `aria-live="polite"` region, sent only on class or regime changes.

**Frame loop** (`main.js`)
```js
renderer.setAnimationLoop(ts => { timer.update(ts); const dt = Math.min(timer.getDelta(), 0.25);
  if (playing) { const n = stepper.tick(dt, speedHps);          // whole hours, cap 240, backlog dropped -> "melambat"
    if (n > 0) { if (n > 1) advance(m, n - 1); prev = snapshot(m); next = advance(m, 1); newStep = true; } }
  lerpSnapshot(view, prev, next, playing ? stepper.frac : 1);  // js/core/view.js; discrete fields from next
  scene?.update(view, dt, playing); kpi.update(view); labels.update(view);
  if (newStep) { if (dayChanged) chart.redrawStatic(dailySeries(m)); flow.update(next); newStep = false; }
  chart.drawPlayhead(view.tDays); if (needsRender) scene?.render(); });
```

## Struktur file & dependensi

```
wm-3d/
├── index.html            # lang="id", data: favicon, import map, modulepreload ×2, layout shell, no-WebGL notice
├── .nojekyll  .gitignore (node_modules/ test-results/ *.log)  package.json  package-lock.json  README.md (ID)
├── css/style.css         # tokens, grid, breakpoints, KPI, badges, chart, flow, focus ring, reduced-motion
├── js/
│   ├── main.js           # composition root (only module with top-level DOM effects); window.wmApp
│   ├── core/             # no three, no DOM → node-testable
│   │   ├── config.js     # SPEEDS, MAX_STEPS_PER_FRAME=240, VE defaults, VISUAL_SEED, LAYOUT (X/Z coords), BMKG classes
│   │   ├── status.js     # statusOf(depthCm) → {cls,label,color,icon}; tmasStatus; uses model THRESHOLDS
│   │   ├── view.js       # createView(), lerpSnapshot(view, a, b, alpha)
│   │   ├── stepper.js    # createStepper({maxStepsPerFrame}) .tick(dtSec, simHoursPerSec) → n; .frac
│   │   └── store.js      # createStore(initial) {get,set,subscribe}
│   ├── model/            # pure: params peat canal rain scenarios indicators control engine index
│   ├── scene/            # three: index layout palette terrain section water palms instruments gate particles labels camera
│   └── ui/               # DOM, never three: strings.id format controls kpi flow chart table tooltip
├── scripts/run-scenario.js   # node CLI: daily table for calibration (node scripts/run-scenario.js kemarau)
└── tests/
    ├── unit/*.test.js
    └── e2e/helpers/{server.js,browser.js}  smoke.e2e.js
```

**Import map** (placed before any module or preload):
```html
<script type="importmap">{"imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/"}}</script>
<link rel="modulepreload" href="https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js">
<link rel="modulepreload" href="https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.core.min.js">
<script type="module" src="./js/main.js"></script>
```
- No `integrity` key.
- Addons used: `controls/OrbitControls.js`, `renderers/CSS2DRenderer.js`, `utils/BufferGeometryUtils.js`.
- The README documents an offline/vendor option but it is not implemented.

**package.json**
- `{"name":"wm-3d","private":true,"type":"module"}`
- scripts:
  - `start`: `python3 -m http.server 8000`
  - `test`: `node --test "tests/unit/**/*.test.js"`
  - `test:e2e`: `node --test --test-concurrency=1 "tests/e2e/**/*.e2e.js"`
  - `check`: `npm test && npm run test:e2e`
- devDependencies: `"three":"0.185.1"`, `"playwright-core":"1.56.1"`.
- Never run `playwright install`.

**Data flow**
- UI controls → store → `setControl`/`setParams`/`setForcing` on the model, applied at the next step.
- Stepper → `advance` → snapshot → `lerpSnapshot` → scene and KPIs/labels (every frame), chart (per day) and flow (per step).
- The UI never imports three, and the scene never touches the UI DOM.
- Test hook `window.wmApp = {ready, version, model, stepHours(n), stepDays(n), getSnapshot(), setScenario(id), renderInfo()→{webgl2,calls,triangles}, sampleColors()→distinct, renderOnce()}`.
- After the first frame, `body.dataset.ready = "1"`.

## Milestones

| M | Contents | Runnable result |
|---|---|---|
| **M0 De-risk** | `index.html` (import map), `main.js` with a ground plane, OrbitControls and an Indonesian header; `package.json`, `.gitignore`, `.nojekyll`, README stub; `architecture.test.js`; the full e2e harness (server, CDN interception, swiftshader flags, console capture, screenshot). Run `npm i && npm run check` and view the screenshot. | Proves that headless WebGL2 and the interception work. Commit and push. |
| **M1 Model** | `js/model/*` and unit tests 1–16; `scripts/run-scenario.js`. Tune the scenario parameters (not the physics) until the calibration tests pass. | `npm test` green; daily tables look plausible. Commit. |
| **M2 2D app** | `core/*`, `ui/*` (controls, KPI, **flow/Alur**, chart, table, strings, format), the loop over the placeholder scene; e2e checks 2–6. | A working dashboard that tells the whole causal story. Commit. |
| **M3 Static 3D** | `scene/layout`, terrain, section, water (static), palms, instruments, gate, labels, camera presets, VE split. | Screenshots reviewed. Commit. |
| **M4 Binding** | Water table, ponding, channel water, piezometer columns, gauges, plank tween, nappe, rain and flow particles, seepage arrows, status colours, picking and tooltips; per-scenario screenshots. | Commit. |
| **M5 Polish & deliver** | Phone layout, accessibility, reduced motion, quality select, "Tentang model", full README; final `npm run check`. | Send screenshots and push. |

## Verifikasi

**Unit tests** (`tests/unit/`, run with `node --test`, no runtime deps)

1. `model.peat.test.js`: round-trip W→Z→W to 1e-10 for z ∈ [−3.95, 0.5]; dW/dz equals Sy; T(−D) = 0; T monotone; Newton converges from a cold start.
2. `model.canal.test.js` (weir):
   - Free flow at H 0.2, L 1.5 gives Q = 0.22807 ± 1e-5.
   - Q = 0 at or below the crest and at equal levels.
   - Submerged flow < free flow.
   - Monotone in hc.
   - Antisymmetric without a flap gate; Q ≥ 0 with one.
3. `model.canal.test.js` (`solveCanalStep`): start at crest + 0.4 with no inflow, at dt = 1 d and 1 h. The level falls monotonically, stays ≥ the crest, and the released volume equals V0 − Vend.
4. `model.rain.test.js`:
   - Determinism by seed.
   - Hourly sums equal daily totals (1e-9).
   - Monthly totals equal their targets (1e-9).
   - Mean ordering kemarau < normal < hujan.
   - `ekstrem` daily maximum = 170.
5. `model.balance.test.js`: all 4 scenarios at both 1 h and 24 h steps, including auto mode and `fixedCanalLevel`: `|res|/in < 1e-9` and `cum.clamp === 0`.
6. `model.response.test.js`:
   - `normal` 120 d with rainScale 0.7 vs 1.3: more rain gives shallower depth at every piezometer, shallower TMAS, and more ΣQ.
   - n = 5 vs n = 8: the higher crest is wetter, with ΣQ(8) ≤ 1.01·ΣQ(5).
   - Fixed canal at −0.2 with the peat starting at −0.8: qb < 0 and z0 > z_{N−1}.
   - Turning field drains off gives a deeper ponding/wetness response in `hujan`.
7. `model.scenarios.test.js` (calibration tests; tune the scenarios, never loosen the bounds):
   - `kemarau`: all depths > 40, P4 > 60, FRI ≥ Tinggi, PP-compliant days < 50%, Q over the last 60 days ≈ 0.
   - `ekstrem`: peak Q ≥ 5× the pre-storm median within days [14, 19]; min TMAS < 25 or ponding > 0; hr ≤ zRMax at all times; Q < 2× the pre-storm level by day 40.
   - Auto control: `kemarau` starting at n = 5 ends at nMax and is shallower than manual; `hujan` starting at n = 9 lowers n and has fewer ponded days; no log is removed while hr ≥ hc − 0.05.
8. `model.stability.test.js`:
   - Ks = 1000, dx = 2, P = 300 mm/d for 5 days at a daily step: everything finite, Vc ≥ 0, depths non-increasing (1e-6), balance closes.
   - Analytic steady state (uniform K = 5, R = 1 mm/d, no field drains, canal fixed at −0.8, 1500 d): `b² = b0² + (R/K)(2Lh·x − x²)` within 1 cm (centre ≈ −0.161); qb = R·Lh within 1%.
   - Hourly vs daily step: mean depth within 2 cm, ΣQ within 10%.
   - C = 0.5 vs 0.1: within 0.5 cm.
9. `model.indicators.test.js`:
   - Depth 0 → tergenang; 40 → optimal and patuh; 40.01 → optimal, not patuh; 60.01 → kering; 100.01 → sangat kering.
   - TMAS edges.
   - S(70) = 5, S(40) = 3.5; FRI monotone.
10. `core.view.test.js`: `lerpSnapshot` takes discrete fields from b when alpha ≥ 0.5; `statusOf` covers every class; `format` gives "0,42".
11. `core.stepper.test.js` (counts, the 240 cap, backlog drop, frac) and `core.store.test.js` (subscribe, unsubscribe, prev).
12. `architecture.test.js`:
    - Import-map URLs contain `three@0.185.1` and equal the `node_modules/three` version (skip if not installed).
    - `js/model/**` and `js/core/**` contain no `three` import and no `\b(document|window|Math\.random|Date)\b`, checked with comments stripped.
    - `js/ui/**` has no `three` import.
    - No root-absolute paths.
    - Every relative import resolves to a file.
    - Every module except `main.js` can be imported in Node.
    - Two identical runs are `deepStrictEqual`.
    - The time of a 365-day hourly run is logged, not asserted.

**Headless smoke test** (`tests/e2e/smoke.e2e.js`)

*Server.* `helpers/server.js`:
- gets a free port with `net.listen(0)`;
- runs `python3 -m http.server <port> --bind 127.0.0.1 --directory <repo>`;
- polls until it returns 200, and kills it in `after()`.

*Browser.* `helpers/browser.js` loads Playwright in this order:
1. `import('playwright-core')` (local devDependency);
2. `createRequire(import.meta.url)('playwright')`;
3. `createRequire('/opt/node-tools/node_modules/')('playwright-core')`.

Launch:
```js
chromium.launch({ headless: true, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] })
// fallback: executablePath '/opt/pw-browsers/chromium'
```

Routing with `context.route('**/*')`:
- `^https://cdn\.jsdelivr\.net/npm/three@0\.185\.1/(.+)$` is fulfilled from `node_modules/three/$1` with `contentType: 'text/javascript'`. Playwright adds the CORS headers.
- Loopback and `data:` requests continue.
- Everything else is aborted and pushed to `external[]`.

Console capture:
- `pageerror`, `requestfailed` and console errors fail the test.
- Warnings fail it unless they match `/GPU stall due to ReadPixels|GL Driver Message|Automatic fallback to software WebGL/`.

*Checks.*
1. Load `/?autoplay=0` and wait for `body[data-ready="1"]` (20 s).
   - `renderInfo().webgl2 === true` and `calls > 0`.
   - `sampleColors() > 8`.
   - No WebGL notice is shown.
   - `external.length === 0`.
2. `selectOption('#skenario','kemarau')`, then `stepDays(60)`: P3 depth > 40, the PP badge contains "Tidak patuh", and the Q text matches `/\d,\d{2} m³\/s/`.
3. `ekstrem` vs `normal`, 30 days each: ekstrem has the higher peak Q.
4. Click stoplog [+] twice, then `stepDays(5)`: TMAS depth is smaller than in the control run.
5. Play: `tDays` advances within 1 s. Pause: it stays frozen.
6. Screenshots go to `test-results/screenshots/`: desktop 1280×800, phone 390×844, the Penampang preset, and one per scenario. Log frame time only.

**Manual checks** (view the screenshots with Read)
- The piezometer water columns line up with the phreatic line in the section.
- The plank count matches the crest label.
- The nappe appears only when the head is > 0.
- Ponding appears in `ekstrem`.
- At VE 1 and 20, the palms and hardware stay at true size.
- The KPI, chart and 3D values agree at the same moment.
- Badge wording: RSPO vs PP.
- Phone layout; reduced motion; keyboard focus on labels.
- No console warnings.
- Relative paths work under a subpath (serve the parent directory and open `/wm-3d/`).

## Delivery

**Git**
- One commit per milestone on `claude/zealous-hawking-qtf0t8`.
- Commit messages end with:
  - `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  - `Claude-Session: https://claude.ai/code/session_01UEios532WR8d8Wvqeitgx9`
- Push with `git push -u origin claude/zealous-hawking-qtf0t8`, retrying with 2/4/8/16 s backoff on network errors only.
- No PR unless asked. No `.github/workflows` in the push; the README holds a `pages.yml` snippet instead.

**GitHub Pages**
- Settings → Pages → Deploy from branch → `/ (root)`, with `.nojekyll`.
- URL: `https://rssyid.github.io/wm-3d/`.

**README (Bahasa Indonesia)**
- How to run: `python3 -m http.server 8000`; note that `file://` does not work.
- Controls and scenarios; the causal chain.
- Units and datum (TMAT and TMAS shown as −cm relative to the peat surface or bank; papan duga zero at the bank).
- References: PP 71/2014 jo 57/2016, P.15/2017, RSPO BMP.
- Assumptions and limits: synthetic and uncalibrated, not for operational decisions.
- Tests, deploy, offline/vendor note, three.js MIT licence.

**Artifact preview**
- Send the final desktop, phone and Penampang screenshots with SendUserFile.
- An Artifact preview only if the parent has a publish tool. It would use the same relative files and an exact-version jsDelivr import map. If the CSP blocks the import map or CDN, fall back to screenshots and do not add a bundler.

## Open risks / unverified facts

**Environment**
- **Headless WebGL2** under headless-shell with SwiftShader is unverified. M0 must prove it. If it fails, try `--use-gl=angle` or `headless: false` with the full `chromium-1194`. Otherwise, assert the no-WebGL fallback path and rely on manual review.
- The **CDN is unreachable from this container.** Production depends on jsDelivr. Users and Pages need internet access.
- Version choice: 0.185.1 is chosen over the newer 0.186.1 for its min builds. r185 deprecations (`Clock`, `PCFSoftShadowMap`) must be avoided, or the no-warnings check fails.

**Regulatory**
- Not verified: P.15/MENLHK/2017 rules for siting the titik penaatan and for averaging (titik penaatan now P4 at the block centre; daily-mean basis labelled a model assumption); whether PP 22/2021 changes the status of PP 71/2014; the SiMATAG sign convention; papan duga zero conventions in the field; the BMKG daily rain classes.

**Physics and calibration**
- Near-surface K, the β ET curve, the river response, the subsidence calibration, the Villemonte exponents (from memory), the "Riau-like" monthly normals and the storm magnitude are all illustrative.
- The calibration tests (scenarios, auto control) may need scenario tuning in M1.

**Model limitations** (stated in "Tentang model")
- one TMAS for the whole canal network (no gradient along it);
- no 2D flow toward the main drain;
- field drains are sub-grid only;
- no unsaturated-zone dynamics;
- no subsidence feedback;
- block drawn 400 m long instead of 1 km;
- piezometer and gauge sizes exaggerated.

**Display convention**
- The +depth/−elevation convention must be applied consistently. Core `status.js` and `format.js` are the single place it lives.

### Critical Files for Implementation
- /home/user/wm-3d/js/model/engine.js (with peat.js, canal.js, rain.js, scenarios.js, indicators.js, control.js)
- /home/user/wm-3d/index.html (import map three@0.185.1, layout shell)
- /home/user/wm-3d/js/main.js (loop, stepper, lerp, wmApp hook)
- /home/user/wm-3d/js/scene/index.js (with section.js, water.js, instruments.js, gate.js, layout.js)
- /home/user/wm-3d/tests/e2e/helpers/browser.js (with tests/e2e/smoke.e2e.js, tests/unit/model.balance.test.js)
