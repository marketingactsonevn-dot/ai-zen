import raw from '../../content/tram-33.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { onSize, p2Defs } from '../../ui/part2/ink'
import { toro } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { blob, cardSheet, curve, ground, live, night, rng, stroke } from '../t31/kit'

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

const K = raw.scenes.keys

/** A bronze key (viewBox 0 0 60 24): a ring bow with a cut-out, a shaft, a toothed bit, moonlight along its back. */
const keyArt = () => s('svg', { class: 't33y-key', viewBox: '0 0 60 24', 'aria-hidden': 'true' },
  s('circle', { class: 't33y-peg', cx: 11, cy: 3.2, r: 2.6 }),
  s('path', { class: 't33y-metal', d: 'M11 2.6A9.4 9.4 0 1 1 10.99 2.6ZM11 8.4A3.6 3.6 0 1 0 11.01 8.4Z', 'fill-rule': 'evenodd', filter: 'url(#ink-rough)' }),
  s('path', { class: 't33y-metal', d: 'M19.5 10.2Q36 9.4 56 10.4L56.6 13.8Q36 14.6 19.5 13.8ZM42 13.6h4.2v5.6H42ZM49.4 13.6h4.4l-.4 7.4h-4Z', filter: 'url(#ink-rough)' }),
  s('path', { class: 't33y-glint', d: stroke([[4, 9], [8, 4], [14, 3.4]], 1.4, 0.2, 0.3, 0.2) + stroke([[22, 10.6], [54, 10.8]], 0.9, 0.1, 0.3, 0.2) }))

/** The stone lantern with the bunch of keys hanging under its roof (viewBox 0 0 120 130). */
function toroArt(): SVGSVGElement {
  p2Defs()
  // an iron ring on a cord from the roof's corner, five small keys hanging from it
  let keys = ''
  for (let i = 0; i < 5; i++) {
    const a = 0.5 + i * 0.5
    const x = 95 + Math.cos(a) * 7, y = 70 + Math.sin(a) * 7
    keys += stroke([[x, y], [x + Math.cos(a) * 14, y + Math.sin(a) * 14 + 4]], 1.8, 0.1, 0.2, 0.4)
  }
  return s('svg', { class: 't33y-toro', viewBox: '0 0 120 130', 'aria-hidden': 'true' },
    toro(56, 126, 112, true),
    s('path', { class: 'g11-thread', d: 'M94 55Q95 60 95 63' }),
    s('circle', { class: 't33y-ring', cx: 95, cy: 70, r: 7 }),
    s('path', { class: 't33y-keys', d: keys }),
    s('path', { class: 't33y-glint', d: stroke(curve([90, 66], [95, 62], [100, 66], 6), 1.2, 0.2, 0.3, 0.2) }))
}

