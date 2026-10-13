import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { blob, rng, stroke } from './ink'
import { C, type FormulaCopy } from './data'

const U = C.ui

/** What a scene's picture must do: redraw itself for the stones that are down. */
export interface ArtApi {
  /** on[i] = stone i is down; vague = the compare toggle shows the vague prompt; instant = no motion */
  update(on: boolean[], vague: boolean, instant: boolean, changed: number): void
  /** first time every stone is down */
  done?(): void
  dispose?(): void
}

export interface Kit {
  ctx: SceneCtx
  root: HTMLElement
  /** the picture box */
  stage: HTMLElement
  /** under the prompt slip: scene-specific controls */
  extra: HTMLElement
  /** inside the slip, under the prompt text */
  slipFoot: HTMLElement
  /** change a stone's fragment (choosers) */
  setFrag(i: number, text: string): void
  /** show this text in the slip instead of the joined fragments (null = back to fragments) */
  override(text: string | null): void
  /** re-fit the slip after the extra controls changed size */
  refit(): void
  readonly on: boolean[]
}

/**
 * A river stone in ink, stretched behind a label, sitting in a raked hollow of sand. Before it is set down only the
 * hollow shows (a shallow dent with a groove ring around it); set down, the stone fills it: wash shadow, body, lit top,
 * dark belly, dry rim.
 */
function stoneArt(seed: number) {
  const base = blob(60, 30, 56, 25, seed, 0.1, 18)
  const ring = blob(60, 31, 61, 29, seed + 5, 0.05, 20)
  return s('svg', { class: 't13-stone-art', viewBox: '0 0 120 60', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { class: 'sa-ring', d: ring, 'vector-effect': 'non-scaling-stroke' }),
    s('path', { class: 'sa-ring is-hi', d: ring, transform: 'translate(0 1.6)', 'vector-effect': 'non-scaling-stroke' }),
    s('path', { class: 'sa-dent', d: blob(60, 31, 54, 24, seed + 1, 0.08, 18) }),
    s('path', { class: 'sa-dent-top', d: stroke([[10, 30], [30, 12], [60, 8], [92, 12], [110, 28]], 6, { head: 0.3, tail: 0.6, min: 0.15 }) }),
    s('path', { class: 'sa-dent-lip', d: stroke([[14, 38], [36, 52], [70, 55], [104, 40]], 4, { head: 0.3, tail: 0.6, min: 0.15 }) }),
    s('path', { class: 'sa-shadow', d: blob(64, 40, 56, 20, seed + 7, 0.1) }),
    s('path', { class: 'sa-base', d: base }),
    s('path', { class: 'sa-hi', d: blob(48, 21, 36, 11, seed + 3, 0.16, 14) }),
    s('path', { class: 'sa-low', d: stroke([[12, 36], [40, 51], [82, 52], [109, 34]], 5, { head: 0.2, tail: 0.6, min: 0.2 }) }),
    s('path', { class: 'sa-rim', d: base, 'vector-effect': 'non-scaling-stroke' }))
}

/**
 * The frame every scene of this station shares: a picture (what the AI returns), a paper slip (the prompt),
 * and a path of formula stones on raked sand. Each stone set down adds its words to the slip and changes
 * the picture; when all are down, a toggle compares the vague prompt with the clear one.
 */
