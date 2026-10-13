import content from '../../content/tram-02.json'
import type { Fact } from '../../core/content'
import { fill, h } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx, SceneDef, StationModule } from '../types'
import { EXTENT, Painting } from './bonsai'
import { brushLength, brushTip, drawBlossom, drawBrush, drawFruit, drawPainting, fruitBox, swingAngle, swinging, type FruitId, type Swing } from './fruits'
import { clamp, dab, inkLine, mix, smooth, sumi, type Pt } from './paint'
import './style.css'

type Copy = string | Fact
interface Item {
  id: string
  name: string
  short?: string
  insight: Copy
  detail?: Copy
}
interface T02 {
  scenes: {
    seed: { label: string; prompt: string; water: string; again: string; art: string; rootLabel: string; insight: Copy; detail: Copy }
    branches: { label: string; prompt: string; art: string; padAria: string; twigAria: string; done: string; families: Item[]; twigs: Item[] }
  }
}
const C = content as unknown as T02

const TREE_W = EXTENT.right - EXTENT.left
const TREE_H = EXTENT.top - EXTENT.bottom
/** Every sentence either scene can show: both scenes reserve the same foot, so the tree keeps its place between them. */
const ALL_COPY: Copy[] = [C.scenes.seed.insight, ...[...C.scenes.branches.families, ...C.scenes.branches.twigs].map((f) => f.insight)]

/**
 * Repaint when the theme changes (watches the attribute, so every way of switching counts). The painting and its
 * words fade back in while the page background eases over, so nothing new flashes on the old paper.
 */
function watchTheme(ctx: SceneCtx, p: Painting) {
  let last = document.documentElement.dataset.theme
  const art = ctx.art
  const mo = new MutationObserver(() => {
    const now = document.documentElement.dataset.theme
    if (now === last) return
    last = now
    if (!ctx.reduced) {
      art.style.transition = 'none'
      art.style.opacity = '0'
    }
    p.rethemed()
    if (!ctx.reduced) {
      void art.offsetWidth
      art.style.transition = 'opacity 0.9s cubic-bezier(0.45, 0.05, 0.25, 1) 0.15s'
      art.style.opacity = ''
    }
  })
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  ctx.onCleanup(() => mo.disconnect())
}

/**
 * The art height once the tallest insight is showing (its detail floats above the foot, so only the sentence and the
 * "more" button count). The picture is composed in that height from the start, so nothing jumps (or slides out from
 * under a finger) when the foot grows — and the canvas is not even rebuilt (see Painting.resize).
 */
function stableHeight(ctx: SceneCtx, copies: Copy[]) {
  const foot = ctx.el.querySelector<HTMLElement>('.scene-foot')
  let probeW = -1
  let need = 0
  const H = (artH: number) => {
    if (!foot) return artH
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
    return artH - Math.max(0, need - foot.offsetHeight)
  }
  return { H, reset: () => void (probeW = -1) }
}

/** Fonts change the insight's line breaks: measure again once they are in. */
function afterFonts(ctx: SceneCtx, fn: () => void) {
  let alive = true
  ctx.onCleanup(() => void (alive = false))
  document.fonts?.ready.then(() => alive && fn())
}

interface Comp {
  s: number
  ox: number
  oy: number
  portrait: boolean
  /** short landscape (a phone on its side, a small laptop window): no names beside the fruits */
  compact: boolean
  /** painted size of a fruit and of a blossom, in step with the tree (the buttons over them stay 40–48px) */
  R: number
  rb: number
}
/** Where the tree sits — the same in both scenes, so it does not jump between slides. */
function compose(w: number, H: number): Comp {
  const portrait = w / H < 1.05
  const compact = !portrait && H < 330
  const rbOf = (s: number) => clamp(0.06 * s, 7, 30)
  const midX = (EXTENT.left + EXTENT.right) / 2
  let s: number
  let ox: number
  let oy: number
  if (portrait) {
    // tree centred; the young branch rises over the crown; the closing words under the pot
    const capH = 34
    const head = (k: number) => 0.25 * k + 1.4 * rbOf(k) + 0.02 * H
    s = Math.min((w - 20) / TREE_W, 520)
    while (s > 60 && TREE_H * s + head(s) + capH > H) s -= 2
    const used = TREE_H * s + head(s) + capH
    // spare height goes mostly above the tree: that is where the brush paints
    const top = Math.max(0, (H - used) * 0.7) + head(s)
    ox = w / 2 - midX * s
    oy = top + EXTENT.top * s
  } else {
    // tree centred-left, with headroom; the empty paper on the right belongs to the young branch and its pictures
    const head = (k: number) => (compact ? 0.04 * H : 0.05 * H + 0.04 * k) + 2 * rbOf(k)
    const below = (k: number) => (compact ? 4 : 0.07 * k)
    s = Math.min((w * (compact ? 0.5 : 0.56)) / TREE_W, 560)
    while (s > 50 && TREE_H * s + head(s) + below(s) > H) s -= 2
    const cx = w * (compact ? 0.3 : 0.4)
    ox = cx - midX * s
    oy = H - below(s) + EXTENT.bottom * s
  }
  return { s, ox, oy, portrait, compact, R: clamp(0.082 * s, 8, 44), rb: rbOf(s) }
}

