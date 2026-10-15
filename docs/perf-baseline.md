# AI Zen — Đo baseline hiệu năng (spec A.1)

Đo ngày 15/10/2026 trên code `f2f3836` + Perf HUD (commit "perf: baseline + HUD"). Chưa sửa gì về hiệu năng.
Số liệu thô nằm trong `docs/perf-data/`. Cách chạy lại ở cuối file.

## 1. Cách đo

| | |
|---|---|
| Bản đo | `npm run build` (production), phục vụ có gzip + `max-age=600` như GitHub Pages, URL có `?perf=1` |
| Trình duyệt | Chromium 156 headless (Playwright), WebGL bằng GPU thật (ANGLE Metal, Apple M5 Max) |
| **Điện thoại (số chính)** | Giả lập Moto G Power: 412×823 @1.75x, cảm ứng, **CPU 4× chậm** (CDP `Emulation.setCPUThrottlingRate`), mạng **Fast 4G** (9 Mbps / 165 ms RTT). App tự chọn `quality=low` (vì `pointer: coarse`). File `mobile.json` |
| Lặp lại | Kịch bản (c) chạy lần 2 để biết độ nhiễu. File `mobile-repeat.json` |
| Điện thoại, CPU 8× | Như trên, chỉ (c). Máy đo là M5 Max nên 4× vẫn nhanh hơn một Moto G Power thật; 8× gần thực tế hơn. File `mobile-cpu8.json` |
| Desktop | 1440×900 @2x, chuột, không giới hạn, `quality=high` (mốc "rich" của A.10). File `desktop.json` |
| Lấy số | HUD `src/core/perf.ts` qua `window.__aizen.perf`: khoảng cách giữa các frame (rAF), long task (`PerformanceObserver`), WebGL context, số `createStage` chưa dispose, vòng rAF, heap (CDP, sau khi ép GC) |
| Quy thủ phạm | Lần chạy riêng có Chrome trace + lấy mẫu CPU V8 (trace làm chậm nên không lấy FPS từ lần này). File `mobile-trace.json`. Đo: luồng chính theo loại việc, JS theo file/hàm, ai ép tính lại style/layout trong rAF, thời gian bận của tiến trình GPU. Call stack đọc được tên hàm lấy từ dev server: `dev-stacks.json` (chỉ intro + t01–t03) |
| Nhân quả | t13–t17 chạy lại có trace, mỗi lần **tắt một hiệu ứng bằng CSS chỉ trong lúc đo**: blur chuyển scene + chapter · mọi filter trên SVG · backdrop-filter. File `ablate/*.json` |

Định nghĩa các khoảng đo:
- **"Chuyển scene"** = 1,6 s kể từ lúc bấm nút ›, bấm bằng `click()` trong trang ngay trước handler.
- **"Idle"** = 1 s sau đó.
- **"Vào trạm"** = từ lúc chạm (đá trên map) hoặc click (nút › ở scene ensō) đến khi scene đầu có trong DOM.
- **"Chapter"** = 4,2 s thẻ mở đầu trạm.
- **"Frame > 50 ms"** = khoảng cách giữa 2 rAF > 50 ms.

**Giới hạn cần nhớ:**
- CPU throttling chỉ làm chậm luồng chính. **GPU M5 Max không bị làm chậm** và mạnh hơn GPU điện thoại nhiều lần, nên chi phí GPU (blur, backdrop-filter, SVG filter) **không lộ thành frame chậm ở đây**. Chúng chỉ thấy được qua thời gian bận của tiến trình GPU (mục 3).
- Chưa đo trên máy thật (A.1.3). Cần đại ca mở bản deploy với `?perf=1` trên 1 iPhone + 1 Android tầm trung và đọc HUD.
- Số lần "chuyển có frame > 50 ms" dao động mạnh: 20/89 ở lần đầu, 8/89 ở lần lặp. Ở lần đầu có 12 lần chuyển chậm mà không có long task nào; lần lặp, lần 8× và desktop thì gần như không có ca nào như vậy (0, 0, 1). Long task ổn định hơn (tổng 1059 so với 961 ms), nên kết luận dựa chủ yếu vào long task, trace và các lần tắt hiệu ứng.
- Mỗi trace bắt đầu bằng 1 task khoảng 80 ms ("Receive mojo message"). Đó là chi phí của chính Playwright/trace, đã loại khỏi phân tích.

