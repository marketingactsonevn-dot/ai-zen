import Matter from 'matter-js'
import { h } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { tokenize } from './tokenizer'
import { brush, col, mix, rng, wash, type Pt } from './ink'
import { CAT, Pit, afterFonts, clamp, crackIn, footReserve, sentence, type Kind, type Stone } from './pit'

const { Events } = Matter

export interface ScaleCopy {
  prompt: string
  ask: string
  doc: string
  answer: string
  reset: string
  question: string
  reply: string
  docTitle: string
  inLabel: string
  outLabel: string
  bill: string
  art: string
  tilt: { left: string; right: string; even: string }
  insight: string | Fact
  detail: string | Fact
}

const WEIGHT: Record<Kind, number> = { stone: 1, moss: 1, ink: 3, pebble: 2 }
// weights are illustrative (output stones heavier, as output tokens usually cost more), not real prices
const PAN_O = [{ x: -5000, y: 0 }, { x: 5000, y: 0 }]
const MASK = CAT.ground | CAT.wall | CAT.c | CAT.a

/** Scene 4: a merchant's balance — what you send in one dish, what the AI writes in the other; coins pile up. */
export function mountScale(ctx: SceneCtx, c: ScaleCopy) {
  const pit = new Pit(ctx, 't4-s4')
  const reserve = footReserve(ctx, [c.insight])
  const desc = h('p', { class: 'visually-hidden' }, c.art)
  const askBtn = h('button', { class: 't4-chip', type: 'button' }, c.ask)
  const docBtn = h('button', { class: 't4-chip', type: 'button' }, c.doc)
  const ansBtn = h('button', { class: 't4-chip t4-chip--ink', type: 'button', disabled: true }, c.answer)
  const resetBtn = h('button', { class: 't4-chip t4-chip--ghost', type: 'button' }, c.reset)
  resetBtn.hidden = true
  const acts = h('div', { class: 't4-acts' }, askBtn, docBtn, ansBtn, resetBtn)
  const hosts = [h('div', { class: 't4-pan-sent' }), h('div', { class: 't4-pan-sent', lang: 'vi' })]
  const labels = [h('p', { class: 't4-pan-label' }, c.inLabel), h('p', { class: 't4-pan-label t4-pan-label--out' }, c.outLabel)]
  const bill = h('p', { class: 't4-bill', 'aria-hidden': 'true' }, c.bill)
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  pit.root.append(desc, ...hosts, ...labels, bill, acts, live)
  pit.layer.setAttribute('aria-hidden', 'true')

  let port = false
  let Heff = 300
  const G = { L: 250, stem: 58, rx: 100, ry: 26, base: 112 }
  let statics: Matter.Body[] = []
  // beam angle (rad, + = right side down) and its velocity
  let th = 0, om = 0
  const frames = [{ x: 0, y: 0 }, { x: 0, y: 0 }]
  const pans: Stone[][] = [[], []]
  const landed = new WeakSet<Matter.Body>()
  let coins = 0
  let told = false
  let asked = false, answered = false, docDone = false
  let lastTilt = ''

  const rimAt = (i: number, a = th) => {
    const sx = i ? 1 : -1
    return { x: sx * G.L * Math.cos(a), y: sx * G.L * Math.sin(a) - G.stem }
  }
  const setFrames = () => {
    for (let i = 0; i < 2; i++) {
      const p = rimAt(i)
      frames[i].x = p.x - PAN_O[i].x
      frames[i].y = p.y - PAN_O[i].y
    }
  }

  const buildPans = () => {
    pit.removeBodies(statics)
    statics = []
    for (let i = 0; i < 2; i++) {
      const o = PAN_O[i]
      const pts: [number, number][] = []
      for (let k = 0; k <= 16; k++) {
        const a = (k / 16) * Math.PI
        pts.push([o.x - G.rx * Math.cos(a), o.y + G.ry * Math.sin(a)])
      }
      statics.push(...pit.chain(pts, 18, CAT.c))
      // invisible, outward-leaning sides so a big pile settles into a mound instead of spilling
      statics.push(...pit.chain([[o.x - G.rx - 70, o.y - 260], [o.x - G.rx, o.y + 2]], 18, CAT.c))
      statics.push(...pit.chain([[o.x + G.rx, o.y + 2], [o.x + G.rx + 70, o.y - 260]], 18, CAT.c))
    }
  }

  pit.resizeFn = () => {
    Heff = Math.max(100, pit.H - reserve())
    port = pit.W / Heff < 0.95
    // short landscape: the buttons stand in a column at the right, the balance takes the rest
    const col = !port && Heff < 330
    acts.classList.toggle('is-col', col)
    Object.assign(G, port ? { L: 142, stem: 50, rx: 80, ry: 24, base: 118 } : col ? { L: 230, stem: 50, rx: 108, ry: 26, base: 70 } : { L: 250, stem: 58, rx: 112, ry: 28, base: 112 })
    buildPans()
    const fs = col ? 14 : clamp(Math.min(pit.W * (port ? 0.045 : 0.024), Heff * 0.055), 15, 26)
    hosts.forEach((hh) => hh.style.setProperty('--fs', `${fs}px`))
    const areaW = col ? pit.W - acts.offsetWidth - 12 : pit.W
    const topZone = fs * 1.35 * (col ? 1 : 2) + (col ? 8 : 18)
    const bottomZone = col ? 10 : acts.offsetHeight + 30
    const pile = col ? 70 : 120
    const needH = G.stem + pile + G.base + 34
    const sc = clamp(Math.min((areaW * 0.94) / (2 * (G.L + G.rx + 14)), (Heff - topZone - bottomZone) / needH), 0.2, 1.5)
    const spare = Math.max(0, Heff - topZone - bottomZone - needH * sc)
    const oy = topZone + spare * 0.45 + (G.stem + pile) * sc
    pit.setView({ s: sc, ox: areaW / 2, oy })
    acts.style.top = col ? `${Math.max(0, (Heff - acts.offsetHeight) / 2)}px` : `${Heff - acts.offsetHeight - 6}px`
    setFrames()
    place()
    pit.wake(60)
  }

  const place = () => {
    const sc = pit.view.s
    for (let i = 0; i < 2; i++) {
      const p = rimAt(i, 0)
      const [x] = pit.toScreen(p.x, 0)
      const w = Math.min(pit.W / 2 - 12, G.rx * 2.6 * sc)
      // runs every frame from frameFn: plain style writes, no throwaway objects
      const hs = hosts[i].style
      hs.left = `${x - w / 2}px`
      hs.width = `${w}px`
      hs.top = '4px'
      const e = rimAt(i)
      const [lx, ly] = pit.toScreen(e.x, e.y + G.stem + 16)
      labels[i].style.left = `${lx}px`
      labels[i].style.top = `${ly}px`
    }
    const [bx, by] = pit.toScreen(G.L * 0.5, G.base + 22)
    bill.style.left = `${bx}px`
    bill.style.top = `${by}px`
  }

  // ── stones land → they start to weigh
  const onHit = (ev: Matter.IEventCollision<Matter.Engine>) => {
    for (const p of ev.pairs) {
      const a = p.bodyA, b = p.bodyB
      if (a.isStatic || landed.has(a)) landed.add(b)
      if (b.isStatic || landed.has(b)) landed.add(a)
    }
  }
  Events.on(pit.engine, 'collisionStart', onHit)
  ctx.onCleanup(() => Events.off(pit.engine, 'collisionStart', onHit))

  // a long document always weighs the same, however many pebbles the quality setting draws
  const DOC = 84
  let pebbleW = 2
  const weight = (i: number) => {
    let sum = 0
    for (const st of pans[i]) sum += landed.has(st.body) ? (st.kind === 'pebble' ? pebbleW : WEIGHT[st.kind]) : 0
    return sum
  }

  pit.frameFn = (dt) => {
    const wl = weight(0), wr = weight(1)
    const target = 0.2 * Math.tanh((wr - wl) / 28)
    const k = 7, d = 2.4
    const steps = Math.max(1, Math.ceil(dt / 0.016))
    for (let i = 0; i < steps; i++) {
      const h2 = dt / steps
      om += (-k * (th - target) - d * om) * h2
      th += om * h2
    }
    if (ctx.reduced) (th = target), (om = 0)
    setFrames()
    pit.forceSync = true
    place()
    const want = Math.min(22, Math.round((wl + wr) / 7))
    if (coins < want) coins = Math.min(want, coins + dt * 9)
    if (coins > want) coins = Math.max(want, coins - dt * 30)
    if (ctx.reduced) coins = want
    bill.classList.toggle('is-on', coins >= 1)
    const tilt = Math.abs(target) < 0.03 ? 'even' : target > 0 ? 'right' : 'left'
    if (tilt !== lastTilt && (wl || wr)) {
      lastTilt = tilt
      live.textContent = c.tilt[tilt as 'left' | 'right' | 'even']
    }
    return Math.abs(th - target) > 0.0005 || Math.abs(om) > 0.0005 || Math.abs(coins - want) > 0.01
  }

  // ── drawing
  pit.paintFn = (g) => {
    const pal = pit.pal
    const sc = pit.view.s
    const [, gy] = pit.toScreen(0, G.base + 18)
    pit.bed(0, { x0: pit.W * 0.04, x1: pit.W * 0.96, y: gy, back: Math.min(50, Heff * 0.1), front: Math.max(10, Math.min(36, pit.H - gy - 4)), rows: ctx.quality === 'low' ? 6 : 9, seed: 12 }, [{ x: pit.view.ox, y: gy, rx: 70 * sc }])
    pit.worldTx(g)
    drawScale(g, pal)
  }

  function drawScale(g: CanvasRenderingContext2D, pal: typeof pit.pal) {
    const ink = pal.ink
    const stoneC = pal.dark ? pal.stone : pal.stone2
    // base stone and its shadow
    wash(g, 0, G.base + 18, 92, 12, pal.dark ? pal.paper : ink, pal.dark ? 0.5 : 0.18, 0.4)
    g.fillStyle = col(stoneC, 1)
    g.beginPath()
    g.ellipse(0, G.base + 6, 62, 15, 0, Math.PI, 0)
    g.lineTo(62, G.base + 12)
    g.ellipse(0, G.base + 12, 62, 8, 0, 0, Math.PI)
    g.closePath()
    g.fill()
    g.fillStyle = col(pal.dark ? pal.stone3 : pal.stone3, 0.9)
    g.beginPath()
    g.ellipse(-8, G.base - 2, 40, 5, 0, 0, Math.PI * 2)
    g.fill()
    // post
    g.fillStyle = col(ink, pal.dark ? 0.75 : 0.88)
    brush(g, [[0, G.base], [1, G.base * 0.5], [0, 0]], 9, { head: 0.05, tail: 0.15, min: 0.55, wob: 0.06, seed: 3 })
    // coins: the bill
    drawCoins(g, pal)
    // beam
    const ca = Math.cos(th), sa = Math.sin(th)
    const L = G.L + 6
    g.fillStyle = col(ink, pal.dark ? 0.85 : 0.92)
    brush(g, [[-L * ca, -L * sa], [-L * 0.5 * ca, -L * 0.5 * sa], [0, 0], [L * 0.5 * ca, L * 0.5 * sa], [L * ca, L * sa]], 10, { head: 0.08, tail: 0.25, min: 0.45, wob: 0.05, seed: 5 })
    // stems and dishes
    for (let i = 0; i < 2; i++) {
      const r = rimAt(i)
      g.fillStyle = col(ink, pal.dark ? 0.8 : 0.9)
      brush(g, [[r.x, r.y + G.stem], [r.x, r.y + G.ry + 2]], 6, { head: 0.1, tail: 0.2, min: 0.6, wob: 0.03, seed: 8 + i })
      drawDish(g, pal, r.x, r.y)
    }
    // pivot
    g.fillStyle = col(ink, 1)
    g.beginPath()
    g.arc(0, 0, 8.5, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = col(pal.paper, 1)
    g.beginPath()
    g.arc(0, 0, 3, 0, Math.PI * 2)
    g.fill()
  }

  function drawDish(g: CanvasRenderingContext2D, pal: typeof pit.pal, x: number, y: number) {
    const { rx, ry } = G
    const t = 8
    const ic = pal.dark ? mix(pal.paper2, pal.stone3, 0.6) : mix(pal.stone3, pal.paper2, 0.3)
    g.fillStyle = col(ic, 0.9)
    g.beginPath()
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI)
    g.closePath()
    g.fill()
    const body = pal.dark ? mix(pal.stone, pal.ink3, 0.35) : pal.ink2
    g.fillStyle = col(body, 0.96)
    g.beginPath()
    g.ellipse(x, y, rx + t, ry + t, 0, 0, Math.PI)
    g.ellipse(x, y, rx, ry, 0, Math.PI, 0, true)
    g.closePath()
    g.fill()
    for (const sx of [-1, 1]) {
      g.beginPath()
      g.ellipse(x + sx * (rx + t / 2), y, t / 2 + 1, t * 0.32, 0, 0, Math.PI * 2)
      g.fill()
    }
    const sheen: Pt[] = []
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI * (0.6 + k * 0.035)
      sheen.push([x + Math.cos(a) * (rx + t * 0.5), y + Math.sin(a) * (ry + t * 0.5)])
    }
    g.fillStyle = col(pal.dark ? pal.ink : pal.card, pal.dark ? 0.16 : 0.24)
    brush(g, sheen, t * 0.35, { head: 0.2, tail: 0.6, seed: 4 })
  }

  function drawCoins(g: CanvasRenderingContext2D, pal: typeof pit.pal) {
    const n = Math.floor(coins)
    const frac = coins - n
    const cx = G.L * 0.5, base = G.base + 14
    const r = rng(77)
    const face = pal.dark ? mix(pal.stone, pal.ink3, 0.4) : mix(pal.stone2, pal.stone, 0.35)
    const rim = pal.dark ? pal.stone3 : pal.ink3
    const coin = (x: number, y: number, top: boolean, a = 1) => {
      g.fillStyle = col(rim, 0.9 * a)
      g.beginPath()
      g.ellipse(x, y + 2.2, 17, 5.2, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = col(face, a)
      g.beginPath()
      g.ellipse(x, y, 17, 5.2, 0, 0, Math.PI * 2)
      g.fill()
      if (top) {
        g.fillStyle = col(pal.dark ? pal.paper2 : pal.paper, a)
        g.beginPath()
        g.moveTo(x - 4, y)
        g.lineTo(x, y - 1.6)
        g.lineTo(x + 4, y)
        g.lineTo(x, y + 1.6)
        g.closePath()
        g.fill()
      }
    }
    if (n || frac) wash(g, cx, base + 3, 30, 6, pal.dark ? pal.paper : pal.ink, pal.dark ? 0.4 : 0.14, 0.4)
    const offs: number[] = []
    for (let i = 0; i < n + 1; i++) offs.push((r() - 0.5) * 3.2)
    for (let i = 0; i < n; i++) coin(cx + offs[i], base - i * 4.4, i === n - 1)
    if (frac > 0.02 && !ctx.reduced) coin(cx + offs[n], base - n * 4.4 - (1 - frac) * 60, true, Math.min(1, frac * 3))
  }

  // ── actions
  const drop = (i: number, text: string, kind: Kind, done?: () => void) => {
    const toks = tokenize(text)
    const sen = sentence(toks, 't4-sent--pan')
    hosts[i].replaceChildren(sen.el)
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(sen.el, { opacity: 0, filter: 'blur(6px)', y: 6 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.9, ease: 'power3.out' }))
    const go = () => {
      const p = rimAt(i)
      pit.shatter(sen.spans, toks, kind, {
        font: port ? 16 : 14,
        id: false,
        cat: CAT.a,
        mask: MASK,
        frame: frames[i],
        stagger: 0.045,
        maxW: G.rx * 1.75,
        cx: p.x,
        place: (x, y) => [x - frames[i].x, y - frames[i].y],
        onStone: (st) => (pans[i].push(st), st.inner.setAttribute('aria-hidden', 'true')),
      })
      ctx.anim(() => gsap.delayedCall(ctx.reduced ? 0 : toks.length * 0.045 + 1.3, () => (sen.el.remove(), done?.())))
    }
    if (ctx.reduced) {
      go()
      done?.()
    } else ctx.anim(() => gsap.delayedCall(0.6, () => crackIn(ctx, sen.cracks, go)))
    pit.wake(4000)
  }

  const sheetDrop = () => {
    const sheet = h('div', { class: 't4-sheet', 'aria-hidden': 'true' }, h('p', { class: 't4-sheet-t' }, c.docTitle), ...Array.from({ length: 6 }, (_, k) => h('span', { class: 't4-sheet-l', style: `width:${[92, 80, 88, 64, 86, 50][k]}%` })))
    hosts[0].replaceChildren(sheet)
    const crumble = () => {
      const rr = pit.root.getBoundingClientRect()
      const b = sheet.getBoundingClientRect()
      const n = ctx.quality === 'low' ? 24 : 38
      pebbleW = DOC / n
      const r = rng(5)
      for (let k = 0; k < n; k++) {
        const make = () => {
          const [x, y] = pit.toWorld(b.left - rr.left + b.width * (0.12 + r() * 0.76), b.top - rr.top + b.height * (0.15 + r() * 0.7))
          const lim = G.rx * 0.8
          const p = rimAt(0)
          const st = pit.addStone(null, 'pebble', clamp(x, p.x - lim, p.x + lim) - frames[0].x, y - frames[0].y, { size: 11 + r() * 5, cat: CAT.a, mask: MASK, frame: frames[0] })
          st.inner.setAttribute('aria-hidden', 'true')
          pans[0].push(st)
        }
        if (ctx.reduced) make()
        else ctx.anim(() => gsap.delayedCall(k * 0.022, make))
      }
      if (ctx.reduced) {
        sheet.remove()
        pit.settle()
      } else
        ctx.anim(() => gsap.to(sheet, { opacity: 0, scale: 0.94, filter: 'blur(4px)', duration: 0.9, ease: 'power2.in', onComplete: () => void setTimeout(() => sheet.remove()) }))
      pit.wake(4000)
    }
    if (ctx.reduced) crumble()
    else ctx.anim(() => gsap.fromTo(sheet, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', onComplete: () => void setTimeout(() => ctx.anim(() => gsap.delayedCall(0.5, crumble))) }))
  }

  const settleSoon = () => {
    if (ctx.reduced) pit.settle()
    pit.wake(4500)
  }

  askBtn.addEventListener('click', () => {
    if (asked) return
    asked = true
    askBtn.disabled = true
    ctx.chime('tap')
    drop(0, c.question, 'stone', () => {
      ansBtn.disabled = false
    })
    settleSoon()
  })
  docBtn.addEventListener('click', () => {
    if (docDone) return
    docDone = true
    docBtn.disabled = true
    ctx.chime('tap')
    sheetDrop()
    settleSoon()
    resetBtn.hidden = !(asked && answered)
  })
  ansBtn.addEventListener('click', () => {
    if (!asked || answered) return
    answered = true
    ansBtn.disabled = true
    ctx.chime('tap')
    drop(1, c.reply, 'ink', () => {
      resetBtn.hidden = false
      if (!told) {
        told = true
        ctx.anim(() => gsap.delayedCall(ctx.reduced ? 0 : 0.8, () => (ctx.insight(c.insight, c.detail), ctx.chime('ok'))))
      }
    })
    settleSoon()
  })
  resetBtn.addEventListener('click', () => {
    resetBtn.hidden = true
    const all = [...pans[0], ...pans[1]]
    pans[0] = []
    pans[1] = []
    pit.sink(all, () => {
      asked = answered = docDone = false
      askBtn.disabled = docBtn.disabled = false
      ansBtn.disabled = true
      lastTilt = ''
      pit.wake(3000)
    })
    pit.wake(3000)
  })

  afterFonts(ctx, () => pit.resizeFn())
  ctx.prompt(c.prompt)
}
