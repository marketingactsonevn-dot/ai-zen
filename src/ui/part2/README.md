# Thành phần dùng chung Phần 2 (spec B.7)

Đọc file này và `types.ts` (hình dạng dữ liệu) là đủ để dựng trạm. Import **từng file**, không có barrel (giữ chunk trạm nhỏ).
Mọi chữ cố định nằm trong `site.json` / `site.en.json` (`labels`); chữ của trạm do trạm truyền vào.

Chung cho mọi thành phần:
- Màu chỉ là token CSS (`html[data-part="2"]`), đổi theme không cần JS. Không canvas, không WebGL, **không vòng frame** (`createLoop`): chuyển động là CSS/WAAPI, tự tắt ở reduced motion (trạng thái tĩnh vẫn đẹp), `quality=low` không có animation lặp.
- Bàn phím: Tab/Enter; phím số 1–9 khi có nói ở dưới; `aria-live` chỉ gắn sau lần điền đầu.
- `insight` truyền vào sẽ hiện bằng `ctx.insight()` khi người xem làm xong tương tác; không truyền thì scene chỉ được đánh dấu đã xem.
- Dùng được làm cả scene (`scenes: [perspectiveCircle(...)]`) lẫn bên trong scene tự viết (`perspectiveCircle(...).mount(ctx)`).
- Thử tất cả với dữ liệu giả: `npm run dev` → `#/tram/99` (chỉ có ở dev, xem `demo.ts` + `demo-data.json`).

## 1. `perspectiveCircle(data: Perspectives, opts)` → `SceneDef` · `perspectives.ts`
3–5 hòn đá bằng nhau quanh hồ trăng, thứ tự xáo ổn định theo dữ liệu. Chạm đá: đá sáng, bóng trăng nghiêng về phía đá, thẻ đọc hiện *Ai nói* + lập luận + dấu tin cậy + nguồn. Nghe hết: mặt nước lặng, `data.common` thành insight. Phím 1–5 = đá số 1–5.
```ts
import { perspectiveCircle } from '../../ui/part2/perspectives'
const c = C.scenes.circle
scenes: [perspectiveCircle(c.perspectives, { label: c.label, prompt: c.prompt, question: c.question, detail: c.detail })]
// opts: { label, prompt?, question?, detail?, art?, sky? }  — prompt mặc định "Nghe từng hòn đá"; detail có thể là mảng nhiều dòng
// art(g: PondGeo) → SVGElement[]: tranh riêng sau hồ (miệng giếng, cầu, bờ xa…) thay núi mặc định; sky: false = không vẽ trăng trên trời
```
**Hook cho trạm tự bố cục** (logic, aria, phím 1–5, thẻ đọc giữ nguyên; `k` = vị trí đá theo chiều kim đồng hồ, số in trên đá và phím là `k+1`; `i` = chỉ số trong `data.stones`, tức *ai nói*):
```ts
perspectiveCircle(data, {
  label, prompt,
  stage: (host, api) => diorama(ctx, host, { layers, floor: false }).dispose,   // sân khấu riêng (2.5D/canvas) thay hồ vẽ sẵn; trả cleanup
  place: (k, n, g) => ({ x, y, s: 1.2, z }),        // chân vật k (px trong stage, g: PondGeo), s = tỉ lệ cỡ đá, z = z-index (mặc định y)
  stone: (k, g, i) => toro(0, 0, 66, true),         // vật đứng thay hòn đá: viewBox -60 -70 120 90, chân ở y = 0, rộng ~92
  onHear: (k, i) => …,                              // mỗi lần chạm vật k
})
// api: { pick(k) — nghe vật k (vd khi chạm vật trong sân khấu riêng), onLayout(fn(g, feet[{ x, y, s }])) — vẽ lại sân khấu theo chỗ đứng }
// class trên root .p2c: .is-heard-{k} (đã nghe vật k), .is-all (nghe đủ) — CSS đổi biến thể (cổng mở, đèn thắp…)
// Có stage thì không vẽ hồ, bóng trăng nghiêng và gợn sóng (đó là việc của sân khấu riêng). Quầng sáng và vòng cào của nút vẫn còn: ẩn bằng CSS nếu không cần.
```

