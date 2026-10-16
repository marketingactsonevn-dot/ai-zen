import { s } from '../../core/dom'
import type { TideArt } from '../../ui/part2/tide'
import { f1, hills, mist, pine, rng, stroke, type Pt } from './kit'

/**
 * Scene 4 — the context window as a paper shōji frame on the scroll: left (2017) only a low slit is open under the
 * paper transoms; bay after bay the opening grows until "today" stands open to the moonlit sand. What rises at each
 * milestone grows the same way: a letter → a few pages → a novel → a stack of books → a whole bookshelf.
 */
export const windowArt: TideArt = {
  back({ w, h, ground, xs, roll, seed }) {
    const n = xs.length - 1
    const r = rng(seed)
    const top = 7
    const step = xs[1] - xs[0]
    // bay k holds stop k; its opening reaches up to y = open(k), sized by the window of that year (log of tokens):
    // a few pages, a novel, ~1M; the 10M of 2025 is the maker's own claim, drawn as a ghost lintel above the 1M one
    const OPEN = [0.18, 0.3, 0.48, 0.62, 0.62, 0.62]
    const open = (k: number) => ground - h * (OPEN[k] ?? 0.62)
    const claim = ground - h * 0.78
    const edges = [roll, ...xs.slice(0, n).map((x, k) => (x + xs[k + 1]) / 2), xs[n] + step * 0.5]
    let paper = '', lattice = '', beams = '', posts = '', ghost = ''
    for (let k = 0; k <= n; k++) {
      const a = edges[k], b = edges[k + 1], y = open(k)
      if (k < n) {
        paper += `M${f1(a)} ${f1(top)}H${f1(b)}V${f1(y)}H${f1(a)}Z`
        // kumiko: thin bars in a tall grid, a little uneven like hand-cut wood
        const cols = Math.max(2, Math.round((b - a) / 30))
        for (let c = 1; c < cols; c++) { const x = a + ((b - a) * c) / cols + (r() - 0.5) * 1.5; lattice += stroke([[x, top], [x + (r() - 0.5), y]], 0.9 + r() * 0.4, 0.02, 0.02, 0.5) }
        for (let yy = top + 34; yy < y - 14; yy += 44 + r() * 8) lattice += stroke([[a, yy], [b, yy + (r() - 0.5)]], 0.9 + r() * 0.4, 0.02, 0.02, 0.5)
      }
      if (k === 4) ghost = stroke([[a + 2, claim], [(a + b) / 2, claim - 1], [b - 2, claim]], 2.4, 0.2, 0.2, 0.3)
      if (k < n) beams += stroke([[a - 2, y], [(a + b) / 2, y + (r() - 0.5) * 1.5], [b + 2, y]], 4.2, 0.04, 0.04, 0.5)
      if (k > 0) posts += stroke([[a, top], [a + (r() - 0.5) * 1.2, (top + ground) / 2], [a, ground + 2]], 2.4, 0.03, 0.06, 0.6)
    }
    const clip = `g8w-clip-${seed}`, grad = `g8w-glow-${seed}`
    return [
      s('defs', null,
        s('clipPath', { id: clip }, s('path', { d: paper })),
        // paper lit from outside by the moon: brightest low, near the opening
        s('linearGradient', { id: grad, x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, class: 'g8w-g0' }),
          s('stop', { offset: 1, class: 'g8w-g1' }))),
      mist(w * 0.5, ground - h * 0.3, w * 0.7, h * 0.42),
      hills(roll, w - roll, ground - h * 0.08, h * 0.34, seed, 0.88, 6),
      hills(xs[Math.max(0, n - 2)], w - roll, ground - h * 0.02, h * 0.46, seed + 1, 0.5, 2),
      mist(w * 0.55, ground - h * 0.04, w * 0.62, h * 0.12),
      s('path', { class: 'g8w-paper', d: paper, fill: `url(#${grad})` }),
      // a pine outside, its moon shadow cast on the paper
      s('g', { class: 'g8w-shadow', 'clip-path': `url(#${clip})` }, pine(roll + w * 0.12, ground + h * 0.1, h * 1.05, seed + 5, 1), pine(w * 0.5, ground + h * 0.2, h * 0.8, seed + 6, -1)),
      s('path', { class: 'g8w-lattice', d: lattice, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8w-ghost', d: ghost }),
      s('path', { class: 'g8w-post', d: posts, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8w-wood', d: beams + stroke([[roll, top + 1], [w / 2, top + 2], [w - roll, top + 1]], 5, 0.02, 0.02, 0.6), filter: 'url(#ink-rough)' }),
    ]
  },

  mark(i, size, seed) {
    const r = rng(seed)
    const u = size
    let fillP = '', inkP = '', lines = ''
    const books: SVGElement[] = []
    // a sheet of paper: corners from its centre-bottom (x, y), w × hh, tilted by a (rad)
    const sheet = (x: number, y: number, w: number, hh: number, a: number) => {
      const rot = ([px, py]: Pt): Pt => [x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)]
      const c = [[-w / 2, 0], [w / 2, 0], [w / 2, -hh], [-w / 2 + w * 0.08, -hh], [-w / 2, -hh + w * 0.1]].map((p) => rot(p as Pt))
      fillP += `M${c.map(([px, py]) => `${f1(px)} ${f1(py)}`).join('L')}Z`
      inkP += stroke([...c, c[0]], 1.1, 0.05, 0.05, 0.4)
      for (let k = 1; k < 6; k++) {
        const yy = -hh + (hh * k) / 6.5
        lines += stroke([rot([-w * 0.32, yy]), rot([w * (0.05 + r() * 0.28), yy])], 1.1, 0.2, 0.3, 0.3)
      }
    }
    // a book seen from the spine (standing) or lying flat
    const book = (x: number, y: number, w: number, hh: number, tone: number, lean = 0) => {
      const sk = Math.tan(lean) * hh
      books.push(s('path', { class: `g8w-book b${tone % 5}`, d: `M${f1(x)} ${f1(y)}h${f1(w)}l${f1(sk)} ${f1(-hh)}h${f1(-w)}Z` }))
      inkP += stroke([[x, y], [x + sk, y - hh], [x + w + sk, y - hh], [x + w, y], [x, y]], 1, 0.05, 0.05, 0.4)
      const band = hh > w ? 0.18 : 0.5
      lines += hh > w ? stroke([[x + sk * band + w * 0.2, y - hh * band], [x + sk * band + w * 0.8, y - hh * band]], 1.2, 0.1, 0.1, 0.4) : stroke([[x + w * 0.1, y - hh * band], [x + w * 0.9, y - hh * band]], 0.9, 0.1, 0.1, 0.4)
    }
    if (i === 0) sheet(0, 0, u * 0.5, u * 0.66, -0.08)
    else if (i === 1) for (const [dx, a] of [[-u * 0.18, -0.2], [0, -0.02], [u * 0.17, 0.16]]) sheet(dx, 0, u * 0.46, u * 0.62, a)
    else if (i === 2) {
      book(-u * 0.2, 0, u * 0.4, u * 0.86, 0)
      sheet(u * 0.32, 0, u * 0.28, u * 0.34, 0.12)
    } else if (i === 3) {
      let y = 0
      for (let k = 0; k < 5; k++) {
        const bw = u * (0.86 - k * 0.07 + r() * 0.06), bh = u * (0.15 + r() * 0.04)
        book(-bw / 2 + (r() - 0.5) * u * 0.08, y, bw, bh, k + 1)
        y -= bh
      }
    } else if (i === 5) {
      // today: about a million tokens, a stack like 2024's and one book open on top
      let y = 0
      for (let k = 0; k < 4; k++) {
        const bw = u * (0.82 - k * 0.06 + r() * 0.05), bh = u * (0.15 + r() * 0.04)
        book(-bw / 2 + (r() - 0.5) * u * 0.06, y, bw, bh, k + 2)
        y -= bh
      }
      sheet(-u * 0.2, y, u * 0.36, u * 0.12, -0.25)
      sheet(u * 0.16, y, u * 0.36, u * 0.12, 0.25)
    } else {
      // 2025: a whole bookshelf (10M, the maker's claim: drawn a little paler): a frame, three shelves, spines of every height
      const sw = u * 1.1, sh = u * 1.35, x0 = -sw / 2
      inkP += stroke([[x0, 2], [x0, -sh]], 2.4, 0.02, 0.05, 0.6) + stroke([[x0 + sw, 2], [x0 + sw, -sh]], 2.4, 0.02, 0.05, 0.6) + stroke([[x0 - 2, -sh], [x0 + sw + 2, -sh]], 2.6, 0.05, 0.05, 0.6)
      for (let k = 0; k < 3; k++) {
        const base = -k * (sh / 3)
        inkP += stroke([[x0 - 1, base], [x0 + sw + 1, base]], 2, 0.05, 0.05, 0.6)
        for (let x = x0 + 3; x < x0 + sw - 5; ) {
          const bw = u * (0.06 + r() * 0.06)
          const bh = (sh / 3) * (0.62 + r() * 0.3)
          if (x + bw > x0 + sw - 3) break
          book(x, base - 1.5, bw, bh, Math.floor(r() * 5), r() < 0.12 ? 0.12 : 0)
          x += bw + 0.6
        }
      }
    }
    return s('g', { class: `g8w-mark${i === 4 ? ' claim' : ''}` },
      s('ellipse', { class: 'g8w-contact', cx: 0, cy: 1.5, rx: f1(u * 0.55), ry: f1(Math.max(2.5, u * 0.08)) }),
      fillP ? s('path', { class: 'g8w-sheet', d: fillP }) : null,
      ...books,
      s('path', { class: 'g8w-lines', d: lines }),
      s('path', { class: 'g8w-ink', d: inkP, filter: 'url(#ink-rough)' }))
  },
}
