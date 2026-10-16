import { h, nextId, s } from '../../core/dom'
import { rng, stroke, type Pt } from '../../ui/part2/ink'
import { perspectiveCircle, type PondGeo } from '../../ui/part2/perspectives'
import type { Perspectives } from '../../ui/part2/types'
import type { SceneDef } from '../types'
import C from '../../content/tram-26.json'

/**
 * Scene 5 — should there be a rule like this? (art direction §4, t26 `circle`): LOW, lying on your back under an open
 * pavilion (azumaya) and looking up. The pavilion is modelled in 3D (metres) and drawn through a pinhole camera at the
 * eye, tilted a little toward the far side: the four posts shoot in from the frame's corners and shrink toward the eave
 * beam, the rafters converge on the closed smoke hole with real thickness and a shaded underside, the eaves overhang with
 * their soffit and rafter tails, and the night sky with pine boughs lies beyond them. A paper lantern hangs at each
 * corner, all alike, seen from below. Light one (tap, 1–4): its corner of the roof warms and a washi strip swings down
 * with who says what. The pointer tilts the roof a little. All four heard: the cover slides off the hole, moon overhead.
 * perspectiveCircle with its stage / place / stone hooks; the reading card is restyled as the hanging strip.
 */

const S = C.scenes.circle
const f1 = (n: number) => n.toFixed(1)
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
type V3 = [number, number, number]
// corners clockwise from top-right (k = slot, digit k + 1), in screen terms (x right, y down)
const CORNER: Pt[] = [[1, -1], [1, 1], [-1, 1], [-1, -1]]

// ── the pavilion in metres: x right, y away (up the frame), z up from the floor you lie on
const A = 1.5 // posts at (±A, ±A)
const PW = 0.12 // half a post's width
const BEAM: [number, number] = [2.24, 2.42] // the eave beam's underside and top
const E = A + 0.7 // the roof's edge, overhanging the beam
const ZE = 2.52 // height of the roof's edge
const ZA = 3.55 // the apex (the smoke hole's ring sits just under it)
const HOLE = 0.3
const LZ = 1.92 // the lanterns' centres
const EYE: V3 = [0, -0.3, 0.32]
const TILT = 0.17 // looking up, and a little toward the far side

/** the pinhole camera for a stage: world → [x, y, depth] in stage px */
function camera(g: PondGeo) {
  const f = Math.min(g.w, g.h) * 0.52
  const cx = g.w / 2, cy = g.h * 0.52
  const ct = Math.cos(TILT), st = Math.sin(TILT)
  return (p: V3): [number, number, number] => {
    const dx = p[0] - EYE[0], dy = p[1] - EYE[1], dz = p[2] - EYE[2]
    const fwd = dy * st + dz * ct, up = dy * ct - dz * st
    return [cx + (f * dx) / fwd, cy - (f * up) / fwd, fwd]
  }
}
/** a lantern's world position (corner k) */
const lampAt = (k: number): V3 => [CORNER[k][0] * A * 0.74, -CORNER[k][1] * A * 0.74, LZ]

/** a paper lantern seen from beneath and a little aside: hoops as rings round the bottom cap, the inside aglow when lit;
 *  `dir` = toward the vanishing point (its cord goes that way) */
