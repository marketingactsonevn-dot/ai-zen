import * as THREE from 'three'
import { TeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { createStage } from '../../core/three-stage'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { cssVar, onPrefs } from '../../core/prefs'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, rng, stroke } from './ink'
import { formula, type ArtApi, type Kit } from './kit'
import { potInk } from './pot'

const S = C.scenes.model
const WD = S.words
// slot order: 0 ảnh sạch · 1 chất liệu · 2 mục đích · 3 số đa giác · 4 PBR · 5 dọn trong Blender
const CLS = ['s-clean', 's-mat', 's-use', 's-budget', 's-pbr', 's-blender']
type Mat = (typeof S.materials)[number]['id']
type Use = (typeof S.uses)[number]['id']

/** The input photo: a busy table, or the same teapot alone on plain paper. */
function photo() {
  const r = rng(5)
  const busy = s('g', { class: 'busy' },
    ...Array.from({ length: 7 }, (_, i) => s('path', { class: 'stripe', d: `M${-10 + i * 18} 0 L${20 + i * 18} 0 L${-10 + i * 18} 120 L${-40 + i * 18} 120Z` })),
    s('path', { class: 'clutter', d: blob(22, 70, 14, 22, 3, 0.2) }),
    s('path', { class: 'clutter2', d: 'M70 44 h22 v36 h-22z' }),
    s('path', { class: 'clutter', d: blob(86, 100, 18, 7, 6, 0.1) }),
    ...[0, 1, 2, 3].map((i) => s('path', { class: 'leafy', d: stroke([[18, 52], [10 + i * 6 + r() * 4, 28 - i * 4], [6 + i * 8, 14 + r() * 6]], 4, { head: 0.2, tail: 0.6 }) })),
    s('path', { class: 'shadowy', d: blob(52, 104, 46, 10, 4, 0.2) }))
  const pot = s('g', { transform: 'translate(52 98) scale(0.42)' }, potInk())
  return s('svg', { class: 't13m-photo', viewBox: '0 0 104 120', 'aria-hidden': 'true' },
    s('rect', { class: 'ph-bg', x: 0, y: 0, width: 104, height: 120 }), busy, pot,
    s('rect', { class: 'ph-edge', x: 0.5, y: 0.5, width: 103, height: 119 }))
}

/** The four PBR maps as little swatches: colour, roughness, metal, bumps. */
function swatches() {
  const mk = (i: number, body: SVGElement[]) => h('figure', { class: 't13m-sw', title: WD.pbr[i] },
    s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, ...body), h('figcaption', null, WD.pbr[i]))
  const r = rng(12)
  return h('div', { class: 't13m-sws' },
    mk(0, [s('rect', { class: 'sw-base', width: 24, height: 24 }), s('path', { class: 'sw-hi', d: blob(9, 8, 7, 4, 2, 0.2) })]),
    mk(1, [s('rect', { class: 'sw-rough', width: 24, height: 24 }), ...Array.from({ length: 22 }, () => s('circle', { class: 'sw-dot', cx: (r() * 24).toFixed(1), cy: (r() * 24).toFixed(1), r: (0.6 + r() * 1.4).toFixed(1) }))]),
    mk(2, [s('rect', { class: 'sw-metal', width: 24, height: 24 })]),
    mk(3, [s('rect', { class: 'sw-bump', width: 24, height: 24 }), ...[5, 11, 17].map((y) => s('path', { class: 'sw-ridge', d: `M0 ${y}Q6 ${y - 3} 12 ${y}T24 ${y}` }))]))
}

