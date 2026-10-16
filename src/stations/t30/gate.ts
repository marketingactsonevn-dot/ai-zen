import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, mist, moon, hills, paperLantern, pine, steppingStones, wash } from '../../ui/part2/paint'
import { C } from './data'
import { f1, frame } from '../t28/frame'
import { bamboo, P } from '../t28/brush'

const G = C.scenes.gate

/** A blossoming tree crown peeking over a wall: an ink wash, a few limbs, vermilion blossoms. */
function blossom(x: number, y: number, R: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const base: Pt = [x - R * 0.1, y + R * 1.1]
  const top: Pt = [x + R * 0.1, y - R * 0.3]
  const trunk = curve(base, [x - R * 0.35, y + R * 0.4], top, 10)
  let limbs = stroke(trunk, Math.max(2, R * 0.1), 0.02, 0.7, 0.25), dots = ''
  ;[[0.35, -1], [0.5, 1], [0.7, -1], [0.85, 1], [1, -1]].forEach(([k, side], i) => {
    const [bx, by] = trunk[Math.round(k * 10)]
    const L = R * (0.45 + r() * 0.35) * (i === 4 ? 0.6 : 1)
    const end: Pt = [bx + side * L, by - L * (0.35 + r() * 0.3)]
    limbs += stroke(curve([bx, by], [bx + side * L * 0.4, by - L * 0.05], end, 8), Math.max(1, R * 0.045), 0.05, 0.7, 0.2)
    const pts = curve([bx, by], [bx + side * L * 0.4, by - L * 0.05], end, 8)
    for (let j = 2; j < 9; j += 2) {
      const [px, py] = pts[j]
      dots += blob(px + (r() - 0.5) * R * 0.12, py - R * 0.05 - r() * R * 0.08, R * 0.055, R * 0.055, seed + i * 7 + j, 0.2, 6)
    }
  })
  return [
    s('path', { class: 't30g-crown', d: blob(x, y - R * 0.05, R * 1.0, R * 0.62, seed, 0.3, 14), filter: 'url(#ink-wash)' }),
    s('path', { class: 't30g-limb', d: limbs, filter: 'url(#ink-rough)' }),
    s('path', { class: 't30g-flower', d: dots }),
  ]
}

