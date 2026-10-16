import './advice.css'
import { h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { pine } from '../../ui/part2/paint'
import { perspectiveCircle, type CircleApi, type PondGeo } from '../../ui/part2/perspectives'
import type { SceneCtx, SceneDef } from '../types'
import { C } from './shell'
import { dawnGlow, f1, fog, g39Defs, leafD, readTok, rgba, type Tok } from './g39'

const A = C.scenes.advice

/** The scene's geometry in the component's stage box: the camera lies in the moss, so the horizon sits high and the
 *  puddle is a thin mirror just under it; the three lamps round it (k = digit − 1). Wide: near-left (huge, cut by the
 *  frame), right mid-way, centre far beyond the water. Tall: a standing triangle — the far lamp the apex, the two near
 *  lamps its feet at the frame's sides. */
type Geo = { w: number; h: number; cx: number; cy: number; rx: number; ry: number; hz: number; tall: boolean; lamps: { x: number; y: number; s: number; a: Pt }[] }
let M: { ctx: SceneCtx; host: HTMLElement; api: CircleApi; geo: Geo | null; drive: (k: number) => void } | null = null

function geoOf(g: PondGeo): Geo {
  const tall = g.h > g.w * 0.75
  const cx = g.w * 0.5, cy = g.h * (tall ? 0.5 : 0.39)
  const rx = g.w * (tall ? 0.38 : 0.44), ry = rx * (tall ? 0.13 : 0.085)
  const hz = tall ? g.h * 0.3 : g.h * 0.23
  // a lamp's scale from the height it should stand in the frame (the component's stone box: bw × 0.75 bw, lamp ≈ 78% of it)
  const bw = clamp(Math.min(g.w, g.h * 1.7) * 0.19, 64, 140)
  const sc = (px: number) => px / (bw * 0.75 * 0.78)
  // each lamp's anchor on the water: the point the leaf drifts to when the lamp is chosen (unit puddle coords)
  const L = tall
    ? [{ x: g.w * 0.07, y: g.h * 1.06, s: sc(g.h * 0.98), a: [-0.62, 0.36] as Pt }, { x: g.w * 0.93, y: g.h * 1.0, s: sc(g.h * 0.8), a: [0.62, 0.32] as Pt }, { x: cx + rx * 0.04, y: cy - ry * 1.4, s: sc(g.h * 0.22), a: [0.02, -0.6] as Pt }]
    : [{ x: cx - rx * 1.02, y: g.h * 1.12, s: sc(g.h * 1.3), a: [-0.64, 0.38] as Pt }, { x: cx + rx * 0.92, y: cy + ry * 2.8, s: sc(g.h * 0.44), a: [0.66, 0.14] as Pt }, { x: cx - rx * 0.14, y: cy - ry * 1.25, s: sc(g.h * 0.15), a: [-0.06, -0.6] as Pt }]
  return { w: g.w, h: g.h, cx, cy, rx, ry, hz, tall, lamps: L }
}

/**
 * Scene 4 — three views on learning with AI (perspectiveCircle, GRAZE). The camera lies in the moss: a rain puddle mirrors
 * the dawn, three stone lamps stand round it (near-left and huge, right, far beyond the water), each still burning and
 * laying a wedge of light on the water. A red maple leaf floats in the middle with three soft shadows, one from each lamp
 * (a canvas, redrawn only while the leaf moves). The visitor steers the leaf (drag it, or touch a lamp / 1–3 and it
 * drifts there): near a lamp, that lamp brightens, its shadow shortens and darkens, and its view is read. The lamps
 * never pull the leaf by themselves.
 */
const def = perspectiveCircle(A.perspectives, {
  label: A.label, prompt: A.prompt, detail: A.insight,
  place: (k, _n, g) => {
    const G = geoOf(g)
    const L = G.lamps[k]
    return { x: L.x, y: L.y, s: L.s, z: Math.round(L.y) }
  },
  // a granite lamp, weathered and mossy, its fire lit behind a lattice
  stone: (k) => lantern(3977 + k * 7),
  onHear: (k) => M?.drive(k),
  stage: (host, api) => {
    M = { ctx: M!.ctx, host, api, geo: null, drive: () => {} }
    return build(M.ctx, host, api)
  },
})

export const adviceScene: SceneDef = {
  label: def.label,
  mount(ctx) {
    g39Defs()
    M = { ctx, host: ctx.art, api: { pick() {}, onLayout() {} }, geo: null, drive: () => {} }
    const out = def.mount(ctx)
    ctx.art.querySelector('.p2c')?.classList.add('t39v')
    ctx.art.append(h('p', { class: 'visually-hidden' }, A.art))
    ctx.onCleanup(() => (M = null))
    return out
  },
}

function build(ctx: SceneCtx, host: HTMLElement, api: CircleApi) {
  const still = ctx.reduced || ctx.quality === 'low'
  // the painting runs full-bleed behind the whole scene (sky, far garden, moss, the puddle's mirror)
  const back = s('svg', { class: 't39v-back', 'aria-hidden': 'true' })
  const fore = s('svg', { class: 't39v-fore', 'aria-hidden': 'true' })
  const wrap = h('div', { class: 't39v-bleed', 'aria-hidden': 'true' }, back)
  const cv = h('canvas', { class: 't39v-light', 'aria-hidden': 'true' })
  const LEAF = leafD(0, 4, 22, 0)
  const leaf = h('div', { class: 't39v-leaf', 'aria-hidden': 'true' }, s('svg', { viewBox: '-30 -30 60 60' },
    s('path', { class: 't39v-leaf-body', d: LEAF }),
    s('path', { class: 't39v-leaf-lit', d: leafD(0.8, 3.2, 20, 0), transform: 'translate(1.2 -1)' }),
    s('path', { class: 't39v-leaf-vein', d: [-90, -38, -142, 8, 172].map((a, i) => stroke([[0, 4], [Math.cos((a * Math.PI) / 180) * (i > 2 ? 9 : 17), 4 + Math.sin((a * Math.PI) / 180) * (i > 2 ? 9 : 17)]], 1.1, 0.05, 0.6, 0.3)).join('') })))
  const leafPath = new Path2D(LEAF)
  // the warm pools each lamp lays on the moss at its foot (in the full-bleed painting; brighter with its lamp)
  let pools: SVGElement[] = []
  const foreWrap = h('div', { class: 't39v-forewrap', 'aria-hidden': 'true' }, fore)
  wrap.append(foreWrap)
  ctx.art.prepend(wrap)
  host.append(cv, leaf)
  const lamps = [...(host.parentElement?.querySelectorAll<HTMLElement>('.p2c-stone') ?? [])]
  const g2 = cv.getContext('2d')!
  let T: Tok = readTok()
  let G: Geo | null = null
  // the leaf in puddle coordinates (unit circle), where it is heading, which lamps it has visited
  let lu = 0.04, lv = 0.06, tu = lu, tv = lv
  const lit = [0.5, 0.5, 0.5]
  let near = -1
  let fromLamp = false
  let ox = 0, oy = 0, BW = 0, BH = 0
  let dpr = 1

  M!.drive = (k: number) => {
    if (!G || fromLamp) return
    // a lamp was touched (or its digit pressed): the leaf drifts to it
    ;[tu, tv] = G.lamps[k].a
    near = k
    loop.start()
    if (still) settle()
  }

  const toScreen = (u: number, v: number): Pt => [G!.cx + u * G!.rx, G!.cy + v * G!.ry]
  // the leaf: a 96 px box (the leaf itself ~73% of it), at least 80 px wide on the water, flattened by the low eye
  const leafK = () => (1 + lv * (G!.tall ? 0.16 : 0.2)) * clamp(G!.rx / 300, 1.2, 1.6)
  function placeLeaf() {
    if (!G) return
    const [x, y] = toScreen(lu, lv)
    const sc = leafK()
    leaf.style.transform = `translate(${f1(x)}px,${f1(y)}px) scale(${sc.toFixed(3)},${(sc * 0.5).toFixed(3)}) rotate(${f1(lu * 8 - 20)}deg)`
  }
  function settle() {
    lu = tu
    lv = tv
    paint()
  }

  // the dynamic water: each lamp's wedge of light on the mirror; then the leaf's three soft shadows, each thrown away
  // from its lamp (short and dark near it, long and faint far from it), drawn with the canvas blur off to one side
  function paint() {
    if (!G) return
    const { cx, cy, rx, ry } = G
    const k = dpr
    g2.setTransform(1, 0, 0, 1, 0, 0)
    g2.clearRect(0, 0, cv.width, cv.height)
    g2.setTransform(k * rx, 0, 0, k * ry, k * cx, k * cy)
    g2.save()
    g2.beginPath()
    g2.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2)
    g2.clip()
    G.lamps.forEach((L, i) => {
      const [au, av] = L.a
      const ang = Math.atan2(-av, -au)
      const gr = g2.createRadialGradient(au * 1.35, av * 1.35, 0, au * 1.35, av * 1.35, 1.5)
      gr.addColorStop(0, rgba(T.lantern, 0.85 * lit[i]))
      gr.addColorStop(0.45, rgba(T.lantern, 0.32 * lit[i]))
      gr.addColorStop(1, rgba(T.lantern, 0))
      g2.fillStyle = gr
      g2.beginPath()
      g2.moveTo(au * 1.35, av * 1.35)
      g2.arc(au * 1.35, av * 1.35, 1.6, ang - 0.36, ang + 0.36)
      g2.closePath()
      g2.fill()
    })
    g2.restore()
    // the shadows, in screen px
    const [x, y] = toScreen(lu, lv)
    const sc = leafK() * (96 / 60)
    const OFF = 4000
    G.lamps.forEach((L, i) => {
      const [lx, ly] = toScreen(L.a[0] * 1.6, L.a[1] * 1.6)
      let dx = x - lx, dy = (y - ly) * 2.2
      const dist = Math.hypot(dx, dy) || 1
      dx /= dist
      dy /= dist
      const nearK = clamp(1 - dist / (G!.rx * 2.4), 0, 1)
      const len = (G!.rx * 0.07 + (1 - nearK) * G!.rx * 0.12) * k
      g2.setTransform(k * sc * (0.9 + (1 - nearK) * 0.35), 0, 0, k * sc * 0.42, k * (x - OFF), k * y)
      g2.shadowColor = rgba(T.umbra, clamp(0.28 + nearK * 0.45, 0.25, 0.72) * (0.6 + lit[i] * 0.4))
      g2.shadowBlur = (2.5 + (1 - nearK) * 5) * k
      g2.shadowOffsetX = OFF * k + dx * len
      g2.shadowOffsetY = dy * len * 0.45
      g2.fillStyle = '#000'
      g2.fill(leafPath)
    })
    g2.shadowColor = 'transparent'
    g2.shadowBlur = 0
    g2.shadowOffsetX = g2.shadowOffsetY = 0
    placeLeaf()
    for (let i = 0; i < lamps.length; i++) {
      lamps[i].style.setProperty('--lit', lit[i].toFixed(2))
      if (pools[i]) pools[i].style.opacity = (0.35 + lit[i] * 0.65).toFixed(2)
    }
  }

  // the loop runs only while the leaf drifts or the lamps' light changes
  const loop = createLoop(host, (_t, dt) => {
    if (!G) return false
    const e = 1 - Math.exp(-(dt || 0.016) * 3.2)
    lu += (tu - lu) * e
    lv += (tv - lv) * e
    let busy = Math.abs(tu - lu) + Math.abs(tv - lv) > 0.002
    G.lamps.forEach((L, i) => {
      const d = Math.hypot(lu - L.a[0], lv - L.a[1])
      const want = clamp(1.05 - d * 0.75, 0.42, 1)
      lit[i] += (want - lit[i]) * e
      if (Math.abs(want - lit[i]) > 0.004) busy = true
    })
    paint()
    return busy
  }, { essential: true })

  // drag the leaf over the water; coming close to a lamp reads its view (never the other way round)
  let drag = false
  leaf.addEventListener('pointerdown', (e) => {
    if (e.button) return
    drag = true
    leaf.setPointerCapture(e.pointerId)
    leaf.classList.add('drag')
  })
  leaf.addEventListener('pointermove', (e) => {
    if (!drag || !G) return
    const r = host.getBoundingClientRect()
    let u = (e.clientX - r.left - G.cx) / G.rx, v = (e.clientY - r.top - G.cy) / G.ry
    const m = Math.hypot(u, v)
    if (m > 0.82) (u = (u / m) * 0.82), (v = (v / m) * 0.82)
    tu = lu = u
    tv = lv = v
    const k = G.lamps.findIndex((L) => Math.hypot(u - L.a[0], v - L.a[1]) < 0.3)
    if (k >= 0 && k !== near) {
      near = k
      fromLamp = true
      api.pick(k)
      fromLamp = false
    } else if (k < 0 && Math.hypot(u, v) < 0.25) near = -1
    loop.start()
  })
  const up = () => {
    if (!drag) return
    drag = false
    leaf.classList.remove('drag')
    // let go near the middle once every lamp has spoken: three equal shadows, a star
    if (Math.hypot(lu, lv) < 0.3 && host.closest('.p2c')?.classList.contains('is-all')) {
      tu = 0
      tv = 0.02
      host.closest('.p2c')?.classList.add('t39v-star')
      loop.start()
    }
  }
  leaf.addEventListener('pointerup', up)
  leaf.addEventListener('pointercancel', up)

  api.onLayout((g) => {
    G = geoOf(g)
    M!.geo = G
    dpr = Math.min(devicePixelRatio || 1, ctx.quality === 'low' ? 1 : 1.5)
    cv.width = Math.round(g.w * dpr)
    cv.height = Math.round(g.h * dpr)
    Object.assign(cv.style, { width: `${g.w}px`, height: `${g.h}px` })
    // where the stage sits in the full-bleed painting
    const st = host.parentElement as HTMLElement
    BW = wrap.clientWidth
    BH = wrap.clientHeight
    ox = (BW - ctx.art.clientWidth) / 2 + st.offsetLeft
    oy = BH - ctx.art.clientHeight - 24 + st.offsetTop
    paintBack()
    paint()
  })

  let mossJob: { cancel(): void } | null = null
  let firstBack = true
  ctx.onCleanup(() => mossJob?.cancel())
  function paintBack() {
    if (!G) return
    const { cx, cy, rx, ry, tall, lamps } = G
    const X = (x: number) => x + ox, Y = (y: number) => y + oy
    const r = rng(3970)
    const hz = Y(G.hz)
    // the art's top in this painting: nothing tall may climb into the header
    const top = BH - ctx.art.clientHeight - 24
    for (const el of [back, fore]) el.setAttribute('viewBox', `0 0 ${f1(BW)} ${f1(BH)}`)
    // far garden: shrubs and a pine out of focus against the dawn, mist on the ground
    let shrubs = ''
    for (let i = 0; i < 16; i++) {
      const x = r() * BW, w = BW * (0.05 + r() * 0.08)
      shrubs += blob(x, hz - w * 0.1, w, w * (0.3 + r() * 0.25), 3971 + i, 0.25, 14)
    }
    // the moss: cushions flattened by the low eye, from a pale hazy band at the horizon to big dark ones near the lens;
    // each with a lit crown and a shaded underside (built in slices once the rest is up: the heaviest part)
    const mossG = s('g', { class: 't39v-mossg' })
    function* moss(): Generator {
      const q0 = rng(3981)
      let mossDk = '', mossLt = '', mossHi = ''
      for (let i = 0; i < 1400; i++) {
        const t0 = Math.pow(q0(), 1.6)
        const y = hz + 3 + t0 * (BH - hz)
        const x = q0() * BW
        const rr = 0.8 + t0 * t0 * 30
        const q = q0()
        const d = blob(x, y, rr * (1 + q0() * 0.8), rr * 0.36, 3980 + i, 0.35, 8)
        if (q < 0.4) mossDk += d
        else mossLt += d
        if (q > 0.55) mossHi += blob(x - rr * 0.15, y - rr * 0.16, rr * 0.7, rr * 0.13, 4980 + i, 0.3, 7)
        if (i % 200 === 199) yield
      }
      mossG.replaceChildren(
        s('path', { class: 't39v-moss t39v-moss-dk', d: mossDk }),
        s('path', { class: 't39v-moss t39v-moss-lt', d: mossLt }),
        s('path', { class: 't39v-moss-hi', d: mossHi }))
    }
    const P = blob(X(cx), Y(cy), rx * 1.02, ry * 1.08, 3972, 0.08, 22)
    const clipId = 't39v-pc'
    const pineH = Math.min((hz - top - 14) * 0.95, G.h * 0.4)
    pools = lamps.map((L, i) => {
      const lh = L.s * 0.75 * 0.78 * clamp(Math.min(G!.w, G!.h * 1.7) * 0.19, 64, 140)
      return s('ellipse', { class: 't39v-pool', cx: f1(X(L.x) + (i === 1 ? -lh * 0.16 : lh * 0.1)), cy: f1(Y(L.y) + lh * 0.03), rx: f1(lh * 0.95), ry: f1(lh * 0.22), fill: 'url(#g39-lamp)' })
    })
    back.replaceChildren(
      s('defs', null,
        s('clipPath', { id: clipId }, s('path', { d: P })),
        s('linearGradient', { id: 't39v-mirror', x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.85' }),
          s('stop', { offset: 0.35, style: 'stop-color:var(--dawn);stop-opacity:1' }),
          s('stop', { offset: 0.7, style: 'stop-color:var(--paper);stop-opacity:1' }),
          s('stop', { offset: 1, style: 'stop-color:var(--water);stop-opacity:1' })),
        s('linearGradient', { id: 't39v-groundg', x1: 0, y1: f1(hz - 30), x2: 0, y2: f1(BH), gradientUnits: 'userSpaceOnUse' },
          // the ground fades in out of the haze: no seam under the far hills
          s('stop', { offset: 0, style: 'stop-color:var(--t39v-far);stop-opacity:0' }),
          s('stop', { offset: 0.07, style: 'stop-color:var(--t39v-far)' }),
          s('stop', { offset: 0.22, style: 'stop-color:var(--t39v-mid)' }),
          s('stop', { offset: 1, style: 'stop-color:var(--t39v-near)' }))),
      s('rect', { class: 'g39-skyfill', x: -2, y: -2, width: f1(BW + 4), height: f1(hz + 4), fill: 'url(#g39-sky)' }),
      s('rect', { class: 'g39-skydawn', x: -2, y: f1(hz * 0.2), width: f1(BW + 4), height: f1(hz * 0.8 + 2), fill: 'url(#g39-dawnv)' }),
      dawnGlow(X(cx + rx * 0.5), hz, BW * 0.4, hz * 0.8, 3),
      pine(X(cx - rx * (tall ? 0.55 : 1.45)), hz + 6, pineH, 3973, 1),
      s('path', { class: 't39v-shrubs', d: shrubs }),
      // the ground rises out of the haze: no seam at the horizon
      s('rect', { class: 't39v-ground', x: -2, y: f1(hz - 30), width: f1(BW + 4), height: f1(BH - hz + 34), fill: 'url(#t39v-groundg)' }),
      fog(BW / 2, hz - 4, BW * 0.75, Math.max(22, (hz - top) * 0.35)),
      dawnGlow(X(cx + rx * 0.3), hz + 2, BW * 0.55, Math.max(20, (hz - top) * 0.3), 2),
      mossG,
      ...pools,
      // the puddle: a mirror of the sky (the dawn bright in its far half), its wet dark rim, the far lamps upside down in it
      s('path', { class: 't39v-wet', d: blob(X(cx), Y(cy + ry * 0.15), rx * 1.08, ry * 1.7, 3974, 0.1, 22) }),
      s('path', { d: P, fill: 'url(#t39v-mirror)', class: 't39v-mirror' }),
      s('g', { 'clip-path': `url(#${clipId})` },
        s('ellipse', { cx: f1(X(cx + rx * 0.3)), cy: f1(Y(cy - ry * 0.7)), rx: f1(rx * 0.9), ry: f1(ry * 0.9), fill: 'url(#g39-dawn)' }),
        ...lamps.slice(tall ? 2 : 1).map((L, i) => s('g', { class: 't39v-reflect', style: `--k:${i + 1}`, transform: `translate(${f1(X(L.x))} ${f1(Y(L.y))}) scale(${(L.s * 0.95).toFixed(2)} ${(-L.s * 0.95 * 0.8).toFixed(2)})` }, lantern(3990 + i, true))),
        s('path', { class: 't39v-glint', d: Array.from({ length: 18 }, () => {
          const u = (r() - 0.5) * 1.6, v = (r() - 0.5) * 1.2
          const L = rx * (0.04 + r() * 0.1)
          return stroke([[X(cx + u * rx) - L / 2, Y(cy + v * ry)], [X(cx + u * rx) + L / 2, Y(cy + v * ry)]], 0.8 + r() * 1.2, 0.3, 0.3, 0.2)
        }).join('') })),
      s('path', { class: 't39v-rim', d: P }),
      s('path', { class: 't39v-lip', d: stroke(Array.from({ length: 15 }, (_, i) => {
        const a = (200 + i * 10) * (Math.PI / 180)
        return [X(cx + Math.cos(a) * rx * 1.01), Y(cy + Math.sin(a) * ry * 1.05)] as Pt
      }), Math.max(1.5, ry * 0.12), 0.2, 0.2, 0.1) }))
    // nearest of all: moss a finger from the lens, huge and out of focus along the foot of the frame (mounds and a few
    // tall blades), the dawn caught as bokeh in its dew
    let near = '', nearHi = '', blades = '', bokeh = ''
    const base = BH + 6, hTop = BH - BH * (tall ? 0.22 : 0.3)
    for (let i = 0; i < (tall ? 7 : 10); i++) {
      const x = ((i + r() * 0.6) / (tall ? 6 : 9)) * BW - BW * 0.05, w = BW * (tall ? 0.2 : 0.13) * (0.8 + r() * 0.6), hh = (BH - hTop) * (0.35 + r() * 0.5)
      near += blob(x, base, w, hh, 3975 + i, 0.25, 18)
      nearHi += blob(x - w * 0.18, base - hh * 0.8, w * 0.5, hh * 0.18, 3995 + i, 0.3, 12)
    }
    for (let i = 0; i < (tall ? 14 : 22); i++) {
      const x = r() * (BW + 120) - 60, hh = (BH - hTop) * (0.6 + r() * 0.8)
      const lean = (r() - 0.5) * hh * 0.6, w = 12 + r() * 22
      blades += stroke(curve([x, base], [x + lean * 0.3, base - hh * 0.6], [x + lean, base - hh], 8), w, 0.05, 0.85, 0.3)
    }
    for (let i = 0; i < 12; i++) {
      const x = r() * BW, y = hTop + r() * (BH - hTop) * 0.7, R = 8 + r() * 20
      bokeh += `M${f1(x + R)} ${f1(y)}A${f1(R)} ${f1(R)} 0 1 0 ${f1(x - R)} ${f1(y)}A${f1(R)} ${f1(R)} 0 1 0 ${f1(x + R)} ${f1(y)}Z`
    }
    mossJob?.cancel()
    mossJob = sliced(moss(), { sync: ctx.reduced || !firstBack })
    firstBack = false
    fore.replaceChildren(
      s('path', { class: 't39v-near', d: near }),
      s('path', { class: 't39v-near t39v-blades', d: blades }),
      s('path', { class: 't39v-near-hi', d: nearHi }),
      s('path', { class: 't39v-bokeh', d: bokeh }))
  }

  ctx.onCleanup(onPrefs(() => {
    const t = readTok()
    if (t.lantern === T.lantern && t.umbra === T.umbra) return
    T = t
    paint()
  }))
  ctx.onCleanup(() => {
    loop.dispose()
    wrap.remove()
  })
  return () => {}
}

/** A granite kasuga lantern, front view, foot on y = 0, 70 tall (the component's stone box): the six-sided base and post,
 *  the platform, the firebox with its fire behind a lattice, the wide roof with curled corners, the jewel. Weathered:
 *  grain, cracks, lichen on the roof; the dawn warm on its right edge. `ghost` (the puddle's reflection) skips the fire. */
function lantern(seed: number, ghost = false): SVGGElement {
  const r = rng(seed)
  const u = 7
  const X = (v: number) => f1(v * u), Y = (v: number) => f1(-v * u)
  const quad = (l0: number, r0: number, b: number, l1: number, r1: number, t: number) => `M${X(l0)} ${Y(b)}L${X(r0)} ${Y(b)}L${X(r1)} ${Y(t)}L${X(l1)} ${Y(t)}Z`
  // base in two tiers, the post with its ring, the platform flaring up to the firebox, the roof, the jewel
  const base = quad(-1.35, 1.35, 0, -1.1, 1.1, 0.7) + quad(-1.0, 1.0, 0.7, -0.62, 0.62, 1.15)
  const post = quad(-0.42, 0.42, 1.15, -0.36, 0.36, 4.5) + quad(-0.5, 0.5, 2.75, -0.5, 0.5, 2.98)
  const deck = quad(-0.62, 0.62, 4.5, -1.32, 1.32, 5.3)
  const frame = `M${X(-1.02)} ${Y(5.3)}h${f1(u * 0.36)}v${f1(-u * 2)}h${f1(-u * 0.36)}ZM${X(0.66)} ${Y(5.3)}h${f1(u * 0.36)}v${f1(-u * 2)}h${f1(-u * 0.36)}Z`
  const roof = `M${X(-1.1)} ${Y(7.3)}L${X(-1.95)} ${Y(7.3)}Q${X(-2.18)} ${Y(7.3)} ${X(-2.26)} ${Y(7.6)}Q${X(-1.62)} ${Y(7.62)} ${X(-1.25)} ${Y(7.95)}L${X(-0.42)} ${Y(8.55)}Q${X(0)} ${Y(8.68)} ${X(0.42)} ${Y(8.55)}L${X(1.25)} ${Y(7.95)}Q${X(1.62)} ${Y(7.62)} ${X(2.26)} ${Y(7.6)}Q${X(2.18)} ${Y(7.3)} ${X(1.95)} ${Y(7.3)}L${X(1.1)} ${Y(7.3)}Z`
  const jewel = blob(0, -9.25 * u, u * 0.36, u * 0.46, seed, 0.1, 10) + quad(-0.28, 0.28, 8.62, -0.2, 0.2, 8.85)
  const stone = base + post + deck + frame + roof + jewel
  let speckDk = '', speckLt = ''
  for (let i = 0; i < 40; i++) {
    const y = r() * 8.6
    const w = y < 0.7 ? 1.2 : y < 1.15 ? 0.8 : y < 4.5 ? 0.36 : y < 5.3 ? 0.62 + (y - 4.5) : y < 7.3 ? 0.95 : 1.8 - (y - 7.3) * 1.1
    const x = (r() - 0.5) * 2 * Math.max(0.2, w) * u
    const d = blob(x, -y * u, 0.18 + r() * 0.28, 0.14 + r() * 0.18, seed + i, 0.3, 6)
    if (r() < 0.55) speckDk += d
    else speckLt += d
  }
  const cracks = stroke([[-0.22 * u, -1.5 * u], [-0.08 * u, -2.3 * u], [-0.18 * u, -3.5 * u]], 0.45, 0.2, 0.3, 0.3) + stroke([[0.7 * u, -4.85 * u], [0.2 * u, -5.08 * u]], 0.45, 0.2, 0.3, 0.3)
  let lichen = ''
  for (let i = 0; i < 6; i++) lichen += blob((r() - 0.5) * 2.6 * u, -(7.55 + r() * 0.5) * u, 1.2 + r() * 2, 0.5 + r() * 0.8, seed + 40 + i, 0.35, 8)
  lichen += blob(-0.9 * u, -5.15 * u, 2.4, 0.8, seed + 50, 0.3, 8) + blob(0.8 * u, -0.6 * u, 2.6, 0.8, seed + 51, 0.3, 8)
  // the dawn on its right edges, the fire on the edges round the firebox
  const rimR = stroke([[1.35 * u, 0], [1.1 * u, -0.7 * u]], 0.8, 0.1, 0.1, 0.3) + stroke([[0.42 * u, -1.2 * u], [0.36 * u, -4.45 * u]], 0.6, 0.1, 0.1, 0.3) + stroke([[1.32 * u, -5.3 * u], [0.62 * u, -4.5 * u]], 0.7, 0.1, 0.1, 0.3) + stroke([[1.02 * u, -5.3 * u], [1.02 * u, -7.3 * u]], 0.7, 0.1, 0.1, 0.3) + stroke([[0.42 * u, -8.55 * u], [1.25 * u, -7.95 * u], [2.26 * u, -7.6 * u]], 0.8, 0.2, 0.2, 0.2)
  return s('g', { class: 't39v-lamp' },
    ghost ? null : s('ellipse', { class: 't39v-contact', cx: 1.5, cy: 0.5, rx: f1(u * 1.9), ry: f1(u * 0.36) }),
    ghost ? null : s('circle', { class: 't39v-halo', cx: 0, cy: Y(6.3), r: f1(u * 4.6), fill: 'url(#g39-lamp)' }),
    s('path', { class: 't39v-fire', d: `M${X(-1)} ${Y(5.3)}H${X(1)}V${Y(7.3)}H${X(-1)}Z` }),
    ghost ? null : s('ellipse', { class: 't39v-flame', cx: 0, cy: Y(6.1), rx: f1(u * 0.3), ry: f1(u * 0.48) }),
    s('path', { class: 't39v-lamp-stone', d: stone, fill: 'url(#g39-lampstone)', filter: 'url(#ink-rough)' }),
    s('path', { class: 't39v-eave', d: `M${X(-1.95)} ${Y(7.3)}H${X(1.95)}V${Y(7.42)}H${X(-1.95)}Z` }),
    s('path', { class: 't39v-lattice', d: `M${X(-0.28)} ${Y(5.3)}h${f1(u * 0.12)}v${f1(-u * 2)}h${f1(-u * 0.12)}ZM${X(0.16)} ${Y(5.3)}h${f1(u * 0.12)}v${f1(-u * 2)}h${f1(-u * 0.12)}Z` }),
    s('path', { class: 't39v-speck-dk', d: speckDk }),
    s('path', { class: 't39v-speck-lt', d: speckLt }),
    s('path', { class: 't39v-crack', d: cracks }),
    s('path', { class: 't39v-lichen', d: lichen }),
    s('path', { class: 't39v-lamp-rim', d: rimR }),
    ghost ? null : s('path', { class: 't39v-firelit', d: stroke([[-1.05 * u, -7.3 * u], [1.05 * u, -7.3 * u]], 0.8, 0.1, 0.1, 0.4) + stroke([[-1.32 * u, -5.3 * u], [1.32 * u, -5.3 * u]], 0.8, 0.1, 0.1, 0.4) }))
}
