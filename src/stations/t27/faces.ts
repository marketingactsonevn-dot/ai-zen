import { h, s } from '../../core/dom'
import { blob, stoneArt, stroke } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import C from '../../content/tram-27.json'
import { F, f1, moon, place, stage, toro } from '../t25/kit'

/** Two eyes and a mouth made of cracks and shadow, centred on (x, y), `r` wide. */
function face(x: number, y: number, r: number) {
  return s('g', { class: 't27f-face' },
    s('path', { d: blob(x - r * 0.42, y, r * 0.15, r * 0.1, 3, 0.25, 10) + blob(x + r * 0.4, y - r * 0.05, r * 0.13, r * 0.09, 8, 0.25, 10) }),
    s('path', { d: stroke([[x - r * 0.42, y + r * 0.6], [x - r * 0.1, y + r * 0.66], [x + r * 0.2, y + r * 0.62], [x + r * 0.4, y + r * 0.68]], r * 0.08, 0.25, 0.35, 0.3) }))
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
    const rw = land ? Math.min(W * 0.24, 320) : W * 0.5
    const rock = land ? [W * 0.24, H * 0.84] : [W * 0.3, H * 0.74]
    const cl = land ? [W * 0.6, H * 0.24] : [W * 0.56, H * 0.18]
    const lt = land ? H * 0.52 : H * 0.36
    const lan = land ? [W * 0.84, H * 0.9] : [W * 0.8, H * 0.7]
    const cr = land ? Math.min(W * 0.13, 180) : W * 0.3
    const u = lt / 10
    const rockArt = stoneArt(rw, rw * 0.58, 27)
    rockArt.setAttribute('transform', `translate(${f1(rock[0])} ${f1(rock[1])})`)
    groups[0].replaceChildren(rockArt,
      s('path', { class: 't27f-moss', d: blob(rock[0] - rw * 0.1, rock[1] - rw * 0.55, rw * 0.22, rw * 0.05, 3, 0.25) + blob(rock[0] + rw * 0.2, rock[1] - rw * 0.5, rw * 0.12, rw * 0.04, 6, 0.3) }),
      face(rock[0] - rw * 0.02, rock[1] - rw * 0.33, rw * 0.15))
    groups[1].replaceChildren(
      moon(cl[0] + cr * 0.25, cl[1] - cr * 0.12, cr * 0.32),
      s('path', { class: 't27f-cloud', d: blob(cl[0], cl[1], cr, cr * 0.36, 11, 0.12) + blob(cl[0] - cr * 0.55, cl[1] + cr * 0.12, cr * 0.5, cr * 0.22, 5, 0.1), filter: 'url(#ink-wash)' }),
      s('path', { class: 't27f-cloud-edge', d: stroke([[cl[0] - cr * 1.05, cl[1] + cr * 0.3], [cl[0], cl[1] + cr * 0.36], [cl[0] + cr * 0.95, cl[1] + cr * 0.2]], 2.4, 0.2, 0.3, 0.2) }),
      face(cl[0] - cr * 0.15, cl[1] - cr * 0.02, cr * 0.22))
    groups[2].replaceChildren(s('g', { class: 'lit' }, toro(lan[0], lan[1], lt)), face(lan[0], lan[1] - u * 3.1, u * 0.7))
    // the stele: a small upright stone with an old green screen
    const sx = land ? W * 0.52 : W * 0.5, sy = land ? H * 0.94 : H * 0.97
    const sw = 118, sh = 70
    stele.replaceChildren(s('ellipse', { class: 'zk-sh', cx: sx + 4, cy: sy, rx: sw * 0.62, ry: 6 }),
      s('path', { class: 'zk-stone', d: `M${f1(sx - sw / 2)} ${f1(sy)}L${f1(sx - sw / 2 + 4)} ${f1(sy - sh + 12)}Q${f1(sx)} ${f1(sy - sh - 8)} ${f1(sx + sw / 2 - 4)} ${f1(sy - sh + 12)}L${f1(sx + sw / 2)} ${f1(sy)}Z`, fill: 'url(#p2-rock)' }))
    svg.replaceChildren(
      s('path', { class: 't27f-ground', d: stroke([[-10, land ? H * 0.9 : H * 0.78], [W * 0.5, land ? H * 0.88 : H * 0.76], [W + 10, land ? H * 0.91 : H * 0.79]], 3, 0.05, 0.05, 0.4), filter: 'url(#ink-rough)' }),
      ...groups, stele)
    place(eliza, sx - sw / 2 + 12, sy - sh + 10, sw - 24)
    eliza.style.height = `${sh - 22}px`
    const boxes = [[rock[0] - rw * 0.5, rock[1] - rw * 0.62, rw, rw * 0.62], [cl[0] - cr, cl[1] - cr * 0.5, cr * 2, cr], [lan[0] - u * 2.6, lan[1] - lt * 0.9, u * 5.2, lt * 0.9]]
    boxes.forEach(([x, y, w, hh], i) => {
      place(btns[i], x, y, w)
      btns[i].style.height = `${f1(hh)}px`
    })
    const lw = 150
    place(labs[0], rock[0] - lw / 2, rock[1] - rw * 0.62 - 44, lw)
    place(labs[1], cl[0] - lw / 2, cl[1] + cr * 0.42, lw)
    place(labs[2], lan[0] - lw / 2 - (land ? 0 : 20), lan[1] - lt * 0.92 - 40, lw)
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
