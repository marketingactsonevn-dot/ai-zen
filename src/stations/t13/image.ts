import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, line, rng, stroke, type Pt } from './ink'
import { formula, type ArtApi, type Kit } from './kit'
import { POT, potInk } from './pot'
import { octaves } from '../../ui/ink'

const S = C.scenes.image
// slot order: 0 chủ thể · 1 bố cục · 2 bối cảnh · 3 phong cách · 4 ánh sáng · 5 góc máy · 6 màu · 7 chữ · 8 khung
const CLS = ['s-subject', 's-comp', 's-place', 's-style', 's-light', 's-lens', 's-color', 's-text', 's-ratio']
const SQUARE = { x: 40, y: 40, width: 320, height: 320 }
const TALL = { x: 56, y: 20, width: 288, height: 360 }
// the moon window: high on the wall, so the teapot's lid never touches it
const WX = 266
const WY = 104
const WR = 64

/** Both looks of one shape: a flat "vector" outline and a sumi-e brush stroke (Phong cách switches between them). */
function both(pts: Pt[], w: number, o: Parameters<typeof stroke>[2] = {}, flatW = 1.4) {
  return [
    s('path', { class: 'flat-l', d: line(pts), 'stroke-width': flatW }),
    s('path', { class: 'ink-s', d: stroke(pts, w, o) }),
  ]
}

function circlePts(cx: number, cy: number, r: number, a0: number, sweep: number, n = 28): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (sweep * i) / n
    const rr = r * (1 + 0.012 * Math.sin(i * 1.7))
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as Pt
  })
}

/** Five-petal plum blossom. */
function blossom(x: number, y: number, r: number, rot: number) {
  const g = s('g', { class: 'bl', transform: `translate(${x} ${y}) rotate(${rot})` })
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    g.append(s('circle', { cx: (Math.cos(a) * r * 0.62).toFixed(1), cy: (Math.sin(a) * r * 0.62).toFixed(1), r: (r * 0.5).toFixed(1) }))
  }
  g.append(s('circle', { class: 'bl-c', r: (r * 0.28).toFixed(1) }))
  return g
}

