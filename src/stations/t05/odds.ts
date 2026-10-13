import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { C, blob, journey, question, rake, state, stroke, type Isle } from './shared'

const T = C.scenes.odds
const pct = (p: number) => (p < 0.01 ? '<1%' : `${Math.round(p * 100)}%`)
const vi = (n: number) => n.toFixed(1).replace('.', ',')
const f1 = (n: number) => n.toFixed(1)

/** A top-down garden stone drawn at radius 50 round (0, 0): wash shadow, body, lit crown, dry-brush rim. */
function stoneTop(seed: number) {
  const base = blob(0, 0, 50, 45, seed, 0.12, 18)
  return [
    s('path', { class: 't5-o-shadow', d: blob(7, 9, 50, 44, seed + 5, 0.12), filter: 'url(#ink-wash)' }),
    s('path', { class: 't5-o-base', d: base }),
    s('path', { class: 't5-o-hi', d: blob(-12, -13, 27, 19, seed + 2, 0.16, 14) }),
    s('path', { class: 't5-o-low', d: stroke([[-42, 14], [-16, 36], [18, 38], [44, 12]], 9, { head: 0.2, tail: 0.6, min: 0.2 }) }),
    s('path', { class: 't5-o-rim', d: base, 'vector-effect': 'non-scaling-stroke', filter: 'url(#ink-dry)' }),
  ]
}

/** Scene 4: the reply waits for its next word. Each candidate is a stone in its own raked circle; the stone's size is its
 *  chance. "Độ sáng tạo" (temperature) reshapes the stones — low: the safe word swells, high: odd words grow —
 *  and a vermilion drop hops across them and lands on the drawn word. */
