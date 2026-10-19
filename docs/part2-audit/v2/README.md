# Audit Part 2 · bản v2 · 18/10/2026

Audit 21 trạm t19–t39 ở commit `0950f07`, chưa sửa app. Bản v2 thêm hai phần so với v1: **câu chữ** và **logic trình bày thông tin**. Mỗi slide một mục riêng, gồm cả quiz và ensō.

## Cách đọc

- **Toàn bộ 21 trạm trong một file:** [toan-bo-21-tram.md](toan-bo-21-tram.md). Dùng file này để so với audit của Đại ca.
- **Theo vườn:** [g07](g07.md) t19–21 · [g08](g08.md) t22–24 · [g09](g09.md) t25–27 · [g10](g10.md) t28–30 · [g11](g11.md) t31–33 · [g12](g12.md) t34–36 · [g13](g13.md) t37–39.
- **Mỗi trạm có:**
  - mục tiêu học;
  - mạch slide hiện tại, vấn đề của mạch, mạch đề xuất;
  - kicker, tóm tắt, thẻ mang về: chữ hiện tại → lỗi → câu đề xuất;
  - điểm Gameplay / Layout / Câu chữ / Logic thông tin.
- **Mỗi slide có:**
  - ảnh hiện tại;
  - **Hiện tại:** thấy gì, làm gì, prompt nguyên văn, chữ trên màn nguyên văn;
  - **Lỗi:** chia 4 loại, gameplay · layout · câu chữ · logic thông tin;
  - **Đề xuất sửa:** gameplay, layout, và câu chữ viết sẵn (prompt, nhãn, insight, "Thêm một chút").
- **Cuối mỗi vườn:** bảng tóm tắt slide, top 5 việc nên làm, những chỗ đổi so với v1.
- **Thang đánh giá:**
  - Mức: Giữ / Sửa nhẹ / Làm lại.
  - Ưu tiên: **P1** = chặn chơi hoặc dạy sai · **P2** = khó hiểu, khó chơi · **P3** = đánh bóng.
- **Bản v1** (chỉ gameplay/layout) để ở `v1/`.

## Kết quả

**96 slide nội dung: 28 Làm lại · 66 Sửa nhẹ · 2 Giữ** (t21-4, t36-2).
**Theo ưu tiên: 28 P1 · 64 P2 · 4 P3.**
**42 mục quiz + ensō: 35 Sửa nhẹ · 7 Giữ.**

So với v1, t23-2 và t29-4 đã hạ từ Giữ xuống Sửa nhẹ, vì lỗi câu chữ: thuật ngữ chưa giải thích, câu khuôn.

Điểm thang 10 theo thứ tự **G**ameplay · **L**ayout · **C**âu chữ · lo**G**ic thông tin. Mỗi ô slide ghi Mức·Ưu tiên (SN = Sửa nhẹ, LL = Làm lại).

| Trạm | G·L·C·Lg | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| 19 Đỉnh núi 2026 | 5·6·5·4 | SN·**P1** | LL·**P1** | LL·P2 → gộp vào 2 | SN·P2 | SN·P2 | |
| 20 AI làm toán | 5·5·**4·4** | SN·P2 | LL·**P1** | SN·P2 | SN·P2 | | |
| 21 Robot marathon | 6·6·6·6 | SN·P2 | SN·P2 | SN·P2 | Giữ·P3 | | |
| 22 Attention | 6·6·5·5 | SN·P2 | SN·**P1** | SN·P2 | LL·**P1** | | |
| 23 Diễn giải AI | **4**·5·**4·4** | SN·P2 | SN·P2 | LL·**P1** | SN·P2 | | |
| 24 Học & nghĩ | 5·5·5·5 | SN·P2 | SN·P2 | LL·P2 | SN·P2 | LL·**P1** | |
| 25 Cảm xúc | **4**·6·5·5 | SN·P2 | SN·**P1** | SN·**P1** | SN·P2 | | |
| 26 Ý thức & phúc lợi | 5·6·**4·4** | SN·P2 | SN·P2 | LL·P2 | SN·P2 | LL·P2 | |
| 27 Gắn bó với AI | 6·6·6·6 | SN·P2 | LL·P2 | SN·P2 | SN·P2 | | |
| 28 NVIDIA | 5·6·5·**4** | SN·P2 | LL·**P1** | LL·**P1** | SN·P2 | SN·P2 | LL·P2 → gộp vào 5 |
| 29 Bộ nhớ | 6·7·6·6 | SN·P2 | SN·**P1** | LL·**P1** | SN·P3 | | |
| 30 Mở hay đóng | 5·6·6·5 | SN·P2 | SN·P2 | LL·**P1** | SN·P2 | | |
| 31 HF & GitHub | 5·6·5·5 | SN·P2 | LL·P2 | SN·P2 | SN·P2 | LL·P2 | |
| 32 AI trên máy | 6·5·**4**·5 | SN·**P1** | SN·P2 | SN·P2 | SN·**P1** | LL·**P1** | LL·P2 → gộp vào 1 |
| 33 Agent trên máy | 7·6·6·5 | SN·P2 | SN·**P1** | SN·**P1** | LL·P2 | LL·P2 → cắt | |
| 34 Nền tảng sáng tạo | 5·5·6·5 | SN·**P1** | LL·P2 | SN·**P1** | SN·P2 | | |
| 35 Skills & workflow | **4**·6·5·**4** | LL·**P1** | SN·P2 | LL·P2 | LL·P2 | SN·**P1** | |
| 36 Code game | 6·6·5·5 | SN·P2 | Giữ·P3 | LL·P2 | SN·P2 | SN·P2 | |
| 37 An toàn | 5·6·5·**4** | SN·P2 | LL·**P1** | SN·P2 | SN·P2 | | |
| 38 AGI & nghề | 6·6·6·6 | SN·P2 | SN·**P1** | SN·P2 | SN·P2 | | |
| 39 Vườn của bạn | **4**·5·5·**4** | SN·P3 | SN·**P1** | LL·**P1** | SN·**P1** | SN·P2 | |

