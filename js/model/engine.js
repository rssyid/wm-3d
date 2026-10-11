// Mesin simulasi: transek 1D Dupuit–Boussinesq (gambut) + simpanan kanal + ambang stoplog + sungai.
// Langkah luar 1 jam (forcing), sub-langkah adaptif eksplisit untuk air tanah, kanal implisit.
// Modul murni: tanpa DOM, tanpa three.js, tanpa Math.random/Date.

import { DEFAULT_PARAMS, DEFAULT_CONTROL, mergeParams, deriveGeometry, surfaceAt } from './params.js';
import { specificYield, conductivity, transmissivity, storageFromDepth, depthFromStorage, etBeta } from './peat.js';
import { canalVolume, canalWetArea, canalLevelFromVolume, crestLevel, weirQ, weirDetail, solveCanalLevel } from './canal.js';
import { scenarioForcing, manualForcing } from './scenarios.js';
import { dateLabel } from './rain.js';
import {
  classifyTmat,
  classifyTmas,
  ppCompliant,
  fireRiskIndex,
  classifyFire,
  subsidenceRate,
  THRESHOLDS,
} from './indicators.js';
import { autoGateDecision } from './control.js';

const SEC_PER_DAY = 86400;
const HOURS_PER_DAY = 24;
const LOG_MAX = 60;
const HOURLY_CAP = 8760;
const DAILY_CAP = 3660;

function newCum() {
  return { rainBlock: 0, rainCanal: 0, et: 0, evapCanal: 0, outWeir: 0, backflow: 0, clamp: 0, boundary: 0 };
}

function newScratch(N) {
  return {
    zeta: new Float64Array(N),
    T: new Float64Array(N),
    Sy: new Float64Array(N),
    et: new Float64Array(N),
    f: new Float64Array(N),
    fdCoef: new Float64Array(N),
    r: new Float64Array(N),
    rCoef: new Float64Array(N),
    qf: new Float64Array(N + 1),
    Tb: 0,
    Tc: 0,
    hcs: 0,
    Aw: 0,
    dtGw: Infinity,
    dtC: Infinity,
    lamMax: 0,
  };
}

function newDayAcc(nP) {
  return {
    hours: 0,
    rain_mm: 0,
    etp_mm: 0,
    depthSum: new Float64Array(nP),
    tmasSum: 0,
    riverSum: 0,
    outVol: 0,
    backVol: 0,
    pondedHours: 0,
    maxPondCm: 0,
  };
}

function createRing(cap, fields) {
  const r = { cap, n: 0, head: 0 };
  for (const f of fields) r[f] = new Float64Array(cap);
  r.fields = fields;
  return r;
}

function ringPush(r, values) {
  for (const f of r.fields) r[f][r.head] = values[f];
  r.head = (r.head + 1) % r.cap;
  if (r.n < r.cap) r.n++;
}

/** Nilai ke-j dari belakang (0 = terbaru). */
function ringBack(r, f, j) {
  return r[f][(r.head - 1 - j + 2 * r.cap) % r.cap];
}

// ---------------------------------------------------------------------------------------------
// Pembuatan model

/**
 * opts: {scenarioId ('kemarau'|'normal'|'hujan'|'ekstrem'|'manual'), params (patch), seed, rainScale,
 *        control {nLogs, flapGate, mode, target, tpId}, init {tmatCm, nLogs}, spinUpDays,
 *        manual {rainMmd, etpMmd, riverM}, forcing (penyedia kustom), forcingResolution ('hourly'|'daily')}
 */
export function createModel(opts = {}) {
  const params = mergeParams(DEFAULT_PARAMS, opts.params ?? {});
  const spinUpDays = opts.spinUpDays ?? params.numerics.spinUpDays;
  const scenarioId = opts.scenarioId ?? 'normal';
  const forcing =
    opts.forcing ??
    (scenarioId === 'manual'
      ? manualForcing(opts.manual, { startMonth: opts.startMonth ?? 0 })
      : scenarioForcing(scenarioId, { spinUpDays, seed: opts.seed }));
  const geo = deriveGeometry(params);
  const init = { ...forcing.init, ...(opts.init ?? {}) };
  const control = { ...DEFAULT_CONTROL, nLogs: init.nLogs ?? DEFAULT_CONTROL.nLogs, ...(opts.control ?? {}) };
  control.nLogs = clampLogs(control.nLogs, params);
  const nP = params.piezometers.length;

  const m = {
    params,
    geo,
    forcing,
    control,
    rainScale: opts.rainScale ?? 1,
    forcingResolution: opts.forcingResolution ?? 'hourly',
    k: forcing.kind === 'manual' ? 0 : -(forcing.spinUpDays ?? 0) * HOURS_PER_DAY,
    W: new Float64Array(geo.N),
    z: new Float64Array(geo.N),
    Vc: 0,
    hc: 0,
    Er: forcing.meanRainMmd ?? 0,
    hr: forcing.zR0 ?? -2.0,
    cum: newCum(),
    S0: 0,
    sc: newScratch(geo.N),
    lastForcing: { rain_mm: 0, etp_mm: 0, P: 0, ETp: 0, Pmmd: 0 },
    substepsLastHour: 0,
    spinningUp: false,
    // statistik
    day: newDayAcc(nP),
    daily: [],
    hourly: createRing(HOURLY_CAP, ['k', 'rain_mm', 'tpDepthCm', 'meanDepthCm', 'tmasCm', 'q_m3s', 'riverM', 'crestM']),
    roll: createRing(26, ['k', 'rain', 'et', 'outNet', 'S']),
    depth30: [],
    pp: { days: 0, compliant: 0, streak: 0, longest: 0, lastDayMeanCm: NaN },
    drySpell: 0,
    subsCumCm: 0,
    log: [],
    lastActionDay: -Infinity,
    lastActionType: null,
    lastAction: null,
    hourOut: 0,
  };

  // keadaan awal: kedalaman seragam relatif permukaan lokal, kanal di mercu
  const d0 = (init.tmatCm ?? 45) / 100;
  for (let i = 0; i < geo.N; i++) {
    m.W[i] = storageFromDepth(d0, params.peat);
    m.z[i] = geo.zs[i] - d0;
  }
  const crest0 = crestLevel(control.nLogs, params.weir);
  m.hc = params.fixedCanalLevel ?? Math.max(crest0, geo.zBedMin);
  m.Vc = canalVolume(m.hc, geo.segments, geo.zBank);
  if (forcing.kind === 'manual' && forcing.values) m.hr = forcing.values.riverM;
  else m.hr = Math.min(m.forcing.zR0 + params.river.gR * m.Er, params.river.zRMax);

  // spin-up: jalankan hari-hari awal lalu nolkan statistik dan neraca
  if (m.k < 0) {
    m.spinningUp = true;
    const savedMode = m.control.mode;
    m.control.mode = 'manual';
    while (m.k < 0) advanceHour(m);
    m.control.mode = savedMode;
    m.spinningUp = false;
  }
  resetStats(m);
  return m;
}

