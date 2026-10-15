import { fill, h, s } from '../core/dom'
import { ALL_STATIONS, L, PARTS, SITE, displayNo, gardensOfPart, stationsOfPart } from '../core/content'
import { STATIONS } from '../stations/registry'
import { progress } from '../core/progress'
import { cssVar, onPrefs, prefs } from '../core/prefs'
import { gsap } from '../core/anim'
import { createLoop } from '../core/loop'
import { lightNet, prefetchStation, prefetchThree, whenIdle } from './prefetch'
import { icon } from './icons'
import { bridgeLink, drawGlint, drawNight, firefly, lantern, lanternGlow, type Night } from './moon-garden'

type Pt = { x: number; y: number }
type Rock = Pt & { r: number; seed: number; sq?: number } // sq: vertical squash of its footprint (the pond is flatter)

// Garden anchors in the free area (0..1). Landscape: the path snakes left→right; portrait: zig-zags down.
const LAND: Pt[] = [{ x: 0.1, y: 0.7 }, { x: 0.27, y: 0.3 }, { x: 0.45, y: 0.7 }, { x: 0.62, y: 0.29 }, { x: 0.77, y: 0.7 }, { x: 0.91, y: 0.32 }]
const PORT: Pt[] = [{ x: 0.3, y: 0.08 }, { x: 0.7, y: 0.25 }, { x: 0.3, y: 0.42 }, { x: 0.7, y: 0.59 }, { x: 0.3, y: 0.76 }, { x: 0.7, y: 0.93 }]
// Part 2 (Vườn Trăng): 7 gardens walk round a moon pond, moonrise (7) → dawn (13). k: the side of the path the
// garden's rocks take (toward that direction), so no rock lands in the water or under the moon.
type A2 = Pt & { k: [number, number] }
const LAND2: A2[] = [
  { x: 0.1, y: 0.2, k: [1, 0] }, { x: 0.14, y: 0.58, k: [-1, 0] }, { x: 0.31, y: 0.86, k: [-1, 1] }, { x: 0.5, y: 0.95, k: [0, -1] },
  { x: 0.69, y: 0.86, k: [1, 1] }, { x: 0.86, y: 0.58, k: [1, 0] }, { x: 0.9, y: 0.2, k: [-1, 0] },
]
const PORT2: A2[] = [
  { x: 0.42, y: 0.05, k: [-0.4, 1] }, { x: 0.76, y: 0.2, k: [1, 0] }, { x: 0.27, y: 0.35, k: [-1, 0] }, { x: 0.25, y: 0.59, k: [-1, 0] },
  { x: 0.73, y: 0.72, k: [1, 0] }, { x: 0.27, y: 0.85, k: [-1, 0] }, { x: 0.72, y: 0.97, k: [1, 0] },
]
// pond and moon centres in the free area (0..1); r as a share of min(w, h)
const NIGHT_LAND = { pond: { x: 0.48, y: 0.43, r: 0.15 }, moon: { x: 0.55, y: 0.02, r: 0.036 } }
const NIGHT_PORT = { pond: { x: 0.64, y: 0.46, r: 0.15 }, moon: { x: 0.74, y: 0.0, r: 0.05 } }
const POND_SQ = 1.45

