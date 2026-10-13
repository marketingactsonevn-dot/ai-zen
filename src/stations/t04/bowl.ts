import Matter from 'matter-js'
import { fill, h } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { tokenize, type Tok } from './tokenizer'
import { brush, col, mix, rng, wash, type Pt } from './ink'
import { CAT, Pit, afterFonts, clamp, crackIn, footReserve, sentence, type Stone } from './pit'

const { Body, Sleeping } = Matter

export interface BowlCopy {
  prompt: string
  send: string
  again: string
  sizeAria: string
  sizes: { id: string; label: string; aria: string }[]
  you: string
  ai: string
  messages: { who: 'you' | 'ai'; text: string }[]
  name: string
  forgot: string
  remember: string
  fill: string
  million: string
  outside: string
  liveMsg: string
  liveOut: string
  art: string
  pages: Fact
  windowFact: Fact
  insight: string | Fact
  detail: string | Fact
}

type Mode = 's' | 'l' | 'm'
/** bowl inner half-width / depth (world units) and how many tokens it holds — illustrative sizes */
const SIZES: Record<Mode, { land: [number, number]; port: [number, number]; short: [number, number]; cap: number }> = {
  s: { land: [205, 140], port: [160, 175], short: [270, 100], cap: 20 },
  l: { land: [380, 268], port: [290, 350], short: [500, 190], cap: 70 },
  m: { land: [2400, 620], port: [1250, 700], short: [2400, 520], cap: 1e6 },
}
const T = 24 // physical wall thickness
const IN_MASK = CAT.ground | CAT.wall | CAT.c | CAT.a
const OUT_MASK = CAT.ground | CAT.wall | CAT.c | CAT.b
/** how many forgotten stones stay visible on the sand (the name always stays) */
const KEEP_OUT = 8

interface Entry {
  tok: Tok
  who: 'you' | 'ai'
  key: boolean
  st: Stone | null
  out: boolean
}

