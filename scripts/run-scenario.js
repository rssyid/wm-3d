#!/usr/bin/env node
// CLI kalibrasi: node scripts/run-scenario.js <skenario> [--every N] [--auto] [--n LOGS] [--scale X]
import { runScenario, SCENARIO_IDS } from '../js/model/index.js';

const args = process.argv.slice(2);
const id = args[0] ?? 'normal';
if (!SCENARIO_IDS.includes(id)) {
  console.error(`Skenario: ${SCENARIO_IDS.join(', ')}`);
  process.exit(1);
}
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const every = Number(opt('--every', 5));
const control = {};
if (args.includes('--auto')) control.mode = 'auto';
if (opt('--n')) control.nLogs = Number(opt('--n'));
const overrides = { control };
if (opt('--scale')) overrides.rainScale = Number(opt('--scale'));
if (opt('--hd')) overrides.params = { 'geom.Hd': Number(opt('--hd')) };

const t0 = performance.now();
const { series: s, balance, model } = runScenario(id, overrides);
const ms = performance.now() - t0;
const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—').padStart(7);
console.log(`Skenario ${id}: ${s.n} hari, ${ms.toFixed(0)} ms, residu relatif ${balance.relError.toExponential(2)}, clamp ${balance.cum.clamp}`);
console.log(' hari  tanggal   hujan    P1     P2     P3     P4    TMAS   Q(m3/s) Q(mm/d) stoplog sungai  genang(j)');
for (let i = 0; i < s.n; i++) {
  if (i % every !== 0 && i !== s.n - 1 && s.rain_mm[i] < 50) continue;
  console.log(
    `${String(s.day[i]).padStart(5)}  ${s.dateLabel[i].padEnd(7)}${f(s.rain_mm[i])}${s.piezometerIds.map((p) => f(s.depthCm[p][i])).join('')}${f(s.tmasCm[i])}${f(s.q_m3s[i], 3)}${f(s.q_mmd[i])}${String(s.nLogs[i]).padStart(7)}${f(s.riverM[i], 2)}${String(s.pondedHours[i]).padStart(8)}`,
  );
}
const tot = s.rain_mm.reduce((a, b) => a + b, 0);
const out = s.out_mm.reduce((a, b) => a + b, 0);
console.log(`Total hujan ${tot.toFixed(0)} mm, pembuangan ${out.toFixed(0)} mm, kepatuhan PP ${model.pp.compliant}/${model.pp.days} hari`);