## 2. `progressTide(data: Tide, opts)` → `SceneDef` · `tide.ts`
Cuộn cát dài; kéo trăng trái → phải (chuột, chạm, ← → Home End khi trăng được focus — trăng là `role="slider"`). Mốc nổi lên như đá; thẻ đọc hiện ngày · nhãn · fact, `compare` thành 2 thanh mực dài–ngắn (`ratio = after / before`; thiếu `ratio` thì chỉ hiện 2 con số). Điểm cuối luôn là "Hôm nay · `horizon.asOf`", rồi `horizon` mờ trong sương (kind `prediction`/`opinion`).
```ts
import { progressTide } from '../../ui/part2/tide'
scenes: [progressTide(C.scenes.tide.tide, { label: S.tide.label, question: S.tide.question, insight: S.tide.insight })]
// opts: { label, prompt?, question?, insight?, detail?, aria?, valueText?, art? } — insight hiện khi trăng tới "Hôm nay"
// aria = sliderAria của trạm; valueText = mẫu aria-valuetext {n} {total} {date} {label}
// art: { back?(g) → SVGElement[] (tranh nền riêng của cuộn: w, h, ground, xs, roll, seed), mark?(i, size, seed) → SVGElement (vật nổi lên ở mốc i thay hòn đá) }
// milestones: { date: '2025-03', label, fact, compare?: { before, after, ratio?, beforeLabel?, afterLabel? } }
```
**Hook cho trạm tự bố cục** (nút kéo vẫn là `role="slider"`, ← → ↑ ↓ Home End, aria như cũ; `t` = 0 ở mốc đầu … 1 ở "Hôm nay", mốc `i` nằm ở `t = i / n`):
```ts
progressTide(data, {
  label, aria,
  track: (g) => (t) => [x, y],      // đường đi của tâm nút kéo (px trong band; g: TideGeo = { w, h, ground, xs, roll, seed }): cung trời, cầu zig-zag, mặt nước dâng dọc…
  thumb: () => s('ellipse', …),     // vật được kéo thay đĩa trăng (bóng trăng, đĩa chặn giấy), vẽ trong ô 50 × 50 tâm 0, 0
  onStep: (i, t) => …,              // mỗi lần nút di chuyển: mốc gần nhất i (n = hôm nay) và t liên tục — trạm cho tranh riêng chạy theo (trăng tròn dần, bóng sào dài ra)
})
// Kéo bám theo track (điểm gần con trỏ nhất); track dọc hơn ngang thì slider tự đặt aria-orientation="vertical".
// Đá mốc mặc định vẫn đứng ở xs[i] trên cát; muốn vật khác thì art.mark, muốn bỏ hẳn thì CSS .p2t-ms { display: none } rồi vẽ trong art.back.
```

## 3. Dấu độ tin cậy · `marks.ts` (tự động)
Ở Phần 2, **mọi** `ctx.fact()` / `ctx.insight()` tự gắn dấu mực sau câu (thay nhãn chữ kiểu Phần 1), chạm/rê để xem chú giải:
● `kind` `fact` hoặc không có `kind` · ◐ `opinion` · ○ `prediction` · ◇ có `claimBy` mà chưa có `verifiedBy`.
Có `verifiedBy` thì thành ●, chú giải ghi "Công bố: … / Xác nhận độc lập: …". `illustration` và `verify: true` giữ nhãn Phần 1. Phần 1 không đổi gì.
```ts
{ "text": "…giải 5/6 bài IMO…", "asOf": "2026-10-15", "source": "t38-imo", "claimBy": "Google DeepMind", "verifiedBy": "IMO" }
// tự vẽ dấu ở chỗ khác: import { markOf, markGlyph } from '../../ui/part2/marks'
el.append(markGlyph(markOf(fact)!))   // markOf trả null cho illustration / verify
```

