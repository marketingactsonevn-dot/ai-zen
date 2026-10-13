// The token garden: a Matter.js world whose bodies are drawn as DOM stones (crisp serif labels, real focus),
// over a Canvas2D layer for raked sand, shadows and ink props. Shared by every scene of Trạm 4.
import Matter from 'matter-js'
import { gsap } from '../../core/anim'
import { h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import type { Tok } from './tokenizer'
import { readPal, rng, sandBed, wash, type Pal, type Ring } from './ink'

const { Engine, Bodies, Body, Composite, Vertices, Sleeping, Constraint } = Matter
const STEP = 1000 / 60

/** collision categories */
export const CAT = { ground: 0x1, wall: 0x2, a: 0x4, b: 0x8, c: 0x10 }

export type Kind = 'stone' | 'moss' | 'ink' | 'pebble'

export interface Stone {
  tok: Tok | null
  kind: Kind
  body: Matter.Body
  /** positioned wrapper (0×0, follows the body) */
  el: HTMLElement
  /** visible stone (art + label), scaled during the text → stone morph */
  inner: HTMLElement
  art: SVGSVGElement
  w: number
  h: number
  /** display offset added to the body position (the balance pans carry their stones) */
  frame: { x: number; y: number }
  /** world y of the sand the stone rests on (for its shadow), if any */
  ground?: number
  n: number
  last?: string
}

export interface View {
  s: number
  ox: number
  oy: number
}

let mctx: CanvasRenderingContext2D | null = null
export function measure(text: string, px: number, weight = 400) {
  mctx ??= document.createElement('canvas').getContext('2d')
  if (!mctx) return text.length * px * 0.55
  mctx.font = `${weight} ${px}px "Noto Serif", Georgia, serif`
  return mctx.measureText(text).width
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** A river-stone outline: a slightly uneven squircle, flatter underneath so it sits still. Convex. */
function stoneVerts(w: number, hh: number, seed: number) {
  const r = rng(seed)
  const ph = [r() * 6.3, r() * 6.3]
  const pts: Matter.Vector[] = []
  const n = 18
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.09
    const c = Math.cos(a), sn = Math.sin(a)
    const p = 2.7
    const k = 1 + 0.045 * Math.sin(2 * a + ph[0]) + 0.03 * Math.sin(3 * a + ph[1])
    const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / p) * (w / 2) * k
    const y = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / p) * (hh / 2) * k * (sn > 0 ? 0.94 : 1)
    pts.push({ x, y })
  }
  return Vertices.hull(pts as Matter.Vertex[])
}

const f1 = (n: number) => n.toFixed(1)
/** Smooth closed path through the midpoints of a polygon. */
function smoothPath(p: [number, number][]) {
  const n = p.length
  const mid = (a: [number, number], b: [number, number]) => `${f1((a[0] + b[0]) / 2)} ${f1((a[1] + b[1]) / 2)}`
  let d = `M${mid(p[n - 1], p[0])}`
  for (let i = 0; i < n; i++) d += `Q${f1(p[i][0])} ${f1(p[i][1])} ${mid(p[i], p[(i + 1) % n])}`
  return d + 'Z'
}

export interface StoneOpts {
  font?: number
  /** show the ID under the label (default true for text stones) */
  id?: boolean
  size?: number
  cat?: number
  mask?: number
  frame?: { x: number; y: number }
  ground?: number
  seed?: number
  density?: number
}

