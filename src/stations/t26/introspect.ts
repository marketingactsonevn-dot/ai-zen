import { h } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { blob, clamp, curve, onDigit, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import C from '../../content/tram-26.json'

/**
 * Scene 2 — the pond that looks at itself (art direction §4, t26 `introspect`): canvas, eye level 2°, a perfect mirror.
 * Horizon, mountains, moon and a white egret on one leg all hang upside down in the still water. From the left edge a
 * sleeve and a hand hold a brush over the water. Press and hold the brush tip: a vermilion-gold drop swells through three
 * strengths; let go and it arcs into the egret's reflection. Then ask the egret. Faint: the drop dissolves before it lands.
 * Just right: five nights pass, five drops, and once — only once — the reflection flashes the injected words; five pebbles
 * on the bank keep the score. Too strong: the pond clouds and the reflection is lost.
 *
 * Layers: bg (sky, ranges, water mirroring them — baked), bird + lift (egret and its rippled reflection, head down / head
 * raised — both baked, crossfaded), fx (moon and its road, the drop, rings, murk, pebbles — drawn per frame only while something moves), near
 * (lotus, reeds, the hand and brush — baked, strong parallax). Words are DOM on water and sky.
 */

const K = C.scenes.introspect
const F = (x: unknown) => x as Fact
const KEYS = ['weak', 'mid', 'strong'] as const
const NIGHTS = 5
const HIT = 2 // the one night of five the egret notices (≈ 20%)

type Pal = Record<'paper' | 'paper2' | 'mist' | 'ink' | 'ink3' | 'wash' | 'water' | 'moon' | 'lantern' | 'vermilion' | 'card' | 'rockLo' | 'rockMid' | 'rockHi' | 'umbra' | 'moss', string> & { dark: boolean; mistA: number }
function readPal(): Pal {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string) => cs.getPropertyValue(n).trim()
  return {
    paper: v('--paper'), paper2: v('--paper-2'), mist: v('--mist'), ink: v('--ink'), ink3: v('--ink-3'), wash: v('--wash'), water: v('--water'),
    moon: v('--moon') || '#f2e4b8', lantern: v('--lantern'), vermilion: v('--vermilion'), card: v('--card'), rockLo: v('--rock-lo'), rockMid: v('--rock-mid'),
    rockHi: v('--rock-hi'), umbra: v('--umbra'), moss: v('--moss-b'), dark: document.documentElement.dataset.theme === 'dark', mistA: parseFloat(v('--mist-a')) || 0.5,
  }
}
/** a CSS colour (hex or rgb) as [r, g, b] */
function rgb(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    const x = c.length === 4 ? c.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : c
    const n = parseInt(x.slice(1, 7), 16)
    return [n >> 16, (n >> 8) & 255, n & 255]
  }
  const m = c.match(/rgba?\(([^)]+)\)/)
  const [r, g, b] = m ? m[1].split(/[\s,/]+/).map(Number) : [128, 128, 128]
  return [r, g, b]
}
/** a CSS colour at alpha a */
const rgba = (c: string, a: number) => `rgba(${rgb(c).join(',')},${a})`
/** two token colours mixed (t = share of b) */
function mix(a: string, b: string, t: number, al = 1) {
  const x = rgb(a), y = rgb(b)
  return `rgba(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')},${al})`
}
const fillD = (g: CanvasRenderingContext2D, d: string, c: string | CanvasGradient) => ((g.fillStyle = c), g.fill(new Path2D(d)))

/** 1D value noise for ridges */
function vnoise(x: number, seed: number) {
  const i = Math.floor(x), f = x - i
  const hsh = (n: number) => {
    const q = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453
    return q - Math.floor(q)
  }
  const u = f * f * (3 - 2 * f)
  return hsh(i) + (hsh(i + 1) - hsh(i)) * u
}
function ridge(W: number, base: number, hh: number, seed: number, f: number) {
  const pts: Pt[] = []
  for (let x = -10; x <= W + 10; x += 5) {
    const r = 1 - Math.abs(vnoise(x * f, seed) * 2 - 1)
    pts.push([x, base - hh * (0.62 * r ** 2.2 + 0.28 * vnoise(x * f * 3.1, seed + 1) + 0.1 * vnoise(x * f * 9, seed + 2))])
  }
  return pts
}

