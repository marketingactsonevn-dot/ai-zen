import { nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, rng, stroke, type Pt } from './ink'
import { formula, type ArtApi, type Kit } from './kit'
import { potInk, teaCup } from './pot'
import { octaves } from '../../ui/ink'

const S = C.scenes.video
// slot order: 0 loại cảnh · 1 chủ thể · 2 một hành động · 3 máy quay · 4 bối cảnh · 5 ánh sáng · 6 âm thanh · 7 thời lượng
const CLS = ['s-shot', 's-subject', 's-action', 's-cam', 's-place', 's-light', 's-sound', 's-time']
const FW = 432
const FH = 243
const PX = 23.5 // timeline pixels per second
const T0 = 62 // where clip 1 starts on the timeline

function bamboo(x: number, top: number, w: number, seed: number) {
  const r = rng(seed)
  const lean = (r() - 0.5) * 10
  const g = s('g', { class: 'bamboo' })
  g.append(s('path', { class: 'ink-s', d: stroke([[x, 180], [x + lean * 0.4, (180 + top) / 2], [x + lean, top]], w, { head: 0.02, tail: 0.9, min: 0.5 }) }))
  for (let y = 160; y > top + 10; y -= 26 + r() * 10) {
    const t = (180 - y) / (180 - top)
    const nx = x + lean * t
    g.append(s('path', { class: 'node', d: stroke([[nx - w * 0.8, y], [nx + w * 0.8, y - 1]], 1.8, { head: 0.3, tail: 0.5 }) }))
    if (t > 0.45 && r() > 0.35) {
      const dir = r() > 0.5 ? 1 : -1
      for (let k = 0; k < 3; k++) {
        const a = (dir > 0 ? 0.25 : Math.PI - 0.25) + (k - 1) * 0.32 * dir
        const len = 18 + r() * 12
        g.append(s('path', { class: 'leaf', d: stroke([[nx, y], [nx + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 + 3], [nx + Math.cos(a) * len, y + Math.sin(a) * len + 7]], 4.2, { head: 0.15, tail: 0.6 }) }))
      }
    }
  }
  return g
}

