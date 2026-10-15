# AI Zen — Hiểu AI để dùng AI đúng cách

Một "bảo tàng tương tác trong vườn đá" giúp người mới hiểu AI: AI là gì, chatbot viết chữ thế nào, AI tạo ảnh / video / 3D hoạt động ra sao, giao việc gì cho AI nào, cách viết prompt, AI agent & MCP, các công ty AI và tác động thật của AI.
6 khu vườn · 18 trạm · từ điển thuật ngữ · bài thi cuối có chứng nhận. Bản tiếng Việt ở `/`, bản tiếng Anh ở `/en/`.

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
- `src/stations/tNN/` — 18 trạm, mỗi trạm là chuỗi cảnh toàn màn hình (`scenes`).
- `src/ui/` — khung: bản đồ vườn (`map.ts`), trình chiếu cảnh (`station.ts`), câu đố, logo, từ điển & bài thi (`src/extras/`).
- `public/logos/` — logo chính thức các công ty + `logos.json` ghi nguồn từng file.

Dữ liệu tra cứu đến 12/10/2026 — AI thay đổi theo tuần, hãy kiểm tra lại các con số trước khi dùng.
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

## Deploy

```bash
npm run deploy     # build cả hai bản rồi đẩy dist/ lên nhánh gh-pages → GitHub Pages
```

GitHub Pages lấy nguồn từ nhánh `gh-pages` (thư mục gốc). Bản tiếng Việt ở `/ai-zen/`, bản tiếng Anh ở `/ai-zen/en/`.
