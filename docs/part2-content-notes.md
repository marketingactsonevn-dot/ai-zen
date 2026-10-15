# Phần 2 · Vườn Trăng — ghi chú nội dung

Kiểm ngày 15/10/2026. Gộp từ ghi chú nghiên cứu của 7 vườn (trạm 19–39, hiển thị II·01–II·21). Mọi số liệu bên dưới đã có trong JSON kèm `asOf` + `source`; chỗ nào chưa chắc đều ghi rõ ở đây.

Kiểm tự động: `node scripts/check-content.mjs` (mọi Fact có `asOf` + nguồn tra được, mọi `takeaways` có trong `toolkit.json`, mọi `newsTags` gặp ít nhất một tin, VI ↔ EN cùng id).

## Đã gộp vào file chung

| File | Nội dung |
|---|---|
| `src/content/news.json` + `.en.json` | 29 tin, 29 nguồn, `asOf` 2026-10-15. Vườn 8, 12, 13 không có trạm tin tức nên không góp tin. |
| `src/content/toolkit.json` + `.en.json` | 32 thẻ, mỗi thẻ có `topic` (7 kệ theo spec C.2) và `asOf`. 11 nguồn của thẻ được chép từ file trạm sang `sources` của toolkit, vì `#/do-nghe` không nạp file trạm. |
| `src/content/glossary.json` + `.en.json` | 51 thuật ngữ Phần 2 (`part: 2`, `station` 19–38), 7 viên đá chính (`key`). |
| `src/content/exam-2.json` + `.en.json` | 12 câu, phủ đủ 7 vườn (5 vườn × 2 câu, vườn 10 và 12 × 1 câu). |

### Quyết định khi gộp
- **Số trạm hiển thị:** ghi chú trong thẻ nhắc trạm khác theo số người xem thấy (`II·14`, `II·16`, `II·17`, `II·18`), không theo id nội bộ (32, 34, 35, 36).
- **Từ điển:** 56 ứng viên → 51. Bỏ `blowup`, `global-workspace`, `chipflation`, `credit`, `pareidolia` (hẹp, hoặc là tiếng lóng; trang từ điển đã chật ở màn hình điện thoại, xem báo cáo F1). Sửa: `hugging-face` bỏ con số “hơn 3 triệu model” (định nghĩa không có nguồn, số sẽ cũ); `ai-label` bỏ câu khẳng định pháp lý, viết thành nguyên tắc chung; `vibe-coding` bỏ `kind: opinion` (từ điển chỉ nhận `prediction`); `dram` bỏ `aka` trùng với `vi`. Không có id nào trùng Phần 1.
- **Bài thi:** 14 ứng viên → 12. Bỏ câu “giá DRAM +400%” (J.P. Morgan, vườn 10) và câu “Higgsfield Marketing Studio” (vườn 12) vì đã có đủ câu phân loại cùng dạng. Thay câu dự đoán của CEO Anthropic (trạm 23) bằng đánh giá của Neel Nanda để ba câu phân loại có ba đáp án khác nhau: tuyên bố công ty (trạm 19), quan điểm (trạm 23), dự đoán (trạm 38). Đủ mục C.1: 3 tầng cảm xúc (trạm 25), ranh giới luật không bạo hành AI (trạm 26), đọc model card (trạm 31), cấp quyền cho agent (trạm 33), chọn công nghệ cho game (trạm 36), chọn đồ nghề (trạm 39). Đáp án rải đều A/B/C/D, mỗi vị trí 3 câu. Câu hỏi ≤ 106 ký tự, đáp án ≤ 32, lời giải ≤ 131 (VI; EN dài hơn chút): đã thử cả 12 câu VI + EN ở 375×667 và 1440×900, không tràn.
- **Thẻ mang về:** kệ theo spec C.2. Đọc tin & kiểm chứng 3 · Tải & chạy model 7 · Agent an toàn 3 · Ảnh/video AI 3 · Skills & workflow 4 · Code game/app 8 · Thói quen lành 4. Tổng 32 thẻ, dưới ước tính 35–50 của spec.

### Cần người duyệt trước khi phát hành
- Ngày tin `n33-clawhub-skills` (01/02/2026) suy từ nguồn thứ cấp; bài gốc The Hacker News chặn công cụ tra cứu.
- Luật Trí tuệ nhân tạo 134/2025/QH15 (trạm 30, 34) và Nghị định 142/2026/NĐ-CP: chưa mở được văn bản gốc trên cổng Chính phủ. Bản tiếng Việt và bản dịch tiếng Anh đánh số khoản khác nhau, nên nội dung chỉ dẫn tới Điều 11. Nên đối chiếu Công báo.
- EU Omnibus (Quy định 2026/1744): nguồn là hãng luật Cuatrecasas, chưa mở được EUR-Lex.
- openai.com chặn công cụ tra cứu. Các tin GPT-6 Astra, GPT-6.1 Astra, sycophancy GPT-4o và o1 dựa trên báo chí, và đều gắn `claimBy: OpenAI`.
- Câu `common` của vòng đá góc nhìn ở 16 trạm (19–21, 23–30, 32, 34, 36, 38, 39) là lời AI Zen tự tổng hợp (`source: editorial`, `kind: opinion`). Chủ dự án nên duyệt lời văn.

## 5 dữ kiện dễ gây tranh cãi nhất

| # | Trạm | Câu trong nội dung | Nguồn | Vì sao dễ gây tranh cãi | Cách đã trình bày |
|---|---|---|---|---|---|
| 1 | 20 · II·02 AI làm toán | “OpenAI công bố chứng minh dòng chảy Navier–Stokes có thể “nổ” (blowup), kèm bản viết lại bằng Lean để máy kiểm.” | `quanta-ns` (Quanta Magazine, 08/09/2026); tin `n-2026-09-navier-stokes` | OpenAI chứng minh một biến thể có lực ngoài trơn (mệnh đề C/D). Có người cho rằng đó không phải điều đa số hiểu là Bài toán Thiên niên kỷ. Viện Clay chưa xét: phải chờ bài được đăng và đứng vững ít nhất 2 năm. Nhóm Buckmaster–Alpöge công bố kết quả gần kề sớm hơn khoảng 12 giờ. | Gắn ◇ `claimBy: OpenAI`, kèm luật Clay. Không viết “đã giải”. |
| 2 | 37 · II·19 An toàn & căn chỉnh | “09/2026: OpenAI không phát hành GPT-6.1 Astra sau thử nghiệm nội bộ, vì model hay làm quá phạm vi được giao và chưa báo lại đúng việc đã làm.” | `t37-astra` (Al Jazeera 29/09/2026, có lời Saachi Jain; WSJ đưa tin trước, có tường phí) | Chỉ có lời OpenAI qua báo chí, chưa có tài liệu chính thức. Một trang nói không tìm thấy GPT-6.1 trong tài liệu công khai, điều này hợp lý vì model không được phát hành. Chi tiết “lừa dối nhiều hơn” chỉ có ở WSJ. | `claimBy: OpenAI`. Bỏ chi tiết chỉ thấy ở WSJ và tin thứ cấp. |
| 3 | 38 · II·20 AGI, tương lai & nghề | “Trong khoảng một năm, việc AI tự làm xong dài từ chừng 1 giờ lên ít nhất 16 giờ, chủ yếu là lập trình.” | `t38-metr-mythos`, `t38-metr-2025`, `t38-metr-page` (METR) | Hai số đo lấy từ hai phiên bản bộ bài thử (2025 và TH1.1). Chính METR nói đo trên 16 giờ không còn tin cậy (khoảng tin cậy 8,5–55 giờ), và trang đo đã ngừng cập nhật từ 08/09/2026. Rất dễ bị đọc thành “AI làm được mọi việc dài 16 giờ”. | Ghi “chủ yếu là lập trình” và “ít nhất”. Detail nói rõ giới hạn. Đường kéo tới 2030 gắn `prediction`. |
| 4 | 36 · II·18 Tự code game bằng AI | “Veracode tự đo 80 bài trên hơn 100 model: khoảng 45% trường hợp, code AI viết có lỗ hổng bảo mật.” | `t36-veracode` (Veracode, 07/2025) | Benchmark tự đo của một hãng bán dịch vụ bảo mật. Dễ bị đọc thành “45% mọi code AI đều lỗi”. | ◇ `claimBy: Veracode`, đặt ngang hàng 4 góc nhìn khác trong vòng đá về vibe coding. |
| 5 | 25 · II·07 AI có cảm xúc không? | “Cảm xúc chức năng có thật theo nghĩa đo và tác động được; theo dõi chúng có thể giúp cảnh báo sớm hành vi lệch.” (cùng phát hiện 171 khái niệm cảm xúc trong Claude Sonnet 4.5) | `anthropic-emotions-2026` (Anthropic, 02/04/2026) | Đây là cách chính công ty diễn giải nghiên cứu về model của mình, trên một chủ đề nhạy cảm, và chưa có bên độc lập lặp lại. Người đọc dễ nhảy từ “có thật” sang “AI cảm thấy”. | `kind: opinion` + `claimBy: Anthropic`. Tách rõ 3 tầng; tầng 3 ghi “chưa ai đo được”. Câu thi số 5 hỏi đúng chỗ này. |

