// Panel kanan: badge kepatuhan (perusahaan & PP 57/2016), kartu KPI (hujan, TMAT, TMAS, pembuangan),
// risiko kebakaran, subsidensi, dan log aksi pintu air. Tulis DOM hanya bila teks berubah.
import { rainClass, hourlySeries, TMAT_CLASSES } from '../model/index.js';
import { fmt, fmtSigned, fmtElevCm, depthPhrase, fmtQ, fmtPct } from './format.js';
import { S } from './strings.id.js';
import { esc, textSlot, setStatusClass } from './dom.js';
import { ICONS } from './icons.js';

/** Teks perubahan muka air dari perubahan kedalaman (positif = lebih dalam = muka air turun). */
export function riseText(dDepthCm) {
  if (!Number.isFinite(dDepthCm)) return '';
  const dLevel = -dDepthCm;
  if (Math.abs(dLevel) < 0.5) return S.kpi.steady;
  return dLevel > 0 ? S.kpi.rise(fmt(dLevel, 0)) : S.kpi.fall(fmt(-dLevel, 0));
}

/** Arah pembuangan untuk KPI. */
export function flowDirection(st) {
  if (st.q_m3s < -1e-5) return { id: 'back', label: S.kpi.backflow };
  if (st.q_m3s > 1e-5) return { id: 'out', label: S.kpi.toRiver };
  return { id: 'none', label: st.flapGate && st.riverAboveCrest ? S.kpi.flapShut : S.kpi.noFlow };
}

/** Catatan khusus: kategori perusahaan dianggap baik/agak basah (Normal / Agak Tergenang) tetapi tidak patuh PP. */
export function tensionNote(cls, ppOk) {
  if (ppOk) return null;
  if (cls?.id === 'normal') return S.badge.tension(cls.label, cls.range);
  if (cls?.id === 'agak-tergenang') return S.badge.tensionWet(cls.label, cls.range);
  return null;
}

/** Kebalikannya: patuh PP, tetapi menurut perusahaan terlalu basah (Tergenang / Banjir). */
export function wetNote(cls, ppOk) {
  if (!ppOk) return null;
  if (cls?.id !== 'tergenang' && cls?.id !== 'banjir') return null;
  return S.badge.wetNote(cls.label, cls.range);
}

const capFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function chip(cls) {
  return `<span class="st st-${esc(cls.id)}" data-st="${esc(cls.id)}"><span class="st-ico" aria-hidden="true">${esc(cls.icon)}</span><span class="st-lbl">${esc(cls.label)}</span></span>`;
}

