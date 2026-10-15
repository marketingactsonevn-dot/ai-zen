import * as THREE from 'three'
import { prefs } from './prefs'
import { counters } from './perf'
import { createLoop } from './loop'

export interface Stage {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  canvas: HTMLCanvasElement
  readonly width: number
  readonly height: number
  /** Per-frame callback; t = seconds since start, dt = frame delta (0 on on-demand renders). */
  onFrame(fn: (t: number, dt: number) => void): void
  onResize(fn: (w: number, h: number) => void): void
  /** Request one frame — use after interaction when the loop is paused (reduced motion / offscreen). */
  render(): void
  dispose(): void
}

/**
 * Three.js canvas that fills `host`, follows its size, pauses when offscreen or the tab is hidden,
 * and under reduced motion only renders on demand. Returns null when WebGL is unavailable.
 */
export function createStage(host: HTMLElement, opts: { fov?: number; animate?: boolean } = {}): Stage | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: prefs.quality === 'high', alpha: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  counters.stages++
  renderer.setPixelRatio(Math.min(devicePixelRatio, prefs.quality === 'high' ? 2 : 1.25))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const canvas = renderer.domElement
  canvas.className = 'stage-canvas'
  host.append(canvas)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 45, 1, 0.1, 200)
  const frames = new Set<(t: number, dt: number) => void>()
  const resizers = new Set<(w: number, h: number) => void>()
  let w = 1, h = 1, disposed = false

  // createLoop pauses offscreen / hidden tab / reduced motion; render() = one frame on demand (dt 0).
  // First frame: compile every shader the scene needs without blocking (KHR_parallel_shader_compile where the
  // browser has it) and draw once they are ready, instead of stalling on the first render (spec A.7).
  let shaders: 'todo' | 'compiling' | 'ready' = 'todo'
  const loop = createLoop(host, (t, dt) => {
    frames.forEach((f) => f(t, dt))
    if (shaders === 'ready') return void renderer.render(scene, camera)
    if (shaders === 'compiling') return
    shaders = 'compiling'
    renderer
      .compileAsync(scene, camera)
      .catch(() => {})
      .then(() => {
        shaders = 'ready'
        loop.wake()
      })
  }, { essential: opts.animate === true })
  const resize = () => {
    const r = host.getBoundingClientRect()
    w = Math.max(1, Math.round(r.width))
    h = Math.max(1, Math.round(r.height))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    resizers.forEach((f) => f(w, h))
    loop.wake()
  }

  const ro = new ResizeObserver(resize)
  ro.observe(host)
  resize()
  if (opts.animate ?? !prefs.reduced) loop.start()

  return {
    scene, camera, renderer, canvas,
    get width() { return w },
    get height() { return h },
    onFrame: (fn) => void frames.add(fn),
    onResize: (fn) => void resizers.add(fn),
    render: () => loop.wake(),
    dispose() {
      if (!disposed) counters.stages--
      disposed = true
      loop.dispose()
      ro.disconnect()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
        mats.forEach((mat) => {
          Object.values(mat).forEach((v) => v instanceof THREE.Texture && v.dispose())
          mat.dispose()
        })
      })
      renderer.dispose()
      renderer.forceContextLoss() // give the WebGL context back now, not whenever GC runs (spec A.9)
      canvas.remove()
    },
  }
}