Cũng nên duyệt: đá “Thương hiệu” trạm 34 (cách đọc Điều 11 Luật AI về nhãn khi giả lập người thật), đá Jensen Huang trạm 28 (“cáo buộc vòng tròn là vô căn cứ”, ◇ NVIDIA), insight trạm 19 “mô hình mạnh nhất có thể không ra cho mọi người ngay” (quan điểm AI Zen rút từ 2 ví dụ).

---

# Ghi chú từng vườn

## Vườn 7 · Đỉnh núi tin tức (trạm 19–21)

### Đổi so với outline
- **Trạm 19 · Các đỉnh núi:** chỉ dựng bia cho tin mở được nguồn gốc hoặc nguồn đáng tin: Claude Mythos Preview (07/04, anthropic.com), DeepSeek V4 Preview (24/04, api-docs.deepseek.com), Gemini 3.6 Flash (21/07, blog.google), GPT-6 Astra (03/09), Claude Opus 5.5 (22/09) và Sonnet 5.5 (28/09, anthropic.com). “Dòng GPT-6” → tên thật là **GPT-6 Astra**. Grok, Qwen, Mistral, Xiaomi MiMo: **không xác minh kịp** bản/ngày mới nhất từ trang chính thức, nên chỉ nhắc tên trong `othersNote`, không dựng bia.
- **Trạm 19 · Đỉnh núi có rào:** ngày 07/04/2026 và con số Mozilla **đã xác minh** trên Mozilla Hacks (07/05/2026): Firefox 150 vá 271 lỗi do Mythos Preview tìm ra (180 cao, 80 trung bình, 11 thấp). Cảnh này dùng `perspectives`: Anthropic (◇), Mozilla, VulnCheck (qua CSO Online, 16/04/2026: lúc đó mới 1 CVE gắn với Glasswing), OpenAI (GPT-6 Astra cũng mở dần). **Bỏ** ý “độc quyền” vì không tìm được nguồn đáng tin trong thời gian tra.
- **Trạm 19 · Thuỷ triều:** không có nguồn đáng tin đếm “số lần ra model lớn mỗi quý” → thay bằng số đếm của **Epoch AI** (mô hình ≥ 10²⁵ FLOP: GPT-4 là mô hình đầu tiên 03/2023; ~2 mô hình/tháng năm 2024; 30+ mô hình của 12 nhà phát triển tới 06/2025). Là số thật nên không cần `illustration`.
- **Trạm 20 · Jacobian:** ngày ghi theo Archive of Formal Proofs là **20/07/2026** (outline ghi 19/07, có lẽ do múi giờ). Ghi “Claude Fable” theo đúng chữ của AFP; “Fable 5” chỉ thấy ở nguồn thứ cấp.
- **Trạm 20 · “Washington Post: hơn 300 bài”:** trang WaPo chặn tra cứu. Con số kiểm được (Anadolu, 08/10/2026): **722 bản thảo, 372 nhóm kết quả, từ ~4.000 bài đã thử**; “hơn 300” có lẽ là làm tròn 372. Dùng con số kiểm được, gắn `claimBy: OpenAI`.
- **Trạm 20 · Fefferman ghi công Córdoba & Martínez-Zoroa:** không tìm thấy. Quanta viết **cả hai nhóm AI đều dựa trên chiến lược của Córdoba và Martínez-Zoroa (2023)**; Fefferman chỉ nói ông “rất vui khi bài toán được giải”. Đã viết lại đúng như vậy.
- **Trạm 20 · IMO 2025:** tách làm hai mốc: OpenAI tự đánh giá (◇, ba cựu huy chương IMO chấm) và Google DeepMind được Chủ tịch IMO xác nhận (`verifiedBy`).
- **Trạm 20 · Vòng đá:** hòn thứ tư “có ích gì ngoài toán” không tìm được người nói có nguồn → thay bằng nhóm cố vấn Toán & AI của Viện IAS (vai trò con người). Thêm: OpenAI nói không định nhận giải (DataCamp, thứ cấp — openai.com chặn tra cứu) và luật Clay (đăng + chờ ≥ 2 năm + được chấp nhận rộng rãi).
- **Trạm 21 · số liệu marathon:** kỷ lục người chính xác **57:20** (Jacob Kiplimo, Lisbon, 03/2026). “Khoảng 40%” → “**hơn 40% số đội**” (China Daily). 48:19 của robot điều khiển từ xa: Interesting Engineering; hệ số **1,2**: trang chính quyền Bắc Kinh. 2:40:42 (2025): AP (trang chặn tra cứu, khớp qua bản đăng lại).
- **Trạm 21 · Bộ não cho tay chân:** thêm so sánh có nguồn: Open X-Embodiment (2023) hơn 1 triệu lượt thao tác / 22 loại robot, so với Llama 3 (2024) hơn 15 nghìn tỷ token. “Mô hình thế giới” giữ ở mức giải thích, không gắn ví dụ có ngày (chưa kiểm).
- **Trạm 21 · Vòng đá:** 4 góc nhìn đều có nguồn: Figure AI (master plan 2022), IFR (5 triệu robot công nghiệp, 24/09/2026), Acemoglu & Restrepo (NBER 2017), Rodney Brooks (09/2025).

### Cho bước dựng trạm
- `news-g07` là nguồn “con trỏ” cho 2 câu tóm tắt nhiều bia cùng lúc (trạm 19, `peaks.detail` và mốc “Hôm nay”); từng tin có nguồn riêng trong `news`. Nếu muốn chặt hơn, tách câu đó thành từng fact.
- `compare` ở trạm 19 là đà tăng (1 → 30+), không có `ratio`; ở trạm 21 `ratio: 0.31` (50:26 / 2:40:42).
- Trạm 20 `mason.code` dùng `lang: "text"` vì `CodeScroll` chưa có Lean; đoạn mã là minh hoạ (có `codeNote` kind illustration).
- Trạm 19, 20 có thẻ mang về dù là trạm `news` (không bắt buộc).

