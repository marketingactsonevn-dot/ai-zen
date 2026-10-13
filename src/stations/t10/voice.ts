import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { brush, C, clamp, fitCanvas, palette, rgba, rng, timers, watchTheme, type Pal } from './ink'

const V = C.scenes.voice

/** A voice only colours the sentence's own rhythm: reed width, height, roughness, pace. */
interface Voice { dur: number; amp: number; jag: number; w: number; gap: number; alpha: number; dry: number; seed: number }
const VOICES: Voice[] = [
  { dur: 0.42, amp: 0.74, jag: 0.18, w: 1.45, gap: 1.1, alpha: 0.9, dry: 0, seed: 11 }, // trầm ấm — broad, smooth, unhurried
  { dur: 0.3, amp: 1, jag: 0.5, w: 0.9, gap: 0.92, alpha: 0.92, dry: 0, seed: 23 }, // trong trẻo — tall, bright, quick
  { dur: 0.36, amp: 0.36, jag: 0.6, w: 0.75, gap: 1.3, alpha: 0.55, dry: 0.4, seed: 37 }, // thì thầm — low, airy, broken
]

interface Reading { wordT: number[]; syl: { t: number; d: number; a: number }[]; T: number }
interface Tick { x: number; t: number; h: number; lean: number; tw: number; tone: number }
/** Each reed takes one of four ink loads, so the bed reads as brushwork, not a bar chart. */
const TONES = [0.58, 0.72, 0.86, 1]

/** Syllable timing: Vietnamese = one syllable per word; English ≈ vowel groups. Commas and stops breathe. */
function prosody(text: string, lang: string, v: Voice): Reading {
  const words = text.split(/\s+/).filter(Boolean)
  const r = rng(text.length * 131 + 7)
  const syl: Reading['syl'] = []
  const wordT: number[] = []
  let t = 0.12
  for (const w of words) {
    wordT.push(t)
    const n = lang === 'en' ? Math.max(1, (w.toLowerCase().replace(/[^a-z]/g, '').replace(/e$/, '').match(/[aeiouy]+/g) ?? []).length) : 1
    for (let k = 0; k < n; k++) {
      const d = v.dur * (0.78 + r() * 0.5)
      syl.push({ t, d, a: lang === 'en' ? (k === 0 ? 0.82 + r() * 0.18 : 0.48 + r() * 0.2) : 0.55 + r() * 0.45 })
      t += d * 0.9
    }
    t += /[,;:]$/.test(w) ? 0.34 : /[.!?]$/.test(w) ? 0.4 : 0.03
  }
  return { wordT, syl, T: t + 0.15 }
}

function loud(rd: Reading, t: number) {
  let m = 0
  for (const y of rd.syl) {
    const u = (t - y.t) / y.d
    if (u <= 0 || u >= 1.2) continue
    m = Math.max(m, y.a * (u < 0.16 ? u / 0.16 : Math.max(0, 1 - ((u - 0.16) / 1.04) ** 1.5)))
  }
  return m
}

/** A reed blade: thick where it meets the water, a fine point at the tip. dir −1 grows up, +1 hangs down (reflection). */
function reed(g: CanvasRenderingContext2D, x: number, base: number, hgt: number, tw: number, lean: number, dir: number) {
  const top = base + dir * hgt
  g.moveTo(x + lean, top)
  g.quadraticCurveTo(x + tw * 0.6 + lean * 0.12, base + dir * hgt * 0.45, x + tw * 0.5, base)
  g.lineTo(x - tw * 0.5, base)
  g.quadraticCurveTo(x - tw * 0.6 + lean * 0.12, base + dir * hgt * 0.5, x + lean, top)
  g.closePath()
}

/** Tiny glyph on each voice stone: the texture that voice will draw. */
function glyph(v: Voice) {
  const hs = [0.35, 0.7, 1, 0.62, 0.85, 0.45, 0.28]
  return s('svg', { class: 't10v-glyph', viewBox: '0 0 44 26', 'aria-hidden': 'true' },
    ...hs.map((k, i) => {
      const x = 5 + i * 5.6 * (v.gap > 1.2 ? 1.02 : 1)
      const hh = 3 + 18 * k * v.amp
      return s('path', { d: brush([[x, 22], [x + 0.6, 22 - hh]], 2.6 * v.w, { a: 0.05, b: 0.7, min: 0.1, wob: 0 }), 'fill-opacity': v.alpha })
    }))
}