/** The egret, foot at (x, y), t tall, standing on one leg looking down; its neck and head turn by `head` degrees. */
function drawEgret(g: CanvasRenderingContext2D, x: number, y: number, t: number, head: number, p: Pal) {
  const A = (dx: number, dy: number): Pt => [x + dx * t, y - dy * t]
  const Q = (q: Pt) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`
  const white = p.dark ? mix(p.rockHi, p.moon, 0.62) : p.card
  const inkC = p.dark ? rgba(p.umbra, 0.85) : p.ink
  // the standing leg, the folded one
  fillD(g, stroke([A(0, -0.02), A(0.005, 0.2), A(0.02, 0.4)], Math.max(1.6, t * 0.012), 0.05, 0.1, 0.6) + stroke([A(0.02, 0.4), A(0.1, 0.3), A(0.05, 0.27)], Math.max(1.4, t * 0.011), 0.1, 0.2, 0.5), p.dark ? p.rockMid : inkC)
  const body = `M${Q(A(-0.28, 0.37))}Q${Q(A(-0.18, 0.52))} ${Q(A(-0.04, 0.565))}Q${Q(A(0.1, 0.59))} ${Q(A(0.15, 0.5))}Q${Q(A(0.13, 0.385))} ${Q(A(-0.02, 0.38))}Q${Q(A(-0.15, 0.335))} ${Q(A(-0.28, 0.37))}Z`
  // white plumage in the round: lit on the back by the moon behind, sinking into a cool wash under the belly
  const shade = p.dark ? mix(p.rockMid, p.umbra, 0.25) : mix(p.card, p.rockLo, 0.42)
  const bg = g.createLinearGradient(0, y - 0.59 * t, 0, y - 0.34 * t)
  bg.addColorStop(0, white)
  bg.addColorStop(0.45, white)
  bg.addColorStop(1, shade)
  fillD(g, body, bg)
  fillD(g, blob(x - 0.04 * t, y - 0.42 * t, 0.15 * t, 0.045 * t, 6, 0.1, 12), rgba(p.dark ? p.umbra : p.wash, p.dark ? 0.4 : 0.13))
  fillD(g, stroke(curve(A(0.1, 0.545), A(-0.1, 0.56), A(-0.33, 0.35), 14), t * 0.04, 0.3, 0.5, 0.1) + stroke([A(-0.18, 0.4), A(-0.27, 0.355), A(-0.35, 0.32)], t * 0.022, 0.2, 0.6, 0.1) + stroke([A(-0.16, 0.39), A(-0.26, 0.34), A(-0.32, 0.29)], t * 0.016, 0.2, 0.6, 0.1), rgba(p.dark ? p.umbra : p.ink, p.dark ? 0.75 : 0.8))
  fillD(g, stroke(curve(A(0.13, 0.42), A(0.02, 0.37), A(-0.16, 0.35), 10), t * 0.012, 0.2, 0.4, 0.1), rgba(p.ink, 0.3))
  // the moon's rim along the back: a bright lip with a soft glow, the one thing on the bird the moon touches directly
  g.save()
  g.shadowColor = rgba(p.moon, p.dark ? 0.9 : 1)
  g.shadowBlur = t * 0.03
  fillD(g, stroke(curve(A(-0.24, 0.43), A(-0.08, 0.575), A(0.1, 0.59), 12), t * 0.014, 0.3, 0.3, 0.1), p.dark ? rgba(p.moon, 0.95) : rgba(p.card, 1))
  g.restore()
  fillD(g, stroke(curve(A(-0.2, 0.4), A(-0.06, 0.5), A(0.1, 0.545), 10), t * 0.008, 0.3, 0.3, 0.1), rgba(p.dark ? p.umbra : p.ink, 0.22))
  // neck and head, pivoting where the neck leaves the body
  const n0 = A(0.1, 0.52)
  g.save()
  g.translate(n0[0], n0[1])
  g.rotate((head * Math.PI) / 180)
  g.translate(-n0[0], -n0[1])
  const neck = [...curve(n0, A(0.25, 0.66), A(0.19, 0.8), 12), ...curve(A(0.19, 0.8), A(0.16, 0.88), A(0.27, 0.8), 8).slice(1)]
  const hd = A(0.29, 0.785)
  fillD(g, stroke(neck, t * 0.05, 0.25, 0.05, 0.55), white)
  // the throat in shadow, the back of the neck lit
  fillD(g, stroke(neck.map(([a, b]) => [a + t * 0.012, b + t * 0.004] as Pt).slice(2), t * 0.022, 0.2, 0.4, 0.2), rgba(p.dark ? p.umbra : p.rockLo, p.dark ? 0.35 : 0.3))
  fillD(g, stroke(neck.map(([a, b]) => [a - t * 0.014, b - t * 0.004] as Pt).slice(3), t * 0.012, 0.2, 0.4, 0.2), p.dark ? rgba(p.moon, 0.8) : rgba(p.card, 1))
  fillD(g, blob(hd[0], hd[1], t * 0.036, t * 0.027, 4, 0.08, 10), white)
  fillD(g, `M${Q(A(0.305, 0.805))}L${Q(A(0.41, 0.665))}L${Q(A(0.315, 0.77))}Z`, rgba(p.lantern, 0.9))
  fillD(g, stroke([A(0.27, 0.805), A(0.21, 0.83), A(0.15, 0.805)], t * 0.007, 0.1, 0.7, 0.1) + stroke([A(0.27, 0.8), A(0.2, 0.815), A(0.16, 0.785)], t * 0.005, 0.1, 0.7, 0.1), inkC)
  g.fillStyle = inkC
  g.beginPath()
  g.arc(A(0.3, 0.79)[0], A(0.3, 0.79)[1], Math.max(1, t * 0.006), 0, Math.PI * 2)
  g.fill()
  g.restore()
}

export function introspectScene(ctx: SceneCtx) {
  const low = ctx.quality === 'low'
  const still = low || ctx.reduced
  let p = readPal()
  const mk = (cls: string) => h('canvas', { class: `t26i-cv ${cls}`, 'aria-hidden': 'true' })
  const bg = mk('t26i-bg'), bird = mk('t26i-bird'), lift = mk('t26i-bird t26i-lift'), fx = mk('t26i-fx'), nearCv = mk('t26i-nearcv'), pebCv = mk('t26i-peb')
  // the levels: three words written under the brush (buttons: tap = drop at that strength; keys 1–3)
  const lvBtns = K.levels.map((t, i) => h('button', { class: `t26i-lv t26i-lv${i}`, type: 'button', 'aria-pressed': 'false', onClick: () => drop(i) }, h('span', { class: 't26i-drop', 'aria-hidden': 'true' }), h('span', { class: 't26i-lvl' }, t)))
  const tip = h('button', { class: 't26i-tip', type: 'button', 'aria-hidden': 'true', tabindex: '-1' })
  const levels = h('div', { class: 't26i-levels', role: 'group', 'aria-label': K.strengthAria }, ...lvBtns)
  const near = h('div', { class: 't26i-near' }, nearCv, pebCv, tip, levels)
  const egretBtn = h('button', { class: 't26i-egret', type: 'button', 'aria-label': K.askAria, 'aria-disabled': 'true', onClick: () => ask() })
  const concept = h('div', { class: 't26i-concept' }, h('p', { class: 't26i-seal' }, K.concept), h('p', { class: 't26i-cnote' }, K.conceptNote))
  const qline = h('p', { class: 't26i-q' }, K.question)
  const out = h('p', { class: 't26i-out' })
  const note = h('div', { class: 't26i-note' }, ctx.fact(F(K.illustration), 'p', 't26i-ill'))
  const said = h('div', { class: 't26i-said', hidden: true }, qline, out, note)
  const flash = h('p', { class: 't26i-flash', 'aria-hidden': 'true' }, K.concept)
  const root = h('div', { class: 't26i' }, h('p', { class: 'visually-hidden' }, K.art), bg, bird, lift, fx, near, concept, egretBtn, said, flash)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const stable = stableHeight(ctx, K.insights.flatMap((x) => [x as Fact]))

  // ── geometry (set in layout)
  let W = 0, H = 0, D = 1, land = true
  let hz = 0, ex = 0, fy = 0, et = 0, mx0 = 0, my0 = 0, tx = 0, ty = 0
  let target: Pt = [0, 0]
  let pebbles: Pt[] = []
  // the near bank (x1 = where it ends, its top edge from y0 at the frame's edge to y1), the inkstone on it, the arm's size
  let bank = { x1: 0, y0: 0, y1: 0 }, stone = { x: 0, y: 0, w: 0 }, arm = 100
  const blots: [number, number, number][] = []
  // ── state
  let hold: { u: number } | null = null
  let fall: { u: number; lv: number; from: Pt; auto: boolean } | null = null
  const rings: { x: number; y: number; u: number; k: number }[] = []
  let murk = 0, murkTo = 0
  let moon: Pt = [0, 0]
  let night: { u: number; k: number } | null = null
  const marks = Array.from({ length: NIGHTS }, () => 0) // 0 untouched, 1 nothing noticed, 2 noticed
  let lastLv = -1
  const asked = new Set<number>()
  let firstInsight = false, secondInsight = false
  let par = [0, 0]

  const size = (cv: HTMLCanvasElement) => {
    cv.width = Math.round(W * D)
    cv.height = Math.round(H * D)
    cv.style.width = `${W}px`
    cv.style.height = `${H}px`
    const g = cv.getContext('2d')!
    g.setTransform(D, 0, 0, D, 0, 0)
    return g
  }

  // ── bake: sky, ranges and their mirror in the water
  function* bakeBg() {
    const off = document.createElement('canvas')
    off.width = Math.round(W * D)
    off.height = Math.round(hz * D + 2)
    const o = off.getContext('2d')!
    o.setTransform(D, 0, 0, D, 0, 0)
    const sky = o.createLinearGradient(0, 0, 0, hz)
    sky.addColorStop(0, p.dark ? p.paper : p.paper2)
    sky.addColorStop(0.75, p.paper)
    sky.addColorStop(1, p.dark ? rgba(p.mist, 0.35) : p.mist)
    o.fillStyle = sky
    o.fillRect(0, 0, W, hz + 2)
    // three ranges in ink wash: dense on the ridge, thinning to mist at the foot; the far one softened by the air, dry
    // strokes hanging down the near slopes, a moonlit lip on the ridges, and a mist band lying in front of each
    const ranges: [number, number, number, number, number][] = [[hz * 0.5, 2611, 0.004, p.dark ? 0.55 : 0.2, 2.4], [hz * 0.36, 2612, 0.006, p.dark ? 0.75 : 0.32, 1.1], [hz * 0.2, 2613, 0.011, p.dark ? 0.95 : 0.48, 0]]
    const inkR = p.dark ? p.umbra : p.wash
    for (const [hh, seed, f, a, blur] of ranges) {
      const pts = ridge(W, hz, hh, seed, f)
      const body = new Path2D()
      body.moveTo(-10, hz + 2)
      pts.forEach(([x, y]) => body.lineTo(x, y))
      body.lineTo(W + 10, hz + 2)
      body.closePath()
      const gr = o.createLinearGradient(0, hz - hh, 0, hz)
      gr.addColorStop(0, rgba(inkR, a))
      gr.addColorStop(0.3, rgba(inkR, a * 0.82))
      gr.addColorStop(0.7, rgba(inkR, a * 0.4))
      gr.addColorStop(1, rgba(p.mist, p.dark ? 0.08 : 0.9))
      o.save()
      if (blur && !low) o.filter = `blur(${blur}px)`
      o.fillStyle = gr
      o.fill(body)
      o.restore()
      // dry strokes (cun) hanging from the ridge down the slopes, inside the range only
      o.save()
      o.clip(body)
      const rr = rng(seed + 40)
      for (let i = 0; i < W / (blur ? 14 : 7); i++) {
        const x = rr() * W, j = Math.max(0, Math.min(pts.length - 1, Math.round((x + 10) / 5)))
        const y0 = pts[j][1] + 1, len = hh * (0.12 + rr() * 0.45)
        fillD(o, stroke([[x, y0], [x + (rr() - 0.5) * 6, y0 + len * 0.5], [x + (rr() - 0.5) * 10, y0 + len]], 0.8 + rr() * (blur ? 1.2 : 2.2), 0.1, 0.8, 0.15), rgba(inkR, a * (0.25 + rr() * 0.3)))
      }
      o.restore()
      // the ridge's lip catching the moon
      o.strokeStyle = p.dark ? rgba(p.moon, 0.14 + a * 0.14) : rgba(p.card, 0.5)
      o.lineWidth = blur ? 0.8 : 1.1
      o.beginPath()
      pts.forEach(([x, y], i) => (i ? o.lineTo(x, y + 0.7) : o.moveTo(x, y + 0.7)))
      o.stroke()
      // a mist band lying across the foot of this range, soft-edged and uneven
      const mb = rng(seed + 80)
      for (let i = 0; i < 7; i++) {
        const cx = (i / 6) * W + (mb() - 0.5) * W * 0.12, cy = hz - hh * (0.12 + mb() * 0.22), rx = W * (0.14 + mb() * 0.12), ry = hh * (0.08 + mb() * 0.08)
        const m = o.createRadialGradient(cx, cy, 0, cx, cy, rx)
        m.addColorStop(0, rgba(p.mist, p.dark ? 0.16 : 0.7))
        m.addColorStop(1, rgba(p.mist, 0))
        o.save()
        o.translate(cx, cy)
        o.scale(1, ry / rx)
        o.translate(-cx, -cy)
        o.fillStyle = m
        o.fillRect(cx - rx, cy - rx, rx * 2, rx * 2)
        o.restore()
      }
      yield // one range per slice (the soft far ones blur)
    }
    yield
    const g = size(bg)
    g.drawImage(off, 0, 0, W, hz + 2)
    // the water: its own body, then the sky and ranges upside down, rippled more toward us
    const wg = g.createLinearGradient(0, hz, 0, H)
    wg.addColorStop(0, p.dark ? p.water : rgba(p.water, 0.55))
    wg.addColorStop(1, p.dark ? p.water : rgba(p.water, 0.95))
    g.fillStyle = p.dark ? p.water : p.paper
    g.fillRect(0, hz, W, H - hz)
    g.fillStyle = wg
    g.fillRect(0, hz, W, H - hz)
    yield
    // the mirror: one-pixel rows swaying smoothly, more as they come toward us, fading a little with depth
    const r = rng(2620)
    for (let y = 0; y < H - hz; y++) {
      if (y === Math.round((H - hz) / 2)) yield
      const sy = Math.max(0, hz - y * 1.04 - 1) // past the top of the sky the deep sky keeps mirroring
      const k = y / (H - hz)
      const dx = Math.sin(y * 0.11 + 1.7) * (0.3 + k * 3.2) + Math.sin(y * 0.037 + 0.4) * k * 2.4
      g.globalAlpha = (p.dark ? 0.78 : 0.52) * (1 - k * 0.35)
      g.drawImage(off, 0, sy * D, off.width, D, dx, hz + y, W, 1)
    }
    g.globalAlpha = 1
    yield
    // dry-brush ripples: pale on the dark water, ink on the pale, longer toward us
    for (let i = 0; i < 150; i++) {
      const y = hz + 3 + (H - hz) * r() ** 1.6
      const k = (y - hz) / (H - hz)
      const x = r() * W, len = 8 + k * (40 + r() * 90)
      fillD(g, stroke([[x, y], [x + len * 0.5, y - 0.6], [x + len, y]], 0.8 + k * 2.2, 0.3, 0.4, 0.2), rgba(r() < 0.5 ? (p.dark ? p.mist : p.card) : p.dark ? p.umbra : p.wash, p.dark ? 0.1 + k * 0.08 : 0.12 + k * 0.1))
    }
    // the water line at the horizon: a breath of mist
    const hl = g.createLinearGradient(0, hz - H * 0.025, 0, hz + H * 0.03)
    hl.addColorStop(0, rgba(p.mist, 0))
    hl.addColorStop(0.45, rgba(p.mist, p.dark ? 0.16 : 0.7))
    hl.addColorStop(1, rgba(p.mist, 0))
    g.fillStyle = hl
    g.fillRect(0, hz - H * 0.025, W, H * 0.055)
  }

  // ── the egret and its rippled reflection, baked twice: looking down, and head raised as if it noticed
  function drawBird(cv: HTMLCanvasElement, headDeg: number) {
    if (!W) return
    const bw = et * 0.95, bh = et * 1.02
    const off = document.createElement('canvas')
    off.width = Math.round(bw * D)
    off.height = Math.round(bh * D)
    const o = off.getContext('2d')!
    o.setTransform(D, 0, 0, D, 0, 0)
    const ox = bw * 0.45, oy = bh * 0.99 // the foot inside the offscreen box
    drawEgret(o, ox, oy, et, headDeg, p)
    const g = size(cv)
    const x0 = ex - ox, y0 = fy - oy
    // reflection first: one-pixel rows mirrored about the foot, a slow smooth ripple that widens with depth, fading out
    for (let y = 0; y < bh; y++) {
      const k = y / bh
      const dx = Math.sin(y * 0.085 + 1.3) * (0.3 + k * 3.4) + Math.sin(y * 0.23) * k * 1.1
      g.globalAlpha = (p.dark ? 0.46 : 0.42) * (1 - k) ** 1.6
      if (g.globalAlpha < 0.01) break
      g.drawImage(off, 0, (oy - y - 1) * D, off.width, D, x0 + dx, fy + y, bw, 1)
    }
    g.globalAlpha = 1
    // the wade: where the leg meets its reflection
    fillD(g, stroke([[ex - et * 0.07, fy + 1], [ex + et * 0.08, fy + 1.5]], 1.6, 0.3, 0.3, 0.2), rgba(p.dark ? p.mist : p.ink, 0.35))
    g.drawImage(off, x0, y0, bw, bh)
  }
  const raise = (up: boolean) => root.classList.toggle('noticed', up)

  // sprites drawn once per layout, so the frame loop only blits (no gradients or paths made per frame)
  const sprite = (w: number, hh: number, draw: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas')
    c.width = Math.ceil(w * D)
    c.height = Math.ceil(hh * D)
    const g = c.getContext('2d')!
    g.setTransform(D, 0, 0, D, 0, 0)
    draw(g)
    return c
  }
  let moonSp: HTMLCanvasElement | null = null, roadSp: HTMLCanvasElement | null = null, murkSp: HTMLCanvasElement | null = null, glowSp: HTMLCanvasElement | null = null
  const dropSp: HTMLCanvasElement[] = []
  const DR = [4.5, 7.5, 11.5]
  let mr = 12
  function sprites() {
    mr = Math.max(12, Math.min(W, H) * 0.028)
    moonSp = sprite(mr * 10, mr * 10, (g) => {
      const c = mr * 5
      const halo = g.createRadialGradient(c, c, mr * 0.6, c, c, mr * 5)
      halo.addColorStop(0, rgba(p.moon, p.dark ? 0.35 : 0.5))
      halo.addColorStop(1, rgba(p.moon, 0))
      g.fillStyle = halo
      g.fillRect(0, 0, mr * 10, mr * 10)
      g.fillStyle = p.dark ? p.moon : mix(p.moon, p.card, 0.55)
      g.beginPath()
      g.arc(c, c, mr, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = rgba(p.dark ? p.moon : p.ink, 0.25)
      g.lineWidth = 1
      g.stroke()
    })
    // the moon's mirror and its broken road toward us, from the waterline down
    roadSp = sprite(mr * 6, H, (g) => {
      const c = mr * 3
      g.fillStyle = p.dark ? rgba(p.moon, 0.75) : mix(p.moon, p.card, 0.55, 0.85)
      g.beginPath()
      g.ellipse(c, mr * 1.2, mr * 1.05, mr * 0.9, 0, 0, Math.PI * 2)
      g.fill()
      const rr = rng(2640)
      for (let y = mr * 2.4; y < H - hz; y += 3 + rr() * 4) {
        const k = y / (H - hz)
        const w = Math.min(mr * 5.6, (6 + k * 40) * (0.5 + rr()))
        g.fillStyle = rgba(p.dark ? p.moon : p.card, (p.dark ? 0.55 : 0.6) * (1 - k * 0.6) * (rr() < 0.75 ? 1 : 0.3))
        g.fillRect(c - w / 2 + (rr() - 0.5) * Math.min(mr * 2, 6 + k * 26), y, w, 1 + k * 1.6)
      }
    })
    murkSp = sprite(W, H - hz, (g) => {
      g.fillStyle = mix(p.moss, p.dark ? p.umbra : p.rockLo, 0.5, p.dark ? 0.8 : 0.64)
      g.fillRect(0, 1, W, H - hz)
      for (const [x, y0, rad] of blots) {
        const y = y0 - hz
        const gr = g.createRadialGradient(x, y, 0, x, y, rad)
        gr.addColorStop(0, mix(p.moss, p.umbra, 0.6, 0.5))
        gr.addColorStop(1, mix(p.moss, p.umbra, 0.6, 0))
        g.save()
        g.translate(x, y)
        g.scale(1, 0.22)
        g.translate(-x, -y)
        g.fillStyle = gr
        g.beginPath()
        g.arc(x, y, rad, 0, Math.PI * 2)
        g.fill()
        g.restore()
      }
    })
    dropSp.length = 0
    for (const rad of DR) dropSp.push(sprite(rad * 6, rad * 6, (g) => {
      const c = rad * 3
      const gr = g.createRadialGradient(c - rad * 0.3, c - rad * 0.3, 0, c, c, rad * 3)
      gr.addColorStop(0, p.lantern)
      gr.addColorStop(0.3, rgba(p.vermilion, 0.9))
      gr.addColorStop(0.36, rgba(p.vermilion, 0.35))
      gr.addColorStop(1, rgba(p.vermilion, 0))
      g.fillStyle = gr
      g.fillRect(0, 0, rad * 6, rad * 6)
    }))
    const pr = Math.max(6, Math.min(W, H) * 0.012)
    glowSp = sprite(pr * 8, pr * 8, (g) => {
      const gl = g.createRadialGradient(pr * 4, pr * 4, 0, pr * 4, pr * 4, pr * 4)
      gl.addColorStop(0, rgba(p.lantern, 0.75))
      gl.addColorStop(1, rgba(p.lantern, 0))
      g.fillStyle = gl
      g.fillRect(0, 0, pr * 8, pr * 8)
    })
  }

  // ── near: reeds, lotus leaves, the bank with its inkstone, the sleeve, hand and brush (baked)
  function drawNear() {
    const g = size(nearCv)
    const inkC = p.dark ? p.umbra : p.wash
    const r = rng(2630)
    // reeds at both edges
    for (const [x0, n, hh] of [[W * 0.97, 9, (H - hz) * 0.95 + H * 0.16], [W * 0.015, 4, (H - hz) * 0.6]] as [number, number, number][]) {
      for (let i = 0; i < n; i++) {
        const bx = x0 + (r() - 0.5) * W * 0.05, top = H - hh * (0.6 + r() * 0.4), lean = (r() - 0.5) * W * 0.05
        fillD(g, stroke([[bx, H + 4], [bx + lean * 0.3, (H + top) / 2], [bx + lean, top]], 2 + r() * 2.2, 0.05, 0.85, 0.15), rgba(inkC, p.dark ? 0.9 : 0.72))
        if (r() < 0.4) fillD(g, blob(bx + lean, top - 8, 2.4, 9, i, 0.1, 10), rgba(inkC, 0.8))
      }
    }
    // lotus pads lying on the water, nearly edge-on: a dark underside where the rim curls up, a top that pales toward the
    // centre, veins running out from the stem's notch, the far lip turned up into the moonlight
    const moss = p.dark ? mix(p.moss, p.umbra, 0.35) : mix(p.moss, p.wash, 0.25)
    const lip = p.dark ? rgba(p.moon, 0.42) : rgba(p.card, 0.85)
    const pad = (cx: number, cy: number, rx: number, seed: number) => {
      const ry = rx * 0.19
      fillD(g, blob(cx, cy + ry * 0.3, rx, ry * 0.95, seed, 0.06, 20), rgba(inkC, p.dark ? 0.95 : 0.78))
      const top = g.createRadialGradient(cx - rx * 0.1, cy - ry * 0.1, 0, cx, cy, rx)
      top.addColorStop(0, mix(moss, p.dark ? p.rockMid : p.card, 0.3))
      top.addColorStop(1, moss)
      g.save()
      g.translate(cx, cy)
      g.scale(1, 0.94)
      g.translate(-cx, -cy)
      fillD(g, blob(cx, cy, rx * 0.97, ry * 0.86, seed, 0.06, 20), top)
      g.restore()
      let veins = ''
      for (let k = 0; k < 15; k++) {
        const a = (k / 15) * Math.PI * 2 + 0.2
        if (Math.abs(a - Math.PI * 0.5) < 0.18) continue // the notch toward us
        veins += stroke([[cx - rx * 0.06, cy], [cx + Math.cos(a) * rx * 0.5, cy + Math.sin(a) * ry * 0.42], [cx + Math.cos(a) * rx * 0.9, cy + Math.sin(a) * ry * 0.78]], Math.max(0.7, rx * 0.008), 0.05, 0.4, 0.2)
      }
      fillD(g, veins, p.dark ? rgba(p.moon, 0.16) : rgba(p.card, 0.45))
      fillD(g, `M${cx} ${cy}L${cx - rx * 0.06} ${cy + ry * 0.9}L${cx + rx * 0.06} ${cy + ry * 0.9}Z`, rgba(inkC, 0.7))
      const far = Array.from({ length: 17 }, (_, i) => { const a = Math.PI * (1.05 + i * 0.056); return [cx + Math.cos(a) * rx * 0.97, cy + Math.sin(a) * ry * 0.9 - ry * 0.18 * Math.sin((i / 16) * Math.PI)] as Pt })
      fillD(g, stroke(far, Math.max(1.2, rx * 0.018), 0.2, 0.2, 0.2), lip)
    }
    pad(W * 0.86, H * 0.93, W * 0.13, 2631)
    pad(W * 0.64, H * 0.985, W * 0.09, 2632)
    pad(W * 0.94, H * 0.83, W * 0.06, 2633)
    // one leaf standing out of the water like a cup: its dark outside, the pale inside with veins, a wavy lip
    const lx = W * 0.79, ly = H * 0.78, lr = Math.min(W * 0.06, 60)
    fillD(g, stroke([[lx + 2, H + 4], [lx + 6, (H + ly) / 2], [lx, ly + lr * 0.3]], 2.6, 0.05, 0.05, 0.6), rgba(inkC, 0.85))
    fillD(g, `M${lx - lr} ${ly}Q${lx} ${ly + lr * 0.8} ${lx + lr} ${ly - lr * 0.12}Q${lx + lr * 0.2} ${ly + lr * 0.12} ${lx - lr} ${ly}Z`, rgba(inkC, p.dark ? 0.95 : 0.78))
    const inside = g.createLinearGradient(lx, ly - lr * 0.3, lx, ly + lr * 0.2)
    inside.addColorStop(0, mix(moss, p.dark ? p.rockMid : p.card, 0.35))
    inside.addColorStop(1, moss)
    const wav = Array.from({ length: 13 }, (_, i) => { const t = i / 12; return [lx - lr + t * lr * 2, ly - lr * 0.12 * t - Math.sin(t * Math.PI) * lr * 0.2 + Math.sin(t * 19) * lr * 0.03] as Pt })
    fillD(g, `M${wav.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Q${lx + lr * 0.2} ${ly + lr * 0.12} ${lx - lr} ${ly}Z`, inside)
    let cv = ''
    for (let k = 1; k < 6; k++) cv += stroke([[lx, ly + lr * 0.05], wav[k * 2]], 0.8, 0.1, 0.3, 0.2)
    fillD(g, cv, p.dark ? rgba(p.moon, 0.2) : rgba(p.card, 0.5))
    fillD(g, stroke(wav, 1.5, 0.2, 0.2, 0.2), lip)

    // the near bank in the corner: a dark wash with a moonlit lip, dry strokes, moss and a few blades; the inkstone on it
    const { x1, y0, y1 } = bank
    const top = (x: number) => y0 + (y1 - y0) * Math.max(0, x / x1) ** 1.6 + Math.sin(x * 0.05) * 2
    const edge: Pt[] = []
    for (let x = -20; x <= x1 + 1; x += 8) edge.push([x, top(x)])
    const bk = new Path2D(`M-20 ${H + 10}L${edge.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Q${x1 + 30} ${H * 0.98} ${x1 + 50} ${H + 10}Z`)
    const bgr = g.createLinearGradient(0, y0, 0, H)
    bgr.addColorStop(0, rgba(inkC, p.dark ? 0.92 : 0.62))
    bgr.addColorStop(1, rgba(inkC, p.dark ? 0.98 : 0.8))
    g.fillStyle = bgr
    g.fill(bk)
    g.save()
    g.clip(bk)
    for (let i = 0; i < 26; i++) {
      const x = r() * x1, y = top(x) + 6 + r() * (H - y0) * 0.6, len = 12 + r() * 40
      fillD(g, stroke([[x, y], [x + len * 0.5, y - 1], [x + len, y + 0.5]], 1 + r() * 2, 0.2, 0.6, 0.15), rgba(p.dark ? p.mist : p.card, p.dark ? 0.05 : 0.1))
    }
    g.restore()
    fillD(g, stroke(edge, 1.6, 0.05, 0.3, 0.3), p.dark ? rgba(p.moon, 0.32) : rgba(p.card, 0.8))
    for (let i = 0; i < 9; i++) {
      const x = r() * x1 * 0.95, y = top(x) + 1
      if (r() < 0.5) fillD(g, blob(x, y + 2, 5 + r() * 7, 2 + r() * 2, 2700 + i, 0.3, 10), rgba(p.moss, p.dark ? 0.6 : 0.5))
      else for (let j = 0; j < 4; j++) fillD(g, stroke([[x + j * 2, y + 2], [x + j * 3 + (r() - 0.5) * 8, y - 8 - r() * 12]], 1.4, 0.05, 0.9, 0.1), rgba(inkC, p.dark ? 0.95 : 0.75))
    }
    // the inkstone: a slab of slate on the bank, its well of ink at one end (the drops lie on its flat, as buttons)
    const { x: sx, y: sy, w: sw } = stone
    const sd = sw * 0.3, th = sw * 0.08
    fillD(g, blob(sx + sw * 0.06, sy + sd * 0.55 + th, sw * 0.56, sd * 0.32, 2710, 0.05, 16), rgba(p.dark ? '#000' : p.wash, p.dark ? 0.5 : 0.28))
    const slab = (y: number, k: number) => `M${sx - sw / 2 + k} ${y - sd / 2}Q${sx - sw / 2} ${y - sd / 2} ${sx - sw / 2} ${y - sd / 2 + k}L${sx - sw / 2} ${y + sd / 2 - k}Q${sx - sw / 2} ${y + sd / 2} ${sx - sw / 2 + k} ${y + sd / 2}L${sx + sw / 2 - k} ${y + sd / 2}Q${sx + sw / 2} ${y + sd / 2} ${sx + sw / 2} ${y + sd / 2 - k}L${sx + sw / 2} ${y - sd / 2 + k}Q${sx + sw / 2} ${y - sd / 2} ${sx + sw / 2 - k} ${y - sd / 2}Z`
    fillD(g, slab(sy + th, sd * 0.3), p.dark ? '#05070d' : mix(p.wash, p.rockLo, 0.2))
    const face = g.createLinearGradient(0, sy - sd / 2, 0, sy + sd / 2)
    face.addColorStop(0, p.dark ? mix(p.rockLo, p.umbra, 0.2) : mix(p.wash, p.rockLo, 0.55))
    face.addColorStop(1, p.dark ? mix(p.rockLo, p.umbra, 0.55) : mix(p.wash, p.rockLo, 0.35))
    fillD(g, slab(sy, sd * 0.3), face)
    fillD(g, blob(sx - sw * 0.33, sy, sw * 0.12, sd * 0.3, 2711, 0.05, 14), p.dark ? '#000' : p.wash)
    fillD(g, stroke([[sx - sw * 0.39, sy - sd * 0.08], [sx - sw * 0.3, sy - sd * 0.12]], 1.4, 0.3, 0.3, 0.1), p.dark ? rgba(p.moon, 0.45) : rgba(p.card, 0.7))
    fillD(g, stroke([[sx - sw / 2 + sd * 0.3, sy - sd / 2 + 0.6], [sx + sw / 2 - sd * 0.3, sy - sd / 2 + 0.6]], 1.4, 0.1, 0.1, 0.4), p.dark ? rgba(p.moon, 0.35) : rgba(p.card, 0.55))

    // the brush first (the hand closes over it): a bamboo handle with nodes, a dark ferrule, the hair tapering to a wet
    // point at (tx, ty)
    const u = arm
    const Q2 = (q: Pt) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`
    const top0: Pt = [tx - u * 0.13, ty - u * 0.66]
    const bL = Math.hypot(tx - top0[0], ty - top0[1]), bx = (tx - top0[0]) / bL, by = (ty - top0[1]) / bL
    const at2 = (k: number): Pt => [top0[0] + bx * bL * k, top0[1] + by * bL * k]
    const bamboo = p.dark ? mix(p.lantern, p.rockLo, 0.62) : mix(p.lantern, p.rockMid, 0.5)
    fillD(g, stroke([at2(0), at2(0.8)], u * 0.04, 0.02, 0.02, 0.9), bamboo)
    fillD(g, stroke([[at2(0)[0] - by * u * 0.008, at2(0)[1] + bx * u * 0.008], [at2(0.8)[0] - by * u * 0.008, at2(0.8)[1] + bx * u * 0.008]], u * 0.008, 0.05, 0.05, 0.8), p.dark ? rgba(p.moon, 0.35) : rgba(p.card, 0.7))
    for (const k of [0.05, 0.42]) fillD(g, stroke([at2(k), at2(k + 0.012)], u * 0.042, 0.1, 0.1, 0.9), mix(bamboo, p.dark ? '#000' : p.wash, 0.45))
    fillD(g, stroke([at2(0.78), at2(0.82)], u * 0.048, 0.1, 0.1, 0.9), p.dark ? '#000' : p.ink)
    fillD(g, stroke([at2(0.81), at2(0.92), [tx, ty]], u * 0.056, 0.05, 0.92, 0.04), p.dark ? '#000' : p.ink)
    fillD(g, stroke([[at2(0.85)[0] - by * u * 0.012, at2(0.85)[1]], [at2(0.95)[0] - by * u * 0.006, at2(0.95)[1]]], u * 0.006, 0.2, 0.6, 0.2), p.dark ? rgba(p.moon, 0.4) : rgba(p.card, 0.5))

    // the sleeve: a kimono sleeve coming in from the left edge, the forearm's line along its top, the loose cloth hanging
    // below it as a bag with a rounded corner under the wrist, folds pulled down by its weight; all in ink washes
    const G = at2(0.4) // where the fingers close on the handle
    const hs = u * 1.45 // the hand's own scale: a hand is most of a brush long
    const W0: Pt = [G[0] - hs * 0.2, G[1] - hs * 0.04] // the wrist, at the cuff
    const su = u * 0.82 // the sleeve's
    const L = (dx: number, dy: number): Pt => [W0[0] + dx * su, W0[1] + dy * su]
    const sleevePath = `M${Q2(L(-1.5, -0.42))}C${Q2(L(-1.0, -0.36))} ${Q2(L(-0.45, -0.22))} ${Q2(L(0, -0.12))}` +
      `Q${Q2(L(0.05, -0.01))} ${Q2(L(0.02, 0.1))}C${Q2(L(0.03, 0.32))} ${Q2(L(-0.02, 0.5))} ${Q2(L(-0.16, 0.54))}` +
      `C${Q2(L(-0.5, 0.6))} ${Q2(L(-1.0, 0.46))} ${Q2(L(-1.5, 0.4))}Z`
    const clothHi = p.dark ? mix(p.rockMid, p.umbra, 0.3) : mix(p.rockMid, p.wash, 0.4)
    const clothLo = p.dark ? mix(p.rockLo, p.umbra, 0.65) : mix(p.wash, p.rockLo, 0.18)
    const cg = g.createLinearGradient(W0[0], W0[1] - su * 0.35, W0[0] - su * 0.2, W0[1] + su * 0.55)
    cg.addColorStop(0, clothHi)
    cg.addColorStop(0.5, mix(clothHi, clothLo, 0.55))
    cg.addColorStop(1, clothLo)
    const sp = new Path2D(sleevePath)
    g.fillStyle = cg
    g.fill(sp)
    g.save()
    g.clip(sp)
    // folds: soft valleys falling from under the forearm into the bag, a pale ridge beside each
    const folds: [number, number, number, number][] = [[-1.32, -0.37, -1.2, 0.44], [-1.05, -0.33, -0.9, 0.5], [-0.7, -0.26, -0.58, 0.55], [-0.5, -0.21, -0.3, 0.56], [-0.26, -0.16, -0.14, 0.48]]
    for (const [ax, ay, bx2, by2] of folds) {
      const f0 = L(ax, ay + 0.06), f1 = L(bx2, by2), fm = L((ax + bx2) / 2 + 0.1, (ay + by2) / 2)
      fillD(g, stroke(curve(f0, fm, f1, 14), su * (0.07 + r() * 0.035), 0.4, 0.3, 0.15), rgba(p.dark ? '#000' : p.wash, p.dark ? 0.32 : 0.22))
      // a pale ridge on some folds only, broken like a dry brush
      if (r() < 0.6) fillD(g, stroke(curve([f0[0] + su * 0.07, f0[1] + su * 0.1], [fm[0] + su * 0.06, fm[1]], [f1[0] + su * 0.05, f1[1] - su * 0.12], 14), su * (0.01 + r() * 0.01), 0.4, 0.5, 0.05), p.dark ? rgba(p.moon, 0.1) : rgba(p.card, 0.22))
    }
    // the weight of the hem: darker low in the bag, a fold across it
    const hg = g.createLinearGradient(0, W0[1] + su * 0.2, 0, W0[1] + su * 0.6)
    hg.addColorStop(0, rgba(p.dark ? '#000' : p.wash, 0))
    hg.addColorStop(1, rgba(p.dark ? '#000' : p.wash, p.dark ? 0.35 : 0.22))
    g.fillStyle = hg
    g.fillRect(W0[0] - su * 1.6, W0[1], su * 1.8, su * 0.7)
    fillD(g, stroke(curve(L(-1.2, 0.36), L(-0.6, 0.48), L(-0.12, 0.44), 14), su * 0.02, 0.3, 0.3, 0.1), rgba(p.dark ? '#000' : p.wash, 0.25))
    g.restore()
    // the forearm's line along the top in moonlight, the sleeve's edges in a fine ink line
    fillD(g, stroke(curve(L(-1.5, -0.41), L(-0.7, -0.29), L(0, -0.115), 18), su * 0.02, 0.05, 0.3, 0.2), p.dark ? rgba(p.moon, 0.5) : rgba(p.card, 0.9))
    fillD(g, stroke([...curve(L(0.02, 0.1), L(0.03, 0.4), L(-0.16, 0.54), 10), ...curve(L(-0.16, 0.54), L(-0.8, 0.56), L(-1.5, 0.4), 14).slice(1)], su * 0.012, 0.1, 0.5, 0.2), rgba(p.dark ? '#000' : p.ink, p.dark ? 0.7 : 0.5))
    // the cuff's mouth: the dark inside, a pale lining round it
    fillD(g, blob(W0[0] - su * 0.005, W0[1] - su * 0.01, su * 0.035, su * 0.1, 2720, 0.05, 12), rgba(p.dark ? '#000' : p.wash, 0.9))
    fillD(g, stroke(curve(L(0, -0.12), L(0.05, -0.01), L(0.02, 0.1), 10), su * 0.022, 0.1, 0.1, 0.4), p.dark ? mix(p.rockMid, p.moon, 0.35) : p.card)

    // the hand: out of the cuff, the back of the hand toward us, four fingers curled over the handle, the thumb along it;
    // a fine ink contour, a little shade between the knuckles
    const skin = p.dark ? mix(p.rockHi, p.moon, 0.35) : mix(p.card, p.lantern, 0.24)
    const skinLo = p.dark ? mix(p.rockMid, p.umbra, 0.05) : mix(p.card, p.rockLo, 0.45)
    const line = rgba(p.dark ? '#000' : p.ink, p.dark ? 0.7 : 0.55)
    const H2 = (dx: number, dy: number): Pt => [G[0] + dx * hs, G[1] + dy * hs]
    const back = `M${Q2(H2(-0.2, -0.11))}C${Q2(H2(-0.13, -0.15))} ${Q2(H2(-0.05, -0.12))} ${Q2(H2(-0.012, -0.075))}L${Q2(H2(-0.02, 0.06))}C${Q2(H2(-0.07, 0.085))} ${Q2(H2(-0.15, 0.07))} ${Q2(H2(-0.2, 0.06))}Z`
    const hgr = g.createLinearGradient(G[0] - hs * 0.2, G[1] - hs * 0.12, G[0] - hs * 0.02, G[1] + hs * 0.08)
    hgr.addColorStop(0, skin)
    hgr.addColorStop(1, skinLo)
    fillD(g, back, hgr)
    // fingers: index on top, then middle, ring, little — each a rounded segment across the front of the handle
    const fingers: [number, number, number][] = [[-0.06, 0.036, 0.034], [-0.025, 0.04, 0.032], [0.01, 0.036, 0.029], [0.042, 0.03, 0.024]]
    for (const [dy, len, fw] of fingers) {
      const a0 = H2(-0.07, dy - 0.005), a1 = H2(-0.005, dy + 0.004), a2 = H2(len - 0.012, dy - 0.004)
      fillD(g, stroke([a0, a1, a2], hs * fw, 0.25, 0.5, 0.6), dy > 0 ? skinLo : skin)
      fillD(g, stroke([[a0[0] + hs * 0.01, a0[1] + hs * fw * 0.5], [a1[0], a1[1] + hs * fw * 0.5], [a2[0] - hs * 0.004, a2[1] + hs * fw * 0.4]], Math.max(0.8, hs * 0.005), 0.2, 0.5, 0.3), line)
    }
    // the thumb, lying along the near side of the handle, its tip pointing down the brush
    fillD(g, stroke([H2(-0.15, -0.09), H2(-0.05, -0.06), H2(-0.025, 0.0)], hs * 0.036, 0.35, 0.6, 0.5), skin)
    fillD(g, stroke([H2(-0.12, -0.065), H2(-0.05, -0.04), H2(-0.03, 0.005)], Math.max(0.8, hs * 0.005), 0.2, 0.4, 0.3), line)
    // the back of the hand's edge in moonlight, the wrist's crease, a fine contour under the hand
    fillD(g, stroke(curve(H2(-0.2, -0.112), H2(-0.12, -0.152), H2(-0.02, -0.085), 10), Math.max(1, hs * 0.008), 0.2, 0.3, 0.2), p.dark ? rgba(p.moon, 0.6) : rgba(p.card, 0.95))
    fillD(g, stroke(curve(H2(-0.2, 0.062), H2(-0.12, 0.08), H2(-0.04, 0.07), 10), Math.max(0.8, hs * 0.006), 0.2, 0.4, 0.2), line)
  }

  // ── fx: moon and its road, the drop, rings, murk, pebbles
  const fxg = () => fx.getContext('2d')!
  function drawFx() {
    if (!W || !moonSp || !roadSp || !murkSp || !glowSp) return
    const g = fxg()
    g.setTransform(D, 0, 0, D, 0, 0)
    g.clearRect(0, 0, W, H)
    const [mx, my] = moon
    g.drawImage(moonSp, mx - mr * 5, my - mr * 5, mr * 10, mr * 10)
    // its mirror and the broken road toward us (gone when the pond clouds)
    const ry = hz + (hz - my)
    if (ry < H && murk < 0.98) {
      g.globalAlpha = 1 - murk
      g.drawImage(roadSp, 0, 0, roadSp.width, Math.max(1, (H - ry + mr * 1.2) * D), mx - mr * 3, ry - mr * 1.2, mr * 6, H - ry + mr * 1.2)
      g.globalAlpha = 1
    }
    // rings spreading on the water, flattened by the low eye
    g.lineWidth = 1.2
    for (let j = 0; j < rings.length; j++) {
      const q = rings[j]
      const a = (1 - q.u) * q.k
      if (a <= 0) continue
      g.strokeStyle = p.dark ? p.moon : p.ink
      g.globalAlpha = a * (p.dark ? 0.55 : 0.4)
      for (let i = 0; i < 3; i++) {
        const rr = (q.u * 70 + i * 16) * (0.6 + q.k * 0.5)
        if (rr <= 0) continue
        g.beginPath()
        g.ellipse(q.x, q.y, rr, rr * 0.16, 0, 0, Math.PI * 2)
        g.stroke()
      }
    }
    g.globalAlpha = 1
    // murk: the pond clouds, the reflection is lost
    if (murk > 0.01) {
      g.globalAlpha = murk
      g.drawImage(murkSp, 0, hz, W, H - hz)
      g.globalAlpha = 1
    }
    // the drop: swelling at the tip, or arcing down into the reflection
    if (hold || fall) {
      let x = tx + par[0], y = ty + 6 + par[1], lv = 0, k = 1, a = 1
      if (hold) {
        lv = Math.min(2, Math.floor(hold.u / 0.55))
        k = Math.min(1, 0.5 + (hold.u % 0.55) * 2)
      }
      if (fall) {
        const u = fall.u
        x = fall.from[0] + (target[0] - fall.from[0]) * u
        y = fall.from[1] + (target[1] - fall.from[1]) * u - Math.sin(u * Math.PI) * H * 0.07
        lv = fall.lv
        k = 1 - u * 0.25
        if (fall.lv === 0) a = clamp(1 - (u - 0.35) / 0.35, 0, 1) // too faint: it dissolves on the way
      }
      const rad = DR[lv] * k * 3
      if (a > 0) {
        g.globalAlpha = a
        g.drawImage(dropSp[lv], x - rad, y - rad, rad * 2, rad * 2)
        g.globalAlpha = 1
      }
    }
    // five pebbles on the bank keep the score of the five nights: grey river stones, a moonlit top, a shadow; the one
    // night the egret noticed glows like a coal
    const pr = Math.max(6, Math.min(W, H) * 0.012)
    const q = pebCv.getContext('2d')!
    q.setTransform(D, 0, 0, D, 0, 0)
    q.clearRect(0, 0, W, H)
    pebbleOn(q, pr)
  }
  /** the five pebbles on the bank (their own canvas, over the bank and moving with it) */
  function pebbleOn(g: CanvasRenderingContext2D, pr: number) {
    if (!glowSp) return
    for (let i = 0; i < pebbles.length; i++) {
      const [x, y] = pebbles[i]
      const m = marks[i]
      if (m === 2) g.drawImage(glowSp, x - pr * 4, y - pr * 4, pr * 8, pr * 8)
      g.fillStyle = rgba(p.dark ? '#000' : p.wash, 0.45)
      g.beginPath()
      g.ellipse(x + pr * 0.25, y + pr * 0.5, pr * 1.1, pr * 0.35, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = m === 2 ? p.lantern : m === 1 ? (p.dark ? mix(p.rockLo, p.umbra, 0.3) : p.rockLo) : p.dark ? p.rockMid : p.rockMid
      g.beginPath()
      g.ellipse(x, y, pr, pr * 0.66, (i - 2) * 0.12, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = p.dark ? p.moon : p.card
      g.globalAlpha = m === 1 ? 0.12 : m === 2 ? 0.6 : 0.42
      g.beginPath()
      g.ellipse(x - pr * 0.2, y - pr * 0.28, pr * 0.55, pr * 0.2, -0.2, 0, Math.PI * 2)
      g.fill()
      g.globalAlpha = 1
    }
  }

  // ── layout: once per size (and theme); the first draw soaks in, later ones in one go
  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    const Wn = root.clientWidth, Hraw = root.clientHeight
    if (!Wn || !Hraw) return
    W = Wn
    H = Hraw
    const Hs = stable(Hraw)
    D = Math.min(devicePixelRatio || 1, low ? 1 : 1.5)
    land = W / Hs > 1.05
    hz = Hs * (land ? 0.42 : 0.34)
    et = Math.min(land ? Hs * 0.44 : Hs * 0.3, W * (land ? 0.3 : 0.56))
    ex = W * (land ? 0.68 : 0.72)
    fy = hz + (Hs - hz) * (land ? 0.17 : 0.1)
    mx0 = W * (land ? 0.3 : 0.22)
    my0 = hz * (land ? 0.42 : 0.6)
    if (!night) moon = [mx0, my0]
    tx = W * (land ? 0.25 : 0.33)
    ty = hz + (Hs - hz) * (land ? 0.04 : 0.06)
    target = [ex - et * 0.02, fy + et * 0.36]
    // the arm, hand and brush come to about a sixth of the frame
    arm = clamp(land ? Math.min(W * 0.15, Hs * 0.34) : W * 0.34, 80, 220)
    bank = land ? { x1: W * 0.46, y0: Hs * 0.8, y1: Hs * 0.95 } : { x1: W * 0.76, y0: Hs * 0.86, y1: Hs * 0.97 }
    stone = land ? { x: W * 0.14, y: Hs * 0.875, w: clamp(W * 0.12, 120, 190) } : { x: W * 0.25, y: Hs * 0.92, w: clamp(W * 0.36, 112, 150) }
    // five pebbles on the bank beside the inkstone keep the score of the five nights
    const pr = Math.max(6, Math.min(W, H) * 0.012)
    const p0 = stone.x + stone.w * 0.62 + pr * 2, p1 = bank.x1 * (land ? 0.9 : 0.94)
    pebbles = Array.from({ length: NIGHTS }, (_, i) => {
      const x = p0 + ((p1 - p0) * i) / (NIGHTS - 1)
      return [x, bank.y0 + (bank.y1 - bank.y0) * Math.max(0, x / bank.x1) ** 1.6 + pr * (1.6 + (i % 2) * 0.5)] as Pt
    })
    blots.length = 0
    const r = rng(2650)
    for (let i = 0; i < 14; i++) blots.push([r() * W, hz + (H - hz) * r(), 40 + r() * W * 0.12])
    // words and controls
    const cw = Math.min(W - 32, 420)
    Object.assign(concept.style, { left: `${(land ? W * 0.5 : W / 2) - cw / 2}px`, top: `${land ? Hs * 0.05 : 6}px`, width: `${cw}px` })
    Object.assign(egretBtn.style, { left: `${ex - et * 0.32}px`, top: `${fy - et * 0.86}px`, width: `${et * 0.62}px`, height: `${et * 0.88}px` })
    Object.assign(tip.style, { left: `${tx - 26}px`, top: `${ty - 30}px` })
    // the three strengths are three drops lying on the inkstone's flat
    Object.assign(levels.style, { left: `${stone.x - stone.w * 0.16}px`, top: `${stone.y - stone.w * 0.15 - 14}px`, width: `${stone.w * 0.64}px` })
    // the words said lie on open water: left of the egret on a wide screen; on a tall one below where its reflection fades
    const sw = land ? Math.min(ex - et * 0.36 - W * 0.37, 380) : W - 32
    Object.assign(said.style, { left: `${land ? W * 0.37 : 16}px`, top: `${land ? fy + 10 : fy + et * 0.6}px`, width: `${sw}px` })
    Object.assign(flash.style, { left: `${ex - 160}px`, top: `${fy + et * 0.3}px`, width: '320px' })
    for (const cv of [fx, pebCv]) size(cv)
    job?.cancel()
    const steps = (function* () {
      yield* bakeBg()
      drawBird(bird, 0)
      yield
      drawBird(lift, -28)
      sprites()
      yield
      drawNear()
      drawFx()
    })()
    job = sliced(steps, { sync: ctx.reduced || !first })
    first = false
  }
  ctx.onCleanup(onSize(root, layout))
  ctx.onCleanup(() => job?.cancel())
  ctx.onCleanup(onPrefs(() => {
    const q = readPal()
    if (JSON.stringify(q) === JSON.stringify(p)) return
    p = q
    layout()
  }))

  // ── motion: one loop, only while something moves
  const busy = () => !!(hold || fall || night || rings.length || Math.abs(murk - murkTo) > 0.005)
  const loop = createLoop(root, (_t, dt) => {
    if (hold) {
      hold.u = Math.min(1.65, hold.u + dt)
      showLv(Math.min(2, Math.floor(hold.u / 0.55)))
    }
    if (fall) {
      fall.u = Math.min(1, fall.u + dt / 0.75)
      if (fall.u >= 1) land1()
    }
    for (const q of rings) q.u = Math.min(1, q.u + dt / 1.7)
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].u >= 1) rings.splice(i, 1)
    murk += (murkTo - murk) * (1 - Math.exp(-dt * 1.6))
    if (night) stepNight(dt)
    drawFx()
    return busy()
  })
  ctx.onCleanup(() => loop.dispose())
  const go = () => (still ? settle() : loop.start())
  /** reduced motion / low: jump every animation to its end and draw once */
  function settle() {
    if (fall) (fall.u = 1), land1()
    rings.length = 0
    murk = murkTo
    if (night) while (night) stepNight(1)
    drawFx()
  }

  // ── the brush: press and hold to load it, let go to drop
  let holdId = -1, held = 0
  tip.addEventListener('pointerdown', (e) => {
    if (fall || night) return
    e.preventDefault()
    holdId = e.pointerId
    held = performance.now()
    tip.setPointerCapture(e.pointerId)
    hold = { u: 0 }
    root.classList.add('holding')
    if (still) drawFx()
    else loop.start()
  })
  const release = (e: PointerEvent) => {
    if (e.pointerId !== holdId || !hold) return
    holdId = -1
    // the time held decides the strength (also under reduced motion, where the drop does not visibly swell)
    const lv = Math.min(2, Math.floor((performance.now() - held) / 550))
    hold = null
    root.classList.remove('holding')
    drop(lv)
  }
  tip.addEventListener('pointerup', release)
  tip.addEventListener('pointercancel', release)
  ctx.onCleanup(onDigit((d) => d <= 3 && drop(d - 1)))
  // show the level reached while holding (on the three words under the brush)
  let shown = -1
  const showLv = (lv: number) => {
    if (lv === shown) return
    shown = lv
    lvBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === lv)))
  }

  function drop(lv: number) {
    if (fall || night) return
    showLv(lv)
    lastLv = lv
    said.hidden = true
    flash.classList.remove('on')
    // a fresh drop clears the pond (the clouded water settles), unless this one is strong
    murkTo = 0
    raise(false)
    marks.fill(0)
    moon = [mx0, my0]
    fall = { u: 0, lv, from: [tx + par[0], ty + 6 + par[1]], auto: false }
    ctx.chime('soft')
    go()
  }
  function land1() {
    const f = fall
    fall = null
    if (!f) return
    if (f.lv > 0) rings.push({ x: target[0], y: target[1], u: still ? 0.35 : 0, k: f.lv === 2 ? 1.4 : 1 })
    else rings.push({ x: target[0] - 30, y: target[1] - 12, u: still ? 0.6 : 0.3, k: 0.35 })
    if (f.lv === 2) murkTo = 1
    if (f.auto) return
    egretBtn.setAttribute('aria-disabled', 'false')
    root.classList.add('dropped')
    ctx.prompt(K.ask)
  }

  // ── asking the egret
  function ask() {
    if (lastLv < 0 || fall || night) return
    const lv = lastLv
    said.hidden = false
    out.textContent = ''
    root.classList.remove('asked')
    void root.offsetWidth
    root.classList.add('asked')
    ctx.chime('tap')
    if (lv === 1) {
      night = { u: 0, k: 0 }
      marks.fill(0)
      go()
    } else answer(lv)
  }
  function answer(lv: number) {
    out.textContent = K.outcomes[KEYS[lv]]
    if (!out.hasAttribute('aria-live')) out.setAttribute('aria-live', 'polite')
    asked.add(lv)
    ctx.chime(lv === 1 ? 'ok' : 'soft')
    if (lv === 1 && !firstInsight) {
      firstInsight = true
      ctx.insight(F(K.insights[0]), F(K.insights[0].detail))
    } else if (asked.size === 3 && firstInsight && !secondInsight) {
      secondInsight = true
      ctx.insight(F(K.insights[1]))
    }
  }
  /** five nights fast: the moon steps across the sky, a drop each night, the egret notices once */
  function stepNight(dt: number) {
    const n = night!
    const per = 1.05
    n.u += dt
    const k = Math.min(NIGHTS - 1, Math.floor(n.u / per))
    if (k !== n.k || n.u < dt + 1e-6) {
      if (k !== n.k) n.k = k
      const a = (k + 0.5) / NIGHTS
      moon = [W * (0.12 + a * 0.76), hz * (0.62 - Math.sin(a * Math.PI) * 0.4)]
      fall = { u: still ? 1 : 0.2, lv: 1, from: [tx + par[0], ty + 6 + par[1]], auto: true }
      if (still) land1()
    }
    const into = n.u - k * per
    if (into > 0.6 && marks[k] === 0) {
      marks[k] = k === HIT ? 2 : 1
      if (k === HIT) {
        flash.classList.add('on')
        raise(true)
      } else if (k === HIT + 1) {
        flash.classList.remove('on')
        raise(false)
      }
    }
    if (n.u >= per * NIGHTS || dt >= 1) {
      if (dt >= 1) marks.forEach((_, i) => (marks[i] = i === HIT ? 2 : 1))
      night = null
      moon = [mx0, my0]
      flash.classList.toggle('on', still)
      raise(still)
      answer(1)
    }
  }

  // ── parallax: the near layer moves most, the far water a little (pointer only)
  if (!low && !ctx.reduced) {
    let rect: DOMRect | null = null
    root.addEventListener('pointerenter', () => void (rect = root.getBoundingClientRect()))
    root.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return
      rect ??= root.getBoundingClientRect()
      const u = (e.clientX - rect.left) / rect.width - 0.5, v = (e.clientY - rect.top) / rect.height - 0.5
      par = [-u * 26, -v * 8]
      near.style.transform = `translate3d(${par[0].toFixed(1)}px,${par[1].toFixed(1)}px,0)`
      bird.style.transform = lift.style.transform = `translate3d(${(-u * 6).toFixed(1)}px,0,0)`
    })
    root.addEventListener('pointerleave', () => {
      par = [0, 0]
      near.style.transform = bird.style.transform = lift.style.transform = ''
    })
  }
}
