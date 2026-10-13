// Static, trusted inline SVG icons (stroke = currentColor).
const P: Record<string, string> = {
  enso: '<path d="M12 3.2a8.8 8.8 0 1 0 8.1 5.3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="19.4" cy="5" r="1.9" fill="var(--vermilion)"/>',
  sun: '<circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  moon: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  soundOn: '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  soundOff: '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  leafHigh: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" fill="currentColor" opacity=".18"/><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  leafLow: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2.5 2.5"/>',
  lantern: '<path d="M9 3h6M10 3v2M14 3v2M7.5 7.5h9l-1 9h-7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 7.5h12M8 16.5h8M12 16.5V21M9 21h6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="1.8" fill="var(--vermilion)"/>',
  gate: '<path d="M3.5 6.5c3 .8 14 .8 17 0M5 9.5h14M7 6.8V21M17 6.8V21M12 9.5v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  arrowL: '<path d="M14.5 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  arrowR: '<path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
}

export function icon(name: keyof typeof P | string, cls = 'icon'): HTMLElement {
  const span = document.createElement('span')
  span.className = cls
  span.setAttribute('aria-hidden', 'true')
  span.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22">${P[name] ?? ''}</svg>`
  return span
}
