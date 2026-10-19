# AI Zen v2 — Bộ prompt cho Claude Code

Cách dùng:
1. Spec nằm ở `ai-zen/docs/AI-ZEN-v2-SPEC.md`. Mở Claude Code trong thư mục `ai-zen`.
2. Dán **từng prompt theo thứ tự**. Xong một prompt → xem báo cáo → mở app kiểm tra → mới dán prompt tiếp.
3. Nên mở **session mới** cho mỗi prompt từ Prompt 3 trở đi (đỡ đầy ngữ cảnh). Mỗi prompt đã tự đủ thông tin.
4. Sau mỗi prompt, Claude Code sẽ commit. Thấy hỏng thì nói "quay về commit trước".

| # | Việc | Ước lượng |
|---|---|---|
| 1 | Đo baseline + Perf HUD | ngắn |
| 2 | Tối ưu mượt (phần A) | dài nhất phần A |
| 3 | Khung Phần 2: dữ liệu, route, map, cầu, topbar | dài |
| 4 | Bài thi + chứng nhận + từ điển theo phần | vừa |
| 5 | Thành phần dùng chung: vòng đá góc nhìn, thuỷ triều tiến triển | vừa |
| 6 | Nội dung tiếng Việt 12 trạm (tra cứu + JSON) | dài |
| 7a–7d | Dựng trạm theo từng vườn | mỗi vườn 1 prompt |
| 8 | Bản tiếng Anh | vừa |
| 9 | QA cuối + README + deploy | vừa |

---

## Prompt 1 — Đo trước khi sửa

```
Đọc kỹ docs/AI-ZEN-v2-SPEC.md (toàn bộ), README.md, src/main.ts, src/ui/station.ts, src/ui/map.ts, src/core/three-stage.ts, src/core/prefs.ts, src/ui/ink.ts.

Nhiệm vụ lần này CHỈ là mục A.1 của spec:
1. Làm Perf HUD bật bằng ?perf=1 (cả bản dev và build), đúng các chỉ số trong A.1. Thêm bộ đếm WebGL context trong createStage và expose số liệu qua window.__aizen.perf để script đọc được.
2. Viết script Playwright (scripts/perf-walk.mjs; thêm playwright vào devDependencies và cài Chromium nếu máy chưa có) chạy đúng kịch bản A.1 (a)–(e) với CPU throttling 4x qua CDP, xuất JSON + tóm tắt.
3. Chạy đo, ghi kết quả vào docs/perf-baseline.md: bảng số liệu + đối chiếu từng dòng trong bảng A.0 (xác nhận / loại trừ / chưa rõ) + top 5 thủ phạm theo số đo thực.

Không sửa bất kỳ hành vi hay giao diện nào khác. Typecheck + build phải sạch. Commit "perf: baseline + HUD".
Báo cáo cho tôi bằng tiếng Việt, ngắn: 5 thủ phạm lớn nhất, kèm con số.
```

## Prompt 2 — Tối ưu mượt

```
Đọc docs/AI-ZEN-v2-SPEC.md mục A (A.2 → A.10) và docs/perf-baseline.md.

Làm phần A theo thứ tự ưu tiên trong spec, bắt đầu từ thủ phạm lớn nhất đã đo được ở baseline:
A.2 chuyển scene (calm/rich, không để 2 scene nặng cùng sống, giữ fix revert gsap ngoài render loop),
A.3 createLoop dùng chung + chuyển các vòng rAF tự viết sang đó, bỏ getComputedStyle/getBoundingClientRect trong vòng frame,
A.4 bản nhẹ của SVG ink filter khi quality=low + quy tắc không animate trực tiếp phần tử có filter,
A.5 backdrop-filter / blur tĩnh / will-change ở chế độ low,
A.6 map không vẽ lại cát khi thanh địa chỉ mobile ẩn hiện,
A.7 prefetch thông minh + renderer.compile,
A.8 tự hạ chất lượng (không re-mount scene hiện tại, có toast + nút giữ chế độ đẹp, nhãn đặt trong site.json và site.en.json),
A.9 rò rỉ bộ nhớ (kể cả Matter.js ở t04).

Ràng buộc:
- Ở quality=high trên desktop, Phần 1 phải trông như cũ. Chụp ảnh trước/sau 6 trạm (01, 03, 07, 09, 13, 18) ở high và low, để trong docs/perf-shots/ để tôi so.
- Sau mỗi nhóm A.x: typecheck, build, chạy lại scripts/perf-walk.mjs; commit riêng từng nhóm ("perf: A.2 scene transitions"…).
- Nếu một tối ưu làm xấu hình rõ rệt thì dừng nhóm đó, ghi lý do, làm nhóm khác.

Kết thúc: ghi docs/perf-after.md (bảng trước/sau theo tiêu chí A.10, đạt/chưa đạt). Báo cáo tiếng Việt ngắn: cái gì nhanh lên bao nhiêu, cái gì chưa đạt và vì sao.
```

