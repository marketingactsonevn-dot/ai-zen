# AI Zen — Hiểu AI để dùng AI đúng cách

Một "bảo tàng tương tác trong vườn đá" giúp người mới hiểu AI: AI là gì, chatbot viết chữ thế nào, AI tạo ảnh / video / 3D hoạt động ra sao, giao việc gì cho AI nào, cách viết prompt, AI agent & MCP, các công ty AI và tác động thật của AI.
Hai phần trong cùng một khu vườn:
- **Phần 1 · Vườn Ngày** (6 vườn, trạm 01–18): hiểu AI để dùng AI đúng cách.
- **Phần 2 · Vườn Trăng** (7 vườn, trạm II·01–II·21, id nội bộ 19–39): hiểu sâu bên trong, thấy rộng bên ngoài, tự tay làm được. Sang Phần 2 qua cây cầu cuối lối đá Phần 1.

Tổng cộng 13 vườn · 39 trạm · từ điển chung có bộ lọc theo phần · bài thi + chứng nhận riêng cho từng phần · túi đồ nghề. Bản tiếng Việt ở `/`, bản tiếng Anh ở `/en/` (cùng route).

## Chạy

```bash
npm install
npm run dev        # bản tiếng Việt — http://localhost:5179 (theo .claude/launch.json) hoặc cổng Vite mặc định
npm run dev:en     # bản tiếng Anh — http://localhost:5180
npm run build      # build cả hai bản vào dist/ (tiếng Anh ở dist/en/)
npm run preview
```

Vite + TypeScript, Three.js, Matter.js, GSAP. Không backend, không API key.

## Cấu trúc

- `src/content/*.json` — toàn bộ chữ và dữ liệu (tiếng Việt); `*.en.json` là bản tiếng Anh cùng cấu trúc. Mỗi dữ kiện có `asOf` và `source`.
- `src/stations/tNN/` — 39 trạm, mỗi trạm là chuỗi cảnh toàn màn hình (`scenes`). `registry.ts` tự nhận mọi thư mục `tNN/index.ts`; trạm chưa có thư mục hiện "Đang dựng".
- `src/ui/part2/` — thành phần dùng chung của Phần 2 (vòng đá góc nhìn, thuỷ triều tiến triển, bảng tin trên đá, thẻ mang về, lối đá từng bước, cuộn mã, dấu độ tin cậy ● ◐ ○ ◇). API: `src/ui/part2/README.md`, kiểu dữ liệu: `types.ts`.
- `src/content/news.json` (bảng tin), `toolkit.json` (thẻ mang về), `exam-2.json` (bài thi Vườn Trăng); `node scripts/check-content.mjs` kiểm mọi fact có `asOf` + nguồn tra được.
- `src/ui/` — khung: bản đồ vườn (`map.ts`), trình chiếu cảnh (`station.ts`), câu đố, logo, từ điển & bài thi (`src/extras/`).
- `public/logos/` — logo chính thức các công ty + `logos.json` ghi nguồn từng file.

Route: `#/` intro → `#/vuon` (map Phần 1) · `#/vuon-trang` (map Phần 2) · `#/tram/1…39` · `#/tu-dien` · `#/bai-thi` · `#/bai-thi-trang` · `#/do-nghe`.

Dữ liệu tra cứu đến 12/10/2026 (Phần 1) và 15/10/2026 (Phần 2) — AI thay đổi theo tuần, hãy kiểm tra lại các con số trước khi dùng.
Logo và thương hiệu thuộc về chủ sở hữu tương ứng; dùng cho mục đích giáo dục.

## Quy ước hiệu năng

Đo bằng `?perf=1` (HUD góc dưới trái) và `scripts/perf-walk.mjs`; số liệu trong `docs/perf-baseline.md`, `docs/perf-after.md`.

- **Vòng frame:** chỉ chạy qua `createLoop(host, fn)` (`src/core/loop.ts`). Vòng này tự dừng khi `host` ra khỏi màn hình, khi tab ẩn và khi bật reduced motion (trừ `{ essential: true }`). Dọn nó khi scene unmount. Không tự viết vòng `requestAnimationFrame` hay `gsap.ticker.add`.
- **Trong callback của frame, cấm:**
  - `getComputedStyle` / `cssVar()`;
  - `getBoundingClientRect` / `offsetWidth` …;
  - tạo mảng/object mới mỗi frame.

  Thay vào đó: đọc màu lúc mount và trong `onPrefs`, đọc kích thước trong `ResizeObserver`.
- **SVG filter:** không animate trực tiếp phần tử có filter (`filter="url(#…)"`). Animate `<g>` cha bằng transform/opacity, đặt filter ở phần tử con tĩnh, hoặc chỉ animate `stroke-dashoffset` của mask như ensō.
  - Filter nhiễu tự định nghĩa dùng `numOctaves: octaves(n)` (`src/ui/ink.ts`): ở `quality=low` chỉ còn 1 octave.
