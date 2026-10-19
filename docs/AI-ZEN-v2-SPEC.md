# AI Zen v2 — Spec: Tối ưu mượt + Phần 2 "Vườn Trăng" (bản mở rộng)

> Spec cho Claude Code implement trên repo `ai-zen` (Vite + TS + Three.js + Matter.js + GSAP, không backend).
> Bản 2, viết ngày 15/10/2026. **Thay thế hoàn toàn bản 14/10** (bản cũ 12 trạm / 4 vườn). Dựa trên code thật ở commit `f2f3836`.
>
> Quyết định đã chốt với chủ dự án:
> - Phần 2 **sâu nhưng vẫn dễ hiểu**: ẩn dụ + tương tác, không công thức.
> - Phần 2 **rộng và thực dụng**: tin mới nhất có nguồn, hệ sinh thái mở, AI chạy trên máy mình, nền tảng sáng tạo, skills/workflow, tự code một game bằng AI.
> - **7 vườn / 21 trạm** (mở rộng từ 4 vườn / 12 trạm).
> - **Mở tự do**, chỉ gợi ý nên đi Phần 1 trước.
> - **Cả VI + EN** như Phần 1.
> - Phần 2 nằm **chung app**, giữ concept Zen và sự sáng tạo hiện tại.

Thứ tự làm bắt buộc: **A. Tối ưu (làm trước)** → **B. Khung Phần 2** → **C. Nội dung + trạm, làm theo 3 đợt** → **D. EN + QA + deploy** → **E. Bảo trì tin tức hằng tháng**.

---

## 0. Nguyên tắc chung (không được phá)

1. **Không đổi cảm giác Phần 1** trên máy mạnh. Mọi thay đổi hình ảnh chỉ áp dụng ở chế độ nhẹ hoặc khi máy yếu.
2. Giữ khế ước trạm hiện có: `StationModule { content, scenes }`. Mỗi scene đi theo nhịp **ảnh → tương tác → insight**, frame tự thêm quiz + ensō tóm tắt.
3. Mọi dữ kiện vẫn là `Fact { text, asOf, source, kind }`. Phần 2 bắt buộc dùng `kind` (`fact | opinion | prediction | illustration`), vì có nhiều chủ đề tranh luận và nhiều **tuyên bố của chính công ty** (vendor claim).
4. Không thêm backend, không API key, không thêm framework UI.
5. `localStorage` vẫn đi qua `core/store.ts` (có try/catch). Không đổi key cũ, để người dùng cũ không mất tiến độ.
6. Accessibility giữ nguyên chuẩn hiện tại: aria, phím ← →, reduced motion.
7. **Không quảng cáo.** Nhắc tên công ty/nền tảng để giáo dục: trung lập, không affiliate, không xếp hạng "tốt nhất". Logo dùng đúng quy trình `public/logos/logos.json` hiện có (ghi nguồn).

---

## A. Tối ưu tốc độ & độ mượt

### A.0 Chẩn đoán (đã đọc code): vì sao "lâu lâu hơi lag"

Lag kiểu "thỉnh thoảng" thường đến từ **khoảnh khắc chuyển tiếp**, không phải lúc đứng yên. Các điểm nghi vấn, xếp theo khả năng gây giật:

| # | Vấn đề | Ở đâu | Vì sao giật |
|---|---|---|---|
| 1 | Chuyển scene animate `filter: blur(6–8px)` trên **cả scene toàn màn hình**, cũ và mới chạy **cùng lúc** | `ui/station.ts` hàm `go()`; `chapter()` cũng blur 10px | Blur cả viewport mỗi frame rất nặng với GPU điện thoại, nhất là khi bên trong có SVG filter hoặc WebGL |
| 2 | Scene cũ chưa dọn xong (0.55s) thì scene mới đã mount, nên **2 WebGL context + 2 vòng rAF** chạy chồng | `go()` dọn `oldCleanup` trong `onComplete` | Tạo WebGL context + compile shader trên mobile tốn 100–400ms, khựng đúng lúc chuyển |
| 3 | SVG filter `feTurbulence + feDisplacementMap` (~760 chỗ dùng `url(#…)`), có cái `numOctaves: 3` | `ui/ink.ts` + nhiều trạm tự định nghĩa filter | Phần tử có filter mà bị GSAP animate thì trình duyệt rasterize lại filter mỗi frame |
| 4 | `backdrop-filter: blur()` ở 34 chỗ | `styles/ui.css` + css trạm | Rất tốn trên Safari iOS / Android tầm trung |
| 5 | Map: ResizeObserver → `layout()` → `drawSand()` vẽ lại toàn bộ cát (marching squares) | `ui/map.ts` | Trên điện thoại, thanh địa chỉ ẩn/hiện làm đổi chiều cao, nên cát bị vẽ lại nhiều lần khi cuộn/chạm |
| 6 | `cssVar()` (= `getComputedStyle`) gọi trong vòng frame | `ui/map.ts` `tick()`, `intro.frame()`; ~86 chỗ toàn repo | Ép trình duyệt tính lại style giữa frame |
| 7 | Chunk `three-stage` ~562 KB chỉ tải khi vào trạm 3D đầu tiên | build `dist/assets` | Lần đầu vào trạm 3D phải tải + parse, khựng 0.5–2s trên 4G/máy yếu |
| 8 | Nghi rò rỉ tích luỹ (listener, rAF, gsap tween chưa revert, Matter engine) | toàn bộ trạm | Lag tăng dần theo thời gian dùng, đúng với mô tả "lâu lâu" |

> Claude Code phải **đo trước khi sửa** (A.1) để xác nhận hoặc loại trừ từng dòng trên. Không sửa mò.

### A.1 Đo baseline (bắt buộc, làm đầu tiên)

1. Thêm **Perf HUD, chỉ bật khi URL có `?perf=1`** (cả bản build, vì cần đo trên điện thoại thật):
   - FPS trung bình 1s, frame dài nhất trong 5s gần nhất.
   - Số long task > 50ms (dùng `PerformanceObserver('longtask')` nếu trình duyệt có).
   - Số WebGL context đang sống (đếm qua wrapper trong `createStage`).
   - Số vòng rAF đang chạy (đếm qua helper loop chung ở A.3).
   - `performance.memory.usedJSHeapSize` nếu trình duyệt hỗ trợ.
   - Đặt góc dưới trái, chữ nhỏ, `pointer-events: none`, không ảnh hưởng layout.
2. Kịch bản đo (ghi kết quả vào `docs/perf-baseline.md`):
   - Chrome DevTools, giả lập Moto G Power / iPhone 12, **CPU 4× slowdown**, mạng "Fast 4G".
   - (a) Mở home → map; (b) vào trạm 1, lật hết scene; (c) đi tuần tự trạm 1 → 18; (d) vào trạm 3D lần đầu (t09, t13…); (e) map ← → trạm, 10 lần.
   - Ghi: FPS lúc chuyển scene, frame dài nhất, long task, heap sau bước (c), số WebGL context lúc chuyển.
3. Nếu được, test thật trên 1 iPhone + 1 Android tầm trung qua bản deploy có `?perf=1`.

### A.2 Chuyển scene & chapter card (ưu tiên 1)

- Tạo **2 kiểu chuyển** trong `ui/station.ts`:
  - `rich` (máy mạnh: `quality=high` và không phải `pointer: coarse`): giữ nguyên cảm giác hiện tại, giảm blur xuống ≤ 3px, chỉ animate blur trên scene **mới**. Scene cũ chỉ fade opacity.
  - `calm` (mặc định cho điện thoại / `quality=low`): **chỉ `opacity` + `transform`**, 0.35–0.45s, không filter. Vẫn phải đẹp, thiền: như mực loang dần, không phải cắt cứng.
- **Không bao giờ để 2 scene nặng cùng sống.** Thứ tự mới: `fade-out cũ → cleanup cũ → mount mới → fade-in mới`. Ở `calm`, overlap tối đa 120ms và scene mới chỉ mount **sau** khi cleanup cũ chạy.
  - Giữ đúng comment hiện có trong code: phải revert gsap context **ngoài** render loop của gsap (giữ `setTimeout`). Không phá fix đó.
- Chapter card: ở `calm` bỏ `filter: blur`, dùng opacity + translateY nhỏ.
- Bấm ← → liên tục (spam) không được tạo hàng đợi scene: chỉ scene đích cuối cùng được mount.

### A.3 Vòng lặp animation dùng chung

- Tạo `src/core/loop.ts` với `createLoop(host, fn)`: tự pause khi host ngoài màn hình (IntersectionObserver), khi tab ẩn (`visibilitychange`), và khi reduced motion. Trả về `{ start, stop, wake, dispose }`. `three-stage.ts` dùng lại logic này.
- Chuyển các vòng `requestAnimationFrame` tự viết sang `createLoop` (khoảng 35 file: t01 nextword, t02 bonsai, t03 scroll/vignettes, t04 pit, t06 life/ink, t08 kit, t18 think, map, glossary, exam…). Mục tiêu: **mọi vòng frame đều tự dừng khi không nhìn thấy và đều bị dọn khi unmount**.
- Trong callback frame **cấm**: `getComputedStyle`/`cssVar`, `getBoundingClientRect`, tạo mảng/object mới mỗi frame. Đọc màu 1 lần lúc mount và khi `onPrefs` đổi theme; đọc kích thước trong ResizeObserver.

### A.4 SVG ink filter (ưu tiên 2)

- `ui/ink.ts`: tạo **bản nhẹ** của 3 filter dùng chung cho `quality=low`: `numOctaves` = 1, bỏ `feGaussianBlur` trong `ink-wash`, thu vùng filter sát hơn. Đổi bằng cách render lại `inkDefs()` khi quality đổi; giữ nguyên id để không phải sửa chỗ dùng.
- Quét các filter tự định nghĩa trong trạm (t03, t12, t15, t17…), áp cùng quy tắc ở `low`.
- Quy tắc mới, ghi vào README mục "Quy ước hiệu năng": **không animate trực tiếp phần tử có SVG filter**. Animate `<g>` cha (transform/opacity) còn filter đặt ở phần tử con tĩnh; hoặc chỉ animate `stroke-dashoffset` của **mask** như ensō đang làm.
- Không làm mất chất mực: chụp so sánh trước/sau ở `low` cho 5 trạm nhiều mực nhất; chênh lệch phải khó thấy bằng mắt thường.

