import * as THREE from 'three'
import content from '../../content/tram-09.json'
import { createStage } from '../../core/three-stage'
import { cssVar, onPrefs } from '../../core/prefs'
import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { Koi, PED_X, noise3, rng } from './koi'
import { devHook, layoutOf } from './shared'

const C = content.scenes.input

/** Ink clutter behind the subject: reeds, ripples, pebbles, a floating leaf. viewBox 400×300. */
function clutter() {
  const r = rng(31)
  const g = s('g', null)
  for (let i = 0; i < 7; i++) {
    const cx = 60 + r() * 280, cy = 40 + r() * 230, rx = 30 + r() * 70
    g.append(s('ellipse', { class: 'rip', cx, cy, rx, ry: rx * 0.32 }))
  }
  const reed = (x: number, lean: number, hgt: number) => {
    const top = 300 - hgt
    return s('path', { class: 'reed', d: `M${x} 305 Q ${x + lean * 0.4} ${300 - hgt * 0.5} ${x + lean} ${top} Q ${x + lean * 0.5 + 2} ${300 - hgt * 0.5} ${x + 5} 305Z` })
  }
  ;[[18, 14, 230], [34, -8, 190], [48, 22, 260], [360, -20, 240], [376, 6, 200], [388, -10, 150], [70, 30, 120]].forEach(([x, l, hg]) => g.append(reed(x, l, hg)))
  ;[[300, 262, 26, 12], [328, 250, 14, 8], [90, 270, 20, 9], [230, 282, 30, 10]].forEach(([cx, cy, rx, ry]) => g.append(s('ellipse', { class: 'peb', cx, cy, rx, ry })))
  g.append(s('path', { class: 'pad', d: 'M330 60 a44 22 0 1 0 2 0 L320 78Z' }))
  g.append(s('path', { class: 'pad', d: 'M60 40 a30 14 0 1 0 2 0 L52 52Z' }))
  return g
}