- **Ở `quality=low`:**
  - không dùng `backdrop-filter` (thay bằng nền giấy đặc hơn);
  - không đặt `filter: blur()` lớn trên phần tử to;
  - không khai báo `will-change` cố định cho phần tử chạy bằng CSS animation.
- **Chuyển scene:** scene cũ fade-out → dọn → mount scene mới → fade-in (WAAPI). Không bao giờ để 2 scene nặng cùng sống.
  - `calm` (cảm ứng / low): chỉ opacity + transform.
  - `rich`: thêm blur ≤ 3 px cho scene mới.
- **WebGL:** chỉ tạo qua `createStage`.
  - `dispose()` trả context ngay (`forceContextLoss`).
  - Shader được biên dịch bất đồng bộ trước frame đầu.
- **Tải trước:** bản đồ rảnh → tải trạm kế + three.js (trừ khi tiết kiệm dữ liệu / 2g / 3g); chạm/rê vào đá → tải trạm đó; scene ensō → tải trạm sau.
- **Mount scene ≤ 50 ms ở CPU 4×** (lỗi Phần 1 phải sửa lại 22 file, A.10):
  - Việc nặng (vẽ canvas, dựng nhiều SVG, tạo WebGL) viết thành generator và chạy bằng `sliced()` (`src/core/chunk.ts`), `sync: ctx.reduced`. Hoặc dời `layout()` sang rAF đầu tiên.
  - Chỉ **lần vẽ đầu** được hiện dần. Vẽ lại (layout lại, đổi theme) thì vẽ một lượt, hoặc vẽ vào canvas tách rời rồi `drawImage`. Không xoá canvas đang hiện rồi vẽ dần (đá nhấp nháy).
  - Mọi việc hoãn (rAF, `requestIdleCallback`, `sliced`) đăng ký huỷ bằng `ctx.onCleanup` ngay lúc tạo.
  - `onPrefs` / listener đăng ký **trước** `yield` đầu tiên, nếu không đổi theme giữa chừng sẽ bị mất.
  - `onPrefs` chạy cả khi đổi âm thanh / quality: so màu cũ trước khi vẽ lại.
  - `aria-live` chỉ gắn sau khi đã điền nội dung lần đầu, nếu không trình đọc màn hình đọc lại mỗi lần vào scene.
  - `ResizeObserver` luôn báo lần đầu: đừng gọi `layout()` thêm lần nữa trong cùng frame.
  - Đo kích thước (`offsetWidth`, `getBoundingClientRect`…) **gom một lượt trước khi ghi DOM**, không đo xen trong vòng lặp đang thêm phần tử. Mỗi lần đọc sau khi ghi là một lần layout: map Phần 2 mất ~20 ms (CPU 4×) chỉ vì 7 lần đo tên vườn.
  - Chữ đo lúc mount có thể chưa có font: nếu `document.fonts.status !== 'loaded'` thì `document.fonts.ready.then(...)` đo lại (huỷ khi unmount).
  - Bảng noise / sprite / gradient dựng một lần ở module, không dựng lại mỗi lần gọi. Lần `measureText` đầu của mỗi font tốn ~25 ms: làm ấm trong `requestIdleCallback`.
- **Trạm mới chỉ xong khi** (B.8):
  - `npm run build && node scripts/perf-walk.mjs --only c --stations N-N`: không long task, không frame > 50 ms khi vào trạm và khi chuyển scene.
  - `--passes 2`: heap lượt 2 không tăng, WebGL ≤ 1, rAF loop = số loop của scene hiện tại.
  - `perf-shots` ở `high` và `low` nhìn đúng; chạy được ở `calm` + `low` + reduced motion.

## Bảo trì tin tức (hằng tháng)

Tin AI cũ đi rất nhanh, nên mọi tin nằm trong `src/content/news.json` (+ `.en.json`) và dữ liệu `tide` của các trạm, không viết cứng trong code.
- Thêm tin mới có nguồn; đánh dấu tin đã bị phủ nhận / đính chính; tuyên bố của chính công ty ghi `claimBy`, có bên độc lập xác nhận thì thêm `verifiedBy`.
- Cập nhật số liệu hay đổi (vốn hoá, giá RAM, số model, model mới nhất) và `asOf` trong `news.json` / `site.json`.
- Chạy `node scripts/check-content.mjs` rồi `npm run build`. Bia tin cũ hơn 6 tháng tự phủ rêu.

## Deploy

```bash
npm run deploy     # build cả hai bản rồi đẩy dist/ lên nhánh gh-pages → GitHub Pages
```

GitHub Pages lấy nguồn từ nhánh `gh-pages` (thư mục gốc). Bản tiếng Việt ở `/ai-zen/`, bản tiếng Anh ở `/ai-zen/en/`.
