import raw from '../../content/tram-33.json'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import { blob, curve, onSize, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, pine, toro } from '../../ui/part2/paint'
import { guide, type Mark, type Track } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import './whisper.css'
import { cardSheet, f1, guard, lantern, live, P, t33Defs } from './kit'

const K = raw.scenes.whisper
const L = K.letter

/**
 * The wet stone steps seen from above (px W × H): the step the letter lies on is three flagstones with mossy joints and a
 * real thickness at its near edge; the next step up shows its riser; dew drops with a bright point each, a puddle with the moon.
 * Returns the art and the slab outline (for the grain laid over the stone).
 */
function stepArt(W: number, H: number, top: number, mobile: boolean, seed: number, moonX: number) {
  const r = rng(seed)
  const near = H * (mobile ? 0.93 : 0.85), thick = H * 0.05
  const l0 = W * 0.13, r0 = W * 0.87, l1 = -W * 0.12, r1 = W * 1.12
  const v = (y: number) => (y - top) / (near - top)
  const xL = (y: number) => l0 + (l1 - l0) * v(y), xR = (y: number) => r0 + (r1 - r0) * v(y)
  // a hewn granite slab: its edges wander a little (chipped, worn), the back edge bowed
  const wob = (p: Pt[], k: number) => p.map(([x, y], i) => (i && i < p.length - 1 ? [x + (r() - 0.5) * k, y + (r() - 0.5) * k] : [x, y]) as Pt)
  const line = (a: Pt, b: Pt, n: number, bow = 0): Pt[] => Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * bow] as Pt
  })
  const back = wob(line([l0, top], [r0, top + 2], 14, 8), H * 0.008)
  const right = wob(line([r0, top + 2], [r1, near], 8), W * 0.006)
  const front = wob(line([r1, near], [l1, near], 16), H * 0.004)
  const left = wob(line([l1, near], [l0, top], 8), W * 0.006)
  const slab = `M${[...back, ...right.slice(1), ...front.slice(1), ...left.slice(1)].map(P).join('L')}Z`
  // the near edge: the slab's thickness (chipped along its foot), then the dark ground below it
  const foot = wob(line([r1, near + thick], [l1, near + thick], 16, -4), H * 0.01)
  const face = `M${front.map(P).join('L')}L${foot.map(P).join('L')}Z`
  // the stone step behind, a little higher and narrower: a rounded natural stone, its riser in shadow, its worn top
  const rt = top - H * 0.075, b0 = l0 + W * 0.1, b1 = r0 - W * 0.08
  const rTop = wob(line([b0 + W * 0.02, rt - H * 0.045], [b1 - W * 0.02, rt - H * 0.05], 12, 6), H * 0.008)
  const rMid = wob(line([b1, rt], [b0, rt], 12, -5), H * 0.006)
  const rBot = wob(line([b0 - 6, top - 2], [b1 + 6, top], 12, 7), H * 0.005)
  const riser = `M${rBot.map(P).join('L')}L${P([b1 + 2, rt + 4])}L${rMid.map(P).join('L')}L${P([b0 - 2, rt + 4])}Z`
  const lip = `M${P([b0, rt])}Q${f1(b0 - W * 0.01)} ${f1(rt - H * 0.03)} ${P(rTop[0])}L${rTop.map(P).join('L')}Q${f1(b1 + W * 0.01)} ${f1(rt - H * 0.03)} ${P([b1, rt])}L${[...rMid].map(P).join('L')}Z`
  // two joints run from the back edge to the near edge (wobbling), one short cross joint: three flagstones
  const joint = (f0: number, f1_: number, k: number): Pt[] => Array.from({ length: 9 }, (_, i) => {
    const y = top + ((near - top) * i) / 8
    const f = f0 + (f1_ - f0) * (i / 8)
    return [xL(y) + (xR(y) - xL(y)) * f + (i && i < 8 ? (r() - 0.5) * W * 0.012 * k : 0), y + (i === 0 ? -3 : 0)] as Pt
  })
  const j1 = joint(0.36, 0.3, 1), j2 = joint(0.66, 0.72, 1)
  const cy0 = top + (near - top) * 0.55
  const cross: Pt[] = [[xL(cy0) + (xR(cy0) - xL(cy0)) * 0.665, cy0], [xR(cy0 + 6) - W * 0.01, cy0 + 8]]
  const poly = (pts: Pt[]) => `M${pts.map(P).join('L')}Z`
  const stone0 = poly([[l0, top], ...j1, [l1, near]])
  const stone1 = poly([...j1, ...[...j2].reverse()])
  const stone2 = poly([...j2, [r1, near], [r0, top + 2]])
  const joints = stroke(j1, Math.max(3, W * 0.004), 0.05, 0.05, 0.6) + stroke(j2, Math.max(3, W * 0.004), 0.05, 0.05, 0.6) + stroke(cross, Math.max(2.4, W * 0.003), 0.1, 0.1, 0.6)
  // the chamfered edges catch the moon
  const chamfer = stroke(j1.map(([x, y]) => [x + 3, y] as Pt), 1.2, 0.2, 0.3, 0.1) + stroke(j2.map(([x, y]) => [x + 3, y] as Pt), 1.2, 0.2, 0.3, 0.1) + stroke([[l0 + 6, top + 2], [W / 2, top - 5], [r0 - 6, top + 3]], 1.6, 0.1, 0.1, 0.3) + stroke([[l1, near - 1], [W / 2, near - 2], [r1, near - 1]], 2, 0.05, 0.05, 0.4)
  let moss = ''
  for (const j of [j1, j2]) for (let i = 1; i < 8; i += 1 + Math.floor(r() * 2)) moss += blob(j[i][0], j[i][1], W * (0.008 + r() * 0.01), H * (0.008 + r() * 0.008), seed + i * 3, 0.4, 10)
  moss += blob(l0 + W * 0.03, top + H * 0.03, W * 0.05, H * 0.022, seed + 90, 0.4, 12) + blob(r1 - W * 0.08, near - H * 0.02, W * 0.08, H * 0.03, seed + 91, 0.4, 12) + blob(l1 + W * 0.08, near - H * 0.015, W * 0.07, H * 0.025, seed + 92, 0.4, 12)
  // dew: each drop a small dark lens with a bright point on its moon side and a soft shadow
  let drops = '', lit = '', dsh = '', pits = ''
  for (let i = 0; i < 70; i++) {
    const vv = Math.pow(r(), 0.75), y = top + 6 + (near - top - 10) * vv
    const x = xL(y) + (xR(y) - xL(y)) * (0.04 + r() * 0.92)
    const k = (0.7 + vv * 1.6) * (mobile ? 0.8 : 1)
    if (i < 46) {
      const rx = k * (1.2 + r() * 1.4), ry = rx * (0.7 + r() * 0.2)
      dsh += blob(x + rx * 0.4, y + ry * 0.6, rx, ry * 0.8, seed + i, 0.1, 8)
      drops += blob(x, y, rx, ry, seed + i, 0.08, 8)
      lit += blob(x - rx * 0.35, y - ry * 0.35, rx * 0.32, ry * 0.28, seed + i + 200, 0.05, 6)
    } else pits += blob(x, y, k * (2 + r() * 3), k * (1 + r() * 1.5), seed + i, 0.4, 8)
  }
  const pudX = mobile ? W * 0.84 : W * 0.5 + Math.min(W * 0.44, 620) * 0.68, pudY = top + (near - top) * (mobile ? 0.8 : 0.78)
  const pud = blob(pudX, pudY, W * (mobile ? 0.1 : 0.055), H * 0.024, seed + 95, 0.25, 16)
  // wet patches darken the stone in soft islands; the riser has its own joints
  let wetp = ''
  for (let i = 0; i < 7; i++) {
    const y = top + (near - top) * (0.15 + r() * 0.8), x = xL(y) + (xR(y) - xL(y)) * (0.08 + r() * 0.84)
    wetp += blob(x, y, W * (0.04 + r() * 0.06), H * (0.02 + r() * 0.03), seed + 60 + i, 0.35, 14)
  }
  let rj = ''
  for (const f of [0.3, 0.62]) rj += stroke([[b0 + (b1 - b0) * f, rt + 4], [b0 + (b1 - b0) * f + 3, top - 4]], 2, 0.05, 0.05, 0.6)
  // the flagstones' joints run on down the near face
  let fj = ''
  for (const j of [j1, j2]) fj += stroke([[j[8][0], near], [j[8][0] + 1, near + thick]], 2.4, 0.05, 0.05, 0.6)
  return {
    slab: slab + face + riser + lip,
    art: [
      s('path', { class: 't33w-lip', d: lip, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-riser', d: riser, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-risersh', d: riser }),
      s('path', { class: 't33w-joint', d: rj, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-moss', d: blob(b0 + (b1 - b0) * 0.3, top - 2, W * 0.06, H * 0.01, seed + 97, 0.4, 12) + blob(b0 + (b1 - b0) * 0.8, top, W * 0.05, H * 0.009, seed + 98, 0.4, 12) + blob(b0 + (b1 - b0) * 0.55, rt - H * 0.04, W * 0.07, H * 0.008, seed + 99, 0.4, 12), filter: 'url(#ink-wash)' }),
      s('path', { class: 't33w-ground', d: `M${f1(l1)} ${f1(near + thick - 2)}L${f1(r1)} ${f1(near + thick - 2)}L${f1(r1)} ${f1(H + 40)}L${f1(l1)} ${f1(H + 40)}Z` }),
      s('path', { class: 't33w-face', d: face, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-joint', d: fj, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-slab', d: slab, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-fs t33w-fs0', d: stone0 }),
      s('path', { class: 't33w-fs t33w-fs1', d: stone1 }),
      s('path', { class: 't33w-fs t33w-fs2', d: stone2 }),
      s('path', { class: 't33w-wet', d: slab }),
      s('path', { class: 't33w-wetp', d: wetp, filter: 'url(#ink-wash)' }),
      s('path', { class: 't33w-pits', d: pits }),
      s('path', { class: 't33w-joint', d: joints, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33w-moss', d: moss, filter: 'url(#ink-wash)' }),
      s('path', { class: 't33w-edge', d: chamfer }),
      s('path', { class: 't33w-puddle', d: pud }),
      s('path', { class: 't33w-pudrim', d: stroke(curve([pudX - W * 0.05, pudY - H * 0.012], [pudX, pudY - H * 0.03], [pudX + W * 0.05, pudY - H * 0.01], 10), 1.4, 0.2, 0.2, 0.1) }),
      s('ellipse', { class: 't33w-sheen', cx: f1(moonX), cy: f1(top + (near - top) * 0.45), rx: f1(W * 0.04), ry: f1((near - top) * 0.45) }),
      // the moon lying on the wet stone: broken strokes running down from the back edge, longer toward us
      s('path', { class: 't33w-mstreak', d: Array.from({ length: 11 }, (_, i) => {
        const v = i / 10, y = top + 8 + (near - top - 16) * v, len = W * (0.012 + v * 0.04)
        return stroke([[moonX - len / 2 + (r() - 0.5) * 6, y], [moonX + len / 2 + (r() - 0.5) * 6, y + 1]], 1 + v * 2.6, 0.3, 0.3, 0.1)
      }).join('') }),
      s('path', { class: 't33w-dropsh', d: dsh }),
      s('path', { class: 't33w-drop', d: drops }),
      s('path', { class: 't33w-droplit', d: lit }),
      grass(l0 - 8, top + 4, 30, seed + 93), grass(r0 + 10, top + 6, 26, seed + 94), grass(r1 - W * 0.12, near + 4, 40, seed + 96),
    ],
  }
}

/** The garden's mail gate (viewBox 0 0 80 100): two posts and a lintel, its leaves swung open — or shut under two paper seals. */
function gateArt() {
  return s('svg', { viewBox: '0 0 80 100', 'aria-hidden': 'true' },
    s('path', { class: 't33w-gsh', d: 'M2 98H84L76 100H6Z' }),
    s('g', { class: 't33w-gopen' }, s('path', { class: 't33w-gleaf', d: 'M22 30L10 36V96L22 92ZM58 30L70 36V96L58 92Z' })),
    s('g', { class: 't33w-gshut' },
      s('path', { class: 't33w-gleaf', d: 'M22 30H58V94H22Z' }),
      s('path', { class: 't33w-gseam', d: 'M40 30V94' }),
      s('path', { class: 't33w-gseal', d: 'M20 36L24 32L60 86L56 90ZM56 32L60 36L24 90L20 86Z' }),
      s('path', { class: 't33w-gstamp', d: 'M36 56H44V64H36Z' })),
    s('path', { class: 't33w-gpost', d: 'M15 20H22V98H15ZM58 20H65V98H58Z' }),
    s('path', { class: 't33w-groof', d: 'M2 22Q40 10 78 22L74 28H6Z', filter: 'url(#ink-rough)' }),
    s('path', { class: 't33w-gbeam', d: 'M10 30H70V34H10Z' }))
}

/** A folded paper crane (viewBox -30 -20 60 40): what the agent sends out when it obeys the hidden line. */
const craneArt = () => s('svg', { viewBox: '-30 -20 60 40', 'aria-hidden': 'true' },
  s('path', { class: 't33w-cwing', d: 'M-4 2L6 -18L10 2Z' }),
  s('path', { class: 't33w-cbody', d: 'M-28 -6L-6 4L0 12L6 4L28 -10L8 6L0 14L-8 6Z' }),
  s('path', { class: 't33w-cwing2', d: 'M-2 4L-14 -16L4 2Z' }))

/**
 * Scene 3 — a polite letter on a wet step: hold the lantern behind it and the hidden line glows through like a watermark.
 * Then what the line does: the agent obeys, a paper crane carries the file to the garden gate. Sealed gate (the keys scene
 * kept the "send" key, or tied its thread): the crane stops there. Open gate: it flies off, and touching the gate seals it.
 */
export function whisperScene(ctx: SceneCtx) {
  t33Defs()
  const low = ctx.quality === 'low'
  const quick = low || ctx.reduced
  let raised = low, done = false

  const night = s('svg', { class: 't33-night', 'aria-hidden': 'true' })
  const step = s('svg', { class: 't33w-step t33-fade', 'aria-hidden': 'true' })
  const hiddenDim = h('p', { class: 't33w-hidden', 'aria-hidden': 'true' }, L.hidden)
  const hiddenLit = h('p', { class: 't33w-hidden t33w-glow', 'aria-hidden': 'true' }, L.hidden)
  const hiddenAll = h('p', { class: 't33w-hidden t33w-full', 'aria-hidden': 'true' }, L.hidden)
  const sheet = h('div', { class: 't33w-sheet' },
    h('div', { class: 't33w-backlit', 'aria-hidden': 'true' }),
    h('p', { class: 't33w-from' }, L.from),
    ...L.visible.map((t) => h('p', { class: 't33w-line' }, t)),
    h('div', { class: 't33w-wm' }, hiddenDim, hiddenLit, hiddenAll),
    h('p', { class: 't33w-seal' }, K.mock),
    h('div', { class: 't33w-sweep', 'aria-hidden': 'true' }))
  const letter = h('div', { class: 't33w-letter' }, h('div', { class: 't33w-shadow', 'aria-hidden': 'true' }), sheet, h('div', { class: 't33w-ear', 'aria-hidden': 'true' }), h('div', { class: 't33w-stand', 'aria-hidden': 'true' }))
  const bail = s('svg', { class: 't33w-bail', viewBox: '0 0 40 30', 'aria-hidden': 'true' },
    s('path', { class: 't33w-bailp', d: stroke(curve([6, 30], [20, -10], [34, 30], 16), 2.6, 0.1, 0.1, 0.7), filter: 'url(#ink-rough)' }),
    s('path', { class: 't33w-bailrim', d: stroke(curve([8, 26], [16, 2], [24, 4], 10), 0.9, 0.2, 0.4, 0.2) }))
  const lamp = h('button', { class: 't33w-lamp', type: 'button', 'aria-label': K.lanternAria }, h('span', { class: 't33w-pool', 'aria-hidden': 'true' }), h('span', { class: 't33w-refl', 'aria-hidden': 'true' }), bail, lantern('on', 3331))
  const tex = h('div', { class: 't33w-tex t33-fade', 'aria-hidden': 'true' })
  const say = live('t33w-say t33-ink')
  const stage = h('div', { class: 't33w-stage' }, step, tex, letter, lamp)
  const gate = h('button', { class: 't33w-gate', type: 'button', 'aria-label': K.gateAria, disabled: true }, gateArt())
  const crane = h('div', { class: 't33w-crane', 'aria-hidden': 'true' }, craneArt())
  let sealed = guard.send === true
  gate.classList.toggle('sealed', sealed)
  const root = h('div', { class: `t33 t33w${low ? ' low up' : ''}`, role: 'group', 'aria-label': K.aria },
    night, gate, stage, crane, say,
    h('p', { class: 'visually-hidden' }, K.art))
  ctx.art.append(root)
  const card = cardSheet(root, K.takeaway, ctx.onCleanup)
  // guide (H1, H2/H4, H5): a dot on the lantern's handle; held, a faint arrow toward the paper; a groove under the hidden
  // line fills as the light passes behind it; the prompt per step
  const g = guide(ctx)
  const steps = g.steps(K.prompts)
  ctx.prompt(K.prompt)
  const dot = g.dot(lamp, { dir: [-1, -0.4] })
  let arrow: Mark | null = null
  let way: Track | null = null
  let line: [number, number, number] = [0, 0, 0] // under the hidden line: x0, y, x1 (px in the scene)

  // ── layout: the night, the step, where the letter and the lantern rest
  const G = { W: 0, H: 0, home: [0, 0] as Pt }
  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    const W = root.clientWidth, H = root.clientHeight
    if (!W || !H) return
    const mobile = W < 640
    G.W = W
    G.H = H
    const lw = Math.round(mobile ? W * 0.74 : Math.min(W * 0.44, 620))
    root.style.setProperty('--lw', `${lw}px`)
    const top = H * (mobile ? 0.5 : 0.44)
    // the letter in the middle-left third, the lantern in the right third beside it (a phone: letter centred, lantern at its foot)
    const lcx = mobile ? W * 0.43 : W * 0.4
    root.style.setProperty('--lcx', `${f1(lcx)}px`)
    G.home = mobile ? [W * 0.89, H * 0.9] : [W * 0.76, H * 0.75]
    // the far bank: a strip of dark garden between the sky (≤ 25%) and the step; the mail gate stands on it, at the end of a path
    const hz = mobile ? H * 0.3 : H * 0.24
    const gw = mobile ? 62 : Math.max(80, Math.min(120, W * 0.08))
    const gx = mobile ? W * 0.81 : W * 0.07, gy = mobile ? top - H * 0.035 : top - H * 0.05 // the gate's feet
    Object.assign(gate.style, { left: `${f1(gx)}px`, top: `${f1(gy - gw * 1.22)}px`, width: `${f1(gw)}px`, height: `${f1(gw * 1.25)}px` })
    const moonX = mobile ? W * 0.84 : W * 0.88
    for (const g of [night, step]) g.setAttribute('viewBox', `0 0 ${W} ${H}`)
    function* draw() {
      // a low bamboo fence along the far bank, the gate in it; a few stepping stones from the step up to the gate
      const fy = gy - 2, fx0 = gx + gw * 0.82, fx1 = mobile ? W * 0.5 : W * 0.6
      let fence = '', rails = ''
      for (let x = gx - gw * 0.9; x < gx + gw * 0.1; x += gw * 0.16) fence += stroke([[x, fy], [x, fy - gw * 0.55]], 2.4, 0.05, 0.05, 0.8)
      for (let x = fx0; x < fx1; x += gw * 0.16 + (x - fx0) * 0.004) fence += stroke([[x, fy - (x - fx0) * 0.02], [x, fy - (x - fx0) * 0.02 - gw * 0.55 * (1 - (x - fx0) / (fx1 - fx0) * 0.35)]], 2.2, 0.05, 0.05, 0.8)
      rails += stroke([[gx - gw * 0.95, fy - gw * 0.42], [gx + gw * 0.12, fy - gw * 0.42]], 1.6, 0.05, 0.05, 0.6) + stroke([[fx0 - 2, fy - gw * 0.42], [fx1, fy - (fx1 - fx0) * 0.02 - gw * 0.36]], 1.6, 0.05, 0.05, 0.6)
      let path = ''
      for (let i = 0; i < 3; i++) {
        const u = (i + 1) / 4
        path += blob(gx + gw * 0.5 + (lcx * 0.6 - gx) * u * 0.6, gy + (top - gy) * u, gw * (0.24 + u * 0.12), H * (0.008 + u * 0.004), 3335 + i, 0.15, 12)
      }
      night.replaceChildren(
        mist(W * 0.5, hz - H * 0.06, W * 0.6, H * 0.1),
        moon(moonX, H * (mobile ? 0.07 : 0.09), mobile ? 12 : Math.max(14, Math.min(W, H) * 0.032), 3332, true),
        hills(-W * 0.05, W * 1.05, hz, H * 0.14, 3333, 0.92, 6),
        mist(W * 0.5, hz + H * 0.005, W * 0.62, H * 0.04),
        // the far bank: dark moss running from the horizon to the back of the step
        s('path', { class: 't33w-bank', d: `M${f1(-10)} ${f1(hz)}L${f1(W + 10)} ${f1(hz)}L${f1(W + 10)} ${f1(top + 6)}L${f1(-10)} ${f1(top + 6)}Z` }),
        pine(W * (mobile ? 0.3 : 0.26), hz + H * 0.07, H * (mobile ? 0.17 : 0.2), 3336, -1),
        pine(W * (mobile ? 0.64 : 0.7), hz + H * 0.05, H * (mobile ? 0.12 : 0.15), 3337, 1),
        mist(W * 0.45, hz + H * 0.06, W * 0.5, H * 0.03),
        ...(mobile ? [] : [s('ellipse', { class: 't33w-toropool', cx: f1(W * 0.56), cy: f1(top - H * 0.035), rx: f1(H * 0.07), ry: f1(H * 0.014) }), toro(W * 0.56, top - H * 0.035, H * 0.13, true)]),
        s('path', { class: 't33w-fence', d: fence + rails, filter: 'url(#ink-rough)' }),
        s('path', { class: 't33w-pathst', d: path, filter: 'url(#ink-rough)' }),
        mist(W * 0.5, top - H * 0.005, W * 0.7, H * 0.025))
      yield
      const st = stepArt(W, H, top, mobile, 3334, moonX)
      step.replaceChildren(...st.art)
      tex.style.clipPath = `path('${st.slab}')`
      placeLamp()
    }
    job?.cancel()
    job = sliced(draw(), { sync: ctx.reduced || !first })
    first = false
  }
  ctx.onCleanup(onSize(root, layout))
  ctx.onCleanup(() => job?.cancel())

  // ── the lantern: where it stands; held, it follows the pointer and goes behind the paper
  let lx = 0, ly = 0
  const placeLamp = () => {
    if (behind) return placeBehind()
    if (!held) [lx, ly] = G.home
    lamp.style.transform = `translate(${f1(lx)}px, ${f1(ly)}px)`
  }
  /** the end: the lantern rests behind the standing letter, its light glowing through the lower corner of the paper */
  let behind = false
  function placeBehind() {
    measure()
    if (!box || !rootBox) return
    const px = box.width * 0.72, py = box.height - lamp.offsetHeight * 0.5
    lx = box.left - rootBox.left + px
    ly = box.bottom - rootBox.top - 2
    lamp.style.transform = `translate(${f1(lx)}px, ${f1(ly)}px)`
    sheet.style.setProperty('--lx', `${f1(px)}px`)
    sheet.style.setProperty('--ly', `${f1(py)}px`)
    sheet.classList.add('lit')
  }
  let held = false, moved = false, p0: Pt = [0, 0]
  let box: DOMRect | null = null, wm: DOMRect | null = null, rootBox: DOMRect | null = null
  const seen = new Array(12).fill(false)
  function raise() {
    if (raised) return
    raised = true
    root.classList.add('up')
    ctx.chime('soft')
  }
  /** the light through the paper at screen point (x, y): only CSS variables are written */
  function shine(x: number, y: number) {
    if (!box || !wm) return
    const px = x - box.left, py = y - box.top
    sheet.style.setProperty('--lx', `${f1(px)}px`)
    sheet.style.setProperty('--ly', `${f1(py)}px`)
    sheet.classList.toggle('lit', px > -40 && px < box.width + 40 && py > -40 && py < box.height + 40)
    // which part of the hidden line has had the light behind it
    const R = Math.min(110, box.width * 0.22)
    if (y > wm.top - R * 0.6 && y < wm.bottom + R * 0.6) {
      for (let i = 0; i < seen.length; i++) {
        const cx = wm.left + ((i + 0.5) / seen.length) * wm.width
        if (Math.abs(cx - x) < R * 0.8) seen[i] = true
      }
      const n = seen.filter(Boolean).length
      way?.set(n / (seen.length * 0.7))
      if (n >= seen.length * 0.7) sweep()
    }
  }
  const measure = () => {
    box = sheet.getBoundingClientRect()
    wm = hiddenDim.getBoundingClientRect()
    rootBox = root.getBoundingClientRect()
    sheet.style.setProperty('--wx', `${f1(wm.left - box.left)}px`)
    sheet.style.setProperty('--wy', `${f1(wm.top - box.top)}px`)
    line = [wm.left - rootBox.left, wm.bottom - rootBox.top + 4, wm.right - rootBox.left]
    if (!done) {
      way ??= g.track(() => [[line[0], line[1]], [line[2], line[1]]])
      g.refresh()
    }
  }
  lamp.addEventListener('pointerdown', (e) => {
    if (done && !raised) return
    e.preventDefault()
    lamp.setPointerCapture(e.pointerId)
    held = true
    moved = false
    p0 = [e.clientX, e.clientY]
    root.classList.add('held')
    raise()
    if (!done) {
      steps(1)
      dot.done()
      // the hidden gesture: carry it behind the paper (a faint curved arrow from the lantern toward the letter)
      arrow ??= g.gesture('swipe', () => [(lx + (box && rootBox ? box.left - rootBox.left + box.width / 2 : lx)) / 2, ly - 60], { r: 46 })
    }
    // the letter takes a moment to stand: measure it where it will be
    const later = quick ? 0 : 1100
    const id = setTimeout(measure, later)
    ctx.onCleanup(() => clearTimeout(id))
    if (quick) measure()
  })
  lamp.addEventListener('pointermove', (e) => {
    if (!held) return
    if (!moved && Math.hypot(e.clientX - p0[0], e.clientY - p0[1]) < 6) return
    moved = true
    rootBox ??= root.getBoundingClientRect()
    lx = e.clientX - rootBox.left
    ly = e.clientY - rootBox.top + 30
    lamp.style.transform = `translate(${f1(lx)}px, ${f1(ly)}px)`
    shine(e.clientX, e.clientY)
  })
  const drop = () => {
    if (!held) return
    held = false
    root.classList.remove('held')
    if (!behind) sheet.classList.remove('lit')
    placeLamp()
  }
  lamp.addEventListener('pointerup', drop)
  lamp.addEventListener('pointercancel', drop)
  // keyboard (Enter / Space) or a tap without a drag: the letter stands and the lantern passes behind it by itself
  lamp.addEventListener('click', () => {
    if (moved) return
    raise()
    sweep()
  })
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== ' ' || (e.target as Element).closest?.('input, textarea, button:not(.t33w-lamp)')) return
    e.preventDefault()
    raise()
    sweep()
  }
  addEventListener('keydown', onKey)
  ctx.onCleanup(() => removeEventListener('keydown', onKey))
  // H7 · standing still: the lantern leans toward the letter on its bail
  const onIdle = () => {
    if (quick || held || done) return
    const lan = lamp.querySelector('.t33-lan') as SVGElement | null
    lan?.animate([{ rotate: '0deg' }, { rotate: '-10deg', offset: 0.35 }, { rotate: '4deg', offset: 0.7 }, { rotate: '0deg' }], { duration: 1500, easing: 'ease-in-out' })
  }
  ctx.el.addEventListener('p2:idle', onIdle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', onIdle))

  // ── the agent's eye: one cold, even light across the whole sheet; nothing hides from it
  function sweep() {
    if (done) return
    done = true
    dot.done()
    arrow?.done()
    way?.set(1)
    const go = () => {
      root.classList.add('swept')
      ctx.chime('low')
      const id = setTimeout(() => {
        root.classList.add('shown', 'behind')
        behind = true
        if (!held) placeBehind()
        say.say(h('p', { class: 'visually-hidden' }, L.hidden), h('p', null, K.revealed))
        way?.done()
        const fly = setTimeout(send, quick ? 600 : 1800)
        ctx.onCleanup(() => clearTimeout(fly))
      }, quick ? 0 : 1500)
      ctx.onCleanup(() => clearTimeout(id))
    }
    const id = setTimeout(go, quick ? 0 : raised && root.classList.contains('up') ? 500 : 1300)
    ctx.onCleanup(() => clearTimeout(id))
  }

  // ── what the hidden line does: the agent obeys and sends a crane out through the garden gate
  let gateDot: Mark | null = null
  function send() {
    const sb = sheet.getBoundingClientRect(), gb = gate.getBoundingClientRect(), rb = root.getBoundingClientRect()
    const a: Pt = [sb.left - rb.left + sb.width * 0.5, sb.top - rb.top + sb.height * 0.45]
    const b: Pt = [gb.left - rb.left + gb.width * 0.5, gb.top - rb.top + gb.height * 0.55]
    const at = (p: Pt, rot = 0, sc = 1) => `translate(${f1(p[0])}px, ${f1(p[1])}px) rotate(${rot}deg) scale(${sc})`
    crane.classList.add('on')
    const mid: Pt = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 60]
    const frames = sealed
      // it reaches the sealed gate, bumps it and drops to the ground
      ? [{ transform: at(a, 0, 0.6), opacity: 0 }, { transform: at(a, -8), opacity: 1, offset: 0.12 }, { transform: at(mid, -14), offset: 0.5 }, { transform: at([b[0] + 26, b[1]], -6), offset: 0.82 }, { transform: at([b[0] + 34, b[1] + 40], 40, 0.9), opacity: 0.85 }]
      // it flies through the open gate and is gone
      : [{ transform: at(a, 0, 0.6), opacity: 0 }, { transform: at(a, -8), opacity: 1, offset: 0.12 }, { transform: at(mid, -14), offset: 0.45 }, { transform: at(b, -10, 0.8), offset: 0.75 }, { transform: at([b[0] - 120, b[1] - 140], -20, 0.4), opacity: 0 }]
    const anim = crane.animate(frames, { duration: quick ? 1 : 2600, easing: 'ease-in-out', fill: 'forwards' })
    ctx.onCleanup(() => anim.cancel())
    anim.onfinish = () => {
      if (sealed) return stopped()
      ctx.chime('low')
      ctx.prompt(K.flew, 'wrong')
      gate.disabled = false
      gateDot = g.dot(gate, { dir: [0, 1] })
    }
  }
  function stopped() {
    say.say(h('p', { class: 'visually-hidden' }, L.hidden), h('p', null, K.stopped))
    ctx.chime('ok')
    ctx.insight(K.insight as Fact, K.detail as Fact)
    card.show()
  }
  // sealing the gate takes the "send out" right away from the agent: the crane is sent again and stops there
  gate.addEventListener('click', () => {
    if (sealed) return
    sealed = true
    gate.disabled = true
    gate.classList.add('sealed')
    gateDot?.done()
    g.ok(gate)
    ctx.chime('tap')
    const id = setTimeout(send, quick ? 0 : 700)
    ctx.onCleanup(() => clearTimeout(id))
  })
}
