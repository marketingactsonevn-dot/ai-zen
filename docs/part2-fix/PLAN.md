# Part 2 fix · PLAN

Mỗi phase: làm → `npm run build` → perf-walk (README) → `node scripts/part2-shots.mjs` cho slide đã đụng → commit → push → báo cáo → **dừng chờ duyệt**. Đánh dấu `[x]` ở đây khi xong.

## Phase 0 · Chuẩn bị (ngắn)
- [ ] `npm ci`, `npx playwright install chromium`, chạy `npm run build` + `npm run dev` xác nhận app lên.
- [ ] Chụp baseline Part 2 bằng `scripts/part2-shots.mjs` (giữ local, không commit ảnh nặng).

## Phase 1 · Khung chung (lợi cho cả 96 slide)
- [ ] Sửa `src/ui/station.ts:153`: prompt không ẩn khi chạm hụt; prompt đổi theo bước (H5).
- [ ] Bộ dấu hướng dẫn H1–H7 dùng chung (dựa trên `src/ui/hint.ts`, mẫu tốt: vầng thở 23-3, `frameHint` 36-2, cung vạch 38-2, chấm thở 36-4). Slide chỉ khai báo.
- [ ] Hẹn giờ đứng yên 6 s → gợi ý lại thay vì chỉ tắt chuyển động (`lantern.ts:610`, `t24/kit.ts:53`, `t23/lit.ts:487`).
- [ ] Vùng chữ định sẵn (đối diện hero); thẻ mang về thu thành vật nhỏ, chạm mới mở.
- [ ] Màn quiz chung vẽ lại (bỏ 4 viên đá xám kiểu nút) + xáo đáp án, đáp án đúng không luôn dài nhất.
- [ ] Nhãn tin cậy (theo audit v2).

## Phase 2 · 30 slide P1 (dạy sai / chặn chơi)
Theo bảng ở `docs/part2-audit/README.md` (ô **P1**). Đi theo vườn, mỗi vườn một commit:
- [ ] Vườn 7 (t19–21) · [ ] 8 (t22–24) · [ ] 9 (t25–27) · [ ] 10 (t28–30) · [ ] 11 (t31–33) · [ ] 12 (t34–36) · [ ] 13 (t37–39)

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
