// Tab "Tabel": tabel harian (terbaru di atas, kepala lengket) + tombol "Salin CSV".
// Clipboard dipanggil langsung di dalam handler klik; bila ditolak, teks CSV ditampilkan
// di textarea dan dipilih agar bisa disalin manual (tanpa unduhan berkas).
import { fmt, fmtSigned } from './format.js';
import { S } from './strings.id.js';
import { esc } from './dom.js';
import { dailyRows, buildCsv } from './csv.js';
import { ICONS } from './icons.js';

const MAX_ROWS = 400; // tabel di layar; CSV selalu memuat semua hari

/** HTML satu baris tabel (string; nilai dari model sudah berupa angka/label tetap). */
export function rowHtml(r, ids, tpId) {
  const pz = ids
    .map((id) => `<td class="${id === tpId ? 'is-tp' : ''}">${esc(fmtSigned(r.elev[id], 0))}</td>`)
    .join('');
  const pp = r.pp
    ? `<td class="pp-ok"><span aria-hidden="true">✓</span> ${S.table.ppOk}</td>`
    : `<td class="pp-bad"><span aria-hidden="true">✗</span> ${S.table.ppBad}</td>`;
  return (
    `<tr${r.partial ? ' class="is-partial"' : ''}>` +
    `<th scope="row">${r.day}</th>` +
    `<td class="t-date">${esc(r.date)}${r.partial ? ` <span class="t-run">${S.chart.running}</span>` : ''}</td>` +
    `<td>${fmt(r.rain, 1)}</td>` +
    pz +
    `<td>${esc(fmtSigned(r.tmas, 0))}</td>` +
    `<td>${esc(fmt(r.q_m3s, 3))}</td>` +
    `<td>${esc(fmtSigned(r.q_mmd, 1))}</td>` +
    `<td>${r.nLogs}</td>` +
    `<td class="t-cls"><span class="swatch st-${esc(r.cls.id)}" aria-hidden="true"></span>${esc(r.cls.label)}</td>` +
    pp +
    '</tr>'
  );
}

export function createTable(container, { meta }) {
  const T = S.table;
  const C = S.chart;
  const ids = (meta.piezometers ?? []).map((p) => p.id);

  const wrap = document.createElement('div');
  wrap.className = 'tbl-view';
  wrap.innerHTML = `
    <div class="tbl-fallback" hidden>
      <label for="csv-text" class="tbl-fallback-msg"></label>
      <textarea id="csv-text" readonly spellcheck="false" rows="4"></textarea>
      <button type="button" class="ui-btn ui-btn-sm tbl-fallback-close">${S.overlay.close}</button>
    </div>
    <div class="tbl-scroll" tabindex="0" role="region" aria-label="${T.caption}">
      <table class="data-table">
        <caption class="visually-hidden">${T.caption}</caption>
        <thead><tr>
          <th scope="col">${T.day}</th>
          <th scope="col">${T.date}</th>
          <th scope="col">${T.rain}</th>
          ${ids.map((id) => `<th scope="col" data-pz="${esc(id)}">${esc(id)} <span class="th-unit">(cm)</span></th>`).join('')}
          <th scope="col">${T.tmas}</th>
          <th scope="col">${T.q}</th>
          <th scope="col">${T.qmm}</th>
          <th scope="col">${T.logs}</th>
          <th scope="col">${T.cls}</th>
          <th scope="col">${T.pp}</th>
        </tr></thead>
        <tbody></tbody>
      </table>
      <p class="tbl-empty">${C.empty}</p>
    </div>
    <p class="tbl-note"></p>`;
  container.append(wrap);

  // Toolbar (dipasang oleh index.js di kepala panel bawah).
  const tools = document.createElement('div');
  tools.className = 'tbl-tools';
  tools.innerHTML = `
    <span class="tbl-status" role="status" aria-live="polite"></span>
    <button type="button" id="btn-copy-csv" class="ui-btn ui-btn-sm">${ICONS.copy}<span>${C.copy}</span></button>`;

  const tbody = wrap.querySelector('tbody');
  const empty = wrap.querySelector('.tbl-empty');
  const note = wrap.querySelector('.tbl-note');
  const fb = wrap.querySelector('.tbl-fallback');
  const fbText = fb.querySelector('textarea');
  const fbMsg = fb.querySelector('.tbl-fallback-msg');
  const status = tools.querySelector('.tbl-status');
  const btnCopy = tools.querySelector('#btn-copy-csv');
  const thPz = Object.fromEntries([...wrap.querySelectorAll('th[data-pz]')].map((th) => [th.dataset.pz, th]));

  let series = null;
  let dirty = true;
  let visible = false;
  let lastRender = 0;
  let timer = 0;
  let statusTimer = 0;

  function render() {
    timer = 0;
    dirty = false;
    lastRender = performance.now();
    const n = series?.n ?? 0;
    empty.hidden = n > 0;
    const tpId = series?.tpId ?? 'P3';
    for (const [id, th] of Object.entries(thPz)) th.classList.toggle('is-tp', id === tpId);
    if (!n) {
      tbody.textContent = '';
      note.textContent = '';
      return;
    }
    const rows = dailyRows(series);
    const from = Math.max(0, rows.length - MAX_ROWS);
    let html = '';
    for (let i = rows.length - 1; i >= from; i--) html += rowHtml(rows[i], ids, tpId);
    tbody.innerHTML = html;
    note.textContent = from > 0 ? `${C.tableNote} ${T.truncated(MAX_ROWS, rows.length)}` : C.tableNote;
  }

  /** Render segera bila tampak; saat simulasi berjalan cepat, dibatasi ±3×/detik. */
  function schedule() {
    dirty = true;
    if (!visible || timer) return;
    const wait = Math.max(0, 300 - (performance.now() - lastRender));
    if (wait === 0) render();
    else timer = setTimeout(render, wait);
  }

  function setStatus(text) {
    status.textContent = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => (status.textContent = ''), 4000);
  }

  function showFallback(text) {
    fbMsg.textContent = C.copyFallback;
    fbText.value = text;
    fb.hidden = false;
    fbText.focus();
    fbText.select();
  }

  btnCopy.addEventListener('click', () => {
    const text = buildCsv(series ?? { n: 0, piezometerIds: ids });
    const n = series?.n ?? 0;
    const ok = () => {
      fb.hidden = true;
      setStatus(C.copied(n));
    };
    try {
      const p = navigator.clipboard?.writeText?.(text);
      if (p && typeof p.then === 'function') p.then(ok, () => showFallback(text));
      else showFallback(text);
    } catch {
      showFallback(text);
    }
  });
  fb.querySelector('.tbl-fallback-close').addEventListener('click', () => {
    fb.hidden = true;
    btnCopy.focus();
  });

  return {
    root: wrap,
    tools,
    setData(s) {
      series = s;
      schedule();
    },
    setVisible(v) {
      visible = v;
      if (v && dirty) render();
    },
  };
}
