import content from '../../content/tram-09.json'
import type { Fact } from '../../core/content'
import { fill, h, nextId, s, viDate } from '../../core/dom'
import { gsap } from '../../core/anim'
import { company, type Model } from '../../ui/logo'
import type { SceneCtx } from '../types'
import { rng } from './koi'
import { layoutOf } from './shared'

const C = content.scenes.models

type Pt = [number, number]
type L = 'wide' | 'tall' | 'short'
/**
 * Where each group's stones sit, in cells (≈ one stone width / height) around the group's centre, and where the
 * group centres sit in the garden (fractions of its box). Group 0 = online services, group 1 = open source.
 * Never in a line: every stone has its own height.
 */
const PLAN: Record<L, { at: Pt[]; g: Pt[][] }> = {
  wide: {
    at: [[0.35, 0.52], [0.8, 0.5]],
    g: [[[-1.12, 0.12], [-0.12, -0.42], [0.02, 0.58], [1.02, 0.02]], [[-0.5, -0.28], [0.48, 0.36]]],
  },
  tall: {
    at: [[0.5, 0.3], [0.5, 0.83]],
    g: [[[-0.52, -0.46], [0.5, -0.56], [-0.48, 0.52], [0.54, 0.42]], [[-0.52, -0.06], [0.52, 0.1]]],
  },
  short: {
    at: [[0.36, 0.5], [0.84, 0.5]],
    g: [[[-0.5, -0.5], [0.52, -0.42], [-0.44, 0.52], [0.56, 0.6]], [[-0.04, -0.5], [0.08, 0.52]]],
  },
}
const TALLNESS = [0.5, 0.42, 0.46, 0.54, 0.44, 0.5]

