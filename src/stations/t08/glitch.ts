import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { createLoop } from '../../core/loop'
import { arc, brush, C, ell, path, poly, rng, smooth, spline, stableHeight, watchSize, type Pt } from './kit'

const G = C.scenes.glitch
const VW = 240
const VH = 180
/** film-strip bands above and below each picture */
const BAND = 11
const VT = VH + BAND * 2
const PERIOD = 5.2

interface Clip {
  /** stuck: the glitch has been found — hold it, plainly visible */
  update(t: number, stuck?: boolean): void
  /** the stretch of the loop where the glitch shows */
  win: [number, number]
  /** where it is, in clip units (for a tap) */
  spot: { x: number; y: number; r: number }
}

/** 0 → 1 → 0 across the glitch window, with soft shoulders. */
const bump = (t: number, [a, b]: [number, number]) => smooth(a, a + 0.08, t) * (1 - smooth(b - 0.08, b, t))

// ───────── Clip 1 · a cup of tea: the handle drifts to the other side and the cup turns into a bowl ─────────
function cupClip(g: SVGGElement): Clip {
  const win: [number, number] = [0.4, 0.78]
  // a plum branch reaching in from the top right, a few buds
  const branch = s('g')
  branch.append(
    path(brush([[248, 20], [214, 30], [190, 26], [168, 36]], 3.4, { a: 0.02, b: 0.6, min: 0.2 }), 'k2'),
    path(brush([[206, 29], [198, 46], [188, 54]], 1.8, { a: 0.1, b: 0.6, min: 0.2 }), 'k2'),
    ...([[180, 30], [194, 22], [189, 53], [168, 36], [222, 24]] as Pt[]).map(([x, y], k) => path(ell(x, y, k % 2 ? 2.6 : 3.4), k === 0 ? 'v' : 'k', { 'fill-opacity': k === 0 ? 0.9 : 0.7 })),
  )
  const table = path(brush([[14, 136], [80, 134.5], [170, 135.5], [228, 134]], 3.4, { a: 0.06, b: 0.3, min: 0.3 }), 'k2')
  const tableShadow = path(ell(124, 137, 64, 4), 'k', { 'fill-opacity': 0.08, filter: 'url(#ink-wash)' })
  const cam = s('g')
  const saucerFill = path('', 'card')
  const saucer = path('', 'k')
  const body = path('', 'card')
  const shade = path('', 'k', { 'fill-opacity': 0.09 })
  const sides = path('', 'k')
  const rimBack = path('', 'k3')
  const rimFront = path('', 'k')
  const band = path('', 'v')
  const handle = path('', 'k')
  const steam = [0, 1, 2].map(() => path('', 'k3', { 'fill-opacity': 0.55 }))
  cam.append(saucerFill, saucer, handle, body, shade, band, sides, rimBack, rimFront, ...steam)
  g.append(branch, tableShadow, table, cam)

  return {
    win,
    spot: { x: 120, y: 98, r: 46 },
    update(t) {
      const m = bump(t, win)
      // a slow push-in, like a real shot
      const z = 1 + 0.07 * t
      cam.setAttribute('transform', `translate(120 112) scale(${z.toFixed(4)}) translate(-120 -112)`)
      const cx = 120
      const rimY = 76 + 10 * m
      const baseY = 126
      const rw = 28 + 13 * m
      const bw = 15 + 9 * m
      const ry = 5 + 2.5 * m
      const L: Pt[] = spline([[cx - rw, rimY], [cx - rw + 2 + 2 * m, rimY + (baseY - rimY) * 0.5], [cx - bw - 5, baseY - 5], [cx - bw, baseY]])
      const R: Pt[] = L.map(([x, y]) => [2 * cx - x, y] as Pt)
      body.setAttribute('d', poly([...arc(cx, rimY, rw, ry, 180, 360, 16), ...R.slice(1), ...L.slice().reverse()]))
      shade.setAttribute('d', poly([[cx + rw * 0.35, rimY + ry], ...R.slice(2), [cx + bw * 0.4, baseY]]))
      sides.setAttribute('d', brush(L, 3, { a: 0.05, b: 0.25, min: 0.4 }) + brush(R, 3, { a: 0.05, b: 0.25, min: 0.4 }) + brush([[cx - bw + 1, baseY], [cx, baseY + 1.6], [cx + bw - 1, baseY]], 2.6, { a: 0.2, b: 0.2 }))
      rimBack.setAttribute('d', brush(arc(cx, rimY, rw, ry, 182, 358, 18), 1.4, { a: 0.1, b: 0.1, min: 0.5 }))
      rimFront.setAttribute('d', brush(arc(cx, rimY, rw, ry, 0, 180, 18), 2.6, { a: 0.1, b: 0.2, min: 0.35 }))
      band.setAttribute('d', brush(arc(cx, rimY + 12 + 4 * m, rw - 3 - 2 * m, ry, 18 + 30 * m, 162 - 10 * m, 14), 2.4, { a: 0.2, b: 0.3, min: 0.3 }))
      // the handle drifts across the cup and lands on the other side
      const side = Math.cos(Math.PI * smooth(0.15, 0.85, m))
      const hx = cx + side * (rw + 5)
      const hs = Math.max(0.25, Math.abs(side))
      handle.setAttribute('d', brush(side >= 0 ? arc(hx - 4, rimY + 17, 10 * hs, 11, -78, 86, 14) : arc(hx + 4, rimY + 17, 10 * hs, 11, 94, 258, 14), 3.4, { a: 0.1, b: 0.2, min: 0.4 }))
      handle.setAttribute('opacity', String(0.4 + 0.6 * hs))
      saucerFill.setAttribute('d', ell(cx, baseY + 1, 46, 7.5))
      saucer.setAttribute('d', brush(arc(cx, baseY + 1, 46, 7.5, 8, 172, 20), 2.8, { a: 0.1, b: 0.3, min: 0.3 }) + brush(arc(cx, baseY + 1, 46, 7.5, 196, 344, 16), 1.2, { a: 0.2, b: 0.2, min: 0.4 }))
      steam.forEach((p, i) => {
        const ph = t * Math.PI * 4 + i * 2.1
        const x0 = cx - 12 + i * 12
        const pts: Pt[] = []
        for (let k = 0; k <= 6; k++) pts.push([x0 + Math.sin(ph + k * 0.9) * (2 + k * 0.8), rimY - 6 - k * 6.5])
        p.setAttribute('d', brush(pts, 2.2, { a: 0.3, b: 0.6, min: 0.15 }))
        p.setAttribute('opacity', String(0.5 + 0.4 * Math.sin(ph * 0.5 + i)))
      })
    },
  }
}