## 4. `newsStones(opts, file = NEWS)` → `SceneDef` · `news.ts`
Bia đá dọc lối, mới nhất trước: mục trong `src/content/news.json` có tag trùng `opts.tags` (= `newsTags` của trạm). Chạm bia → lật: chuyện gì · vì sao quan trọng · nguồn · ngày · ai xác nhận. Nút "Chỉ xem tin đã kiểm chứng" (ẩn opinion, prediction, ◇). Tin cũ hơn 6 tháng so với `news.json.asOf` phủ rêu. `sources` của news.json đã được đăng ký sẵn.
```ts
import { newsStones } from '../../ui/part2/news'
scenes: [newsStones({ label: S.news.label, tags: C.newsTags, insight: S.news.insight })]
// opts: { label, tags, prompt?, insight?, detail? } — insight hiện sau lần lật bia đầu tiên
// news.json: { asOf, items: NewsItem[], sources } — NewsItem: { id, date, title, what, why, kind, source, claimBy?, verifiedBy?, tags }
```

## 5. `takeaway(card: Takeaway, extra?)` → `HTMLElement` · `takeaway.ts`
Thẻ giấy dó: tiêu đề, thân sao chép được (nút Sao chép: Clipboard API, không được thì chọn sẵn chữ để Ctrl+C), `[CHỮ IN HOA TRONG NGOẶC VUÔNG]` được tô màu, `note`, `source` ⓘ, `asOf`. Mọi thẻ nằm trong `src/content/toolkit.json` và hiện lại ở `#/do-nghe`.
```ts
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
const card = findTakeaway('t29-hoi-gia')!          // id trong toolkit.json
ctx.art.append(h('div', { class: 'my-wrap' }, takeaway(card)))
// toolkit.json: { cards: Takeaway[], sources? } — Takeaway: { id, station, title, type: prompt|checklist|command|table, body, note?, source?, topic?, asOf? }
// topic = tên kệ ở #/do-nghe (C.2: "Đọc tin & kiểm chứng", "Tải & chạy model", "Agent an toàn", …); source phải có trong toolkit.json `sources` hoặc sources.json
```

## 6. `stepPath(data: StepPath, opts)` → `SceneDef` · `steps.ts`
Các viên đá nằm xáo trộn (ổn định) cạnh lối trống. Đặt theo thứ tự: chạm lần lượt, kéo thả vào chỗ, hoặc phím số (số in trên đá). Sai: đá trượt về + 1 dòng gợi ý (`why` của bước đúng ở chỗ đó). Đúng hết: lối sáng, thẻ mang về mở (`data.takeaway` = id trong toolkit.json, hoặc `opts.card`).
```ts
import { stepPath } from '../../ui/part2/steps'
scenes: [stepPath(S.path.steps, { label: S.path.label, question: S.path.question, insight: S.path.insight })]
// opts: { label, prompt?, question?, insight?, detail?, card?: Takeaway, cards?: string[] (thêm thẻ), fact? (dòng nguồn dưới câu hỏi), art?(g: PathGeo) → SVGElement[] (trời, đầu và cuối lối riêng) }
// data: { steps: [{ label, detail, why }], takeaway?: 'id-in-toolkit.json' }  — label ngắn (≤ 5 từ), tối đa 9 bước
```
**Hook cho trạm tự bố cục** (đặt đúng/sai, kéo thả, phím số, thẻ mang về giữ nguyên):
```ts
stepPath(data, {
  label, art,
  slots: (g) => Pt[],          // tâm các chỗ trống theo thứ tự (px trong scene; g: SlotGeo = { w, h, n, size: [rộng, cao] của một viên, top: chiều cao câu hỏi, row, seed })
  pile: (g) => Pt[],           // tâm chỗ nằm của đá rời, theo thứ tự phím số (mặc định: hàng dưới lối / cột phải)
  piece: (i, { w, h, seed }) => SVGElement,   // hình của bước i thay viên đá sông (viewBox 0 0 w h, nằm dưới chữ)
  onPlace: (k) => …,           // sau khi đặt đúng bước k
})
// Có slots: lối mực nối các tâm, chạy quá hai đầu theo hướng lối; không vẽ cát cào mặc định; đèn đá cuối lối đứng ở đầu cuối (khi không có art);
// dòng gợi ý và thẻ mang về nằm dưới chỗ trống thấp nhất. Cỡ viên đá vẫn do layout mặc định tính (size): đặt slots/pile theo nó.
```

