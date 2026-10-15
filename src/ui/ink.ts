import { s } from '../core/dom'
import { onPrefs, prefs } from '../core/prefs'

/** Noise octaves for a feTurbulence: 1 at quality=low (noise costs per octave, per pixel, on every repaint). */
export const octaves = (n: number) => String(prefs.quality === 'low' ? 1 : n)
/** Light ink at quality=low: drop the soft blur after a displacement wash. */
export const liteInk = () => prefs.quality === 'low'

/**
 * Global SVG filters shared by every station's ink art:
 *   filter="url(#ink-rough)"  — ragged brush edge
 *   filter="url(#ink-wash)"   — soft bleeding wash (for fills)
 *   filter="url(#ink-dry)"    — dry-brush streaks
 * At quality=low they are rebuilt lighter (1 octave, no wash blur, tighter wash region) under the same ids.
 */
export function inkDefs(): SVGSVGElement {
  const svg = s('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' })
  let built = ''
  const build = () => {
    if (built === prefs.quality) return
    built = prefs.quality
    const low = liteInk()
    svg.replaceChildren(
      s('defs', null,
        s('filter', { id: 'ink-rough', x: '-10%', y: '-10%', width: '120%', height: '120%' },
          s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035', numOctaves: octaves(2), seed: '3', result: 'n' }),
          s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '3.2', xChannelSelector: 'R', yChannelSelector: 'G' })),
        s('filter', low ? { id: 'ink-wash', x: '-14%', y: '-14%', width: '128%', height: '128%' } : { id: 'ink-wash', x: '-20%', y: '-20%', width: '140%', height: '140%' },
          s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.02', numOctaves: octaves(3), seed: '7', result: 'n' }),
          s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '9', xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' }),
          low ? null : s('feGaussianBlur', { in: 'd', stdDeviation: '1.4' })),
        s('filter', { id: 'ink-dry', x: '-10%', y: '-10%', width: '120%', height: '120%' },
          s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9 0.04', numOctaves: octaves(2), seed: '11', result: 'n' }),
          s('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.5', result: 'm' }),
          s('feComposite', { in: 'SourceGraphic', in2: 'm', operator: 'in' }))))
  }
  build()
  onPrefs(build)
  return svg
}