// ───────── Clip 2 · a waving hand: for a moment it has six fingers ─────────
/** A finger drawn the sumi-e way: a light wash body, a tapered outline, two knuckle creases. */
function finger(x: number, y: number, deg: number, len: number, w: number) {
  const a = (deg * Math.PI) / 180
  const u: Pt = [Math.sin(a), -Math.cos(a)]
  const n: Pt = [-u[1], u[0]]
  const at = (k: number, side: number, hw: number): Pt => [x - u[0] * 4 + u[0] * (len + 4) * k + n[0] * side * hw, y - u[1] * 4 + u[1] * (len + 4) * k + n[1] * side * hw]
  const hw0 = w / 2
  const hw1 = w * 0.4
  const tipC: Pt = [x + u[0] * (len - hw1), y + u[1] * (len - hw1)]
  const kTip = (len + 4 - hw1) / (len + 4)
  const L: Pt[] = [at(0, -1, hw0), at(0.5, -1, hw0 * 0.94), at(kTip, -1, hw1)]
  const cap: Pt[] = Array.from({ length: 7 }, (_, i) => {
    const th = ((i + 1) / 8) * Math.PI
    return [tipC[0] - n[0] * hw1 * Math.cos(th) + u[0] * hw1 * Math.sin(th), tipC[1] - n[1] * hw1 * Math.cos(th) + u[1] * hw1 * Math.sin(th)] as Pt
  })
  const R: Pt[] = [at(kTip, 1, hw1), at(0.5, 1, hw0 * 0.94), at(0, 1, hw0)]
  const outline = [...L, ...cap, ...R]
  const crease = (k: number) => brush([at(k, -0.55, hw0), at(k, 0.55, hw0)], 0.8, { a: 0.2, b: 0.2, min: 0.4, straight: true })
  return {
    fill: poly(outline),
    line: brush(outline, 1.45, { a: 0.08, b: 0.12, min: 0.3, wob: 0.12 }),
    crease: crease(0.42) + crease(0.68),
  }
}

