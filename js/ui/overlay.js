// Lapisan di atas viewport 3D: tombol preset kamera, legenda kategori TMAT perusahaan, cap skala,
// dan kartu detail saat objek 3D diklik (onPick). Kontainer tidak menangkap pointer — hanya kontrolnya —
// sehingga orbit kamera tetap bisa diseret di area kosong.
import { fmt, fmtSigned, fmtElevCm, depthPhrase, fmtQ } from './format.js';
import { S } from './strings.id.js';
import { esc, textSlot } from './dom.js';
import { ICONS } from './icons.js';

/** Posisi kartu (px relatif viewport) dari koordinat klik, dijaga tetap di dalam viewport. */
export function placeCard(px, py, cardW, cardH, vw, vh, margin = 8, offset = 14) {
  let x = px + offset;
  let y = py + offset;
  if (x + cardW > vw - margin) x = px - offset - cardW;
  if (y + cardH > vh - margin) y = vh - margin - cardH;
  x = Math.max(margin, Math.min(x, vw - margin - cardW));
  y = Math.max(margin, y);
  return { x: Math.round(x), y: Math.round(y) };
}

/** Isi kartu detail: {title, sub, rows:[[label, value, chip?]]} dari snapshot. */
export function pickContent(info, snap) {
  const P = S.pick;
  if (!snap) return null;
  const st = snap.structure;
  const yesNo = (b) => (b ? P.yes : P.no);
  switch (info?.type) {
    case 'piezometer': {
      const p = snap.piezometers.find((x) => x.id === info.id) ?? snap.piezometers.find((x) => x.isTP) ?? snap.piezometers[0];
      return {
        title: P.piezometer(p.id),
        sub: [P.distance(fmt(p.x, 0)), p.note].filter(Boolean).join(' · '),
        rows: [
          [P.tmat, `${fmtElevCm(p.depthCm)}`, null, depthPhrase(p.depthCm)],
          [P.category, p.cls.label, p.cls],
          [P.pp, p.ppCompliant ? S.badge.ok : S.badge.bad, null, p.isTP ? P.isTp : P.notTp, p.ppCompliant ? 'ok' : 'bad'],
        ],
      };
    }
    case 'gauge': {
      const c = snap.canal;
      return {
        title: P.gauge,
        sub: P.gaugeSub,
        rows: [
          [P.tmas, fmtElevCm(c.tmasCm), null, c.tmasCls.label],
          [P.reading, `${fmtSigned(c.gaugeReadingCm, 0)} cm`, null, P.readingNote],
          [P.crest, fmtElevCm(-st.crestM * 100), null, `${st.nLogs} stoplog`],
        ],
      };
    }
    case 'gate':
      return {
        title: P.gate,
        sub: st.mode === 'auto' ? S.extra.auto : S.extra.manual,
        rows: [
          [P.logs, `${st.nLogs} / ${st.nMax}`, null, `${P.crest.toLowerCase()} ${fmtElevCm(-st.crestM * 100)}`],
          [P.q, fmtQ(st.q_m3s), null, `${fmt(st.q_m3s * 1000, 1)} L/s`],
          [P.head, `${fmt(st.headCm, 1)} cm`],
          [P.submerged, yesNo(st.submerged), null, st.flapGate ? P.flapOn : ''],
          [P.river, `${fmtSigned(snap.river.levelM, 2)} m`],
        ],
      };
    case 'section': {
      const pr = snap.profile;
      return {
        title: P.section,
        sub: P.sectionSub,
        rows: [
          [P.meanTmat, fmtElevCm(snap.ind.meanDepthCm), snap.ind.meanCls],
          [P.dome, `${fmt(pr.Hd, 2)} m`],
          [P.peat, `${fmt(pr.Hd - pr.peatBaseZ, 1)} m`, null, P.peatNote],
          [P.drains, pr.fieldDrains ? P.on : P.off],
        ],
      };
    }
    default:
      return null;
  }
}