/** One garden, one gate: a lime wall with a little window (closed model) or a bamboo gate thrown open, saplings carried home (open weights). */
export function gateScene(ctx: SceneCtx) {
  let isOpen = false
  const seen = new Set<boolean>([false])
  const seg = (o: boolean) => h('button', { class: 'btn', type: 'button', 'aria-pressed': String(o === isOpen), onClick: () => set(o) }, o ? G.open : G.closed)
  const bC = seg(false), bO = seg(true)
  const rows = G.tradeoffs.map((t) => h('div', { class: 't30g-row' }, h('dt', null, t.name), h('dd', null, t.closed)))
  const dl = h('dl', { class: 't30g-list', 'aria-live': 'polite' }, ...rows)
  const note = h('p', { class: 't30g-note' })
  const panel = h('div', { class: 'gf-panel t30g-panel' }, h('div', { class: 'gf-seg', role: 'group', 'aria-label': G.toggleAria }, bC, bO), h('p', { class: 'gf-eyebrow' }, G.tradeoffLabel), dl, note)
  const { root, svg } = frame(ctx, 't30g', [G.insight as Fact], panel, draw)
  ctx.prompt(G.prompt)

  function set(o: boolean) {
    if (o === isOpen) return
    isOpen = o
    bC.setAttribute('aria-pressed', String(!o))
    bO.setAttribute('aria-pressed', String(o))
    root.classList.toggle('open', o)
    G.tradeoffs.forEach((t, i) => { (rows[i].lastChild as HTMLElement).textContent = o ? t.open : t.closed })
    seen.add(o)
    if (seen.size === 2 && !note.textContent) {
      note.textContent = G.caveat
      ctx.insight(G.insight as Fact, G.detail as Fact)
      ctx.chime('ok')
    } else ctx.chime('soft')
  }

  function draw(w: number, hh: number) {
    const r = rng(3010)
    const gy = hh * 0.66 // the foot of both gardens
    const u = Math.min(w / 8, hh / 5)
    const wh = Math.min(hh * 0.26, u * 1.5) // the wall's height
    const mid = w * 0.5
    // ── the walled garden (left): a lime wall under dark tiles, a little lit window, one branch handed out
    const x0 = w * 0.03, x1 = mid - w * 0.03
    const capH = Math.max(8, wh * 0.17)
    const wallD = `M${P([x0, gy])}L${P([x0 + 1, gy - wh])}L${P([x1 - 1, gy - wh - 1])}L${P([x1, gy])}Z`
    let stains = ''
    for (let i = 0; i < 9; i++) {
      const x = x0 + (x1 - x0) * r()
      stains += stroke([[x, gy - wh * (0.9 - r() * 0.2)], [x + (r() - 0.5) * 4, gy - wh * (0.3 + r() * 0.3)]], 2 + r() * 4, 0.3, 0.6, 0.1)
    }
    let tiles = ''
    for (let x = x0 - capH * 0.4; x < x1 + capH * 0.4; x += capH * 0.7) tiles += `M${f1(x)} ${f1(gy - wh + capH * 0.2)}q${f1(capH * 0.35)} ${f1(capH * 0.55)} ${f1(capH * 0.7)} 0`
    const coping = `M${P([x0 - capH * 0.6, gy - wh + capH * 0.25])}Q${P([x0 - capH * 0.2, gy - wh - capH * 0.3])} ${P([x0 + capH, gy - wh - capH * 0.75])}L${P([x1 - capH, gy - wh - capH * 0.8])}Q${P([x1 + capH * 0.2, gy - wh - capH * 0.3])} ${P([x1 + capH * 0.6, gy - wh + capH * 0.2])}Z`
    const winX = (x0 + x1) / 2 + (x1 - x0) * 0.08, winY = gy - wh * 0.56, ws = wh * 0.3
    const lattice = [-0.25, 0, 0.25].map((k) => stroke([[winX - ws * 0.48 * Math.sqrt(1 - 4 * k * k), winY + ws * k], [winX + ws * 0.48 * Math.sqrt(1 - 4 * k * k), winY + ws * k]], 1.2, 0.1, 0.1, 0.4) + stroke([[winX + ws * k, winY - ws * 0.48 * Math.sqrt(1 - 4 * k * k)], [winX + ws * k, winY + ws * 0.48 * Math.sqrt(1 - 4 * k * k)]], 1.2, 0.1, 0.1, 0.4)).join('')
    const ring = Array.from({ length: 25 }, (_, i) => [winX + Math.cos((i / 24) * Math.PI * 2) * ws * 0.5, winY + Math.sin((i / 24) * Math.PI * 2) * ws * 0.5] as Pt)
    const twig = curve([winX + ws * 0.2, winY + ws * 0.1], [winX + ws * 0.9, winY + ws * 0.45], [winX + ws * 1.9, winY + ws * 0.05], 12)
    let buds = ''
    ;[4, 6, 8, 10, 11, 12].forEach((k, i) => { const [x, y] = twig[k]; buds += blob(x + (i % 2 ? 3 : -3), y - 3 - (i % 2) * 3, ws * 0.085, ws * 0.085, 3020 + i, 0.25, 7) })
    const walled = s('g', { class: 't30g-walled' },
      ...blossom(x0 + (x1 - x0) * 0.25, gy - wh - u * 0.25, u * 0.55, 3011),
      pine(x0 + (x1 - x0) * 0.72, gy - wh * 0.6, wh * 1.6, 3012, -1),
      ...blossom(x0 + (x1 - x0) * 0.5, gy - wh - u * 0.1, u * 0.38, 3013),
      s('ellipse', { class: 'gb-shadow', cx: f1((x0 + x1) / 2), cy: f1(gy + 2), rx: f1((x1 - x0) * 0.55), ry: f1(Math.max(3, wh * 0.06)) }),
      s('path', { class: 'gb-plaster', d: wallD, filter: 'url(#ink-rough)' }),
      s('path', { class: 'gb-stone-sh', d: wallD }),
      s('path', { class: 't30g-edge', d: stroke([[x1 - 1, gy - wh + capH * 0.4], [x1, gy - wh * 0.5], [x1, gy]], Math.max(2, wh * 0.03), 0.1, 0.1, 0.3) + stroke([[x0, gy - 2], [(x0 + x1) / 2, gy - 1], [x1, gy - 2]], Math.max(2, wh * 0.03), 0.05, 0.05, 0.4), filter: 'url(#ink-rough)' }),
      s('path', { class: 't30g-stain', d: stains, filter: 'url(#ink-wash)' }),
      s('path', { class: 't30g-plinth', d: `M${P([x0, gy])}L${P([x0, gy - wh * 0.14])}L${P([x1, gy - wh * 0.14])}L${P([x1, gy])}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30g-tiles', d: coping, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30g-tile-edge', d: tiles }),
      s('path', { class: 'gb-rim-hi', d: stroke([[x0 + capH, gy - wh - capH * 0.72], [x1 - capH, gy - wh - capH * 0.78]], Math.max(1, capH * 0.15), 0.2, 0.2, 0.2) }),
      // the window: a lit square in a dark frame; the branch it hands out, one at a time
      s('circle', { cx: f1(winX), cy: f1(winY), r: f1(ws * 1.6), fill: 'url(#p2-lamp)', class: 't30g-glow' }),
      s('circle', { class: 't30g-light', cx: f1(winX), cy: f1(winY), r: f1(ws * 0.5) }),
      s('path', { class: 't30g-frame', d: lattice + stroke(ring, Math.max(2.4, ws * 0.12), 0.02, 0.02, 0.8), filter: 'url(#ink-rough)' }),
      s('g', { class: 't30g-branch' }, s('path', { class: 't30g-limb', d: stroke(twig, Math.max(1.2, ws * 0.05), 0.1, 0.6, 0.2) }), s('path', { class: 't30g-flower', d: buds })),
      paperLantern(winX - ws * 0.95, gy - wh - capH * 0.4, Math.max(5, wh * 0.075), 3014, ws * 0.35))
    // ── the open garden (right): a low bamboo fence, the gate between two posts, its doors swinging wide
    const fx0 = mid + w * 0.03, fx1 = w * 0.97
    const gx = fx0 + (fx1 - fx0) * 0.5, gw = Math.min((fx1 - fx0) * 0.3, wh * 1.0)
    const fh = wh * 0.55
    let posts = '', nodes = ''
    for (let x = fx0; x <= fx1; x += 7 + r() * 4) {
      if (Math.abs(x - gx) < gw / 2 + 6) continue
      const hgt = fh * (0.85 + r() * 0.25)
      posts += stroke([[x, gy + 1], [x + (r() - 0.5) * 1.5, gy - hgt]], Math.max(3, u * 0.05), 0.03, 0.05, 0.6)
      nodes += stroke([[x - 2.2, gy - hgt * 0.55], [x + 2.2, gy - hgt * 0.53]], 1.2, 0.2, 0.2, 0.3)
    }
    const rail = (y: number) => stroke([[fx0 - 4, y + 1], [gx - gw / 2 - 6, y]], 2.2, 0.05, 0.1, 0.3) + stroke([[gx + gw / 2 + 6, y], [fx1 + 4, y + 1]], 2.2, 0.1, 0.05, 0.3)
    const gh = wh * 1.05
    const door = (side: -1 | 1) => {
      const hx = gx + (side * gw) / 2 // the hinge
      const xa = Math.min(hx, gx), xb = Math.max(hx, gx)
      let bars = ''
      for (let i = 0; i < 4; i++) {
        const x = xa + ((xb - xa) * (i + 0.5)) / 4
        bars += stroke([[x, gy - 2], [x, gy - gh * 0.72]], Math.max(2, gw * 0.05), 0.03, 0.05, 0.6)
      }
      bars += stroke([[xa + 2, gy - gh * 0.2], [xb - 2, gy - gh * 0.2]], 1.6, 0.1, 0.1, 0.4) + stroke([[xa + 2, gy - gh * 0.58], [xb - 2, gy - gh * 0.58]], 1.6, 0.1, 0.1, 0.4)
      return s('g', { class: `t30g-door t30g-door-${side < 0 ? 'l' : 'r'}`, style: `transform-origin:${f1(hx)}px ${f1(gy)}px` }, s('path', { class: 't30g-bamboo', d: bars }))
    }
    const pots = [0, 1, 2].map((i) => {
      const t = 0.3 + i * 0.28
      const x = gx + gw * (0.2 + i * 0.5) + (r() - 0.5) * 6, y = gy + (hh - gy) * t
      const k = Math.max(8, u * (0.16 + t * 0.12))
      return s('g', { class: 't30g-pot', style: `--i:${i}` },
        s('ellipse', { class: 'gb-shadow', cx: f1(x + 2), cy: f1(y + 1), rx: f1(k * 0.8), ry: f1(k * 0.18) }),
        s('path', { class: 't30g-clay', d: `M${f1(x - k * 0.55)} ${f1(y - k * 0.75)}h${f1(k * 1.1)}l${f1(-k * 0.16)} ${f1(k * 0.75)}h${f1(-k * 0.78)}Z` }),
        s('path', { class: 't30g-limb', d: stroke([[x, y - k * 0.75], [x + k * 0.05, y - k * 1.7]], Math.max(1.2, k * 0.08), 0.05, 0.6, 0.3) }),
        s('path', { class: 't30g-leafy', d: blob(x + k * 0.05, y - k * 1.9, k * 0.55, k * 0.45, 3030 + i, 0.3, 10) }))
    })
    const open = s('g', { class: 't30g-openg' },
      pine(fx0 + (fx1 - fx0) * 0.2, gy - fh * 0.4, wh * 1.5, 3015, 1),
      ...blossom(fx0 + (fx1 - fx0) * 0.82, gy - fh - u * 0.15, u * 0.5, 3016),
      ...blossom(gx + gw * 0.05, gy - fh * 1.1, u * 0.32, 3017),
      steppingStones([gx - gw * 0.1, gy - fh * 0.12], [gx, gy - 2], 2, Math.max(8, gw * 0.18), 3031),
      s('ellipse', { class: 'gb-shadow', cx: f1((fx0 + fx1) / 2), cy: f1(gy + 2), rx: f1((fx1 - fx0) * 0.55), ry: f1(Math.max(3, wh * 0.06)) }),
      s('path', { class: 't30g-bamboo', d: posts, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30g-node', d: nodes }),
      s('path', { class: 't30g-bamboo', d: rail(gy - fh * 0.3) + rail(gy - fh * 0.75), filter: 'url(#ink-rough)' }),
      steppingStones([gx, gy + (hh - gy) * 0.1], [gx + gw * 0.5, hh * 0.98], 4, Math.max(14, gw * 0.3), 3018),
      bamboo([gx - gw / 2 - 3, gy + 1], [gx - gw / 2 - 3, gy - gh], Math.max(4, u * 0.08), 3019, false),
      bamboo([gx + gw / 2 + 3, gy + 1], [gx + gw / 2 + 3, gy - gh], Math.max(4, u * 0.08), 3020, false),
      bamboo([gx - gw / 2 - gw * 0.25, gy - gh + 2], [gx + gw / 2 + gw * 0.25, gy - gh - 1], Math.max(4, u * 0.07), 3021, true),
      door(-1), door(1),
      paperLantern(gx - gw / 2 - gw * 0.1, gy - gh + 2, Math.max(5, wh * 0.075), 3022, gh * 0.12),
      paperLantern(gx + gw / 2 + gw * 0.1, gy - gh + 2, Math.max(5, wh * 0.075), 3023, gh * 0.12),
      ...pots)
    const mr = Math.max(12, Math.min(u * 0.22, 26))
    svg.replaceChildren(
      mist(mid, hh * 0.2, w * 0.6, hh * 0.25),
      moon(mid, Math.max(mr * 1.8, hh * 0.1), mr, 3024, true),
      hills(-w * 0.05, w * 1.05, gy - wh * 1.1, Math.min(hh * 0.22, gy - wh * 1.1 - hh * 0.16), 3025, 0.88, 6),
      mist(mid, gy - wh * 1.05, w * 0.6, hh * 0.05),
      wash(blob(mid, gy + (hh - gy) * 0.3, w * 0.46, (hh - gy) * 0.32, 3026, 0.12), 0.05),
      // the line between the two gardens: a mossy stone and some grass
      grass(mid, gy + 2, Math.max(12, u * 0.3), 3027),
      walled, open)
  }
}
