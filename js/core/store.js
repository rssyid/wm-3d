// Store sederhana: get / set (gabung level atas) / patch (gabung objek bersarang) / subscribe.
export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  const notify = (prev) => {
    for (const fn of [...subs]) fn(state, prev);
  };
  return {
    get: () => state,
    set(partial) {
      const prev = state;
      const next = typeof partial === 'function' ? partial(state) : partial;
      state = { ...state, ...next };
      notify(prev);
    },
    /** patch('gate', {nLogs: 9}) → state.gate = {...state.gate, nLogs: 9} */
    patch(key, partial) {
      const prev = state;
      state = { ...state, [key]: { ...state[key], ...partial } };
      notify(prev);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
