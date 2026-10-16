import { fill, h, s } from '../../core/dom'
import { blob, clamp, curve, onSize, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, pine, reeds, steppingStones, toro, wash, water } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F, f1, gdefs, ink, lantern, P, pebble, roof, wood, woodG } from './night'

const K = C.scenes.market

/** One thing on a small stall's counter, standing on (x, y), about u tall: the trade it sells. */
function ware(id: string, x: number, y: number, u: number): SVGElement[] {
  if (id === 'sales') {
    // a standing mirror with a presenter in it
    return [
      ink(stroke([[x - u * 0.3, y], [x, y - u * 0.25], [x + u * 0.3, y]], u * 0.08, 0.1, 0.1, 0.5), 'g12-edge', 'rough'),
      s('ellipse', { class: 't34m-glass', cx: f1(x), cy: f1(y - u * 0.62), rx: f1(u * 0.3), ry: f1(u * 0.4) }),
      ink(blob(x, y - u * 0.62, u * 0.3, u * 0.4, 5, 0.04, 14) + blob(x, y - u * 0.62, u * 0.24, u * 0.33, 6, 0.04, 14), 'g12-edge', 'rough', 'fill-rule:evenodd'),
      ink(blob(x, y - u * 0.78, u * 0.07, u * 0.07, 7, 0.1, 8) + stroke([[x, y - u * 0.7], [x + u * 0.02, y - u * 0.52], [x, y - u * 0.36]], u * 0.13, 0.1, 0.3, 0.4), 't34m-figure', 'rough'),
    ]
  }
  if (id === 'image') {
    // a magnifying lens leaning on a small block
    const cx = x - u * 0.05, cy = y - u * 0.55, R = u * 0.3
    return [
      s('circle', { class: 't34m-glass', cx: f1(cx), cy: f1(cy), r: f1(R) }),
      ink(stroke([[cx + R * 0.7, cy + R * 0.7], [cx + R * 1.5, y]], u * 0.12, 0.05, 0.2, 0.5) + blob(cx, cy, R, R, 3, 0.03, 16) + blob(cx, cy, R * 0.8, R * 0.8, 4, 0.03, 16), 'g12-edge', 'rough', 'fill-rule:evenodd'),
      ink(stroke(curve([cx - R * 0.5, cy - R * 0.1], [cx - R * 0.4, cy - R * 0.5], [cx - R * 0.05, cy - R * 0.55], 5), u * 0.06, 0.3, 0.3, 0.1), 'g12-rim'),
    ]
  }
  // the hub: many wares — a jar, a box, a rolled scroll
  return [
    s('path', { d: blob(x - u * 0.45, y - u * 0.3, u * 0.22, u * 0.3, 11, 0.06, 12), fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    ink(stroke([[x - u * 0.56, y - u * 0.58], [x - u * 0.34, y - u * 0.58]], u * 0.1, 0.1, 0.1, 0.5) + stroke([[x - u * 0.62, y - u * 0.1], [x - u * 0.45, y + u * 0.02], [x - u * 0.27, y - u * 0.1]], u * 0.06, 0.2, 0.2, 0.2), 'g12-edge', 'rough'),
    ink(`M${P([x - u * 0.12, y])}L${P([x - u * 0.12, y - u * 0.36])}L${P([x + u * 0.26, y - u * 0.38])}L${P([x + u * 0.26, y])}Z`, 't34m-box', 'rough'),
    ink(stroke([[x + u * 0.32, y - u * 0.06], [x + u * 0.8, y - u * 0.1]], u * 0.16, 0.05, 0.05, 0.8), 't34m-scroll', 'rough'),
    ink(stroke([[x + u * 0.8, y - u * 0.1], [x + u * 0.86, y - u * 0.1]], u * 0.2, 0.1, 0.1, 0.8), 'g12-edge'),
  ]
}

/** Scene 1 — a night market by the lake: one big stall under a cluster of lanterns, two small ones under a single lantern. Tap a task slip, then a stall. */
export function marketScene(ctx: SceneCtx) {
  gdefs()
  let picked = -1
  const placed = new Set<number>()
  const factShown = new Set<string>()
  const note = h('div', { class: 't34m-note', 'aria-live': 'polite' })

  const slips = K.tasks.map((t, i) =>
    h('button', { class: 't34m-slip g12-paper', type: 'button', 'aria-pressed': 'false', style: `--tilt:${[-1.4, 1.1, -0.6, 1.6][i % 4]}deg`, onClick: () => pick(i) }, t.text))
  const stalls = K.stalls.map((st, i) => {
    const paint = s('svg', { class: 't34m-paint', 'aria-hidden': 'true' })
    const name = h('span', { class: 't34m-name' }, st.name)
    const body = h('span', { class: 't34m-body' }, h('span', { class: 't34m-what' }, st.what), h('span', { class: 't34m-ex' }, st.example))
    const basket = h('ul', { class: 't34m-basket' })
    const src = (C.sources as Record<string, { url?: string }>)[st.source]
    const btn = h('button', { class: 't34m-drop', type: 'button', onClick: () => drop(i) }, name, body)
    const el = h('div', { class: `t34m-stall t34m-${st.id}` }, paint, btn,
      src?.url ? h('a', { class: 't34m-link', href: src.url, target: '_blank', rel: 'noopener' }, K.officialLabel) : null, basket)
    return { el, btn, basket, paint, name, id: st.id }
  })

  const bg = s('svg', { class: 't34m-bg', 'aria-hidden': 'true' })
  const row = h('div', { class: 't34m-row', role: 'group', 'aria-label': K.group }, ...stalls.map((x) => x.el))
  const flow = h('div', { class: 't34m-flow' },
    row,
    h('div', { class: 't34m-tasks', role: 'group', 'aria-label': K.taskGroup }, ...slips),
    note,
    h('p', { class: 't34m-vol' }, K.volatile))
  const root = h('div', { class: 't34 t34m' }, bg, h('p', { class: 'visually-hidden' }, K.art), flow)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  // the flow fills the scene, so its size follows both the scene and the notes that grow inside it
  ctx.onCleanup(onSize(flow, layout))

  /** Paint the market for the current layout: measure every stall first, then build the SVG. */
  function layout() {
    const W = root.clientWidth, H = Math.max(root.clientHeight, root.scrollHeight)
    if (W < 60 || H < 60) return
    const R = root.getBoundingClientRect()
    const geo = stalls.map((st) => {
      const e = st.el.getBoundingClientRect(), b = st.btn.getBoundingClientRect(), n = st.name.getBoundingClientRect()
      return { x: e.left - R.left, y: e.top - R.top + root.scrollTop, w: e.width, lz: b.top - e.top, bh: b.height, nb: n.bottom - b.top }
    })
    geo.forEach((g, i) => paintStall(stalls[i].paint, g.w, g.lz, g.bh, g.nb, stalls[i].id, 340 + i * 13))
    paintBack(W, H, geo)
  }

  function paintStall(svg: SVGSVGElement, w: number, lz: number, bh: number, nb: number, id: string, seed: number) {
    const r = rng(seed)
    const top = lz, bot = lz + bh
    const u = clamp(lz / 64, 0.62, 1.4)
    const cTop = bot - 15 * u
    const hub = id === 'hub'
    // cloth awning under the roof, its hem in tabs with slits (noren); the name sits on it
    const hem = top + nb + 9 * u
    const tabs = hub ? 4 : 3
    let cloth = `M${P([7, top + 9 * u])}L${P([w - 7, top + 9 * u])}`
    for (let k = tabs; k > 0; k--) {
      const x1 = 7 + ((w - 14) * k) / tabs, x0 = 7 + ((w - 14) * (k - 1)) / tabs
      cloth += `L${P([x1 - 1, hem + (r() - 0.5) * 3])}Q${P([(x0 + x1) / 2, hem + 4 * u])} ${P([x0 + 1, hem + (r() - 0.5) * 3])}`
      if (k > 1) cloth += `L${P([x0 + 1, hem - 6 * u])}L${P([x0 - 1, hem - 6 * u])}`
    }
    cloth += 'Z'
    let folds = ''
    for (let k = 0; k < tabs * 2; k++) {
      const x = 12 + r() * (w - 24)
      folds += stroke([[x, top + 13 * u], [x + (r() - 0.5) * 3, hem - 4 * u]], 1 + r(), 0.2, 0.3, 0.1)
    }
    // the cord over the stall and its lanterns: a cluster in many inks on the big stall, one on a small one
    const c0: Pt = [11, 5 * u], c1: Pt = [w - 11, 5 * u], cm: Pt = [w / 2, 5 * u + lz * 0.26]
    const cord = curve(c0, cm, c1, 24)
    const lamps: SVGElement[] = []
    if (hub) {
      const tones = [5, 1, 0, 2, 3, 1, 4, 0]
      const n = Math.max(5, Math.min(8, Math.round(w / 44)))
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n
        const [x, y] = cord[Math.round(t * 24)]
        const rr = (6.5 + r() * 3.2) * u
        lamps.push(lantern(x, y, rr, seed + k, Math.max(2, lz - y - rr * 2.9 - 6 * u - r() * 10 * u), tones[k % tones.length]))
      }
    } else {
      const [x, y] = cord[12]
      lamps.push(lantern(x, y, 10.5 * u, seed, Math.max(2, lz - y - 10.5 * u * 2.9 - 5 * u)))
    }
    const posts = [wood([10, 2], [11, bot + 6 * u], 5.5 * u, seed + 1), wood([w - 10, 2], [w - 11, bot + 6 * u], 5.5 * u, seed + 2)]
    const roofD = roof(0, w, top, u)
    const counter = [wood([-4 * u, cTop], [w + 4 * u, cTop + 0.5], 7.5 * u, seed + 4), wood([5, cTop + 9 * u], [w - 5, cTop + 9.5 * u], 9 * u, seed + 5)]
    let slats = ''
    for (let x = 16; x < w - 12; x += 13 + r() * 6) slats += stroke([[x, cTop + 5 * u], [x + (r() - 0.5), bot + 6 * u]], 0.9 + r() * 0.6, 0.1, 0.1, 0.4)
    const wares = hub ? [...ware('hub', 26 * u + 4, cTop - 3 * u, 30 * u), ...ware('hub', w - 34 * u, cTop - 3 * u, 26 * u)] : ware(id, w - 22 * u, cTop - 3 * u, 30 * u)
    svg.replaceChildren(
      s('ellipse', { class: 't34m-pick', cx: f1(w / 2), cy: f1((top + bot) / 2), rx: f1(w * 0.62), ry: f1(bh * 0.62), fill: 'url(#p2-lamp)' }),
      wash(blob(w / 2, bot + 6 * u, w * 0.56, 7 * u, seed + 6, 0.2), 0.22),
      s('rect', { class: 't34m-wall', x: 10, y: f1(top + 8 * u), width: f1(w - 20), height: f1(cTop - top - 8 * u) }),
      ink(blob(w / 2, hem + (cTop - hem) * 0.2, w * 0.46, (cTop - hem) * 0.42, seed + 7, 0.12), 'p2p-wash t34m-inside', 'wash'),
      s('ellipse', { class: 't34m-warm', cx: f1(w / 2), cy: f1(hem + 4), rx: f1(w * 0.42), ry: f1((cTop - hem) * 0.7), fill: 'url(#g12-pool)' }),
      ink(cord.length ? `M${cord.map(P).join('L')}` : '', 't34m-cord'),
      ...lamps,
      woodG(posts),
      ink(roofD, 'g12-eave', 'rough'),
      ink(stroke(curve([4 * u, top + 1 * u], [w / 2, top - 4.6 * u], [w - 4 * u, top + 1 * u], 12), 1.6 * u, 0.2, 0.2, 0.2), 'g12-rim'),
      ink(cloth, `t34m-cloth${hub ? ' hub' : ''}`, 'wash'),
      ink(folds, 't34m-fold', 'dry'),
      ...wares,
      woodG(counter),
      ink(slats, 'g12-wood-grain', 'dry'))
  }

  /** The lake behind the stalls, the moon over the gap between the rows, more stalls along the shore, the stone path. */
  function paintBack(W: number, H: number, geo: { x: number; y: number; w: number; lz: number; bh: number }[]) {
    const rowTop = Math.min(...geo.map((g) => g.y))
    const yh = rowTop + geo[0].lz + 10 // the far shore: just under the roofs
    const ys = Math.max(...geo.map((g) => g.y + g.lz + g.bh)) + 4 // where the stalls stand
    const left = Math.min(...geo.map((g) => g.x)), right = Math.max(...geo.map((g) => g.x + g.w))
    const gapL = geo[0].x + geo[0].w, gapR = geo[1].x
    const wideGap = gapR - gapL > 70
    const gx = wideGap ? (gapL + gapR) / 2 : W * 0.5
    const mr = clamp(W * 0.022, 13, 26)
    const my = clamp(rowTop * 0.45, mr * 1.6, Math.max(mr * 1.6, yh - mr * 4))
    const mx = wideGap ? gx : clamp(right - mr * 2, W * 0.6, W - mr * 2)
    const stop = (o: number, a: number) => s('stop', { offset: o, style: `stop-color:#fff;stop-opacity:${a}` })
    const fade = s('mask', { id: 't34m-fade', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: f1(W), height: f1(H) },
      s('linearGradient', { id: 't34m-fade-g' }, stop(0, 0), stop(0.12, 1), stop(0.88, 1), stop(1, 0)),
      s('rect', { x: 0, y: 0, width: f1(W), height: f1(H), fill: 'url(#t34m-fade-g)' }))
    const out: SVGElement[] = [
      s('defs', null, fade),
      mist(W / 2, yh - 20, W * 0.6, 90),
      moon(mx, my, mr, 34, true),
      hills(-20, W + 20, yh, clamp(yh * 0.42, 40, 110), 341, 0.9, 6),
      hills(W * 0.55, W + 30, yh, clamp(yh * 0.3, 30, 80), 342, 0.65, 2),
      mist(W / 2, yh, W * 0.7, 26),
      s('g', { mask: 'url(#t34m-fade)' },
        s('rect', { class: 't34m-lake', x: 0, y: f1(yh), width: f1(W), height: f1(ys - yh) }),
        water(0, yh, W, ys, 343, mx, false),
        wash(`M${P([-10, ys - 4])}Q${P([W / 2, ys - 10])} ${P([W + 10, ys - 4])}L${P([W + 10, ys + 40])}Q${P([W / 2, ys + 70])} ${P([-10, ys + 40])}Z`, 0.07)),
    ]
    // stalls further along the shore, smaller and fainter into the mist, each with one lantern
    const side = (x0: number, x1: number, dir: number) => {
      const room = Math.abs(x1 - x0)
      if (room < 64) return
      const hh = (ys - yh) * 0.55
      for (let k = 0, x = x0 + dir * 16; k < 3 && Math.abs(x - x0) < room - 30; k++) {
        const sc = 1 - k * 0.24
        const w = 56 * sc, y = ys - 2 - k * 6
        out.push(s('g', { class: 't34m-far', style: `opacity:${(0.85 - k * 0.22).toFixed(2)}` },
          woodG([wood([x, y], [x, y - hh * sc], 3.5 * sc, 345 + k), wood([x + dir * w, y], [x + dir * w, y - hh * sc], 3.5 * sc, 346 + k), wood([x - dir * 5, y - hh * sc], [x + dir * (w + 5), y - hh * sc - 2], 5 * sc, 347 + k, -2)]),
          ink(`M${P([x, y - hh * sc + 2])}L${P([x + dir * w, y - hh * sc + 1])}L${P([x + dir * w, y - hh * sc * 0.62])}L${P([x, y - hh * sc * 0.6])}Z`, 't34m-cloth far', 'wash'),
          lantern(x + dir * w * 0.5, y - hh * sc - 1, 6 * sc, 350 + k, 4 * sc, k % 2 ? 1 : 0)))
        x += dir * (w + 22 * sc)
      }
    }
    side(left - 10, 0, -1)
    side(right + 10, W, 1)
    // ground under the stalls and the path of stones between the two rows, coming toward us
    out.push(wash(blob(W / 2, ys + 2, W * 0.5, 10, 344, 0.2), 0.14))
    // the stone path between the two rows: from the shore toward us, under the slips, larger as it comes near
    const sz = clamp((gapR - gapL) * 0.3, 18, 40)
    if (wideGap) out.push(steppingStones([gx, ys - (ys - yh) * 0.22], [gx - 8, ys + 46], 4, sz, 348))
    // framing: an old pine leaning in from the far left shore, a stone lantern and grass in the near corners
    if (left > 90) out.splice(4, 0, pine(left * 0.42, ys - 6, Math.min(ys * 0.92, 330), 355, 1))
    const th = clamp(H * 0.16, 60, 120)
    const ty = Math.min(H - 18, ys + th * 1.5)
    if (W > 700) out.push(wash(blob(W * 0.09, ty, th * 0.8, th * 0.1, 358, 0.2), 0.14), toro(W * 0.09, ty, th, true), pebble(W * 0.09 + th * 0.36, ty + 6, th * 0.14, 356), grass(W * 0.09 - th * 0.4, ty + 2, 20, 359))
    out.push(reeds(left - 18, ys + 2, 34, 351, 7), reeds(right + 22, ys + 2, 28, 352, 6), grass(W * 0.16, H - 14, 34, 353), grass(W * 0.88, H - 20, 30, 354), grass(W * 0.8, H - 10, 22, 357))
    bg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    bg.style.height = `${f1(H)}px`
    bg.replaceChildren(...out)
  }

  function pick(i: number) {
    picked = picked === i ? -1 : i
    slips.forEach((b, k) => b.setAttribute('aria-pressed', String(k === picked)))
    root.classList.toggle('is-picking', picked >= 0)
    stalls.forEach((st, k) => st.btn.setAttribute('aria-label', picked >= 0 ? fill(K.dropAria, { task: K.tasks[picked].text, stall: K.stalls[k].name }) : K.stalls[k].name))
  }

  function drop(si: number) {
    if (picked < 0) {
      slips.find((_, k) => !placed.has(k))?.focus()
      return
    }
    const t = K.tasks[picked]
    const st = K.stalls[si]
    if (!t.fits.includes(st.id)) {
      note.replaceChildren(h('p', { class: 't34m-wrong' }, K.wrong))
      slips[picked].classList.remove('shake')
      void slips[picked].offsetWidth
      slips[picked].classList.add('shake')
      ctx.chime('low')
      return
    }
    ctx.chime('ok')
    placed.add(picked)
    slips[picked].hidden = true
    stalls[si].basket.append(h('li', { class: 'g12-paper' }, t.text))
    const others = t.fits.filter((f) => f !== st.id).map((f) => K.stalls.find((x) => x.id === f)!.name)
    note.replaceChildren(h('p', null, h('strong', null, K.right), ' ', t.why, others.length ? h('span', { class: 't34m-also' }, ' ' + fill(K.also, { stalls: others.join(', ') })) : null))
    // the stall's own claim (◇) the first time something lands there
    const fx = K.facts.filter((f) => f.source.startsWith(st.source))
    if (!factShown.has(st.id) && fx[0]) {
      factShown.add(st.id)
      note.append(ctx.fact(F(fx[0]), 'p', 't34m-fact'))
    }
    pick(-1)
    const next = slips.find((_, k) => !placed.has(k))
    if (next) next.focus()
    else {
      stalls[si].btn.focus()
      ctx.insight(F(K.insight), K.detail)
    }
  }
}