## 2. Số liệu — điện thoại giả lập (CPU 4×, Fast 4G, quality=low)

### (a) Home → map

| Đoạn | FPS | FPS trung vị | Frame dài nhất | Frame > 50 ms | Long task (dài nhất) |
|---|---|---|---|---|---|
| Intro (từ lúc HUD chạy tới load + 5,5 s) | 58,2 | 60 | 150 ms | 1 | 2 (146 ms) |
| Bấm "Bước vào vườn" → map | 59,8 | 60 | 17 ms | 0 | 0 |
| Map đứng yên 3 s | 60 | 60 | 17 ms | 0 | 0 |
| Chạm cát 6 lần | 59,9 | 60 | 17 ms | 0 | 0 |
| Thanh địa chỉ ẩn/hiện (cao −56 px, 6 lần) | 57,8 | 60 | 50 ms | 1 | 1 (52 ms) — **cát vẽ lại 6/6 lần** |

FCP 624 ms · load 1127 ms · JS tải lúc đầu 62 kB (gzip). Long task 146 ms lúc mở trang = chạy module chính (91 ms) + layout.
(Kịch bản (a) được đo lại sau khi sửa cách tính FPS của HUD; xem `meta.aRerun` trong `mobile.json`.)

### (b) Trạm 1, lật hết scene

- Vào trạm (chạm đá → scene): **719 ms**, lần đầu tải three.js.

| Đoạn | Frame dài nhất | Long task | `createStage` sống |
|---|---|---|---|
| Thẻ chapter | 367 ms | 316 ms | 1 |
| → 2 "Một việc, bốn cách" | 167 ms | 156 ms | 1 |
| → 3, → 4 (quiz), → 5 (ensō) | 17 ms | 0 | 0 |

### (c) Đi tuần tự trạm 1 → 18 (89 lần chuyển scene)

| Trạm | Vào (ms) | Chapter: frame max / long task max | Chuyển scene: frame tệ nhất (sang scene) | Số lần chuyển có frame > 50 ms | Long task khi chuyển: số (max) | `createStage` sống max (WebGL chưa thu hồi) |
|---|---|---|---|---|---|---|
| 01 | 719 | 367 / 316 | 167 (→2 Một việc, bốn cách) | 1/4 | 1 (156) | 1 (1) |
| 02 | 290 | 67 / 86 | **233 (→2 Các nhánh)** | 1/3 | 1 (**246**) | 0 |
| 03 | 251 | 33 / 0 | 100 (→2 Phía trước) | 1/4 | 0 | 0 |
| 04 | 253 | 17 / 0 | 83 (→3 Bát ngữ cảnh) | 1/5 | 0 | 0 |
| 05 | 230 | 17 / 0 | 167 (→2 Embedding) | 2/6 | 1 (143) | 1 (1) |
| 06 | 262 | 50 / 52 | 117 (→3 Viên đá nứt) | 2/6 | 1 (69) | 0 |
| 07 | 275 | 50 / 57 | 83 (→2 Sửa ảnh bằng trò chuyện) | 1/6 | 0 | 1 (1) |
| 08 | 239 | 33 / 0 | 50 | 0/7 | 1 (57) | 1 (1) |
| 09 | 272 | 67 / 67 | 33 | 0/5 | 0 | **2 (3)** |
| 10 | 215 | 17 / 0 | 150 (→3 Suối nhạc) | 1/4 | 0 | 0 |
| 11 | 238 | 33 / 0 | 83 (→3 Ai giỏi việc gì) | 1/4 | 0 | 0 |
| 12 | 300 | 83 / 97 | 100 (→3 Sáu quy tắc vàng) | 2/4 | 2 (83) | 0 |
| 13 | 242 | 33 / 0 | 150 (→4 AI 3D) | 2/6 | 1 (127) | 1 (1) |
| 14 | 250 | 50 / 53 | 33 | 0/4 | 1 (52) | 0 (1) |
| 15 | 275 | 183 / 63 | 33 | 0/4 | 0 | 0 (1) |
| 16 | 247 | 33 / 0 | 100 (→4 Mực ẩn) | 1/5 | 0 | 0 (1) |
| 17 | 329 | 133 / 96 | 167 (→2 Đóng hay mở) | 2/5 | 0 | 0 (1) |
| 18 | 259 | 50 / 0 | 183 (→6 Bình minh) | 2/7 | 1 (65) | 0 (1) |