- **Logic thông tin yếu nhất (4/10):** t19, t20, t23, t26, t28, t35, t37, t39.
- **Câu chữ yếu nhất (4/10):** t20, t23, t26, t32.

---

## A. Câu chữ: lỗi chung (chi tiết và câu viết sẵn nằm trong từng slide)

1. **Ẩn dụ không được giải mã.** Người xem phải tự đoán vật nào là cái gì. Cần một dòng giải mã, nói một lần ngay lúc vật xuất hiện. Ví dụ đang thiếu:
   - đỉnh = một mô hình; đá trong tide = một mô hình cỡ GPT-4; đom đóm = một bản AI chạy song song;
   - xẻng = chip; vòi tre = một lõi GPU; cầu tre = mã viết cho CUDA;
   - bàn = RAM; dầu đèn = file GGUF; bia giếng = model card; người giữ vườn = agent;
   - người giấy = AI; đốm = một tác hại; chiếc lá = bạn; chân trời xa/gần = rủi ro muộn/sớm.

   Kicker cũng chỉ có ẩn dụ: t19 "mây che đường", t25 "là gió hay là hồ", t26 "trăng có biết mình là trăng". Ensō t34 dùng "cây đục", một hình không xuất hiện ở slide nào.
2. **Thuật ngữ để trần.** Ví dụ: token, benchmark, system card, Lean, zero-day, CVE, VLA, FLOP, attention, feature, superposition, attribution graph, RLHF, sycophancy, reward hacking, chain of thought, HBM, DRAM, NAND, CUDA, gigawatt, mở trọng số, API, API key, localhost, curl, VRAM, B (tỷ tham số), Q4, GGUF, MCP, spec, git, npm, vibe coding, alignment / "căn chỉnh", AGI. Ở t32 còn có công thức "× bit ÷ 8".
   - **Quy tắc đề xuất:** trên màn chỉ dùng lời thường. Thuật ngữ, nếu cần, để trong ngoặc ở "Thêm một chút".
3. **Insight mở đầu bằng thuật ngữ, đọc như định nghĩa sách giáo khoa.** Ví dụ "(feature)…", "(superposition)…", "model card đi kèm mỗi model: mục đích, giới hạn…". Không nói điều người xem *vừa thấy*.
   - **Mẫu đề xuất:** "Bạn vừa thấy X → nghĩa là Y", ≤ 22 từ.
4. **Câu khuôn "Đồng ý… Khác nhau ở…" làm insight** ở hầu hết vòng quan điểm (19-3, 20-4, 21-4, 23-4, 24-5, 28-6, 29-4, 32-6, 34-4, 36-5…). Câu này dài 26–29 từ, cụt (36-5 thiếu vế "Đều đồng ý"), trong khi câu kết luận hay hơn bị giấu (code đẩy xuống detail, ví dụ `circle.ts:562`).
5. **Văn dịch máy, tiếng Anh sót, chữ in hoa:**
   - "Quy tắc ngón tay cái" (rule of thumb), "ý định là gốc", "spec sống", "Bản đồ quy kết" (nghe như đổ lỗi);
   - "tín dụng" (credit của nền tảng); tên trạm "Attention" và "Diễn giải được AI";
   - "asset", "progressive disclosure", "prompt khổng lồ";
   - "HAI REPO GIẢ LẬP ĐỂ HỌC", "CHUYỆN GÌ", "CHỮ IN HOA".