function handClip(g: SVGGElement): Clip {
  const win: [number, number] = [0.36, 0.74]
  // two bamboo stalks behind, quiet
  const bamboo = s('g')
  for (const [x, w, op] of [[196, 6, 0.32], [214, 4.4, 0.22]] as const) {
    bamboo.append(path(brush([[x, 0], [x + 1, 180]], w, { a: 0, b: 0, min: 1, straight: true }), 'k2', { 'fill-opacity': op }))
    for (let y = 26 + (x % 7) * 4; y < 180; y += 38) bamboo.append(path(brush([[x - w * 0.9, y], [x + w * 0.9, y - 1]], 1.4, { a: 0.2, b: 0.2, min: 0.5 }), 'k', { 'fill-opacity': op + 0.2 }))
  }
  bamboo.append(path(brush([[197, 64], [182, 58], [166, 62]], 4, { a: 0.05, b: 0.7, min: 0.1 }), 'm', { 'fill-opacity': 0.55 }), path(brush([[197, 66], [180, 74], [170, 86]], 3.4, { a: 0.05, b: 0.7, min: 0.1 }), 'm', { 'fill-opacity': 0.45 }))
  // a wide robe sleeve, brushed folds
  const sleeve = path(poly([[82, 182], [101, 145], [139, 145], [160, 182]]), 'k2', { 'fill-opacity': 0.14 })
  const sleeveL = path(brush([[102, 145], [93, 163], [82, 182]], 2.6, { a: 0.1, b: 0.2 }), 'k2')
  const sleeveR = path(brush([[138, 145], [148, 163], [160, 182]], 2.6, { a: 0.1, b: 0.2 }), 'k2')
  const fold = path(brush([[115, 152], [112, 167], [107, 182]], 1.1, { a: 0.2, b: 0.4, min: 0.3 }) + brush([[129, 154], [133, 168], [138, 182]], 0.9, { a: 0.2, b: 0.4, min: 0.3 }), 'k3')
  const cuff = path(brush([[100, 146], [120, 149], [140, 146]], 3.4, { a: 0.1, b: 0.1, min: 0.5 }), 'k2')
  const hand = s('g')
  // the wash is one layer (group opacity), so overlapping fingers never darken each other
  const wash = s('g', { opacity: 0.13 })
  const palm = 'M106 132C102 117 102 101 107 90C114 84 131 84 136 89C141 99 141 115 136 132Z'
  wash.append(path(palm, 'k'), path(poly([[108, 128], [109, 150], [133, 150], [134, 128]]), 'k'))
  const fWash = [0, 1, 2, 3, 4].map(() => {
    const p = path('', 'k')
    wash.append(p)
    return p
  })
  const contour = path(brush([[108, 91], [103, 104], [103, 118], [107, 133], [109, 150]], 1.7, { a: 0.1, b: 0.1, min: 0.3 }) + brush([[136, 92], [140, 106], [137, 121], [133, 135], [132, 150]], 1.9, { a: 0.1, b: 0.1, min: 0.3 }), 'k2')
  const palmLine = path(brush([[111, 121], [118, 111], [129, 106]], 0.9, { a: 0.2, b: 0.4, min: 0.3 }) + brush([[113, 131], [123, 127], [131, 128]], 0.8, { a: 0.3, b: 0.4, min: 0.3 }), 'k3')
  const lines = path('', 'k2')
  const creases = path('', 'k3')
  const sixWash = path('', 'v', { 'fill-opacity': 0.3 })
  const sixLine = path('', 'v')
  hand.append(wash, sixWash, contour, palmLine, lines, creases, sixLine)
  g.append(bamboo, sleeve, hand, fold, sleeveL, sleeveR, cuff)
  // base x, base y, angle (deg from up), length
  const F: [number, number, number, number][] = [
    [110.5, 89, -11, 28],
    [118.5, 85, -3.5, 33],
    [127, 85, 4, 31],
    [134.5, 89, 12, 24],
  ]
  return {
    win,
    spot: { x: 126, y: 72, r: 40 },
    update(t, stuck) {
      const m = stuck ? 1 : bump(t, win)
      const wave = stuck ? 4 : 13 * Math.sin(t * Math.PI * 4)
      hand.setAttribute('transform', `rotate(${wave.toFixed(2)} 120 142)`)
      const spread = 1 + 0.25 * m
      let ld = ''
      let cd = ''
      F.forEach(([x, y, a, len], i) => {
        const f = finger(x + (i === 3 ? 1.5 * m : 0), y, a * spread + (i === 3 ? 5 * m : 0), len, i === 3 ? 6 : 6.6)
        fWash[i].setAttribute('d', f.fill)
        ld += f.line
        cd += f.crease
      })
      const th = finger(104, 115, -52, 25, 7.2)
      fWash[4].setAttribute('d', th.fill)
      lines.setAttribute('d', ld + th.line)
      creases.setAttribute('d', cd)
      // the extra finger grows beside the little one, tinted so it can be found
      if (m > 0.02) {
        const six = finger(138.5, 96, 30 + 6 * m, 5 + 17 * m, 5.6)
        sixWash.setAttribute('d', six.fill)
        sixLine.setAttribute('d', six.line)
      } else {
        sixWash.setAttribute('d', '')
        sixLine.setAttribute('d', '')
      }
    },
  }
}