Ghi chú về cột WebGL: từ t14 trở đi, "WebGL chưa thu hồi" = 1 dù không còn `createStage` nào. Đó là context bị rò (xem A.0 dòng 8).

**Tổng hợp 89 lần chuyển:**
- FPS trung vị 59,6 (p10 55,7).
- Frame dài nhất: trung vị 17 ms, p90 117 ms, tệ nhất 233 ms.
- **20/89 lần có frame > 50 ms.** Lần lặp: 8/89 · CPU 8×: 34/89 · desktop: 5/89.
- Long task khi chuyển: 10 cái, tổng 1059 ms.
- Lúc đứng yên trong scene: FPS trung vị 60 ở cả 89 scene, không frame nào > 50 ms.
- Vào trạm: trung vị 256 ms, khoảng 215–719 ms.

**CPU 8×:** long task khi chuyển tổng 4319 ms.

| | Long task lớn nhất |
|---|---|
| Khi chuyển scene | t02 → "Các nhánh" **503 ms** · t01 → scene 2 373 · t12 → 3 259 · t13 → "AI 3D" 246 · t18 → 5 163 |
| Khi vào trạm (chapter) | t01 **641 ms** · t12 240 · t17 185 · t02 161 |

Thẻ chapter: frame dài nhất trung vị 100 ms.

**Bộ nhớ & tài nguyên** (sau khi ép GC; spec A.9):

| Thời điểm | Heap JS | WebGL sống (đã tạo) | `createStage` chưa dispose |
|---|---|---|---|
| Map lúc đầu | 1,9 MB | 0 (0) | 0 |
| Sau trạm 1 | 5,3 MB | 0 (1) | 0 |
| Sau trạm 6 | 8,3 MB | 0 (2) | 0 |
| Sau trạm 12 | 11,4 MB | 0 (7) | 0 |
| Sau trạm 18 | 14,6 MB | **1** (8) | 0 |
| Về map sau khi đi hết | 14,7 MB | **1** | 0 |

Trong các khoảng idle ở t09 (scene 2) có 2 context sống cùng lúc trong khi chỉ 1 `createStage` còn hoạt động. Trên desktop, t09 scene 4–6 có **3 context chưa thu hồi trong khi `createStage` = 0**: `dispose()` không trả context, phải chờ GC.

Vào/ra **cùng một trạm** 5 lần (`leak-pingpong.json`):
- t01: lần đầu +3,5 MB (code three.js + trạm), sau đó trung bình +0,1 MB/lượt (tối đa +0,2).
- t09: lần đầu +0,5 MB, sau đó trung bình +0,1 MB/lượt (tối đa +0,3).
- t02: lần đầu +0,5 MB, sau đó 0.

### (d) Trạm 3D lần đầu, cache trống

| Trạm | Vào (ms) | Long task max | Tải về (gzip, Fast 4G) |
|---|---|---|---|
| t01 (scene 1 là não 3D) | 738 | 318 ms | three-stage 135 kB / 338 ms · t01 26 kB / 226 ms (song song) |
| t09 (scene 1 là 3D) | 500 | 97 ms | three-stage 135 kB / 348 ms · t09 28 kB / 239 ms |
| t13 (3D ở scene 4) | 439 | 0 | three-stage vẫn tải ngay lúc vào trạm (135 kB / 343 ms) |
| t13 → scene 4 "AI 3D" | | 165 ms | |

