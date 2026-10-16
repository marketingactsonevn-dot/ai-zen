import raw from '../../content/tram-32.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { stoneArt } from '../../ui/part2/ink'
import { moon } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { blob, curve, flame, live, needles, night, rng, stroke, type Pt } from '../t31/kit'

const K = raw.scenes.scale
type Weight = (typeof K.weights)[number]

const PX = 300, PY = 96, ARM = 196, PAN = 206
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** A woven bamboo tray hanging under (x, PY) on three cords: bowl, weave, rim. */
function tray(x: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const bowl = `M${x - 60} ${PAN}Q${x - 52} ${PAN + 20} ${x} ${PAN + 22}Q${x + 52} ${PAN + 20} ${x + 60} ${PAN}Z`
  let weave = ''
  for (let k = -5; k <= 5; k++) {
    const bx = x + k * 10
    weave += stroke([[bx - 5, PAN + 2], [bx + 4, PAN + 18 - Math.abs(k) * 1.3]], 0.9, 0.2, 0.2, 0.3) + stroke([[bx + 5, PAN + 2], [bx - 4, PAN + 18 - Math.abs(k) * 1.3]], 0.9, 0.2, 0.2, 0.3)
  }
  return [
    s('path', { class: 'g11-thread', d: `M${x} ${PY + 3}L${x - 56} ${PAN}M${x} ${PY + 3}L${x + 56} ${PAN}M${x} ${PY + 3}L${x + 4} ${PAN - 1}` }),
    s('path', { class: 't32s-tray', d: bowl, filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wash t32s-weave', d: weave }),
    s('path', { class: 'g11-wash t32s-rim', d: stroke([[x - 62, PAN + 0.5], [x, PAN + 1.5 + r()], [x + 62, PAN + 0.5]], 2.6, 0.05, 0.05, 0.5) + stroke(curve([x - 58, PAN + 4], [x, PAN + 30], [x + 58, PAN + 4], 12), 1.6, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }),
  ]
}

/** A small house with an oil lamp in its window, standing on the tray at (x, PAN). */
function house(x: number): SVGGElement {
  const y = PAN - 1
  return s('g', { class: 't32s-house' },
    s('circle', { class: 'g11-halo', cx: x - 2, cy: y - 18, r: 38 }),
    s('rect', { class: 't32s-wall', x: x - 24, y: y - 30, width: 48, height: 30 }),
    s('rect', { class: 't32s-win', x: x - 15, y: y - 22, width: 15, height: 12 }),
    flame(x - 7.5, y - 12, 0.32),
    s('path', { class: 'g11-wash t32s-lat', d: stroke([[x - 7.5, y - 22], [x - 7.5, y - 10]], 0.8, 0.1, 0.1, 0.4) + stroke([[x - 15, y - 16], [x, y - 16]], 0.8, 0.1, 0.1, 0.4) }),
    s('rect', { class: 't32s-door', x: x + 5, y: y - 20, width: 11, height: 20 }),
    s('path', { class: 't32s-roof', d: `M${x - 36} ${y - 27}Q${x - 18} ${y - 34} ${x} ${y - 50}Q${x + 18} ${y - 34} ${x + 36} ${y - 27}Q${x + 20} ${y - 31} ${x} ${y - 40}Q${x - 20} ${y - 31} ${x - 36} ${y - 27}Z`, filter: 'url(#ink-wash)' }),
    s('path', { class: 'g11-wash t32s-ink', d: stroke([[x - 37, y - 27], [x - 18, y - 35], [x, y - 50.5], [x + 18, y - 35], [x + 37, y - 27]], 2, 0.1, 0.1, 0.4) + stroke([[x - 24, y - 29], [x - 24, y]], 1.6, 0.1, 0.1, 0.4) + stroke([[x + 24, y - 29], [x + 24, y]], 1.8, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }))
}

/** A silver cloud drawn over half of the moon, sitting on the tray at (x, PAN). */
function cloudMoon(x: number): SVGGElement {
  const y = PAN - 4
  const puffs = blob(x - 22, y - 10, 18, 11, 3201, 0.12, 14) + blob(x - 2, y - 18, 20, 14, 3202, 0.12, 14) + blob(x + 20, y - 11, 17, 10, 3203, 0.12, 14) + blob(x, y - 5, 34, 8, 3204, 0.1, 14)
  const curl = (cx: number, cy: number, R: number, dir: number): string =>
    stroke(Array.from({ length: 14 }, (_, i) => { const a = dir * (i / 13) * Math.PI * 1.6 - Math.PI / 2; const rr = R * (1 - i / 22); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as Pt }), 1.3, 0.1, 0.4, 0.2)
  return s('g', { class: 't32s-cloud' },
    moon(x + 14, y - 30, 17, 3205, false),
    s('path', { class: 't32s-puff', d: puffs, filter: 'url(#ink-wash)' }),
    s('path', { class: 'g11-wash t32s-curl', d: curl(x - 22, y - 12, 7, 1) + curl(x - 1, y - 20, 9, -1) + curl(x + 21, y - 13, 6, 1) + stroke([[x - 36, y - 4], [x, y - 2], [x + 34, y - 4]], 1.4, 0.1, 0.1, 0.3) }))
}

/** Scene 1 — a steelyard hanging from an old pine: local lamp on the left pan, the cloud over the moon on the right. */
export function scaleScene(ctx: SceneCtx) {
  const placed: Record<string, number> = { local: 0, cloud: 0 }
  const stack: Record<string, SVGGElement> = { local: s('g'), cloud: s('g') }
  const panG: Record<string, SVGGElement> = {}
  const beam = s('g', { class: 't32s-beam' })
  const pan = (side: string, x: number) => {
    const g = s('g', { class: 't32s-pan' }, ...tray(x, side === 'local' ? 3210 : 3211), side === 'local' ? house(x) : cloudMoon(x), stack[side])
    panG[side] = g
    return g
  }
  let ticks = ''
  for (let k = -9; k <= 9; k++) if (k) ticks += stroke([[PX + k * 19, PY - 3], [PX + k * 19, PY + 3]], 1, 0.2, 0.2, 0.4)
  beam.append(
    s('path', { class: 't32s-bar', d: stroke([[PX - ARM - 10, PY + 0.5], [PX, PY - 1.5], [PX + ARM + 10, PY + 0.5]], 6, 0.04, 0.04, 0.6), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit', d: stroke([[PX - ARM - 6, PY - 1.6], [PX, PY - 3.2], [PX + ARM + 6, PY - 1.6]], 1.2, 0.1, 0.1, 0.3) }),
    s('path', { class: 't32s-tick', d: ticks }),
    s('circle', { class: 't32s-ring', cx: PX - ARM, cy: PY + 2, r: 4 }),
    s('circle', { class: 't32s-ring', cx: PX + ARM, cy: PY + 2, r: 4 }))

  // the old pine's long limb, reaching in from beyond the left edge (overflow) and thinning over the pivot
  const r = rng(3220)
  const seg1 = [...curve([-460, 96], [-330, 10], [-170, 30], 10), ...curve([-170, 30], [-40, 50], [40, 18], 8).slice(1)]
  const seg2 = curve([40, 18], [170, -8], [300, 22], 10)
  const seg3 = [...curve([300, 22], [380, 44], [460, 30], 6), ...curve([460, 30], [540, 16], [620, 26], 6).slice(1)]
  const limb = [...seg1, ...seg2.slice(1), ...seg3.slice(1)]
  let bark = ''
  for (let i = 0; i < 14; i++) {
    const [bx, by] = limb[2 + Math.floor(r() * 30)]
    bark += stroke([[bx - 7, by + 1.5], [bx, by - 1], [bx + 8, by + 0.5]], 1.6, 0.2, 0.4, 0.2)
  }
  const twigs = stroke(curve([140, 8], [160, -2], [176, -12], 6), 4, 0.1, 0.7, 0.3) + stroke(curve([430, 36], [450, 46], [470, 50], 6), 3.4, 0.1, 0.7, 0.3) + stroke(curve([-80, 42], [-60, 34], [-40, 28], 6), 5, 0.1, 0.7, 0.3)
  const pads = [[-150, 22, 130], [-40, 28, 110], [90, 2, 100], [176, -10, 84], [250, 6, 86], [392, 30, 104], [526, 14, 94], [470, 50, 62]].map(([x, y, w], i) => needles(x, y, w, 3230 + i))
  const art = s('svg', { class: 't32s-art', viewBox: '0 0 600 260', 'aria-hidden': 'true' },
    ...pads.slice(0, 3),
    s('path', { class: 'p2p-trunk t32s-limb', d: stroke(seg1, 22, 0.01, 0.02, 0.62) + stroke(seg2, 13, 0.02, 0.02, 0.75) + stroke(seg3, 8, 0.02, 0.4, 0.3) + twigs, filter: 'url(#ink-rough)' }),
    s('path', { class: 'p2p-bark', d: bark, filter: 'url(#ink-dry)' }),
    s('path', { class: 'g11-moonlit t32s-limb-hi', d: stroke(limb.slice(4, 38).map(([x, y]) => [x, y - 5] as Pt), 1.6, 0.1, 0.3, 0.2) }),
    ...pads.slice(3),
    // the hanger: a cord and an iron hook down to the pivot
    s('path', { class: 'g11-thread t32s-cord', d: `M${PX} 26L${PX} ${PY - 12}` }),
    s('path', { class: 'g11-wash t32s-hook', d: stroke(curve([PX, PY - 14], [PX + 8, PY - 8], [PX, PY - 4], 6), 2.2, 0.1, 0.1, 0.4) }),
    beam,
    pan('local', PX - ARM), pan('cloud', PX + ARM),
    s('circle', { class: 't32s-pivot', cx: PX, cy: PY - 1, r: 5 }))

  let cur = 0
  const trayEl = K.weights.map((w, k) => h('button', { class: 't32s-stone', type: 'button', 'aria-pressed': String(k === 0), onClick: () => select(k) }, w.label))
  const sides = K.sides.map((sd) => h('button', { class: 'g11-pill t32s-side', type: 'button', onClick: () => put(sd.id) }, sd.name))
  const say = live('g11-say t32s-say')
  const root = h('div', { class: 'g11 t32s', role: 'group', 'aria-label': K.aria },
    night({ moon: false, low: true }),
    h('p', { class: 'visually-hidden' }, K.art),
    art,
    h('div', { class: 't32s-sides' }, ...sides),
    h('div', { class: 't32s-tray' }, ...trayEl),
    say)
  ctx.art.append(root)

  const left = () => K.weights.map((_, k) => k).filter((k) => !trayEl[k].hidden)
  function label() {
    const w = K.weights[cur]
    sides.forEach((b, k) => b.setAttribute('aria-label', w ? fill(K.weightAria, { label: w.label, side: K.sides[k].name }) : K.sides[k].aria))
  }
  function select(k: number) {
    cur = k
    trayEl.forEach((b, j) => b.setAttribute('aria-pressed', String(j === k)))
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
    if (!w || trayEl[cur].hidden) return
    if (w.side !== side) {
      ctx.chime('low')
      say.say(h('span', { class: 'bad' }, K.wrong))
      return
    }
    ctx.chime('tap')
    const n = placed[side]++
    // the stones settle in front of the house / cloud, a second row on top
    const x = (side === 'local' ? PX - ARM : PX + ARM) + ((n % 3) - 1) * 22 + (n > 2 ? 11 : 0)
    const y = PAN + 3 - (n > 2 ? 9 : 0)
    stack[side].append(s('g', { transform: `translate(${f1(x)} ${f1(y)})` }, s('g', { class: 't32s-weight' }, stoneArt(18, 11, 3240 + n * 7 + (side === 'local' ? 0 : 50)))))
    trayEl[cur].hidden = true
    tilt()
    say.say(h('strong', null, `${K.right} `), w.why)
    const rest = left()
    if (rest.length) {
      select(rest[0])
      trayEl[rest[0]].focus({ preventScroll: true })
      return
    }
    label()
    sides.forEach((b) => (b.disabled = true))
    ctx.insight(K.insight as Fact, K.detail as Fact)
  }
  label()
  ctx.prompt(K.prompt)
}