// ───────── Clip 3 · a shop sign swaying: the letters wobble and change ─────────
function signClip(g: SVGGElement, word: string, variants: string[]): Clip {
  const win: [number, number] = [0.38, 0.76]
  const wall = path(poly([[0, 34], [240, 34], [240, 180], [0, 180]]), 'k', { 'fill-opacity': 0.03 })
  const r = rng(5)
  const grid = s('g', { class: 'k3', 'fill-opacity': 0.3 })
  for (const x of [28, 58, 182, 212]) grid.append(path(brush([[x, 46], [x + (r() - 0.5) * 2, 176]], 1, { a: 0.1, b: 0.2, min: 0.5 }), 'k3'))
  for (const y of [86, 128]) {
    grid.append(path(brush([[24, y], [64, y + 1]], 1, { a: 0.1, b: 0.2, min: 0.5 }), 'k3'))
    grid.append(path(brush([[178, y], [216, y - 1]], 1, { a: 0.1, b: 0.2, min: 0.5 }), 'k3'))
  }
  const roofWash = path('M-4 0H244V24C210 32 160 36 120 36C80 36 30 32 -4 24Z', 'k', { 'fill-opacity': 0.12 })
  const roof = path(brush([[-6, 20], [36, 31], [120, 36], [204, 31], [246, 20]], 6, { a: 0.04, b: 0.06, min: 0.5 }), 'k')
  // the eave: tile rows as soft ink bands, round tile ends along the edge
  const tiles = s('g')
  for (const [y, op] of [[6, 0.35], [14, 0.25]] as const) tiles.append(path(brush([[-6, y], [120, y + 3], [246, y]], 5, { a: 0.02, b: 0.02, min: 0.7 }), 'k2', { 'fill-opacity': op }))
  for (let x = 4; x < 240; x += 12) {
    const y = 21 + 4 * Math.sin((x / 240) * Math.PI) * 1.5
    tiles.append(path(ell(x, y, 3.2), 'k', { 'fill-opacity': 0.75 }))
  }
  const board = s('g')
  const strings = path(brush([[96, 36], [86, 72]], 1.2, { a: 0, b: 0, min: 1, straight: true }) + brush([[144, 36], [154, 72]], 1.2, { a: 0, b: 0, min: 1, straight: true }), 'k2')
  const plank = path('M78 72H162V114H78Z', 'wood')
  const plankEdge = path(brush([[78, 72], [162, 72], [162, 114], [78, 114], [78, 72]], 2.2, { a: 0.02, b: 0.04, min: 0.5, straight: true }), 'k')
  const grain = path(brush([[84, 80], [120, 79], [156, 81]], 0.8, { a: 0.2, b: 0.3 }) + brush([[86, 107], [128, 108], [154, 106]], 0.8, { a: 0.2, b: 0.3 }), 'k', { 'fill-opacity': 0.25 })
  const text = s('text', { x: 120, y: 99, class: 't08g-word', 'text-anchor': 'middle', 'font-size': 17 }, word)
  // a faint double of the true word stays where the letters should be, so the jump shows
  const ghost = s('text', { x: 120, y: 99, class: 't08g-word t08g-ghost', 'text-anchor': 'middle', 'font-size': 17, opacity: 0 }, word)
  const tGroup = s('g', null, text)
  board.append(strings, plank, grain, plankEdge, ghost, tGroup)
  const lantern = s('g')
  lantern.append(
    path(brush([[198, 34], [198, 58]], 1.2, { a: 0, b: 0, min: 1, straight: true }), 'k2'),
    path(ell(198, 76, 13, 17), 'v', { 'fill-opacity': 0.9 }),
    path(brush(arc(198, 76, 7, 17, -90, 90, 10), 1, { a: 0.2, b: 0.2 }) + brush(arc(198, 76, 7, 17, 90, 270, 10), 1, { a: 0.2, b: 0.2 }), 'k', { 'fill-opacity': 0.35 }),
    path('M191 58H205V62H191ZM191 91H205V95H191Z', 'k'),
    path(brush([[198, 95], [198, 108]], 1.6, { a: 0, b: 0.4 }), 'k2'),
  )
  g.append(wall, grid, roofWash, tiles, roof, lantern, board)
  return {
    win,
    spot: { x: 120, y: 93, r: 40 },
    update(t, stuck) {
      const sway = 2.2 * Math.sin(t * Math.PI * 2 * 2)
      board.setAttribute('transform', `rotate(${sway.toFixed(2)} 120 36)`)
      lantern.setAttribute('transform', `rotate(${(-3.5 * Math.sin(t * Math.PI * 4 + 0.8)).toFixed(2)} 198 34)`)
      const m = bump(t, win)
      if (stuck) {
        // found: hold one plainly wrong state — swapped letters, a hard slant, uneven stretch
        text.textContent = variants[variants.length - 1] ?? word
        tGroup.setAttribute('transform', 'translate(120 93) skewX(-12) scale(1.02 0.86) translate(-120 -93) translate(-2 -2)')
        text.setAttribute('opacity', '1')
        ghost.setAttribute('opacity', '0.22')
      } else if (m > 0.05) {
        ghost.setAttribute('opacity', (0.18 * m).toFixed(2))
        const step = Math.floor(t * 40)
        const k = Math.floor(((step * 2654435761) >>> 0) % 1000 / 1000 * (variants.length + 1))
        text.textContent = k < variants.length ? variants[k] : word
        const q = rng(step + 3)
        tGroup.setAttribute('transform', `translate(120 93) skewX(${((q() - 0.5) * 22 * m).toFixed(1)}) scale(${(1 + (q() - 0.5) * 0.18 * m).toFixed(3)} ${(1 + (q() - 0.5) * 0.24 * m).toFixed(3)}) translate(-120 -93)`)
        text.setAttribute('opacity', String(1 - 0.25 * m * q()))
      } else {
        text.textContent = word
        tGroup.removeAttribute('transform')
        text.setAttribute('opacity', '1')
        ghost.setAttribute('opacity', '0')
      }
    },
  }
}

