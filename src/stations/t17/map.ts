import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { L, type Fact } from '../../core/content'
import { company, loadLogos, logoStone, type Category, type Company, type Model } from '../../ui/logo'
import type { SceneCtx } from '../types'
import { badgeText, C, CATS, GROUPS, hasLens, heft, ORDER, type Lens, type Region } from './data'
import { catGlyph, clamp, defs, hash, isle, peaks, rng, sand, vf, type Pt, type Ring, type River } from './ink'
import { openCard } from './card'

const M = C.scenes.map
const VF = L.kinds.verify
// Each region is its own loose cluster inside its own zone of the garden, with a raked river between zones.
// Targets are fractions of the zone; the first group is the region's hero island: nearest (lowest) and biggest.
const WIDE_T: Record<Region, Pt[]> = {
  us: [
    [0.56, 0.84],
    [0.22, 0.24],
    [0.84, 0.5],
  ],
  cn: [
    [0.5, 0.6],
    [0.16, 0.16],
    [0.8, 0.9],
  ],
  other: [
    [0.34, 0.86],
    [0.86, 0.5],
    [0.66, 0.12],
    [0.14, 0.36],
  ],
}
// a phone: two rows per band, the hero in front
const TALL_T: Record<Region, Pt[]> = {
  us: [
    [0.6, 0.84],
    [0.16, 0.18],
    [0.88, 0.2],
  ],
  cn: [
    [0.52, 0.86],
    [0.14, 0.2],
    [0.76, 0.16],
  ],
  other: [
    [0.3, 0.86],
    [0.84, 0.82],
    [0.7, 0.14],
    [0.14, 0.2],
  ],
}
// how much of the garden each region holds (by how many stones it carries)
const SHARE: Record<Region, number> = { us: 0.31, cn: 0.31, other: 0.38 }
const SHARE_TALL: Record<Region, number> = { us: 0.31, cn: 0.33, other: 0.36 }

interface Stone {
  c: Company
  r: Region
  x: number
  y: number
  sz: number
  w: number
  h: number
  named: boolean
  btn: HTMLButtonElement
  cap: HTMLElement
}
interface Group {
  r: Region
  k: number
  hero: boolean
  st: Stone[]
  x: number
  y: number
  w: number
  h: number
  /** the region word beside the hero island (local centre) */
  wx: number
  wy: number
  g?: SVGGElement
  puff: HTMLElement
}
interface Zone {
  x0: number
  x1: number
  y0: number
  y1: number
}

