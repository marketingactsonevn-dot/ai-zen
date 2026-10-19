import './part2.css'
import { fill, h, nextId, s } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import type { Detail, SceneDef } from '../../stations/types'
import type { StepPath, Takeaway } from './types'
import { blob, clamp, curve, onDigit, onSize, rng, seedOf, shuffledIdx, stableHeight, stroke, type Pt } from './ink'
import { grass, hills, mist, moon, toro, wash } from './paint'
import { findTakeaway, foldedTakeaway } from './takeaway'

/** Where the path runs (px in the scene): a station may paint its own start and end (a workshop door, a gate at dawn). */
export type PathGeo = { w: number; h: number; row: boolean; first: Pt; last: Pt; top: number; pathY: number; seed: number }
/** What a station needs to lay out its own path (px in the scene): stone size, the question's height on top, the default mode. */
export type SlotGeo = { w: number; h: number; n: number; size: Pt; top: number; row: boolean; seed: number }

export interface StepOpts {
  label: string
  /** default "Đặt đá theo thứ tự" */
  prompt?: string
  question?: string
  /** the scene's insight once the path is lit (else the scene is just marked explored) */
  insight?: Fact | string
  detail?: Detail
  /** the card to open when done; default: toolkit.json card `data.takeaway` */
  card?: Takeaway
  /** more cards to open with it (toolkit.json ids), e.g. one per week */
  cards?: string[]
  /** a fact shown under the question from the start (the scene's own source line) */
  fact?: Fact | string
  /** the station's own painting (sky, start, end); default: hills under the moon, a stone lantern lit at the path's end */
  art?: (g: PathGeo) => SVGElement[]
  /** the empty places of the path, in order: their centres (a climb, an S of sand, a lamp's parts). Default: a row or a column */
  slots?: (g: SlotGeo) => Pt[]
  /** where the loose stones lie before they are placed (centres, pile order = their digit keys). Default: rows under the path */
  pile?: (g: SlotGeo) => Pt[]
  /** what step i looks like instead of a river stone, drawn in a size[0] × size[1] box (viewBox 0 0 w h); its label stays on top */
  piece?: (i: number, g: { w: number; h: number; seed: number }) => SVGElement
  /** after step k is placed (right) */
  onPlace?: (k: number) => void
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
      const more = (o.cards ?? []).map((id) => findTakeaway(id)).filter((c): c is Takeaway => !!c)
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
        if (o.piece) el.classList.add('has-art')
        const st: Stone = { el, step, key: k + 1, slot: -1 }
        el.addEventListener('click', () => !st.el.dataset.dragged && tap(st))
        el.addEventListener('pointerdown', (e) => grab(st, e))
        return st
      })
      const note = h('p', { class: 'p2s-note' })
      const sheet = h('div', { class: 'p2s-sheet', hidden: true })
      const scape = s('svg', { class: 'p2s-scape', 'aria-hidden': 'true' })
      const root = h('div', { class: 'p2s', role: 'group', 'aria-label': L.stepPath },
        scape,
        o.question || o.fact ? h('div', { class: 'p2s-q' }, o.question ? h('p', { class: 'p2-question' }, o.question) : null, o.fact ? ctx.fact(o.fact, 'p', 'p2s-fact') : null) : null,
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
          note.textContent = slot ? fill(L.stepWrong, { n: slot + 1, prev: steps[slot - 1].label }) : L.stepWrongFirst // where it goes, not what it is
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
        o.onPlace?.(slot)
        if (placed.every(Boolean)) finish()
        else ctx.chime('soft')
      }

      const tap = (st: Stone) => tryPlace(st, placed.findIndex((p) => !p))

      function finish() {
        done = true
        root.classList.add('lit')
        note.replaceChildren()
        ctx.chime('ok')
        if (card || more.length) {
          // folded at the end of the path: it opens when touched, not over the scene by itself (audit v3 F)
          const fold = foldedTakeaway([card, ...more].filter((c): c is Takeaway => !!c), ctx.onCleanup)
          sheet.replaceChildren(h('p', { class: 'p2s-done' }, L.stepDone), fold)
          sheet.hidden = false
          ;(fold.querySelector('.p2k-slip') as HTMLElement).focus({ preventScroll: true })
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
        const endW = clamp(W * 0.06, 36, 84) // room for the lantern at the path's end
        const sw = clamp((W - endW - gx * (n - 1)) / n, 0, 176)
        const row = sw >= 128
        const noteH = 46
        if (row) {
          const sh = clamp(sw * 0.42, 52, 64)
          size = [sw, sh]
          const total = n * sw + (n - 1) * gx
          const x0 = (W - endW - total) / 2
          const rows = Math.ceil(n / Math.max(1, Math.floor((W + gx) / (sw + gx))))
          const below = sh * 2.4 + rows * (sh + gy) + 12
          const pathY = qh + sh * 0.6 + Math.max(0, H - qh - below - sh) * 0.58
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
        // a station's own path and pile (centres) override the default places
        const sg: SlotGeo = { w: W, h: H, n, size, top: qh, row, seed }
        const corner = ([x, y]: Pt): Pt => [x - size[0] / 2, y - size[1] / 2]
        if (o.slots) {
          slotXY = o.slots(sg).map(corner)
          const low = Math.max(...slotXY.map(([, y]) => y)) + size[1] + 10
          note.style.top = `${f1(low)}px`
          sheet.style.top = `${f1(low)}px`
        }
        if (o.pile) pileXY = o.pile(sg).map(corner)
        root.classList.toggle('cols', !row)
        for (const [i, el] of slots.entries()) Object.assign(el.style, { transform: `translate(${f1(slotXY[i][0])}px, ${f1(slotXY[i][1])}px)`, width: `${f1(size[0])}px`, height: `${f1(size[1])}px` })
        for (const st of stones) {
          Object.assign(st.el.style, { width: `${f1(size[0])}px`, height: `${f1(size[1])}px` })
          if (o.piece) {
            st.el.querySelector('.p2s-art')?.remove()
            st.el.prepend(s('svg', { class: 'p2s-art', viewBox: `0 0 ${f1(size[0])} ${f1(size[1])}`, 'aria-hidden': 'true' }, o.piece(st.step, { w: size[0], h: size[1], seed: seed + st.step * 13 })))
          }
          put(st)
        }
        drawLine(W, H, row, qh)
      }

      // the path: a brushed ink line through the slots, with a moonlit twin that shows once every stone is in place
      function drawLine(w: number, hh: number, row: boolean, qh: number) {
        line.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
        scape.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
        const c = slotXY.map(([x, y]) => [x + size[0] / 2, y + size[1] / 2] as Pt)
        const pts: Pt[] = []
        const lead = row ? 26 : 18
        // the path runs on a little past both ends (along the station's own path, when it has one)
        const past = (a: Pt, b: Pt): Pt => {
          const dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy) || 1, d = Math.min(size[0], size[1]) / 2 + lead
          return [a[0] + (dx / l) * d, a[1] + (dy / l) * d]
        }
        const first: Pt = o.slots && n > 1 ? past(c[0], c[1]) : row ? [c[0][0] - size[0] / 2 - lead, c[0][1] + 6] : [c[0][0], c[0][1] - size[1] / 2 - lead]
        const last: Pt = o.slots && n > 1 ? past(c[n - 1], c[n - 2]) : row ? [c[n - 1][0] + size[0] / 2 + lead, c[n - 1][1] - 6] : [c[n - 1][0], c[n - 1][1] + size[1] / 2 + 6]
        const all = [first, ...c, last]
        for (let i = 0; i < all.length - 1; i++) {
          const a = all[i], b = all[i + 1]
          const mid: Pt = row ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 10] : [(a[0] + b[0]) / 2 + 14 * (i % 2 ? 1 : -1), (a[1] + b[1]) / 2]
          pts.push(...curve(a, mid, b, 10).slice(i ? 1 : 0))
        }
        const wv = row ? 7 : 5
        line.replaceChildren(
          s('path', { class: 'p2s-glow', d: stroke(pts, wv * 3, 0.05, 0.05, 0.4) }),
          s('path', { class: 'p2s-ink', d: stroke(pts, wv * 0.5, 0.06, 0.08, 0.35), filter: 'url(#ink-rough)' }))
        // the garden round it: a gravel band under the slots, raked sand where the loose stones lie, sky and both ends
        const pathY = slotXY[0][1]
        const geo: PathGeo = { w, h: hh, row, first, last, top: qh, pathY, seed }
        const rr = rng(seed + 5)
        let rake = ''
        const sandTop = row ? pathY + size[1] * 2.1 : qh
        for (let y = sandTop; y < hh - 4; y += 7 + rr() * 3) {
          for (let x = row ? 0 : w / 2 + 6; x < w; ) {
            const len = 40 + rr() * 140
            rake += stroke([[x, y + (rr() - 0.5)], [x + len, y + (rr() - 0.5)]], 1 + rr() * 0.5, 0.2, 0.2, 0.1)
            x += len + 8 + rr() * 30
          }
        }
        const band = stroke(pts, row ? size[1] * 1.5 : size[0] * 0.5, 0.02, 0.02, 0.6)
        const skyH = row ? pathY - qh : 0
        const back = o.art ? o.art(geo) : row && skyH > 60 ? [
          mist(w * 0.5, qh + skyH * 0.7, w * 0.6, skyH * 0.45),
          moon(w * 0.82, qh + Math.max(18, skyH * 0.28), clamp(skyH * 0.12, 10, 22), seed, true),
          hills(-w * 0.04, w * 1.04, pathY - size[1] * 0.55, skyH * 0.6, seed, 0.88, 6),
          hills(w * 0.05, w * 0.55, pathY - size[1] * 0.5, skyH * 0.5, seed + 1, 0.55, 2),
          mist(w * 0.5, pathY - size[1] * 0.6, w * 0.6, skyH * 0.16),
        ] : []
        const lampH = clamp(row ? size[1] * 1.9 : size[1] * 1.5, 46, 110)
        scape.replaceChildren(
          ...back,
          o.slots ? '' : s('path', { class: 'p2s-rake', d: rake }),
          s('path', { class: 'p2s-band', d: band, filter: 'url(#ink-wash)' }),
          wash(blob(last[0], last[1] + 4, lampH * 0.7, lampH * 0.12, seed + 7, 0.2), 0.18),
          o.art ? '' : s('g', { class: 'p2s-end' }, toro(last[0] + (row && !o.slots ? lampH * 0.25 : 0), last[1] + (row || o.slots ? 4 : lampH), lampH, true)),
          o.art ? '' : grass(first[0], first[1] + 6, 26, seed + 9))
      }

      ctx.onCleanup(onSize(ctx.art, layout))
      ctx.onCleanup(onDigit((d) => {
        const st = stones.find((x) => x.key === d && x.slot < 0)
        if (st) tap(st)
      }))
    },
  }
}
