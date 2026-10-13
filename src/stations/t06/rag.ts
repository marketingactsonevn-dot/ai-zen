import { h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { blob, brush, C, clamp, defs, ell, layer, onSize, place, rng, stableHeight, stone, type Pt } from './ink'

const R = C.scenes.rag

/** A kasuga stone lantern, base centre at (0, 0), ≈ 200 units tall. Returns the group and the window centre. */
function lantern(glowId: string) {
  const g = s('g')
  const fill = s('g', { filter: 'url(#ink-rough)' })
  const P = (pts: Pt[]) => `M${pts.map((p) => p.join(' ')).join('L')}Z`
  fill.append(
    s('path', { class: 'st3', d: P([[-42, 0], [-36, -14], [36, -14], [42, 0]]) }),
    s('path', { class: 'st3', d: P([[-11, -14], [-9, -90], [9, -90], [11, -14]]) }),
    s('path', { class: 'st3', d: P([[-36, -90], [-30, -104], [30, -104], [36, -90]]) }),
    s('path', { class: 'st3', d: P([[-27, -104], [-27, -146], [27, -146], [27, -104]]) }),
    s('path', { class: 'st3', d: 'M-60 -144Q-30 -150 -14 -170Q0 -180 14 -170Q30 -150 60 -144Q52 -140 46 -141Q20 -146 0 -146Q-20 -146 -46 -141Q-52 -140 -60 -144Z' }),
    s('path', { class: 'st3', d: 'M-7 -176Q-9 -186 0 -196Q9 -186 7 -176Z' }),
  )
  // shading on the right of each block
  const shade = s('g', { class: 'k', 'fill-opacity': 0.13, filter: 'url(#ink-wash)' },
    s('path', { d: P([[14, 0], [12, -14], [36, -14], [42, 0]]) }),
    s('path', { d: P([[2, -14], [2, -90], [9, -90], [11, -14]]) }),
    s('path', { d: P([[10, -104], [10, -146], [27, -146], [27, -104]]) }),
    s('path', { d: 'M14 -170Q30 -150 60 -144Q52 -140 46 -141Q24 -146 6 -146Z' }))
  const win = s('g', null,
    s('rect', { class: 't6r-win', x: -13, y: -138, width: 26, height: 28, rx: 2 }),
    s('path', { class: 'v t6r-flame', d: 'M0 -113C-6 -116 -6 -123 -1 -131C0 -127 3 -126 3 -122C5 -120 5 -115 0 -113Z' }))
  const glow = s('circle', { class: 't6r-glow', cx: 0, cy: -124, r: 70, fill: `url(#${glowId})` })
  const ink = s('g', { class: 'k', filter: 'url(#ink-rough)' })
  const line = (pts: Pt[], w: number, op = 0.75) => ink.append(s('path', { 'fill-opacity': op, d: brush(pts, w, { a: 0.08, b: 0.3, min: 0.3 }).d }))
  line([[-42, 0], [-36, -14], [36, -14]], 2.4)
  line([[-48, 1], [48, 1]], 2.6, 0.6)
  line([[-11, -14], [-9, -90]], 2.2)
  line([[11, -14], [9, -90]], 1.6, 0.5)
  line([[-9, -54], [9, -54]], 1.4, 0.5)
  line([[-36, -90], [-30, -104], [30, -104], [36, -90], [-36, -90]], 2.2)
  line([[-27, -104], [-27, -146]], 2.2)
  line([[27, -104], [27, -146]], 1.6, 0.6)
  line([[-13, -110], [-13, -138], [13, -138]], 1.6, 0.7)
  line([[-62, -144], [-30, -150], [-14, -170], [0, -179], [14, -170], [30, -150], [62, -144]], 3, 0.85)
  line([[-46, -141], [0, -146], [46, -141]], 1.4, 0.5)
  line([[-7, -176], [-9, -186], [0, -197]], 1.6, 0.7)
  g.append(glow, fill, shade, win, ink)
  return { g, win, glow, center: [0, -124] as Pt }
}

/** One rolled scroll lying down: a paper body with a soft shadow on its underside, wood-coloured ends, maybe a cord. */
function roll(x: number, y: number, w: number, tilt: number, tied: boolean) {
  const a: Pt = [x, y], b: Pt = [x + w, y + tilt]
  const g = s('g')
  g.append(
    s('path', { class: 'card', d: brush([a, b], 6.2, { a: 0, b: 0, min: 1, wob: 0 }).d }),
    s('path', { class: 'k', 'fill-opacity': 0.1, d: brush([[x + 1, y + 1.6], [x + w - 1, y + tilt + 1.6]], 2.8, { a: 0, b: 0, min: 1, wob: 0 }).d }),
    s('path', { class: 'k', 'fill-opacity': 0.42, d: brush([[x + 1, y - 3], [x + w - 1, y + tilt - 3]], 0.7, { a: 0.2, b: 0.2, min: 0.4 }).d }),
    s('path', { class: 'k', 'fill-opacity': 0.3, d: brush([[x + 2, y + 3.1], [x + w - 2, y + tilt + 3.1]], 0.7, { a: 0.2, b: 0.2, min: 0.4 }).d }),
  )
  for (const [cx, cy] of [a, b]) {
    g.append(s('path', { class: 't6r-cap', d: ell(cx, cy, 1.9, 3.4) }), s('path', { class: 'k', 'fill-opacity': 0.45, d: brush([[cx + 0.4, cy - 3.3], [cx + 1.8, cy], [cx + 0.4, cy + 3.3]], 0.6, { a: 0.2, b: 0.2, min: 0.5 }).d }))
  }
  if (tied) {
    const tx = x + w * 0.42
    g.append(s('path', { class: 'v', 'fill-opacity': 0.85, d: brush([[tx, y - 3.2], [tx + 0.6, y + tilt * 0.42 + 3.2]], 1.3, { a: 0, b: 0, min: 1, wob: 0 }).d }),
      s('path', { class: 'v', 'fill-opacity': 0.75, d: brush([[tx + 0.6, y + 3.2], [tx + 2.4, y + 6.4], [tx + 1.2, y + 8.6]], 0.8, { a: 0.1, b: 0.5 }).d }))
  }
  return g
}

/** A small library pavilion, base centre at (0, 0), ≈ 220 × 150 units. Bays: left = company files, right = web. */
function pavilion() {
  const g = s('g')
  const r = rng(4)
  const P = (pts: Pt[]) => `M${pts.map((p) => p.join(' ')).join('L')}Z`
  g.append(
    s('path', { class: 't6-sh', 'fill-opacity': 0.12, d: ell(0, 4, 118, 8), filter: 'url(#ink-wash)' }),
    s('path', { class: 'st3', d: P([[-104, 0], [-98, -10], [98, -10], [104, 0]]), filter: 'url(#ink-rough)' }),
    s('path', { class: 'card', 'fill-opacity': 0.75, d: P([[-80, -10], [-80, -98], [80, -98], [80, -10]]) }),
    s('path', { class: 'k', 'fill-opacity': 0.05, d: P([[-80, -10], [-80, -98], [80, -98], [80, -10]]), filter: 'url(#ink-wash)' }),
  )
  const bays = [-1, 1].map((sd) => {
    const bay = s('g', { class: 't6r-bay' })
    const x0 = sd < 0 ? -72 : 6
    bay.append(s('rect', { class: 't6r-bayglow', x: x0 - 3, y: -94, width: 72, height: 82, rx: 6, opacity: 0 }))
    for (const y of [-40, -68]) bay.append(s('path', { class: 'w2', d: brush([[x0, y], [x0 + 66, y]], 2, { a: 0.02, b: 0.02, min: 0.8, wob: 0 }).d }))
    for (let row = 0; row < 3; row++) {
      const yb = -14 - row * 28
      if (sd < 0) {
        // rolled scrolls lying in a little stack: paper rolls of varied length, wooden ends, a few tied with a cord
        const stack = row % 2 ? [[2, 0, 30, -0.8], [33, 0, 26, 0.6], [12, -6.6, 32, 0.4]] : [[5, 0, 26, 0.5], [32, 0, 31, -0.6], [17, -6.6, 27, -0.9]]
        for (const [dx, dy, w, tilt] of stack) bay.append(roll(x0 + dx, yb - 3.4 + dy, w, tilt, r() > 0.62))
      } else {
        // the web: leaves of paper, leaning
        for (let k = 0; k < 6; k++) {
          const x = x0 + 6 + k * 10 + r() * 2
          const lean = (r() - 0.5) * 6
          bay.append(s('path', { class: 'card', d: P([[x, yb], [x + lean, yb - 20], [x + lean + 7, yb - 20], [x + 7, yb]]) }),
            s('path', { class: 'k', 'fill-opacity': 0.45, d: brush([[x, yb], [x + lean, yb - 20], [x + lean + 7, yb - 20]], 0.9, { min: 0.5 }).d }))
        }
      }
    }
    g.append(bay)
    return bay
  })
  const ink = s('g', { class: 'k', filter: 'url(#ink-rough)' })
  const line = (pts: Pt[], w: number, op = 0.8) => ink.append(s('path', { 'fill-opacity': op, d: brush(pts, w, { a: 0.06, b: 0.25, min: 0.3 }).d }))
  line([[-82, -8], [-82, -100]], 4.2)
  line([[82, -8], [82, -100]], 3.2, 0.7)
  line([[0, -12], [0, -96]], 1.6, 0.4)
  line([[-106, 0], [106, 0]], 2.2, 0.6)
  g.append(ink)
  // the roof: a wide curve with lifted eaves
  g.append(
    s('path', { class: 'w1', 'fill-opacity': 0.42, d: 'M-128 -100Q-92 -104 -66 -124Q-34 -146 0 -148Q34 -146 66 -124Q92 -104 128 -100Q118 -94 104 -96Q60 -104 0 -106Q-60 -104 -104 -96Q-118 -94 -128 -100Z', filter: 'url(#ink-wash)' }),
    // tile rows: near-vertical strokes from the ridge down to the eave
    s('g', { class: 'k', 'fill-opacity': 0.3 }, ...[-96, -72, -48, -24, 0, 24, 48, 72, 96].map((x) => {
      const top = -147 + 44 * (Math.abs(x) / 118) ** 1.7
      return s('path', { d: brush([[x * 0.97, top + 4], [x * 1.04, -104 + Math.abs(x) * 0.03]], 1.1, { a: 0.2, b: 0.3, min: 0.4 }).d })
    })),
    s('path', { class: 'k', 'fill-opacity': 0.85, d: brush([[-130, -100], [-92, -105], [-66, -125], [-34, -146], [0, -149], [34, -146], [66, -125], [92, -105], [130, -100]], 3, { a: 0.05, b: 0.08, min: 0.4 }).d, filter: 'url(#ink-rough)' }),
    s('path', { class: 'k', 'fill-opacity': 0.4, d: brush([[-100, -98], [0, -106], [100, -98]], 1.6, { min: 0.4 }).d }),
  )
  return { g, bays }
}

/** A rolled scroll, centred at (0, 0). */
function scrollIcon() {
  return s('g', { class: 't6r-scroll' },
    s('rect', { class: 'card', x: -11, y: -4, width: 22, height: 8, rx: 1 }),
    s('path', { class: 'k', 'fill-opacity': 0.6, d: brush([[-11, -4], [11, -4]], 1, { min: 0.6 }).d }),
    s('path', { class: 'w2', d: ell(-12, 0, 2.6, 5) }), s('path', { class: 'w2', d: ell(12, 0, 2.6, 5) }),
    s('rect', { class: 'v', x: -2, y: -4, width: 4, height: 8, 'fill-opacity': 0.8 }))
}

/** Scene 4 — answering from memory vs. fetching documents from the library first (RAG / web search). */
export function ragScene(ctx: SceneCtx) {
  const stable = stableHeight(ctx, [R.insight])
  const svg = layer()
  const ids = defs(svg)
  const ground = s('g')
  const path = s('g')
  const L = lantern(ids.glow)
  const lib = pavilion()
  const lanternG = s('g', null, L.g)
  const libG = s('g', null, lib.g)
  const trail = s('path', { class: 't6r-trail', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 })
  const orb = s('g', { opacity: 0 }, s('circle', { r: 14, fill: `url(#${ids.glow})` }), s('circle', { class: 'v', r: 3.6 }))
  const carried = s('g', { opacity: 0 }, scrollIcon())
  const cord = s('path', { class: 't6r-cord', opacity: 0 })
  const knot = s('circle', { class: 'k2', r: 1.8, opacity: 0 })
  const moss = s('g')
  svg.append(moss, ground, path, libG, lanternG, trail, carried, orb, cord, knot)

  const q = h('p', { class: 't6r-q' }, h('span', null, R.question), ' ', ctx.tag('illustration'))
  const slip = h('div', { class: 't6r-slip' })
  const card = h('div', { class: 't6r-card', 'aria-live': 'polite' }, slip)
  card.hidden = true
  const labs = [R.lantern, ...R.shelves].map((t) => h('span', { class: 't6-lab t6r-lab', 'aria-hidden': 'true' }, t))
  const btns = [
    h('button', { class: 't6-btn', type: 'button', 'aria-label': R.memoryAria, 'aria-disabled': 'false' }, R.memory),
    h('button', { class: 't6-btn', type: 'button', 'aria-label': R.lookupAria, 'aria-disabled': 'false' }, R.lookup),
  ]
  const root = h('div', { class: 't6 t6r' }, h('p', { class: 'visually-hidden' }, R.art), svg, q, ...labs, card, ...btns) // the answer slip sits above the place words
  ctx.art.append(root)

  const done = new Set<number>()
  let busy = false
  let W = 1, H = 1
  let lk = 1 // lantern scale
  let lanternAt: Pt = [0, 0]
  let libAt: Pt = [0, 0]
  let lb = 1 // library scale
  let route: SVGPathElement | null = null

  function layout() {
    W = root.clientWidth
    const Hraw = root.clientHeight
    if (!W || !Hraw) return
    H = stable.H(Hraw)
    svg.setAttribute('viewBox', `0 0 ${W} ${Hraw}`)
    const land = W / H > 1.1
    const qw = Math.min(W - 8, 560)
    place(q, (W - qw) / 2, 2, qw)
    const qh = q.offsetHeight + 10
    // buttons along the bottom
    const bw = btns.map((b) => b.offsetWidth || 150)
    const gap = 8
    const total = bw[0] + bw[1] + gap
    const by = H - 48
    place(btns[0], W / 2 - total / 2, by)
    place(btns[1], W / 2 - total / 2 + bw[0] + gap, by)
    const gy = by - (land ? clamp(H * 0.07, 24, 50) : 34) // ground line: the sagging stones and the lantern's word stay clear of the buttons
    gyNow = gy
    byNow = by
    const room = gy - qh
    if (land) {
      lk = clamp(Math.min(room * 0.8, W * 0.3) / 200, 0.3, 2)
      lb = lk * 0.82
      lanternAt = [Math.max(W * 0.28, 66 * lk + 6), gy]
      libAt = [Math.min(W * 0.72, W - 132 * lb - 6), gy - room * 0.06]
    } else {
      lb = clamp(Math.min(W * 0.62 / 260, room * 0.32 / 150), 0.3, 1.2)
      lk = clamp(Math.min(room * 0.5, W * 0.5) / 200, 0.3, 1.6)
      lanternAt = [W * 0.22, gy]
      libAt = [W * 0.6, qh + 152 * lb + 4]
    }
    lanternG.setAttribute('transform', `translate(${lanternAt[0].toFixed(1)} ${lanternAt[1].toFixed(1)}) scale(${lk.toFixed(3)})`)
    libG.setAttribute('transform', `translate(${libAt[0].toFixed(1)} ${libAt[1].toFixed(1)}) scale(${lb.toFixed(3)})`)
    // ground: raked sand, a mossy wash under the lantern and the library
    ground.replaceChildren()
    for (let i = 0; i < 4; i++) {
      const y = gy + 6 + i * 7
      const d = `M${-20} ${y}Q${W / 2} ${y - 6 + i * 1.5} ${W + 20} ${y}`
      ground.append(s('path', { class: 'rake-hi', d, transform: 'translate(0 1.4)' }), s('path', { class: 'rake', d }))
    }
    moss.replaceChildren(
      s('path', { class: 'm', 'fill-opacity': 0.14, d: blob(lanternAt[0] + 6 * lk, lanternAt[1] + 4, 82 * lk, 13 * lk + 4, 3, 0.2), filter: 'url(#ink-wash)' }),
      s('path', { class: 'm', 'fill-opacity': 0.1, d: blob(libAt[0], libAt[1] + 5, 140 * lb, 12 * lb + 4, 8, 0.2), filter: 'url(#ink-wash)' }),
    )
    // stepping stones from the lantern to the library
    path.replaceChildren()
    const a: Pt = [lanternAt[0] + 40 * lk, lanternAt[1] - 2]
    const b: Pt = [libAt[0] - 70 * lb, libAt[1] + 2]
    const n = 5
    const hops: Pt[] = []
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const x = a[0] + (b[0] - a[0]) * t
      const y = a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * (land ? 16 : 10) * lk
      const k = lk * (1 - t * 0.35) * (land ? 1 : 0.85)
      path.append(stone(x, y, 17 * k, 6 * k, ids.stone, i + 5, 4 * k))
      hops.push([x, y - 6 * k])
    }
    // the stones lie on a bed of raked sand and moss, so they never float
    const bed = [a, ...hops.map(([x, y]) => [x, y + 6 * lk] as Pt), b]
    const bedW = (land ? 30 : 26) * lk
    path.prepend(
      s('path', { class: 't6r-bed', d: brush(bed, bedW * 2, { a: 0.15, b: 0.15, min: 0.5 }).d, filter: 'url(#ink-wash)' }),
      s('path', { class: 'm', 'fill-opacity': 0.12, d: brush(bed.map(([x, y]) => [x - 4, y + bedW * 0.5] as Pt), bedW * 0.7, { a: 0.3, b: 0.3, min: 0.3 }).d, filter: 'url(#ink-wash)' }),
      s('path', { class: 'k3', 'fill-opacity': 0.35, d: brush(bed.map(([x, y]) => [x, y - bedW * 0.62] as Pt), 1, { a: 0.2, b: 0.2, min: 0.4 }).d }),
      s('path', { class: 'k3', 'fill-opacity': 0.35, d: brush(bed.map(([x, y]) => [x, y + bedW * 0.66] as Pt), 1, { a: 0.2, b: 0.2, min: 0.4 }).d }),
    )
    const gr = rng(23)
    for (let i = 0; i < 26; i++) {
      const t = gr()
      const j = Math.min(bed.length - 2, Math.floor(t * (bed.length - 1)))
      const u = t * (bed.length - 1) - j
      const x = bed[j][0] + (bed[j + 1][0] - bed[j][0]) * u + (gr() - 0.5) * bedW * 1.4
      const y = bed[j][1] + (bed[j + 1][1] - bed[j][1]) * u + (gr() - 0.5) * bedW * 0.9
      path.prepend(s('path', { class: gr() > 0.5 ? 't6t-pb3' : 't6t-pb1', d: ell(x, y, 1.2 + gr() * 1.6, 0.8 + gr()) }))
    }
    // the orb's road: out of the window, down, hop by hop, into the left bay
    const win: Pt = [lanternAt[0], lanternAt[1] - 124 * lk]
    const bay: Pt = [libAt[0] - 36 * lb, libAt[1] - 52 * lb]
    const pts: Pt[] = [win, [win[0] + 30 * lk, win[1] + 40 * lk], ...hops, [b[0] + 20 * lb, b[1] - 30 * lb], bay]
    route = s('path', { d: brush(pts, 1).c })
    trail.setAttribute('d', route.getAttribute('d')!)
    // words
    const fsz = clamp(14 * Math.min(lk, 1.2), 12.5, 16)
    root.style.setProperty('--t6-fs', `${fsz}px`)
    lab(labs[0], lanternAt[0], lanternAt[1] + 6)
    // the two shelf names: centred under their bays, or pushed apart if they would touch
    lab(labs[1], libAt[0] - 36 * lb, libAt[1] + 8)
    lab(labs[2], libAt[0] + 42 * lb, libAt[1] + 8)
    const w1 = labs[1].offsetWidth, w2 = labs[2].offsetWidth
    if (labs[1].offsetLeft + w1 > labs[2].offsetLeft - 4) {
      const mid = libAt[0]
      place(labs[1], clamp(mid - w1 + 6, 2, W - w1 - w2 - 2), libAt[1] + 8)
      place(labs[2], Math.max(labs[1].offsetLeft + w1 - 8, mid - 6), libAt[1] + 8)
      if (labs[2].offsetLeft + w2 > W - 2) place(labs[2], clamp(mid - w2 / 2, 2, W - w2 - 2), libAt[1] + 8 + labs[1].offsetHeight - 6)
    }
    placeCard()
  }
  /** The answer slip hangs on a cord from the lantern's right eave when there is room, otherwise where it fits. */
  let gyNow = 0
  let byNow = 0
  function placeCard() {
    if (card.hidden) return
    const land = W / H > 1.1
    // short landscape (≈ 170px of art): a smaller slip, set in the gap between lantern and library, clear of the buttons
    const compact = land && H < 300
    card.classList.toggle('compact', compact)
    const gy = gyNow
    const qh = q.offsetHeight + 10
    const eave: Pt = [lanternAt[0] + 62 * lk, lanternAt[1] - 143 * lk]
    const gapL = lanternAt[0] + 64 * lk + 8, gapR = libAt[0] - 132 * lb - 8
    const cw = compact ? clamp(gapR - gapL, 230, 340) : land ? clamp(libAt[0] - 132 * lb - 16 - (eave[0] - 12), 190, 330) : Math.min(W * 0.56, 240)
    card.style.width = `${cw}px`
    const chh = card.offsetHeight || 120
    let x = eave[0] - 12
    let y = eave[1] + 22 * Math.max(0.8, lk)
    const libBox = [libAt[0] - 132 * lb, libAt[1] - 152 * lb, libAt[0] + 132 * lb, libAt[1] + 12]
    const hitsLib = x < libBox[2] && x + cw > libBox[0] && y < libBox[3] && y + chh > libBox[1]
    if (compact) {
      x = (gapL + gapR) / 2 - cw / 2
      const top = byNow - 8 - chh // the buttons' top edge is the hard floor
      y = Math.max(0, Math.min(qh + (top - qh) * 0.3, top))
    } else if (x + cw > W - 2 || y + chh > gy - 14 || hitsLib) {
      if (land) {
        const left = lanternAt[0] + 64 * lk + 16
        const right = libAt[0] - 132 * lb - 16
        x = (left + right) / 2 - cw / 2
        y = clamp(qh + (gy - qh - chh) * 0.12, qh, gy - chh - 30 * lk)
      } else {
        x = W - cw - 4
        y = clamp(gy - chh - 34, libAt[1] + 30, gy - chh - 10)
      }
    }
    x = clamp(x, 2, W - cw - 2)
    place(card, x, y)
    // the cord: from the eave tip to the slip's top edge, sagging a little
    const end: Pt = [x + Math.min(cw * 0.22, 40), y + 3]
    const mid: Pt = [(eave[0] + end[0]) / 2, Math.max(eave[1], end[1]) + Math.min(26, Math.abs(end[0] - eave[0]) * 0.12)]
    cord.setAttribute('d', `M${eave[0].toFixed(1)} ${eave[1].toFixed(1)}Q${mid[0].toFixed(1)} ${mid[1].toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}`)
    knot.setAttribute('cx', end[0].toFixed(1))
    knot.setAttribute('cy', end[1].toFixed(1))
    tear()
  }
  /** Rice paper torn by hand: a ragged polygon the size of the slip. */
  function tear() {
    const w = slip.offsetWidth, hh = slip.offsetHeight
    if (!w || !hh) return
    const r = rng(Math.round(w + hh))
    const pts: string[] = []
    const edge = (x0: number, y0: number, x1: number, y1: number, n: number, nx: number, ny: number) => {
      for (let i = 0; i < n; i++) {
        const t = i / n
        const j = (r() - 0.3) * 3.2
        pts.push(`${(x0 + (x1 - x0) * t + nx * j).toFixed(1)}px ${(y0 + (y1 - y0) * t + ny * j).toFixed(1)}px`)
      }
    }
    edge(0, 0, w, 0, Math.round(w / 9), 0, 1)
    edge(w, 0, w, hh, Math.round(hh / 9), -1, 0)
    edge(w, hh, 0, hh, Math.round(w / 7), 0, -1)
    edge(0, hh, 0, 0, Math.round(hh / 9), 1, 0)
    slip.style.clipPath = `polygon(${pts.join(',')})`
  }
  function lab(el: HTMLElement, cx: number, y: number) {
    const w = el.offsetWidth || 80
    place(el, clamp(cx - w / 2, 2, W - w - 2), y)
  }

  const flame = L.win.querySelector('.t6r-flame')!
  function setLight(v: number) {
    L.glow.setAttribute('opacity', v.toFixed(3))
    flame.setAttribute('transform', `translate(0 ${(-113 * (1 - (0.7 + v * 0.5))).toFixed(2)}) scale(${(0.7 + v * 0.5).toFixed(3)})`)
    flame.setAttribute('fill-opacity', (0.5 + v * 0.5).toFixed(3))
  }
  setLight(0.35)

  function writeCard(kind: 'guess' | 'sure') {
    card.hidden = false
    card.className = `t6r-card ${kind}`
    if (kind === 'guess') {
      slip.replaceChildren(h('p', { class: 't6r-ans' }, R.guess), h('p', { class: 't6r-note' }, h('span', { class: 't6r-seal q', 'aria-hidden': 'true' }, '?'), R.guessNote))
    } else {
      slip.replaceChildren(h('p', { class: 't6r-ans' }, R.answer), h('p', { class: 't6r-cite' }, R.cite), h('p', { class: 't6r-note' }, h('span', { class: 't6r-seal', 'aria-hidden': 'true' }, '1'), R.citeNote))
    }
    placeCard()
    if (ctx.reduced) {
      gsap.set([cord, knot], { opacity: 1 })
      return
    }
    ctx.anim(() => {
      gsap.fromTo([cord, knot], { opacity: 0 }, { opacity: 1, duration: 0.6 })
      gsap.fromTo(card, { opacity: 0, y: -10, rotation: -2 }, { opacity: 1, y: 0, rotation: 0, duration: 1.2, ease: 'power3.out' })
      gsap.fromTo(slip.children, { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 -4% 0 0)', duration: 1.1, stagger: 0.35, delay: 0.3, ease: 'power2.out', clearProps: 'clipPath' })
    })
  }
  function hideCard() {
    card.hidden = true
    gsap.set([cord, knot], { opacity: 0 })
  }

  function finish(i: number) {
    busy = false
    btns.forEach((b) => b.setAttribute('aria-disabled', 'false'))
    btns[i].classList.remove('on')
    btns[i].classList.add('done')
    done.add(i)
    if (done.size === 2) {
      ctx.insight(R.insight, R.detail)
      ctx.chime('ok')
    } else ctx.prompt(R.again)
  }

  function memory() {
    if (busy) return
    busy = true
    btns.forEach((b) => b.setAttribute('aria-disabled', 'true'))
    btns[0].classList.add('on')
    ctx.chime('soft')
    hideCard()
    if (ctx.reduced) {
      setLight(0.35)
      writeCard('guess')
      finish(0)
      return
    }
    ctx.anim(() => {
      const v = { l: 0.35 }
      const tl = gsap.timeline({ onComplete: () => finish(0) })
      tl.to(v, { l: 0.15, duration: 0.25, repeat: 3, yoyo: true, ease: 'sine.inOut', onUpdate: () => setLight(v.l) })
      tl.to(v, { l: 0.35, duration: 0.3, onUpdate: () => setLight(v.l) })
      tl.call(() => writeCard('guess'), [], 0.6)
      tl.set({}, {}, 1.8)
    })
  }

  function lookup() {
    if (busy || !route) return
    busy = true
    btns.forEach((b) => b.setAttribute('aria-disabled', 'true'))
    btns[1].classList.add('on')
    ctx.chime('soft')
    hideCard()
    const bay = lib.bays[0].querySelector('.t6r-bayglow')!
    if (ctx.reduced) {
      setLight(1)
      gsap.set(bay, { opacity: 0.6 })
      writeCard('sure')
      finish(1)
      return
    }
    ctx.anim(() => {
      const len = route!.getTotalLength()
      const at = (t: number, el: SVGGElement, k = 1) => {
        const p = route!.getPointAtLength(t * len)
        el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${k.toFixed(3)})`)
      }
      const o = { t: 0 }
      const back = { t: 1 }
      const v = { l: 0.35 }
      const k = clamp(lk, 0.7, 1.6)
      const tl = gsap.timeline({ onComplete: () => finish(1) })
      tl.set(orb, { opacity: 1 })
      tl.fromTo(trail, { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 1.8, ease: 'power1.inOut' }, 0)
      tl.to(o, { t: 1, duration: 1.8, ease: 'power1.inOut', onUpdate: () => at(o.t, orb, k) }, 0)
      tl.fromTo(bay, { opacity: 0 }, { opacity: 0.7, duration: 0.5 }, 1.6)
      tl.set(carried, { opacity: 1 }, 2.1)
      tl.to(back, { t: 0, duration: 1.8, ease: 'power1.inOut', onUpdate: () => (at(back.t, orb, k), at(back.t, carried, k * 1.1)) }, 2.1)
      tl.to(trail, { attr: { 'stroke-dashoffset': -1 }, duration: 1.8, ease: 'power1.inOut' }, 2.1)
      tl.to([orb, carried], { opacity: 0, duration: 0.4 }, 3.8)
      tl.to(v, { l: 1, duration: 0.9, ease: 'power2.out', onUpdate: () => setLight(v.l) }, 3.8)
      tl.to(bay, { opacity: 0.25, duration: 1 }, 3.8)
      tl.call(() => writeCard('sure'), [], 4.1)
      tl.set({}, {}, 5.4)
    })
  }
  btns[0].addEventListener('click', memory)
  btns[1].addEventListener('click', lookup)

  onSize(ctx, root, layout, stable.reset)
  layout()
  ctx.prompt(R.prompt)
  if (!ctx.reduced) {
    gsap.from([lanternG, libG, path], { opacity: 0, duration: 1.6, stagger: 0.25, ease: 'power2.out', delay: 0.3 })
    // the flame breathes
    const v = { l: 0.35 }
    ctx.anim(() => gsap.to(v, { l: 0.45, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut', onUpdate: () => !busy && done.size === 0 && setLight(v.l) }))
  }
}

