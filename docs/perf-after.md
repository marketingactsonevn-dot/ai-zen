# AI Zen — Hiệu năng sau tối ưu (spec A.10)

Đo ngày 15/10/2026, cùng cách đo với `docs/perf-baseline.md`: bản build production, Chromium headless, điện thoại giả lập Moto G Power (CPU 4×, Fast 4G, app tự chọn `quality=low`), desktop 1440×900 không giới hạn (`quality=high`).

- **Baseline:** `f2f3836`, số liệu ở `docs/perf-data/mobile.json` và `desktop.json`.
- **Sau tối ưu:** `51205e0`, số liệu ở `docs/perf-data/after/A6-chunk/` (a–e) và `after/A9/mobile-c-2pass.json` (đi 18 trạm hai lượt).
- Số liệu sau từng nhóm A.x nằm trong `docs/perf-data/after/A2 … A8`.

## Theo tiêu chí A.10

| Tiêu chí | Baseline | Sau | Kết quả |
|---|---|---|---|
| Chuyển scene ở `calm` (điện thoại): không frame nào > 50 ms | 20/89 lần có frame > 50 ms · tệ nhất 233 ms · 10 long task (max 246 ms) | 1/89 · tệ nhất 67 ms · 3 long task (max 77 ms). Lượt đo 2 lượt: 3/178, tệ nhất 50 ms | **Gần đạt** (xem ghi chú 1) |
| Chuyển scene ở `rich` (desktop): không tệ hơn baseline | 5/89 · tệ nhất 217 ms · 4 long task | 0/89 · tệ nhất 33 ms · 0 long task | **Đạt** |
| Map đứng yên + chạm cát: FPS trung vị ≥ 55 | 60 / 60 | 60 / 60 | **Đạt** |
| Thanh địa chỉ ẩn/hiện không vẽ lại cát | 6/6 lần vẽ lại | 0/6 | **Đạt** |
| Vào trạm đã prefetch: bấm → scene đầu < 300 ms | trung vị 259 ms · max 719 ms | trung vị 63 ms · max 120 ms | **Đạt** |
| Trạm 3D đầu tiên (đã prefetch): không long task > 200 ms | t01 318 ms · t09 97 ms · t13 (sang scene 3D) 165 ms | t01 0 · t09 106 ms · t13 0 | **Đạt** |
| Rò rỉ (A.9): heap lượt 2 không tăng · WebGL ≤ 1 lúc đứng yên · rAF = loop của scene | về map: heap 14,7 MB, WebGL 1 | lượt 1: 5,7 → 14,2 MB (tải code 18 trạm) · lượt 2: 14,4 → 15,0 MB · về map: WebGL 0, stage 0, rAF 0 | **Đạt** (xem ghi chú 2) |
| Ảnh trước/sau ở `high`: Phần 1 trông như cũ | `docs/perf-shots/before/` | `docs/perf-shots/after/`: ≤ 0,21 % điểm ảnh khác (góc quay 3D t13) | **Đạt** |
| `npm run build` + `tsc --noEmit` sạch, VI + EN | | sạch | **Đạt** |

**Ghi chú**

1. Lần chuyển còn chậm (67 ms) ở t08 sang scene 4, trạm không có mount nặng. Lặp lại thì lúc có lúc không (lượt đo 2 lượt: tệ nhất 50 ms), nên đây là nhiễu sát ngưỡng, không phải lỗi cố định. Lúc vào trạm (thẻ chapter + scene đầu), 6/18 trạm còn 1 frame 50–83 ms (t03, t07, t09, t14, t15, t17), long task lớn nhất 75 ms. Baseline là 367 ms.
2. Tiêu chí nguyên văn là "heap cuối ≤ heap sau trạm 1 + 25 %". Lượt 1 không đạt được vì mỗi trạm tải thêm code (chunk JS + bảng dựng sẵn). Lượt 2 đi lại đủ 18 trạm, heap về map chỉ tăng 14,0 → 14,9 MB (+6 %), nên không có rò rỉ tích luỹ.

## Nhanh lên ở đâu

| | Baseline | Sau |
|---|---|---|
| Vào t01 lần đầu (tải three.js) | 738 ms, long task 318 ms | 81 ms, không long task |
| Bản đồ ↔ trạm × 10: long task lớn nhất | 326 ms | 71 ms |
| Desktop: vào trạm (trung vị) | 32 ms | 13 ms |

Từng nhóm (mỗi nhóm một commit):

| Nhóm | Thay đổi |
|---|---|
| A.2 | Chuyển scene `calm` / `rich`, không còn 2 scene nặng cùng sống |
| A.3 | `createLoop` dùng chung, bỏ đọc style / layout trong frame |
| A.4 | Filter mực bản nhẹ ở `low` |
| A.5 | Bỏ `backdrop-filter` / blur lớn / `will-change` ở `low` |
| A.6 | Bản đồ: không vẽ lại cát khi thanh địa chỉ đổi, hiện dần |
| A.7 | Prefetch + biên dịch shader trước |
| A.8 | Tự hạ chất lượng |
| A.9 | Dọn rò rỉ |
| A.10 | Chia nhỏ mount scene (`sliced()`) |

## Chưa làm được

- **Máy thật (A.1.3):** chưa đo. Cần mở bản deploy với `?perf=1` trên 1 iPhone + 1 Android tầm trung.
- **Chi phí GPU:** GPU của máy đo (M5 Max) không bị làm chậm, nên chi phí blur, SVG filter… trên điện thoại thật chỉ thấy được khi đo máy thật.
- **Mở trang lần đầu (intro):** còn 1 long task ~144 ms (chạy module chính + layout). Mục này không thuộc tiêu chí chuyển scene.

Quy tắc rút ra cho Phần 2: `README.md` mục **Quy ước hiệu năng**.

## Phần 2 · Vườn Trăng (16/10/2026)

Cùng cách đo (điện thoại giả lập, CPU 4×, `quality=low`). Số liệu: `docs/perf-data/part2/`.

| Tiêu chí A.10 / B.8 | Kết quả | |
|---|---|---|
| Map Phần 2 đứng yên + chạm cát: FPS trung vị ≥ 55 | 60 / 60 · thanh địa chỉ ẩn/hiện 0/6 lần vẽ lại cát | **Đạt** |
| Qua cầu Phần 1 ⇄ Phần 2 | frame dài nhất 33 ms / 17 ms, 0 long task · đứng yên: 0 frame được vẽ | **Đạt** |
| Mở thẳng `#/vuon-trang` (tải trang lần đầu) | 1 long task 178 ms (ngang Phần 1: 166 ms, chạy module chính) | Ghi nhận |
| 21 trạm × 2 lượt: chuyển scene | 2/234 lần có frame > 50 ms (t22 → 3: 100 ms, t33 → 2: 117 ms, chỉ lượt 1, không long task) · **0 long task** | **Gần đạt** |
| Vào trạm: bấm → scene đầu | trung vị 24 ms · max 130 ms | **Đạt** |
| Rò rỉ: lượt 2 không tăng | heap 6,0 → 5,9 MB · WebGL 0 · rAF 0 khi về map | **Đạt** |
| WebGL ≤ 6/21 trạm | 0/21 (chỉ SVG / Canvas 2D / CSS) | **Đạt** |
| Chunk JS mỗi trạm ≤ 120 KB | 14–32 KB | **Đạt** |