export function mountOdds(ctx: SceneCtx) {
  const q = question()
  const cands = q.next.cands
  const longest = Math.max(...cands.map((c) => c.w.length))
  const fillW = h('span', { class: 't5-fillw' })
  const blank = h('span', { class: 't5-blank', style: `width:${f1(longest * 0.55 + 0.8)}em` }, fillW)
  const chat = h('div', { class: 't5-chat' },
    h('p', { class: 't5-ask' }, h('span', { class: 't5-who' }, T.you), q.text),
    h('p', { class: 't5-reply' }, h('span', { class: 't5-who is-ai' }, T.ai), `${q.next.lead.join('')} `, blank))

  // the garden: raked sand, six stones, a drop, a ripple
  const svg = s('svg', { class: 't5-o-svg', 'aria-hidden': 'true' })
  const sand = s('g', { class: 't5-o-sand' })
  const ripple = s('ellipse', { class: 't5-o-ripple', rx: 10, ry: 10, opacity: 0 })
  const drop = s('g', { class: 't5-o-drop', opacity: 0 }, s('ellipse', { class: 't5-o-dropshadow', cx: 0, cy: 0, rx: 5, ry: 2.4 }), s('circle', { class: 't5-o-dropbody', cx: 0, cy: -10, r: 5.5 }))
  const stones = cands.map((_, i) => s('g', { class: 't5-o-stone' }, ...stoneTop(i * 11 + 4)))
  svg.append(sand, ...stones, ripple, drop)
  const items = cands.map((c) => {
    const p = h('span', { class: 't5-pct' })
    const el = h('div', { class: 't5-cand', role: 'listitem' }, h('span', { class: 't5-cw' }, c.w), p)
    return { el, p }
  })
  const list = h('div', { class: 't5-cands', role: 'list', 'aria-label': T.candsLabel }, ...items.map((i) => i.el))
  const garden = h('div', { class: 't5-garden' }, svg, list, h('div', { class: 't5-odds-tag' }, ctx.tag('illustration')))

  const range = h('input', { class: 'range t5-range', type: 'range', min: '0.2', max: '2', step: '0.05', value: '1', id: `t5-temp-${Date.now()}`, 'aria-label': T.tempAria })
  const val = h('span', { class: 't5-tval' })
  const draw = h('button', { class: 'btn ghost t5-draw', type: 'button' }, h('span', { class: 't5-draw-dot', 'aria-hidden': 'true' }), T.draw)
  const ctrl = h('div', { class: 't5-ctrl' },
    h('div', { class: 't5-temp' },
      h('label', { class: 't5-tlabel', for: range.id }, T.temp, val),
      range,
      h('span', { class: 't5-tends', 'aria-hidden': 'true' }, h('span', null, T.low), h('span', null, T.high))),
    draw)
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const root = h('div', { class: 't5-scene t5-odds' }, journey(3), chat, h('div', { class: 't5-odds-stage' }, garden, ctrl), live)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  let temp = 1
  let probs: number[] = []
  let samples = 0
  let moved = false
  let done = false
  let busy = false
  let picked = -1
  // stone i sits at centres[i]; Rm = the radius of a certain word (≈ 90%)
  let centres: [number, number][] = []
  let Rm = 30
  const size = cands.map(() => ({ v: 0 }))
  const setStone = (i: number) => {
    const [x, y] = centres[i] ?? [0, 0]
    stones[i].setAttribute('transform', `translate(${f1(x)} ${f1(y)}) scale(${(size[i].v * Rm / 50).toFixed(4)})`)
  }

  const compute = () => {
    const raw = cands.map((c) => Math.pow(c.p, 1 / temp))
    const sum = raw.reduce((a, b) => a + b, 0)
    probs = raw.map((r) => r / sum)
  }
  /** stone area follows the chance: radius ∝ √p (a 90% word fills its circle) */
  const target = (p: number) => Math.min(1, Math.max(0.09, Math.sqrt(p / 0.9)))
  const paint = (animate: boolean) => {
    compute()
    const max = Math.max(...probs)
    items.forEach((it, i) => {
      it.p.textContent = pct(probs[i])
      it.el.setAttribute('aria-label', `${cands[i].w} ${pct(probs[i])}`)
      it.el.classList.toggle('is-top', probs[i] === max)
      const v = target(probs[i])
      if (animate) ctx.anim(() => gsap.to(size[i], { v, duration: 0.9, ease: 'power3.out', overwrite: 'auto', onUpdate: () => setStone(i) }))
      else {
        size[i].v = v
        setStone(i)
      }
    })
    const mood = temp < 0.65 ? T.low : temp > 1.35 ? T.high : T.mid
    val.textContent = vi(temp)
    range.setAttribute('aria-valuetext', fill(T.tempValue, { t: vi(temp), mood }))
    range.style.setProperty('--fill', `${((temp - 0.2) / 1.8) * 100}%`)
  }

  /** lay the garden out: six circles in a row when wide, two rows of three when narrow */
  function layout() {
    const W = garden.clientWidth, H = garden.clientHeight
    if (W < 20 || H < 20) return
    const cols = W / 6 >= 92 || W / Math.max(1, H) > 2.6 ? 6 : 3
    const rows = 6 / cols
    const cw = W / cols, ch = H / rows
    const lab = 38
    Rm = Math.max(12, Math.min(cw * (cols === 3 ? 0.32 : 0.36), (ch - lab) * 0.42, 92))
    centres = cands.map((_, i) => {
      const c = i % cols, r = Math.floor(i / cols)
      // a little irregularity, as stones are placed by hand
      const jx = Math.sin(i * 2.7) * cw * 0.04, jy = Math.cos(i * 1.9) * Math.min(8, ch * 0.04)
      return [cw * (c + 0.5) + jx, ch * r + (ch - lab) / 2 + jy + 4]
    })
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const isles: Isle[] = centres.map(([x, y]) => ({ x0: x, x1: x, y, ry: Rm + 3 }))
    // each stone's raked rings stay inside its own cell, so neighbouring circles never cross
    const step = Rm > 40 ? 9 : 7
    const room = cw * 0.46 - Rm - 4
    const rings = Math.max(1, Math.min(3, Math.floor(room / step - 0.55) + 1))
    sand.replaceChildren(...rake(W, H, isles, { step, rings, seed: 4 }))
    items.forEach((it, i) => {
      it.el.style.left = `${f1(centres[i][0])}px`
      it.el.style.top = `${f1(ch * Math.floor(i / cols) + (ch - lab) / 2 + 4 + Rm + Math.min(20, Rm * 0.4 + 6))}px`
    })
    cands.forEach((_, i) => setStone(i))
    if (picked >= 0) placeRipple(picked, 1)
  }

  function placeRipple(i: number, k: number) {
    const [x, y] = centres[i]
    ripple.setAttribute('cx', f1(x))
    ripple.setAttribute('cy', f1(y))
    ripple.setAttribute('rx', f1(Rm * (0.9 + k * 0.35)))
    ripple.setAttribute('ry', f1(Rm * (0.9 + k * 0.35)))
  }

  range.addEventListener('input', () => {
    temp = Number(range.value)
    if (!moved) {
      moved = true
      ctx.complete()
    }
    paint(!ctx.reduced)
    maybeInsight()
  })

  const maybeInsight = () => {
    if (done || !((samples >= 1 && moved) || samples >= 3)) return
    done = true
    ctx.insight(T.insight, T.detail as Fact)
  }

  /** the top of stone i, where the drop touches down */
  const crown = (i: number): [number, number] => [centres[i][0], centres[i][1] - size[i].v * Rm * 0.2]

  const sample = () => {
    if (busy) return
    const r = Math.random()
    let acc = 0
    let pick = probs.length - 1
    for (let i = 0; i < probs.length; i++) {
      acc += probs[i]
      if (r <= acc) {
        pick = i
        break
      }
    }
    samples++
    picked = -1
    stones.forEach((st) => st.classList.remove('is-picked'))
    items.forEach((it) => it.el.classList.remove('is-picked'))
    const land = () => {
      picked = pick
      state.picked = pick // scene 5 writes the drawn word
      stones[pick].classList.add('is-picked')
      items[pick].el.classList.add('is-picked')
      fillW.textContent = cands[pick].w
      blank.classList.add('is-filled')
      live.textContent = fill(T.result, { w: cands[pick].w, p: pct(probs[pick]) })
      ctx.chime(probs[pick] < 0.05 ? 'low' : 'soft')
      placeRipple(pick, 1)
      if (!ctx.reduced) {
        ctx.anim(() => {
          gsap.fromTo(fillW, { clipPath: 'inset(-30% 100% -30% 0)', opacity: 0.4 }, { clipPath: 'inset(-30% -4% -30% 0)', opacity: 1, duration: 0.9, ease: 'power2.out' })
          const o = { k: 0 }
          gsap.fromTo(o, { k: 0 }, { k: 1, duration: 1.6, ease: 'power2.out', onUpdate: () => placeRipple(pick, o.k) })
          gsap.fromTo(ripple, { opacity: 0.9 }, { opacity: 0.45, duration: 1.6 })
        })
      } else gsap.set(ripple, { opacity: 0.45 })
      busy = false
      draw.disabled = false
      if (samples === 1 && !moved) ctx.prompt(T.prompt2)
      maybeInsight()
    }
    if (ctx.reduced) return land()
    busy = true
    draw.disabled = true
    gsap.set(ripple, { opacity: 0 })
    // the drop hops from stone to stone, slowing down, and settles on the drawn word
    const hops: number[] = []
    let at = Math.floor(Math.random() * cands.length)
    for (let k = 0; k < 5; k++) {
      let nx = Math.floor(Math.random() * cands.length)
      if (nx === at) nx = (nx + 1) % cands.length
      hops.push((at = nx))
    }
    if (hops[hops.length - 1] === pick) hops.pop()
    hops.push(pick)
    const [sx, sy] = crown(hops[0])
    const body = drop.querySelector('.t5-o-dropbody') as SVGElement
    ctx.anim(() => {
      const tl = gsap.timeline({ onComplete: land })
      tl.set(drop, { x: sx, y: sy, opacity: 1 })
        .fromTo(body, { attr: { cy: -60 }, opacity: 0 }, { attr: { cy: -8 }, opacity: 1, duration: 0.4, ease: 'power2.in' })
      hops.slice(1).forEach((i, k) => {
        const [x, y] = crown(i)
        const d = 0.2 + k * 0.07
        tl.to(drop, { x, y, duration: d, ease: 'none' })
          .to(body, { keyframes: [{ attr: { cy: -26 - k * 3 }, ease: 'power2.out' }, { attr: { cy: -8 }, ease: 'power2.in' }], duration: d }, '<')
      })
      tl.to(body, { attr: { cy: 0, r: 2 }, opacity: 0, duration: 0.35, ease: 'power2.in' }, '+=0.1')
        .set(body, { attr: { r: 5.5 } })
        .set(drop, { opacity: 0 })
    })
  }
  draw.addEventListener('click', sample)

  const ro = new ResizeObserver(layout)
  ro.observe(garden)
  layout()
  paint(false)
  if (!ctx.reduced) {
    ctx.anim(() => {
      // the stones are set down one by one
      size.forEach((o, i) => gsap.fromTo(o, { v: 0 }, { v: target(probs[i]), duration: 1.3, delay: 0.4 + i * 0.1, ease: 'back.out(1.6)', onUpdate: () => setStone(i) }))
      gsap.from(items.map((i) => i.el), { opacity: 0, duration: 1, delay: 0.9, stagger: 0.08 })
      gsap.from(sand, { opacity: 0, duration: 1.4 })
      gsap.from(chat.children, { opacity: 0, y: 10, filter: 'blur(4px)', duration: 1.1, stagger: 0.25, ease: 'power3.out', clearProps: 'filter' })
    })
  }
  return () => ro.disconnect()
}