### (e) Map ↔ trạm, 10 lần (t01, 09, 13, 05, 07, 08, 04, 03, 06, 18)

- Vào trạm: 746 ms (t01, lần đầu tải three), các lần sau 258–335 ms.
- Về map: 61–89 ms, nhưng **mỗi lần về map đều có long task 56–78 ms** (1 lần có 2 long task); frame 50–83 ms.
- Heap 1,9 → 8,1 MB. WebGL sống lúc cuối 0 (đã tạo 4).

### Desktop (1440×900 @2x, quality=high, không giới hạn)

- 5/89 lần chuyển có frame > 50 ms, long task tổng 413 ms.
- **t02 → "Các nhánh" vẫn có long task 224 ms** ngay cả trên desktop.
- Vào trạm: trung vị 32 ms. Map: 60 FPS. Intro: frame dài nhất 50 ms.
- Heap và WebGL rò giống hệt bản điện thoại (14,8 MB; 1 context).

## 3. Trace — thời gian đi đâu (điện thoại, CPU 4×, `mobile-trace.json`)

Đi hết 18 trạm (cửa sổ 312 s, tính cả lúc vào từng trạm):

- **Luồng chính:** bận 44,6 s (14%, trong đó ~1,8 s là chi phí của Playwright).
  - Tính lại style (`UpdateLayoutTree`) 8,5 s
  - Layerize 5,7 s
  - JS chunk chính (GSAP + trình chiếu scene + map) 5,0 s
  - PrePaint 3,5 s
  - Paint 3,3 s
  - Layout 3,0 s
  - Commit 2,0 s
- **Tiến trình GPU:** bận 30,3 s (9,7%). Các trạm nặng nhất cũng là các trạm dùng nhiều SVG filter:
  - t06: 3,4 s / 20,1 s (17%)
  - t15: 2,6 s / 14,8 s (17%)
  - t07: 2,6 s / 20,1 s
  - t13: 2,2 s / 20,3 s
  - t16: 2,1 s / 17,4 s

**Ép tính lại style/layout ngay trong rAF:**

| Ở đâu | Nơi gây ra | Thời gian |
|---|---|---|
| Intro + map (a), dev | `cssVar()` (`src/core/prefs.ts:66`), gọi 2 lần mỗi frame trong `intro.frame()` | **474 ms** |
| Intro + map (a), dev | GSAP `_getComputedProperty` (khởi tạo tween đọc style) | 139 ms + 25 ms layout |
| Intro + map (a), dev | `map.ts` (dựng map trong rAF của ResizeObserver) | 48 ms |
| Intro + map (a), bản build | chunk chính (gồm cả hai nguồn trên) | 523 ms style + 37 ms layout |
| Cả lượt 18 trạm, bản build | chunk chính (GSAP ticker; ở t01–t03 có call stack: đều là `_getComputedProperty`) | 737 ms style + 374 ms layout |

Theo từng trạm, phần lớn trạm tốn 17–53 ms. Riêng **t17 181 ms** và **t11 81 ms**, chưa có call stack.

**Các long task lớn nhất khi vào trạm / chuyển scene** (JS theo hàm):

| Long task | Thời gian | Thành phần chính |
|---|---|---|
| t02 → "Các nhánh" | 296 ms (build) · 325 ms (dev) | `paint.ts · blotch` 65 ms, `drawImage` 31–36, `fill` 25–36, GC 28–37: vẽ mực lên canvas đồng bộ lúc mount |
| Vào t01 lần đầu | 373–378 ms | code dựng não-cát của t01 ~180 ms (`ae`, `ie`, …), `clearRect` 21. Parse three.js nhỏ |
| t01 → scene 2 | 184 ms (build) · 260 ms (dev) | `stone.ts · paintStone` 34, `ladder.ts · paint` 20, GSAP `_getComputedProperty` 41 (dev) |
| t13 → "AI 3D" | 178–185 ms | code t13 ~24 ms, `getProgramInfoLog` (biên dịch shader) 18 ms, three.js 10–17 ms |
| Vào t12 / t02 / t17 / t15 / t09 | 91–113 ms | chạy module trạm + mount scene đầu |
| Mỗi lần về map | 84–92 ms (có trace) | JS dựng map ~45 ms (`layout()` + `drawSand()` + tween xuất hiện), style 17 + layout 10 ms, đo `offsetWidth` nhãn ~10 ms, GSAP `getBBox` 4–6 ms |