6. **Từ và số không thống nhất giữa các slide:**
   - system card / "thẻ hệ thống";
   - t26 gọi một chính sách của công ty là "luật";
   - "cảm giác / cảm xúc / trải nghiệm / ý thức" dùng lẫn nhau;
   - cỡ model cho laptop 1B–14B / 1–8B / 7 GB;
   - 3,15 và 3,16 triệu đặt cạnh nhau;
   - "15/10/2026" và "Hôm nay" cho cùng một ngày;
   - "Hai kịch bản" mà có 3 mẩu giấy (38-3).
7. **Prompt không nói đúng cử chỉ hoặc đúng vật.**
   - Sai vật: "Kéo trăng" mà phải kéo đá (29-3, 31-2).
   - Không nói cử chỉ: "Chia 100 giọt" mà phải nghiêng chậu (28-2); "Lần theo dòng tiền" mà phải xoay guồng (28-5); "Chọn bông" mà bông không bấm được (24-1).
   - Gợi ý cử chỉ chỉ có cho trình đọc màn hình, không hiện trên màn: 26-1, 27-1, 29-1, 34-4.
8. **Nhãn độ tin cậy làm loãng chính bài học.**
   - 31/36 câu insight mang dấu ◐ "Quan điểm", nguồn "Diễn giải của AI Zen".
   - 102/169 dữ kiện của Part 2 gắn "Quan điểm".
   - Hệ quả: kết luận của bài học trông như ý kiến cá nhân, còn dấu "Quan điểm" thật của các phe thì mất nghĩa.
   - **Đề xuất:** câu tóm của AI Zen dùng dấu riêng ("AI Zen tóm lại") hoặc không có dấu; chỉ lời của người hoặc phe có tên mới mang "Quan điểm".
9. **Chữ dùng chung của khung trạm** (`site.json`):

   | Chữ hiện tại | Vấn đề | Đề xuất |
   |---|---|---|
   | "Nghe từng hòn đá" | Không nói đá là gì | "Chạm từng hòn đá: mỗi hòn là một góc nhìn" |
   | "Đặt đá theo thứ tự" | Thứ tự gì? | "Xếp đá theo thứ tự bạn sẽ làm" |
   | "Chưa đúng chỗ. Gợi ý: {why}" | Đang chèn lời giải thích của chính viên đá, không phải gợi ý về thứ tự | Gợi ý nói về vị trí, ví dụ "Việc này cần làm sau khi…" |
   | "Lối đã sáng" | Tên card không nói card là gì | Đặt tên theo nội dung, ví dụ "Danh sách kiểm: đăng một asset" |
   | "Chỉ xem tin đã kiểm chứng" và "Chưa có tin nào ở đây được kiểm chứng độc lập." | Dễ hiểu thành "tin chưa có thật" | "Chỉ giữ con số đã có bên ngoài kiểm lại" / "Các con số ở đây đều do chính hãng tự đo." |
   | "Thêm một chút" | Không nói bên trong là chi tiết | (P3) "Chi tiết & nguồn" |

## B. Logic trình bày thông tin: lỗi chung

1. **Thông tin đến sớm, lộ đáp án trước.**
   - 19-1: câu xin lỗi về Grok/Qwen là câu đầu tiên người xem đọc.
   - 19-5: lời phân trần phương pháp đứng đầu.
   - 20-3: ghi chú nói trước chỗ lệch đề.
   - Lean nhắc ở 20-1 và 20-2 trước khi 20-3 giải thích. CUDA chỉ được giải thích ở 28-4, sau hai slide đã nhắc tới.
   - 21-3: dòng "Còn…" được đọc trước.
   - 38-2: nhãn đích có sẵn trên dây.
   - 31-4: mô tả ẩn lộ đáp án.
