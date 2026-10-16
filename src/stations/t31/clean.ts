import raw from '../../content/tram-31.json'
import { s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneDef } from '../types'
import type { StepPath } from '../../ui/part2/types'
import { clamp } from '../../ui/part2/ink'
import { grass, hills, mist, moon, wash } from '../../ui/part2/paint'
import { stepPath, type SlotGeo } from '../../ui/part2/steps'
import { bamboo, blob, ground, rng, stroke, type Pt } from './kit'

const K = raw.scenes.clean

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** A celadon bowl standing on (cx, cy = rim centre), bw half-wide, its water holding the whole moon. */
export function moonBowl(cx: number, cy: number, bw: number, seed: number): SVGGElement {
  const ry = bw * 0.24
  const body = `M${f1(cx - bw)} ${f1(cy)}C${f1(cx - bw * 0.96)} ${f1(cy + bw * 0.5)} ${f1(cx - bw * 0.55)} ${f1(cy + bw * 0.74)} ${f1(cx - bw * 0.3)} ${f1(cy + bw * 0.78)}L${f1(cx - bw * 0.32)} ${f1(cy + bw * 0.9)}L${f1(cx + bw * 0.32)} ${f1(cy + bw * 0.9)}L${f1(cx + bw * 0.3)} ${f1(cy + bw * 0.78)}C${f1(cx + bw * 0.55)} ${f1(cy + bw * 0.74)} ${f1(cx + bw * 0.96)} ${f1(cy + bw * 0.5)} ${f1(cx + bw)} ${f1(cy)}Z`
  const rim: Pt[] = Array.from({ length: 17 }, (_, i) => { const a = (Math.PI * i) / 16; return [cx + Math.cos(a) * bw, cy + Math.sin(a) * ry] as Pt })
  return s('g', { class: 'g11-bowl' },
    ground(cx + bw * 0.1, cy + bw * 0.92, bw * 1.15, bw * 0.16, seed, 0.24),
    s('path', { class: 'g11-bowl-glaze', d: body, filter: 'url(#ink-rough)' }),
    s('path', { d: body, fill: 'url(#p2-shade)' }),
    s('path', { class: 'g11-moonlit', d: stroke([[cx - bw * 0.86, cy + bw * 0.12], [cx - bw * 0.7, cy + bw * 0.46], [cx - bw * 0.42, cy + bw * 0.64]], bw * 0.07, 0.2, 0.3, 0.2) }),
    s('path', { class: 'g11-wash g11-bowl-ink', d: stroke(rim.slice(2).reverse(), bw * 0.06, 0.1, 0.2, 0.3) + stroke([[cx + bw * 0.98, cy + bw * 0.1], [cx + bw * 0.7, cy + bw * 0.6], [cx + bw * 0.3, cy + bw * 0.8]], bw * 0.05, 0.1, 0.3, 0.3), filter: 'url(#ink-rough)' }),
    s('ellipse', { class: 'g11-bowl-in', cx: f1(cx), cy: f1(cy), rx: f1(bw), ry: f1(ry) }),
    s('ellipse', { class: 'g11-bowl-water', cx: f1(cx), cy: f1(cy + ry * 0.14), rx: f1(bw * 0.88), ry: f1(ry * 0.78) }),
    s('ellipse', { class: 'g11-bowl-glow', cx: f1(cx + bw * 0.08), cy: f1(cy + ry * 0.12), rx: f1(bw * 0.5), ry: f1(ry * 0.6), fill: 'url(#p2-halo)' }),
    s('ellipse', { class: 'g11-bowl-moon', cx: f1(cx + bw * 0.08), cy: f1(cy + ry * 0.12), rx: f1(bw * 0.22), ry: f1(ry * 0.42) }),
    s('path', { class: 'g11-moonlit', d: stroke([[cx - bw * 0.92, cy - ry * 0.2], [cx - bw * 0.4, cy - ry * 0.95], [cx + bw * 0.3, cy - ry * 0.95]], bw * 0.05, 0.2, 0.4, 0.2) }))
}