/** A map = a full-viewport zen garden. Rocks are the part's gardens; stepping stones are its stations. */
export function renderMap(root: HTMLElement, { part, withIntro }: { part: number; withIntro: boolean }): () => void {
  const STS = stationsOfPart(part)
  const GS = gardensOfPart(part)
  const sand = h('canvas', { class: 'garden-sand', 'aria-hidden': 'true' })
  const ripple = h('canvas', { class: 'garden-ripple', 'aria-hidden': 'true' })
  const rocksSvg = s('svg', { class: 'garden-rocks', 'aria-hidden': 'true' })
  const labels = h('div', { class: 'garden-labels', 'aria-hidden': 'true' })
  const tip = h('div', { class: 'ptip', role: 'tooltip', id: 'ptip', hidden: true })
  // Vườn Trăng: water + moon under the rocks, lantern light on the sand, fireflies (rich only); both maps get a bridge
  const night = part === 2 ? s('svg', { class: 'garden-night', 'aria-hidden': 'true' }) : null
  const glint = part === 2 ? s('svg', { class: 'pond-glint', 'aria-hidden': 'true' }) : null
  const glows = part === 2 ? h('div', { class: 'garden-glow', 'aria-hidden': 'true' }) : null
  const flies = part === 2 && prefs.quality === 'high' && !prefs.reduced ? h('div', { class: 'fireflies', 'aria-hidden': 'true' }) : null
  const bridge = bridgeLink(part === 1 ? 2 : 1)
  const kindLabel = { concept: L.kindConcept, news: L.kindNews, practice: L.kindPractice }
  const nextId = STS.find((st) => st.id in STATIONS && !progress.isVisited(st.id))?.id
  const stones = STS.map((st, i) => {
    const built = st.id in STATIONS
    const visited = progress.isVisited(st.id)
    const passed = progress.isPassed(st.id)
    const state = [st.kind ? kindLabel[st.kind] : '', built ? '' : L.soon, passed ? L.passed : visited ? L.visited : ''].filter(Boolean).join(', ')
    const [no, sub] = displayNo(st.id).split('·') // 'II·01' → a small 'II·' and the number
    return h('a', {
      class: 'pstone',
      href: `#/tram/${st.id}`,
      'data-built': built,
      'data-visited': visited,
      'data-passed': passed,
      'data-here': st.id === nextId,
      'data-garden': st.garden.id,
      'aria-label': `${L.station} ${part === 1 ? st.id : displayNo(st.id)}: ${st.title}${state ? ` — ${state}` : ''}`, // Part 1 aria unchanged
      'aria-describedby': 'ptip',
      style: `--i:${i}`, // appear stagger
    }, h('span', { class: 'pstone-num' }, ...(sub ? [h('small', null, `${no}·`), sub] : [no])), st.kind ? kindMark(st.kind) : null)
  })
  const list = h('nav', { class: 'garden-stones', 'aria-label': part === 1 ? SITE.hero.tagline : PARTS[1].tagline }, ...stones)
  const note = h('p', { class: 'garden-note' }, SITE.footer.note, ' · ', h('a', { href: '#/logos' }, SITE.footer.logos))
  const hint = progress.visitedCount() ? null : h('p', { class: 'garden-hint' }, L.mapHint)
  const glossary = h('a', { class: 'gx', href: '#/tu-dien', title: L.glossaryHint }, icon('lantern'), h('span', null, L.glossary))
  // shortcut: Part 2 has only the glossary until its exam (#/bai-thi-trang) and toolkit (#/do-nghe) exist
  const extras = part === 1
    ? h('nav', { class: 'garden-extras', 'aria-label': `${L.glossary} · ${L.exam}` },
        glossary, h('a', { class: 'gx', href: '#/bai-thi', title: L.examHint }, icon('gate'), h('span', null, L.exam)))
    : h('nav', { class: 'garden-extras', 'aria-label': L.glossary }, glossary)
  // the bridge sits where the walk leaves (Part 1, after the last stone) or arrives (Part 2, before the first)
  const garden = h('section', { class: 'garden', 'aria-label': L.map },
    sand, night, glint, glows, ripple, rocksSvg, flies, labels, part === 2 && bridge, list, part === 1 && bridge, tip, note, hint, extras)
  root.append(garden)

  let w = 0
  let hgt = 0
  let sandH = 0 // canvas height in CSS px (garden height + 15%)
  let rocks: Rock[] = []
  // design tokens read once (and again when prefs change) — never inside a frame
  const col = { rake: '', rakeHi: '', ink: '' }
  const readColours = () => {
    col.rake = cssVar('--rake')
    col.rakeHi = cssVar('--rake-hi')
    col.ink = cssVar('--ink')
  }
  readColours()
  const dpr = () => Math.min(devicePixelRatio, prefs.quality === 'high' ? 2 : 1)

  function layout() {
    const r = garden.getBoundingClientRect()
    w = Math.round(r.width)
    hgt = Math.round(r.height)
    if (!w || !hgt) return
    const portrait = hgt > w * 1.05
    garden.toggleAttribute('data-portrait', portrait)
    const top = 80
    const bottom = portrait ? 104 : 84
    const side = portrait ? 18 : Math.max(40, w * 0.03)
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
    const rnd = (k: number) => {
      const x = Math.sin(k * 127.1 + 311.7) * 43758.5453
      return x - Math.floor(x)
    }
    const A2 = part === 2 ? (portrait ? PORT2 : LAND2) : null
    const fx = (v: number) => side + v * (w - 2 * side), fy = (v: number) => top + v * (hgt - top - bottom)
    const anchors = (A2 ?? (portrait ? PORT : LAND)).map((p) => ({ x: fx(p.x), y: fy(p.y) }))
    const first = anchors[0], last = anchors[anchors.length - 1], beforeLast = anchors[anchors.length - 2]
    const P = [
      { x: first.x - (anchors[1].x - first.x) * 0.7, y: first.y - (anchors[1].y - first.y) * 0.7 },
      ...anchors,
      { x: last.x + (last.x - beforeLast.x) * 0.7, y: last.y + (last.y - beforeLast.y) * 0.7 },
    ]
    const at = (T: number): Pt => {
      const j = Math.max(0, Math.min(P.length - 2, Math.floor(T)))
      const t = T - j
      const p0 = P[Math.max(0, j - 1)], p1 = P[j], p2 = P[j + 1], p3 = P[Math.min(P.length - 1, j + 2)]
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
      return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) }
    }
    const m = Math.min(w, hgt)
    const S = Math.round(clamp(m * 0.058, 34, 54))
    const R = clamp(m * (portrait ? 0.05 : part === 2 ? 0.06 : 0.07), 20, 78) // Part 2 shares the sand with a pond
    const NG = part === 2 ? (portrait ? NIGHT_PORT : NIGHT_LAND) : null
    const pondR = NG ? NG.pond.r * m : 0 // as an obstacle: the sand's rings start at 1.12 × this
    const nightAt: Night | null = NG && {
      pond: { x: fx(NG.pond.x), y: fy(NG.pond.y), rx: pondR * 1.12, ry: (pondR * 1.12) / POND_SQ },
      moon: { x: fx(NG.moon.x), y: fy(NG.moon.y), r: Math.max(15, NG.moon.r * m) },
      w, h: hgt, portrait,
    }
    const lampSpots: { g: number; cands: Pt[] }[] = []
    // arc-length table so stepping stones keep an even pixel gap whatever the curve does
    const STEP = 0.004
    const Ts: number[] = []
    const Ls: number[] = []
    let acc = 0
    let prev = at(0)
    for (let T = 0; T <= P.length - 1 + 1e-9; T += STEP) {
      const p = at(T)
      acc += Math.hypot(p.x - prev.x, p.y - prev.y)
      prev = p
      Ts.push(T)
      Ls.push(acc)
    }
    const lenAt = (T: number) => Ls[Math.min(Ls.length - 1, Math.round(T / STEP))]
    const tAtLen = (Lq: number) => {
      let lo = 0, hi = Ls.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (Ls[mid] < Lq) lo = mid + 1
        else hi = mid
      }
      return Ts[lo]
    }

    const pending: { lab: HTMLElement; half: number; vh: number; cands: Pt[]; home: Pt }[] = []
    const placed: Pt[] = []
    rocks = []
    let ri = 0
    rocksSvg.replaceChildren()
    rocksSvg.setAttribute('viewBox', `0 0 ${w} ${hgt}`)
    rocksSvg.style.width = `${w}px`
    rocksSvg.style.height = `${hgt}px`
    labels.replaceChildren()
    // the garden names and the bridge label are measured in ONE read, before the loop below writes rocks and stones:
    // reading a size between writes forces a layout per garden (≈ 20 ms at 4× CPU)
    const labs = GS.map((g, gi) => h('p', { class: 'glabel', 'data-garden': g.id, style: `--i:${gi}` }, h('span', { class: 'glabel-num' }, String(g.id)), h('span', null, g.name)))
    labels.append(...labs)
    const labSize = labs.map((l) => [l.offsetWidth, l.offsetHeight])
    const bridgeHalf = (bridge.lastElementChild as HTMLElement).offsetWidth / 2
    GS.forEach((g, gi) => {
      const T = gi + 1
      const c = at(T)
      const a = at(T - 0.02), b = at(T + 0.02)
      let nx = -(b.y - a.y), ny = b.x - a.x
      const len = Math.hypot(nx, ny) || 1
      nx /= len
      ny /= len
      const sideK = A2 ? Math.sign(nx * A2[gi].k[0] + ny * A2[gi].k[1]) || 1 : portrait ? (c.x < w / 2 ? -1 : 1) * Math.sign(nx || 1) : gi % 2 ? 1 : -1
      const off = R * (portrait ? 2.6 : 2.3)
      const rc = {
        x: clamp(c.x + nx * off * sideK, R * 2.5, w - R * 2.6),
        y: clamp(c.y + ny * off * sideK, top + R, hgt - bottom - R * 1.2),
      }
      // a main rock with one or two companions, set like a real garden group (never in a row)
      const cluster: Rock[] = [
        { x: rc.x, y: rc.y, r: R, seed: g.id * 1.7 },
        { x: rc.x + R * 1.3 * Math.cos(g.id * 2.1), y: rc.y + R * 0.55 * Math.sin(g.id * 2.1) + R * 0.35, r: R * 0.46, seed: g.id * 3.1 },
      ]
      if (g.stations.length > 2) cluster.push({ x: rc.x - R * 1.15, y: rc.y + R * 0.5, r: R * 0.3, seed: g.id * 5.3 })
      cluster.forEach((rk, i) => {
        drawRock(rocksSvg, rk, g.id, i === 0)
        ;(rocksSvg.lastElementChild as SVGGElement).style.setProperty('--i', String(ri++)) // appear stagger
      })
      rocks.push(...cluster)
      if (A2) {
        // where this group's stone lantern could stand: either side along the path, or behind the rocks
        const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1
        const tx = (b.x - a.x) / tl, ty = (b.y - a.y) / tl
        lampSpots.push({ g: g.id, cands: [
          { x: rc.x + tx * R * 1.9, y: rc.y + ty * R * 1.9 + R * 0.45 },
          { x: rc.x - tx * R * 1.9, y: rc.y - ty * R * 1.9 + R * 0.45 },
          { x: rc.x + nx * sideK * R * 1.5 + tx * R * 0.9, y: rc.y + ny * sideK * R * 1.5 + ty * R * 0.9 },
          { x: rc.x + nx * sideK * R * 1.5 - tx * R * 0.9, y: rc.y + ny * sideK * R * 1.5 - ty * R * 0.9 },
        ] })
      }

      const lab = labs[gi]
      const half = labSize[gi][0] / 2 + 10
      const vh = part === 2 ? labSize[gi][1] / 2 + 3 : 13 // Part 2 names may wrap to two lines on a phone
      const cands = [
        { x: rc.x + nx * R * 1.75 * sideK, y: rc.y + ny * R * 1.75 * sideK },
        { x: rc.x, y: rc.y - R * 1.5 },
        { x: rc.x, y: rc.y + R * 1.4 },
        { x: rc.x + (rc.x < w / 2 ? 1 : -1) * (R * 1.5 + half), y: rc.y },
        ...(portrait
          ? [
              { x: rc.x < w / 2 ? half + 4 : w - half - 4, y: rc.y + R * 1.45 },
              { x: rc.x < w / 2 ? half + 4 : w - half - 4, y: rc.y - R * 1.55 },
            ]
          : []),
      ].map((p) => ({ x: clamp(p.x, half, w - half), y: clamp(p.y, top, hgt - bottom - 10) }))
      pending.push({ lab, half, vh, cands, home: rc })

      // stepping stones: follow the path but alternate sides, vary gap, size and turn — a hand-set walk
      const n = g.stations.length
      let sOff = -((n - 1) / 2) * S * 1.3
      g.stations.forEach((st, k) => {
        const tk = tAtLen(lenAt(T) + sOff)
        sOff += S * (1.18 + rnd(st.id * 3.3) * 0.24)
        const p = at(tk)
        const q = at(tk + 0.01)
        const tl = Math.hypot(q.x - p.x, q.y - p.y) || 1
        const pn = { x: -(q.y - p.y) / tl, y: (q.x - p.x) / tl }
        const zig = (k % 2 ? 1 : -1) * S * (0.26 + rnd(st.id) * 0.16)
        const x = p.x + pn.x * zig
        const y = p.y + pn.y * zig
        const el = stones[STS.findIndex((x2) => x2.id === st.id)]
        el.style.left = `${x}px`
        el.style.top = `${y}px`
        placed.push({ x, y })
        el.style.setProperty('--S', `${(S * (0.9 + rnd(st.id + 7) * 0.2)).toFixed(1)}px`)
        el.style.setProperty('--rot', `${((Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI + (rnd(st.id + 3) - 0.5) * 40).toFixed(1)}deg`)
      })
    })
    if (nightAt) rocks.push({ x: nightAt.pond.x, y: nightAt.pond.y, r: pondR, seed: 0, sq: POND_SQ })
    // stepping stones never sit on a rock: nudge any overlapping stone out along the line from the rock's centre
    stones.forEach((el, i) => {
      let x = parseFloat(el.style.left), y = parseFloat(el.style.top)
      for (let pass = 0; pass < 3; pass++)
        for (const rk of rocks) {
          const dx = x - rk.x, dy = (y - rk.y) * (rk.sq ?? 1.25)
          const dd = Math.hypot(dx, dy) || 1
          const min = rk.r * 1.4 + S * 0.6
          if (dd < min) {
            x += (dx / dd) * (min - dd)
            y += ((dy / dd) * (min - dd)) / (rk.sq ?? 1.25)
          }
        }
      x = clamp(x, S * 0.6, w - S * 0.6)
      y = clamp(y, top, hgt - bottom)
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      placed[i] = { x, y }
    })
    // Part 2 walks round the pond in tighter bends: keep stepping stones from touching each other, the rocks and
    // (second run, once they are placed) the garden names
    const relax2 = (names: { x: number; y: number; w: number; h: number }[]) => {
      for (let pass = 0; pass < 6; pass++) {
        for (let i = 0; i < placed.length; i++)
          for (let j = i + 1; j < placed.length; j++) {
            const p1 = placed[i], p2 = placed[j]
            const dx = p2.x - p1.x, dy = (p2.y - p1.y) * 1.35 // stones are wider than tall
            const dd = Math.hypot(dx, dy) || 1
            const k = (S * 1.28 - dd) / dd / 2
            if (k > 0) (p1.x -= dx * k), (p1.y -= (dy * k) / 1.35), (p2.x += dx * k), (p2.y += (dy * k) / 1.35)
          }
        for (const p1 of placed) {
          for (const rk of rocks) {
            const dx = p1.x - rk.x, dy = (p1.y - rk.y) * (rk.sq ?? 1.25)
            const dd = Math.hypot(dx, dy) || 1
            const min = rk.r * 1.4 + S * 0.6
            if (dd < min) (p1.x += (dx / dd) * (min - dd)), (p1.y += ((dy / dd) * (min - dd)) / (rk.sq ?? 1.25))
          }
          for (const t of names) {
            const ox = t.w + S * 0.6 - Math.abs(p1.x - t.x), oy = t.h + S * 0.45 - Math.abs(p1.y - t.y)
            if (ox > 0 && oy > 0) ox < oy ? (p1.x += Math.sign(p1.x - t.x || 1) * ox) : (p1.y += Math.sign(p1.y - t.y || 1) * oy)
          }
        }
      }
      placed.forEach((p1, i) => {
        p1.x = clamp(p1.x, S * 0.6, w - S * 0.6)
        p1.y = clamp(p1.y, top, hgt - bottom)
        stones[i].style.left = `${p1.x}px`
        stones[i].style.top = `${p1.y}px`
      })
    }
    if (part === 2) relax2([])
    // each label takes the candidate spot that overlaps the fewest stepping stones / rocks
    const overlap = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
      Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax - aw, bx - bw)) * Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay - ah, by - bh))
    const taken: { x: number; y: number; w: number; h: number }[] = placed.map((p) => ({ x: p.x, y: p.y, w: S * 0.6, h: S * 0.45 }))
    for (const { lab, half, vh, cands, home } of pending) {
      const cost = (p: Pt, k: number) => {
        let v = k * 40 + Math.max(0, Math.hypot(p.x - home.x, p.y - home.y) - R * 2.2) * 25
        for (const t of taken) v += overlap(p.x, p.y, half, vh, t.x, t.y, t.w, t.h)
        for (const r2 of rocks) v += overlap(p.x, p.y, half, vh, r2.x, r2.y, r2.r * 0.95, r2.r * 0.7)
        return v
      }
      let best = cands[0], bestCost = Infinity
      cands.forEach((p, k) => {
        const v = cost(p, k)
        if (v < bestCost) (bestCost = v), (best = p)
      })
      lab.style.left = `${best.x}px`
      lab.style.top = `${best.y}px`
      taken.push({ x: best.x, y: best.y, w: half, h: vh })
    }
    // Part 2 on a phone: when every spot for a name covers a stone, the name keeps its spot and the stone steps off it
    if (part === 2) {
      relax2(taken.slice(placed.length))
      placed.forEach((p1, i) => (taken[i] = { ...taken[i], x: p1.x, y: p1.y }))
    }

    // the bridge: level with the end stone, from just past it out over the screen edge; when there is no room
    // beside it, the nearest height above or below that covers no stone, label or rock
    const end = part === 1 ? placed[placed.length - 1] : placed[0]
    const room = part === 1 ? w - end.x - S * 0.62 - 4 : end.x - S * 0.62 - 4
    const BW = Math.round(clamp(w * 0.1, 92, 160))
    const BH = BW * 0.525
    const fits = room >= BW * 0.6 // the crown of the arch and a little more stay on screen
    const vis = Math.round(Math.min(BW * 0.86, fits ? room : BW))
    const bx = part === 1 ? w - vis - 4 : 4
    bridge.style.left = `${bx}px`
    bridge.style.width = `${vis}px`
    bridge.style.setProperty('--bw', `${BW}px`)
    // the label rides above or below the arch, wherever it covers fewer stones, garden names and rocks
    const lw = bridgeHalf
    const lx = part === 1 ? w - 4 - lw : 4 + lw
    const lcost = (y: number) =>
      rocks.reduce((v, r2) => v + overlap(lx, y, lw, 11, r2.x, r2.y, r2.r * 0.95, r2.r * 0.7), taken.reduce((v, t) => v + overlap(lx, y, lw, 11, t.x, t.y, t.w, t.h), y < top ? 1e6 : 0))
    const lbest = (y: number) => Math.min(lcost(y - BH * 0.68 - 12), lcost(y + BH * 0.32 + 12))
    let by = end.y
    if (!fits) {
      let byCost = Infinity
      for (const k of [-1.2, 1.2, -2.2, 2.2, -3.2, 3.2]) {
        const y = clamp(end.y + k * S, top + BH * 0.6, hgt - bottom - BH * 0.4 - 16)
        let v = Math.abs(k) * 30 + lbest(y)
        for (const t of taken) v += overlap(bx + vis / 2, y, vis / 2, BH / 2 + 10, t.x, t.y, t.w, t.h)
        for (const r2 of rocks) v += overlap(bx + vis / 2, y, vis / 2, BH / 2 + 10, r2.x, r2.y, r2.r, r2.r * 0.7)
        if (v < byCost) (byCost = v), (by = y)
      }
    }
    by = clamp(by, top + BH * 0.5, hgt - bottom - BH * 0.3)
    const above = lcost(by - BH * 0.68 - 12) < lcost(by + BH * 0.32 + 12)
    bridge.toggleAttribute('data-above', above)
    bridge.style.top = `${Math.round(by - BH * 0.68 - (above ? 24 : 0))}px` // the deck meets the sand at the stone's height

    // stone lanterns go last and give way: each takes the spot clearest of rocks, water, stones, names and the bridge
    const lamps: (Pt & { H: number; g: number })[] = []
    if (nightAt) {
      const H = Math.max(28, R * 1.2)
      const pd = nightAt.pond
      taken.push({ x: bx + vis / 2, y: by - BH * 0.2, w: vis / 2, h: BH / 2 }, { x: lx, y: above ? by - BH * 0.68 - 12 : by + BH * 0.32 + 12, w: lw, h: 12 })
      for (const { g, cands } of lampSpots) {
        const score = (q: Pt) => {
          let v = Math.min(q.x - H * 0.5, w - H * 0.5 - q.x, q.y - H - top, hgt - bottom - q.y) * 4 // on screen
          for (const r2 of rocks) if (!r2.sq) v = Math.min(v, Math.hypot(q.x - r2.x, (q.y - r2.y) * 1.3) - r2.r)
          v = Math.min(v, (Math.hypot((q.x - pd.x) / pd.rx, (q.y - pd.y) / pd.ry) - 1) * pd.ry) // the pond
          for (const t of taken) v -= overlap(q.x, q.y - H * 0.5, H * 0.3, H * 0.55, t.x, t.y, t.w, t.h) * 2
          for (const l of lamps) v = Math.min(v, Math.hypot(q.x - l.x, q.y - l.y) - H)
          return v
        }
        const at = cands.reduce((p1, p2) => (score(p2) > score(p1) ? p2 : p1))
        lamps.push({ x: clamp(at.x, H * 0.5, w - H * 0.5), y: at.y, H, g })
      }
    }

    if (nightAt && night && glint && glows) {
      night.style.width = `${w}px`
      night.style.height = `${hgt}px`
      drawNight(night, nightAt)
      drawGlint(glint, nightAt)
      lamps.forEach((l) => lantern(rocksSvg, l, l.H, l.g))
      glows.replaceChildren(...lamps.map((l, i) => lanternGlow({ x: l.x, y: l.y - l.H * 0.5 }, R * 2.4, i)))
      // fireflies: one by each lantern (alternating sides), a few over the water's edge
      const p = nightAt.pond
      const spots = [
        ...lamps.map((l, i) => ({ x: l.x + (i % 2 ? 1 : -1) * R * 1.3, y: l.y - l.H * (0.8 + rnd(i + 40) * 0.6) })),
        ...[0.15, 0.55, 0.85].map((t, i) => ({ x: p.x + Math.cos(t * Math.PI * 2) * p.rx * 1.05, y: p.y + Math.sin(t * Math.PI * 2) * p.ry * 1.1 - 10 * i })),
      ]
      flies?.replaceChildren(...spots.slice(0, portrait ? 7 : 10).map((p2, i) => firefly(p2, i)))
    }
    drawSand()
  }

  function drawSand() {
    const d = dpr()
    // raked a little taller than the garden: when a phone's address bar hides, the sand is already there
    const H = (sandH = Math.round(hgt * 1.15))
    for (const c of [sand, ripple]) {
      c.width = w * d
      c.height = H * d
      c.style.width = `${w}px`
      c.style.height = `${H}px`
    }
    const g = sand.getContext('2d')!
    g.setTransform(d, 0, 0, d, 0, 0)
    g.clearRect(0, 0, w, H)
    const gap = Math.max(7, Math.min(11, Math.min(w, hgt) / 80))
    const K = 5
    const limit = (K + 0.55) * gap
    const field = (x: number, y: number) => {
      let m = Infinity
      for (const r of rocks) m = Math.min(m, Math.hypot(x - r.x, (y - r.y) * (r.sq ?? 1.15)) - r.r * 1.12)
      return m
    }
    // Distance field sampled every c px. Only cells within reach of a rock are computed exactly — further out the
    // value is only known to exceed `reach`, which is all the rows and the rings (≤ K·gap < reach) need.
    const c = 4
    const nx = Math.ceil(w / c) + 1, ny = Math.ceil(H / c) + 1
    const F = new Float32Array(nx * ny).fill(1e6)
    const reach = limit + 3 * c
    for (const r of rocks) {
      const rx = r.r * 1.12 + reach
      const i0 = Math.max(0, Math.floor((r.x - rx) / c)), i1 = Math.min(nx - 1, Math.ceil((r.x + rx) / c))
      const j0 = Math.max(0, Math.floor((r.y - rx / 1.15) / c)), j1 = Math.min(ny - 1, Math.ceil((r.y + rx / 1.15) / c))
      const sq = r.sq ?? 1.15
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const v = Math.hypot(i * c - r.x, (j * c - r.y) * sq) - r.r * 1.12
          if (v < F[j * nx + i]) F[j * nx + i] = v
        }
    }
    // the field changes ≤ 1.15 px per px, so a grid value this far past the limit decides a row sample without the exact field
    const clear = limit + 1.15 * c * 1.5
    const far = (x: number, y: number) => {
      const i = Math.min(nx - 1, Math.max(0, Math.round(x / c))), j = Math.min(ny - 1, Math.max(0, Math.round(y / c)))
      return F[j * nx + i] > clear || field(x, y) > limit
    }
    // straight raked rows, broken where they meet the rings
    const rows = new Path2D()
    for (let y = gap * 0.6; y < H; y += gap) {
      let pen = false
      for (let x = -2; x <= w + 4; x += 4) {
        const yy = y + Math.sin(x / 210 + y / 37) * 0.9
        if (far(x, yy)) {
          if (pen) rows.lineTo(x, yy)
          else rows.moveTo(x, yy)
          pen = true
        } else pen = false
      }
    }
    // concentric rings around each rock cluster = iso-lines of the distance field (marching squares)
    const rings = new Path2D()
    let px = 0, py = 0, n = 0
    const edge = (v1: number, v2: number, lv: number, x1: number, y1: number, x2: number, y2: number) => {
      if (v1 < lv === v2 < lv) return
      const t = (lv - v1) / (v2 - v1)
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t
      if (n++ % 2 === 0) (px = x), (py = y)
      else rings.moveTo(px, py), rings.lineTo(x, y)
    }
    for (let k = 1; k <= K; k++) {
      const lv = k * gap
      for (let j = 0; j < ny - 1; j++)
        for (let i = 0; i < nx - 1; i++) {
          const a = F[j * nx + i], b = F[j * nx + i + 1], cc = F[(j + 1) * nx + i + 1], dd = F[(j + 1) * nx + i]
          if (Math.min(a, b, cc, dd) > lv || Math.max(a, b, cc, dd) < lv) continue
          const x0 = i * c, y0 = j * c
          n = 0
          edge(a, b, lv, x0, y0, x0 + c, y0)
          edge(b, cc, lv, x0 + c, y0, x0 + c, y0 + c)
          edge(cc, dd, lv, x0 + c, y0 + c, x0, y0 + c)
          edge(dd, a, lv, x0, y0 + c, x0, y0)
        }
    }
    for (const path of [rows, rings])
      for (const [c2, dy] of [[col.rakeHi, -0.9], [col.rake, 0]] as const) {
        g.save()
        g.translate(0, dy)
        g.strokeStyle = c2
        g.lineWidth = 1.05
        g.stroke(path)
        g.restore()
      }
  }

  // Touching the sand sends a slow ripple — the garden answers you.
  const ripples: { x: number; y: number; t: number }[] = []
  const rippleCtx = ripple.getContext('2d')!
  const rippleLoop = createLoop(ripple, () => {
    const d = dpr()
    const g = rippleCtx
    g.setTransform(d, 0, 0, d, 0, 0)
    g.clearRect(0, 0, w, sandH)
    const now = performance.now()
    for (let i = ripples.length - 1; i >= 0; i--) {
      const age = (now - ripples[i].t) / 2600
      if (age >= 1) {
        ripples.splice(i, 1)
        continue
      }
      for (let k = 0; k < 3; k++) {
        const a = age - k * 0.12
        if (a <= 0) continue
        g.globalAlpha = (1 - a) * 0.22
        g.strokeStyle = col.ink
        g.lineWidth = 1.2
        g.beginPath()
        g.ellipse(ripples[i].x, ripples[i].y, a * 150, a * 150 * 0.62, 0, 0, Math.PI * 2)
        g.stroke()
      }
    }
    return ripples.length > 0
  })
  const onSandDown = (e: PointerEvent) => {
    if (prefs.reduced || (e.target as Element).closest('a, button')) return
    const r = garden.getBoundingClientRect()
    ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() })
    rippleLoop.start()
  }
  garden.addEventListener('pointerdown', onSandDown)

  // Tooltip: hover/focus shows the station; on touch the first tap shows it, the second enters.
  let touchArmed: HTMLElement | null = null
  let lastPointer = 'mouse'
  const showTip = (el: HTMLElement) => {
    const st = STS[stones.indexOf(el as HTMLAnchorElement)]
    const built = st.id in STATIONS
    prefetchStation(st.id) // hover / focus / first tap: the visit is likely, start loading it now
    // "nên xem trước: 04 Token" (only Part 2 stations carry prereq)
    const pre = st.prereq?.map((id) => `${displayNo(id)} ${ALL_STATIONS.find((x) => x.id === id)?.title ?? ''}`).join(', ')
    tip.replaceChildren(
      h('span', { class: 'ptip-num' }, `${L.station} ${displayNo(st.id)} · ${fill(L.gardenOf, { n: st.garden.id })}${st.kind ? ` · ${kindLabel[st.kind]}` : ''}`),
      h('span', { class: 'ptip-title' }, st.title),
      h('span', { class: 'ptip-teaser' }, built ? st.teaser : L.soon))
    if (pre) tip.append(h('span', { class: 'ptip-num ptip-prereq' }, fill(L.prereq, { list: pre })))
    tip.hidden = false
    const r = el.getBoundingClientRect()
    const gr = garden.getBoundingClientRect()
    const tw = tip.offsetWidth
    const th = tip.offsetHeight
    const x = Math.max(10, Math.min(w - tw - 10, r.left - gr.left + r.width / 2 - tw / 2))
    const above = r.top - gr.top - th - 14
    tip.style.left = `${x}px`
    tip.style.top = `${above > 70 ? above : r.bottom - gr.top + 14}px`
    garden.dataset.focus = String(st.garden.id)
  }
  const hideTip = () => {
    tip.hidden = true
    delete garden.dataset.focus
  }
  stones.forEach((el) => {
    el.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && showTip(el))
    el.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && hideTip())
    el.addEventListener('pointerdown', (e) => (lastPointer = e.pointerType))
    el.addEventListener('focus', () => el.matches(':focus-visible') && showTip(el))
    el.addEventListener('blur', hideTip)
    el.addEventListener('click', (e) => {
      if (lastPointer !== 'mouse' && touchArmed !== el) {
        e.preventDefault()
        touchArmed = el
        showTip(el)
      }
    })
  })

  // Re-lay out only when the width changes or the height changes by more than 15% (a phone's address bar hiding
  // or showing must not redraw the sand), debounced 150 ms for real resizes such as rotating the phone.
  let relayout = 0
  const ro = new ResizeObserver(([e]) => {
    const nw = Math.round(e.contentRect.width), nh = Math.round(e.contentRect.height)
    if (nw === w && Math.abs(nh - hgt) <= hgt * 0.15) return
    clearTimeout(relayout)
    relayout = window.setTimeout(layout, 150)
  })
  ro.observe(garden)
  const offPrefs = onPrefs(() => {
    readColours()
    if (w) drawSand()
  })
  layout()
  // layout() measures the garden names; on a first visit the serif may still be loading, so measure again once it is in
  let alive = true
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => alive && layout())

  // once the garden is drawn and the browser is idle: the station to visit next, and three.js for the 3D scenes
  const cancelIdle = whenIdle(() => {
    if (lightNet()) return
    prefetchStation(nextId)
    prefetchThree()
  })

  let introCleanup: (() => void) | null = null
  let appearTimer = 0
  const gctx = gsap.context(() => {
    if (prefs.reduced) return
    // the garden settles in: CSS animations (ui.css .garden.appear), so nothing reads styles or bboxes in JS;
    // the class goes once they are done, so a later relayout (rotation) draws without replaying them
    const appear = () => {
      garden.classList.add('appear')
      appearTimer = window.setTimeout(() => garden.classList.remove('appear'), 4200)
    }
    if (withIntro) introCleanup = intro(garden, appear)
    else appear()
  }, root)
  if (withIntro && prefs.reduced) introCleanup = intro(garden, () => {})

  return () => {
    alive = false
    ro.disconnect()
    offPrefs()
    cancelIdle()
    rippleLoop.dispose()
    clearTimeout(relayout)
    introCleanup?.()
    clearTimeout(appearTimer)
    gctx.revert()
  }
}

