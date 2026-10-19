import './part2.css'
import './guide.css'
import { h, nextId, s } from '../../core/dom'
import { L, type Quiz } from '../../core/content'
import { progress } from '../../core/progress'
import { sliced } from '../../core/chunk'
import type { SceneDef } from '../../stations/types'
import { blob, clamp, onSize, p2Defs, rng, seedOf, shuffledIdx, stroke, type Pt } from './ink'
import { hills, mist, moon, water } from './paint'

const f1 = (n: number) => n.toFixed(1)
const px = (n: number) => `${f1(n)}px`

/**
 * The Part 2 quiz (audit v3 E: no four grey menu stones): stepping stones on dark water under the moon, the question
 * written in the sky at top left. Each answer is written on the flat face of its own stone; the stones run from near
 * (lower left) to far (upper right), on phones from far (top) to near (bottom). The order is shuffled per question
 * (stable), so the right answer is not always B. Right: a red seal is stamped on the stone. Wrong: it sinks a little
 * and the prompt says to try another. Hover / focus puts the vermilion dot on a stone (H1); idle 6 s, the stones breathe (H7).
 */
export function quizScene2(id: number, q: Quiz): SceneDef {
  return {
    label: L.quizEyebrow,
    mount(ctx) {
      const qid = nextId('quiz')
      const seed = seedOf(q.q)
      const order = shuffledIdx(q.options.length, seed) // order[k] = which option the k-th stone carries
      defs()
      const paint = s('svg', { class: 'p2q-paint', 'aria-hidden': 'true' })
      const stones = order.map((oi, k) =>
        h('button', { class: 'p2q-stone', type: 'button', style: `--i:${k}`, onClick: () => pick(k) },
          s('svg', { class: 'p2q-stone-art', viewBox: '0 0 200 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, ...slab(seed + oi * 17)),
          h('span', { class: 'p2q-key', 'aria-hidden': 'true' }, String.fromCharCode(65 + k)),
          h('span', { class: 'p2q-text' }, q.options[oi])))
      const passed = progress.isPassed(id)
      const head = h('div', { class: 'p2q-head' },
        h('p', { class: 'p2-eyebrow p2q-label' }, L.quizEyebrow),
        h('h2', { id: qid, class: 'p2q-q' }, q.q),
        passed ? h('p', { class: 'p2q-note' }, L.quizPassed) : null)
      const field = h('div', { class: 'p2q-stones', role: 'group', 'aria-labelledby': qid }, ...stones)
      const root = h('div', { class: 'p2q' }, paint, head, field)
      ctx.art.append(root)
      if (!passed) ctx.prompt(L.quizPrompt)

      function pick(k: number) {
        stones.forEach((b) => b.classList.remove('wrong'))
        if (order[k] === q.answer) {
          stones.forEach((b, j) => {
            b.classList.toggle('right', j === k)
            b.disabled = j !== k
          })
          ctx.insight(`${L.quizRight} ${q.explain}`)
          progress.pass(id)
          ctx.chime('ok')
        } else {
          stones[k].classList.add('wrong')
          ctx.prompt(L.quizWrong, 'wrong')
          ctx.chime('low')
        }
      }

      // ── layout: question top left, stones on the water below it; the painting drawn once per size (first time soaking in)
      let job: { cancel(): void } | null = null
      let first = true
      let painted = ''
      function layout() {
        const W = ctx.art.clientWidth, H = ctx.art.clientHeight
        if (W < 60 || H < 60) return
        const tall = W / H < 1
        root.classList.toggle('tall', tall)
        const n = stones.length
        // widths first (nearer = larger), then one read of the heights the text needs, then the places
        const base = tall ? clamp(W * 0.9, 240, 400) : clamp(W * 0.27, 230, 330)
        const ws = stones.map((_, k) => base * (tall ? 0.9 + 0.1 * (k / (n - 1 || 1)) : 1 - 0.12 * (k / (n - 1 || 1))))
        stones.forEach((b, k) => (b.style.width = px(ws[k])))
        const hs = stones.map((b) => b.offsetHeight)
        const headB = head.offsetTop + head.offsetHeight
        const horizon = Math.max(tall ? H * 0.3 : H * 0.4, headB + (tall ? 10 : 18))
        const at: Pt[] = []
        if (tall) {
          // far (top, just under the horizon) → near (bottom), a slight zig-zag, equal gaps
          const room = H - 6 - (horizon + 10)
          const gap = Math.max(-8, (room - hs.reduce((x, y) => x + y, 0)) / Math.max(1, n - 1))
          let y = horizon + 10
          for (let k = 0; k < n; k++) {
            at.push([W * (0.5 + (k % 2 ? 0.04 : -0.04)), y + hs[k] / 2])
            y += hs[k] + gap
          }
        } else {
          // near lower left → right → farther right → far, back toward the middle: a path of stepping stones
          const spots: Pt[] = [[0.25, 0.8], [0.52, 0.71], [0.76, 0.6], [0.55, 0.48]]
          for (let k = 0; k < n; k++) {
            const [fx, fy] = spots[k] ?? [0.3 + 0.12 * k, 0.8 - 0.1 * k]
            at.push([clamp(W * fx, ws[k] / 2 + 8, W - ws[k] / 2 - 8), Math.min(H - hs[k] / 2 - 6, Math.max(H * fy, horizon + hs[k] / 2 + 10))])
          }
        }
        stones.forEach((b, k) => {
          // top = the stone's centre (CSS translates it up by half), nearer stones above farther ones
          Object.assign(b.style, { left: px(at[k][0] - ws[k] / 2), top: px(at[k][1]), zIndex: String(Math.round(at[k][1])) })
        })
        const key = `${W}x${H}x${Math.round(horizon)}`
        if (key === painted) return
        painted = key
        job?.cancel()
        job = sliced(scenery(W, H, horizon, tall, seed), { sync: ctx.reduced || !first })
        first = false
      }
      function* scenery(W: number, H: number, horizon: number, tall: boolean, sd: number) {
        const moonX = W * (tall ? 0.86 : 0.8), moonY = tall ? Math.min(H * 0.05, 34) : horizon * 0.34
        const g = s('g')
        paint.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
        paint.replaceChildren(g)
        g.append(moon(moonX, moonY, clamp(Math.min(W, H) * 0.045, 14, 40), sd))
        yield
        g.append(hills(-W * 0.1, W * 0.7, horizon, horizon * 0.42, sd + 1, 0.9, 4), mist(W * 0.4, horizon, W * 0.55, horizon * 0.1))
        yield
        g.append(hills(W * 0.35, W * 1.1, horizon, horizon * 0.3, sd + 2, 0.55, 3), mist(W * 0.75, horizon * 1.02, W * 0.4, horizon * 0.08))
        yield
        g.append(water(0, horizon, W, H, sd + 3, moonX))
        yield
        // a dark near bank on the lower left frames the near stone; reeds would be noise here, the bank is enough
        g.append(s('path', { class: 'p2q-bank', d: blob(-W * 0.04, H * 1.02, W * 0.22, H * 0.12, sd + 4, 0.12), filter: 'url(#ink-wash)' }))
      }
      ctx.onCleanup(onSize(ctx.art, layout))
      ctx.onCleanup(() => job?.cancel())
    },
  }
}

/** The pale stepping-stone face (url(#p2-step)): --step tokens, so the answer reads in --stone-text in both themes. */
function defs() {
  p2Defs()
  if (document.getElementById('p2-step')) return
  const stop = (o: number, c: string) => s('stop', { offset: o, style: `stop-color:var(${c})` })
  document.getElementById('p2-defs')!.append(s('defs', null,
    s('linearGradient', { id: 'p2-step', x1: 0, y1: 0, x2: 0.25, y2: 1 }, stop(0, '--step-hi'), stop(0.7, '--step-mid'), stop(1, '--step-lo'))))
}

/** A flat stepping stone seen at three quarters, in a 200 × 100 box: water shadow, side band, top face, moonlit rim, moss. */
function slab(seed: number): SVGElement[] {
  const r = rng(seed)
  const top = blob(100, 44, 92, 34, seed, 0.09, 22)
  const side = blob(100, 56, 93, 36, seed + 1, 0.08, 22)
  const rim = stroke([[14, 40], [46, 18 + r() * 3], [108, 11 + r() * 2], [168, 19 + r() * 3], [188, 36]], 3, 0.3, 0.35, 0.15) // along the upper edge
  return [
    s('ellipse', { class: 'p2q-reflect', cx: 104, cy: 86, rx: 96, ry: 14 }),
    s('path', { class: 'p2q-side', d: side, filter: 'url(#ink-rough)' }),
    s('path', { class: 'p2q-face', d: top, fill: 'url(#p2-step)', filter: 'url(#ink-rough)' }),
    s('path', { class: 'p2q-shade', d: top, fill: 'url(#p2-shade)' }),
    s('path', { class: 'p2q-rim', d: rim }),
    s('path', { class: 'p2q-moss', d: blob(30 + r() * 20, 58 + r() * 8, 14 + r() * 8, 5, seed + 2, 0.3) + blob(150 + r() * 25, 60, 10 + r() * 6, 4, seed + 3, 0.3) }),
    s('g', { class: 'p2q-seal', transform: `translate(${f1(183 + r() * 3)} ${f1(56 + r() * 4)}) rotate(-6)` }, // at the right edge, in the padding beside the words
      s('rect', { x: -9, y: -11, width: 18, height: 22, rx: 1.5, filter: 'url(#ink-rough)' }),
      s('path', { d: 'M-4.5 -4h9M-4.5 1h9M0 -8v15' })),
  ]
}
