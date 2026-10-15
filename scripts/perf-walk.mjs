#!/usr/bin/env node
/**
 * AI Zen perf walk (spec A.1, A.9). Drives a production build with ?perf=1 in Chromium (Playwright) and reads
 * window.__aizen.perf (src/core/perf.ts). Default profile emulates a mid-range phone: Moto G Power
 * (412×823 @1.75x, touch), CPU 4× slower and "Fast 4G" through the DevTools protocol.
 *
 *   npm run build && node scripts/perf-walk.mjs                       # scenarios a–e, phone profile
 *   node scripts/perf-walk.mjs --profile desktop                      # 1440×900 @2x, no throttling
 *   node scripts/perf-walk.mjs --only c --stations 3-8                # a subset
 *   node scripts/perf-walk.mjs --only c --ablate blur,svgfilter,backdrop   # same walk with an effect switched off by CSS
 *   node scripts/perf-walk.mjs --only a,c,d --trace                   # + Chrome trace: what the main thread spent time on
 *   … --trace --stacks --base http://localhost:5179/                # + who forced each style/layout (dev server = readable names)
 *   node scripts/perf-walk.mjs --only e --pingpong 13,13,13 --settle-each   # one station in and out, heap after each
 *   node scripts/perf-walk.mjs --only c --passes 2                    # walk 1 → 18 twice (A.9: pass 2 must not grow)
 *   --cpu 8 (override the slowdown) · --out file.json · --dist other-build-dir · --base http://… (default: serve dist/ like GitHub Pages)
 *
 * Scenarios: a) home → map (intro, sand, address-bar resize)  b) station 1, every scene  c) stations 1 → 18 in order
 *            d) first visit of a 3D station on a cold cache   e) map ↔ station, 10 times
 * Writes JSON (default docs/perf-data/<profile>[-no-…][-trace].json) and prints a summary.
 */
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveDist } from './serve-dist.mjs'

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'))