## 7. `codeScroll(data: CodeScroll, opts?)` → `HTMLElement` · `code.ts`
Cuộn thư pháp cho đoạn mã ngắn: số dòng, tô màu nhẹ tự viết (js, html, css, bash, python, json, text), nút sao chép, chú thích tiếng Việt cạnh mỗi khối (khối = từ dòng của note tới trước note sau; màn hẹp thì note nằm dưới khối). Cao tối đa bằng chỗ chứa, cuộn bên trong.
```ts
import { codeScroll } from '../../ui/part2/code'
ctx.art.append(h('div', { style: 'position:absolute;inset:0;display:flex' }, codeScroll(S.carve.code, { title: 'main.js' })))
// data: { lang: 'js', code: '…\n…', notes: [{ line: 2, text: 'Tìm tấm canvas…' }] }
```

## Tiện ích (`ink.ts`)
`rng(seed)`, `seedOf(text)`, `shuffledIdx(n, seed)`, `blob()`, `rock()`, `stoneArt(w, h, seed)` (đá mực có bóng, sườn tối, viền trăng), `stroke(pts, w)` (nét cọ thon), `curve()`, `p2Defs()` (gradient `url(#p2-rock|p2-shade|p2-halo|p2-mist)`), `onSize(el, fn)` (ResizeObserver + fonts), `onDigit(fn)`, `stableHeight(ctx, [insight])`, `copyText(text, el)`.

## Cọ vẽ đêm (`paint.ts`)
Tranh mực dưới trăng cho mọi scene Phần 2: SVG tĩnh, màu là token (`--wash` mực loang, `--mist`/`--mist-a` sương, `--moon`, `--lantern`, `--water`), mép mực nhờ filter `#ink-rough` / `#ink-wash` / `#ink-dry` (nhẹ đi ở `quality=low`). Dựng một lần mỗi layout; muốn chuyển động thì animate `<g>` cha, không animate phần tử có filter.
- `hills(x0, x1, base, h, seed, depth, peaks)` — một lớp núi mực: `depth` 0 gần (sống núi nét cọ, nét rỗ, viền trăng), 1 xa (chỉ một lớp loang). Chân núi tan vào sương.
- `mist(cx, cy, rx, ry)` — dải sương mềm. Ban đêm đặt **sau** lớp núi để núi nổi lên, và **trước** chân núi để che chân.
- `moon(cx, cy, r, seed, cloud)` — quầng, đĩa, biển mờ, viền mực, sợi mây. Mỗi scene tối đa một vầng trăng.
- `water(x0, y0, x1, y1, seed, moonX?, body?)` — nước lặng, gợn cọ khô dài dần về gần, đường trăng vỡ dưới `moonX`.
- `pine(x, y, h, seed, dir)`, `reeds(x, y, h, seed, n)`, `grass(x, y, w, seed)` — thông, lau, cỏ.
- `toro(x, y, H, lit)` đèn đá; `paperLantern(x, y, r, seed, cord)` đèn lồng giấy; `steppingStones(a, b, n, size, seed)` đá bước.
- `wash(d, opacity)` loang mực theo hình bất kỳ; `brush(pts, w)` một nét cọ; `brushFrame(x, y, w, h, seed)` khung bốn nét cọ; `thread(pts)` dây mảnh.
Giấy: `.player` của Phần 2 đã có hạt giấy + viền loang (part2.css), scene không cần tự vẽ nền giấy. Bề mặt HTML giả đá/giấy: xem nền nhiễu data-URI của `.p2n-front` / `.p2s-stone`.

