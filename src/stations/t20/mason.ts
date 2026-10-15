import raw from '../../content/tram-20.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import type { CodeScroll } from '../../ui/part2/types'
import { codeScroll } from '../../ui/part2/code'
import { onSize, p2Defs, stableHeight, stoneArt } from '../../ui/part2/ink'

const M = raw.scenes.mason
const STEPS = M.code.code.split('\n').length // one stone step per line of the proof

/** Scene 3 · the stonemason: tap every step (the machine checks each line), then hold the sign up to the original problem. */
export function masonScene(ctx: SceneCtx) {
  p2Defs()
  const stableH = stableHeight(ctx, M.insights.map((x) => x as Fact))
  const rung = new Set<number>()
  const steps = Array.from({ length: STEPS }, (_, i) =>
    h('button', { class: 't20m-step', type: 'button', style: `--i:${i}`, 'aria-label': fill(M.stepAria, { n: i + 1 }), 'aria-pressed': 'false', onClick: () => tap(i) },
      s('svg', { viewBox: '-56 -34 112 40', 'aria-hidden': 'true' },
        s('g', { transform: 'translate(0 2)' }, stoneArt(104, 30, 2000 + i * 13)),
        s('path', { class: 't20m-tick', d: 'M-7 -14l5 5l10 -11' })),
      h('span', { class: 't20m-n', 'aria-hidden': 'true' }, String(i + 1))))
  const stair = h('div', { class: 't20m-stair' },
    s('svg', { class: 't20m-lantern', viewBox: '0 0 40 60', 'aria-hidden': 'true' },
      s('circle', { class: 't20m-glow', cx: 20, cy: 20, r: 18 }),
      s('path', { class: 't20m-toro', d: 'M6 12h28l-6-8h-16zM10 14h20v14h-20zM17 28h6v20h-6zM8 48h24v4h-24z' }),
      s('rect', { class: 't20m-flame', x: 15, y: 17, width: 10, height: 8 })),
    ...steps)
  const ok = h('p', { class: 't20m-ok' }, M.machineOk)
  const compare = h('button', { class: 't20m-compare', type: 'button', 'aria-label': M.compareAria, onClick: compareSign }, M.compare)
  const result = h('div', { class: 't20m-result' },
    h('p', { class: 't20m-original' }, M.original),
    h('p', { class: 't20m-mismatch' }, M.mismatch))
  ok.hidden = compare.hidden = result.hidden = true
  const sign = h('div', { class: 't20m-sign' },
    codeScroll(M.code as CodeScroll),
    ctx.fact(M.codeNote as Fact, 'p', 't20m-note'))
  const side = h('div', { class: 't20m-side' }, sign, ok, compare, result)
  const root = h('div', { class: 't20 t20m' }, stair, side)
  ctx.art.append(root)
  ctx.prompt(M.prompt)
  ctx.onCleanup(onSize(ctx.art, () => {
    root.style.height = `${stableH(ctx.art.clientHeight)}px`
  }))

  function tap(i: number) {
    const b = steps[i]
    b.classList.remove('ring')
    void b.offsetWidth // restart the ring on a second tap
    b.classList.add('ring', 'done')
    b.setAttribute('aria-pressed', 'true')
    ctx.chime('tap')
    if (rung.has(i)) return
    rung.add(i)
    if (rung.size < STEPS) return
    ok.hidden = compare.hidden = false
    ctx.insight(M.insights[0] as Fact)
  }

  function compareSign() {
    if (!result.hidden) return
    result.hidden = false
    root.classList.add('compared')
    compare.hidden = true
    ctx.chime('low')
    ctx.insight(M.insights[1] as Fact, M.detail as Fact)
    result.setAttribute('tabindex', '-1')
    result.focus({ preventScroll: true })
  }
}