/** The keep side (px W × H, keys from y = top): a weathered plank board hung by a cord under the lantern, nails, moss. */
function paintBoard(svg: SVGSVGElement, W: number, H: number, top: number) {
  const r = rng(3360)
  const x0 = 4, x1 = W - 4, y0 = top - 6, y1 = H - 4
  const planks = 4
  let seams = '', grain = '', nails = ''
  for (let k = 1; k < planks; k++) {
    const x = x0 + ((x1 - x0) * k) / planks + (r() - 0.5) * 3
    seams += stroke([[x, y0 + 2], [x + (r() - 0.5) * 2, y1 - 2]], 1.6, 0.05, 0.05, 0.4)
  }
  for (let i = 0; i < 22; i++) {
    const x = x0 + 6 + r() * (x1 - x0 - 12), y = y0 + 8 + r() * (y1 - y0 - 30)
    grain += stroke([[x, y], [x + 0.6, y + 18 + r() * 30], [x - 0.4, y + 36 + r() * 40]], 0.7, 0.2, 0.3, 0.2)
  }
  for (const y of [y0 + 16, y1 - 18]) for (const x of [x0 + 10, x1 - 10]) nails += blob(x, y, 1.8, 1.8, 3361, 0, 6)
  const batten = (y: number) => stroke([[x0 - 2, y], [(x0 + x1) / 2, y + 1], [x1 + 2, y]], 7, 0.02, 0.02, 0.7)
  svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
  svg.replaceChildren(
    s('path', { class: 'g11-thread', d: `M${f1(x0 + 14)} ${f1(y0)}L${f1(W / 2)} ${f1(Math.max(4, y0 - 26))}L${f1(x1 - 14)} ${f1(y0)}` }),
    ground(W / 2 + 6, y1 + 4, W * 0.5, 7, 3362, 0.22),
    s('path', { class: 'g11-wood-face t33y-plank', d: `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y0 + 1.5)}L${f1(x1 - 1)} ${f1(y1)}L${f1(x0 + 1)} ${f1(y1 - 1)}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wood-grain', d: grain }),
    s('path', { class: 'g11-wash t33y-seam', d: seams }),
    s('path', { class: 'g11-wood-face t33y-batten', d: batten(y0 + 16) + batten(y1 - 18), filter: 'url(#ink-rough)' }),
    s('path', { class: 't33y-nail', d: nails }),
    s('path', { class: 'g11-wash t33y-boardink', d: stroke([[x1, y0 + 2], [x1 + 0.5, (y0 + y1) / 2], [x1 - 1, y1]], 2.4, 0.05, 0.05, 0.4) + stroke([[x0, y1 - 1], [W / 2, y1 + 0.5], [x1, y1]], 2.4, 0.05, 0.05, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit', d: stroke([[x0 + 2, y0 + 1.5], [W * 0.6, y0 + 2]], 1.6, 0.1, 0.4, 0.2) + stroke([[x0 + 2, y0 + 4], [x0 + 1.6, y1 * 0.6]], 1.4, 0.1, 0.5, 0.2) }),
    s('path', { class: 'g11-mossy', d: blob(x0 + 14, y1 - 3, 22, 5, 3363, 0.35, 12) + blob(x1 - 8, y1 - 6, 10, 7, 3364, 0.35, 10), filter: 'url(#ink-wash)' }))
}

/** The give side (px W × H): a round-cornered woven bamboo tray — rim, a brushed weave, its shadow, two ghost keys. */
function paintTray(svg: SVGSVGElement, W: number, H: number, top: number) {
  const x0 = 6, y0 = Math.max(2, top - 8), x1 = W - 6, y1 = H - 8, rad = Math.min(26, W * 0.12)
  const rim = `M${f1(x0 + rad)} ${f1(y0)}L${f1(x1 - rad)} ${f1(y0)}Q${f1(x1)} ${f1(y0)} ${f1(x1)} ${f1(y0 + rad)}L${f1(x1)} ${f1(y1 - rad)}Q${f1(x1)} ${f1(y1)} ${f1(x1 - rad)} ${f1(y1)}L${f1(x0 + rad)} ${f1(y1)}Q${f1(x0)} ${f1(y1)} ${f1(x0)} ${f1(y1 - rad)}L${f1(x0)} ${f1(y0 + rad)}Q${f1(x0)} ${f1(y0)} ${f1(x0 + rad)} ${f1(y0)}Z`
  // the weave: a basket-weave tile (bamboo splints over and under), set on the diagonal like a nia tray
  const splints = (x: number, y: number, horiz: boolean) => [2.5, 6, 9.5].map((o) => horiz
    ? stroke([[x + 0.6, y + o], [x + 6, y + o + 0.3], [x + 11.4, y + o]], 2.6, 0.12, 0.12, 0.5)
    : stroke([[x + o, y + 0.6], [x + o + 0.3, y + 6], [x + o, y + 11.4]], 2.6, 0.12, 0.12, 0.5)).join('')
  const tile = splints(0, 0, true) + splints(12, 0, false) + splints(0, 12, false) + splints(12, 12, true)
  const ghost = (x: number, y: number) =>
    `M${f1(x)} ${f1(y)}m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0` + `M${f1(x + 8)} ${f1(y - 1.5)}h30v3h-30ZM${f1(x + 28)} ${f1(y + 1.5)}h3v5h-3ZM${f1(x + 34)} ${f1(y + 1.5)}h3v6h-3Z`
  const gx = W / 2 - 18, gy = (y0 + y1) / 2
  svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
  svg.replaceChildren(
    s('defs', null,
      s('clipPath', { id: 't33y-weave' }, s('path', { d: rim })),
      s('pattern', { id: 't33y-nia', width: 24, height: 24, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
        s('path', { class: 't33y-splint', d: tile }))),
    s('path', { class: 't33y-trayshadow', d: rim, transform: 'translate(4 7)', filter: 'url(#ink-wash)' }),
    s('path', { class: 't33y-traybed', d: rim }),
    s('g', { 'clip-path': 'url(#t33y-weave)' },
      s('rect', { class: 't33y-weave', x: f1(x0), y: f1(y0), width: f1(x1 - x0), height: f1(y1 - y0), fill: 'url(#t33y-nia)' }),
      s('rect', { x: f1(x0), y: f1(y0), width: f1(x1 - x0), height: f1(y1 - y0), fill: 'url(#p2-shade)', class: 't33y-trayshade' })),
    s('path', { class: 't33y-ghost', d: ghost(gx, gy - 14) + ghost(gx + 6, gy + 14) }),
    s('path', { class: 't33y-rim', d: rim, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33y-rim-in', d: rim, transform: `translate(${f1(W * 0.02)} ${f1(H * 0.02)}) scale(0.96)` }),
    s('path', { class: 'g11-moonlit', d: stroke([[x0 + rad, y0 + 1.5], [W * 0.62, y0 + 1.2]], 1.6, 0.1, 0.4, 0.2) }))
}

/** Scene 2 — a ring of keys under a stone lantern: hand the agent only the keys this one job needs. */
export function keysScene(ctx: SceneCtx) {
  const given = new Set<string>()
  const say = live('g11-say t33y-say')
  const ring = h('div', { class: 't33y-zone kept' })
  const hand = h('div', { class: 't33y-zone given' })
  const keys = K.keys.map((k) => {
    const st = h('span', { class: 't33y-st' }, K.keep)
    const b = h('button', { class: 't33y-k', type: 'button', 'aria-pressed': 'false', onClick: () => toggle(k.id) }, keyArt(), h('span', { class: 't33y-tag g11-dopaper' }, h('span', { class: 't33y-l' }, k.label), st))
    ring.append(b)
    return { k, b, st }
  })
  const check = h('button', { class: 'g11-pill t33y-check', type: 'button', onClick: judge }, K.check)
  const boardArt = s('svg', { class: 't33y-back', 'aria-hidden': 'true' })
  const trayArt = s('svg', { class: 't33y-back', 'aria-hidden': 'true' })
  const keepT = h('p', { class: 'p2-eyebrow' }, K.keep)
  const giveT = h('p', { class: 'p2-eyebrow' }, K.give)
  const keep = h('section', { class: 't33y-side keep' }, boardArt, toroArt(), keepT, ring)
  const give = h('section', { class: 't33y-side give' }, trayArt, giveT, hand)
  const board = h('div', { class: 't33y-board' }, keep, give)
  const root = h('div', { class: 'g11 g11-nomoon t33y', role: 'group', 'aria-label': K.aria },
    night({ low: true }),
    h('p', { class: 'visually-hidden' }, K.art),
    h('p', { class: 'g11-q t33y-task' }, K.task),
    board,
    say, check)
  ctx.art.append(root)
  ctx.onCleanup(onSize(board, () => {
    // read both sides first, then paint
    const k = [keep.clientWidth, keep.clientHeight, keepT.offsetTop], g = [give.clientWidth, give.clientHeight, giveT.offsetTop]
    if (k[0] < 40 || g[0] < 40) return
    paintBoard(boardArt, k[0], k[1], k[2])
    paintTray(trayArt, g[0], g[1], g[2])
  }))
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)
  let solved = false

  const label = () => keys.forEach(({ k, b, st }) => {
    const on = given.has(k.id)
    b.setAttribute('aria-pressed', String(on))
    b.setAttribute('aria-label', fill(K.keyAria, { label: k.label, state: on ? K.given : K.kept }))
    st.textContent = on ? K.give : K.keep
  })

  function toggle(id: string) {
    const x = keys.find((v) => v.k.id === id)!
    const on = !given.has(id)
    on ? given.add(id) : given.delete(id)
    const focused = document.activeElement === x.b
    ;(on ? hand : ring).append(x.b)
    give.classList.toggle('has', given.size > 0)
    if (focused) x.b.focus({ preventScroll: true })
    label()
    ctx.chime('tap')
    say.say(on ? h('span', null, h('strong', null, `${x.k.label}: `), x.k.risk) : '')
  }

  function judge() {
    const extra = K.keys.filter((k) => given.has(k.id) && !k.need).length
    const missing = K.keys.some((k) => k.need && !given.has(k.id))
    if (extra) return void (ctx.chime('low'), say.say(h('span', { class: 'bad' }, fill(K.tooMany, { n: extra }))))
    if (missing) return void (ctx.chime('low'), say.say(h('span', { class: 'bad' }, K.tooFew)))
    ctx.chime('ok')
    say.say(K.right)
    root.classList.add('solved')
    if (solved) return
    solved = true
    ctx.insight(K.insight as Fact, K.detail as Fact)
    sheet.show()
  }
  label()
  ctx.prompt(K.prompt)
}
