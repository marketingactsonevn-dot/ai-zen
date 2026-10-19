import raw from '../../content/tram-31.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { clamp, onSize } from '../../ui/part2/ink'
import { grass } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { blob, cardSheet, live, night, rng, stroke } from './kit'
import { wellArt } from './wells'

const K = raw.scenes.card
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

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

type Row = { y: number; h: number; x: number; w: number; cells: Uint8Array; nx: number; ny: number; got: number; open: boolean }
const canvas = () => document.createElement('canvas')

/**
 * Scene 3 — a thick, low granite stele by the well, seen three-quarters at chest height: a damp sheet of washi is tied
 * round it with a cord, so the six carved lines (and the model's name) are hidden under white paper. Dab the ink pad on
 * the paper (or drag it): sumi takes only where the stone stands up, so each carved line comes out white on black. A line
 * that is mostly inked opens what to read in it; when all six are up, the rubbing peels off: it is the take-away card.
 */
export function cardScene(ctx: SceneCtx) {
  const low = ctx.quality === 'low'
  const still = ctx.reduced || low
  const lines = K.lines
  const read = live('t31c2-read')
  // decode the stone once, where it stands: it is the model card (no aria-live yet: filled before the first line)
  read.append(h('p', { class: 't31c2-readp' }, K.decode))
  const say = live('visually-hidden')
  const stoneCv = h('canvas', { class: 't31c2-stone', 'aria-hidden': 'true' })
  const paperCv = h('canvas', { class: 't31c2-paper', 'aria-hidden': 'true' })
  const puddle = h('canvas', { class: 't31c2-puddle', 'aria-hidden': 'true' })
  const rows = lines.map((ln, n) => h('button', { class: 't31c2-row', type: 'button', 'aria-label': fill(K.lineAria, { n: n + 1, label: ln.label }), onClick: () => auto(n) }))
  const face = h('div', { class: 't31c2-face' }, stoneCv, paperCv, ...rows)
  // the slab's thickness: its right flank, turned back from the face, the cord running round it to a knot
  const side = h('div', { class: 't31c2-side' }, h('div', { class: 't31c2-sidecord' }), h('div', { class: 't31c2-knot' }))
  const stele = h('div', { class: 't31c2-stele' }, face, side)
  const stage = h('div', { class: 't31c2-stage' }, stele)
  const pad = h('div', { class: 't31c2-pad', 'aria-hidden': 'true' })
  const foot = s('svg', { class: 't31c2-foot', 'aria-hidden': 'true' })
  const lead = s('svg', { class: 't31c2-lead', 'aria-hidden': 'true' })
  const well = wellArt('github', 3100, 't31c2-well', true)
  const root = h('div', { class: 'g11 g11-nomoon t31c2', role: 'group', 'aria-label': K.aria },
    night({ low: true }), h('p', { class: 'visually-hidden' }, K.art), well, foot, stage, puddle, lead, pad, read, say)
  ctx.art.append(root)
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)

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
      paperLo: mix(paper, v('--wash'), dark ? 0.3 : 0.12),
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
  const dabs: [number, number, number][] = [] // u, v, r as shares of fw (replayed after a resize or theme change)
  const base = canvas() // the bare damp sheet: fibres, creases, the letters sunk into it, the cord
  const inkL = canvas() // the sumi so far (already cut away where the stone is carved)
  const mask = canvas() // what ink never reaches: the carved letters and the cord
  let peeled = false
  const sheetY = () => fh * 0.12, cordY = () => fh * 0.165

  /** the carved text, laid out for the face: name, mock line, six rows of label + value (a long value wraps once) */
  function layoutText(g: CanvasRenderingContext2D, draw: (t: string, x: number, y: number, font: string, kind: 'name' | 'mock' | 'label' | 'value') => void) {
    const m = fw * 0.1
    const maxW = fw - 2 * m
    const font = (px: number, weight: number, fam: string) => `${weight} ${Math.floor(px * 10) / 10}px ${fam}`
    const fit = (t: string, px: number, weight: number, fam: string, w = maxW) => {
      g.font = font(px, weight, fam)
      return font(px * Math.min(1, w / Math.max(1, g.measureText(t).width)), weight, fam)
    }
    draw(K.model, m, fh * 0.235, fit(K.model, fw * 0.052, 600, C.serif), 'name')
    draw(K.mock, m + fw * 0.05, fh * 0.285, fit(K.mock, fw * 0.034, 500, C.sans, maxW - fw * 0.05), 'mock')
    const top = fh * 0.315, rh = (fh * 0.955 - top) / lines.length
    const nx = 18
    rowsG = lines.map((ln, n) => {
      const y = top + rh * n
      draw(ln.label, m, y + rh * 0.38, fit(ln.label, Math.min(fw * 0.056, rh * 0.36), 600, C.serif), 'label')
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
        draw(a, m, y + rh * 0.64, fit(a, px2, 400, C.serif), 'value')
        draw(b, m, y + rh * 0.9, fit(b, px2, 400, C.serif), 'value')
      } else draw(ln.value, m, y + rh * 0.76, fit(ln.value, vpx, 400, C.serif), 'value')
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

  /** the stone face: granite (blotches, speckle), lichen and moss from the foot, a chiselled bevel, the text cut in */
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
    for (let i = 0; i < 60; i++) {
      const edge = r() < 0.35
      const x = edge ? (r() < 0.5 ? r() * fw * 0.08 : fw - r() * fw * 0.08) : r() * fw
      const y = edge ? fh * (0.5 + r() * 0.5) : fh - r() * r() * fh * 0.1
      g.globalAlpha = 0.25 + r() * 0.35
      g.beginPath()
      g.ellipse(x, y, 3 + r() * 12, 2 + r() * 6, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
    // the cut text: shadowed on the upper-left wall of each groove, lit on the lower-right
    g.textBaseline = 'alphabetic'
    layoutText(g, (t, x, y, font, kind) => {
      g.font = font
      if (kind === 'mock') {
        g.fillStyle = C.seal
        g.globalAlpha = 0.85
        g.fillRect(x - fw * 0.05, y - fw * 0.028, fw * 0.03, fw * 0.03)
      }
      g.globalAlpha = 0.6
      g.fillStyle = C.groove
      g.fillText(t, x, y)
      g.globalAlpha = 0.45
      g.fillStyle = C.lit
      g.fillText(t, x + 0.8, y + 0.9)
      g.globalAlpha = 1
    })
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
    g.restore()
    // the crown's moonlit edge (grazing from the upper left) and the face's ink edge on the right
    g.strokeStyle = C.lit
    g.globalAlpha = 0.55
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(fw * 0.01, fh * 0.16)
    g.bezierCurveTo(fw * 0.03, fh * 0.04, fw * 0.2, 1, fw * 0.42, 1)
    g.stroke()
    g.globalAlpha = 1
    // the line buttons sit over the lines just laid out
    rows.forEach((b, n) => {
      const rw = rowsG[n]
      if (rw) Object.assign(b.style, { left: `${f1(rw.x)}px`, top: `${f1(rw.y)}px`, width: `${f1(rw.w)}px`, height: `${f1(rw.h)}px` })
    })
  }

  /** the damp washi over the face (fibres, creases, the letters it has sunk into, the cord); the mask; then the ink */
  function drawPaper() {
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
    // kōzo fibres: long fine hairs, a few darker
    g.lineCap = 'round'
    const ks = clamp(fw / 300, 0.55, 1.2) // detail scales with the sheet, so a phone's stele is not a crumpled foil
    for (let i = 0; i < Math.round((low ? 160 : 460) * ks * ks); i++) {
      const x = r() * fw, y = py + r() * (fh - py), a = r() * Math.PI, l = (6 + r() * 34) * ks
      g.strokeStyle = r() < 0.55 ? 'rgba(255,255,255,0.7)' : rgba(C.paperLo, 0.75)
      g.lineWidth = (0.4 + r() * 0.6) * ks
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l)
      g.stroke()
    }
    // damp: the sheet is soaked unevenly, darker where it clings to the stone
    for (let i = 0; i < 26; i++) {
      const x = px + r() * (fw - 2 * px), y = py + r() * (fh - py)
      const rg = g.createRadialGradient(x, y, 0, x, y, fw * (0.05 + r() * 0.12))
      rg.addColorStop(0, rgba(C.paperLo, 0.16 + r() * 0.12))
      rg.addColorStop(1, rgba(C.paperLo, 0))
      g.fillStyle = rg
      g.fillRect(x - fw * 0.2, y - fw * 0.2, fw * 0.4, fw * 0.4)
    }
    // wrinkles: short puckers fanning down from the cord and in from the edges, a lit ridge with its shade below
    for (let i = 0; i < Math.round(16 * ks); i++) {
      const fromCord = i < 9 * ks
      const x = fromCord ? px + r() * (fw - 2 * px) : r() < 0.5 ? px + 2 : fw - px - 2
      const y = fromCord ? cordY() + 2 : py + fh * 0.2 + r() * fh * 0.6
      const a = fromCord ? Math.PI / 2 + (r() - 0.5) * 0.9 : (x < fw / 2 ? 0 : Math.PI) + (r() - 0.5) * 0.8
      const l = fw * (0.05 + r() * 0.1), w = (1.2 + r() * 1.8) * ks
      const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l
      g.lineWidth = w
      g.strokeStyle = 'rgba(255,255,255,0.5)'
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo((x + ex) / 2 + (r() - 0.5) * 6, (y + ey) / 2, ex, ey)
      g.stroke()
      g.strokeStyle = rgba(C.paperLo, 0.45)
      g.beginPath()
      g.moveTo(x + w * 0.8, y + w * 0.8)
      g.quadraticCurveTo((x + ex) / 2 + w, (y + ey) / 2 + w, ex + w * 0.6, ey + w * 0.6)
      g.stroke()
    }
    // the wet paper sags into every carved line: a breath of shade above it, the letters pressed in
    g.textBaseline = 'alphabetic'
    layoutText(g, (t, x, y, font) => {
      g.font = font
      g.fillStyle = rgba(C.paperLo, 0.55)
      g.fillText(t, x + 0.7, y + 0.9)
      g.fillStyle = 'rgba(255,255,255,0.75)'
      g.fillText(t, x - 0.5, y - 0.6)
      g.fillStyle = C.paper
      g.fillText(t, x, y)
    })
    // the moon's sheen across the upper left of the sheet
    const sh = g.createRadialGradient(fw * 0.2, py, 0, fw * 0.2, py, fw * 0.9)
    sh.addColorStop(0, 'rgba(255,255,255,0.28)')
    sh.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = sh
    g.fillRect(0, 0, fw, fh)
    g.restore()
    // the cord tied round the stone: its shadow on the paper, then the twisted rope from edge to edge
    const cy = cordY(), cw = Math.max(2.4, fw * 0.014)
    const cord = (gg: CanvasRenderingContext2D, wid: number, dy = 0) => {
      gg.beginPath()
      gg.moveTo(-2, cy + dy - 1)
      gg.quadraticCurveTo(fw * 0.5, cy + dy + fh * 0.012, fw + 2, cy + dy - 3)
      gg.lineWidth = wid
      gg.stroke()
    }
    g.lineCap = 'butt'
    g.strokeStyle = rgba(C.groove, 0.2)
    cord(g, cw * 1.6, cw * 0.9)
    g.strokeStyle = mix(C.stoneLo, '#7a5a3c', 0.55)
    cord(g, cw)
    g.save()
    g.setLineDash([cw * 0.9, cw * 0.9])
    g.strokeStyle = rgba(C.lit.startsWith('#') ? C.lit : '#ffffff', 0.45)
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
    // the paper's own outline as a clip for the ink lives in `base` (ink is drawn source-atop onto it)
    const ig = inkL.getContext('2d')!
    ig.setTransform(1, 0, 0, 1, 0, 0)
    ig.clearRect(0, 0, inkL.width, inkL.height)
    for (const [u, v, rr] of dabs) dab(u * fw, v * fw, rr * fw, false, false)
    if (low) fullInk()
    compose(0, 0, paperCv.width, paperCv.height)
    drawPuddle()
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
  function dab(x: number, y: number, rr: number, record = true, show = true) {
    const ig = inkL.getContext('2d')
    if (!ig) return
    ig.setTransform(dpr, 0, 0, dpr, 0, 0)
    // each press lands a little turned and squashed: the cloth's grain never repeats
    const a = (x * 7.1 + y * 3.3) % 6.28, k = 0.85 + ((x * 13 + y * 7) % 10) / 33
    ig.globalAlpha = 0.62
    ig.translate(x, y)
    ig.rotate(a)
    ig.drawImage(tinted, -rr * k, -rr, rr * 2 * k, rr * 2)
    ig.setTransform(1, 0, 0, 1, 0, 0)
    ig.globalAlpha = 1
    const sx = Math.max(0, Math.floor((x - rr) * dpr)), sy = Math.max(0, Math.floor((y - rr) * dpr))
    const sw = Math.min(inkL.width - sx, Math.ceil(rr * 2 * dpr) + 2), sh = Math.min(inkL.height - sy, Math.ceil(rr * 2 * dpr) + 2)
    if (sw > 0 && sh > 0) {
      ig.globalCompositeOperation = 'destination-out'
      ig.drawImage(mask, sx, sy, sw, sh, sx, sy, sw, sh)
      ig.globalCompositeOperation = 'source-over'
      if (show) compose(sx, sy, sw, sh)
    }
    if (!record) return
    dabs.push([x / fw, y / fw, rr / fw])
    // which line cells this dab covered
    rowsG.forEach((row, n) => {
      if (y + rr < row.y || y - rr > row.y + row.h) return
      for (let j = 0; j < row.ny; j++)
        for (let i = 0; i < row.nx; i++) {
          const cx = row.x + ((i + 0.5) * row.w) / row.nx, cy = row.y + ((j + 0.5) * row.h) / row.ny
          if (!row.cells[j * row.nx + i] && Math.hypot(cx - x, cy - y) < rr * 0.85) (row.cells[j * row.nx + i] = 1), row.got++
        }
      if (!row.open && row.got >= row.cells.length * 0.6) openLine(n)
    })
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

  /** the puddle in front: an organic pool holding the stele upside down, broken by ripples, and the moon */
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
    // the wet ground round it, then the water
    g.save()
    g.filter = `blur(${Math.round(4 * dpr)}px)`
    g.fillStyle = rgba(C.groove, C.dark ? 0.5 : 0.18)
    g.translate(0, 2 * dpr)
    g.fill(shape)
    g.restore()
    g.save()
    g.clip(shape)
    g.fillStyle = C.dark ? mix(C.water, C.stoneLo, 0.4) : mix(C.water, C.paper, 0.35)
    g.fillRect(0, 0, w, hh)
    // the stele upside down, cut in slices that sway (ripples)
    const ref = canvas()
    const rw = Math.round(w * 0.36), rhh = Math.round((fh / fw) * rw)
    ref.width = rw
    ref.height = rhh
    const rg = ref.getContext('2d')!
    rg.translate(0, rhh)
    rg.scale(1, -1)
    rg.drawImage(stoneCv, 0, 0, rw, rhh)
    rg.drawImage(paperCv, 0, 0, rw, rhh)
    const ox = w * 0.3, sq = 0.34 // the reflection is squashed by the low view
    g.globalAlpha = C.dark ? 0.55 : 0.42
    const slice = Math.max(2, Math.round(2 * dpr))
    for (let y = 0; y < Math.min(hh, rhh * sq); y += slice) {
      const dx = Math.sin(y * 0.35 / dpr) * 2.2 * dpr * (y / hh + 0.3)
      g.drawImage(ref, 0, y / sq, rw, slice / sq, ox + dx, y, rw, slice)
    }
    g.globalAlpha = 1
    // the moon, broken into bars by the ripples, and a few rings
    g.fillStyle = C.moon
    const mx = w * 0.78, my = hh * 0.34
    g.globalAlpha = 0.85
    g.beginPath()
    g.ellipse(mx, my, w * 0.04, hh * 0.08, 0, 0, Math.PI * 2)
    g.fill()
    g.globalAlpha = 0.5
    for (let i = 0; i < 4; i++) g.fillRect(mx - w * (0.05 - i * 0.008) + (i % 2) * w * 0.01, my + hh * (0.12 + i * 0.07), w * (0.1 - i * 0.016), Math.max(1, hh * 0.018))
    g.strokeStyle = C.moon
    g.lineWidth = Math.max(1, dpr * 0.8)
    for (let i = 1; i <= 3; i++) {
      g.globalAlpha = 0.28 - i * 0.06
      g.beginPath()
      g.ellipse(w * 0.46, hh * 0.58, w * 0.07 * i, hh * 0.1 * i, 0, 0, Math.PI * 2)
      g.stroke()
    }
    // darker toward its rim, where the bank shades it
    const vg = g.createRadialGradient(w / 2, hh / 2, Math.min(w, hh) * 0.2, w / 2, hh / 2, w * 0.55)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, rgba(C.groove, C.dark ? 0.55 : 0.2))
    g.globalAlpha = 1
    g.fillStyle = vg
    g.fillRect(0, 0, w, hh)
    g.restore()
    // its wet rim catching the moon on the far side
    g.strokeStyle = C.moon
    g.globalAlpha = 0.45
    g.lineWidth = 1.4 * dpr
    g.save()
    g.clip(new Path2D(`M0 0H${w}V${hh * 0.5}H0Z`))
    g.stroke(shape)
    g.restore()
    g.globalAlpha = 1
  }

  // ── a line comes up: what to read in it, written in the margin with a fine leader to the line
  const opened = new Set<number>()
  function openLine(n: number) {
    const row = rowsG[n]
    if (row) row.open = true
    rows[n].classList.add('on')
    const ln = lines[n]
    read.say(h('p', { class: 'p2-eyebrow' }, ln.label), h('p', { class: 't31c2-readp' }, ln.read))
    say.say(`${ln.label}: ${ln.value}. ${ln.read}`)
    leader(n)
    if (opened.has(n)) return
    opened.add(n)
    if (opened.size === 1) ctx.prompt(K.next)
    ctx.chime('tap')
    drawPuddle()
    if (opened.size === lines.length) finish()
  }
  function leader(n: number) {
    // read the row's and the panel's boxes once (event time, not in a frame)
    const rr = rows[n].getBoundingClientRect(), pr = read.getBoundingClientRect(), bs = root.getBoundingClientRect()
    if (!pr.width || window.innerWidth < 700) return void lead.replaceChildren()
    const x0 = rr.right - bs.left, y0 = rr.top + rr.height / 2 - bs.top
    const x1 = pr.left - bs.left - 8, y1 = pr.top + 18 - bs.top
    lead.replaceChildren(s('path', { d: `M${f1(x0)} ${f1(y0)}C${f1(x0 + 40)} ${f1(y0)} ${f1(x1 - 40)} ${f1(y1)} ${f1(x1)} ${f1(y1)}` }), s('circle', { cx: f1(x0), cy: f1(y0), r: 2.4 }))
  }
  function finish() {
    ctx.chime('ok')
    root.classList.add('t31c2-done')
    const go = () => {
      peeled = true
      ctx.insight(K.insight as Fact, K.detail as Fact)
      sheet.show()
    }
    if (ctx.reduced) return (paperCv.style.opacity = '0'), go()
    // the rubbing lifts off the stone from its top edge, curls toward you and floats away: it is the card now
    const a = paperCv.animate(low
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ transform: 'none', opacity: 1 }, { transform: 'translateZ(40px) rotateX(-38deg)', opacity: 1, offset: 0.45 }, { transform: 'translate3d(0, -40px, 260px) rotateX(-70deg)', opacity: 0 }],
    { duration: low ? 500 : 1600, delay: 500, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' })
    a.onfinish = go
    ctx.onCleanup(() => a.cancel())
  }

  // ── auto-dab along a line (keyboard, or a tap on a closed row at low quality)
  let queue: [number, number, number][] = []
  const loop = createLoop(root, () => {
    for (let k = 0; k < 2 && queue.length; k++) {
      const [x, y, rr] = queue.shift()!
      dab(x, y, rr)
    }
    if (!queue.length) drawPuddle()
    return queue.length > 0
  })
  ctx.onCleanup(() => loop.dispose())
  function auto(n: number) {
    const row = rowsG[n]
    if (!row || peeled) return
    if (low || row.open) return openLine(n)
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

  // ── pointer: the pad follows the finger; pressing on the paper dabs, dragging dabs as it goes
  let down: { id: number; x: number; y: number } | null = null
  let rest = '' // the pad's place by the inkstone
  let box: DOMRect | null = null
  const padAt = (cx: number, cy: number) => {
    if (box) pad.style.transform = `translate(${f1(cx - box.left)}px, ${f1(cy - box.top)}px)`
  }
  const sx = () => fw / Math.max(1, paperCv.clientWidth)
  paperCv.addEventListener('pointerdown', (e) => {
    if (peeled || low || e.button) return
    paperCv.setPointerCapture(e.pointerId)
    box = root.getBoundingClientRect()
    root.classList.add('t31c2-inking')
    const x = e.offsetX * sx(), y = e.offsetY * sx()
    down = { id: e.pointerId, x, y }
    padAt(e.clientX, e.clientY)
    dab(x, y, fw * 0.075)
  })
  paperCv.addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== down.id) return
    const x = e.offsetX * sx(), y = e.offsetY * sx()
    padAt(e.clientX, e.clientY)
    if (Math.hypot(x - down.x, y - down.y) < fw * 0.03) return
    down.x = x
    down.y = y
    dab(x, y, fw * 0.07)
  })
  const up = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return
    down = null
    root.classList.remove('t31c2-inking')
    pad.style.transform = rest
    drawPuddle()
  }
  paperCv.addEventListener('pointerup', up)
  paperCv.addEventListener('pointercancel', up)

  // ── layout: the stele's size and place, its foot (moss, grass, the inkstone and pad), the puddle, the well, the note
  function* paint() {
    drawStone()
    yield
    drawPaper()
  }
  let first = true
  ctx.onCleanup(onSize(root, () => {
    const W = root.clientWidth, H = root.clientHeight
    if (W < 80 || H < 80) return
    const tall = W < 700
    fw = Math.round(tall ? clamp(W * 0.58, 170, 280) : clamp(Math.min(W * 0.24, H * 0.47), 230, 380))
    fh = Math.round(fw * 1.28)
    const depth = Math.round(fw * 0.4)
    dpr = Math.min(devicePixelRatio || 1, low ? 1.25 : 2)
    const pw = Math.round(fw * (tall ? 1.3 : 1.55)), ph = Math.round(fw * 0.3)
    const total = fh + fw * 0.12 + ph
    const cxF = tall ? 14 + fw / 2 : W * 0.42
    // a phone: the stele high, its reading full width under the puddle (not a 2-word column beside it)
    const topF = tall ? Math.max(8, (H - total) * 0.12) : Math.max(14, (H - total) * 0.42)
    Object.assign(stage.style, { left: `${f1(cxF - fw / 2)}px`, top: `${f1(topF)}px`, width: `${fw}px`, height: `${fh}px` })
    root.style.setProperty('--fw', `${fw}px`)
    root.style.setProperty('--fh', `${fh}px`)
    root.style.setProperty('--depth', `${depth}px`)
    root.style.setProperty('--cord', `${f1(fh * 0.165 - fh * 0.15 - 3)}px`)
    for (const c of [stoneCv, paperCv]) (c.width = Math.round(fw * dpr)), (c.height = Math.round(fh * dpr))
    puddle.width = Math.round(pw * dpr)
    puddle.height = Math.round(ph * dpr)
    const py = topF + fh + fw * 0.1
    Object.assign(puddle.style, { width: `${pw}px`, height: `${ph}px`, left: `${f1(cxF - pw * (tall ? 0.42 : 0.4))}px`, top: `${f1(py)}px` })
    // the read note: in the margin right of the stele; on a phone under the puddle, full width
    const rl = cxF + fw * 0.5 + depth * 0.5 + 40
    if (tall) Object.assign(read.style, { left: '12px', top: `${f1(py + ph + 6)}px`, width: `${f1(W - 24)}px`, right: 'auto' })
    else Object.assign(read.style, { left: `${f1(rl)}px`, top: `${f1(topF + fh * 0.3)}px`, width: `${f1(Math.min(340, W - rl - 24))}px`, right: 'auto' })
    // the foot: a ground shadow toward the camera, moss and grass at the stone's base; the inkstone and the pad's rest
    foot.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const by = topF + fh
    const fx = cxF - fw * (tall ? 0.2 : 0.66), fy = by + fw * (tall ? 0.16 : 0.08)
    const iw = fw * 0.2
    foot.replaceChildren(
      s('path', { class: 't31c2-gsh', d: blob(cxF + fw * 0.02, by + fw * 0.03, fw * 0.66, fw * 0.07, 3146, 0.14), filter: 'url(#ink-wash)' }),
      s('path', { class: 'g11-mossy t31c2-moss', d: blob(cxF - fw * 0.3, by - 1, fw * 0.24, fw * 0.035, 3147, 0.35, 14) + blob(cxF + fw * 0.12, by + 1, fw * 0.3, fw * 0.03, 3148, 0.35, 14) + blob(cxF + fw * 0.5, by - 3, fw * 0.12, fw * 0.05, 3149, 0.35, 12), filter: 'url(#ink-wash)' }),
      grass(cxF - fw * 0.42, by + 3, fw * 0.16, 3150), grass(cxF + fw * 0.46, by + 2, fw * 0.14, 3151), grass(cxF - fw * 0.05, by + 4, fw * 0.1, 3152),
      // the inkstone: a dark slab with its well of ink, in 3/4 like the stele
      s('ellipse', { class: 't31c2-ink-sh', cx: f1(fx + iw * 0.15), cy: f1(fy + iw * 0.2), rx: f1(iw * 0.75), ry: f1(iw * 0.16) }),
      s('path', { class: 't31c2-inkside', d: `M${f1(fx - iw * 0.55)} ${f1(fy - iw * 0.08)}L${f1(fx + iw * 0.5)} ${f1(fy - iw * 0.12)}L${f1(fx + iw * 0.5)} ${f1(fy + iw * 0.08)}L${f1(fx - iw * 0.55)} ${f1(fy + iw * 0.14)}Z` }),
      s('path', { class: 't31c2-inkstone', d: `M${f1(fx - iw * 0.62)} ${f1(fy - iw * 0.14)}L${f1(fx + iw * 0.38)} ${f1(fy - iw * 0.3)}L${f1(fx + iw * 0.6)} ${f1(fy - iw * 0.14)}L${f1(fx - iw * 0.4)} ${f1(fy + iw * 0.02)}Z` }),
      s('ellipse', { class: 't31c2-inkwell', cx: f1(fx + iw * 0.12), cy: f1(fy - iw * 0.15), rx: f1(iw * 0.24), ry: f1(iw * 0.06) }),
      s('path', { class: 't31c2-inklit', d: stroke([[fx - iw * 0.6, fy - iw * 0.15], [fx + iw * 0.36, fy - iw * 0.3]], 1.2, 0.2, 0.2, 0.3) }))
    pad.style.transform = rest = `translate(${f1(fx - iw * 0.35)}px, ${f1(fy - iw * 0.3)}px)`
    pad.style.setProperty('--pad', `${f1(fw * 0.1)}px`)
    // the well: left of the stele on a wide screen; under the note, right of the stele's foot, on a phone
    const ww = fw * (tall ? 0.72 : 0.92)
    Object.assign(well.style, tall ? { left: `${f1(W - ww - 2)}px`, top: `${f1(by - ww * 0.32)}px`, width: `${f1(ww)}px` } : { left: `${f1(cxF - fw * 1.6)}px`, top: `${f1(by - ww * 0.42)}px`, width: `${f1(ww)}px` })
    root.classList.toggle('tall', tall)
    root.classList.toggle('g11-nomoon', !tall) // a phone has the sky above the stele free for the moon
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
  ctx.prompt(K.prompt)
}