export class Pit {
  readonly engine = Engine.create({ enableSleeping: true, positionIterations: 8, velocityIterations: 6 })
  readonly root: HTMLElement
  readonly canvas: HTMLCanvasElement
  readonly g: CanvasRenderingContext2D | null
  readonly layer: HTMLElement
  stones: Stone[] = []
  view: View = { s: 1, ox: 0, oy: 0 }
  W = 1
  H = 1
  dpr = 1
  pal: Pal
  /** optional canvas above the stones (e.g. the translucent front of a bowl) */
  front: HTMLCanvasElement | null = null
  frontDirty = true
  frontFn: ((g: CanvasRenderingContext2D, now: number) => void) | null = null
  /** scene paints its canvas here (called every frame while anything moves) */
  paintFn: (g: CanvasRenderingContext2D, now: number) => void = () => {}
  /** scene per-frame hook (dt seconds); return true while it still animates */
  frameFn: (dt: number) => boolean = () => false
  /** scene relayout (art resized) */
  resizeFn: () => void = () => {}
  /** set by a scene when display frames moved: sync every stone this frame */
  forceSync = false
  private raf = 0
  private last = 0
  private acc = 0
  private keep = 0
  private alive = true
  private count = 0
  private grads: Record<Kind, string>
  private drag: Matter.Constraint | null = null
  private beds = new Map<number, { cur: HTMLCanvasElement; old: HTMLCanvasElement; key: string; ring: string; t0: number }>()
  private themeTick = 0
  private offs: (() => void)[] = []

  constructor(readonly ctx: SceneCtx, cls: string) {
    this.engine.gravity.y = 0.62
    this.pal = readPal()
    this.canvas = h('canvas', { class: 't4-canvas', 'aria-hidden': 'true' })
    this.g = this.canvas.getContext('2d')
    this.layer = h('div', { class: 't4-layer' })
    const uid = nextId('t4g')
    this.grads = { stone: `${uid}-s`, moss: `${uid}-m`, ink: `${uid}-i`, pebble: `${uid}-p` }
    const grad = (id: string, k: string) =>
      s('radialGradient', { id, cx: '0.38', cy: '0.3', r: '0.85' }, s('stop', { offset: '0', class: `t4-g0 t4-g--${k}` }), s('stop', { offset: '0.85', class: `t4-g1 t4-g--${k}` }))
    const defs = s('svg', { class: 't4-defs', width: 0, height: 0, 'aria-hidden': 'true' },
      s('defs', null, ...(Object.keys(this.grads) as Kind[]).map((k) => grad(this.grads[k], k))))
    this.root = h('div', { class: `t4-pit ${cls}` }, defs, this.canvas, this.layer)
    ctx.art.append(this.root)
    if (import.meta.env.DEV) (this.root as unknown as { pit: Pit }).pit = this

    const ro = new ResizeObserver(() => this.measure())
    ro.observe(this.root)
    const mo = new MutationObserver(() => this.retheme())
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-garden'] })
    const onVis = () => !document.hidden && this.wake()
    document.addEventListener('visibilitychange', onVis)
    this.offs.push(() => ro.disconnect(), () => mo.disconnect(), () => document.removeEventListener('visibilitychange', onVis))
    ctx.onCleanup(() => this.destroy())
  }

  // ───────── size, view, theme ─────────
  private measure() {
    const r = this.root.getBoundingClientRect()
    this.W = Math.max(1, r.width)
    this.H = Math.max(1, r.height)
    this.dpr = Math.min(devicePixelRatio || 1, this.ctx.quality === 'low' ? 1.25 : 2)
    this.canvas.width = Math.round(this.W * this.dpr)
    this.canvas.height = Math.round(this.H * this.dpr)
    if (this.front) {
      this.frontDirty = true
      this.front.width = this.canvas.width
      this.front.height = this.canvas.height
    }
    this.resizeFn()
    this.applyView()
    this.sync(true)
    this.paint()
  }

  setView(v: View) {
    this.view = v
    this.frontDirty = true
    this.applyView()
  }
  applyView() {
    this.layer.style.transform = `translate(${this.view.ox}px, ${this.view.oy}px) scale(${this.view.s})`
  }
  /** root-relative screen px → world */
  toWorld(x: number, y: number): [number, number] {
    return [(x - this.view.ox) / this.view.s, (y - this.view.oy) / this.view.s]
  }
  toScreen(x: number, y: number): [number, number] {
    return [this.view.ox + x * this.view.s, this.view.oy + y * this.view.s]
  }
  /** set the canvas transform so drawing happens in world units */
  worldTx(g: CanvasRenderingContext2D) {
    const { s: k, ox, oy } = this.view
    g.setTransform(this.dpr * k, 0, 0, this.dpr * k, this.dpr * ox, this.dpr * oy)
  }
  screenTx(g: CanvasRenderingContext2D) {
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }
  private retheme() {
    this.frontDirty = true
    this.pal = readPal()
    this.themeTick++
    this.paint()
  }