function clampLogs(n, params) {
  return Math.min(Math.max(Math.round(n), 0), params.weir.nMax);
}

function resetStats(m) {
  m.cum = newCum();
  m.S0 = totalStorage(m);
  m.day = newDayAcc(m.params.piezometers.length);
  m.daily = [];
  m.hourly.n = 0;
  m.hourly.head = 0;
  m.roll.n = 0;
  m.roll.head = 0;
  m.depth30 = [];
  m.pp = { days: 0, compliant: 0, streak: 0, longest: 0, lastDayMeanCm: NaN };
  m.subsCumCm = 0;
  m.log = [];
  m.lastActionDay = -Infinity;
  m.lastActionType = null;
  m.lastAction = null;
  pushRoll(m);
}

function totalStorage(m) {
  let S = 0;
  for (let i = 0; i < m.geo.N; i++) S += m.W[i] * m.geo.area[i];
  if (m.params.fixedCanalLevel == null) S += m.Vc;
  return S;
}

function pushRoll(m) {
  const c = m.cum;
  ringPush(m.roll, {
    k: m.k,
    rain: c.rainBlock + c.rainCanal,
    et: c.et + c.evapCanal,
    outNet: c.outWeir - c.backflow,
    S: totalStorage(m),
  });
}

// ---------------------------------------------------------------------------------------------
// Fluks

/** Menghitung semua fluks untuk keadaan saat ini dengan laju hujan P dan ETp (m/hari). */
function computeFluxes(m, P, ETp) {
  const { geo, params } = m;
  const peat = params.peat;
  const N = geo.N;
  const s = m.sc;
  const fixed = params.fixedCanalLevel;
  const hc = fixed ?? m.hc;
  const fd = params.fieldDrains;
  const fdOn = fd.enabled && fd.spacing > 0;
  const sFd2 = fdOn ? fd.spacing * fd.spacing : 1;
  const ks = params.runoff.ks;
  const hcEff = Math.max(hc, geo.zBank);

  for (let i = 0; i < N; i++) {
    const zi = m.z[i];
    const zeta = geo.zs[i] - zi;
    s.zeta[i] = zeta;
    s.T[i] = transmissivity(zeta, geo.D[i], peat);
    s.Sy[i] = specificYield(zeta, peat);
    s.et[i] = ETp * etBeta(zeta, geo.D[i], params.et);

    let f = 0;
    let fdc = 0;
    if (fdOn) {
      const zFd = geo.zFd[i];
      const hFd = Math.max(hc, zFd);
      const dl = zi - hFd;
      if (dl > 0 || (dl < 0 && hc > zFd)) {
        const Tm = 0.5 * (s.T[i] + transmissivity(geo.zs[i] - hFd, geo.D[i], peat));
        fdc = (12 * Tm) / sFd2;
        f = fdc * dl;
      }
    }
    s.f[i] = f;
    s.fdCoef[i] = fdc;

    let r = 0;
    let rc = 0;
    const pond = zi - geo.zs[i];
    if (pond > 0 && zi > hcEff) {
      r = ks * Math.min(pond, zi - hcEff);
      rc = ks;
    } else if (hc > geo.zBank) {
      const wl = Math.max(zi, geo.zs[i]);
      if (hc > wl) {
        r = -ks * (hc - wl);
        rc = ks;
      }
    }
    s.r[i] = r;
    s.rCoef[i] = rc;
  }

  const hcs = Math.max(hc, geo.zBedColl);
  const Tc = transmissivity(geo.zBank - Math.min(hcs, geo.zBank), geo.Dbank, peat);
  const Tb = 0.5 * (s.T[0] + Tc);
  s.hcs = hcs;
  s.Tc = Tc;
  s.Tb = Tb;
  s.qf[0] = (Tb * (m.z[0] - hcs)) / (geo.dx / 2);
  for (let i = 1; i < N; i++) s.qf[i] = (0.5 * (s.T[i] + s.T[i - 1]) * (m.z[i] - m.z[i - 1])) / geo.dx;
  s.qf[N] = 0;

  // kriteria stabilitas
  const dx2 = geo.dx * geo.dx;
  let lamMax = 0;
  for (let i = 0; i < N; i++) {
    const left = i === 0 ? (2 * Tb) / dx2 : (0.5 * (s.T[i] + s.T[i - 1])) / dx2;
    const right = i === N - 1 ? 0 : (0.5 * (s.T[i] + s.T[i + 1])) / dx2;
    const lam = (left + right + s.fdCoef[i] + s.rCoef[i]) / s.Sy[i];
    if (lam > lamMax) lamMax = lam;
  }
  s.lamMax = lamMax;
  s.dtGw = lamMax > 0 ? params.numerics.C / lamMax : Infinity;

  s.Aw = canalWetArea(hc, geo.segments, geo.zBank);
  if (fixed == null) {
    let denom = (2 * geo.Lb * 2 * Tb) / geo.dx;
    for (let i = 0; i < N; i++) {
      if (hc > geo.zFd[i]) denom += geo.area[i] * s.fdCoef[i];
      if (hc > geo.zBank) denom += geo.area[i] * s.rCoef[i];
    }
    s.dtC = denom > 0 ? (params.numerics.canalCoupling * s.Aw) / denom : Infinity;
  } else {
    s.dtC = Infinity;
  }
}