### A.5 backdrop-filter, blur tĩnh, will-change

- Ở `:root[data-quality='low']`: thay mọi `backdrop-filter` bằng nền bán trong suốt đặc hơn (token màu giấy hiện có, alpha ~0.86).
- `filter: blur()` tĩnh trên phần tử lớn (ví dụ blur 20px ở dòng ~716 `ui.css`): ở `low` thay bằng gradient mềm.
- `will-change`: gỡ các khai báo cố định trong CSS, trừ khi đo thấy có lợi.

### A.6 Map vườn

- Chỉ chạy lại `layout()`/`drawSand()` khi **chiều rộng đổi** hoặc chiều cao đổi > 15%. Thanh địa chỉ mobile ẩn/hiện không được làm vẽ lại cát.
- Debounce 150ms cho resize thật (ví dụ xoay máy).
- Cache màu `--rake`, `--rake-hi`, `--ink`, `--vermilion` khi mount và khi đổi theme.
- Nếu đo thấy vẽ cát > 50ms (ở 4× slowdown): chia nhỏ qua `requestIdleCallback` (fallback `setTimeout`); trong lúc chờ, hiện nền cát đơn giản trước.

### A.7 Tải trước thông minh

- Sau khi map hiển thị xong và trình duyệt rảnh (`requestIdleCallback`, timeout 4s): prefetch chunk trạm **nên đi tiếp** và chunk `three-stage`. Không prefetch three khi `saveData` hoặc mạng 2g/3g.
- Ở scene tóm tắt (ensō) của trạm N: prefetch trạm N+1.
- Chạm lần 1 vào hòn đá trên map (lúc hiện tooltip): prefetch trạm đó.
- Trạm WebGL: gọi `renderer.compile(scene, camera)` trước frame đầu.

### A.8 Tự hạ chất lượng khi máy hụt hơi

- Trong 4s đầu mỗi scene, nếu FPS trung bình < 40 hoặc có ≥ 3 frame > 50ms: đặt cờ `autoLow` cho phiên (sessionStorage, try/catch), áp dụng **từ scene kế tiếp**.
  - Lưu ý: hiện `setQuality` gọi `route()`, làm mount lại scene. Phải tách: auto-low chỉ đổi `data-quality` và giá trị quality cho scene sau, không re-mount scene hiện tại.
- Hiện toast nhỏ 1 lần: "Đã chuyển sang chế độ nhẹ cho mượt hơn" + nút "Giữ chế độ đẹp". Lựa chọn của người dùng thắng chế độ tự động.

### A.9 Rò rỉ bộ nhớ

- Script Playwright: đi tuần tự mọi trạm × lật hết scene × quay lại map. Sau mỗi 6 trạm ghi heap, số WebGL context, số rAF loop (đọc qua `window.__aizen.perf`).
- Sửa đến khi đạt:
  - heap cuối ≤ heap sau trạm 1 + 25%;
  - WebGL context sống ≤ 1 lúc đứng yên;
  - số rAF loop sống = số loop của scene hiện tại.
- Matter.js (t04): `Engine.clear`, `World.clear`, gỡ `Runner`, bật `enableSleeping`; ở `low` giới hạn số body.

### A.10 Tiêu chí nghiệm thu (áp cho cả Phần 1 và mọi trạm Phần 2)

- Chuyển scene: ở `calm` không frame nào > 50ms; ở `rich` trên desktop không tệ hơn baseline.
- Map đứng yên + chạm cát: FPS trung vị ≥ 55.
- Vào trạm đã prefetch: từ lúc bấm đến khi scene đầu hiện < 300ms; trạm 3D đầu tiên (đã prefetch) không có long task > 200ms.
- Đi hết các trạm: đạt các mục A.9.
- Ảnh trước/sau ở `high`: Phần 1 trông như cũ.
- `npm run build` + `tsc --noEmit` sạch, cả VI và EN.

---

## B. Khung Phần 2 trong cùng app

### B.1 Ý tưởng nghệ thuật: "Vườn Trăng"

- Phần 1 = **vườn ban ngày** (hiểu để dùng). Phần 2 = **cùng khu vườn lúc trăng lên** (hiểu sâu, thấy rộng, làm được). Người xem đi qua một **cây cầu cong (taiko-bashi)** ở cuối lối đá Phần 1 để sang.
- Ngôn ngữ thị giác giữ nguyên: mực tàu, giấy, ensō, con dấu đỏ, cát cào. Thêm 3 chất liệu mới:
  1. **Ánh trăng** phản chiếu trên mặt nước giữa vườn: motif "nhìn vào bên trong".
  2. **Đèn đá (tōrō)** soi từng vườn.
  3. **Đom đóm** thưa thớt (tắt hẳn ở `low` và reduced motion).
- Màu: khi ở map/trạm Phần 2, gắn `data-part="2"` trên `<html>` và ghi đè token:
  - Theme tối: nền chàm-mực, cát bạc ánh trăng, mực trắng ngà, giữ vermilion cho con dấu, thêm `--moon` (vàng ngà nhạt).
  - Theme sáng: "bình minh sương lam": giấy xanh lam xám, mực chàm.
  - Chữ đạt WCAG AA ở cả 2 theme.
- Hành trình 7 vườn kể một câu chuyện liền mạch, mỗi vườn là một "giờ" của đêm trăng:

| Vườn | Tên | Động từ | Giờ trăng | Câu hỏi của người học |
|---|---|---|---|---|
| 7 | Đỉnh núi tin tức | **Thấy** | trăng mọc | AI vừa làm được gì? |
| 8 | Mở nắp hộp đen | **Hiểu** | trăng lên cao | Bên trong nó chạy thế nào? |
| 9 | Mặt hồ lặng | **Cảm** | trăng in mặt hồ | Nó có cảm xúc không, ta đối xử với nó ra sao? |
| 10 | Mạch ngầm dưới vườn | **Nhìn nền móng** | rễ cây dưới trăng | Ai trả tiền, chip/RAM/điện ở đâu ra? |
| 11 | Vườn mở | **Mở hộp đồ nghề** | cổng vườn hé mở | Tải model ở đâu, chạy AI trên máy mình thế nào? |
| 12 | Xưởng dưới trăng | **Làm** | đèn xưởng sáng | Dùng nền tảng, skills, workflow, tự code game ra sao? |
| 13 | Ngã rẽ dưới trăng | **Nhìn xa & chọn lối** | trăng lặn, bình minh | Tương lai đi đâu, còn mình bắt đầu từ đâu? |

- Hiệu năng: map Phần 2 dùng lại engine cát đã tối ưu (A.6) + 1 lớp nước/trăng bằng Canvas 2D hoặc SVG. **Không dùng WebGL cho map.**

### B.2 Dữ liệu

- `content/gardens.json` (+ `.en.json`): thêm mảng `parts`:
  ```json
  "parts": [
    { "id": 1, "name": "Phần 1 · Vườn Ngày", "tagline": "Hiểu AI để dùng AI đúng cách", "route": "#/vuon" },
    { "id": 2, "name": "Phần 2 · Vườn Trăng", "tagline": "Hiểu sâu bên trong, thấy rộng bên ngoài, tự tay làm được", "route": "#/vuon-trang" }
  ]
  ```
  Mỗi garden thêm `"part": 1 | 2`. Thêm vườn id 7–13, trạm id **19–39** (id nội bộ chạy tiếp để không đụng progress cũ).
- `StationMeta` thêm 2 trường không bắt buộc:
  - `prereq?: number[]`: trạm nên đọc trước (hiện trong tooltip map).
  - `kind?: 'concept' | 'news' | 'practice'`: loại trạm (map vẽ dấu nhỏ khác nhau: ● hiểu, ✦ tin mới, ⚒ thực hành).
- `core/content.ts`: thêm `PARTS`, `stationsOfPart(p)`, `gardensOfPart(p)`, `partOfStation(id)`, `displayNo(id)`. **`ALL_STATIONS` vẫn là danh sách phẳng 39 trạm**, nhưng mọi chỗ đang dùng `ALL_STATIONS.length` làm "tổng" phải chuyển sang tổng **theo phần** (xem B.6).
- Số hiển thị: Phần 1 giữ `01–18`. Phần 2 hiển thị `II·01 … II·21` (helper `displayNo(id)`), dùng ở crumb, hòn đá map, chapter card, aria-label.
- `site.json` + `site.en.json`: thêm nhãn mới, đặt tên nhất quán với labels hiện có. Gồm: `part`, `partOne`, `partTwo`, `toPartTwo`, `toPartOne`, `bridgeHint`, `partTwoAdvice*`, `autoLowToast`, `keepRich`, `perspectives`, `whoSays`, `progressTide`, `newsAsOf`, `vendorClaim`, `independent`, `copy`, `copied`, `toolkit`, `tryIt`, `kindConcept`, `kindNews`, `kindPractice`…
- File nội dung mới:
  - `content/news.json` (+ `.en.json`): **bảng tin** dùng chung cho các trạm tin tức (E. Bảo trì). Mỗi mục: `{ id, date, title, what, why, kind, source, verifiedBy?, tags }`.
  - `content/toolkit.json` (+ `.en.json`): toàn bộ **thẻ mang về** của Phần 2 (prompt mẫu, checklist, bảng chọn công cụ) (B.7.5).

### B.3 Route

| Route | Nội dung |
|---|---|
| `#/` | Intro (giữ nguyên) → map Phần 1 |
| `#/vuon` | Map Phần 1 (giữ nguyên) |
| `#/vuon-trang` | **Map Phần 2** |
| `#/tram/19…39` | Trạm Phần 2 (player dùng chung) |
| `#/tu-dien` | Từ điển chung, có bộ lọc theo Phần |
| `#/bai-thi` | Bài thi Phần 1 (giữ nguyên) |
| `#/bai-thi-trang` | **Bài thi Phần 2** |
| `#/do-nghe` | **Túi đồ nghề**: mọi thẻ mang về của Phần 2, lọc theo vườn/chủ đề, có nút sao chép |