/**
 * First arrival. Dawn mist; a single vermilion drop falls and becomes the dot of "AI Zen.";
 * its ripple rakes the sand into rings while the letters bleed in like ink. Stepping in sends
 * one wide ripple across the garden and the mist lifts.
 */
function intro(garden: HTMLElement, then: () => void): () => void {
  const fx = h('canvas', { class: 'intro-fx', 'aria-hidden': 'true' })
  const letters = [...SITE.title].map((ch) => h('span', { class: 'intro-ch', 'aria-hidden': 'true' }, ch === ' ' ? ' ' : ch))
  const dot = h('span', { class: 'dot', 'aria-hidden': 'true' })
  const title = h('h1', { class: 'intro-title', tabindex: '-1', 'aria-label': SITE.title }, ...letters, dot)
  const tag = h('p', { class: 'intro-tag' }, SITE.hero.tagline)
  const btn = h('button', { class: 'btn primary intro-btn', type: 'button' }, SITE.hero.enter)
  const drop = h('span', { class: 'intro-drop', 'aria-hidden': 'true' })
  const mists = [1, 2, 3].map((i) => h('div', { class: `mist m${i}` }))
  const veil = h('div', { class: 'intro' }, fx, ...mists, h('div', { class: 'intro-copy' }, title, tag, btn), drop)
  garden.append(veil)
  title.focus({ preventScroll: true })

  // ── canvas: rings raked around the dot (revealed by the ripple), passing ripples, drifting dust ──
  const ctx2 = fx.getContext('2d')!
  const rake = document.createElement('canvas')
  const state = { reveal: 0 }
  const ripples: { t: number; big: boolean }[] = []
  const motes = Array.from({ length: prefs.quality === 'high' ? 70 : 34 }, (_, i) => ({
    x: Math.random(), y: Math.random(), v: 4 + Math.random() * 10, r: 0.6 + Math.random() * 1.4, ph: i * 1.7,
  }))
  let W = 1, H = 1, d = 1, cx = 0, cy = 0, Rr = 200
  let ink = '', ver = '' // read in size() and on prefs change, never per frame

  function size() {
    const vr = veil.getBoundingClientRect()
    W = Math.max(1, vr.width)
    H = Math.max(1, vr.height)
    d = Math.min(devicePixelRatio, prefs.quality === 'high' ? 2 : 1)
    fx.width = W * d
    fx.height = H * d
    const dr = dot.getBoundingClientRect()
    cx = dr.left - vr.left + dr.width / 2
    cy = dr.top - vr.top + dr.height / 2
    Rr = Math.min(W, H) * 0.46
    drop.style.left = `${cx}px`
    drop.style.top = `${cy}px`
    // pre-render the raked pattern once: rings around the dot, straight rows beyond
    rake.width = W * d
    rake.height = H * d
    ink = cssVar('--ink')
    ver = cssVar('--vermilion')
    const c = rake.getContext('2d')!
    c.setTransform(d, 0, 0, d, 0, 0)
    const gap = Math.max(8, Math.min(12, Math.min(W, H) / 70))
    const r0 = dr.width * 1.6
    for (const [col, dy] of [[cssVar('--rake-hi'), -0.9], [cssVar('--rake'), 0]] as const) {
      c.strokeStyle = col
      c.lineWidth = 1.05
      c.beginPath()
      for (let r = r0; r < Rr; r += gap) {
        c.moveTo(cx + r, cy + dy)
        c.arc(cx, cy + dy, r, 0, Math.PI * 2)
      }
      for (let y = gap * 0.5; y < H; y += gap) {
        let pen = false
        for (let x = 0; x <= W + 4; x += 4) {
          const yy = y + dy + Math.sin(x / 200 + y / 41) * 0.8
          if (Math.hypot(x - cx, yy - cy) > Rr + gap * 0.4) {
            if (pen) c.lineTo(x, yy)
            else c.moveTo(x, yy)
            pen = true
          } else pen = false
        }
      }
      c.stroke()
    }
  }

  // dust drifts while motion is allowed; under reduced motion the loop only draws on wake()
  const loop = createLoop(veil, (_t, dt) => {
    const now = performance.now()
    ctx2.setTransform(d, 0, 0, d, 0, 0)
    ctx2.clearRect(0, 0, W, H)
    if (state.reveal > 0) {
      ctx2.save()
      ctx2.beginPath()
      ctx2.arc(cx, cy, state.reveal, 0, Math.PI * 2)
      ctx2.clip()
      ctx2.drawImage(rake, 0, 0, W, H)
      ctx2.restore()
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i]
      const life = rp.big ? 2.2 : 3.4
      const age = (now - rp.t) / 1000 / life
      if (age >= 1) {
        ripples.splice(i, 1)
        continue
      }
      const reach = rp.big ? Math.hypot(W, H) : Rr * 1.05
      for (let k = 0; k < 3; k++) {
        const a = age - k * 0.08
        if (a <= 0) continue
        const ease = 1 - Math.pow(1 - a, 2.2)
        ctx2.globalAlpha = (1 - a) * (k === 0 ? 0.5 : 0.25)
        ctx2.strokeStyle = k === 0 ? ver : ink
        ctx2.lineWidth = k === 0 ? 1.6 : 1
        ctx2.beginPath()
        ctx2.arc(cx, cy, 6 + ease * reach, 0, Math.PI * 2)
        ctx2.stroke()
      }
    }
    ctx2.globalAlpha = 1
    // dust in dawn light, rising very slowly
    ctx2.fillStyle = ink
    for (const m of motes) {
      m.y -= (m.v * dt) / H
      if (m.y < -0.02) m.y = 1.02
      const x = m.x * W + Math.sin(now / 2400 + m.ph) * 12
      ctx2.globalAlpha = 0.16 * (0.5 + 0.5 * Math.sin(now / 1300 + m.ph))
      ctx2.beginPath()
      ctx2.arc(x, m.y * H, m.r, 0, Math.PI * 2)
      ctx2.fill()
    }
    ctx2.globalAlpha = 1
  })
  const kick = () => (prefs.reduced ? loop.wake() : loop.start())
  const offPrefs = onPrefs(() => {
    ink = cssVar('--ink')
    ver = cssVar('--vermilion')
  })
  const ripple = (big = false) => {
    ripples.push({ t: performance.now(), big })
    kick()
  }

  size()
  const ro = new ResizeObserver(() => {
    size()
    kick()
  })
  ro.observe(veil)

  let idle: gsap.core.Tween | null = null
  if (prefs.reduced) {
    state.reveal = Rr * 1.2
    kick()
  } else {
    const tl = gsap.timeline()
    tl.from(mists, { opacity: 0, duration: 2.4, stagger: 0.2 }, 0)
      .fromTo(drop, { y: -cy - 60, scaleY: 2.2, scaleX: 0.7, opacity: 1 }, { y: 0, scaleY: 1, scaleX: 1, duration: 0.95, ease: 'power2.in' }, 0.35)
      .set(drop, { opacity: 0 }, 1.3)
      .fromTo(dot, { scale: 0 }, { scale: 1, duration: 1.1, ease: 'elastic.out(1, 0.45)' }, 1.3)
      .add(() => ripple(), 1.3)
      .to(state, { reveal: Rr * 1.2, duration: 3.2, ease: 'power2.out' }, 1.3)
      .from(letters, { opacity: 0, filter: 'blur(14px)', y: 12, stagger: 0.08, duration: 1.5, ease: 'power3.out' }, 1.45)
      .from(tag, { opacity: 0, y: 10, filter: 'blur(6px)', duration: 1.3, ease: 'power3.out' }, 2.3)
      .from(btn, { opacity: 0, y: 10, duration: 1.1, ease: 'power3.out' }, 2.8)
      .add(() => {
        idle = gsap.delayedCall(4.6, function again() {
          ripple()
          idle = gsap.delayedCall(4.6, again)
        })
      })
    kick()
  }

  btn.addEventListener('click', () => {
    idle?.kill()
    ripple(true)
    const tl = gsap.timeline({
      onComplete: () => {
        loop.dispose()
        offPrefs()
        ro.disconnect()
        veil.remove()
      },
    })
    if (prefs.reduced) {
      tl.add(then).to(veil, { opacity: 0, duration: 0.01 })
    } else {
      tl.to(letters.concat(dot), { opacity: 0, y: -16, filter: 'blur(10px)', stagger: 0.04, duration: 0.8, ease: 'power2.in' }, 0)
        .to([tag, btn], { opacity: 0, y: -10, duration: 0.6, ease: 'power2.in' }, 0)
        .to(mists, { scale: 1.6, opacity: 0, duration: 1.8, stagger: 0.1, ease: 'power2.out' }, 0.2)
        .to(veil, { backgroundColor: 'transparent', duration: 1.6 }, 0.35)
        .to(fx, { opacity: 0, duration: 1.4 }, 0.7)
        .add(then, 0.55)
    }
    history.pushState(null, '', '#/vuon') // back button returns to the title; no re-render now
    ;(document.querySelector('.pstone[data-here]') as HTMLElement | null)?.focus({ preventScroll: true })
  }, { once: true })

  return () => {
    idle?.kill()
    loop.dispose()
    offPrefs()
    ro.disconnect()
  }
}

