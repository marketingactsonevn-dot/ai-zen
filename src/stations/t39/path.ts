import { s } from '../../core/dom'
import { clamp, curve, stroke } from '../../ui/part2/ink'
import { stepPath, type PathGeo } from '../../ui/part2/steps'
import { grass, hills, mist } from '../../ui/part2/paint'
import { C } from './shell'
import { crescent, dawnGlow, f1, fog, lines } from '../t37/sumi'

const P = C.scenes.path

/** A roofed garden gate standing on (x, y), H tall: two posts, a tie beam, a small tiled roof, the doors swung open. */
function gate(x: number, y: number, H: number) {
  const u = H / 10
  const X = (v: number) => x + v * u, Y = (v: number) => y - v * u
  return s('g', { class: 't39p-gate' },
    s('ellipse', { class: 'p2p-contact', cx: f1(X(0.3)), cy: f1(Y(-0.1)), rx: f1(u * 5), ry: f1(u * 0.6) }),
    s('path', { class: 't39p-door', d: `M${f1(X(-2.6))} ${f1(Y(0))}L${f1(X(-4.4))} ${f1(Y(0.6))}L${f1(X(-4.4))} ${f1(Y(6.6))}L${f1(X(-2.6))} ${f1(Y(6.9))}ZM${f1(X(2.6))} ${f1(Y(0))}L${f1(X(4.4))} ${f1(Y(0.6))}L${f1(X(4.4))} ${f1(Y(6.6))}L${f1(X(2.6))} ${f1(Y(6.9))}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't39p-roof', d: `M${f1(X(-4.6))} ${f1(Y(8.3))}Q${f1(X(-2))} ${f1(Y(9.1))} ${f1(X(0))} ${f1(Y(10))}Q${f1(X(2))} ${f1(Y(9.1))} ${f1(X(4.6))} ${f1(Y(8.3))}Q${f1(X(4.9))} ${f1(Y(8.1))} ${f1(X(4.8))} ${f1(Y(7.8))}L${f1(X(-4.8))} ${f1(Y(7.8))}Q${f1(X(-4.9))} ${f1(Y(8.1))} ${f1(X(-4.6))} ${f1(Y(8.3))}Z`, filter: 'url(#ink-wash)' }),
    s('path', { class: 'g13-ink', d: lines([[X(-2.6), Y(0), X(-2.6), Y(8)], [X(2.6), Y(0), X(2.6), Y(8)]], u * 0.55, 0.02, 0.02) + lines([[X(-3.4), Y(7), X(3.4), Y(7)], [X(-4.9), Y(7.85), X(4.9), Y(7.85)]], u * 0.32, 0.05, 0.05) + lines([[X(-3.9), Y(1.4), X(-3.9), Y(6.2)], [X(3.9), Y(1.4), X(3.9), Y(6.2)]], u * 0.18), filter: 'url(#ink-rough)' }))
}

/** The house the path starts from, seen at its corner: the veranda floor, shōji behind it, a post, the eave above. Anchored at the floor's front right (x, y). */
function veranda(x: number, y: number, H: number) {
  const u = H / 10
  const X = (v: number) => f1(x + v * u), Y = (v: number) => f1(y - v * u)
  let lattice = ''
  for (let i = 1; i < 6; i++) lattice += stroke([[x - (9.4 - i * 1.4) * u, y - 2.7 * u], [x - (9.4 - i * 1.4) * u, y - 8.8 * u]], Math.max(0.6, u * 0.07), 0.1, 0.1, 0.5)
  for (let j = 1; j < 4; j++) lattice += stroke([[x - 9.4 * u, y - (2.7 + j * 1.5) * u], [x - 1.4 * u, y - (2.7 + j * 1.5) * u]], Math.max(0.6, u * 0.07), 0.1, 0.1, 0.5)
  return s('g', { class: 't39p-veranda' },
    s('path', { class: 't39p-shoji', d: `M${X(-9.4)} ${Y(2.7)}L${X(-1.4)} ${Y(2.7)}L${X(-1.4)} ${Y(8.8)}L${X(-9.4)} ${Y(8.8)}Z` }),
    s('path', { class: 't39p-lattice', d: lattice }),
    s('path', { class: 't39p-floor', d: `M${X(-9.6)} ${Y(2.6)}L${X(-0.4)} ${Y(2.6)}L${X(0)} ${Y(1.4)}L${X(-9)} ${Y(1.4)}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't39p-floor-front', d: `M${X(-9)} ${Y(1.4)}L${X(0)} ${Y(1.4)}L${X(0)} ${Y(0.6)}L${X(-9)} ${Y(0.6)}Z` }),
    s('path', { class: 't39p-eave', d: `M${X(-11)} ${Y(10.4)}L${X(1.8)} ${Y(9.7)}L${X(1.5)} ${Y(8.9)}L${X(-11)} ${Y(9.4)}Z`, filter: 'url(#ink-wash)' }),
    s('path', { class: 'g13-ink', d: lines([[x - 0.7 * u, y - 0.6 * u, x - 0.7 * u, y - 9.2 * u], [x - 9.3 * u, y - 2.6 * u, x - 9.3 * u, y - 9.1 * u]], u * 0.42, 0.02, 0.02) + stroke([[x - 9.6 * u, y - 2.6 * u], [x - 0.4 * u, y - 2.6 * u]], u * 0.2, 0.02, 0.05, 0.5) + stroke([[x - 9 * u, y - 0.6 * u], [x, y - 0.6 * u]], u * 0.22, 0.02, 0.05, 0.5) + stroke([[x - 11 * u, y - 9.4 * u], [x + 1.5 * u, y - 8.9 * u]], u * 0.28, 0.02, 0.05, 0.5), filter: 'url(#ink-rough)' }),
    s('path', { class: 't39p-plank', d: lines([[x - 9.3 * u, y - 2.0 * u, x - 0.3 * u, y - 2.0 * u]], u * 0.1) }),
    s('ellipse', { class: 'p2p-contact', cx: X(-4.5), cy: Y(0.4), rx: f1(u * 5.4), ry: f1(u * 0.5) }))
}

