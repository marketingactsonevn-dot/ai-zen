import Matter from 'matter-js'
import { fill, h } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { tokenize, type Tok } from './tokenizer'
import { CAT, Pit, afterFonts, clamp, crackIn, footReserve, sentence, type Stone } from './pit'

const { Body, Sleeping } = Matter

export interface ShatterCopy {
  prompt: string
  sample: string
  breakAria: string
  stonesAria: string
  stoneAria: string
  count: string
  sees: string
  demo: string
  live: string
  placeholder: string
  inputAria: string
  drop: string
  insight: string | Fact
  detail: string | Fact
}

/** Scene 1: a written sentence cracks along its token seams and falls as stones onto raked sand. */
export function mountShatter(ctx: SceneCtx, c: ShatterCopy) {
  const pit = new Pit(ctx, 't4-s1')
  const reserve = footReserve(ctx, [c.insight])
  const top = h('div', { class: 't4-top' })
  const num = h('span', { class: 't4-tally-n' })
  const sees = h('span', { class: 't4-tally-ids' })
  const tally = h('div', { class: 't4-tally', 'aria-hidden': 'true' }, h('p', { class: 't4-tally-row' }, num, sees), h('p', { class: 't4-tally-demo' }, ctx.tag('illustration'), ' ', c.demo))
  tally.hidden = true
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const input = h('input', { class: 't4-input', type: 'text', maxlength: '56', placeholder: c.placeholder, 'aria-label': c.inputAria, enterkeyhint: 'go', autocomplete: 'off' })
  const form = h('form', { class: 't4-try' }, input, h('button', { class: 't4-go', type: 'submit' }, c.drop))
  form.hidden = true
  pit.layer.setAttribute('role', 'group')
  pit.layer.setAttribute('aria-label', c.stonesAria)
  pit.root.append(top, tally, form, live)

  type State = 'idle' | 'falling' | 'rest'
  let state: State = 'idle'
  let fallT = 0
  let first = true
  let toks: Tok[] = []
  let order: Stone[] = []
  let cur: HTMLElement | null = null
  let ground: Matter.Body[] = []
  const L = { Gy: 0, Heff: 0, port: false, hw: 300 }

  // ── layout: ground across the art, sentence high above it, numbers in the near sand
  pit.resizeFn = () => {
    const Heff = Math.max(100, pit.H - reserve())
    const port = pit.W / Heff < 0.95
    const sc = clamp(Math.min(pit.W / (port ? 400 : 820), Heff / 380), 0.6, 1.5)
    const Gy = Heff * (port ? 0.62 : 0.66)
    pit.setView({ s: sc, ox: pit.W / 2, oy: Gy })
    const hw = pit.W / 2 / sc - 8
    pit.removeBodies(ground)
    ground = [pit.box(0, 40, hw * 2 + 800, 80), pit.box(-hw - 40, -900, 80, 2400, 0, CAT.wall), pit.box(hw + 40, -900, 80, 2400, 0, CAT.wall)]
    for (const st of pit.stones) {
      const lim = hw - st.w / 2
      if (Math.abs(st.body.position.x) > lim) {
        Body.setPosition(st.body, { x: clamp(st.body.position.x, -lim, lim), y: st.body.position.y - 60 })
        Sleeping.set(st.body, false)
      }
    }
    Object.assign(L, { Gy, Heff, port, hw })
    const fs = clamp(Math.min(pit.W * (port ? 0.078 : 0.052), Heff * 0.105), 24, 62)
    top.style.setProperty('--fs', `${fs}px`)
    top.style.top = `${Heff * (port ? 0.1 : 0.11)}px`
    form.style.top = `${Heff * (port ? 0.08 : 0.1)}px`
    tally.style.bottom = `${pit.H - Heff + 4}px`
    pit.wake(50)
  }

  pit.paintFn = (g) => {
    const { Gy, Heff } = L
    const { s: sc, ox } = pit.view
    const rings = pit.ringsOn(0).map((r) => ({ x: ox + r.x * sc, y: Gy, rx: r.rx * sc }))
    pit.bed(0, { x0: pit.W * 0.02, x1: pit.W * 0.98, y: Gy, back: Heff * 0.15, front: Math.max(20, Math.min(Heff * (L.port ? 0.12 : 0.22), pit.H - Gy - 4)), rows: ctx.quality === 'low' ? 9 : 15, seed: 4 }, rings)
    pit.worldTx(g)
    pit.shadows(g)
  }

  pit.frameFn = () => {
    if (state !== 'falling') return false
    const t = performance.now() - fallT
    const still = pit.stones.length >= toks.length && pit.calm()
    if ((still && t > 1800) || t > 4800) rest()
    return true
  }

  // ── stones: one tab stop, arrows walk, Enter/Space (or a tap) tosses the stone back up
  let focusI = 0
  const label = (st: Stone) => fill(c.stoneAria, { t: st.tok?.t ?? '', id: st.tok?.id ?? '' })
  const setFocus = (i: number, move: boolean) => {
    focusI = clamp(i, 0, order.length - 1)
    order.forEach((st, j) => st.inner.setAttribute('tabindex', j === focusI ? '0' : '-1'))
    if (move) order[focusI]?.inner.focus({ preventScroll: true })
  }
  pit.layer.addEventListener('keydown', (e) => {
    const i = order.findIndex((st) => st.inner === document.activeElement)
    if (i < 0) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') (e.preventDefault(), setFocus(i + 1, true))
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') (e.preventDefault(), setFocus(i - 1, true))
    else if (e.key === 'Home') (e.preventDefault(), setFocus(0, true))
    else if (e.key === 'End') (e.preventDefault(), setFocus(order.length - 1, true))
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pit.toss(order[i], 0)
      ctx.chime('tap')
    }
  })

  // ── the sentence
  function show(text: string, auto: boolean) {
    toks = tokenize(text).slice(0, 30)
    if (!toks.length) return
    const sen = sentence(toks, 't4-sent--big')
    cur?.remove()
    cur = sen.el
    top.replaceChildren(sen.el)
    sen.el.setAttribute('role', 'button')
    sen.el.setAttribute('tabindex', '0')
    sen.el.setAttribute('aria-label', fill(c.breakAria, { s: text }))
    const go = () => {
      if (state !== 'idle' || cur !== sen.el) return
      state = 'falling'
      fallT = performance.now() + 9e9
      sen.el.removeAttribute('tabindex')
      sen.el.removeAttribute('role')
      sen.el.classList.add('is-breaking')
      ctx.chime('tap')
      crackIn(ctx, sen.cracks, () => drop(sen.spans, sen.el))
    }
    sen.el.addEventListener('click', go)
    sen.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), go())
    })
    state = 'idle'
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(sen.el, { opacity: 0, filter: 'blur(8px)', y: 8 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1.3, ease: 'power3.out' }))
    if (auto) {
      if (ctx.reduced) go()
      else ctx.anim(() => gsap.delayedCall(1.1, go))
    }
  }

  function drop(spans: HTMLElement[], el: HTMLElement) {
    fallT = performance.now()
    order = pit.shatter(spans, toks, 'stone', {
      font: 24,
      ground: 0,
      stagger: 0.05,
      maxW: L.hw * 2 - 24,
      onStone: (st, i) => {
        st.inner.setAttribute('role', 'button')
        st.inner.setAttribute('tabindex', i === 0 ? '0' : '-1')
        st.inner.setAttribute('aria-label', label(st))
        pit.draggable(st, () => (pit.toss(st, 0), ctx.chime('tap')))
      },
    })
    focusI = 0
    if (!ctx.reduced) ctx.anim(() => gsap.delayedCall(toks.length * 0.05 + 1.2, () => el === cur && (el.remove(), (cur = null))))
    else (el.remove(), (cur = null))
    pit.wake(1200)
    if (ctx.reduced) rest()
  }

  function rest() {
    if (state === 'rest') return
    state = 'rest'
    const ids = toks.map((t) => t.id)
    num.textContent = fill(c.count, { n: toks.length })
    sees.textContent = fill(c.sees, { ids: ids.slice(0, L.port ? 4 : 7).join(' · ') + (ids.length > (L.port ? 4 : 7) ? ' …' : '') })
    tally.hidden = false
    form.hidden = false
    live.textContent = fill(c.live, { n: toks.length, list: toks.map((t) => `“${t.t}”`).join(', ') })
    if (first) {
      first = false
      ctx.insight(c.insight, c.detail)
      ctx.chime('ok')
    }
    if (!ctx.reduced) {
      ctx.anim(() => {
        gsap.fromTo(tally.children, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 1, stagger: 0.18, ease: 'power3.out' })
        gsap.fromTo(form, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 1, delay: 0.4, ease: 'power3.out' })
      })
    }
    pit.wake(1600)
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const text = input.value.trim()
    if (!text || state !== 'rest') return
    input.value = ''
    input.blur()
    form.hidden = true
    tally.hidden = true
    const old = pit.stones.slice()
    order = []
    pit.sink(old, () => show(text, true))
  })

  afterFonts(ctx, () => pit.resizeFn())
  show(c.sample, false)
  ctx.prompt(c.prompt)
}
