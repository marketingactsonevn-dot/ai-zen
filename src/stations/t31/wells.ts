import raw from '../../content/tram-31.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { lantern, live, night, stroke } from './kit'

const K = raw.scenes.wells

/** A stone well with a bamboo frame and bucket (viewBox 0 0 200 190); the water shows code scales or little jars. */
function wellArt(kind: string): SVGSVGElement {
  const water = s('g', { class: 't31w-water' })
  if (kind === 'github') {
    // code glinting like fish scales
    for (let i = 0; i < 9; i++) {
      const x = 62 + (i % 3) * 26 + (i > 2 ? 6 : 0), y = 121 + Math.floor(i / 3) * 5
      water.append(s('path', { class: 'g11-ink2', d: stroke([[x, y], [x + 12 + (i % 2) * 6, y - 0.6]], 1.6, 0.2, 0.3) }))
    }
  } else {
    for (const [x, y, k] of [[74, 122, 1], [98, 119, 1.2], [124, 123, 0.9]] as const) {
      water.append(
        s('ellipse', { class: 'g11-ink2', cx: x, cy: y, rx: 6 * k, ry: 4 * k, 'fill-opacity': 0.75 }),
        s('rect', { class: 'g11-ver', x: x - 3 * k, y: y - 2 * k, width: 6 * k, height: 2.6 * k, 'fill-opacity': 0.8 }))
    }
  }
  return s('svg', { class: 't31w-art', viewBox: '0 0 200 190', 'aria-hidden': 'true' },
    s('ellipse', { class: 't31w-shadow', cx: 104, cy: 178, rx: 82, ry: 8 }),
    // frame: two posts and a crossbar with rope
    s('path', { class: 'g11-ink', d: stroke([[40, 160], [42, 30]], 5, 0.05, 0.05, 0.6) }),
    s('path', { class: 'g11-ink', d: stroke([[160, 160], [158, 30]], 5, 0.05, 0.05, 0.6) }),
    s('path', { class: 'g11-ink', d: stroke([[30, 34], [100, 30], [172, 35]], 6, 0.1, 0.1, 0.5) }),
    s('g', { class: 't31w-bucket' },
      s('path', { class: 'g11-ink2', d: stroke([[100, 32], [100, 70]], 1.2, 0, 0) }),
      s('path', { class: 'g11-ink', d: 'M88 70h24l-3 20h-18z' }),
      s('path', { class: 'g11-paper', 'fill-opacity': 0.4, d: stroke([[91, 74], [109, 74]], 1.4, 0, 0) })),
    // well body
    s('path', { class: 't31w-body', d: 'M44 118v42c0 10 26 16 56 16s56-6 56-16v-42z', fill: 'url(#p2-rock)' }),
    s('path', { d: 'M44 118v42c0 10 26 16 56 16s56-6 56-16v-42z', fill: 'url(#p2-shade)' }),
    s('path', { class: 'g11-ink', 'fill-opacity': 0.35, d: stroke([[48, 140], [100, 146], [152, 140]], 1.4) + stroke([[46, 158], [100, 166], [154, 158]], 1.4) }),
    s('ellipse', { class: 't31w-rim', cx: 100, cy: 118, rx: 58, ry: 14, fill: 'url(#p2-rock)' }),
    s('ellipse', { class: 't31w-hole', cx: 100, cy: 120, rx: 46, ry: 9 }),
    water,
    s('path', { class: 'g11-moss', 'fill-opacity': 0.7, d: stroke([[44, 121], [56, 128], [72, 130]], 4, 0.2, 0.5) + stroke([[132, 131], [148, 126], [156, 119]], 3, 0.4, 0.2) }),
    s('path', { class: 'g11-ink', d: stroke([[42, 118], [70, 131], [130, 131], [158, 118]], 2.2, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }))
}

/** Scene 1 — two village wells: GitHub keeps code, Hugging Face keeps models, data and demos. One item at a time. */
export function wellsScene(ctx: SceneCtx) {
  const items = K.items
  let i = 0
  const slipBox = h('div', { class: 't31w-slipbox' }, lantern('on'))
  const say = live('g11-say')
  const note = h('p', { class: 't31w-note', hidden: true }, K.note)
  const wells = K.wells.map((w) => {
    const tags = h('ul', { class: 't31w-tags' })
    const descId = `t31w-d-${w.id}`
    const btn = h('button', { class: 't31w-well', type: 'button', 'aria-describedby': descId, onClick: () => drop(w.id) },
      wellArt(w.id),
      h('span', { class: 't31w-name' }, w.name),
      h('span', { class: 't31w-holds' }, w.holds),
      h('span', { class: 'visually-hidden', id: descId }, w.aria))
    return { w, btn, tags, el: h('div', { class: 't31w-col' }, btn, tags) }
  })
  const root = h('div', { class: 'g11 t31w', role: 'group', 'aria-label': K.aria },
    night(),
    h('p', { class: 'visually-hidden' }, K.art),
    slipBox,
    h('div', { class: 't31w-row' }, ...wells.map((x) => x.el)),
    say, note)
  ctx.art.append(root)

  let slip: HTMLElement | null = null
  function showItem() {
    slip?.remove()
    slip = null
    const it = items[i]
    if (it) {
      slip = h('p', { class: 't31w-slip' }, it.label)
      slipBox.append(slip)
    }
    for (const x of wells) x.btn.setAttribute('aria-label', it ? fill(K.itemAria, { item: it.aria, well: x.w.name }) : x.w.aria)
  }

  function drop(id: string) {
    const it = items[i]
    if (!it) return
    if (it.well !== id) {
      ctx.chime('low')
      say.say(h('span', { class: 'bad' }, K.wrong))
      if (slip && !ctx.reduced) {
        slip.classList.remove('g11-shake')
        void slip.offsetWidth // restart the shake
        slip.classList.add('g11-shake')
      }
      return
    }
    ctx.chime('tap')
    const x = wells.find((v) => v.w.id === id)!
    x.tags.append(h('li', null, it.label))
    x.btn.classList.remove('dip')
    void x.btn.offsetWidth
    x.btn.classList.add('dip')
    i++
    showItem()
    if (i < items.length) return say.say(K.right)
    say.say(K.done)
    note.hidden = false
    for (const v of wells) v.btn.classList.add('full')
    ctx.insight(K.insight as Fact, K.detail as Fact)
  }

  showItem()
  ctx.prompt(K.prompt)
}
