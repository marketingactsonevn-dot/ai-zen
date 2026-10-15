import { fill, h, s } from '../../core/dom'
import { onDigit } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import C from '../../content/tram-26.json'
import { F, f1, moon, place, rake, stage, toro } from '../t25/kit'

/** how human the statue's shadow looks under each lamp (gwt, hot, iit, bio): an illustration of each theory's verdict */
const PERSON = [1, 0.6, 0, 0]

/** Scene 1 — a faceless statue on raked sand, four stone lanterns around it: each light casts a different shadow. */
export function lampsScene(ctx: SceneCtx) {
  const K = C.scenes.lamps
  const n = K.lamps.length
  const lit = new Set<number>()
  let active = -1
  let done = false
  const lampG = K.lamps.map(() => s('g'))
  const nums = K.lamps.map((_, i) => h('span', { class: 'zk-lab t26l-num', 'aria-hidden': 'true' }, String(i + 1)))
  const btns = K.lamps.map((l, i) => h('button', { class: 'zk-hit t26l-lamp', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.lampAria, { name: l.name }), onClick: () => light(i) }))
  const statue = h('p', { class: 'zk-lab t26l-statue' }, K.statue)
  const card = h('div', { class: 'zk-note t26l-card', hidden: true })
  const rot = s('g', { class: 't26l-rot' })
  const person = s('path', { class: 't26l-sh' })
  const rock = s('path', { class: 't26l-sh' })
  rot.append(person, rock)
  const shadow = s('g', null, rot)
  let lampXY: [number, number][] = []
  let foot: [number, number] = [0, 0]

  const { root, svg } = stage(ctx, 't26l', K.art, [K.insight], (W, H) => {
    const land = W / H > 1.05
    const gw = land ? W * 0.6 : W, gh = land ? H : H * 0.6
    const gx = gw * 0.5, gy = gh * (land ? 0.52 : 0.6)
    const t = Math.min(gw * (land ? 0.15 : 0.2), gh * 0.3, 160)
    const st = t * 0.95
    const Rx = Math.min(gw * 0.36, t * 3.4), Ry = gh * 0.3
    const ang = [-168, -122, -58, -12].map((d) => (d * Math.PI) / 180)
    lampXY = ang.map((a) => [gx + Math.cos(a) * Rx, gy + Math.sin(a) * Ry * (land ? 0.9 : 1) + t * 0.2])
    foot = [gx, gy]
    // shadow shapes along local +y: a lying figure, or just a stone's shadow
    const L = st * 2.6
    person.setAttribute('d', `M${f1(-st * 0.2)} 0Q${f1(-st * 0.3)} ${f1(L * 0.45)} ${f1(-st * 0.16)} ${f1(L * 0.72)}L${f1(st * 0.16)} ${f1(L * 0.72)}Q${f1(st * 0.3)} ${f1(L * 0.45)} ${f1(st * 0.2)} 0Z` +
      `M0 ${f1(L * 0.74)}m${f1(-st * 0.13)} 0a${f1(st * 0.13)} ${f1(st * 0.15)} 0 1 0 ${f1(st * 0.26)} 0a${f1(st * 0.13)} ${f1(st * 0.15)} 0 1 0 ${f1(-st * 0.26)} 0` +
      `M${f1(-st * 0.2)} ${f1(L * 0.18)}L${f1(-st * 0.42)} ${f1(L * 0.5)}L${f1(-st * 0.32)} ${f1(L * 0.52)}L${f1(-st * 0.16)} ${f1(L * 0.28)}Z` +
      `M${f1(st * 0.2)} ${f1(L * 0.18)}L${f1(st * 0.42)} ${f1(L * 0.5)}L${f1(st * 0.32)} ${f1(L * 0.52)}L${f1(st * 0.16)} ${f1(L * 0.28)}Z`)
    rock.setAttribute('d', `M${f1(-st * 0.24)} 0Q${f1(-st * 0.34)} ${f1(L * 0.3)} 0 ${f1(L * 0.42)}Q${f1(st * 0.34)} ${f1(L * 0.3)} ${f1(st * 0.24)} 0Z`)
    shadow.setAttribute('transform', `translate(${f1(gx)} ${f1(gy)})`)
    const bodyD = `M${f1(gx - st * 0.24)} ${f1(gy)}C${f1(gx - st * 0.3)} ${f1(gy - st * 0.5)} ${f1(gx - st * 0.2)} ${f1(gy - st * 0.72)} ${f1(gx)} ${f1(gy - st * 0.74)}C${f1(gx + st * 0.2)} ${f1(gy - st * 0.72)} ${f1(gx + st * 0.3)} ${f1(gy - st * 0.5)} ${f1(gx + st * 0.24)} ${f1(gy)}Z`
    svg.replaceChildren(
      rake(W, gy - Ry * 1.3, Math.min(gh, gy + Ry * 1.25), 16, 26),
      s('ellipse', { class: 't26l-ring', cx: gx, cy: gy + 2, rx: st * 0.9, ry: st * 0.22 }),
      s('ellipse', { class: 't26l-ring', cx: gx, cy: gy + 2, rx: st * 1.35, ry: st * 0.34 }),
      moon(land ? W * 0.08 : W * 0.86, land ? H * 0.12 : gh * 0.08, Math.min(W, H) * 0.026),
      shadow,
      // the lamps behind the statue first, so the statue stands in front
      ...lampXY.map(([x, y], i) => (lampG[i].replaceChildren(toro(x, y, t)), lampG[i])),
      s('ellipse', { class: 'zk-sh', cx: gx + st * 0.05, cy: gy, rx: st * 0.3, ry: st * 0.06 }),
      s('path', { class: 'zk-stone', d: bodyD, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
      s('path', { class: 'p2-stone-flank', d: bodyD, fill: 'url(#p2-shade)' }),
      s('ellipse', { class: 'zk-stone', cx: gx, cy: gy - st * 0.88, rx: st * 0.15, ry: st * 0.17, fill: 'url(#p2-rock)' }))
    lampXY.forEach(([x, y], i) => {
      place(btns[i], x - t * 0.4, y - t * 0.92, t * 0.8)
      btns[i].style.height = `${f1(t)}px`
      place(nums[i], x - 10, y + 4, 20)
    })
    place(statue, gx - 60, gy - st - 30, 120)
    if (land) place(card, gw + 8, H * 0.18, Math.min(W - gw - 24, 400))
    else place(card, 12, gh + 4, W - 24)
    aim()
  })
  root.append(statue, ...btns, ...nums, card)
  ctx.prompt(K.prompt)
  ctx.onCleanup(onDigit((d) => d <= n && light(d - 1)))

  function aim() {
    if (active < 0) {
      rot.style.opacity = '0'
      return
    }
    const [lx, ly] = lampXY[active]
    const deg = (Math.atan2(foot[1] - ly + 40, foot[0] - lx) * 180) / Math.PI - 90
    rot.style.opacity = '1'
    rot.style.transform = `rotate(${deg.toFixed(1)}deg)`
    person.style.opacity = String(PERSON[active] * 0.5)
    rock.style.opacity = String((1 - PERSON[active]) * 0.5)
  }
  function light(i: number) {
    const l = K.lamps[i]
    active = i
    lit.add(i)
    lampG.forEach((g, k) => g.classList.toggle('lit', lit.has(k)))
    lampG.forEach((g, k) => g.classList.toggle('on', k === i))
    btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    aim()
    card.replaceChildren(
      h('p', { class: 'p2-eyebrow' }, `${i + 1} · ${l.en}`),
      h('p', { class: 't26l-name' }, l.name),
      h('p', { class: 'p2-question t26l-asks' }, l.asks),
      ctx.fact(F(l.view)))
    card.hidden = false
    if (!card.hasAttribute('aria-live')) card.setAttribute('aria-live', 'polite')
    ctx.chime('soft')
    if (lit.size === n && !done) {
      done = true
      ctx.insight(F(K.insight), F(K.detail))
    }
  }
}
