# Part 2 fix · SPEC · 19/10/2026

Sửa 21 trạm Part 2 (t19–t39, route `#/vuon-trang`) theo audit v3 ở commit `0950f07`.

## Nguồn sự thật (đọc theo thứ tự)
1. `CLAUDE.md` + `README.md` § "Quy ước hiệu năng" và checklist "Trạm mới chỉ xong khi" — bắt buộc trước khi sửa mọi scene.
2. `docs/part2-audit/README.md` — tóm tắt v3: bảng điểm, mục E (thẩm mỹ), F (cân bằng), G (hướng dẫn H1–H7), thứ tự sửa.
3. `docs/part2-audit/v2/README.md` — mục A–D (câu chữ, logic thông tin, gameplay).
4. `docs/part2-audit/toan-bo-21-tram.md` — từng slide: hiện tại, lỗi 1–7, **đề xuất sửa kèm câu chữ viết sẵn**. Đây là đặc tả chi tiết; làm đúng theo đó.
5. `docs/part2-audit/calibration.md` — thang chấm thẩm mỹ/cân bằng chéo 21 trạm.
6. `docs/part2-art-direction.md`, `docs/AI-ZEN-v2-SPEC.md` (spec gốc, có thẩm quyền về nội dung/vườn).
7. `docs/part2-audit/ref/` — ảnh chuẩn (`strong.jpg` = mốc 5/5, `p1-15-1-1.jpg` = hướng dẫn Phần 1).

Ảnh chụp audit (`all/`, `gNN/`) **không lên repo** (quá nặng) — link ảnh trong file .md sẽ gãy, bình thường. Muốn xem trạng thái thật thì chụp lại bằng `node scripts/part2-shots.mjs` (Playwright).

## Mục tiêu (định nghĩa xong)
- Hết 30 slide P1 (dạy sai / chặn chơi).
- Mọi slide có hướng dẫn trong cảnh theo bộ dấu H1–H7; prompt không mất khi chạm hụt.
- Thẩm mỹ, cân bằng, hướng dẫn mỗi slide ≥ 3/5 (hiện TB 3,1 / 2,7 / 2,7).
- Câu chữ theo bản viết sẵn trong audit; quiz xáo đáp án (hiện đáp án = B và dài nhất ở 18/21).
- 96 slide → khoảng 87 (cắt/gộp theo audit).
- Không hồi quy hiệu năng: qua checklist README, perf-walk CPU 4× `--passes 2`.
- VI và EN đều chạy (`npm run build` build cả hai).

## Ràng buộc
- Chữ hiển thị chỉ trong `src/content/*.json` + `*.en.json`; fact có `asOf` + `source`.
- Dùng `createLoop` / `createStage` / `sliced`; mount ≤ 50 ms ở CPU 4×; dọn mọi job trì hoãn.
- Phong cách: tranh mực đêm trăng, một hero có khối 15–50% khung, một nguồn sáng trăng, chữ khắc lên vật thật — không UI card/chip/nút. Không emoji, không pastel trẻ con.
- Không deploy (`npm run deploy` / gh-pages) khi chủ app chưa duyệt.
- Không sửa Phần 1 (t01–t18) trừ khung chung dùng chung có lợi cho cả hai và không đổi hình Phần 1.

## Cách làm việc với chủ app
- Báo cáo tiếng Việt, ngắn. Làm **một phase**, commit, push nhánh, báo kết quả + ảnh trước/sau các slide chính, rồi **dừng chờ duyệt**.
- Không thêm vòng review/check thừa; chủ app tự kiểm.
