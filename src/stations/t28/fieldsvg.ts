import * as THREE from 'three'
import { h, s } from '../../core/dom'
import { sliced } from '../../core/chunk'
import type { SceneCtx } from '../types'
import { onSize, p2Defs, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, toro } from '../../ui/part2/paint'
import { C } from './data'
import { figure } from './brush'
import { A, COLS, R, ROWS, Rl, TRAY, Y, at, thOf } from './hill'

const G = C.scenes.gardeners
const f1 = (n: number) => n.toFixed(1)

/**
 * No WebGL: the same terraced hill painted once as SVG from the hero's angle (projected with the same numbers), built in
 * slices. The can and the valve become two buttons; watering darkens the rows front to back (art direction §4 t28).
 */
export function fieldFallback(ctx: SceneCtx, host: HTMLElement, o: { go(many: boolean, el: { set(k: number): void; done(): void }): void }): () => void {
  p2Defs()
  const svg = s('svg', { class: 't28g-fb', 'aria-hidden': 'true' })
  const b = (many: boolean) => h('button', { class: 't28g-fbb', type: 'button', 'aria-pressed': 'false', 'aria-label': many ? G.manyAria : G.oneAria }, many ? G.many : G.one)
  const one = b(false), many = b(true)
  const wrap = h('div', { class: 't28g-fbw', role: 'img', 'aria-label': G.art }, svg)
  host.append(wrap, one, many)
  let wets: SVGPathElement[] = []
  let wetK = 0 // how much of the garden is watered (kept across a re-layout)
  const paint = () => wets.forEach((p, i) => p.classList.toggle('on', i < Math.round(wetK * ROWS)))
  const el = {
    set: (k: number) => ((wetK = k), paint()),
    done: () => ((wetK = 1), paint()),
  }
  const press = (m: boolean) => () => {
    one.setAttribute('aria-pressed', String(!m))
    many.setAttribute('aria-pressed', String(m))
    o.go(m, el)
  }
  one.addEventListener('click', press(false))
  many.addEventListener('click', press(true))
  let job: { cancel(): void } | null = null

  function* draw(w: number, hh: number) {
    const cam = new THREE.PerspectiveCamera(35, w / hh, 0.1, 200)
    const tall = hh > w
    const yaw = tall ? -0.08 : -0.2, pitch = tall ? 0.785 : 0.46, d = tall ? 62 : 28
    const T = new THREE.Vector3(0, 1.2, tall ? 1.6 : -1.3)
    cam.position.set(T.x + d * Math.cos(pitch) * Math.sin(yaw), T.y + d * Math.sin(pitch), T.z + d * Math.cos(pitch) * Math.cos(yaw))
    cam.lookAt(T)
    cam.updateMatrixWorld()
    const v = new THREE.Vector3()
    const P = (p: [number, number, number]): Pt => {
      v.set(...p).project(cam)
      return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * hh]
    }
    const M = (pts: Pt[]) => `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`
    svg.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
    const horizon = P(at(0, R[ROWS] - 1.6, Y(ROWS)))[1] - hh * 0.02
    svg.replaceChildren(
      moon(w * 0.76, hh * 0.2, hh * 0.09, 2815, true),
      hills(-w * 0.05, w * 1.05, horizon, hh * 0.22, 2816, 0.85, 4),
      mist(w * 0.5, horizon, w * 0.7, hh * 0.08))
    wets = []
    yield
    // row i's lip (hand-built contour, hill.ts J) less `back`, at height y
    const arc = (i: number, back: number, y: number, n = 40) => Array.from({ length: n + 1 }, (_, k) => {
      const th = -A + (2 * A * k) / n
      return P(at(th, Rl(i, th) - back, y))
    })
    // the black lacquer tray under it
    svg.append(s('path', { class: 't28g-fb-tray', d: M([...Array.from({ length: 41 }, (_, k) => P(at(-1.5 + (3 * k) / 40, R[0] + 0.6, TRAY))), ...Array.from({ length: 41 }, (_, k) => P(at(1.5 - (3 * k) / 40, R[0] + 0.6, 0)))]) }))
    // back to front so nearer rows cover farther ones
    for (let i = ROWS; i >= 0; i--) {
      const crest = i === ROWS
      const r1 = R[i], r2 = crest ? R[i] - 1.6 : R[i + 1]
      const y = Y(i), y0 = i ? Y(i - 1) : TRAY
      const top = crest ? M([...arc(i, 0, y), ...arc(i, 1.6, y).reverse()]) : M([...arc(i, 0, y), ...arc(i + 1, 0, y).reverse()])
      const riser = M([...arc(i, 0, y0), ...arc(i, 0, y).reverse()])
      const g = s('g', null,
        s('path', { class: crest ? 't28g-fb-crest' : 't28g-fb-tread', d: top }),
        s('path', { class: 't28g-fb-riser', d: riser }),
        s('path', { class: 't28g-fb-lip', d: stroke(arc(i, 0, y), 1.2, 0.2, 0.2, 0.3) }))
      if (!crest) {
        const dR = r1 - r2
        let beds = ''
        for (let j = 0; j < COLS; j++) {
          const th = thOf(j), hw = (A / COLS) * 0.8
          beds += M([P(at(th - hw, r1 - dR * 0.17, y)), P(at(th + hw, r1 - dR * 0.17, y)), P(at(th + hw, r1 - dR * 0.78, y)), P(at(th - hw, r1 - dR * 0.78, y))])
        }
        const wet = s('path', { class: 't28g-fb-wet', d: beds })
        wets[i] = wet
        g.append(s('path', { class: 't28g-fb-bed', d: beds }), wet, s('path', { class: 't28g-fb-pipe', d: stroke(arc(i + 1, 0, Y(i + 1) + 0.02), 1.4, 0.1, 0.1, 0.5) }))
      }
      svg.append(g)
      if (i % 4 === 0) yield
    }
    // the gardener and his can, the lantern, the valve on the crest
    // the same spots as the 3D scene (gardeners.ts HOME / CAN / lamp)
    const hx = tall ? -3.2 : -6.2, hz = tall ? 9.6 : 3.6
    const home = P([hx, 0, hz]), foot = P([hx, 1.1, hz])
    const k = home[1] - foot[1]
    const lamp = P([hx - 1.3, 0, hz - 1.3])
    const valve = P(at(-A + 0.06, R[ROWS] - 0.62, Y(ROWS) + 0.3))
    const can = P([hx + 1.5, 0.35, hz + 0.5])
    svg.append(
      s('g', { transform: `translate(${f1(lamp[0])} ${f1(lamp[1])})` }, toro(0, 0, k * 1.1, true)),
      s('path', { class: 't28g-fb-man', d: figure(home[0], home[1], k, 2811, 1, { hat: 'cone', stoop: 0.35 }) }))
    const put = (b: HTMLElement, p: Pt) => Object.assign(b.style, { left: `${f1(p[0])}px`, top: `${f1(p[1])}px` })
    put(one, can)
    put(many, valve)
    paint()
  }
  const off = onSize(host, () => {
    const w = host.clientWidth, hh = host.clientHeight
    if (w < 40 || hh < 40) return
    job?.cancel()
    job = sliced(draw(w, hh), { sync: ctx.reduced })
  })
  return () => {
    off()
    job?.cancel()
    wrap.remove()
    one.remove()
    many.remove()
  }
}