function buildArt(k: Kit): ArtApi {
  const id = nextId('t13i')
  const clip = s('rect', { ...SQUARE })
  const blurF = s('feGaussianBlur', { stdDeviation: 0 })
  const defs = s('defs', null,
    s('clipPath', { id: `${id}-clip` }, clip),
    s('filter', { id: `${id}-noise`, x: 0, y: 0, width: '100%', height: '100%' },
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.85', numOctaves: octaves(2), seed: '4', stitchTiles: 'stitch' }),
      s('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1.6 -0.55' })),
    s('filter', { id: `${id}-fog`, x: '-40%', y: '-40%', width: '180%', height: '180%' }, s('feGaussianBlur', { stdDeviation: 14 })),
    s('filter', { id: `${id}-dof`, x: '-10%', y: '-10%', width: '120%', height: '120%' }, blurF),
    s('linearGradient', { id: `${id}-beam`, x1: 1, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, class: 'beam0' }),
      s('stop', { offset: 1, class: 'beam1' })),
    s('radialGradient', { id: `${id}-sky`, cx: 0.45, cy: 0.4, r: 0.7 },
      s('stop', { offset: 0, class: 'sky0' }),
      s('stop', { offset: 1, class: 'sky1' })),
    s('filter', { id: `${id}-glow`, x: '-30%', y: '-30%', width: '160%', height: '160%' }, s('feGaussianBlur', { stdDeviation: 5 })),
    s('clipPath', { id: `${id}-win` }, s('circle', { cx: WX, cy: WY, r: WR - 2 })))

  // ── the background (Bối cảnh): wall, moon window with far hills, a plum branch, the table
  const r = rng(31)
  // far hills in the moon window: two ranges with mist between, low in the circle (well clear of the pot)
  const hills = s('g', null,
    s('path', { class: 'wash', 'fill-opacity': 0.1, filter: 'url(#ink-wash)', d: `M${WX - 72} ${WY + 30} Q${WX - 52} ${WY + 4} ${WX - 34} ${WY + 16} T${WX + 2} ${WY + 6} Q${WX + 22} ${WY - 8} ${WX + 40} ${WY + 14} T${WX + 74} ${WY + 22} L${WX + 74} ${WY + 80} L${WX - 72} ${WY + 80}Z` }),
    s('path', { class: 'mist', d: blob(WX, WY + 34, 70, 8, 3, 0.2), filter: `url(#${id}-glow)` }),
    s('path', { class: 'wash', 'fill-opacity': 0.2, filter: 'url(#ink-wash)', d: `M${WX - 72} ${WY + 52} Q${WX - 40} ${WY + 32} ${WX - 14} ${WY + 44} T${WX + 30} ${WY + 40} T${WX + 74} ${WY + 50} L${WX + 74} ${WY + 80} L${WX - 72} ${WY + 80}Z` }))
  const ring = circlePts(WX, WY, WR, -2.3, Math.PI * 1.86, 44)
  const ringDry = circlePts(WX, WY, WR + 0.8, -2.3 + Math.PI * 1.78, Math.PI * 0.2, 12)
  const branchMain: Pt[] = [[414, 10], [372, 34], [336, 56], [300, 70], [270, 92], [240, 104], [212, 126]]
  const twigs: Pt[][] = [[[336, 56], [334, 80], [342, 98]], [[300, 70], [292, 48], [280, 38]], [[270, 92], [276, 116], [270, 132]], [[240, 104], [230, 88]]]
  const flowers: [number, number, number][] = [[342, 100, 5.5], [280, 38, 6], [296, 58, 4.6], [270, 134, 5.6], [228, 86, 5], [214, 128, 6], [252, 112, 4.4], [356, 40, 4.8]]
  const back = s('g', { class: 'back', filter: `url(#${id}-dof)` },
    s('rect', { class: 'wall', x: 0, y: 0, width: 400, height: 272 }),
    s('path', { class: 'wall-wash', d: blob(110, 140, 110, 140, 5, 0.2), filter: 'url(#ink-wash)' }),
    s('circle', { class: 'sky', cx: WX, cy: WY, r: WR - 1, fill: `url(#${id}-sky)` }),
    s('g', { 'clip-path': `url(#${id}-win)` }, hills),
    // the moon window, one loaded brush stroke that swells and runs dry where it closes
    s('g', { class: 'ring' },
      s('path', { class: 'flat-l', d: line(circlePts(WX, WY, WR, 0, Math.PI * 2, 44)), 'stroke-width': 1.3 }),
      s('path', { class: 'ink-s', d: stroke(ring, 8, { head: 0.1, tail: 0.85, min: 0.18 }) }),
      s('path', { class: 'ink-s dry', d: stroke(ringDry, 5.5, { head: 0.15, tail: 0.5, min: 0.1 }), filter: 'url(#ink-dry)' })),
    s('g', { class: 'branch' },
      ...both(branchMain, 5, { head: 0.05, tail: 0.6, min: 0.12 }, 1.4),
      ...twigs.flatMap((t) => both(t, 2.2, { head: 0.1, tail: 0.8 }, 1)),
      ...flowers.map(([x, y, rr]) => blossom(x, y, rr, r() * 72)),
      ...[[318, 62], [244, 96], [204, 120], [384, 24]].map(([x, y]) => s('circle', { class: 'bud', cx: x, cy: y, r: 2.2 }))))
  const table = s('g', { class: 'table' },
    s('path', { class: 'table-body', d: 'M-10 271 L410 265 L410 410 L-10 410Z' }),
    s('path', { class: 'ink-s grain', d: stroke([[0, 300], [140, 297], [300, 302], [400, 298]], 1.6, { head: 0.1, tail: 0.4, min: 0.3 }), filter: 'url(#ink-dry)' }),
    s('path', { class: 'ink-s grain', d: stroke([[40, 330], [200, 326], [380, 331]], 1.4, { head: 0.1, tail: 0.4, min: 0.3 }), filter: 'url(#ink-dry)' }),
    s('path', { class: 'ink-s grain', d: stroke([[0, 366], [170, 362], [400, 368]], 2, { head: 0.1, tail: 0.4, min: 0.3 }), filter: 'url(#ink-dry)' }),
    ...both([[-10, 271], [200, 268], [410, 265]], 2.6, { head: 0.04, tail: 0.5, min: 0.3 }, 1.2))

  // ── light (Ánh sáng): beams from the window, the pot's cast shadow; without it the picture sits under a dull veil
  const beams = s('g', { class: 'beams', filter: `url(#${id}-glow)` },
    s('path', { d: `M${WX - 58} ${WY + 22} L${WX - 6} ${WY + 62} L196 274 L52 274Z`, fill: `url(#${id}-beam)` }),
    s('path', { d: `M${WX - 2} ${WY + 64} L${WX + 22} ${WY + 62} L246 274 L214 274Z`, fill: `url(#${id}-beam)`, opacity: 0.7 }))

  // ── the teapot (Chủ thể), drawn around its resting point
  const { body, spout, lid, handle } = POT
  const castShadow = s('path', { class: 'cast', d: blob(-58, 3, 70, 7, 9, 0.12), filter: 'url(#ink-wash)' })
  const steam = s('g', { class: 'steam' },
    s('path', { class: 'steam-s', d: stroke([[-87, -68], [-93, -86], [-83, -104], [-92, -124], [-82, -146]], 4, { head: 0.1, tail: 0.5, min: 0.2 }) }),
    s('path', { class: 'steam-s', d: stroke([[3, -82], [10, -100], [0, -118], [9, -138]], 3, { head: 0.1, tail: 0.5, min: 0.2 }) }),
    s('path', { class: 'steam-s', d: stroke([[-79, -74], [-72, -92], [-80, -108]], 2.2, { head: 0.1, tail: 0.5, min: 0.2 }) }))
  const pot = s('g', { class: 'pot', transform: 'translate(200 268)' },
    castShadow,
    s('path', { class: 'pot-under', d: blob(0, 2, 44, 5, 3, 0.1), filter: 'url(#ink-wash)' }),
    // flat look: plain fills and even outlines
    s('g', { class: 'flat' },
      s('path', { class: 'flat-f', d: spout }), s('path', { class: 'flat-f', d: body }), s('path', { class: 'flat-f', d: lid }),
      s('ellipse', { class: 'flat-f', cx: 0, cy: -75, rx: 6, ry: 4.5 }),
      s('path', { class: 'flat-l', d: line(handle), 'stroke-width': 5 })),
    // ink look: glaze wash, then brush contours
    potInk(),
    // where the window light catches the glaze
    s('path', { class: 'lit', d: stroke([[14, -60], [36, -54], [50, -38], [52, -20]], 5, { head: 0.2, tail: 0.6, min: 0.15 }) }),
    steam)
  // the vague result: a grey, soft "teapot-ish" smudge in the middle of nowhere
  const smudge = s('g', { class: 'smudge', filter: `url(#${id}-fog)` },
    s('ellipse', { cx: 196, cy: 236, rx: 62, ry: 42 }),
    s('ellipse', { cx: 150, cy: 214, rx: 22, ry: 12 }),
    s('ellipse', { cx: 248, cy: 226, rx: 18, ry: 22 }),
    s('ellipse', { cx: 200, cy: 196, rx: 20, ry: 10 }))
  const ground = s('path', { class: 'ground', d: blob(200, 271, 120, 9, 4, 0.14), filter: 'url(#ink-wash)' })

  const world = s('g', { class: 'world' }, back, table, ground, beams, smudge, pot)
  const veil = s('rect', { class: 'veil', x: 0, y: 0, width: 400, height: 400 })
  const noise = s('rect', { class: 'noise', x: 0, y: 0, width: 400, height: 400, filter: `url(#${id}-noise)` })
  const brand = s('g', { class: 'imgtext', transform: `translate(${SQUARE.x + 24} ${SQUARE.y + 46})` },
    s('text', { class: 'imgtext-t', x: 0, y: 0 }, S.words.brand),
    s('rect', { class: 'seal', x: 2, y: 12, width: 14, height: 14, rx: 1.5 }),
    s('path', { class: 'seal-m', d: stroke([[5, 21], [8, 17], [11, 20], [14, 16]], 1.6, { head: 0.2, tail: 0.5 }) }))
  const paper = s('rect', { class: 'paper', ...SQUARE })
  const shadow = s('rect', { class: 'paper-shadow', ...SQUARE, filter: 'url(#ink-wash)' })
  const edge = s('rect', { class: 'paper-edge', ...SQUARE })
  const svg = s('svg', { class: 't13-art t13i', viewBox: '0 0 400 400', role: 'img', 'aria-label': S.artLabel },
    defs, shadow, paper,
    s('g', { 'clip-path': `url(#${id}-clip)` }, world, veil, noise, brand),
    edge)
  k.stage.append(svg)

  // ambient: the steam breathes upward
  let steamTl: gsap.core.Timeline | null = null
  if (!k.ctx.reduced) {
    steamTl = gsap.timeline({ repeat: -1 })
    steam.querySelectorAll('path').forEach((p, i) => {
      steamTl!.fromTo(p, { y: 6, opacity: 0 }, { y: -10, opacity: 1, duration: 2.2, ease: 'sine.out' }, i * 0.9)
        .to(p, { y: -22, opacity: 0, duration: 2, ease: 'sine.in' }, i * 0.9 + 2.2)
    })
  }

  let wasRatio = false
  return {
    update(on, vague, instant) {
      const v = (i: number) => !vague && on[i]
      CLS.forEach((c, i) => svg.classList.toggle(c, v(i)))
      svg.classList.toggle('is-vague', vague)
      const n = on.filter(Boolean).length
      noise.style.opacity = String(vague ? 0.9 : 0.85 * (1 - n / on.length))
      const go = (t: gsap.TweenTarget, vars: gsap.TweenVars, d = 1.4) =>
        instant ? gsap.set(t, vars) : gsap.to(t, { ...vars, duration: d, ease: 'power3.inOut', overwrite: 'auto' })
      go(pot, { x: v(1) ? 252 : 200, y: 268 })
      go(world, { scale: v(5) ? 1.22 : 1, svgOrigin: '246 236' }, 1.8)
      go(blurF, { attr: { stdDeviation: v(5) ? 1.5 : 0 } }, 1.8)
      const fr = v(8) ? TALL : SQUARE
      if (v(8) !== wasRatio || instant) {
        wasRatio = v(8)
        go([clip, paper, shadow, edge], { attr: fr }, 1.2)
        go(brand, { x: fr.x + 24, y: fr.y + 46 }, 1.2)
      }
    },
    done() {
      // the two ways to write the same image prompt
      const W = S.words
      const btns = [W.sentence, W.keywords].map((t, i) =>
        h('button', { class: 't13-mode', type: 'button', 'aria-pressed': String(i === 0), onClick: () => pick(i) }, t))
      const note = h('p', { class: 't13-note' })
      const param = h('div', { class: 't13-param', hidden: true }, k.ctx.fact(S.paramFact, 'p'))
      const pick = (i: number) => {
        btns.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)))
        k.override(i ? W.keywordsText : W.sentenceText)
        note.textContent = i ? W.keywordsFor : W.sentenceFor
        param.hidden = !i
        k.refit()
      }
      const ways = h('div', { class: 't13-ways' }, h('div', { class: 't13-modes is-small', role: 'group', 'aria-label': W.ways }, ...btns), note)
      k.slipFoot.append(ways, param)
      if (!k.ctx.reduced) k.ctx.anim(() => gsap.from(ways, { opacity: 0, y: 8, duration: 0.9, delay: 0.7, ease: 'power3.out' }))
      pick(0)
    },
    dispose() {
      steamTl?.kill()
    },
  }
}

export function imageScene(ctx: SceneCtx) {
  return formula(ctx, S, buildArt)
}