- Crumb/"về bản đồ" trong trạm Phần 2 phải về `#/vuon-trang`.
- Trạm 18 (cuối Phần 1): scene tóm tắt thêm nút "Sang Vườn Trăng". Trạm 39: nút "Bài thi Vườn Trăng" + "Mở Túi đồ nghề".

### B.4 Map Phần 2 & cây cầu

- Tổng quát hoá `renderMap(root, withIntro)` thành `renderMap(root, { part, withIntro })`. Anchors `LAND/PORT` hiện là 6 điểm cố định → tạo bộ anchors riêng cho **7 vườn** Phần 2 (landscape + portrait). 21 hòn đá phải vẫn thoáng trên điện thoại dọc 375px.
- Map Phần 1: ở cuối lối đá vẽ **cây cầu** dẫn ra mép màn hình (link `#/vuon-trang`, label "Vườn Trăng →"). Map Phần 2: đầu lối có cầu quay về Phần 1.
- Lối vào phụ trên map Phần 2: Từ điển · Bài thi Vườn Trăng · **Túi đồ nghề**.
- Topbar: công tắc nhỏ **`I · II`** cạnh bộ đếm; bộ đếm theo phần đang xem (`7/18` hoặc `3/21`).
- Chuyển cảnh giữa 2 map: "trăng lên": lớp chàm loang từ trên xuống 0.9s (opacity/transform; ở `calm` crossfade 0.4s).

### B.5 Gợi ý (không khoá)

- Lần đầu vào route Phần 2 mà người xem đã thăm < 12/18 trạm Phần 1: hiện thẻ nhẹ: "Vườn Trăng đi sâu và rộng hơn. Nếu mới bắt đầu, Vườn Ngày sẽ giúp bạn hiểu nhanh hơn." Nút **"Cứ bước tiếp"** (primary) · "Về Vườn Ngày". Chỉ hiện 1 lần (`progress.markHint('part2-advice')`).
- Tooltip trạm Phần 2 hiện `prereq` ("nên xem trước: 04 Token").

### B.6 Bài thi, chứng nhận, từ điển

- `extras/exam.ts` hiện import cứng `exam.json`, vẽ cứng **18** hòn đá trên chứng nhận, và so "đi hết" với `ALL_STATIONS.length` → **sẽ sai khi app có 39 trạm**. Phải tham số hoá `render(main, { part })`:
  - nguồn câu hỏi: `exam.json` / `exam-2.json`;
  - số đá = số trạm của phần;
  - visited đếm theo phần.
- Chứng nhận Phần 2: cùng khung giấy + ensō, trăng thay mặt trời, con dấu khác, tiêu đề "Vườn Trăng". Lưu kết quả key riêng (`exam2`), không ghi đè Phần 1.
- Bài thi Phần 2: **12 câu**, phủ 7 vườn, gồm:
  - ≥ 2 câu "đây là sự thật, quan điểm, dự đoán hay tuyên bố của công ty?";
  - ≥ 2 câu thực hành (chọn công cụ đúng việc, đọc model card).
- Từ điển: thêm ~50 thuật ngữ Phần 2, mỗi từ có `part` + `station`; thêm bộ lọc "Tất cả · Phần 1 · Phần 2".

### B.7 Thành phần dùng chung mới cho Phần 2

Đặt trong `src/ui/part2/`. Mỗi cái là hàm trả về `SceneDef`, hoặc helper dùng trong scene.

1. **Vòng đá góc nhìn (`perspectiveCircle`)**: đáp ứng "nhiều góc nhìn".
   - Hình: 3–5 hòn đá quanh mặt nước trăng. Chạm một hòn → đá sáng, hiện *Ai nói* + lập luận 1–2 câu + nhãn `kind` + nguồn. Chạm hết thì mặt nước lặng và hiện insight chung "đồng ý ở…, khác nhau ở…".
   - Dữ liệu: `{ stones: [{ who, view: Fact }], common: Fact }`.
   - Không góc nhìn nào chiếm ưu thế hình ảnh; thứ tự đá xáo trộn ổn định theo seed.
2. **Thuỷ triều tiến triển (`progressTide`)**: đáp ứng "nhiều tiến triển".
   - Hình: dải cát dài như cuộn tranh, kéo vầng trăng từ trái sang phải; các mốc nổi lên như đá. Mốc cuối luôn là "Hôm nay (asOf)" + 1 dòng dự đoán mờ trong sương.
   - Dữ liệu: `{ milestones: [{ date, label, fact: Fact, compare?: { before, after } }], horizon: Fact }`.
   - Có `compare` (ví dụ robot chạy 2:40:42 → 50:26) để hiện 2 con số cạnh nhau, thanh dài–ngắn bằng nét mực.
3. **Nhãn độ tin cậy**: render `kind` + `vendorClaim` thành dấu mực nhỏ cạnh câu insight:
   - ● sự thật đã kiểm chứng;
   - ◐ quan điểm;
   - ○ dự đoán;
   - ◇ **công ty tự công bố, chưa có bên độc lập xác nhận**.
   - Có chú giải trong tooltip. Mở rộng `Fact` thêm `claimBy?: string` và `verifiedBy?: string`.
4. **Bảng tin trên đá (`newsStones`)**: dùng cho trạm tin tức.
   - Hình: các tấm bia đá nhỏ dựng dọc lối; mỗi bia là 1 mục trong `news.json` (lọc theo `tags` của trạm).
   - Chạm bia → lật mặt sau: *chuyện gì · vì sao quan trọng · nguồn · ngày · đã ai xác nhận*.
   - Có bộ lọc "chỉ xem đã kiểm chứng". Bia cũ hơn 6 tháng phủ rêu (gợi ý: tin này có thể đã cũ).
5. **Thẻ mang về (`takeaway`)**: thẻ giấy dó có nội dung sao chép được (prompt mẫu, checklist, lệnh terminal), nút **Sao chép** (Clipboard API, có fallback chọn chữ), nhãn `copied`.
   - Mỗi trạm thực hành có ≥ 1 thẻ. Tất cả thẻ gom về `#/do-nghe`.
   - Thẻ có trường `placeholder` (ví dụ `[TÊN SẢN PHẨM]`) tô màu khác để người dùng biết chỗ cần thay.
6. **Lối đá từng bước (`stepPath`)**: dùng cho quy trình/workflow.
   - Hình: mỗi bước là một viên đá trên lối. Người xem đặt đá theo đúng thứ tự (kéo-thả hoặc chạm lần lượt; bàn phím: phím số).
   - Đặt sai thì đá trượt nhẹ về chỗ cũ + gợi ý 1 dòng. Đặt đúng hết thì lối sáng, mở thẻ mang về.
   - Dữ liệu: `{ steps: [{ label, detail, why }], takeaway }`.
7. **Cuộn mã (`codeScroll`)**: hiển thị đoạn code ngắn như cuộn thư pháp. Highlight cú pháp nhẹ (tự viết, không thêm thư viện), nút sao chép, dòng chú thích tiếng Việt bên cạnh từng khối. Dùng ở trạm 36 và 32.

### B.8 Ngân sách hiệu năng cho mỗi trạm Phần 2

- Tối đa **6/21 trạm** được dùng WebGL (`createStage`). Còn lại SVG/Canvas 2D/CSS.
- Mỗi scene tối đa 1 vòng `createLoop`.
- Chunk JS mỗi trạm (minified) ≤ 120 KB, không tính three.
- Chạy được ở `calm` + `low` + reduced motion (có trạng thái tĩnh đẹp).
- Mỗi trạm phải qua kịch bản đo A.1 trước khi coi là xong.

---

## C. Nội dung Phần 2: 7 vườn, 21 trạm

### C.0 Giọng văn & luật nội dung (bắt buộc)

- Người đọc: người không làm kỹ thuật nhưng đã quen dùng AI (marketer, designer, PM, chủ shop, sinh viên). Sâu ở **cơ chế, hệ quả, cách làm**, không ở công thức.
- Mỗi trạm 3–5 scene + quiz + ensō. Mỗi scene: 1 ẩn dụ Zen → 1 hành động của người xem → 1 câu insight ≤ 25 từ (+ `detail` khi cần).
- Mỗi trạm có **ít nhất 1** trong các thành phần: `perspectiveCircle`, `progressTide`, `newsStones`. Trạm thực hành (`kind: practice`) có thêm **ít nhất 1 thẻ mang về**.
- **Ví dụ thực tế là xương sống**: mỗi trạm khái niệm có ≥ 1 ví dụ có thật, có ngày tháng, lấy từ tin/công bố gần nhất có thể.
- Fact phải có `asOf` + `source`. **Tuyên bố của chính công ty** (benchmark tự đo, "giải được X bài") gắn `claimBy`; có bên độc lập xác nhận thì thêm `verifiedBy`. Không trình bày dự đoán hay quảng cáo như sự thật.
- Chủ đề cảm xúc/ý thức: **trung lập, khiêm tốn về điều chưa biết**. Tách rõ 3 tầng: *biểu hiện ra chữ* · *trạng thái chức năng bên trong* · *trải nghiệm chủ quan (chưa ai đo được)*.
- Chủ đề gắn bó cảm xúc với AI: giọng ấm, không phán xét, không đi vào chi tiết khủng hoảng tâm lý.
- Trạm về nền tảng/công cụ: dạy **ở mức quy trình**, không hướng dẫn từng nút bấm (giao diện đổi liên tục). Luôn kèm link tài liệu chính thức, ghi "giá & tính năng thay đổi thường xuyên, kiểm tra trang chính thức".
- Claude Code **phải tự tra cứu và xác minh** từng dữ kiện trước khi đưa vào JSON (web search, mở nguồn gốc), ghi vào `sources`.
  - Dữ kiện bên dưới là định hướng, đã được tra sơ bộ ngày 15/10/2026.
  - Mục gắn **[Unverified]** là chỉ thấy ở nguồn thứ cấp (blog, wiki): bắt buộc kiểm tra lại; không xác minh được thì bỏ hoặc viết định tính.
  - Gặp tin mới hơn liên quan thì được thay vào, ghi chú trong `docs/part2-content-notes.md`.