/** Scene 3 — four week-stones from the veranda to the garden gate at dawn; when set, the first ray runs along the path. */
export const pathScene = stepPath(P.steps, {
  label: P.label, prompt: P.prompt, insight: P.insight, cards: P.weekCards,
  art: ({ w, h, row, first, last, top, pathY, seed }: PathGeo) => {
    if (!row) {
      // a phone: the path runs down the left column, from the veranda's edge to the gate at its foot
      const H = clamp(w * 0.16, 40, 64)
      return [
        dawnGlow(last[0] + H * 0.4, last[1] + H * 0.6, w * 0.7, H * 1.6, 3),
        crescent(w - 18, top + 16, 7, 0.6, 160),
        s('path', { class: 't39p-ray', d: stroke([[last[0], last[1]], [first[0], first[1] + 6]], H * 0.5, 0, 0.92, 0.05), filter: 'url(#ink-wash)' }),
        gate(last[0], Math.min(h - 4, last[1] + H * 0.95), H * 0.9),
      ]
    }
    const skyH = pathY - top
    const hz = pathY - Math.min(skyH * 0.32, 60) // the far ground meets the hills just behind the path
    const H = clamp(skyH * 0.62, 50, 150)
    const sun = Math.max(6, H * 0.08)
    return [
      dawnGlow(last[0] - H * 0.2, hz, w * 0.42, skyH * 0.9, 3),
      fog(w * 0.45, hz - skyH * 0.25, w * 0.55, skyH * 0.4),
      crescent(Math.max(28, w * 0.08), top + Math.max(20, skyH * 0.16), clamp(skyH * 0.05, 7, 14), 0.6, 160),
      s('circle', { cx: f1(last[0] - H * 0.15), cy: f1(hz + 2), r: f1(sun * 3.4), fill: 'url(#g13-sun)' }),
      s('circle', { class: 't39p-sun', cx: f1(last[0] - H * 0.15), cy: f1(hz + 2), r: f1(sun) }),
      hills(-w * 0.04, w * 1.04, hz, Math.min(skyH * 0.42, 110), seed, 0.9, 7),
      hills(w * 0.05, w * 0.5, hz + 4, Math.min(skyH * 0.3, 80), seed + 1, 0.62, 2),
      mist(w * 0.5, hz + 2, w * 0.6, skyH * 0.08),
      s('path', { class: 't39p-ray', d: stroke(curve([last[0] - 6, last[1] - 2], [(first[0] + last[0]) / 2, pathY + H * 0.12], [first[0] + 10, first[1] - 2], 24), H * 0.42, 0, 0.95, 0.04), filter: 'url(#ink-wash)' }),
      veranda(first[0] - 4, first[1] + H * 0.12, H),
      gate(last[0] + H * 0.08, last[1] + H * 0.08, H * 0.92),
      grass(last[0] + H * 0.62, last[1] + H * 0.1, H * 0.2, seed + 3),
    ]
  },
})