function buildArt(k: Kit): ArtApi {
  const ctx = k.ctx
  const id = nextId('t13v')
  const turb = s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.012', numOctaves: octaves(2), seed: '5' })
  const defs = s('defs', null,
    s('clipPath', { id: `${id}-clip` }, s('rect', { x: 0, y: 0, width: FW, height: FH })),
    s('filter', { id: `${id}-wob`, x: '-5%', y: '-5%', width: '110%', height: '110%' }, turb,
      s('feDisplacementMap', { in: 'SourceGraphic', scale: '9', xChannelSelector: 'R', yChannelSelector: 'G' })),
    s('filter', { id: `${id}-fog`, x: '-40%', y: '-40%', width: '180%', height: '180%' }, s('feGaussianBlur', { stdDeviation: 9 })),
    s('linearGradient', { id: `${id}-beam`, x1: 0, y1: 0, x2: 1, y2: 1 },
      s('stop', { offset: 0, class: 'beam0' }),
      s('stop', { offset: 1, class: 'beam1' })))

  // ── the world of the shot (frame-local coordinates)
  const garden = s('g', { class: 'grove' },
    s('path', { class: 'haze', d: 'M0 70 Q110 50 216 74 T432 64 L432 182 L0 182Z', filter: 'url(#ink-wash)' }),
    ...[[34, -6, 7, 1], [118, 18, 5.5, 2], [142, -4, 6.5, 3], [306, 6, 6, 4], [334, 26, 5, 5], [404, -8, 7.5, 6]].map(([x, t, w, sd]) => bamboo(x, t, w, sd)),
    s('path', { class: 'floor', d: stroke([[0, 182], [216, 179], [432, 183]], 1.6, { head: 0.05, tail: 0.4, min: 0.4 }) }),
    s('path', { class: 'stone-f', d: blob(70, 186, 22, 8, 3, 0.15), filter: 'url(#ink-wash)' }),
    s('path', { class: 'stone-f', d: blob(372, 188, 30, 9, 8, 0.15), filter: 'url(#ink-wash)' }))
  const table = s('g', { class: 'table' },
    s('path', { class: 'table-body', d: 'M96 176 L336 176 L332 194 L100 194Z', filter: 'url(#ink-wash)' }),
    s('path', { class: 'ink-s', d: stroke([[94, 176], [216, 175], [338, 176]], 2.4, { head: 0.04, tail: 0.5, min: 0.35 }) }),
    s('path', { class: 'ink-s', d: stroke([[110, 194], [108, 243]], 3, { head: 0.1, tail: 0.3, min: 0.4 }) }),
    s('path', { class: 'ink-s', d: stroke([[322, 194], [324, 243]], 3, { head: 0.1, tail: 0.3, min: 0.4 }) }))
  const ground = s('path', { class: 'ground', d: blob(216, 177, 120, 6, 4, 0.14), filter: 'url(#ink-wash)' })
  const beams = s('g', { class: 'beams' },
    s('path', { d: 'M40 0 L120 0 L300 176 L196 176Z', fill: `url(#${id}-beam)` }),
    s('path', { d: 'M140 0 L180 0 L330 176 L290 176Z', fill: `url(#${id}-beam)`, opacity: 0.6 }))
  // the pot pours from the left into a bowl on the right (mirrored: its spout faces the bowl)
  const potTilt = s('g', null, s('g', { transform: 'translate(180 176) scale(-0.55 0.55)' }, potInk()))
  const { g: cupG, level } = teaCup()
  cupG.setAttribute('transform', 'translate(262 176) scale(0.72)')
  const stream = s('path', { class: 'stream', d: 'M235 151 C244 150.5 254 155 259 168' })
  const steam = s('g', { class: 'steam' },
    ...[[[258, 158], [252, 142], [262, 124], [254, 104]], [[270, 160], [276, 144], [268, 128], [276, 112]]].map((p) =>
      s('path', { class: 'steam-s', d: stroke(p as Pt[], 3, { head: 0.1, tail: 0.5, min: 0.2 }) })))
  const smudge = s('g', { class: 'smudge', filter: `url(#${id}-fog)` },
    s('ellipse', { cx: 196, cy: 156, rx: 30, ry: 20 }),
    s('ellipse', { cx: 258, cy: 166, rx: 16, ry: 9 }))
  const subject = s('g', { class: 'subject' }, cupG, stream, steam, potTilt)
  const world = s('g', { class: 'world' }, garden, table, ground, beams, smudge, subject)
  const cam = s('g', null, world)

  // ── the jumble a crammed prompt makes: four unrelated half-shots cutting into each other
  const walker = s('g', { class: 'cut' },
    s('path', { class: 'haze', d: 'M0 130 Q200 110 432 136 L432 243 L0 243Z', filter: 'url(#ink-wash)' }),
    s('path', { class: 'ink-s', d: stroke([[0, 196], [216, 190], [432, 198]], 2, { head: 0.05, tail: 0.4, min: 0.4 }) }),
    bamboo(120, 10, 6, 9), bamboo(320, 30, 5, 10),
    // a walker in a robe and a wide straw hat, staff in hand, a soft shadow at the feet
    s('path', { class: 'shade', d: blob(218, 193, 26, 4, 3, 0.15), filter: 'url(#ink-wash)' }),
    s('path', { class: 'robe', d: 'M210 120 C204 134 200 158 196 186 Q214 190 236 185 C232 160 228 136 222 120 Q216 116 210 120Z', filter: 'url(#ink-wash)' }),
    s('path', { class: 'ink-s', d: stroke([[211, 120], [205, 140], [200, 164], [196, 186]], 3.2, { head: 0.08, tail: 0.5, min: 0.3 }) }),
    s('path', { class: 'ink-s', d: stroke([[222, 121], [229, 150], [236, 185]], 2, { head: 0.1, tail: 0.6, min: 0.25 }) }),
    s('path', { class: 'ink-s', d: stroke([[214, 134], [222, 146], [232, 150]], 2.6, { head: 0.1, tail: 0.5, min: 0.3 }) }),
    s('path', { class: 'ink-s', d: stroke([[205, 186], [201, 193]], 3, { head: 0.2, tail: 0.5 }) }),
    s('path', { class: 'ink-s', d: stroke([[226, 186], [232, 192]], 3, { head: 0.2, tail: 0.5 }) }),
    s('path', { class: 'ink-s', d: stroke([[238, 104], [236, 150], [233, 194]], 1.8, { head: 0.1, tail: 0.3, min: 0.5 }) }),
    s('path', { class: 'ink-s', d: 'M192 117 Q204 104 216 101 Q228 104 240 117 Q216 112 192 117Z' }),
    s('path', { class: 'ink-s', d: stroke([[190, 117.5], [216, 113], [242, 117.5]], 2.2, { head: 0.1, tail: 0.5, min: 0.3 }) }))
  const sunset = s('g', { class: 'cut' },
    s('path', { class: 'sun', d: 'M190 160 A42 42 0 0 1 274 160Z' }),
    s('path', { class: 'ink-s', d: stroke([[0, 160], [216, 158], [432, 161]], 2.2, { head: 0.05, tail: 0.4, min: 0.4 }) }),
    ...[0, 1, 2, 3].map((i) => s('path', { class: 'sun', 'fill-opacity': 0.7 - i * 0.14, d: stroke([[200 + i * 5, 172 + i * 12], [264 - i * 5, 172 + i * 12]], 4 - i * 0.6, { head: 0.2, tail: 0.5 }) })),
    s('path', { class: 'ink-s', d: stroke([[120, 70], [128, 76], [136, 68]], 2, { head: 0.2, tail: 0.5 }) }),
    s('path', { class: 'ink-s', d: stroke([[146, 58], [152, 63], [158, 57]], 1.6, { head: 0.2, tail: 0.5 }) }))
  const logo = s('g', { class: 'cut' },
    ...[0, 1, 2].map((i) => s('path', { class: 'ink-s', 'fill-opacity': 0.35, d: stroke([[40, 104 + i * 16], [150, 106 + i * 14]], 3, { head: 0.6, tail: 0.3 }) })),
    s('g', { transform: 'rotate(-9 230 120)' },
      s('text', { class: 'logo-t', x: 230, y: 132, 'text-anchor': 'middle' }, C.scenes.image.words.brand),
      s('rect', { class: 'seal', x: 300, y: 100, width: 14, height: 14, rx: 1.5 })))
  const cuts = [s('g', null, cam), walker, sunset, logo]
  // reduced motion: no cutting, the four half-shots sit side by side instead
  const QUAD = [[0, 0], [FW / 2, 0], [0, FH / 2], [FW / 2, FH / 2]]
  const content = s('g', { class: 'content' }, ...cuts)
  const veil = s('rect', { class: 'veil', x: 0, y: 0, width: FW, height: FH })

  // ── viewfinder chrome
  const brk = (x: number, y: number, dx: number, dy: number) => s('path', { class: 'brk', d: `M${x} ${y + dy * 14}V${y}H${x + dx * 22}` })
  const chev = (x: number, y: number, dx: number, dy: number) => s('path', { class: 'chev', d: `M${x - dx * 6} ${y}L${x} ${y}L${x} ${y - dy * 6}`, transform: `translate(${dx * 4} ${dy * 4})` })
  const chevs = [chev(52, 40, 1, -1), chev(FW - 52, 40, -1, -1), chev(52, FH - 40, 1, 1), chev(FW - 52, FH - 40, -1, 1)]
  const rec = s('circle', { class: 'rec', cx: 22, cy: 22, r: 3.6 })
  const tc = s('text', { class: 'tc lab', x: 32, y: 25.5 }, '--:--')
  const chrome = s('g', { class: 'chrome' },
    brk(12, 12, 1, 1), brk(FW - 12, 12, -1, 1), brk(12, FH - 12, 1, -1), brk(FW - 12, FH - 12, -1, -1),
    s('g', { class: 'chevs' }, ...chevs), rec, tc)
  const frame = s('g', { transform: 'translate(24 10)' },
    s('rect', { class: 'screen', x: 0, y: 0, width: FW, height: FH }),
    s('g', { 'clip-path': `url(#${id}-clip)` }, content, veil),
    chrome,
    s('rect', { class: 'screen-edge', x: 0, y: 0, width: FW, height: FH }))

  // ── the edit timeline: one clip for this prompt, its sound underneath
  const end = T0 + 8 * PX
  const wr = rng(17)
  let wave = ''
  for (let x = T0 + 3; x < end - 2; x += 3.2) {
    const a = 1.5 + Math.abs(Math.sin(x * 0.08) * 5 + Math.sin(x * 0.31) * 2.5) * (0.5 + wr() * 0.6)
    wave += `M${x.toFixed(1)} ${(303 - a).toFixed(1)}V${(303 + a).toFixed(1)}`
  }
  const head = s('g', { class: 'playhead' },
    s('path', { d: `M${T0} 262V314` }),
    s('path', { class: 'ph-cap', d: `M${T0 - 4} 258H${T0 + 4}L${T0} 263Z` }))
  const thumb = s('g', { class: 'tip thumb' },
    s('rect', { class: 'thumb-p', x: 26, y: 262, width: 24, height: 30, rx: 1.5 }),
    s('g', { transform: 'translate(39 284) scale(0.15)' }, potInk()),
    s('path', { class: 'link', d: `M51 277 H${T0 - 3}` }),
    s('text', { class: 'tl-cap lab', x: 24, y: 330 }, S.words.first))
  const timeline = s('g', { class: 'timeline' },
    s('path', { class: 'track', d: `M24 277H456M24 303H456` }),
    s('path', { class: 'spk', d: 'M30 300h3l4 -3v12l-4 -3h-3z' }),
    thumb,
    s('rect', { class: 'clip', x: T0, y: 268, width: end - T0, height: 19, rx: 3 }),
    s('text', { class: 'clip-t lab', x: T0 + 7, y: 281 }, S.words.shot),
    s('text', { class: 'clip-end lab time', x: end - 6, y: 281, 'text-anchor': 'end' }, S.words.end),
    s('text', { class: 'clip-end lab notime', x: end - 6, y: 281, 'text-anchor': 'end' }, '?'),
    s('g', { class: 'ticks' }, ...Array.from({ length: 9 }, (_, i) => s('path', { d: `M${T0 + i * PX} ${i % 4 ? 263 : 260}V266` }))),
    ...S.words.next.map((t, i) => {
      const x = end + 8 + i * 106
      return s('g', { class: 'tip' },
        s('rect', { class: 'clip ghost', x, y: 268, width: 98, height: 19, rx: 3 }),
        s('text', { class: 'clip-t lab', x: x + 7, y: 281 }, t))
    }),
    s('path', { class: 'flat', d: `M${T0} 303H${end}` }),
    s('path', { class: 'wave', d: wave }),
    head)

  const svg = s('svg', { class: 't13-art t13v', viewBox: '0 0 480 336', role: 'img', 'aria-label': S.artLabel }, defs, frame, timeline)
  k.stage.append(svg)

  // ── motion: the 8-second shot loops; a crammed prompt cuts between four things instead
  // the pot tips over the front edge of its base, which stays on the table
  const EDGE = '201 176'
  // the timecode only changes once a second: skip the DOM write on the other frames
  const loop = gsap.timeline({ repeat: -1, paused: true, onUpdate: () => {
    const tcNow = svg.classList.contains('s-time') ? `00:0${Math.min(8, Math.floor(loop.time()))}` : '--:--'
    if (tc.textContent !== tcNow) tc.textContent = tcNow
  } })
  loop.fromTo(head, { x: 0 }, { x: end - T0, duration: 8, ease: 'none' }, 0)
    .fromTo(potTilt, { rotation: 0, svgOrigin: EDGE }, { rotation: 18, svgOrigin: EDGE, duration: 1.3, ease: 'power2.inOut' }, 0.3)
    .fromTo(stream, { opacity: 0, strokeDashoffset: 0 }, { opacity: 1, duration: 0.3 }, 1.5)
    .to(stream, { strokeDashoffset: -60, duration: 5, ease: 'none' }, 1.5)
    .fromTo(level, { attr: { cy: -4, rx: 9, ry: 2 }, opacity: 0.3 }, { attr: { cy: -14, rx: 18, ry: 3.6 }, opacity: 1, duration: 4.6, ease: 'sine.inOut' }, 1.7)
    .to(stream, { opacity: 0, duration: 0.3 }, 6.4)
    .to(potTilt, { rotation: 0, duration: 1.2, ease: 'power2.inOut' }, 6.5)
    .to({}, { duration: 0.1 }, 7.9)
  const camTween = gsap.fromTo(cam, { scale: 1, svgOrigin: `${FW / 2} ${FH / 2}` }, { scale: 1.1, duration: 8, ease: 'none', repeat: -1, paused: true })
  const wobble = gsap.to(turb, { attr: { baseFrequency: 0.03 }, duration: 0.7, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true })
  let cutTimer = 0
  let cutIdx = 0
  const showCut = (i: number) => cuts.forEach((c, j) => c.setAttribute('opacity', j === i ? '1' : '0'))
  const chaos = (on: boolean) => {
    clearInterval(cutTimer)
    content.setAttribute('filter', on ? `url(#${id}-wob)` : 'none')
    if (on && !ctx.reduced) {
      if (ctx.quality === 'high') wobble.play()
      cutTimer = window.setInterval(() => showCut((cutIdx = (cutIdx + 1) % 4)), 620)
      showCut(cutIdx)
    } else {
      wobble.pause()
      showCut(0)
    }
    cuts.forEach((c, j) => {
      if (on && ctx.reduced) {
        c.setAttribute('transform', `translate(${QUAD[j][0]} ${QUAD[j][1]}) scale(0.5)`)
        c.setAttribute('opacity', '1')
      } else c.removeAttribute('transform')
    })
    svg.classList.toggle('is-chaos', on)
  }

  let shotWas: boolean | null = null
  return {
    update(on, vague, instant) {
      const v = (i: number) => !vague && on[i]
      CLS.forEach((c, i) => svg.classList.toggle(c, v(i)))
      // framing: wide (lots of empty space) or close on the pour
      if (shotWas !== v(0)) {
        shotWas = v(0)
        const Sc = v(0) ? 1.62 : 1
        const to = { x: v(0) ? FW / 2 - 224 * Sc : 0, y: v(0) ? FH / 2 - 146 * Sc : 0, scale: Sc, svgOrigin: '0 0' }
        if (instant) gsap.set(world, to)
        else gsap.to(world, { ...to, duration: 1.6, ease: 'power3.inOut' })
      }
      chaos(!v(2))
      if (ctx.reduced) {
        loop.pause(3.4)
      } else if (v(2)) loop.play()
      else loop.pause(0)
      if (v(3) && !ctx.reduced) camTween.play()
      else camTween.pause(0)
      if (!v(7) || !v(2)) tc.textContent = '--:--'
    },
    done() {
      if (ctx.reduced) return
      gsap.from(svg.querySelectorAll('.tip'), { opacity: 0, x: -10, duration: 1, stagger: 0.25, delay: 0.5, ease: 'power3.out' })
    },
    dispose() {
      clearInterval(cutTimer)
      loop.kill()
      camTween.kill()
      wobble.kill()
    },
  }
}

export function videoScene(ctx: SceneCtx) {
  return formula(ctx, S, buildArt)
}
