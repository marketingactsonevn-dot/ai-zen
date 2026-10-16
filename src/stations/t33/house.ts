import raw from '../../content/tram-33.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { onDigit, onSize } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { blob, curve, flame, ground, lantern, live, night, plank, rng, stroke, type Pt } from '../t31/kit'

const K = raw.scenes.house
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
const lines = (ls: number[][], w: number) => ls.map(([a, b, c, d]) => stroke([[a, b], [c, d]], w, 0.15, 0.15, 0.4)).join('')

/** What each bay holds (viewBox 0 0 60 44, standing on y = 42): hearth, tool rack, recipe shelf, notebook chest, gate bell. */
function bayArt(i: number): SVGSVGElement {
  const kids: SVGElement[] = []
  if (i === 0) {
    kids.push(
      s('circle', { class: 'g11-halo t33h-fire', cx: 30, cy: 30, r: 24 }),
      s('path', { class: 't33h-clay', d: 'M12 42L14 26Q30 22 46 26L48 42Z', filter: 'url(#ink-rough)' }),
      s('path', { class: 't33h-mouth', d: 'M24 42Q24 32 30 32Q36 32 36 42Z' }),
      flame(30, 41, 0.34, 't33h-fire'),
      s('path', { class: 't33h-pot', d: 'M19 24Q19 14 30 14Q41 14 41 24Z', filter: 'url(#ink-rough)' }),
      s('path', { class: 'g11-wash t33h-smoke', d: stroke(curve([30, 12], [24, 6], [31, 0], 6), 1.4, 0.1, 0.6, 0.2) }))
  } else if (i === 1) {
    kids.push(
      s('path', { class: 'g11-wood-face', d: stroke([[6, 8], [54, 8]], 3, 0.05, 0.05, 0.7), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g11-wash t33h-tool', d: stroke([[14, 9], [12, 40]], 2, 0.1, 0.1, 0.5) + stroke([[8, 38], [18, 40]], 3, 0.2, 0.2, 0.5) + stroke([[30, 9], [30, 34]], 1.8, 0.1, 0.1, 0.5) + 'M24 22h12v10h-12Z' + stroke([[44, 9], [46, 40]], 1.8, 0.1, 0.1, 0.5) + stroke([[40, 12], [50, 12]], 4, 0.2, 0.2, 0.6) }),
      s('path', { class: 't33h-saw', d: 'M25 23l10 0 0 8-10 0Z' }))
  } else if (i === 2) {
    const books: string[] = []
    const r = rng(3340)
    for (let x = 9; x < 50; ) {
      const w = 4 + r() * 3, hh = 12 + r() * 6
      books.push(`M${f1(x)} 24h${f1(w)}v-${f1(hh)}h-${f1(w)}Z`)
      x += w + 0.6
    }
    kids.push(
      s('path', { class: 't33h-books', d: books.join('') }),
      s('path', { class: 'g11-wash t33h-spines', d: lines([[10, 20, 50, 20]], 0.6) }),
      plank(6, 24, 48, 3, 3341),
      s('path', { class: 't33h-books', d: 'M12 38h14v-8h-14ZM30 38h16v-6h-16Z' }),
      plank(6, 38, 48, 3, 3342))
  } else if (i === 3) {
    kids.push(
      s('path', { class: 'g11-wood-face', d: 'M12 42V12h36v30Z', filter: 'url(#ink-rough)' }),
      s('path', { class: 'g11-wash t33h-drawer', d: lines([[13, 22, 47, 22], [13, 32, 47, 32], [30, 12, 30, 42]], 1.1) }),
      s('path', { class: 't33h-pull', d: blob(24, 17, 1.4, 1.4, 1, 0, 6) + blob(36, 17, 1.4, 1.4, 2, 0, 6) + blob(24, 27, 1.4, 1.4, 3, 0, 6) + blob(36, 27, 1.4, 1.4, 4, 0, 6) + blob(24, 37, 1.4, 1.4, 5, 0, 6) + blob(36, 37, 1.4, 1.4, 6, 0, 6) }),
      s('path', { class: 't33h-books', d: 'M16 12v-4h12v4ZM18 8v-3h10v3Z' }))
  } else {
    kids.push(
      s('path', { class: 'g11-wood-face', d: stroke([[14, 42], [14, 6]], 4, 0.02, 0.02, 0.8) + stroke([[46, 42], [46, 6]], 4, 0.02, 0.02, 0.8) + stroke([[8, 8], [52, 6]], 4, 0.05, 0.05, 0.6), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g11-thread', d: 'M30 7V16' }),
      s('path', { class: 't33h-bell', d: 'M24 26Q24 16 30 16Q36 16 36 26Z', filter: 'url(#ink-rough)' }),
      s('path', { class: 'g11-wash t33h-rope', d: stroke(curve([30, 26], [32, 32], [29, 38], 6), 1.2, 0.1, 0.4, 0.3) }))
  }
  return s('svg', { class: 't33h-bayart', viewBox: '0 0 60 44', 'aria-hidden': 'true' }, ...kids)
}

/** The house's frame over the bays (px W × H, roof band rh tall, bays from y = rh): roof, posts, beam, floor, footings. */
function paintHouse(svg: SVGSVGElement, W: number, H: number, rh: number) {
  const r = rng(3350)
  const fy = H - 10 // the floor line
  const ov = Math.max(18, W * 0.05)
  const roof = `M${f1(-ov)} ${f1(rh)}Q${f1(-ov * 0.4)} ${f1(rh + 4)} ${f1(W * 0.06)} ${f1(rh - 2)}Q${f1(W * 0.34)} ${f1(rh * 0.78)} ${f1(W * 0.44)} ${f1(rh * 0.16)}L${f1(W * 0.56)} ${f1(rh * 0.16)}Q${f1(W * 0.66)} ${f1(rh * 0.78)} ${f1(W * 0.94)} ${f1(rh - 2)}Q${f1(W + ov * 0.4)} ${f1(rh + 4)} ${f1(W + ov)} ${f1(rh)}Q${f1(W + ov * 0.6)} ${f1(rh + 10)} ${f1(W * 0.92)} ${f1(rh + 8)}L${f1(W * 0.08)} ${f1(rh + 8)}Q${f1(-ov * 0.6)} ${f1(rh + 10)} ${f1(-ov)} ${f1(rh)}Z`
  let tiles = ''
  for (let x = W * 0.08; x < W * 0.93; x += Math.max(9, W / 70)) {
    // the concave slope: steep near the ridge, flattening toward the eaves
    const t = Math.max(0, (Math.abs(x - W / 2) - W * 0.06) / (W * 0.44))
    const y = rh * (0.18 + 0.8 * (1 - Math.pow(1 - t, 2.2)))
    tiles += stroke([[x, y + 2], [x + (x - W / 2) * 0.03, Math.min(rh + 6, y + rh * 0.3)]], 1.4, 0.2, 0.3, 0.3)
  }
  const ridge: Pt[] = [...curve([-ov, rh - 4], [W * 0.34, rh * 0.8], [W * 0.44, rh * 0.15], 14), [W * 0.5, rh * 0.13], ...curve([W * 0.56, rh * 0.15], [W * 0.66, rh * 0.8], [W + ov, rh - 4], 14)]
  let posts = ''
  for (let k = 0; k <= 5; k++) {
    const x = (W * k) / 5 + (k === 0 ? 3 : k === 5 ? -3 : 0)
    posts += stroke([[x, rh + 6], [x + (r() - 0.5) * 1.5, fy]], k === 0 || k === 5 ? 7 : 5, 0.02, 0.02, 0.8)
  }
  let foot = ''
  for (let k = 0; k <= 5; k++) foot += blob((W * k) / 5 + (k === 0 ? 3 : k === 5 ? -3 : 0), fy + 8, 9, 4, 3351 + k, 0.2, 10)
  svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
  svg.replaceChildren(
    ground(W / 2, fy + 12, W * 0.62, 10, 3352, 0.22),
    s('path', { class: 't33h-foot', d: foot, fill: 'url(#p2-rock)' }),
    plank(-ov * 0.5, fy - 2, W + ov, 9, 3353),
    s('path', { class: 'g11-wood-face t33h-post', d: posts, filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wash t33h-beam', d: stroke([[-4, rh + 8], [W / 2, rh + 9], [W + 4, rh + 8]], 5, 0.02, 0.02, 0.6), filter: 'url(#ink-rough)' }),
    s('path', { class: 't33h-roofwash', d: roof, filter: 'url(#ink-wash)' }),
    s('path', { class: 't33h-tiles', d: tiles }),
    s('path', { class: 'g11-wash t33h-ridge', d: stroke(ridge, 3.4, 0.04, 0.04, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wash t33h-ridge', d: stroke([[W * 0.42, rh * 0.15], [W * 0.5, rh * 0.12], [W * 0.58, rh * 0.15]], 7, 0.2, 0.2, 0.5) + stroke(curve([W * 0.42, rh * 0.15], [W * 0.405, rh * 0.06], [W * 0.415, 0], 5), 3, 0.1, 0.6, 0.3) + stroke(curve([W * 0.58, rh * 0.15], [W * 0.595, rh * 0.06], [W * 0.585, 0], 5), 3, 0.1, 0.6, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit', d: stroke(ridge.slice(4, 15).map(([x, y]) => [x, y + 2.5] as Pt), 1.8, 0.2, 0.3, 0.2) }))
}

/** Scene 4 — a five-bay wooden house in section: light each bay (model, tools, skills, memory, channel) to read it. */
export function houseScene(ctx: SceneCtx) {
  const lit = new Set<number>()
  const panel = live('t33h-panel')
  const note = h('p', { class: 't33h-note', hidden: true }, K.note)
  const rooms = K.rooms.map((r, i) => {
    const [a, b] = r.name.split(/:\s*/)
    return h('button', { class: 't33h-room', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.roomAria, { name: r.name }), onClick: () => light(i) },
      lantern('', 330 + i), h('span', { class: 't33h-a' }, a), b ? h('span', { class: 't33h-b' }, b) : null, bayArt(i))
  })
  const frame = s('svg', { class: 't33h-frame', 'aria-hidden': 'true' })
  const roof = h('div', { class: 't33h-roof' })
  const house = h('div', { class: 't33h-house' }, frame, roof, h('div', { class: 't33h-bays' }, ...rooms), h('span', { class: 't33h-floor', 'aria-hidden': 'true' }))
  const root = h('div', { class: 'g11 t33h', role: 'group', 'aria-label': K.aria },
    night(),
    h('p', { class: 'visually-hidden' }, K.art),
    house,
    panel, note)
  ctx.art.append(root)
  ctx.onCleanup(onSize(house, () => paintHouse(frame, house.clientWidth, house.clientHeight, roof.offsetHeight)))

  function light(i: number) {
    const r = K.rooms[i]
    rooms.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    rooms[i].classList.add('on')
    const st = (r as { station?: number }).station
    panel.say(h('p', { class: 't33h-name' }, r.name), h('p', { class: 't33h-what' }, r.what),
      st ? h('a', { class: 't33h-link', href: `#/tram/${st}` }, fill(K.seeStation, { n: st })) : '')
    if (lit.has(i)) return
    lit.add(i)
    ctx.chime('tap')
    if (lit.size === K.rooms.length) {
      note.hidden = false
      ctx.insight(K.insight as Fact, K.detail as Fact)
    }
  }
  ctx.onCleanup(onDigit((d) => d <= rooms.length && rooms[d - 1].click()))
  ctx.prompt(K.prompt)
}