/** Satu sub-langkah; mengembalikan dt (hari). */
function substep(m, dtMax, P, ETp, Pmmd) {
  const { geo, params } = m;
  const s = m.sc;
  const N = geo.N;
  const fixed = params.fixedCanalLevel;
  computeFluxes(m, P, ETp);
  const dt = Math.min(dtMax, Math.max(params.numerics.dtMin, Math.min(s.dtGw, s.dtC)));

  // sungai (EMA hujan) atau nilai manual
  if (m.forcing.kind === 'manual' && m.forcing.values) {
    m.hr = m.forcing.values.riverM;
  } else {
    m.Er += (Pmmd - m.Er) * (1 - Math.exp(-dt / params.river.tauR));
    m.hr = Math.min(m.forcing.zR0 + params.river.gR * m.Er, params.river.zRMax);
  }

  // pembatasan penarikan dari kanal (agar Vc ≥ 0)
  let evap = params.et.eowFactor * ETp * s.Aw;
  let seep = 2 * geo.Lb * s.qf[0];
  if (fixed == null) {
    let inflow = P * geo.Acp + Math.max(0, seep);
    let withdraw = evap + Math.max(0, -seep);
    for (let i = 0; i < N; i++) {
      const a = geo.area[i];
      inflow += (Math.max(0, s.r[i]) + Math.max(0, s.f[i])) * a;
      withdraw += (Math.max(0, -s.r[i]) + Math.max(0, -s.f[i])) * a;
    }
    const avail = m.Vc + inflow * dt;
    if (withdraw * dt > avail) {
      const phi = Math.max(avail, 0) / (withdraw * dt);
      evap *= phi;
      if (seep < 0) {
        seep *= phi;
        s.qf[0] *= phi;
      }
      for (let i = 0; i < N; i++) {
        if (s.r[i] < 0) s.r[i] *= phi;
        if (s.f[i] < 0) s.f[i] *= phi;
      }
    }
  }

  // sel gambut
  let etVol = 0;
  let toCanal = seep;
  const peat = params.peat;
  for (let i = 0; i < N; i++) {
    const a = geo.area[i];
    const net = P - s.et[i] - s.r[i] - s.f[i] + (s.qf[i + 1] - s.qf[i]) / geo.dx;
    m.W[i] += dt * net;
    etVol += s.et[i] * dt * a;
    toCanal += (s.r[i] + s.f[i]) * a;
    m.z[i] = geo.zs[i] - depthFromStorage(m.W[i], peat, s.zeta[i]);
  }

  const c = m.cum;
  c.rainBlock += P * dt * geo.Ablock;
  c.rainCanal += P * dt * geo.Acp;
  c.et += etVol;
  c.evapCanal += evap * dt;

  const Vin = dt * (P * geo.Acp - evap + toCanal);
  if (fixed != null) {
    c.boundary += Vin;
    m.hc = fixed;
  } else {
    const Vtarget = m.Vc + Vin;
    const crest = crestLevel(m.control.nLogs, params.weir);
    const h = solveCanalLevel(Vtarget, dt, m.hr, crest, params.weir, m.control.flapGate, geo.segments, geo.zBank, params.numerics.bisectIter);
    const Q = weirQ(h, m.hr, crest, params.weir, m.control.flapGate);
    const wv = SEC_PER_DAY * dt * Q;
    let Vn = Vtarget - wv;
    if (Vn < 0) {
      c.clamp += -Vn;
      Vn = 0;
    }
    m.Vc = Vn;
    m.hc = h;
    if (wv >= 0) c.outWeir += wv;
    else c.backflow += -wv;
    m.hourOut += wv;
  }
  return dt;
}

