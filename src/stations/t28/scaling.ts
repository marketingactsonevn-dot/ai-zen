import { fill, h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, wash } from '../../ui/part2/paint'
import { C } from './data'
import { clamp, f1, frame } from './frame'
import { bamboo, nightSky } from './brush'

const G = C.scenes.scaling
const TOTAL = 100

/** A water jar (chum) standing on (x, g), W wide, H tall: wide belly, short neck, rolled rim. */
function jarPath(x: number, g: number, W: number, H: number) {
  const X = (k: number) => f1(x + k * W)
  const Y = (k: number) => f1(g - k * H)
  return `M${X(-0.3)} ${Y(0)}L${X(0.3)} ${Y(0)}C${X(0.43)} ${Y(0.05)} ${X(0.54)} ${Y(0.34)} ${X(0.5)} ${Y(0.58)}C${X(0.47)} ${Y(0.78)} ${X(0.38)} ${Y(0.9)} ${X(0.29)} ${Y(0.945)}L${X(0.33)} ${Y(1)}L${X(-0.33)} ${Y(1)}L${X(-0.29)} ${Y(0.945)}C${X(-0.38)} ${Y(0.9)} ${X(-0.47)} ${Y(0.78)} ${X(-0.5)} ${Y(0.58)}C${X(-0.54)} ${Y(0.34)} ${X(-0.43)} ${Y(0.05)} ${X(-0.3)} ${Y(0)}Z`
}

/** A young tree in brush: S-bent trunk from (x, y) up th, three limbs, leaf clusters of pointed dabs (no filters: it sways). */
function sapling(x: number, y: number, th: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const top: Pt = [x + th * 0.04, y - th]
  const trunk = curve([x, y], [x - th * 0.12, y - th * 0.55], top, 14)
  let wood = stroke(trunk, Math.max(3, th * 0.055), 0.02, 0.7, 0.18)
  const tips: Pt[] = [top]
  ;[[0.42, -1, 0.34], [0.58, 1, 0.3], [0.74, -1, 0.22], [0.82, 1, 0.18]].forEach(([t, side, len]) => {
    const [bx, by] = trunk[Math.round(t * 14)]
    const L = th * len
    const end: Pt = [bx + side * L, by - L * (0.45 + r() * 0.2)]
    wood += stroke(curve([bx, by], [bx + side * L * 0.5, by - L * 0.05], end, 8), Math.max(1.4, th * 0.022), 0.05, 0.7, 0.2)
    tips.push(end)
  })
  let dark = '', light = '', pads = ''
  tips.forEach(([tx, ty], k) => {
    const R = th * (k ? 0.12 : 0.15)
    pads += blob(tx, ty - R * 0.2, R * 1.25, R * 0.8, seed + k, 0.25, 12)
    for (let i = 0; i < 13; i++) {
      const a = r() * Math.PI * 2
      const d = R * Math.sqrt(r())
      const px = tx + Math.cos(a) * d * 1.2, py = ty + Math.sin(a) * d * 0.75 - R * 0.2
      const ang = -Math.PI / 2 + (px - tx) / R * 0.9 + (r() - 0.5) * 0.9
      const len = R * (0.45 + r() * 0.3)
      const q: Pt = [px + Math.cos(ang) * len, py + Math.sin(ang) * len]
      const leaf = stroke([[px, py], [(px + q[0]) / 2 + Math.cos(ang + 1.5) * len * 0.12, (py + q[1]) / 2 + Math.sin(ang + 1.5) * len * 0.12], q], len * 0.42, 0.45, 0.5, 0.05)
      if (r() < 0.55) dark += leaf
      else light += leaf
    }
  })
  return [
    s('path', { class: 't28s-pad', d: pads }),
    s('path', { class: 't28s-wood', d: wood }),
    s('path', { class: 'gb-leaf-2', d: light }),
    s('path', { class: 'gb-leaf', d: dark }),
  ]
}

