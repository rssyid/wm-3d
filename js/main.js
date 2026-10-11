// main.js — akar komposisi: store, model, loop waktu, UI, tab Persamaan, dan scene 3D.
// Scene dimuat dinamis supaya model, KPI, dan grafik tetap jalan bila three.js/WebGL tidak tersedia.

import {
  createModel,
  advance,
  snapshot,
  dailySeries,
  setControl,
  setParams,
  setRainScale,
  setManualInputs,
  isFinished,
  SCENARIOS,
  SCENARIO_IDS,
  PARAM_META,
  DEFAULT_PARAMS,
  DEFAULT_CONTROL,
  TMAT_CLASSES,
  TMAS_CLASSES,
  CONTROL_TARGETS,
} from './model/index.js';
import { createStore } from './core/store.js';
import { createStepper } from './core/stepper.js';
import { lerpSnapshot } from './core/view.js';
import { APP_VERSION, SPEEDS, DEFAULT_SPEED_HPS, MAX_STEPS_PER_FRAME, VE, CAMERA_PRESETS, QUALITY, EQ_SECTIONS } from './core/config.js';
import { createRouter } from './ui/router.js';
import { createUI } from './ui/index.js';
import { createEquations } from './ui/equations/index.js';
import { createAbout } from './ui/about.js';

const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 899px)').matches;

const store = createStore({
  route: { view: 'sim', section: null },
  scenarioId: 'normal',
  playing: false,
  speedHps: DEFAULT_SPEED_HPS,
  rainScale: 1,
  manual: { rainMmd: 20, etpMmd: 4, riverM: -2.0 },
  gate: {
    mode: DEFAULT_CONTROL.mode,
    nLogs: SCENARIOS.normal.init.nLogs,
    flapGate: DEFAULT_CONTROL.flapGate,
    target: DEFAULT_CONTROL.target,
  },
  land: {
    Hd: DEFAULT_PARAMS.geom.Hd,
    fieldDrains: DEFAULT_PARAMS.fieldDrains.enabled,
    Ks: DEFAULT_PARAMS.peat.Ks,
    tpId: DEFAULT_CONTROL.tpId,
  },
  view: {
    ve: VE.default,
    labels: true,
    cutaway: true,
    particles: true,
    quality: narrow ? 'rendah' : 'tinggi',
    camera: 'ikhtisar',
  },
  eq: { piezometer: DEFAULT_CONTROL.tpId, frozen: false },
  status: { finished: false, slow: false },
});

function paramsPatch(land) {
  return { 'geom.Hd': land.Hd, 'peat.Ks': land.Ks, 'fieldDrains.enabled': land.fieldDrains };
}

function buildModel(s) {
  const control = { nLogs: s.gate.nLogs, flapGate: s.gate.flapGate, mode: s.gate.mode, target: s.gate.target, tpId: s.land.tpId };
  if (s.scenarioId === 'manual') {
    return createModel({ scenarioId: 'manual', manual: { ...s.manual }, params: paramsPatch(s.land), control });
  }
  return createModel({ scenarioId: s.scenarioId, params: paramsPatch(s.land), control, rainScale: s.rainScale });
}

let model = buildModel(store.get());
let prev = snapshot(model);
let next = prev;
let view = next;
let lastDay = -1;
let scene = null;
const stepper = createStepper({ maxStepsPerFrame: MAX_STEPS_PER_FRAME });

const meta = {
  version: APP_VERSION,
  scenarios: SCENARIO_IDS.map((id) => SCENARIOS[id]),
  speeds: SPEEDS,
  ve: VE,
  cameras: CAMERA_PRESETS,
  quality: QUALITY,
  paramMeta: PARAM_META,
  piezometers: DEFAULT_PARAMS.piezometers,
  weir: DEFAULT_PARAMS.weir,
  tmatClasses: TMAT_CLASSES,
  tmasClasses: TMAS_CLASSES,
  controlTargets: CONTROL_TARGETS,
  eqSections: EQ_SECTIONS,
};

function syncFromModel() {
  const s = store.get();
  const n = model.control.nLogs;
  const finished = isFinished(model);
  if (s.gate.nLogs !== n) store.patch('gate', { nLogs: n });
  if (s.status.finished !== finished) store.patch('status', { finished });
  if (finished && store.get().playing) store.set({ playing: false });
}

function afterStep() {
  syncFromModel();
  ui.onStep(next);
  if (next.day !== lastDay || next.hourOfDay === 0) {
    lastDay = next.day;
    ui.onDay(dailySeries(model));
  }
  equations.onStep(next);
}

function rebuild() {
  model = buildModel(store.get());
  prev = snapshot(model);
  next = prev;
  view = next;
  lastDay = -1;
  stepper.reset();
  syncFromModel();
  ui.onReset(next, dailySeries(model));
  equations.onStep(next);
  scene?.rebuild?.(model.params);
  scene?.frame(view, 0, false, true);
}

/** Maju n jam secara langsung (tombol ⏭ dan hook tes). */
function stepHours(n) {
  if (n <= 0) return next;
  prev = snapshot(model);
  next = advance(model, n);
  view = next;
  afterStep();
  ui.onFrame(view);
  scene?.frame(view, 0, false, true);
  return next;
}

const actions = {
  play() {
    if (isFinished(model)) return;
    stepper.reset();
    store.set({ playing: true });
  },
  pause() {
    store.set({ playing: false });
  },
  togglePlay() {
    if (store.get().playing) actions.pause();
    else actions.play();
  },
  stepDay() {
    actions.pause();
    return stepHours(24);
  },
  stepHours,
  reset() {
    store.set({ playing: false });
    rebuild();
  },
  setScenario(id) {
    const s = store.get();
    const nLogs = id === 'manual' ? s.gate.nLogs : SCENARIOS[id].init.nLogs;
    store.set({ scenarioId: id, playing: false, gate: { ...s.gate, nLogs } });
  },
  setCamera(id) {
    store.patch('view', { camera: id });
    scene?.setCamera(id);
  },
  getModel: () => model,
  getSnapshot: () => next,
  getView: () => view,
  dailySeries: () => dailySeries(model),
};