function forcingAt(m, k) {
  const f = m.forcing;
  if (m.forcingResolution === 'daily' && f.kind !== 'manual') {
    const d = Math.floor(k / HOURS_PER_DAY);
    return { rain_mm: f.dayRain(d) / HOURS_PER_DAY, etp_mm: f.dayEtp(d) / HOURS_PER_DAY, etpDaily_mm: f.dayEtp(d) };
  }
  return f.hour(k);
}

/** Maju satu jam simulasi. */
function advanceHour(m) {
  const fk = forcingAt(m, m.k);
  const rain_mm = fk.rain_mm * m.rainScale;
  const etp_mm = fk.etp_mm;
  const P = (rain_mm / 1000) * HOURS_PER_DAY;
  const ETp = (etp_mm / 1000) * HOURS_PER_DAY;
  const Pmmd = rain_mm * HOURS_PER_DAY;
  m.lastForcing = { rain_mm, etp_mm, etpDaily_mm: fk.etpDaily_mm ?? etp_mm * 24, P, ETp, Pmmd };
  m.hourOut = 0;
  let remaining = 1 / HOURS_PER_DAY;
  let n = 0;
  while (remaining > 0) {
    const dt = substep(m, remaining, P, ETp, Pmmd);
    remaining -= dt;
    n++;
    if (n > 200000) throw new Error('Sub-langkah tidak konvergen');
  }
  m.substepsLastHour = n;
  m.k += 1;
  if (!m.spinningUp && m.k > 0) recordHour(m, rain_mm, etp_mm);
}

// ---------------------------------------------------------------------------------------------
// Statistik per jam / hari

function depthAtX(m, x) {
  const { geo } = m;
  const N = geo.N;
  const zeta = (i) => geo.zs[i] - m.z[i];
  if (x <= geo.x[0]) return zeta(0);
  if (x >= geo.x[N - 1]) return zeta(N - 1);
  const u = x / geo.dx - 0.5;
  const i = Math.floor(u);
  const t = u - i;
  return zeta(i) * (1 - t) + zeta(i + 1) * t;
}

function piezometerDepthsCm(m) {
  return m.params.piezometers.map((p) => 100 * depthAtX(m, p.x));
}

function tpIndex(m) {
  const i = m.params.piezometers.findIndex((p) => p.id === m.control.tpId);
  return i < 0 ? 0 : i;
}

function pondingInfo(m) {
  const { geo } = m;
  let maxCm = 0;
  let area = 0;
  for (let i = 0; i < geo.N; i++) {
    const p = m.z[i] - geo.zs[i];
    if (p > 0.001) {
      area += geo.area[i];
      if (p * 100 > maxCm) maxCm = p * 100;
    }
  }
  return { maxCm, areaFrac: area / geo.Ablock };
}

function recordHour(m, rain_mm, etp_mm) {
  const depths = piezometerDepthsCm(m);
  const tp = tpIndex(m);
  const tmasCm = 100 * (m.geo.zBank - m.hc);
  const q = m.hourOut / 3600;
  const d = m.day;
  d.hours++;
  d.rain_mm += rain_mm;
  d.etp_mm += etp_mm;
  for (let i = 0; i < depths.length; i++) d.depthSum[i] += depths[i];
  d.tmasSum += tmasCm;
  d.riverSum += m.hr;
  if (m.hourOut >= 0) d.outVol += m.hourOut;
  else d.backVol += -m.hourOut;
  const pond = pondingInfo(m);
  if (pond.maxCm > 0) d.pondedHours++;
  if (pond.maxCm > d.maxPondCm) d.maxPondCm = pond.maxCm;
  const mean = depths.reduce((a, b) => a + b, 0) / depths.length;
  ringPush(m.hourly, {
    k: m.k,
    rain_mm,
    tpDepthCm: depths[tp],
    meanDepthCm: mean,
    tmasCm,
    q_m3s: q,
    riverM: m.hr,
    crestM: crestLevel(m.control.nLogs, m.params.weir),
  });
  pushRoll(m);
  if (m.k % HOURS_PER_DAY === 0) finalizeDay(m);
}