  // ───────── loop ─────────
  wake(ms = 0) {
    this.keep = Math.max(this.keep, performance.now() + ms)
    if (!this.raf && this.alive) this.raf = requestAnimationFrame(this.tick)
  }
  private tick = (now: number) => {
    this.raf = 0
    if (!this.alive) return
    // dev-only fast-forward for automated visual checks (window.__t4speed)
    const k = import.meta.env.DEV ? ((window as unknown as { __t4speed?: number }).__t4speed ?? 1) : 1
    const dt = (this.last ? Math.min(64, now - this.last) : STEP) * k
    this.last = now
    this.acc += dt
    let n = 0
    while (this.acc >= STEP && n < 4 * k) {
      Engine.update(this.engine, STEP)
      this.acc -= STEP
      n++
    }
    if (n >= 4 * k) this.acc = 0
    const busy = this.frameFn(dt / 1000)
    this.sync(this.forceSync)
    this.forceSync = false
    this.paint(now)
    const moving = this.drag || this.stones.some((st) => !st.body.isSleeping && !st.body.isStatic)
    // a wake() during this frame may already have queued the next one — never run two loops
    if (this.raf) return
    if (moving || busy || now < this.keep) this.raf = requestAnimationFrame(this.tick)
    else this.last = 0
  }
  /** Nothing in `list` is visibly moving any more (sleeping, static, or barely creeping). */
  calm(list = this.stones, v = 0.3) {
    return list.every((st) => st.body.isSleeping || st.body.isStatic || (st.body.speed < v && st.body.angularSpeed < 0.02))
  }
  /** Reduced motion: run the world to rest at once. */
  settle(max = 900) {
    for (let i = 0; i < max; i++) {
      Engine.update(this.engine, STEP)
      if (i > 30 && this.stones.every((st) => st.body.isSleeping || st.body.isStatic)) break
    }
    this.sync(true)
    this.paint()
  }
  paint(now = performance.now()) {
    const g = this.g
    if (!g) return
    this.screenTx(g)
    g.clearRect(0, 0, this.W, this.H)
    this.paintFn(g, now)
    // the front layer only changes with the view, size or theme — repainting it every frame over moving,
    // composited stones is very costly, so it is redrawn only when marked dirty
    const fg = this.frontDirty ? this.front?.getContext('2d') : null
    if (fg && this.frontFn) {
      this.frontDirty = false
      this.screenTx(fg)
      fg.clearRect(0, 0, this.W, this.H)
      this.frontFn(fg, now)
    }
  }
  /** add a canvas layer above the stones */
  withFront(fn: (g: CanvasRenderingContext2D, now: number) => void) {
    this.front = h('canvas', { class: 't4-canvas t4-front', 'aria-hidden': 'true' })
    this.layer.after(this.front)
    this.frontFn = fn
  }
  sync(force = false) {
    for (const st of this.stones) {
      if (!force && st.body.isSleeping && st.last) continue
      const x = st.body.position.x + st.frame.x
      const y = st.body.position.y + st.frame.y
      const t = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${st.body.angle.toFixed(4)}rad)`
      if (t !== st.last) {
        st.el.style.transform = t
        st.last = t
      }
    }
  }

  // ───────── statics ─────────
  /** an invisible static box (ground, wall, dish segment) */
  box(x: number, y: number, w: number, hh: number, angle = 0, cat = CAT.ground) {
    const b = Bodies.rectangle(x, y, w, hh, { isStatic: true, angle, friction: 0.9, restitution: 0.05, collisionFilter: { category: cat, mask: 0xffff } })
    Composite.add(this.engine.world, b)
    return b
  }
  /** a chain of static boxes whose surface follows pts; the thickness grows to the right of travel (screen y down), e.g. below a curve drawn left → right */
  chain(pts: [number, number][], thick: number, cat = CAT.ground) {
    const out: Matter.Body[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
      const len = Math.hypot(x1 - x0, y1 - y0)
      const a = Math.atan2(y1 - y0, x1 - x0)
      // outward normal (right of travel in screen coords with y down)
      const nx = -Math.sin(a), ny = Math.cos(a)
      out.push(this.box((x0 + x1) / 2 + nx * thick / 2, (y0 + y1) / 2 + ny * thick / 2, len + thick * 0.6, thick, a, cat))
    }
    return out
  }
  removeBodies(bs: Matter.Body[]) {
    bs.forEach((b) => Composite.remove(this.engine.world, b))
  }

  // ───────── stones ─────────
  addStone(tok: Tok | null, kind: Kind, x: number, y: number, o: StoneOpts = {}): Stone {
    const font = o.font ?? 20
    const seed = o.seed ?? (tok ? tok.id : 7) + this.count * 13
    const r = rng(seed)
    let w: number, hh: number
    const withId = kind !== 'pebble' && o.id !== false
    if (kind === 'pebble' || !tok) {
      hh = o.size ?? 14
      w = hh * (1.15 + r() * 0.5)
    } else {
      hh = font * (withId ? 2.05 : 1.7)
      w = Math.max(hh * 1.08, measure(tok.t, font) + font * 1.3)
    }
    const verts = stoneVerts(w, hh, seed)
    const body = Bodies.fromVertices(x, y, [verts], {
      friction: 0.85,
      frictionStatic: 1.1,
      restitution: 0.04,
      frictionAir: 0.016,
      density: o.density ?? 0.002,
      slop: 0.03,
      collisionFilter: { category: o.cat ?? CAT.a, mask: o.mask ?? CAT.ground | CAT.wall | CAT.a },
    })
    ;(body as Matter.Body & { sleepThreshold: number }).sleepThreshold = 45
    Composite.add(this.engine.world, body)
    const rel = body.vertices.map((v) => [v.x - body.position.x, v.y - body.position.y] as [number, number])
    const xs = rel.map((p) => p[0]), ys = rel.map((p) => p[1])
    const bx = Math.min(...xs), by = Math.min(...ys)
    const bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by
    const d = smoothPath(rel)
    const hi = smoothPath(rel.map(([px, py]) => [px * 0.6 - bw * 0.1, py * 0.5 - bh * 0.16]))
    const lowPts = rel.filter(([, py]) => py > bh * 0.12).sort((a, b) => a[0] - b[0])
    const low = lowPts.length > 1 ? `M${lowPts.map(([px, py]) => `${f1(px * 0.86)} ${f1(py - 3)}`).join('L')}` : ''
    const art = s('svg', { class: 't4-st-art', viewBox: `${f1(bx - 2)} ${f1(by - 2)} ${f1(bw + 4)} ${f1(bh + 4)}`, 'aria-hidden': 'true' },
      s('path', { class: 't4-b', d, fill: `url(#${this.grads[kind]})` }),
      s('path', { class: 't4-hi', d: hi }),
      low ? s('path', { class: 't4-lo', d: low }) : null,
      s('path', { class: 't4-rim', d }))
    const inner = h('div', {
      class: `t4-st t4-st--${kind}`,
      style: `left:${f1(bx - 2)}px;top:${f1(by - 2)}px;width:${f1(bw + 4)}px;height:${f1(bh + 4)}px;transform-origin:${f1(-bx + 2)}px ${f1(-by + 2)}px;--f:${font}px`,
    }, art)
    if (tok && kind !== 'pebble') {
      inner.append(h('span', { class: 't4-st-t' }, tok.t))
      if (withId) inner.append(h('span', { class: 't4-st-id' }, String(tok.id)))
    }
    const el = h('div', { class: 't4-st-pos' }, inner)
    this.layer.append(el)
    const st: Stone = { tok, kind, body, el, inner, art, w, h: hh, frame: o.frame ?? { x: 0, y: 0 }, ground: o.ground, n: this.count++ }
    this.stones.push(st)
    this.sync(true)
    this.wake()
    return st
  }