2. **Insight hiện trước bằng chứng, hoặc dù người xem bỏ qua bước so sánh:** 23-3, 24-3, 25-1, 28-1, 30-1, 30-4, 31-4, 32-2, 34-3, 36-2, 37-1, 37-3, 38-3.
3. **Ý chính giấu trong "Thêm một chút", câu phụ nằm trên màn:** 20-2, 22-4, 23-3, 24-5 (con số 25%), 27-2 (72%), 27-3, 28-2, 29-3, 31-1, 31-2, 32-6, 33-1, 33-3, 38-1, 39-4.
4. **Tự mâu thuẫn trong một slide hoặc giữa các slide:**
   - 19-1 dạy "không ghi mạnh nhất", ngay 19-2 viết "mô hình mạnh nhất".
   - 19-1: đèn "đã kiểm chứng" làm chìm cả Mythos, dù bia ghi Mozilla đã xác nhận.
   - 23-3: hồ ghi Sacramento, insight ghi Austin.
   - 24-5: thẻ ghi "dưới 2%" (của một thử nghiệm khác) cạnh con số 25%.
   - 22-2: 4 đèn mà insight chỉ kể 3 quan hệ.
   - 24-1: insight Constitutional AI xoá mất insight RLHF.
   - 26-1: insight ngược với hình.
   - 37-2: câu chuyện, biểu đồ và số liệu chỉ ba hướng khác nhau.
   - 38-2: bỏ mất điều kiện "đạt một nửa số lần", thành nói quá khả năng AI.
   - 38-4: ghi "góc nhìn chuyên gia" nhưng là cách xếp của AI Zen.
   - 39-2: giỏ đồ nghề trái với thẻ quai và với chính quiz.
   - Danh sách dạy sai về gameplay (cổng rào, Navier–Stokes, Chinchilla, hào CUDA, luật theo nước, sạp gom, Workflow/Agent, git, quyền tối thiểu…) xem v1 mục 3. Tất cả vẫn đúng và đã đưa vào từng slide v2.
5. **Mạch trạm chưa đi theo thứ tự chuyện → cơ chế → hệ quả → mình làm gì:**
   - t19: tide nên lên vị trí 2; slide 3 gộp vào 2.
   - t23: đảo 23-2 lên trước 23-1.
   - t33: Người giữ vườn → Nhà năm gian → Chùm chìa → Lời thì thầm.
   - t34: credit trước đường đi.
   - t35: mở bằng một skill cụ thể; ý "spec" chuyển sang t36.
   - t39: "Học cho bền" lên trước "Lộ trình".
   - Ý bị lặp: CUDA 2006 ×3, Micron ×2, IDC 2027 ×2, "chia nhỏ từng bước" ×4, local/mây ×2, Mythos ×2.
6. **Quiz, ensō và thẻ mang về không khớp điều slide đã dạy:**
   - Quiz t19 bỏ qua phần phát hành có kiểm soát; quiz t26 kiểm thí nghiệm thay vì chính sách; quiz t39 nói ngược với giỏ đồ nghề.
   - Thẻ mang về mồ côi (có trong nội dung, không slide nào trao): t20, hai thẻ ở t35, bốn thẻ ở t36. t21 và t38 không có thẻ.
   - Câu tóm tắt t20 nói quá.
   - t39 kết hai lần (slide 5 và dot 7).
   - Quiz: đáp án đúng ở B và dài nhất trong 18/21 trạm; phương án nhiễu thường là câu đùa.

## C. Gameplay & layout

Giữ nguyên phát hiện của v1 ([v1/README.md](../v1/README.md) mục 1–2): ba khuôn chơi lặp (chạm-4-đọc-4, kéo trăng qua mốc, xếp đá đánh số), cử chỉ nói ngược ý, card và chữ lấn tranh.

Các lỗi chặn vẫn cần sửa trước:
- `src/ui/station.ts:153` ẩn hướng dẫn ở cú chạm đầu;
- t25-2: cần gạt bị lớp phủ đè;
- t22-2: camera kéo ngược chiều;
- t35-5: click đèn không ăn, thuyền tự chạy;
- t27-3: gương che gương;
- vùng chạm chồng ở t20-4, t21-3, t33-2, t39-4;
- t39-3: phím 1–4 sai;
- t39-5: ensō không khép;
- t34-3: phone trượt ngang.

## D. Thứ tự sửa đề xuất (chờ Đại ca duyệt)

1. **Lỗi chặn** (mục C) + **28 slide P1** (dạy sai hoặc chặn chơi).
2. **Câu chữ toàn Part 2** theo mục A:
   - giải mã ẩn dụ, bỏ thuật ngữ trần;
   - viết lại insight theo mẫu "bạn vừa thấy → nghĩa là";
   - bỏ câu khuôn; sửa nhãn tin cậy và chữ dùng chung.

   Phần lớn là sửa JSON, câu viết sẵn có trong từng slide.
3. **Logic thông tin** theo mục B: đổi chỗ insight với detail, sắp lại mạch 6 trạm, khớp lại quiz / ensō / thẻ.
4. **Làm lại 28 slide** gameplay, và **cắt gộp** từ 96 còn khoảng 87 slide.

**Chưa kiểm:**
- desk-light, phone-dark, chế độ low quality, reduced motion;
- bản EN;
- nguồn ngoài của các con số 2026; từng slide đã ghi "cần kiểm nguồn" ở chỗ cần.

Dev server bị tắt giữa chừng lúc làm v2, nên một số mục v2 đối chiếu chữ bằng JSON và code thay vì chụp lại màn hình. Khi server chạy lại, các agent đã kiểm lại trên màn những phát hiện mới.