/** Scene 2 — three little clips, each with one glitch to find: objects morph, hands go wrong, text wobbles. */
export function glitchScene(ctx: SceneCtx) {
  const root = h('div', { class: 't08 t08g' })
  const grid = h('div', { class: 't08g-grid', role: 'group', 'aria-label': G.group })
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  root.append(grid, live)
  ctx.art.append(root)
  ctx.prompt(G.prompt)
  const stable = stableHeight(ctx, [[G.insight, G.detail]])

  const builders = [cupClip, handClip, (g: SVGGElement) => signClip(g, G.clips[2].word ?? '', G.clips[2].variants ?? [])]
  const found = new Set<number>()
  const cards = G.clips.map((c, i) => {
    const cid = nextId('t08g')
    const content = s('g', { 'clip-path': `url(#${cid})` })
    const ringMask = nextId('t08gm')
    const ringLine = s('path', { class: 't08-mask', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 })
    const ring = s('g', { mask: `url(#${ringMask})`, opacity: 0 })
    const ripples = s('g')
    const holes = s('g', { class: 't08g-holes' })
    for (let x = 10; x < VW - 4; x += 15) holes.append(s('rect', { x, y: 4, width: 5, height: 3.4, rx: 1.4 }), s('rect', { x, y: VT - 7.4, width: 5, height: 3.4, rx: 1.4 }))
    // the picture's edge: four brush strokes that overlap at the corners
    const fr = rng(20 + i)
    const sideL = (p: Pt, q: Pt, w: number) => brush([p, [(p[0] + q[0]) / 2 + (fr() - 0.5), (p[1] + q[1]) / 2 + (fr() - 0.5)], q], w, { a: 0.03, b: 0.08, min: 0.5 })
    const frameLine = path(sideL([-1, 0.3], [VW + 1, 0], 1.3) + sideL([VW - 0.3, -1], [VW, VH + 1], 1.1) + sideL([VW + 1, VH - 0.3], [-1, VH], 1.5) + sideL([0.3, VH + 1], [0, -1], 1.1), 'k2', { 'fill-opacity': 0.75, filter: ctx.quality === 'low' ? null : 'url(#ink-rough)' })
    const svg = s('svg', { class: 't08g-svg', viewBox: `0 0 ${VW} ${VT}`, 'aria-hidden': 'true' },
      s('defs', null,
        s('clipPath', { id: cid }, s('rect', { width: VW, height: VH, rx: 2 })),
        s('mask', { id: ringMask, maskUnits: 'userSpaceOnUse', x: -20, y: -20, width: VW + 40, height: VH + 40 }, ringLine)),
      s('rect', { class: 't08g-film', width: VW, height: VT, rx: 9 }),
      holes,
      s('g', { transform: `translate(0 ${BAND})` }, s('rect', { class: 'card', width: VW, height: VH, rx: 2 }), content, frameLine, ring, ripples))
    const clip = builders[i](content)
    // the playhead under the picture; the glitch stretch is marked once found
    const mark = h('i', { class: 't08g-mark', style: `left:${clip.win[0] * 100}%;width:${(clip.win[1] - clip.win[0]) * 100}%` })
    const head = h('i', { class: 't08g-head' })
    const bar = h('span', { class: 't08g-bar', 'aria-hidden': 'true' }, mark, head)
    const btn = h('button', { class: 't08g-card', type: 'button', 'aria-label': c.aria }, svg, bar)
    const name = h('p', { class: 't08g-name' }, h('span', { class: 't08g-dot', 'aria-hidden': 'true' }), h('span', null, c.name))
    const cell = h('div', { class: 't08g-cell' }, btn, name)
    grid.append(cell)
    // the ring: one brushed ensō around the glitch
    const { x, y, r } = clip.spot
    const pts = arc(x, y, r, r * 0.86, -110, 232, 40).map(([px, py], k) => [px + Math.sin(k * 0.7) * 1.2, py] as Pt)
    ring.append(s('path', { class: 'v', d: brush(pts, 4.2, { a: 0.05, b: 0.45, min: 0.2, wob: 0.16 }), filter: ctx.quality === 'low' ? null : 'url(#ink-rough)' }))
    ringLine.setAttribute('d', `M${pts.map((p) => p.join(' ')).join('L')}`)
    ringLine.setAttribute('stroke-width', '14')
    let misses = 0
    const freeze = (clip.win[0] + clip.win[1]) / 2
    const state = { clip, svg, btn, name, ring, ringLine, ripples, head, mark, freeze, t: (i * 0.29) % 1 }

    btn.addEventListener('click', (e) => {
      if (found.has(i)) return
      // keyboard (detail 0) reveals; a tap must land on the glitch (or close enough after a few tries)
      if (e.detail > 0) {
        const p = toClip(svg, e.clientX, e.clientY)
        if (p && Math.hypot(p.x - x, p.y - BAND - y) > r * 1.25 && ++misses < 3) {
          miss(state, p.x, p.y - BAND)
          return
        }
      }
      reveal(i)
    })
    return state
  })

  function toClip(svg: SVGSVGElement, cx: number, cy: number) {
    const m = svg.getScreenCTM()
    if (!m) return null
    return new DOMPoint(cx, cy).matrixTransform(m.inverse())
  }

  function miss(st: (typeof cards)[number], x: number, y: number) {
    ctx.chime('tap')
    const c = s('circle', { cx: x, cy: y, r: 4, class: 't08g-miss' })
    st.ripples.append(c)
    if (ctx.reduced) return void setTimeout(() => c.remove(), 600)
    ctx.anim(() => gsap.to(c, { attr: { r: 26 }, opacity: 0, duration: 1.1, ease: 'power2.out', onComplete: () => c.remove() }))
  }

  function reveal(i: number) {
    const st = cards[i]
    found.add(i)
    st.t = st.freeze
    st.clip.update(st.t, true)
    st.btn.classList.add('found')
    st.btn.setAttribute('aria-pressed', 'true')
    st.name.lastElementChild!.textContent = G.clips[i].found
    st.name.classList.add('found')
    live.textContent = fill(G.found, { name: G.clips[i].found })
    ctx.chime('soft')
    ctx.anim(() => {
      st.ring.setAttribute('opacity', '1')
      if (ctx.reduced) st.ringLine.setAttribute('stroke-dashoffset', '0')
      else {
        gsap.fromTo(st.ringLine, { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 1.1, ease: 'power2.inOut' })
        gsap.fromTo(st.name, { opacity: 0.2, y: 4 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
      }
    })
    if (found.size === cards.length) setTimeout(() => ctx.insight(G.insight, G.detail), ctx.reduced ? 0 : 900)
  }

  const draw = () => {
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]
      c.clip.update(c.t, found.has(i))
      c.head.style.left = `${(c.t * 100).toFixed(2)}%`
    }
  }
  draw()
  // the clips play until every glitch is found (found ones hold still)
  const play = createLoop(grid, (_, dt) => {
    for (let i = 0; i < cards.length; i++) if (!found.has(i)) cards[i].t = (cards[i].t + dt / PERIOD) % 1
    draw()
    if (found.size === cards.length) return false
  })
  if (!ctx.reduced) play.start()

  // ───────── layout: three in a row when wide; two over one when tall ─────────
  function layout(W: number, Hh: number) {
    const H = stable.H(Hh)
    const wide = W / H > 1.35
    const gap = Math.max(12, Math.min(28, W * 0.025))
    const lab = 34
    const cw = wide ? Math.min((W - gap * 2) / 3, ((H - lab) * VW) / VT, 460) : Math.min((W - gap) / 2, (((H - gap - lab * 2) / 2) * VW) / VT, 320)
    root.style.setProperty('--cw', `${Math.floor(cw)}px`)
    root.style.setProperty('--gap', `${gap}px`)
    root.style.height = `${H}px`
    root.classList.toggle('tall', !wide)
    // spare height in a row: the three prints are laid a little off-line, like frames set down on sand
    const spare = wide ? H - (cw * VT) / VW - lab - 16 : 0
    const off = Math.max(0, Math.min(spare * 0.25, 26))
    cards.forEach((c, i) => c.btn.parentElement!.style.setProperty('--dy', `${([-0.8, 0.9, -0.15][i] * off).toFixed(1)}px`))
  }
  const unwatch = watchSize(ctx.art, layout)
  layout(ctx.art.clientWidth, ctx.art.clientHeight)
  stable.afterFonts(() => layout(ctx.art.clientWidth, ctx.art.clientHeight))

  if (!ctx.reduced) gsap.from(cards.map((c) => c.btn.parentElement), { opacity: 0, y: 18, filter: 'blur(6px)', duration: 1.2, stagger: 0.14, ease: 'power3.out', delay: 0.2, clearProps: 'filter' })

  return () => {
    play.dispose()
    unwatch()
  }
}