  removeStone(st: Stone) {
    Composite.remove(this.engine.world, st.body)
    st.el.remove()
    this.stones = this.stones.filter((x) => x !== st)
  }

  /** Stones sink into the sand and vanish. */
  sink(list: Stone[], done?: () => void) {
    if (!list.length) return void done?.()
    if (this.ctx.reduced) {
      list.forEach((st) => this.removeStone(st))
      this.paint()
      return void done?.()
    }
    list.forEach((st) => {
      Body.setStatic(st.body, true)
      st.body.collisionFilter.mask = 0
    })
    this.ctx.anim(() => {
      gsap.to(list.map((st) => st.inner), {
        opacity: 0, y: 14, scale: 0.92, filter: 'blur(3px)', duration: 0.7, stagger: 0.015, ease: 'power2.in',
        onComplete: () => void setTimeout(() => {
          list.forEach((st) => this.removeStone(st))
          this.paint()
          done?.()
        }),
      })
    })
    this.wake(900)
  }

  /**
   * Lay text pieces out so their stones never start overlapping: keeps reading order and each line's centre,
   * wraps a line into more rows when it is wider than `maxW` (rows stay centred on `cx` within that width).
   */
  spread(items: { x: number; y: number; w: number; h: number }[], gap = 3, maxW = Infinity, cx = 0) {
    const lines: (typeof items)[] = []
    for (const it of [...items].sort((a, b) => a.y - b.y)) {
      const ln = lines.find((l) => Math.abs(l[0].y - it.y) < it.h * 0.5)
      if (ln) ln.push(it)
      else lines.push([it])
    }
    const rows: (typeof items)[] = []
    for (const ln of lines) {
      ln.sort((a, b) => a.x - b.x)
      const centre = ln.reduce((sum, it) => sum + it.x, 0) / ln.length
      let row: typeof items = []
      let rw = 0
      const flush = () => {
        if (!row.length) return
        let x = 0
        row.forEach((it, i) => ((x += i ? (row[i - 1].w + it.w) / 2 + gap : 0), (it.x = x)))
        const mid = (row[0].x - row[0].w / 2 + row[row.length - 1].x + row[row.length - 1].w / 2) / 2
        const slack = Number.isFinite(maxW) ? Math.max(0, (maxW - rw) / 2) : Infinity
        const want = clamp(centre, cx - slack, cx + slack)
        row.forEach((it) => (it.x += want - mid))
        rows.push(row)
        row = []
        rw = 0
      }
      for (const it of ln) {
        const add = it.w + (row.length ? gap : 0)
        if (row.length && rw + add > maxW) flush()
        row.push(it)
        rw += it.w + (row.length > 1 ? gap : 0)
      }
      flush()
    }
    let prevY = -Infinity, prevH = 0
    for (const row of rows) {
      const lh = Math.max(...row.map((it) => it.h))
      const y = Math.max(row[0].y, prevY + (prevH + lh) / 2 + gap)
      row.forEach((it) => (it.y = y))
      prevY = y
      prevH = lh
    }
  }