/** Scene 1 — the archipelago: three clusters of stone islands (Mỹ, Trung Quốc, khác); filters light the ones that do that work. */
export function mapScene(ctx: SceneCtx) {
  const back = s('svg', { class: 't17m-svg', 'aria-hidden': 'true' })
  const sandL = s('svg', {
    class: 't17-sandsvg t17m-sand',
    'aria-hidden': 'true',
  })
  const isl = s('svg', { class: 't17m-svg', 'aria-hidden': 'true' })
  const rip = s('svg', { class: 't17m-svg t17m-rip', 'aria-hidden': 'true' })
  const mist = h('div', { class: 't17-mist', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))
  const field = h('div', {
    class: 't17m-field',
    role: 'group',
    'aria-label': M.region,
  })
  const note = h('div', { class: 't17m-note', 'aria-live': 'polite' })
  const legend = h('p', { class: 't17-legend', 'aria-hidden': 'true' }, h('span', { class: 't17-vf' }), VF)
  const foot = h('div', { class: 't17m-foot' }, legend, h('p', { class: 't17-badge' }, badgeText()))
  let cat: Category | null = null
  let reg: Region | null = null
  let lens: Lens | null = null
  const LENSES: Lens[] = ['closed', 'open']
  const tried = new Set<string>()

  const chips = CATS.map((k) =>
    h(
      'button',
      {
        class: 't17-chip',
        type: 'button',
        'aria-pressed': 'false',
        onClick: () => setCat(k),
      },
      catGlyph(k),
      h('span', null, C.cats[k]),
    ),
  )
  const regs = ORDER.map((r) =>
    h(
      'button',
      {
        class: 't17m-reg',
        type: 'button',
        'aria-pressed': 'false',
        onClick: () => setReg(r),
      },
      C.regions[r],
    ),
  )
  const wChips = LENSES.map((l) =>
    h(
      'button',
      {
        class: 't17m-wchip',
        type: 'button',
        'aria-pressed': 'false',
        onClick: () => setLens(l),
      },
      M.weightsChips[l],
    ),
  )
  const wBox = h('div', { class: 't17m-wts', role: 'group', 'aria-label': M.weightsGroup }, h('span', { class: 't17m-wlab', 'aria-hidden': 'true' }, M.weightsLabel), ...wChips)
  const bar = h('div', { class: 't17-chips' }, h('div', { class: 't17m-cats', role: 'group', 'aria-label': M.filters }, ...chips), wBox)
  const regBox = h('div', { class: 't17m-regs', role: 'group', 'aria-label': M.regionGroup }, ...regs)

  const count: Record<Region, number> = { us: 0, cn: 0, other: 0 }
  const groups: Group[] = GROUPS.map(({ r, ids }) => {
    const k = count[r]++
    return {
      r,
      k,
      hero: k === 0,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      wx: 0,
      wy: 0,
      puff: h('div', { class: 't17m-puff', 'aria-hidden': 'true' }),
      st: ids
        .map((id) => {
          const c = company(id)!
          const cap = h('span', { class: 't17m-cap', 'aria-hidden': 'true' })
          const btn: HTMLButtonElement = h(
            'button',
            {
              class: 't17m-isle ls-host',
              type: 'button',
              'aria-label': fill(M.island, { name: c.name }),
              onClick: () => open(c, btn),
            },
            h('span', { class: 't17m-in' }, logoStone(c.id, { size: 48, decorative: true }), h('span', { class: 't17m-name', 'aria-hidden': 'true' }, c.name), cap),
          )
          return {
            c,
            r,
            x: 0,
            y: 0,
            sz: 48,
            w: 60,
            h: 60,
            named: false,
            btn,
            cap,
          }
        })
        .sort((a, b) => heft(b.c) - heft(a.c)),
    }
  })
  const stones = groups.flatMap((g) => g.st)
  field.append(...groups.map((g) => g.puff), ...GROUPS.flatMap((g) => g.ids).map((id) => stones.find((x) => x.c.id === id)!.btn))
  const root = h('div', { class: 't17 t17m' }, back, sandL, isl, mist, rip, regBox, field, note, bar, foot)
  ctx.art.append(root)
  ctx.prompt(M.prompt)

  let hasLogo: Set<string> | null = null
  loadLogos().then((m) => {
    hasLogo = new Set(Object.keys(m?.items ?? {}))
    layout()
  })

  let W = 0
  let H = 0
  let compact = false
  let bare = false
  let wide = true
  let pools: { x: number; y: number; rx: number; ry: number }[] = []

  /** Stones inside one island (one, a pair, or a scalene three with the biggest in front) and the hero's region word. */
  function arrange(g: Group, base: number, fs: number, depth: number, word: { w: number; h: number } | null, room = Infinity) {
    for (const st of g.st) {
      st.sz = Math.round(base * heft(st.c) * depth)
      st.named = hasLogo ? !hasLogo.has(st.c.id) : false
      // a name typeset in the stone needs a stone big enough to hold it; a logo stays legible
      if (st.named) st.sz = Math.max(st.sz, compact || !wide ? (st.c.name.length > 12 ? 34 : 30) : st.c.name.length > 12 ? 40 : 34)
      else st.sz = Math.max(st.sz, compact ? 26 : 22)
      const tw = st.c.name.length * fs * 0.58
      // a name wraps only between words, so its longest word sets the narrowest it can be
      const word = Math.max(...st.c.name.split(/\s+/).map((x) => x.length)) * fs * 0.56
      const lw = Math.max(st.sz * 1.7, word)
      // one label line under each stone: its name, or (while filtering) the model that answers the filter
      // (a phone has no room to keep a caption line under a stone that already carries its name)
      const lines = compact ? 0 : bare || st.named ? (st.c.models.length ? 1 : 0) : tw > lw ? 2 : 1
      st.w = st.named ? clamp(st.c.name.length * Math.max(11, st.sz * 0.17) * 0.56 + st.sz * 0.4, st.sz * 1.28, st.sz * 2) : Math.max(st.sz * 1.28, compact || bare ? 0 : Math.min(tw, lw))
      st.h = st.sz + (lines ? lines * fs * 1.15 + 3 : 0)
    }
    const [a, b, c] = g.st
    // a phone sets names side by side with little air: keep them from reading as one word
    const gap = Math.max(wide ? 6 : 12, base * 0.12)
    const lift = wide ? 1 : 0.45
    if (g.st.length === 1) {
      a.x = 0
      a.y = 0
    } else if (g.st.length === 2) {
      a.x = -(b.w + gap) / 2
      b.x = (a.w + gap) / 2
      a.y = base * 0.14 * lift
      b.y = -base * 0.2 * lift
    } else {
      // back-left, front-middle (the biggest), right
      a.x = 0
      b.x = -(a.w + b.w) / 2 - gap
      c.x = (a.w + c.w) / 2 + gap
      a.y = base * 0.2 * lift
      b.y = -base * 0.3 * lift
      c.y = -base * 0.02 * lift
    }
    let x0 = Math.min(...g.st.map((t) => t.x - t.w / 2))
    let x1 = Math.max(...g.st.map((t) => t.x + t.w / 2))
    let y0 = Math.min(...g.st.map((t) => t.y - t.sz / 2))
    let y1 = Math.max(...g.st.map((t) => t.y - t.sz / 2 + t.h))
    if (word && x1 - x0 + gap * 1.6 + word.w <= room) {
      // the inscription sits on the sand beside the hero island, at the level of its stones' feet
      g.wx = x0 - gap * 1.6 - word.w / 2
      g.wy = Math.max(...g.st.map((t) => t.y + t.sz / 2)) - word.h * 0.3
      x0 = g.wx - word.w / 2
      y0 = Math.min(y0, g.wy - word.h / 2)
      y1 = Math.max(y1, g.wy + word.h / 2)
    } else if (word) {
      // no room beside it: in front of it, under the front-left stone
      g.wx = Math.max(x0 + word.w / 2, Math.min(...g.st.map((t) => t.x)))
      g.wy = y1 + word.h * 0.45
      y1 += word.h * 0.95
    }
    g.w = x1 - x0
    g.h = y1 - y0 + base * 0.16
    const ox = (x0 + x1) / 2
    const oy = (y0 + y1) / 2
    for (const st of g.st) {
      st.x -= ox
      st.y -= oy
    }
    g.wx -= ox
    g.wy -= oy
  }

  // last positions, so a relayout (the sentence arriving, a resize) glides instead of jumping
  const was = new Map<Element, Pt>()
  const wasIsle = new Map<Group, Pt>()
  let settled = false
  const settle = window.setTimeout(() => (settled = true), ctx.reduced ? 0 : 2200)

  function layout() {
    W = root.clientWidth
    H = root.clientHeight
    if (!W || !H) return
    wide = W / H > 1.1
    // a landscape phone: no room for names under the logos (the card and the captions still say them)
    compact = wide && H < 330
    root.classList.toggle('wide', wide)
    root.classList.toggle('compact', compact)
    // the weights lens joins the chips on wide screens; on a phone it waits at the foot of the map
    const wHome = wide ? bar : root
    if (wBox.parentElement !== wHome) wHome.append(wBox)
    // …and the verify legend waits in the dusk sky, top-right, so it never sits under a caption
    if (wide && legend.parentElement !== foot) foot.prepend(legend)
    else if (!wide && legend.parentElement !== root) root.append(legend)
    const barH = bar.offsetHeight
    // the far shore: a band of dusk sky, ridges and a low sun
    const sky = wide ? clamp(H * 0.11, compact ? 14 : 28, 92) : clamp(H * 0.05, 16, 60)
    const horizon = barH + sky
    const top = horizon + (compact ? 2 : 8)
    legend.style.top = wide ? '' : `${barH + Math.max(0, (sky - legend.offsetHeight) / 2) + 2}px`
    const fs = wide && !compact ? 12 : 11
    // the date (wide: bottom-right corner); on a phone the date and the weights lens share a strip at the foot, below every band
    const strip = wide ? 0 : Math.max(wBox.offsetHeight, foot.offsetHeight) + 6
    const rocks = wide ? [{ x: W - foot.offsetWidth - 4, y: H - foot.offsetHeight - 2, w: foot.offsetWidth + 4, h: foot.offsetHeight + 2 }] : []

    // three zones and two rivers between them: across the garden when wide, stacked bands on a phone
    const rw = wide ? clamp(W * 0.05, compact ? 18 : 26, 72) : clamp((H - top) * 0.04, 12, 28)
    const avail = (wide ? W : H - top - strip) - rw * 2
    let at = wide ? 0 : top
    const zones: Zone[] = ORDER.map((r) => {
      const len = avail * (wide ? SHARE : SHARE_TALL)[r]
      const z = wide ? { x0: at, x1: at + len, y0: top, y1: H } : { x0: 0, x1: W, y0: at, y1: at + len }
      at += len + rw
      return z
    })
    const words = regs.map((b) => ({ w: b.offsetWidth, h: b.offsetHeight }))
    const T = wide ? WIDE_T : TALL_T
    const zoneOf = (g: Group) => zones[ORDER.indexOf(g.r)]
    // on a phone each region's word sits at the start of its band, in the river above it (only what dips into the band is in the way)
    const wordAt = zones.map((z, i): Pt => [2, z.y0 - rw * 0.5 - words[i].h * 0.62])
    if (!wide)
      wordAt.forEach(([x, y], i) =>
        rocks.push({
          x,
          y: Math.max(y, zones[i].y0),
          w: words[i].w + 4,
          h: Math.max(1, y + words[i].h - zones[i].y0),
        }),
      )

    const keep = (g: Group, m: number) => {
      const z = zoneOf(g)
      const lo = z.x0 + g.w / 2 + m
      const hi = z.x1 - g.w / 2 - m
      g.x = lo > hi ? (z.x0 + z.x1) / 2 : clamp(g.x, lo, hi)
      const my = wide ? 0 : m * 0.4
      const ylo = z.y0 + g.h / 2 + my
      // wide: leave one caption line under the front islands
      const yhi = z.y1 - g.h / 2 - my - (wide && !compact ? fs * 1.2 : 0)
      g.y = ylo > yhi ? (z.y0 + z.y1) / 2 : clamp(g.y, ylo, yhi)
      // an island wider (or taller) than its zone counts as a clash: the next try uses smaller stones
      tight = Math.max(tight, lo - hi, ylo - yhi)
    }
    let tight = 0

    // try a size, let the islands settle inside their zone; if they cannot all find room, use smaller stones;
    // and if even the smallest stones cannot keep their names, the names step back (the card and the captions still say them)
    let base = 0
    let worst = 0
    bare = false
    for (const tryBare of wide ? [false] : [false, true]) {
      bare = tryBare
      base = clamp(Math.sqrt((W * (H - top) * (compact ? 0.36 : 0.3)) / 23 / 2.1), 22, 74)
      for (let attempt = 0; attempt < 8; attempt++) {
        for (const g of groups) {
          const [fx, fy] = T[g.r][g.k]
          const z0 = zoneOf(g)
          arrange(g, base, fs, wide ? (0.8 + 0.3 * fy) * (g.hero ? 1.06 : 1) : 0.94 + 0.1 * fy, g.hero && wide ? words[ORDER.indexOf(g.r)] : null, z0.x1 - z0.x0 - base * 0.4)
          const z = zoneOf(g)
          g.x = z.x0 + fx * (z.x1 - z.x0)
          g.y = z.y0 + fy * (z.y1 - z.y0)
          keep(g, base * 0.2)
        }
        worst = 0
        tight = 0
        for (let n = 0; n < 240; n++) {
          worst = 0
          for (let i = 0; i < groups.length; i++) {
            const a = groups[i]
            const push = (bx: number, by: number, bw: number, bh: number, both: Group | null, pad: number) => {
              const ox = (a.w + bw) / 2 + pad - Math.abs(a.x - bx)
              const oy = (a.h + bh) / 2 + pad * 0.6 - Math.abs(a.y - by)
              if (ox <= 0 || oy <= 0) return
              worst = Math.max(worst, Math.min(ox, oy))
              const k = both ? 0.5 : 1
              if (ox / (a.w + bw) < oy / (a.h + bh)) {
                const d = (a.x < bx ? -1 : 1) * ox * k
                a.x += d
                if (both) both.x -= d
              } else {
                const d = (a.y < by ? -1 : 1) * oy * k
                a.y += d
                if (both) both.y -= d
              }
            }
            // only neighbours in the same region meet: the zones and the river keep regions apart
            for (let j = i + 1; j < groups.length; j++) if (groups[j].r === a.r) push(groups[j].x, groups[j].y, groups[j].w, groups[j].h, groups[j], base * 0.3)
            for (const r of rocks) push(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, null, 6)
            keep(a, base * 0.2)
          }
          if (worst < 0.5) break
        }
        worst = Math.max(worst, tight)
        if (worst < 2) break
        base *= 0.93
      }
      if (worst < 2) break
    }
    root.classList.toggle('bare', bare)

    // ── paint: the dusk sky
    back.replaceChildren()
    for (const v of [back, sandL, isl, rip]) v.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const id = defs(back)
    const sunR = clamp(sky * 0.34, 7, 30)
    const sun: Pt = [W * (wide ? 0.86 : 0.6), horizon - sky * 0.46]
    back.append(
      s('ellipse', {
        cx: W / 2,
        cy: top + (H - top) * 0.55,
        rx: W * 0.62,
        ry: (H - top) * 0.64,
        fill: `url(#${id.warm})`,
      }),
      s('circle', {
        cx: sun[0],
        cy: sun[1],
        r: sunR * 3,
        fill: `url(#${id.glow})`,
        class: 't17-halo',
      }),
      s('circle', { class: 't17-sun', cx: sun[0], cy: sun[1], r: sunR }),
    )
    const pr = rng(17)
    const rg = s('g', {
      class: 't17-ridge',
      filter: ctx.quality === 'low' ? null : 'url(#ink-wash)',
    })
    for (const [b, h0, h1, op] of [
      [horizon - 2, 0.3, 0.72, 0.075],
      [horizon + 2, 0.14, 0.38, 0.11],
    ])
      for (const d of peaks(pr, -W * 0.05, W * 1.05, b, sky * h0, sky * h1, W * (wide ? 0.1 : 0.17))) rg.append(s('path', { d, 'fill-opacity': op }))
    back.append(rg)

    // ── islands (far ones first), their rings, and the rivers between regions
    const k = 0.34
    const isles = groups.map((g) => {
      const xs0 = Math.min(...g.st.map((t) => t.x - t.w / 2))
      const xs1 = Math.max(...g.st.map((t) => t.x + t.w / 2))
      const feet = g.st.map((t) => g.y + t.y + t.sz * 0.36)
      const lo = Math.min(...feet)
      const hi = Math.max(...feet) + base * 0.18
      const rx = (xs1 - xs0) / 2 + base * 0.3
      return {
        x: g.x + (xs0 + xs1) / 2,
        y: (lo + hi) / 2,
        rx,
        ry: Math.max((hi - lo) / 2, rx * k * 0.5),
      }
    })
    pools = isles
    const rings: Ring[] = isles.map((i) => ({
      x: i.x,
      y: i.y,
      r0: Math.max(i.rx * 1.1, i.ry / k + 5),
      n: compact ? 1 : 2,
    }))
    const rivers: River[] = zones.slice(0, 2).map((z) => {
      if (wide) {
        const b = z.x1 + rw / 2
        const a = rw * 0.16
        return {
          pts: [
            [b + a, horizon],
            [b - a, horizon + (H - horizon) * 0.36],
            [b + a * 0.8, horizon + (H - horizon) * 0.72],
            [b - a * 0.3, H + 16],
          ],
          w0: rw * 0.14,
          w1: rw * 0.46,
          n: compact ? 3 : 4,
        }
      }
      const b = z.y1 + rw / 2
      const a = rw * 0.2
      return {
        pts: [
          [-12, b + a],
          [W * 0.32, b - a],
          [W * 0.68, b + a * 0.8],
          [W + 12, b - a * 0.2],
        ],
        w0: rw * 0.4,
        w1: rw * 0.4,
        n: 3,
      }
    })
    sandL.replaceChildren(
      sand(W, H, rings, {
        top: horizon - 2,
        gap: wide ? 7 : 6,
        k,
        fade: (H - horizon) * 0.14,
        rivers,
      }),
    )
    isl.replaceChildren()
    const glide: [SVGGElement, number, number][] = []
    groups
      .map((g, i) => ({ g, i }))
      .sort((a, b) => a.g.y - b.g.y)
      .forEach(({ g, i }) => {
        const e = isles[i]
        const el = s('g', { class: `t17m-g${g.hero ? ' hero' : ''}` })
        el.append(isle(e.x, e.y, e.rx, e.ry, hash(g.st[0].c.id)))
        g.g = el
        isl.append(el)
        const old = wasIsle.get(g)
        if (old && settled && !ctx.reduced) glide.push([el, old[0] - e.x, old[1] - e.y])
        wasIsle.set(g, [e.x, e.y])
        Object.assign(g.puff.style, {
          left: `${e.x - e.rx * 1.3}px`,
          top: `${g.y - g.h * 0.75}px`,
          width: `${e.rx * 2.6}px`,
          height: `${g.h * 1.5}px`,
        })
      })

    // ── stones and words
    const moved: [Element, number, number][] = []
    const put = (el: HTMLElement, x: number, y: number, extra: Record<string, string>) => {
      const old = was.get(el)
      if (old && settled && !ctx.reduced && (Math.abs(old[0] - x) > 1 || Math.abs(old[1] - y) > 1)) moved.push([el, old[0] - x, old[1] - y])
      was.set(el, [x, y])
      Object.assign(el.style, { left: `${x}px`, top: `${y}px`, ...extra })
    }
    for (const g of groups)
      for (const st of g.st) {
        const bw = Math.max(44, st.w + 6)
        const bh = Math.max(44, st.h + 4)
        put(st.btn, g.x + st.x - bw / 2, g.y + st.y - st.sz / 2 - 2, {
          width: `${bw}px`,
          height: `${bh}px`,
        })
        st.btn.style.setProperty('--sz', `${st.sz}px`)
        {
          const cw = wide ? Math.max(st.w + base * 0.3, st.sz * 1.9) : Math.max(st.w + 8, st.sz * 1.7, 56)
          const cx = g.x + st.x
          st.btn.style.setProperty('--cs', `${Math.round(Math.max(0, cw / 2 + 2 - cx) - Math.max(0, cx + cw / 2 + 2 - W))}px`)
        }
        st.btn.style.setProperty('--cw', `${Math.round(wide ? Math.max(st.w + base * 0.3, st.sz * 1.9) : Math.max(st.w + 8, st.sz * 1.7, 56))}px`)
        st.btn.querySelector<HTMLElement>('.logo-stone')?.style.setProperty('--ls-size', `${st.sz}px`)
        st.btn.style.setProperty('--fs', `${fs}px`)
        st.btn.style.setProperty('--z', String(Math.round(g.y + st.y)))
        st.btn.classList.toggle('named', st.named)
      }
    for (const g of groups) {
      if (!g.hero) continue
      const i = ORDER.indexOf(g.r)
      if (wide) put(regs[i], g.x + g.wx - words[i].w / 2, g.y + g.wy - words[i].h / 2, {})
      else put(regs[i], wordAt[i][0], wordAt[i][1], {})
    }
    if (moved.length)
      ctx.anim(() => {
        for (const [el, dx, dy] of moved)
          gsap.fromTo(
            el,
            { x: dx, y: dy },
            {
              x: 0,
              y: 0,
              duration: 1,
              ease: 'power3.inOut',
              clearProps: 'transform',
            },
          )
        for (const [el, dx, dy] of glide) if (Math.abs(dx) + Math.abs(dy) > 1) gsap.fromTo(el, { x: dx, y: dy }, { x: 0, y: 0, duration: 1, ease: 'power3.inOut' })
        gsap.fromTo(
          sandL,
          { opacity: 0.25 },
          {
            opacity: 1,
            duration: 1.2,
            ease: 'power2.out',
            clearProps: 'opacity',
          },
        )
      })
    if (note.firstChild) placeNote()
    apply(false)
  }

  /** which model is the open one: flagged in the brief, or the only kind a "mixed" company lists (Flux 2) */
  const isOpen = (c: Company, m: Model) => m.openWeights === true || (c.weights === 'mixed' && m.openWeights == null && !c.models.some((x) => x.openWeights != null))
  const lit = (st: Stone) => (!cat || st.c.categories.includes(cat)) && (!reg || st.r === reg) && (!lens || hasLens(st.c, lens))
  /** a closed product of this kind (e.g. Sora): the stone half-wakes to say so */
  const gone = (st: Stone) => (cat && !lens && (!reg || st.r === reg) ? st.c.models.find((m) => m.kind === cat && m.status === 'discontinued') : undefined)

  function apply(anim = true) {
    const any = !!(cat || reg || lens)
    root.classList.toggle('filtering', any)
    let anyVf = false
    groups.forEach((g, gi) => {
      let some = false
      g.st.forEach((st, i) => {
        const on = lit(st)
        const ghost = !on ? gone(st) : undefined
        some ||= on || !!ghost
        st.btn.classList.toggle('lit', any && on)
        st.btn.classList.toggle('ghost', !!ghost)
        st.btn.style.setProperty('--d', `${((gi * 3 + i) % 9) * 0.05}s`)
        // the stone answers the filter with the model that does that work (a hollow ring = the brief says "verify")
        const ms = on && (cat || lens === 'open') ? st.c.models.filter((m) => !m.status && (!cat || m.kind === cat) && (lens !== 'open' || isOpen(st.c, m))) : []
        const m0 = ms[0]
        st.cap.replaceChildren()
        if (ghost) st.cap.append(`${ghost.name} · ${C.status.discontinued}`)
        else if (m0) {
          st.cap.append(m0.name)
          if (m0.verify) {
            st.cap.append(vf(VF))
            anyVf = true
          }
          if (ms.length > 1) st.cap.append(h('span', { class: 't17m-more' }, ` +${ms.length - 1}`))
        }
        st.btn.classList.toggle('has-cap', !!(ghost || m0))
        if (anim && any && on && !ctx.reduced) ripple(g, st, gi)
      })
      g.g?.classList.toggle('dim', any && !some)
      g.puff.classList.toggle('on', any && !some)
    })
    legend.classList.toggle('on', anyVf)
  }

  function ripple(g: Group, st: Stone, gi: number) {
    const x = g.x + st.x
    const y = g.y + st.y + st.sz * 0.45
    const rs = [0, 1].map(() => s('ellipse', { cx: x, cy: y, rx: st.sz, ry: st.sz * 0.34 }))
    rip.append(...rs)
    ctx.anim(() =>
      gsap.fromTo(
        rs,
        { attr: { rx: st.sz * 0.7, ry: st.sz * 0.24 }, opacity: 0.8 },
        {
          attr: { rx: st.sz * 1.9, ry: st.sz * 0.66 },
          opacity: 0,
          duration: 2.2,
          ease: 'power2.out',
          stagger: 0.4,
          delay: (gi % 5) * 0.06,
          onComplete: () => rs.forEach((r) => r.remove()),
        },
      ),
    )
  }

  function setCat(k: Category) {
    cat = cat === k ? null : k
    chips.forEach((b, i) => b.setAttribute('aria-pressed', String(CATS[i] === cat)))
    if (cat) tried.add(cat)
    apply()
    ctx.chime('soft')
    check()
  }

  function setLens(l: Lens) {
    lens = lens === l ? null : l
    wChips.forEach((b, i) => b.setAttribute('aria-pressed', String(LENSES[i] === lens)))
    if (lens) tried.add(lens)
    say(lens ? M.weightsNote[lens] : reg ? M.regionNote[reg] : undefined)
    apply()
    ctx.chime('soft')
    check()
  }

  function setReg(r: Region) {
    reg = reg === r ? null : r
    regs.forEach((b, i) => b.setAttribute('aria-pressed', String(ORDER[i] === reg)))
    if (reg) tried.add(reg)
    say(reg ? M.regionNote[reg] : lens ? M.weightsNote[lens] : undefined)
    apply()
    ctx.chime('soft')
    check()
  }

  /** the note floats in the dusk sky under the chips, where it hides no island */
  function placeNote() {
    Object.assign(note.style, {
      left: `${W / 2}px`,
      top: `${bar.offsetHeight + 6}px`,
    })
  }
  function say(n: Fact | string | undefined) {
    note.replaceChildren()
    if (!n) return
    const el = typeof n === 'string' ? h('p', { class: 't17m-note-t sans' }, n) : ctx.fact(n, 'p', 't17m-note-t')
    note.append(el)
    placeNote()
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(el, { opacity: 0, y: -4 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }))
  }

  let opened = false
  let shown = false
  function check() {
    if (shown || !(tried.size >= 2 || opened)) return
    shown = true
    ctx.insight(M.insight, M.detail)
  }

  let closeCard: (() => void) | null = null
  let timer = 0
  function open(c: Company, from: HTMLElement) {
    closeCard?.()
    closeCard = openCard(ctx, c, () => {
      closeCard = null
      from.focus({ preventScroll: true })
    })
    ctx.chime('soft')
    if (!opened) {
      opened = true
      // let the card speak first; the sentence arrives as it settles
      timer = window.setTimeout(check, ctx.reduced ? 0 : 900)
    }
  }

  // now and then a drop falls by an island and one slow ring spreads: the garden breathes
  let idle: ReturnType<typeof gsap.delayedCall> | null = null
  const drip = () => {
    const p = pools[Math.floor(Math.random() * pools.length)]
    if (p && !cat && !reg && !lens && !closeCard) {
      const e = s('ellipse', {
        class: 't17m-drop',
        cx: p.x,
        cy: p.y,
        rx: p.rx * 1.05,
        ry: p.rx * 0.36,
      })
      rip.append(e)
      ctx.anim(() =>
        gsap.fromTo(
          e,
          { attr: { rx: p.rx * 1.05, ry: p.rx * 0.36 }, opacity: 0.55 },
          {
            attr: { rx: p.rx * 1.9, ry: p.rx * 0.66 },
            opacity: 0,
            duration: 4.2,
            ease: 'sine.out',
            onComplete: () => e.remove(),
          },
        ),
      )
    }
    idle = gsap.delayedCall(2.4 + Math.random() * 2.6, drip)
  }
  if (!ctx.reduced && ctx.quality !== 'low') idle = gsap.delayedCall(3.2, drip)

  // a gentle parallax: the far shore drifts against the pointer, the islands stay put
  let par: ((e: PointerEvent) => void) | null = null
  if (!ctx.reduced && matchMedia('(pointer: fine)').matches) {
    const qx = gsap.quickTo(back, 'x', { duration: 1.6, ease: 'power3.out' })
    const qy = gsap.quickTo(back, 'y', { duration: 1.6, ease: 'power3.out' })
    const mx = gsap.quickTo(mist, 'x', { duration: 2.2, ease: 'power3.out' })
    par = (e) => {
      const r = root.getBoundingClientRect()
      const u = (e.clientX - r.left) / r.width - 0.5
      const v = (e.clientY - r.top) / r.height - 0.5
      qx(-u * 14)
      qy(-v * 5)
      mx(u * 22)
    }
    root.addEventListener('pointermove', par)
  }

  // islands rise out of the sand
  if (!ctx.reduced) {
    gsap.from(
      stones.map((t) => t.btn),
      {
        opacity: 0,
        y: 14,
        duration: 1.3,
        ease: 'power3.out',
        stagger: { each: 0.05, from: 'random' },
        delay: 0.35,
        clearProps: 'opacity,transform',
      },
    )
    gsap.from([bar, foot], {
      opacity: 0,
      y: -8,
      duration: 1.1,
      ease: 'power3.out',
      delay: 0.2,
      clearProps: 'opacity,transform',
    })
    gsap.from(regs, {
      opacity: 0,
      duration: 1.6,
      ease: 'power2.out',
      delay: 1.1,
      stagger: 0.25,
      clearProps: 'opacity',
    })
  }

  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  layout()
  return () => {
    idle?.kill()
    ro.disconnect()
    cancelAnimationFrame(raf)
    clearTimeout(timer)
    clearTimeout(settle)
    if (par) root.removeEventListener('pointermove', par)
    closeCard?.()
  }
}