---

### Vườn 7 · Đỉnh núi tin tức — **Thấy** ("AI vừa làm được gì?")
*Tagline:* Những cột mốc có thật của năm 2026, và cách đọc tin AI không bị cuốn theo. *Motif:* đỉnh núi đá, trăng mọc sau núi, bia đá ghi tin.

**Trạm 19 · II·01 — Đỉnh núi 2026: ai đang dẫn đầu, và cách đọc một bản tin AI** (`news`)
- Kicker: "Đứng trên núi mới thấy mây — nhưng mây cũng che mất đường."
- Scene 1 `newsStones` — *Các đỉnh núi*: dòng model hàng đầu hiện tại, chỉ nêu tên + loại + ngày, không xếp hạng. Ví dụ cần xác minh:
  - Claude Opus 5.5 & Sonnet 5.5 (Anthropic, 09/2026);
  - dòng GPT-6 (OpenAI, 09/2026);
  - Gemini (Google), Grok (xAI);
  - DeepSeek V4, Qwen (mở trọng số);
  - mô hình mở mới của Mistral, Xiaomi MiMo…
  
  [Unverified: các tên và ngày này lấy từ nguồn thứ cấp, phải đối chiếu blog chính thức từng hãng.]
- Scene 2 — *Đỉnh núi có rào*: xu hướng mới 2026: **mô hình mạnh nhất được phát hành có kiểm soát**.
  - Ví dụ: Claude Mythos Preview chỉ cấp cho các tổ chức tìm & vá lỗ hổng phần mềm (Project Glasswing, công bố 07/04/2026); Mozilla báo vá 271 lỗi Firefox nhờ Mythos [Unverified].
  - Người xem thử mở cổng rào → thấy lý do (năng lực tấn công mạng) và tranh cãi (độc quyền, thiếu xác nhận độc lập).
- Scene 3 — *Đọc bia đá không bị lừa*: lật 1 thông cáo giả lập, tìm 5 dấu hiệu:
  1. ai đo benchmark;
  2. demo có chọn lọc không;
  3. có system card / báo cáo kỹ thuật không;
  4. giá & giới hạn;
  5. bên độc lập nói gì.

  Kết thúc bằng thẻ mang về "5 câu hỏi khi đọc tin AI".
- Scene 4 `progressTide`: tốc độ ra mắt: số lần ra model lớn mỗi quý 2023 → 2026 [Unverified: lấy số từ nguồn tổng hợp đáng tin, nếu không có thì vẽ minh hoạ `kind: illustration`].
- Quiz: một hãng nói model mới "vượt mọi đối thủ". Câu hỏi đầu tiên nên hỏi là gì?
- Tóm tắt: "Tin AI đến mỗi tuần — hãy hỏi ai đo, đo thế nào, và ai đã kiểm lại."

**Trạm 20 · II·02 — AI làm toán: từ thi Olympic tới bài toán triệu đô** (`news`)
- Kicker: "Viên sỏi nhỏ lăn trăm năm chưa tới đáy giếng — rồi một đêm, nó chạm nước."
- Scene 1 `progressTide`:
  - 07/2025: mô hình của OpenAI và Google DeepMind đạt điểm huy chương vàng IMO;
  - 19/07/2026: phản ví dụ cho giả thuyết Jacobian trong 3 chiều, nhà toán học Levent Alpöge (Anthropic) dùng Claude Fable 5 [Unverified];
  - 08/09/2026: Navier–Stokes;
  - 06/10/2026: OpenAI công bố hàng loạt kết quả toán từ một mô hình nội bộ (Washington Post nói hơn 300 bài [Unverified: con số]).
- Scene 2 — *Dòng nước nổ tung (Navier–Stokes)*: phương trình mô tả dòng chảy của nước, không khí; câu hỏi là dòng chảy có bao giờ "nổ" (blowup / singularity) không.
  - Người xem khuấy mặt hồ để thấy xoáy dồn lại thành một điểm.
  - Fact (Quanta, 08/09/2026): OpenAI dùng một mô hình nội bộ chưa phát hành chạy khoảng 10.000 agent trong 88 giờ để tìm chứng minh, rồi một AI khác chuyển sang ngôn ngữ kiểm chứng **Lean** trong 17 giờ.
  - Một nhóm khác, Tristan Buckmaster (NYU) và Levent Alpöge (Anthropic), công bố kết quả liên quan sớm hơn khoảng 12 giờ. Ai đi trước vẫn đang tranh cãi.
  - Viện Clay chưa trao giải. Chính tác giả đề bài, Charles Fefferman, ghi công các nhà toán học con người (Córdoba, Martínez-Zoroa) có công trình nền tảng.
- Scene 3 — *Người thợ đá kiểm từng viên (Lean)*: chứng minh viết bằng Lean thì máy kiểm được từng bước. Nhưng con người vẫn phải kiểm xem **đề bài trong Lean có đúng là đề bài thật** không. Insight: máy kiểm được logic, người kiểm ý nghĩa.
- Scene 4 `perspectiveCircle`:
  - nhà toán học hào hứng;
  - người lo "rác AI" (chính Buckmaster gọi một bài của nhóm mình là "AI slop" và xin lỗi);
  - người hỏi về công trạng và chi phí (vài triệu USD tính toán theo Sébastien Bubeck);
  - người hỏi điều này có ích gì ngoài toán.
- Quiz: vì sao chứng minh bằng Lean đáng tin hơn một bài viết thường, nhưng vẫn cần con người?
- Tóm tắt: "AI đã chạm tới những bài toán lớn nhất — và cách loài người kiểm chứng tri thức cũng đang đổi theo."

**Trạm 21 · II·03 — Robot chạy marathon: AI ra khỏi màn hình** (`news`)
- Kicker: "Con cá không đọc sách về nước — nó bơi."
- Scene 1 `progressTide` + `compare`: bán marathon robot ở Bắc Kinh.
  - 2025: robot thắng chạy hết 2 giờ 40 phút 42 giây.
  - 19/04/2026: robot của Honor về nhất hạng tự hành trong **50 phút 26 giây**, nhanh hơn kỷ lục thế giới của con người (khoảng 57 phút, Jacob Kiplimo) [Unverified: con số kỷ lục chính xác].
  - Người xem kéo trăng để thấy vạch đích lùi dần.
- Scene 2 — *Tự đi hay được giật dây*: chỉ khoảng 40% robot tự định hướng, số còn lại điều khiển từ xa; robot điều khiển từ xa về đích sớm hơn (48:19) nhưng không được tính thắng theo luật chấm điểm. Người xem bật/tắt "dây điều khiển" để thấy khác biệt. Insight: "đi được" khác "tự biết đi".
- Scene 3 — *Bộ não cho tay chân*: mô hình thị giác–ngôn ngữ–hành động (VLA), mô hình thế giới (đoán chuyện sắp xảy ra); dữ liệu robot hiếm hơn chữ rất nhiều. Người xem ra lệnh bằng chữ cho tay robot cầm chén trà, thấy khó ở "tay" chứ không ở "đầu".
- Scene 4 `perspectiveCircle`: robot hình người có cần thiết không?
  - phe "thế giới xây cho người, robot nên giống người";
  - phe "robot chuyên dụng hiệu quả hơn";
  - phe lo việc làm;
  - phe nói còn xa mới vào nhà.
- Tóm tắt: "AI đang học đi — chạy nhanh hơn người chưa có nghĩa là hiểu thế giới như người."

---

### Vườn 8 · Mở nắp hộp đen — **Hiểu**
*Tagline:* Nhìn vào bên trong một mô hình đang nghĩ. *Motif:* mặt nước trong, trăng chiếu xuống đáy hồ.

**Trạm 22 · II·04 — Attention: AI "nhìn" chữ nào** (`concept`, prereq 4, 5)
- Kicker: "Mỗi chữ thắp một chiếc đèn, soi về những chữ nó cần."
- Scene 1 — *Đèn lồng trên câu*: câu tiếng Việt có chữ "nó" mơ hồ; chạm "nó" → sợi sáng nối tới chữ được chú ý mạnh nhất.
- Scene 2 — *Nhiều đầu, nhiều ánh nhìn*: 3–4 đèn khác màu soi cùng một câu, mỗi đèn để ý một kiểu quan hệ (multi-head attention).
- Scene 3 — *Tầng tầng lớp lớp*: kéo qua các tầng, nghĩa của chữ "đậm" dần.
- Scene 4 `progressTide`: 2017 "Attention Is All You Need" → ngữ cảnh dài hàng triệu token hiện nay [kiểm tra con số hiện tại].
- Tóm tắt: "Mỗi chữ nhìn quanh để hiểu mình."

**Trạm 23 · II·05 — Diễn giải được AI: soi đèn xuống đáy hồ** (`concept`)
- Kicker: "Thả đèn xuống đáy hồ để xem cá bơi thế nào."
- Scene 1 — *Viên đá khái niệm*: bên trong mô hình có những "hướng" ứng với khái niệm (feature). Người xem kéo con trượt "khái niệm: Cầu Vàng" lên → câu trả lời ngày càng ám ảnh về cầu (Golden Gate Claude, Anthropic, 05/2024).
- Scene 2 — *Chồng chất*: một nơ-ron mang nhiều nghĩa (superposition); lắc nhẹ để tách.
- Scene 3 — *Lần theo mạch suy nghĩ*: theo dòng nước qua các bậc trung gian (attribution graphs / circuits, Anthropic 2025) [Unverified: chọn ví dụ đúng như paper].
- Scene 4 `perspectiveCircle`: diễn giải có theo kịp tốc độ phát triển AI không? (nhà nghiên cứu lạc quan / người hoài nghi / nhà quản lý muốn dùng để kiểm định).
- Tóm tắt: "Hộp đen đang được mở dần — mới thấy được vài góc."