/** Scene 1 — a written line beside a pond. Read aloud, its voice rises as a bed of ink reeds; switch language, same voice. */
export function voiceScene(ctx: SceneCtx) {
  const bg = document.createElement('canvas') // the quiet back layer, painted once per layout
  const cv = h('canvas', { class: 't10v-cv', role: 'img', 'aria-label': V.art })
  const line = h('p', { class: 't10v-line', lang: 'vi' })
  const langs = V.langs.map((L, i) =>
    h('button', { class: 't10-chip', type: 'button', lang: L.lang, 'aria-pressed': String(i === 0), onClick: () => setLang(i) }, L.name))
  const langBox = h('div', { class: 't10v-lang', role: 'group', 'aria-label': V.langLabel }, ...langs)
  const voices = VOICES.map((v, i) =>
    h('button', { class: 't10v-voice', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(V.readAs, { name: V.voices[i] }), onClick: () => read(i) },
      h('span', { class: 't10v-peb', 'aria-hidden': 'true' }, glyph(v)),
      h('span', { class: 't10v-vname', 'aria-hidden': 'true' }, V.voices[i])))
  const voiceBox = h('div', { class: 't10v-voices', role: 'group', 'aria-label': V.voicesLabel }, ...voices)
  const same = h('p', { class: 't10-cap t10v-same' }, V.same)
  // ElevenLabs' mark is two upright bars — beside a waveform it reads as a pause button, so the name is set in type
  const brand = h('div', { class: 't10-brand t10v-brand' }, ctx.fact(V.brand, 'p', 't10-cap'))
  const root = h('div', { class: 't10 t10v' }, cv, langBox, line, same, brand, voiceBox)
  ctx.art.append(root)
  ctx.prompt(V.prompt)

  let spans: HTMLElement[] = []
  let lang = 0
  let voice = -1
  let rd: Reading | null = null
  let ticks: Tick[] = []
  let old: Tick[] = []
  let oldTint = 1
  const st = { p: -1, oldA: 0 }
  let play: gsap.core.Tween | null = null
  let nextSyl = 0
  let curWord = -1
  let readOnce = false
  let dubbed = false
  const ripples: { x: number; at: number; v: boolean }[] = []
  const tm = timers()

  // geometry
  let W = 0
  let H = 0
  let x0 = 0
  let x1 = 0
  let base = 0
  let maxH = 0
  let short = false
  const view = { base: 0, maxH: 0 } // what is drawn: glides to base / maxH when only the height changes
  let g: CanvasRenderingContext2D | null = null
  let pal: Pal = palette()
  let waterD: Path2D | null = null
  let marks: Path2D | null = null
  let banks: { x: number; h: number; lean: number; tw: number }[] = []
  let dirty = true

  function setWords() {
    const L = V.langs[lang]
    line.lang = L.lang
    spans = L.text.split(/\s+/).map((w) => h('span', { class: 't10v-w' }, w))
    line.replaceChildren(...spans.flatMap((sp, i) => (i ? [' ', sp] : [sp])))
    curWord = -1
  }
  setWords()

  const xOf = (t: number) => x0 + (rd ? clamp(t / rd.T) : 0) * (x1 - x0)

  function buildTicks() {
    if (!rd) return []
    const v = VOICES[voice]
    const r = rng(v.seed)
    const gap = Math.max(3.4, (x1 - x0) / 175) * v.gap
    const out: Tick[] = []
    // on a very low frame even a whisper keeps enough height to read as reeds
    const amp = short ? Math.max(0.5, v.amp) : v.amp
    for (let x = x0; x <= x1; x += gap) {
      const t = ((x - x0) / (x1 - x0)) * rd.T
      let a = loud(rd, t) * amp * (1 - v.jag + v.jag * r())
      if (v.dry && r() < v.dry) a *= 0.35
      const lean = (r() - 0.42) * 0.3
      const tw = Math.min(gap * 0.92, gap * 0.6 * v.w * (0.75 + r() * 0.5))
      const tone = Math.floor(r() * TONES.length)
      // silence leaves clean water: no stubs in the pauses
      if (a < 0.04) continue
      out.push({ x: x + (r() - 0.5) * gap * 0.3, t, h: a, lean, tw, tone })
    }
    return out
  }

  function layout() {
    const was = { W, voices: voiceBox.offsetTop, brand: brand.offsetTop, same: same.offsetTop }
    W = root.clientWidth
    H = root.clientHeight
    if (!W || !H) return
    const wide = W / H > 1.1
    short = wide && H < 330
    root.classList.toggle('wide', wide)
    root.classList.toggle('short', short)
    root.classList.toggle('tall', !wide)
    const fs = short ? clamp(H * 0.085, 15, 19) : wide ? clamp(Math.min(W * 0.03, H * 0.072), 17, 40) : clamp(W * 0.06, 19, 30)
    root.style.setProperty('--fs', `${fs}px`)
    const ps = short ? clamp(H * 0.17, 30, 38) : wide ? clamp(H * 0.11, 34, 62) : H < 440 ? 46 : clamp(W * 0.14, 42, 58)
    root.style.setProperty('--ps', `${ps}px`)
    const langW = langBox.offsetWidth || 190
    let voicesTop: number
    let cy: number
    if (short) {
      // landscape, short: the voices in a quiet column on the left; the line and the pond own the right
      const colW = Math.min(W * 0.27, 180)
      Object.assign(voiceBox.style, { left: '0px', width: `${colW}px` })
      voicesTop = Math.max(0, (H - voiceBox.offsetHeight) / 2)
      x0 = colW + 22
      x1 = W - 6
      Object.assign(langBox.style, { left: `${W - langW}px`, top: '0px' })
      Object.assign(line.style, { left: `${x0}px`, width: `${W - langW - 16 - x0}px`, top: '4px' })
      const top = Math.max(line.offsetTop + line.offsetHeight, langBox.offsetHeight) + 8
      const bottom = H - 24
      maxH = Math.max(30, Math.min(H * 0.24, (bottom - top) / 1.62))
      base = top + Math.max(0, (bottom - top - maxH * 1.6) / 2) + maxH
      cy = Math.min(base + maxH * 0.55 + 4, H - 20)
    } else {
      // the line on top; under the pond, two quiet captions; the voices a breath below them, never flush to the edge
      const rowH = voiceBox.offsetHeight || ps + 28
      const gapB = wide ? clamp(H * 0.05, 18, 36) : 18
      Object.assign(voiceBox.style, { left: '0px', width: `${W}px` })
      let y = Math.max(2, H * 0.025)
      Object.assign(langBox.style, { left: `${(W - langW) / 2}px`, top: `${y}px` })
      y += (langBox.offsetHeight || 40) + Math.min(14, H * 0.02)
      const lw = wide ? Math.min(W * 0.78, fs * 24) : W
      Object.assign(line.style, { left: `${(W - lw) / 2}px`, width: `${lw}px`, top: `${y}px` })
      const top = line.offsetTop + line.offsetHeight + 14
      const capH = wide ? 24 : 50
      const capGap = wide ? 28 : 20
      x0 = wide ? W * 0.1 : 6
      x1 = wide ? W * 0.9 : W - 6
      // room for the pond: its reeds (maxH) above the water, the reflection (0.6·maxH) and a little air below
      const room = H - gapB - rowH - capGap - capH - top - 8
      maxH = Math.max(18, Math.min(wide ? H * 0.27 : H * 0.17, room / 1.62))
      const slack = Math.max(0, room - maxH * 1.62)
      base = top + slack * 0.45 + maxH
      cy = base + maxH * 0.6 + 8
      voicesTop = cy + capH + capGap + slack * 0.2
    }
    // two quiet captions under the reflection: "same voice" on the left, the notable name on the right
    let brandTop = cy
    let sameTop = cy
    if (wide) {
      const cw = (x1 - x0) * (short ? 0.6 : 0.42)
      Object.assign(brand.style, { left: `${x1 - cw}px`, width: `${cw}px` })
      Object.assign(same.style, { left: `${x0}px`, width: `${short ? x1 - x0 - cw - 12 : cw}px`, textAlign: 'left' })
      // never let a wrapped caption run off the bottom of a low frame
      brandTop = Math.min(cy, H - brand.offsetHeight - 2)
      sameTop = Math.min(cy, H - same.offsetHeight - 2)
    } else {
      // a phone: the two captions stack on the right, under the reflection
      Object.assign(brand.style, { left: `${x0}px`, width: `${x1 - x0}px` })
      Object.assign(same.style, { left: `${x0}px`, width: `${x1 - x0}px`, textAlign: 'right' })
      sameTop = cy + 24
    }
    // only the height changed (the insight arrived below): everything glides to its new place instead of jumping
    const glide = !ctx.reduced && was.W === W && view.maxH > 0
    const place = (el: HTMLElement, from: number, to: number) => {
      el.style.top = `${to}px`
      if (glide && from !== to) ctx.anim(() => gsap.fromTo(el, { top: from }, { top: to, duration: 0.9, ease: 'power3.inOut', overwrite: 'auto' }))
    }
    place(voiceBox, was.voices, voicesTop)
    place(brand, was.brand, brandTop)
    place(same, was.same, sameTop)
    if (glide) ctx.anim(() => gsap.to(view, { base, maxH, duration: 0.9, ease: 'power3.inOut', overwrite: true }))
    else {
      gsap.killTweensOf(view)
      view.base = base
      view.maxH = maxH
    }
    paintBg()

    g = fitCanvas(cv, W, H, ctx.quality)
    const r = rng(5)
    const pts: [number, number][] = []
    for (let x = x0 - 34; x <= x1 + 34; x += 24) pts.push([x, base + Math.sin(x * 0.013) * 0.8])
    waterD = new Path2D(brush(pts, 2.2, { a: 0.08, b: 0.12, min: 0.2, wob: 0.18 }))
    // faint water strokes under the line
    marks = new Path2D()
    for (let k = 0; k < 7; k++) {
      const cx = x0 + r() * (x1 - x0)
      const cy = base + maxH * (0.12 + r() * 0.42)
      const len = (x1 - x0) * (0.04 + r() * 0.07)
      marks.addPath(new Path2D(brush([[cx - len, cy], [cx, cy + 0.6], [cx + len, cy]], 1.4, { a: 0.3, b: 0.4 })))
    }
    // a few tall bank reeds frame the pond
    banks = []
    // (on a phone the pond runs edge to edge, so no bank reeds)
    for (const [bx, dir] of wide ? ([[x0 - 4, -1], [x1 + 4, 1]] as const) : []) {
      for (let k = 0; k < 5; k++) banks.push({ x: bx + dir * k * (3 + r() * 4), h: maxH * (0.5 + r() * 0.75), lean: dir * (0.05 + r() * 0.2), tw: 2 + r() * 1.6 })
    }
    if (rd) ticks = buildTicks()
    dirty = true
    draw(performance.now())
  }

  /** The quiet back layer: a low sun (a pale moon at night) setting behind a far shore of wash, both mirrored in the pond. */
  function paintBg() {
    const b = fitCanvas(bg, W, H, ctx.quality)
    const pw = x1 - x0
    const disc = pal.dark ? pal.ink : pal.verm
    const sx = x0 + pw * 0.74
    const R = maxH * 0.42
    const sy = base - maxH * 0.42
    if (pal.dark) {
      const halo = b.createRadialGradient(sx, sy, R * 0.9, sx, sy, R * 2.4)
      halo.addColorStop(0, rgba(disc, 0.06))
      halo.addColorStop(1, rgba(disc, 0))
      b.fillStyle = halo
      b.fillRect(sx - R * 2.4, sy - R * 2.4, R * 4.8, R * 4.8)
    }
    const dg = b.createRadialGradient(sx, sy, 0, sx, sy, R)
    dg.addColorStop(0, rgba(disc, pal.dark ? 0.08 : 0.065))
    dg.addColorStop(0.85, rgba(disc, pal.dark ? 0.1 : 0.085))
    dg.addColorStop(0.97, rgba(disc, pal.dark ? 0.13 : 0.12))
    dg.addColorStop(1, rgba(disc, 0))
    b.fillStyle = dg
    b.beginPath()
    b.arc(sx, sy, R, 0, Math.PI * 2)
    b.fill()
    // its light broken on the water
    const r = rng(19)
    for (let k = 0; k < 6; k++) {
      const y = base + 5 + k * maxH * 0.085
      const hw = R * (0.95 - k * 0.13) * (0.8 + r() * 0.3)
      const xo = sx + (r() - 0.5) * R * 0.25
      b.fillStyle = rgba(disc, (pal.dark ? 0.11 : 0.1) * (1 - k / 7))
      b.fill(new Path2D(brush([[xo - hw, y], [xo, y + 0.4], [xo + hw, y]], 2.2 - k * 0.2, { a: 0.3, b: 0.35, wob: 0.2 })))
    }
    // the far shore: a low ridge of wash, and its faint reflection
    const ridge = (x: number) => maxH * (0.3 + 0.1 * Math.sin(x * 0.009 + 1.2) + 0.06 * Math.sin(x * 0.023 + 0.4) + 0.025 * Math.sin(x * 0.061))
    const xs: number[] = []
    for (let x = x0 - 40; x <= x1 + 40; x += 8) xs.push(x)
    // the sun sets behind it: clear the disc below the ridge line first
    b.globalCompositeOperation = 'destination-out'
    b.beginPath()
    b.moveTo(xs[0], base)
    for (const x of xs) b.lineTo(x, base - ridge(x))
    b.lineTo(xs[xs.length - 1], base)
    b.closePath()
    b.fill()
    b.globalCompositeOperation = 'source-over'
    for (const [dir, a] of [[-1, pal.dark ? 0.1 : 0.075], [1, pal.dark ? 0.04 : 0.03]] as const) {
      const fg = b.createLinearGradient(0, base + dir * maxH * 0.45, 0, base)
      fg.addColorStop(0, rgba(pal.ink, a))
      fg.addColorStop(1, rgba(pal.ink, a * 0.25))
      b.fillStyle = fg
      b.beginPath()
      b.moveTo(xs[0], base)
      for (const x of xs) b.lineTo(x, base + dir * ridge(x) * (dir > 0 ? 0.55 : 1))
      b.lineTo(xs[xs.length - 1], base)
      b.closePath()
      b.fill()
    }
    // both melt into the paper at the pond's ends
    b.globalCompositeOperation = 'destination-out'
    for (const [e0, e1] of [[x0 - 40, x0 + pw * 0.16], [x1 + 40, x1 - pw * 0.16]]) {
      const fg = b.createLinearGradient(e0, 0, e1, 0)
      fg.addColorStop(0, 'rgba(0,0,0,1)')
      fg.addColorStop(1, 'rgba(0,0,0,0)')
      b.fillStyle = fg
      b.fillRect(Math.min(e0, e1), 0, Math.abs(e1 - e0), H)
    }
    b.globalCompositeOperation = 'source-over'
  }

  function draw(now: number) {
    if (!g) return
    const clock = now / 1000
    const sway = ctx.reduced || ctx.quality === 'low' ? 0 : 1
    g.clearRect(0, 0, W, H)
    g.save()
    g.translate(0, view.base)
    g.scale(1, view.maxH / maxH || 1)
    g.translate(0, -base)
    g.drawImage(bg, 0, 0, W, H)
    // the pond's ink wash
    const xm = (x0 + x1) / 2
    const rx = (x1 - x0) * 0.62
    g.save()
    g.translate(xm, base)
    g.scale(1, (maxH * 0.9) / rx)
    const wash = g.createRadialGradient(0, 0, 0, 0, 0, rx)
    wash.addColorStop(0, rgba(pal.ink, pal.dark ? 0.06 : 0.055))
    wash.addColorStop(1, rgba(pal.ink, 0))
    g.fillStyle = wash
    g.beginPath()
    g.arc(0, 0, rx, 0, Math.PI * 2)
    g.fill()
    g.restore()

    // bank reeds
    g.fillStyle = rgba(pal.ink3, 0.55)
    g.beginPath()
    for (const b of banks) reed(g, b.x, base, b.h, b.tw, (b.lean + Math.sin(clock * 0.6 + b.x) * 0.03 * sway) * b.h, -1)
    g.fill()
    g.fillStyle = rgba(pal.ink3, 0.16)
    g.beginPath()
    for (const b of banks) reed(g, b.x + Math.sin(clock + b.x) * sway, base, b.h * 0.5, b.tw, b.lean * b.h * 0.5, 1)
    g.fill()

    const v = voice >= 0 ? VOICES[voice] : VOICES[0]
    const swayAt = (x: number, hh: number) => Math.sin(clock * 0.8 + x * 0.012) * 0.045 * hh * sway
    // reeds of the previous reading sink away
    if (st.oldA > 0 && old.length) {
      g.fillStyle = rgba(pal.ink, oldTint * st.oldA)
      g.beginPath()
      for (const tk of old) {
        const hh = tk.h * maxH * st.oldA
        reed(g, tk.x, base, hh, tk.tw, tk.lean * hh, -1)
      }
      g.fill()
    }
    // this reading: reeds grow as the voice passes
    const fresh: [Tick, number, number][] = []
    if (st.p >= 0) {
      // four ink loads; each fades toward a dry, pale tip
      for (let b = 0; b < TONES.length; b++) {
        const a = v.alpha * TONES[b]
        const gr = g.createLinearGradient(0, base, 0, base - maxH)
        gr.addColorStop(0, rgba(pal.ink, a))
        gr.addColorStop(0.45, rgba(pal.ink, a * 0.86))
        gr.addColorStop(1, rgba(pal.ink, a * 0.28))
        g.fillStyle = gr
        g.beginPath()
        for (const tk of ticks) {
          if (tk.tone !== b) continue
          const age = st.p - tk.t
          if (age <= 0) continue
          const k = Math.min(1, age / 0.16)
          const hh = tk.h * maxH * (1 - (1 - k) ** 3)
          reed(g, tk.x, base, hh, tk.tw, tk.lean * hh + swayAt(tk.x, hh), -1)
          if (age < 0.45) fresh.push([tk, hh, 1 - age / 0.45])
        }
        g.fill()
      }
      // reflection, a little broken by the water, fading with depth
      const rf = g.createLinearGradient(0, base, 0, base + maxH * 0.55)
      rf.addColorStop(0, rgba(pal.ink, v.alpha * 0.24))
      rf.addColorStop(1, rgba(pal.ink, 0))
      g.fillStyle = rf
      g.beginPath()
      for (const tk of ticks) {
        const age = st.p - tk.t
        if (age <= 0) continue
        const hh = tk.h * maxH * 0.52 * Math.min(1, age / 0.2)
        reed(g, tk.x + Math.sin(clock * 1.3 + tk.x * 0.08) * 0.9 * sway, base + 1.5, hh, tk.tw * 1.1, -tk.lean * hh, 1)
      }
      g.fill()
      // the newest reeds still carry the reader's vermilion
      for (const [tk, hh, a] of fresh) {
        g.fillStyle = rgba(pal.verm, a * 0.85)
        g.beginPath()
        reed(g, tk.x, base, hh, tk.tw, tk.lean * hh + swayAt(tk.x, hh), -1)
        g.fill()
      }
    }

    // the water line
    if (waterD) {
      g.fillStyle = rgba(pal.ink, 0.62)
      g.fill(waterD)
    }
    if (marks) {
      g.save()
      g.translate(Math.sin(clock * 0.4) * 3 * sway, 0)
      g.fillStyle = rgba(pal.ink, 0.12)
      g.fill(marks)
      g.restore()
    }
    // ripples from each syllable
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i]
      const age = (now - rp.at) / 1000
      if (age > 1.8) {
        ripples.splice(i, 1)
        continue
      }
      const rr = 5 + age * maxH * 0.55
      g.strokeStyle = rgba(rp.v ? pal.verm : pal.ink2, (1 - age / 1.8) * (rp.v ? 0.55 : 0.35))
      g.lineWidth = 1
      g.beginPath()
      g.ellipse(rp.x, base + 2, rr, rr * 0.18, 0, 0, Math.PI * 2)
      g.stroke()
    }
    // the reading point
    if (rd && st.p >= 0 && st.p < rd.T) {
      const px = xOf(st.p)
      g.save()
      g.shadowColor = pal.verm
      g.shadowBlur = pal.dark ? 14 : 8
      g.fillStyle = pal.verm
      g.beginPath()
      g.arc(px, base, 3.6, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
    g.restore()
    dirty = false
  }

  const frame = () => {
    const now = performance.now()
    const live = !ctx.reduced && ctx.quality !== 'low'
    const gliding = view.base !== base || view.maxH !== maxH
    if (!live && !dirty && !gliding && !ripples.length && !(play && play.isActive()) && st.oldA <= 0) return
    if (rd && st.p >= 0) syncWords()
    draw(now)
  }

  function syncWords() {
    if (!rd) return
    while (nextSyl < rd.syl.length && st.p >= rd.syl[nextSyl].t) {
      if (!ctx.reduced) ripples.push({ x: xOf(rd.syl[nextSyl].t), at: performance.now(), v: nextSyl === 0 })
      nextSyl++
    }
    let wi = -1
    for (let i = 0; i < rd.wordT.length; i++) if (st.p >= rd.wordT[i]) wi = i
    if (st.p >= rd.T) wi = rd.wordT.length
    if (wi === curWord) return
    curWord = wi
    spans.forEach((sp, i) => {
      sp.classList.toggle('said', i < wi)
      sp.classList.toggle('now', i === wi)
    })
  }

  function start() {
    const L = V.langs[lang]
    if (ticks.length && st.p > 0) {
      old = ticks.filter((tk) => tk.t < st.p)
      oldTint = VOICES[voice].alpha
    }
    rd = prosody(L.text, L.lang, VOICES[voice])
    ticks = buildTicks()
    nextSyl = 0
    curWord = -2
    play?.kill()
    play = null
    if (ctx.reduced) {
      st.p = rd.T + 1
      st.oldA = 0
      syncWords()
      dirty = true
      draw(performance.now())
      finish()
      return
    }
    ctx.anim(() => {
      gsap.fromTo(st, { oldA: 1 }, { oldA: 0, duration: 0.6, ease: 'power2.in' })
      play = gsap.fromTo(st, { p: 0 }, { p: rd!.T, duration: rd!.T, ease: 'none', delay: old.length ? 0.35 : 0.1, onComplete: () => tm.later(finish, 0) })
    })
    st.p = 0
  }

  function finish() {
    syncWords()
    if (!readOnce) {
      readOnce = true
      ctx.insight(V.insight, V.detail)
      reveal(langBox)
      reveal(brand)
      langs[1].classList.add('invite')
    } else if (lang === 1 && !dubbed) {
      dubbed = true
      ctx.insight(V.dubInsight, V.dubDetail)
      reveal(same)
    }
    ctx.chime('soft')
  }

  function reveal(el: HTMLElement) {
    if (ctx.reduced) gsap.set(el, { autoAlpha: 1 })
    else ctx.anim(() => gsap.fromTo(el, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out' }))
  }

  function read(i: number) {
    voice = i
    voices.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
    start()
  }

  function setLang(i: number) {
    if (i === lang) return
    lang = i
    langs.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
    langs[1].classList.remove('invite')
    setWords()
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(line, { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.9, ease: 'power2.out', clearProps: 'filter' }))
    tm.later(layout, 0)
    if (voice < 0) voice = 0
    voices.forEach((b, j) => b.setAttribute('aria-pressed', String(j === voice)))
    start()
  }

  gsap.set([langBox, brand, same], { autoAlpha: 0 })
  if (!ctx.reduced) gsap.from(voices, { y: 18, opacity: 0, duration: 1.2, stagger: 0.12, delay: 0.5, ease: 'power3.out' })

  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  layout()
  const unTheme = watchTheme(() => {
    pal = palette()
    dirty = true
    if (W) paintBg()
    draw(performance.now())
  })
  gsap.ticker.add(frame)

  return () => {
    gsap.ticker.remove(frame)
    ro.disconnect()
    cancelAnimationFrame(raf)
    unTheme()
    tm.clear()
    play?.kill()
  }
}