const argv = process.argv.slice(2)
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`)
  if (i < 0) return d
  const v = argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}
const PROFILE = opt('profile', 'mobile')
const ONLY = String(opt('only', 'a,b,c,d,e')).split(',')
const [S0, S1 = S0] = String(opt('stations', '1-18')).split('-').map(Number)
const TRACE = opt('trace', false) === true
const STACKS = opt('stacks', false) === true // + JS stack of every forced style/layout (best on the dev server: readable names)
const ABLATE = opt('ablate', '') ? String(opt('ablate')).split(',') : []
const OUT = String(opt('out', `docs/perf-data/${PROFILE}${opt('cpu', null) ? `-cpu${opt('cpu')}` : ''}${ABLATE.length ? `-no-${ABLATE.join('-')}` : ''}${TRACE ? '-trace' : ''}.json`))
let BASE = opt('base', null)

// DevTools "Fast 4G" preset (9 Mbps down, 1.5 Mbps up, 165 ms RTT incl. its 0.9 / 2.75 adjustments).
const FAST_4G = { offline: false, latency: 165, downloadThroughput: (9e6 * 0.9) / 8, uploadThroughput: (1.5e6 * 0.9) / 8 }
const PROFILES = {
  mobile: {
    label: 'Moto G Power (giả lập) · 412×823 @1.75x · cảm ứng · CPU 4× · Fast 4G',
    context: {
      viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 12; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
    },
    cpu: 4,
    net: FAST_4G,
  },
  desktop: { label: 'Desktop 1440×900 @2x · chuột · không giới hạn CPU/mạng', context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, cpu: 1, net: null },
}
const P = PROFILES[PROFILE]
if (!P) throw new Error(`unknown --profile ${PROFILE}`)
if (opt('cpu', null)) P.cpu = Number(opt('cpu'))
const PINGPONG = String(opt('pingpong', '1,9,13,5,7,8,4,3,6,18')).split(',').map(Number)
const SETTLE_EACH = opt('settle-each', false) === true
const PASSES = Number(opt('passes', 1)) // walk the stations N times: growth on pass 2+ is a leak, pass 1 also loads code

// Switch one suspected effect off with CSS (measurement only — the app is untouched).
const ABLATE_CSS = {
  blur: '.scenes > .scene, .chapter, .chapter > * { filter: none !important }',
  svgfilter: 'svg, svg * { filter: none !important }',
  backdrop: '* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important }',
}
for (const a of ABLATE) if (!ABLATE_CSS[a]) throw new Error(`unknown --ablate ${a} (blur | svgfilter | backdrop)`)

const TRACE_CATEGORIES = ['toplevel', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing', 'disabled-by-default-v8.cpu_profiler']
const TRANS = 1600 // a scene change: 0.55 s out + 0.25 s delay + 0.95 s in, plus mount
const IDLE = 1000 // the new scene settling
const ENTRY = 4200 // a station's chapter card: 2.8 s + 0.9 s dissolve
const pad = (n) => String(n).padStart(2, '0')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.error(...a)

// ── server: dist/ (or --dist) served like GitHub Pages, unless --base points elsewhere ──
let server = null
if (!BASE) {
  server = await serveDist(String(opt('dist', 'dist')))
  BASE = server.url
}
const url = (hash) => `${BASE}?perf=1${hash}`

const browser = await chromium.launch({
  channel: 'chromium', // full Chromium in new headless mode (hardware WebGL through ANGLE)
  headless: true,
  args: [...(process.platform === 'darwin' ? ['--use-angle=metal'] : []), '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-precise-memory-info'],
})

async function open() {
  const context = await browser.newContext({ ...P.context, colorScheme: 'light', reducedMotion: 'no-preference' })
  if (ABLATE.length)
    await context.addInitScript((css) => {
      document.addEventListener('DOMContentLoaded', () => {
        const st = document.createElement('style')
        st.textContent = css
        document.head.append(st)
      })
    }, ABLATE.map((a) => ABLATE_CSS[a]).join('\n'))
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  if (P.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpu })
  if (P.net) {
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', P.net)
  }
  const warnings = []
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && warnings.push(`${m.type()}: ${m.text().slice(0, 200)}`))
  page.on('pageerror', (e) => warnings.push(`pageerror: ${e.message.slice(0, 200)}`))
  return { context, page, cdp, warnings }
}

const now = (page) => page.evaluate(() => performance.now())
const since = (page, t0) => page.evaluate((t) => window.__aizen.perf.since(t), t0)
/** Garbage-collect, then read heap + WebGL contexts + live rAF loops (spec A.9). */
async function settle(cdp, page) {
  await cdp.send('HeapProfiler.collectGarbage')
  await sleep(800)
  const { usedSize } = await cdp.send('Runtime.getHeapUsage')
  const s = await page.evaluate(() => window.__aizen.perf.snapshot())
  return { heapMB: Math.round((usedSize / 1048576) * 10) / 10, glAlive: s.glAlive, glMade: s.glMade, stages: s.stages, loops: s.loops, loopsAlive: s.loopsAlive, loopsTicking: s.loopsTicking, loopNames: s.loopNames }
}
/** A real tap (phone) or click (desktop) at the element's centre. */
async function press(page, selector) {
  const b = await page.locator(selector).first().boundingBox()
  if (!b) throw new Error(`not visible: ${selector}`)
  if (P.context.hasTouch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
}
/** Wait until fn() is truthy (polled every 16 ms) and return performance.now() at that moment. */
// timer polling (not 'raf'): a rAF poll would be counted by the HUD as one more app loop
const until = async (page, fn, arg) => (await page.waitForFunction(fn, arg, { polling: 16, timeout: 60000 })).jsonValue()
const clickIn = (page, selector) =>
  page.evaluate((sel) => {
    const t = performance.now()
    document.querySelector(sel).click()
    return t
  }, selector)

/** From the map: tap a station's stepping stone (on touch: 1st tap = tooltip, 2nd = enter). */
async function enterFromMap(page, id) {
  const sel = `a.pstone[href="#/tram/${id}"]`
  if (P.context.hasTouch) {
    await press(page, sel)
    await sleep(400)
  }
  const t0 = await now(page)
  await press(page, sel)
  const t1 = await until(page, (p) => document.querySelector('.chapter-num')?.textContent === p && document.querySelector('.scenes .scene') && performance.now(), pad(id))
  return { t0, latency: Math.round(t1 - t0) }
}

// ── Chrome trace → where the renderer main thread spent its time ──
async function traced(page, fn) {
  if (!TRACE) return { value: await fn(), trace: null }
  await browser.startTracing(page, { categories: STACKS ? [...TRACE_CATEGORIES, 'disabled-by-default-devtools.timeline.stack'] : TRACE_CATEGORIES })
  const value = await fn()
  const buf = await browser.stopTracing()
  return { value, trace: summarizeTrace(buf) }
}
function summarizeTrace(buf) {
  const data = JSON.parse(buf.toString())
  const ev = Array.isArray(data) ? data : data.traceEvents
  const tname = new Map()
  for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') tname.set(`${e.pid}:${e.tid}`, e.args.name)
  const threads = new Map()
  for (const e of ev) {
    if (e.ph !== 'X' || e.dur == null) continue
    const k = `${e.pid}:${e.tid}`
    if (!threads.has(k)) threads.set(k, [])
    threads.get(k).push(e)
  }
  const keysOf = (n) => [...threads.keys()].filter((k) => (tname.get(k) ?? '').startsWith(n))
  const mainKey = keysOf('CrRendererMain').sort((a, b) => threads.get(b).length - threads.get(a).length)[0]
  if (!mainKey) return null
  const file = (u) => (u ? String(u).split('/').pop().split('?')[0] : '')
  const label = (e) => {
    const d = e.args?.data ?? {}
    if (e.name === 'FunctionCall') return `JS ${file(d.url) || '?'}`
    if (e.name === 'EvaluateScript' || e.name.startsWith('v8.compile')) return `${e.name} ${file(d.url ?? e.args?.fileName)}`.trim()
    if (e.name === 'ThreadControllerImpl::RunTask' || e.name === 'RunTask') return '(task)'
    return e.name
  }
  const ms = (us) => Math.round(us / 100) / 10
  const main = threads.get(mainKey).sort((a, b) => a.ts - b.ts || b.dur - a.dur)
  const self = new Map()
  const tasks = []
  const forced = new Map()
  const stack = []
  for (const e of main) {
    while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop()
    if (stack.length) stack.at(-1).kids = (stack.at(-1).kids ?? 0) + e.dur
    else tasks.push(e)
    e.top = stack[0] ?? e
    if ((e.name === 'UpdateLayoutTree' || e.name === 'Layout') && stack.some((s) => s.name === 'FireAnimationFrame')) {
      const js = [...stack].reverse().find((s) => s.name === 'FunctionCall')
      const f0 = e.args?.beginData?.stackTrace?.[0]
      const where = f0 ? `${f0.functionName || '(anonymous)'}@${file(f0.url)}:${f0.lineNumber}` : file(js?.args?.data?.url) || '?'
      const k = `${e.name === 'Layout' ? 'layout' : 'style'} in rAF · ${where}`
      forced.set(k, (forced.get(k) ?? 0) + e.dur)
    }
    stack.push(e)
  }
  for (const e of main) {
    const s = Math.max(0, e.dur - (e.kids ?? 0))
    const k = label(e)
    self.set(k, (self.get(k) ?? 0) + s)
    if (e.top.dur > 50e3) (e.top.parts ??= new Map()).set(k, (e.top.parts.get(k) ?? 0) + s)
  }
  // V8 sampling profiler (main thread): JS self time by script file / function, overall and inside each long task
  const mainPid = Number(mainKey.split(':')[0]), mainTid = Number(mainKey.split(':')[1])
  const prof = new Map()
  for (const e of ev) {
    if (e.name === 'Profile' && e.pid === mainPid && e.tid === mainTid) prof.set(e.id, { t: e.args.data.startTime, nodes: new Map(), samples: [] })
    if (e.name !== 'ProfileChunk' || !prof.has(e.id)) continue
    const p = prof.get(e.id)
    const cp = e.args.data.cpuProfile ?? {}
    for (const n of cp.nodes ?? []) p.nodes.set(n.id, n)
    ;(e.args.data.timeDeltas ?? []).forEach((d, i) => {
      p.t += d
      p.samples.push([p.t, cp.samples[i]])
    })
  }
  const js = new Map()
  const jsFn = new Map()
  const longs = tasks.filter((e) => e.dur > 50e3)
  for (const p of prof.values()) {
    p.samples.sort((a, b) => a[0] - b[0])
    for (let i = 0; i < p.samples.length - 1; i++) {
      const [t, id] = p.samples[i]
      const cf = p.nodes.get(id)?.callFrame ?? {}
      const fn = cf.functionName || '(anonymous)'
      if (fn === '(idle)' || fn === '(root)') continue
      const d = Math.min(p.samples[i + 1][0] - t, 10e3)
      const f = file(cf.url) || fn
      js.set(f, (js.get(f) ?? 0) + d)
      jsFn.set(`${f} · ${fn}`, (jsFn.get(`${f} · ${fn}`) ?? 0) + d)
      const lt = longs.find((e) => t >= e.ts && t < e.ts + e.dur)
      if (lt) (lt.js ??= new Map()).set(`${f} · ${fn}`, (lt.js.get(`${f} · ${fn}`) ?? 0) + d)
    }
  }
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, ms(v)])
  // busy time of a thread = its top-level events only (Chrome nests RunTask / GPUTask / mojo events inside each other)
  const sumTop = (keys) =>
    keys.reduce((s, k) => {
      let end = -Infinity
      for (const e of [...threads.get(k)].sort((a, b) => a.ts - b.ts || b.dur - a.dur))
        if (e.ts >= end) (s += e.dur), (end = e.ts + e.dur)
      return s
    }, 0)
  const t0 = main[0]?.ts ?? 0
  return {
    windowMs: ms((main.at(-1)?.ts ?? t0) + (main.at(-1)?.dur ?? 0) - t0),
    mainBusyMs: ms(tasks.reduce((s, e) => s + e.dur, 0)),
    mainSelf: top(self, 14),
    jsByFile: top(js, 10),
    jsByFunction: top(jsFn, 12),
    forcedStyleLayoutInRaf: top(forced, 8),
    longTasks: longs
      .sort((a, b) => b.dur - a.dur)
      .slice(0, 8)
      .map((e) => ({ at: ms(e.ts - t0), ms: ms(e.dur), parts: top(e.parts ?? new Map(), 4), js: top(e.js ?? new Map(), 5) })),
    gpuMainMs: ms(sumTop(keysOf('CrGpuMain'))),
    compositorMs: ms(sumTop(keysOf('VizCompositorThread'))),
  }
}

// ── scenarios ──
const res = {
  meta: {
    date: new Date().toISOString(),
    profile: PROFILE,
    label: P.label.replace('CPU 4×', `CPU ${P.cpu}×`),
    ablate: ABLATE,
    trace: TRACE,
    commit: (() => {
      try {
        return execSync('git rev-parse --short HEAD').toString().trim() + (execSync('git status --porcelain src').toString().trim() ? '+dirty' : '')
      } catch {
        return '?'
      }
    })(),
    browser: `Chromium ${browser.version()}`,
    host: `${process.platform} ${process.arch}`,
  },
}

/** a) Home: intro → enter → map idle → touching the sand → address bar hiding/showing (viewport height −56 px). */
async function scenarioA() {
  const { context, page, cdp, warnings } = await open()
  const out = {}
  // GPU check on the blank page, before the app (and its WebGL counter) loads
  res.meta.gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl')
    const x = gl?.getExtension('WEBGL_debug_renderer_info')
    return gl ? gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : 'no WebGL'
  })
  const { trace } = await traced(page, async () => {
    await page.goto(url('#/'), { waitUntil: 'load' })
    res.meta.quality = await page.evaluate(() => document.documentElement.dataset.quality)
    await sleep(5500)
    out.load = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0]
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]
      const js = performance.getEntriesByType('resource').filter((e) => /\.js$/.test(e.name))
      return { fcp: Math.round(fcp?.startTime ?? -1), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), jsKB: Math.round(js.reduce((s, e) => s + e.transferSize, 0) / 1024) }
    })
    out.intro = await since(page, 0)
    let t = await now(page)
    await press(page, '.intro-btn')
    await sleep(2500)
    out.enter = await since(page, t)
    t = await now(page)
    await sleep(3000)
    out.mapIdle = await since(page, t)
    // six taps on open sand (not on a stone / link)
    const pts = await page.evaluate(() => {
      const g = document.querySelector('.garden').getBoundingClientRect()
      const ok = []
      for (let k = 0; k < 400 && ok.length < 6; k++) {
        const x = g.left + g.width * (0.1 + ((k * 0.618) % 0.8))
        const y = g.top + g.height * (0.2 + ((k * 0.382) % 0.6))
        const el = document.elementFromPoint(x, y)
        if (el && el.closest('.garden') && !el.closest('a, button, .ptip')) ok.push([x, y])
      }
      return ok
    })
    t = await now(page)
    for (const [x, y] of pts) {
      if (P.context.hasTouch) await page.touchscreen.tap(x, y)
      else await page.mouse.click(x, y)
      await sleep(450)
    }
    await sleep(1500)
    out.sandTouch = { taps: pts.length, ...(await since(page, t)) }
    // address bar: shrink/grow the viewport by 56 px three times; count how often the sand canvas is redrawn
    await page.evaluate(() => {
      window.__sandDraws = 0
      new MutationObserver((m) => (window.__sandDraws += m.filter((r) => r.attributeName === 'height').length)).observe(document.querySelector('.garden-sand'), { attributes: true })
    })
    const vp = page.viewportSize()
    t = await now(page)
    for (let k = 0; k < 3; k++) {
      await page.setViewportSize({ width: vp.width, height: vp.height - 56 })
      await sleep(500)
      await page.setViewportSize(vp)
      await sleep(500)
    }
    await sleep(500)
    out.addressBar = { resizes: 6, sandRedraws: await page.evaluate(() => window.__sandDraws), ...(await since(page, t)) }
  })
  out.settled = await settle(cdp, page)
  out.trace = trace
  out.warnings = warnings
  await context.close()
  return out
}

/** Flip through every scene of the open station with the "next" button. */
async function flip(page) {
  const labels = await page.locator('.rail-dot').evaluateAll((ds) => ds.map((d) => d.title))
  const scenes = []
  for (let k = 2; k <= labels.length; k++) {
    const t0 = await clickIn(page, '.rail-btn.next')
    await sleep(TRANS)
    const transition = await since(page, t0)
    const t1 = await now(page)
    await sleep(IDLE)
    scenes.push({ scene: k, label: labels[k - 1], transition, idle: await since(page, t1) })
  }
  return scenes
}

/** b + c) Enter `from` from the map, then follow "next" through every scene of every station up to `to`. */
async function scenarioWalk(from, to) {
  const { context, page, cdp, warnings } = await open()
  await page.goto(url('#/vuon'), { waitUntil: 'load' })
  res.meta.quality ??= await page.evaluate(() => document.documentElement.dataset.quality)
  await sleep(4000)
  const mapStart = await settle(cdp, page)
  const stations = []
  const mapEnds = []
  for (let pass = 1; pass <= PASSES; pass++) {
  let entry
  for (let id = from; id <= to; id++) {
    // traced from the tap/click that enters the station: chunk load, first mount, chapter card, every scene
    const { value, trace } = await traced(page, async () => {
      if (id === from) entry = await enterFromMap(page, from)
      else {
        const t0 = await clickIn(page, '.rail-btn.next') // summary scene → next station
        const t1 = await until(page, (p) => document.querySelector('.chapter-num')?.textContent === p && document.querySelector('.scenes .scene') && performance.now(), pad(id))
        entry = { t0, latency: Math.round(t1 - t0) }
      }
      await sleep(Math.max(0, ENTRY - ((await now(page)) - entry.t0)))
      const entryStats = await since(page, entry.t0)
      return { entryStats, scenes: await flip(page) }
    })
    const rec = { id, pass, latency: entry.latency, entry: value.entryStats, scenes: value.scenes, trace }
    if (id === from || id % 6 === 0 || id === to) rec.settled = await settle(cdp, page)
    stations.push(rec)
    const worst = Math.max(0, ...rec.scenes.map((s) => s.transition.maxFrame))
    log(`  t${pad(id)}: vào ${rec.latency} ms · ${rec.scenes.length} lần chuyển · frame dài nhất ${worst} ms${rec.settled ? ` · heap ${rec.settled.heapMB} MB, GL ${rec.settled.glAlive}, rAF ${rec.settled.loops}` : ''}`)
  }
  // back to the map: what is still alive after the walk?
  await page.evaluate(() => (location.hash = '#/vuon'))
  await sleep(3500)
  mapEnds.push(await settle(cdp, page))
  }
  await context.close()
  return { mapStart, stations, mapEnd: mapEnds[0], mapEnds, warnings }
}

/** d) First visit of a 3D station on a cold cache: chunk download + parse + WebGL context + shaders. */
async function scenarioCold3D(id, goToScene) {
  const { context, page, warnings } = await open()
  await page.goto(url('#/vuon'), { waitUntil: 'load' })
  res.meta.quality ??= await page.evaluate(() => document.documentElement.dataset.quality)
  await sleep(4000)
  const net = []
  page.on('requestfinished', async (r) => {
    if (!r.url().includes('/assets/')) return
    const s = await r.sizes().catch(() => null)
    net.push({ file: r.url().split('/').pop(), kB: s ? Math.round(s.responseBodySize / 1024) : null, ms: Math.round(r.timing().responseEnd) })
  })
  const out = { id }
  const { trace } = await traced(page, async () => {
    const e = await enterFromMap(page, id)
    out.latency = e.latency
    await sleep(4500)
    out.stats = await since(page, e.t0)
    if (goToScene) {
      const t0 = await clickIn(page, `.rail-dot:nth-child(${goToScene})`)
      await sleep(3000)
      out.toScene = { scene: goToScene, ...(await since(page, t0)) }
    }
  })
  out.net = net
  out.trace = trace
  out.warnings = warnings
  await context.close()
  return out
}

/** e) Map ↔ station, 10 times (3D, physics and ink-heavy stations), then what is left alive. */
async function scenarioPingPong(ids) {
  const { context, page, cdp, warnings } = await open()
  await page.goto(url('#/vuon'), { waitUntil: 'load' })
  res.meta.quality ??= await page.evaluate(() => document.documentElement.dataset.quality)
  await sleep(4000)
  const start = await settle(cdp, page)
  const legs = []
  const { trace } = await traced(page, async () => {
    for (const id of ids) {
      const e = await enterFromMap(page, id)
      await sleep(2500)
      legs.push({ to: `t${pad(id)}`, latency: e.latency, ...(await since(page, e.t0)) })
      const t0 = await clickIn(page, 'a.crumb')
      const t1 = await until(page, () => document.querySelector('.garden .pstone') && performance.now())
      await sleep(2000)
      legs.push({ to: 'map', latency: Math.round(t1 - t0), ...(await since(page, t0)), ...(SETTLE_EACH ? { settled: await settle(cdp, page) } : {}) })
    }
  })
  const end = await settle(cdp, page)
  await context.close()
  return { ids, start, legs, end, trace, warnings }
}

try {
  log(`perf-walk · ${P.label}${ABLATE.length ? ` · tắt: ${ABLATE.join(', ')}` : ''}${TRACE ? ' · trace' : ''} · ${BASE}`)
  if (ONLY.includes('a')) {
    log('a) home → map')
    res.a = await scenarioA()
  }
  if (ONLY.includes('b') || ONLY.includes('c')) {
    const [from, to] = ONLY.includes('c') ? [S0, S1] : [1, 1]
    log(`${ONLY.includes('c') ? 'b+c' : 'b'}) trạm ${from} → ${to}, lật hết scene`)
    const walk = await scenarioWalk(from, to)
    if (from === 1) res.b = walk.stations[0]
    if (ONLY.includes('c')) res.c = walk
  }
  if (ONLY.includes('d')) {
    log('d) trạm 3D lần đầu (cache trống)')
    res.d = []
    for (const [id, sc] of [[1], [9], [13, 4]]) res.d.push(await scenarioCold3D(id, sc))
  }
  if (ONLY.includes('e')) {
    log('e) bản đồ ↔ trạm ×10')
    res.e = await scenarioPingPong(PINGPONG)
  }
} finally {
  await browser.close()
  server?.close()
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(res, null, 1))
console.log(summary(res))
log(`→ ${OUT}`)

function summary(r) {
  const L = [`# perf-walk · ${r.meta.label} · quality=${r.meta.quality ?? '?'} · ${r.meta.commit}`]
  const f = (s) => (s ? `${s.fps} fps (trung vị ${s.medianFps}), frame max ${s.maxFrame} ms, >50ms: ${s.over50}, long task ${s.longTasks} (max ${s.longTaskMax} ms), GL max ${s.maxGl}` : '–')
  if (r.a) {
    L.push(`a) FCP ${r.a.load.fcp} ms · load ${r.a.load.load} ms · JS tải ${r.a.load.jsKB} kB`)
    for (const k of ['intro', 'enter', 'mapIdle', 'sandTouch', 'addressBar']) L.push(`   ${k}: ${f(r.a[k])}${k === 'addressBar' ? ` · cát vẽ lại ${r.a.addressBar.sandRedraws}/6 lần resize` : ''}`)
  }
  if (r.c || r.b) {
    const st = r.c ? r.c.stations : [r.b]
    const tr = st.flatMap((s) => s.scenes.map((x) => x.transition))
    const sorted = (a) => [...a].sort((x, y) => x - y)
    const med = (a) => sorted(a)[a.length >> 1]
    L.push(`b/c) ${st.length} trạm, ${tr.length} lần chuyển scene: fps trung vị ${med(tr.map((x) => x.fps))}, frame max trung vị ${med(tr.map((x) => x.maxFrame))} ms, tệ nhất ${Math.max(...tr.map((x) => x.maxFrame))} ms; ${tr.filter((x) => x.over50 > 0).length}/${tr.length} lần có frame > 50 ms; long task tổng ${tr.reduce((s, x) => s + x.longTasks, 0)}; khi chuyển: createStage sống max ${Math.max(...tr.map((x) => x.maxStages))}, WebGL chưa thu hồi max ${Math.max(...tr.map((x) => x.maxGl))}`)
    L.push(`   vào trạm (bấm → scene): trung vị ${med(st.map((s) => s.latency))} ms, max ${Math.max(...st.map((s) => s.latency))} ms`)
    if (r.c) {
      const s1 = r.c.stations[0].settled
      L.push(`   heap: bản đồ ${r.c.mapStart.heapMB} MB → sau trạm ${r.c.stations[0].id} ${s1.heapMB} MB → ${r.c.stations.filter((s) => s.settled).slice(1).map((s) => `t${pad(s.id)} ${s.settled.heapMB}`).join(' → ')} → về bản đồ ${r.c.mapEnds.map((m) => `${m.heapMB} MB (GL ${m.glAlive}, stage ${m.stages}, loop ${m.loopsTicking ?? '?'}/${m.loopsAlive ?? '?'}, rAF ${m.loops})`).join(' · vòng sau: ')}`)
    }
  }
  if (r.d) for (const d of r.d) L.push(`d) t${pad(d.id)} lần đầu: vào ${d.latency} ms · ${f(d.stats)}${d.toScene ? ` · sang scene ${d.toScene.scene}: ${f(d.toScene)}` : ''} · chunk: ${d.net.filter((n) => /three|t\d\d/.test(n.file)).map((n) => `${n.file} ${n.kB} kB/${n.ms} ms`).join(', ')}`)
  if (r.e) {
    const st = r.e.legs.filter((l) => l.to !== 'map'), mp = r.e.legs.filter((l) => l.to === 'map')
    L.push(`e) vào trạm: ${st.map((l) => l.latency).join('/')} ms · về map: ${mp.map((l) => l.latency).join('/')} ms · long task max ${Math.max(...r.e.legs.map((l) => l.longTaskMax))} ms`)
    L.push(`   heap ${r.e.start.heapMB} → ${r.e.end.heapMB} MB · GL sống ${r.e.start.glAlive} → ${r.e.end.glAlive} (đã tạo ${r.e.end.glMade}) · stage ${r.e.end.stages} · rAF ${r.e.start.loops} → ${r.e.end.loops} [${r.e.end.loopNames.join(', ')}]`)
  }
  return L.join('\n')
}