function finalizeDay(m) {
  const d = m.day;
  const dayIndex = m.k / HOURS_PER_DAY - 1;
  const nP = m.params.piezometers.length;
  const meanDepth = Array.from(d.depthSum, (s) => s / d.hours);
  const tp = tpIndex(m);
  const tpMean = meanDepth[tp];
  const allMean = meanDepth.reduce((a, b) => a + b, 0) / nP;

  // kepatuhan PP 57/2016 (rata-rata harian di titik penaatan)
  const pp = m.pp;
  pp.days++;
  pp.lastDayMeanCm = tpMean;
  if (ppCompliant(tpMean)) {
    pp.compliant++;
    pp.streak = 0;
  } else {
    pp.streak++;
    if (pp.streak > pp.longest) pp.longest = pp.streak;
  }

  m.drySpell = d.rain_mm < THRESHOLDS.dryDayMm ? m.drySpell + 1 : 0;
  m.depth30.push(allMean);
  if (m.depth30.length > 30) m.depth30.shift();
  const mean30 = m.depth30.reduce((a, b) => a + b, 0) / m.depth30.length;
  m.subsCumCm += subsidenceRate(mean30) / 365;

  const rec = {
    day: dayIndex,
    dateLabel: dateLabel(dayIndex, m.forcing.startMonth),
    rain_mm: d.rain_mm,
    etp_mm: d.etp_mm,
    depthCm: meanDepth,
    tpDepthCm: tpMean,
    meanDepthCm: allMean,
    tmasCm: d.tmasSum / d.hours,
    q_m3s: (d.outVol - d.backVol) / SEC_PER_DAY,
    out_mm: ((d.outVol - d.backVol) / m.geo.Atot) * 1000,
    crestM: crestLevel(m.control.nLogs, m.params.weir),
    nLogs: m.control.nLogs,
    riverM: d.riverSum / d.hours,
    pondedHours: d.pondedHours,
    maxPondCm: d.maxPondCm,
    ppCompliant: ppCompliant(tpMean),
    partial: false,
  };
  m.daily.push(rec);
  if (m.daily.length > DAILY_CAP) m.daily.shift();
  m.day = newDayAcc(nP);

  if (m.control.mode === 'auto') {
    const pond = pondingInfo(m);
    const dec = autoGateDecision({
      nLogs: m.control.nLogs,
      nMax: m.params.weir.nMax,
      dMeanCm: allMean,
      tmasCm: 100 * (m.geo.zBank - m.hc),
      ponded: pond.maxCm > 0,
      riverM: m.hr,
      canalM: m.hc,
      daysSinceLast: dayIndex + 1 - m.lastActionDay,
      target: m.control.target,
    });
    if (dec.action) {
      const changed = dec.nLogs !== m.control.nLogs;
      const repeatHold = dec.action.type === 'tahan' && m.lastActionType === 'tahan';
      const entry = {
        day: dayIndex + 1,
        dateLabel: dateLabel(dayIndex + 1, m.forcing.startMonth),
        type: dec.action.type,
        text: dec.action.text,
        from: m.control.nLogs,
        to: dec.nLogs,
        auto: true,
      };
      m.control.nLogs = dec.nLogs;
      m.lastActionType = dec.action.type;
      if (changed) m.lastActionDay = dayIndex + 1;
      if (!repeatHold) pushLog(m, entry);
    } else if (m.lastActionType === 'tahan') {
      m.lastActionType = null;
    }
  }
}

function pushLog(m, entry) {
  m.lastAction = entry;
  m.log.push(entry);
  if (m.log.length > LOG_MAX) m.log.shift();
}

// ---------------------------------------------------------------------------------------------
// API publik

export function isFinished(m) {
  return Number.isFinite(m.forcing.days) && m.k >= m.forcing.days * HOURS_PER_DAY;
}

/** Maju `hours` jam (berhenti di akhir skenario). Mengembalikan snapshot. */
export function advance(m, hours = 1) {
  for (let h = 0; h < hours; h++) {
    if (isFinished(m)) break;
    advanceHour(m);
  }
  return snapshot(m);
}

export function setControl(m, patch = {}) {
  const c = m.control;
  if (patch.nLogs !== undefined) {
    const n = clampLogs(patch.nLogs, m.params);
    if (n !== c.nLogs) {
      const day = Math.floor(Math.max(m.k, 0) / HOURS_PER_DAY);
      pushLog(m, {
        day,
        dateLabel: dateLabel(day, m.forcing.startMonth),
        type: 'manual',
        text: `Manual: stoplog ${c.nLogs} → ${n}`,
        from: c.nLogs,
        to: n,
        auto: false,
      });
      c.nLogs = n;
    }
  }
  for (const key of ['flapGate', 'mode', 'target', 'tpId']) if (patch[key] !== undefined) c[key] = patch[key];
  return snapshot(m);
}

/** Mengubah parameter (mis. kubah Hd, Ks, parit lapangan). Simpanan W per sel dipertahankan (neraca tetap tertutup). */
export function setParams(m, patch = {}) {
  const S1 = totalStorage(m);
  m.params = mergeParams(m.params, patch);
  m.geo = deriveGeometry(m.params);
  for (let i = 0; i < m.geo.N; i++) m.z[i] = m.geo.zs[i] - depthFromStorage(m.W[i], m.params.peat);
  if (m.params.fixedCanalLevel != null) m.hc = m.params.fixedCanalLevel;
  else m.hc = canalLevelFromVolume(m.Vc, m.geo.segments, m.geo.zBank);
  m.S0 += totalStorage(m) - S1;
  return snapshot(m);
}

export function setForcing(m, provider) {
  m.forcing = provider;
  return snapshot(m);
}

export function setRainScale(m, s) {
  m.rainScale = s;
}

/** Nilai slider mode Manual: {rainMmd, etpMmd, riverM}. */
export function setManualInputs(m, values = {}) {
  if (m.forcing.kind === 'manual') Object.assign(m.forcing.values, values);
}

export function waterBalance(m) {
  const c = m.cum;
  const inflow = c.rainBlock + c.rainCanal + c.backflow + c.clamp;
  const outflow = c.et + c.evapCanal + c.outWeir + c.boundary;
  const dS = totalStorage(m) - m.S0;
  const residual = inflow - outflow - dS;
  return { in: inflow, out: outflow, dS, residual, relError: Math.abs(residual) / Math.max(inflow, outflow, 1e-9), cum: { ...c } };
}

function todayBalance(m) {
  const r = m.roll;
  if (r.n === 0) return { rain_mm: 0, et_mm: 0, out_mm: 0, dS_mm: 0, residual_mm: 0, hours: 0 };
  const back = Math.min(24, r.n - 1);
  const k = (f) => (ringBack(r, f, 0) - ringBack(r, f, back)) * (1000 / m.geo.Atot);
  const rain = k('rain');
  const et = k('et');
  const out = k('outNet');
  const dS = k('S');
  return { rain_mm: rain, et_mm: et, out_mm: out, dS_mm: dS, residual_mm: rain - et - out - dS, hours: back };
}

