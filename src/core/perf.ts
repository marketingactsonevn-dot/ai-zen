/**
 * Perf HUD (spec A.1). Off unless the URL has ?perf=1 — dev and build alike, so it can be read on a real phone.
 * Shows FPS, longest frame, long tasks, live WebGL contexts, running rAF loops and JS heap (bottom-left),
 * and exposes the raw numbers to scripts as window.__aizen.perf (scripts/perf-walk.mjs).
 */

/** Live counters fed by the app itself (cheap, always on). */
export const counters = { stages: 0, loops: 0, ticking: 0 } // createStage alive · createLoop alive · createLoop ticking

if (new URLSearchParams(location.search).get('perf') === '1') install()

function install() {
  // ── frames: rAF timestamps in a ring buffer, plus the counters sampled on each frame ──
  const N = 4096
  const ts = new Float64Array(N)
  const dt = new Float32Array(N)
  const glN = new Uint8Array(N)
  const stN = new Uint8Array(N)
  const lpN = new Uint8Array(N)
  const tkN = new Uint8Array(N)
  let n = 0

  // ── long tasks (> 50 ms) ──
  const longTasks: { start: number; dur: number }[] = []
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) longTasks.push({ start: e.startTime, dur: e.duration })
      if (longTasks.length > 2000) longTasks.splice(0, 1000)
    }).observe({ type: 'longtask', buffered: true })
  } catch {
    /* no longtask support (Safari/Firefox): the HUD shows "–" */
  }

  // ── WebGL contexts: every one the page creates; alive = neither lost nor garbage-collected ──
  type GL = WebGLRenderingContext | WebGL2RenderingContext
  let glRefs: WeakRef<GL>[] = []
  let glMade = 0
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (this: HTMLCanvasElement, type: string, ...a: unknown[]) => unknown }
  const getContext = proto.getContext
  proto.getContext = function (type, ...a) {
    const c = getContext.call(this, type, ...a)
    if (c && type.includes('webgl') && !glRefs.some((r) => r.deref() === c)) {
      glMade++
      glRefs.push(new WeakRef(c as GL))
    }
    return c
  }
  const glAlive = () => {
    let k = 0
    for (const r of glRefs) {
      const c = r.deref()
      if (c && !c.isContextLost()) k++
    }
    if (glRefs.length > 64) glRefs = glRefs.filter((r) => r.deref())
    return k
  }

  // ── raw rAF callbacks per frame (catches loops outside createLoop); the HUD's own loop is not counted ──
  const raf = window.requestAnimationFrame.bind(window)
  let calls = 0
  let names: string[] = []
  let lastNames: string[] = []
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      calls++
      names.push(cb.name || 'anonymous')
      cb(t)
    })

  const mem = () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize
  const mb = (b?: number) => (b == null ? null : Math.round((b / 1048576) * 10) / 10)

  let last = 0
  const frame = (now: number) => {
    if (last) {
      const i = n % N
      ts[i] = now
      dt[i] = now - last
      glN[i] = glAlive()
      stN[i] = counters.stages
      lpN[i] = calls
      tkN[i] = counters.ticking
      n++
    }
    last = now
    calls = 0
    ;[lastNames, names] = [names, lastNames]
    names.length = 0
    raf(frame)
  }
  raf(frame)

  /** Frames whose timestamp is ≥ t0, newest last. */
  const framesSince = (t0: number) => {
    const out: number[] = []
    for (let k = Math.max(0, n - N); k < n; k++) if (ts[k % N] >= t0) out.push(k % N)
    return out
  }
  const median = (a: number[]) => {
    if (!a.length) return 0
    const b = [...a].sort((x, y) => x - y)
    return b[b.length >> 1]
  }
  /** rAF loops alive = median callbacks per frame over the last ~0.5 s (one-off rAFs don't count). */
  const loops = () => median(framesSince(performance.now() - 500).map((i) => lpN[i]))

  /** Stats for everything since t0 (performance.now() time base). FPS counts from the HUD's first frame at the earliest. */
  const since = (t0: number) => {
    const end = performance.now()
    const first = n ? ts[Math.max(0, n - N) % N] - dt[Math.max(0, n - N) % N] : end
    const idx = framesSince(t0)
    const d = idx.map((i) => dt[i])
    const sorted = [...d].sort((x, y) => x - y)
    const lt = longTasks.filter((e) => e.start + e.dur >= t0)
    const max = (a: number[]) => a.reduce((m, v) => Math.max(m, v), 0)
    return {
      ms: Math.round(end - t0),
      frames: d.length,
      fps: Math.round((d.length / Math.max(1, end - Math.max(t0, first))) * 1000 * 10) / 10,
      medianFps: sorted.length ? Math.round(1000 / sorted[sorted.length >> 1]) : 0,
      maxFrame: Math.round(max(d)),
      p95Frame: sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]) : 0,
      over50: d.filter((v) => v > 50).length,
      longTasks: lt.length,
      longTaskMax: Math.round(max(lt.map((e) => e.dur))),
      longTaskTotal: Math.round(lt.reduce((s, e) => s + e.dur, 0)),
      maxGl: max(idx.map((i) => glN[i])),
      maxStages: max(idx.map((i) => stN[i])),
      maxLoops: max(idx.map((i) => lpN[i])),
      maxTicking: max(idx.map((i) => tkN[i])),
      heapMB: mb(mem()),
    }
  }

  const snapshot = () => {
    const now = performance.now()
    const s1 = framesSince(now - 1000)
    const s5 = framesSince(now - 5000)
    return {
      fps: s1.length,
      maxFrame5s: Math.round(s5.reduce((m, i) => Math.max(m, dt[i]), 0)),
      longTasks: longTasks.length,
      longTasks5s: longTasks.filter((e) => e.start >= now - 5000).length,
      glAlive: glAlive(),
      glMade,
      stages: counters.stages,
      loops: loops(),
      loopsAlive: counters.loops,
      loopsTicking: counters.ticking,
      loopNames: [...lastNames],
      heapMB: mb(mem()),
    }
  }

  const w = window as unknown as { __aizen?: Record<string, unknown> }
  Object.assign((w.__aizen ??= {}), { perf: { since, snapshot, longTasks, counters } })

  // ── the HUD itself: bottom-left, tiny, never takes input or space ──
  const hud = document.createElement('div')
  hud.className = 'perf-hud'
  hud.setAttribute('aria-hidden', 'true')
  hud.style.cssText =
    'position:fixed;left:6px;bottom:6px;z-index:2147483647;pointer-events:none;contain:content;white-space:pre;' +
    'font:10px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#fff;background:rgba(0,0,0,.6);padding:3px 6px;border-radius:4px'
  document.body.append(hud)
  const hasLongTask = PerformanceObserver.supportedEntryTypes?.includes('longtask')
  setInterval(() => {
    const s = snapshot()
    hud.textContent =
      `FPS ${s.fps}  max ${s.maxFrame5s}ms/5s\n` +
      `long ${hasLongTask ? `${s.longTasks5s}/5s (${s.longTasks})` : '–'}\n` +
      `GL ${s.glAlive} (stage ${s.stages})  loop ${s.loopsTicking}/${s.loopsAlive}  rAF ${s.loops}\n` +
      `heap ${s.heapMB ?? '–'}${s.heapMB == null ? '' : ' MB'}`
  }, 250)
}