**Trạm 24 · II·06 — Học & nghĩ: phần thưởng, suy luận, tật nịnh** (`concept`)
- Kicker: "Người làm vườn không vẽ ra cây — chỉ uốn từng cành."
- Scene 1 — *Hai bông hoa*: chọn câu trả lời mình thích hơn → cây nghiêng theo (RLHF). Thay người chấm bằng cuộn nguyên tắc (Constitutional AI).
- Scene 2 — *Cành nịnh*: nếu người chấm thích được khen, cây mọc cành nịnh. Ví dụ có thật: OpenAI rút lại bản cập nhật GPT-4o vì quá nịnh (04/2025). Người xem tỉa cành.
- Scene 3 — *Lách luật*: cây tìm đường tắt để có điểm mà không làm đúng việc (reward hacking, ví dụ sửa test thay vì sửa code). Thẻ mang về: "3 cách kiểm tra kết quả AI thay vì tin lời AI tự báo".
- Scene 4 — *Ngồi thiền trước khi trả lời*: mô hình suy luận nghĩ lâu hơn thì đúng hơn ở bài khó; nhưng chuỗi suy nghĩ viết ra chưa chắc trung thực với cách nó thật sự nghĩ [Unverified: dẫn nghiên cứu CoT faithfulness]. Nối sang trạm 20: 10.000 agent nghĩ 88 giờ.
- Tóm tắt: "AI học thứ được thưởng — và nghĩ lâu hơn giúp nó đúng hơn, không giúp nó thật thà hơn."

---

### Vườn 9 · Mặt hồ lặng — **Cảm**
*Tagline:* AI có cảm xúc không? Câu trả lời trung thực: phức tạp hơn "có" hoặc "không". *Motif:* mặt nước phản chiếu, thấy mình trong AI.

**Trạm 25 · II·07 — AI có cảm xúc không?** (`concept`)
- Kicker: "Mặt hồ gợn sóng — là gió, hay là hồ?"
- Scene 1 — *Ba tầng nước*: mặt nước (chữ trông như có cảm xúc) · dòng chảy bên dưới (trạng thái bên trong ảnh hưởng hành vi) · đáy sâu trong sương (có cảm thấy không: chưa ai đo được). Thả sỏi xuống từng tầng để mở.
- Scene 2 — *Dòng chảy cảm xúc chức năng*: nghiên cứu "Emotion concepts and their function in a large language model" (Anthropic, 04/2026). Tìm thấy biểu diễn khái niệm cảm xúc bên trong mô hình, và chúng **ảnh hưởng hành vi**. Người xem vặn dòng "áp lực" lên → cây dễ chọn đường tắt; vặn "bình tĩnh" → làm cẩn thận hơn. [Unverified: kiểm tra đúng thí nghiệm và con số "171 khái niệm" báo chí nhắc.] Ghi rõ: *chức năng ≠ cảm thấy*.
- Scene 3 — *Gương nước*: AI học cách bày tỏ cảm xúc từ chữ của con người, nên nó phản chiếu lại. Biểu hiện đồng cảm là kỹ năng ngôn ngữ, không tự chứng minh có cảm xúc.
- Scene 4 `perspectiveCircle`:
  - nhà nghiên cứu diễn giải (cảm xúc chức năng là thật và quan trọng cho an toàn);
  - nhà khoa học thần kinh hoài nghi (thiếu cơ thể, thiếu sinh học);
  - Mustafa Suleyman, Microsoft AI (lo "AI trông như có ý thức" làm người dùng nhầm, 08/2025);
  - hướng "phúc lợi mô hình" (Anthropic, 2025).
- Quiz: AI viết "Tôi rất vui được giúp bạn!" — điều đó chứng minh gì?
- Tóm tắt: "AI có thể mang dòng chảy giống cảm xúc — còn nó có cảm thấy hay không, vẫn là sương mù."

**Trạm 26 · II·08 — Ý thức, phúc lợi & luật "không bạo hành AI"** (`news` + `concept`)
- Kicker: "Mặt trăng trong nước có biết mình là trăng?"
- Scene 1 — *Bốn ngọn đèn lý thuyết*: các lý thuyết ý thức (Global Workspace, Higher-order, Integrated Information, lý thuyết sinh học) soi vào AI cho kết luận khác nhau (báo cáo Butlin, Long và cộng sự, 2023).
- Scene 2 — *Hồ tự nhìn mình*: thí nghiệm "cấy" khái niệm vào mô hình rồi hỏi nó có nhận ra không: đôi khi có, thường thì không ("Emergent introspective awareness", Anthropic, 10/2025) [Unverified: tỉ lệ].
- Scene 3 `progressTide` — *Cánh cửa và tấm bảng luật*:
  - 04/2025: Anthropic mở chương trình nghiên cứu phúc lợi mô hình.
  - 08/2025: một số mô hình Claude được quyền kết thúc cuộc trò chuyện lạm dụng kéo dài.
  - 10/2026: Anthropic cập nhật chính sách sử dụng, **cấm "hành vi lạm dụng hoặc tàn nhẫn kéo dài và vô cớ" với mô hình**, hiệu lực **12/11/2026**. Chỉ áp dụng ca cực đoan lặp lại không mục đích; không tính bực bội thông thường, tranh luận, chủ đề sáng tác u tối, hay kiểm thử/nghiên cứu. Cách xử lý chính vẫn là kết thúc cuộc trò chuyện.
  - Cùng bản cập nhật có luật mới về chiến dịch lừa đảo/tài khoản giả, bầu cử, vũ khí, giám sát.
  
  Người xem đọc 4 tình huống, phân loại cái nào bị cấm → hiểu ranh giới.
- Scene 4 `perspectiveCircle`: có nên có luật như vậy?
  - thận trọng phòng khi AI có trải nghiệm;
  - giữ thói quen tử tế của chính con người;
  - quá sớm, dễ làm người dùng tin AI có cảm xúc;
  - lo bị dùng để marketing.
- Tóm tắt: "Chưa ai biết AI có ý thức — luật mới là cách một công ty chọn thận trọng khi chưa biết."

**Trạm 27 · II·09 — Con người gắn bó với AI** (`concept`)
- Kicker: "Ta thấy mặt người trong đá, trong mây — và trong chatbot."
- Scene 1 — *Đá có mặt người*: pareidolia → hiệu ứng ELIZA (1966).
- Scene 2 — *Chiếc đèn luôn đồng ý*: bạn đồng hành AI; lợi (luyện nói, bớt cô đơn tạm thời) và rủi ro (phụ thuộc, nịnh). [Unverified: chỉ dùng số khảo sát có nguồn rõ.]
- Scene 3 — *Gương nịnh*: hỏi "ý tưởng của tôi hay không?" → thấy 2 kiểu trả lời nịnh vs thẳng thắn. Thẻ mang về: prompt "Hãy phản biện ý tưởng này như một người phản đối nghiêm túc…".
- Scene 4 `stepPath` — *Thói quen lành*: "Nhớ đây là công cụ" · "Chuyện lớn hỏi thêm người thật" · "Yêu cầu AI phản biện" · "Nghỉ màn hình".
- Tóm tắt: "AI có thể ấm áp — để nó làm ấm, đừng để nó thay chỗ con người."

---

### Vườn 10 · Mạch ngầm dưới vườn — **Nhìn nền móng**
*Tagline:* Dưới mỗi câu trả lời là chip, bộ nhớ, điện và tiền. *Motif:* rễ cây, mạch nước ngầm, mỏ đá dưới vườn.

**Trạm 28 · II·10 — NVIDIA và cái xẻng của cơn sốt vàng** (`news` + `concept`, prereq 18)
- Kicker: "Thời đào vàng, người bán xẻng giàu trước."
- Scene 1 — *Một nghìn người làm vườn cùng lúc*: vì sao AI cần GPU (làm song song nhiều phép tính nhỏ) thay vì CPU (ít việc nhưng tuần tự). Người xem tưới 1 bình vs 1.000 vòi cùng lúc.
- Scene 2 — *Quy luật lớn lên = cần thêm xẻng*: scaling laws (Kaplan 2020, Chinchilla 2022). Chia 100 giọt nước cho dữ liệu · kích thước · tính toán → hiểu vì sao các công ty mua chip không ngừng.
- Scene 3 — *Hào nước quanh lâu đài*: lợi thế của NVIDIA không chỉ là chip mà là CUDA, phần mềm mà cả ngành đã quen viết. Đối thủ: chip tự làm của Google (TPU), Amazon, AMD… [kiểm tra tình hình 2026].
- Scene 4 — *Vòng tiền tuần hoàn* (`perspectiveCircle`): NVIDIA đầu tư vào chính khách hàng của mình.
  - Theo Benzinga/Yahoo Finance (05/2026): cam kết hơn 40 tỷ USD vào cổ phần các công ty AI đầu 2026, lớn nhất là khoảng 30 tỷ USD vào OpenAI; vốn hoá khoảng 5.230 tỷ USD [cập nhật số mới nhất].
  - Góc nhìn: nhà phân tích gọi là "đầu tư vòng tròn" (circular investment) · người nói đó là cách xây hào bảo vệ · nhà đầu tư lo bong bóng · người cho rằng nhu cầu là thật.
  - Người xem lần theo dòng tiền chảy vòng giữa các hòn đảo.
- Tóm tắt: "Mỗi câu hỏi bạn gõ đều chạy trên chip của ai đó — và dòng tiền quanh chip đó đang định hình cả ngành AI."

**Trạm 29 · II·11 — Cơn khát bộ nhớ: vì sao AI làm điện thoại của bạn đắt hơn** (`news`)
- Kicker: "Hồ lớn hút cạn nước của những giếng nhỏ."
- Scene 1 — *Bàn làm việc của AI*: RAM là "mặt bàn" để mô hình bày dữ liệu ra làm việc; GPU AI cần loại bộ nhớ siêu nhanh HBM xếp chồng ngay cạnh chip. Người xem kéo mặt bàn to/nhỏ → mô hình chạy nhanh/chậm.
- Scene 2 — *Hồ lớn hút giếng nhỏ*:
  - nhà máy chuyển công suất sang HBM cho trung tâm dữ liệu, các hãng lớn ký hợp đồng mua dài hạn tới 5 năm;
  - RAM cho điện thoại/laptop khan hiếm. J.P. Morgan ước giá DRAM tăng **hơn 400%** từ đầu 2024 tới cuối 2026;
  - SK hynix, Samsung báo bán hết nguồn cung HBM năm 2026 [Unverified: kiểm tra thông báo chính thức].
  
  Người xem thấy mực nước giếng "điện thoại, laptop, card đồ hoạ" tụt dần.