const f1 = (n: number) => Math.round(n * 10) / 10
const path = (pts: Pt[]) => {
  // closed Catmull-Rom → cubic Béziers
  const n = pts.length
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`
  }
  return d + 'Z'
}
const ell = (cx: number, cy: number, rx: number, ry: number) => `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0Z`

/** A garden stone seen from a little above: a domed silhouette with a flat-ish foot. Base centre at 0,0. */
function pebble(seed: number, w: number, hgt: number) {
  const r = rng(seed)
  const ph = [r() * 6, r() * 6]
  const pts: Pt[] = []
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const k = 1 + 0.06 * Math.sin(2 * a + ph[0]) + 0.035 * Math.sin(3 * a + ph[1])
    let x = Math.cos(a) * (w / 2) * k
    let y = -hgt / 2 + Math.sin(a) * (hgt / 2) * k
    if (y > -hgt * 0.06) y = -hgt * 0.06 + (y + hgt * 0.06) * 0.25 // flatten the foot
    x *= y < -hgt * 0.75 ? 0.94 : 1
    pts.push([x, y])
  }
  return { d: path(pts), pts }
}

/** Scene 4 — six notable 3D models as stones in two raked sets (online services · open source); touch one to read it. */
export function modelsScene(ctx: SceneCtx) {
  const items = C.items.map((it) => {
    const co = company(it.company)
    const m = co?.models.find((x) => x.name === it.model) as Model | undefined
    return { ...it, maker: co?.name ?? it.company, m, open: !!m?.openWeights }
  })
  // groups straight from the data: what you use online, and what you can download and run yourself
  const groups = [items.flatMap((it, i) => (it.open ? [] : [i])), items.flatMap((it, i) => (it.open ? [i] : []))]
  const root = h('div', { class: 't9 t9m' })
  const sand = s('svg', { class: 't9m-sand', 'aria-hidden': 'true' })
  const card = h('div', { class: 't9m-card', 'aria-live': 'polite' })
  const btns = items.map((it, i) => h('button', { class: 't9m-stone', type: 'button', 'aria-pressed': 'false', onClick: () => pick(i) },
    h('span', { class: 't9m-name' }, it.model)))
  const gLabels = C.groups.map((t) => h('p', { class: 't9m-glabel', id: nextId('t9m-g') }, t))
  const sets = groups.map((gi, k) => h('div', { class: 't9m-set', role: 'group', 'aria-labelledby': gLabels[k].id }, ...gi.map((i) => btns[i])))
  const stones = h('div', { class: 't9m-stones', role: 'group', 'aria-label': C.group }, ...sets, ...gLabels)
  root.append(sand, card, stones)
  ctx.art.append(root)
  ctx.prompt(C.prompt)

  const seen = new Set<number>()
  let sel = -1
  let parts: { g: SVGGElement; rip: SVGGElement; x: number; y: number; w: number }[] = []
  const uid = nextId('t9m')

  function layout() {
    const W = root.clientWidth, H = root.clientHeight
    if (!W || !H) return
    const lay = layoutOf(root) as L
    root.dataset.layout = lay
    const side = lay === 'short'
    // the card: above the garden, or beside it on a cramped landscape
    const gx0 = side ? Math.min(W * 0.42, 300) : 0
    const top = side ? 4 : lay === 'tall' ? Math.min(Math.max(H * 0.36, 150), 210) : Math.min(Math.max(H * 0.34, 150), 210)
    const cw = side ? gx0 - 16 : Math.min(lay === 'tall' ? W : 560, W - 8)
    Object.assign(card.style, { left: side ? '0px' : `${(W - cw) / 2}px`, width: `${cw}px`, maxHeight: `${side ? H : top - 8}px` })

    // stones sized to their names
    type Q = { x: number; y: number; w: number; h: number }
    type Ring = { cx: number; cy: number; rx: number; ry: number; n: number }
    const ringsOf = (S: Q[]): Ring[] => groups.map((gi) => {
      const xs = gi.map((i) => S[i].x), ys = gi.map((i) => S[i].y - S[i].h * 0.42)
      const cx = (Math.min(...gi.map((i) => S[i].x - S[i].w / 2)) + Math.max(...gi.map((i) => S[i].x + S[i].w / 2))) / 2
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2
      const rx = (Math.max(...xs) - Math.min(...xs)) / 2 + Math.max(...gi.map((i) => S[i].w)) * 0.64
      const ry = Math.max((Math.max(...ys) - Math.min(...ys)) / 2 + Math.max(...gi.map((i) => S[i].h)) * (tight ? 0.72 : 0.95), rx * 0.32)
      return { cx, cy, rx, ry, n: tight ? 2 : 3 }
    })
    const labH = 22
    const tight = lay === 'tall'
    root.style.setProperty('--k', '1')
    const pad = 10
    const box = { x: gx0 + pad, y: top + (side ? 4 : 10), w: W - gx0 - pad * 2, h: H - top - (side ? 4 : 10) - pad }
    let k = 1
    let S: Q[] = []
    let gap = 8
    for (let pass = 0; pass < 5; pass++) {
      root.style.setProperty('--k', k.toFixed(3))
      gap = Math.max(5, 8 * k)
      const lw = btns.map((b) => (b.firstElementChild as HTMLElement).offsetWidth)
      const sw = lw.map((w) => w + 46 * k)
      const sh = sw.map((w, i) => Math.max(44 * k, Math.min(w * TALLNESS[i], 92 * k)))
      const cellW = Math.max(...sw) + 14 * k, cellH = Math.max(...sh) + (tight ? 18 : 30) * k
      const P = PLAN[lay]
      S = items.map(() => ({ x: 0, y: 0, w: 0, h: 0 }))
      groups.forEach((gi, g) => gi.forEach((i, j) => {
        const [dx, dy] = P.g[g][j]
        S[i] = { x: P.at[g][0] * box.w + dx * cellW, y: P.at[g][1] * box.h + dy * cellH, w: sw[i], h: sh[i] }
      }))
      const outerY = (r: Ring) => r.ry + r.n * gap * 0.55
      if (lay === 'tall') {
        // portrait: the two sets stack, each under its own name
        const r = ringsOf(S)
        const dy = r[0].cy + outerY(r[0]) + labH + 6 + outerY(r[1]) - r[1].cy
        groups[1].forEach((i) => (S[i].y += dy))
      }
      // fit the whole composition into the garden box: stones across, rings and their names top to bottom
      const R = ringsOf(S)
      const x0 = Math.min(...S.map((q) => q.x - q.w / 2)), x1 = Math.max(...S.map((q) => q.x + q.w / 2))
      const y0 = side ? Math.min(...S.map((q) => q.y - q.h)) - labH : Math.min(...R.map((r) => r.cy - outerY(r))) - labH
      const y1 = side ? Math.max(...S.map((q) => q.y + 8)) : Math.max(...R.map((r) => r.cy + outerY(r)))
      // grow into a roomy garden, shrink into a small one (names shrink with their stones)
      const fit = Math.min(box.w / (x1 - x0), box.h / (y1 - y0))
      const want = Math.max(0.62, Math.min(1.32, k * fit * (pass ? 0.99 : 0.94)))
      if (pass < 4 && ((fit < 0.985 && want < k) || (pass === 0 && want > k * 1.04))) {
        k = want
        continue
      }
      // centre each axis inside the box, then keep every stone inside the art
      const ox = box.x + (box.w - (x1 - x0)) / 2 - x0
      const oy = box.y + Math.max(0, (box.h - (y1 - y0)) / 2) - y0
      S.forEach((q) => {
        q.x = Math.min(W - pad - q.w / 2, Math.max(pad + q.w / 2, q.x + ox))
        q.y += oy
      })
      break
    }

    sand.setAttribute('viewBox', `0 0 ${W} ${H}`)
    sand.replaceChildren()
    const fadeTop = top - (side ? 0 : 10)
    const defs = s('defs', null,
      s('linearGradient', { id: `${uid}-st`, x1: 0, y1: 0, x2: 0.25, y2: 1 }, s('stop', { offset: 0, class: 's0' }), s('stop', { offset: 1, class: 's1' })),
      s('linearGradient', { id: `${uid}-fade`, x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: Math.max(0, fadeTop / H), 'stop-color': '#fff', 'stop-opacity': 0 }),
        s('stop', { offset: Math.min(0.99, (fadeTop + Math.min(90, H * 0.16)) / H), 'stop-color': '#fff', 'stop-opacity': 1 })))
    sand.append(defs)
    // a set of raked rings round each group; the outer rings stop before they reach the other set
    const rings = ringsOf(S)
    const hit = (a: (typeof rings)[0], b: (typeof rings)[0]) => {
      // ellipses (with their outer ring) overlap? test along the line between centres
      const dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.hypot(dx, dy) || 1
      const ra = 1 / Math.hypot(dx / d / (a.rx + a.n * gap), dy / d / (a.ry + a.n * gap * 0.55))
      const rb = 1 / Math.hypot(dx / d / (b.rx + b.n * gap), dy / d / (b.ry + b.n * gap * 0.55))
      return ra + rb > d - 6
    }
    for (let t = 0; t < 6 && hit(rings[0], rings[1]); t++) {
      if (rings[0].n > 1) rings[0].n--
      if (rings[1].n > 1) rings[1].n--
      if (rings[0].n === 1 && rings[1].n === 1) {
        rings.forEach((r) => ((r.rx *= 0.94), (r.ry *= 0.94)))
      }
    }
    const mask = s('mask', { id: `${uid}-mask`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      s('rect', { x: 0, y: 0, width: W, height: H, fill: `url(#${uid}-fade)` }),
      ...rings.map((r) => s('path', { d: ell(r.cx, r.cy, r.rx + r.n * gap + gap * 0.6, r.ry + (r.n * gap + gap * 0.6) * 0.55), fill: '#000' })))
    const fadeOnly = s('mask', { id: `${uid}-fo`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, s('rect', { x: 0, y: 0, width: W, height: H, fill: `url(#${uid}-fade)` }))
    defs.append(mask, fadeOnly)
    const rk = s('g', { mask: `url(#${uid}-mask)` })
    for (let y = fadeTop, j = 0; y < H + 10; j++) {
      const pts: string[] = []
      for (let x = -10; x <= W + 24; x += 24) pts.push(`${x} ${(y + 1.2 * Math.sin(x / 47 + j * 0.6)).toFixed(1)}`)
      const d = `M${pts.join('L')}`
      rk.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.5)' }))
      y += 7 + 9 * ((y - fadeTop) / Math.max(1, H - fadeTop))
    }
    sand.append(rk)
    const ringG = s('g', { mask: `url(#${uid}-fo)` })
    for (const r of rings)
      for (let j = 0; j <= r.n; j++) {
        const d = ell(r.cx, r.cy, r.rx + j * gap, r.ry + j * gap * 0.55)
        ringG.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.5)' }))
      }
    sand.append(ringG)
    // each set's name: a small ink label just above its outer ring
    rings.forEach((r, g) => {
      const el = gLabels[g]
      const y = Math.max(2, r.cy - (r.ry + r.n * gap * 0.55) - labH + 2)
      Object.assign(el.style, { left: `${Math.max(4, Math.min(W - el.offsetWidth - 4, r.cx - el.offsetWidth / 2))}px`, top: `${y}px` })
    })

    // stones, far ones first
    const built = S.map((q, i) => {
      const { d, pts } = pebble(40 + i * 7, q.w, q.h)
      const sh = s('path', { class: 'sh', d: ell(q.x + q.w * 0.06, q.y + 1, q.w * 0.56, Math.max(4, q.w * 0.1)), filter: 'url(#ink-wash)' })
      const rip = s('g', { class: 'rip' })
      const upper = pts.filter(([x, y]) => y < -q.h * 0.35 && x < q.w * 0.3)
      const lower = pts.filter(([x, y]) => y > -q.h * 0.6 || x > q.w * 0.28)
      const open = (ps: Pt[]) => (ps.length > 1 ? `M${ps.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}` : '')
      const rr = rng(90 + i)
      const g = s('g', { class: 't9m-body' },
        s('path', { d, fill: `url(#${uid}-st)`, filter: 'url(#ink-rough)' }),
        s('path', { class: 'shade', d: path([...lower.map(([x, y]) => [x, y] as Pt), [q.w * 0.05, -q.h * 0.35]]), filter: 'url(#ink-wash)' }),
        s('path', { class: 'edge', d, filter: 'url(#ink-rough)' }),
        s('path', { class: 'rim', d: open(upper) }),
        s('g', { class: 'dry', filter: 'url(#ink-dry)' }, ...[0, 1].map((j) => {
          const x0 = -q.w * (0.3 - j * 0.42) + rr() * 6, y0 = -q.h * (0.78 + rr() * 0.1)
          return s('path', { d: `M${f1(x0)} ${f1(y0)} Q ${f1(x0 + q.w * 0.1)} ${f1(y0 - 3)} ${f1(x0 + q.w * 0.18)} ${f1(y0 + q.h * 0.08)}`, 'stroke-width': f1(2.5 + j * 1.5) })
        })),
        i === groups[0][0] || i === groups[1][1] ? s('path', { class: 'moss', d: ell(-q.w * 0.18, -q.h * 0.93, q.w * 0.11, q.h * 0.07), filter: 'url(#ink-rough)' }) : null)
      const pos = s('g', { transform: `translate(${f1(q.x)} ${f1(q.y)})` }, g)
      if (i === sel) gsap.set(g, { y: -8 })
      Object.assign(btns[i].style, { left: `${q.x - q.w / 2}px`, top: `${q.y - q.h - 4}px`, width: `${q.w}px`, height: `${q.h + 10}px` })
      return { y: q.y, layers: [rip, sh, pos], part: { g, rip, x: q.x, y: q.y, w: q.w } }
    })
    ;[...built].sort((a, b) => a.y - b.y).forEach((b) => sand.append(...b.layers))
    parts = built.map((b) => b.part)
  }

  const factOf = (m: Model, text: string): Fact => ({ text, asOf: m.asOf, source: m.source, verify: m.verify })
  function pick(i: number) {
    if (i === sel) return
    const prev = sel
    sel = i
    const it = items[i]
    btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    if (prev < 0) root.classList.add('named')
    ctx.anim(() => {
      if (prev >= 0) {
        const q = parts[prev]
        if (ctx.reduced) gsap.set(q.g, { y: 0 })
        else gsap.to(q.g, { y: 0, duration: 0.7, ease: 'power2.in' })
      }
      const p = parts[i]
      if (ctx.reduced) gsap.set(p.g, { y: -8 })
      else {
        gsap.to(p.g, { y: -8, duration: 0.9, ease: 'power3.out' })
        p.rip.replaceChildren()
        const rs = [0, 1, 2].map(() => s('path', { d: ell(p.x, p.y, p.w * 0.56, p.w * 0.13) }))
        p.rip.append(...rs)
        rs.forEach((el, k) =>
          gsap.fromTo(el, { scale: 1, opacity: 0.7, svgOrigin: `${p.x} ${p.y}` }, { scale: 2.2, opacity: 0, duration: 2.2, delay: k * 0.35, ease: 'power2.out' }))
      }
      const m = it.m
      const kids: HTMLElement[] = [h('h3', { class: 't9m-title' }, it.model), h('p', { class: 't9m-maker' }, it.maker)]
      if (m?.date) kids.push(ctx.fact(factOf(m, fill(C.released, { date: viDate(m.date) })), 'p', 't9m-date'))
      if (m?.strengths) kids.push(ctx.fact(m.strengths, 'p', 't9m-str'))
      if (m?.note) kids.push(ctx.fact(factOf(m, m.note), 'p', 't9m-note'))
      card.replaceChildren(...kids)
      if (!ctx.reduced) gsap.fromTo(card.children, { opacity: 0, y: 10, filter: 'blur(5px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, stagger: 0.1, ease: 'power3.out', clearProps: 'filter' })
    })
    if (!seen.has(i)) {
      seen.add(i)
      btns[i].classList.add('seen')
    }
    ctx.chime('soft')
    if (seen.size === 3) ctx.insight(C.insight, C.detail)
  }

  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  layout()
  // web fonts can land after the first layout: stones are sized to their names, so measure again
  document.fonts?.ready.then(() => root.isConnected && layout())
  return () => {
    ro.disconnect()
    cancelAnimationFrame(raf)
    root.remove()
  }
}