function buildArt(k: Kit): ArtApi {
  const ctx = k.ctx
  let mat: Mat = 'matte'
  let use: Use = 'game'
  const matCopy = (id: Mat) => S.materials.find((m) => m.id === id)!
  const useCopy = (id: Use) => S.uses.find((u) => u.id === id)!
  const syncFrags = () => {
    k.setFrag(1, fill(S.slots[1].frag, { mat: matCopy(mat).frag }))
    k.setFrag(2, fill(S.slots[2].frag, { use: useCopy(use).frag }))
    k.setFrag(3, fill(S.slots[3].frag, { budget: useCopy(use).budget }))
  }
  syncFrags()

  const host = h('div', { class: 't13m-gl', role: 'slider', tabindex: '0', 'aria-label': S.artLabel, 'aria-valuemin': '0', 'aria-valuemax': '359', 'aria-valuenow': '0' })
  const card = h('div', { class: 't13m-input', 'aria-hidden': 'true' }, photo(), h('p', null, WD.input))
  const sws = swatches()
  // aria-live only once build() has filled it, so entering the scene is not announced
  const tris = h('p', { class: 't13m-tris' })
  const wrap = h('div', { class: 't13m' }, host, card, sws, tris)
  k.stage.append(wrap)

  let on: boolean[] = S.slots.map(() => false)
  // set by build() once the 3D scene exists; until then update() only changes the page around it
  let apply: ((instant: boolean) => void) | null = null
  let dispose3d = () => {}

  // choosers for the material and the use, shown once their stones are down
  const chooser = <T extends string>(label: string, items: { id: T; name: string }[], get: () => T, set: (v: T) => void) => {
    const btns = items.map((it) =>
      h('button', { class: 't13-mode', type: 'button', 'aria-pressed': String(it.id === get()), onClick: () => {
        set(it.id)
        btns.forEach((b, i) => b.setAttribute('aria-pressed', String(items[i].id === get())))
      } }, it.name))
    return h('div', { class: 't13-modes', role: 'group', 'aria-label': label, hidden: true }, ...btns)
  }
  const matPick = chooser(WD.matGroup, S.materials, () => mat, (v) => ((mat = v), syncFrags(), ctx.chime('tap'), apply?.(false)))
  const usePick = chooser(WD.useGroup, S.uses, () => use, (v) => ((use = v), syncFrags(), ctx.chime('tap'), apply?.(false)))
  k.extra.append(matPick, usePick)

  let angle = 0.5
  const deg = (a: number) => Math.round((((a * 180) / Math.PI) % 360 + 360) % 360)
  const announce = () => {
    host.setAttribute('aria-valuenow', String(deg(angle)))
    host.setAttribute('aria-valuetext', fill(WD.angle, { n: deg(angle) }))
  }
  announce()

  // The turntable is built over three frames (stage · scene · teapot and loop) so the scene change has no long
  // task (spec A.10); the canvas shows nothing until its shaders are ready anyway. Reduced motion: all at once.
  function* build() {
    // animate:false — this scene drives its own spin loop (see below), the stage only renders on demand
    const stage = createStage(host, { fov: 30, animate: false })
    if (!stage) return void host.append(h('p', { class: 't13m-nogl' }, WD.noGl))
    dispose3d = stage.dispose // frees whatever is in the scene so far
    yield

    const { scene, camera, renderer } = stage
    camera.position.set(0, 1.75, 6)
    camera.lookAt(0, 0.7, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    // reflections only show with the PBR stone: prefilter the room then, not on mount (~70 ms on a phone)
    let envTex: THREE.Texture | null = null
    const env = () => {
      if (!envTex) {
        const pmrem = new THREE.PMREMGenerator(renderer)
        envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
        pmrem.dispose()
      }
      return envTex
    }

    scene.add(new THREE.HemisphereLight(0xfffaf0, 0x8a8476, 1.25))
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.7)
    sun.position.set(-3, 5, 4)
    scene.add(sun)
    const rim = new THREE.DirectionalLight(0xdfe8ff, 0.5)
    rim.position.set(4, 2, -3)
    scene.add(rim)

    // the stage: a disc of raked sand and a few bamboo stalks behind, so glass has something to bend
    const sandCanvas = document.createElement('canvas')
    sandCanvas.width = sandCanvas.height = 256
    const sandTex = new THREE.CanvasTexture(sandCanvas)
    sandTex.colorSpace = THREE.SRGBColorSpace
    const sandMat = new THREE.MeshBasicMaterial({ map: sandTex, transparent: true, depthWrite: false })
    const sand = new THREE.Mesh(new THREE.CircleGeometry(2.7, 64), sandMat)
    sand.rotation.x = -Math.PI / 2
    sand.position.y = 0.001
    scene.add(sand)
    const grove = new THREE.Group()
    const stalkGeo = new THREE.CylinderGeometry(0.075, 0.085, 3.6, 12)
    const nodeGeo = new THREE.CylinderGeometry(0.092, 0.092, 0.035, 12)
    const stalkMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 })
    const nodeMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 })
    ;[[-0.95, -1.9, 0.02], [-0.5, -2.5, -0.03], [1.25, -2.1, 0.04]].forEach(([x, z, lean], i) => {
      const st = new THREE.Group()
      st.add(new THREE.Mesh(stalkGeo, stalkMat))
      for (let y = -1.3 + i * 0.15; y < 1.8; y += 0.62) {
        const n = new THREE.Mesh(nodeGeo, nodeMat)
        n.position.y = y
        st.add(n)
      }
      st.position.set(x, 1.8, z)
      st.rotation.z = lean
      grove.add(st)
    })
    scene.add(grove)

    // soft ground shadow (a radial ink wash)
    const shCanvas = document.createElement('canvas')
    shCanvas.width = shCanvas.height = 128
    const shTex = new THREE.CanvasTexture(shCanvas)
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.9, 48), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.002
    scene.add(shadow)

    // the turntable: teapot, the clutter it swallowed from a busy photo, and stray shards
    const turn = new THREE.Group()
    scene.add(turn)
    const clayMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 })
    const roughCanvas = document.createElement('canvas')
    roughCanvas.width = roughCanvas.height = 128
    {
      const g = roughCanvas.getContext('2d')!
      const r = rng(3)
      g.fillStyle = '#bbb'
      g.fillRect(0, 0, 128, 128)
      for (let i = 0; i < 900; i++) {
        const v = 150 + Math.floor(r() * 90)
        g.fillStyle = `rgb(${v},${v},${v})`
        g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2)
      }
    }
    const roughTex = new THREE.CanvasTexture(roughCanvas)
    roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping
    roughTex.repeat.set(3, 3)
    const mats = {
      glass: new THREE.MeshPhysicalMaterial({ roughness: 0.03, metalness: 0, transmission: 1, thickness: 0.7, ior: 1.45, attenuationDistance: 7, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true }),
      matte: new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0 }),
      metal: new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 1 }),
    }
    const teapot = new THREE.Mesh(new THREE.BufferGeometry(), clayMat)
    turn.add(teapot)
    const wire = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.32, depthWrite: false }))
    turn.add(wire)
    const lumps = new THREE.Group()
    const lumpGeos = [new THREE.SphereGeometry(0.42, 10, 8), new THREE.CylinderGeometry(0.3, 0.24, 0.5, 9), new THREE.BoxGeometry(0.7, 0.18, 0.5)]
    ;[[1.35, 0.32, 0.25], [-1.25, 0.25, -0.35], [0.2, 0.09, 0.85]].forEach((p, i) => {
      const m = new THREE.Mesh(lumpGeos[i], clayMat)
      m.position.set(p[0], p[1], p[2])
      m.rotation.set(i * 0.4, i, i * 0.3)
      lumps.add(m)
    })
    turn.add(lumps)
    const shards = new THREE.Group()
    const shardGeo = new THREE.IcosahedronGeometry(0.09, 0)
    const sr = rng(8)
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(shardGeo, clayMat)
      const a = sr() * Math.PI * 2
      const rr = 1.5 + sr() * 0.5
      m.position.set(Math.cos(a) * rr, 0.25 + sr() * 1.5, Math.sin(a) * rr)
      m.scale.setScalar(0.6 + sr() * 1.1)
      m.userData.s0 = m.scale.x
      m.rotation.set(sr() * 3, sr() * 3, 0)
      shards.add(m)
    }
    turn.add(shards)

    // teapot geometry for a given level of detail; noisy when the photo was busy
    let segsNow = -1
    let noisyNow = false
    let wireOf: THREE.BufferGeometry | null = null
    function setGeometry(segs: number, noisy: boolean, flat: boolean, wired: boolean) {
      if (segs !== segsNow || noisy !== noisyNow) {
        segsNow = segs
        noisyNow = noisy
        const g = new TeapotGeometry(1, segs, true, true, true, true, true)
        g.computeBoundingBox()
        const bb = g.boundingBox!
        const sc = 2.4 / (bb.max.x - bb.min.x)
        g.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y, -(bb.max.z + bb.min.z) / 2)
        g.scale(sc, sc, sc)
        if (noisy) {
          const p = g.attributes.position as THREE.BufferAttribute
          const n = g.attributes.normal as THREE.BufferAttribute
          for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
            const d = 0.07 * Math.sin(x * 6.1 + y * 2.3) * Math.cos(z * 5.3 - y * 4.1) + 0.04 * Math.sin(y * 13 + x * 3)
            p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d)
          }
          g.computeVertexNormals()
        }
        teapot.geometry.dispose()
        teapot.geometry = g
        const count = g.index ? g.index.count / 3 : g.attributes.position.count / 3
        // grouped by hand: toLocaleString's first call loads the locale (~15 ms on a phone); same text for en-US / vi-VN
        tris.textContent = fill(WD.tris, { n: String(Math.round(count)).replace(/\B(?=(\d{3})+(?!\d))/g, __LOCALE__ === 'en' ? ',' : '.') })
      }
      // the wireframe only once it shows (the polygon-budget stone)
      if (wired && wireOf !== teapot.geometry) {
        wireOf = teapot.geometry
        wire.geometry.dispose()
        wire.geometry = new THREE.WireframeGeometry(wireOf)
      }
      for (const m of [clayMat, ...Object.values(mats)]) {
        if (m.flatShading !== flat) {
          m.flatShading = flat
          m.needsUpdate = true
        }
      }
    }

    // colours from the design tokens (re-read when the theme changes)
    const col = (v: string) => new THREE.Color().setStyle(cssVar(v) || '#888', THREE.SRGBColorSpace)
    function readColors() {
      const moss = col('--moss')
      clayMat.color.copy(col('--stone-2'))
      mats.glass.color.copy(col('--moss-2')).lerp(new THREE.Color(1, 1, 1), 0.72)
      mats.glass.attenuationColor.copy(col('--moss'))
      mats.matte.color.copy(document.documentElement.dataset.theme === 'dark' ? col('--moss-2') : moss)
      mats.metal.color.copy(col('--stone-3')).lerp(new THREE.Color(0.85, 0.83, 0.8), 0.6)
      ;(wire.material as THREE.LineBasicMaterial).color.copy(col('--ink'))
      stalkMat.color.copy(col('--moss-2'))
      nodeMat.color.copy(col('--moss'))
      // raked rings in the sand, fading out at the rim
      const sg = sandCanvas.getContext('2d')!
      sg.clearRect(0, 0, 256, 256)
      sg.fillStyle = cssVar('--paper-2') || '#ebe5d8'
      sg.beginPath()
      sg.arc(128, 128, 128, 0, Math.PI * 2)
      sg.fill()
      sg.lineWidth = 1.6
      for (let rr = 18; rr < 128; rr += 9) {
        sg.strokeStyle = cssVar('--rake') || 'rgba(0,0,0,.15)'
        sg.beginPath()
        sg.arc(128, 128, rr, 0, Math.PI * 2)
        sg.stroke()
        sg.strokeStyle = cssVar('--rake-hi') || 'rgba(255,255,255,.6)'
        sg.beginPath()
        sg.arc(128, 128, rr + 1.6, 0, Math.PI * 2)
        sg.stroke()
      }
      sg.globalCompositeOperation = 'destination-in'
      const fade = sg.createRadialGradient(128, 128, 70, 128, 128, 128)
      fade.addColorStop(0, '#000')
      fade.addColorStop(1, 'rgba(0,0,0,0)')
      sg.fillStyle = fade
      sg.fillRect(0, 0, 256, 256)
      sg.globalCompositeOperation = 'source-over'
      sandTex.needsUpdate = true
      const g = shCanvas.getContext('2d')!
      g.clearRect(0, 0, 128, 128)
      const dark = document.documentElement.dataset.theme === 'dark'
      const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64)
      grd.addColorStop(0, dark ? '#000' : cssVar('--ink') || '#000')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      g.globalAlpha = dark ? 0.6 : 0.22
      g.fillStyle = grd
      g.fillRect(0, 0, 128, 128)
      shTex.needsUpdate = true
      stage!.render()
    }
    readColors()
    const offPrefs = onPrefs(readColors) // before the yield, so a theme change between the slices still lands
    dispose3d = () => (offPrefs(), stage.dispose())
    yield

    apply = (instant) => {
      const [clean, hasMat, hasUse, budget, pbr, tidy] = on
      // detail: game → few faces, faceted; render → many, smooth
      setGeometry(hasUse ? (use === 'game' ? 3 : 14) : clean ? 8 : 6, !clean, hasUse && use === 'game', budget)
      // material: clay until a material is named; without PBR every material is a flat colour
      const m = hasMat ? mats[mat] : clayMat
      teapot.material = m
      for (const x of [clayMat, ...Object.values(mats)]) {
        x.envMap = pbr ? env() : null
        x.envMapIntensity = pbr ? 1 : 0
        x.roughnessMap = pbr && x !== mats.glass ? roughTex : null
        x.needsUpdate = true
      }
      if (hasMat && !pbr) {
        // "just a colour": no reflections, no see-through
        mats.metal.metalness = 0.15
        mats.metal.roughness = 0.9
        mats.glass.transmission = 0
        mats.glass.opacity = 0.75
      } else {
        mats.metal.metalness = 1
        mats.metal.roughness = 0.28
        mats.glass.transmission = 1
        mats.glass.opacity = 1
      }
      lumps.visible = !clean
      wire.visible = budget
      ;(wire.material as THREE.LineBasicMaterial).opacity = hasUse && use === 'render' ? 0.1 : 0.32
      S.materials.forEach((x) => wrap.classList.toggle(`m-${x.id}`, hasMat && x.id === mat))
      const target = tidy ? 0.0001 : 1
      shards.children.forEach((sh, i) => {
        if (instant || ctx.reduced) sh.visible = !tidy
        else {
          sh.visible = true
          const v = target * (sh.userData.s0 as number)
          gsap.to(sh.scale, { x: v, y: v, z: v, duration: 0.7, delay: i * 0.06, ease: tidy ? 'back.in(2)' : 'back.out(2)', onUpdate: () => stage!.render(), onComplete: () => void (sh.visible = !tidy) })
        }
      })
      stage!.render()
    }

    // turntable: slow spin; drag or arrow keys turn it by hand
    let dragging = false
    let lastX = 0
    turn.rotation.y = angle
    let lastAria = -1
    // paused offscreen / hidden tab / reduced motion; stopped while a drag turns it by hand
    const spin = createLoop(host, (t, dt) => {
      angle += dt * 0.28
      turn.rotation.y = angle
      // until the stage has drawn once (after its async shader compile, spec A.7) let it draw: drawing here first
      // would compile every shader in one long task
      if (renderer.info.render.frame) renderer.render(scene, camera)
      else stage.render()
      if (t - lastAria > 1) {
        lastAria = t
        announce()
      }
    })
    if (!ctx.reduced) spin.start()
    const setAngle = (a: number) => {
      angle = a
      turn.rotation.y = a
      announce()
      stage.render()
    }
    const down = (e: PointerEvent) => {
      dragging = true
      spin.stop()
      lastX = e.clientX
      host.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      setAngle(angle + (e.clientX - lastX) * 0.012)
      lastX = e.clientX
    }
    const up = () => {
      dragging = false
      if (!ctx.reduced) spin.start()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      setAngle(angle + (e.key === 'ArrowRight' ? 1 : -1) * (Math.PI / 12))
    }
    host.addEventListener('pointerdown', down)
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerup', up)
    host.addEventListener('pointercancel', up)
    host.addEventListener('keydown', key)

    dispose3d = () => {
      spin.dispose()
      offPrefs()
      gsap.killTweensOf(shards.children.map((c) => c.scale))
      lumpGeos.forEach((g) => g.dispose())
      ;[stalkGeo, nodeGeo, sand.geometry, shadow.geometry].forEach((g) => g.dispose())
      ;[stalkMat, nodeMat, sandMat, shadow.material as THREE.Material, clayMat, wire.material as THREE.Material].forEach((m) => m.dispose())
      sandTex.dispose()
      shTex.dispose()
      teapot.geometry.dispose()
      wire.geometry.dispose()
      shardGeo.dispose()
      Object.values(mats).forEach((m) => m.dispose())
      roughTex.dispose()
      envTex?.dispose()
      stage.dispose()
    }
    apply(true)
    tris.setAttribute('aria-live', 'polite')
  }
  // sliced() runs its first slice right away: start it next frame so the stage is not made in the mount's task
  let job: { cancel(): void } | null = null
  const start = () => void (job = sliced(build(), { sync: ctx.reduced }))
  const raf = ctx.reduced ? (start(), 0) : requestAnimationFrame(start)

  return {
    update(o, vague, instant) {
      on = o.map((x) => x && !vague)
      CLS.forEach((c, i) => wrap.classList.toggle(c, on[i]))
      matPick.hidden = !on[1]
      usePick.hidden = !on[2]
      k.refit()
      apply?.(instant)
    },
    dispose() {
      cancelAnimationFrame(raf)
      job?.cancel()
      dispose3d()
    },
  }
}

export function modelScene(ctx: SceneCtx) {
  return formula(ctx, S, buildArt)
}