Biên dịch shader trên máy đo nhỏ: `getProgramInfoLog` tổng 48 ms cho cả lượt đi.

**Tắt từng hiệu ứng, t13–t17** (cùng điều kiện, có trace):

| Lần chạy | Tiến trình GPU | Viz | Luồng chính | Paint + PrePaint | Lần chuyển có frame > 50 ms |
|---|---|---|---|---|---|
| Nguyên bản | 10,27 s | 0,98 s | 12,1 s | 1,95 s | 2/24 |
| Tắt blur chuyển scene + chapter | 10,18 s (−1%) | 0,90 s | 11,4 s | 1,74 s | 2/24 |
| **Tắt mọi filter trên SVG** | **6,03 s (−41%)** | 0,91 s | 10,9 s | 1,67 s | 1/24 |
| Tắt backdrop-filter | 10,20 s (−1%) | 0,79 s (−19%) | 13,7 s | 2,19 s | 2/24 |

Theo từng trạm, khi tắt filter SVG:
- t15: 2,46 → 0,90 s (−63%)
- t16: 2,15 → 0,93 s (−57%)
- t13: 2,07 → 1,21 s (−42%)
- t17: 1,76 → 1,40 s (−20%)
- t14: 1,83 → 1,59 s (−13%)

Lần tắt này tắt **mọi** filter trên SVG, gồm cả filter mực (`feTurbulence`) và các filter glow/halo dùng `feGaussianBlur`. Luồng chính ở cả 3 lần đều chỉ đổi trong mức nhiễu.

## 4. Đối chiếu bảng A.0