export function createOverlay(viewport, { store, actions, meta }) {
  const O = S.overlay;
  const classes = meta.tmatClasses ?? [];
  const root = document.createElement('div');
  root.className = 'vp-overlay';
  const ppAfter = classes.findIndex((c) => c.id === 'tergenang');
  root.innerHTML = `
    <div class="vp-cams" role="group" aria-label="${O.cameras}">
      ${(meta.cameras ?? []).map((c) => `<button type="button" class="vp-cam" data-camera="${esc(c.id)}" aria-pressed="false">${esc(c.label)}</button>`).join('')}
    </div>
    <details class="vp-legend">
      <summary><span>${O.legend}</span></summary>
      <ul class="vp-legend-list">
        ${classes
          .map(
            (c, i) =>
              `<li><span class="swatch st-${esc(c.id)}" aria-hidden="true"></span><span class="lg-ico" aria-hidden="true">${esc(c.icon)}</span><span class="lg-name">${esc(c.label)}</span><span class="lg-range">${esc(c.range)}</span></li>` +
              (i === ppAfter ? `<li class="vp-pp" aria-label="${O.ppMark}"><span class="vp-pp-rule" aria-hidden="true"></span><span>${O.ppMark}</span></li>` : ''),
          )
          .join('')}
      </ul>
    </details>
    <p class="vp-stamp"><span data-f="ve"></span><span class="vp-stamp-sep" aria-hidden="true">·</span><span>${O.block}</span></p>
    <div class="vp-card" role="dialog" aria-modal="false" aria-labelledby="vp-card-title" tabindex="-1" hidden>
      <header class="vp-card-head">
        <div><h3 id="vp-card-title" class="vp-card-title"></h3><p class="vp-card-sub"></p></div>
        <button type="button" class="ui-btn ui-btn-icon ui-btn-ghost vp-card-close" aria-label="${O.close}" title="${O.close} (Esc)">${ICONS.close}</button>
      </header>
      <dl class="vp-card-rows"></dl>
    </div>`;
  viewport.append(root);

  const camBtns = [...root.querySelectorAll('[data-camera]')];
  for (const b of camBtns) b.addEventListener('click', () => actions.setCamera(b.dataset.camera));
  const legend = root.querySelector('.vp-legend');
  const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 899px)').matches;
  legend.open = !narrow;
  const ve = textSlot(root.querySelector('[data-f="ve"]'));

  const card = root.querySelector('.vp-card');
  const cardTitle = card.querySelector('.vp-card-title');
  const cardSub = card.querySelector('.vp-card-sub');
  const cardRows = card.querySelector('.vp-card-rows');
  let pick = null;
  let pos = { x: 0, y: 0 };
  let lastKey = '';

  function renderCard(snap) {
    const c = pickContent(pick, snap);
    if (!c) return false;
    const key = JSON.stringify(c);
    if (key === lastKey) return true;
    lastKey = key;
    cardTitle.textContent = c.title;
    cardSub.textContent = c.sub ?? '';
    cardSub.hidden = !c.sub;
    cardRows.textContent = '';
    for (const [label, value, cls, note, tone] of c.rows) {
      const row = document.createElement('div');
      row.className = 'vp-row';
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      if (cls) {
        const chip = document.createElement('span');
        chip.className = `st st-${cls.id}`;
        const ico = document.createElement('span');
        ico.setAttribute('aria-hidden', 'true');
        ico.textContent = cls.icon;
        chip.append(ico, document.createTextNode(` ${value}`));
        dd.append(chip);
      } else {
        const v = document.createElement('strong');
        v.className = tone ? `vp-v tone-${tone}` : 'vp-v';
        v.textContent = value;
        dd.append(v);
      }
      if (note) {
        const n = document.createElement('span');
        n.className = 'vp-note';
        n.textContent = note;
        dd.append(n);
      }
      row.append(dt, dd);
      cardRows.append(row);
    }
    return true;
  }

  function place() {
    const r = viewport.getBoundingClientRect();
    const { x, y } = placeCard(pos.x, pos.y, card.offsetWidth, card.offsetHeight, r.width, r.height);
    card.style.transform = `translate(${x}px, ${y}px)`;
  }

  function open(info, snap) {
    pick = info;
    lastKey = '';
    if (!renderCard(snap)) {
      close();
      return;
    }
    const r = viewport.getBoundingClientRect();
    const cx = Number(info.screenX);
    const cy = Number(info.screenY);
    // screenX/screenY = koordinat client (MouseEvent.clientX/Y); tanpa koordinat → pojok kanan atas
    pos = Number.isFinite(cx) && Number.isFinite(cy) ? { x: cx - r.left, y: cy - r.top } : { x: r.width, y: 0 };
    card.hidden = false;
    place();
  }

  function close() {
    if (card.hidden && !pick) return;
    pick = null;
    card.hidden = true;
  }

  card.querySelector('.vp-card-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !card.hidden) close();
  });

  function sync(s) {
    const cam = s.view.camera;
    for (const b of camBtns) {
      const on = String(b.dataset.camera === cam);
      if (b.getAttribute('aria-pressed') !== on) b.setAttribute('aria-pressed', on);
    }
    ve.set(O.ve(fmt(s.view.ve, 0)));
  }

  sync(store.get());
  return {
    sync,
    open,
    close,
    /** Perbarui angka kartu yang sedang terbuka. */
    update(snap) {
      if (pick && !card.hidden) renderCard(snap);
    },
  };
}
