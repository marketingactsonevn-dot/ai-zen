import raw from '../../content/tram-19.json'
import { fill, h, s, viDate } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import type { SceneCtx } from '../types'
import type { Tide } from '../../ui/part2/types'
import { clamp, onSize, p2Defs, rng, rock, stableHeight } from '../../ui/part2/ink'
import { moon as moonArt } from '../../ui/part2/paint'
import { guide } from '../../ui/part2/guide'

const S = raw.scenes.tide
const D = S.tide as Tide
const f1 = (n: number) => n.toFixed(1)
/** a CSS colour (hex or rgb()) at alpha a, for canvas gradients that fade to nothing without turning grey */
function fade(css: string, a: number) {
  const m = css.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const [r, g, b] = m[1].split(/[\s,/]+/)
    return `rgba(${r},${g},${b},${a})`
  }
  const x = css.replace('#', '')
  const v = parseInt(x.length === 3 ? x.replace(/./g, (c) => c + c) : x, 16)
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`
}

/** One stone on the flat: world depth z (or on the mountain's flank: up > 0), lateral offset, size, kind, the stop that raises it. */
interface Stone { z: number; dx: number; up: number; w: number; hh: number; seed: number; stop: number; kind: 'stone' | 'fence' | 'today'; at: number; sx: number; sy: number; sk: number; big?: boolean }

/**
 * The stones of the tide, from near to far: ChatGPT alone in the lower-left third (the way in), GPT-4 further out,
 * the pairs of 2024 (two a month) evenly spaced, thirty small ones crowding the mountain's foot and climbing its flank like
 * steps (06/2025), one with a little bamboo fence (04/2026), today's on the highest step still in sight. Depth runs with time.
 */
function stonesOf(): Stone[] {
  const r = rng(1959)
  const out: Stone[] = []
  const add = (z: number, dx: number, w: number, stop: number, up = 0, kind: Stone['kind'] = 'stone', hh = w * (0.55 + r() * 0.25)) =>
    out.push({ z, dx, up, w, hh, seed: 1960 + out.length * 7, stop, kind, at: -1, sx: 0, sy: 0, sk: 1 })
  add(3.1, 0, 0.5, 0, 0, 'stone', 0.34) // ChatGPT: the way in, lower-left third (audit: x≈380, y≈640 at 1440×900)
  add(5, 0.15, 0.44, 1) // GPT-4
  for (let k = 0; k < 6; k++) { // 2024: two a month, evenly spaced pairs
    const z = 6.8 + k * 1.15
    add(z, -0.32, 0.42, 2)
    add(z + 0.15, 0.3, 0.38, 2)
  }
  for (let k = 0; k < 30; k++) { // 06/2025: thirty-odd, crowding the foot, then up the flank as steps
    const foot = k < 18
    const z = foot ? 15 + k * 0.55 + r() * 0.3 : 25.5
    add(z, foot ? (r() - 0.5) * 2.4 : -1.4 + (k - 18) * 0.24, foot ? 0.3 + r() * 0.14 : 0.36, 3, foot ? 0 : 0.35 + (k - 18) * 0.32, 'stone')
  }
  add(25.5, 1.9, 0.5, 4, 4.7, 'fence') // 04/2026: the fenced one
  add(25.5, 2.5, 0.3, 5, 5.5, 'today', 0.85) // today: the highest step still in sight
  return out
}

/** a stone's sprite: the painted stone (sunk in the sand) and its silhouette as a ground shadow (base at the top edge, fading) */
interface Sprite { stone: HTMLCanvasElement; shadow: HTMLCanvasElement; sw: number; sh: number; base: number; bodyW: number; bodyH: number }

/**
 * Scene 5 · the tide of launches (GRAZE + one-point, canvas). The eye lies at the water's edge at one end of a long tidal
 * flat that runs diagonally away to a mountain: time runs into depth. At high water the flat is a sheet of water with the
 * moon's broken road running to the eye. The moon in the sky is the slider: drag it and the water draws back toward the
 * mountain, the stones rise in date order, each shedding drips and rings — few and far apart near the eye, crowding the
 * mountain's foot and climbing its flank by 2025. Each stone sits sunk in the sand with a contact shadow, and its shadow lies
 * long on the flat away from the moon; the wet sand behind the water mirrors stones and moon, the raked lines run with the
 * perspective to the mountain. At 06/2025 their shadows make the comparison on the sand: one thin shadow beside a band
 * thirty wide. The prediction sits in the cloud on the summit.
 */
export function tideScene(ctx: SceneCtx) {
  p2Defs()
  const low = ctx.quality === 'low'
  const ms = D.milestones
  const n = ms.length - 1 // stops 0…n; n = today
  const stableH = stableHeight(ctx, [S.insight as Fact])
  const stones = stonesOf()

  const cv = h('canvas', { class: 't19t-cv', 'aria-hidden': 'true' })
  const disc = s('svg', { class: 't19t-disc', viewBox: '-25 -25 50 50', 'aria-hidden': 'true' }, moonArt(0, 0, 21, 1919, true))
  const valueText = (i: number) => fill(L.tideValue, { date: viDate(ms[i].date), label: ms[i].label })
  const moonEl = h('div', {
    class: 't19t-moon', role: 'slider', tabindex: '0', 'aria-label': S.moonAria, 'aria-valuemin': '0', 'aria-valuemax': String(n), 'aria-valuenow': '0', 'aria-valuetext': valueText(0),
  }, disc)
  const q = h('p', { class: 't19t-q' }, S.stones) // what a stone stands for, said where the stones are (the method note is in the detail)
  const read = h('div', { class: 't19t-card' })
  const words = h('div', { class: 't19t-words' }, q, read)
  const cmpA = h('p', { class: 't19t-cmp t19t-cmp-a' })
  const cmpB = h('p', { class: 't19t-cmp t19t-cmp-b' })
  const fore = h('p', { class: 't19t-fore' })
  const root = h('div', { class: `t19t${low ? ' low' : ''}`, role: 'group', 'aria-label': S.art }, cv, cmpA, cmpB, fore, words, moonEl)
  ctx.art.append(root)
  ctx.prompt(S.prompt)
  // H1 the vermilion dot on the moon, H2 its faint ink arc across the sky with the six stops ticked
  const gd = guide(ctx)
  const moonDot = gd.dot(moonEl, { dir: [1, -0.3] })
  const way = gd.track(() => samples.length ? samples.filter((_, k) => k % 4 === 0) : [[0, 0], [1, 0]], { labels: S.ticks })

  let W = 0, H = 0, dpr = 1
  let tallF = false
  let hy = 0, f = 1, hc = 1, pa = 0, pb = 0, cx = 0 // the ground plane's projection
  let tt = 0 // the moon: 0 first launch … 1 today
  let at = -1
  let reached = false
  let arc: (t: number) => [number, number] = () => [0, 0]
  let samples: [number, number][] = []
  let bg: HTMLCanvasElement | null = null
  let waterCv: HTMLCanvasElement | null = null, wetCv: HTMLCanvasElement | null = null, roadCv: HTMLCanvasElement | null = null, veilCv: HTMLCanvasElement | null = null
  let moonX = 0, moonY = 0
  const sprites = new Map<number, Sprite>()
  let col = { water: '', mist: '', moon: '', ink: '', paper: '', sand: '', wash: '', vermilion: '', umbra: '', hi: '', mid: '', lo: '', moss: '', dark: false }
  let palKey = ''

  // the water line (world depth) at each stop: just past that stop's farthest stone on the flat; the flank ones need none
  const knots = Array.from({ length: n + 1 }, (_, i) => {
    const zs = stones.filter((st) => st.stop === i && !st.up).map((st) => st.z)
    return zs.length ? Math.max(...zs) + 0.6 : 28.5
  })
  for (let i = 1; i <= n; i++) knots[i] = Math.max(knots[i], knots[i - 1])
  const waterZ = (t: number) => {
    const u = clamp(t, 0, 1) * n
    const i = Math.min(n - 1, Math.floor(u))
    return knots[i] + (knots[i + 1] - knots[i]) * (u - i)
  }
  // far stones first, the flank's lower steps before its higher ones (fixed, so the frame sorts nothing)
  const order = stones.map((_, i) => i).sort((a, b) => stones[b].z - stones[a].z || stones[a].up - stones[b].up)

  const proj = (X: number, z: number): [number, number, number] => {
    const k = f / z
    return [cx + X * k, hy + hc * k, k]
  }
  const pathX = (z: number) => pa + pb * z

  function readPal() {
    const cs = getComputedStyle(document.documentElement)
    const v = (k: string) => cs.getPropertyValue(k).trim()
    col = { water: v('--water'), mist: v('--mist'), moon: v('--moon'), ink: v('--ink'), paper: v('--paper'), sand: v('--paper-2'), wash: v('--wash'), vermilion: v('--vermilion'), umbra: v('--umbra'), hi: v('--rock-hi'), mid: v('--rock-mid'), lo: v('--rock-lo'), moss: v('--moss-b'), dark: document.documentElement.dataset.theme === 'dark' }
    const key = Object.values(col).join()
    const changed = key !== palKey
    palKey = key
    return changed
  }

  /**
   * A garden stone seen low across the flat: a seeded boulder (not a dome), lit from the moon's side with a brushed
   * terminator, moss on its crown, wet streaks down its foot, sunk in the sand with a lip of sand over its base and a dark
   * contact shadow; plus its silhouette for the long ground shadow. Baked once per stone and theme.
   */
  function sprite(st: Stone): Sprite {
    const key = st.seed
    const hit = sprites.get(key)
    if (hit) return hit
    const r = rng(st.seed)
    const SW = st.big ? 380 : 150
    const bodyW = SW * 0.78
    const bodyH = st.kind === 'today' ? SW * 0.62 : bodyW * (st.hh / st.w) * (st.big ? 0.82 : 0.95)
    const SH = Math.ceil(bodyH * 1.25 + SW * 0.12)
    const base = bodyH * 1.1
    const c = h('canvas')
    c.width = SW
    c.height = SH
    const g = c.getContext('2d')!
    const bx = SW / 2
    const outline = st.kind === 'today'
      ? (() => { const w2 = bodyW * 0.32; return [[-w2, 0], [-w2 * 0.9, -bodyH * 0.8], [-w2 * 0.3, -bodyH], [w2 * 0.5, -bodyH * 0.96], [w2, -bodyH * 0.6], [w2, 0]] as [number, number][] })()
      : rock(bodyW, bodyH, st.seed).top
    const shape = (dy = 0) => {
      g.beginPath()
      outline.forEach(([x, y], i) => (i ? g.lineTo(bx + x, base + y + dy) : g.moveTo(bx + x, base + y + dy)))
      g.lineTo(bx + outline[outline.length - 1][0], base + bodyH * 0.12)
      g.lineTo(bx + outline[0][0], base + bodyH * 0.12)
      g.closePath()
    }
    // contact shadow under the foot
    const cg = g.createRadialGradient(bx + bodyW * 0.04, base, 0, bx + bodyW * 0.04, base, bodyW * 0.62)
    cg.addColorStop(0, fade(col.dark ? col.umbra : col.wash, col.dark ? 0.75 : 0.45))
    cg.addColorStop(1, fade(col.dark ? col.umbra : col.wash, 0))
    g.save()
    g.translate(0, base)
    g.scale(1, 0.16)
    g.translate(0, -base)
    g.fillStyle = cg
    g.fillRect(0, base - bodyW, SW, bodyW * 2)
    g.restore()
    // body: three tones; the moon is on the right, the left flank falls into shade along a wandering terminator
    shape()
    const lg = g.createLinearGradient(bx + bodyW * 0.45, base - bodyH, bx - bodyW * 0.4, base)
    lg.addColorStop(0, col.dark ? col.mid : col.lo)
    lg.addColorStop(0.5, col.dark ? col.lo : fade(col.wash, 0.75))
    lg.addColorStop(1, col.dark ? col.umbra : col.wash)
    g.fillStyle = lg
    g.fill()
    g.save()
    shape()
    g.clip()
    g.fillStyle = fade(col.dark ? '#000' : col.wash, col.dark ? 0.45 : 0.35)
    g.beginPath()
    g.moveTo(bx - bodyW, base + 4)
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      g.lineTo(bx - bodyW * 0.08 + Math.sin(t * 5 + st.seed) * bodyW * 0.06 - t * bodyW * 0.12, base - bodyH * (1.1 - t * 1.2))
    }
    g.lineTo(bx - bodyW, base - bodyH * 1.2)
    g.closePath()
    g.fill()
    // dry strokes in the shade, moss on the crown, wet streaks at the foot
    g.strokeStyle = col.dark ? '#000' : col.wash
    g.globalAlpha = 0.3
    for (let k = 0; k < 7; k++) {
      const x = bx + (r() - 0.65) * bodyW * 0.7, y = base - bodyH * (0.2 + r() * 0.6)
      g.lineWidth = SW * (0.005 + r() * 0.008)
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + bodyW * 0.06, y + bodyH * 0.1, x + bodyW * (0.03 + r() * 0.08), y + bodyH * (0.18 + r() * 0.2))
      g.stroke()
    }
    g.globalAlpha = col.dark ? 0.55 : 0.7
    g.fillStyle = col.moss
    for (let k = 0; k < (st.big ? 9 : 4); k++) {
      const i = Math.floor(outline.length * (0.3 + r() * 0.45))
      const [x, y] = outline[i]
      g.beginPath()
      g.ellipse(bx + x + (r() - 0.5) * bodyW * 0.05, base + y + bodyH * (0.04 + r() * 0.05), bodyW * (0.04 + r() * 0.06), bodyH * (0.025 + r() * 0.03), (r() - 0.5) * 0.4, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = col.dark ? 0.35 : 0.25
    g.fillStyle = col.dark ? '#000' : col.wash
    for (let k = 0; k < (st.big ? 10 : 4); k++) {
      const x = bx + (r() - 0.5) * bodyW * 0.85
      const len = bodyH * (0.12 + r() * 0.25)
      g.fillRect(x, base - len, SW * (0.004 + r() * 0.006), len)
    }
    g.restore()
    // the moon's rim on the crown, toward the right
    g.save()
    shape()
    g.clip()
    g.lineWidth = Math.max(2, SW * 0.016)
    g.strokeStyle = col.moon
    g.globalAlpha = col.dark ? 0.8 : 0.6
    g.beginPath()
    outline.slice(Math.floor(outline.length * 0.42), Math.floor(outline.length * 0.92)).forEach(([x, y], i) => (i ? g.lineTo(bx + x - 1, base + y + 1.5) : g.moveTo(bx + x - 1, base + y + 1.5)))
    g.stroke()
    g.restore()
    g.globalAlpha = 0.55
    g.lineWidth = Math.max(1.2, SW * 0.008)
    g.strokeStyle = col.dark ? '#000' : col.wash
    g.beginPath()
    outline.forEach(([x, y], i) => (i ? g.lineTo(bx + x, base + y) : g.moveTo(bx + x, base + y)))
    g.stroke()
    g.globalAlpha = 1
    // sunk in the sand: a ragged lip of sand over its foot
    const lip = g.createLinearGradient(0, base - bodyH * 0.08, 0, base + bodyH * 0.12)
    lip.addColorStop(0, fade(col.dark ? col.mist : col.sand, col.dark ? 0.28 : 0.85))
    lip.addColorStop(1, fade(col.dark ? col.mist : col.sand, col.dark ? 0.4 : 1))
    g.fillStyle = lip
    g.beginPath()
    g.moveTo(bx - bodyW * 0.7, base + bodyH * 0.12)
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      const bulge = Math.sin(t * Math.PI)
      g.lineTo(bx - bodyW * 0.7 + bodyW * 1.4 * t, base + bodyH * 0.1 - bodyH * bulge * (0.13 + 0.04 * Math.sin(t * 9 + st.seed)))
    }
    g.closePath()
    g.fill()
    if (st.kind === 'today') {
      g.fillStyle = col.vermilion
      g.fillRect(bx - SW * 0.03, base - bodyH * 0.62, SW * 0.06, SW * 0.08)
    }
    if (st.kind === 'fence') {
      g.strokeStyle = col.dark ? col.mist : col.wash
      g.globalAlpha = 0.85
      g.lineWidth = SW * 0.018
      for (let k = 0; k < 9; k++) {
        const a = (k / 8) * Math.PI
        const x = bx + Math.cos(a) * bodyW * 0.62, y = base + Math.sin(a) * 6 - 4
        g.beginPath()
        g.moveTo(x, y + 6)
        g.lineTo(x, y - bodyH * 0.55)
        g.stroke()
      }
      g.beginPath()
      g.moveTo(bx - bodyW * 0.62, base - bodyH * 0.3)
      g.quadraticCurveTo(bx, base - bodyH * 0.2, bx + bodyW * 0.62, base - bodyH * 0.3)
      g.stroke()
      g.globalAlpha = 1
    }
    // the silhouette laid down as a ground shadow: base along the top edge, the crown at the bottom, fading away
    const sc = h('canvas')
    const SSH = Math.ceil(bodyH)
    sc.width = SW
    sc.height = SSH
    const sg = sc.getContext('2d')!
    sg.beginPath()
    outline.forEach(([x, y], i) => (i ? sg.lineTo(bx + x, -y) : sg.moveTo(bx + x, -y)))
    sg.closePath()
    const sgr = sg.createLinearGradient(0, 0, 0, SSH)
    sgr.addColorStop(0, fade(col.dark ? col.umbra : col.wash, col.dark ? 0.6 : 0.34))
    sgr.addColorStop(1, fade(col.dark ? col.umbra : col.wash, 0))
    sg.fillStyle = sgr
    sg.fill()
    const sp = { stone: c, shadow: sc, sw: SW, sh: SH, base, bodyW, bodyH }
    sprites.set(key, sp)
    return sp
  }

  // ── the still painting: sky mist, far ranges, the mountain with cloud on its summit, the silver flat with its rake
  function* paintBg() {
    const c = h('canvas')
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    const r = rng(1971)
    // far ranges along the horizon, pale
    const range = (base: number, amp: number, alpha: number, seed: number) => {
      const rr = rng(seed)
      g.beginPath()
      g.moveTo(-10, base)
      for (let x = -10; x <= W + 10; x += 8) {
        const y = base - amp * (0.4 + 0.6 * Math.abs(Math.sin(x * 0.006 + rr() * 0.2 + seed)) * (0.6 + 0.4 * Math.sin(x * 0.019 + seed)))
        g.lineTo(x, y)
      }
      g.lineTo(W + 10, base)
      g.closePath()
      const lg = g.createLinearGradient(0, base - amp, 0, base)
      lg.addColorStop(0, col.wash)
      lg.addColorStop(1, col.paper)
      g.globalAlpha = alpha
      g.fillStyle = lg
      g.fill()
      g.globalAlpha = 1
    }
    range(hy + 1, H * 0.05, col.dark ? 0.55 : 0.18, 3)
    yield
    // the mountain the flat runs to: a tall ink peak, its feet in the water, cloud on its crown
    const [mx, my] = proj(pathX(26), 26)
    const mw = Math.min(W * 0.62, H * 0.9), mh = Math.min(H * 0.42, my - H * 0.04)
    g.beginPath()
    g.moveTo(mx - mw * 0.6, hy + 2)
    for (let i = 0; i <= 60; i++) {
      const u = i / 60
      const x = mx - mw * 0.6 + mw * 1.2 * u
      const d = Math.abs(u - 0.47) / 0.53
      const y = hy - mh * Math.pow(1 - Math.min(1, d), 1.6) * (1 + 0.08 * Math.sin(u * 37 + 1) + 0.05 * Math.sin(u * 91))
      g.lineTo(x, y)
    }
    g.lineTo(mx + mw * 0.6, hy + 2)
    g.closePath()
    const mg = g.createLinearGradient(0, hy - mh, 0, hy)
    mg.addColorStop(0, col.wash)
    mg.addColorStop(0.6, col.wash)
    mg.addColorStop(1, col.paper)
    g.globalAlpha = col.dark ? 0.8 : 0.42
    g.fillStyle = mg
    g.fill()
    g.globalAlpha = col.dark ? 0.25 : 0.18
    g.strokeStyle = col.wash
    for (let i = 0; i < 70; i++) {
      const u = 0.15 + r() * 0.7
      const x = mx - mw * 0.6 + mw * 1.2 * u
      const d = Math.abs(u - 0.47) / 0.53
      const y = hy - mh * Math.pow(1 - Math.min(1, d), 1.6) + 6
      g.lineWidth = 0.8 + r() * 1.6
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + (u < 0.47 ? -1 : 1) * (6 + r() * 14), y + 20 + r() * mh * 0.35)
      g.stroke()
    }
    g.globalAlpha = 1
    yield
    const cloud = (gg: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a: number, c = col.mist) => {
      const rg = gg.createRadialGradient(x, y, 0, x, y, rx)
      rg.addColorStop(0, c)
      rg.addColorStop(1, fade(c, 0))
      gg.save()
      gg.translate(x, y)
      gg.scale(1, ry / rx)
      gg.translate(-x, -y)
      gg.globalAlpha = a
      gg.fillStyle = rg
      gg.fillRect(x - rx, y - rx, rx * 2, rx * 2)
      gg.restore()
    }
    const ca = col.dark ? 0.55 : 0.95
    for (let i = 0; i < 9; i++) cloud(g, mx - mw * 0.05 + (r() - 0.5) * mw * 0.7, hy - mh * (0.72 + r() * 0.3), mw * (0.18 + r() * 0.2), mh * 0.12, ca)
    cloud(g, W * 0.5, hy - H * 0.01, W * 0.7, H * 0.035, ca * 0.8)
    yield
    // the dry flat: silver sand with a grain, darker toward the eye
    const silver = col.dark ? fade(col.mist, 0.4) : col.sand
    const sg = g.createLinearGradient(0, hy, 0, H)
    sg.addColorStop(0, col.dark ? fade(col.mist, 0.3) : col.mist)
    sg.addColorStop(0.4, silver)
    sg.addColorStop(1, col.dark ? fade(col.mist, 0.18) : col.sand)
    g.fillStyle = sg
    g.fillRect(0, hy, W, H - hy)
    // the rake: lines running with the flat toward the mountain, converging on its vanishing point, bending a little
    g.strokeStyle = col.dark ? col.mist : col.wash
    for (let k = -26; k <= 26; k++) {
      const c0 = k * 0.26 + (r() - 0.5) * 0.05
      g.globalAlpha = col.dark ? 0.1 : 0.1
      g.beginPath()
      let first = true
      for (let z = 1.3; z <= 27; z *= 1.08) {
        const X = pathX(z) + c0 + Math.sin(z * 0.55 + k) * 0.05 * Math.min(1, z / 6)
        const [x, y, kk] = proj(X, z)
        g.lineWidth = Math.max(0.4, kk * 0.006)
        if (first) g.moveTo(x, y), (first = false)
        else g.lineTo(x, y)
      }
      g.stroke()
      if (k % 6 === 0) yield
    }
    g.globalAlpha = 1
    bg = c
    yield
    // what the frame only blits: the water body (fading in at the horizon), the wet band, the moon's road, the summit's veil
    const mk = (w: number, hh: number) => {
      const cc = h('canvas')
      cc.width = Math.max(1, Math.round(w * dpr))
      cc.height = Math.max(1, Math.round(hh * dpr))
      const gg = cc.getContext('2d')!
      gg.scale(dpr, dpr)
      return [cc, gg] as const
    }
    const [wc, wg] = mk(W, H)
    const grad = wg.createLinearGradient(0, hy - 1, 0, H)
    grad.addColorStop(0, fade(col.water, 0))
    grad.addColorStop(0.05, fade(col.water, 0.55))
    grad.addColorStop(0.2, col.water)
    grad.addColorStop(1, col.water)
    wg.globalAlpha = col.dark ? 0.95 : 0.78
    wg.fillStyle = grad
    wg.fillRect(0, hy - 1, W, H - hy + 1)
    // the sky mirrored: pale at the horizon (grazing), gone toward the eye; never as light as the sky itself
    const sky = col.dark ? col.mist : col.paper
    const refl = wg.createLinearGradient(0, hy, 0, H)
    refl.addColorStop(0, fade(sky, col.dark ? 0.2 : 0.45))
    refl.addColorStop(0.18, fade(sky, col.dark ? 0.07 : 0.16))
    refl.addColorStop(0.5, fade(sky, 0))
    wg.globalAlpha = 1
    wg.fillStyle = refl
    wg.fillRect(0, hy - 1, W, H - hy + 1)
    waterCv = wc
    // wet sand: dark and glossy just behind the water's edge, fading toward the eye
    const wetH = (H - hy) * 0.3
    const [tc, tg] = mk(W, wetH)
    const wet = tg.createLinearGradient(0, 0, 0, wetH)
    wet.addColorStop(0, fade(col.dark ? '#000' : col.water, col.dark ? 0.5 : 0.5))
    wet.addColorStop(0.35, fade(col.dark ? '#000' : col.water, col.dark ? 0.3 : 0.28))
    wet.addColorStop(1, fade(col.dark ? '#000' : col.water, 0))
    tg.fillStyle = wet
    tg.fillRect(0, 0, W, wetH)
    wetCv = tc
    // the moon's broken road: short dry strokes, longer toward the eye
    const rw = Math.min(W * 0.5, 360)
    const [rc, rg2] = mk(rw, H - hy + 2)
    const rr = rng(1977)
    // a soft column of moonlight under the broken strokes
    const colG = rg2.createLinearGradient(0, 0, rw, 0)
    colG.addColorStop(0, fade(col.moon, 0))
    colG.addColorStop(0.5, fade(col.moon, col.dark ? 0.09 : 0.14))
    colG.addColorStop(1, fade(col.moon, 0))
    rg2.fillStyle = colG
    rg2.fillRect(0, 0, rw, H - hy + 2)
    rg2.globalAlpha = col.dark ? 0.85 : 0.65
    rg2.fillStyle = col.moon
    for (let i = 0; i < 90; i++) {
      const y = 2 + Math.pow(rr(), 1.5) * (H - hy)
      const spread = 4 + y * 0.26
      const x = rw / 2 + (rr() - 0.5) * spread * 1.6
      const len = 3 + y * 0.11 * (0.5 + rr())
      rg2.fillRect(x - len / 2, y, len, Math.max(1, y * 0.013))
    }
    roadCv = rc
    // the summit's veil: the high steps of the flank go into it
    const [vc, vg] = mk(W, H)
    for (let i = 0; i < 5; i++) cloud(vg, mx + (r() - 0.4) * mw * 0.3, hy - mh * (0.35 + i * 0.12), mw * (0.12 + r() * 0.08), mh * 0.06, col.dark ? 0.3 : 0.55)
    // drifts of mist at both sides over sand and water: the picture runs to the frame and dissolves there, no box
    for (const side of [0, 1]) {
      for (let i = 0; i < 4; i++) {
        const x = side ? W * (0.98 + r() * 0.06) : W * (0.02 - r() * 0.06)
        cloud(vg, x, hy + (H - hy) * (0.05 + i * 0.28 + r() * 0.1), W * (0.1 + r() * 0.06), (H - hy) * (0.12 + r() * 0.08), 0.85, col.paper)
      }
      cloud(vg, side ? W * 1.02 : -W * 0.02, hy - H * 0.04, W * 0.12, H * 0.12, 0.75, col.paper)
    }
    veilCv = vc
    yield
    // out of focus in front: a few pebbles and blades of beach grass, painted small and enlarged (a cheap, soft blur)
    const lowc = h('canvas')
    const q4 = 5
    lowc.width = Math.ceil(W / q4)
    lowc.height = Math.ceil(H / q4)
    const lgc = lowc.getContext('2d')!
    lgc.scale(1 / q4, 1 / q4)
    lgc.fillStyle = col.dark ? '#000' : col.wash
    lgc.strokeStyle = col.dark ? '#000' : col.wash
    const fr = rng(1983)
    for (let i = 0; i < 7; i++) {
      const x = W * (0.32 + fr() * 0.6), y = H * (1.0 + fr() * 0.03), rx = H * (0.014 + fr() * 0.03)
      lgc.globalAlpha = col.dark ? 0.75 : 0.45
      lgc.beginPath()
      lgc.ellipse(x, y, rx * 1.4, rx, 0, 0, Math.PI * 2)
      lgc.fill()
    }
    for (let i = 0; i < 16; i++) {
      const x = W * (0.82 + fr() * 0.2), y = H * 1.02, len = H * (0.08 + fr() * 0.12), lean = (fr() - 0.6) * len * 0.7
      lgc.globalAlpha = col.dark ? 0.7 : 0.4
      lgc.lineWidth = 3 + fr() * 4
      lgc.beginPath()
      lgc.moveTo(x, y)
      lgc.quadraticCurveTo(x + lean * 0.3, y - len * 0.6, x + lean, y - len)
      lgc.stroke()
    }
    const bgc = c.getContext('2d')!
    bgc.imageSmoothingQuality = 'high'
    bgc.drawImage(lowc, 0, 0, lowc.width * q4, lowc.height * q4)
  }

  // ── each frame: the painting, the water drawn back to its line, the risen stones with their shadows, their rings
  const rings: { x: number; y: number; k: number; t0: number }[] = []
  function frame(now: number) {
    const g = cv.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    if (bg) g.drawImage(bg, 0, 0, W, H)
    const zwNow = low ? 28.5 : waterZ(tt) // low: the tide is out, every stone already stands
    const wy = hy + (hc * f) / zwNow
    const mxs = moonX
    const wetH = (H - hy) * 0.3
    // wet sand just behind the water, glossy: the moon and the nearest risen stones are mirrored in it
    if (wetCv) g.drawImage(wetCv, 0, wy, W, wetH)
    if (roadCv && wy < H) {
      const rw = roadCv.width / dpr
      g.globalAlpha = 0.45
      g.drawImage(roadCv, 0, 0, roadCv.width, Math.min(roadCv.height, wetH * 0.6 * dpr), mxs - rw / 2, wy, rw, wetH * 0.6)
      g.globalAlpha = 1
    }
    for (const i of order) {
      const st = stones[i]
      if (st.up || st.at < 0 || st.sy < wy || st.sy > wy + wetH * 0.8) continue
      const sp = sprite(st)
      const w = (st.w * st.sk * (st.big && tallF ? 0.58 : 1)) / 0.78
      const sh = w * (sp.sh / sp.sw)
      g.save()
      g.globalAlpha = 0.22 * (1 - (st.sy - wy) / (wetH * 0.8))
      g.translate(st.sx, st.sy)
      g.scale(1, -0.7)
      g.drawImage(sp.stone, -w / 2, -sh * (sp.base / sp.sh), w, sh)
      g.restore()
    }
    if (waterCv && roadCv && wy > hy) {
      const top = hy - 1, d = dpr
      g.drawImage(waterCv, 0, top * d, W * d, (wy - top) * d, 0, top, W, wy - top)
      const rw = roadCv.width / d
      g.drawImage(roadCv, 0, 0, roadCv.width, (wy - top) * d, mxs - rw / 2, top, rw, wy - top)
      // foam: a thin broken line of white where the water meets the sand, a fainter one behind it
      g.strokeStyle = col.dark ? col.moon : col.paper
      for (const [dy, a, lw] of [[0, col.dark ? 0.85 : 0.95, 1.4], [-3, 0.4, 0.8]] as const) {
        g.globalAlpha = a
        g.lineWidth = lw
        g.beginPath()
        let pen = false
        for (let x = 0; x <= W; x += 6) {
          const on = Math.sin(x * 0.043 + dy) + Math.sin(x * 0.11 + now * 0.4) * 0.6 > -0.55
          const y = wy + dy + Math.sin(x * 0.05 + now * 1.3) * 1.2
          if (on && pen) g.lineTo(x, y)
          else if (on) g.moveTo(x, y), (pen = true)
          else pen = false
        }
        g.stroke()
      }
      g.globalAlpha = 1
    }
    // stones, far first; a stone under the water line is hidden, one on the flank comes out of the mist with its stop
    for (const i of order) {
      const st = stones[i]
      const up = st.up > 0
      const shown = low || (up ? tt * n >= st.stop - 0.15 : st.z < zwNow)
      if (!shown) {
        st.at = -1
        continue
      }
      if (st.at < 0) {
        st.at = now
        if (!up && !low) rings.push({ x: st.sx, y: st.sy, k: st.sk, t0: now })
      }
      const sp = sprite(st)
      const k = st.sk * (up ? 1.7 : st.big && tallF ? 0.58 : 1) // the flank's steps drawn a little larger: each a stone, not a dot
      const x = st.sx
      const y = st.sy - st.up * st.sk
      const w = (st.w * k) / 0.78
      const sh = w * (sp.sh / sp.sw)
      const rise = low || ctx.reduced ? 1 : clamp((now - st.at) / 0.7, 0, 1)
      const fadeUp = up ? clamp(1.15 - st.up / 6.5, 0.25, 1) : 1
      const a = (low ? (st.stop === Math.round(tt * n) ? 1 : 0.6) : up ? clamp(tt * n - st.stop + 0.6, 0, 1) : 1) * fadeUp
      // its shadow, lying on the flat away from the moon: toward the eye and to the left when the moon is on the right
      const lean = clamp((mxs - x) / W, -0.4, 0.9)
      const L = (up ? 0.9 : 2.3) * (0.75 + 0.25 * (1 - moonY / (H * 0.4)))
      g.save()
      g.globalAlpha = a * rise
      g.translate(x, y + 1)
      g.transform(1, 0, -lean * L * 1.1, L * 0.42, 0, 0)
      g.drawImage(sp.shadow, -w / 2, 0, w, sp.bodyH * (w / sp.sw))
      g.restore()
      g.globalAlpha = a
      g.drawImage(sp.stone, x - w / 2, y - sh * (sp.base / sp.sh) + (1 - rise) * sh * 0.3, w, sh)
      g.globalAlpha = 1
    }
    // the summit's veil over the highest steps
    if (veilCv) g.drawImage(veilCv, 0, 0, W, H)
    // drips: rings spreading round a stone as it breaks the surface
    for (let i = rings.length - 1; i >= 0; i--) {
      const rg = rings[i]
      const u = (now - rg.t0) / 1.4
      if (u >= 1) {
        rings.splice(i, 1)
        continue
      }
      g.strokeStyle = col.moon
      g.lineWidth = 1
      for (let k = 0; k < 3; k++) {
        const v = u - k * 0.18
        if (v <= 0) continue
        g.globalAlpha = (1 - v) * 0.6
        g.beginPath()
        g.ellipse(rg.x, rg.y, rg.k * (0.3 + v * 1.1), rg.k * (0.08 + v * 0.28), 0, 0, Math.PI * 2)
        g.stroke()
      }
    }
    g.globalAlpha = 1
    return rings.length > 0
  }

  const loop = createLoop(root, (t) => frame(t) || dragging)
  ctx.onCleanup(() => loop.dispose())
  const paint = () => (low || ctx.reduced ? loop.wake() : loop.start())

  // ── the moon on its arc: the slider
  function show(i: number) {
    if (i === at) return
    at = i
    moonEl.setAttribute('aria-valuenow', String(i))
    moonEl.setAttribute('aria-valuetext', valueText(i))
    const m = ms[i]
    read.replaceChildren(h('p', { class: 'p2-eyebrow' }, `${viDate(m.date)} · ${m.label}`), ctx.fact(m.fact, 'p', 't19t-fact'))
    if (!read.hasAttribute('aria-live')) read.setAttribute('aria-live', 'polite')
    const c = ms.find((x) => x.compare)?.compare
    const ci = ms.findIndex((x) => x.compare)
    root.classList.toggle('cmp', !!c && i >= ci)
    if (c) {
      cmpA.textContent = `${c.before} · ${c.beforeLabel ?? ''}`
      cmpB.textContent = `${c.after} · ${c.afterLabel ?? ''}`
    }
    if (i === n) {
      fore.replaceChildren(ctx.fact(D.horizon, 'span', 't19t-fore-text'))
      root.classList.add('today')
      if (!reached) {
        reached = true
        moonDot.done()
        ctx.insight(S.insight as Fact, S.detail)
      }
    }
  }
  function moveTo(t: number, snap: boolean) {
    tt = clamp(t, 0, 1)
    const near = Math.round(tt * n)
    if (snap) tt = near / n
    const [x, y] = arc(tt)
    moonX = x
    moonY = y
    moonEl.style.transform = `translate(${f1(x)}px, ${f1(y)}px)`
    moonEl.classList.toggle('snap', snap)
    way.set(tt)
    // the eye edges forward with the moon
    cv.style.transform = `scale(${f1(1 + tt * 0.05)})`
    show(near)
    placeLabels()
    paint()
  }
  function tAt(x: number, y: number) {
    let best = 0, bd = Infinity
    samples.forEach(([sx, sy], k) => {
      const d = (sx - x) ** 2 + (sy - y) ** 2
      if (d < bd) (bd = d), (best = k)
    })
    return best / (samples.length - 1)
  }
  let dragging = false
  let box: DOMRect | null = null
  root.addEventListener('pointerdown', (e) => {
    if (e.button || (e.target as Element).closest('.t19t-card, .scene-insight')) return
    dragging = true
    box = root.getBoundingClientRect()
    root.setPointerCapture(e.pointerId)
    moonEl.focus({ preventScroll: true })
    moveTo(tAt(e.clientX - box.left, e.clientY - box.top), false)
    ctx.chime('soft')
  })
  root.addEventListener('pointermove', (e) => dragging && box && moveTo(tAt(e.clientX - box.left, e.clientY - box.top), false))
  const end = () => {
    if (!dragging) return
    dragging = false
    moveTo(tt, true)
  }
  root.addEventListener('pointerup', end)
  root.addEventListener('pointercancel', end)
  moonEl.addEventListener('keydown', (e) => {
    const k = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[e.key]
    const to = k ? clamp(at + k, 0, n) : e.key === 'Home' ? 0 : e.key === 'End' ? n : -1
    if (to < 0) return
    e.preventDefault()
    moveTo(to / n, true)
  })

  /** the comparison written by the shadows (06/2025): one thin shadow (GPT-4), a band thirty wide at the mountain's foot */
  function placeLabels() {
    const a = stones.find((st) => st.stop === 1)!
    const [ax, ay, ak] = proj(pathX(a.z) + a.dx, a.z)
    cmpA.style.transform = `translate(${f1(tallF ? ax - ak * 0.1 : ax + ak * 0.5)}px, ${f1(ay + ak * 0.4)}px)`
    const foot = stones.filter((st) => st.stop === 3 && !st.up)
    const z = foot.reduce((s0, st) => s0 + st.z, 0) / foot.length
    const [bx, by, bk] = proj(pathX(z), z)
    cmpB.style.transform = tallF ? `translate(${f1(Math.min(W - 8, bx + bk * 2.6))}px, ${f1(by + bk * 1.5)}px)` : `translate(${f1(bx - bk * 0.4)}px, ${f1(by + bk * 1.3)}px)`
    if (!tallF && at >= 0) {
      // the reading sits beside the stop's stone (the foot's middle one for the thirty): right of the near ones; for the far
      // ones, left of the chain on the water just above the horizon, under the moon's arc
      const of = stones.filter((st) => st.stop === at)
      const st = of[Math.floor(of.length / 2)]
      const x = st.sx, y = st.sy - st.up * st.sk, k = st.sk
      const near = x < W * 0.5
      words.classList.toggle('flip', !near)
      words.style.transform = near ? `translate(${f1(x + k * 0.5)}px, ${f1(Math.max(y - k * 0.25, hy + (hc * f) / waterZ(tt) + 10))}px)` : `translate(${f1(x - W * 0.05)}px, ${f1(hy - H * 0.02)}px)`
    }
    const [mx] = proj(pathX(26), 26)
    // the prediction: desk on the mountain's right shoulder, clear of the arc and its ticks
    fore.style.transform = W / H < 1
      ? `translate(${f1(W - 12)}px, ${f1(hy + (H - hy) * 0.36)}px)` // phone: on the empty sand right of the chain, clear of words and arc
      : `translate(${f1(mx + Math.min(W * 0.62, H * 0.9) * 0.3)}px, ${f1(hy - H * 0.05)}px)`
  }

  let job: ReturnType<typeof sliced> | null = null
  function layout() {
    W = ctx.art.clientWidth
    H = stableH(ctx.art.clientHeight)
    if (W < 60 || H < 60) return
    root.style.height = `${f1(H)}px`
    const tall = W / H < 1
    tallF = tall
    root.classList.toggle('tall', tall)
    dpr = Math.min(devicePixelRatio || 1, low ? 1 : 1.5)
    cv.width = Math.round(W * dpr)
    cv.height = Math.round(H * dpr)
    // ground plane: horizon, focal length, eye height; the stones' path runs from the near left to the mountain on the right
    hy = H * (tall ? 0.5 : 0.42)
    f = H * 1.1
    cx = W * 0.5
    const z0 = 2.7, zf = 26
    hc = ((tall ? 0.86 : 0.9) * H - hy) * z0 / f
    // the path is pinned at the first stone (ChatGPT) and at the mountain: a diagonal (desk), nearly upright (phone)
    const zc = stones[0].z
    const x0 = W * (tall ? 0.4 : 0.26), xf = W * (tall ? 0.62 : 0.72)
    const A0 = ((x0 - cx) * zc) / f, Af = ((xf - cx) * zf) / f
    pb = (Af - A0) / (zf - zc)
    pa = A0 - pb * zc
    // the moon's arc across the sky, rising on the left and setting over the mountain (tall: low, under the words),
    // walked by arc length so the six ticks of the groove sit on the six stops
    const ax0 = W * (tall ? 0.14 : 0.42), ax1 = W * (tall ? 0.86 : 0.9), ay = H * (tall ? 0.44 : 0.28), lift = H * (tall ? 0.11 : 0.2)
    const raw = (t: number): [number, number] => [ax0 + (ax1 - ax0) * t, ay - Math.sin(Math.PI * (0.15 + 0.7 * t)) * lift]
    const dense = Array.from({ length: 97 }, (_, k) => raw(k / 96))
    const cum = [0]
    for (let k = 1; k < dense.length; k++) cum.push(cum[k - 1] + Math.hypot(dense[k][0] - dense[k - 1][0], dense[k][1] - dense[k - 1][1]))
    arc = (t) => {
      const d = clamp(t, 0, 1) * cum[96]
      let k = 1
      while (k < 96 && cum[k] < d) k++
      const u = (d - cum[k - 1]) / (cum[k] - cum[k - 1] || 1)
      return [dense[k - 1][0] + (dense[k][0] - dense[k - 1][0]) * u, dense[k - 1][1] + (dense[k][1] - dense[k - 1][1]) * u]
    }
    samples = Array.from({ length: 97 }, (_, k) => arc(k / 96))
    way.at([0, 0]) // re-read the groove along the new arc
    for (const st of stones) [st.sx, st.sy, st.sk] = proj(pathX(st.z) + st.dx * (tall && st.big ? 0.4 : 1), st.z)
    readPal()
    sprites.clear()
    job?.cancel()
    job = sliced(paintBg(), { sync: ctx.reduced, budget: 6 })
    void job.done.then(() => paint())
    moveTo(at < 0 ? tt : at / n, true)
  }

  ctx.onCleanup(onPrefs(() => {
    if (!readPal()) return
    sprites.clear()
    job?.cancel()
    job = sliced(paintBg(), { sync: true })
    paint()
  }))
  ctx.onCleanup(() => job?.cancel())
  ctx.onCleanup(onSize(ctx.art, layout))
}