  /**
   * The sentence breaks: each token span becomes a stone that starts as the written word and shrinks into
   * its stone while falling. `place` maps the span centre (world) to the body position (e.g. into a pan frame).
   */
  shatter(spans: HTMLElement[], toks: Tok[], kind: Kind | ((t: Tok, i: number) => Kind), o: StoneOpts & { stagger?: number; maxW?: number; cx?: number; place?: (x: number, y: number, i: number) => [number, number]; onStone?: (st: Stone, i: number) => void } = {}) {
    const rr = this.root.getBoundingClientRect()
    const font = o.font ?? 20
    const items = spans.map((sp, i) => {
      const b = sp.getBoundingClientRect()
      const [x, y] = this.toWorld(b.left - rr.left + b.width / 2, b.top - rr.top + b.height / 2)
      const t = toks[i]
      const hh = font * (o.id === false ? 1.7 : 2.05)
      const w = Math.max(hh * 1.08, measure(t.t, font) + font * 1.3)
      return { x, y, w, h: hh, x0: x, y0: y, px: parseFloat(getComputedStyle(sp).fontSize) || font }
    })
    this.spread(items, 3, o.maxW, o.cx)
    const made: Stone[] = []
    const r = rng(toks.length * 31 + this.count)
    const drop = (i: number) => {
      const it = items[i]
      const [bx, by] = o.place ? o.place(it.x, it.y, i) : [it.x, it.y]
      const k = typeof kind === 'function' ? kind(toks[i], i) : kind
      const st = this.addStone(toks[i], k, bx, by, o)
      made.push(st)
      spans[i].style.visibility = 'hidden'
      // the seam on its left goes with it
      const seam = spans[i].previousElementSibling
      if (seam?.classList.contains('t4-crack')) (seam as HTMLElement).style.visibility = 'hidden'
      if (i === 0) spans[0].parentElement?.parentElement?.querySelectorAll<HTMLElement>('.t4-crack').forEach((c) => c.classList.add('is-fading'))
      o.onStone?.(st, i)
      if (this.ctx.reduced) return
      Body.setVelocity(st.body, { x: (r() - 0.5) * 0.9, y: -0.6 - r() * 0.8 })
      Body.setAngularVelocity(st.body, (r() - 0.5) * 0.05)
      const k0 = it.px / (font * this.view.s)
      const id = st.inner.querySelector('.t4-st-id')
      this.ctx.anim(() => {
        gsap.fromTo(st.inner, { scale: k0, x: (it.x0 - it.x), y: it.y0 - it.y }, { scale: 1, x: 0, y: 0, duration: 1.05, ease: 'power3.inOut' })
        gsap.fromTo(st.art, { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 0.55, ease: 'power2.out' })
        if (id) gsap.fromTo(id, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.7 })
      })
    }
    if (this.ctx.reduced) {
      items.forEach((_, i) => drop(i))
      this.settle()
      return made
    }
    const stg = o.stagger ?? 0.045
    this.ctx.anim(() => items.forEach((_, i) => gsap.delayedCall(i * stg, () => drop(i))))
    this.wake(items.length * stg * 1000 + 1400)
    return made
  }

  // ───────── drag (pointer) — keyboard alternatives live in the scenes ─────────
  draggable(st: Stone, onTap?: () => void) {
    let id: number | null = null
    let sx = 0, sy = 0, moved = 0
    const pt = (e: PointerEvent): Matter.Vector => {
      const rr = this.root.getBoundingClientRect()
      const [x, y] = this.toWorld(clamp(e.clientX - rr.left, 4, this.W - 4), clamp(e.clientY - rr.top, 4, this.H - 4))
      return { x: x - st.frame.x, y: y - st.frame.y }
    }
    st.inner.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.drag) return
      id = e.pointerId
      sx = e.clientX
      sy = e.clientY
      moved = 0
      try {
        st.inner.setPointerCapture(id)
      } catch {
        /* gone */
      }
      const p = pt(e)
      Sleeping.set(st.body, false)
      const dx = p.x - st.body.position.x, dy = p.y - st.body.position.y
      this.drag = Constraint.create({ pointA: p, bodyB: st.body, pointB: { x: dx * 0.5, y: dy * 0.5 }, stiffness: 0.04, damping: 0.12, length: 0 })
      Composite.add(this.engine.world, this.drag)
      st.inner.classList.add('is-held')
      this.wake()
    })
    st.inner.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id || !this.drag) return
      moved = Math.max(moved, Math.hypot(e.clientX - sx, e.clientY - sy))
      this.drag.pointA = pt(e)
    })
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      id = null
      if (this.drag) Composite.remove(this.engine.world, this.drag)
      this.drag = null
      st.inner.classList.remove('is-held')
      if (moved < 6 && e.type === 'pointerup') onTap?.()
      this.wake(300)
    }
    st.inner.addEventListener('pointerup', end)
    st.inner.addEventListener('pointercancel', end)
  }

  /** A gentle toss — the keyboard (and tap) alternative to dragging a stone. */
  toss(st: Stone, dir = 0) {
    Sleeping.set(st.body, false)
    Body.setVelocity(st.body, { x: dir * 2.2, y: -7.5 - Math.random() * 1.5 })
    Body.setAngularVelocity(st.body, (Math.random() - 0.5) * 0.12 + dir * 0.04)
    if (this.ctx.reduced) this.settle()
    else this.wake(400)
  }

  // ───────── canvas helpers ─────────
  /** Soft contact shadows under stones that rest on sand (world transform must be set). */
  shadows(g: CanvasRenderingContext2D, list = this.stones) {
    const c = this.pal.dark ? this.pal.paper : this.pal.ink
    for (const st of list) {
      if (st.ground === undefined) continue
      const b = st.body.bounds
      const d = Math.max(0, st.ground - b.max.y)
      const k = clamp(1 - d / 260, 0, 1)
      if (k <= 0) continue
      const x = st.body.position.x + st.frame.x
      wash(g, x, st.ground + 1, st.w * (0.62 + (1 - k) * 0.4), st.h * 0.2 * (0.8 + (1 - k)), c, (this.pal.dark ? 0.55 : 0.2) * k * k, 0.35)
    }
  }

  /** Rings for stones resting on `ground` (world): one ring set per cluster of settled stones. */
  ringsOn(ground: number, list = this.stones, pad = 22): Ring[] {
    const rest = list.filter((st) => st.ground === ground && st.body.isSleeping && st.body.bounds.max.y > ground - st.h * 2.4)
    if (!rest.length) return []
    const iv = rest.map((st) => [st.body.bounds.min.x + st.frame.x, st.body.bounds.max.x + st.frame.x]).sort((a, b) => a[0] - b[0])
    const groups: number[][] = []
    for (const [a, b] of iv) {
      const gp = groups[groups.length - 1]
      if (gp && a < gp[1] + pad * 2 + 70) gp[1] = Math.max(gp[1], b)
      else groups.push([a, b])
    }
    return groups.map(([a, b]) => ({ x: (a + b) / 2, y: ground, rx: (b - a) / 2 + pad }))
  }

  /** Raked sand bed (screen-space spec), cached; rings fade in when they change. */
  bed(id: number, spec: { x0: number; x1: number; y: number; back: number; front: number; rows: number; seed?: number }, rings: Ring[]) {
    const g = this.g
    if (!g) return
    const key = [this.W, this.H, this.dpr, this.themeTick, spec.x0, spec.x1, spec.y, spec.back, spec.front, spec.rows].map((v) => Math.round(v)).join(',')
    const ringKey = rings.map((r) => `${Math.round(r.x / 3)}:${Math.round(r.rx / 3)}:${Math.round(r.y)}`).join('|')
    let slot = this.beds.get(id)
    if (!slot) {
      slot = { cur: document.createElement('canvas'), old: document.createElement('canvas'), key: '', ring: '', t0: 0 }
      this.beds.set(id, slot)
    }
    const render = (c: HTMLCanvasElement) => {
      c.width = this.canvas.width
      c.height = this.canvas.height
      const cg = c.getContext('2d')
      if (!cg) return
      cg.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
      sandBed(cg, this.pal, { ...spec, rings })
    }
    const now = performance.now()
    if (slot.key !== key) {
      render(slot.cur)
      slot.key = key
      slot.ring = ringKey
      slot.t0 = 0
    } else if (slot.ring !== ringKey) {
      ;[slot.cur, slot.old] = [slot.old, slot.cur]
      render(slot.cur)
      slot.ring = ringKey
      slot.t0 = this.ctx.reduced ? 0 : now
    }
    const f = slot.t0 ? clamp((now - slot.t0) / 1400, 0, 1) : 1
    this.screenTx(g)
    if (f < 1) {
      g.globalAlpha = 1 - f
      g.drawImage(slot.old, 0, 0, this.W, this.H)
      this.wake(60)
    }
    g.globalAlpha = f
    g.drawImage(slot.cur, 0, 0, this.W, this.H)
    g.globalAlpha = 1
  }

  destroy() {
    if (!this.alive) return
    this.alive = false
    cancelAnimationFrame(this.raf)
    this.offs.forEach((f) => f())
    gsap.killTweensOf(this.stones.flatMap((st) => [st.inner, st.art]))
    Composite.clear(this.engine.world, false)
    Engine.clear(this.engine)
    this.stones = []
    this.beds.clear()
  }
}

