// Bilah simulasi (atas), panel kontrol kiri, dan pintasan keyboard.
// Semua kontrol hanya menulis ke store / memanggil actions; main.js yang menerapkan ke model & scene.
import { crestLevel, safeMaxLogs } from '../model/index.js';
import { fmt, fmtDay, fmtElevCm } from './format.js';
import { S, MONTHS_LONG } from './strings.id.js';
import { esc, textSlot } from './dom.js';
import { ICONS } from './icons.js';

const MANUAL_RANGES = Object.freeze({
  rainMmd: { min: 0, max: 200, step: 1, digits: 0, unit: 'mm/hari' },
  etpMmd: { min: 2, max: 6, step: 0.1, digits: 1, unit: 'mm/hari' },
  riverM: { min: -3, max: -0.15, step: 0.05, digits: 2, unit: 'm' },
});

function metaFor(meta, path, fallback) {
  return meta.paramMeta?.find?.((p) => p.path === path) ?? fallback;
}

/** Teks mercu: "mercu −40 cm" (relatif tanggul saluran). */
export function crestText(nLogs, weir) {
  const crestM = crestLevel(nLogs, weir);
  return S.left.crest(fmtElevCm(-crestM * 100));
}

function rangeField(id, label, { min, max, step }, hint = '') {
  return `<div class="ctl-field">
    <div class="ctl-row"><label for="${id}">${esc(label)}</label><output id="${id}-out" for="${id}" class="ctl-out"></output></div>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}">
    ${hint ? `<p class="ctl-hint">${esc(hint)}</p>` : ''}
  </div>`;
}

function checkField(id, label) {
  return `<label class="ctl-check" for="${id}"><input type="checkbox" id="${id}"><span>${esc(label)}</span></label>`;
}