// ----- reaksi store → model / scene -----
store.subscribe((s, p) => {
  if (s.scenarioId !== p.scenarioId) {
    rebuild();
    return;
  }
  if (s.gate !== p.gate) {
    const g = s.gate;
    if (g.nLogs !== model.control.nLogs || g.mode !== model.control.mode || g.flapGate !== model.control.flapGate || g.target !== model.control.target) {
      next = setControl(model, { nLogs: g.nLogs, mode: g.mode, flapGate: g.flapGate, target: g.target });
      view = next;
      ui.onStep(next);
      equations.onStep(next);
    }
  }
  if (s.land !== p.land) {
    const geomChanged = s.land.Hd !== p.land.Hd || s.land.fieldDrains !== p.land.fieldDrains;
    if (s.land.Hd !== p.land.Hd || s.land.Ks !== p.land.Ks || s.land.fieldDrains !== p.land.fieldDrains) setParams(model, paramsPatch(s.land));
    if (s.land.tpId !== p.land.tpId) setControl(model, { tpId: s.land.tpId });
    next = snapshot(model);
    view = next;
    ui.onStep(next);
    ui.onDay(dailySeries(model));
    equations.onStep(next);
    if (geomChanged) scene?.rebuild?.(model.params);
  }
  if (s.rainScale !== p.rainScale) setRainScale(model, s.rainScale);
  if (s.manual !== p.manual) setManualInputs(model, s.manual);
  if (s.view !== p.view && scene) {
    scene.setOptions(s.view);
    if (s.view.camera !== p.view.camera) scene.setCamera(s.view.camera);
  }
  if (s.route !== p.route) {
    if (s.route.view === 'persamaan') equations.show(s.route.section);
    else equations.hide();
    if (s.route.view === 'sim') {
      scene?.resize();
      scene?.frame(view, 0, false, true);
    }
  }
  if (s.playing !== p.playing) stepper.reset();
});

// ----- UI -----
const ui = createUI({
  store,
  actions,
  meta,
  roots: {
    simBar: document.getElementById('sim-bar'),
    left: document.getElementById('panel-left'),
    right: document.getElementById('panel-right'),
    bottom: document.getElementById('panel-bottom'),
    mobileTabs: document.getElementById('mobile-tabs'),
    viewport: document.getElementById('viewport'),
  },
});
const equations = createEquations(document.getElementById('view-persamaan'), { store, actions, meta });
createAbout(document.getElementById('view-tentang'), { meta });
createRouter(store);
ui.onReset(next, dailySeries(model));
if (store.get().route.view === 'persamaan') equations.show(store.get().route.section);

// ----- Scene 3D (dimuat dinamis) -----
let readyResolve;
const ready = new Promise((r) => (readyResolve = r));

async function initScene() {
  const container = document.getElementById('viewport');
  const fallback = document.getElementById('webgl-fallback');
  try {
    const mod = await import('./scene/index.js');
    scene = mod.createScene(container, {
      params: model.params,
      options: store.get().view,
      onPick: (info) => ui.onPick?.(info),
    });
    scene.setCamera(store.get().view.camera, { instant: true });
    scene.frame(view, 0, false, true);
  } catch (err) {
    console.info('Scene 3D tidak tersedia:', err?.message ?? err);
    scene = null;
    if (fallback) fallback.hidden = false;
  }
}

let lastTs = null;
function frame(ts) {
  const dt = lastTs == null ? 0 : Math.min((ts - lastTs) / 1000, 0.25);
  lastTs = ts;
  const s = store.get();
  if (s.playing) {
    const n = stepper.tick(dt, s.speedHps);
    if (n > 0) {
      if (n > 1) advance(model, n - 1);
      prev = snapshot(model);
      next = advance(model, 1);
      afterStep();
    }
    view = isFinished(model) ? next : lerpSnapshot(prev, next, stepper.frac);
    if (s.status.slow !== stepper.dropped && stepper.dropped) store.patch('status', { slow: true });
  } else {
    view = next;
  }
  ui.onFrame(view);
  if (scene && store.get().route.view === 'sim') scene.frame(view, dt, s.playing, false);
  if (!document.body.dataset.ready) {
    document.body.dataset.ready = '1';
    readyResolve(true);
  }
  requestAnimationFrame(frame);
}

initScene().finally(() => requestAnimationFrame(frame));

// ----- Hook tes / konsol -----
window.wmApp = {
  version: APP_VERSION,
  ready,
  store,
  actions,
  get model() {
    return model;
  },
  stepHours,
  stepDays: (n) => stepHours(24 * n),
  getSnapshot: () => next,
  setScenario: (id) => actions.setScenario(id),
  renderInfo: () => (scene ? scene.renderInfo() : { webgl2: false, calls: 0, triangles: 0 }),
  renderOnce: () => scene?.frame(view, 0, false, true),
  /** Jumlah warna berbeda pada kisi 16×16 piksel kanvas (cek bahwa scene tidak kosong). */
  sampleColors() {
    if (!scene) return 0;
    scene.frame(view, 0, false, true);
    const src = scene.canvas;
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0, 16, 16);
    const data = ctx.getImageData(0, 0, 16, 16).data;
    const set = new Set();
    for (let i = 0; i < data.length; i += 4) set.add(`${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`);
    return set.size;
  },
};