/** Snapshot keadaan model (objek biasa) untuk UI dan scene. */
export function snapshot(m) {
  const { geo, params, control } = m;
  const N = geo.N;
  const kk = Math.max(m.k, 0);
  const day = Math.floor(kk / HOURS_PER_DAY);
  const crest = crestLevel(control.nLogs, params.weir);
  const tmasCm = 100 * (geo.zBank - m.hc);
  const wd = weirDetail(m.hc, m.hr, crest, params.weir, control.flapGate);
  const q = m.params.fixedCanalLevel == null ? wd.Q : 0;
  const depths = piezometerDepthsCm(m);
  const tp = tpIndex(m);
  const meanDepth = depths.reduce((a, b) => a + b, 0) / depths.length;
  const pond = pondingInfo(m);
  const fire = fireRiskIndex(meanDepth, m.drySpell);
  const mean30 = m.depth30.length ? m.depth30.reduce((a, b) => a + b, 0) / m.depth30.length : meanDepth;

  // profil
  computeFluxes(m, m.lastForcing.P, m.lastForcing.ETp);
  const zArr = Float64Array.from(m.z);
  const depthArr = new Float64Array(N);
  const ponded = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    depthArr[i] = 100 * (geo.zs[i] - m.z[i]);
    ponded[i] = m.z[i] - geo.zs[i] > 0.001 ? 1 : 0;
  }

  // hujan 24 jam terakhir
  let rain24 = 0;
  const hn = Math.min(24, m.hourly.n);
  for (let j = 0; j < hn; j++) rain24 += ringBack(m.hourly, 'rain_mm', j);

  const pp = m.pp;
  return {
    tDays: kk / HOURS_PER_DAY,
    hourIndex: kk,
    day,
    hourOfDay: kk % HOURS_PER_DAY,
    dateLabel: dateLabel(day, m.forcing.startMonth),
    scenarioId: m.forcing.scenarioId,
    scenarioLabel: m.forcing.label,
    scenarioDays: m.forcing.days,
    finished: isFinished(m),
    forcing: {
      rain_mmh: m.lastForcing.rain_mm,
      rain24h_mm: rain24,
      etp_mmd: m.lastForcing.etpDaily_mm ?? 0,
      rainScale: m.rainScale,
      riverM: m.hr,
    },
    profile: {
      x: geo.x,
      zs: geo.zs,
      z: zArr,
      depthCm: depthArr,
      ponded,
      q: Float64Array.from(m.sc.qf),
      fd: Float64Array.from(m.sc.f),
      peatBaseZ: geo.zBase,
      fieldDrainDepth: params.fieldDrains.depth,
      fieldDrains: params.fieldDrains.enabled,
      Lh: params.geom.Lh,
      Hd: params.geom.Hd,
    },
    piezometers: params.piezometers.map((p, i) => {
      const dCm = depths[i];
      const surf = surfaceAt(p.x, params.geom);
      return {
        id: p.id,
        name: p.name,
        note: p.note,
        x: p.x,
        surfaceM: surf,
        levelM: surf - dCm / 100,
        depthCm: dCm,
        cls: classifyTmat(dCm),
        ppCompliant: ppCompliant(dCm),
        isTP: i === tp,
      };
    }),
    canal: {
      levelM: m.hc,
      tmasCm,
      tmasCls: classifyTmas(tmasCm),
      gaugeReadingCm: -tmasCm,
      volumeM3: m.Vc,
      overbank: m.hc > geo.zBank,
      bankM: geo.zBank,
    },
    structure: {
      nLogs: control.nLogs,
      nMax: params.weir.nMax,
      plankM: params.weir.plank,
      sillM: params.weir.zSill,
      crestM: crest,
      widthM: params.weir.width,
      headCm: Math.max(0, 100 * wd.H1),
      flapGate: control.flapGate,
      mode: control.mode,
      q_m3s: q,
      q_Ls: q * 1000,
      q_mmd: ((q * SEC_PER_DAY) / geo.Atot) * 1000,
      submerged: wd.submerged,
      backflow: q < 0,
      riverAboveCrest: m.hr > crest,
    },
    river: { levelM: m.hr },
    ponding: pond,
    today: todayBalance(m),
    ind: {
      meanDepthCm: meanDepth,
      tpId: control.tpId,
      tpDepthCm: depths[tp],
      cls: classifyTmat(depths[tp]),
      meanCls: classifyTmat(meanDepth),
      pp: {
        now: ppCompliant(depths[tp]),
        limitCm: THRESHOLDS.ppLimitCm,
        lastDayMeanCm: pp.lastDayMeanCm,
        lastDayCompliant: Number.isFinite(pp.lastDayMeanCm) ? ppCompliant(pp.lastDayMeanCm) : null,
        daysCounted: pp.days,
        compliantDays: pp.compliant,
        pctDays: pp.days ? (100 * pp.compliant) / pp.days : NaN,
        streak: pp.streak,
        longestStreak: pp.longest,
      },
      fire: { index: fire, cls: classifyFire(fire), drySpellDays: m.drySpell },
      subs: { rate: subsidenceRate(mean30), cumCm: m.subsCumCm },
    },
    balance: waterBalance(m),
    control: {
      mode: control.mode,
      target: control.target,
      tpId: control.tpId,
      lastAction: m.lastAction,
      log: m.log.slice(),
    },
    substepsLastHour: m.substepsLastHour,
  };
}

