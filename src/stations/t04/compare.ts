import Matter from 'matter-js'
import { fill, h } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { tokenize, type Tok } from './tokenizer'
import { CAT, Pit, afterFonts, clamp, crackIn, footReserve, sentence, type Stone } from './pit'

const { Body, Sleeping } = Matter

export interface CompareCopy {
  prompt: string
  breakAria: string
  vi: string
  en: string
  token: string
  next: string
  nextAria: string
  demo: string
  live: string
  pairs: [string, string][]
  insight: string | Fact
  detail: string | Fact
}

interface Lane {
  lang: 'vi' | 'en'
  head: HTMLElement
  count: HTMLElement
  host: HTMLElement
  toks: Tok[]
  stones: Stone[]
  spans: HTMLElement[]
  cracks: HTMLElement[]
  sent: HTMLElement | null
  /** screen rect */
  x: number
  y: number
  w: number
  h: number
  /** ground, world y */
  gy: number
}

/** Scene 2: the same meaning in Vietnamese and English breaks at once — count the stones. */
export function mountCompare(ctx: SceneCtx, c: CompareCopy) {
  const pit = new Pit(ctx, 't4-s2')
  const reserve = footReserve(ctx, [c.insight])
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const nextBtn = h('button', { class: 't4-chip t4-next', type: 'button', 'aria-label': c.nextAria }, h('span', null, c.next), h('span', { class: 't4-chip-n' }))
  nextBtn.hidden = true
  const demo = h('p', { class: 't4-demo' }, ctx.tag('illustration'), ' ', c.demo)
  demo.hidden = true
  const mk = (lang: 'vi' | 'en'): Lane => {
    const count = h('span', { class: 't4-lane-n' })
    const head = h('p', { class: `t4-lane-head t4-lane-head--${lang}` }, h('span', { class: 't4-lane-lang' }, lang === 'vi' ? c.vi : c.en))
    const host = h('div', { class: 't4-lane-sent', lang: lang === 'vi' ? 'vi' : 'en' })
    pit.root.append(head, host)
    return { lang, head, count, host, toks: [], stones: [], spans: [], cracks: [], sent: null, x: 0, y: 0, w: 1, h: 1, gy: 0 }
  }
  const lanes = [mk('vi'), mk('en')]
  pit.root.append(nextBtn, demo, live)
  pit.layer.setAttribute('aria-hidden', 'true')

  let pair = 0
  let state: 'idle' | 'falling' | 'rest' = 'idle'
  let fallT = 0
  let first = true
  let statics: Matter.Body[] = []
  let Heff = 300

  pit.resizeFn = () => {
    Heff = Math.max(100, pit.H - reserve())
    const side = pit.W / Heff > 2.3
    const port = pit.W / Heff < 0.95
    const rects = side
      ? [[0, 0, pit.W / 2, Heff], [pit.W / 2, 0, pit.W / 2, Heff]]
      : [[0, 0, pit.W, Heff / 2], [0, Heff / 2, pit.W, Heff / 2]]
    const lw = rects[0][2], lh = rects[0][3]
    const sc = clamp(Math.min(lw / (port ? 360 : 600), lh / 170), 0.5, 1.4)
    pit.setView({ s: sc, ox: 0, oy: 0 })
    pit.removeBodies(statics)
    statics = []
    lanes.forEach((ln, i) => {
      const [x, y, w, hh] = rects[i]
      const gyScreen = y + hh * (side ? 0.8 : 0.86)
      const gy = gyScreen / sc
      const dy = ln.gy ? gy - ln.gy : 0
      const cxOld = (ln.x + ln.w / 2) / sc, cxNew = (x + w / 2) / sc, kx = ln.w > 1 ? w / ln.w : 1
      Object.assign(ln, { x, y, w, h: hh, gy })
      // the near lane gets a full-width floor; the far lane's floor is only as wide as its lane
      statics.push(pit.box((x + w / 2) / sc, gy + 40, w / sc + (side ? 0 : 400), 80))
      for (const st of ln.stones) {
        st.ground = gy
        Body.setPosition(st.body, { x: cxNew + (st.body.position.x - cxOld) * kx, y: st.body.position.y + dy - 4 })
        Sleeping.set(st.body, false)
      }
      const fs = clamp(Math.min(w * (port ? 0.07 : 0.045), hh * 0.2), 18, 44)
      ln.host.style.cssText = `left:${x}px;top:${y + hh * (side ? 0.2 : 0.22)}px;width:${w}px;--fs:${fs}px`
      ln.head.style.cssText = `left:${x + w * 0.04}px;top:${y + 2}px`
    })
    statics.push(pit.box(-32, Heff / sc / 2, 80, Heff / sc * 3, 0, CAT.wall), pit.box(pit.W / sc + 32, Heff / sc / 2, 80, Heff / sc * 3, 0, CAT.wall))
    if (side) statics.push(pit.box(pit.W / 2 / sc, Heff / sc / 2, 30, Heff / sc * 3, 0, CAT.wall))
    demo.style.top = `${Heff - 24}px`
    pit.wake(60)
  }

  pit.paintFn = (g) => {
    const sc = pit.view.s
    for (let i = 0; i < lanes.length; i++) {
      const ln = lanes[i]
      const y = ln.gy * sc
      // TODO(perf): ringsOn + this map allocate a few small arrays per frame (only while the pit loop runs)
      const rings = pit.ringsOn(ln.gy, ln.stones, 16).map((r) => ({ x: r.x * sc, y, rx: r.rx * sc }))
      pit.bed(i, { x0: ln.x + ln.w * 0.03, x1: ln.x + ln.w * 0.97, y, back: ln.h * 0.2, front: Math.max(12, Math.min(ln.h * 0.12, Heff - y - 28 + (i ? 0 : ln.h * 0.05))), rows: ctx.quality === 'low' ? 7 : 10, seed: 5 + i * 4 }, rings)
    }
    pit.worldTx(g)
    pit.shadows(g)
  }

  pit.frameFn = () => {
    if (state !== 'falling') return false
    const t = performance.now() - fallT
    let n = 0
    for (const ln of lanes) n += ln.toks.length
    if ((pit.stones.length >= n && pit.calm() && t > 1800) || t > 5000) rest()
    return true
  }

  function setPair(i: number, auto: boolean) {
    pair = i
    state = 'idle'
    const texts = c.pairs[i]
    lanes.forEach((ln, k) => {
      ln.toks = tokenize(texts[k])
      const sen = sentence(ln.toks, 't4-sent--lane')
      Object.assign(ln, { spans: sen.spans, cracks: sen.cracks, sent: sen.el, stones: [] })
      ln.host.replaceChildren(sen.el)
      ln.count.textContent = ''
      sen.el.addEventListener('click', go)
      if (k === 0) {
        sen.el.setAttribute('role', 'button')
        sen.el.setAttribute('tabindex', '0')
        sen.el.setAttribute('aria-label', `${c.breakAria}: “${texts[0]}” / “${texts[1]}”`)
        sen.el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), go())
        })
      } else sen.el.classList.add('is-tap')
    })
    ;(nextBtn.lastChild as HTMLElement).textContent = `${i + 1}/${c.pairs.length}`
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(lanes.map((ln) => ln.sent), { opacity: 0, filter: 'blur(8px)', y: 6 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1.2, stagger: 0.15, ease: 'power3.out' }))
    if (auto) {
      if (ctx.reduced) go()
      else ctx.anim(() => gsap.delayedCall(1.2, go))
    }
  }

  function go() {
    if (state !== 'idle') return
    state = 'falling'
    fallT = performance.now() + 9e9
    ctx.chime('tap')
    let ready = 0
    lanes.forEach((ln) => {
      ln.sent?.removeAttribute('role')
      ln.sent?.removeAttribute('tabindex')
      crackIn(ctx, ln.cracks, () => {
        if (++ready < 2) return
        fallT = performance.now()
        lanes.forEach((l2) => {
          const sc = pit.view.s
          l2.stones = pit.shatter(l2.spans, l2.toks, 'stone', { font: 22, id: false, ground: l2.gy, stagger: 0.06, maxW: l2.w / sc * 0.92, cx: (l2.x + l2.w / 2) / sc })
          const el = l2.sent
          if (ctx.reduced) el?.remove()
          else ctx.anim(() => gsap.delayedCall(l2.toks.length * 0.06 + 1.2, () => el?.remove()))
        })
        if (ctx.reduced) rest()
      })
    })
  }

  function rest() {
    if (state === 'rest') return
    state = 'rest'
    const [vi, en] = lanes.map((ln) => ln.toks.length)
    lanes.forEach((ln) => {
      ln.count.textContent = String(ln.toks.length)
      const big = h('p', { class: `t4-lane-count${ln.toks.length > Math.min(vi, en) ? ' is-more' : ''}`, 'aria-hidden': 'true' }, ln.count, h('span', { class: 't4-lane-unit' }, c.token))
      ln.host.replaceChildren(big)
    })
    live.textContent = fill(c.live, { vi, en })
    nextBtn.hidden = false
    demo.hidden = false
    ctx.chime('ok')
    if (first) {
      first = false
      ctx.insight(c.insight, c.detail)
    }
    if (!ctx.reduced) {
      ctx.anim(() => {
        lanes.forEach((ln, i) => {
          const o = { n: 0 }
          gsap.to(o, { n: ln.toks.length, duration: 1.2, delay: i * 0.25, ease: 'power2.out', onUpdate: () => void (ln.count.textContent = String(Math.round(o.n))) })
          gsap.fromTo(ln.host.firstChild, { opacity: 0, filter: 'blur(6px)', y: 6 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1, delay: i * 0.25, ease: 'power3.out' })
        })
        gsap.fromTo([nextBtn, demo], { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.8 })
      })
    }
    pit.wake(1600)
  }

  nextBtn.addEventListener('click', () => {
    if (state !== 'rest') return
    state = 'idle'
    nextBtn.hidden = true
    pit.sink(pit.stones.slice(), () => setPair((pair + 1) % c.pairs.length, true))
  })

  afterFonts(ctx, () => pit.resizeFn())
  setPair(0, false)
  ctx.prompt(c.prompt)
}
