import { h, s } from '../../core/dom'
import { blob, curve, rng, rock, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, toro } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import C from '../../content/tram-27.json'
import { F, f1, grad, place, stage } from '../t25/kit'

/** Two eyes and a mouth made of cracks and shade, centred on (x, y), `r` wide: faint until found. */
function face(x: number, y: number, r: number, seed: number) {
  const q = rng(seed)
  const crack = (pts: Pt[], w: number) => stroke(pts.map(([a, b]) => [a + (q() - 0.5) * r * 0.04, b + (q() - 0.5) * r * 0.04] as Pt), w, 0.3, 0.4, 0.15)
  return s('g', { class: 't27f-face' },
    s('path', { class: 't27f-eye', d:
      crack([[x - r * 0.6, y + r * 0.02], [x - r * 0.42, y - r * 0.06], [x - r * 0.24, y + r * 0.01]], r * 0.11) +
      crack([[x + r * 0.22, y - r * 0.03], [x + r * 0.4, y - r * 0.1], [x + r * 0.58, y - r * 0.02]], r * 0.1) +
      crack([[x - r * 0.46, y + r * 0.55], [x - r * 0.18, y + r * 0.68], [x + r * 0.1, y + r * 0.64], [x + r * 0.44, y + r * 0.56]], r * 0.07), filter: 'url(#ink-rough)' }))
}

