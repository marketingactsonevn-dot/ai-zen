import { s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, scribble, stroke } from './ink'
import { formula, type ArtApi, type Kit } from './kit'
import { potInk } from './pot'

const S = C.scenes.text
const WD = S.words
// slot order: 0 vai trò · 1 bối cảnh · 2 nhiệm vụ · 3 dữ liệu, ví dụ · 4 ràng buộc · 5 định dạng · 6 hỏi lại
const CLS = ['s-role', 's-ctx', 's-task', 's-data', 's-limit', 's-format', 's-ask']
const VW = 420
const VH = 320

/**
 * One answer card. What the prompt says decides its shape: a long grey wall of words (vague), or a short post
 * for a busy reader, with a picture, grounded in the source (no "?"), calm (no "!"), and in three versions.
 */
function card(on: boolean[], x: number, y: number, w: number, seed: number, tag?: string) {
  const [role, ctx, task, data, limit] = on
  const g = s('g', { class: `answer${role ? ' is-pro' : ''}` })
  const lines = limit ? 5 : 9
  const lh = 11.5
  let top = y + 14
  const body: SVGElement[] = []
  if (tag) body.push(s('text', { class: 'opt', x: x + 10, y: y + 15 }, tag))
  if (task) {
    // a post: a small picture of the tea on top
    const ih = Math.round(w * 0.42)
    body.push(
      s('rect', { class: 'pic', x: x + 8, y: top + (tag ? 6 : 0), width: w - 16, height: ih, rx: 2 }),
      s('g', { transform: `translate(${x + w / 2 + 4} ${top + (tag ? 6 : 0) + ih - 6}) scale(${(w / 300).toFixed(3)})` }, potInk()))
    top += ih + (tag ? 14 : 10)
  } else if (tag) top += 10
  if (role) body.push(s('path', { class: 'ink-s head-l', d: stroke([[x + 10, top + 4], [x + w * 0.62, top + 3]], 4.2, { head: 0.08, tail: 0.4, min: 0.4 }) }))
  top += role ? 16 : 4
  const marks: SVGElement[] = []
  for (let i = 0; i < lines; i++) {
    if (ctx && i && i % 2 === 0) top += 6 // short paragraphs for a busy reader
    const last = i === lines - 1 || (ctx && i % 2 === 1)
    const x1 = x + w - 10 - (last ? w * 0.3 : (seed * 7 + i * 13) % 18)
    body.push(s('path', { class: 'scr', d: scribble(x + 10, top + i * lh, x1, seed * 10 + i, 2.4) }))
    if (!data && (i === 2 || i === 5 || i === 7) && i < lines) marks.push(s('text', { class: 'q', x: x + w + 4, y: top + i * lh + 1 }, '?'))
    if (!limit && (i === 3 || i === 8)) marks.push(s('text', { class: 'ex', x: x1 + 3, y: top + i * lh + 1 }, '!!'))
  }
  const h = top + (lines - 1) * lh + 14 - y
  g.append(s('path', { class: 'sheet-sh', d: blob(x + w / 2 + 4, y + h / 2 + 5, w / 2, h / 2, seed, 0.03, 26), filter: 'url(#ink-wash)' }),
    s('rect', { class: 'sheet', x, y, width: w, height: h, rx: task ? 6 : 1.5 }),
    ...body, ...marks)
  return { g, h }
}