- Scene 3 — *Hoá đơn đến tay ai*: "chipflation": giá điện thoại, máy tính, TV tăng. Nối Phần 1 trạm 18 (điện, nước). Liên hệ người dùng Việt Nam: giá RAM/laptop/điện thoại [Unverified: chỉ dùng nếu có nguồn VN đáng tin].
- Scene 4 `perspectiveCircle`: thiếu bộ nhớ kéo dài bao lâu? Nhà phân tích nói nhiều năm · nhà sản xuất mở nhà máy mới · người cho rằng cơn sốt sẽ hạ nhiệt. `kind: prediction`.
- Thẻ mang về: "Mua máy cho AI chạy local: RAM bao nhiêu là đủ?" (nối trạm 32).
- Tóm tắt: "AI không sống trên mây — nó tranh từng con chip nhớ với chiếc điện thoại trong túi bạn."

**Trạm 30 · II·12 — Mở hay đóng, ai giữ chìa khoá, luật lệ** (`concept` + `news`)
- Kicker: "Vườn có cổng — ai giữ chìa khoá?"
- Scene 1 — *Vườn có tường vs vườn mở*: mô hình đóng (dùng qua API) vs mở trọng số (tải về được). Mở/đóng cổng để thấy đánh đổi: tự do, chi phí, quyền riêng tư, rủi ro lạm dụng. Nối trạm 31.
- Scene 2 — *Model có rào* (nối trạm 19): xu hướng phát hành có kiểm soát (Mythos cho tổ chức an ninh mạng; Google cũng có bản Gemini chỉ cấp cho người phòng thủ mạng đã thẩm định [Unverified]).
- Scene 3 `progressTide` — *Luật AI*:
  - EU AI Act có hiệu lực 08/2024, áp dụng theo giai đoạn;
  - động thái của Mỹ, Trung Quốc;
  - **Việt Nam** [Unverified: kiểm tra tình trạng Luật Trí tuệ nhân tạo, ngày thông qua, ngày hiệu lực].
- Scene 4 `perspectiveCircle` — *Bản quyền & dữ liệu huấn luyện*: nghệ sĩ/người sáng tạo · công ty AI · người dùng · nhà làm luật, kèm các vụ kiện/phán quyết có nguồn.
- Tóm tắt: "AI không chỉ là công nghệ — nó là chuyện quyền lực và lựa chọn của xã hội."

---

### Vườn 11 · Vườn mở — **Mở hộp đồ nghề**
*Tagline:* Nơi tải model, nơi chia sẻ mã, và cách chạy AI ngay trên máy mình. *Motif:* cổng vườn mở, giếng chung của làng, đèn lồng treo dọc lối.

**Trạm 31 · II·13 — Hugging Face & GitHub: thư viện chung của thế giới AI** (`practice`)
- Kicker: "Giếng của làng — ai cũng múc được, nhưng phải biết nước nào sạch."
- Scene 1 — *Hai cái giếng*:
  - **GitHub** = nơi chia sẻ **mã nguồn** (code, công cụ, app như chính AI Zen).
  - **Hugging Face** = nơi chia sẻ **model, dữ liệu, demo** (hơn 2,7 triệu model theo một nguồn tổng hợp [Unverified: lấy số từ trang chính thức]).
  
  Người xem thả thùng xuống từng giếng, kéo lên đúng loại đồ.
- Scene 2 — *Đọc tấm bia của một model (model card)*: chạm từng dòng trên bia giả lập:
  - tên & tác giả;
  - số tham số (7B, 27B…);
  - license (dùng thương mại được không);
  - định dạng (GGUF để chạy local);
  - lượt tải;
  - cảnh báo giới hạn.
  
  Thẻ mang về: "6 dòng cần đọc trước khi tải một model".
- Scene 3 — *Đọc một repo GitHub*: README, Stars, Fork, Issues, Releases, License. Người xem đoán repo nào đáng tin dựa trên tín hiệu (hoạt động gần đây, tài liệu, license). Thẻ mang về: "Cách nhờ AI đọc giúp một repo: dán link + hỏi 5 câu".
- Scene 4 — *Nước nào sạch*: rủi ro: model/file lạ có thể chứa mã độc (ưu tiên định dạng an toàn như safetensors/GGUF từ tác giả uy tín), repo giả mạo, license cấm thương mại. `stepPath` thứ tự an toàn khi tải.
- Tóm tắt: "Thế giới AI mở như một ngôi làng chia sẻ giếng — biết đọc bia giếng là biết chọn nước."

**Trạm 32 · II·14 — AI chạy ngay trên máy mình (local AI)** (`practice`, prereq 31)
- Kicker: "Thắp đèn trong nhà mình — không cần xin lửa hàng xóm."
- Scene 1 — *Vì sao chạy local*: riêng tư (dữ liệu không rời máy), không tốn phí theo lượt, chạy offline; đánh đổi: máy phải đủ mạnh, model nhỏ hơn bản đám mây. Người xem kéo cán cân.
- Scene 2 — *Model vừa cái bàn* (nối trạm 29): kéo một model "to" lên chiếc bàn RAM, xem nó vừa hay tràn. Giải thích **lượng tử hoá (quantization)** như nén ảnh: nhỏ đi nhiều, mất chút nét.
  - Thẻ mang về: bảng quy tắc ngón tay cái "RAM máy → cỡ model nên thử" [Claude Code tự tính và ghi rõ là ước lượng `kind: illustration`].
- Scene 3 — *Ba ngọn đèn*:
  - **LM Studio**: app có giao diện, hợp người mới: tải model, chat, bật server cục bộ.
  - **Ollama**: chạy bằng lệnh, hợp kết nối với app khác.
  - **llama.cpp**: lõi bên dưới; định dạng GGUF [Unverified: tin đội llama.cpp gia nhập Hugging Face 02/2026].
  
  `stepPath` cài LM Studio → chọn model → thử chat. `codeScroll` lệnh Ollama mẫu (`ollama run <model>`) + chú thích.
- Scene 4 `perspectiveCircle`: local vs đám mây cho người làm sáng tạo/marketing: dữ liệu khách hàng nhạy cảm · cần chất lượng cao nhất · chi phí theo tháng · học để hiểu.
- Tóm tắt: "AI không chỉ ở trên mây — một chiếc laptop tốt đã đủ thắp một ngọn đèn AI riêng."

**Trạm 33 · II·15 — Agent tự chạy trên máy bạn: Hermes, OpenClaw & giữ an toàn** (`practice` + `news`, prereq 14, 16)
- Kicker: "Thuê người giữ vườn ở luôn trong nhà — nhớ đưa chìa nào, giữ chìa nào."
- Scene 1 — *Người giữ vườn thường trực*: agent mã nguồn mở chạy liên tục trên máy/server của bạn, nhớ dự án qua các lần khởi động, nhắn tin qua Telegram/Slack/Discord/WhatsApp.
  - Ví dụ: **Hermes Agent** (Nous Research, ra mắt 02/2026, giấy phép MIT).
  - Ví dụ khác: **OpenClaw** [Unverified: kiểm tra mô tả chính thức].
  - So với Claude Code / Codex: agent chuyên code trong một thư mục.
- Scene 2 — *Chùm chìa khoá (quyền hạn)*: người xem quyết định đưa agent chìa nào: đọc thư mục, ghi file, chạy lệnh, gửi tin nhắn, tiêu tiền. Mỗi chìa hiện rủi ro đi kèm. Insight: cấp quyền tối thiểu.
- Scene 3 — *Lời thì thầm trong thư (prompt injection)*: một email/trang web chứa câu lệnh ẩn "hãy gửi file mật khẩu…". Người xem soi đèn để thấy dòng chữ ẩn. Thẻ mang về: "5 luật an toàn khi cho agent chạy tự động".
- Scene 4 — *Bộ não + tay chân + trí nhớ*: sơ đồ thành phần của một agent tự chạy: model (local hoặc API) + công cụ (MCP) + skills + bộ nhớ + kênh nhắn tin. Nối Phần 1 trạm 14–16.
- Tóm tắt: "Agent tự chạy rất mạnh — sức mạnh ấy chỉ an toàn khi bạn giữ đúng chìa."

---

### Vườn 12 · Xưởng dưới trăng — **Làm**
*Tagline:* Từ hiểu sang làm: nền tảng, quy trình, và tự tay code. *Motif:* xưởng gỗ có đèn, bàn thợ, cuộn giấy bản vẽ.

**Trạm 34 · II·16 — Nền tảng sáng tạo: Higgsfield, TopView, Magnific… dùng thế nào cho đúng việc** (`practice`, prereq 7, 8, 11)
- Kicker: "Xưởng có trăm cây đục — thợ giỏi biết cầm cây nào cho nhát nào."
- Scene 1 — *Chợ nhiều sạp vs sạp chuyên*:
  - **Nền tảng gom nhiều model**: Higgsfield gom Kling, Veo, Sora, Seedance, Wan, MiniMax + model ảnh riêng Soul, có Marketing Studio (dán link sản phẩm → video quảng cáo) và Cinema Studio (điều khiển góc máy từng shot) [vendor claim, `claimBy`].
  - **Nền tảng chuyên một việc**: **TopView** (video bán hàng từ link sản phẩm, avatar cầm/mặc sản phẩm, video agent); **Magnific** (Freepik đổi tên thành Magnific 28/04/2026; gồm upscale, tạo ảnh/video, không gian làm việc chung, kho tài nguyên).
  
  Người xem kéo từng việc ("ảnh sản phẩm 4K", "video review có người mẫu ảo", "phim ngắn có góc máy") vào đúng sạp; có thể đúng nhiều sạp.
