import { s } from '../core/dom'

/**
 * Global SVG filters shared by every station's ink art:
 *   filter="url(#ink-rough)"  — ragged brush edge
 *   filter="url(#ink-wash)"   — soft bleeding wash (for fills)
 *   filter="url(#ink-dry)"    — dry-brush streaks
 */
export function inkDefs(): SVGSVGElement {
  return s('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' },
    s('defs', null,
      s('filter', { id: 'ink-rough', x: '-10%', y: '-10%', width: '120%', height: '120%' },
        s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035', numOctaves: '2', seed: '3', result: 'n' }),
        s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '3.2', xChannelSelector: 'R', yChannelSelector: 'G' })),
      s('filter', { id: 'ink-wash', x: '-20%', y: '-20%', width: '140%', height: '140%' },
        s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.02', numOctaves: '3', seed: '7', result: 'n' }),
        s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '9', xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' }),
        s('feGaussianBlur', { in: 'd', stdDeviation: '1.4' })),
      s('filter', { id: 'ink-dry', x: '-10%', y: '-10%', width: '120%', height: '120%' },
        s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9 0.04', numOctaves: '2', seed: '11', result: 'n' }),
        s('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.5', result: 'm' }),
        s('feComposite', { in: 'SourceGraphic', in2: 'm', operator: 'in' }))))
}
