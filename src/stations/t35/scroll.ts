import './scroll.css'
import { fill, h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onSize, rng, stroke, type Pt } from '../../ui/part2/ink'
import { mist, moon, pine } from '../../ui/part2/paint'
import { codeScroll } from '../../ui/part2/code'
import type { CodeScroll } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { guide } from '../../ui/part2/guide'
import { findTakeaway, foldedTakeaway } from '../../ui/part2/takeaway'
import { C } from './content'
import { F, drift, f1, gdefs, ink, lantern, wood, woodG } from './kit'

const K = C.scenes.scroll
const N = 9
const READ = 5 // the one scroll whose name tag can be read (the skill of this scene)

/**
 * Scene 2 — a dark alcove wall of boards with a rack of nine rolled skills, each its own length, silk and knob, hung at
 * three depths. A round moon window lets in a soft shaft of dusty light; a hand lantern on a bamboo stick is the key
 * light: carried along the wall, its pool reads only the name tags (what an AI reads first) while shadows swing away.
 * Open the readable skill and it unrolls along the wall as a makimono (a hanging kakemono on a phone): SKILL.md on
 * washi, notes in vermilion in the margin, a seal to copy at its tail, a cloth pouch of attached files at its axis.
 * Reduced motion / low: the lantern rests on the readable tag, the scroll opens at once.
 */