// ───────────────────────── Scene 1 · Gieo hạt ─────────────────────────
const seedScene: SceneDef = {
  label: C.scenes.seed.label,
  mount(ctx) {
    const S = C.scenes.seed
    const art = ctx.art
    art.classList.add('t02-art')
    const stable = stableHeight(ctx, ALL_COPY)
    /** the root's name: its ink leader is written after the tree has grown */
    const root = { k: 0 }
    const paint = new Painting({
      host: art,
      quality: ctx.quality,
      reduced: ctx.reduced,
      grown: false,
      layout: (w, hh) => {
        const H = stable.H(hh)
        const c = compose(w, H)
        return { s: c.s, ox: c.ox, oy: c.oy, H }
      },
      onLayout: () => place(),
      overlay: (g) => {
        if (root.k <= 0) return false
        const pal = paint.pal
        const a = paint.px(0.262, 0.026)
        const b = paint.px(0.33, 0.07)
        const c = paint.px(0.375, 0.118)
        inkLine(g, [a, b, c], { w: Math.max(1.3, 0.009 * paint.s), color: pal.ink, alpha: pal.dark ? 0.6 : 0.72, head: 0.45, tail: 0.15, upTo: root.k })
        return false
      },
    })
    paint.sway = false
    watchTheme(ctx, paint)
    afterFonts(ctx, () => (stable.reset(), paint.relayout()))

    const desc = h('p', { class: 'visually-hidden' }, S.art)
    const btn = h('button', { class: 't02-hit t02-water', type: 'button', 'aria-label': S.water })
    const name = h('span', { class: 't02-root', 'aria-hidden': 'true' }, S.rootLabel)
    name.hidden = true
    art.append(desc, name, btn)

    function place() {
      const a = paint.px(-0.5, 0.75)
      const b = paint.px(0.5, -0.17)
      Object.assign(btn.style, { left: `${a.x}px`, top: `${a.y}px`, width: `${b.x - a.x}px`, height: `${b.y - a.y}px` })
      // the name sits where the leader ends, just right of the roots; never below the picture
      const p = paint.px(0.385, 0.118)
      const fs = clamp(0.075 * paint.s, 16, 30)
      name.style.fontSize = `${fs}px`
      const nw = name.hidden ? fs * 4.6 : name.offsetWidth
      Object.assign(name.style, { left: `${Math.min(p.x, art.clientWidth - nw - 2)}px`, top: `${Math.min(p.y - fs * 0.62, paint.H - fs * 1.5 - 4)}px` })
    }
    place()

    let grown = false
    const water = () => {
      ctx.chime('soft')
      paint.water()
      if (grown) return
      grown = true
      btn.setAttribute('aria-label', S.again)
      const finish = () => {
        ctx.insight(S.insight, S.detail)
        name.hidden = false
      }
      if (ctx.reduced) {
        paint.G = paint.F = paint.M = 1
        root.k = 1
        paint.invalidate()
        finish()
        return
      }
      ctx.anim(() => {
        const tl = gsap.timeline({ onUpdate: () => paint.invalidate() })
        tl.to(paint, { G: 1, duration: 3.6, ease: 'power1.inOut' }, 0.8)
        tl.to(paint, { M: 1, duration: 1.8, ease: 'power2.out' }, 1.3)
        tl.to(paint, { F: 1, duration: 3, ease: 'power2.out' }, 2.7)
        tl.add(() => {
          paint.sway = ctx.quality === 'high'
          finish()
        }, 4.9)
        tl.to(root, { k: 1, duration: 1.2, ease: 'power2.inOut' }, 5.1)
        tl.fromTo(name, { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 -10% 0 0)', duration: 1.6, ease: 'power2.out', clearProps: 'clipPath' }, 5.9)
      })
    }
    btn.addEventListener('click', water)
    const onArt = (e: MouseEvent) => {
      if (e.target !== btn && !(e.target as Element).closest('button, a')) water()
    }
    art.addEventListener('click', onArt)
    ctx.prompt(S.prompt)
    return () => {
      art.removeEventListener('click', onArt)
      paint.destroy()
    }
  },
}

// ───────────────────────── Scene 2 · Các nhánh ─────────────────────────
/** Where each fruit hangs (tree units, on the underside of its pad), its stem length (× s) and the side its name sits on. */
const HANG: Record<FruitId, { at: [number, number]; stem: number; side: -1 | 1 }> = {
  recog: { at: [-0.62, 0.316], stem: 0.045, side: -1 },
  rec: { at: [0.575, 0.51], stem: 0, side: 1 },
  robot: { at: [-0.42, 0.716], stem: 0, side: -1 },
}
/** top to bottom: the order of the pads for Tab */
const ORDER = ['gen', 'robot', 'rec', 'recog']
/** where the young branch leaves the apex twig (tree units) */
const SHOOT_FROM: [number, number] = [0.12, 0.915]
const BLOSSOM_SCALE = [1.06, 0.88, 1.12, 0.92, 1, 0.86]

/**
 * The young branch of AI tạo sinh, in units of D (the room each flower's button needs): a main shoot that arches as
 * it grows, one side twig, the brush's cord, a few closed buds, and the six flowers — each `s` along a stroke and `o`
 * to its upper side (o = 0: on past the stroke's tip). Text, image, video, audio, 3D, code — left to right.
 * Two habits: a long branch with its flowers alternating along it (wide paper), a short forked spray (tall paper).
 */
type On = 'main' | 'twig'
interface Spray {
  len: number
  twig: { at: number; turn: number; len: number }
  brush: number
  buds: [On, number, number][]
  flowers: [On, number, number][]
}
const SPRAYS: Spray[] = [
  {
    len: 5.7,
    twig: { at: 2.6, turn: 0.85, len: 0.7 },
    brush: 2.15,
    buds: [['main', 0.7, 0.1], ['twig', 0.75, 0], ['main', 5.3, 0.12]],
    flowers: [['main', 1.25, -0.32], ['main', 2.15, 0.32], ['main', 3.05, -0.32], ['main', 3.95, 0.32], ['main', 4.85, -0.32], ['main', 5.8, 0]],
  },
  {
    len: 4.65,
    twig: { at: 2, turn: 0.95, len: 1.55 },
    brush: 2.45,
    buds: [['main', 0.7, 0.1], ['main', 4.2, 0.12], ['twig', 1.25, -0.1]],
    flowers: [['main', 1.25, -0.32], ['twig', 0.8, 0.3], ['twig', 1.72, 0], ['main', 2.95, 0.32], ['main', 3.65, -0.34], ['main', 4.75, 0]],
  },
]
interface Stroke {
  pts: Pt[]
  ang: number[]
  step: number
}
/** A stroke from p setting off at angle a (radians, up from the right), turning by `turn` as it grows (more near its tip). */
function arcStroke(p: Pt, a: number, turn: number, len: number, n = 30): Stroke {
  const pts = [p]
  const ang = [a]
  const step = len / n
  let { x, y } = p
  for (let i = 1; i <= n; i++) {
    const t = a + turn * Math.pow(i / n, 1.4)
    x += Math.cos(t) * step
    y -= Math.sin(t) * step
    pts.push({ x, y })
    ang.push(t)
  }
  return { pts, ang, step }
}
/** The point `d` along a stroke (carrying on straight past its tip), and a point `o` px off it to its upper side. */
function onStroke(st: Stroke, d: number, o = 0) {
  const i = clamp(Math.round(d / st.step), 0, st.pts.length - 1)
  const a = st.ang[i]
  const extra = d - i * st.step
  const base = { x: st.pts[i].x + Math.cos(a) * extra, y: st.pts[i].y - Math.sin(a) * extra }
  return { base, at: { x: base.x - Math.sin(a) * o, y: base.y - Math.cos(a) * o } }
}

interface Bud {
  t: Item
  i: number
  btn: HTMLButtonElement
  k: number
  sel: number
  seen: boolean
  /** where its stem leaves the wood, and the flower's centre (px) */
  base: Pt
  c: Pt
  rot: number
}

const branchScene: SceneDef = {
  label: C.scenes.branches.label,
  mount(ctx) {
    const B = C.scenes.branches
    const art = ctx.art
    art.classList.add('t02-art')
    const stable = stableHeight(ctx, ALL_COPY)
    let comp: Comp = compose(1, 1)

    // ── state painted by the overlay ──
    const fam = new Map(B.families.map((f) => [f.id, f]))
    const fruit = Object.fromEntries((Object.keys(HANG) as FruitId[]).map((id) => [id, { k: 0, sel: 0, sw: { t0: 0, amp: 0 } as Swing }])) as Record<FruitId, { k: number; sel: number; sw: Swing }>
    const brush = { k: 0, sel: 0, sw: { t0: 0, amp: 0 } as Swing }
    /** the young branch of AI tạo sinh, painted once into its own layer and revealed as it grows */
    const shoot = { k: 0, path: [] as Pt[], acc: [0], layer: document.createElement('canvas'), reveal: [] as { x: number; y: number; r: number; t: number }[], bottom: 0, right: 0 }
    /** the small picture the brush paints for a chosen blossom; `go` flies the brush from its cord to the paper */
    const pic = { id: null as string | null, k: 1, alpha: 1, go: 0, tip: null as Pt | null, box: { cx: 0, cy: 0, size: 0 }, prev: null as { id: string; alpha: number; box: { cx: number; cy: number; size: number } } | null }
    /** the habit the young branch grew in, for this layout */
    let spray = SPRAYS[0]
    /** bare wood before the flowers (D units), so they open clear of the crown */
    let lead = 0
    const uBrush = () => (spray.brush + lead) / (spray.len + lead)

    const paint = new Painting({
      host: art,
      quality: ctx.quality,
      reduced: ctx.reduced,
      grown: true,
      layout: (w, hh) => {
        const H = stable.H(hh)
        comp = compose(w, H)
        return { s: comp.s, ox: comp.ox, oy: comp.oy, H }
      },
      onLayout: () => place(),
      overlay: draw,
      underlay: drawShoot,
    })
    paint.breath = true
    watchTheme(ctx, paint)
    afterFonts(ctx, () => (stable.reset(), paint.relayout()))

    // ── DOM: a description, one transparent button per pad (tab order top → bottom), names, captions ──
    const desc = h('p', { class: 'visually-hidden' }, B.art)
    art.append(desc)
    const pads = ORDER.map((id) => {
      const f = fam.get(id)!
      const b = h('button', { class: 't02-hit t02-pad', type: 'button', 'aria-label': fill(B.padAria, { name: f.name }), 'aria-pressed': 'false' })
      b.addEventListener('click', () => choose(id))
      b.addEventListener('pointerenter', () => hover(id, 1))
      b.addEventListener('pointerleave', () => hover(id, 0))
      b.addEventListener('focus', () => hover(id, 1))
      b.addEventListener('blur', () => hover(id, 0))
      art.append(b)
      return { id, b }
    })
    const buds: Bud[] = B.twigs.map((t, i) => {
      const btn = h('button', { class: 't02-hit t02-bud', type: 'button', 'aria-label': fill(B.twigAria, { name: t.name }), 'aria-pressed': 'false' })
      btn.hidden = true
      btn.addEventListener('click', () => chooseTwig(t.id))
      return { t, i, btn, k: 0, sel: 0, seen: false, base: { x: 0, y: 0 }, c: { x: 0, y: 0 }, rot: i * 0.9 + 0.3 }
    })
    // the six blossoms follow AI tạo sinh in the tab order
    pads[0].b.after(...buds.map((b) => b.btn))
    const labels = new Map(B.families.map((f) => [f.id, h('span', { class: 't02-label', 'aria-hidden': 'true' }, f.short ?? f.name)]))
    for (const l of labels.values()) {
      l.hidden = true
      art.append(l)
    }
    /** the name of the medium under its picture */
    const picCap = h('p', { class: 't02-pcap', 'aria-hidden': 'true' })
    const done = h('p', { class: 't02-done', 'aria-hidden': 'true' }, B.done)
    picCap.hidden = done.hidden = true
    art.append(picCap, done)

    const visited = new Set<string>()
    let sel: string | null = null
    let finished = false
    let showDone = false

    // ── the young branch: a path in px with arc lengths, so things can sit at a fraction of it ──
    function pointAt(u: number) {
      const P = shoot.path
      const L = shoot.acc[shoot.acc.length - 1]
      const target = clamp(u) * L
      let i = 1
      while (i < P.length - 1 && shoot.acc[i] < target) i++
      const a = P[i - 1]
      const b = P[i]
      const f = clamp((target - shoot.acc[i - 1]) / (shoot.acc[i] - shoot.acc[i - 1] || 1))
      const tx = b.x - a.x
      const ty = b.y - a.y
      const l = Math.hypot(tx, ty) || 1
      // the normal that points up, away from the ground
      let nx = -ty / l
      let ny = tx / l
      if (ny > 0) (nx = -nx), (ny = -ny)
      return { p: { x: a.x + tx * f, y: a.y + ty * f }, n: { x: nx, y: ny }, t: { x: tx / l, y: ty / l } }
    }

    function layoutShoot() {
      const s = paint.s
      const W = art.clientWidth
      const H = paint.H
      const { rb, R } = comp
      /** every flower keeps its button clear of the others (smaller on small paper, still well above 24px) */
      const btn = comp.compact ? 36 : comp.portrait ? 44 : 48
      const D = Math.max(btn, rb * 2.2)
      const A = paint.px(...SHOOT_FROM)
      const crown = [paint.padBox('gen'), paint.padBox('deco')]
      // the picture is painted above-left of the crown in portrait: leave that paper to it
      const picX = paint.px(-0.22, 0).x
      const picY = paint.px(0, 0.86).y
      const out = (p: Pt, m: number) => Math.max(0, m - p.x) + Math.max(0, p.x + m - W) + Math.max(0, m - p.y) + Math.max(0, p.y + m - H)
      // a natural shoot at every size: try a few angles of departure, arches and spans, keep the one that fits best
      // portrait: a shoot leaning out over the moon and arching over, never a straight rod standing up
      const thetas = comp.portrait ? [0.85, 0.7, 1, 1.15] : [0.45, 0.32, 0.58, 0.2, 0.08, -0.06]
      const turns = comp.portrait ? [-1, -0.75, -1.3, -0.5] : [-0.4, -0.15, -0.7, 0.2]
      const labelW = comp.portrait || comp.compact ? 0 : 110
      let best = { bad: Infinity, main: null as Stroke | null, twig: null as Stroke | null, u: D, sd: 1, sp: SPRAYS[0], ld: 0 }
      for (const [n, sp] of SPRAYS.entries())
        for (const sd of [1, -1])
          for (const th of thetas)
            for (const turn of turns)
              for (const f of [1, 0.88])
                for (const ld of [0, 0.5, 1]) {
                const u = D * f
                const main = arcStroke(A, th, turn, (sp.len + ld) * u)
                const twig = arcStroke(onStroke(main, (sp.twig.at + ld) * u).base, main.ang[Math.round(((sp.twig.at + ld) / (sp.len + ld)) * 30)] + sd * sp.twig.turn, -sd * 0.25, sp.twig.len * u, 12)
                const cs = sp.flowers.map(([on, d, o]) => (on === 'main' ? onStroke(main, (d + ld) * u, o * u * sd) : onStroke(twig, d * u, o * u * sd)).at)
                const br = onStroke(main, (sp.brush + ld) * u).base
                const brEnd = br.y + brushLength(R) + R * 0.4
                const labY = br.y + brushLength(R) * 0.55
                let bad = 0
                for (const c of cs) {
                  bad += 3 * out(c, rb * 1.2 + 4)
                  for (const b of crown) if (((c.x - b.x) / (b.rx + rb * 0.5)) ** 2 + ((c.y - b.y) / (b.ry + rb * 0.5)) ** 2 < 1) bad += 30
                  if (comp.portrait && c.x < picX + rb && c.y < picY) bad += 30
                  // nothing in the way of the hanging brush, or of its name beside it
                  if (Math.abs(c.x - br.x) < rb + R * 0.35 && c.y > br.y - rb && c.y < brEnd + rb) bad += 60
                  if (labelW && c.x + rb > br.x + R * 0.4 && c.x - rb < br.x + R * 0.4 + labelW && Math.abs(c.y - labY) < rb + 14) bad += 40
                }
                for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) bad += 2 * Math.max(0, D - Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y))
                for (const p of [...main.pts, ...twig.pts]) bad += out(p, 3)
                bad += 2 * Math.max(0, brEnd - H)
                bad += Math.abs(th - thetas[0]) * 25 + Math.abs(turn - turns[0]) * 12 + (1 - f) * 90 + (sd < 0 ? 12 : 0) + (n === (comp.portrait ? 1 : 0) ? 0 : 10) + ld * 12
                if (bad < best.bad) best = { bad, main, twig, u, sd, sp, ld }
              }
      spray = best.sp
      lead = best.ld
      const { main, twig, u, sd } = best as { main: Stroke; twig: Stroke; u: number; sd: number }
      /** a place on the young wood: `d` along the main shoot (after its bare lead) or along the twig, `o` to its upper side */
      const place = (on: On, d: number, o: number) => (on === 'main' ? onStroke(main, (d + lead) * u, o * u * sd) : onStroke(twig, d * u, o * u * sd))
      shoot.path = main.pts
      shoot.acc = main.pts.map((_, i) => i * main.step)
      for (const b of buds) {
        const q = place(...spray.flowers[b.i])
        b.base = q.base
        b.c = { ...q.at }
      }
      // safety: keep them apart and inside the picture
      const inside = (b: Bud) => {
        b.c.x = clamp(b.c.x, rb + 4, W - rb - 4)
        b.c.y = clamp(b.c.y, rb + 4, H - rb - 4)
      }
      buds.forEach(inside)
      for (let it = 0; it < 30; it++) {
        for (let i = 0; i < buds.length; i++)
          for (let j = i + 1; j < buds.length; j++) {
            const a = buds[i].c
            const b = buds[j].c
            let dx = b.x - a.x
            let dy = b.y - a.y
            const d = Math.hypot(dx, dy)
            if (d >= D) continue
            if (d < 0.01) (dx = 1), (dy = 0)
            const push = (D - d) / 2 / (d || 1)
            a.x -= dx * push
            a.y -= dy * push
            b.x += dx * push
            b.y += dy * push
          }
        buds.forEach(inside)
      }
      shoot.bottom = Math.max(...buds.map((b) => b.c.y + rb), ...main.pts.map((p) => p.y), ...twig.pts.map((p) => p.y))
      shoot.right = Math.max(...buds.map((b) => b.c.x + rb), ...main.pts.map((p) => p.x), ...twig.pts.map((p) => p.x))
      for (const b of buds) Object.assign(b.btn.style, { width: `${btn}px`, height: `${btn}px`, left: `${clamp(b.c.x - btn / 2, 0, W - btn)}px`, top: `${clamp(b.c.y - btn / 2, 0, H - btn)}px` })

      // paint the branch once, into its own layer; `reveal` grows it (circles that open in time order)
      const dpr = paint.canvas.width / Math.max(1, paint.w)
      const layer = shoot.layer
      layer.width = paint.canvas.width
      layer.height = paint.canvas.height
      const g = layer.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, paint.w, paint.h)
      const pal = paint.pal
      const opts = (seed: number) => ({ color: pal.wood, alpha: pal.dark ? 0.5 : 0.94, seed, dry: 0.18, side: 1, paper: pal.paper })
      // a young shoot: as thick as the twig it grows from, tapering to a fine tip
      const w0 = clamp(0.012 * s, 2, 6.5)
      const taper = (n: number, a: number, b: number) => Array.from({ length: n }, (_, k) => Math.max(0.7, a + (b - a) * Math.pow(k / (n - 1), 0.85)))
      const Wm = taper(main.pts.length, w0, 0.9)
      const forkK = Math.round(((spray.twig.at + lead) / (spray.len + lead)) * (main.pts.length - 1))
      const Wt = taper(twig.pts.length, Wm[forkK] * 0.72, 0.7)
      sumi(g, twig.pts, Wt, opts(709))
      sumi(g, main.pts, Wm, opts(707))
      shoot.reveal = []
      main.pts.forEach((p, k) => shoot.reveal.push({ ...p, r: Wm[k] + 4, t: 0.72 * (k / (main.pts.length - 1)) }))
      const t0 = 0.72 * ((spray.twig.at + lead) / (spray.len + lead))
      twig.pts.forEach((p, k) => shoot.reveal.push({ ...p, r: Wt[k] + 4, t: t0 + 0.2 * (k / (twig.pts.length - 1)) }))
      // short stalks where a flower sits off the wood
      for (const b of buds) {
        const d = Math.hypot(b.c.x - b.base.x, b.c.y - b.base.y)
        if (d < rb * 0.55) continue
        inkLine(g, [b.base, { x: (b.base.x + b.c.x) / 2 + (b.i % 2 ? 1 : -1) * d * 0.12, y: (b.base.y + b.c.y) / 2 }, b.c], { w: Math.max(0.8, rb * 0.09), color: pal.wood, alpha: pal.dark ? 0.5 : 0.85, head: 1, tail: 0.6, seed: b.i })
        shoot.reveal.push({ x: (b.base.x + b.c.x) / 2, y: (b.base.y + b.c.y) / 2, r: d / 2 + 3, t: 0.85 })
      }
      // a few closed buds, dark with a breath of vermilion
      for (const [on, d, o] of spray.buds) {
        const q = place(on, d, o)
        const br = Math.max(1.3, rb * 0.2)
        inkLine(g, [q.base, q.at], { w: Math.max(0.7, br * 0.5), color: pal.wood, alpha: pal.dark ? 0.5 : 0.8, head: 1, tail: 0.7 })
        dab(g, q.at.x, q.at.y, br, mix(pal.wood, pal.verm, 0.3), pal.dark ? 0.7 : 0.9, Math.round(d * 10))
        shoot.reveal.push({ ...q.at, r: br * 2 + 3, t: 0.8 })
      }
    }

    /** where the plaque of a family is (or the middle of the hanging brush), for its name */
    /** the middle of a family's painting (the hanging brush for AI tạo sinh) and its half-width, for its name */
    function fruitCentre(id: string) {
      if (id === 'gen') {
        const { p } = pointAt(uBrush())
        return { x: p.x, y: p.y + brushLength(comp.R) * 0.55, half: comp.R * 0.42 }
      }
      const H = HANG[id as FruitId]
      const a = paint.px(H.at[0], H.at[1])
      const b = fruitBox(id as FruitId, comp.R, H.stem * paint.s)
      return { x: a.x + b.cx, y: a.y + b.cy, half: b.half }
    }

    /** the empty paper beside the tree where the brush paints: right of it in landscape, above-left in portrait */
    function paperBox() {
      const W = art.clientWidth
      const H = paint.H
      const s = paint.s
      const capH = 26
      if (comp.portrait) {
        const x0 = 4
        const x1 = paint.px(-0.22, 0).x
        const y0 = 4
        const y1 = paint.px(0, 0.86).y - capH
        const size = clamp(Math.min(x1 - x0, y1 - y0) * 0.92, 36, 0.6 * s)
        return { cx: (x0 + x1) / 2, cy: y0 + (y1 - y0) / 2, size }
      }
      const rec = fruitCentre('rec')
      const labelEnd = rec.x + rec.half + (comp.compact ? 0 : 14 + (labels.get('rec')!.offsetWidth || 80))
      let x0 = Math.max(paint.px(0.72, 0).x, labelEnd) + 12
      const x1 = W - 8
      let y0 = shoot.bottom + 10
      const y1 = H - (comp.compact ? 40 : 52) - capH
      // not enough paper under the branch (short screens): use the paper beyond its flowers instead
      if (y1 - y0 < H * 0.4) {
        y0 = 8
        x0 = Math.max(x0, shoot.right + 12)
      }
      const size = clamp(Math.min((x1 - x0) * 0.86, (y1 - y0) * 0.92, (comp.compact ? 0.9 : 0.62) * s), 36, 230)
      return { cx: (x0 + x1) / 2, cy: y0 + (y1 - y0) / 2, size }
    }

    function placeLabels() {
      const W = art.clientWidth
      for (const [id, l] of labels) {
        const show = !comp.portrait && !comp.compact && visited.has(id)
        l.hidden = !show
        l.classList.toggle('on', id === sel)
        if (!show) continue
        const c = fruitCentre(id)
        const side = id === 'gen' ? 1 : HANG[id as FruitId].side
        l.classList.toggle('left', side < 0)
        const gap = c.half + 10
        if (side < 0) Object.assign(l.style, { left: '', right: `${W - (c.x - gap)}px`, top: `${c.y}px` })
        else Object.assign(l.style, { right: '', left: `${c.x + gap}px`, top: `${c.y}px` })
      }
    }

    function placePic() {
      pic.box = paperBox()
      const { cx, cy, size } = pic.box
      Object.assign(picCap.style, { left: `${cx}px`, top: `${cy + size / 2 + 4}px`, fontSize: `${clamp(size * 0.095, 13, 17)}px` })
    }

    function place() {
      const H = paint.H
      for (const p of pads) {
        const box = hitBox(p.id)
        const w = Math.max(48, box.rx * 2)
        const hh = Math.max(48, box.ry * 2)
        // hit areas stay whole inside the art
        const left = clamp(box.x - w / 2, 0, art.clientWidth - w)
        const top = clamp(box.y - hh / 2, 0, art.clientHeight - hh)
        Object.assign(p.b.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${hh}px` })
      }
      layoutShoot()
      placeLabels()
      placePic()
      // the closing words: under the pot in portrait, on the sand at the bottom right otherwise
      const base = paint.px(0, EXTENT.bottom)
      done.classList.toggle('center', comp.portrait)
      done.classList.toggle('small', comp.compact)
      if (comp.portrait) Object.assign(done.style, { left: '50%', right: '', top: `${base.y + 6}px` })
      else Object.assign(done.style, { left: '', right: '8px', top: `${H - (comp.compact ? 32 : 44)}px` })
      done.hidden = !showDone
    }

    /** the button over AI tạo sinh covers the whole crown, including the small pad beside it */
    function hitBox(id: string) {
      const a = paint.padBox(id)
      if (id !== 'gen') return a
      const d = paint.padBox('deco')
      const x0 = Math.min(a.x - a.rx, d.x - d.rx)
      const x1 = Math.max(a.x + a.rx, d.x + d.rx)
      const y0 = Math.min(a.y - a.ry, d.y - d.ry)
      const y1 = Math.max(a.y + a.ry, d.y + d.ry)
      return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2 }
    }

    // ── the young branch grows behind the crown's foliage ──
    function drawShoot(g: CanvasRenderingContext2D) {
      if (shoot.k <= 0 || shoot.path.length < 2) return
      const w = paint.w
      const hh = paint.h
      if (shoot.k >= 1) {
        g.drawImage(shoot.layer, 0, 0, w, hh)
        return
      }
      g.save()
      g.beginPath()
      for (const c of shoot.reveal) {
        if (c.t > shoot.k) continue
        const grow = smooth(c.t, c.t + 0.06, shoot.k)
        g.moveTo(c.x + c.r * grow, c.y)
        g.arc(c.x, c.y, c.r * grow, 0, Math.PI * 2)
      }
      g.clip()
      g.drawImage(shoot.layer, 0, 0, w, hh)
      g.restore()
    }

    function brushPose(now: number, t: number) {
      const { p } = pointAt(uBrush())
      const hang = ctx.reduced ? 0 : swingAngle(brush.sw, now, t, 1.3, paint.sway)
      if (pic.go <= 0 || !pic.tip) return { at: p, ang: hang, cord: 1 }
      // painting: the brush leans like a hand holds it, its tip on the stroke being written
      const ANG = 0.5
      const L = brushTip(comp.R)
      const to = { x: pic.tip.x + Math.sin(ANG) * L, y: pic.tip.y - Math.cos(ANG) * L }
      const e = pic.go
      // it lifts off in a soft arc
      const lift = Math.sin(e * Math.PI) * paint.s * 0.06
      return { at: { x: p.x + (to.x - p.x) * e, y: p.y + (to.y - p.y) * e - lift }, ang: hang + (ANG - hang) * e, cord: clamp(1 - e * 3) }
    }

    // ── painting the fruits, the blossoms and the pictures (every frame, over the tree) ──
    function draw(g: CanvasRenderingContext2D, t: number, now: number) {
      const pal = paint.pal
      const breeze = paint.sway
      const { R, rb } = comp
      let busy = false
      // the pictures on the paper
      if (pic.prev && pic.prev.alpha > 0) {
        const b = pic.prev.box
        drawPainting(g, pic.prev.id, b.cx, b.cy, b.size, pal, 1, pic.prev.alpha)
        busy = true
      }
      if (pic.id) {
        const b = pic.box
        pic.tip = drawPainting(g, pic.id, b.cx, b.cy, b.size, pal, pic.k, pic.alpha)
        if (pic.k < 1 || pic.alpha < 1) busy = true
      }
      if (shoot.k > 0 && shoot.path.length > 1) {
        if (shoot.k < 1) busy = true
        for (const b of buds) {
          if (b.k <= 0) continue
          const breathe = !ctx.reduced && sel === 'gen' && !b.seen && !budAny
          drawBlossom(g, b.c, rb, smooth(0.2, 1, b.k), b.sel, b.seen, pal, b.rot, BLOSSOM_SCALE[b.i] * (breathe ? 1 + 0.04 * Math.sin(t * 2.1 + b.i) : 1), b.i)
          if (b.k < 1 || breathe) busy = true
        }
      }
      for (const id of Object.keys(HANG) as FruitId[]) {
        const f = fruit[id]
        if (f.k <= 0) continue
        const Hd = HANG[id]
        drawFruit(g, id, paint.px(Hd.at[0], Hd.at[1]), Hd.stem * paint.s, R, f.k, f.sel, pal, ctx.reduced ? 0 : swingAngle(f.sw, now, t, id.length, breeze), t, breeze)
        if (f.k < 1 || swinging(f.sw, now)) busy = true
      }
      if (brush.k > 0 && shoot.path.length > 1) {
        const pose = brushPose(now, t)
        drawBrush(g, pose.at, R, brush.k, brush.sel, pal, pose.ang, pose.cord)
        if (brush.k < 1 || swinging(brush.sw, now) || pic.go > 0) busy = true
      }
      return busy
    }

    // ── interaction ──
    const to = (o: object, vars: gsap.TweenVars) => {
      if (ctx.reduced) {
        for (const [k, v] of Object.entries(vars)) if (typeof v === 'number' && k !== 'duration' && k !== 'delay') (o as Record<string, number>)[k] = v
        paint.invalidate()
        return
      }
      ctx.anim(() => gsap.to(o, { ...vars, onUpdate: () => paint.invalidate() }))
    }
    const now = () => performance.now() / 1000
    let budAny = false

    function hover(id: string, v: number) {
      to(paint.hover, { [id]: v, duration: 0.5, ease: 'power2.out' })
    }

    /** the picture on the paper fades away (another family was chosen) */
    function clearPic() {
      if (!pic.id) return
      pic.prev = { id: pic.id, alpha: pic.alpha, box: { ...pic.box } }
      pic.id = null
      picTl?.kill()
      pic.go = 0
      picCap.hidden = true
      to(pic.prev, { alpha: 0, duration: 0.6, ease: 'power2.out' })
    }

    function choose(id: string) {
      const f = fam.get(id)!
      const first = !visited.has(id)
      sel = id
      paint.breath = false
      ctx.chime('tap')
      for (const p of pads) p.b.setAttribute('aria-pressed', String(p.id === id))
      for (const k of ORDER) to(paint.glow, { [k]: k === id ? 1 : 0, duration: 0.9, ease: 'power2.out' })
      for (const k of Object.keys(HANG) as FruitId[]) to(fruit[k], { sel: k === id ? 1 : 0, duration: 0.9, ease: 'power2.out' })
      to(brush, { sel: id === 'gen' ? 1 : 0, duration: 0.9, ease: 'power2.out' })
      for (const b of buds) {
        to(b, { sel: 0, duration: 0.6 })
        b.btn.setAttribute('aria-pressed', 'false')
      }
      clearPic()
      ctx.insight(f.insight, f.detail)
      if (id === 'gen') sprout(first)
      else {
        const fr = fruit[id as FruitId]
        if (first) to(fr, { k: 1, duration: 1.8, ease: 'power2.out' })
        fr.sw = { t0: now() + (first ? 0.55 : 0), amp: first ? 0.2 : 0.09 }
      }
      visited.add(id)
      placeLabels()
      const lab = labels.get(id)!
      if (first && !lab.hidden && !ctx.reduced) ctx.anim(() => gsap.fromTo(lab, { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 -10% 0 0)', duration: 1.3, delay: 0.7, ease: 'power2.out', clearProps: 'clipPath' }))
      if (visited.size === B.families.length && !finished) {
        finished = true
        ctx.complete()
        ctx.chime('ok')
      }
      settle()
    }

    /** Once all four are known, the closing words appear when the visitor pauses. */
    let settleCall: gsap.core.Tween | null = null
    function settle() {
      if (!finished || showDone) return
      settleCall?.kill()
      ctx.anim(() => {
        settleCall = gsap.delayedCall(ctx.reduced ? 0 : 1.6, () => {
          showDone = true
          done.hidden = false
          if (!ctx.reduced) gsap.fromTo(done, { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: 1.6, ease: 'power2.out' })
        })
      })
    }

    function sprout(first: boolean) {
      brush.sw = { t0: now() + (first ? 1.3 : 0), amp: first ? 0.16 : 0.08 }
      if (!first) return
      const show = () => buds.forEach((b) => (b.btn.hidden = false))
      if (ctx.reduced) {
        shoot.k = brush.k = 1
        buds.forEach((b) => (b.k = 1))
        show()
        paint.invalidate()
        return
      }
      to(shoot, { k: 1, duration: 2, ease: 'power2.inOut' })
      to(brush, { k: 1, duration: 1.5, delay: 0.45, ease: 'power2.out' })
      buds.forEach((b) => to(b, { k: 1, duration: 1.2, delay: 1.1 + b.i * 0.14, ease: 'power2.out' }))
      ctx.anim(() => gsap.delayedCall(1.1, show))
    }

    let picTl: gsap.core.Timeline | null = null
    function chooseTwig(id: string) {
      const t = B.twigs.find((x) => x.id === id)!
      budAny = true
      ctx.chime('tap')
      for (const b of buds) {
        const on = b.t.id === id
        if (on) b.seen = true
        to(b, { sel: on ? 1 : 0, duration: 0.8, ease: 'power2.out' })
        b.btn.setAttribute('aria-pressed', String(on))
      }
      ctx.insight(t.insight, t.detail)
      if (pic.id === id) return
      clearPic()
      pic.id = id
      pic.alpha = 1
      picCap.textContent = t.name
      if (ctx.reduced) {
        pic.k = 1
        picCap.hidden = false
        paint.invalidate()
        return
      }
      pic.k = 0
      pic.go = 0
      ctx.anim(() => {
        picTl = gsap.timeline({ onUpdate: () => paint.invalidate() })
        picTl.to(pic, { go: 1, duration: 0.55, ease: 'power2.inOut' })
        picTl.to(pic, { k: 1, duration: 1.3, ease: 'power1.inOut' })
        picTl.add(() => {
          picCap.hidden = false
          gsap.fromTo(picCap, { opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.9, ease: 'power2.out' })
        })
        picTl.to(pic, { go: 0, duration: 0.75, ease: 'power2.inOut' })
        picTl.add(() => (brush.sw = { t0: now(), amp: 0.07 }))
      })
    }

    ctx.prompt(B.prompt)
    place()
    return () => {
      paint.destroy()
      shoot.layer.width = shoot.layer.height = 0
    }
  },
}

const station: StationModule = {
  content: content as unknown as StationModule['content'],
  scenes: [seedScene, branchScene],
}
export default station