/** A stone basin (tsukubai) whose rim centre is (cx, cy), bw half-wide: a cut bowl with a lip, murky water that clears. */
function basin(cx: number, cy: number, bw: number, seed: number): { g: SVGGElement; clear: SVGElement } {
  const ry = bw * 0.3
  const body = `M${f1(cx - bw)} ${f1(cy)}C${f1(cx - bw * 1.02)} ${f1(cy + bw * 0.42)} ${f1(cx - bw * 0.6)} ${f1(cy + bw * 0.62)} ${f1(cx - bw * 0.36)} ${f1(cy + bw * 0.66)}L${f1(cx + bw * 0.36)} ${f1(cy + bw * 0.66)}C${f1(cx + bw * 0.6)} ${f1(cy + bw * 0.62)} ${f1(cx + bw * 1.02)} ${f1(cy + bw * 0.42)} ${f1(cx + bw)} ${f1(cy)}Z`
  const clear = s('g', { class: 't31f3-clear' },
    s('ellipse', { class: 't31f3-clearw', cx: f1(cx), cy: f1(cy + ry * 0.12), rx: f1(bw * 0.84), ry: f1(ry * 0.7) }),
    s('ellipse', { class: 't31f3-moonr', cx: f1(cx + bw * 0.2), cy: f1(cy + ry * 0.05), rx: f1(bw * 0.16), ry: f1(ry * 0.2) }))
  const g = s('g', { class: 't31f2-basin' },
    ground(cx - bw * 0.25, cy + bw * 0.7, bw * 1.25, bw * 0.14, seed, 0.3),
    s('path', { class: 't31f2-stone', d: body, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { d: body, fill: 'url(#p2-shade)' }),
    s('path', { class: 'g11-mossy', d: blob(cx - bw * 0.5, cy + bw * 0.5, bw * 0.3, bw * 0.08, seed + 1, 0.3, 10) + blob(cx + bw * 0.55, cy + bw * 0.12, bw * 0.16, bw * 0.06, seed + 2, 0.3, 10) }),
    s('ellipse', { class: 't31f2-lip', cx: f1(cx), cy: f1(cy), rx: f1(bw), ry: f1(ry), fill: 'url(#p2-rock)' }),
    // murky water: lighter in the middle where the moonlight sits in the silt, darker at its edge
    s('ellipse', { class: 't31f3-murk', cx: f1(cx), cy: f1(cy + ry * 0.12), rx: f1(bw * 0.84), ry: f1(ry * 0.7), fill: 'url(#t31f3-murk)' }),
    clear,
    s('path', { class: 'g11-moonlit', d: stroke(Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (1.08 + i * 0.06); return [cx + Math.cos(a) * bw * 0.98, cy + Math.sin(a) * ry * 0.98] as Pt }), Math.max(1.2, bw * 0.05), 0.2, 0.3, 0.2) }))
  return { g, clear }
}

/** Falling water from a (a lip) to b (the next surface): a ribbon that narrows, bows out and lands in splash rings. */
function fall(a: Pt, b: Pt, w: number, out: number): { g: SVGGElement; clear: SVGElement } {
  // it leaves the lip moving outward, then drops: a quadratic with its control point out past the lip
  const c: Pt = [a[0] + out, a[1] + (b[1] - a[1]) * 0.08]
  const pts = Array.from({ length: 14 }, (_, i) => {
    const t = i / 13, u = 1 - t
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as Pt
  })
  const ribbon = stroke(pts, w, 0.2, 0.08, 0.5)
  // the lit edge and a second strand: water, not a pipe
  const hi = stroke(pts.map(([x, y]) => [x - w * 0.22, y] as Pt), Math.max(0.7, w * 0.22), 0.15, 0.4, 0.2) +
    stroke(pts.slice(3).map(([x, y], k) => [x + w * 0.25 + Math.sin(k * 1.3) * w * 0.12, y] as Pt), Math.max(0.5, w * 0.12), 0.3, 0.3, 0.2)
  const splash = s('g', { class: 't31f3-splash' },
    s('ellipse', { cx: f1(b[0]), cy: f1(b[1] + 1), rx: f1(w * 2.4), ry: f1(w * 0.7) }),
    s('ellipse', { cx: f1(b[0]), cy: f1(b[1] + 1), rx: f1(w * 4.2), ry: f1(w * 1.2) }))
  const clear = s('g', { class: 't31f3-flow-clear' }, s('path', { d: ribbon }), s('path', { class: 't31f3-flow-hi', d: hi }))
  return { g: s('g', null, s('path', { class: 't31f3-flow', d: ribbon }), s('path', { class: 't31f3-flow-hi', d: hi }), splash, clear), clear }
}