/** Rangkuman harian (termasuk hari berjalan yang belum lengkap) untuk grafik dan tabel. */
export function dailySeries(m) {
  const recs = m.daily.slice();
  const d = m.day;
  if (d.hours > 0) {
    const nP = m.params.piezometers.length;
    const meanDepth = Array.from(d.depthSum, (s) => s / d.hours);
    const tp = tpIndex(m);
    recs.push({
      day: Math.floor(m.k / HOURS_PER_DAY),
      dateLabel: dateLabel(Math.floor(m.k / HOURS_PER_DAY), m.forcing.startMonth),
      rain_mm: d.rain_mm,
      etp_mm: d.etp_mm,
      depthCm: meanDepth,
      tpDepthCm: meanDepth[tp],
      meanDepthCm: meanDepth.reduce((a, b) => a + b, 0) / nP,
      tmasCm: d.tmasSum / d.hours,
      q_m3s: (d.outVol - d.backVol) / (3600 * d.hours),
      out_mm: ((d.outVol - d.backVol) / m.geo.Atot) * 1000,
      crestM: crestLevel(m.control.nLogs, m.params.weir),
      nLogs: m.control.nLogs,
      riverM: d.riverSum / d.hours,
      pondedHours: d.pondedHours,
      maxPondCm: d.maxPondCm,
      ppCompliant: ppCompliant(meanDepth[tp]),
      partial: true,
    });
  }
  const ids = m.params.piezometers.map((p) => p.id);
  const depthCm = Object.fromEntries(ids.map((id, i) => [id, recs.map((r) => r.depthCm[i])]));
  return {
    n: recs.length,
    scenarioDays: m.forcing.days,
    startMonth: m.forcing.startMonth,
    piezometerIds: ids,
    tpId: m.control.tpId,
    day: recs.map((r) => r.day),
    dateLabel: recs.map((r) => r.dateLabel),
    rain_mm: recs.map((r) => r.rain_mm),
    etp_mm: recs.map((r) => r.etp_mm),
    depthCm,
    tpDepthCm: recs.map((r) => r.tpDepthCm),
    meanDepthCm: recs.map((r) => r.meanDepthCm),
    tmasCm: recs.map((r) => r.tmasCm),
    q_m3s: recs.map((r) => r.q_m3s),
    q_mmd: recs.map((r) => (r.q_m3s * SEC_PER_DAY * 1000) / m.geo.Atot),
    out_mm: recs.map((r) => r.out_mm),
    crestM: recs.map((r) => r.crestM),
    nLogs: recs.map((r) => r.nLogs),
    riverM: recs.map((r) => r.riverM),
    pondedHours: recs.map((r) => r.pondedHours),
    maxPondCm: recs.map((r) => r.maxPondCm),
    ppCompliant: recs.map((r) => r.ppCompliant),
    partial: recs.map((r) => r.partial),
  };
}

/** Deret per jam terakhir (maks. 8760 jam). */
export function hourlySeries(m, last = 24 * 30) {
  const r = m.hourly;
  const n = Math.min(last, r.n);
  const out = {};
  for (const f of r.fields) {
    const a = new Array(n);
    for (let j = 0; j < n; j++) a[n - 1 - j] = ringBack(r, f, j);
    out[f] = a;
  }
  return out;
}

/**
 * Besaran antara untuk tab "Persamaan & Perhitungan" — dihitung dengan fungsi model yang sama.
 * opts.cell: indeks sel; atau opts.piezometer: id (sel terdekat).
 */
