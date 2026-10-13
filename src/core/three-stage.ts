import * as THREE from 'three'
import { prefs } from './prefs'

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
  renderer.setPixelRatio(Math.min(devicePixelRatio, prefs.quality === 'high' ? 2 : 1.25))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const canvas = renderer.domElement
  canvas.className = 'stage-canvas'
  host.append(canvas)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 45, 1, 0.1, 200)
  const frames = new Set<(t: number, dt: number) => void>()
  const resizers = new Set<(w: number, h: number) => void>()
  const animate = opts.animate ?? !prefs.reduced
  let w = 1, h = 1, t = 0, last = performance.now(), raf = 0, visible = false, disposed = false

  const running = () => animate && visible && !document.hidden && !disposed
  const draw = () => renderer.render(scene, camera)
  // The loop keeps its own timestamps (dt includes render time); external wake-ups only reset the clock when idle.
  const loop = (now: number) => {
    raf = 0
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
    last = now
    t += dt
    frames.forEach((f) => f(t, dt))
    draw()
    if (running()) raf = requestAnimationFrame(loop)
  }
  const schedule = () => {
    if (running() && !raf) {
      last = performance.now()
      raf = requestAnimationFrame(loop)
    }
  }
  const renderOnce = () => {
    if (disposed || raf) return
    if (running()) return schedule()
    raf = requestAnimationFrame(() => {
      raf = 0
      frames.forEach((f) => f(t, 0))
      draw()
      schedule() // became visible meanwhile? start the loop instead of going idle
    })
  }
  const resize = () => {
    const r = host.getBoundingClientRect()
    w = Math.max(1, Math.round(r.width))
    h = Math.max(1, Math.round(r.height))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    resizers.forEach((f) => f(w, h))
    renderOnce()
  }

  const ro = new ResizeObserver(resize)
  ro.observe(host)
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    schedule()
  })
  io.observe(host)
  const onVis = () => schedule()
  document.addEventListener('visibilitychange', onVis)
  resize()

  return {
    scene, camera, renderer, canvas,
    get width() { return w },
    get height() { return h },
    onFrame: (fn) => void frames.add(fn),
    onResize: (fn) => void resizers.add(fn),
    render: renderOnce,
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
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
      canvas.remove()
    },
  }
}