| # | Nghi vấn | Kết luận | Bằng chứng |
|---|---|---|---|
| 1 | Blur cả scene khi chuyển, 2 scene cùng blur | **Chưa rõ** | Code đúng như mô tả: blur 6 px scene cũ (0,55 s) + 8 px scene mới (bắt đầu sau 0,25 s), hai scene cùng bị blur khoảng 0,3 s; chapter blur 10 px. Tắt hẳn blur: GPU −1%, số lần chuyển chậm không đổi (2/24). Ở 3/4 lần chạy, lần chuyển chậm hầu như luôn trùng long task do JS lúc mount. Chi phí GPU của blur M5 Max nuốt được, nên cần đo trên điện thoại thật |
| 2 | Scene cũ chưa dọn đã mount scene mới; 2 WebGL context + 2 vòng rAF chồng | **Xác nhận** | Scene mới mount ngay khi scene cũ còn fade, nên long task lúc mount rơi đúng giữa hiệu ứng: t02 246 ms (8×: 503), t01 156 (373), t05 143, t13 127 (246). Ở t09 có **2 `createStage` sống cùng lúc** khi chuyển và tới **3 WebGL context chưa thu hồi**, vì `dispose()` không trả context. Biên dịch shader trên máy đo nhỏ (≤ 18 ms/lần); trên điện thoại sẽ lớn hơn |
| 3 | SVG filter `feTurbulence + feDisplacementMap` | **Xác nhận (GPU)** | Code: 504 chỗ `filter=url(#…)`, 24 filter tự định nghĩa trong trạm + 3 filter dùng chung (`ui/ink.ts`), 4 filter `numOctaves: 3`. Tắt filter SVG: **GPU −41%** (t15 −63%, t16 −57%). t06 và t15 có GPU bận 17% thời gian. Luồng chính gần như không đổi, nên trên máy đo không thành frame chậm, nhưng đây là chi phí GPU lớn nhất và là nguy cơ chính trên điện thoại |
| 4 | `backdrop-filter: blur()` 34 chỗ | **Chưa rõ** | 34 dòng = **17 quy tắc** (mỗi quy tắc viết 2 lần, có tiền tố `-webkit-`). Tắt hết: GPU −1%, Viz −19% (0,19 s / 5 trạm). Trên Chromium + GPU mạnh thì nhỏ; trên Safari iOS chưa đo được |
| 5 | Map vẽ lại cát khi thanh địa chỉ ẩn/hiện | **Xác nhận** | 6/6 lần đổi chiều cao đều vẽ lại cát (frame dài nhất 50 ms, 1 long task 52 ms ở 4×, quality=low DPR 1; chưa đo ở high). Thêm điều spec chưa ghi: **mỗi lần mount map, `layout()` + `drawSand()` chạy 2 lần** (gọi trực tiếp + callback đầu tiên của ResizeObserver; lần mở trang đầu: 3), xem `loops-check.txt`. Lần 2 thay toàn bộ đá/nhãn, nên tween xuất hiện của lần 1 chạy trên phần tử đã bị gỡ. Mỗi lần về map đều có long task 56–78 ms (JS dựng map + vẽ cát ~45 ms, phần còn lại là style/layout) |
| 6 | `cssVar()` (`getComputedStyle`) trong vòng frame | **Xác nhận** | Intro: `cssVar` ép tính lại style **474 ms** ngay trong rAF (dev); bản build: 523 ms trong (a). Cả lượt 18 trạm: 737 ms style + 374 ms layout bị ép trong rAF, ở chunk chính (phần có call stack là GSAP đọc computed style; t17 181 ms chưa rõ nguồn). Tính lại style là việc tốn nhất của luồng chính (8,5 s) |
| 7 | Chunk `three-stage` 562 KB tải lúc vào trạm 3D đầu | **Xác nhận một phần** | 562 KB thô = **135 kB gzip**, tải 338–348 ms trên Fast 4G (song song với chunk trạm). Scene 1 của trạm 1 là não 3D nên khách nào cũng gặp ở trạm đầu: vào t01 719–746 ms, các trạm khác 215–335 ms. Long task 315–326 ms lúc vào t01 chủ yếu là code dựng não-cát của t01; parse three.js không phải phần chính. t13 tải three ngay lúc vào dù 3D ở scene 4 |
| 8 | Rò rỉ tích luỹ (listener, rAF, tween, Matter) | **Xác nhận một phần** | Heap sau GC 5,3 → 14,7 MB qua 18 trạm, phần lớn là code/dữ liệu trạm tải lần đầu (vào lại cùng trạm: trung bình +0,1 MB/lượt, tối đa +0,3). **1 WebGL context không bao giờ được giải phóng** (`glAlive` = 1 sau GC, mọi `createStage` đã dispose): bản build thấy sau khi qua t13 scene 4, dev thấy cả sau t09, nên nguồn chưa chắc. **Không rò vòng rAF**: ticker GSAP tự ngủ trong ≤ 6 s sau khi về map; vòng thường trực duy nhất là `_rafBugFix` của ScrollTrigger (đăng ký toàn cục dù chỉ `#/logos` dùng) (`loops-check.txt`). Các snapshot ghi 2 vòng đều chụp < 4,5 s sau khi về map, lúc GSAP còn chạy hiệu ứng xuất hiện. Không thấy FPS tụt dần theo thời gian. Matter.js t04: chưa thấy dấu hiệu |

## 5. Năm thủ phạm lớn nhất (theo số đo)

1. **Việc nặng chạy đồng bộ lúc mount trạm/scene, trúng ngay giữa hiệu ứng chuyển.**
   - Gồm: vẽ canvas mực, dựng hình, GSAP đọc style.
   - Ở 4×: vào t01 316 ms · t02 → "Các nhánh" 246 ms (desktop vẫn 224 ms) · t01 → 2 156 ms · t05 143 ms · t13 127 ms.
   - Ở 8×: long task khi chuyển scene tổng 4,3 s, lớn nhất 503 ms; vào t01 641 ms.
   - Đây là nguồn chính của cảm giác "lâu lâu hơi lag" đo được.
