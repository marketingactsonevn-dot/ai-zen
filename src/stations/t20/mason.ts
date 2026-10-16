import raw from '../../content/tram-20.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import type { CodeScroll } from '../../ui/part2/types'
import { codeScroll } from '../../ui/part2/code'
import { blob, clamp, curve, onSize, p2Defs, rng, stableHeight, stoneArt, stroke } from '../../ui/part2/ink'
import { grass, hills, mist, moon, paperLantern, pine, wash } from '../../ui/part2/paint'

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
  const hill = s('svg', { class: 't20m-hill', 'aria-hidden': 'true' })
  const stair = h('div', { class: 't20m-stair' },
    hill,
    s('svg', { class: 't20m-lantern', viewBox: '0 0 60 100', 'aria-hidden': 'true' },
      // a bamboo pole with a paper lantern; the old mason crouched under it, hammer raised
      s('path', { class: 't20m-pole', d: stroke([[48, 99], [47, 50], [48, 8]], 3, 0.02, 0.05, 0.6) + stroke([[48, 10], [36, 12], [26, 16]], 2, 0.05, 0.4, 0.3), filter: 'url(#ink-rough)' }),
      paperLantern(26, 16, 7, 2031, 4),
      s('path', { class: 't20m-mason', d:
        stroke(curve([14, 66], [22, 63], [30, 68], 6), 3, 0.2, 0.3, 0.3) + // hat brim
        stroke([[18, 66], [22, 60], [27, 66]], 5, 0.2, 0.3, 0.4) + // hat crown
        stroke(curve([22, 70], [16, 80], [24, 92], 8), 9, 0.05, 0.25, 0.5) + // bent back
        stroke(curve([24, 92], [31, 93], [36, 99], 6), 4, 0.1, 0.4, 0.3) + // knee
        stroke(curve([25, 76], [34, 78], [40, 72], 6), 3, 0.1, 0.4, 0.3) + // arm
        stroke([[39, 74], [43, 66]], 2, 0.1, 0.1, 0.5) + stroke([[40, 66], [46, 66]], 4, 0.1, 0.1, 0.6), // hammer
        filter: 'url(#ink-rough)' })),
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
    paintHill(hill, stair.clientWidth, stair.clientHeight)
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

/** The hill the steps climb, in the stair's px: night sky with the moon, far ridges, a mossy slope, a pine at the top. */
function paintHill(svg: SVGSVGElement, W: number, H: number) {
  if (W < 40 || H < 40) return
  const r = rng(2040)
  const slope = `M${-W * 0.1} ${H + 10}L${-W * 0.1} ${H * 0.95}Q${W * 0.45} ${H * 0.8} ${W * 0.75} ${H * 0.25}Q${W * 0.9} ${-H * 0.05} ${W * 1.1} ${-H * 0.1}V${H + 10}Z`
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.replaceChildren(
    mist(W * 0.55, H * 0.15, W * 0.7, H * 0.5),
    moon(W * 0.18, -H * 0.18, clamp(W * 0.03, 10, 20), 2041, true),
    hills(-W * 0.2, W * 1.2, H * 0.45, H * 0.55, 2042, 0.85, 5),
    wash(slope, 0.22),
    s('path', { class: 't20m-slope-ink', d: stroke(curve([W * 0.02, H * 0.94], [W * 0.5, H * 0.78], [W * 0.78, H * 0.22], 18), 2.4, 0.05, 0.4, 0.2), filter: 'url(#ink-rough)' }),
    pine(W * 0.97, H * 0.08, H * 0.7, 2043, -1),
    grass(W * 0.12, H * 0.98, 24, 2044),
    grass(W * (0.3 + r() * 0.2), H * 0.86, 18, 2046),
    wash(blob(W * 0.5, H + 4, W * 0.6, 10, 2045, 0.1), 0.15))
}