function lantern(dir: Pt) {
  const [ux, uy] = dir
  let ribs = ''
  // the hoops of the lower half, from the equator in to the base ring; each centre slides toward the top (perspective)
  for (const [r, sh] of [[30, 0], [28.6, 3.2], [25, 6], [19.5, 8.2], [12.8, 9.6]] as [number, number][]) {
    const cx = ux * sh, cy = -25 + uy * sh
    ribs += `M${f1(cx + r)} ${f1(cy)}a${f1(r)} ${f1(r * 0.97)} 0 1 0 ${f1(-2 * r)} 0a${f1(r)} ${f1(r * 0.97)} 0 1 0 ${f1(2 * r)} 0`
  }
  return s('g', { class: 't26c-lamp' },
    s('circle', { class: 't26c-lglow', cx: 0, cy: -25, r: 62, fill: 'url(#p2-lamp)' }),
    s('path', { class: 't26c-lcord', d: `M${f1(ux * 26)} ${f1(-25 + uy * 26)}L${f1(ux * 70)} ${f1(-25 + uy * 70)}` }),
    s('circle', { class: 't26c-lbody', cx: 0, cy: -25, r: 31 }),
    s('path', { class: 't26c-lrib', d: ribs }),
    // the glow inside, brightest through the open base; the base ring itself a thin dark hoop
    s('ellipse', { class: 't26c-lcore', cx: f1(ux * 10.5), cy: f1(-25 + uy * 10.5), rx: 16, ry: 15 }),
    s('ellipse', { class: 't26c-lcap', cx: f1(ux * 10), cy: f1(-25 + uy * 10), rx: 9.5, ry: 9 }),
    s('path', { class: 't26c-lrim', d: stroke([[-24, -42], [-6, -50.5], [14, -48]], 2.2, 0.3, 0.4, 0.1) }))
}