## 8. Vườn 3D mực tàu · `stage3d.ts` (WebGL, một `createStage`)
Tranh thuỷ mặc có khối thật: chất liệu mực loang (ba lớp loang, ranh sáng–tối lượn như nét cọ, nét khô trong bóng, rêu mọc mặt trên, viền trăng, hắt ấm từ đèn, hạt giấy, sương xa theo độ sâu), viền mực inverted hull (đậm hơn ở phía tối, đứt theo nhiễu). Màu là token Phần 2, đổi theme không dựng lại. Dựng trong `sliced()` (khung sườn → stage riêng một lát → shader biên dịch bất đồng bộ một lần), **không có vòng frame khi đứng yên** (chỉ chạy khi kéo/quán tính/hover/bay/hoạt cảnh, cộng chuyển động sống ở `quality=high` tới khi hết `idle`), dọn hết khi rời scene.
```ts
import { inkStage } from '../../ui/part2/stage3d'
mount(ctx) {
  ctx.prompt(S.garden.prompt)
  inkStage(ctx, ctx.art, { label: S.garden.aria, hint: S.garden.hint, gyro: true }, function* (k) {
    k.backdrop()                                   // trăng + quầng, 3 dải núi loang, sương trôi
    yield                                          // yield giữa các phần nặng
    k.ground({ r: 7.5 }); k.pond({ at: [1.9, -1.1], r: [2, 1.2] })
    yield
    const rock = k.rock({ at: [-2, 0.4], w: 1.7, h: 1.05, seed: 3, moss: 0.75 })
    k.tappable(rock, S.garden.rock, () => ctx.insight(S.garden.insight))   // chuột: raycast; bàn phím: nút ẩn theo vật
    k.toro({ at: [0.4, -2.5], h: 1.6 }); k.stones([-0.2, 4.3], [0.9, 0.7], 5)
    k.pine({ at: [3.7, -2.3], h: 3.2, lean: -1 }); k.bamboo({ at: [-3.9, -2.7] })
  })            // → { ready: Promise<InkKit | null>, dispose } — tự dọn qua ctx.onCleanup
}
// opts: { label, hint?, view?: { yaw, pitch, yawRange, pitchRange, fit: [nửa rộng, nửa cao], target, shift, home?, zoomRange? }, fov?, gyro?, sway?, dpr?, idle?, fallback? }
```
**Tuỳ chọn mới (art direction §5.2)**
- `dpr: [high, low]` — trần devicePixelRatio theo quality (vd `[1.5, 1]` cho t19 nhiều lớp mây). Mặc định của createStage: 2 / 1.25.
- `idle` (giây, mặc định 10) — chuyển động sống (đung đưa camera, sương trôi, gợn nước, `uTime`) chạy ở `quality=high` tới khi đủ `idle` giây không có input (chuột rê, kéo, phím, bánh xe), rồi vòng frame **dừng hẳn**; input bật lại. `idle: 0` = không có chuyển động sống; `Infinity` = không bao giờ dừng (chỉ khi có lý do).
- `view.home: true` — buông tay sau khi kéo thì camera trôi về góc mặc định (hoặc góc `k.fly` vừa bay tới). Phím mũi tên không bị kéo về.
- `view.zoomRange: [gần, xa]` — giới hạn dolly theo phần của khoảng cách vừa khung (mặc định `[0.65, 1.35]`).
- Lại gần / ra xa: `+`/`−`, **bánh xe chuột** (cả chụm trackpad), **chụm hai ngón** trên cảm ứng (chụm thì không xoay), `k.dolly(z)`.