/** Share 100 silver drops between three stone jars (data · size · compute): the sapling grows only when all three are full together. */
export function scalingScene(ctx: SceneCtx) {
  const cid = nextId('t28s')
  const vals = G.jars.map(() => 0)
  const left = h('p', { class: 't28s-left' }, fill(G.remaining, { n: TOTAL }))
  const status = h('p', { class: 't28s-status', 'aria-live': 'polite' })
  const inputs = G.jars.map((j, i) => {
    const out = h('output', { class: 't28s-val' }, '0')
    const inp = h('input', { type: 'range', min: 0, max: TOTAL, step: 1, value: 0, 'aria-label': fill(G.slider, { name: j.name }), 'aria-valuetext': fill(G.valueText, { n: 0, name: j.name }) })
    inp.addEventListener('input', () => set(i, Number(inp.value), inp, out))
    return h('label', { class: 't28s-row', title: j.aria }, h('span', { class: 't28s-name' }, j.name), inp, out)
  })
  const panel = h('div', { class: 'gf-panel t28s-panel' }, ...inputs, left, status)
  const { root, svg } = frame(ctx, 't28s', [...G.insights as Fact[]], panel, draw)
  ctx.prompt(G.prompt)
  const still = ctx.reduced || ctx.quality === 'low'

  let waters: SVGGElement[] = []
  let drops: SVGGElement[] = []
  let flights: Pt[] = [] // spout → jar mouth, per jar
  let jarH = 1
  let tree: SVGGElement | null = null
  let stage = 0 // 0 nothing yet · 1 first insight · 2 balanced

  function set(i: number, v: number, inp: HTMLInputElement, out: HTMLOutputElement) {
    const others = vals.reduce((a, b, k) => (k === i ? a : a + b), 0)
    v = Math.min(v, TOTAL - others)
    const more = v > vals[i]
    vals[i] = v
    inp.value = String(v)
    out.textContent = String(v)
    inp.setAttribute('aria-valuetext', fill(G.valueText, { n: v, name: G.jars[i].name }))
    update()
    if (more) pour(i)
  }

  // one silver drop flies from the spout into the jar that was just given water
  function pour(i: number) {
    const d = drops[i]
    if (still || !d || d.getAnimations().length) return
    const [dx, dy] = flights[i]
    d.animate([
      { transform: 'translate(0px, 0px)', opacity: 0 },
      { transform: `translate(${f1(dx * 0.35)}px, ${f1(dy * 0.18)}px)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${f1(dx)}px, ${f1(dy)}px)`, opacity: 0.9, offset: 0.92 },
      { transform: `translate(${f1(dx)}px, ${f1(dy + 6)}px)`, opacity: 0 },
    ], { duration: 650, easing: 'ease-in' })
  }

  function update() {
    const sum = vals.reduce((a, b) => a + b, 0)
    left.textContent = fill(G.remaining, { n: TOTAL - sum })
    waters.forEach((g, i) => { g.style.transform = `translateY(${f1(-jarH * clamp(vals[i] / 50, 0, 1))}px)` })
    const lo = Math.min(...vals), hi = Math.max(...vals)
    const low = vals.indexOf(lo)
    const grow = clamp(lo / 30, 0, 1)
    const tilt = sum ? ((hi - lo) / TOTAL) * 48 * (low === 0 ? -1 : 1) : 0
    if (tree) tree.style.transform = `rotate(${f1(tilt)}deg) scale(${f1(0.42 + grow * 0.58)})`
    const balanced = lo >= 26 && hi - lo <= 10
    status.textContent = !sum ? '' : balanced ? G.balanced : fill(G.lopsided, { name: G.jars[low].name })
    root.classList.toggle('ok', balanced)
    if (sum && stage === 0) {
      stage = 1
      ctx.insight(G.insights[0] as Fact)
    }
    if (balanced && stage < 2) {
      stage = 2
      ctx.insight(G.insights[1] as Fact, G.detail)
      ctx.chime('ok')
    }
  }

  function draw(w: number, hh: number) {
    const u = Math.min(w / 3.4, hh / 2.3)
    const ground = hh * 0.86
    const jw = Math.min(u * 0.74, w * 0.23), jh = Math.min(jw * 1.08, hh * 0.34)
    jarH = jh * 0.8
    const xs = [w * 0.19, w * 0.5, w * 0.81]
    const gy = (i: number) => ground + (i === 1 ? jh * 0.06 : 0)
    const r = rng(2802)
    const jars = xs.map((x, i) => {
      const g = gy(i)
      const d = jarPath(x, g, jw, jh)
      const W = jw, H = jh
      // crackle in the glaze: a few fine branching hairlines low on the belly
      let crack = ''
      for (let k = 0; k < 3; k++) {
        let p: Pt = [x + (r() - 0.5) * W * 0.5, g - H * (0.18 + r() * 0.3)]
        const pts: Pt[] = [p]
        for (let j = 0; j < 5; j++) {
          p = [p[0] + (r() - 0.5) * W * 0.09, p[1] - H * (0.02 + r() * 0.05)]
          pts.push(p)
          if (r() < 0.35) crack += stroke([p, [p[0] + (r() - 0.5) * W * 0.1, p[1] + H * (0.02 + r() * 0.04)]], Math.max(0.5, W * 0.005), 0.2, 0.4, 0.3)
        }
        crack += stroke(pts, Math.max(0.6, W * 0.006), 0.2, 0.3, 0.3)
      }
      const band = stroke(curve([x - W * 0.47, g - H * 0.76], [x, g - H * 0.68], [x + W * 0.47, g - H * 0.76], 12), Math.max(1.4, W * 0.014), 0.1, 0.1, 0.3) +
        stroke(curve([x - W * 0.42, g - H * 0.83], [x, g - H * 0.76], [x + W * 0.42, g - H * 0.83], 12), Math.max(1, W * 0.008), 0.1, 0.1, 0.3)
      const flank = stroke([...curve([x + W * 0.3, g - H * 0.94], [x + W * 0.58, g - H * 0.58], [x + W * 0.42, g - H * 0.1], 12), [x + W * 0.28, g]], Math.max(2, W * 0.035), 0.1, 0.25, 0.25)
      const moonrim = stroke(curve([x - W * 0.28, g - H * 0.9], [x - W * 0.53, g - H * 0.62], [x - W * 0.42, g - H * 0.2], 12), Math.max(1.4, W * 0.02), 0.25, 0.4, 0.1)
      let rip = ''
      for (let k = 0; k < 4; k++) {
        const y = g + H * (0.06 + k * 0.07), x0 = x - W * (0.3 - r() * 0.2)
        rip += stroke([[x0, y], [x0 + W * (0.2 + r() * 0.25), y + (r() - 0.5)]], Math.max(0.8, H * 0.008), 0.3, 0.3, 0.1)
      }
      const water = s('g', { class: 't28s-water' },
        s('rect', { x: f1(x - W * 0.6), y: f1(g), width: f1(W * 1.2), height: f1(H), fill: `url(#${cid}-w)` }),
        s('path', { class: 't28s-rip', d: rip }),
        s('path', { class: 'gb-glint', d: stroke(curve([x - W * 0.5, g + 1], [x, g + H * 0.035], [x + W * 0.5, g + 1], 10), Math.max(1.2, H * 0.014), 0.2, 0.2, 0.2) }))
      return s('g', null,
        s('ellipse', { class: 'gb-shadow', cx: f1(x + W * 0.12), cy: f1(g + 2), rx: f1(W * 0.6), ry: f1(H * 0.06) }),
        s('path', { class: 't28s-jar', d, filter: 'url(#ink-rough)' }),
        s('path', { class: 'gb-stone-sh', d }),
        s('clipPath', { id: `${cid}-${i}` }, s('path', { d })),
        s('g', { 'clip-path': `url(#${cid}-${i})` }, water),
        s('path', { class: 't28s-crack', d: crack }),
        s('path', { class: 't28s-band', d: band }),
        s('path', { class: 't28s-flank', d: flank, filter: 'url(#ink-rough)' }),
        s('path', { class: 'gb-rim-hi', d: moonrim }),
        s('ellipse', { class: 't28s-mouth', cx: f1(x), cy: f1(g - H), rx: f1(W * 0.3), ry: f1(H * 0.05) }),
        s('path', { class: 't28s-lip', d: stroke(curve([x - W * 0.34, g - H * 0.995], [x, g - H * 0.93], [x + W * 0.34, g - H * 0.995], 10), Math.max(2, W * 0.03), 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
        s('text', { class: 'gf-caption', x: f1(x), y: f1(g + Math.max(20, H * 0.13)), 'text-anchor': 'middle' }, G.jars[i].name))
    })
    waters = jars.map((j) => j.querySelector('.t28s-water') as SVGGElement)
    // the sapling grows on a raised mound in the middle of the garden, behind the jars
    const tx = w * 0.5, ty = ground - jh * 1.2
    const th = Math.min(hh * 0.5, ty - hh * 0.05)
    tree = s('g', { class: 't28s-tree', style: `transform-origin:${f1(tx)}px ${f1(ty)}px` }, ...sapling(tx, ty, th, 2803))
    // the bamboo spout comes in from the right, held on a crossed bamboo trestle; its mouth drips silver drops
    const pw = Math.max(5, u * 0.075)
    const mouth: Pt = [w * 0.7, hh * 0.2]
    const postX = w * 0.95, legY = ground - jh * 1.05
    const pipe = bamboo([w * 1.06, hh * 0.15], mouth, pw, 2804)
    const trestle = s('g', null,
      bamboo([postX - pw * 2.6, legY], [postX + pw * 1.6, hh * 0.12], pw * 0.66, 2805, false),
      bamboo([postX + pw * 2.8, legY + pw], [postX - pw * 1.4, hh * 0.12], pw * 0.66, 2806, false),
      s('path', { class: 't28s-tie', d: stroke([[postX - pw * 1.1, hh * 0.165], [postX + pw * 1.3, hh * 0.18]], pw * 0.5, 0.2, 0.2, 0.4) }))
    const drop = (x: number, y: number, k: number) => `M${f1(x)} ${f1(y - k * 1.6)}Q${f1(x + k)} ${f1(y)} ${f1(x)} ${f1(y + k * 0.9)}Q${f1(x - k)} ${f1(y)} ${f1(x)} ${f1(y - k * 1.6)}Z`
    const dk = Math.max(2.4, pw * 0.42)
    const hang: Pt = [mouth[0] - pw * 0.1, mouth[1] + pw * 0.9]
    drops = xs.map(() => s('g', { class: 't28s-fly' }, s('path', { class: 'gb-drop', d: drop(hang[0], hang[1], dk) })))
    flights = xs.map((x, i) => [x - hang[0], gy(i) - jh * 0.96 - hang[1]] as Pt)
    svg.replaceChildren(
      s('linearGradient', { id: `${cid}-w`, x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: 0, style: 'stop-color:var(--water);stop-opacity:.35' }),
        s('stop', { offset: 0.5, style: 'stop-color:var(--water);stop-opacity:.7' }),
        s('stop', { offset: 1, style: 'stop-color:var(--water);stop-opacity:.9' })),
      ...nightSky(w, ground - jh * 0.55, 2801, [w * 0.13, hh * 0.13, Math.max(12, u * 0.11)], hh * 0.3),
      // a garden floor: a soft ground wash, the mound, some grass
      wash(blob(w * 0.5, ground + jh * 0.02, w * 0.52, jh * 0.12, 2807, 0.1), 0.14),
      s('path', { class: 'p2p-hill', style: '--o:.42', filter: 'url(#ink-wash)', d: `M${f1(tx - jw * 1.7)} ${f1(ground - jh * 0.3)}Q${f1(tx - jw * 0.9)} ${f1(ty + jh * 0.02)} ${f1(tx - jw * 0.15)} ${f1(ty - jh * 0.03)}Q${f1(tx + jw * 0.55)} ${f1(ty - jh * 0.05)} ${f1(tx + jw * 1.1)} ${f1(ty + jh * 0.28)}Q${f1(tx + jw * 1.6)} ${f1(ty + jh * 0.6)} ${f1(tx + jw * 1.9)} ${f1(ground - jh * 0.3)}Z` }),
      s('path', { class: 't28s-ridge', d: stroke(curve([tx - jw * 0.95, ty + jh * 0.16], [tx - jw * 0.3, ty - jh * 0.08], [tx + jw * 0.7, ty + jh * 0.1], 14), Math.max(2, jw * 0.03), 0.2, 0.5, 0.1), filter: 'url(#ink-rough)' }),
      grass(tx - jw * 0.55, ty + jh * 0.04, Math.max(12, jw * 0.16), 2809),
      grass(tx + jw * 0.48, ty + jh * 0.06, Math.max(10, jw * 0.13), 2810),
      tree,
      trestle,
      pipe,
      s('path', { class: 'gb-drop t28s-hang', d: drop(hang[0], hang[1], dk) }),
      s('g', { class: 't28s-drip' }, s('path', { class: 'gb-drop', d: drop(hang[0], hang[1], dk * 0.8) })),
      s('path', { class: 't28s-ground', d: stroke([[w * 0.02, ground + 3], [w * 0.5, ground + 6], [w * 0.98, ground + 2]], 2.4, 0.1, 0.1, 0.2), filter: 'url(#ink-rough)' }),
      ...jars,
      grass(xs[0] - jw * 0.58, ground + 4, Math.max(12, jw * 0.16), 2811),
      grass(xs[2] + jw * 0.6, ground + 4, Math.max(12, jw * 0.16), 2812),
      ...drops)
    update()
  }
}
