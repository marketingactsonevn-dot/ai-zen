import raw from '../../content/tram-32.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { live, night, stroke, type Pt } from '../t31/kit'

const K = raw.scenes.scale
type Weight = (typeof K.weights)[number]

const PX = 300, PY = 92, ARM = 190

/** Scene 1 — a steelyard hanging from an old pine: local lamp on the left pan, the cloud over the moon on the right. */
export function scaleScene(ctx: SceneCtx) {
  const placed: Record<string, number> = { local: 0, cloud: 0 }
  const stack: Record<string, SVGGElement> = { local: s('g'), cloud: s('g') }
  const panG: Record<string, SVGGElement> = {}
  const beam = s('g', { class: 't32s-beam' })
  const pan = (side: string, x: number) => {
    const g = s('g', { class: 't32s-pan' },
      s('path', { class: 'g11-ink2', d: stroke([[x, PY], [x - 46, 196]], 1, 0, 0) + stroke([[x, PY], [x + 46, 196]], 1, 0, 0) }),
      s('path', { class: 'g11-ink', d: `M${x - 58} 196Q${x} 222 ${x + 58} 196Z` }),
      s('path', { class: 'g11-ink2', d: stroke([[x - 54, 197], [x + 54, 197]], 1.2, 0.1, 0.1) }),
      side === 'local'
        ? s('g', null, // a small house with an oil lamp in the window
          s('path', { class: 'g11-card', d: `M${x - 26} 194V170h52V194Z` }),
          s('path', { class: 'g11-ink', d: `M${x - 34} 172Q${x} 150 ${x + 34} 172Q${x} 166 ${x - 34} 172Z` }),
          s('rect', { class: 't32s-lamp', x: x - 8, y: 176, width: 16, height: 12 }),
          s('path', { class: 'g11-ink', d: stroke([[x - 26, 194], [x - 26, 170]], 1.6, 0, 0) + stroke([[x + 26, 194], [x + 26, 170]], 1.6, 0, 0) }))
        : s('g', null, // a silver cloud over half a moon
          s('circle', { class: 'g11-moon', cx: x + 14, cy: 176, r: 15 }),
          s('path', { class: 't32s-cloud', d: `M${x - 40} 192C${x - 44} 178 ${x - 26} 172 ${x - 18} 178C${x - 14} 164 ${x + 6} 162 ${x + 10} 176C${x + 22} 170 ${x + 40} 178 ${x + 36} 192Z` })),
      stack[side])
    panG[side] = g
    return g
  }
  beam.append(
    s('path', { class: 'g11-ink', d: stroke([[PX - ARM - 6, PY], [PX, PY - 3], [PX + ARM + 6, PY]], 5, 0.04, 0.04, 0.6) }),
    s('circle', { class: 'g11-ink', cx: PX - ARM, cy: PY, r: 3.5 }),
    s('circle', { class: 'g11-ink', cx: PX + ARM, cy: PY, r: 3.5 }))
  const art = s('svg', { class: 't32s-art', viewBox: '0 0 600 240', 'aria-hidden': 'true' },
    // pine branch with needle tufts, a cord down to the pivot
    s('path', { class: 'g11-ink', d: stroke([[-10, 22], [140, 12], [300, 26], [460, 14], [610, 30]], 9, 0.02, 0.1, 0.4), filter: 'url(#ink-rough)' }),
    ...[60, 190, 400, 540].map((x, i) => s('path', {
      class: 'g11-moss', 'fill-opacity': 0.8,
      d: Array.from({ length: 7 }, (_, k) => { const a = -1.1 + k * 0.36; return stroke([[x, 18 + (i % 2) * 6], [x + Math.cos(a) * 34, 18 + (i % 2) * 6 + Math.sin(a) * 18 + 8]] as Pt[], 2, 0.1, 0.6) }).join(''),
    })),
    s('path', { class: 'g11-ink2', d: stroke([[PX, 24], [PX, PY - 4]], 1.4, 0, 0) }),
    beam,
    pan('local', PX - ARM), pan('cloud', PX + ARM),
    s('circle', { class: 'g11-ink', cx: PX, cy: PY - 2, r: 5 }))

  let cur = 0
  const tray = K.weights.map((w, k) => h('button', { class: 't32s-stone', type: 'button', 'aria-pressed': String(k === 0), onClick: () => select(k) }, w.label))
  const sides = K.sides.map((sd) => h('button', { class: 'g11-pill t32s-side', type: 'button', onClick: () => put(sd.id) }, sd.name))
  const say = live('g11-say t32s-say')
  const root = h('div', { class: 'g11 t32s', role: 'group', 'aria-label': K.aria },
    night(),
    h('p', { class: 'visually-hidden' }, K.art),
    art,
    h('div', { class: 't32s-sides' }, ...sides),
    h('div', { class: 't32s-tray' }, ...tray),
    say)
  ctx.art.append(root)

  const left = () => K.weights.map((_, k) => k).filter((k) => !tray[k].hidden)
  function label() {
    const w = K.weights[cur]
    sides.forEach((b, k) => b.setAttribute('aria-label', w ? fill(K.weightAria, { label: w.label, side: K.sides[k].name }) : K.sides[k].aria))
  }
  function select(k: number) {
    cur = k
    tray.forEach((b, j) => b.setAttribute('aria-pressed', String(j === k)))
    label()
  }
  function tilt() {
    const deg = Math.max(-12, Math.min(12, (placed.cloud - placed.local) * 3.2))
    beam.style.transform = `rotate(${deg}deg)`
    const dy = ARM * Math.sin((deg * Math.PI) / 180)
    panG.local.style.transform = `translateY(${(-dy).toFixed(1)}px)`
    panG.cloud.style.transform = `translateY(${dy.toFixed(1)}px)`
  }
  function put(side: string) {
    const w: Weight | undefined = K.weights[cur]
    if (!w || tray[cur].hidden) return
    if (w.side !== side) {
      ctx.chime('low')
      say.say(h('span', { class: 'bad' }, K.wrong))
      return
    }
    ctx.chime('tap')
    const n = placed[side]++
    const x = (side === 'local' ? PX - ARM : PX + ARM) + (n % 3 - 1) * 18 + (n > 2 ? 9 : 0)
    const y = 192 - (n > 2 ? 9 : 0)
    stack[side].append(s('path', { class: 't32s-weight', d: `M${x - 8} ${y}Q${x - 9} ${y - 9} ${x} ${y - 10}Q${x + 9} ${y - 9} ${x + 8} ${y}Z` }))
    tray[cur].hidden = true
    tilt()
    say.say(h('strong', null, `${K.right} `), w.why)
    const rest = left()
    if (rest.length) {
      select(rest[0])
      tray[rest[0]].focus({ preventScroll: true })
      return
    }
    label()
    sides.forEach((b) => (b.disabled = true))
    ctx.insight(K.insight as Fact, K.detail as Fact)
  }
  label()
  ctx.prompt(K.prompt)
}