**Kit mới**
```ts
const lamp = k.toro({ at: [1, -2], tint: '--vermilion', lit: 0 })   // tint: token / màu CSS / ['--water', '--mist', 0.5]; lit: true | false | 0…1
lamp.lamp!.set(1)                                  // thắp: ô cửa, quầng và ánh ấm lên đá/cát/nước — chỉ đổi uniform, không biên dịch lại
const shoji = k.lamp([0, 1.2, -3], { tint: '--lantern', k: 0.8, halo: 2 })   // nguồn ấm tự đặt (shōji, đèn dựng bằng k.mesh); halo: 0 = không quầng
k.label(obj, h('p', null, S.name), [0, 0.2, 0])    // nhãn DOM nằm trên đỉnh hộp bao của obj (+ offset, đơn vị mét-vườn); el.remove() để bỏ
await k.fly([x, 1, z], yaw, pitch, 1.2)            // camera bay (power2.inOut) tới nhìn target; reduced = cắt thẳng; kéo tay thì huỷ bay; null = giữ target
k.dolly(0.8)                                       // lại gần (< 1) / ra xa (> 1)
k.backdrop({ moonRise: 4 })                        // trăng mọc từ sau núi trong 4 s (chỉ high; low / reduced: đã mọc sẵn); viền trăng trên vật trượt theo
k.animate((dt) => { … ; return stillRunning })     // hoạt cảnh có thời hạn trong vòng frame của stage (không tự tạo createLoop); reduced: chạy một lèo tới cuối
k.onFrame((t, dt) => …)                            // mỗi frame stage vẽ, trước khi vẽ (không cấp phát, không đọc layout); k.live = chuyển động sống đang bật
const mat = new THREE.ShaderMaterial({ defines: { OCT: k.low ? 2 : 4 }, uniforms: { ...k.uniforms, … }, fragmentShader: `${inkGlsl.noise}${inkGlsl.haze}…` })
// k.uniforms: uTime, uKey, uMoonDir, uMoonC, uInk, uFogC, uFog, uMist, uLampC (dùng chung, đổi theme tự cập nhật); import { inkGlsl } from stage3d
```
- **Đèn:** tối đa **4** nguồn ấm (`k.toro` thắp + `k.lamp`) chiếu lên xung quanh, theo thứ tự tạo; nguồn thứ 5 trở đi chỉ có ô cửa + quầng. Không thêm `THREE.Light` (cấm, xem art direction §5.1).
- **Nhãn:** toạ độ chỉ tính lại khi camera đổi hoặc sau `k.render()`: dời vật bằng tay thì gọi `k.render()`. Nhãn ẩn khi vật ở sau camera, mờ dần trong sương xa (theo `uFog`). Kiểu mặc định `.p2s3-label`: serif 15px, `--ink`, quầng giấy; trạm tự đổi bằng CSS.
- **Nước (`k.pond`):** nửa xa phản chiếu (Fresnel vẽ đậm hơn tự nhiên), nửa gần nhìn xuống lòng nước (cát ở chỗ nông, mực ở chỗ sâu); mọi vật `cast` (đá, đèn, thông, tre…) in bóng tối xuống nước theo hướng nhìn; đường trăng vỡ và vệt đèn (màu từng đèn) là chỗ sáng nhất; bờ mềm: nước nông trong, viền ướt, dải cát ẩm. Đặt hồ **trước** vật muốn soi bóng (vật đứng ở bờ xa).
- **Thông (`k.pine`):** tán là nhiều lớp búi (đỉnh vòm + vòng búi rủ), mép tua kim, bụng phẳng tối, nét kim khô, viền trăng; ~9k tam giác ở high (~4k ở low) mỗi cây, chưa tính viền. `k.ink(tone, { ao: true })` dùng được cho hình tự dựng có attribute `color` (kênh r = độ che sáng).
- Dựng hình: hình cầu hàn sẵn được dựng **một lần mỗi module** và clone (đá, búi thông), nên dựng nhiều đá/thông không tạo long task.
- Đơn vị: mét-vườn, mặt đất y = 0, camera mặc định nhìn về −z. Mọi builder tự thêm vào `k.root`, nhận `at: [x, z]`; đặt xong trước khi `build` kết thúc (bóng đổ, vòng cào, đèn được tính lúc đó).
- Builder: `rock` (đá đẽo, rêu, vòng cào quanh chân) · `stones(from, to, n)` (đá bước lùi xa) · `toro` (đèn đá Kasuga, cửa sổ sáng, quầng + ánh ấm lên đá/cát/nước) · `pine` · `bamboo` · `ground` (cát cào thẳng uốn thành vòng quanh đá, nhận bóng mềm, tan vào sương ở mép) · `pond` (nước tĩnh, đường trăng vỡ, vệt đèn) · `backdrop` · `glow(at, size, 'lantern'|'moon')`.
- Tự dựng: `k.mesh(geo, k.ink('rock' | 'step' | 'moss' | 'pine' | 'bark' | 'bamboo', { moss, rim, edge, double }), { outline, cast, at, parent })`.
- Tương tác: kéo xoay có quán tính và giới hạn, ← → ↑ ↓ xoay, `+`/`−` lại gần (khi khung 3D được focus), con quay (`gyro`), `k.turn(yaw, pitch)`, `k.pick(x, y)`. Vật `tappable` sáng ấm khi rê/focus; nút proxy `pointer-events: none` nằm đúng chỗ vật để Tab/Enter và trình đọc màn hình dùng được.
- Không WebGL: `ready` → `null`, tự vẽ `nightGarden()` của `depth.ts` (hoặc `opts.fallback(host)`). Reduced motion: dựng một lượt, xoay/phím nhảy thẳng tới chỗ, không quán tính, không đung đưa. `quality=low`: noise 2 octave, ít sương, không đung đưa (chỉ vẽ khi có tương tác).
- Chữ (label, hint, tên vật) do trạm truyền vào từ JSON. Mỗi trạm chỉ một `inkStage` sống một lúc.