/** Scene 3 — four flaws in the photo, four flaws in the model; fix the photo and the model mends. */
export function inputScene(ctx: SceneCtx) {
  const low = ctx.quality === 'low'
  const root = h('div', { class: 't9 t9i' })
  const host = h('div', { class: 't9i-gl', 'aria-hidden': 'true' })
  const bg = s('svg', { class: 't9i-bg', viewBox: '0 0 400 300', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' }, clutter())
  const photo = h('div', { class: 't9i-photo', role: 'img', 'aria-label': C.photo }, bg)
  const leaf = s('g', { class: 'leaf' },
    s('path', { d: 'M0 -46 C 30 -44 52 -20 50 6 C 48 34 20 50 -6 48 C -36 46 -52 18 -48 -8 C -46 -30 -26 -44 -4 -46 L 0 -2Z' }),
    ...[0, 1, 2, 3, 4, 5, 6].map((k) => {
      const a = -1.2 + k * 0.62
      return s('path', { class: 'vein', d: `M0 -2 L${(Math.cos(a) * 44).toFixed(1)} ${(Math.sin(a) * 42).toFixed(1)}` })
    }))
  const over = s('svg', { class: 't9i-over', viewBox: '0 0 400 300', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' },
    s('defs', null, s('radialGradient', { id: 't9i-glare' }, s('stop', { offset: 0, class: 'g0' }), s('stop', { offset: 0.55, class: 'g1' }), s('stop', { offset: 1, class: 'g2' }))),
    s('g', { transform: 'translate(205 168) rotate(-18) scale(1.15)' }, leaf),
    s('ellipse', { class: 'glare', cx: 275, cy: 120, rx: 62, ry: 44, fill: 'url(#t9i-glare)' }))
  const result = h('div', { class: 't9i-result' }, s('svg', { class: 't9i-ring', viewBox: '-100 -30 200 60', 'aria-hidden': 'true' },
    s('ellipse', { rx: 92, ry: 22 }), s('ellipse', { rx: 76, ry: 17 }), s('ellipse', { rx: 60, ry: 13 })))
  const photoLab = h('p', { class: 't9i-lab' }, C.photo)
  const resultLab = h('p', { class: 't9i-lab' }, C.result)
  const arrow = s('svg', { class: 't9i-arrow', viewBox: '0 0 80 24', 'aria-hidden': 'true' },
    s('path', { d: 'M4 13 C 22 9, 44 15, 66 11 L 60 5 M66 11 L 59 18' }))
  const fixed = C.fixes.map(() => false)
  const btns = C.fixes.map((f, i) => h('button', {
    class: 't9i-fix', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(C.fixAria, f), onClick: () => toggle(i),
  }, h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', { class: 'txt' }, f.flaw)))
  const status = h('p', { class: 't9i-status', 'aria-live': 'polite' }, fill(C.status, { n: 0 }))
  const fixes = h('div', { class: 't9i-fixes', role: 'group', 'aria-label': C.group }, ...btns)
  root.append(photo, result, host, over, photoLab, resultLab, arrow, fixes, status)
  ctx.art.append(root)
  ctx.prompt(C.prompt)

  // ── layout: photo → arrow → result, controls below
  type R = { x: number; y: number; w: number; h: number }
  let pr: R = { x: 0, y: 0, w: 1, h: 1 }, rr: R = { ...pr }
  const place = (el: HTMLElement | SVGElement, r: R) => Object.assign((el as HTMLElement).style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` })
  const layout = () => {
    const W = root.clientWidth, H = root.clientHeight
    if (!W || !H) return
    const L = layoutOf(root)
    root.dataset.layout = L
    const fh = fixes.offsetHeight + status.offsetHeight + 18
    const labH = 30
    if (L === 'tall') {
      // photo above, the model below it (the model gets the larger share), compact fixes at the foot
      const avail = H - fh - labH * 2 - 22
      const ph = Math.min(avail * 0.45, ((W * 0.9) * 3) / 4)
      const pw = (ph * 4) / 3
      pr = { x: (W - pw) / 2, y: labH, w: pw, h: ph }
      const rh = Math.max(60, avail - ph)
      const rw = Math.min(W, rh * 1.7)
      rr = { x: (W - rw) / 2, y: pr.y + ph + labH + 18, w: rw, h: rh }
      arrow.style.display = 'none' // the order (photo above, model below) says it; no room for an arrow between the labels
    } else if (L === 'short') {
      // controls on the right, the two pictures share the left
      const fw = fixes.offsetWidth + 20
      const room = W - fw
      const avail = H - labH - 8
      const pw = Math.min(room * 0.5, (avail * 4) / 3)
      const ph = (pw * 3) / 4
      const gap = Math.min(70, room * 0.1)
      const rw = Math.min(room - pw - gap, pw * 1.05)
      const x0 = Math.max(0, (room - (pw + gap + rw)) / 2)
      const y0 = labH + Math.max(0, (avail - ph) / 2)
      pr = { x: x0, y: y0, w: pw, h: ph }
      rr = { x: x0 + pw + gap, y: y0, w: rw, h: ph }
      Object.assign(arrow.style, { display: '', left: `${x0 + pw + gap / 2 - 22}px`, top: `${y0 + ph / 2 - 7}px`, width: '44px', rotate: '0deg' })
    } else {
      const avail = H - fh - labH - 6
      const pw = Math.min(W * 0.44, (avail * 4) / 3)
      const ph = (pw * 3) / 4
      const gap = Math.min(110, W * 0.08)
      const rw = Math.min(W - pw - gap - 10, pw * 1.05)
      const x0 = (W - (pw + gap + rw)) / 2
      const y0 = labH + Math.max(0, (avail - ph) / 2)
      pr = { x: x0, y: y0, w: pw, h: ph }
      rr = { x: x0 + pw + gap, y: y0, w: rw, h: ph }
      Object.assign(arrow.style, { display: '', left: `${x0 + pw + gap / 2 - 30}px`, top: `${y0 + ph / 2 - 9}px`, width: '60px', rotate: '0deg' })
    }
    place(photo, pr)
    place(over, pr)
    place(result, rr)
    const lab = (el: HTMLElement, r: R) => {
      const w = Math.max(r.w, 150)
      Object.assign(el.style, { left: `${r.x + r.w / 2 - w / 2}px`, top: `${r.y - labH}px`, width: `${w}px` })
    }
    lab(photoLab, pr)
    lab(resultLab, rr)
  }

  const stage = createStage(host, { fov: 26 })
  if (!stage) {
    host.append(h('p', { class: 't9-nogl' }, C.noWebgl))
    ctx.insight(C.insight, C.detail as Fact)
    return () => root.remove()
  }
  const { renderer, canvas } = stage
  canvas.setAttribute('aria-hidden', 'true')
  renderer.autoClear = false

  // ── two little worlds: the photo and the model built from it
  const sPhoto = new THREE.Scene()
  const sModel = new THREE.Scene()
  const camP = new THREE.PerspectiveCamera(26, 4 / 3, 0.1, 50)
  const camM = new THREE.PerspectiveCamera(26, 1.4, 0.1, 50)
  const kp = new Koi(low)
  const km = new Koi(low)
  for (const k of [kp, km]) {
    k.wireRaw.visible = k.wireQuad.visible = false
    k.rawOpacity = 0
    k.quadOpacity = 0
  }
  sPhoto.add(kp.group)
  const turn = new THREE.Group()
  const shape = new THREE.Group()
  shape.add(km.group)
  turn.add(shape)
  sModel.add(turn)
  // background bits the AI fused onto the model: a reed spiked right through the body, a pebble stuck under the chin
  const reedMat = new THREE.MeshBasicMaterial({ transparent: true })
  const pebMat = new THREE.MeshBasicMaterial({ transparent: true })
  const reedGeo = new THREE.ConeGeometry(0.035, 1.5, 7, 1, false)
  reedGeo.translate(0, 0.75, 0)
  const reed = new THREE.Mesh(reedGeo, reedMat)
  reed.position.set(-0.32, -0.62, 0.04)
  reed.rotation.z = -0.32
  const pebGeo = new THREE.IcosahedronGeometry(0.11, 2)
  const pp = pebGeo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pp.count; i++) {
    const k = 0.8 + 0.4 * noise3(pp.getX(i) * 9, pp.getY(i) * 9, pp.getZ(i) * 9)
    pp.setXYZ(i, pp.getX(i) * k * 1.4, pp.getY(i) * k * 0.8, pp.getZ(i) * k)
  }
  pebGeo.computeVertexNormals()
  const peb = new THREE.Mesh(pebGeo, pebMat)
  peb.position.set(0.62, -0.27, 0.02)
  shape.add(reed, peb)

  // ── state: 1 = flaw present
  const F = { bg: 1, angle: 1, crop: 1, clean: 1 }
  // the model idles in a three-quarter view (head toward us), swaying a little; drag turns it anywhere
  let yaw = -0.5, dragV = 0, sway = 0
  let drag: { id: number; x: number } | null = null
  const dir = new THREE.Vector3(), look = new THREE.Vector3()
  const applyTheme = () => {
    const c = (n: string) => new THREE.Color(cssVar(n))
    kp.theme()
    km.theme()
    reedMat.color = c('--moss')
    pebMat.color = c('--stone')
    stage.render()
  }
  applyTheme()
  const offPrefs = onPrefs(applyTheme)

  const draw = (_t: number, dt: number) => {
    // photo: angle and crop are camera problems
    const a = F.angle, cr = F.crop
    dir.set(THREE.MathUtils.lerp(0.12, 0.62, a), THREE.MathUtils.lerp(0.25, 1.25, a), THREE.MathUtils.lerp(1, 0.55, a)).normalize()
    const d = THREE.MathUtils.lerp(4.15, 2.75, cr)
    look.set(THREE.MathUtils.lerp(-0.06, 0.48, cr), -0.04, 0)
    camP.position.copy(look).addScaledVector(dir, d)
    camP.up.set(0, 1, 0)
    camP.lookAt(look)
    camP.aspect = pr.w / pr.h
    camP.updateProjectionMatrix()
    // model: lumps, a missing tail, a glare baked in, fused clutter, wrong proportions
    const flaws = (F.bg + F.angle + F.crop + F.clean) / 4
    km.U.uNoise.value = 0.1 + 0.5 * flaws
    km.U.uFacet.value = 0.12 + 0.4 * flaws
    km.U.uCut.value = THREE.MathUtils.lerp(-9, PED_X + 0.3, F.crop)
    km.U.uGlare.value = F.clean
    km.U.uDent.value = F.clean
    const k = 1e-4 + F.bg
    reed.scale.set(k, 0.2 + 0.8 * F.bg, k)
    reed.visible = peb.visible = F.bg > 0.003
    peb.scale.setScalar(k)
    shape.scale.set(1 + 0.05 * F.angle, 1 - 0.16 * F.angle, 1 + 0.28 * F.angle)
    shape.position.x = 0.1 - 0.42 * F.crop // turn about what is there: the cropped model has no tail
    shape.rotation.z = 0.09 * F.angle
    if (dt > 0) sway += dt * 0.45
    yaw += dragV
    dragV *= 0.85
    turn.rotation.y = yaw + (ctx.reduced ? 0 : Math.sin(sway) * 0.3)
    turn.rotation.x = 0.2
    // frame the fish to its window: the whole length across, a little air round it
    const aspect = rr.w / rr.h
    const tf = Math.tan((camM.fov * Math.PI) / 360)
    const dm = Math.max(THREE.MathUtils.lerp(1.3, 0.95, F.crop) / (tf * aspect), 0.8 / tf)
    camM.position.set(0, 0.18 * (dm / 4.5), dm)
    camM.lookAt(0, -0.06, 0)
    camM.aspect = aspect
    camM.updateProjectionMatrix()

    const H = stage.height
    renderer.setScissorTest(true)
    renderer.setScissor(0, 0, stage.width, H)
    renderer.setViewport(0, 0, stage.width, H)
    renderer.clear()
    renderer.setViewport(pr.x, H - pr.y - pr.h, pr.w, pr.h)
    renderer.setScissor(pr.x, H - pr.y - pr.h, pr.w, pr.h)
    renderer.render(sPhoto, camP)
    renderer.setViewport(rr.x, H - rr.y - rr.h, rr.w, rr.h)
    renderer.setScissor(rr.x, H - rr.y - rr.h, rr.w, rr.h)
    renderer.render(sModel, camM)
    renderer.setScissorTest(false)
    root.style.setProperty('--bg', F.bg.toFixed(3))
    root.style.setProperty('--clean', F.clean.toFixed(3))
  }
  stage.onFrame(draw)
  stage.onResize(() => layout())
  layout()
  stage.render()

  // ── fixing
  let said = false
  function toggle(i: number) {
    fixed[i] = !fixed[i]
    const f = C.fixes[i]
    const b = btns[i]
    b.setAttribute('aria-pressed', String(fixed[i]))
    b.setAttribute('aria-label', fixed[i] ? fill(C.fixedAria, f) : fill(C.fixAria, f))
    ;(b.querySelector('.txt') as HTMLElement).textContent = fixed[i] ? f.fix : f.flaw
    const key = (['bg', 'angle', 'crop', 'clean'] as const)[i]
    const v = fixed[i] ? 0 : 1
    if (ctx.reduced) {
      F[key] = v
      stage!.render()
    } else ctx.anim(() => gsap.to(F, { [key]: v, duration: 1.4, ease: 'power3.inOut' }))
    const n = fixed.filter(Boolean).length
    status.textContent = fill(C.status, { n })
    status.classList.toggle('done', n === fixed.length)
    ctx.chime(fixed[i] ? 'tap' : 'low')
    if (n === fixed.length && !said) {
      said = true
      ctx.chime('ok')
      ctx.insight(C.insight, C.detail as Fact)
    }
  }

  // drag to spin the model
  const onDown = (e: PointerEvent) => {
    drag = { id: e.pointerId, x: e.clientX }
    try {
      result.setPointerCapture(e.pointerId)
    } catch {
      /* gone */
    }
  }
  const onMove = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return
    dragV = (e.clientX - drag.x) * 0.01
    drag.x = e.clientX
    stage.render()
  }
  const onUp = () => void (drag = null)
  result.addEventListener('pointerdown', onDown)
  result.addEventListener('pointermove', onMove)
  result.addEventListener('pointerup', onUp)
  result.addEventListener('pointercancel', onUp)
  const ro = new ResizeObserver(() => layout())
  ro.observe(fixes)
  devHook({ F, toggle }, draw, () => {})

  return () => {
    offPrefs()
    ro.disconnect()
    result.removeEventListener('pointerdown', onDown)
    result.removeEventListener('pointermove', onMove)
    result.removeEventListener('pointerup', onUp)
    result.removeEventListener('pointercancel', onUp)
    for (const sc of [sPhoto, sModel])
      sc.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        ;(Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach((x) => x.dispose())
      })
    stage.dispose()
    root.remove()
  }
}
