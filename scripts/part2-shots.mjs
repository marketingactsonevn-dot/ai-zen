#!/usr/bin/env node
/**
 * Part 2 frame screenshots (spec B): the Moon Garden map #/vuon-trang, and the Part 1 map #/vuon for regression,
 * in portrait (375×812 @2x, phone with touch) and landscape (1440×900), light and dark theme. quality=high and
 * Math.random seeded as in perf-shots, so two runs draw the same garden; every shot is a fresh page load.
 *
 *   npm run build && node scripts/part2-shots.mjs      # → docs/part2-shots/{part2,part1}-{portrait,landscape}-{light,dark}.jpg
 *   node scripts/part2-shots.mjs --advice              # keep the first-visit card (B.5) on the Part 2 map
 *   --dist dist/en (EN build) · --out other/dir · --quality low
 *
 * Slide mode (before/after of the Part 2 fix, same frames as docs/part2-audit/all/): every scene of some stations,
 * desk-dark 1440×900 (-d) and phone-light 375×812 @2x (-p), named like the audit shots.
 *   node scripts/part2-shots.mjs --slides 19-21 [--scenes 1,3] [--label after]   # → docs/part2-shots/slides/after/tNN-K-{d,p}.jpg
 *   --quiz also shoots the quiz and ensō scenes (K = n+1, n+2)
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveDist } from './serve-dist.mjs'

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'))
const argv = process.argv.slice(2)
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d)
const ADVICE = argv.includes('--advice')
const quality = opt('quality', 'high')
const SLIDES = opt('slides', '')
const dir = opt('out', SLIDES ? `docs/part2-shots/slides/${opt('label', 'after')}` : 'docs/part2-shots')
const pad = (n) => String(n).padStart(2, '0')

const VIEWS = {
  portrait: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  landscape: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
}
const MAPS = { part2: ['#/vuon-trang', '.garden a.pstone[href="#/tram/19"]'], part1: ['#/vuon', '.garden a.pstone[href="#/tram/1"]'] }

fs.mkdirSync(dir, { recursive: true })
const server = await serveDist(opt('dist', 'dist'))
const browser = await chromium.launch({ channel: 'chromium', args: process.platform === 'darwin' ? ['--use-angle=metal'] : [] })
// the same seeded page for both modes: quality, first-visit card seen (unless --advice), Math.random = mulberry32
const seed = (context) =>
  context.addInitScript(([q, advice]) => {
    localStorage.setItem('aizen:quality', JSON.stringify(q))
    // the B.5 card shows once per browser; mark it seen unless --advice (visited stays empty: a new visitor's map)
    if (!advice && !localStorage.getItem('aizen:progress')) localStorage.setItem('aizen:progress', JSON.stringify({ visited: [], passed: [], hints: ['part2-advice'] }))
    let s = 20261015 // mulberry32: the same "random" garden in every run
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }, [quality, ADVICE])
try {
  if (SLIDES) await slides()
  else for (const [view, device] of Object.entries(VIEWS))
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ ...device, colorScheme: theme, reducedMotion: 'no-preference' })
      await seed(context)
      for (const [name, [hash, ready]] of Object.entries(MAPS)) {
        const page = await context.newPage() // a hash-only goto would not reload, so the seed would not restart
        await page.goto(`${server.url}${hash}`, { waitUntil: 'load' })
        await page.waitForSelector(ready, { state: 'attached' })
        await page.waitForTimeout(5000) // .garden.appear: 4.2 s of stones, rocks and labels settling in
        const file = `${dir}/${name}-${view}-${theme}.jpg`
        await page.screenshot({ path: file, type: 'jpeg', quality: 70 })
        console.error(`→ ${file}`)
        await page.close()
      }
      await context.close()
    }
} finally {
  await browser.close()
  server.close()
}

async function slides() {
  const [a, b = a] = String(SLIDES).split('-').map(Number)
  const only = opt('scenes', '') ? String(opt('scenes')).split(',').map(Number) : null
  const quiz = argv.includes('--quiz')
  const frames = [['d', { ...VIEWS.landscape, colorScheme: 'dark' }], ['p', { ...VIEWS.portrait, colorScheme: 'light' }]]
  await Promise.all(frames.map(async ([tag, device]) => {
    const context = await browser.newContext({ ...device, reducedMotion: 'no-preference' })
    await seed(context)
    for (let id = a; id <= b; id++) {
      let page = await context.newPage()
      await page.goto(`${server.url}#/tram/${id}/1`, { waitUntil: 'load' })
      await page.waitForSelector('.rail-dot')
      const n = (await page.locator('.rail-dot').count()) - (quiz ? 0 : 2)
      for (let k = 1; k <= n; k++) {
        if (only && !only.includes(k)) continue
        if (k > 1) {
          await page.close() // fresh load per scene: the seed restarts, so before and after draw the same garden
          await (page = await context.newPage()).goto(`${server.url}#/tram/${id}/${k}`, { waitUntil: 'load' })
        }
        await page.waitForTimeout(k === 1 ? 5000 : 3200) // scene 1 waits out the chapter card
        await page.screenshot({ path: `${dir}/t${pad(id)}-${k}-${tag}.jpg`, type: 'jpeg', quality: 70 })
      }
      await page.close()
      console.error(`${tag} t${pad(id)}: ${n} scenes → ${dir}`)
    }
    await context.close()
  }))
}