## 9. Diorama giấy 2.5D · `depth.ts` (không WebGL)
Các lớp tranh SVG (paint.ts) đặt ở độ sâu thật bằng CSS 3D: nền cát cào nằm trong phối cảnh thật (đá bước nhỏ dần về sương, có mặt trên, sườn, viền trăng, bóng đổ), vật cắt giấy đứng trên nền (to/nhỏ theo khoảng cách, bóng mềm đổ về phải–xa, vòng cào quanh chân), lớp xa nhạt + mềm hơn (blur nhẹ chỉ ở `high`). Thị sai theo chuột / kéo cảm ứng / nghiêng máy / `set()`. Chỉ transform (compositor), một `createLoop` chạy khi đang lắng; reduced motion = tĩnh. Màu là token, đổi theme không cần JS.
```ts
import { diorama, nightGarden } from '../../ui/part2/depth'
diorama(ctx, ctx.art, { ...nightGarden(), label: S.scene.aria, gyro: true })      // vườn đêm dựng sẵn
diorama(ctx, ctx.art, {
  layers: [                                   // phông sau nền: depth 0 (mép xa của nền) … 1 (trời)
    { depth: 1, art: (g) => moon(g.w * 0.7, g.h * 0.15, 30) },
    { depth: 0.6, art: (g) => hills(-g.w * 0.2, g.w * 1.2, g.horizon, g.h * 0.3, 21, 0.8, 4) },   // g = { w, h, horizon, seed }
  ],
  floor: { stones: 6, art: (f) => [...] },    // f = { w, d, seed, at(x, z) → điểm trên nền (nhìn từ trên) }; floor: false = không nền
  props: [{ x: 0.76, z: 0.3, w: 0.11, h: 0.26, art: (w, h) => toro(0, 0, h) }],   // x 0…1 ngang, z 0 gần … 1 xa; w, h = phần của chiều cao khung
})              // → { el, props: HTMLElement[] (gắn nút/listener vào đây), set(x, y), dispose } — tự dọn qua ctx.onCleanup
```
- `label` biến diorama thành `role="img"`; bỏ `label` khi prop chứa nút bấm.
- Vẽ lần đầu thấm dần (`sliced`), đổi kích thước thì vẽ một lượt. Art của prop vẽ đứng trên y = 0, giữa x = 0 (cùng quy ước `stoneArt`, `toro`, `pine`).

Thử cả hai: `#/tram/99/6` (3D: trăng mọc, chạm vật → camera bay tới + nhãn, kéo rồi buông → trôi về, bánh xe/chụm để lại gần) và `#/tram/99/7` (2.5D). Hook của component: `#/tram/99/8` (track zig-zag + thumb + onStep), `/9` (stage + place + stone + onHear), `/10` (slots + pile + piece + onPlace).