/** Scene 3: the conversation drops into a stone bowl; when it is full, the oldest stones roll out over the rim. */
export function mountBowl(ctx: SceneCtx, c: BowlCopy) {
  const pit = new Pit(ctx, 't4-s3')
  const reserve = footReserve(ctx, [c.insight])
  const desc = h('p', { class: 'visually-hidden' }, c.art)
  const seg = h('div', { class: 'seg t4-seg', role: 'group', 'aria-label': c.sizeAria })
  const segBtns = c.sizes.map((z) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(z.id === 's'), 'aria-label': z.aria }, z.label)
    b.addEventListener('click', () => setMode(z.id as Mode))
    seg.append(b)
    return b
  })
  const sendBtn = h('button', { class: 't4-send', type: 'button' }, c.send)
  const bar = h('div', { class: 't4-bar' }, seg, sendBtn)
  const who = h('span', { class: 't4-who' })
  const msgHost = h('div', { class: 't4-msg-sent' })
  const msg = h('div', { class: 't4-msg' }, who, msgHost)
  const meterText_ = h('span', { 'aria-live': 'polite' })
  const meter = h('p', { class: 't4-meter' }, meterText_, ' ', ctx.tag('illustration'))
  const outLabel = h('p', { class: 't4-outlabel', 'aria-hidden': 'true' }, c.outside)
  outLabel.hidden = true
  const million = h('div', { class: 't4-million' }, ctx.fact(c.pages, 'p', 't4-pages'), ctx.fact(c.windowFact, 'p', 't4-wfact'))
  million.hidden = true
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  pit.root.append(desc, bar, msg, meter, outLabel, million, live)
  pit.layer.setAttribute('aria-hidden', 'true')

  let mode: Mode = 's'
  let port = false
  let short = false
  let step = 0
  let busy = false
  let answered = false
  let told = false
  let outN = 0
  let entries: Entry[] = []
  let statics: Matter.Body[] = []
  let Heff = 300
  let fallT = 0
  let pending = 0
  const geo = { rx: 178, ry: 124, foot: 14, ground: 152, side: 150 }

  const dims = (m: Mode) => {
    const [rx, ry] = port ? SIZES[m].port : short ? SIZES[m].short : SIZES[m].land
    const foot = m === 'm' ? ry * 0.04 : 14
    return { rx, ry, foot, ground: ry + T + foot, side: m === 'm' ? 0 : port ? 74 : 150 }
  }
  const topZone = () => {
    if (short) return bar.offsetHeight + 8
    const fs = parseFloat(getComputedStyle(msg).getPropertyValue('--fs')) || 24
    return bar.offsetHeight + 14 + fs * 1.5 + 22
  }
  const fitView = (m: Mode) => {
    const d = dims(m)
    const sw = (pit.W * 0.96) / (2 * (d.rx + T) + 2 * d.side)
    const groundY = Heff - (short ? 14 : Math.max(16, Heff * (port ? 0.12 : 0.07)))
    const sh = (groundY - topZone() - 26) / (d.ground + 34)
    const sc = clamp(Math.min(sw, sh), 0.03, 1.65)
    return { s: sc, ox: pit.W / 2 + (port ? 0 : d.side * sc * 0.5), oy: groundY - d.ground * sc }
  }

  // the bowl: a chain of static boxes along the inner curve; the sand floor; walls at the view edges
  const build = () => {
    pit.removeBodies(statics)
    const d = dims(mode)
    Object.assign(geo, d)
    const pts: [number, number][] = []
    const n = mode === 'm' ? 56 : 30
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI
      pts.push([-d.rx * Math.cos(a), d.ry * Math.sin(a)])
    }
    statics = pit.chain(pts, T, CAT.c)
    const v = fitView(mode)
    const half = pit.W / 2 / v.s
    statics.push(pit.box(0, d.ground + 50, half * 2 + 4000, 100))
    statics.push(pit.box(-half - 40, 0, 80, 6000, 0, CAT.wall), pit.box(half + 40, 0, 80, 6000, 0, CAT.wall))
  }

  pit.resizeFn = () => {
    Heff = Math.max(100, pit.H - reserve())
    const was = `${port}${short}`
    port = pit.W / Heff < 0.95
    short = !port && Heff < 300
    pit.root.classList.toggle('is-short', short)
    const fs = short ? 16 : clamp(Math.min(pit.W * (port ? 0.06 : 0.03), Heff * 0.065), 17, 34)
    msg.style.setProperty('--fs', `${fs}px`)
    if (short) Object.assign(msg.style, { top: '0px', height: `${bar.offsetHeight}px`, left: `${seg.offsetWidth + 10}px`, right: `${sendBtn.offsetWidth + 10}px` })
    else Object.assign(msg.style, { top: `${bar.offsetHeight + 14}px`, height: '', left: '', right: '' })
    if (was !== `${port}${short}` && entries.length) {
      build()
      pit.setView(fitView(mode))
      replay()
    } else {
      build()
      pit.setView(fitView(mode))
    }
    placeLabels()
    pit.wake(60)
  }

  const placeLabels = () => {
    msg.style.paddingLeft = short ? '' : `${Math.max(0, 2 * (pit.view.ox - pit.W / 2))}px`
    const [, gy] = pit.toScreen(0, geo.ground)
    meter.style.top = short ? `${gy - 22}px` : `${gy + 6}px`
    meter.classList.toggle('is-side', short)
    if (mode === 'm') {
      const [, rimTop] = pit.toScreen(0, -geo.rx * 0.1 - 20)
      const msgBottom = msg.offsetTop + (msg.hidden ? 0 : msg.offsetHeight)
      million.style.top = `${Math.max(msgBottom + 8, (msgBottom + rimTop) / 2 - million.offsetHeight / 2)}px`
    }
    const [lx] = pit.toScreen(-(geo.rx + T), 0)
    outLabel.classList.toggle('is-port', port)
    outLabel.style.left = port ? '50%' : ''
    outLabel.style.right = port ? '' : `${pit.W - lx + 14}px`
    outLabel.style.top = `${short ? gy - 60 * pit.view.s - 26 : gy + (port ? 26 : 8)}px`
  }

  const meterText = () => {
    const n = entries.filter((e) => !e.out).length
    meterText_.textContent = fill(c.fill, { n, cap: mode === 'm' ? c.million : SIZES[mode].cap })
  }

  // ── drawing: the bowl's inside and far rim behind the stones; its translucent front over them
  const look = (sc: number) => {
    const { rx, ry, ground } = geo
    const t = mode === 'm' ? 13 / sc : 17
    const k = mode === 'm' ? 0.1 : 0.17
    return { rx, ry, ground, t, rr: rx * k, ro: rx * k + t * 0.4 }
  }
  /** light: an ink-wash bowl; dark: matte stoneware under moonlight — warm grey glaze, lip lit from the upper left */
  const tones = () => {
    const p = pit.pal
    return p.dark
      ? { body: mix(p.stone2, p.stone, 0.3), lip: mix(p.stone, p.ink3, 0.2), deep: mix(p.paper, p.stone3, 0.5) }
      : { body: p.ink2, lip: p.ink2, deep: p.ink }
  }
  const lipFill = (g: CanvasRenderingContext2D, rx: number, a: number) => {
    const { body, lip } = tones()
    if (!pit.pal.dark) return col(body, a)
    const gr = g.createLinearGradient(-rx, 0, rx, 0)
    gr.addColorStop(0, col(lip, a))
    gr.addColorStop(0.45, col(mix(lip, body, 0.55), a))
    gr.addColorStop(1, col(mix(body, tones().deep, 0.3), a))
    return gr
  }
  pit.paintFn = (g) => {
    const pal = pit.pal
    const sc = pit.view.s
    const [, gy] = pit.toScreen(0, geo.ground)
    const outs = entries.filter((e) => e.out && e.st).map((e) => e.st!)
    const rings = pit.ringsOn(geo.ground, outs, 14).map((r) => ({ x: pit.view.ox + r.x * sc, y: gy, rx: r.rx * sc }))
    pit.bed(0, { x0: pit.W * 0.01, x1: pit.W * 0.99, y: gy, back: Math.min(Heff * 0.14, 70), front: Math.max(10, pit.H - gy - 2), rows: ctx.quality === 'low' ? 7 : 11, seed: 9 }, rings)
    pit.worldTx(g)
    const { rx, ry, ground, t, rr, ro } = look(sc)
    // contact shadow
    wash(g, 0, ground, rx * 0.62, Math.max(8, rx * 0.08), pal.dark ? pal.paper : pal.ink, pal.dark ? 0.6 : 0.22, 0.4)
    // inside of the bowl: far wall in soft shade, the floor a touch lighter
    const ins = g.createLinearGradient(0, -rr, 0, ry)
    const shade = pal.dark ? pal.stone3 : pal.stone2
    ins.addColorStop(0, col(shade, pal.dark ? 0.95 : 0.85))
    ins.addColorStop(0.5, col(shade, pal.dark ? 0.6 : 0.5))
    ins.addColorStop(1, col(shade, pal.dark ? 0.85 : 0.75))
    g.fillStyle = ins
    g.beginPath()
    g.ellipse(0, 0, rx, rr, 0, Math.PI, Math.PI * 2)
    g.ellipse(0, 0, rx, ry, 0, 0, Math.PI)
    g.fill()
    // moonlight falls on the inner far wall, opposite the lit shoulder
    if (pal.dark) wash(g, rx * 0.3, -rr * 0.15, rx * 0.55, rr * 0.8, pal.ink, 0.05, 0.2)
    // far rim: the lip seen from above
    g.fillStyle = lipFill(g, rx + t, 1)
    g.beginPath()
    g.ellipse(0, 0, rx + t, ro, 0, Math.PI, Math.PI * 2)
    g.ellipse(0, 0, rx, rr, 0, Math.PI * 2, Math.PI, true)
    g.fill()
    pit.shadows(g, outs)
  }

  pit.withFront((g) => {
    const pal = pit.pal
    const sc = pit.view.s
    pit.worldTx(g)
    const { rx, ry, ground, t, rr, ro } = look(sc)
    const dk = pal.dark
    const { body, deep } = tones()
    const R = rx + t
    // the front of the bowl: a thin glaze you can see the stones through
    const face = g.createLinearGradient(0, 0, 0, ry + t)
    face.addColorStop(0, col(body, dk ? 0.36 : 0.2))
    face.addColorStop(0.55, col(body, dk ? 0.5 : 0.34))
    face.addColorStop(1, col(deep, dk ? 0.9 : 0.72))
    g.fillStyle = face
    g.beginPath()
    g.ellipse(0, 0, R, ro, 0, Math.PI, 0, true)
    g.ellipse(0, 0, R, ry + t, 0, 0, Math.PI)
    g.fill()
    if (dk) {
      // glaze that ran unevenly down the wall, and moonlight resting softly on the left shoulder — matte, no gloss
      g.save()
      g.clip()
      const r = rng(17)
      for (let i = 0; i < 7; i++) {
        const x = (-0.84 + (i / 6) * 1.68 + (r() - 0.5) * 0.1) * rx
        const y1 = (ry + t) * Math.sqrt(Math.max(0, 1 - (x / R) ** 2)) * (0.45 + r() * 0.4)
        g.fillStyle = i % 2 ? col(deep, 0.18) : col(pal.ink, 0.03)
        brush(g, [[x, ro * (0.3 + r() * 0.5)], [x * 0.99, y1 * 0.55], [x * 0.96, y1]], t * (0.9 + r() * 0.9), { head: 0.08, tail: 0.9, min: 0.2, wob: 0.3, seed: i + 4 })
      }
      wash(g, -rx * 0.52, ry * 0.32, rx * 0.42, ry * 0.5, pal.ink, 0.075, 0.15)
      g.restore()
    }
    // front lip
    g.fillStyle = lipFill(g, R, 0.96)
    g.beginPath()
    g.ellipse(0, 0, R, ro, 0, Math.PI, 0, true)
    g.ellipse(0, 0, rx, rr, 0, 0, Math.PI)
    g.fill()
    if (dk) {
      // a darker iron line where the lip turns into the wall
      const edge: Pt[] = []
      for (let i = 0; i <= 16; i++) edge.push([Math.cos((Math.PI * i) / 16) * R, Math.sin((Math.PI * i) / 16) * ro])
      g.fillStyle = col(deep, 0.85)
      brush(g, edge, Math.max(1.6, t * 0.24), { head: 0.06, tail: 0.3, min: 0.4, wob: 0.2, seed: 8 })
    }
    // glaze light along the lip
    const lip: Pt[] = []
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * (0.18 + i * 0.045)
      lip.push([Math.cos(a) * (rx + t * 0.5), Math.sin(a) * (rr + t * 0.2)])
    }
    g.fillStyle = col(dk ? pal.ink : pal.card, dk ? 0.13 : 0.42)
    brush(g, dk ? lip.slice(0, 9) : lip, t * (dk ? 0.2 : 0.28), { head: 0.25, tail: 0.5, seed: 6 })
    // brush contour of the outer wall, heavier toward the foot
    const wall: Pt[] = []
    for (let i = 0; i <= 18; i++) {
      const a = Math.PI * (1 - i / 18)
      wall.push([Math.cos(a) * (rx + t), Math.sin(a) * (ry + t)])
    }
    g.fillStyle = col(deep, 0.85)
    brush(g, wall, Math.max(3, t * 0.42), { head: 0.06, tail: 0.3, min: 0.18, wob: 0.18, seed: 3 })
    // a dry sheen on the left shoulder (light only: under the moon it read as plastic)
    if (!dk) {
      const sheen: Pt[] = []
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * (0.66 + i * 0.022)
        sheen.push([Math.cos(a) * (rx + t * 0.45), Math.sin(a) * (ry + t * 0.45)])
      }
      g.fillStyle = col(pal.card, 0.3)
      brush(g, sheen, t * 0.3, { head: 0.2, tail: 0.6, seed: 2 })
    }
    // foot ring
    const fw = Math.min(rx * 0.32, 90 / sc)
    g.fillStyle = col(dk ? mix(body, deep, 0.45) : deep, 0.95)
    g.beginPath()
    g.moveTo(-fw, ry + t * 0.7)
    g.quadraticCurveTo(0, ry + t * 1.05, fw, ry + t * 0.7)
    g.lineTo(fw * 0.9, ground)
    g.lineTo(-fw * 0.9, ground)
    g.closePath()
    g.fill()
  })

  // ── conversation
  function showLine(whoKey: 'you' | 'ai', text: string, answer = false) {
    who.textContent = whoKey === 'you' ? c.you : c.ai
    who.className = `t4-who t4-who--${whoKey}`
    const toks = tokenize(text)
    const sen = sentence(toks, `t4-sent--msg${answer ? ' is-answer' : ''}`)
    msgHost.replaceChildren(sen.el)
    msg.hidden = false
    live.textContent = fill(c.liveMsg, { who: who.textContent, text })
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(msg, { opacity: 0, filter: 'blur(6px)', y: 6 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.9, ease: 'power3.out' }))
    return { toks, sen }
  }
  const clearLine = () => {
    if (ctx.reduced) return
    ctx.anim(() => gsap.to(msg, { opacity: 0, duration: 0.6, onComplete: () => void (msg.hidden = true) }))
  }

  const setBusy = (b: boolean) => {
    busy = b
    sendBtn.disabled = b
    segBtns.forEach((x) => (x.disabled = b))
  }

  function makeStone(e: Entry, x: number, y: number, out: boolean) {
    const st = pit.addStone(e.tok, e.who === 'ai' ? 'moss' : 'stone', x, y, { font: 20, id: false, cat: out ? CAT.b : CAT.a, mask: out ? OUT_MASK : IN_MASK, ground: out ? geo.ground : undefined })
    if (e.key) st.inner.classList.add('is-key')
    if (out) st.el.classList.add('is-out')
    st.inner.setAttribute('aria-hidden', 'true')
    e.st = st
    return st
  }

  function send() {
    if (busy) return
    if (answered) return restart()
    if (step >= c.messages.length) return
    setBusy(true)
    const m = c.messages[step++]
    const { toks, sen } = showLine(m.who, m.text)
    const fresh: Entry[] = toks.map((tok) => ({ tok, who: m.who, key: tok.t === c.name && step === 1, st: null, out: false }))
    ctx.chime('tap')
    const begin = () => {
      const inside = entries.filter((e) => !e.out)
      const excess = Math.max(0, inside.length + fresh.length - SIZES[mode].cap)
      if (excess) lift(inside.slice(0, excess))
      const fall = () => {
        fallT = performance.now()
        pending = fresh.length
        pit.shatter(sen.spans, toks, m.who === 'ai' ? 'moss' : 'stone', {
          font: 20,
          id: false,
          cat: CAT.a,
          mask: IN_MASK,
          maxW: Math.min(geo.rx * 1.55, 640),
          cx: 0,
          stagger: 0.05,
          onStone: (st, i) => {
            const e = fresh[i]
            e.st = st
            if (e.key) st.inner.classList.add('is-key')
            st.inner.setAttribute('aria-hidden', 'true')
            pending--
            if (!pending) clearLine()
          },
        })
        entries.push(...fresh)
        meterText()
        // without motion the line simply stays written above the bowl
        if (ctx.reduced) {
          sen.spans.forEach((sp) => (sp.style.visibility = ''))
          sen.cracks.forEach((cr) => (cr.style.visibility = 'hidden'))
        }
      }
      if (excess && !ctx.reduced) ctx.anim(() => gsap.delayedCall(0.6, fall))
      else fall()
      if (ctx.reduced) done()
    }
    if (ctx.reduced) begin()
    else ctx.anim(() => gsap.delayedCall(0.4, () => crackIn(ctx, sen.cracks, begin)))
  }

  /** The oldest stones are lifted, roll over the rim and come to rest on the sand outside — out of sight for the AI. */
  function lift(list: Entry[]) {
    list.forEach((e) => (e.out = true))
    live.textContent = fill(c.liveOut, { n: list.length })
    entries.filter((e) => !e.out && e.st).forEach((e) => Sleeping.set(e.st!.body, false))
    list.forEach((e, i) => {
      const st = e.st
      if (!st) return
      const side = port ? (i % 2 ? 1 : -1) : -1
      const b = st.body
      const land = () => {
        Body.setStatic(b, false)
        Sleeping.set(b, false)
        b.collisionFilter.category = CAT.b
        b.collisionFilter.mask = OUT_MASK
        Body.setVelocity(b, { x: side * 2.2, y: 0.4 })
        Body.setAngularVelocity(b, side * 0.05)
        st.ground = geo.ground
        st.inner.classList.remove('is-leaving')
        st.el.classList.add('is-out')
        tidy()
      }
      if (ctx.reduced) {
        const k = outN++
        Body.setPosition(b, { x: side * (geo.rx + T + 40 + (k % 5) * 50), y: geo.ground - st.h - Math.floor((k % 15) / 5) * 40 })
        Body.setAngle(b, 0)
        Sleeping.set(b, false)
        b.collisionFilter.category = CAT.b
        b.collisionFilter.mask = OUT_MASK
        st.ground = geo.ground
        st.el.classList.add('is-out')
        return
      }
      Body.setStatic(b, true)
      b.collisionFilter.mask = 0
      pit.layer.append(st.el)
      st.inner.classList.add('is-leaving')
      const p0 = { x: b.position.x, y: b.position.y }
      const a0 = b.angle
      const up = -(st.h * 1.25 + 18)
      const p1 = { x: p0.x * 0.5, y: up }
      const p2 = { x: side * geo.rx * 0.95, y: up }
      const p3 = { x: side * (geo.rx + T + st.w * 0.55 + 6 + (i % 3) * 10), y: -st.h * 0.4 }
      const o = { t: 0 }
      ctx.anim(() => {
        gsap.to(o, {
          t: 1, duration: 1.15, delay: i * 0.1, ease: 'power1.inOut',
          onUpdate: () => {
            const t = o.t, u = 1 - t
            const x = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x
            const y = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
            Body.setPosition(b, { x, y })
            Body.setAngle(b, a0 + side * t * 1.8)
          },
          onComplete: () => void setTimeout(land),
        })
      })
      pit.wake(1400 + i * 100)
    })
    if (ctx.reduced) (pit.settle(), tidy())
    if (list.length && outLabel.hidden) {
      outLabel.hidden = false
      if (!ctx.reduced) ctx.anim(() => gsap.fromTo(outLabel, { opacity: 0 }, { opacity: 1, duration: 1.2, delay: 1.6 }))
    }
    if (list.length && mode !== 'm') tell()
  }

  /** keep the sand calm: only the latest forgotten stones (and the name) stay; older ones sink into the sand */
  const tidy = () => {
    const outs = entries.filter((e) => e.out && e.st && !e.key && !e.st.body.isStatic)
    if (outs.length <= KEEP_OUT) return
    const gone = outs.slice(0, outs.length - KEEP_OUT)
    const sts = gone.map((e) => e.st as Stone)
    gone.forEach((e) => (e.st = null))
    pit.sink(sts)
  }

  const tell = () => {
    if (told) return
    told = true
    ctx.insight(c.insight, c.detail)
  }

  pit.frameFn = () => {
    if (!busy || !fallT) return false
    const t = performance.now() - fallT
    const settled = pending <= 0 && pit.calm(entries.filter((e) => e.st && !e.out).map((e) => e.st as Stone), 0.5)
    if ((settled && t > 1300) || t > 3400) done()
    return true
  }

  function done() {
    fallT = 0
    meterText()
    if (step >= c.messages.length && !answered) {
      answered = true
      const key = entries.find((e) => e.key)
      const forgot = !!key?.out
      const delay = ctx.reduced ? 0 : 0.6
      ctx.anim(() =>
        gsap.delayedCall(delay, () => {
          showLine('ai', forgot ? c.forgot : c.remember, true)
          if (forgot && key?.st) key.st.inner.classList.add('is-sought')
          ctx.chime(forgot ? 'low' : 'ok')
          tell()
          sendBtn.textContent = c.again
          setBusy(false)
        }),
      )
      return
    }
    setBusy(false)
  }

  function restart() {
    answered = false
    step = 0
    setBusy(true)
    if (ctx.reduced) msg.hidden = true
    else clearLine()
    outLabel.hidden = true
    sendBtn.textContent = c.send
    const all = entries.filter((e) => e.st).map((e) => e.st as Stone)
    entries = []
    meterText()
    pit.sink(all, () => setBusy(false))
  }

  /** rebuild the conversation in the current bowl: what fits rains in, the rest already lies outside */
  function replay() {
    const old = entries.filter((e) => e.st).map((e) => e.st as Stone)
    old.forEach((st) => pit.removeStone(st))
    const keepN = SIZES[mode].cap
    const firstIn = Math.max(0, entries.length - keepN)
    entries.forEach((e, i) => (e.out = i < firstIn))
    const outs = entries.filter((e) => e.out)
    const shown = new Set([...outs.slice(-KEEP_OUT), ...outs.filter((e) => e.key)])
    let ox = 0
    entries.forEach((e, i) => {
      if (e.out) {
        e.st = null
        if (!shown.has(e)) return
        const side = port ? (ox % 2 ? 1 : -1) : -1
        makeStone(e, side * (geo.rx + T + 40 + (ox % 4) * 50), geo.ground - 50 - Math.floor(ox / 4) * 40, true)
        ox++
      } else {
        const k = i - firstIn
        const per = clamp(Math.floor((geo.rx * 1.3) / 52), 3, 9)
        const x = ((k % per) - (per - 1) / 2) * 52 + ((Math.floor(k / per) % 2) * 14)
        makeStone(e, x, -40 - Math.floor(k / per) * 40 - (mode === 'm' ? 200 : 0), false)
      }
    })
    outLabel.hidden = !entries.some((e) => e.out)
    meterText()
    if (ctx.reduced) pit.settle()
    else {
      fallT = performance.now()
      pending = 0
      setBusy(true)
      pit.wake(1500)
    }
    if (answered) {
      const key = entries.find((e) => e.key)
      const forgot = !!key?.out
      showLine('ai', forgot ? c.forgot : c.remember, true)
      if (forgot && key?.st) key.st.inner.classList.add('is-sought')
    }
  }

  function setMode(m: Mode) {
    if (busy || m === mode) return
    mode = m
    segBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(c.sizes[i].id === m)))
    million.hidden = m !== 'm'
    build()
    const target = fitView(m)
    if (ctx.reduced) {
      pit.setView(target)
      replay()
      placeLabels()
      return
    }
    const v = { ...pit.view }
    replay()
    ctx.anim(() => {
      gsap.to(v, {
        ...target, duration: 1.5, ease: 'power3.inOut',
        onUpdate: () => (pit.setView({ ...v }), placeLabels(), pit.paint()),
      })
      if (m === 'm') gsap.fromTo(million, { opacity: 0 }, { opacity: 1, duration: 1.2, delay: 1.1 })
    })
    pit.wake(1700)
  }

  sendBtn.addEventListener('click', send)
  afterFonts(ctx, () => pit.resizeFn())
  meterText()
  msg.hidden = true
  ctx.prompt(c.prompt)
}