/** A big garden rock (w × h, foot centred on (x, y)): washes, a shaded flank, texture strokes, a moonlit crown, moss on top. */
function bigRock(x: number, y: number, w: number, hh: number, seed: number) {
  const { top } = rock(w, hh, seed)
  const r = rng(seed + 1)
  const T = (p: Pt): Pt => [x + p[0], y + p[1]]
  const out = `M${top.map((p) => T(p).map(f1).join(' ')).join('L')}Z`
  let cun = ''
  for (let i = 3; i < top.length - 3; i += 2) {
    const [px, py] = T(top[i])
    if (py > y - hh * 0.3 || r() < 0.3) continue
    const len = hh * (0.18 + r() * 0.3), dir = i < top.length / 2 ? -1 : 1
    cun += stroke(curve([px, py + 3], [px + dir * len * 0.2, py + len * 0.5], [px + dir * len * 0.08, py + len], 6), 1.4 + r() * 1.8, 0.1, 0.5, 0.1)
  }
  let dots = ''
  for (let i = 0; i < 46; i++) {
    const k = 3 + Math.floor(r() * (top.length - 6)), [px, py] = T(top[k])
    const dy = r() * hh * 0.16
    dots += stroke([[px + (r() - 0.5) * 8, py + dy], [px + 3 + r() * 2, py + dy + 1.5]], 2.6 + r() * 2.6, 0.35, 0.35, 0.45)
  }
  return [
    s('ellipse', { class: 't27f-sh', cx: f1(x + w * 0.06), cy: f1(y + 2), rx: f1(w * 0.58), ry: f1(Math.max(4, hh * 0.08)) }),
    s('path', { class: 't27f-rock', d: out, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { d: out, fill: 'url(#p2-shade)' }),
    s('path', { class: 'zk-ink t27f-cun', d: cun, filter: 'url(#ink-dry)' }),
    s('path', { class: 'zk-ink t27f-edge', d: stroke(top.slice(Math.floor(top.length * 0.45)).map(T), Math.max(2, w * 0.012), 0.2, 0.1, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 't27f-crown', d: stroke(top.slice(4, Math.floor(top.length * 0.55)).map(T), Math.max(2, w * 0.012), 0.3, 0.4, 0.1) }),
    s('path', { class: 't27f-moss', d: blob(x - w * 0.12, y - hh * 0.9, w * 0.26, hh * 0.08, seed + 2, 0.3, 14) + blob(x + w * 0.2, y - hh * 0.82, w * 0.14, hh * 0.06, seed + 3, 0.3, 12), filter: 'url(#ink-wash)' }),
    s('path', { class: 't27f-dots', d: dots }),
  ]
}

/** A cloud drawn across the moon: long washes laid one over another, an ink underside broken in two places. */
function cloud(x: number, y: number, R: number) {
  const lens = (x0: number, y0: number, len: number, w: number) =>
    `M${f1(x0)} ${f1(y0)}Q${f1(x0 + len * 0.45)} ${f1(y0 - w * 1.7)} ${f1(x0 + len)} ${f1(y0 - w * 0.4)}Q${f1(x0 + len * 0.55)} ${f1(y0 + w * 0.6)} ${f1(x0)} ${f1(y0)}Z`
  const body = lens(x - R * 1.15, y + R * 0.12, R * 2.2, R * 0.26) + lens(x - R * 0.6, y + R * 0.3, R * 1.8, R * 0.2) + lens(x - R * 0.2, y - R * 0.02, R * 1.25, R * 0.2)
  return [
    s('path', { class: 't27f-cloud', d: body, filter: 'url(#ink-wash)' }),
    s('path', { class: 'zk-ink t27f-cloud-ink', d: stroke([[x - R * 1.1, y + R * 0.16], [x - R * 0.4, y + R * 0.3]], R * 0.04, 0.2, 0.4, 0.2) + stroke([[x - R * 0.25, y + R * 0.36], [x + R * 0.55, y + R * 0.34], [x + R * 1.05, y + R * 0.2]], R * 0.035, 0.3, 0.4, 0.2), filter: 'url(#ink-rough)' }),
  ]
}

/** Scene 1 — a moss rock, a cloud across the moon, a stone lantern: each hides a face. Then a small stele: ELIZA, 1966. */
export function facesScene(ctx: SceneCtx) {
  const K = C.scenes.faces
  const found = K.things.map(() => false)
  let read = false
  const groups = K.things.map(() => s('g', { class: 't27f-thing-g' }))
  const btns = K.things.map((t, i) => h('button', { class: 'zk-hit t27f-thing', type: 'button', 'aria-label': t.aria, 'aria-pressed': 'false', onClick: () => look(i) }))
  const labs = K.things.map((t) => h('p', { class: 'zk-lab t27f-lab' }, t.label, h('small', { class: 't27f-found' }, K.found)))
  const stele = s('g', { class: 't27f-stele' })
  const eliza = h('button', { class: 't27f-eliza', type: 'button', 'aria-label': K.eliza.aria, hidden: true, onClick: chat }, K.eliza.label)
  const talk = h('div', { class: 'zk-note t27f-talk', hidden: true },
    h('p', { class: 't27f-user' }, K.eliza.user), h('p', { class: 't27f-bot' }, K.eliza.bot), ctx.fact(F(K.eliza.note), 'div', 'zk-small'))

  const { root, svg } = stage(ctx, 't27f', K.art, K.insights, (W, H) => {
    const land = W / H > 1.05
    const gy = land ? H * 0.84 : H * 0.74 // the ground line
    const rw = land ? Math.min(W * 0.26, 340) : W * 0.52, rh = rw * 0.6
    const rk: Pt = land ? [W * 0.24, gy + 6] : [W * 0.3, gy + 6]
    const cl: Pt = land ? [W * 0.58, H * 0.22] : [W * 0.56, H * 0.17]
    const cr = land ? Math.min(W * 0.13, 180) : W * 0.3
    const lt = land ? H * 0.56 : H * 0.38
    const lan: Pt = land ? [W * 0.84, gy + 4] : [W * 0.8, gy + 2]
    const u = lt / 10
    const r = rng(2701)
    groups[0].replaceChildren(...bigRock(rk[0], rk[1], rw, rh, 2702), face(rk[0] - rw * 0.02, rk[1] - rh * 0.5, rw * 0.15, 2703))
    groups[1].replaceChildren(
      mist(cl[0] + cr * 0.25, cl[1] - cr * 0.1, cr * 1.6, cr * 0.6),
      moon(cl[0] + cr * 0.25, cl[1] - cr * 0.12, cr * 0.32, 2704, false),
      ...cloud(cl[0], cl[1] + cr * 0.02, cr),
      face(cl[0] - cr * 0.15, cl[1] - cr * 0.01, cr * 0.22, 2706))
    groups[2].replaceChildren(toro(lan[0], lan[1], lt, true),
      s('g', { class: 't27f-face' },
        s('path', { class: 't27f-eyelit', d: blob(lan[0] - u * 0.32, lan[1] - u * 6.75, u * 0.15, u * 0.15, 2707, 0.1, 8) + blob(lan[0] + u * 0.32, lan[1] - u * 6.75, u * 0.15, u * 0.15, 2708, 0.1, 8) }),
        s('path', { class: 't27f-eye', d: stroke([[lan[0] - u * 0.5, lan[1] - u * 4.95], [lan[0] - u * 0.1, lan[1] - u * 4.85], [lan[0] + u * 0.5, lan[1] - u * 4.97]], u * 0.12, 0.3, 0.3, 0.2), filter: 'url(#ink-rough)' })))
    // the stele: a small upright stone with an old green screen set into it
    const sx = land ? W * 0.53 : W * 0.5, sy = land ? gy + 10 : H * 0.97
    const sw = 118, sh = 74
    const slab = `M${f1(sx - sw / 2)} ${f1(sy)}L${f1(sx - sw / 2 + 4)} ${f1(sy - sh + 12)}Q${f1(sx)} ${f1(sy - sh - 8)} ${f1(sx + sw / 2 - 4)} ${f1(sy - sh + 12)}L${f1(sx + sw / 2)} ${f1(sy)}Z`
    stele.replaceChildren(
      s('ellipse', { class: 't27f-sh', cx: f1(sx + 4), cy: f1(sy), rx: f1(sw * 0.62), ry: 6 }),
      s('path', { class: 't27f-rock', d: slab, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
      s('path', { d: slab, fill: 'url(#p2-shade)' }),
      s('rect', { class: 't27f-screen', x: f1(sx - sw / 2 + 10), y: f1(sy - sh + 8), width: f1(sw - 20), height: f1(sh - 20), rx: 4 }),
      s('path', { class: 'zk-ink t27f-edge', d: stroke([[sx + sw / 2 - 4, sy - sh + 12], [sx + sw / 2, sy]], 2, 0.2, 0.2, 0.3), filter: 'url(#ink-rough)' }))
    let moss = ''
    for (let i = 0; i < 40; i++) {
      const x = r() * W, y = gy + 4 + Math.pow(r(), 2) * (H - gy - 4) * 0.6
      moss += stroke([[x, y], [x + 2.5 + r() * 2, y + 1.2]], 2.2 + r() * 2, 0.35, 0.35, 0.45)
    }
    svg.replaceChildren(
      hills(-W * 0.05, W * 1.05, gy - H * 0.06, H * 0.22, 2709, 0.9, 6),
      mist(W * 0.5, gy - H * 0.06, W * 0.7, H * 0.08),
      s('path', { class: 't27f-groundwash', d: `M-10 ${f1(gy)}Q${f1(W * 0.5)} ${f1(gy - 8)} ${f1(W + 10)} ${f1(gy + 2)}L${f1(W + 10)} ${f1(H)}L-10 ${f1(H)}Z`, fill: grad(svg, [[0, '--moss-b', 1], [1, '--moss-b', 0]], 'v', [0, gy - 6, 0, H]) }),
      s('path', { class: 'zk-ink t27f-ground', d: stroke([[-10, gy + 1], [W * 0.5, gy - 4], [W + 10, gy + 2]], 2.4, 0.05, 0.05, 0.4), filter: 'url(#ink-rough)' }),
      s('path', { class: 't27f-dots', d: moss }),
      ...[0.08, 0.4, 0.66, 0.95].map((k, i) => grass(W * k, gy + 6 + i * 3, 22, 2710 + i)),
      ...groups, stele)
    place(eliza, sx - sw / 2 + 12, sy - sh + 10, sw - 24)
    eliza.style.height = `${sh - 24}px`
    const boxes = [[rk[0] - rw * 0.5, rk[1] - rh * 1.02, rw, rh], [cl[0] - cr, cl[1] - cr * 0.5, cr * 2, cr], [lan[0] - u * 2.6, lan[1] - lt * 0.95, u * 5.2, lt * 0.95]]
    boxes.forEach(([x, y, w, hh], i) => {
      place(btns[i], x, y, w)
      btns[i].style.height = `${f1(hh)}px`
    })
    const lw = 150
    place(labs[0], rk[0] - lw / 2, rk[1] - rh * 1.02 - 44, lw)
    place(labs[1], cl[0] - lw / 2, cl[1] + cr * 0.42, lw)
    place(labs[2], lan[0] - lw / 2 - (land ? 0 : 20), lan[1] - lt * 0.98 - 40, lw)
    if (land) place(talk, W * 0.05, H * 0.06, Math.min(W * 0.32, 360))
    else place(talk, 12, H * 0.04, W * 0.62)
  })
  root.append(...btns, ...labs, eliza, talk)
  ctx.prompt(K.prompt)

  function look(i: number) {
    if (!found[i]) {
      found[i] = true
      groups[i].classList.add('found')
      labs[i].classList.add('found')
      btns[i].setAttribute('aria-pressed', 'true')
      ctx.chime('soft')
    }
    if (found.filter(Boolean).length === 1 && !read) ctx.insight(F(K.insights[0]), F(K.insights[0].detail))
    if (found.every(Boolean)) {
      eliza.hidden = false
      root.classList.add('all')
    }
  }
  function chat() {
    talk.hidden = false
    if (!read) {
      read = true
      ctx.chime('ok')
      ctx.insight(F(K.insights[1]), F(K.insights[1].detail))
    }
  }
}