function stage(host: HTMLElement, api: { onLayout(fn: (g: PondGeo) => void): void }) {
  const id = nextId('t26c')
  const svg = s('svg', { class: 't26c-sky', 'aria-hidden': 'true' })
  host.append(h('p', { class: 'visually-hidden' }, S.question), svg)
  // the pointer tilts the whole roof, lanterns and all (the component's stage element), like turning your head
  const st = host.parentElement!
  const tilt = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || document.documentElement.dataset.quality === 'low') return
    const r = st.getBoundingClientRect()
    st.style.transform = `rotate(${(((e.clientX - r.left) / r.width - 0.5) * 12).toFixed(2)}deg)`
  }
  const art = st.closest('.p2c')?.parentElement ?? st
  art.addEventListener('pointermove', tilt)
  const untilt = () => void (st.style.transform = '')
  art.addEventListener('pointerleave', untilt)

  api.onLayout((g) => {
    const w = g.w, hh = g.h
    const pr = camera(g)
    const q = (p: V3): Pt => { const [x, y] = pr(p); return [x, y] }
    const poly = (pts: V3[]) => `M${pts.map((p) => P(q(p))).join('L')}Z`
    const r = rng(2670)
    svg.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)

    // the sky beyond the eaves: stars, and pine boughs reaching in — far ones soft and pale, near ones crisp ink needles
    let stars = ''
    for (let i = 0; i < 60; i++) stars += `M${f1(r() * w)} ${f1(r() * hh)}h${f1(0.6 + r() * 1.2)}`
    const bough = (x: number, y: number, dir: number, k: number, sd: number) => {
      const b = rng(sd)
      let wood = stroke([[x, y], [x + dir * k * 0.45, y + k * 0.06], [x + dir * k, y - k * 0.04]], k * 0.045, 0.05, 0.7, 0.2)
      let needles = ''
      for (let i = 0; i < 8; i++) {
        const t = 0.14 + i * 0.11, bx = x + dir * k * t + (b() - 0.5) * k * 0.04, by = y + k * 0.05 * Math.sin(t * 3) + (b() - 0.5) * k * 0.12
        wood += stroke([[x + dir * k * (t - 0.06), y + k * 0.04], [bx, by]], k * 0.016, 0.1, 0.6, 0.3)
        // a clump of needles at each twig end, seen from below: two rings of dry strokes fanning all round, dense in the
        // middle, ragged at the rim
        for (const [n2, l0, l1, wd] of [[30, 0.07, 0.06, 1.3], [22, 0.04, 0.035, 1.8]] as [number, number, number, number][]) {
          for (let j = 0; j < n2; j++) {
            const a = (j / n2) * Math.PI * 2 + b() * 0.3, len = k * (l0 + b() * l1)
            needles += stroke([[bx + Math.cos(a) * len * 0.1, by + Math.sin(a) * len * 0.1], [bx + Math.cos(a) * len, by + Math.sin(a) * len * 0.8]], wd + b() * 1.2, 0.1, 0.75, 0.12)
          }
        }
      }
      return [s('path', { class: 't26c-bwood', d: wood }), s('path', { class: 't26c-bneedle', d: needles })]
    }
    const B = Math.max(w, hh) * 0.36
    const far = s('g', { class: 't26c-bough t26c-far' }, ...bough(w * 0.92, hh * 0.08, -1, B * 0.7, 2673), ...bough(w * 0.05, hh * 0.86, 1, B * 0.65, 2674))
    const near = s('g', { class: 't26c-bough' }, ...bough(-B * 0.12, hh * 0.18, 1, B, 2671), ...bough(w + B * 0.1, hh * 0.8, -1, B * 0.9, 2672))

    // the roof's underside: four facets from the edge up to the apex, darker toward the hole
    const C4: V3[] = CORNER.map(([sx, sy]) => [sx * E, -sy * E, ZE])
    const apex: V3 = [0, 0, ZA]
    const facets = C4.map((a, i) => s('path', { class: `t26c-facet f${i}`, d: poly([apex, a, C4[(i + 1) % 4]]) }))
    const deep = q(apex)
    // boards between the rafters: grain running across each facet
    let boards = ''
    for (let i = 0; i < 4; i++) {
      const a = C4[i], b = C4[(i + 1) % 4]
      for (let k = 1; k < 9; k++) {
        const t = 0.18 + k * 0.09
        const p0: V3 = [apex[0] + (a[0] - apex[0]) * t, apex[1] + (a[1] - apex[1]) * t, apex[2] + (a[2] - apex[2]) * t]
        const p1: V3 = [apex[0] + (b[0] - apex[0]) * t, apex[1] + (b[1] - apex[1]) * t, apex[2] + (b[2] - apex[2]) * t]
        boards += stroke([q(p0), q(p1)], 0.8, 0.1, 0.1, 0.4)
      }
    }
    // rafters: a bar of real thickness hanging under the boards from the hole's ring to the roof's edge — its underside in
    // shade, the side turned to you lit; heavier hip rafters to the corners. Painted far → near.
    const bars: { d: number; els: SVGElement[] }[] = []
    const rafter = (e: V3, half: number, depth: number) => {
      const dx = e[0], dy = e[1], L = Math.hypot(dx, dy)
      const ux = dx / L, uy = dy / L, nx = -uy, ny = ux
      const s0: V3 = [ux * HOLE * 1.2, uy * HOLE * 1.2, ZA - 0.16]
      const at = (p: V3, o: number, dz: number): V3 => [p[0] + nx * o, p[1] + ny * o, p[2] - dz]
      // the side facing the eye is the one on the eye's side of the rafter's plane
      const side = (EYE[0] - 0) * nx + (EYE[1] - 0) * ny > 0 ? 1 : -1
      const under = poly([at(s0, -half, depth), at(e, -half, depth), at(e, half, depth), at(s0, half, depth)])
      const face = poly([at(s0, side * half, 0), at(e, side * half, 0), at(e, side * half, depth), at(s0, side * half, depth)])
      const mid = q([(s0[0] + e[0]) / 2, (s0[1] + e[1]) / 2, (s0[2] + e[2]) / 2])
      bars.push({ d: -Math.hypot(mid[0] - deep[0], mid[1] - deep[1]), els: [s('path', { class: 't26c-rface', d: face }), s('path', { class: 't26c-runder', d: under })] })
    }
    for (let i = 0; i < 4; i++) {
      const a = C4[i], b = C4[(i + 1) % 4]
      for (let k = 1; k < 8; k++) {
        const t = k / 8
        rafter([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, ZE], 0.045, 0.085)
      }
      rafter(a, 0.085, 0.15)
    }
    bars.sort((x, y) => x.d - y.d)
    // the eave beam: its underside (you see it from below), its inner face, a moonlit outer lip; brackets on the posts
    const beamParts: SVGElement[] = []
    const [b0, b1] = BEAM
    for (let i = 0; i < 4; i++) {
      const [sx, sy] = CORNER[i], [tx, ty] = CORNER[(i + 1) % 4]
      const o = (m: number, z: number, sgn: [number, number]): V3 => [sgn[0] * (A + m), -sgn[1] * (A + m), z]
      const pA: [number, number] = [sx, sy], pB: [number, number] = [tx, ty]
      beamParts.push(s('path', { class: 't26c-bunder', d: poly([o(-0.09, b0, pA), o(-0.09, b0, pB), o(0.09, b0, pB), o(0.09, b0, pA)]) }))
      beamParts.push(s('path', { class: 't26c-binner', d: poly([o(-0.09, b0, pA), o(-0.09, b0, pB), o(-0.09, b1, pB), o(-0.09, b1, pA)]) }))
      beamParts.push(s('path', { class: 't26c-bouter', d: poly([o(0.09, b0, pA), o(0.09, b0, pB), o(0.09, b1 + 0.04, pB), o(0.09, b1 + 0.04, pA)]) }))
    }
    // the roof's edge: a fascia board with thickness, its lower lip catching the moon; beyond it, the sky
    const fascia = C4.map((a, i) => {
      const b = C4[(i + 1) % 4]
      return s('path', { class: 't26c-fascia', d: poly([a, b, [b[0], b[1], b[2] - 0.12], [a[0], a[1], a[2] - 0.12]]) })
    })
    const lip = C4.map((a, i) => { const b = C4[(i + 1) % 4]; return stroke([q([a[0], a[1], a[2] - 0.12]), q([b[0], b[1], b[2] - 0.12])], 1.6, 0.05, 0.05, 0.6) }).join('')
    // the posts: from beyond the frame's corners (you lie between them) up to the beam — two faces of each seen, lit and
    // shaded, wood grain converging with them, a bracket block under the beam
    const posts = CORNER.map(([sx, sy]) => {
      const X = sx * A, Y = -sy * A
      const z0 = EYE[2] + 0.42, z1 = b0
      const faces: SVGElement[] = []
      const edges: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
      for (let e = 0; e < 4; e++) {
        const [ax, ay] = edges[e], [bx2, by2] = edges[(e + 1) % 4]
        const mx = (ax + bx2) / 2, my = (ay + by2) / 2 // the face's outward normal (in units of PW)
        if ((EYE[0] - X) * mx + (EYE[1] - Y) * my <= 0) continue // turned away from you
        const lit = mx * -0.5 + my * 0.5 > 0
        faces.push(s('path', { class: lit ? 't26c-postlit' : 't26c-post', d: poly([[X + ax * PW, Y + ay * PW, z0], [X + bx2 * PW, Y + by2 * PW, z0], [X + bx2 * PW, Y + by2 * PW, z1], [X + ax * PW, Y + ay * PW, z1]]) }))
      }
      let grain = ''
      for (const o of [-0.4, 0.15, 0.6]) grain += stroke([q([X + o * PW, Y - PW * 0.98, z0 + 0.02]), q([X + o * PW, Y - PW * 0.98, z1])], 1, 0.1, 0.1, 0.4)
      const br = s('path', { class: 't26c-post', d: poly([[X - PW * 1.5, Y - PW * 1.5, b0 - 0.1], [X + PW * 1.5, Y - PW * 1.5, b0 - 0.1], [X + PW * 1.5, Y + PW * 1.5, b0 - 0.1], [X - PW * 1.5, Y + PW * 1.5, b0 - 0.1]]) })
      return s('g', { class: 't26c-postg' }, br, ...faces, s('path', { class: 't26c-grain', d: grain }))
    })
    // the hole, its ring beam, the moon waiting behind the cover
    const hc = q([0, 0, ZA - 0.1])
    const hr = Math.abs(q([HOLE, 0, ZA - 0.1])[0] - hc[0])
    // the question, written round the hole on the upper arc only (never upside down): one line if it fits between the hole
    // and the far lanterns, else two lines on two arcs, split at its dash (or the space nearest its middle)
    const R1 = Math.min(w * 0.4, Math.max(hr * 3.2, (hc[1] - q(lampAt(0))[1]) * 0.88))
    const SPAN = Math.PI * 0.86
    const words = S.question
    const fit = (txt: string, R: number) => (R * SPAN) / ([...txt].length * 0.53)
    let lines = [words]
    if (fit(words, R1) < 13) {
      const cut = words.includes('—') ? words.indexOf('—') + 1 : words.lastIndexOf(' ', Math.floor(words.length / 2))
      lines = [words.slice(0, cut).trim(), words.slice(cut).trim()]
    }
    const fs = Math.max(10.5, Math.min(16, fit(lines[0], R1)))
    const arcs = lines.map((_, i) => {
      const R = R1 - i * fs * 1.4, a0 = (Math.PI - SPAN) / 2
      return `M${f1(hc[0] - R * Math.cos(a0))} ${f1(hc[1] - R * Math.sin(a0))}A${f1(R)} ${f1(R)} 0 0 1 ${f1(hc[0] + R * Math.cos(a0))} ${f1(hc[1] - R * Math.sin(a0))}`
    })
    // a lit lantern warms its corner of the roof: a soft pool of light on the rafters round it
    const warm = [0, 1, 2, 3].map((k) => {
      const [x, y] = q(lampAt(k))
      return s('circle', { class: `t26c-warm q${k}`, cx: f1(x), cy: f1(y), r: f1(Math.min(w, hh) * 0.36), fill: `url(#${id}-w)` })
    })
    svg.replaceChildren(
      s('defs', null,
        s('radialGradient', { id: `${id}-w` }, s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.6' }), s('stop', { offset: 0.45, style: 'stop-color:var(--lantern);stop-opacity:.2' }), s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:0' })),
        s('radialGradient', { id: `${id}-m` }, s('stop', { offset: 0, style: 'stop-color:var(--moon);stop-opacity:.7' }), s('stop', { offset: 1, style: 'stop-color:var(--moon);stop-opacity:0' })),
        s('clipPath', { id: `${id}-hole` }, s('circle', { cx: f1(hc[0]), cy: f1(hc[1]), r: f1(hr) })),
        s('radialGradient', { id: `${id}-deep`, cx: f1(deep[0]), cy: f1(deep[1]), r: f1(Math.max(w, hh) * 0.6), gradientUnits: 'userSpaceOnUse' }, s('stop', { offset: 0, style: 'stop-color:var(--umbra);stop-opacity:.6' }), s('stop', { offset: 0.5, style: 'stop-color:var(--umbra);stop-opacity:.18' }), s('stop', { offset: 1, style: 'stop-color:var(--umbra);stop-opacity:0' })),
        s('radialGradient', { id: 't26c-lp-off', cx: '0.42', cy: '0.4', r: '0.6' }, s('stop', { offset: 0, style: 'stop-color:var(--card)' }), s('stop', { offset: 1, style: 'stop-color:var(--rock-mid)' })),
        s('radialGradient', { id: 't26c-lp-on', cx: '0.5', cy: '0.55', r: '0.6' }, s('stop', { offset: 0, style: 'stop-color:color-mix(in srgb, var(--lantern) 30%, #fff)' }), s('stop', { offset: 0.45, style: 'stop-color:var(--lantern)' }), s('stop', { offset: 1, style: 'stop-color:color-mix(in srgb, var(--lantern) 62%, var(--vermilion))' })),
        ...arcs.map((d, i) => s('path', { id: `${id}-arc${i}`, d }))),
      s('rect', { class: 't26c-skyfill', width: f1(w), height: f1(hh) }),
      s('path', { class: 't26c-stars', d: stars }),
      far,
      s('g', { class: 't26c-roof' },
        ...facets,
        s('path', { d: poly(C4), fill: `url(#${id}-deep)` }),
        s('path', { class: 't26c-boards', d: boards }),
        ...bars.flatMap((b) => b.els),
        // the hole: night sky, and the moon right overhead waiting behind the cover
        s('circle', { class: 't26c-skyfill', cx: f1(hc[0]), cy: f1(hc[1]), r: f1(hr) }),
        s('g', { 'clip-path': `url(#${id}-hole)` }, s('g', { class: 't26c-moon' }, s('circle', { cx: f1(hc[0]), cy: f1(hc[1]), r: f1(hr * 1.2), fill: `url(#${id}-m)` }), s('circle', { class: 't26c-disc', cx: f1(hc[0] + hr * 0.12), cy: f1(hc[1] - hr * 0.08), r: f1(hr * 0.55) }))),
        s('circle', { class: 't26c-ringbeam', cx: f1(hc[0]), cy: f1(hc[1]), r: f1(hr * 1.12), 'stroke-width': f1(hr * 0.3) }),
        ...lines.map((t, i) => s('text', { class: 't26c-q', style: `font-size:${f1(fs)}px` }, s('textPath', { href: `#${id}-arc${i}`, startOffset: '50%', 'text-anchor': 'middle' }, t))),
        ...fascia,
        s('path', { class: 't26c-eaverim', d: lip }),
        ...beamParts),
      ...warm,
      // the cover over the hole: planks, sliding away once all four have spoken
      s('g', { 'clip-path': `url(#${id}-hole)` }, s('g', { class: 't26c-lid', style: `--d:${f1(hr * 2.2)}px` },
        s('circle', { class: 't26c-lidwood', cx: f1(hc[0]), cy: f1(hc[1]), r: f1(hr * 1.02) }),
        s('path', { class: 't26c-lidline', d: [-0.5, 0, 0.5].map((k) => `M${f1(hc[0] + k * hr)} ${f1(hc[1] - hr)}V${f1(hc[1] + hr)}`).join('') }))),
      ...posts,
      near)
  })
  return () => {
    art.removeEventListener('pointermove', tilt)
    art.removeEventListener('pointerleave', untilt)
  }
}