function buildArt(k: Kit): ArtApi {
  // the source sheets (Dữ liệu, ví dụ): the document and a sample post, tied to the answer by threads
  const doc = s('g', { class: 'src-doc' },
    s('rect', { class: 'sheet', x: 14, y: 54, width: 74, height: 92, rx: 1.5 }),
    ...[0, 1, 2].map((i) => s('path', { class: 'scr', d: scribble(22, 70 + i * 10, 78 - i * 8, 50 + i, 2) })),
    s('path', { class: 'grid', d: 'M22 104H80M22 116H80M22 128H80M22 104V136M51 104V136M80 104V136M22 136H80' }),
    s('text', { class: 'lbl lab', x: 51, y: 160, 'text-anchor': 'middle' }, WD.source))
  const sample = s('g', { class: 'src-doc' },
    s('rect', { class: 'sheet', x: 14, y: 182, width: 74, height: 76, rx: 1.5 }),
    ...[0, 1, 2, 3].map((i) => s('path', { class: 'ink-s', d: stroke([[22, 198 + i * 13], [50, 196 + i * 13], [78 - i * 9, 199 + i * 13]], 2.2, { head: 0.1, tail: 0.5, min: 0.3 }) })),
    s('text', { class: 'lbl lab', x: 51, y: 272, 'text-anchor': 'middle' }, WD.sample))
  const threads = s('g', { class: 'threads' },
    s('path', { d: 'M90 100 C116 100 120 120 142 126' }),
    s('path', { d: 'M90 220 C118 220 122 196 142 190' }))
  const data = s('g', { class: 'data' }, threads, doc, sample)
  // Hỏi lại: before writing, the AI asks what it is missing
  const ask = s('g', { class: 'askb' }, s('g', { class: 'lab ask-lab' },
    s('path', { class: 'bubble', d: 'M286 12 H406 Q414 12 414 20 V62 Q414 70 406 70 H330 L318 82 L320 70 H286 Q278 70 278 62 V20 Q278 12 286 12Z' }),
    ...WD.ask.map((q, i) => s('text', { class: 'ask-t', x: 288, y: 34 + i * 20 }, q))))

  // the writing desk, low in the corner: an ink stone slab (well at the far end), a brush on its rest in front
  const [ix, iy] = [380, 288]
  // a river-stone inkstone: irregular, thick, a carved pool at one end
  const top = blob(ix, iy, 30, 10, 11, 0.12, 20)
  const front = blob(ix + 1, iy + 5.5, 30, 10, 11, 0.12, 20)
  const desk = s('g', { class: 'desk', 'aria-hidden': 'true' },
    s('path', { class: 'pot-under', d: blob(ix + 4, iy + 15, 36, 4.5, 3, 0.1), filter: 'url(#ink-wash)' }),
    s('path', { class: 'slab-f', d: front }),
    s('path', { class: 'inkstone', d: top }),
    s('path', { class: 'grind', d: blob(ix + 9, iy - 1, 14, 5, 4, 0.12, 14) }),
    s('path', { class: 'carve', d: blob(ix - 15, iy - 0.5, 11, 6, 2, 0.1, 14) }),
    s('path', { class: 'inkwell', d: blob(ix - 15, iy, 8.5, 4.4, 2, 0.1, 12) }),
    s('path', { class: 'sheen', d: stroke([[ix - 20, iy - 1.5], [ix - 15, iy - 3], [ix - 10, iy - 2]], 1.2, { head: 0.2, tail: 0.6 }) }),
    s('path', { class: 'rim', d: top, filter: 'url(#ink-rough)' }),
    // the ceramic rest (three low peaks) and the brush lying on it
    s('path', { class: 'pot-under', d: blob(338, 314, 13, 2.2, 5, 0.1), filter: 'url(#ink-wash)' }),
    s('path', { class: 'rest', d: 'M326 314 Q328 306 331 308 Q334.5 300 338 304.5 Q341.5 300 345 308 Q348 306 350 314Z' }),
    s('path', { class: 'ink-s', d: stroke([[326, 314], [331, 308], [338, 304], [345, 308], [350, 314]], 1.2, { head: 0.15, tail: 0.5, min: 0.3 }) }),
    s('path', { class: 'bamboo-h', d: stroke([[262, 309.5], [300, 307], [342, 304]], 4, { head: 0.02, tail: 0.05, min: 0.85 }) }),
    ...[276, 300, 324].map((x) => s('path', { class: 'node', d: stroke([[x, 310.6 - (x - 262) * 0.072], [x + 0.4, 306.6 - (x - 262) * 0.072]], 1.9, { head: 0.3, tail: 0.5 }) })),
    s('path', { class: 'ink-s', d: stroke([[341.5, 304], [346.5, 303.7]], 5.6, { head: 0.1, tail: 0.1, min: 0.9 }) }),
    s('path', { class: 'ink-s', d: stroke([[346.5, 303.7], [354, 303.1], [362, 303.6]], 6, { head: 0.15, tail: 1.4, min: 0.06 }) }))
  // what the red marks mean (only while they are on the page)
  const legend = s('g', { class: 'legend' },
    s('g', { class: 'lab lg-q' }, s('text', { class: 'q', x: 16, y: 298 }, '?'), s('text', { class: 'lbl', x: 30, y: 298 }, WD.legendQ)),
    s('g', { class: 'lab lg-ex' }, s('text', { class: 'ex', x: 14, y: 314 }, '!!'), s('text', { class: 'lbl', x: 30, y: 314 }, WD.legendEx)))
  const holder = s('g')
  const svg = s('svg', { class: 't13-art t13t', viewBox: `0 0 ${VW} ${VH}`, role: 'img', 'aria-label': S.artLabel }, desk, data, holder, legend, ask)
  k.stage.append(svg)

  let cur: SVGGElement | null = null
  let sig = ''
  return {
    update(on, vague, instant) {
      const st = on.map((x) => x && !vague)
      CLS.forEach((c, i) => svg.classList.toggle(c, st[i]))
      const key = st.slice(0, 6).join()
      if (key === sig) return
      sig = key
      const g = s('g', { class: 'cards' })
      if (st[5]) {
        // three options, fanned
        const w = 104
        WD.options.forEach((t, i) => {
          const { g: c, h } = card(st, 0, 0, w, i + 3, t)
          const x = 148 + i * 60
          const y = 30 + Math.abs(i - 1) * 10
          c.setAttribute('transform', `translate(${x - w / 2} ${y}) rotate(${(i - 1) * 5} ${w / 2} ${h / 2})`)
          g.append(c)
        })
        g.append(g.children[1]) // B on top
      } else {
        const { g: c, h } = card(st, 0, 0, 150, 1)
        c.setAttribute('transform', `translate(140 ${Math.max(18, (VH - h) / 2 - 6)})`)
        g.append(c)
      }
      holder.append(g)
      const old = cur
      cur = g
      if (instant) {
        old?.remove()
        return
      }
      gsap.fromTo(g, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' })
      // the words write themselves in, line by line, like a brush moving across the page
      const lines = g.querySelectorAll<SVGPathElement>('.scr')
      lines.forEach((l) => l.setAttribute('pathLength', '1'))
      gsap.fromTo(lines, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: 'none', stagger: 0.06, delay: 0.15 })
      if (old) gsap.to(old, { opacity: 0, duration: 0.5, onComplete: () => old.remove() })
    },
  }
}

export function textScene(ctx: SceneCtx) {
  return formula(ctx, S, buildArt)
}