## Prompt 3 — Khung Phần 2

```
Đọc docs/AI-ZEN-v2-SPEC.md mục 0, B.1 → B.5 và B.8. Đọc src/core/content.ts, src/content/gardens.json, src/content/site.json, src/ui/map.ts, src/ui/topbar.ts, src/ui/station.ts, src/main.ts, src/stations/registry.ts.

Làm khung Phần 2, CHƯA làm nội dung trạm:
1. Dữ liệu: parts, garden.part, vườn 7–10 và trạm 19–30 trong gardens.json + gardens.en.json (tên/teaser lấy từ mục C của spec, bản EN dịch tạm, Prompt 8 sẽ trau chuốt). Helper PARTS, stationsOfPart, gardensOfPart, partOfStation, displayNo trong core/content.ts.
2. Route #/vuon-trang; crumb + "về bản đồ" trong trạm Phần 2 về đúng map Phần 2; trạm chưa có module hiện màn "Đang dựng" như hiện tại.
3. renderMap tham số hoá theo part, bộ anchors riêng 4 vườn (landscape + portrait), cây cầu nối 2 map ở cả 2 đầu, chuyển cảnh "trăng lên" (calm: crossfade).
4. Bản sắc Vườn Trăng: data-part="2" trên <html>, token màu cho theme tối + theme sáng theo B.1, mặt nước + trăng + đèn đá + đom đóm trên map (Canvas 2D/SVG, không WebGL; đom đóm tắt ở low và reduced motion). Kiểm tra tương phản chữ đạt WCAG AA.
5. Topbar: công tắc I · II, bộ đếm theo phần đang xem.
6. Thẻ gợi ý B.5 (chỉ 1 lần, không khoá).
7. Trạm 18: thêm nút "Sang Vườn Trăng" ở scene tóm tắt.

Ràng buộc: không đổi key localStorage cũ; Phần 1 hiển thị và hành xử y như trước; đạt ngân sách hiệu năng ở B.8 và tiêu chí A.10 cho map Phần 2 (chạy perf-walk có thêm map Phần 2).
Typecheck + build sạch cả VI/EN. Chụp ảnh map Phần 2 (dọc + ngang, sáng + tối) vào docs/part2-shots/. Commit "part2: frame".
Báo cáo tiếng Việt ngắn + đường dẫn ảnh chụp để tôi duyệt hình ảnh Vườn Trăng trước khi làm tiếp.
```

> Dừng ở đây, xem ảnh map Vườn Trăng. Muốn chỉnh màu/không khí thì nói với Claude Code trước khi sang Prompt 4.

## Prompt 4 — Bài thi, chứng nhận, từ điển theo phần

```
Đọc docs/AI-ZEN-v2-SPEC.md mục B.6. Đọc src/extras/exam.ts, src/extras/glossary.ts, src/content/exam.json, src/content/glossary.json.

1. Tham số hoá bài thi theo part: route #/bai-thi giữ nguyên Phần 1, thêm #/bai-thi-trang cho Phần 2, đọc exam-2.json (tạo file khung 10 câu giữ chỗ, nội dung thật làm ở Prompt 6). Số đá trên chứng nhận, câu "đi hết", bộ đếm visited đều tính theo phần — hiện code đang cứng 18 và dùng ALL_STATIONS.length, phải sửa.
2. Chứng nhận Vườn Trăng: cùng khung, trăng thay mặt trời, con dấu khác, tiêu đề riêng; lưu kết quả key riêng, không ghi đè kết quả Phần 1.
3. Từ điển: field part cho mỗi thuật ngữ, bộ lọc Tất cả · Phần 1 · Phần 2 (thuật ngữ Phần 2 thêm ở Prompt 6).
4. Map Phần 2 có lối vào bài thi + từ điển giống map Phần 1.

Kiểm tra hồi quy: người dùng đã thi Phần 1 (giả lập localStorage cũ) vẫn xem lại đúng chứng nhận cũ. Typecheck + build sạch. Commit "part2: exam + glossary by part". Báo cáo ngắn.
```

