// Ikon SVG kecil (inline, currentColor) untuk tombol. Selalu disertai teks; ikon aria-hidden.
const svg = (body, vb = '0 0 16 16') =>
  `<svg class="ui-ico" viewBox="${vb}" width="14" height="14" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = Object.freeze({
  play: svg('<path d="M4 2.5v11l9-5.5z" fill="currentColor"/>'),
  pause: svg('<rect x="3.5" y="2.5" width="3" height="11" rx="0.8" fill="currentColor"/><rect x="9.5" y="2.5" width="3" height="11" rx="0.8" fill="currentColor"/>'),
  step: svg('<path d="M2.5 2.5v11l7-5.5z" fill="currentColor"/><rect x="10.5" y="2.5" width="2.6" height="11" rx="0.8" fill="currentColor"/>'),
  reset: svg('<path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M2.2 2.2v3.6h3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  minus: svg('<path d="M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  plus: svg('<path d="M3 8h10M8 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  close: svg('<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  copy: svg('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
  check: svg('<path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  cross: svg('<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  info: svg('<circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 7.2v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="4.9" r="0.9" fill="currentColor"/>'),
  alert: svg('<path d="M8 1.8l6.6 11.7H1.4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.2v3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.6" r="0.9" fill="currentColor"/>'),
});
