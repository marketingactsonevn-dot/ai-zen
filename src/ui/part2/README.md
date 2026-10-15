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
// opts: { label, prompt?, question?, detail? }  — prompt mặc định "Nghe từng hòn đá"
```

## 2. `progressTide(data: Tide, opts)` → `SceneDef` · `tide.ts`
Cuộn cát dài; kéo trăng trái → phải (chuột, chạm, ← → Home End khi trăng được focus — trăng là `role="slider"`). Mốc nổi lên như đá; thẻ đọc hiện ngày · nhãn · fact, `compare` thành 2 thanh mực dài–ngắn (`ratio = after / before`; thiếu `ratio` thì chỉ hiện 2 con số). Điểm cuối luôn là "Hôm nay · `horizon.asOf`", rồi `horizon` mờ trong sương (kind `prediction`/`opinion`).
```ts
import { progressTide } from '../../ui/part2/tide'
scenes: [progressTide(C.scenes.tide.tide, { label: S.tide.label, question: S.tide.question, insight: S.tide.insight })]
// opts: { label, prompt?, question?, insight?, detail? } — insight hiện khi trăng tới "Hôm nay"
// milestones: { date: '2025-03', label, fact, compare?: { before, after, ratio?, beforeLabel?, afterLabel? } }
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
// opts: { label, prompt?, question?, insight?, detail?, card?: Takeaway }
// data: { steps: [{ label, detail, why }], takeaway?: 'id-in-toolkit.json' }  — label ngắn (≤ 5 từ), tối đa 9 bước
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