export function createControls({ store, actions, meta, simBar, left }) {
  const L = S.left;
  const SB = S.simBar;
  const nMax = meta.weir?.nMax ?? 9;

  // ---------------- bilah simulasi ----------------
  const scenarioOpts = meta.scenarios
    .map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`)
    .join('');
  const speedOpts = meta.speeds.map((s) => `<option value="${s.hps}">${esc(s.label)}</option>`).join('');
  simBar.innerHTML = `
    <div class="sb-field sb-scenario">
      <label for="skenario">${SB.scenario}</label>
      <select id="skenario">${scenarioOpts}<option value="manual">${SB.manual}</option></select>
    </div>
    <div class="sb-transport" role="group" aria-label="${SB.transport}">
      <button id="btn-play" type="button" class="ui-btn ui-btn-primary" aria-pressed="false" title="${SB.playTitle}">
        <span class="sb-play-ico">${ICONS.play}</span><span class="sb-play-lbl">${SB.play}</span>
      </button>
      <button id="btn-step" type="button" class="ui-btn" title="${SB.stepTitle}">${ICONS.step}<span>+1 hari</span></button>
      <button id="btn-reset" type="button" class="ui-btn" title="${SB.resetTitle}">${ICONS.reset}<span>Ulang</span></button>
    </div>
    <div class="sb-field sb-speed">
      <label for="kecepatan">${SB.speed}</label>
      <select id="kecepatan">${speedOpts}</select>
    </div>
    <div class="sb-status">
      <span class="visually-hidden">${SB.clockLabel}:</span>
      <span id="clock" class="sb-clock"></span>
      <span class="ui-chip ui-chip-done" id="chip-selesai" title="${SB.finishedTitle}" hidden>${SB.finished}</span>
      <span class="ui-chip ui-chip-slow" id="chip-melambat" title="${SB.slowTitle}" hidden>${SB.slow}</span>
    </div>`;

  const $ = (sel, root = simBar) => root.querySelector(sel);
  const selScenario = $('#skenario');
  const btnPlay = $('#btn-play');
  const playIco = $('.sb-play-ico');
  const playLbl = $('.sb-play-lbl');
  const btnStep = $('#btn-step');
  const btnReset = $('#btn-reset');
  const selSpeed = $('#kecepatan');
  const clock = textSlot($('#clock'));
  const chipDone = $('#chip-selesai');
  const chipSlow = $('#chip-melambat');

  const clearSlow = () => {
    if (store.get().status.slow) store.patch('status', { slow: false });
  };

  selScenario.addEventListener('change', () => actions.setScenario(selScenario.value));
  btnPlay.addEventListener('click', () => {
    actions.togglePlay();
    if (!store.get().playing) clearSlow();
  });
  btnStep.addEventListener('click', () => actions.stepDay());
  btnReset.addEventListener('click', () => {
    clearSlow();
    actions.reset();
  });
  selSpeed.addEventListener('change', () => {
    store.set({ speedHps: Number(selSpeed.value) });
    clearSlow();
  });

  // ---------------- panel kiri ----------------
  const hdMeta = metaFor(meta, 'geom.Hd', { min: 0, max: 1, step: 0.05 });
  const ksMeta = metaFor(meta, 'peat.Ks', { min: 20, max: 500, step: 10 });
  const ve = meta.ve ?? { min: 1, max: 20, step: 1 };
  const targetOpts = Object.values(meta.controlTargets ?? {})
    .map((t) => `<option value="${esc(t.id)}" title="${esc(t.label)}">${esc(L.targetLabels?.[t.id] ?? t.label)}</option>`)
    .join('');
  const tpOpts = (meta.piezometers ?? [])
    .map((p) => `<option value="${esc(p.id)}"${p.note ? ` title="${esc(p.note)}"` : ''}>${esc(L.tpOption(p.name, fmt(p.x, 0)))}</option>`)
    .join('');
  const qualityOpts = (meta.quality ?? []).map((q) => `<option value="${esc(q.id)}">${esc(q.label)}</option>`).join('');
  const stack = Array.from({ length: nMax }, (_, i) => `<span data-i="${nMax - 1 - i}"></span>`).join('');

  left.innerHTML = `
    <h2 class="visually-hidden">${L.title}</h2>
    <fieldset class="ctl-group" id="grp-skenario">
      <legend>${L.scenario}</legend>
      <div class="sc-card">
        <p class="sc-title"></p>
        <p class="sc-meta"></p>
        <p class="sc-desc"></p>
        <p class="sc-hint" hidden>${L.pausedHint}</p>
      </div>
    </fieldset>

    <fieldset class="ctl-group" id="grp-hujan">
      <legend>${L.rain}</legend>
      <div data-mode="scenario">${rangeField('rain-scale', L.rainScale, { min: 0.5, max: 1.5, step: 0.05 }, L.rainScaleHint)}</div>
      <div data-mode="manual" hidden>
        ${rangeField('manual-rain', L.manualRain, MANUAL_RANGES.rainMmd)}
        ${rangeField('manual-etp', L.manualEtp, MANUAL_RANGES.etpMmd)}
        ${rangeField('manual-river', L.manualRiver, MANUAL_RANGES.riverM, L.manualRiverHint)}
      </div>
    </fieldset>

    <fieldset class="ctl-group" id="grp-pintu">
      <legend>${L.gate}</legend>
      <div class="ctl-row ctl-inline">
        <label for="gate-mode">${L.gateMode}</label>
        <select id="gate-mode"><option value="manual">${L.gateManual}</option><option value="auto">${L.gateAuto}</option></select>
      </div>
      <div class="stoplog">
        <div class="stoplog-main">
          <span class="ctl-label" id="stoplog-label">${L.stoplog}</span>
          <div class="stoplog-ctl" role="group" aria-labelledby="stoplog-label">
            <button type="button" id="stoplog-minus" class="ui-btn ui-btn-icon" aria-label="${L.stoplogMinus}" title="${L.stoplogMinus}">${ICONS.minus}</button>
            <output id="stoplog-count" class="stoplog-count" aria-live="polite"></output>
            <button type="button" id="stoplog-plus" class="ui-btn ui-btn-icon" aria-label="${L.stoplogPlus}" title="${L.stoplogPlus}">${ICONS.plus}</button>
          </div>
          <p class="stoplog-crest" id="stoplog-crest" title="${L.crestHint}"></p>
        </div>
        <div class="stoplog-stack" aria-hidden="true" title="${L.stoplog}">${stack}</div>
      </div>
      <p class="ctl-note" id="auto-note" hidden>${L.autoOverride}</p>
      ${checkField('flap-gate', L.flap)}
      <div class="ctl-field">
        <label for="gate-target" class="ctl-label">${L.target}</label>
        <select id="gate-target">${targetOpts}</select>
        <p class="ctl-hint" id="target-hint"><span data-f="band"></span> <span data-f="only-auto">${L.targetHint}</span></p>
      </div>
    </fieldset>

    <fieldset class="ctl-group" id="grp-lahan">
      <legend>${L.land}</legend>
      <details class="ctl-adv">
        <summary>${L.advanced}</summary>
        ${rangeField('land-hd', L.dome, hdMeta, L.domeHint)}
        ${checkField('land-drains', L.fieldDrains)}
        ${rangeField('land-ks', L.ks, ksMeta)}
        <div class="ctl-field">
          <label for="land-tp" class="ctl-label">${L.tp}</label>
          <select id="land-tp">${tpOpts}</select>
          <p class="ctl-hint">${L.tpHint}</p>
        </div>
      </details>
    </fieldset>

    <fieldset class="ctl-group" id="grp-tampilan">
      <legend>${L.view}</legend>
      ${rangeField('view-ve', L.ve, ve)}
      <div class="ctl-checks">
        ${checkField('view-labels', L.labels)}
        ${checkField('view-cutaway', L.cutaway)}
        ${checkField('view-particles', L.particles)}
      </div>
      <div class="ctl-row ctl-inline">
        <label for="view-quality">${L.quality}</label>
        <select id="view-quality">${qualityOpts}</select>
      </div>
    </fieldset>`;

  const q = (sel) => left.querySelector(sel);
  const sc = {
    title: textSlot(q('.sc-title')),
    meta: textSlot(q('.sc-meta')),
    desc: textSlot(q('.sc-desc')),
    hint: q('.sc-hint'),
  };
  const modeScenario = q('[data-mode="scenario"]');
  const modeManual = q('[data-mode="manual"]');
  const inputs = {
    rainScale: q('#rain-scale'),
    manRain: q('#manual-rain'),
    manEtp: q('#manual-etp'),
    manRiver: q('#manual-river'),
    gateMode: q('#gate-mode'),
    minus: q('#stoplog-minus'),
    plus: q('#stoplog-plus'),
    flap: q('#flap-gate'),
    target: q('#gate-target'),
    hd: q('#land-hd'),
    drains: q('#land-drains'),
    ks: q('#land-ks'),
    tp: q('#land-tp'),
    ve: q('#view-ve'),
    labels: q('#view-labels'),
    cutaway: q('#view-cutaway'),
    particles: q('#view-particles'),
    quality: q('#view-quality'),
  };
  const outs = {
    rainScale: textSlot(q('#rain-scale-out')),
    manRain: textSlot(q('#manual-rain-out')),
    manEtp: textSlot(q('#manual-etp-out')),
    manRiver: textSlot(q('#manual-river-out')),
    hd: textSlot(q('#land-hd-out')),
    ks: textSlot(q('#land-ks-out')),
    ve: textSlot(q('#view-ve-out')),
  };
  const stoplogCount = textSlot(q('#stoplog-count'));
  const stoplogCrest = textSlot(q('#stoplog-crest'));
  const stackBars = [...q('.stoplog-stack').children];
  const autoNote = q('#auto-note');
  const targetBand = textSlot(q('#target-hint [data-f="band"]'));
  const targetOnlyAuto = q('#target-hint [data-f="only-auto"]');
  /** Teks pita target: pita perusahaan [45,60] = kategori Normal 46–60 cm (bilangan bulat). */
  const bandText = (id) => {
    const t = meta.controlTargets?.[id];
    if (!t) return '';
    const lo = id === 'perusahaan' ? t.band[0] + 1 : t.band[0];
    return L.targetBand(fmt(lo, 0), fmt(t.band[1], 0), safeMaxLogs(meta.weir ?? { zSill: -2, plank: 0.2, nMax }, 0, id));
  };

  const fmtOut = {
    rainScale: (v) => `×${fmt(v, 2)}`,
    manRain: (v) => `${fmt(v, 0)} mm/hari`,
    manEtp: (v) => `${fmt(v, 1)} mm/hari`,
    manRiver: (v) => `${fmt(v, 2)} m`,
    hd: (v) => `${fmt(v, 2)} m`,
    ks: (v) => `${fmt(v, 0)} m/hari`,
    ve: (v) => `×${fmt(v, 0)}`,
  };

  // input → store
  const num = (node) => Number(node.value);
  inputs.rainScale.addEventListener('input', () => store.set({ rainScale: num(inputs.rainScale) }));
  inputs.manRain.addEventListener('input', () => store.patch('manual', { rainMmd: num(inputs.manRain) }));
  inputs.manEtp.addEventListener('input', () => store.patch('manual', { etpMmd: num(inputs.manEtp) }));
  inputs.manRiver.addEventListener('input', () => store.patch('manual', { riverM: num(inputs.manRiver) }));
  inputs.gateMode.addEventListener('change', () => store.patch('gate', { mode: inputs.gateMode.value }));
  const bump = (d) => {
    const n = store.get().gate.nLogs;
    const v = Math.min(nMax, Math.max(0, n + d));
    if (v !== n) store.patch('gate', { nLogs: v });
  };
  inputs.minus.addEventListener('click', () => bump(-1));
  inputs.plus.addEventListener('click', () => bump(+1));
  inputs.flap.addEventListener('change', () => store.patch('gate', { flapGate: inputs.flap.checked }));
  inputs.target.addEventListener('change', () => store.patch('gate', { target: inputs.target.value }));
  // Kubah & K: label diperbarui saat digeser, model diubah saat dilepas (membangun ulang geometri scene mahal).
  inputs.hd.addEventListener('input', () => outs.hd.set(fmtOut.hd(num(inputs.hd))));
  inputs.hd.addEventListener('change', () => store.patch('land', { Hd: num(inputs.hd) }));
  inputs.ks.addEventListener('input', () => outs.ks.set(fmtOut.ks(num(inputs.ks))));
  inputs.ks.addEventListener('change', () => store.patch('land', { Ks: num(inputs.ks) }));
  inputs.drains.addEventListener('change', () => store.patch('land', { fieldDrains: inputs.drains.checked }));
  inputs.tp.addEventListener('change', () => store.patch('land', { tpId: inputs.tp.value }));
  inputs.ve.addEventListener('input', () => store.patch('view', { ve: num(inputs.ve) }));
  inputs.labels.addEventListener('change', () => store.patch('view', { labels: inputs.labels.checked }));
  inputs.cutaway.addEventListener('change', () => store.patch('view', { cutaway: inputs.cutaway.checked }));
  inputs.particles.addEventListener('change', () => store.patch('view', { particles: inputs.particles.checked }));
  inputs.quality.addEventListener('change', () => store.patch('view', { quality: inputs.quality.value }));

  const setVal = (node, v) => {
    const s = String(v);
    if (node.value !== s) node.value = s;
  };
  const setChecked = (node, v) => {
    if (node.checked !== !!v) node.checked = !!v;
  };

  function scenarioInfo(id) {
    if (id === 'manual') return { title: L.manualTitle, meta: L.endless, desc: L.manualDesc };
    const s = meta.scenarios.find((x) => x.id === id);
    if (!s) return { title: id, meta: '', desc: '' };
    return {
      title: s.label,
      meta: `${L.days(fmt(s.days, 0))} · ${L.startsIn(MONTHS_LONG[s.startMonth] ?? '')}`,
      desc: s.description ?? '',
    };
  }

  /** Menyelaraskan semua kontrol dengan state store. */
  function sync(s) {
    // bilah atas
    setVal(selScenario, s.scenarioId);
    setVal(selSpeed, s.speedHps);
    const playing = !!s.playing;
    if (btnPlay.getAttribute('aria-pressed') !== String(playing)) {
      btnPlay.setAttribute('aria-pressed', String(playing));
      playIco.innerHTML = playing ? ICONS.pause : ICONS.play;
      playLbl.textContent = playing ? SB.pause : SB.play;
    }
    const finished = !!s.status?.finished;
    btnPlay.disabled = finished && !playing;
    btnStep.disabled = finished;
    btnPlay.title = finished ? SB.finishedTitle : SB.playTitle;
    chipDone.hidden = !finished;
    chipSlow.hidden = !s.status?.slow;

    // skenario
    const info = scenarioInfo(s.scenarioId);
    sc.title.set(info.title);
    sc.meta.set(info.meta);
    sc.desc.set(info.desc);
    const manual = s.scenarioId === 'manual';
    modeScenario.hidden = manual;
    modeManual.hidden = !manual;

    // hujan
    setVal(inputs.rainScale, s.rainScale);
    outs.rainScale.set(fmtOut.rainScale(s.rainScale));
    setVal(inputs.manRain, s.manual.rainMmd);
    outs.manRain.set(fmtOut.manRain(s.manual.rainMmd));
    setVal(inputs.manEtp, s.manual.etpMmd);
    outs.manEtp.set(fmtOut.manEtp(s.manual.etpMmd));
    setVal(inputs.manRiver, s.manual.riverM);
    outs.manRiver.set(fmtOut.manRiver(s.manual.riverM));

    // pintu air
    const g = s.gate;
    setVal(inputs.gateMode, g.mode);
    stoplogCount.set(String(g.nLogs));
    stoplogCrest.set(crestText(g.nLogs, meta.weir));
    inputs.minus.disabled = g.nLogs <= 0;
    inputs.plus.disabled = g.nLogs >= nMax;
    stackBars.forEach((b) => b.classList.toggle('on', Number(b.dataset.i) < g.nLogs));
    autoNote.hidden = g.mode !== 'auto';
    setChecked(inputs.flap, g.flapGate);
    setVal(inputs.target, g.target);
    targetBand.set(bandText(g.target));
    targetOnlyAuto.hidden = g.mode === 'auto';

    // lahan
    const land = s.land;
    if (document.activeElement !== inputs.hd) {
      setVal(inputs.hd, land.Hd);
      outs.hd.set(fmtOut.hd(land.Hd));
    }
    if (document.activeElement !== inputs.ks) {
      setVal(inputs.ks, land.Ks);
      outs.ks.set(fmtOut.ks(land.Ks));
    }
    setChecked(inputs.drains, land.fieldDrains);
    setVal(inputs.tp, land.tpId);

    // tampilan
    const v = s.view;
    setVal(inputs.ve, v.ve);
    outs.ve.set(fmtOut.ve(v.ve));
    setChecked(inputs.labels, v.labels);
    setChecked(inputs.cutaway, v.cutaway);
    setChecked(inputs.particles, v.particles);
    setVal(inputs.quality, v.quality);
  }

  let hintShown = null;
  function onFrame(view) {
    clock.set(fmtDay(view));
    const show = !store.get().playing && view.hourIndex === 0;
    if (show !== hintShown) {
      hintShown = show;
      sc.hint.hidden = !show;
    }
  }

  // ---------------- keyboard ----------------
  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    const tag = t?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON' || t?.isContentEditable) return;
    if (t?.closest?.('[data-own-keys]')) return; // wilayah yang memakai tombol panah sendiri (tabel bergulir)
    if (store.get().route?.view !== 'sim') return;
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      actions.togglePlay();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      actions.stepDay();
    } else if (e.key === 'r' || e.key === 'R') {
      actions.reset();
    } else if (e.key === 'c' || e.key === 'C') {
      const cams = meta.cameras ?? [];
      if (!cams.length) return;
      const i = cams.findIndex((c) => c.id === store.get().view.camera);
      actions.setCamera(cams[(i + 1) % cams.length].id);
    }
  }
  document.addEventListener('keydown', onKey);

  sync(store.get());
  return { sync, onFrame };
}

