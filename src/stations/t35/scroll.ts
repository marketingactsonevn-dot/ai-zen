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
      : h('div', { class: 't35s-roll', 'aria-hidden': 'true', onClick: () => !opened && !found && GD.wrong(K.notReadable) }, art, tag)
    const depth = readable ? 0 : [1, 2, 0, 2, 1, 0, 2, 1, 0][k]
    return { el, art, shadow, tag, tagArt, depth, len: 0.58 + r0() * 0.42, d: 0.78 + r0() * 0.5, silk: Math.floor(r0() * 4), knob: Math.floor(r0() * 3), x: 0, tagOp: -1 }
  })
  scrolls[READ].len = 0.8
  scrolls[READ].d = 1
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
      const op = clamp(1.3 - Math.abs(d) / (W * (port ? 0.3 : 0.17)), 0.03, 1)
      if (Math.abs(op - sc.tagOp) > 0.02) (sc.tagOp = op), (sc.tag.style.opacity = op.toFixed(2))
    }
    if (String(near + 1) !== lamp.getAttribute('aria-valuenow')) {
      lamp.setAttribute('aria-valuenow', String(near + 1))
      lamp.setAttribute('aria-valuetext', fill(K.lampValue, { n: near + 1, total: N }))
    }
    const on = near === READ && best < W * 0.06
    scrolls[READ].el.classList.toggle('lit', on)
    if (on && !found && !opened) {
      found = true
      dot.at(scrolls[READ].el)
      ctx.prompt(K.openPrompt)
      ledge.replaceChildren(h('div', { class: 't35s-slip t35k-paper' }, ctx.fact(F(K.facts[1]), 'p')))
      if (!ledge.hasAttribute('aria-live')) ledge.setAttribute('aria-live', 'polite')
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
    ledge.replaceChildren(...(port ? [pouchSlip] : []), h('div', { class: 't35s-slip t35k-paper' }, ctx.fact(F(K.facts[0]), 'p')), ...(kit ? [foldedTakeaway([kit], ctx.onCleanup)] : []))
    // the lantern steps aside to the scroll's tail so its pool lights the reading
    aim(port ? W * 0.9 : W * 0.29)
    const done = () => {
      seal.querySelector<HTMLElement>('.p2x-copy')?.focus({ preventScroll: true })
      ctx.insight(F(K.insight), K.detail)
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
    const wx = port ? W * 0.2 : W * 0.15, wy = port ? H * 0.1 : H * 0.25, wr = port ? W * 0.13 : Math.min(W * 0.095, H * 0.17)
    const ring = (rad: number) => Array.from({ length: 61 }, (_, i) => { const a = (i / 60) * Math.PI * 2; return [wx + Math.cos(a) * rad, wy + Math.sin(a) * rad] as Pt })
    // the shaft: from the window down across the boards to the ledge, wide and soft, a little dust in it
    const ly = port ? H * 0.86 : H * 0.88
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
      // the ledge: its top catches the light, its front face is in shade, a soft shadow under it
      s('rect', { class: 't35s-ledge-sh', x: 0, y: f1(ly + H * 0.03), width: f1(W), height: f1(H * 0.05) }),
      woodG([wood([-10, ly + H * 0.016], [W + 10, ly + H * 0.016 + 1], clamp(H * 0.03, 10, 22), 3690)], 't35s-sill'),
      s('rect', { class: 't35s-sill-top', x: 0, y: f1(ly - 2), width: f1(W), height: 3 }))
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
    const x0 = port ? W * 0.08 : W * 0.31, x1 = port ? W * 0.92 : W * 0.95
    const by = port ? H * 0.3 : H * 0.14
    rail.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    rail.replaceChildren(
      s('ellipse', { class: 't35k-contact', cx: f1((x0 + x1) / 2), cy: f1(by + 12), rx: f1((x1 - x0) * 0.52), ry: 6 }),
      woodG([wood([x0 - 30, by], [x1 + 30, by + 1], clamp(W * 0.011, 7, 13), 3700)], 't35s-bamboo'),
      ink(blob(x0 - 16, by + 2, 7, 9, 3701, 0.1, 8) + blob(x1 + 16, by + 2, 7, 9, 3702, 0.1, 8), 't35s-peg', 'rough'))
    const step = (x1 - x0) / N
    const base = clamp(step * 0.34, 10, 28) // a roll's diameter
    const L0 = port ? H * 0.22 : H * 0.36
    for (const [k, sc] of scrolls.entries()) {
      const x = x0 + step * (k + 0.5)
      sc.x = x
      const d = base * sc.d, len = L0 * sc.len
      const z = [1, 0.92, 0.84][sc.depth]
      const w = d * 2.6, hh = len + d * 1.8
      Object.assign(sc.el.style, { left: `${f1(x - w / 2)}px`, top: `${f1(by - 2)}px`, width: `${f1(w)}px`, height: `${f1(hh)}px`, transform: `scale(${z})` })
      sc.el.className = sc.el.className.replace(/ ?(silk|knob)\d/g, '') + ` silk${sc.silk} knob${sc.knob}`
      sc.art.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
      sc.art.replaceChildren(...rolled(w, hh, d, sc.knob, 3720 + k))
      Object.assign(sc.shadow.style, { left: `${f1(x - d * 0.75)}px`, top: `${f1(by + d * 1.4)}px`, width: `${f1(d * 1.5)}px`, height: `${f1(len * z)}px` })
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
      : { left: `${f1(W * 0.03)}px`, width: `${f1(clamp(W * 0.23, 230, 320))}px`, bottom: `${f1(H - ly + 2)}px` })
    Object.assign(maki.style, port
      ? { left: `${f1(W * 0.06)}px`, width: `${f1(W * 0.88)}px`, top: `${f1(H * 0.03)}px`, height: `${f1(H * 0.44)}px` }
      : { left: `${f1(W * 0.31)}px`, width: `${f1(Math.min(W * 0.62, 900))}px`, top: `${f1(H * 0.3)}px`, height: `${f1(H * 0.51)}px` })
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
      tx = lx = still ? scrolls[READ].x : W * 0.12
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

/** A rolled hanging scroll (box w × hh): its cord to the hook, knobs at both ends, the rolled silk and paper, its tie. */
function rolled(w: number, hh: number, d: number, knob: number, seed: number): SVGElement[] {
  const cx = w / 2
  const top = d * 1.3, bot = hh - d * 0.45
  const r = rng(seed)
  const kd = knob === 2 ? 0.5 : 0.62
  const knobD = (y: number) => knob === 1
    ? blob(cx - d * 0.5 - d * 0.2, y, d * 0.22, d * 0.22, seed + 1, 0.05, 10) + blob(cx + d * 0.5 + d * 0.2, y, d * 0.22, d * 0.22, seed + 2, 0.05, 10)
    : `M${f1(cx - d * 0.5 - d * kd)} ${f1(y - d * 0.16)}h${f1(d * kd)}v${f1(d * 0.32)}h${f1(-d * kd)}ZM${f1(cx + d * 0.5)} ${f1(y - d * 0.16)}h${f1(d * kd)}v${f1(d * 0.32)}h${f1(-d * kd)}Z`
  const body = `M${f1(cx - d / 2)} ${f1(top)}L${f1(cx + d / 2)} ${f1(top)}L${f1(cx + d / 2)} ${f1(bot)}L${f1(cx - d / 2)} ${f1(bot)}Z`
  const tie = top + (bot - top) * (0.4 + r() * 0.2)
  return [
    s('path', { class: 't35s-cord', d: `M${f1(cx)} 0L${f1(cx - d * 0.35)} ${f1(top - d * 0.15)}M${f1(cx)} 0L${f1(cx + d * 0.35)} ${f1(top - d * 0.15)}` }),
    s('path', { class: 't35s-silk', d: body }),
    s('rect', { class: 't35s-paper', x: f1(cx - d / 2), y: f1(top + (bot - top) * 0.12), width: f1(d), height: f1((bot - top) * 0.7) }),
    s('path', { d: body, fill: 'url(#t35k-cyl)' }),
    ink(stroke([[cx + d * 0.48, top + 2], [cx + d * 0.5, (top + bot) / 2], [cx + d * 0.48, bot - 2]], Math.max(1.4, d * 0.1), 0.1, 0.1, 0.4), 't35k-edge', 'rough'),
    ink(stroke([[cx - d * 0.3, top + 4], [cx - d * 0.32, bot - 4]], Math.max(1, d * 0.07), 0.3, 0.3, 0.1), 't35k-rim'),
    // the rod's ends stick out past the paper at top and bottom, turned knobs on them
    ink(stroke([[cx - d * 0.62, top], [cx + d * 0.62, top]], d * 0.2, 0.02, 0.02, 0.8) + stroke([[cx - d * 0.62, bot], [cx + d * 0.62, bot]], d * 0.24, 0.02, 0.02, 0.8), 't35s-rod'),
    ink(knobD(bot), 't35s-knob', 'rough'),
    ink(stroke([[cx - d * 0.55, tie], [cx, tie + d * 0.04], [cx + d * 0.55, tie]], Math.max(2, d * 0.16), 0.1, 0.1, 0.5), 't35s-cordred', 'rough'),
    s('path', { class: 't35s-cord', d: `M${f1(cx + d * 0.2)} ${f1(tie + 1)}Q${f1(cx + d * 0.6)} ${f1(bot)} ${f1(cx + d * 0.1)} ${f1(hh)}` }),
  ]
}