/** Station kind mark on a Part 2 stone (spec B.2): ● hiểu, ✦ tin mới, ⚒ thực hành — drawn, not font glyphs. */
function kindMark(kind: 'concept' | 'news' | 'practice') {
  const art =
    kind === 'concept' ? s('circle', { cx: 6, cy: 6, r: 2.5 })
    : kind === 'news' ? s('path', { d: 'M6 .8L7.2 4.8 11.2 6 7.2 7.2 6 11.2 4.8 7.2.8 6 4.8 4.8z' })
    : s('g', { transform: 'rotate(-38 6 6)' }, s('rect', { x: 1.6, y: 1, width: 8.8, height: 3.4, rx: 0.8 }), s('rect', { x: 5.1, y: 4, width: 1.8, height: 7.6, rx: 0.9 })) // a mallet
  return s('svg', { class: 'pstone-kind', 'data-kind': kind, viewBox: '0 0 12 12', 'aria-hidden': 'true' }, art)
}

/** Deterministic 0..1 noise from a seed. */
function hash(k: number) {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * A garden stone: a weathered silhouette resting on a flat base, lit from the upper left,
 * with grain, speckles, a contact shadow on the sand and — on the main stone — a cushion of moss.
 */
function drawRock(svg: SVGSVGElement, r: Rock, garden: number, main: boolean) {
  const id = `rk-${garden}-${Math.round(r.seed * 100)}`
  const R = r.r
  const body = rockPath(r.x, r.y, R, r.seed)
  const rnd = (k: number) => hash(r.seed * 31 + k)
  const grain = [0, 1, 2, 3].map((i) => {
    const y0 = r.y - R * 0.34 + i * R * 0.2 + (rnd(i) - 0.5) * R * 0.08
    return s('path', {
      class: 'rock-grain',
      d: `M${(r.x - R * 1.05).toFixed(1)} ${(y0 + R * 0.08).toFixed(1)}Q${(r.x + (rnd(i + 4) - 0.5) * R * 0.6).toFixed(1)} ${(y0 - R * (0.12 + rnd(i + 8) * 0.1)).toFixed(1)} ${(r.x + R * 1.05).toFixed(1)} ${(y0 + R * 0.02).toFixed(1)}`,
    })
  })
  const specks = Array.from({ length: Math.round(10 + R * 0.5) }, (_, i) => {
    const a = rnd(i + 20) * Math.PI * 2
    const d = Math.sqrt(rnd(i + 50))
    return s('circle', { class: 'rock-speck', cx: (r.x + Math.cos(a) * d * R * 0.9).toFixed(1), cy: (r.y + Math.sin(a) * d * R * 0.6).toFixed(1), r: (0.4 + rnd(i + 80) * 0.9).toFixed(2) })
  })
  const g = s('g', { class: 'rock', 'data-garden': garden },
    s('ellipse', { class: 'rock-shadow', cx: r.x + R * 0.22, cy: r.y + R * 0.5, rx: R * 1.18, ry: R * 0.32 }),
    s('ellipse', { class: 'rock-contact', cx: r.x + R * 0.05, cy: r.y + R * 0.41, rx: R * 0.95, ry: R * 0.13 }),
    s('path', { d: body, fill: `url(#${id}-g)` }),
    s('g', { 'clip-path': `url(#${id}-c)` },
      s('ellipse', { class: 'rock-shade', cx: r.x + R * 0.4, cy: r.y + R * 0.62, rx: R * 1.1, ry: R * 0.55 }),
      s('ellipse', { class: 'rock-light', cx: r.x - R * 0.32, cy: r.y - R * 0.45, rx: R * 0.66, ry: R * 0.28 }),
      ...grain,
      ...specks),
    s('path', { class: 'rock-rim', d: body }))
  if (main && R > 24) g.append(moss(r, rnd))
  svg.append(
    s('defs', null,
      s('clipPath', { id: `${id}-c` }, s('path', { d: body })),
      s('linearGradient', { id: `${id}-g`, x1: '0.1', y1: '0', x2: '0.75', y2: '1' },
        s('stop', { offset: '0', style: 'stop-color:var(--rock-hi)' }),
        s('stop', { offset: '.5', style: 'stop-color:var(--rock-mid)' }),
        s('stop', { offset: '1', style: 'stop-color:var(--rock-lo)' }))),
    g)
}

/** Moss grows as a cushion of tiny clumps where the stone meets the sand, a little way up its side. */
function moss(r: Rock, rnd: (k: number) => number) {
  const R = r.r
  const dir = rnd(99) > 0.5 ? 1 : -1 // which side the moss favours
  const g = s('g', { class: 'moss' },
    s('ellipse', { class: 'moss-wash', cx: r.x - dir * R * 0.45, cy: r.y + R * 0.43, rx: R * 0.62, ry: R * 0.16 }))
  const n = Math.round(16 + R * 0.45)
  for (let i = 0; i < n; i++) {
    const t = rnd(i + 200)
    const along = -dir * (0.15 + t * 0.95) // from the front toward one side
    const up = Math.pow(rnd(i + 300), 1.8) * 0.32 // mostly low, a few climbing the stone
    const x = r.x + along * R
    const y = r.y + R * (0.44 - up) + (rnd(i + 400) - 0.5) * R * 0.08
    const tone = rnd(i + 500)
    g.append(s('circle', { class: tone < 0.35 ? 'moss-dot dark' : tone < 0.8 ? 'moss-dot' : 'moss-dot light', cx: x.toFixed(1), cy: y.toFixed(1), r: (0.8 + rnd(i + 600) * R * 0.036).toFixed(2) }))
  }
  return g
}

/** Weathered stone outline: irregular top, flattened base so it sits on the sand. */
function rockPath(cx: number, cy: number, R: number, seed: number): string {
  const n = 9
  const squash = 0.62 + hash(seed) * 0.2
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(seed + i) * 0.25
    const rr = R * (0.86 + hash(seed * 3 + i) * 0.22)
    let y = cy + Math.sin(a) * rr * squash
    if (Math.sin(a) > 0) y = Math.min(y, cy + R * 0.42) // flat foot
    else y -= R * 0.12 * Math.abs(Math.sin(a)) // a little taller than wide
    pts.push([cx + Math.cos(a) * rr, y])
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const k = 1 / 7.5 // a touch tighter than a blob: reads as weathered stone
    d += `C${(p1[0] + (p2[0] - p0[0]) * k).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) * k).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * k).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) * k).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d + 'Z'
}
