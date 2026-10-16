import { s } from '../../core/dom'
import { blob, stroke, type Pt } from '../../ui/part2/ink'

/**
 * Brushed figures for station 21: an ink robot (boxy head with a visor slit, a washed torso, jointed limbs) or a
 * runner in a few human strokes, in one of a few poses. Standing on (0, 0), about 90 units tall; scale with a transform.
 */
export type Pose = 'run' | 'walk' | 'stumble' | 'fallen'

// angles from straight down, + = forward (toward +x): [hip, knee] per leg, [shoulder, elbow] per arm, torso lean
const POSES: Record<Exclude<Pose, 'fallen'>, { lean: number; legs: [number, number][]; arms: [number, number][] }> = {
  run: { lean: 0.32, legs: [[0.75, -0.25], [-0.65, -1.35]], arms: [[1.0, 1.3], [-0.8, 0.9]] },
  walk: { lean: 0.08, legs: [[0.35, -0.08], [-0.3, -0.35]], arms: [[0.35, 0.4], [-0.35, 0.2]] },
  stumble: { lean: -0.22, legs: [[0.55, -0.15], [0.05, -0.75]], arms: [[2.3, 0.5], [-2.0, -0.6]] },
}

const dir = (a: number): Pt => [Math.sin(a), Math.cos(a)]
const add = (p: Pt, a: number, l: number): Pt => [p[0] + dir(a)[0] * l, p[1] + dir(a)[1] * l]

export function figure(pose: Pose, human = false, cls = 't21-fig'): SVGGElement {
  const P = POSES[pose === 'fallen' ? 'run' : pose]
  const thigh = 21, shin = 21, upper = 15, fore = 15, torso = 30
  const hip: Pt = [0, -(thigh + shin) * 0.94]
  const neck = add(hip, Math.PI - P.lean, torso)
  const shoulder = add(neck, P.lean, 3)
  let limbs = ''
  const joints: Pt[] = []
  for (const [a, b] of P.legs) {
    const knee = add(hip, a, thigh)
    const foot = add(knee, a + b, shin)
    limbs += stroke([hip, knee, foot], human ? 4.2 : 5.4, 0.04, 0.3, 0.5)
    joints.push(knee)
  }
  for (const [a, b] of P.arms) {
    const elbow = add(shoulder, a, upper)
    const hand = add(elbow, a + b, fore)
    limbs += stroke([shoulder, elbow, hand], human ? 3 : 4, 0.05, 0.35, 0.45)
    joints.push(elbow)
  }
  const head = add(neck, Math.PI - P.lean, human ? 7 : 9)
  // torso: wider at the chest, a little waist (robot) or a single strong stroke (human)
  const n: Pt = dir(Math.PI / 2 - P.lean)
  const chest = human ? 4.5 : 8, waist = human ? 3.5 : 5.5
  const body = human
    ? stroke([hip, add(hip, Math.PI - P.lean, torso * 0.5), neck], 7, 0.1, 0.2, 0.6)
    : `M${(hip[0] - n[0] * waist).toFixed(1)} ${(hip[1] - n[1] * waist).toFixed(1)}L${(neck[0] - n[0] * chest).toFixed(1)} ${(neck[1] - n[1] * chest).toFixed(1)}L${(neck[0] + n[0] * chest).toFixed(1)} ${(neck[1] + n[1] * chest).toFixed(1)}L${(hip[0] + n[0] * waist).toFixed(1)} ${(hip[1] + n[1] * waist).toFixed(1)}Z`
  const deg = (P.lean * 180) / Math.PI
  const g = s('g', { class: `${cls}${human ? ' human' : ''}` },
    s('ellipse', { class: 't21-shadow', cx: 2, cy: 1.5, rx: 20, ry: 3 }),
    s('path', { class: 't21-limb', d: limbs, filter: 'url(#ink-rough)' }),
    s('path', { class: human ? 't21-limb' : 't21-torso', d: body, filter: 'url(#ink-rough)' }),
    human ? null : s('path', { class: 't21-limb', d: stroke([[hip[0] - n[0] * waist, hip[1] - n[1] * waist], [neck[0] - n[0] * chest, neck[1] - n[1] * chest]], 1.8, 0.1, 0.1, 0.4) + stroke([[neck[0] - n[0] * chest, neck[1] - n[1] * chest], [neck[0] + n[0] * chest, neck[1] + n[1] * chest]], 2.2, 0.1, 0.1, 0.5), filter: 'url(#ink-rough)' }),
    human
      ? s('circle', { class: 't21-limb', cx: head[0].toFixed(1), cy: head[1].toFixed(1), r: 5 })
      : s('g', { transform: `rotate(${deg.toFixed(1)} ${head[0].toFixed(1)} ${head[1].toFixed(1)})` },
          s('path', { class: 't21-torso', d: blob(head[0], head[1], 7.5, 7, 5, 0.08, 10), filter: 'url(#ink-rough)' }),
          s('path', { class: 't21-visor', d: stroke([[head[0] - 3.5, head[1] - 0.5], [head[0] + 6, head[1] - 1]], 2.6, 0.2, 0.2, 0.4) })),
    human ? null : s('path', { class: 't21-joint', d: joints.map(([x, y]) => blob(x, y, 2.2, 2.2, 1, 0.05, 8)).join('') }))
  if (pose === 'fallen') g.setAttribute('transform', 'translate(-30 -8) rotate(-78 30 8)')
  return g
}

/** An industrial robot arm bolted to the floor (the "5 million in factories" milestone). */
export function factoryArm(cls = 't21-fig'): SVGGElement {
  const base: Pt = [0, 0], j1: Pt = [0, -26], j2: Pt = [24, -58], j3: Pt = [52, -46]
  return s('g', { class: cls },
    s('ellipse', { class: 't21-shadow', cx: 0, cy: 1.5, rx: 18, ry: 3 }),
    s('path', { class: 't21-torso', d: `M-14 0L-9 -10H9L14 0Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't21-limb', d: stroke([base, j1], 9, 0.05, 0.05, 0.8) + stroke([j1, j2], 7, 0.05, 0.1, 0.7) + stroke([j2, j3], 5, 0.05, 0.2, 0.6) + stroke([j3, [58, -38], [55, -32]], 2.4, 0.1, 0.4, 0.3) + stroke([j3, [60, -48], [64, -42]], 2.4, 0.1, 0.4, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 't21-joint', d: [j1, j2, j3].map(([x, y]) => blob(x, y, 3.4, 3.4, 2, 0.05, 8)).join('') }))
}