export const circleScene: SceneDef = {
  label: S.label,
  mount(ctx) {
    ctx.art.classList.add('t26c-art')
    ctx.onCleanup(() => ctx.art.classList.remove('t26c-art'))
    return perspectiveCircle(S.perspectives as Perspectives, {
      label: S.label, prompt: S.prompt, stage,
      // the lanterns hang inside the roof's four corners, nearer than the roof, so a little larger
      place: (k, _n, g) => {
        const pr = camera(g)
        const [x, y, d] = pr(lampAt(k))
        const sc = Math.max(0.8, Math.min(1.3, 2.1 / d))
        const bh = Math.min(140, Math.max(64, Math.min(g.w, g.h * 1.7) * 0.19)) * 0.75
        return { x, y: y + bh * 0.28 * sc, s: sc }
      },
      stone: (k, g) => {
        // its cord runs toward the vanishing point (the hole)
        const pr = camera(g)
        const [lx, ly] = pr(lampAt(k)), [hx, hy] = pr([0, 0, ZA])
        const L = Math.hypot(hx - lx, hy - ly) || 1
        return lantern([(hx - lx) / L, (hy - ly) / L])
      },
      // the strip swings again each time someone speaks
      onHear: () => {
        const card = ctx.art.querySelector<HTMLElement>('.p2c-card')
        if (!card || ctx.reduced) return
        card.classList.remove('t26c-swing')
        void card.offsetWidth
        card.classList.add('t26c-swing')
      },
    }).mount(ctx)
  },
}