/** Build a sentence: words never wrap apart; a hairline crack waits between every two tokens. */
export function sentence(toks: Tok[], cls = '') {
  const el = h('p', { class: `t4-sent ${cls}`.trim() })
  const spans: HTMLElement[] = []
  const cracks: HTMLElement[] = []
  let word: HTMLElement | null = null
  let wi = -1
  toks.forEach((t, i) => {
    if (t.word !== wi) {
      wi = t.word
      if (i) el.append(t.lead ? ' ' : '')
      word = h('span', { class: 't4-word' })
      el.append(word)
    } else if (t.lead) word!.append(' ')
    if (i) {
      const c = h('span', { class: 't4-crack', 'aria-hidden': 'true' })
      cracks.push(c)
      word!.append(c)
    }
    const sp = h('span', { class: 't4-tok' }, t.t)
    spans.push(sp)
    word!.append(sp)
  })
  return { el, spans, cracks }
}

/** Cracks draw in one after another (a dry little ink tick between pieces). */
export function crackIn(ctx: SceneCtx, cracks: HTMLElement[], done: () => void) {
  if (ctx.reduced || !cracks.length) {
    cracks.forEach((c) => c.classList.add('on'))
    return done()
  }
  ctx.anim(() => {
    gsap.fromTo(cracks, { scaleY: 0, opacity: 0 }, {
      scaleY: 1, opacity: 1, duration: 0.3, stagger: Math.min(0.055, 0.6 / cracks.length), ease: 'power2.out',
      onStart: () => cracks.forEach((c) => c.classList.add('on')),
      onComplete: () => void setTimeout(() => ctx.el.isConnected && done(), 320),
    })
  })
}