export function createKpi(root, { meta, actions }) {
  const K = S.kpi;
  const B = S.badge;
  const X = S.extra;
  const pz = meta.piezometers ?? [];
  const firstCls = TMAT_CLASSES[1];

  root.innerHTML = `
    <h2 class="visually-hidden">${K.title}</h2>
    <section class="rp-section rp-verdict" aria-label="Status di titik penaatan">
      <div class="badges">
        <div class="badge badge-company" data-badge="perusahaan">
          <p class="badge-label">${B.company}</p>
          <p class="badge-sub" data-f="company-sub"></p>
          <p class="badge-value" data-f="company-chip">${chip(firstCls)}</p>
          <p class="badge-foot" data-f="company-foot"></p>
        </div>
        <div class="badge badge-pp" data-badge="pp" data-ok="true">
          <p class="badge-label">${B.pp}</p>
          <p class="badge-sub">${B.ppSub}</p>
          <p class="badge-value pp-value"><span class="pp-ico" data-f="pp-ico">${ICONS.check}</span><span data-f="pp-lbl">${B.ok}</span></p>
          <p class="badge-foot" data-f="pp-foot"></p>
        </div>
      </div>
      <dl class="pp-strip">
        <div><dt>${B.pctDays}</dt><dd data-f="pp-pct"></dd></div>
        <div><dt>${B.longest}</dt><dd data-f="pp-streak"></dd></div>
      </dl>
      <p class="badge-basis">${B.basis}</p>
      <p class="tension" data-f="tension" hidden><span class="tension-ico" data-f="tension-ico">${ICONS.alert}</span><span data-f="tension-txt"></span></p>
    </section>

    <section class="rp-section rp-kpis" aria-label="Indikator utama">
      <article class="kpi" data-kpi="rain">
        <header class="kpi-head"><h3 class="kpi-title">${K.rain}<span class="kpi-sub">${K.rainSub}</span></h3><span class="kpi-tag" data-f="rain-cls"></span></header>
        <p class="kpi-value" data-f="rain-val"></p>
        <p class="kpi-detail" data-f="rain-int"></p>
      </article>

      <article class="kpi" data-kpi="tmat">
        <header class="kpi-head"><h3 class="kpi-title">${K.tmat}<span class="kpi-sub" data-f="tmat-sub"></span></h3><span data-f="tmat-chip">${chip(firstCls)}</span></header>
        <p class="kpi-value" data-f="tmat-val"></p>
        <p class="kpi-detail"><span data-f="tmat-phrase"></span></p>
        <p class="kpi-detail kpi-trend" data-f="tmat-rise"></p>
        <ul class="pz-list" aria-label="Piezometer P1–P4">
          ${pz
            .map(
              (p) => `<li data-pz="${esc(p.id)}"><span class="swatch" data-f="sw"></span><span class="pz-id">${esc(p.id)}</span><span class="pz-v" data-f="v"></span></li>`,
            )
            .join('')}
        </ul>
        <p class="kpi-detail kpi-muted"><span>${K.mean}</span> <span class="mono-num" data-f="tmat-mean"></span></p>
      </article>

      <article class="kpi" data-kpi="tmas">
        <header class="kpi-head"><h3 class="kpi-title">${K.tmas}<span class="kpi-sub">${K.tmasSub}</span></h3><span class="kpi-tag kpi-tag-sw"><span class="tag-sw" data-f="tmas-sw"></span><span data-f="tmas-cls"></span></span></header>
        <p class="kpi-value" data-f="tmas-val"></p>
        <p class="kpi-detail"><span>${K.gauge}</span> <span class="mono-num" data-f="tmas-gauge"></span></p>
        <p class="kpi-detail kpi-muted" data-f="tmas-crest"></p>
      </article>

      <article class="kpi" data-kpi="q">
        <header class="kpi-head"><h3 class="kpi-title">${K.q}<span class="kpi-sub">${K.qSub}</span></h3><span class="kpi-tag" data-f="q-dir"></span></header>
        <p class="kpi-value" data-f="q-val"></p>
        <p class="kpi-detail"><span class="mono-num" data-f="q-ls"></span> · <span class="mono-num" data-f="q-mmd"></span></p>
        <p class="kpi-flag" data-f="q-sub" title="${K.submergedTitle}" hidden>${K.submerged}</p>
      </article>
    </section>`;

  const extra = document.createElement('div');
  extra.className = 'rp-extra';
  extra.innerHTML = `
    <section class="rp-section mini-grid" aria-label="${X.fire} dan ${X.subs}">
      <article class="mini" data-kpi="fire">
        <h3 class="mini-title">${X.fire} <span class="tag-heur">${X.heuristic}</span></h3>
        <p class="mini-value"><span data-f="fire-val"></span><span class="mini-unit">/100</span></p>
        <div class="meter" aria-hidden="true"><span data-f="fire-bar"></span></div>
        <p class="mini-detail"><span data-f="fire-cls"></span> · <span data-f="fire-dry"></span></p>
      </article>
      <article class="mini" data-kpi="subs">
        <h3 class="mini-title">${X.subs} <span class="tag-heur">${X.heuristic}</span></h3>
        <p class="mini-value"><span data-f="subs-rate"></span><span class="mini-unit">${X.subsRate}</span></p>
        <p class="mini-detail"><span>${X.subsCum}</span> <span class="mono-num" data-f="subs-cum"></span></p>
      </article>
    </section>
    <section class="rp-section" aria-label="${X.log}">
      <h3 class="rp-h">${X.log}</h3>
      <ol class="log-list" data-f="log"><li class="log-empty">${X.logEmpty}</li></ol>
    </section>`;

  const f = (name, r = root) => r.querySelector(`[data-f="${name}"]`);
  const T = (name, r) => textSlot(f(name, r));

  const el = {
    companySub: T('company-sub'),
    companyChipBox: f('company-chip'),
    companyFoot: T('company-foot'),
    ppBadge: root.querySelector('[data-badge="pp"]'),
    ppIco: f('pp-ico'),
    ppLbl: T('pp-lbl'),
    ppPct: T('pp-pct'),
    ppFoot: T('pp-foot'),
    tensionIco: f('tension-ico'),
    ppStreak: T('pp-streak'),
    tension: f('tension'),
    tensionTxt: T('tension-txt'),
    rainCls: T('rain-cls'),
    rainVal: T('rain-val'),
    rainInt: T('rain-int'),
    tmatSub: T('tmat-sub'),
    tmatChipBox: f('tmat-chip'),
    tmatVal: T('tmat-val'),
    tmatPhrase: T('tmat-phrase'),
    tmatRise: T('tmat-rise'),
    tmatMean: T('tmat-mean'),
    tmasSw: f('tmas-sw'),
    tmasCls: T('tmas-cls'),
    tmasVal: T('tmas-val'),
    tmasGauge: T('tmas-gauge'),
    tmasCrest: T('tmas-crest'),
    qDir: T('q-dir'),
    qDirNode: f('q-dir'),
    qVal: T('q-val'),
    qLs: T('q-ls'),
    qMmd: T('q-mmd'),
    qSub: f('q-sub'),
    fireVal: T('fire-val', extra),
    fireBar: f('fire-bar', extra),
    fireCls: T('fire-cls', extra),
    fireDry: T('fire-dry', extra),
    subsRate: T('subs-rate', extra),
    subsCum: T('subs-cum', extra),
    log: f('log', extra),
  };
  const pzRows = Object.fromEntries(
    [...root.querySelectorAll('[data-pz]')].map((li) => [li.dataset.pz, { li, sw: f('sw', li), v: textSlot(f('v', li)) }]),
  );

  // Chip status: elemen .st yang kelasnya diganti bila kategori berubah.
  function chipUpdater(box) {
    const node = box.querySelector('.st');
    const ico = textSlot(node.querySelector('.st-ico'));
    const lbl = textSlot(node.querySelector('.st-lbl'));
    return (cls) => {
      setStatusClass(node, cls.id);
      ico.set(cls.icon);
      lbl.set(cls.label);
    };
  }
  const setCompanyChip = chipUpdater(el.companyChipBox);
  const setTmatChip = chipUpdater(el.tmatChipBox);

  let ppOkState = null;
  let lastLogKey = '';
  let lastTmasCls = '';
  let lastFireCls = '';
  let lastDir = '';
  let rise = '';
  let initTp = { k: 0, depth: NaN, id: null };
  let area = 306240; // luas total blok + saluran (m²); diperbarui dari explain().geometry.Atot

  /** Nilai kontinu dari view (terinterpolasi) — dipanggil tiap frame. */
  function onFrame(v) {
    // hujan
    const r24 = v.forcing.rain24h_mm;
    el.rainVal.set(`${fmt(r24, 1)} mm`);
    el.rainCls.set(rainClass(r24).label);
    el.rainInt.set(`${K.intensity} ${fmt(v.forcing.rain_mmh, 1)} mm/jam`);

    // TMAT
    const tp = v.piezometers.find((p) => p.isTP) ?? v.piezometers[0];
    el.tmatSub.set(K.tmatSub(tp.id));
    el.tmatVal.set(fmtElevCm(tp.depthCm));
    el.tmatPhrase.set(depthPhrase(tp.depthCm));
    setTmatChip(v.ind.cls);
    let sum = 0;
    for (const p of v.piezometers) {
      sum += p.depthCm;
      const row = pzRows[p.id];
      if (!row) continue;
      row.v.set(fmtElevCm(p.depthCm));
      setStatusClass(row.sw, p.cls.id);
      row.li.classList.toggle('is-tp', !!p.isTP);
    }
    el.tmatMean.set(fmtElevCm(sum / v.piezometers.length));
    el.tmatRise.set(rise);

    // TMAS
    const c = v.canal;
    el.tmasVal.set(fmtElevCm(c.tmasCm));
    el.tmasGauge.set(`${fmtSigned(c.gaugeReadingCm, 0)} cm`);
    if (c.tmasCls.id !== lastTmasCls) {
      lastTmasCls = c.tmasCls.id;
      el.tmasSw.style.background = c.tmasCls.color;
      el.tmasCls.set(c.tmasCls.label);
    }
    const st = v.structure;
    el.tmasCrest.set(K.crestLogs(fmtElevCm(-st.crestM * 100), st.nLogs, st.nMax));

    // pembuangan
    el.qVal.set(fmtQ(st.q_m3s));
    el.qLs.set(`${fmt(st.q_m3s * 1000, 1)} L/s`); // dari q_m3s terinterpolasi, konsisten dengan m³/s
    el.qMmd.set(`${fmt((st.q_m3s * 86400 * 1000) / area, 1)} mm/hari`);
    const dir = flowDirection(st);
    el.qDir.set(dir.label);
    if (dir.id !== lastDir) {
      lastDir = dir.id;
      el.qDirNode.dataset.dir = dir.id;
    }
    const sub = !!st.submerged && st.q_m3s !== 0;
    if (el.qSub.hidden === sub) el.qSub.hidden = !sub;
  }

  /** Nilai diskret dari snapshot — dipanggil setelah model maju / kontrol berubah. */
  function onStep(s, ctx = {}) {
    if (ctx.Atot > 0) area = ctx.Atot;
    const ind = s.ind;
    // badge perusahaan
    el.companySub.set(B.companySub(ind.tpId));
    setCompanyChip(ind.cls);
    el.companyFoot.set(`${ind.cls.range} · ${fmtElevCm(ind.tpDepthCm)}`);
    // badge PP
    const ok = !!ind.pp.now;
    if (ok !== ppOkState) {
      ppOkState = ok;
      el.ppBadge.dataset.ok = String(ok);
      el.ppIco.innerHTML = ok ? ICONS.check : ICONS.cross;
      el.ppLbl.set(ok ? B.ok : B.bad);
    }
    el.ppPct.set(ind.pp.daysCounted ? B.pctValue(fmtPct(ind.pp.pctDays), fmt(ind.pp.compliantDays, 0), fmt(ind.pp.daysCounted, 0)) : B.noDays);
    el.ppStreak.set(B.days(fmt(ind.pp.longestStreak, 0)));
    el.ppFoot.set(Number.isFinite(ind.pp.lastDayMeanCm) ? B.lastDay(fmtElevCm(ind.pp.lastDayMeanCm).replace(' ', '\u00a0')) : `${fmtElevCm(ind.tpDepthCm)} · batas ${fmtElevCm(ind.pp.limitCm ?? 40)}`);
    const warn = tensionNote(ind.cls, ok);
    const note = warn ?? wetNote(ind.cls, ok);
    if (el.tension.hidden !== !note) el.tension.hidden = !note;
    if (note) {
      el.tensionTxt.set(note);
      const tone = warn ? 'warn' : 'info';
      if (el.tension.dataset.tone !== tone) {
        el.tension.dataset.tone = tone;
        el.tensionIco.innerHTML = warn ? ICONS.alert : ICONS.info;
      }
    }

    // risiko kebakaran & subsidensi
    const fire = ind.fire;
    el.fireVal.set(fmt(fire.index, 0));
    el.fireBar.style.width = `${Math.max(0, Math.min(100, fire.index)).toFixed(1)}%`;
    if (fire.cls.id !== lastFireCls) {
      lastFireCls = fire.cls.id;
      el.fireBar.style.background = fire.cls.color;
    }
    el.fireCls.set(fire.cls.label);
    el.fireDry.set(X.drySpell(fmt(fire.drySpellDays, 0)));
    el.subsRate.set(fmt(ind.subs.rate, 1));
    el.subsCum.set(`${fmt(ind.subs.cumCm, 2)} cm`);

    // perubahan muka air 24 jam di titik penaatan
    rise = computeRise(s);

    // log aksi pintu air
    const log = s.control.log ?? [];
    const last = log[log.length - 1];
    const key = `${log.length}|${last?.day}|${last?.text}`;
    if (key !== lastLogKey) {
      lastLogKey = key;
      renderLog(log);
    }
  }

  function computeRise(s) {
    const k = s.hourIndex;
    const tp = s.piezometers.find((p) => p.isTP) ?? s.piezometers[0];
    if (k < 24) return '';
    let then = NaN;
    if (k === 24 && initTp.id === tp.id) then = initTp.depth;
    else {
      const m = actions.getModel?.();
      if (!m) return '';
      const hs = hourlySeries(m, 25);
      const i = hs.k.indexOf(k - 24);
      if (i >= 0) then = hs.tpDepthCm[i];
    }
    return riseText(tp.depthCm - then);
  }

  function renderLog(log) {
    const list = el.log;
    list.textContent = '';
    if (!log.length) {
      const li = document.createElement('li');
      li.className = 'log-empty';
      li.textContent = X.logEmpty;
      list.append(li);
      return;
    }
    for (let i = log.length - 1; i >= Math.max(0, log.length - 30); i--) {
      const e = log[i];
      const li = document.createElement('li');
      li.className = `log-item log-${e.type}`;
      const when = document.createElement('span');
      when.className = 'log-when';
      when.textContent = e.dateLabel;
      const who = document.createElement('span');
      who.className = 'log-who';
      who.textContent = e.auto ? X.auto : X.manual;
      const what = document.createElement('span');
      what.className = 'log-what';
      what.textContent = e.auto ? e.text : capFirst(String(e.text ?? '').replace(/^Manual:\s*/i, '')); // "Manual" sudah di kolom pelaku
      li.append(when, who, what);
      list.append(li);
    }
  }

  function onReset(s) {
    const tp = s.piezometers.find((p) => p.isTP) ?? s.piezometers[0];
    initTp = { k: s.hourIndex, depth: tp.depthCm, id: tp.id };
    rise = '';
    lastLogKey = '';
  }

  return { onFrame, onStep, onReset, extra };
}
