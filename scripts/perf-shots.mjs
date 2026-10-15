#!/usr/bin/env node
/**
 * Before/after screenshots for perf work: every scene of a few stations at quality=high and quality=low,
 * 1440×900, light theme, Math.random seeded so two runs draw the same garden.
 *
 *   npm run build && node scripts/perf-shots.mjs before        # → docs/perf-shots/before/{high,low}/tNN-K.jpg
 *   node scripts/perf-shots.mjs after --stations 6,15 --quality low
 * The quiz and ensō scenes are shot for station 1 only (they are the same frame everywhere).
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
const stations = opt('stations', '1,3,6,7,9,13,15,17,18').split(',').map(Number)
const qualities = opt('quality', 'high,low').split(',')
const pad = (n) => String(n).padStart(2, '0')

const server = await serveDist(opt('dist', 'dist'))
const browser = await chromium.launch({ channel: 'chromium', args: process.platform === 'darwin' ? ['--use-angle=metal'] : [] })
try {
  for (const q of qualities) {
    const dir = `docs/perf-shots/${label}/${q}`
    fs.mkdirSync(dir, { recursive: true })
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'no-preference' })
    await context.addInitScript((quality) => {
      localStorage.setItem('aizen:quality', JSON.stringify(quality))
      let s = 20261015 // mulberry32: the same "random" garden in every run
      Math.random = () => {
        s = (s + 0x6d2b79f5) | 0
        let t = Math.imul(s ^ (s >>> 15), 1 | s)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }, q)
    const page = await context.newPage()
    for (const id of stations) {
      await page.goto(`${server.url}#/tram/${id}/1`, { waitUntil: 'load' })
      await page.waitForSelector('.rail-dot')
      const n = await page.locator('.rail-dot').count()
      const last = id === stations[0] ? n : n - 2 // quiz + ensō once
      for (let k = 1; k <= last; k++) {
        if (k > 1) await page.goto(`${server.url}#/tram/${id}/${k}`, { waitUntil: 'load' })
        await page.waitForTimeout(k === 1 ? 5000 : 3200) // chapter card / scene intro animations
        await page.screenshot({ path: `${dir}/t${pad(id)}-${k}.jpg`, type: 'jpeg', quality: 60 })
      }
      console.error(`${q} t${pad(id)}: ${last} scenes`)
    }
    await context.close()
  }
} finally {
  await browser.close()
  server.close()
}
