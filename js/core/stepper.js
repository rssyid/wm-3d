// Jam simulasi diskret dari waktu nyata: tick(dtDetik, jamPerDetik) → jumlah jam bulat untuk dimajukan.
export function createStepper({ maxStepsPerFrame = 240 } = {}) {
  let acc = 0;
  const st = {
    frac: 0,
    dropped: false,
    tick(dtSec, hoursPerSec) {
      acc += Math.max(0, dtSec) * hoursPerSec;
      let n = Math.floor(acc);
      st.dropped = false;
      if (n > maxStepsPerFrame) {
        acc -= n; // buang tunggakan (simulasi melambat), simpan pecahan
        n = maxStepsPerFrame;
        st.dropped = true;
      } else {
        acc -= n;
      }
      st.frac = acc;
      return n;
    },
    reset() {
      acc = 0;
      st.frac = 0;
      st.dropped = false;
    },
  };
  return st;
}
