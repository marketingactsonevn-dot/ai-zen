/** A hand-brushed ensō: a filled stroke that swells and thins, ends in dry-brush streaks (flying white). */
export function ensoBrush(seed: number) {
  const N = 140
  const a0 = -2.05
  const sweep = Math.PI * 1.8
  const outer: [number, number][] = []
  const inner: [number, number][] = []
  const spine: [number, number][] = []
  const tail: { a: number; rr: number; w: number }[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const a = a0 + sweep * t
    const rr = 76 + Math.sin(t * 7 + seed) * 1.8 + Math.sin(t * 19 + seed * 2) * 0.7 + (t > 0.85 ? (t - 0.85) * 22 : 0)
    const swell = t < 0.05 ? 0.7 + (t / 0.05) * 0.5 : 1.2 - 0.3 * t
    const fade = t > 0.74 ? Math.max(0.08, 1 - ((t - 0.74) / 0.26) * 0.92) : 1
    const w = 16 * swell * fade + Math.sin(t * 37 + seed) * 0.7
    const x = 100 + Math.cos(a) * rr
    const y = 100 + Math.sin(a) * rr
    outer.push([x + Math.cos(a) * w * 0.5, y + Math.sin(a) * w * 0.5])
    inner.push([x - Math.cos(a) * w * 0.5, y - Math.sin(a) * w * 0.5])
    spine.push([x, y])
    if (t > 0.66) tail.push({ a, rr, w: 16 * swell })
  }
  const f = (p: [number, number]) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`
  const start = spine[0]
  const body = `M${f(outer[0])}` + outer.slice(1).map((p) => `L${f(p)}`).join('') +
    inner.reverse().map((p) => `L${f(p)}`).join('') +
    `Q${(start[0] - 9).toFixed(1)} ${(start[1] + 4).toFixed(1)} ${f(outer[0])}Z`
  // dry-brush hairs that run on past the body and break up
  const streaks = [-0.42, -0.18, 0.08, 0.3, 0.46].map((o, k) =>
    tail.slice(Math.floor(k * 3), tail.length - (k % 2) * 6)
      .map(({ a, rr, w }, i) => `${i ? 'L' : 'M'}${(100 + Math.cos(a) * (rr + o * w)).toFixed(2)} ${(100 + Math.sin(a) * (rr + o * w)).toFixed(2)}`)
      .join(''))
  return { body, streaks, spine: `M${spine.map(f).join('L')}`, end: spine[spine.length - 1] }
}


/** The AI Zen mark: a brushed ensō with the vermilion dot where the stroke lifts. */
export function brandMark(cls = 'brand-mark'): SVGSVGElement {
  const b = ensoBrush(3)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 200 200')
  svg.setAttribute('class', cls)
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = `<path d="${b.body}" fill="currentColor"/>` +
    b.streaks.slice(0, 3).map((d) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>`).join('') +
    `<circle cx="${(b.end[0] + 8).toFixed(1)}" cy="${(b.end[1] + 16).toFixed(1)}" r="15" fill="var(--vermilion)"/>`
  return svg
}
