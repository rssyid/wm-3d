// STUB UI — akan diganti implementasi lengkap (M2). Antarmuka: lihat docs/kontrak.md.
import { fmt, fmtDay, fmtElevCm, fmtQ } from './format.js';

export function createUI({ store, actions, meta, roots }) {
  roots.simBar.innerHTML = `
    <label class="visually-hidden" for="skenario">Skenario</label>
    <select id="skenario">${meta.scenarios.map((s) => `<option value="${s.id}">${s.label}</option>`).join('')}<option value="manual">Manual</option></select>
    <button id="btn-play" type="button">▶ Jalankan</button>
    <button id="btn-step" type="button">⏭ +1 hari</button>
    <span id="clock" class="num"></span>`;
  const sel = roots.simBar.querySelector('#skenario');
  sel.value = store.get().scenarioId;
  sel.addEventListener('change', () => actions.setScenario(sel.value));
  const play = roots.simBar.querySelector('#btn-play');
  play.addEventListener('click', () => actions.togglePlay());
  roots.simBar.querySelector('#btn-step').addEventListener('click', () => actions.stepDay());
  const clock = roots.simBar.querySelector('#clock');
  roots.right.innerHTML = '<div id="kpi" class="num" style="padding:16px"></div>';
  const kpi = roots.right.querySelector('#kpi');
  store.subscribe((s) => (play.textContent = s.playing ? '⏸ Jeda' : '▶ Jalankan'));
  return {
    onFrame(view) {
      clock.textContent = fmtDay(view);
      kpi.innerHTML = `<p>TMAT titik penaatan: ${fmtElevCm(view.ind.tpDepthCm)} (${view.ind.cls.label})</p>
        <p>TMAS: ${fmtElevCm(view.canal.tmasCm)}</p><p>Pembuangan: ${fmtQ(view.structure.q_m3s)}</p>`;
    },
    onStep() {},
    onDay() {},
    onReset() {},
  };
}
