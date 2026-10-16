#!/usr/bin/env node
/**
 * Art review shots: every content scene of some stations (quiz + ensō skipped) in 4 frames — 1440×900 and 375×812
 * (phone, touch), light and dark — at quality=high, Math.random seeded as in perf-shots. One contact sheet per station
 * (rows = scenes, columns = the 4 frames) so a whole station reads at a glance.
 *
 *   npm run build && node scripts/art-shots.mjs before --stations 19-39   # → docs/part2-shots/art/before/tNN.jpg
 *   node scripts/art-shots.mjs after --stations 19-21 --quality low
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveDist } from './serve-dist.mjs'

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'))
const argv = process.argv.slice(2)
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d)
const label = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'shots'
const [a, b = a] = opt('stations', '19-39').split('-').map(Number)
const stations = Array.from({ length: b - a + 1 }, (_, i) => a + i)
const quality = opt('quality', 'high')
const dir = `docs/part2-shots/art/${label}`
const pad = (n) => String(n).padStart(2, '0')
const ALL_FRAMES = [
  ['desk-light', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' }],
  ['desk-dark', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' }],
  ['phone-light', { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' }],
  ['phone-dark', { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' }],
]
// --frames desk-light,desk-dark · --scenes 2,3: a quicker pass while painting (no contact sheet then)
const FRAMES = ALL_FRAMES.filter(([f]) => String(opt('frames', f)).split(',').includes(f))
const only = opt('scenes', '') ? String(opt('scenes')).split(',').map(Number) : null

fs.mkdirSync(`${dir}/raw`, { recursive: true })
const server = await serveDist(opt('dist', 'dist'))
const browser = await chromium.launch({ channel: 'chromium', args: process.platform === 'darwin' ? ['--use-angle=metal'] : [] })
const scenes = {} // station → number of content scenes
try {
  await Promise.all(FRAMES.map(async ([name, device]) => {
    const context = await browser.newContext({ ...device, reducedMotion: 'no-preference' })
    await context.addInitScript((q) => {
      localStorage.setItem('aizen:quality', JSON.stringify(q))
      // the first-visit card (B.5) would cover the first scene shot: mark it seen
      if (!localStorage.getItem('aizen:progress')) localStorage.setItem('aizen:progress', JSON.stringify({ visited: [], passed: [], hints: ['part2-advice'] }))
      let s = 20261015 // mulberry32, as perf-shots
      Math.random = () => {
        s = (s + 0x6d2b79f5) | 0
        let t = Math.imul(s ^ (s >>> 15), 1 | s)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }, quality)
    const page = await context.newPage()
    for (const id of stations) {
      await page.goto(`${server.url}#/tram/${id}/1`, { waitUntil: 'load' })
      await page.waitForSelector('.rail-dot')
      const n = (await page.locator('.rail-dot').count()) - 2
      scenes[id] = n
      for (let k = 1; k <= n; k++) {
        if (only && !only.includes(k)) continue
        if (k > 1) await page.goto(`${server.url}#/tram/${id}/${k}`, { waitUntil: 'load' })
        await page.waitForTimeout(k === 1 ? 5000 : 3200)
        await page.screenshot({ path: `${dir}/raw/t${pad(id)}-${k}-${name}.jpg`, type: 'jpeg', quality: 70 })
      }
      console.error(`${name} t${pad(id)}: ${n} scenes`)
    }
    await context.close()
  }))
  if (only || FRAMES.length < ALL_FRAMES.length) process.exit(0)
  // contact sheets: a plain page of <img>, screenshot full page
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  for (const id of stations) {
    const imgs = Array.from({ length: scenes[id] }, (_, i) => FRAMES.map(([f]) => `${dir}/raw/t${pad(id)}-${i + 1}-${f}.jpg`)).flat()
    const html = `<body style="margin:0;background:#888"><div style="display:grid;grid-template-columns:repeat(2,560px) repeat(2,180px);gap:6px;padding:6px">${imgs
      .map((f) => `<img src="data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}" style="width:100%">`)
      .join('')}</div></body>`
    await page.setContent(html, { waitUntil: 'load' })
    await page.screenshot({ path: `${dir}/t${pad(id)}.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  }
  console.error(`→ ${dir}/tNN.jpg`)
} finally {
  await browser.close()
  server.close()
}
