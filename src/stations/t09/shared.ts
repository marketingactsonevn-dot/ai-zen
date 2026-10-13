import { h, s } from '../../core/dom'

/** Value noise for shaders (0…1). */
export const NOISE_GLSL = /* glsl */ `
float h3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float n3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`

export type Pt = [number, number]
const f1 = (n: number) => Math.round(n * 10) / 10

/** Smooth centre line through `pts` (Catmull-Rom), `n` samples per segment. */
export function smoothLine(pts: Pt[], n = 12): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t
      const c = (a: number, b: number, c2: number, d: number) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3)
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/** A sumi-e stroke as a filled outline: presses in, swells, lifts off thin (variable width `w` along the line). */
export function brushStroke(line: Pt[], w: number, seed = 0): string {
  const L: Pt[] = [], R: Pt[] = []
  const n = line.length
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)]
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const l = Math.hypot(dx, dy) || 1
    const press = Math.min(1, t / 0.06) ** 0.6 * (1 - 0.82 * Math.max(0, (t - 0.55) / 0.45) ** 1.4)
    const ww = (w / 2) * press * (0.86 + 0.14 * Math.sin(t * 23 + seed) * Math.sin(t * 7 + seed * 2))
    L.push([line[i][0] - (dy / l) * ww, line[i][1] + (dx / l) * ww])
    R.push([line[i][0] + (dy / l) * ww, line[i][1] - (dx / l) * ww])
  }
  const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
  return `M${L.map(P).join('L')}L${R.reverse().map(P).join('L')}Z`
}

/** 'tall' = portrait, 'short' = cramped landscape, 'wide' = roomy landscape. */
export function layoutOf(el: HTMLElement): 'tall' | 'short' | 'wide' {
  const W = el.clientWidth, H = el.clientHeight
  if (W < H * 1.05) return 'tall'
  return H < 330 ? 'short' : 'wide'
}

/** No WebGL: a still ink drawing of a koi on its stand, with the scene's sentence as its label. */
export function staticFallback(host: HTMLElement, label: string) {
  host.classList.add('is-static')
  host.append(s('svg', { class: 't9-fallback', viewBox: '0 0 320 200', role: 'img', 'aria-label': label },
    s('ellipse', { class: 'fb-sh', cx: 160, cy: 168, rx: 110, ry: 12 }),
    s('path', { class: 'fb-body', d: 'M250 96c-10-26-60-38-118-30-34 5-62 16-80 30l-30-22c4 16 4 34 0 50l30-20c20 14 50 22 84 24 54 3 104-6 114-32z' }),
    s('path', { class: 'fb-red', d: 'M232 80c-16-10-44-12-62-6 10 10 34 14 62 6zM150 70c-18-2-40 2-52 10 16 6 38 4 52-10z' }),
    s('circle', { class: 'fb-eye', cx: 236, cy: 92, r: 3 })),
  h('p', { class: 'visually-hidden' }, label))
}

/** Dev only: drive a scene's frames by hand (the preview pane is often hidden, which pauses rAF). */
export function devHook(state: object, frame: (t: number, dt: number) => void, draw: () => void) {
  if (!import.meta.env.DEV) return
  let t = 0
  ;(window as unknown as { __t9: unknown }).__t9 = {
    ...state,
    step(n = 60) {
      for (let i = 0; i < n; i++) frame((t += 1 / 60), 1 / 60)
      draw()
    },
  }
}
