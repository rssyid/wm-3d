// Barrel modul model (murni, bisa diimpor di Node dan peramban).
export * from './params.js';
export * from './peat.js';
export * from './canal.js';
export * from './rain.js';
export * from './scenarios.js';
export * from './indicators.js';
export * from './control.js';
export {
  createModel,
  advance,
  snapshot,
  dailySeries,
  hourlySeries,
  explain,
  peatCurves,
  ratingCurve,
  runScenario,
  setControl,
  setParams,
  setForcing,
  setRainScale,
  setManualInputs,
  waterBalance,
  isFinished,
} from './engine.js';