export function formula(ctx: SceneCtx, copy: FormulaCopy, make: (k: Kit) => ArtApi, opts: { deferInsight?: boolean } = {}) {
  const on: boolean[] = copy.slots.map(() => false)
  const frags = copy.slots.map((sl) => sl.frag)
  let vague = false
  let done = false
  let over: string | null = null

  const stage = h('div', { class: 't13-stage' })
  const label = h('p', { class: 't13-slip-label' }, h('span', { class: 't13-seal', 'aria-hidden': 'true' }), U.promptLabel)
  const text = h('p', { class: 't13-slip-text' })
  const mistakes = h('ul', { class: 't13-mistakes', hidden: true, 'aria-label': U.mistakes },
    ...copy.bad.mistakes.map((m, i) => h('li', null,
      s('svg', { class: 't13-x', viewBox: '0 0 20 20', 'aria-hidden': 'true' },
        s('path', { d: stroke([[4, 4 + i], [10, 10], [16, 16 - i]], 3.2, { head: 0.2, tail: 0.5 }) }),
        s('path', { d: stroke([[15, 4], [10, 10.5], [5, 16]], 2.6, { head: 0.25, tail: 0.6 }) })),
      h('span', null, m))))
  const modeBtns = [U.vague, U.clear].map((t, i) =>
    h('button', { class: 't13-mode', type: 'button', 'aria-pressed': String(i === 1), onClick: () => setVague(i === 0) }, t))
  const modes = h('div', { class: 't13-modes is-small', role: 'group', 'aria-label': U.compare, hidden: true }, ...modeBtns)
  const slipFoot = h('div', { class: 't13-slip-foot' })
  // on small screens the finished prompt folds to a few lines so the picture keeps the room
  let open = false
  const more = h('button', { class: 't13-more', type: 'button', hidden: true, 'aria-expanded': 'false', onClick: () => {
    open = !open
    more.setAttribute('aria-expanded', String(open))
    fit()
  } }, U.more)
  const slip = h('div', { class: 't13-slip' }, h('div', { class: 't13-slip-head' }, label, more, modes), text, mistakes, slipFoot)
  const extra = h('div', { class: 't13-ctrl' })
  const side = h('div', { class: 't13-side' }, slip, extra)

  // stepping stones are never in a ruler line: a gentle S along the path, each one tilted and sized a little differently
  const lay = rng(copy.label.length * 7 + copy.slots.length)
  const n = copy.slots.length
  const stones = copy.slots.map((sl, i) => {
    const t = n > 1 ? i / (n - 1) : 0.5
    const dy = Math.sin(t * Math.PI * 2 + 0.4) * 3.2 + (lay() - 0.5) * 2.4
    const rip = h('span', { class: 't13-rip', 'aria-hidden': 'true' })
    const inner = h('span', { class: 't13-stone-in' }, stoneArt(i * 13 + copy.label.length), h('span', { class: 't13-stone-name' }, sl.name))
    return h('button', {
      class: `t13-stone${sl.key ? ' is-key' : ''}${i === 0 ? ' is-first' : ''}`,
      type: 'button',
      title: sl.name,
      style: `--dy:${dy.toFixed(1)};--rot:${((lay() - 0.5) * 8).toFixed(1)}deg;--sc:${(0.92 + lay() * 0.16).toFixed(2)}`,
      'aria-pressed': 'false',
      onClick: () => toggle(i),
    }, rip, inner)
  })
  const path = h('div', { class: 't13-path', role: 'group', 'aria-label': U.stones }, ...stones)
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const root = h('div', { class: `t13${ctx.reduced ? ' is-reduced' : ''}` }, stage, side, path, live)
  ctx.art.append(root)
  ctx.prompt(copy.prompt)

  // ── the slip: the vague prompt at first, then the clear one growing fragment by fragment
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
  function renderSlip(fresh = -1) {
    const any = on.some(Boolean)
    slip.classList.toggle('is-vague', vague || !any)
    mistakes.hidden = !vague
    label.lastChild!.textContent = vague || !any ? U.vagueLabel : done && on.every(Boolean) ? U.clearLabel : U.promptLabel
    text.replaceChildren()
    if (vague || !any) {
      text.append(h('span', { class: 't13-frag is-bad' }, `“${copy.bad.text}”`))
    } else if (over && on.every(Boolean)) {
      // tool parameters ("--ar 4:5") keep their two hyphens apart
      text.append(h('span', { class: 't13-frag is-over' },
        ...over.split(/(--[a-z]+ [\d:]+)/).map((p, j) => (j % 2 ? h('span', { class: 't13-tok' }, p) : p))))
    } else {
      const idx = on.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)
      idx.forEach((i, k) => {
        let t = frags[i]
        if (copy.phrases) t = (k === 0 ? cap(t) : t) + (k === idx.length - 1 ? '.' : ',')
        if (k) text.append(' ')
        text.append(h('span', { class: `t13-frag${i === fresh ? ' is-new' : ''}${copy.slots[i].key ? ' is-key' : ''}` }, t))
      })
    }
    fit()
  }

  // shrink the slip's type until it fits (landscape: its column; portrait: leave the picture at least ~38%)
  function fit() {
    let k = 1
    side.style.setProperty('--k', '1')
    const port = root.classList.contains('is-port')
    const small = port || root.classList.contains('is-short')
    // fold the finished prompt to four lines on small screens (a toggle opens it)
    const fold = small && done && !vague
    text.classList.toggle('is-folded', fold && !open)
    more.hidden = true
    if (fold) {
      text.classList.add('is-folded')
      const long = text.scrollHeight > text.clientHeight + 2
      text.classList.toggle('is-folded', !open)
      more.hidden = !long
      more.textContent = open ? U.less : U.more
    }
    const tight = () => (port ? stage.clientHeight < root.clientHeight * 0.42 : side.scrollHeight > side.clientHeight + 1)
    while (k > (port ? 0.8 : small ? 0.7 : 0.62) && tight()) {
      k -= 0.04
      side.style.setProperty('--k', k.toFixed(2))
    }
    scaleLabels()
  }
  // words drawn inside a picture never get smaller than ~10px on screen
  function scaleLabels() {
    stage.querySelectorAll<SVGSVGElement>('svg.t13-art').forEach((svg) => {
      const vb = svg.viewBox.baseVal
      const sc = Math.min(stage.clientWidth / vb.width, stage.clientHeight / vb.height) || 1
      svg.style.setProperty('--inv', (1 / sc).toFixed(3))
    })
  }

  function setVague(v: boolean) {
    if (v === vague) return
    vague = v
    modeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === (v ? 0 : 1))))
    root.classList.toggle('is-vague', v)
    live.textContent = v ? U.showVague : U.showClear
    renderSlip()
    ctx.anim(() => art.update(on, vague, ctx.reduced, -1))
    ctx.chime('soft')
  }

  function toggle(i: number) {
    if (vague) {
      setVague(false)
      return
    }
    on[i] = !on[i]
    const st = stones[i]
    st.setAttribute('aria-pressed', String(on[i]))
    root.classList.add('has-any')
    live.textContent = on[i] ? fill(U.added, { name: copy.slots[i].name, frag: frags[i] }) : fill(U.removed, { name: copy.slots[i].name })
    if (!ctx.reduced) {
      const inner = st.querySelector('.t13-stone-in')!
      const rip = st.querySelector('.t13-rip')!
      ctx.anim(() => {
        if (on[i]) {
          gsap.fromTo(inner, { y: -14, scale: 1.06 }, { y: 0, scale: 1, duration: 0.75, ease: 'power3.in', overwrite: true,
            onComplete: () => void gsap.fromTo(inner, { y: 0 }, { y: -2, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.out' }) })
          gsap.fromTo(rip, { scale: 0.6, opacity: 0.75 }, { scale: 1.9, opacity: 0, duration: 1.6, delay: 0.55, ease: 'power2.out' })
        } else {
          gsap.fromTo(inner, { y: 0 }, { y: -6, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1, overwrite: true })
        }
      })
    }
    ctx.chime(on[i] ? 'soft' : 'low')
    root.classList.toggle('is-partial', done && !on.every(Boolean))
    renderSlip(on[i] ? i : -1)
    ctx.anim(() => art.update(on, false, ctx.reduced, i))
    if (!done && on.every(Boolean)) {
      done = true
      root.classList.add('is-done')
      modes.hidden = false
      if (!ctx.reduced) ctx.anim(() => gsap.from(modes, { opacity: 0, y: 8, duration: 0.9, delay: 0.4, ease: 'power3.out' }))
      renderSlip()
      ctx.chime('ok')
      ctx.anim(() => art.done?.())
      if (!opts.deferInsight) ctx.insight(copy.insight, copy.detail)
    }
  }

  const kit: Kit = {
    ctx,
    root,
    stage,
    extra,
    slipFoot,
    on,
    setFrag(i, t) {
      frags[i] = t
      if (on[i] && !vague) renderSlip()
    },
    override(t) {
      over = t
      renderSlip()
    },
    refit: fit,
  }
  const art = make(kit)
  art.update(on, false, true, -1)
  renderSlip()

  let raf = 0
  const layout = () => {
    const W = root.clientWidth
    const H = root.clientHeight
    if (!W || !H) return
    const land = W / H > 1.1
    root.classList.toggle('is-land', land)
    root.classList.toggle('is-port', !land)
    root.classList.toggle('is-short', land && H < 360)
    root.classList.toggle('is-wide', land && W > 1100 && H > 520)
    fit()
  }
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  layout()

  return () => {
    ro.disconnect()
    cancelAnimationFrame(raf)
    art.dispose?.()
  }
}
