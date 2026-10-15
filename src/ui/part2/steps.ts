import './part2.css'
import { fill, h, nextId, s } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import type { SceneDef } from '../../stations/types'
import type { StepPath, Takeaway } from './types'
import { clamp, curve, onDigit, onSize, rng, seedOf, shuffledIdx, stableHeight, stroke, type Pt } from './ink'
import { findTakeaway, takeaway } from './takeaway'

export interface StepOpts {
  label: string
  /** default "Đặt đá theo thứ tự" */
  prompt?: string
  question?: string
  /** the scene's insight once the path is lit (else the scene is just marked explored) */
  insight?: Fact | string
  detail?: Fact | string
  /** the card to open when done; default: toolkit.json card `data.takeaway` */
  card?: Takeaway
}

const f1 = (n: number) => n.toFixed(1)
type Stone = { el: HTMLButtonElement; step: number; key: number; slot: number }

/**
 * B.7.6 Lối đá từng bước: the steps lie shuffled (stable seed) beside an empty path. Tap them in order, drag one onto
 * its place, or press its number key. Wrong: the stone slides back and one line hints why; all placed: the path
 * lights and the take-away card opens.
 */
export function stepPath(data: StepPath, o: StepOpts): SceneDef {
  return {
    label: o.label,
    mount(ctx) {
      const steps = data.steps
      const n = steps.length
      const card = o.card ?? findTakeaway(data.takeaway)
      const seed = seedOf(steps.map((x) => x.label).join('|'))
      let pile = shuffledIdx(n, seed)
      if (pile.every((v, i) => v === i)) pile = pile.reverse() // never already in order
      const stableH = stableHeight(ctx, [o.insight])
      const r = rng(seed)
      const keysId = nextId('p2s')

      const line = s('svg', { class: 'p2s-line', 'aria-hidden': 'true' })
      const slots = steps.map((_, i) => h('div', { class: 'p2s-slot', 'aria-hidden': 'true' }, h('span', null, String(i + 1))))
      const stones: Stone[] = pile.map((step, k) => {
        const rr = () => 40 + Math.round(r() * 20)
        const el = h('button', {
          class: 'p2s-stone', type: 'button', 'aria-describedby': keysId,
          style: `border-radius:${rr()}% ${rr()}% ${rr()}% ${rr()}% / ${rr()}% ${rr()}% ${rr()}% ${rr()}%`,
        }, h('span', { class: 'p2s-key', 'aria-hidden': 'true' }, String(k + 1)), h('span', { class: 'p2s-label' }, steps[step].label))
        const st: Stone = { el, step, key: k + 1, slot: -1 }
        el.addEventListener('click', () => !st.el.dataset.dragged && tap(st))
        el.addEventListener('pointerdown', (e) => grab(st, e))
        return st
      })
      const note = h('p', { class: 'p2s-note' })
      const sheet = h('div', { class: 'p2s-sheet', hidden: true })
      const root = h('div', { class: 'p2s', role: 'group', 'aria-label': L.stepPath },
        o.question ? h('p', { class: 'p2-question p2s-q' }, o.question) : null,
        line, ...slots, ...stones.map((x) => x.el), note,
        h('p', { class: 'visually-hidden', id: keysId }, L.stepKeys),
        sheet)
      ctx.art.append(root)
      ctx.prompt(o.prompt ?? L.stepPrompt)

      const placed: (Stone | null)[] = steps.map(() => null)
      let slotXY: Pt[] = []
      let pileXY: Pt[] = []
      let size: Pt = [0, 0]
      let done = false

      const put = (st: Stone) => {
        const [x, y] = st.slot >= 0 ? slotXY[st.slot] : pileXY[st.key - 1]
        st.el.style.transform = `translate(${f1(x)}px, ${f1(y)}px)`
      }

      function tryPlace(st: Stone, slot: number) {
        if (done || st.slot >= 0 || slot < 0 || placed[slot]) return put(st)
        if (st.step !== slot) {
          put(st)
          st.el.classList.remove('shake')
          void st.el.offsetWidth // restart the shake
          st.el.classList.add('shake')
          note.className = 'p2s-note wrong'
          note.textContent = fill(L.stepWrong, { why: steps[slot].why })
          ctx.chime('low')
          return
        }
        st.slot = slot
        placed[slot] = st
        st.el.classList.add('placed')
        st.el.tabIndex = -1
        st.el.setAttribute('aria-disabled', 'true')
        st.el.querySelector('.p2s-key')!.textContent = String(slot + 1)
        put(st)
        note.className = 'p2s-note'
        note.replaceChildren(h('b', null, `${slot + 1}. ${steps[slot].label}`), ` — ${steps[slot].detail}`)
        if (!note.hasAttribute('aria-live')) note.setAttribute('aria-live', 'polite')
        // hand the keyboard on to the next loose stone
        if (document.activeElement === st.el) stones.find((x) => x.slot < 0)?.el.focus({ preventScroll: true })
        if (placed.every(Boolean)) finish()
        else ctx.chime('soft')
      }

      const tap = (st: Stone) => tryPlace(st, placed.findIndex((p) => !p))

      function finish() {
        done = true
        root.classList.add('lit')
        note.replaceChildren()
        ctx.chime('ok')
        if (card) {
          sheet.replaceChildren(
            h('button', { class: 'p2s-close', type: 'button', 'aria-label': L.close, onClick: () => (sheet.hidden = true) }, '×'),
            h('p', { class: 'p2s-done' }, L.stepDone),
            takeaway(card))
          sheet.hidden = false
          ;(sheet.querySelector('.p2k-copy') as HTMLElement | null)?.focus({ preventScroll: true })
        }
        if (o.insight) ctx.insight(o.insight, o.detail)
        else ctx.complete()
      }

      // drag: the stone follows the pointer; dropped on a slot it tries that slot, anywhere else it goes home
      let rootX = 0, rootY = 0
      function grab(st: Stone, e: PointerEvent) {
        if (done || st.slot >= 0 || e.button) return
        const r0 = root.getBoundingClientRect()
        rootX = r0.left
        rootY = r0.top
        const [hx, hy] = pileXY[st.key - 1]
        const ox = e.clientX - rootX - hx, oy = e.clientY - rootY - hy
        const sx = e.clientX, sy = e.clientY
        let moved = false
        delete st.el.dataset.dragged
        st.el.setPointerCapture(e.pointerId)
        const move = (ev: PointerEvent) => {
          if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
          moved = true
          st.el.classList.add('drag')
          st.el.style.transform = `translate(${f1(ev.clientX - rootX - ox)}px, ${f1(ev.clientY - rootY - oy)}px)`
        }
        const up = (ev: PointerEvent) => {
          st.el.removeEventListener('pointermove', move)
          st.el.removeEventListener('pointerup', up)
          st.el.removeEventListener('pointercancel', up)
          st.el.classList.remove('drag')
          if (!moved) return // a tap: the click handler places it
          st.el.dataset.dragged = '1' // swallow the click that follows this drag
          setTimeout(() => delete st.el.dataset.dragged)
          const px = ev.clientX - rootX, py = ev.clientY - rootY
          const slot = slotXY.findIndex(([x, y]) => px >= x - 8 && px <= x + size[0] + 8 && py >= y - 8 && py <= y + size[1] + 8)
          tryPlace(st, slot)
        }
        st.el.addEventListener('pointermove', move)
        st.el.addEventListener('pointerup', up)
        st.el.addEventListener('pointercancel', up)
      }

      function layout() {
        const W = ctx.art.clientWidth
        const H = stableH(ctx.art.clientHeight)
        if (W < 60 || H < 60) return
        root.style.height = `${f1(H)}px`
        const q = root.querySelector<HTMLElement>('.p2s-q')
        const qh = q ? q.offsetHeight + 8 : 0
        const gx = 14, gy = clamp(H * 0.025, 8, 16)
        // one row of path above the loose stones when it fits, else two columns: the path left, the stones right
        const sw = clamp((W - gx * (n - 1)) / n, 0, 176)
        const row = sw >= 128
        const noteH = 46
        if (row) {
          const sh = clamp(sw * 0.42, 52, 64)
          size = [sw, sh]
          const total = n * sw + (n - 1) * gx
          const x0 = (W - total) / 2
          const pathY = qh + clamp(H * 0.12, 24, 80)
          slotXY = steps.map((_, i) => [x0 + i * (sw + gx), pathY + Math.sin((i / Math.max(1, n - 1)) * Math.PI * 1.3) * sh * 0.45] as Pt)
          // the loose stones: rows under the path, centred
          const pileTop = pathY + sh * 2.4
          const per = Math.max(1, Math.floor((W + gx) / (sw + gx)))
          pileXY = pile.map((_, k) => {
            const rowN = Math.floor(k / per), inRow = Math.min(per, n - rowN * per)
            const rx0 = (W - (inRow * sw + (inRow - 1) * gx)) / 2
            return [rx0 + (k % per) * (sw + gx), pileTop + rowN * (sh + gy) + ((k * 7) % 5) * 2] as Pt
          })
          Object.assign(note.style, { top: `${f1(pathY + sh * 1.45)}px`, left: '0px', width: `${f1(W)}px`, textAlign: 'center' })
          Object.assign(sheet.style, { top: `${f1(pathY + sh * 1.35)}px`, bottom: '0px', left: `${f1(Math.max(0, (W - 620) / 2))}px`, right: `${f1(Math.max(0, (W - 620) / 2))}px` })
        } else {
          const cw = (W - gx * 2) / 2
          const sh = clamp((H - qh - noteH - gy * (n - 1)) / n, 40, 60)
          size = [cw, sh]
          const top = qh + 4
          slotXY = steps.map((_, i) => [0, top + i * (sh + gy)] as Pt)
          pileXY = pile.map((_, k) => [cw + gx * 2, top + k * (sh + gy)] as Pt)
          Object.assign(note.style, { top: `${f1(top + n * (sh + gy) + 2)}px`, left: '0px', width: `${f1(W)}px`, textAlign: 'left' })
          Object.assign(sheet.style, { top: `${f1(qh)}px`, bottom: '0px', left: '0px', right: '0px' })
        }
        root.classList.toggle('cols', !row)
        for (const [i, el] of slots.entries()) Object.assign(el.style, { transform: `translate(${f1(slotXY[i][0])}px, ${f1(slotXY[i][1])}px)`, width: `${f1(size[0])}px`, height: `${f1(size[1])}px` })
        for (const st of stones) Object.assign(st.el.style, { width: `${f1(size[0])}px`, height: `${f1(size[1])}px` }), put(st)
        drawLine(W, H, row)
      }

      // the path: a brushed ink line through the slots, with a moonlit twin that shows once every stone is in place
      function drawLine(w: number, hh: number, row: boolean) {
        line.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
        const c = slotXY.map(([x, y]) => [x + size[0] / 2, y + size[1] / 2] as Pt)
        const pts: Pt[] = []
        const lead = row ? 26 : 18
        const first: Pt = row ? [c[0][0] - size[0] / 2 - lead, c[0][1] + 6] : [c[0][0], c[0][1] - size[1] / 2 - lead]
        const last: Pt = row ? [c[n - 1][0] + size[0] / 2 + lead, c[n - 1][1] - 6] : [c[n - 1][0], c[n - 1][1] + size[1] / 2 + 6]
        const all = [first, ...c, last]
        for (let i = 0; i < all.length - 1; i++) {
          const a = all[i], b = all[i + 1]
          const mid: Pt = row ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 10] : [(a[0] + b[0]) / 2 + 14 * (i % 2 ? 1 : -1), (a[1] + b[1]) / 2]
          pts.push(...curve(a, mid, b, 10).slice(i ? 1 : 0))
        }
        const wv = row ? 7 : 5
        line.replaceChildren(
          s('path', { class: 'p2s-glow', d: stroke(pts, wv * 3, 0.05, 0.05, 0.4) }),
          s('path', { class: 'p2s-ink', d: stroke(pts, wv, 0.06, 0.08, 0.35), filter: 'url(#ink-rough)' }))
      }

      ctx.onCleanup(onSize(ctx.art, layout))
      ctx.onCleanup(onDigit((d) => {
        const st = stones.find((x) => x.key === d && x.slot < 0)
        if (st) tap(st)
      }))
    },
  }
}