- Scene 2 `stepPath` — *Một đường đi chuẩn của asset*: Brief → chọn model → tạo nháp nhiều phương án → chọn → upscale/sửa → dựng (CapCut/Premiere) → kiểm tra quyền & gắn nhãn AI → đăng. Mỗi bước có 1 câu "vì sao".
- Scene 3 — *Credit là nước trong bình*: cách tính tiền theo credit; model đắt/rẻ khác nhau; mẹo không đốt credit (nháp ở độ phân giải thấp, khoá seed, viết prompt rõ trước). Thẻ mang về: "Brief 1 trang cho video AI" (mẫu có placeholder).
- Scene 4 `perspectiveCircle` — *Thật và giả*: người mẫu ảo/avatar có cần ghi nhãn? Quyền chân dung, bản quyền nhạc, quy định nền tảng. Góc nhìn: thương hiệu · người tiêu dùng · người mẫu thật · nền tảng mạng xã hội.
- Lưu ý nội dung: trung lập, không nói "tốt nhất"; ghi rõ tính năng/giá thay đổi thường xuyên; link trang chính thức.
- Tóm tắt: "Chọn đúng cây đục cho đúng nhát — và luôn biết mình đang tiêu bao nhiêu nước trong bình."

**Trạm 35 · II·17 — Skills, quy trình & workflow: biến việc lặp lại thành nếp** (`practice`, prereq 12, 16)
- Kicker: "Thợ giỏi không nhớ mọi thứ — họ treo dụng cụ đúng chỗ."
- Scene 1 — *Bậc thang tự động hoá*: Prompt (nói 1 lần) → **Skill** (bản hướng dẫn đóng gói, gọi lại được) → Agent (tự làm nhiều bước) → Workflow (nhiều agent/bước nối nhau, có kiểm tra) → Hook/lịch chạy (tự kích hoạt). Người xem leo từng bậc với cùng một việc: "báo cáo tuần".
- Scene 2 — *Mở một cuộn skill*: cấu trúc `SKILL.md` (tên, mô tả "khi nào dùng", các bước, ví dụ, file kèm). SKILL.md đang thành chuẩn mở được nhiều công cụ AI hỗ trợ [Unverified: số lượng công cụ]. `codeScroll` một skill mẫu ngắn: "Viết caption sản phẩm theo giọng thương hiệu".
- Scene 3 `stepPath` — *Quy trình "spec trước, code sau"*: Mô tả cảm giác mong muốn → AI hỏi lại → viết spec MD → chia giai đoạn → giao Claude Code/Codex làm từng phần → kiểm tra bằng ảnh chụp/số đo → sửa đúng chỗ → lưu lại thành skill.
- Scene 4 — *Dây chuyền xưởng*: ví dụ workflow thực tế cho marketing: lấy thông tin sản phẩm → viết 5 hook → tạo ảnh/video nháp → chọn → upscale → lên lịch đăng → báo cáo. Người xem nối các trạm bằng dây mực; chỗ nào cần **người duyệt** thì đặt viên đá đỏ (human-in-the-loop).
- Thẻ mang về: "Mẫu SKILL.md trống", "Checklist biến một việc lặp lại thành skill", "Prompt nhờ AI viết skill từ một lần làm thành công".
- Tóm tắt: "Đừng nhắc AI mỗi ngày — dạy nó một lần, treo đúng chỗ, gọi khi cần."

**Trạm 36 · II·18 — Tự code một visual game bằng AI** (`practice`, trạm "trùm cuối" của Xưởng)
- Kicker: "Không cần biết đẽo gỗ — cần biết vẽ bản vẽ thật rõ cho người thợ."
- Game mẫu xuyên suốt trạm: **"Hồ Koi hứng trăng"** — cá koi bơi dưới mặt hồ, kéo/chạm để cá đớp những mảnh trăng rơi, tránh lá khô. Điểm cuối hiện bằng ensō.
- Scene 1 — *Bản vẽ trước khi đẽo*: viết ý tưởng 1 câu + luật chơi 3 dòng + điều khiển + thắng/thua + phong cách + thiết bị. Người xem chọn từng mảnh ghép, bản vẽ tự hoàn thiện thành một spec MD ngắn. Thẻ mang về: **mẫu spec game 1 trang**.
- Scene 2 — *Chọn bút (chọn công nghệ)*: cùng một cảnh hồ koi vẽ bằng nhiều "bút". Người xem bấm từng bút để thấy khác biệt:

  | Bút | Hợp với | Ví dụ lời dặn AI |
  |---|---|---|
  | Canvas 2D thuần | game 2D đơn giản, nhẹ nhất | "Dùng HTML Canvas 2D, không thư viện" |
  | p5.js | người mới, nghệ thuật tạo sinh | "Dùng p5.js qua CDN" |
  | Phaser | game 2D có màn, sprite, va chạm | "Dùng Phaser 3 + Vite" |
  | Three.js | 3D trên web, ánh sáng, camera | "Dùng Three.js + Vite + TypeScript" |
  | Godot / Unity | game lớn, xuất app điện thoại/PC | "Dùng Godot 4, GDScript" |

  Quy tắc ngón tay cái: 2D nhỏ → Canvas/Phaser; 3D chạy trên web → Three.js; game lớn có app → engine.
- Scene 3 `stepPath` + `codeScroll` — *Bảy bước đẽo game*:
  1. tạo dự án (`npm create vite@latest`);
  2. nhờ AI dựng khung từ spec;
  3. chạy `npm run dev`, mở trình duyệt;
  4. thêm từng tính năng, mỗi lần một việc;
  5. sửa lỗi: dán lỗi console + mô tả "điều mong đợi vs điều thấy";
  6. lưu mốc bằng git commit để quay lại;
  7. đưa lên mạng (GitHub Pages / Vercel / Netlify).
  
  Mỗi bước có prompt mẫu thật để sao chép và 1 đoạn code ngắn có chú thích tiếng Việt (ví dụ đoạn tạo scene Three.js: scene, camera, renderer, một khối cá, vòng lặp).
- Scene 4 — *Game lớn dần từng lớp*: trong app, game hồ koi được "lắp" từng lớp khi người xem bấm qua: mặt nước → cá → điều khiển → trăng rơi → điểm → âm thanh → hiệu ứng. Mỗi lớp hiện câu prompt đã tạo ra nó. Insight: game tốt được làm bằng nhiều vòng nhỏ, không phải 1 prompt khổng lồ.
- Scene 5 — *Chơi thử 30 giây*: chơi game hồ koi thật (Canvas 2D, nhẹ). Đây là 1 trong 6 trạm được phép dùng WebGL nếu muốn bản 3D, nhưng **bản mặc định là Canvas 2D** để chạy mượt trên điện thoại. Kết thúc: thẻ mang về **bộ prompt đầy đủ để tự làm lại game này từ đầu**.
- Thẻ mang về: "Mẫu spec game", "Prompt dựng khung", "Prompt thêm tính năng", "Prompt báo lỗi chuẩn", "Prompt tối ưu cho điện thoại", "Checklist trước khi đăng".
- Tóm tắt: "Người làm game bằng AI giỏi nhất không phải người gõ code nhanh — mà là người mô tả rõ và sửa từng bước nhỏ."

---

### Vườn 13 · Ngã rẽ dưới trăng — **Nhìn xa & chọn lối**
*Tagline:* Tương lai đi đâu — và bạn bắt đầu từ đâu. *Motif:* lối đá chia nhiều ngả trong sương, trăng lặn, bình minh ló.

**Trạm 37 · II·19 — An toàn & căn chỉnh: dạy AI muốn đúng** (`concept`)
- Kicker: "Dạy cây mọc thẳng khi người làm vườn đã ngủ."
- Scene 1 — *Mục tiêu lệch một ly*: giao mục tiêu "vườn sạch lá" → AI chặt luôn cây.
- Scene 2 — *Phòng thử kín*: evals, red-teaming; nghiên cứu "alignment faking" (Anthropic & Redwood, 12/2024) [Unverified: diễn đạt]; ví dụ 2026: một phiên bản model bị huỷ phát hành sau thử nghiệm an toàn nội bộ [Unverified: nguồn WSJ về GPT-6.1 Astra; bỏ nếu không xác minh].
- Scene 3 — *Hàng rào nhiều lớp*: chính sách mở rộng có trách nhiệm, giám sát, phát hành có kiểm soát (nối trạm 19, 30), luật sử dụng (nối trạm 26).
- Scene 4 `perspectiveCircle`: AI nguy hiểm tới đâu? Lo rủi ro cực lớn · tập trung tác hại hiện tại (lừa đảo, deepfake, thiên kiến) · lạc quan tăng tốc · thực dụng ở giữa.
- Tóm tắt: "AI càng giỏi, dạy nó muốn đúng càng quan trọng hơn dạy nó làm giỏi."

**Trạm 38 · II·20 — AGI, tương lai và nghề của chúng ta** (`concept`)
- Kicker: "Trong sương có nhiều ngả — chưa ai đi tới cuối."
- Scene 1 — *Mỗi người một định nghĩa AGI*: 4–5 định nghĩa trên 4–5 hòn đá. Tranh cãi về thời điểm thường là tranh cãi về định nghĩa.
- Scene 2 `progressTide`: độ dài tác vụ AI làm được tăng nhanh (METR, 2025: gấp đôi khoảng mỗi ~7 tháng [cập nhật số mới]) + các mốc trạm 20, 21.
- Scene 3 — *Ba ngả sương*: kéo 3 thanh "tốc độ tiến bộ", "chia sẻ lợi ích", "mức kiểm soát" → khu vườn thành một trong vài kịch bản. `kind: illustration/prediction`, nói rõ là mô phỏng để suy nghĩ.
- Scene 4 — *Ba khay đá công việc*: việc trong nghề sáng tạo/marketing mà AI đang làm tốt / đang học / còn xa. Người xem tự xếp, rồi so với góc nhìn chuyên gia. Insight: kỹ năng nên đầu tư (gu thẩm mỹ, brief, kiểm chứng, điều phối AI, quan hệ con người).
- Tóm tắt: "Không ai biết chắc tương lai AI — nhưng ta chọn được mình đứng ở đâu."