## Prompt 5 — Thành phần dùng chung Phần 2

```
Đọc docs/AI-ZEN-v2-SPEC.md mục B.7, B.8 và src/stations/types.ts, src/ui/fact.ts, src/ui/station.ts.

Làm 3 thành phần trong src/ui/part2/:
1. perspectiveCircle — "Vòng đá góc nhìn" đúng mô tả B.7 (đá quanh mặt nước trăng, chạm từng đá hiện ai nói + lập luận + nhãn kind + nguồn; chạm hết thì hiện insight chung). Bàn phím: Tab/Enter/phím số; aria đầy đủ; reduced motion có trạng thái tĩnh.
2. progressTide — "Thuỷ triều tiến triển": kéo trăng theo thời gian, mốc nổi lên như đá, mốc cuối "Hôm nay (asOf)" + dòng dự đoán trong sương. Hỗ trợ kéo chuột/chạm/phím ←→.
3. Nhãn độ chắc chắn theo kind (fact/opinion/prediction/illustration) hiển thị cạnh insight, có chú giải; nhãn chữ trong site.json + site.en.json.

Làm 1 trạm demo ẩn (không có trên map, route #/tram/99 chỉ ở dev) dùng cả 3 với dữ liệu giả để tôi bấm thử. Đạt ngân sách B.8, chạy tốt ở low/calm trên giả lập mobile 4x CPU.
Typecheck + build sạch. Commit "part2: shared components". Báo cáo + cách mở trạm demo.
```

## Prompt 6 — Nội dung tiếng Việt 12 trạm (tra cứu thật)

```
Đọc docs/AI-ZEN-v2-SPEC.md mục C toàn bộ (C.0 là luật bắt buộc) và mục F. Đọc 2 file nội dung mẫu của Phần 1 để bắt chước cấu trúc và giọng văn: src/content/tram-06.json và src/content/tram-15.json, cùng src/content/sources.json.

Nhiệm vụ: viết src/content/tram-19.json → tram-30.json (tiếng Việt), exam-2.json (10 câu thật), và thêm ~30–40 thuật ngữ Phần 2 vào glossary.json.

Quy trình bắt buộc cho MỖI trạm:
1. Tra cứu web từng dữ kiện trong outline mục C; mở nguồn gốc (paper, blog chính thức, văn bản luật), không dựa vào bài báo tóm tắt nếu có nguồn gốc.
2. Mục nào gắn [Unverified] trong spec: xác minh; nếu không xác minh được thì viết lại theo hướng định tính hoặc bỏ, và ghi vào docs/part2-content-notes.md.
3. Mỗi fact có asOf (ngày bạn kiểm tra) + source; quan điểm/dự đoán gắn kind tương ứng. Không trình bày dự đoán như sự thật.
4. Chủ đề cảm xúc/ý thức (trạm 25, 26): giữ đúng 3 tầng "biểu hiện / chức năng / cảm thấy", trung lập, khiêm tốn. Trạm 27: giọng ấm, không phán xét, không đi vào chi tiết khủng hoảng tâm lý.
5. Câu insight ≤ 25 từ, tiếng Việt tự nhiên cho người không làm kỹ thuật; thuật ngữ tiếng Anh để trong ngoặc lần đầu.
6. Mỗi scene ghi rõ trường "art" (mô tả tranh mực) và các nhãn tương tác như file mẫu, để bước dựng trạm dùng.

Chưa dựng code trạm. Chạy script kiểm tra: mọi source key tồn tại, mọi fact có asOf. Commit "part2: content vi".
Báo cáo tiếng Việt: danh sách mục đã đổi so với outline vì không xác minh được, và 5 dữ kiện bạn thấy dễ gây tranh cãi nhất để tôi duyệt.
```

> Dừng ở đây, đọc `docs/part2-content-notes.md` và lướt vài file `tram-2x.json`. Duyệt xong mới dựng trạm.

## Prompt 7a → 7d — Dựng trạm theo vườn

Dán 4 lần, mỗi lần đổi dòng đầu:
- 7a: `VƯỜN 7 — trạm 19, 20, 21`
- 7b: `VƯỜN 8 — trạm 22, 23, 24`
- 7c: `VƯỜN 9 — trạm 25, 26, 27`
- 7d: `VƯỜN 10 — trạm 28, 29, 30`