export function scrollScene(ctx: SceneCtx) {
  gdefs()
  const still = ctx.reduced || ctx.quality === 'low'
  const code = K.code as CodeScroll
  const desc = code.code.split('\n').find((l) => l.startsWith('description:'))?.slice(12).trim() ?? ''
  const r0 = rng(353)

  const wall = s('svg', { class: 't35s-wall', 'aria-hidden': 'true' })
  const win = s('svg', { class: 't35s-wall t35s-win', 'aria-hidden': 'true' })
  const shades = h('div', { class: 't35s-shades', 'aria-hidden': 'true' })
  const rail = s('svg', { class: 't35s-rail', 'aria-hidden': 'true' })
  const layers = [0, 1, 2].map((d) => h('div', { class: `t35s-depth d${d}` }))
  const cut = K.fileName.lastIndexOf('/') + 1 // the file name may break only after its slash
  const scrolls = Array.from({ length: N }, (_, k) => {
    const art = s('svg', { class: 't35s-roll-art', 'aria-hidden': 'true' })
    const shadow = h('div', { class: 't35s-shade' })
    const readable = k === READ
    const tagArt = s('svg', { class: 't35s-scrib', 'aria-hidden': 'true' })
    // the readable name tag: a paper strip tied with string; the file name on one line (it may break only after the slash)
    const tag = readable
      ? h('span', { class: 't35s-tag read t35k-paper' },
        h('b', { class: 't35s-file' }, h('span', null, K.fileName.slice(0, cut)), h('wbr'), h('span', null, K.fileName.slice(cut))),
        h('span', { class: 't35s-desc' }, desc))
      : h('span', { class: 't35s-tag', 'aria-hidden': 'true' }, tagArt)
    const el = readable
      ? h('button', { class: 't35s-roll read', type: 'button', 'aria-label': K.codeAria, 'aria-expanded': 'false', 'aria-controls': 't35s-maki', onClick: open }, art, tag)
      : h('div', { class: 't35s-roll', 'aria-hidden': 'true', onClick: () => nope(k) }, art, tag)
    // three tiers on their cords, neighbours never on the same tier; the lowest tier hangs nearest the wall's front
    const row = k % 3
    const depth = 2 - row
    return { el, art, shadow, tag, tagArt, depth, row, len: r0(), d: 0.8 + r0() * 0.4, silk: Math.floor(r0() * 4), knob: Math.floor(r0() * 3), x: 0, tagOp: -1 }
  })
  scrolls[READ].len = 0.7
  scrolls[READ].d = 1.1
  /** A tap on a scroll whose tag can't be read: its tassel swings, and the prompt says what to do. */
  function nope(k: number) {
    if (opened || found) return
    const el = scrolls[k].el
    el.classList.remove('nope')
    void el.offsetWidth // restart the swing
    el.classList.add('nope')
    GD.wrong(K.notReadable)
  }
  for (const sc of scrolls) {
    layers[sc.depth].append(sc.el)
    shades.append(sc.shadow)
  }
  const dark = h('div', { class: 't35s-dark', 'aria-hidden': 'true' })
  const pool = h('div', { class: 't35s-pool', 'aria-hidden': 'true' })
  const lampArt = s('svg', { class: 't35s-lamp-art', 'aria-hidden': 'true' })
  const lamp = h('div', {
    class: 't35s-lamp', role: 'slider', tabindex: '0', 'aria-label': K.lampAria,
    'aria-valuemin': '1', 'aria-valuemax': String(N), 'aria-valuenow': '1', 'aria-valuetext': fill(K.lampValue, { n: 1, total: N }),
  }, lampArt)
  // paper slips standing on the ledge: the note the lamp finds, later the two facts
  const ledge = h('div', { class: 't35s-ledge' })
  // the makimono: a sweep (mid) runs from the axis while the page itself holds still (inner); the rolled bulk rides its end
  const pouchSlip = h('div', { class: 't35s-pouch-slip t35k-paper', id: 't35s-pouch-slip', hidden: true }, h('span', null, K.pouch, h('wbr'), K.pouchFile))
  const pouch = h('button', { class: 't35s-pouch', type: 'button', 'aria-label': K.pouchAria, 'aria-expanded': 'false', 'aria-controls': 't35s-pouch-slip', onClick: () => {
    const on = pouchSlip.hidden
    pouchSlip.hidden = !on
    pouch.setAttribute('aria-expanded', String(on))
    ctx.chime('soft')
  } }, s('svg', { viewBox: '0 0 40 52', 'aria-hidden': 'true' },
    s('path', { class: 't35s-pouch-cord', d: 'M20 0V10' }),
    ink('M13 14Q9 10 15 8.5Q20 7 25 8.5Q31 10 27 14Q38 26 34 40Q20 50 6 40Q2 26 13 14Z', 't35s-pouch-body', 'wash'),
    ink(stroke([[13, 14], [20, 17], [27, 14]], 2.4, 0.1, 0.1, 0.4) + stroke([[16, 24], [19, 41]], 1.2, 0.2, 0.3, 0.1) + stroke([[25, 22], [27, 38]], 1, 0.2, 0.3, 0.1), 't35k-edge', 'rough'),
    ink(stroke(curve([20, 17], [27, 24], [24, 33], 6), 1.8, 0.1, 0.4, 0.3), 't35s-cordred', 'rough')))
  const scrollEl = codeScroll(code, { title: K.fileName })
  // the copy button becomes a small seal stamped at the scroll's tail
  const seal = h('div', { class: 't35s-seal' })
  const copyBtn = scrollEl.querySelector<HTMLElement>('.p2x-copy')
  if (copyBtn) seal.append(copyBtn)
  const inner = h('div', { class: 't35s-inner' }, scrollEl, seal)
  const bulk = h('div', { class: 't35s-bulk', 'aria-hidden': 'true' }, h('span', { class: 't35s-knob a' }), h('span', { class: 't35s-knob b' }))
  const mid = h('div', { class: 't35s-mid' }, inner, h('span', { class: 't35s-curl', 'aria-hidden': 'true' }), bulk)
  const axis = h('div', { class: 't35s-axis', 'aria-hidden': 'true' }, h('span', { class: 't35s-knob a' }), h('span', { class: 't35s-knob b' }))
  const maki = h('div', { class: 't35s-maki', id: 't35s-maki', hidden: true }, mid, axis, pouch)
  const root = h('div', { class: `t35 t35s${still ? ' still' : ''}` },
    h('p', { class: 'visually-hidden' }, K.art), wall, shades, rail, ...layers.slice().reverse(), dark, win, pool, ledge, maki, pouchSlip, lamp)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  // guide: a dot on the lantern until it finds the readable tag, then on that scroll
  const GD = guide(ctx)
  const dot = GD.dot(lamp, { dir: [1, 0] })
  const par = drift(ctx, root, [[wall, 3], [win, 3], [shades, 5], [rail, 7], [layers[2], 4], [layers[1], 7], [layers[0], 11]])

  let W = 0, H = 0, port = false
  let lx = 0, tx = 0 // lantern x: current, target
  let found = false, opened = false

  function light() {
    lamp.style.transform = `translate3d(${f1(lx)}px, 0, 0)`
    pool.style.transform = dark.style.transform = `translate3d(${f1(lx)}px, 0, 0)`
    let near = 0, best = Infinity
    for (const [k, sc] of scrolls.entries()) {
      const d = sc.x - lx
      if (Math.abs(d) < best) (best = Math.abs(d)), (near = k)
      // the shadow falls away from the lantern: longer and softer for the scrolls that hang out from the wall
      const reach = [0.22, 0.14, 0.07][sc.depth]
      sc.shadow.style.transform = `translate3d(${f1(clamp(d * reach, -70, 70))}px, ${f1([16, 10, 5][sc.depth])}px, 0) skewX(${f1(clamp(-d * reach * 0.4, -30, 30))}deg)`
      // name tags show only inside the pool
      // (the scribbled tags of the others stay faintly there as paper; the readable one only in the pool)
      const op = clamp(1.3 - Math.abs(d) / (W * (port ? 0.3 : 0.17)), k === READ ? 0.03 : 0.3, 1)
      if (Math.abs(op - sc.tagOp) > 0.02) (sc.tagOp = op), (sc.tag.style.opacity = op.toFixed(2))
    }
    if (String(near + 1) !== lamp.getAttribute('aria-valuenow')) {
      lamp.setAttribute('aria-valuenow', String(near + 1))
      lamp.setAttribute('aria-valuetext', fill(K.lampValue, { n: near + 1, total: N }))
    }
    const on = near === READ && best < W * 0.06
    scrolls[READ].el.classList.toggle('lit', on)
    // H3: the readable tag breathes as the lantern comes near
    scrolls[READ].el.classList.toggle('near', !on && !found && Math.abs(scrolls[READ].x - lx) < W * (port ? 0.4 : 0.2))
    if (on && !found && !opened) {
      found = true
      dot.at(scrolls[READ].el)
      ctx.prompt(K.openPrompt)
      ctx.chime('soft')
    }
  }
  const loop = createLoop(root, (_t, dt) => {
    const f = dt > 0 ? 1 - Math.exp(-dt * 7) : 1
    lx += (tx - lx) * f
    light()
    return Math.abs(tx - lx) > 0.3
  }, { essential: true })
  const aim = (x: number) => {
    tx = clamp(x, W * 0.05, W * 0.95)
    if (still) (lx = tx), light()
    else loop.start()
  }

  // carry the lantern: drag anywhere on the wall (touch / pen), follow the mouse, or ← → on the lantern
  let rx = 0
  let drag = -1
  root.addEventListener('pointerdown', (e) => {
    if (opened || (e.target as Element).closest('button')) return
    rx = root.getBoundingClientRect().left
    drag = e.pointerId
    aim(e.clientX - rx)
  })
  root.addEventListener('pointermove', (e) => {
    if (opened) return
    if (e.pointerId === drag || e.pointerType === 'mouse') {
      if (e.pointerType === 'mouse' && drag < 0) rx = root.getBoundingClientRect().left // shortcut: a read per mouse move, no ResizeObserver needed here
      aim(e.clientX - rx)
    }
  })
  const up = (e: PointerEvent) => e.pointerId === drag && (drag = -1)
  root.addEventListener('pointerup', up)
  root.addEventListener('pointercancel', up)
  lamp.addEventListener('keydown', (e) => {
    const now = Number(lamp.getAttribute('aria-valuenow')) - 1
    const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
    const to = k ? clamp(now + k, 0, N - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? N - 1 : -1
    if (to < 0) return
    e.preventDefault()
    aim(scrolls[to].x)
  })

  // H7: standing still 6 s, the lantern drifts 20 px toward the readable scroll and settles back
  const idle = () => {
    if (found || opened || ctx.reduced) return
    const from = tx
    aim(tx + Math.sign(scrolls[READ].x - tx) * 20)
    setTimeout(() => !found && !opened && drag < 0 && aim(from), 900)
  }
  ctx.el.addEventListener('p2:idle', idle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', idle))

  function open() {
    if (opened) return
    opened = true
    root.classList.add('is-open')
    scrolls[READ].el.setAttribute('aria-expanded', 'true')
    maki.hidden = false
    ctx.chime('soft')
    dot.done()
    // one fact at a time (the other was shown when the tag was found), and the blank SKILL.md card folded beside it
    const kit = findTakeaway(K.takeaway)
    // one block of words per state: the scroll itself; the two facts go into the insight's details
    ledge.replaceChildren(...(port ? [pouchSlip] : []), ...(kit ? [foldedTakeaway([kit], ctx.onCleanup)] : []))
    // on a wide frame the fact and the folded card lie on the ledge right under the open scroll
    if (!port) {
      Object.assign(ledge.style, { left: `${f1(W * 0.31 + 40)}px`, width: `${f1(Math.min(W * 0.55, 760))}px` })
      ledge.classList.add('row')
    }
    // the lantern steps aside to the scroll's tail so its pool lights the reading
    aim(port ? W * 0.9 : W * 0.29)
    const done = () => {
      seal.querySelector<HTMLElement>('.p2x-copy')?.focus({ preventScroll: true })
      ctx.insight(F(K.insight), [F(K.facts[1]), F(K.facts[0]), K.detail])
    }
    if (still) return done()
    const from = port ? 'translateY(-100%)' : 'translateX(100%)', back = port ? 'translateY(100%)' : 'translateX(-100%)'
    const a = mid.animate([{ transform: from }, { transform: 'none' }], { duration: 1600, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'backwards' })
    inner.animate([{ transform: back }, { transform: 'none' }], { duration: 1600, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'backwards' })
    a.finished.then(done, () => {})
  }

  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    W = root.clientWidth
    H = root.clientHeight
    if (W < 60 || H < 60) return
    port = W < H * 0.8
    root.classList.toggle('port', port)
    job?.cancel()
    job = sliced(paint(), { sync: ctx.reduced || !first })
    first = false
    par.resize()
  }

  function* paint() {
    // the wall: dark boards with grain and knots, a round moon window with a thin bamboo frame, a soft dusty shaft, the ledge
    const rr = rng(354)
    const bw = clamp(W * 0.075, 38, 92)
    let grain = '', seams = '', knots = ''
    const tones = ['', '']
    for (let x = -bw * 0.4, k = 0; x < W + bw; x += bw, k++) {
      const w = bw * (0.9 + rr() * 0.2)
      tones[k % 2] += `M${f1(x)} -4h${f1(w)}v${f1(H + 8)}h${f1(-w)}Z`
      seams += `M${f1(x + w)} -4V${f1(H + 4)}`
      for (let j = 0; j < 4; j++) {
        const gx = x + w * (0.15 + rr() * 0.7)
        const pts = Array.from({ length: 9 }, (_, q) => [gx + Math.sin(q * 0.9 + k + j) * w * 0.05, -4 + ((H + 8) * q) / 8] as Pt)
        grain += stroke(pts, 0.8 + rr() * 0.8, 0.02, 0.02, 0.4)
      }
      if (rr() < 0.4) knots += blob(x + w * (0.3 + rr() * 0.4), H * (0.2 + rr() * 0.6), w * 0.08, w * 0.12, 3650 + k, 0.2, 10)
      x += w - bw
    }
    const notches = s('path', { class: 't35s-notch' })
    const wx = port ? W * 0.2 : W * 0.15, wy = port ? H * 0.1 : H * 0.25, wr = port ? W * 0.13 : Math.min(W * 0.095, H * 0.17)
    const ring = (rad: number) => Array.from({ length: 61 }, (_, i) => { const a = (i / 60) * Math.PI * 2; return [wx + Math.cos(a) * rad, wy + Math.sin(a) * rad] as Pt })
    // the shaft: from the window down across the boards to the ledge, wide and soft, a little dust in it
    const ly = port ? H * 0.86 : H * 0.85
    const beam = `M${f1(wx - wr * 0.7)} ${f1(wy - wr * 0.3)}L${f1(wx + wr * 0.6)} ${f1(wy - wr * 0.7)}L${f1(wx + wr * 0.6 + W * 0.3)} ${f1(ly)}L${f1(wx - wr * 0.2 + W * 0.08)} ${f1(ly)}Z`
    let dust = ''
    for (let k = 0; k < 34; k++) {
      const t = rr()
      const x = wx + (W * 0.05 + W * 0.18 * t) * (0.4 + rr()), y = wy + (ly - wy) * t
      dust += blob(x, y, 0.8 + rr() * 1.4, 0.8 + rr() * 1.4, 3700 + k, 0.1, 6)
    }
    wall.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    wall.replaceChildren(
      s('path', { class: 't35s-board b0', d: tones[0] }), s('path', { class: 't35s-board b1', d: tones[1] }),
      s('path', { class: 't35s-grain', d: grain, filter: 'url(#ink-dry)' }),
      s('path', { class: 't35s-seam', d: seams }),
      s('path', { class: 't35s-knot', d: knots, filter: 'url(#ink-wash)' }),
      // the floor under the ledge: boards running away from us, the lantern's warmth caught on them
      s('path', { class: 't35s-floor', d: `M0 ${f1(ly + H * 0.03)}H${f1(W)}V${f1(H)}H0Z` }),
      s('path', { class: 't35s-floorline', d: floorLines(W, H, ly + H * 0.03) }),
      // the ledge: its top catches the light, its front face is in shade, a soft shadow under it
      s('rect', { class: 't35s-ledge-sh', x: 0, y: f1(ly + H * 0.03), width: f1(W), height: f1(H * 0.05) }),
      woodG([wood([-10, ly + H * 0.016], [W + 10, ly + H * 0.016 + 1], clamp(H * 0.03, 10, 22), 3690)], 't35s-sill'),
      s('rect', { class: 't35s-sill-top', x: 0, y: f1(ly - 2), width: f1(W), height: 3 }),
      // the groove the lantern's stick rides in, a notch under every scroll
      s('path', { class: 't35s-groove', d: `M0 ${f1(ly + 2)}H${f1(W)}`, id: 't35s-groove' }),
      notches)
    win.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    win.replaceChildren(
      s('defs', null, s('filter', { id: 't35s-soft', x: '-20%', y: '-20%', width: '140%', height: '140%' }, s('feGaussianBlur', { stdDeviation: still ? 0 : f1(clamp(W * 0.008, 4, 12)) }))),
      s('clipPath', { id: 't35s-winclip' }, s('circle', { cx: f1(wx), cy: f1(wy), r: f1(wr) })),
      s('circle', { class: 't35s-sky', cx: f1(wx), cy: f1(wy), r: f1(wr) }),
      s('g', { 'clip-path': 'url(#t35s-winclip)' },
        moon(wx + wr * 0.28, wy - wr * 0.22, wr * 0.26, 355, false),
        mist(wx, wy + wr * 0.75, wr * 1.3, wr * 0.32),
        s('g', { class: 't35s-bough' }, pine(wx - wr * 0.95, wy + wr * 1.6, wr * 2.3, 356, 1)),
        ink(stroke([[wx - wr * 0.34, wy - wr], [wx - wr * 0.34, wy + wr]], Math.max(2, wr * 0.035), 0.02, 0.02, 0.8) + stroke([[wx + wr * 0.34, wy - wr], [wx + wr * 0.34, wy + wr]], Math.max(2, wr * 0.035), 0.02, 0.02, 0.8), 't35s-bars', 'rough')),
      ink(stroke(ring(wr * 1.02), Math.max(3, wr * 0.045), 0.01, 0.01, 0.9), 't35s-frame', 'rough'),
      ink(stroke(ring(wr * 0.97).slice(32, 52), Math.max(1.2, wr * 0.02), 0.2, 0.3, 0.1), 't35s-moonrim'),
      s('path', { class: 't35s-beam', d: beam, fill: 'url(#t35k-beam)', filter: 'url(#t35s-soft)' }),
      s('path', { class: 't35s-dust', d: dust }))
    yield
    // the rack: a bamboo rail on two pegs; nine scrolls on hooks
    const x0 = port ? W * 0.06 : W * 0.31, x1 = port ? W * 0.94 : W * 0.95
    const by = port ? H * 0.34 : H * 0.27
    rail.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const step = (x1 - x0) / N
    const tier = port ? H * 0.095 : H * 0.11
    // a peg in the rail over every scroll, the bamboo on two brackets at its ends
    let pegs = ''
    for (let k = 0; k < N; k++) pegs += blob(x0 + step * (k + 0.5), by + 1, 3.2, 4.2, 3703 + k, 0.1, 8)
    rail.replaceChildren(
      s('ellipse', { class: 't35k-contact', cx: f1((x0 + x1) / 2), cy: f1(by + 12), rx: f1((x1 - x0) * 0.52), ry: 6 }),
      woodG([wood([x0 - 30, by], [x1 + 30, by + 1], clamp(W * 0.011, 7, 13), 3700)], 't35s-bamboo'),
      ink(`M${f1(x0 - 22)} ${f1(by - 3)}h7v${f1(22)}h-12Z M${f1(x1 + 15)} ${f1(by - 3)}h7v${f1(22)}h-12Z`, 't35s-peg', 'rough'),
      ink(pegs, 't35s-peg', 'rough'))
    for (const [k, sc] of scrolls.entries()) {
      const x = x0 + step * (k + 0.5)
      sc.x = x
      // a makimono on a cord loop: the silk-wrapped roll lies across, its rod's turned knobs past both ends
      const d = clamp(step * (port ? 0.4 : 0.27), 13, 28) * sc.d
      const len = step * (port ? 2.0 + sc.len * 0.45 : 1.35 + sc.len * 0.5)
      const drop = tier * (0.6 + sc.row) + (k * 7 % 5) * 2
      const z = [1, 0.93, 0.86][sc.depth]
      const w = len + d * 1.2, hh = drop + d * 1.9
      Object.assign(sc.el.style, { left: `${f1(x - w / 2)}px`, top: `${f1(by + 2)}px`, width: `${f1(w)}px`, height: `${f1(hh)}px`, transform: `scale(${z})` })
      sc.el.className = sc.el.className.replace(/ ?(silk|knob)\d/g, '') + ` silk${sc.silk} knob${sc.knob}`
      sc.art.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
      sc.art.replaceChildren(...rolled(w, hh, drop, d, len, sc.silk, 3720 + k))
      Object.assign(sc.shadow.style, { left: `${f1(x - len * z * 0.5)}px`, top: `${f1(by + 2 + drop * z + d * 0.2)}px`, width: `${f1(len * z)}px`, height: `${f1(d * 1.4 * z)}px` })
      sc.shadow.className = `t35s-shade d${sc.depth}`
      if (k !== READ) {
        const tw = d * 1.15, th = d * (2 + ((k * 7) % 5) * 0.25)
        Object.assign(sc.tag.style, { width: `${f1(tw)}px`, height: `${f1(th)}px`, marginTop: `${f1(((k * 5) % 3) * 4)}px` })
        sc.tagArt.setAttribute('viewBox', `0 0 ${f1(tw)} ${f1(th)}`)
        const q = rng(3800 + k)
        let scr = ''
        for (let j = 0; j < 3; j++) scr += stroke(curve([tw * (0.3 + q() * 0.2), th * (0.18 + j * 0.24)], [tw * (0.5 + q() * 0.3), th * (0.22 + j * 0.24)], [tw * (0.35 + q() * 0.3), th * (0.32 + j * 0.24)], 5), 1.3, 0.2, 0.3, 0.2)
        sc.tagArt.replaceChildren(s('rect', { class: 't35s-tagpaper', width: f1(tw), height: f1(th), rx: 1 }), ink(scr, 't35s-scribble'))
      } else {
        // the readable tag hangs a little aside on its string, always inside the frame
        const tw = port ? Math.min(W * 0.6, 240) : clamp(W * 0.17, 224, 250)
        const left = clamp(x - tw * 0.3, W * 0.04, W * 0.96 - tw)
        Object.assign(sc.tag.style, { width: `${f1(tw)}px`, left: `${f1(left - (x - w / 2))}px` })
        sc.tag.style.setProperty('--string', `${f1(x - left)}px`)
      }
    }
    const nly = port ? H * 0.86 : H * 0.85
    wall.querySelector('.t35s-notch')?.setAttribute('d', scrolls.map((sc) => `M${f1(sc.x - 3)} ${f1(nly - 1)}l3 6l3 -6Z`).join(''))
    yield
    // the lantern on its bamboo stick, held from below the frame
    const lh = port ? H * 0.11 : H * 0.27
    Object.assign(lamp.style, { height: `${f1(lh)}px`, width: '64px', marginLeft: '-32px' })
    lampArt.setAttribute('viewBox', `-32 0 64 ${f1(lh)}`)
    const lr = clamp(H * 0.035, 14, 24)
    lampArt.replaceChildren(
      woodG([wood([4, lh + 4], [-2, lr * 0.4], 4, 3900)], 't35s-bamboo'),
      woodG([wood([-2, lr * 0.4], [-14, lr * 0.2], 3, 3901)], 't35s-bamboo'),
      lantern(-14, lr * 0.2, lr, 3902, lr * 0.5))
    const pw = port ? W * 1.3 : H * 1.35
    const ptop = H - lh - pw * 0.5 + lr * 2.4
    Object.assign(pool.style, { width: `${f1(pw)}px`, height: `${f1(pw)}px`, marginLeft: `${f1(-pw / 2)}px`, top: `${f1(ptop)}px` })
    const dw = Math.max(W, H) * 3.2
    Object.assign(dark.style, { width: `${f1(dw)}px`, height: `${f1(dw)}px`, marginLeft: `${f1(-dw / 2)}px`, top: `${f1(ptop + pw / 2 - dw / 2)}px` })
    // the slips stand on the ledge under the window; the makimono hangs over the lower wall
    Object.assign(ledge.style, port
      ? { left: `${f1(W * 0.04)}px`, width: `${f1(W * 0.92)}px`, bottom: `${f1(H - ly + 2)}px` }
      : opened
        ? { left: `${f1(W * 0.31 + 40)}px`, width: `${f1(Math.min(W * 0.55, 760))}px`, bottom: `${f1(H - ly + 2)}px` }
        : { left: `${f1(W * 0.03)}px`, width: `${f1(clamp(W * 0.23, 230, 320))}px`, bottom: `${f1(H - ly + 2)}px` })
    Object.assign(maki.style, port
      ? { left: `${f1(W * 0.06)}px`, width: `${f1(W * 0.88)}px`, top: `${f1(H * 0.03)}px`, height: `${f1(H * 0.6)}px` }
      : { left: `${f1(W * 0.31)}px`, width: `${f1(Math.min(W * 0.62, 900))}px`, top: `${f1(H * 0.31)}px`, height: `${f1(H * 0.43)}px` })
    // the pouch's slip falls under the scroll beside the pouch; on a phone it joins the slips on the ledge
    if (port) {
      ledge.prepend(pouchSlip)
      Object.assign(pouchSlip.style, { right: '', top: '', left: '' })
    } else {
      root.insertBefore(pouchSlip, lamp)
      Object.assign(pouchSlip.style, { right: `${f1(W * 0.05 + 46)}px`, top: `${f1(H * 0.825)}px`, left: 'auto' })
    }
    maki.classList.toggle('v', port)
    if (first || lx === 0) {
      tx = lx = still ? scrolls[READ].x : port ? W * 0.18 : W * 0.24
    } else tx = clamp(opened ? (port ? W * 0.9 : W * 0.29) : tx, W * 0.05, W * 0.95)
    lx = tx
    light()
  }

  ctx.onCleanup(onSize(root, layout))
  ctx.onCleanup(() => {
    job?.cancel()
    loop.dispose()
  })
}

/**
 * A makimono hung on a cord loop (box w × hh): the loop from the peg round the roll, the silk wrap with its weave, the
 * paper's spiral at one end, the rod's turned knobs past both ends, the red tie and its tassel (the tag hangs below it).
 */
function rolled(w: number, hh: number, drop: number, d: number, len: number, silk: number, seed: number): SVGElement[] {
  const cx = w / 2
  const r = rng(seed)
  const x0 = cx - len / 2, x1 = cx + len / 2
  const y0 = drop, y1 = drop + d, ym = drop + d / 2
  const e = d * 0.16 // the ends' curve: a cylinder seen a little from below
  const body = `M${f1(x0 + e)} ${f1(y0)}L${f1(x1 - e)} ${f1(y0)}Q${f1(x1 + e)} ${f1(ym)} ${f1(x1 - e)} ${f1(y1)}L${f1(x0 + e)} ${f1(y1)}Q${f1(x0 - e)} ${f1(ym)} ${f1(x0 + e)} ${f1(y0)}Z`
  // the weave: fine bands across (silk 0, 2) or a scatter of small woven flowers (1, 3)
  let weave = ''
  if (silk % 2 === 0) for (let k = 1; k < 9; k++) {
    const x = x0 + (len * k) / 9
    weave += stroke([[x, y0 + 1], [x + 0.6, y1 - 1]], Math.max(0.8, d * 0.07), 0.2, 0.2, 0.3)
  }
  else for (let k = 0; k < 7; k++) weave += blob(x0 + len * (0.1 + r() * 0.8), y0 + d * (0.25 + r() * 0.5), d * 0.09, d * 0.09, seed + 40 + k, 0.2, 6)
  const tieX = cx + len * (r() - 0.5) * 0.2
  const knob = (x: number, dir: number) =>
    `M${f1(x)} ${f1(ym - d * 0.12)}h${f1(dir * d * 0.18)}v${f1(d * 0.24)}h${f1(-dir * d * 0.18)}Z` +
    blob(x + dir * d * 0.36, ym, d * 0.2, d * 0.3, seed + (dir > 0 ? 7 : 8), 0.08, 12)
  return [
    // the cord: from the peg down both sides of the roll and round under it
    s('path', { class: 't35s-cord', d: `M${f1(cx)} 0L${f1(x0 + len * 0.22)} ${f1(y0 + d * 0.2)}M${f1(cx)} 0L${f1(x1 - len * 0.22)} ${f1(y0 + d * 0.2)}` }),
    s('path', { class: 't35s-silk', d: body }),
    s('path', { class: 't35s-weave', d: weave }),
    s('path', { d: body, fill: 'url(#t35k-cylh)' }),
    // the paper's end face, wound in a spiral, at the left end
    s('ellipse', { class: 't35s-paper', cx: f1(x0 + e * 0.6), cy: f1(ym), rx: f1(d * 0.17), ry: f1(d * 0.46) }),
    ink(stroke([[x0 + e * 0.6, ym - d * 0.3], [x0 + e * 0.6 + d * 0.06, ym], [x0 + e * 0.6, ym + d * 0.3]], Math.max(0.7, d * 0.05), 0.2, 0.2, 0.3), 't35k-edge'),
    ink(stroke([[x0 + e, y1 - 0.5], [cx, y1 + 0.4], [x1 - e, y1 - 0.5]], Math.max(1.2, d * 0.11), 0.1, 0.1, 0.4), 't35k-edge', 'rough'),
    ink(stroke([[x0 + e * 2, y0 + d * 0.22], [cx, y0 + d * 0.14], [x1 - e * 2, y0 + d * 0.22]], Math.max(0.8, d * 0.08), 0.3, 0.3, 0.1), 't35k-rim'),
    // the rod's ends and their turned knobs
    ink(knob(x0 - e * 0.2, -1) + knob(x1 + e * 0.2, 1), 't35s-knob', 'rough'),
    // the loop of cord passing under the roll, then the red tie and its tassel
    s('path', { class: 't35s-cord', d: `M${f1(x0 + len * 0.22)} ${f1(y0 + d * 0.2)}V${f1(y1)}M${f1(x1 - len * 0.22)} ${f1(y0 + d * 0.2)}V${f1(y1)}` }),
    ink(stroke([[tieX - d * 0.06, y0 - 0.5], [tieX + d * 0.04, ym], [tieX - d * 0.04, y1 + 0.5]], Math.max(2, d * 0.2), 0.05, 0.05, 0.6), 't35s-cordred', 'rough'),
    s('path', { class: 't35s-tassel', d: `M${f1(tieX)} ${f1(y1)}Q${f1(tieX + d * 0.3)} ${f1(y1 + d * 0.4)} ${f1(cx)} ${f1(hh)}` }),
  ]
}

/** Floor boards seen from above the ledge: seams converging a little toward the wall. */
function floorLines(W: number, H: number, y0: number): string {
  let d = ''
  for (let k = -6; k <= 6; k++) {
    const xt = W / 2 + k * W * 0.09, xb = W / 2 + k * W * 0.16
    d += stroke([[xt, y0 + 2], [xb, H + 2]], 1.2, 0.05, 0.05, 0.4)
  }
  return d
}
