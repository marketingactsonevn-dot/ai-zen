import raw from '../../content/tram-31.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { clamp, onSize } from '../../ui/part2/ink'
import { grass, hills, mist, moon, reeds, steppingStones, toro } from '../../ui/part2/paint'
import { guide, type Mark } from '../../ui/part2/guide'
import { findTakeaway, foldedTakeaway } from '../../ui/part2/takeaway'
import type { SceneCtx } from '../types'
import { blob, live, rng, stroke, type Pt } from './kit'
import './card.css'

const K = raw.scenes.card
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
// the marks are brushed strokes, not ✓ ✗ characters: those glyphs are in no web font, and the first system-font fallback
// lookup costs a ~50 ms layout at CPU 4× on entering the scene
const GLYPH: Record<string, string> = { ok: 'M2 11L7 16L18 3', no: 'M3 3L17 17M17 3L3 17', warn: 'M5 6Q5 1 10 1Q15 1 15 6Q15 9 10 11V14M10 18.2V18.6' }
const glyph = (k: string) => s('svg', { class: 't31c2-glyph', viewBox: '0 0 20 20', 'aria-hidden': 'true' }, s('path', { d: GLYPH[k] ?? '' }))

/** a grainy ink dab, alpha only (tinted when drawn): built once for the module */
let dabTile: HTMLCanvasElement | null = null
function dabSprite(): HTMLCanvasElement {
  if (dabTile) return dabTile
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const img = g.createImageData(64, 64)
  const r = rng(3141)
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x - 31.5, y - 31.5) / 32
      const soft = Math.max(0, 1 - d ** 2.2)
      // cloth grain: the pad leaves speckle at its rim, solid ink at its heart
      const a = soft * (0.7 + 0.3 * r()) * (r() < 0.2 * (1 - soft) ? 0.2 : 1)
      img.data.set([255, 255, 255, Math.round(Math.min(1, a * 1.15) * 255)], (y * 64 + x) * 4)
    }
  g.putImageData(img, 0, 0)
  return (dabTile = c)
}

