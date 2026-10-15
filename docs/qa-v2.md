# AI Zen v2 — QA checklist (spec D)

Kiểm ngày 16/10/2026 trên commit sau `9823d06`. Số liệu hiệu năng: `docs/perf-after.md`, `docs/perf-data/part2/`.

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| `npm run typecheck` + `npm run build` sạch | **Đạt** | tsc không lỗi; build VI + EN không lỗi, không cảnh báo |
| Mọi fact Phần 2 có `asOf` + `source` | **Đạt** | `node scripts/check-content.mjs`: 770 fact (VI + EN, trạm 19–39, news, toolkit, exam-2), mọi nguồn tra được |
| Tuyên bố của chính công ty có `claimBy` | **Đạt theo rà soát nội dung** | agent tra cứu gắn `claimBy` / `verifiedBy`; script chưa tự nhận ra được câu nào là vendor claim |
| Đi hết 39 trạm ở high, low, reduced motion, sáng + tối, VI + EN | **Đạt một phần** | 21 trạm Phần 2 × mọi scene, 375×812: VI tối + reduced motion + low, EN sáng + high, 276 scene, 0 lỗi console, 0 tràn ngang. Phần 1: perf-walk 1 → 18 ở low không lỗi. Chưa chạy đủ mọi tổ hợp × 39 trạm |
| Điện thoại dọc 375×812, ngang, iPad, desktop 1440 | **Đạt một phần** | dọc 375 + desktop 1440: ảnh chụp từng scene của agent dựng trạm + smoke test. Điện thoại ngang và iPad: **chưa kiểm** |
| Người dùng cũ (tiến độ + chứng nhận Phần 1) vẫn đúng | **Đạt** | giả lập `aizen:exam` cũ: chứng nhận Phần 1 y như trước; thi Phần 2 lưu `aizen:exam2`, không đụng `aizen:exam` |
| Bộ đếm, chứng nhận, "đi hết" theo từng phần | **Đạt** | topbar `n/18` · `n/21`; chứng nhận đếm trạm của đúng phần |
| Nút Sao chép trên iOS Safari / Android Chrome | **Chưa kiểm trên máy thật** | có Clipboard API + fallback chọn chữ; đã chạy trong Chromium |
| Game hồ koi trạm 36 ≥ 50 FPS ở low, 4× CPU | **Chưa đo** | game dùng 1 `createLoop`, cấp sẵn đối tượng; perf-walk chỉ lật scene, chưa chơi game |
| A.10 trên mọi trạm Phần 2 | **Gần đạt** | 0 long task; 2/234 lần chuyển có frame > 50 ms (t22 → 3: 100 ms, t33 → 2: 117 ms, không lặp lại ở lượt 2); xem `docs/perf-after.md` |
| A.9 rò rỉ Phần 2 | **Đạt** | lượt 2 heap 6,0 → 5,9 MB, WebGL 0, rAF 0 |
| B.8 ngân sách | **Đạt** | WebGL 0/21 trạm; chunk 14–32 KB; tối đa 1 `createLoop` mỗi scene |

## Biết rồi, chưa sửa (nhỏ)

- `perspectiveCircle` chỉ nhận 1 dòng `detail`, nên vài dòng phụ không hiện: `diary.detail` của t24 (số liệu DeepSeek R1), `views.detail` của t37 (báo cáo IASR). `stepPath` không hiện fact riêng, nên `facts[0]` của scene spec ở t35 không hiện.
- `stepPath` chỉ mở 1 thẻ mang về: 4 thẻ tuần `t39-week1…4` chỉ thấy ở Túi đồ nghề, không hiện trong scene.
- Ensō không có dòng "{n} thẻ đã sao chép" (chưa có bộ đếm số lần sao chép).
- `progressTide` dùng nhãn aria của nó trong `site.json`, bỏ qua `sliderAria` trong file trạm.
- `takeaway`: bộ hẹn giờ 2,4 s đặt lại nút sao chép không được huỷ khi rời scene (vô hại).
- t19, t20, t21 đều có một scene dòng thời gian dùng chung `progressTide`, nên bố cục giống nhau.
- Mở thẳng `#/vuon-trang` khi tải trang lần đầu: 1 long task ~178 ms, ngang Phần 1.
- Điện thoại rất hẹp (320px), bản EN: map Phần 2 hơi chật. Phần 1 xoay ngang 667×375: nhãn cầu chạm đá 17–18.

## Nội dung cần chủ dự án duyệt

`docs/part2-content-notes.md`: ghi chú từng vườn và mục "5 dữ kiện dễ gây tranh cãi nhất" (t20 Navier–Stokes, t37 GPT-6.1 Astra, t38 METR 16 giờ, t36 Veracode 45 %, t25 cảm xúc chức năng).

## Deploy

Chưa deploy: chờ chủ dự án đồng ý các mục "chưa kiểm" ở trên (Prompt 9 mục 5).