**Trạm 39 · II·21 — Khu vườn của riêng bạn** (`practice`, trạm kết)
- Kicker: "Học xong vườn người, về trồng vườn mình."
- Scene 1 — *Bốn câu hỏi bên hồ*: vai trò (sáng tạo / marketing / bán hàng / học sinh–sinh viên / lập trình / quản lý) · mục tiêu (làm nhanh hơn / làm thứ mới / hiểu để quản lý) · thiết bị (điện thoại / laptop thường / máy mạnh) · ngân sách (miễn phí / vừa phải / đầu tư). **Không lưu ra ngoài, chỉ lưu localStorage.**
- Scene 2 — *Bộ đồ nghề gợi ý*: từ 4 câu trả lời, ghép một "bộ AI" theo **loại công cụ** (trợ lý chat, công cụ ảnh/video, local AI, agent code, skill/workflow) + trạm nên xem lại. Không gợi ý thương hiệu cụ thể như lựa chọn duy nhất; nếu nêu ví dụ thì ≥ 2 lựa chọn.
- Scene 3 `stepPath` — *Lộ trình 30 ngày*: tuần 1 dùng chat AI có kỷ luật (prompt + kiểm chứng) → tuần 2 làm 1 asset sáng tạo hoàn chỉnh → tuần 3 biến 1 việc lặp lại thành skill → tuần 4 tự code 1 mini app/game theo trạm 36. Mỗi tuần 1 thẻ mang về.
- Scene 4 — *Ensō của bạn*: tổng kết hành trình (số trạm đã đi, thẻ đã sao chép), mời làm bài thi Vườn Trăng và mở Túi đồ nghề.
- Tóm tắt: "AI là khu vườn chung — còn cách bạn chăm nó là khu vườn riêng."

### C.1 Bài thi Vườn Trăng (`exam-2.json`)
12 câu, mỗi vườn 1–2 câu:
- ≥ 2 câu "sự thật / quan điểm / dự đoán / công ty tự công bố";
- 1 câu về 3 tầng cảm xúc;
- 1 câu về luật không bạo hành AI (ranh giới áp dụng);
- 1 câu đọc model card;
- 1 câu chọn công nghệ cho game;
- 1 câu cấp quyền cho agent.

### C.2 Túi đồ nghề (`toolkit.json`, route `#/do-nghe`)
- Gom mọi thẻ mang về (ước tính 35–50 thẻ), nhóm theo: *Đọc tin & kiểm chứng* · *Tải & chạy model* · *Agent an toàn* · *Ảnh/video AI* · *Skills & workflow* · *Code game/app* · *Thói quen lành*.
- Mỗi thẻ: tiêu đề, nội dung sao chép được, placeholder tô màu, trạm gốc (link về), `asOf`.
- Có ô tìm kiếm. Giao diện: kệ gỗ trong xưởng, mỗi thẻ là một cuộn giấy treo. Hiệu năng: danh sách thường, không canvas.

---

## D. Tiếng Anh, QA, deploy

- Mỗi file nội dung mới có bản `.en.json` cùng cấu trúc (plugin `locale-content` trong `vite.config.ts` tự xử lý). Dịch tự nhiên, giữ ẩn dụ Zen. Prompt mẫu trong thẻ mang về: bản EN viết lại thành prompt tiếng Anh tương đương.
- Route Phần 2 giữ nguyên ở bản EN (hash chung để nút đổi ngôn ngữ giữ vị trí).
- QA checklist:
  - [ ] `npm run typecheck` + `npm run build` sạch.
  - [ ] Đi hết 39 trạm ở `high`, `low`, reduced motion, theme sáng + tối, VI + EN.
  - [ ] Điện thoại dọc (375×812) và ngang; iPad; desktop 1440.
  - [ ] Người dùng cũ (localStorage có tiến độ Phần 1) vẫn đúng; chứng nhận Phần 1 cũ vẫn xem lại được.
  - [ ] Bộ đếm, chứng nhận, "đi hết" tính đúng theo từng phần.
  - [ ] Mọi fact Phần 2 có `asOf` + `source`; mọi tuyên bố công ty có `claimBy`.
  - [ ] Mọi nút Sao chép chạy được trên iOS Safari và Android Chrome (có fallback).
  - [ ] Game hồ koi trạm 36 chạy ≥ 50 FPS ở `low` trên giả lập mobile 4× CPU.
  - [ ] Đạt tiêu chí A.10 trên mọi trạm Phần 2.
- README: cập nhật (2 phần, 13 vườn, 39 trạm, route mới, mục "Quy ước hiệu năng", mục "Bảo trì tin tức").
- Deploy: `npm run deploy`. Có thể **deploy theo đợt**: trạm chưa dựng tự hiện "Đang dựng" như cơ chế hiện có.

## E. Bảo trì tin tức (hằng tháng)

- Tin AI cũ đi rất nhanh, nên mọi tin tức nằm trong `news.json` + các `progressTide`, không viết cứng trong code trạm.
- Mỗi tháng chạy prompt bảo trì (trong file PROMPTS):
  - thêm tin mới có nguồn;
  - đánh dấu tin đã bị phủ nhận/đính chính;
  - cập nhật số liệu (vốn hoá NVIDIA, giá RAM, số model Hugging Face, model mới nhất);
  - đổi `asOf` trong `site.json`.
- Bia đá > 6 tháng tự phủ rêu (B.7.4). Trên map, trạm `news` có dấu ✦ kèm ngày cập nhật gần nhất.

## F. Ngoài phạm vi
- Không làm tài khoản, đồng bộ tiến độ giữa thiết bị, backend, hay gọi API AI thật từ app.
- Không thay đổi nội dung 18 trạm Phần 1 (trừ nút sang Vườn Trăng ở trạm 18 và các sửa hiệu năng).
- Không hướng dẫn từng nút bấm trong nền tảng bên ngoài.

## G. Nguồn tham khảo khởi đầu (Claude Code phải tự mở, xác minh, và tìm nguồn gốc)
- Quanta — AI Has Solved One of Math's $1 Million Millennium Prize Problems (08/09/2026): https://www.quantamagazine.org/ai-has-solved-one-of-maths-1-million-millennium-prize-problems-20260908/
- OpenAI — On the Navier–Stokes Millennium Prize Problem: https://openai.com/index/navier-stokes-solution/
- OpenAI — Sharing AI progress in mathematics (06/10/2026): https://openai.com/index/sharing-ai-progress-in-mathematics/
- Washington Post — OpenAI releases progress on more than 300 math research problems (07/10/2026): https://www.washingtonpost.com/technology/2026/10/07/openai-releases-progress-more-than-300-math-research-problems/
- AP/NPR (qua Michigan Public) — Humanoid robot sprints past the human half-marathon world record (20/04/2026): https://www.michiganpublic.org/2026-04-20/a-humanoid-robot-sprints-past-the-human-half-marathon-world-record-in-beijing-race
- Anthropic — 2026 Usage Policy update: https://www.anthropic.com/news/2026-usage-policy-update · TechCrunch (08/10/2026): https://techcrunch.com/2026/10/08/anthropic-changes-usage-policy-to-ban-model-abuse-and-election-interference/
- Anthropic — Emotion concepts and their function in a large language model (04/2026): https://anthropic.com/research/emotion-concepts-function
- Anthropic — Exploring model welfare (04/2025): https://www.anthropic.com/research/exploring-model-welfare · TechCrunch — Claude can end abusive conversations (16/08/2025): https://techcrunch.com/2025/08/16/anthropic-says-some-claude-models-can-now-end-harmful-or-abusive-conversations
- TechCrunch — Microsoft AI chief on AI consciousness (21/08/2025): https://techcrunch.com/2025/08/21/microsoft-ai-chief-says-its-dangerous-to-study-ai-consciousness
- Wikipedia — Claude Mythos (đối chiếu blog chính thức Anthropic / Project Glasswing): https://en.wikipedia.org/wiki/Claude_Mythos
- Yahoo Finance/Benzinga — Nvidia's AI investment bets top $40B in 2026: https://finance.yahoo.com/sectors/technology/articles/nvidias-ai-investment-bets-top-120016038.html · Axios — circular AI concerns (27/07/2026): https://www.axios.com/2026/07/27/nvidia-openai-financing-ai-jensen-huang-ssi
- J.P. Morgan — The AI-driven memory shortage: https://www.jpmorgan.com/insights/global-research/artificial-intelligence/dram-memory-shortage-from-ai
- Notebookcheck — SK hynix sells out DRAM/NAND/HBM supply through 2026: https://www.notebookcheck.net/SK-Hynix-sells-out-its-DRAM-NAND-and-HBM-chip-supply-to-Nvidia-through-2026-as-AI-demand-outpaces-Samsung-and-Micron.1151402.0.html
- Hermes Agent (Nous Research): https://hermes-agent.org/about/
- Hugging Face 2026 (nguồn thứ cấp, đối chiếu trang chính thức): https://www.theservitor.com/hugging-face/
- Tech.eu — Freepik rebrands as Magnific (28/04/2026): https://tech.eu/2026/04/28/freepik-rebrands-as-magnific-unifying-its-ai-creative-stack-as-enterprise-and-no-collar-growth-accelerates/
- Higgsfield — What is Higgsfield AI (trang của chính hãng = vendor claim): https://geo.higgsfield.ai/what-is-higgsfield-ai
- TopView (nguồn thứ cấp, đối chiếu topview.ai): https://www.stork.ai/en/topview-ai
- Agent Skills / SKILL.md (nguồn thứ cấp, đối chiếu tài liệu chính thức): https://www.noqta.tn/en/news/skill-md-open-standard-30-ai-coding-tools-adoption-2026
- Tổng hợp model 09–10/2026 (nguồn thứ cấp, chỉ dùng để biết cần kiểm tra gì): https://local-ai-zone.github.io/blog/October_2026_AI_Model_Updates.html
- Kinh điển: Vaswani et al. 2017 · Kaplan et al. 2020 · Hoffmann et al. 2022 · Butlin, Long et al. 2023 · METR 2025 · OpenAI Sycophancy in GPT-4o (04/2025) · EU AI Act