/** two #rrggbb colours mixed (t = share of b) */
function mix(a: string, b: string, t: number): string {
  const p = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16) || 0)
  const A = p(a), Bc = p(b)
  const c = A.map((v, i) => Math.round(v + (Bc[i] - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
const rgba = (hex: string, a: number) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0).join(',')},${a})`
const oval = (x: number, y: number, rx: number, ry: number) => `M${f1(x - rx)} ${f1(y)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0Z`

type Row = { y: number; h: number; x: number; w: number; cells: Uint8Array; nx: number; ny: number; got: number; open: boolean }
const canvas = () => document.createElement('canvas')

/** The cloth ink pad (tampo), viewBox −50 −62 100 100, its foot at y = 33: a soaked ball of cloth gathered at the neck by
 *  a cord, the spare cloth flaring above; moonlit on its upper left, black with ink where it presses. */
function padArt(): SVGSVGElement {
  const folds = stroke([[-27, 17], [-18, 4], [-7, -9]], 1.5, 0.3, 0.3, 0.2) + stroke([[-8, 26], [-6, 8], [-2, -9]], 1.3, 0.3, 0.3, 0.2) +
    stroke([[16, 25], [12, 8], [4, -9]], 1.3, 0.3, 0.3, 0.2) + stroke([[31, 14], [20, 2], [7, -9]], 1.5, 0.3, 0.3, 0.2)
  return s('svg', { class: 't31c2-padart', viewBox: '-50 -62 100 100', 'aria-hidden': 'true' },
    s('path', { class: 't31c2-pad-tuft', d: 'M-8 -13C-7 -20 -6 -25 -9 -30C-16 -32 -19 -37 -15 -41C-10 -44 -4 -40 0 -42C5 -45 12 -43 14 -38C16 -33 11 -30 8 -29C6 -24 7 -19 8 -13Z' }),
    s('path', { class: 't31c2-pad-tuftlit', d: stroke([[-13, -39], [-7, -41], [-1, -40]], 1.5, 0.2, 0.3, 0.2) + stroke([[-5, -28], [-4.5, -21], [-5, -15]], 1.2, 0.2, 0.3, 0.2) }),
    s('path', { class: 't31c2-pad-fold', d: stroke([[-2, -40], [0, -34], [-1, -29]], 1, 0.2, 0.3, 0.2) + stroke([[6, -41], [5, -35], [3, -30]], 1, 0.2, 0.3, 0.2) }),
    s('path', { class: 't31c2-pad-body', d: 'M-7 -12C-25 -10 -38 4 -38 18C-38 28 -26 33 0 33C26 33 38 28 38 18C38 4 25 -10 7 -12Z' }),
    s('path', { class: 't31c2-pad-shade', d: 'M7 -12C25 -10 38 4 38 18C38 28 26 33 0 33C18 30 28 22 26 10C24 0 16 -8 7 -12Z' }),
    s('path', { class: 't31c2-pad-ink', d: 'M-37.5 20C-36 29 -24 33 0 33C24 33 37 29 37.5 20C28 27 -28 27 -37.5 20Z' }),
    s('path', { class: 't31c2-pad-fold', d: folds }),
    s('path', { class: 't31c2-pad-tie', d: 'M-10 -16Q0 -11 10 -16L10 -10Q0 -5 -10 -10Z' }),
    s('path', { class: 't31c2-pad-lit', d: stroke([[-33, 13], [-26, 0], [-12, -9]], 2.8, 0.2, 0.3, 0.2) }))
}

/**
 * Scene 3 — a thick, low granite stele on the mossy ground at the edge of the village, seen three-quarters under a moon
 * low on the left, a stone lantern to its right: a damp sheet of washi is tied round it with a cord, hiding the six
 * carved lines of a model card. Take the cloth pad from the inkstone and dab the paper from the top down: sumi takes only
 * where the stone stands up, so each carved line comes out white on black, one line at a time. Each line opened gets a
 * tick on the stone's margin and a mark in the rubbing (fine / stop / check) for the job written above the reading; when
 * all six are up the rubbing stays on the stone and its folded copy (the take-away card) lies by the inkstone.
 */
export function cardScene(ctx: SceneCtx) {
  const low = ctx.quality === 'low'
  const still = ctx.reduced || low
  const lines = K.lines
  const read = live('t31c2-read')
  const task = h('p', { class: 't31c2-task' }, K.task)
  // decode the stone once, where it stands: it is the model card (no aria-live yet: filled before the first line)
  read.append(task, h('p', { class: 't31c2-readp' }, K.decode))
  const say = live('visually-hidden')
  const stoneCv = h('canvas', { class: 't31c2-stone', 'aria-hidden': 'true' })
  const paperCv = h('canvas', { class: 't31c2-paper', 'aria-hidden': 'true' })
  const puddle = h('canvas', { class: 't31c2-puddle', 'aria-hidden': 'true' })
  const rows = lines.map((ln, n) => h('button', { class: 't31c2-row', type: 'button', 'aria-label': fill(K.lineAria, { n: n + 1, label: ln.label }), onClick: () => auto(n) }))
  // the tally on the stone's margin (one notch per line) and the mark brushed into the rubbing once a line is read
  const ticks = lines.map(() => h('i', { class: 't31c2-tick', 'aria-hidden': 'true' }))
  const marks = lines.map((ln) => h('span', { class: 't31c2-mark', 'data-mark': ln.mark, 'aria-hidden': 'true' }, glyph(ln.mark)))
  const face = h('div', { class: 't31c2-face' }, stoneCv, paperCv, ...ticks, ...marks, ...rows)
  // the slab's thickness: its right flank, turned back from the face, the cord running round it to a knot
  const side = h('div', { class: 't31c2-side' }, h('div', { class: 't31c2-sidecord' }), h('div', { class: 't31c2-knot' }))
  const stele = h('div', { class: 't31c2-stele' }, face, side)
  const stage = h('div', { class: 't31c2-stage' }, stele)
  const pad = h('div', { class: 't31c2-pad', 'aria-hidden': 'true' }, padArt())
  const back = s('svg', { class: 't31c2-back', 'aria-hidden': 'true' })
  const fore = s('svg', { class: 't31c2-fore', 'aria-hidden': 'true' })
  const lead = s('svg', { class: 't31c2-lead', 'aria-hidden': 'true' })
  const take = h('div', { class: 't31c2-take' })
  const root = h('div', { class: 'g11 g11-nomoon t31c2', role: 'group', 'aria-label': K.aria },
    back, h('p', { class: 'visually-hidden' }, K.art), stage, puddle, fore, lead, pad, read, take, say)
  ctx.art.append(root)
  const gd = guide(ctx)
  // H1: the pad waits on the inkstone with the vermilion dot until the first line is read
  let dot: Mark | null = gd.dot(pad, { dir: [0.5, -1] })
  // H4: the tally, cut over the stele's crown
  let cnt: Pt = [0, 0]
  const tally = gd.count(K.count, lines.length, () => cnt)

  // ── colours (read on mount and on a theme change)
  const C = { paper: '', paperHi: '', paperLo: '', ink: '', stoneHi: '', stoneMid: '', stoneLo: '', moss: '', groove: '', lit: '', seal: '', serif: '', sans: '', water: '', moon: '', dark: false }
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement)
    const v = (n: string) => cs.getPropertyValue(n).trim()
    const dark = document.documentElement.dataset.theme === 'dark'
    // washi stays pale paper at night too (moonlit), so the black sumi and the white letters read in both themes
    const paper = dark ? mix(mix(v('--step-hi'), v('--step-mid'), 0.3), v('--moon'), 0.18) : mix(v('--card'), v('--step-mid'), 0.1)
    Object.assign(C, {
      dark, paper,
      paperHi: dark ? mix(paper, v('--moon'), 0.35) : v('--card'),
      paperLo: mix(paper, v('--wash'), dark ? 0.32 : 0.16),
      ink: '#07080d',
      stoneHi: v('--rock-hi'), stoneMid: v('--rock-mid'), stoneLo: v('--rock-lo'), moss: v('--moss-b'),
      groove: dark ? '#000000' : v('--wash'), lit: dark ? v('--moon') : '#ffffff', seal: v('--vermilion'),
      serif: v('--serif') || 'serif', sans: v('--sans') || 'sans-serif', water: v('--water'), moon: v('--moon'),
    })
  }
  readColors()

  // ── geometry (CSS px of the face), the per-line ink grid, and the layers of the paper
  let fw = 0, fh = 0, dpr = 1
  let rowsG: Row[] = []
  const dabs: [number, number, number, number][] = [] // u, v, r, the ink's limit, as shares of fw (replayed after a resize or theme change)
  const base = canvas() // the bare damp sheet: fibres, creases, the cord
  const inkL = canvas() // the sumi so far (already cut away where the stone is carved)
  const mask = canvas() // what ink never reaches: the carved letters and the cord
  let done = false
  let cur = 0 // the line now taking ink (all above it are read)
  const sheetY = () => fh * 0.12, cordY = () => fh * 0.165
  /** the paper takes ink only down to the foot of the line being read: one line at a time, from the top */
  const limit = () => (cur >= lines.length ? fh : rowsG[cur] ? rowsG[cur].y + rowsG[cur].h : fh)

  /** the carved text, laid out for the face: name, mock line, six rows of label + value (a long value wraps once) */
  function layoutText(g: CanvasRenderingContext2D, draw: (t: string, x: number, y: number, font: string) => void) {
    const m = fw * 0.1
    const maxW = fw - 2 * m
    const font = (px: number, weight: number, fam: string) => `${weight} ${Math.floor(px * 10) / 10}px ${fam}`
    const fit = (t: string, px: number, weight: number, fam: string, w = maxW) => {
      g.font = font(px, weight, fam)
      return font(px * Math.min(1, w / Math.max(1, g.measureText(t).width)), weight, fam)
    }
    draw(K.model, m, fh * 0.235, fit(K.model, fw * 0.052, 600, C.serif))
    draw(K.mock, m + fw * 0.05, fh * 0.285, fit(K.mock, fw * 0.034, 500, C.sans, maxW - fw * 0.05))
    const top = fh * 0.315, rh = (fh * 0.955 - top) / lines.length
    const nx = 18
    rowsG = lines.map((ln, n) => {
      const y = top + rh * n
      draw(ln.label, m, y + rh * 0.38, fit(ln.label, Math.min(fw * 0.056, rh * 0.36), 600, C.serif, maxW * 0.7))
      const vpx = Math.min(fw * 0.045, rh * 0.29)
      g.font = font(vpx, 400, C.serif)
      if (g.measureText(ln.value).width > maxW * 1.12) {
        // too long for one line at a readable size: two lines, broken at the word nearest the middle
        const words = ln.value.split(' ')
        let best = 1, bd = Infinity
        for (let k = 1; k < words.length; k++) {
          const d = Math.abs(g.measureText(words.slice(0, k).join(' ')).width - g.measureText(words.slice(k).join(' ')).width)
          if (d < bd) (bd = d), (best = k)
        }
        const a = words.slice(0, best).join(' '), b = words.slice(best).join(' ')
        const px2 = Math.min(vpx, rh * 0.25)
        draw(a, m, y + rh * 0.64, fit(a, px2, 400, C.serif))
        draw(b, m, y + rh * 0.9, fit(b, px2, 400, C.serif))
      } else draw(ln.value, m, y + rh * 0.76, fit(ln.value, vpx, 400, C.serif))
      const old = rowsG[n]
      const ny = 3
      return { y, h: rh, x: m - 6, w: maxW + 12, cells: old?.cells ?? new Uint8Array(nx * ny), nx, ny, got: old?.got ?? 0, open: old?.open ?? false }
    })
  }

  /** the face's outline: a slab with an irregular, rounded crown (higher toward the left), straight flanks */
  function outline(g: CanvasRenderingContext2D, inset = 0) {
    const i = inset
    g.beginPath()
    g.moveTo(i, fh)
    g.lineTo(fw * 0.006 + i, fh * 0.16 + i)
    g.bezierCurveTo(fw * 0.01 + i, fh * 0.08 + i, fw * 0.07 + i, fh * 0.035 + i, fw * 0.2, fh * 0.018 + i)
    g.bezierCurveTo(fw * 0.3, fh * 0.004 + i, fw * 0.4, i, fw * 0.5, fh * 0.008 + i)
    // a chip knocked out of the crown, then the long fall to the right shoulder
    g.lineTo(fw * 0.57, fh * 0.03 + i)
    g.lineTo(fw * 0.62, fh * 0.022 + i)
    g.bezierCurveTo(fw * 0.76, fh * 0.035 + i, fw * 0.9, fh * 0.07 + i, fw * 0.97 - i, fh * 0.12 + i)
    g.quadraticCurveTo(fw - i, fh * 0.14 + i, fw - i, fh * 0.17 + i)
    g.lineTo(fw - i, fh)
    g.closePath()
  }

  /** the stone face: granite (blotches, speckle), lichen and moss from the foot, a chiselled bevel; the rows laid out */
  function drawStone() {
    const g = stoneCv.getContext('2d')
    if (!g) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, fw, fh)
    outline(g)
    const grad = g.createLinearGradient(0, 0, fw * 0.6, fh)
    grad.addColorStop(0, mix(C.stoneMid, C.stoneHi, 0.35))
    grad.addColorStop(0.55, C.stoneMid)
    grad.addColorStop(1, mix(C.stoneMid, C.stoneLo, 0.7))
    g.fillStyle = grad
    g.fill()
    g.save()
    g.clip()
    const r = rng(3142)
    for (let i = 0; i < 110; i++) {
      g.globalAlpha = 0.08 + r() * 0.16
      g.fillStyle = r() < 0.55 ? C.stoneLo : C.stoneHi
      g.beginPath()
      g.ellipse(r() * fw, r() * fh, 4 + r() * fw * 0.08, 3 + r() * fh * 0.04, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    // granite: a salt of pale feldspar and dark mica
    for (let i = 0; i < (low ? 700 : 2200); i++) {
      const dk = r() < 0.6
      g.globalAlpha = dk ? 0.25 + r() * 0.4 : 0.3 + r() * 0.4
      g.fillStyle = dk ? C.groove : C.lit
      const sz = 0.5 + r() * (dk ? 1.4 : 1)
      g.fillRect(r() * fw, r() * fh, sz, sz * (0.6 + r() * 0.6))
    }
    // moss creeping up from the foot and down the flanks
    g.fillStyle = C.moss
    for (let i = 0; i < 70; i++) {
      const edge = r() < 0.35
      const x = edge ? (r() < 0.5 ? r() * fw * 0.07 : fw - r() * fw * 0.07) : r() * fw
      const y = edge ? fh * (0.5 + r() * 0.5) : fh - r() * r() * fh * 0.08
      g.globalAlpha = 0.25 + r() * 0.35
      g.beginPath()
      g.ellipse(x, y, 3 + r() * 12, 2 + r() * 6, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
    // the text is cut under the paper: only its layout is needed here (rows, ticks, marks)
    layoutText(g, () => {})
    // a chiselled bevel round the face: moonlit on the crown and the left, in shade on the right
    const bev = Math.max(3, fw * 0.022)
    const bg = g.createLinearGradient(0, 0, fw, fh * 0.5)
    bg.addColorStop(0, rgba(C.lit.startsWith('#') ? C.lit : '#ffffff', C.dark ? 0.55 : 0.85))
    bg.addColorStop(0.6, rgba(C.lit.startsWith('#') ? C.lit : '#ffffff', C.dark ? 0.2 : 0.35))
    bg.addColorStop(1, rgba(C.groove, 0.35))
    g.lineWidth = bev * 2
    g.strokeStyle = bg
    outline(g)
    g.stroke()
    g.lineWidth = 1.2
    g.strokeStyle = rgba(C.groove, 0.45)
    outline(g, bev)
    g.stroke()
    // the paper's edge throws a thin shadow on the stone, to the right and below (the moon is up on the left)
    g.fillStyle = rgba(C.groove, C.dark ? 0.5 : 0.22)
    g.fillRect(fw * 0.925, fh * 0.13, Math.max(2, fw * 0.012), fh)
    g.restore()
    // the crown's moonlit edge (grazing from the upper left)
    g.strokeStyle = C.lit
    g.globalAlpha = 0.6
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(fw * 0.01, fh * 0.16)
    g.bezierCurveTo(fw * 0.03, fh * 0.04, fw * 0.2, 1, fw * 0.42, 1)
    g.stroke()
    g.globalAlpha = 1
    // the line buttons sit over the lines just laid out; the notches on the left margin, the marks at the right
    rows.forEach((b, n) => {
      const rw = rowsG[n]
      if (!rw) return
      Object.assign(b.style, { left: `${f1(rw.x)}px`, top: `${f1(rw.y)}px`, width: `${f1(rw.w)}px`, height: `${f1(rw.h)}px` })
      Object.assign(ticks[n].style, { top: `${f1(rw.y + rw.h * 0.42)}px` })
      Object.assign(marks[n].style, { left: `${f1(fw * 0.8)}px`, top: `${f1(rw.y - rw.h * 0.06)}px`, fontSize: `${f1(rw.h * 0.4)}px` })
    })
  }

  /** the damp washi over the face (fibres, creases catching the moon, the cord); the mask; then the ink */
  function drawPaper(pool = true) {
    for (const c of [base, inkL, mask]) (c.width = paperCv.width), (c.height = paperCv.height)
    const g = base.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const px = fw * 0.075, py = sheetY()
    const r = rng(3143)
    // the sheet: a deckled edge all round
    const sheet = new Path2D()
    sheet.moveTo(px, py + 3)
    for (let k = 1; k <= 12; k++) sheet.lineTo(px + ((fw - 2 * px) * k) / 12 + (r() - 0.5) * 2.4, py + 3 - (k / 12) * 5 + (r() - 0.5) * 2)
    for (let k = 1; k <= 14; k++) sheet.lineTo(fw - px + (r() - 0.5) * 2.4, py + ((fh - 5 - py) * k) / 14)
    for (let k = 11; k >= 0; k--) sheet.lineTo(px + ((fw - 2 * px) * k) / 12 + (r() - 0.5) * 2.4, fh - 3 + (r() - 0.5) * 1.6)
    sheet.closePath()
    const pg = g.createLinearGradient(0, py, fw * 0.7, fh)
    pg.addColorStop(0, C.paperHi)
    pg.addColorStop(1, C.paper)
    g.fillStyle = pg
    g.fill(sheet)
    g.save()
    g.clip(sheet)
    g.lineCap = 'round'
    const ks = clamp(fw / 300, 0.55, 1.2) // detail scales with the sheet
    // damp: the sheet is soaked unevenly, darker where it clings to the stone
    for (let i = 0; i < 22; i++) {
      const x = px + r() * (fw - 2 * px), y = py + r() * (fh - py)
      const rg = g.createRadialGradient(x, y, 0, x, y, fw * (0.05 + r() * 0.12))
      rg.addColorStop(0, rgba(C.paperLo, 0.12 + r() * 0.1))
      rg.addColorStop(1, rgba(C.paperLo, 0))
      g.fillStyle = rg
      g.fillRect(x - fw * 0.2, y - fw * 0.2, fw * 0.4, fw * 0.4)
    }
    // kōzo fibres: long fine hairs in the paper's own tones (not scratches)
    for (let i = 0; i < Math.round((low ? 120 : 300) * ks * ks); i++) {
      const x = r() * fw, y = py + r() * (fh - py), a = r() * Math.PI, l = (8 + r() * 30) * ks
      g.strokeStyle = r() < 0.5 ? rgba(C.paperHi, 0.55) : rgba(C.paperLo, 0.35)
      g.lineWidth = (0.3 + r() * 0.45) * ks
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l)
      g.stroke()
    }
    // creases: the sheet gathers under the cord and falls in long soft folds; each ridge is lit on its upper-left side
    // (the moon grazes from the top left) and shaded on its lower right
    const knots: Pt[] = [[fw * 0.3, cordY() + 2], [fw * 0.62, cordY() + 2], [px + 2, fh * 0.55], [fw - px - 2, fh * 0.4], [fw * 0.5, fh - 4]]
    for (let i = 0; i < 9; i++) {
      const [x0, y0] = knots[i % knots.length]
      const base = i % 5 < 2 ? Math.PI / 2 + (r() - 0.5) * 1.3 : i % 5 === 2 ? 0.25 + (r() - 0.5) * 0.8 : i % 5 === 3 ? Math.PI - 0.3 + (r() - 0.5) * 0.8 : -Math.PI / 2 + (r() - 0.5) * 1.2
      const len = fw * (0.18 + r() * 0.32)
      const x1 = x0 + Math.cos(base) * len, y1 = y0 + Math.sin(base) * len
      const cx = (x0 + x1) / 2 + (r() - 0.5) * len * 0.35, cy = (y0 + y1) / 2 + (r() - 0.5) * len * 0.35
      const w = (0.9 + r() * 1.1) * ks
      const path = (dx: number, dy: number) => {
        g.beginPath()
        g.moveTo(x0 + dx, y0 + dy)
        g.quadraticCurveTo(cx + dx, cy + dy, x1 + dx, y1 + dy)
      }
      g.strokeStyle = rgba(C.paperLo, 0.1)
      g.lineWidth = w * 9
      path(w * 3, w * 2)
      g.stroke()
      g.strokeStyle = rgba(C.paperLo, 0.42)
      g.lineWidth = w * 1.3
      path(w * 0.9, w * 0.7)
      g.stroke()
      g.strokeStyle = 'rgba(255,255,255,0.6)'
      g.lineWidth = w
      path(-w * 0.5, -w * 0.4)
      g.stroke()
    }
    // short puckers in from the edges where the paper wraps the stone
    for (let i = 0; i < Math.round(8 * ks); i++) {
      const left = r() < 0.5
      const x = left ? px + 2 : fw - px - 2
      const y = py + fh * 0.15 + r() * fh * 0.7
      const a = (left ? 0 : Math.PI) + (r() - 0.5) * 0.7
      const l = fw * (0.04 + r() * 0.06), w = (1 + r() * 1.2) * ks
      const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l
      g.lineWidth = w
      g.strokeStyle = 'rgba(255,255,255,0.5)'
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(ex, ey)
      g.stroke()
      g.strokeStyle = rgba(C.paperLo, 0.4)
      g.beginPath()
      g.moveTo(x + w * 0.8, y + w * 0.8)
      g.lineTo(ex + w * 0.6, ey + w * 0.6)
      g.stroke()
    }
    // the moon's sheen across the upper left of the sheet, the lower right in the stone's shade
    const sh = g.createRadialGradient(fw * 0.15, py, 0, fw * 0.15, py, fw * 0.95)
    sh.addColorStop(0, 'rgba(255,255,255,0.3)')
    sh.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = sh
    g.fillRect(0, 0, fw, fh)
    const lo = g.createLinearGradient(fw * 0.4, fh * 0.4, fw, fh)
    lo.addColorStop(0, rgba(C.paperLo, 0))
    lo.addColorStop(1, rgba(C.paperLo, 0.35))
    g.fillStyle = lo
    g.fillRect(0, 0, fw, fh)
    g.restore()
    // the cord tied round the stone: its shadow on the paper, then the twisted rope from edge to edge
    const cy = cordY(), cw = Math.max(2.4, fw * 0.014)
    const cord = (gg: CanvasRenderingContext2D, wid: number, dy = 0, dx = 0) => {
      gg.beginPath()
      gg.moveTo(-2 + dx, cy + dy - 1)
      gg.quadraticCurveTo(fw * 0.5 + dx, cy + dy + fh * 0.012, fw + 2 + dx, cy + dy - 3)
      gg.lineWidth = wid
      gg.stroke()
    }
    g.lineCap = 'butt'
    g.strokeStyle = rgba(C.groove, C.dark ? 0.35 : 0.22)
    cord(g, cw * 1.5, cw * 1.1, cw * 0.7)
    g.strokeStyle = mix(C.stoneLo, '#7a5a3c', 0.55)
    cord(g, cw)
    g.save()
    g.setLineDash([cw * 0.9, cw * 0.9])
    g.strokeStyle = rgba(C.lit.startsWith('#') ? C.lit : '#ffffff', 0.5)
    cord(g, cw * 0.4, -cw * 0.15)
    g.restore()
    // the mask: letters and cord, opaque
    const mg = mask.getContext('2d')!
    mg.setTransform(dpr, 0, 0, dpr, 0, 0)
    mg.fillStyle = mg.strokeStyle = '#000'
    mg.textBaseline = 'alphabetic'
    layoutText(mg, (t, x, y, font) => {
      mg.font = font
      mg.fillText(t, x, y)
    })
    cord(mg, cw * 1.2)
    const ig = inkL.getContext('2d')!
    ig.setTransform(1, 0, 0, 1, 0, 0)
    ig.clearRect(0, 0, inkL.width, inkL.height)
    for (const [u, v, rr, lv] of dabs) dab(u * fw, v * fw, rr * fw, false, false, lv * fw)
    if (low || done) fullInk()
    compose(0, 0, paperCv.width, paperCv.height)
    if (pool) drawPuddle()
  }

  /** the visible paper in a region (device px): the sheet, then the sumi over it, only on the sheet */
  function compose(sx: number, sy: number, sw: number, sh: number) {
    const g = paperCv.getContext('2d')
    if (!g || sw <= 0 || sh <= 0) return
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.clearRect(sx, sy, sw, sh)
    g.drawImage(base, sx, sy, sw, sh, sx, sy, sw, sh)
    g.globalCompositeOperation = 'source-atop'
    g.drawImage(inkL, sx, sy, sw, sh, sx, sy, sw, sh)
    g.globalCompositeOperation = 'source-over'
  }

  /** one dab of ink at (x, y) (face px): sumi where the stone stands up; the carved letters cut out of it, left white */
  const tinted = canvas()
  function tint() {
    const t = dabSprite()
    tinted.width = tinted.height = 64
    const g = tinted.getContext('2d')!
    g.clearRect(0, 0, 64, 64)
    g.drawImage(t, 0, 0)
    g.globalCompositeOperation = 'source-in'
    g.fillStyle = C.ink
    g.fillRect(0, 0, 64, 64)
    g.globalCompositeOperation = 'source-over'
  }
  tint()
  function dab(x: number, y: number, rr: number, record = true, show = true, lim = limit()) {
    const ig = inkL.getContext('2d')
    if (!ig) return
    ig.setTransform(dpr, 0, 0, dpr, 0, 0)
    ig.save()
    // the lines below the one being read do not take ink yet
    ig.beginPath()
    ig.rect(0, 0, fw, lim)
    ig.clip()
    // each press lands a little turned and squashed: the cloth's grain never repeats
    const a = (x * 7.1 + y * 3.3) % 6.28, k = 0.85 + ((x * 13 + y * 7) % 10) / 33
    ig.globalAlpha = 0.62
    ig.translate(x, y)
    ig.rotate(a)
    ig.drawImage(tinted, -rr * k, -rr, rr * 2 * k, rr * 2)
    ig.restore()
    ig.setTransform(1, 0, 0, 1, 0, 0)
    const sx = Math.max(0, Math.floor((x - rr) * dpr)), sy = Math.max(0, Math.floor((y - rr) * dpr))
    const sw = Math.min(inkL.width - sx, Math.ceil(rr * 2 * dpr) + 2), sh = Math.min(inkL.height - sy, Math.ceil(rr * 2 * dpr) + 2)
    if (sw > 0 && sh > 0) {
      ig.globalCompositeOperation = 'destination-out'
      ig.drawImage(mask, sx, sy, sw, sh, sx, sy, sw, sh)
      ig.globalCompositeOperation = 'source-over'
      if (show) compose(sx, sy, sw, sh)
    }
    if (!record) return
    dabs.push([x / fw, y / fw, rr / fw, lim / fw])
    // which cells of the line being read this dab covered
    const row = rowsG[cur]
    if (!row || y + rr < row.y || y - rr > row.y + row.h) return
    for (let j = 0; j < row.ny; j++)
      for (let i = 0; i < row.nx; i++) {
        const cx = row.x + ((i + 0.5) * row.w) / row.nx, cy = row.y + ((j + 0.5) * row.h) / row.ny
        if (!row.cells[j * row.nx + i] && Math.hypot(cx - x, cy - y) < rr * 0.85) (row.cells[j * row.nx + i] = 1), row.got++
      }
    if (!row.open && row.got >= row.cells.length * 0.6) openLine(cur)
  }
  function fullInk() {
    const ig = inkL.getContext('2d')
    if (!ig) return
    ig.setTransform(dpr, 0, 0, dpr, 0, 0)
    const r = rng(3144)
    for (let y = fh * 0.13; y < fh; y += fw * 0.04) for (let x = fw * 0.04; x < fw * 0.98; x += fw * 0.045) {
      ig.globalAlpha = 0.6 + r() * 0.3
      const k = fw * (0.045 + r() * 0.025)
      ig.drawImage(tinted, x - k + (r() - 0.5) * 6, y - k + (r() - 0.5) * 6, k * 2, k * 2)
    }
    ig.setTransform(1, 0, 0, 1, 0, 0)
    ig.globalAlpha = 1
    ig.globalCompositeOperation = 'destination-out'
    ig.drawImage(mask, 0, 0)
    ig.globalCompositeOperation = 'source-over'
  }

  /** the puddle in front: an organic pool holding the stele upside down (right under it), broken by ripples, a moon glint */
  let pondK = 0.4 // where the stele stands over the pool, as a share of its width
  function drawPuddle() {
    const g = puddle.getContext('2d')
    if (!g || !fw) return
    const w = puddle.width, hh = puddle.height
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, w, hh)
    const r = rng(3145)
    // an organic pool: an ellipse pushed in and out by a few slow waves, its outline smoothed through midpoints
    const n = 28, ph = r() * 6
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      const k = 0.86 + 0.07 * Math.sin(a * 2 + ph) + 0.05 * Math.sin(a * 3 + ph * 1.7) + (r() - 0.5) * 0.04
      return [w / 2 + Math.cos(a) * (w * 0.48) * k, hh / 2 + Math.sin(a) * (hh * 0.44) * k] as [number, number]
    })
    const shape = new Path2D()
    const mid = (i: number) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2]
    shape.moveTo(mid(0)[0], mid(0)[1])
    for (let i = 1; i <= n; i++) shape.quadraticCurveTo(pts[i % n][0], pts[i % n][1], mid(i)[0], mid(i)[1])
    shape.closePath()
    // the wet ground round it, then the water (always darker than the sky)
    g.save()
    g.filter = `blur(${Math.round(4 * dpr)}px)`
    g.fillStyle = rgba(C.groove, C.dark ? 0.55 : 0.25)
    g.translate(0, 2 * dpr)
    g.fill(shape)
    g.restore()
    g.save()
    g.clip(shape)
    g.fillStyle = C.dark ? mix(C.water, C.stoneLo, 0.12) : mix(C.water, C.groove, 0.3)
    g.fillRect(0, 0, w, hh)
    // the stele upside down, right under it, cut in slices that sway (ripples)
    const ref = canvas()
    const rw = Math.round(((fw * 0.95) / (w / dpr)) * w), rhh = Math.round((fh / fw) * rw)
    ref.width = rw
    ref.height = rhh
    const rg = ref.getContext('2d')!
    rg.translate(0, rhh)
    rg.scale(1, -1)
    rg.drawImage(stoneCv, 0, 0, rw, rhh)
    rg.drawImage(paperCv, 0, 0, rw, rhh)
    const ox = w * pondK - rw / 2, sq = 0.4 // squashed by the low view
    g.globalAlpha = C.dark ? 0.36 : 0.5
    const slice = Math.max(2, Math.round(2 * dpr))
    for (let y = 0; y < Math.min(hh, rhh * sq); y += slice) {
      const dx = Math.sin((y * 0.35) / dpr) * 2.2 * dpr * (y / hh + 0.3)
      g.drawImage(ref, 0, y / sq, rw, slice / sq, ox + dx, y, rw, slice)
    }
    g.globalAlpha = 1
    // the moon (low on the left) glinting near the pool's left, broken into bars by the ripples, and a few rings
    g.fillStyle = C.dark ? C.moon : '#ffffff'
    const mx = w * 0.14, my = hh * 0.3
    g.globalAlpha = 0.8
    g.beginPath()
    g.ellipse(mx, my, w * 0.025, hh * 0.07, 0, 0, Math.PI * 2)
    g.fill()
    g.globalAlpha = 0.45
    for (let i = 0; i < 3; i++) g.fillRect(mx - w * (0.035 - i * 0.008), my + hh * (0.12 + i * 0.08), w * (0.07 - i * 0.016), Math.max(1, hh * 0.018))
    g.strokeStyle = C.dark ? C.moon : '#ffffff'
    g.lineWidth = Math.max(1, dpr * 0.8)
    for (let i = 1; i <= 3; i++) {
      g.globalAlpha = 0.26 - i * 0.06
      g.beginPath()
      g.ellipse(w * pondK, hh * 0.62, w * 0.06 * i, hh * 0.1 * i, 0, 0, Math.PI * 2)
      g.stroke()
    }
    // darker toward its rim, where the bank shades it
    const vg = g.createRadialGradient(w / 2, hh / 2, Math.min(w, hh) * 0.2, w / 2, hh / 2, w * 0.55)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, rgba(C.groove, C.dark ? 0.55 : 0.25))
    g.globalAlpha = 1
    g.fillStyle = vg
    g.fillRect(0, 0, w, hh)
    g.restore()
    // its wet rim catching the moon on the far side
    g.strokeStyle = C.dark ? C.moon : '#ffffff'
    g.globalAlpha = 0.45
    g.lineWidth = 1.4 * dpr
    g.save()
    g.clip(new Path2D(`M0 0H${w}V${hh * 0.5}H0Z`))
    g.stroke(shape)
    g.restore()
    g.globalAlpha = 1
  }

  // ── a line comes up: what to read in it and what it means for the job, beside the stele with a fine leader to the line
  const opened = new Set<number>()
  function showLine(n: number) {
    const ln = lines[n]
    read.say(task, h('p', { class: 'p2-eyebrow' }, `${n + 1} · ${ln.label}`), h('p', { class: 't31c2-readp' }, ln.read),
      h('p', { class: 't31c2-verdict', 'data-mark': ln.mark }, h('b', null, glyph(ln.mark)), ` ${ln.verdict}`))
    say.say(`${ln.label}: ${ln.value}. ${ln.read} ${ln.verdict}.`)
    leader(n)
  }
  function openLine(n: number) {
    if (opened.has(n) || n !== cur) return
    const row = rowsG[n]
    if (row) row.open = true
    rows[n].classList.add('on')
    ticks[n].classList.add('on')
    marks[n].classList.add('on')
    opened.add(n)
    cur = opened.size
    ticks.forEach((t, k) => t.classList.toggle('next', k === cur))
    tally.set(opened.size)
    showLine(n)
    if (opened.size === 1) dot?.done(), (dot = null)
    ctx.chime('tap')
    drawPuddle()
    if (opened.size === lines.length) return finish()
    ctx.prompt(K.next)
  }
  function leader(n: number) {
    // read the row's and the panel's boxes once (event time, not in a frame)
    const rr = rows[n].getBoundingClientRect(), pr = read.getBoundingClientRect(), bs = root.getBoundingClientRect()
    if (!pr.width || root.classList.contains('tall')) return void lead.replaceChildren()
    const x0 = rr.right - bs.left, y0 = rr.top + rr.height * 0.3 - bs.top
    const x1 = pr.left - bs.left - 8, y1 = pr.top + pr.height * 0.5 - bs.top
    lead.replaceChildren(s('path', { d: `M${f1(x0)} ${f1(y0)}C${f1(x0 + 60)} ${f1(y0)} ${f1(x1 - 60)} ${f1(y1)} ${f1(x1)} ${f1(y1)}` }), s('circle', { cx: f1(x0), cy: f1(y0), r: 2.4 }))
  }
  let sweeping = false
  function finish() {
    ctx.chime('ok')
    // the rest of the sheet takes its ink too, so the whole rubbing stands white on black (it stays on the stone)
    if (still) {
      fullInk()
      compose(0, 0, paperCv.width, paperCv.height)
      return settle()
    }
    sweeping = true
    for (let y = sheetY() + fw * 0.03; y < fh; y += fw * 0.07) for (let x = fw * 0.1; x < fw * 0.95; x += fw * 0.08) queue.push([x, y, fw * 0.075])
    loop.start()
  }
  function settle() {
    done = true
    sweeping = false
    root.classList.add('t31c2-done')
    tally.done()
    // one text block: the reading gives way to the insight in the same corner of sky; the folded rubbing lies by the inkstone
    read.replaceChildren()
    read.hidden = true
    lead.replaceChildren()
    ctx.textZone('tr')
    ctx.insight(K.insight as Fact, K.detail as Fact)
    const card = findTakeaway(K.takeaway)
    if (card && !take.childElementCount) take.append(foldedTakeaway([card], ctx.onCleanup))
    drawPuddle()
  }

  // ── auto-dab along a line (keyboard Enter on a line); dabs run a few per frame
  let queue: [number, number, number][] = []
  const loop = createLoop(root, () => {
    for (let k = 0; k < (sweeping ? 8 : 2) && queue.length; k++) {
      const [x, y, rr] = queue.shift()!
      dab(x, y, rr)
    }
    if (queue.length) return true
    if (sweeping) settle()
    else drawPuddle()
    return false
  })
  ctx.onCleanup(() => loop.dispose())
  function auto(n: number) {
    if (done || sweeping) return
    if (opened.has(n)) return showLine(n) // read a line again
    const row = rowsG[cur]
    if (!row) return
    if (low) return openLine(cur)
    if (n !== cur) ctx.prompt(fill(K.order, { n: cur + 1 }), 'wrong')
    const rr = row.h * 0.55
    const q: [number, number, number][] = []
    for (let x = row.x + rr * 0.5; x < row.x + row.w; x += rr * 0.55) q.push([x, row.y + row.h * 0.32, rr], [x + rr * 0.25, row.y + row.h * 0.7, rr])
    if (still) {
      q.forEach(([x, y, r2]) => dab(x, y, r2))
      return drawPuddle()
    }
    queue = queue.concat(q)
    loop.start()
  }

  // ── pointer: take the pad from the inkstone (it follows the finger and dabs over the paper), or press the paper itself
  let down: { id: number; x: number; y: number } | null = null
  let carry: number | null = null
  let warned = false
  let rest = '' // the pad's place on the inkstone
  let padS = 60
  let box: DOMRect | null = null
  // the pad's foot (where the cloth presses) is under the finger
  const padAt = (cx: number, cy: number) => {
    if (box) pad.style.transform = `translate(${f1(cx - box.left)}px, ${f1(cy - box.top - padS * 0.42)}px)`
  }
  const sx = () => fw / Math.max(1, paperCv.clientWidth)
  /** a press at (x, y) on the face: ink it, or say which line comes first */
  function press(x: number, y: number, rr: number) {
    if (y - rr * 0.4 > limit() && !warned && cur < lines.length) {
      warned = true
      ctx.prompt(fill(K.order, { n: cur + 1 }), 'wrong')
      ticks[cur].animate?.([{ transform: 'scaleX(1)' }, { transform: 'scaleX(1.8)' }, { transform: 'scaleX(1)' }], { duration: 500 })
    }
    dab(x, y, rr)
  }
  const inkAt = (e: PointerEvent) => {
    const x = e.offsetX * sx(), y = e.offsetY * sx()
    if (!down) {
      down = { id: e.pointerId, x, y }
      return press(x, y, fw * 0.075)
    }
    if (Math.hypot(x - down.x, y - down.y) < fw * 0.03) return
    down.x = x
    down.y = y
    press(x, y, fw * 0.07)
  }
  paperCv.addEventListener('pointerdown', (e) => {
    if (done || sweeping || e.button) return
    if (low) return openLine(cur)
    paperCv.setPointerCapture(e.pointerId)
    box = root.getBoundingClientRect()
    root.classList.add('t31c2-inking')
    warned = false
    down = null
    padAt(e.clientX, e.clientY)
    inkAt(e)
  })
  paperCv.addEventListener('pointermove', (e) => {
    if (e.pointerId !== down?.id && e.pointerId !== carry) return
    padAt(e.clientX, e.clientY)
    if (carry != null && !(e.buttons & 1) && e.pointerType === 'mouse') return
    inkAt(e)
  })
  paperCv.addEventListener('pointerleave', (e) => {
    if (e.pointerId === carry) down = null // carried off the paper: the next touch down is a fresh dab
  })
  const up = (e: PointerEvent) => {
    if (e.pointerId !== down?.id && e.pointerId !== carry) return
    down = null
    carry = null
    root.classList.remove('t31c2-inking')
    removeEventListener('pointermove', follow)
    removeEventListener('pointerup', up)
    removeEventListener('pointercancel', up)
    pad.style.transform = rest
    drawPuddle()
  }
  paperCv.addEventListener('pointerup', up)
  paperCv.addEventListener('pointercancel', up)
  const follow = (e: PointerEvent) => e.pointerId === carry && padAt(e.clientX, e.clientY)
  pad.addEventListener('pointerdown', (e) => {
    if (done || sweeping || e.button) return
    if (low) return openLine(cur)
    // let go of the implicit touch capture, so the paper under the finger gets the moves
    try { pad.releasePointerCapture(e.pointerId) } catch { /* not captured */ }
    carry = e.pointerId
    down = null
    warned = false
    box = root.getBoundingClientRect()
    root.classList.add('t31c2-inking')
    padAt(e.clientX, e.clientY)
    addEventListener('pointermove', follow)
    addEventListener('pointerup', up)
    addEventListener('pointercancel', up)
  })
  ctx.onCleanup(() => {
    removeEventListener('pointermove', follow)
    removeEventListener('pointerup', up)
    removeEventListener('pointercancel', up)
  })
  // H7: standing still, the pad lifts off the inkstone and dabs once over the line waiting for ink
  const idle = () => {
    if (done || sweeping || down || carry != null || ctx.reduced || !rows[cur]) return
    const rr = rows[cur].getBoundingClientRect(), bs = root.getBoundingClientRect()
    const tx = rr.left - bs.left + rr.width * 0.3, ty = rr.top - bs.top + rr.height * 0.5 - padS * 0.42
    const over = `translate(${f1(tx)}px, ${f1(ty - padS * 0.25)}px)`
    pad.animate([{ transform: rest }, { transform: over, offset: 0.45 }, { transform: `translate(${f1(tx)}px, ${f1(ty)}px) scale(0.94, 0.9)`, offset: 0.58 }, { transform: over, offset: 0.7 }, { transform: rest }], { duration: 2400, easing: 'ease-in-out' })
  }
  ctx.el.addEventListener('p2:idle', idle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', idle))

  // ── the night garden: moon low on the left, hills in mist, mossy gravel ground to the frame's edges, the stone lantern
  type Geo = { W: number; H: number; tall: boolean; cxF: number; topF: number; by: number; gy: number; fx: number; fy: number; iw: number; quiet: number }
  function scenery(G: Geo) {
    const { W, H, tall, cxF, by, gy, fx, fy, iw } = G
    const r = rng(3160)
    const defs = s('defs', null,
      s('linearGradient', { id: 't31c2-gr', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 't31c2-gr0' }), s('stop', { offset: 0.3, class: 't31c2-gr1' }), s('stop', { offset: 1, class: 't31c2-gr2' })))
    // the ground: from the hills' misty feet to the frame's foot, edge to edge
    let gtop = `M-20 ${f1(gy + 6)}`
    for (let k = 1; k <= 8; k++) gtop += `L${f1((W * k) / 8 + 10)} ${f1(gy + Math.sin(k * 1.7) * H * 0.006 + (k % 3) * 2)}`
    const groundD = `${gtop}L${f1(W + 20)} ${f1(H + 20)}L-20 ${f1(H + 20)}Z`
    // gravel in perspective: tiny far, a thumbnail near; each with a moonlit top-left and a shadow to the lower right
    let peb = '', pebLit = '', pebSh = ''
    const nP = tall ? 110 : 220
    for (let i = 0; i < nP; i++) {
      const t = r() ** 1.25
      const y = gy + 8 + (H - gy) * t, k = (y - gy) / (H - gy)
      const x = r() * W
      if (tall && y > G.quiet) continue
      const rx = (0.6 + k * (tall ? 3.4 : 5)) * (0.5 + r() * 0.8), ry = rx * (0.38 + r() * 0.16)
      peb += oval(x, y, rx, ry)
      pebSh += oval(x + rx * 0.35, y + ry * 0.55, rx * 1.05, ry * 0.6)
      if (k > 0.2) pebLit += `M${f1(x - rx * 0.75)} ${f1(y - ry * 0.1)}Q${f1(x - rx * 0.4)} ${f1(y - ry * 0.95)} ${f1(x + rx * 0.35)} ${f1(y - ry * 0.85)}`
    }
    // moss: low cushions scattered on the gravel, thicker round the stele's foot
    let moss = ''
    for (let i = 0; i < (tall ? 10 : 18); i++) {
      const t = 0.12 + r() * 0.85, y = gy + (H - gy) * t, k = t
      const ms = tall ? 0.55 : 1
      moss += blob(r() * W, y, (12 + r() * 34) * (0.4 + k) * ms, (2.5 + r() * 5) * (0.4 + k) * ms, 3170 + i, 0.35, 12)
    }
    moss += blob(cxF, by + 1, fw * 0.55, fw * 0.045, 3190, 0.35, 16) + blob(cxF + fw * 0.45, by - 2, fw * 0.2, fw * 0.04, 3191, 0.35, 12)
    const mr = tall ? 15 : clamp(W * 0.021, 20, 32)
    const kids: (SVGElement | null)[] = [
      defs,
      moon(tall ? W * 0.13 : W * 0.12, tall ? Math.max(40, G.topF * 0.5) : H * 0.16, mr, 3161, true),
      hills(-W * 0.1, W * 1.1, gy + 4, H * (tall ? 0.12 : 0.2), 3162, 0.92, 6),
      mist(W * 0.5, gy - H * 0.05, W * 0.75, H * 0.07),
      hills(-W * 0.05, W * 0.55, gy + 6, H * (tall ? 0.06 : 0.1), 3163, 0.6, 3),
      hills(W * 0.6, W * 1.08, gy + 6, H * (tall ? 0.05 : 0.08), 3164, 0.66, 2),
      s('path', { class: 't31c2-ground', d: groundD, fill: 'url(#t31c2-gr)' }),
      mist(W * 0.5, gy + 4, W * 0.85, H * 0.03),
      s('ellipse', { class: 't31c2-sheen', cx: f1(cxF - fw * 0.2), cy: f1(by + (H - by) * 0.1), rx: f1(fw * 1.6), ry: f1((H - gy) * 0.45), fill: 'url(#p2-halo)' }),
      s('path', { class: 't31c2-pebsh', d: pebSh }),
      s('path', { class: 't31c2-peb', d: peb }),
      s('path', { class: 't31c2-peblit', d: pebLit }),
      s('path', { class: 'g11-mossy t31c2-moss', d: moss, filter: 'url(#ink-wash)' }),
      ...shrubs(G),
      tall ? null : steppingStones([W * 0.13, H * 0.985], [fx - iw * 0.15, fy + iw * 0.28], 4, W * 0.042, 3165),
    ]
    // the stone lantern to the right, a little farther back, its warm pool on the gravel and on the stele's flank
    const tx = tall ? W * 0.9 : W * 0.79, ty = tall ? by - fw * 0.12 : by - H * 0.035, TH = tall ? fw * 0.45 : H * 0.29
    kids.push(
      s('ellipse', { class: 't31c2-pool', cx: f1(tx - TH * 0.1), cy: f1(ty + TH * 0.02), rx: f1(TH * 0.9), ry: f1(TH * 0.13), fill: 'url(#p2-lamp)' }),
      s('ellipse', { class: 't31c2-pool', cx: f1(cxF + fw * 0.45), cy: f1(by + fw * 0.02), rx: f1(fw * 0.4), ry: f1(fw * 0.05), fill: 'url(#p2-lamp)' }),
      tall ? null : steppingStones([W * 0.88, H * 0.99], [tx - TH * 0.18, ty + TH * 0.16], 3, W * 0.036, 3168),
      toro(tx, ty, TH, true),
      // the stele's own shade: its contact, and the long shadow falling away from the moon (to the right and forward)
      s('path', { class: 't31c2-cast', d: blob(cxF + fw * 0.48, by + fw * 0.05, fw * 0.66, fw * 0.065, 3166, 0.12), filter: 'url(#ink-wash)' }),
      s('path', { class: 't31c2-contact', d: blob(cxF + fw * 0.06, by + 1, fw * 0.52, fw * 0.022, 3167, 0.1) }))
    back.replaceChildren(...(kids.filter(Boolean) as SVGElement[]))
  }

  /** low garden shrubs and two rocks on the far ground: dark mounds with a moonlit crown on the left, set down with a shade */
  function shrubs(G: Geo): SVGElement[] {
    const { W, H, tall, gy, cxF } = G
    const r = rng(3175)
    const spots: [number, number, number][] = tall
      ? [[W * 0.06, gy + 10, W * 0.16], [W * 0.98, gy + 8, W * 0.12]]
      : [[W * 0.05, gy + 14, W * 0.07], [W * 0.15, gy + 8, W * 0.045], [cxF + fw * 0.95, gy + 6, W * 0.05], [W * 0.95, gy + 16, W * 0.07]]
    let body = '', lit = '', shade = ''
    for (const [x, y, w] of spots) {
      shade += blob(x + w * 0.15, y + 2, w * 0.62, w * 0.07, 3176 + Math.round(x), 0.12)
      for (let k = 0; k < 4; k++) {
        const bx = x + (k - 1.5) * w * 0.28 + (r() - 0.5) * w * 0.1, rr = w * (0.2 + r() * 0.12)
        const byy = y - rr * (0.55 + r() * 0.3)
        body += blob(bx, byy, rr, rr * 0.72, 3180 + k + Math.round(x), 0.25, 14)
        lit += stroke([[bx - rr * 0.85, byy - rr * 0.1], [bx - rr * 0.45, byy - rr * 0.62], [bx + rr * 0.2, byy - rr * 0.7]], Math.max(1, rr * 0.08), 0.2, 0.3, 0.2)
      }
    }
    void H
    return [s('path', { class: 't31c2-cast', d: shade, filter: 'url(#ink-wash)' }), s('path', { class: 't31c2-shrub', d: body, filter: 'url(#ink-rough)' }), s('path', { class: 't31c2-shrublit', d: lit })]
  }

  /** in front: the inkstone the pad rests on, tufts at the stele's foot, a darker band of near ground framing the foot */
  function foreground(G: Geo) {
    const { W, H, tall, cxF, by, fx, fy, iw } = G
    const t = iw * 0.12
    const FL: Pt = [fx - iw * 0.5, fy], FR: Pt = [fx + iw * 0.36, fy - iw * 0.05], BR: Pt = [fx + iw * 0.5, fy - iw * 0.25], BL: Pt = [fx - iw * 0.35, fy - iw * 0.2]
    const P = (p: Pt, dy = 0) => `${f1(p[0])} ${f1(p[1] + dy)}`
    const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
    // the ink well (umi) at the far end, the grinding land (oka) in front of it, a raised lip all round
    const w0 = lerp(BL, FL, 0.12), w1 = lerp(BR, FR, 0.12), w2 = lerp(BR, FR, 0.42), w3 = lerp(BL, FL, 0.42)
    const inner = [lerp(lerp(BL, BR, 0.08), lerp(FL, FR, 0.08), 0.1), lerp(lerp(BL, BR, 0.92), lerp(FL, FR, 0.92), 0.1), lerp(lerp(BL, BR, 0.92), lerp(FL, FR, 0.92), 0.9), lerp(lerp(BL, BR, 0.08), lerp(FL, FR, 0.08), 0.9)] as Pt[]
    const wcx = (w0[0] + w1[0] + w2[0] + w3[0]) / 4, wcy = (w0[1] + w1[1] + w2[1] + w3[1]) / 4
    const stone = s('g', { class: 't31c2-suzuri' },
      s('path', { class: 't31c2-suz-sh', d: blob(fx + iw * 0.18, fy + t * 1.1, iw * 0.66, iw * 0.09, 3180, 0.12), filter: 'url(#ink-wash)' }),
      s('path', { class: 't31c2-suz-front', d: `M${P(FL)}L${P(FR)}L${P(FR, t)}L${P(FL, t)}Z` }),
      s('path', { class: 't31c2-suz-side', d: `M${P(FR)}L${P(BR)}L${P(BR, t)}L${P(FR, t)}Z` }),
      s('path', { class: 't31c2-suz-top', d: `M${P(FL)}L${P(FR)}L${P(BR)}L${P(BL)}Z` }),
      s('path', { class: 't31c2-suz-land', d: `M${inner.map((p) => P(p)).join('L')}Z` }),
      s('path', { class: 't31c2-suz-well', d: `M${P(w0)}L${P(w1)}L${P(w2)}Q${f1(wcx)} ${f1(Math.max(w2[1], w3[1]) + iw * 0.04)} ${P(w3)}Z` }),
      s('ellipse', { class: 't31c2-suz-wet', cx: f1(wcx - iw * 0.08), cy: f1(wcy - iw * 0.01), rx: f1(iw * 0.1), ry: f1(iw * 0.018) }),
      s('path', { class: 't31c2-suz-lit', d: stroke([FL, lerp(FL, BL, 0.5), BL, lerp(BL, BR, 0.6)], Math.max(1, iw * 0.012), 0.2, 0.2, 0.3) }))
    const nb = H * (tall ? 0.1 : 0.13)
    fore.replaceChildren(
      s('defs', null, s('linearGradient', { id: 't31c2-nr', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 't31c2-nr0' }), s('stop', { offset: 1, class: 't31c2-nr1' }))),
      s('rect', { class: 't31c2-near', x: -10, y: f1(H - nb), width: f1(W + 20), height: f1(nb + 10), fill: 'url(#t31c2-nr)' }),
      grass(cxF - fw * 0.32, by + 5, fw * 0.16, 3150), grass(cxF + fw * 0.2, by + 6, fw * 0.12, 3151),
      stone,
      grass(fx + iw * 0.55, fy + t + 3, iw * 0.3, 3152),
      reeds(W * (tall ? 0.03 : 0.025), H + 4, H * (tall ? 0.07 : 0.22), 3153, 7),
      grass(W * 0.94, H - 2, W * (tall ? 0.16 : 0.08), 3154), grass(W * 0.06, H - 2, W * (tall ? 0.14 : 0.07), 3155))
    rest = `translate(${f1(fx - iw * 0.02)}px, ${f1(fy - iw * 0.11 - padS * 0.42)}px)`
    pad.style.transform = rest
  }

  // ── layout: the stele's size and place, the ground, the puddle, the inkstone and pad, the reading
  function* paint() {
    // one heavy canvas per frame (mount ≤ 50 ms at CPU 4×): the stone, the paper, then its reflection
    yield
    // the first measureText of each face costs ~25 ms (README): warm them one per frame before the stone lays out its rows
    const wg = mask.getContext('2d')
    for (const f of [`600 20px ${C.serif}`, `500 20px ${C.sans}`, `400 20px ${C.serif}`]) {
      if (wg) (wg.font = f), wg.measureText('Ag')
      yield
    }
    drawStone()
    yield
    drawPaper(false)
    yield
    drawPuddle()
  }
  let first = true
  ctx.onCleanup(onSize(root, () => {
    const W = root.clientWidth, H = root.clientHeight
    if (W < 80 || H < 80) return
    const tall = W < 700
    fw = Math.round(tall ? clamp(W * 0.66, 190, 290) : clamp(Math.min(W * 0.25, H * 0.47), 230, 390))
    fh = Math.round(fw * 1.28)
    const depth = Math.round(fw * 0.4)
    dpr = Math.min(devicePixelRatio || 1, low ? 1.25 : 2)
    const cxF = tall ? W * 0.46 : W * 0.41
    const topF = tall ? clamp(H * 0.1, 56, 120) : Math.max(40, H * 0.71 - fh)
    const by = topF + fh
    const gy = by - fh * (tall ? 0.36 : 0.44)
    const pw = Math.round(fw * (tall ? 0.86 : 1.7)), ph = Math.round(fw * (tall ? 0.3 : 0.32))
    const pl = tall ? cxF - pw * 0.6 : cxF - pw * 0.4
    pondK = (cxF - pl) / pw
    const pyT = by + fw * (tall ? 0.09 : 0.06)
    const iw = fw * (tall ? 0.4 : 0.44)
    const fx = tall ? cxF + fw * 0.54 : cxF - fw * 0.92, fy = tall ? by + fw * 0.2 : by + fw * 0.03
    padS = Math.round(tall ? clamp(fw * 0.27, 56, 76) : clamp(fw * 0.27, 70, 100))
    Object.assign(stage.style, { left: `${f1(cxF - fw / 2)}px`, top: `${f1(topF)}px`, width: `${fw}px`, height: `${fh}px` })
    root.style.setProperty('--fw', `${fw}px`)
    root.style.setProperty('--fh', `${fh}px`)
    root.style.setProperty('--depth', `${depth}px`)
    root.style.setProperty('--cord', `${f1(fh * 0.165 - fh * 0.15 - 3)}px`)
    root.style.setProperty('--pad', `${padS}px`)
    root.style.setProperty('--tick', `${f1(fw * 0.04)}px`)
    for (const c of [stoneCv, paperCv]) (c.width = Math.round(fw * dpr)), (c.height = Math.round(fh * dpr))
    puddle.width = Math.round(pw * dpr)
    puddle.height = Math.round(ph * dpr)
    Object.assign(puddle.style, { width: `${pw}px`, height: `${ph}px`, left: `${f1(pl)}px`, top: `${f1(pyT)}px` })
    // the reading: desk = the sky's top-right corner (where the insight follows it); phone = under the pool, full width
    if (tall) {
      const top = pyT + ph + 8
      Object.assign(read.style, { left: '14px', right: 'auto', top: `${f1(top)}px`, width: `${f1(W - 28)}px`, maxHeight: '' })
      Object.assign(take.style, { left: '10px', right: 'auto', top: `${f1(top)}px`, bottom: 'auto' })
    } else {
      Object.assign(read.style, { left: 'auto', right: 'clamp(8px, 2.5%, 36px)', top: 'clamp(8px, 3%, 28px)', width: 'min(27rem, 36%)', maxHeight: '' })
      Object.assign(take.style, { left: 'auto', right: '3%', top: 'auto', bottom: '4%' })
    }
    root.classList.toggle('tall', tall)
    const G: Geo = { W, H, tall, cxF, topF, by, gy, fx, fy, iw, quiet: pyT + ph + 4 }
    back.setAttribute('viewBox', `0 0 ${W} ${H}`)
    fore.setAttribute('viewBox', `0 0 ${W} ${H}`)
    scenery(G)
    foreground(G)
    cnt = [cxF - fw * 0.06, topF - (tall ? 16 : 24)]
    gd.refresh()
    if (first) {
      first = false
      // the first paint soaks in (README A.10); a relayout repaints at once
      const job = sliced(paint(), { sync: ctx.reduced, budget: 6 })
      ctx.onCleanup(job.cancel)
    } else drawStone(), drawPaper()
  }))
  ctx.onCleanup(onPrefs(() => {
    const was = C.paper + C.ink + C.stoneMid
    readColors()
    if (was === C.paper + C.ink + C.stoneMid || !fw) return
    tint()
    drawStone()
    drawPaper()
  }))
  ticks[0].classList.add('next')
  ctx.prompt(K.prompt)
}