export function explain(m, opts = {}) {
  const { geo, params, control } = m;
  const N = geo.N;
  const { P, ETp } = m.lastForcing;
  computeFluxes(m, P, ETp);
  const s = m.sc;
  let i = opts.cell;
  if (i == null) {
    const pz = params.piezometers.find((p) => p.id === (opts.piezometer ?? control.tpId)) ?? params.piezometers[0];
    i = Math.min(N - 1, Math.max(0, Math.floor(pz.x / geo.dx)));
  }
  i = Math.min(N - 1, Math.max(0, i));
  const zeta = s.zeta[i];
  const lateral = (s.qf[i + 1] - s.qf[i]) / geo.dx;
  const net = P - s.et[i] - s.r[i] - s.f[i] + lateral;
  const crest = crestLevel(control.nLogs, params.weir);
  const wd = weirDetail(m.hc, m.hr, crest, params.weir, control.flapGate);
  const fixed = params.fixedCanalLevel != null;
  let drains = 0;
  let runoff = 0;
  for (let j = 0; j < N; j++) {
    drains += s.f[j] * geo.area[j];
    runoff += s.r[j] * geo.area[j];
  }
  const evap = params.et.eowFactor * ETp * s.Aw;
  const terms = {
    rain: P * geo.Acp,
    evap,
    seepage: 2 * geo.Lb * s.qf[0],
    drains,
    runoff,
    weir: fixed ? 0 : SEC_PER_DAY * wd.Q,
  };
  const zFdC = geo.zFd[i];
  const hFd = Math.max(m.hc, zFdC);
  const fdActive = params.fieldDrains.enabled && (m.z[i] - hFd > 0 || (m.z[i] - hFd < 0 && m.hc > zFdC));
  return {
    tDays: Math.max(m.k, 0) / HOURS_PER_DAY,
    forcing: { P_mmd: P * 1000, ETp_mmd: ETp * 1000, rain_mmh: m.lastForcing.rain_mm, rainScale: m.rainScale },
    geometry: {
      N,
      dx: geo.dx,
      Lh: params.geom.Lh,
      Lb: geo.Lb,
      Hd: params.geom.Hd,
      zBase: geo.zBase,
      zBank: geo.zBank,
      Ablock: geo.Ablock,
      Acp: geo.Acp,
      Atot: geo.Atot,
      cellArea: geo.area[0],
      segments: geo.segments.map((g) => ({ ...g })),
    },
    cells: {
      x: Float64Array.from(geo.x),
      zs: Float64Array.from(geo.zs),
      z: Float64Array.from(m.z),
      zeta: Float64Array.from(s.zeta),
      Sy: Float64Array.from(s.Sy),
      T: Float64Array.from(s.T),
      et: Float64Array.from(s.et),
      f: Float64Array.from(s.f),
      r: Float64Array.from(s.r),
      qf: Float64Array.from(s.qf),
    },
    cell: {
      i,
      x: geo.x[i],
      zs: geo.zs[i],
      z: m.z[i],
      zeta,
      D: geo.D[i],
      W: m.W[i],
      Sy: s.Sy[i],
      K: conductivity(zeta, params.peat),
      T: s.T[i],
      Tleft: i === 0 ? s.Tb : 0.5 * (s.T[i] + s.T[i - 1]),
      Tright: i === N - 1 ? 0 : 0.5 * (s.T[i] + s.T[i + 1]),
      zLeft: i === 0 ? s.hcs : m.z[i - 1],
      zRight: i === N - 1 ? m.z[i] : m.z[i + 1],
      qLeft: s.qf[i],
      qRight: s.qf[i + 1],
      lateral,
      P,
      ET: s.et[i],
      beta: etBeta(zeta, geo.D[i], params.et),
      f: s.f[i],
      fdActive,
      fdSpacing: params.fieldDrains.spacing,
      fdBed: zFdC,
      fdLevel: hFd,
      fdTm: fdActive ? 0.5 * (s.T[i] + transmissivity(geo.zs[i] - hFd, geo.D[i], params.peat)) : 0,
      r: s.r[i],
      net,
      dzdt: net / s.Sy[i],
    },
    canal: {
      h: m.hc,
      hcs: s.hcs,
      V: m.Vc,
      Aw: s.Aw,
      Tb: s.Tb,
      Tc: s.Tc,
      qb: s.qf[0],
      Eow: params.et.eowFactor * ETp,
      terms,
      net: terms.rain - terms.evap + terms.seepage + terms.drains + terms.runoff - terms.weir,
      fixed,
    },
    weir: { ...wd, hc: m.hc, hr: m.hr, nLogs: control.nLogs, sill: params.weir.zSill, plank: params.weir.plank, flapGate: control.flapGate },
    numerics: {
      C: params.numerics.C,
      canalCoupling: params.numerics.canalCoupling,
      dtGw: s.dtGw,
      dtC: s.dtC,
      dt: Math.min(1 / 24, Math.max(params.numerics.dtMin, Math.min(s.dtGw, s.dtC))),
      lamMax: s.lamMax,
      substepsLastHour: m.substepsLastHour,
    },
    balance: waterBalance(m),
    params,
  };
}

/** Kurva profil sifat gambut terhadap kedalaman (untuk grafik mini). */
export function peatCurves(m, { n = 61, maxDepth = 3 } = {}) {
  const peat = m.params.peat;
  const D = m.params.geom.zBank - m.params.geom.zBase;
  const depth = [];
  const Sy = [];
  const K = [];
  const T = [];
  const W = [];
  const beta = [];
  for (let j = 0; j < n; j++) {
    const z = (maxDepth * j) / (n - 1);
    depth.push(z);
    Sy.push(specificYield(z, peat));
    K.push(conductivity(z, peat));
    T.push(transmissivity(z, D, peat));
    W.push(storageFromDepth(z, peat));
    beta.push(etBeta(z, D, m.params.et));
  }
  return { depth, Sy, K, T, W, beta, D };
}

/** Kurva rating pintu air Q(H) untuk mercu saat ini, aliran bebas. */
export function ratingCurve(m, { n = 41, maxHead = 0.8 } = {}) {
  const w = m.params.weir;
  const crest = crestLevel(m.control.nLogs, w);
  const H = [];
  const Q = [];
  for (let j = 0; j < n; j++) {
    const h = (maxHead * j) / (n - 1);
    H.push(h);
    Q.push(weirQ(crest + h, -100, crest, w, false));
  }
  return { H, Q, crest };
}

/** Menjalankan satu skenario penuh (untuk tes dan CLI). */
export function runScenario(id, overrides = {}, { stepHours = 1, days } = {}) {
  const m = createModel({ scenarioId: id, forcingResolution: stepHours === 24 ? 'daily' : 'hourly', ...overrides });
  const total = (days ?? m.forcing.days) * HOURS_PER_DAY;
  advance(m, total);
  const series = dailySeries(m);
  return { model: m, series, snapshot: snapshot(m), balance: waterBalance(m) };
}

export { DEFAULT_PARAMS };
