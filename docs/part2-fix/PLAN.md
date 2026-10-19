# Part 2 fix · PLAN

Mỗi phase: làm → `npm run build` → perf-walk (README) → `node scripts/part2-shots.mjs` cho slide đã đụng → commit → push → báo cáo → **dừng chờ duyệt**. Đánh dấu `[x]` ở đây khi xong.

## Phase 0 · Chuẩn bị (ngắn)
- [x] `npm ci`, `npx playwright install chromium`, chạy `npm run build` + `npm run dev` xác nhận app lên. *(cloud: dùng Chromium cài sẵn ở `/opt/pw-browsers`, không tải lại)*
- [x] Chụp baseline Part 2 bằng `scripts/part2-shots.mjs` (giữ local, không commit ảnh nặng). *(thêm chế độ `--slides 19-39 --label baseline --quiz`: 138 scene × desk-dark/phone-light, cùng khung ảnh audit; `docs/part2-shots/slides/baseline/` nằm trong .gitignore)*

## Phase 1 · Khung chung (lợi cho cả 96 slide)
- [x] Sửa `src/ui/station.ts:153`: prompt không ẩn khi chạm hụt; prompt đổi theo bước (H5). *(chỉ Phần 2; `ctx.prompt(text, 'wrong'|'ok')` cho H6)*
- [x] Bộ dấu hướng dẫn H1–H7 dùng chung (dựa trên `src/ui/hint.ts`, mẫu tốt: vầng thở 23-3, `frameHint` 36-2, cung vạch 38-2, chấm thở 36-4). Slide chỉ khai báo. *(`src/ui/part2/guide.ts`, thử ở `#/tram/99/9`; gắn vào từng slide ở phase 2/4)*
- [x] Hẹn giờ đứng yên 6 s → gợi ý lại thay vì chỉ tắt chuyển động (`lantern.ts:610`, `t24/kit.ts:53`, `t23/lit.ts:487`). *(khung lo cho mọi scene Phần 2: `.is-idle` + prompt trở lại + sự kiện `p2:idle`; 3 hẹn giờ cũ chỉ còn lo chuyển động sống)*
- [x] Vùng chữ định sẵn (đối diện hero); thẻ mang về thu thành vật nhỏ, chạm mới mở. *(`SceneDef.text` / `ctx.textZone`; `foldedTakeaway` trong stepPath + bia t19; khai báo vùng từng slide ở phase 4)*
- [x] Màn quiz chung vẽ lại (bỏ 4 viên đá xám kiểu nút) + xáo đáp án, đáp án đúng không luôn dài nhất. *(`src/ui/part2/quiz.ts`; độ dài đáp án là câu chữ → phase 3, `check-content` báo 18/21)*
- [x] Nhãn tin cậy (theo audit v2). *(câu tóm AI Zen = ấn triện "AI Zen tóm lại"; chữ dùng chung A.9 trong site.json + en)*

## Phase 2 · 30 slide P1 (dạy sai / chặn chơi)
Theo bảng ở `docs/part2-audit/README.md` (ô **P1**). Đi theo vườn, mỗi vườn một commit:
- [x] Vườn 7 (t19–21) · [x] 8 (t22–24) · [x] 9 (t25–27) · [x] 10 (t28–30) · [x] 11 (t31–33) · [x] 12 (t34–36) · [x] 13 (t37–39)
  *(30 slide P1 + lỗi chặn v2 §C: 20-4, 21-3, 22-2, 25-2, 27-3, 33-2, 34-3, 35-5, 39-3, 39-4, 39-5. Ảnh sau: `docs/part2-shots/slides/after/tNN-K-{d,p}.jpg`, ảnh trước: `docs/part2-audit/all/`. Khung thêm: prompt dài xuống dòng, hook `stepPath.onWrong`, `perspectiveCircle.name`. Còn để phase 4: vẽ lại, bố cục phone; hook cần thêm: điểm dừng từng mốc + eyebrow riêng cho `progressTide`, `inkStage` đảo chiều kéo dọc, `g.drop` theo vật chạy cùng camera.)*

## Phase 3 · Câu chữ + logic thông tin (mục A, B)
- [ ] Thay copy JSON theo câu viết sẵn trong `toan-bo-21-tram.md` (kicker, tóm tắt, thẻ, prompt, insight, quiz, ensō). VI trước, EN dịch theo sau.
- [ ] Sửa thứ tự thông tin: insight sau bằng chứng, không lộ đáp án sớm, quiz khớp bài.

## Phase 4 · Vẽ lại + cân bố cục + 31 slide Làm lại
Ưu tiên slide thẩm mỹ ≤ 2 (22 slide, mục E) rồi cân bằng ≤ 2 (37 slide, mục F); gộp chung khi cùng slide. Theo vườn, mỗi vườn một commit, kèm ảnh trước/sau:
- [ ] Vườn 7 · [ ] 8 · [ ] 9 · [ ] 10 · [ ] 11 · [ ] 12 · [ ] 13 (nước luôn tối hơn trời; bình minh là nắng sượt)
- [ ] Phone bố cục lại riêng, không chỉ thu nhỏ.

## Phase 5 · Cắt gộp + QA cuối
- [ ] Cắt/gộp theo audit (19-3, 28-6, 32-6, 33-5…) → ~87 slide; cập nhật số slide, tiến độ, ensō.
- [ ] Kiểm các mục audit chưa kiểm: desk-light, phone-dark, low quality, reduced motion, bản EN.
- [ ] Perf-walk toàn Part 2, cập nhật `docs/qa-v2.md`. Chờ chủ app duyệt rồi mới `npm run deploy`.

## Ghi chú đo đạc (Phase 0)
- Máy cloud không GPU, CPU chậm hơn máy gốc: perf-walk ở đây cho Phần 1 (t01–06) 23/28 lần chuyển có frame > 50 ms (máy gốc ~1/89, `docs/perf-after.md`). Ngưỡng tuyệt đối README không đo được trên máy này → mỗi phase so **tương đối** với baseline dưới, đo cùng máy.
- Baseline Part 2 (`docs/perf-data/part2-fix-p0-baseline.json`, `--only c --stations 19-39 --passes 2`, CPU 4×): 234 lần chuyển, 213 có frame > 50 ms, frame max trung vị 167 ms, tệ nhất 1150 ms (t33), 808 long task; vào trạm trung vị 319 ms. Heap lượt 1 → 2: 19,8 → 20,4 MB (về bản đồ 19,4 → 20,2); WebGL max 1, rAF ≤ 1.
- Sau Phase 1 (`docs/perf-data/part2-fix-p1.json`, cùng máy, cùng lệnh): 193/234 lần chuyển có frame > 50 ms (baseline 213), frame max trung vị 117 ms (167), tệ nhất 1083 ms (1150), 688 long task (808); vào trạm trung vị 212 ms (319). Heap lượt 1 → 2: 20,0 → 20,3 MB; WebGL max 1, rAF ≤ 1. Không hồi quy.