/** Measure the tallest insight this scene can show, so the picture is composed for it from the start. */
export function footReserve(ctx: SceneCtx, copies: (string | Fact)[]) {
  const foot = ctx.el.querySelector<HTMLElement>('.scene-foot')
  let probeW = -1
  let need = 0
  return () => {
    if (!foot) return 0
    if (foot.clientWidth !== probeW) {
      probeW = foot.clientWidth
      const box = h('div', { class: 'scene-insight', 'aria-hidden': 'true', style: 'position:absolute;left:0;right:0;bottom:0;visibility:hidden;pointer-events:none' })
      foot.append(box)
      let max = 0
      for (const c of copies) {
        box.replaceChildren(ctx.fact(c, 'p', 'insight-text'), h('button', { class: 'insight-more', type: 'button', tabindex: '-1' }, '…'))
        max = Math.max(max, box.offsetHeight)
      }
      box.remove()
      const cs = getComputedStyle(foot)
      need = Math.max(parseFloat(cs.minHeight) || 0, max + (parseFloat(cs.paddingBottom) || 0))
    }
    return Math.max(0, need - foot.offsetHeight)
  }
}

/** Fonts change widths and line breaks: run once they are in. */
export function afterFonts(ctx: SceneCtx, fn: () => void) {
  let alive = true
  ctx.onCleanup(() => void (alive = false))
  document.fonts?.ready.then(() => alive && fn())
}