2. **SVG filter là chi phí GPU lớn nhất.**
   - Tắt đi thì GPU giảm 41% (có trạm giảm 63%).
   - t06/t15 có GPU bận 17% thời gian.
   - Trên GPU điện thoại đây là rủi ro lớn nhất, dù máy đo chưa thấy thành frame chậm.
3. **Ép tính lại style/layout trong vòng frame.**
   - `cssVar` trong intro: 474 ms.
   - 737 ms style + 374 ms layout qua 18 trạm (GSAP đọc computed style; t17 181 ms).
   - Tính lại style chiếm nhiều nhất ở luồng chính (8,5 s).
4. **Vòng đời WebGL.**
   - `dispose()` không trả context: tới 3 context chờ GC, 2 `createStage` chồng nhau khi chuyển; 1 context không bao giờ được trả.
   - three.js (135 kB gzip) tải ngay ở trạm 1, thêm khoảng 340 ms trên 4G; t13 cũng tải ngay khi vào trạm.
5. **Map dựng lại thừa.**
   - Mỗi lần mount: `layout()` + vẽ cát chạy 2 lần.
   - Mỗi lần đổi chiều cao: vẽ lại cát.
   - Mỗi lần về map: long task 56–78 ms.

Chưa kết luận được trên máy đo, cần đo trên điện thoại thật bằng `?perf=1`: blur khi chuyển scene (A.0 #1) và backdrop-filter (A.0 #4).

## 6. Hiện trạng so với tiêu chí A.10 (để Prompt 2 so sánh)

| Tiêu chí | Hiện tại (4×, low) | Đạt? |
|---|---|---|
| Chuyển scene ở `calm`: không frame nào > 50 ms | 8–20/89 lần chuyển có frame > 50 ms (8×: 34/89) | Chưa |
| Map đứng yên + chạm cát: FPS trung vị ≥ 55 | 60 / 60 | Đạt |
| Vào trạm đã prefetch < 300 ms | Chưa có prefetch; trung vị 256 ms, t01 719 ms, t12 300, t17 329 | Chưa |
| Trạm 3D đầu tiên không có long task > 200 ms | t01: 315–326 ms | Chưa |
| A.9: heap cuối ≤ heap sau trạm 1 + 25% | 14,7 MB so với giới hạn 6,6 MB (phần lớn là code trạm, xem A.0 dòng 8) | Chưa |
| A.9: WebGL sống ≤ 1 lúc đứng yên | t09: 2–3 context chờ GC lúc idle; map sau khi đi hết: 1 context bị rò | Chưa |
| A.9: số vòng rAF = vòng của scene hiện tại | +1 vòng ScrollTrigger thường trực | Chưa |
| Desktop `rich` không tệ hơn baseline | baseline = số desktop ở trên | — |
| Build + typecheck sạch VI/EN | Sạch | Đạt |

## 7. Chạy lại

```bash
npm run build
node scripts/perf-walk.mjs                                   # a–e, điện thoại giả lập → docs/perf-data/mobile.json
node scripts/perf-walk.mjs --profile desktop                 # desktop, quality=high
node scripts/perf-walk.mjs --only c --cpu 8                  # đi 18 trạm ở CPU 8×
node scripts/perf-walk.mjs --only a,c,d,e --trace            # + quy thời gian về luồng chính / JS / GPU
node scripts/perf-walk.mjs --only c --stations 13-17 --trace --ablate svgfilter   # tắt 1 hiệu ứng khi đo
node scripts/perf-walk.mjs --only e --pingpong 1,1,1,1,1 --settle-each           # vào/ra 1 trạm, heap sau mỗi lượt
```

Trên điện thoại thật: mở bản deploy với `?perf=1` (ví dụ `…/ai-zen/?perf=1#/vuon`). HUD góc dưới trái hiện:
- FPS 1 s, frame dài nhất trong 5 s
- Số long task (5 s / tổng)
- WebGL context sống (`stage` = số `createStage` chưa dispose)
- Số vòng rAF
- Heap JS (chỉ Chrome)