```
VƯỜN __ — trạm __, __, __

Đọc docs/AI-ZEN-v2-SPEC.md mục 0, B.1, B.7, B.8 và phần của các trạm này trong mục C. Đọc content của các trạm này (src/content/tram-NN.json). Đọc 2 trạm Phần 1 làm mẫu chất lượng: src/stations/t06/ và src/stations/t15/ (cấu trúc thư mục, cách dùng SceneCtx, cleanup, style.css theo scope trạm). Đọc src/ui/part2/ để dùng lại perspectiveCircle, progressTide.

Dựng từng trạm thành src/stations/tNN/ và đăng ký trong src/stations/registry.ts.
Yêu cầu:
- Đúng nhịp ảnh → tương tác → insight; prompt pill ≤ 6 chữ; insight chỉ hiện sau khi người xem làm gì đó.
- Hình ảnh: mực tàu, Vườn Trăng (B.1), sáng tạo ngang tầm Phần 1 — mỗi scene một ẩn dụ thị giác riêng, không lặp bố cục giữa các trạm.
- Ngân sách B.8 (tối đa 4/12 trạm dùng WebGL cho cả Phần 2 — kiểm tra các vườn trước đã dùng bao nhiêu), mọi vòng frame qua createLoop, không animate trực tiếp phần tử có SVG filter.
- Chạy tốt ở high, low, calm, reduced motion, theme sáng/tối, điện thoại dọc 375px.
- Bàn phím + aria như Phần 1.

Sau mỗi trạm: typecheck, build, chạy perf-walk cho trạm đó (đạt A.10), chụp ảnh từng scene (dọc + ngang) vào docs/part2-shots/tNN/. Commit mỗi trạm riêng.
Báo cáo tiếng Việt ngắn: mỗi trạm 1 dòng mô tả ẩn dụ chính + số đo hiệu năng + chỗ nào tôi nên xem kỹ.
```

## Prompt 8 — Bản tiếng Anh

```
Đọc docs/AI-ZEN-v2-SPEC.md mục D. Tạo/hoàn thiện bản .en.json cho: tram-19 → tram-30, exam-2, glossary (thuật ngữ Phần 2), gardens (phần 2), site (nhãn mới).
Dịch như người viết tiếng Anh bản xứ cho người không làm kỹ thuật; giữ ẩn dụ Zen, giữ nguyên cấu trúc JSON, source, asOf, kind. Câu insight vẫn ≤ 25 từ.
Chạy npm run dev:en, đi hết 12 trạm Phần 2 + bài thi + từ điển, kiểm tra chữ không tràn khung ở 375px. Nút đổi ngôn ngữ giữ đúng vị trí ở mọi route Phần 2.
Typecheck + build sạch. Commit "part2: english". Báo cáo ngắn.
```

## Prompt 9 — QA cuối & deploy

```
Đọc docs/AI-ZEN-v2-SPEC.md mục D và A.10.
1. Chạy toàn bộ QA checklist mục D, ghi kết quả từng dòng vào docs/qa-v2.md (đạt/chưa đạt + bằng chứng).
2. Chạy perf-walk cho cả 30 trạm, cập nhật docs/perf-after.md.
3. Sửa mọi lỗi tìm thấy (commit riêng từng lỗi). Lỗi nào không sửa được thì ghi rõ vào qa-v2.md.
4. Cập nhật README (2 phần, 10 vườn, 30 trạm, route mới, mục "Quy ước hiệu năng" gồm các luật ở A.3, A.4, B.8).
5. Chỉ deploy (npm run deploy) khi checklist đạt hết hoặc tôi đồng ý các mục còn lại. Hỏi tôi trước khi deploy.
Báo cáo tiếng Việt: tổng kết đạt/chưa đạt, link bản deploy nếu đã deploy.
```

---

## Mẹo khi làm việc với Claude Code

- Thấy app chạy sai sau một prompt: dán "Đọc lại docs/AI-ZEN-v2-SPEC.md mục __, lỗi tôi thấy là: __ (mô tả + ảnh chụp). Sửa đúng lỗi này, không đổi thứ khác."
- Muốn chỉnh hình một trạm: chụp màn hình + mô tả cảm giác mong muốn ("tĩnh hơn", "giống mực loang hơn"), không cần nói kỹ thuật.
- Kiểm tra mượt trên điện thoại: mở bản deploy với `?perf=1` ở cuối link, xem số FPS góc dưới trái.
