import raw from '../../content/tram-33.json'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import { blob, curve, onSize, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import './whisper.css'
import { cardSheet, f1, lantern, live, P, t33Defs } from './kit'

const K = raw.scenes.whisper
const L = K.letter

/**
 * The wet stone steps seen from above (px W × H): the step the letter lies on is three flagstones with mossy joints and a
 * real thickness at its near edge; the next step up shows its riser; dew drops with a bright point each, a puddle with the moon.
 * Returns the art and the slab outline (for the grain laid over the stone).
 */
function stepArt(W: number, H: number, top: number, mobile: boolean, seed: number) {
  const r = rng(seed)
  const near = H * (mobile ? 0.93 : 0.9), thick = H * 0.05
  const l0 = W * 0.13, r0 = W * 0.87, l1 = -W * 0.12, r1 = W * 1.12
  const v = (y: number) => (y - top) / (near - top)
  const xL = (y: number) => l0 + (l1 - l0) * v(y), xR = (y: number) => r0 + (r1 - r0) * v(y)
  const slab = `M${f1(l0)} ${f1(top)}Q${f1(W / 2)} ${f1(top - 8)} ${f1(r0)} ${f1(top + 2)}L${f1(r1)} ${f1(near)}L${f1(l1)} ${f1(near)}Z`
  // the near edge: the slab's thickness, then the dark ground below it
  const face = `M${f1(l1)} ${f1(near)}L${f1(r1)} ${f1(near)}L${f1(r1)} ${f1(near + thick)}Q${f1(W / 2)} ${f1(near + thick + 4)} ${f1(l1)} ${f1(near + thick)}Z`
  // the step behind, a little higher: its riser and the lip of its top
  const rt = top - H * 0.075
  const riser = `M${f1(l0 - 6)} ${f1(top)}Q${f1(W / 2)} ${f1(top - 10)} ${f1(r0 + 6)} ${f1(top + 2)}L${f1(r0 + 2)} ${f1(rt)}Q${f1(W / 2)} ${f1(rt - 9)} ${f1(l0 + 2)} ${f1(rt)}Z`
  const lip = `M${f1(l0 + 2)} ${f1(rt)}Q${f1(W / 2)} ${f1(rt - 9)} ${f1(r0 + 2)} ${f1(rt)}L${f1(r0 - W * 0.02)} ${f1(rt - H * 0.05)}Q${f1(W / 2)} ${f1(rt - H * 0.058)} ${f1(l0 + W * 0.02)} ${f1(rt - H * 0.05)}Z`
  // two joints run from the back edge to the near edge (wobbling), one short cross joint: three flagstones
  const joint = (f0: number, f1_: number, k: number): Pt[] => Array.from({ length: 9 }, (_, i) => {
    const y = top + ((near - top) * i) / 8
    const f = f0 + (f1_ - f0) * (i / 8)
    return [xL(y) + (xR(y) - xL(y)) * f + (i && i < 8 ? (r() - 0.5) * W * 0.012 * k : 0), y + (i === 0 ? -3 : 0)] as Pt
  })
  const j1 = joint(0.36, 0.3, 1), j2 = joint(0.66, 0.72, 1)
  const cy0 = top + (near - top) * 0.55
  const cross: Pt[] = [[xL(cy0) + (xR(cy0) - xL(cy0)) * 0.665, cy0], [xR(cy0 + 6) - W * 0.01, cy0 + 8]]
  const poly = (pts: Pt[]) => `M${pts.map(P).join('L')}Z`
  const stone0 = poly([[l0, top], ...j1, [l1, near]])
  const stone1 = poly([...j1, ...[...j2].reverse()])
  const stone2 = poly([...j2, [r1, near], [r0, top + 2]])
  const joints = stroke(j1, Math.max(3, W * 0.004), 0.05, 0.05, 0.6) + stroke(j2, Math.max(3, W * 0.004), 0.05, 0.05, 0.6) + stroke(cross, Math.max(2.4, W * 0.003), 0.1, 0.1, 0.6)
  // the chamfered edges catch the moon
  const chamfer = stroke(j1.map(([x, y]) => [x + 3, y] as Pt), 1.2, 0.2, 0.3, 0.1) + stroke(j2.map(([x, y]) => [x + 3, y] as Pt), 1.2, 0.2, 0.3, 0.1) + stroke([[l0 + 6, top + 2], [W / 2, top - 5], [r0 - 6, top + 3]], 1.6, 0.1, 0.1, 0.3) + stroke([[l1, near - 1], [W / 2, near - 2], [r1, near - 1]], 2, 0.05, 0.05, 0.4)
  let moss = ''
  for (const j of [j1, j2]) for (let i = 1; i < 8; i += 1 + Math.floor(r() * 2)) moss += blob(j[i][0], j[i][1], W * (0.008 + r() * 0.01), H * (0.008 + r() * 0.008), seed + i * 3, 0.4, 10)
  moss += blob(l0 + W * 0.03, top + H * 0.03, W * 0.05, H * 0.022, seed + 90, 0.4, 12) + blob(r1 - W * 0.08, near - H * 0.02, W * 0.08, H * 0.03, seed + 91, 0.4, 12) + blob(l1 + W * 0.08, near - H * 0.015, W * 0.07, H * 0.025, seed + 92, 0.4, 12)
  // dew: each drop a small dark lens with a bright point on its moon side and a soft shadow
  let drops = '', lit = '', dsh = '', pits = ''
  for (let i = 0; i < 70; i++) {
    const vv = Math.pow(r(), 0.75), y = top + 6 + (near - top - 10) * vv
    const x = xL(y) + (xR(y) - xL(y)) * (0.04 + r() * 0.92)
    const k = (0.7 + vv * 1.6) * (mobile ? 0.8 : 1)
    if (i < 46) {
      const rx = k * (1.2 + r() * 1.4), ry = rx * (0.7 + r() * 0.2)
      dsh += blob(x + rx * 0.4, y + ry * 0.6, rx, ry * 0.8, seed + i, 0.1, 8)
      drops += blob(x, y, rx, ry, seed + i, 0.08, 8)
      lit += blob(x - rx * 0.35, y - ry * 0.35, rx * 0.32, ry * 0.28, seed + i + 200, 0.05, 6)
    } else pits += blob(x, y, k * (2 + r() * 3), k * (1 + r() * 1.5), seed + i, 0.4, 8)
  }
  const pudX = mobile ? W * 0.84 : W * 0.5 + Math.min(W * 0.44, 620) * 0.68, pudY = top + (near - top) * (mobile ? 0.8 : 0.78)
  const pud = blob(pudX, pudY, W * (mobile ? 0.1 : 0.055), H * 0.024, seed + 95, 0.25, 16)
  // wet patches darken the stone in soft islands; the riser has its own joints
  let wetp = ''
  for (let i = 0; i < 7; i++) {
    const y = top + (near - top) * (0.15 + r() * 0.8), x = xL(y) + (xR(y) - xL(y)) * (0.08 + r() * 0.84)
    wetp += blob(x, y, W * (0.04 + r() * 0.06), H * (0.02 + r() * 0.03), seed + 60 + i, 0.35, 14)
  }
  let rj = ''
  for (const f of [0.22, 0.47, 0.71]) rj += stroke([[l0 + (r0 - l0) * f, rt + 2], [l0 + (r0 - l0) * f + 2, top - 3]], 2, 0.05, 0.05, 0.6)
  // the flagstones' joints run on down the near face
  let fj = ''
  for (const j of [j1, j2]) fj += stroke([[j[8][0], near], [j[8][0] + 1, near + thick]], 2.4, 0.05, 0.05, 0.6)
  return {
    slab: slab + face + riser + lip,
    art: [
      s('path', { class: 't33w-lip', d: lip, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-riser', d: riser, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-risersh', d: riser }),
      s('path', { class: 't33w-joint', d: rj, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-moss', d: blob(l0 + (r0 - l0) * 0.3, top - 2, W * 0.05, H * 0.008, seed + 97, 0.4, 12) + blob(l0 + (r0 - l0) * 0.8, top, W * 0.04, H * 0.007, seed + 98, 0.4, 12), filter: 'url(#ink-wash)' }),
      s('path', { class: 't33w-ground', d: `M${f1(l1)} ${f1(near + thick - 2)}L${f1(r1)} ${f1(near + thick - 2)}L${f1(r1)} ${f1(H + 40)}L${f1(l1)} ${f1(H + 40)}Z` }),
      s('path', { class: 't33w-face', d: face, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-joint', d: fj, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-slab', d: slab, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-fs t33w-fs0', d: stone0 }),
      s('path', { class: 't33w-fs t33w-fs1', d: stone1 }),
      s('path', { class: 't33w-fs t33w-fs2', d: stone2 }),
      s('path', { class: 't33w-wet', d: slab }),
      s('path', { class: 't33w-wetp', d: wetp, filter: 'url(#ink-wash)' }),
      s('path', { class: 't33w-pits', d: pits }),
      s('path', { class: 't33w-joint', d: joints, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-moss', d: moss, filter: 'url(#ink-wash)' }),
      s('path', { class: 't33w-edge', d: chamfer }),
      s('path', { class: 't33w-puddle', d: pud }),
      s('path', { class: 't33w-pudrim', d: stroke(curve([pudX - W * 0.05, pudY - H * 0.012], [pudX, pudY - H * 0.03], [pudX + W * 0.05, pudY - H * 0.01], 10), 1.4, 0.2, 0.2, 0.1) }),
      s('ellipse', { class: 't33w-sheen', cx: f1(W * 0.6), cy: f1(top + (near - top) * 0.42), rx: f1(W * 0.05), ry: f1((near - top) * 0.4) }),
      s('path', { class: 't33w-dropsh', d: dsh }),
      s('path', { class: 't33w-drop', d: drops }),
      s('path', { class: 't33w-droplit', d: lit }),
      grass(l0 - 8, top + 4, 30, seed + 93), grass(r0 + 10, top + 6, 26, seed + 94), grass(r1 - W * 0.12, near + 4, 40, seed + 96),
    ],
  }
}

/** Scene 3 — a polite letter on a wet step: hold the lantern behind it and the hidden line glows through like a watermark. */
export function whisperScene(ctx: SceneCtx) {
  t33Defs()
  const low = ctx.quality === 'low'
  const quick = low || ctx.reduced
  let raised = low, done = false

  const night = s('svg', { class: 't33-night', 'aria-hidden': 'true' })
  const step = s('svg', { class: 't33w-step t33-fade', 'aria-hidden': 'true' })
  const hiddenDim = h('p', { class: 't33w-hidden', 'aria-hidden': 'true' }, L.hidden)
  const hiddenLit = h('p', { class: 't33w-hidden t33w-glow', 'aria-hidden': 'true' }, L.hidden)
  const hiddenAll = h('p', { class: 't33w-hidden t33w-full', 'aria-hidden': 'true' }, L.hidden)
  const sheet = h('div', { class: 't33w-sheet' },
    h('div', { class: 't33w-backlit', 'aria-hidden': 'true' }),
    h('p', { class: 't33w-from' }, L.from),
    ...L.visible.map((t) => h('p', { class: 't33w-line' }, t)),
    h('div', { class: 't33w-wm' }, hiddenDim, hiddenLit, hiddenAll),
    h('p', { class: 't33w-seal' }, K.mock),
    h('div', { class: 't33w-sweep', 'aria-hidden': 'true' }))
  const letter = h('div', { class: 't33w-letter' }, h('div', { class: 't33w-shadow', 'aria-hidden': 'true' }), sheet, h('div', { class: 't33w-ear', 'aria-hidden': 'true' }))
  const lamp = h('button', { class: 't33w-lamp', type: 'button', 'aria-label': K.lanternAria }, h('span', { class: 't33w-pool', 'aria-hidden': 'true' }), h('span', { class: 't33w-refl', 'aria-hidden': 'true' }), lantern('on', 3331))
  const tex = h('div', { class: 't33w-tex t33-fade', 'aria-hidden': 'true' })
  const say = live('t33w-say t33-ink')
  const stage = h('div', { class: 't33w-stage' }, step, tex, letter, lamp)
  const root = h('div', { class: `t33 t33w${low ? ' low up' : ''}`, role: 'group', 'aria-label': K.aria },
    night, stage, say,
    h('p', { class: 'visually-hidden' }, K.art))
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const card = cardSheet(root, K.takeaway, ctx.onCleanup)

  // ── layout: the night, the step, where the letter and the lantern rest
  const G = { W: 0, H: 0, home: [0, 0] as Pt }
  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    const W = root.clientWidth, H = root.clientHeight
    if (!W || !H) return
    const mobile = W < 640
    G.W = W
    G.H = H
    const lw = Math.round(mobile ? W * 0.88 : Math.min(W * 0.44, 620))
    root.style.setProperty('--lw', `${lw}px`)
    const top = H * (mobile ? 0.5 : 0.44)
    G.home = mobile ? [W * 0.89, H * 0.925] : [W * 0.5 + lw * 0.68, H * 0.76]
    for (const g of [night, step]) g.setAttribute('viewBox', `0 0 ${W} ${H}`)
    function* draw() {
      night.replaceChildren(
        mist(W * 0.5, top - H * 0.1, W * 0.6, H * 0.14),
        moon(W * (mobile ? 0.12 : 0.86), H * (mobile ? 0.07 : 0.11), mobile ? 11 : Math.max(14, Math.min(W, H) * 0.035), 3332, true),
        hills(-W * 0.05, W * 1.05, top - H * 0.02, H * 0.2, 3333, 0.92, 6),
        mist(W * 0.5, top - H * 0.01, W * 0.6, H * 0.05))
      yield
      const st = stepArt(W, H, top, mobile, 3334)
      step.replaceChildren(...st.art)
      tex.style.clipPath = `path('${st.slab}')`
      placeLamp()
    }
    job?.cancel()
    job = sliced(draw(), { sync: ctx.reduced || !first })
    first = false
  }
  ctx.onCleanup(onSize(root, layout))
  ctx.onCleanup(() => job?.cancel())

  // ── the lantern: where it stands; held, it follows the pointer and goes behind the paper
  let lx = 0, ly = 0
  const placeLamp = () => {
    if (behind) return placeBehind()
    if (!held) [lx, ly] = G.home
    lamp.style.transform = `translate(${f1(lx)}px, ${f1(ly)}px)`
  }
  /** the end: the lantern rests behind the standing letter, its light glowing through the lower corner of the paper */
  let behind = false
  function placeBehind() {
    measure()
    if (!box || !rootBox) return
    const px = box.width * 0.72, py = box.height * 0.7
    lx = box.left - rootBox.left + px
    ly = box.top - rootBox.top + py + 58
    lamp.style.transform = `translate(${f1(lx)}px, ${f1(ly)}px)`
    sheet.style.setProperty('--lx', `${f1(px)}px`)
    sheet.style.setProperty('--ly', `${f1(py)}px`)
    sheet.classList.add('lit')
  }
  let held = false, moved = false, p0: Pt = [0, 0]
  let box: DOMRect | null = null, wm: DOMRect | null = null, rootBox: DOMRect | null = null
  const seen = new Array(12).fill(false)
  function raise() {
    if (raised) return
    raised = true
    root.classList.add('up')
    ctx.chime('soft')
  }
  /** the light through the paper at screen point (x, y): only CSS variables are written */
  function shine(x: number, y: number) {
    if (!box || !wm) return
    const px = x - box.left, py = y - box.top
    sheet.style.setProperty('--lx', `${f1(px)}px`)
    sheet.style.setProperty('--ly', `${f1(py)}px`)
    sheet.classList.toggle('lit', px > -40 && px < box.width + 40 && py > -40 && py < box.height + 40)
    // which part of the hidden line has had the light behind it
    const R = Math.min(110, box.width * 0.22)
    if (y > wm.top - R * 0.6 && y < wm.bottom + R * 0.6) {
      for (let i = 0; i < seen.length; i++) {
        const cx = wm.left + ((i + 0.5) / seen.length) * wm.width
        if (Math.abs(cx - x) < R * 0.8) seen[i] = true
      }
      if (seen.filter(Boolean).length >= seen.length * 0.7) sweep()
    }
  }
  const measure = () => {
    box = sheet.getBoundingClientRect()
    wm = hiddenDim.getBoundingClientRect()
    rootBox = root.getBoundingClientRect()
    sheet.style.setProperty('--wx', `${f1(wm.left - box.left)}px`)
    sheet.style.setProperty('--wy', `${f1(wm.top - box.top)}px`)
  }
  lamp.addEventListener('pointerdown', (e) => {
    if (done && !raised) return
    e.preventDefault()
    lamp.setPointerCapture(e.pointerId)
    held = true
    moved = false
    p0 = [e.clientX, e.clientY]
    root.classList.add('held')
    raise()
    // the letter takes a moment to stand: measure it where it will be
    const later = quick ? 0 : 1100
    const id = setTimeout(measure, later)
    ctx.onCleanup(() => clearTimeout(id))
    if (quick) measure()
  })
  lamp.addEventListener('pointermove', (e) => {
    if (!held) return
    if (!moved && Math.hypot(e.clientX - p0[0], e.clientY - p0[1]) < 6) return
    moved = true
    rootBox ??= root.getBoundingClientRect()
    lx = e.clientX - rootBox.left
    ly = e.clientY - rootBox.top + 30
    lamp.style.transform = `translate(${f1(lx)}px, ${f1(ly)}px)`
    shine(e.clientX, e.clientY)
  })
  const drop = () => {
    if (!held) return
    held = false
    root.classList.remove('held')
    if (!behind) sheet.classList.remove('lit')
    placeLamp()
  }
  lamp.addEventListener('pointerup', drop)
  lamp.addEventListener('pointercancel', drop)
  // keyboard (Enter / Space) or a tap without a drag: the letter stands and the lantern passes behind it by itself
  lamp.addEventListener('click', () => {
    if (moved) return
    raise()
    sweep()
  })
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== ' ' || (e.target as Element).closest?.('input, textarea, button:not(.t33w-lamp)')) return
    e.preventDefault()
    raise()
    sweep()
  }
  addEventListener('keydown', onKey)
  ctx.onCleanup(() => removeEventListener('keydown', onKey))

  // ── the agent's eye: one cold, even light across the whole sheet; nothing hides from it
  function sweep() {
    if (done) return
    done = true
    const go = () => {
      root.classList.add('swept')
      ctx.chime('low')
      const id = setTimeout(() => {
        root.classList.add('shown', 'behind')
        behind = true
        if (!held) placeBehind()
        say.say(h('p', { class: 'visually-hidden' }, L.hidden), h('p', null, K.revealed))
        ctx.insight(K.insight as Fact, K.detail as Fact)
        card.show()
      }, quick ? 0 : 1500)
      ctx.onCleanup(() => clearTimeout(id))
    }
    const id = setTimeout(go, quick ? 0 : raised && root.classList.contains('up') ? 500 : 1300)
    ctx.onCleanup(() => clearTimeout(id))
  }
}