/** the scene's own geometry, laid out once per size (px in the scene) */
type Geo = { w: number; h: number; row: boolean; size: Pt; basins: [number, number, number][]; bowl: [number, number, number]; spout: Pt; stone: number; bank: [number, number, number, number] }

/**
 * Scene 5 — seen low, beside a big dark bowl: a bamboo kakehi high at the back left, half in mist, pours murky water
 * down six stone basins that zig-zag toward you, each one bigger and nearer, into the bowl. Each basin waits for its
 * filter stone: river stones with carved numbers lie on the moss in front (stepPath: in order, by tap, drag or number
 * key). A right stone settles on its basin's lip, the step's name is brushed beside it and the water below clears a
 * notch; all six in, the bowl fills clear and holds the whole moon.
 */
export function cleanScene(): SceneDef {
  let G: Geo | null = null
  let clears: SVGElement[] = []
  let falls: SVGElement[] = []
  let names: SVGElement[] = []
  let anchor: SVGElement | null = null
  let placed = 0
  const show = () => {
    clears.forEach((c, i) => (c.style.opacity = String(i < placed ? 0.4 + (0.6 * (i + 1)) / 6 : 0)))
    falls.forEach((c, i) => (c.style.opacity = String(i < placed ? 0.3 + (0.7 * (i + 1)) / 6 : 0)))
    names.forEach((t, i) => t.classList.toggle('on', i < placed))
  }
  /** lay the scene out: the cascade, the bowl, the spout, the mossy bank the loose stones lie on */
  const geo = (g: SlotGeo): Geo => {
    const { w, h, row, size } = g
    const n = 6
    if (row) {
      // wide: a zig-zag from the spout high on the left down toward you on the right, into the bowl; the bank bottom left
      const bw0 = clamp(w * 0.021, 16, 32)
      const basins = Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1)
        const x = w * (0.25 + 0.3 * t) + (i % 2 ? 1 : -1) * w * 0.052 * (0.5 + t)
        return [x, h * (0.2 + 0.5 * t ** 1.12), bw0 * (1 + 2.6 * t)] as [number, number, number]
      })
      const last = basins[n - 1]
      const bowl: [number, number, number] = [Math.min(w - last[2] * 1.5, last[0] + last[2] * 2.6), last[1] + last[2] * 0.95, last[2] * 1.3]
      return { w, h, row, size, basins, bowl, spout: [basins[0][0] - bw0 * 1.4, h * 0.075], stone: size[1], bank: [w * 0.01, h * 0.6, w * 0.36, h] }
    }
    // tall: the note sits on top; a zig-zag down the middle to the bowl; the bank across the foot
    const top = h * 0.2, bot = h * 0.55
    const bw0 = clamp(w * 0.045, 12, 20)
    const basins = Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1)
      return [w * (0.5 + (i % 2 ? 0.16 : -0.16) * (0.7 + 0.3 * t)), top + (bot - top) * t, bw0 * (1 + 2 * t)] as [number, number, number]
    })
    const last = basins[n - 1]
    return { w, h, row, size, basins, bowl: [w * 0.42, last[1] + last[2] * 1.5, last[2] * 1.35], spout: [basins[0][0] - bw0 * 1.4, top - h * 0.06], stone: size[1], bank: [0, h * 0.72, w, h] }
  }
  // tall screens draw the stones narrower than stepPath's column box (CSS): their centres move to match
  const BOXW = 112
  const vis = (g: Geo, c: Pt): Pt => (g.row ? c : [c[0] + (g.size[0] - BOXW) / 2, c[1]])

  return stepPath(K.steps as StepPath, {
    label: K.label, prompt: K.prompt, insight: K.insight as Fact, detail: [K.detail as Fact, K.note],
    // a placed stone sits on its basin's outer lip: the stone is the left end of the stone's box
    slots: (g) => {
      const Gg = (G = geo(g))
      const sz = Gg.row ? Gg.size[1] : Math.min(Gg.size[1], 46)
      return Gg.basins.map(([x, y, bw], i) => {
        const side = i % 2 ? 1 : -1
        const sx = x + side * bw * 1.05, sy = y + bw * 0.12
        return vis(Gg, [sx - sz * 0.55 + (Gg.row ? Gg.size[0] : BOXW) / 2, sy])
      })
    },
    // the loose stones lie on the moss bank in front
    pile: (g) => {
      const Gg = G ?? geo(g)
      const [bx0, by0, bx1, by1] = Gg.bank
      if (Gg.row) {
        const cw = Gg.size[0] + 14, rh = (by1 - by0) / 3.2
        return Array.from({ length: 6 }, (_, k) => [bx0 + 22 + (k % 2) * cw + Gg.size[0] / 2 + ((k >> 1) % 2) * 26, by0 + rh * 0.7 + (k >> 1) * rh] as Pt)
      }
      const cw = (bx1 - bx0 - 8) / 3, rh = (by1 - by0) / 2.15
      return Array.from({ length: 6 }, (_, k) => vis(Gg, [bx0 + 4 + (k % 3) * cw + BOXW / 2, by0 + rh * 0.62 + (k / 3 >= 1 ? rh : 0)]))
    },
    // a river stone at the left end of its box: shadow, body, moonlit crown, a tuft of moss
    piece: (_i, b) => {
      const r = rng(b.seed)
      const hh = b.h, cx = hh * 0.55, cy = hh * 0.54, rx = hh * (0.46 + r() * 0.06), ry = hh * (0.34 + r() * 0.05)
      const body = blob(cx, cy, rx, ry, b.seed, 0.06, 18)
      return s('g', { class: 't31f3-river' },
        s('ellipse', { class: 't31f3-river-sh', cx: f1(cx + rx * 0.12), cy: f1(cy + ry * 0.78), rx: f1(rx * 1.05), ry: f1(ry * 0.32) }),
        s('path', { class: 't31f3-river-body', d: body, fill: 'url(#p2-rock)' }),
        s('path', { d: body, fill: 'url(#p2-shade)' }),
        s('path', { class: 't31f3-river-lit', d: stroke(Array.from({ length: 8 }, (_, k) => { const a = Math.PI * (1.08 + k * 0.08); return [cx + Math.cos(a) * rx * 0.86, cy + Math.sin(a) * ry * 0.86] as Pt }), Math.max(1.2, hh * 0.05), 0.2, 0.3, 0.2) }),
        s('path', { class: 'g11-mossy', d: blob(cx + rx * 0.45, cy + ry * 0.62, rx * 0.3, ry * 0.12, b.seed + 1, 0.3, 8) }))
    },
    onPlace: (k) => {
      placed = k + 1
      show()
      // the stone on a far basin is far away too: smaller
      const root = anchor?.closest('.p2s')
      const st = root && [...root.querySelectorAll<HTMLElement>('.p2s-stone.placed')].find((e) => e.querySelector('.p2s-key')?.textContent === String(k + 1))
      if (st) st.style.setProperty('--k', (0.42 + (0.58 * k) / 5).toFixed(2))
    },
    art: (g) => {
      const Gg = G!
      const { w, h, row, basins, bowl, spout } = Gg
      const { seed } = g
      const parts: SVGElement[] = []
      clears = []
      falls = []
      names = []
      const r = rng(seed + 3)
      parts.push(s('defs', null, s('radialGradient', { id: 't31f3-murk', cx: 0.45, cy: 0.4, r: 0.65 }, s('stop', { offset: 0, class: 't31f3-m0' }), s('stop', { offset: 1, class: 't31f3-m1' }))))
      // the sky: mist, the moon, far hills behind the high basins
      const b0 = basins[0], b2 = basins[2]
      parts.push(
        mist(w * 0.55, h * 0.12, w * 0.7, h * 0.18),
        moon(row ? w * 0.5 : w * 0.82, row ? h * 0.11 : h * 0.1, row ? clamp(h * 0.045, 14, 28) : 11, seed, true),
        hills(row ? w * 0.08 : -w * 0.1, row ? w * 1.02 : w * 1.1, b2[1] + b2[2] * 0.3, (b2[1] - h * 0.04) * 0.7, seed, 0.92, 5),
        mist(w * 0.5, b2[1] + b2[2] * 0.2, w * 0.6, h * 0.06))
      // the kakehi: a long bamboo pipe out of the mist, resting on a crossed stand, its cut spout pouring a ribbon
      const pw = row ? clamp(w * 0.011, 9, 16) : 7
      const sp1: Pt = spout
      const sp0: Pt = [-pw * 4, sp1[1] - (sp1[0] + pw * 4) * 0.09] // from out of the frame, sloping down to the spout
      const postX = sp1[0] - pw * 3.2, postY = sp1[1] - pw * 0.2
      const footY = Math.max(b0[1] + b0[2] * 0.9, postY + h * 0.08)
      parts.push(
        // the post with a fork at its head that the pipe rests in, and a stone at its foot
        bamboo([postX + pw * 0.2, footY], [postX, postY + pw * 0.5], pw * 0.62, seed + 6, pw * 4),
        s('path', { class: 'g11-wash t31f3-fork', d: stroke([[postX - pw * 0.1, postY + pw * 0.7], [postX - pw * 0.7, postY - pw * 0.5]], pw * 0.28, 0.1, 0.3, 0.3) + stroke([[postX + pw * 0.1, postY + pw * 0.7], [postX + pw * 0.6, postY - pw * 0.6]], pw * 0.28, 0.1, 0.3, 0.3) }),
        ground(postX + pw * 0.6, footY + 1, pw * 2.4, pw * 0.4, seed + 8, 0.3),
        bamboo(sp0, sp1, pw, seed + 4, pw * 6),
        // the cut end: the open bore and its lit lip
        s('ellipse', { class: 't31f3-mouth', cx: f1(sp1[0]), cy: f1(sp1[1] + pw * 0.05), rx: f1(pw * 0.3), ry: f1(pw * 0.5), transform: `rotate(-20 ${f1(sp1[0])} ${f1(sp1[1])})` }),
        mist(pw * 2, sp0[1] + pw, w * 0.12, pw * 3))
      const pour = fall([sp1[0] + pw * 0.2, sp1[1] + pw * 0.25], [b0[0] - b0[2] * 0.2, b0[1] + b0[2] * 0.1], row ? 4.5 : 3, pw * 0.9)
      pour.clear.remove() // what leaves the spout is always murky
      parts.push(pour.g)
      // the basins, far to near, each with its fall into the next (under it), mist between the far ones; the bowl last
      basins.forEach(([x, y, bw], i) => {
        const bs = basin(x, y, bw, seed + 10 + i)
        clears.push(bs.clear)
        parts.push(bs.g)
        if (i < 3) parts.push(mist(x + bw * 0.5, y + bw * 0.9, bw * 3.2, bw * 0.5))
        const nx = basins[i + 1]
        const to: Pt = nx ? [nx[0] + (nx[0] > x ? -0.15 : 0.15) * nx[2], nx[1] + nx[2] * 0.1] : [bowl[0] + (bowl[0] > x ? -0.2 : 0.2) * bowl[2], bowl[1] + bowl[2] * 0.06]
        const dir = to[0] > x ? 1 : -1
        const f = fall([x + dir * bw * 0.92, y + bw * 0.06], to, (row ? 3.5 : 2.4) + bw * 0.1, dir * bw * 0.35)
        falls.push(f.clear)
        parts.push(f.g)
        // the step's name, brushed beside its basin on the outer side (shown once its stone is in)
        const side = i % 2 ? 1 : -1
        const fs = row ? clamp(12 + bw * 0.06, 13, 17) : 11
        const tx = x + side * (bw * 1.05 + Gg.stone * (row ? 0.5 : 0.32) * (0.42 + (0.58 * i) / 5) + (row ? 8 : 4))
        // as many characters a line as the room on that side allows (a phone's margins are narrow)
        const room = side < 0 ? tx - 4 : w - tx - 4
        const lines = wrap(K.steps.steps[i].label, row ? 18 : clamp(Math.floor(room / (fs * 0.5)), 7, 16))
        names.push(s('text', { class: 't31f3-name', x: f1(tx), y: f1(y - (lines.length - 1) * fs * 0.6 + bw * 0.14), 'font-size': f1(fs), 'text-anchor': side < 0 ? 'end' : 'start' },
          ...lines.map((ln, k) => s('tspan', { x: f1(tx), dy: k ? f1(fs * 1.2) : '0' }, ln))))
      })
      parts.push(moonBowl(bowl[0], bowl[1], bowl[2], seed + 30), ...names)
      // the near bank: a mound of moss the loose stones lie on, grass at its edges (kept inside the frame)
      // the near bank: a low mound of moss in cushions, darker at its foot, lit on its crowns, with tufts and pebbles
      const [bx0, by0, bx1, by1] = Gg.bank
      const bw2 = bx1 - bx0, bh2 = by1 - by0, mx = (bx0 + bx1) / 2
      let cush = '', lit = '', peb = ''
      for (let k = 0; k < 14; k++) {
        const x = bx0 + bw2 * (0.08 + r() * 0.84), y = by0 + bh2 * (0.25 + r() * 0.6), rr = bw2 * (0.05 + r() * 0.09)
        cush += blob(x, y, rr, rr * 0.38, seed + 50 + k, 0.25, 12)
        lit += stroke([[x - rr * 0.7, y - rr * 0.22], [x, y - rr * 0.36], [x + rr * 0.6, y - rr * 0.24]], Math.max(1, rr * 0.08), 0.3, 0.3, 0.2)
      }
      for (let k = 0; k < 7; k++) peb += blob(bx0 + bw2 * (0.1 + r() * 0.8), by0 + bh2 * (0.4 + r() * 0.5), 2 + r() * 4, 1.4 + r() * 2.4, seed + 70 + k, 0.2, 8)
      parts.push(
        wash(blob(mx, by0 + bh2 * 0.62, bw2 * 0.54, bh2 * 0.42, seed + 40, 0.14), 0.12, 'p2p-wash t31f3-bank'),
        s('path', { class: 'g11-mossy t31f3-bankmoss', d: cush, filter: 'url(#ink-wash)' }),
        s('path', { class: 't31f3-banklit', d: lit }),
        s('path', { class: 't31f3-pebble', d: peb }),
        grass(bx0 + bw2 * 0.1, by0 + bh2 * 0.3, row ? 46 : 26, seed + 42), grass(bx1 - bw2 * 0.08, by0 + bh2 * 0.45, row ? 40 : 22, seed + 43), grass(mx, by1 - bh2 * 0.05, row ? 34 : 20, seed + 44))
      void r
      anchor = parts[0]
      show()
      return parts
    },
  })
}

/** Break a label into lines of about n characters, at spaces. */
function wrap(t: string, n: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const wd of t.split(' ')) {
    if (cur && (cur + ' ' + wd).length > n) out.push(cur), (cur = wd)
    else cur = cur ? `${cur} ${wd}` : wd
  }
  if (cur) out.push(cur)
  return out
}