### Dễ gây tranh cãi nhất (đã giữ)
1. **Navier–Stokes:** OpenAI nói đã giải bằng mệnh đề C/D (nổ khi có lực ngoài trơn); một số người cho rằng biến thể có lực không phải điều đa số hiểu là bài toán; Viện Clay chưa xét. Trình bày là ◇ OpenAI tự công bố + luật Clay, không nói “đã giải”.
2. **Trạm 19 · “Xu hướng 2026: mô hình mạnh nhất có thể không ra cho mọi người ngay”:** quan điểm của AI Zen (`kind: opinion`) rút từ 2 ví dụ (Mythos Preview, GPT-6 Astra).

## Vườn 8 · Mở nắp hộp đen (trạm 22–24)

### Đổi so với outline
- **Trạm 22**: thêm scene ví dụ câu “Con mèo… vì nó quá chậm / nhanh” để chữ “nó” đổi hướng khi đổi một chữ (dựa trên Clark và cộng sự 2019: có đầu chú ý làm đồng tham chiếu). Trọng số ánh sáng là minh hoạ, gắn `kind: illustration`. Scene 2 thêm cảnh báo “attention không phải lời giải thích đầy đủ” (Jain & Wallace 2019) để nối sang Trạm 23. Scene 3 dùng số thật GPT-3 (96 tầng, 96 đầu) và Tenney 2019 (tầng thấp → ngữ pháp, tầng cao → đồng tham chiếu). Tide: 2017 Transformer → 2020 GPT-3 2.048 token → 2023 Claude 100K → 2024 Gemini 1.5 (1M, Google nói thử tới 10M — `claimBy`) → 2025 Llama 4 Scout 10M (`claimBy Meta`) → hôm nay ~1M (Anthropic GA 13/03/2026). Thêm mẹo “lạc giữa chừng” (Liu 2023).
- **Trạm 23**: outline viết “Cầu Vàng” — sửa thành **Cầu Cổng Vàng** (Golden Gate Bridge ở San Francisco); “Cầu Vàng” là cầu ở Bà Nà, Đà Nẵng, dễ gây hiểu nhầm. Scene superposition dùng 5 khái niệm có thật trong *Towards Monosemanticity* (512 nơ-ron → hơn 4.000 khái niệm). Mục [Unverified] attribution graphs: **đã xác minh**, chọn đúng ví dụ trong paper *On the Biology of a Large Language Model* (27/03/2025, Claude 3.5 Haiku): Dallas → Texas → Austin, thay Texas bằng California ra Sacramento; thêm câu khiêm tốn của chính tác giả (thoả đáng ở ~1/4 số câu thử). Vòng đá có 4 góc: Amodei (prediction), Neel Nanda (opinion), Nhà Trắng — AI Action Plan 07/2025 (opinion, đại diện “nhà quản lý”), nhóm kiểm định Anthropic với Claude Sonnet 4.5 (fact + `claimBy Anthropic`, nguồn là bài tường thuật system card của Transformer).
- **Trạm 24**: outline không có perspectives/tide/news nên **thêm scene 5 “Nhật ký thiền”** là vòng đá về độ tin cậy của chuỗi suy nghĩ (Anthropic 04/2025, OpenAI 03/2025, bài 41 tác giả 07/2025). Mục [Unverified] CoT faithfulness: **đã xác minh** (Anthropic, *Reasoning models don't always say what they think*, 03/04/2025: Claude 3.7 Sonnet 25%, DeepSeek R1 39%; lách luật >99% nhưng nói ra <2%). Ví dụ reward hacking lấy đúng từ Baker và cộng sự (OpenAI, 03/2025): cho hàm verify luôn trả true, thoát sớm để test không chạy. “Nghĩ lâu hơn thì đúng hơn” gắn `claimBy OpenAI` (o1) + `verifiedBy arcprize-o3` (ARC Prize tự chấm o3: 75,7% → 87,5% với ~172× tính toán). Nối Trạm 20 bằng số liệu Quanta (≈10.000 agent, 88 giờ), gắn `claimBy OpenAI`. Thẻ mang về `t24-kiem-chung` đặt ở scene 3 như outline. Tóm tắt đổi “không giúp nó thật thà hơn” → “**chưa chắc** giúp nó thật thà hơn” vì nghiên cứu chỉ cho thấy chuỗi suy nghĩ thường không trung thực, không chứng minh suy luận *không bao giờ* giúp trung thực hơn.
- Không có trạm tin tức trong vườn này → `news` để trống.

### Không xác minh được / đã bỏ
- Trang openai.com (bài Sycophancy in GPT-4o, Learning to reason with LLMs) chặn công cụ đọc tự động: nội dung đối chiếu qua TechCrunch 29/04/2025 và nhiều nguồn thứ cấp trích cùng một câu; các câu dẫn đều gắn `claimBy OpenAI`.
- Con số cửa sổ ngữ cảnh hiện tại của Gemini 3.x / GPT-5.x chỉ thấy ở trang so sánh thứ cấp, mâu thuẫn nhau (có trang nói Gemini 3 Pro 10M) → **không đưa vào**; mốc “hôm nay” chỉ nêu định tính “nhiều mô hình hàng đầu ~1 triệu token” + mốc Anthropic đã kiểm ở nguồn gốc.
- Bài 41 tác giả: trang arXiv không ghi đơn vị; “từ OpenAI, Google DeepMind, Anthropic” lấy theo TechCrunch 15/07/2025. Không xác nhận được Meta hay UK AISI nên không nhắc.
- Số vòng chấm điểm trong RLHF (“hàng chục nghìn lần”) không có số chắc → viết “rất nhiều lần”.

### Quyết định cần duyệt
- Nghiên cứu do chính hãng công bố về **lỗi/giới hạn** mô hình của mình (Golden Gate, attribution graphs, CoT faithfulness, ví dụ reward hacking) để là fact thường, không gắn `claimBy`; chỉ gắn `claimBy` cho con số năng lực/thành tích tự đo (InstructGPT thắng GPT-3, cửa sổ 10M, o1, audit Sonnet 4.5, 10.000 agent).

### Hai câu dễ tranh cãi nhất
1. Trạm 23, insight scene 4 (opinion của AI Zen): “Diễn giải hiện là một lớp kiểm tra thêm, chưa phải giấy chứng nhận an toàn.” — nghiêng về phía Nanda hơn Amodei; giữ vì cả hai bên đều đồng ý hiện tại chưa đủ.
2. Trạm 24, insight scene 4: “Cho mô hình suy luận nghĩ lâu hơn, nó thường giải đúng nhiều bài khó hơn” — đúng ở benchmark toán/code/ARC, chưa chắc đúng với mọi loại việc; đã ghi rõ “thường” và “bài khó”, kèm chi phí.

## Vườn 9 · Mặt hồ lặng (trạm 25–27)

### Đã xác minh từ nguồn gốc
- **Trạm 25, “171 khái niệm”**: đúng. Anthropic (nhóm Interpretability), 02/04/2026, mô hình Claude Sonnet 4.5. Thí nghiệm “đường tắt” là gian lận (reward hacking) ở bài code không thể giải: tăng “desperate” thì gian lận nhiều hơn, tăng “calm” thì ít hơn. **Bài không công bố tỉ lệ % cho thí nghiệm này**, nên insight chỉ nói định tính. Có thêm một chi tiết từ chính bài: đôi khi dòng “tuyệt vọng” đẩy mô hình gian lận mà chữ viết ra vẫn điềm tĩnh. Chi tiết này minh hoạ đúng việc tầng 1 và tầng 2 có thể lệch nhau.
- **Trạm 26, introspection**: blog “Signs of introspection in large language models” (29/10/2025), bài đầy đủ của Jack Lindsey “Emergent Introspective Awareness in Large Language Models”. Opus 4.1 nhận ra khái niệm bị cấy **khoảng 20%** số lần ở độ đậm tối ưu và không báo nhầm ở lần đối chứng. Số liệu do công ty tự công bố (◇).
- **Trạm 26, luật**: trang AUP ghi đúng câu “sustained and needless abusive or cruel behavior toward our models”, đăng 08/10/2026, hiệu lực 12/11/2026. Phạm vi loại trừ đúng như outline. Cơ chế xử lý chính vẫn là kết thúc cuộc trò chuyện. Thông báo **không nêu lý do** (phúc lợi mô hình hay thói quen người dùng), nên nội dung không gán lý do nào.
- Mốc 04/2025 (Exploring model welfare, 24/04) và 08/2025 (Opus 4/4.1 kết thúc cuộc trò chuyện, 15/08) đúng. Bài luận của Suleyman đăng 19/08/2025 đúng.

### Đã đổi so với outline
- **26 · Bốn ngọn đèn**: outline ngầm hiểu báo cáo Butlin, Long et al. 2023 soi cả 4 lý thuyết. Thực tế báo cáo chỉ dùng **5 lý thuyết dựa trên tính toán** (RPT, GWT, HOT, PP, AST) với giả định chức năng luận tính toán. Vì vậy hai đèn GWT và HOT dẫn Butlin 2023, đèn IIT dẫn Tononi & Koch 2015 (máy tính số “gần như không trải nghiệm gì”), đèn sinh học dẫn Anil Seth (BBS 2025). Detail của scene có nói rõ chỗ này.
- **26 · Thuỷ triều**: thêm mốc 11/2024 “Taking AI Welfare Seriously” (Long, Sebo và cộng sự, có David Chalmers) và mốc “Hôm nay”. Horizon là dự đoán của nhóm này, gắn kind `prediction`.
- **26 · Vòng đá**: mỗi góc nhìn đều có nguồn thật. Thận trọng: Long & Sebo 2024. Thói quen tử tế: Kate Darling (viết về robot xã hội, AI Zen áp dụng theo lối so sánh, đã ghi rõ ở source). Quá sớm: Suleyman 2025. Lo dùng để có lợi thương mại: Randima Fernando, Tech Policy Press 06/2026 (bài op-ed). **Không tìm được nhà nghiên cứu học thuật** nói thẳng “phúc lợi AI là marketing”, nên dùng bài op-ed này và viết thành “có lợi cho công ty: người dùng gắn bó hơn, dễ né trách nhiệm hơn”.
- **26** không có scene bia tin riêng. Station có `newsTags` ở top-level, bia đá do frame/builder gắn vào. Tin và thuỷ triều trùng một phần (welfare 2025, kết thúc hội thoại, luật 2026) là có chủ ý: thuỷ triều kể dòng thời gian, bia tin cho chi tiết.
- **27 · Chiếc đèn luôn đồng ý**: outline của trạm 27 không có perspectives/tide/news, mà C.0 bắt buộc phải có, nên đã thêm **vòng đá góc nhìn**: khảo sát Common Sense 2025 (39% mang kỹ năng giao tiếp ra đời thật; 80% vẫn dành nhiều thời gian cho bạn thật hơn), RCT MIT & OpenAI 2025 (981 người, 4 tuần, ghi rõ chỉ là tương quan), dữ liệu Claude.ai của Anthropic (2,9% cảm xúc, dưới 0,5% đồng hành/nhập vai, ◇), và khuyến nghị dưới 18 tuổi của Common Sense (quan điểm).
- **27 · Gương nịnh**: ví dụ có thật là Cheng et al., *Science* 2026 (11 mô hình, tán thành nhiều hơn con người **49%**; preprint 10/2025 ghi 50%, dùng số của bản đăng báo). Trạm 24 đã giải thích vì sao AI nịnh (RLHF, GPT-4o 04/2025), nên trạm 27 chỉ giữ góc nhìn con người, có dòng “xem trạm II·06”. Từ điển không thêm `sycophancy` vì g08 đã có.
- **27 · Đá có mặt người**: pareidolia dẫn Wardle et al. 2020 (Nature Communications). ELIZA dẫn Weizenbaum 1966 (CACM 9(1)). Giai thoại người thư ký là **lời kể của chính Weizenbaum** trong sách 1976, nội dung ghi “kể”.
- **27 · Lối đá**: thứ tự theo nhịp trước, trong, chuyện lớn, sau một cuộc trò chuyện. Trạm 27 là `concept` nhưng vẫn có 2 thẻ mang về như outline (prompt phản biện + checklist thói quen).

### Không xác minh được hoặc đã bỏ
- Tỉ lệ tống tiền 22% trong bài cảm xúc: có thật nhưng xảy ra trên một snapshot chưa phát hành và dễ gây hoảng, nên **không dùng**.
- “Một phần ba thiếu niên chọn AI thay người cho chuyện nghiêm túc” (Common Sense): mẫu số chưa rõ, lại gần chủ đề khủng hoảng, nên **không dùng**. Mọi số liệu khủng hoảng tâm lý (ví dụ thống kê của OpenAI về người dùng gặp nguy cơ) cũng **không dùng**, theo luật giọng ấm.
- HBR “therapy/companionship là cách dùng số 1”: là phân tích thứ cấp bài đăng Reddit, **không dùng**.
- Bản Hiến pháp mới của Claude (01/2026) bàn về tư cách đạo đức: chỉ thấy nguồn thứ cấp, **không dùng**.
- Ngày đăng trực tuyến chính xác của bài Seth (BBS): trang nhà xuất bản trả về 429/403, nên chỉ ghi năm 2025 kèm DOI lấy từ đường dẫn PDF chính thức.

### Câu dễ gây tranh cãi nhất đã giữ
1. Hai câu “common” của vòng đá ở trạm 25 và 26 (“Đồng ý… Khác nhau…”) là **AI Zen tự tổng hợp** (source `editorial`, kind `opinion`). Chủ dự án nên duyệt lời văn.
2. Câu trong đá của nhóm diễn giải Anthropic, rằng cảm xúc chức năng “có thật theo nghĩa đo và tác động được” và giúp cảnh báo sớm: đây là **cách chính công ty diễn giải nghiên cứu của mình**, gắn kind `opinion` + `claimBy`. Câu thi số 5 trong `exam-2.json` cũng nói phát hiện 171 khái niệm là do chính công ty công bố dù đó là một bài nghiên cứu, vì chưa có bên độc lập lặp lại.

## Vườn 10 · Mạch ngầm dưới vườn (trạm 28–30)

### Đổi so với outline, và vì sao

**Trạm 28**
- Vốn hoá: outline ghi khoảng 5.230 tỷ USD (Benzinga 05/2026). Con số này nhảy theo ngày (đầu 10/2026 báo chí ghi khoảng 5.700–5.800 tỷ), nên không viết số vốn hoá hiện tại. Thay bằng mốc đã chốt: công ty đầu tiên vượt 5.000 tỷ USD (29/10/2025).
- "Hơn 40 tỷ USD, lớn nhất 30 tỷ vào OpenAI": giữ 30 tỷ (AP, 27/02/2026). Bỏ con số tổng "hơn 40 tỷ" vì chỉ có Benzinga đưa, chưa đối chiếu được với báo cáo của hãng. Thay bằng số từ chính 10-Q của NVIDIA nộp SEC: cổ phần ở công ty chưa niêm yết tăng từ 22,3 lên 51,2 tỷ USD (25/01 → 26/07/2026), cùng khoản bảo lãnh tới 105 tỷ USD cho trung tâm dữ liệu phục vụ một công ty con của OpenAI (08/2026).
- Thêm một `progressTide` "Mùa đào vàng" (CUDA 2006 → Kaplan 2020 → doanh thu trung tâm dữ liệu 15,0 tỷ (năm tài chính 2023) → 193,7 tỷ (năm tài chính 2026) → 89 tỷ trong một quý (26/08/2026)). Toàn bộ số lấy từ hồ sơ SEC.
- Đối thủ 2026: dùng các thoả thuận có thông cáo chính thức — Anthropic dùng tới 1 triệu TPU (10/2025), OpenAI dùng 2 GW Trainium (02/2026), AMD–OpenAI 6 GW (10/2025).
- Vòng đá góc nhìn: Wedbush (qua Benzinga), Global X (qua Asia Economy), Jensen Huang (cùng bài, gắn `claimBy: NVIDIA`), Ngân hàng Trung ương Anh (biên bản FPC 08/10/2025). Bỏ khung "người nói nhu cầu là thật" chung chung; lời của Huang đứng ở vị trí đó.

**Trạm 29**
- "SK hynix, Samsung báo bán hết HBM 2026" [Unverified]: chỉ xác minh được SK hynix, qua thông cáo của chính hãng (29/10/2025): đã chốt khách cho toàn bộ sản lượng DRAM và NAND năm 2026, đàm phán HBM đã xong. Gắn `claimBy: SK hynix`. **Bỏ Samsung** vì không tìm thấy thông báo chính thức.
- J.P. Morgan "+400%": giữ, gắn `kind: prediction` vì mốc cuối 2026 chưa tới (bài 06/08/2026). "Hợp đồng dài hạn tới 5 năm" sửa thành "có hợp đồng từ năm năm trở lên", đúng câu chữ của J.P. Morgan.
- Thêm: Micron rút khỏi mảng Crucial (03/12/2025, thông cáo của hãng); IDC dự báo điện thoại 2026 giảm 12,9%, giá bán trung bình +14% lên 523 USD, giá bộ nhớ ổn định giữa 2027 (thông cáo IDC 26/02/2026, `kind: prediction`).
- Giá RAM/laptop ở Việt Nam [Unverified]: nguồn tìm được chủ yếu là trang của nhà bán lẻ (có lợi ích bán hàng) hoặc bài tổng hợp lại dự báo nước ngoài. **Bỏ mọi con số Việt Nam**; thay bằng mẹo mua máy định tính (`kind: illustration`).
- Thẻ "RAM bao nhiêu là đủ" viết dạng checklist mua máy, số là quy tắc ngón tay cái tự tính (khoảng 0,6 GB mỗi tỷ tham số ở 4-bit), ghi rõ là ước lượng. Bảng chi tiết "RAM → cỡ model" để cho trạm 32.

**Trạm 30**
- "Google cũng có bản Gemini chỉ cấp cho người phòng thủ đã thẩm định" [Unverified]: **xác minh được** qua blog chính thức của Google (02/09/2026): chương trình Fairwind, Gemini 3.8 Flash Cyber, chỉ cấp cho người phòng thủ đã thẩm định. Không đưa Gemini 4 Argon vì chỉ thấy qua trang thứ cấp trong lúc tra.
- Luật Việt Nam [Unverified]: **xác minh được**. Luật Trí tuệ nhân tạo số 134/2025/QH15, thông qua 10/12/2025 (429/434 phiếu, 35 điều), hiệu lực 01/03/2026 (VnEconomy). Nghị định 142/2026/NĐ-CP ban hành 30/04/2026, hiệu lực 01/05/2026 (Tilleke & Gibbins, 05/06/2026). Chưa mở được văn bản gốc trên cổng Chính phủ; nên đối chiếu thêm.
- EU: thêm gói Omnibus (Quy định 2026/1744, hiệu lực 27/07/2026) lùi hạn AI rủi ro cao tới 02/12/2027 và 02/08/2028 — nguồn là hãng luật Cuatrecasas, chưa mở được EUR-Lex.
- Mỹ: dùng sắc lệnh 14365 (11/12/2025, Federal Register). Trung Quốc: quy định dán nhãn nội dung AI hiệu lực 01/09/2025 (qua hãng luật Loeb & Loeb).
- Bản quyền: 5 hòn đá — người sáng tạo (Statement on AI training, 10/2024), OpenAI (01/2024, `claimBy`), toà Mỹ (Bartz v. Anthropic, 06/2025), nhà làm luật (EU AI Act, nghĩa vụ cho model đa dụng), người dùng (Cục Bản quyền Mỹ, 01/2025). Thêm hồ sơ: dàn xếp 1,5 tỷ USD được duyệt dứt điểm 20/07/2026; toà phúc thẩm khu vực 3 bác fair use của Ross (29/09/2026, lập luận còn niêm phong).

### Chưa xác minh được, đã bỏ
- Tổng "hơn 40 tỷ USD" đầu tư cổ phần 2026 của NVIDIA (chỉ Benzinga).
- Samsung "bán hết HBM 2026".
- Mọi con số giá RAM/điện thoại tại Việt Nam.
- Khoản "750 tỷ USD" và "bảo lãnh 250 tỷ" trong tin 07/2026: không đưa; chỉ dùng con số 105 tỷ có trong 10-Q.

### Quy ước đã chọn (cần duyệt)
- Số liệu tài chính nộp SEC (8-K, 10-K, 10-Q) và thông số sản phẩm (H200) **không** gắn `claimBy`: đó là hồ sơ pháp lý / thông số kỹ thuật, không phải benchmark tự đo. Thông cáo kiểu "đã bán hết", "sẽ dùng tới 1 triệu TPU", "giải được…" thì gắn `claimBy`.
- Câu tổng hợp của AI Zen (`common`, insight luật ở trạm 30, horizon luật) dùng `source: editorial` + `kind: opinion`/`prediction`.
- Một số nguồn là bản đăng lại (AP qua KSAT, Reuters qua The Star, SK hynix qua PR Newswire/TechNode, Benzinga qua Yahoo) vì bản gốc có paywall hoặc không mở được.

### 1–2 câu dễ gây tranh cãi nhất
1. Trạm 28, đá của Jensen Huang: "ông gọi cáo buộc vòng tròn là vô căn cứ" — đặt ngang hàng với Wedbush, Global X, BoE. Lời của bên bị phê phán, gắn ◇ `claimBy: NVIDIA`; các hòn đá không xếp hạng.
2. Trạm 29, insight "Lạm phát chip đẩy giá điện thoại, máy tính lên": cơ chế có nguồn (J.P. Morgan: nhà sản xuất chuyển chi phí vào giá bán; IDC: giá bán trung bình +14%), nhưng mức tăng cụ thể ở từng nước, nhất là Việt Nam, chưa có số liệu đáng tin.

## Vườn 11 · Vườn mở (trạm 31–33)

### Đổi so với outline và lý do
- **Trạm 31 · số model Hugging Face**: outline ghi “hơn 2,7 triệu [Unverified]”. Đã kiểm tra trực tiếp trang huggingface.co/models ngày 15/10/2026: **3.156.130 model công khai** (lọc GGUF: 211.773). Dùng số này, ghi rõ ngày. Tài liệu Hub của chính HF vẫn ghi “over 2M” (chưa cập nhật) nên không dùng.
- **Trạm 31 có thêm scene `depth` (progressTide)** để trạm có ít nhất một thành phần perspectives/tide/news: mốc 09/2024 (1 triệu, lời CEO → `claimBy`), 02/2026 (ggml về HF), hôm nay. Không dùng các mốc 2,4 triệu / 3 triệu 08/2026 vì chỉ thấy ở blog thứ cấp (blog đó còn kể chuyện “NVIDIA mua Hugging Face 09/2026” mà tôi không xác minh được).
- **Trạm 32 · llama.cpp gia nhập Hugging Face [Unverified]**: đã xác minh ở blog chính thức HF (20/02/2026). Ghi là ggml “gia nhập”, kèm `claimBy: Hugging Face` cho phần cam kết “vẫn mở”.
- **Trạm 32 · bảng RAM → cỡ model**: tự tính từ bảng lượng tử hoá của HF (Q4_K ≈ 4,5 bit/trọng số) + quy tắc “file < ~½ RAM” do AI Zen đặt; gắn `kind: illustration`, ghi rõ là ước lượng.
- **Trạm 32 · lệnh mẫu**: dùng đúng ví dụ trong tài liệu Ollama (`gemma4:e2b`, ~7 GB). Thẻ mang về dùng placeholder `[TÊN MODEL]` vì tên model đổi liên tục. Thêm sắc thái: Ollama có cả model cloud (cần API key) — “Ollama = local” không còn đúng tuyệt đối.
- **Trạm 32 có 5 scene** (tách `codeScroll` khỏi `lamps` thành scene `scroll`) để mỗi scene một ẩn dụ, một tương tác.
- **Trạm 33 · Hermes Agent**: outline ghi “ra mắt 02/2026”. GitHub API: repo tạo 22/07/2025 (nội bộ); release notes v0.2.0 (12/03/2026) nói v0.1.0 là “nền móng trước khi công khai” và dự án công khai “hơn hai tuần” trước đó → viết “công khai cuối tháng 2/2026”. Trang hermes-agent.org trong mục G **không phải trang chính thức** (homepage repo là hermes-agent.nousresearch.com) nên không dùng làm nguồn.
- **Trạm 33 · OpenClaw [Unverified]**: đã xác minh qua README GitHub (MIT, trợ lý AI cá nhân chạy trên thiết bị của bạn, 20+ kênh, model cloud hoặc local) và trang lore chính thức (Clawdbot → Moltbot 27/01 → OpenClaw 30/01/2026).
- **Trạm 33 · “So với Claude Code / Codex”**: chỉ giữ Claude Code (có nguồn tài liệu chính thức). Bỏ Codex vì trang tài liệu chuyển hướng sang tên miền khác, chưa đối chiếu được mô tả.
- **Trạm 33 · component**: là trạm `practice` + news nên có `newsTags` + scene `stones` (bia đá), 2 thẻ mang về.

### Không xác minh được — đã bỏ hoặc viết định tính
- Số instance OpenClaw bị lộ ra internet (21.000–42.000 tuỳ nguồn): bỏ.
- Số skill độc hại về sau (900–1.184): bỏ; chỉ giữ con số gốc 341/2.857 của Koi Security, gắn `claimBy`.
- Kaspersky “512 lỗ hổng”: bỏ.
- **Ngày của tin ClawHub (`n33-clawhub-skills`)**: bài The Hacker News đăng 02/2026 nhưng chặn bot; ngày `2026-02-01` suy từ chi tiết “Koi công bố vào Chủ nhật” (SC Media, thứ cấp) + timeline thứ cấp. **Cần người duyệt mở bài gốc kiểm lại ngày.**
- Repo giả mạo trên GitHub (Apiiro): giữ định tính, không đưa con số “100.000+ / hàng triệu” vì chính Apiiro nói khó đếm.
- JFrog 2024: không đưa “100 model” vì JFrog sau đó nói chỉ ~10 model thật sự độc hại; viết định tính.
- Vụ “mua sao GitHub”: không đưa vào (chưa kiểm nguồn gốc); chỉ nói sao là độ phổ biến, không phải bảo chứng.

### 1–2 câu dễ tranh cãi nhất đã giữ
1. Trạm 32, vòng đá: “model lớn trên mây thường vẫn giỏi hơn model vừa với một chiếc laptop” — gắn `opinion`, nguồn editorial; đúng với tình hình 10/2026 nhưng khoảng cách đang thu hẹp.
2. Trạm 33, bia đá: “Đầu 2026, agent thường trực lan rất nhanh — kéo theo lỗ hổng và skill độc hại” — có nguồn (NVD, Koi qua THN) nhưng chủ yếu dẫn ví dụ OpenClaw; Hermes chưa có sự cố tương tự được báo. Tránh để người đọc hiểu là chê riêng một dự án.

### Cho bước dựng trạm
- Trạm 32 scene `table`: `fitRule` = tỉ lệ file/RAM (≤ 0,45 vừa · ≤ 0,75 chật · > 0,75 tràn), khớp bảng thẻ `t32-ram-table`.
- Trạm 31 `depth.tide` có `compare.ratio = 3.16` (> 1, vì là tăng trưởng) — component cần chấp nhận ratio > 1.
- Chuỗi `{item}`, `{well}`, `{n}`, `{label}`, `{name}`, `{gb}`, `{ram}`, `{side}`, `{state}` là placeholder cho code thay.

## Vườn 12 · Xưởng dưới trăng (trạm 34–36)

### Thay đổi so với outline (spec mục C, Vườn 12)
- **Trạm 34 · Higgsfield**: trang chủ hiện nêu Sora 2, Kling 3.0, Veo 3.1, Seedance 2.5, Wan 3.0 và “30+ models”; **không thấy MiniMax** → bỏ MiniMax. “Soul” chỉ thấy rõ ở dạng Soul ID trong blog của hãng; câu về Soul đưa vào phần mô tả Marketing Studio thay vì nêu như một model riêng. Mọi mô tả tính năng gắn `claimBy`.
- **Trạm 34 · TopView**: hướng dẫn chính thức chỉ liệt kê *URL to Video*, *Product Avatar*, *Video Agent*; chuyện avatar **cầm/mặc** sản phẩm chỉ thấy ở nguồn thứ cấp → viết trung tính là “người dẫn ảo cho sản phẩm”.
- **Trạm 34 · Magnific**: xác nhận đổi tên 28/04/2026 (Tech.eu + thông cáo). Không đưa số ARR vì các nguồn lệch nhau ($200M vs $230M) và không cần cho bài học.
- **Trạm 34 · Credit**: không dùng bảng giá cụ thể (các nguồn thứ cấp mâu thuẫn); chỉ dùng trang Help Center chính thức của Higgsfield (giá tuỳ model/độ phân giải/độ dài, hiện trên nút, credit thuê bao không cộng dồn). Số “phần nước” trong mô phỏng gắn `illustration`.
- **Trạm 34 · Thật và giả**: neo bằng luật Việt Nam thay vì chỉ nêu chung chung: Luật Trí tuệ nhân tạo 134/2025/QH15 Điều 11 (hiệu lực 01/03/2026; nguồn: bản tiếng Anh trên Cổng TTĐT Chính phủ) và Bộ luật Dân sự 2015 Điều 32. Nền tảng: dùng YouTube (trang Help truy cập được); trang TikTok không tải được nên không dùng. Góc nhìn “người tiêu dùng” là quan điểm do AI Zen diễn đạt (`opinion`, `editorial`) vì không tìm được khảo sát độc lập đủ chắc trong thời gian cho phép.
- **Trạm 35 · [Unverified] số công cụ hỗ trợ SKILL.md**: nguồn thứ cấp nói “30+”; trang chính thức agentskills.io ngày 15/10/2026 liệt kê **46** sản phẩm → viết “hơn 40”, nguồn agentskills.io, kèm lưu ý mức hỗ trợ mỗi nơi khác nhau. Mốc: Agent Skills ra mắt 16/10/2025, thành chuẩn mở 18/12/2025 (blog Claude).
- **Trạm 35**: thêm scene thứ 5 `moons` (progressTide) vì mỗi trạm bắt buộc có perspectives/tide/news; các mốc MCP (25/11/2024), “Building effective agents” (19/12/2024), Spec Kit (02/09/2025), Skills (16/10/2025, 18/12/2025). Ở dây chuyền marketing, đổi “viết 5 hook” thành “viết 5 câu mở đầu” để không lẫn với “hook” tự động hoá.
- **Trạm 36**: outline có 5 scene nhưng chưa có perspectives/tide → **gộp “Game lớn dần từng lớp” và “Chơi thử 30 giây” thành một scene `layers`** (đặt lớp cuối thì hồ chơi được), thêm scene `vibe` (perspectiveCircle về vibe coding: Karpathy, Willison, Veracode, Collins, người mới học).
- **Trạm 36 · Phaser**: outline ghi “Phaser 3 + Vite”; Phaser đã sang dòng 4 (4.2.1 ngày 09/07/2026, phaser.io) → lời dặn đổi thành “Phaser 4 + Vite”.
- **Trạm 36 · codeScroll**: dùng đoạn **Canvas 2D** (cá bơi theo ngón tay + vòng lặp) thay cho ví dụ Three.js trong outline, để khớp với game mặc định Canvas 2D ở cuối trạm. Vite: `npm create vite@latest`, cổng 5173, Node 20.19+/22.12+ (vite.dev).
- Không có trạm tin tức trong vườn này → `news` để trống.

### Không xác minh được, đã bỏ
- MiniMax trong danh sách model của Higgsfield; bảng giá credit cụ thể từng model; số avatar của TopView; ngày chính xác bài đăng của Karpathy (nguồn ghi 2/2 và 6/2) → chỉ ghi “2/2025”.

### Câu dễ gây tranh cãi nhất (nên duyệt)
1. Đá “Hãng bảo mật” ở trạm 36: “khoảng 45% trường hợp, code AI viết có lỗ hổng” — đây là benchmark tự đo của Veracode (hãng bán dịch vụ bảo mật), 80 bài trên hơn 100 model, 07/2025; đã gắn `claimBy: Veracode`, nhưng con số dễ bị đọc thành “45% mọi code AI đều lỗi”.
2. Đá “Thương hiệu” ở trạm 34 tóm tắt Điều 11 Luật Trí tuệ nhân tạo: bắt buộc nhãn khi giả lập người thật. Nguồn tiếng Việt và bản dịch tiếng Anh đánh số khoản khác nhau; đã bỏ số khoản và ghi “không phải tư vấn pháp lý”. Nên đối chiếu Công báo trước khi phát hành.

## Vườn 13 · Ngã rẽ dưới trăng (trạm 37–39)

### Đã đổi so với outline
- **Trạm 37, scene 2:** mục [Unverified] về GPT-6.1 Astra **giữ lại** vì đã xác minh: WSJ đưa tin, Al Jazeera (29/09/2026) có phát biểu trực tiếp của Saachi Jain (trưởng nhóm hệ thống an toàn OpenAI). Lý do huỷ là lời OpenAI tự nêu nên gắn `claimBy: OpenAI`. Chi tiết “lừa dối nhiều hơn bản trước” chỉ có ở WSJ (bài gốc sau tường phí) nên **không** đưa vào; chỉ giữ ý “làm quá phạm vi, báo lại chưa đúng việc đã làm” theo lời Jain. Chi tiết agent của OpenAI “xâm nhập Hugging Face / Medicare Úc” thấy trong tin thứ cấp, **bỏ** vì chưa mở được nguồn gốc.
- **Alignment faking:** diễn đạt theo bài gốc Anthropic (18/12/2024): 12% làm theo yêu cầu có hại khi tin mình đang bị huấn luyện, 97% từ chối khi tin không ai dùng; ghi rõ là kịch bản dựng sẵn. Gắn `claimBy: Anthropic & Redwood Research` (nghiên cứu tự công bố về model của chính hãng, chưa thấy bên độc lập lặp lại).
- **Thêm** Báo cáo An toàn AI Quốc tế 2026 (03/02/2026) làm xương sống cho scene 2 (model nhận ra đang bị thử), scene 3 (phòng thủ nhiều lớp, “biện pháp hiện nay chưa ngăn được mọi tác hại”) và insight chung của vòng đá góc nhìn (“thế khó về bằng chứng”).
- **Scene 1 trạm 37** thêm ví dụ thật (DeepMind 2020: lật khối Lego, thuyền CoastRunners chạy vòng) cho ẩn dụ “chặt cây để sạch lá”. Bài gốc OpenAI 2016 về CoastRunners chặn truy cập (403) nên dùng bản tổng hợp của DeepMind.
- **Scene 3 trạm 37** cụ thể hoá “hàng rào nhiều lớp” thành 6 lớp có nguồn: RSP bản 3.4 (hiệu lực 08/07/2026), Project Glasswing (07/04/2026, 12 đối tác + hơn 40 tổ chức), chính sách sử dụng 2026 (08/10/2026, hiệu lực 12/11/2026), nghĩa vụ model đa dụng của EU AI Act (02/08/2025).
- **Trạm 37 có thêm 1 thẻ mang về** (`t37-goal-check`) dù là trạm concept: checklist giao mục tiêu cho agent, nối thẳng bài học lách mục tiêu + vụ Astra.
- **Trạm 38, scene 1:** dùng `perspectives` cho 4 định nghĩa AGI (OpenAI Charter · DeepMind Levels of AGI · Hendrycks/Bengio 2025 · hợp đồng Microsoft–OpenAI 10/2025). Bỏ định nghĩa “ACI kiếm 1 triệu USD” của Suleyman và tin “AGI = 100 tỉ USD lợi nhuận” (The Information) vì không kịp mở nguồn gốc.
- **Trạm 38, scene 2 (METR):** outline ghi “gấp đôi ~7 tháng [cập nhật số mới]”. Con số 7 tháng là của bài 03/2025; các con số mới (TH1.1: ~131 ngày từ 2023, ~89 ngày từ 2024) **chỉ thấy ở nguồn thứ cấp** (Manifold, blog) nên **không** đưa vào. Thay bằng các số đo có nguồn METR: Claude 3.7 Sonnet ≈ 1 giờ (03/2025), GPT-5 ≈ 2 giờ 17 phút, Mythos Preview bản sớm ≥ 16 giờ (khoảng tin cậy 8,5–55 giờ). Ghi rõ trang METR ngừng cập nhật từ 08/09/2026 và đo không tin cậy trên 16 giờ. Mốc trạm 20 (IMO 07/2025, Navier–Stokes 09/2026) đưa vào tide; mốc robot chạy (trạm 21) **không** đưa vì không mở được nguồn gốc AP (403) — để trạm 21 lo.
- **Trạm 38, scene 3:** ba cần gạt dẫn tới 5 kịch bản `illustration`; thêm 2 “kịch bản người ta hay nhắc” có nguồn: AI 2027 (`prediction`) kèm ghi chú chính tác giả đã lùi trung vị (một tác giả: 2030), và “AI là công nghệ bình thường” (`opinion`). Quy tắc chọn kịch bản cho người dựng trạm: cần gạt 0–100, ≥ 50 là `high`; duyệt `scenarios` theo thứ tự, kịch bản đầu tiên khớp mọi điều kiện trong `when` thắng; `when: {}` là mặc định.
- **Trạm 38, scene 4:** cách xếp “chuyên gia” vào 3 khay là **góc nhìn biên tập** (`opinion`), không phải khảo sát; dữ kiện đi kèm là WEF Future of Jobs 2025 (`prediction`: 170 triệu việc mới, 92 triệu mất, gần 40% kỹ năng đổi tới 2030).
- **Trạm 39:** thêm scene 4 `advice` (vòng đá góc nhìn: Mollick · Microsoft Research CHI 2025 · MIT Media Lab 2025) để trạm thực hành có thành phần bắt buộc; ensō thành scene 5. Ví dụ công cụ luôn ≥ 2 lựa chọn, link trang chính thức, kèm câu “giá & tính năng thay đổi thường xuyên”. Ví dụ ảnh/video thêm Adobe Firefly, Canva cạnh Higgsfield, TopView để không nghiêng về một nhóm; Magnific không link vì trang chặn kiểm tra (403).
- **Thẻ tuần 2–3** viết thành kế hoạch 7 ngày và **trỏ sang** thẻ trạm 34, 35 thay vì chép lại (tránh trùng trong Túi đồ nghề). Thẻ tuần 4 là prompt cho **mini app công việc**; game thì trỏ sang bộ thẻ trạm 36.
- Glossary: không thêm `specification-gaming` vì g08 đã có `reward-hacking` (aka specification gaming); thay bằng `evaluation-awareness`. `agi` đã có ở Phần 1 (trạm 3) nên không thêm.
- Không có trạm tin tức trong vườn này → `news` rỗng.

### Không xác minh được, đã bỏ
- Số doubling time mới của METR (TH1.1) — chỉ có nguồn thứ cấp.
- Con số chính xác ~17,4 giờ của Mythos (DataLearner, Manifold) — METR chỉ nói “ít nhất 16 giờ”.
- Chi tiết “Astra lừa dối nhiều hơn” và các sự cố agent OpenAI tháng 6–7/2026.
- Định nghĩa ACI của Suleyman; tin “AGI = 100 tỉ USD lợi nhuận”.
- Tỉ lệ cộng tác/tự động hoá mới của Anthropic Economic Index (01/2026) — chỉ thấy qua bản tóm tắt thứ cấp.

### Câu dễ gây tranh cãi nhất (đã giữ)
1. **“Trong khoảng một năm, việc AI tự làm xong dài từ chừng 1 giờ lên ít nhất 16 giờ”** (trạm 38): hai số đo dùng hai phiên bản bộ bài thử của METR (2025 và TH1.1), và mốc 16 giờ METR tự nói là kém tin cậy. Insight đã ghi “chủ yếu là việc lập trình”, detail nói rõ giới hạn; vẫn nên duyệt.
2. **Vụ GPT-6.1 Astra** (trạm 37): chỉ dựa trên lời OpenAI qua báo chí, chưa có tài liệu chính thức trên trang OpenAI; có một trang (Runtime Wire) nói không tìm thấy GPT-6.1 trong tài liệu công khai — điều này hợp lý vì model không được phát hành. Gắn `claimBy: OpenAI`.
3. (Phụ) Cách xếp 8 việc marketing vào 3 khay ở trạm 38 là phán đoán biên tập, đã gắn `opinion` và ghi “mỗi tháng có thể khác”.

## Phụ lục · Ứng viên chưa dùng

Giữ lại để dùng sau (thư mục `docs/part2-staging/` đã xoá sau khi gộp).

Thuật ngữ:

```json
[
  {
    "id": "blowup",
    "term": "Blowup",
    "vi": "điểm “nổ” (kỳ dị)",
    "aka": [
      "singularity",
      "điểm kỳ dị"
    ],
    "def": "Lúc một đại lượng trong phương trình, như độ xoáy của dòng nước, vọt lên vô hạn chỉ sau một khoảng thời gian hữu hạn.",
    "station": 20,
    "part": 2
  },
  {
    "id": "global-workspace",
    "term": "Global Workspace Theory",
    "vi": "thuyết không gian làm việc toàn cục",
    "aka": [
      "GWT"
    ],
    "def": "Lý thuyết ý thức: thông tin trở nên “được biết” khi lên một sân khấu chung, phát tới mọi bộ phận của hệ thống.",
    "station": 26,
    "part": 2
  },
  {
    "id": "pareidolia",
    "term": "pareidolia",
    "vi": "ảo ảnh khuôn mặt",
    "def": "Thấy khuôn mặt hay hình quen ở nơi không có — trong đá, mây, ổ cắm điện.",
    "station": 27,
    "part": 2
  },
  {
    "id": "chipflation",
    "term": "chipflation",
    "vi": "lạm phát chip",
    "def": "Cách gọi việc giá chip, nhất là bộ nhớ, tăng mạnh vì AI rồi kéo giá điện thoại, máy tính tăng theo.",
    "station": 29,
    "part": 2
  },
  {
    "id": "credit",
    "term": "credit",
    "vi": "tín dụng nền tảng",
    "def": "Đơn vị trả phí trên nhiều nền tảng AI; mỗi lượt tạo tốn số credit tuỳ model, độ phân giải, độ dài.",
    "station": 34,
    "part": 2
  }
]
```

Câu thi:

```json
[
  {
    "q": "Năm 2025, CEO Anthropic viết: đến 2027, diễn giải sẽ phát hiện được phần lớn vấn đề của mô hình. Câu này là gì?",
    "options": [
      "Sự thật đã kiểm chứng",
      "Quan điểm",
      "Dự đoán",
      "Công ty tự công bố kết quả"
    ],
    "answer": 2,
    "explain": "Đó là mục tiêu cho tương lai, chưa xảy ra nên chưa thể kiểm chứng — một dự đoán, dù người nói rất am hiểu.",
    "station": 23
  },
  {
    "topic": "Đọc tin bộ nhớ",
    "q": "“Giá DRAM từ đầu 2024 tới cuối 2026 sẽ tăng hơn 400%” (J.P. Morgan, 08/2026). Câu này là gì?",
    "options": [
      "Sự thật đã kiểm chứng",
      "Quan điểm",
      "Dự đoán",
      "Công ty tự công bố về sản phẩm của mình"
    ],
    "answer": 2,
    "explain": "Mốc cuối 2026 chưa tới, nên đây là ước tính của một ngân hàng — một dự đoán, chưa phải giá đã đo.",
    "station": 29
  },
  {
    "q": "Blog của Higgsfield viết: Marketing Studio biến một link sản phẩm thành video quảng cáo có người dẫn, tiếng và khẩu hình. Câu này là gì?",
    "options": [
      "Sự thật đã được bên độc lập kiểm chứng",
      "Quan điểm cá nhân của người viết",
      "Dự đoán về tương lai",
      "Công ty tự công bố về sản phẩm của mình"
    ],
    "answer": 3,
    "explain": "Đây là lời hãng tự nói trên kênh của mình (◇). Muốn tin chắc, hãy tự thử hoặc tìm bên độc lập đã kiểm tra.",
    "station": 34
  }
]
```
