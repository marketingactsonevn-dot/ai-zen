# Audit Part 2 · bản v3 · 18/10/2026

Audit 21 trạm t19–t39 ở commit `0950f07`, **chưa sửa app**.

- **v1:** gameplay, layout.
- **v2:** thêm câu chữ, logic thông tin.
- **v3:** thêm **thẩm mỹ / đồ hoạ**, **cân bằng bố cục**, **hướng dẫn tương tác theo chuẩn Phần 1**. Mỗi slide là một mục riêng, gồm cả quiz và ensō.

## Cách đọc

- **Cả 21 trạm trong một file:** [toan-bo-21-tram.md](toan-bo-21-tram.md).
- **Theo vườn:** [g07](g07.md) t19–21 · [g08](g08.md) t22–24 · [g09](g09.md) t25–27 · [g10](g10.md) t28–30 · [g11](g11.md) t31–33 · [g12](g12.md) t34–36 · [g13](g13.md) t37–39.
- **Mỗi slide có:**
  - ảnh lúc mở (`all/`) và lúc kết (`gNN/`);
  - **Hiện tại:** thấy gì, làm gì, prompt và chữ nguyên văn;
  - **Lỗi 1–7:** gameplay · layout · câu chữ · logic thông tin · **thẩm mỹ** · **cân bằng bố cục** · **hướng dẫn tương tác**;
  - **Đề xuất sửa:** gameplay · layout · câu chữ viết sẵn · **thẩm mỹ** (vẽ lại vật nào, thế nào) · **bố cục** (đặt hero ở đâu, lấp vùng nào) · **hướng dẫn** (vật nào mang chấm son, rãnh hoặc đích ở đâu, prompt từng bước, gợi ý khi đứng yên).
- **Mỗi trạm có:** mục tiêu học, mạch slide, kicker / tóm tắt / thẻ, điểm 7 tiêu chí.
- **Cuối mỗi vườn:** bảng tóm tắt (thêm cột TM · CB · HD), top 5 việc, 5 việc về thẩm mỹ · cân bằng · hướng dẫn, đổi so với bản trước.
- **Tài liệu kèm:**
  - [calibration.md](calibration.md): bảng chấm thẩm mỹ và cân bằng chéo cả 21 trạm, một con mắt, cùng một khung ảnh.
  - `all/`: 96 slide × máy bàn tối + điện thoại sáng, kèm bảng ảnh `sheet-d-NN.jpg` / `sheet-p-NN.jpg` theo vườn.
  - `ref/`: ảnh chuẩn so sánh.
  - Bản cũ: `v1/`, `v2/`.

**Thang chấm:**
- Mức: Giữ / Sửa nhẹ (SN) / Làm lại (LL).
- Ưu tiên: **P1** = chặn chơi hoặc dạy sai · P2 = khó hiểu, khó chơi · P3 = đánh bóng.
- TM · CB · HD: thang 1–5 mỗi slide, thang 10 mỗi trạm.

## Kết quả

**96 slide nội dung: 31 Làm lại · 63 Sửa nhẹ · 2 Giữ** (t21-4, t36-2). **Ưu tiên: 30 P1 · 64 P2 · 2 P3.** 42 mục quiz và ensō: 35 Sửa nhẹ · 7 Giữ.

**Đổi so với v2:**
- Thêm 3 slide Làm lại: 32-4 (P1), 37-4 (P1, người xem kẹt sau hòn đá đầu), 39-1 (vẽ lại toàn bộ).
- 20-3 lên P1, vì bước kéo cuộn đề không có lời hướng dẫn, người xem dễ bỏ lỡ ý chính.

**Trung bình 96 slide (thang 5): thẩm mỹ 3,1 · cân bằng 2,7 · hướng dẫn 2,7.**
- Thẩm mỹ ≤ 2: **22 slide**.
- Cân bằng ≤ 2: **37 slide**.
- Hướng dẫn ≤ 2: **38 slide**.

Cột "G·L·C·Lg" là Gameplay · Layout · Câu chữ · Logic thông tin.

| Trạm | G·L·C·Lg (/10) | TM·CB·HD (/10) | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|---|
| 19 Đỉnh núi 2026 | 5·6·5·4 | 7·6·5 | SN·**P1** | **LL**·**P1** | **LL**·P2 → gộp | SN·P2 | SN·P2 |  |
| 20 AI làm toán | 5·5·4·4 | 6·5·5 | SN·P2 | **LL**·**P1** | SN·**P1** | SN·P2 |  |  |
| 21 Robot marathon | 6·6·6·6 | 8·7·5 | SN·P2 | SN·P2 | SN·P2 | Giữ·P3 |  |  |
| 22 Attention | 6·6·5·5 | 6·6·6 | SN·P2 | SN·**P1** | SN·P2 | **LL**·**P1** |  |  |
| 23 Diễn giải AI | 4·5·4·4 | 6·6·4 | SN·P2 | SN·P2 | **LL**·**P1** | SN·P2 |  |  |
| 24 Học & nghĩ | 5·5·5·5 | 6·5·5 | SN·P2 | SN·P2 | **LL**·P2 | SN·P2 | **LL**·**P1** |  |
| 25 Cảm xúc | 4·6·5·5 | 6·6·4 | SN·P2 | SN·**P1** | SN·**P1** | SN·P2 |  |  |
| 26 Ý thức & phúc lợi | 5·6·4·4 | 6·6·6 | SN·P2 | SN·P2 | **LL**·P2 | SN·P2 | **LL**·P2 |  |
| 27 Gắn bó với AI | 6·6·6·6 | 6·5·5 | SN·P2 | **LL**·P2 | SN·P2 | SN·P2 |  |  |
| 28 NVIDIA | 5·6·5·4 | 6·6·5 | SN·P2 | **LL**·**P1** | **LL**·**P1** | SN·P2 | SN·P2 | **LL**·P2 → gộp |
| 29 Bộ nhớ | 6·7·6·6 | 5·5·6 | SN·P2 | SN·**P1** | **LL**·**P1** | SN·P2 |  |  |
| 30 Mở hay đóng | 5·6·6·5 | 6·5·5 | SN·P2 | SN·P2 | **LL**·**P1** | SN·P2 |  |  |
| 31 HF & GitHub | 5·6·5·5 | 6·6·5 | SN·P2 | **LL**·P2 | SN·P2 | SN·P2 | **LL**·P2 |  |
| 32 AI trên máy | 6·5·4·5 | 7·5·6 | SN·**P1** | SN·P2 | SN·P2 | **LL**·**P1** | **LL**·**P1** | **LL**·P2 → gộp |
| 33 Agent trên máy | 7·6·6·5 | 5·6·6 | SN·P2 | SN·**P1** | SN·**P1** | **LL**·P2 | **LL**·P2 → cắt |  |
| 34 Nền tảng sáng tạo | 5·5·6·5 | 6·5·4 | SN·**P1** | **LL**·P2 | SN·**P1** | SN·P2 |  |  |
| 35 Skills & workflow | 4·6·5·4 | 5·5·5 | **LL**·**P1** | SN·P2 | **LL**·P2 | **LL**·P2 | SN·**P1** |  |
| 36 Code game | 6·6·5·5 | 6·5·5 | SN·P2 | Giữ·P3 | **LL**·P2 | SN·P2 | SN·P2 |  |
| 37 An toàn | 5·6·5·4 | 6·4·4 | SN·P2 | **LL**·**P1** | SN·P2 | **LL**·**P1** |  |  |
| 38 AGI & nghề | 6·6·6·6 | 6·5·6 | SN·P2 | SN·**P1** | SN·P2 | SN·P2 |  |  |
| 39 Vườn của bạn | 4·5·5·4 | 4·4·6 | **LL**·P2 | SN·**P1** | **LL**·**P1** | SN·**P1** | SN·P2 |  |

**Điểm TM / CB / HD từng slide** (thang 5, in đậm là ≤ 2):

| Trạm | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 19 | 4/3/**2** | 5/4/3 | 3/3/3 | 3/**2**/3 | 3/**2**/3 |  |
| 20 | 4/3/3 | 3/3/3 | **2**/**2**/**2** | 3/**2**/**2** |  |  |
| 21 | 5/4/**2** | 4/4/**2** | 4/3/3 | 4/3/3 |  |  |
| 22 | 4/3/3 | 4/4/**2** | 3/3/3 | **2**/**2**/3 |  |  |
| 23 | 3/3/**2** | 4/3/**2** | **2**/**2**/**2** | 3/3/3 |  |  |
| 24 | 4/3/**2** | 3/**2**/3 | **2**/**2**/**2** | 3/**2**/3 | 3/3/**2** |  |
| 25 | 3/3/**2** | 3/3/**1** | 4/3/3 | 3/3/3 |  |  |
| 26 | 5/4/3 | 4/3/**2** | **2**/**2**/3 | **2**/3/4 | 3/**2**/3 |  |
| 27 | 3/3/3 | 3/**2**/3 | 3/**2**/**2** | 4/3/3 |  |  |
| 28 | 4/3/3 | 3/3/**1** | 3/3/3 | 3/**2**/4 | 4/3/**2** | **2**/3/3 |
| 29 | 3/3/3 | 3/3/3 | **2**/**2**/**1** | **2**/**2**/4 |  |  |
| 30 | 3/3/**2** | 4/3/**2** | **2**/**2**/**2** | 3/**2**/3 |  |  |
| 31 | 3/3/3 | **2**/**2**/**2** | 3/3/3 | 4/3/**2** | 3/3/3 |  |
| 32 | 4/**2**/3 | 4/3/**2** | 4/**2**/3 | **2**/**2**/3 | 3/**2**/3 | 3/3/4 |
| 33 | 3/3/4 | 3/3/3 | **2**/3/3 | 3/3/3 | **2**/**2**/**2** |  |
| 34 | 3/3/3 | **2**/**2**/**2** | 4/3/**2** | 3/3/**2** |  |  |
| 35 | **2**/**2**/**2** | 4/3/3 | **2**/**2**/4 | 3/**2**/**2** | 4/3/**1** |  |
| 36 | 3/**2**/3 | 5/4/4 | 3/3/**2** | **2**/**2**/3 | 3/3/**2** |  |
| 37 | 3/**2**/3 | 4/3/**1** | 3/3/**2** | **2**/**1**/**2** |  |  |
| 38 | 4/3/3 | **2**/**2**/4 | 4/3/3 | 3/3/3 |  |  |
| 39 | **1**/3/4 | **2**/**2**/3 | 3/**2**/4 | 3/**2**/**2** | 3/**2**/3 |  |

---

## E. Thẩm mỹ / đồ hoạ: kém dần về các trạm sau (mới ở v3)

**Đúng như Đại ca nhận xét.** Chấm chéo cả 21 trạm cùng một khung ảnh (thang 5):

| Vườn | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
|---|---|---|---|---|---|---|---|
| Thẩm mỹ | **3,6** | 3,1 | 3,2 | 2,9 | 3,0 | 3,1 | **2,8** |
| Cân bằng | **2,9** | 2,7 | 2,8 | 2,6 | 2,6 | 2,6 | **2,4** |

- **Mốc chuẩn (5/5)**, xem [ref/strong.jpg](ref/strong.jpg): 19-2 cổng rào, 21-1 đường đua, 26-1 sân khấu bóng, 36-2 chọn bút.
  - Tranh phủ kín khung, một nguồn sáng trăng có viền sáng và bóng đổ, sương nhiều lớp, khối có chất liệu, một hero rõ.
- **22 slide đạt thẩm mỹ ≤ 2:** 20-3, 22-4, 23-3, 24-3, 26-3, 26-4, 28-6, 29-3, 29-4, 30-3, 31-2, 32-4, 33-3, 33-5, 34-2, 35-1, 35-3, 36-4, 37-4, 38-2, 39-1, 39-2.
  - Thêm **màn quiz dùng chung** cho cả 21 trạm: 4 viên đá xám xếp như nút menu.

**Năm nguyên nhân thấy trên ảnh** (chi tiết và cách vẽ lại nằm trong từng slide):
1. **Hình khối của bộ 2.5D bị dùng như UI:** đĩa đá có chữ xếp hàng, phiến xám, biển chữ nhật, card giấy, hàng chip.
   - Gặp ở 34-2, 35-1, 35-4, 36-3, 39-1, 39-3, 30-4, 32-1, 28-6, 31-5, 26-4, 24-3, 22-4.
   - Ngoài 7 hero WebGL, phần lớn slide dựng bằng bộ 2.5D này, nên càng về sau càng giống giao diện.
2. **Cảnh chỉ còn mặt phẳng trống với một đường chân trời:** 28-4, 30-3, 37-4, 38-2, 39-5, 35-3, 22-4.
3. **Tông "bình minh" của vườn 13 thành mảng xám hoặc be phẳng,** mất tương phản đêm: 39-1, 39-2, 39-4. Có chỗ nước còn sáng hơn trời.
4. **Hero nhỏ, dồn trong một dải ngang ở giữa:** 24-4, 29-4, 20-4, 27-2, 32-4, 36-1.
5. **Lệch phong cách:**
   - bàn tay gần như ảnh chụp ở 33-2;
   - mặt cười vẽ sẵn kiểu emoji ở 27-1;
   - bia trông như mộ ở 33-5;
   - lá phong dán và biển gỗ hoạt hình ở 39-1;
   - mây vón cục kiểu blur ở 37-4.

**Hướng sửa chung:**
- Mỗi cảnh **một hero có khối, chiếm khoảng 15–50% khung** theo một phần ba, cộng một vật đối trọng và tiền cảnh tối làm khung.
- **Một nguồn sáng trăng**, có viền sáng, bóng đổ, sương 2–3 lớp. Học theo 26-1 và 19-2.
- **Chữ khắc hoặc viết lên vật thật** (đá, gỗ, giấy treo), không đặt trong ô hay nút.
- **Vườn 13:** nước luôn tối hơn trời; bình minh là nắng sượt có hướng, không phủ mảng màu.
- **Vẽ lại trước** các slide thẩm mỹ ≤ 2, theo đúng mô tả ở từng slide (39-1, 37-4, 29-3, 30-3, 35-1, 34-2, 23-3…) và màn quiz chung.

## F. Cân bằng bố cục (mới ở v3)

**37 slide cân bằng ≤ 2.** Năm kiểu lệch lặp lại:
1. **Hero nhỏ ở tâm đáy, hai bên trống, mọi thứ trên một trục dọc:** 37-4, 20-4, 32-4, 39-5.
2. **Khoảng chết lớn vô nghĩa** (nửa khung, hoặc 40–60% là nước đen, sàn hay trời trống): 19-5, 28-4, 30-3, 31-2, 32-3, 32-5, 38-2, 35-3, 24-4, 29-4.
3. **Dồn một góc, góc kia trống:** 37-1 (nặng trên trái), 24-2, 26-5, 39-4 (đèn khổng lồ cắt mép trái), 36-1.
4. **Chữ đặt giữa tranh hoặc đè hero:**
   - đoạn văn giữa 26-3;
   - card giữa 22-4 và 39-2;
   - thẻ 30 ngày che bình minh ở 39-3;
   - insight bị mũi thuyền (34-1) và chân đèn (39-4) che;
   - 6 thẻ cùng lúc ở 32-1.
5. **Trạng thái kết lệch khung:**
   - card tự mở che 1/3 khung (34-2, 36-3, 31-5, 32-4);
   - stage co lại đẩy đèn ra mép (19-1);
   - thẻ bị cắt đáy (19-4, 37-1);
   - bàn trống tối khi kết (35-4).

**Trên phone:** nhiều slide chỉ thu nhỏ bản máy bàn (tranh không lấp xuống tới dòng hướng dẫn, chừa một dải trống khoảng 15%; chữ bị ép thành cột 2–3 chữ ở 31-2, 31-3, 32-2), hoặc thành nút to (39-1, 39-3).

**Luật bố cục đề xuất:**
- Mỗi slide có **một vùng chữ định sẵn** (dải trời hoặc nước trống, đối diện hero), không dán insight cố định ở dưới trái.
- **Thẻ mang về thu thành một vật nhỏ, chỉ mở khi chạm.**
- Chấm bố cục ở **cả lúc mở lẫn lúc kết**.
- **Phone được bố cục lại riêng.**
- Vị trí cụ thể cho từng slide nằm trong mục "Bố cục:".

## G. Hướng dẫn tương tác: Part 2 thiếu dấu hiệu như Phần 1 (mới ở v3)

**Phần 1 hướng dẫn bằng dấu nhìn thấy trong cảnh, không dùng tooltip** ([ref/p1-15-1-1.jpg](ref/p1-15-1-1.jpg)):
- tay cầm có **chấm son kèm vầng sáng**;
- **rãnh kéo có vạch số 1–5**;
- nhãn đặt ngay cạnh vật;
- chỗ trống "____" để thả chữ (t01); bút lông cạnh câu cần cắt (t05);
- thanh trượt có nút play (t07); chấm bước có nhãn (t09).

**Part 2 hiện tại:**
- Gần như bỏ hết các dấu này khi chuyển sang "tranh không UI": vùng chạm vô hình, vật không nhãn, cử chỉ chỉ ghi trong mô tả cho trình đọc màn hình.
- Hàm `hint()` (`src/ui/hint.ts`) có sẵn nhưng không trạm nào gọi.
- Dòng hướng dẫn biến mất ngay ở cú chạm đầu, kể cả chạm hụt (`src/ui/station.ts:153`).
- Các hẹn giờ "đứng yên" trong code chỉ **tắt** chuyển động, không gợi ý lại (`lantern.ts:610`, `t24/kit.ts:53`, `t23/lit.ts:487`).
- **38 slide hướng dẫn ≤ 2.** Năm slide chỉ được 1 điểm: 25-2, 28-2, 29-3, 35-5, 37-2.
- Mẫu tốt đã có, nên nhân ra:
  - vầng thở ở 23-3;
  - gợi ý khi đứng yên `frameHint` ở 36-2;
  - cung có vạch ở 38-2;
  - chấm thở ở 36-4.

**Đề xuất: một bộ dấu hướng dẫn chung cho Part 2**, làm một lần ở khung, mỗi slide chỉ khai báo:

| Dấu | Áp dụng |
|---|---|
| **H1** Chấm son 8–10 px kèm vầng thở trên **vật kế tiếp** cần chạm hoặc kéo; tắt khi xong | mọi slide |
| **H2** Rãnh hoặc cung mực mờ có vạch mốc và nhãn, cho thấy chiều kéo và còn bao xa | mọi slide kéo trăng / kéo thanh (19-5, 20-1, 21-1, 22-4, 28-2, 29-1, 29-3, 30-3, 38-2…) |
| **H3** Đích thả viền đứt, sáng lên khi nhấc vật | kéo thả (22-1, 23-3, 24-2, 27-4, 37-1, 38-4, 39-3, 39-4…) |
| **H4** Bộ đếm khắc trong cảnh ("0/4 đèn", "Vết nứt 1/4", "Trang 1/4"), hiện ngay từ đầu | slide nhiều bước |
| **H5** Prompt = động từ + đúng vật, **đổi theo từng bước**, không mất khi chạm hụt | khung + mọi slide (prompt viết sẵn trong từng slide) |
| **H6** Phản hồi tức thì khi chạm hoặc kéo; khi sai thì nói phải làm gì | mọi slide |
| **H7** Đứng yên 6 s: vật kế tiếp tự "mời" (nhích 4–12 px theo hướng kéo, hoặc vầng sáng thở mạnh hơn) | slide nhiều bước |
| Cử chỉ ẩn (xoay, kéo dọc đổi góc, nhấn giữ, vuốt nước, vẽ vòng): **thêm mũi tên cong mực mờ hoặc vòng nạp, nếu không thì bỏ cử chỉ** | 19-1, 21-2, 20-2, 22-2, 23-4, 25-2, 25-3, 26-1, 26-2, 27-1, 27-3, 28-5, 30-1, 30-2, 34-4, 35-1, 35-5, 36-1, 36-4, 36-5, 37-2, 37-3, 39-4… |
| Vùng chạm ≥ 44 px, gồm cả nhãn chữ | mọi slide |

---

## A–D. Câu chữ · logic thông tin · gameplay · thứ tự sửa

Các phần này giữ nguyên từ v2, xem [v2/README.md](v2/README.md):
- **A.** 9 lỗi câu chữ chung: ẩn dụ không giải mã, thuật ngữ trần, insight kiểu định nghĩa, câu khuôn, văn dịch máy, từ không thống nhất, prompt sai vật, nhãn "Quan điểm" làm loãng, chữ chung của khung.
- **B.** 6 lỗi logic thông tin: đến sớm hoặc lộ đáp án; insight trước bằng chứng; ý chính giấu; mâu thuẫn; mạch trạm; quiz và thẻ lệch bài.
- **C.** Gameplay và lỗi chặn.

**Thứ tự sửa đề xuất, cập nhật ở v3 (chờ Đại ca duyệt):**
1. **Khung chung, làm một lần, lợi cho cả 96 slide:**
   - sửa `station.ts:153`;
   - bộ dấu hướng dẫn H1–H7;
   - vùng chữ định sẵn, thẻ thu nhỏ;
   - màn quiz vẽ lại và xáo đáp án;
   - nhãn tin cậy.
2. **Lỗi chặn + 30 slide P1**, tức các slide dạy sai hoặc chặn chơi.
3. **Câu chữ và logic** (mục A, B), phần lớn là sửa JSON theo câu viết sẵn.
4. **Vẽ lại 22 slide thẩm mỹ ≤ 2 và cân lại 37 slide cân bằng ≤ 2,** theo mô tả trong từng slide. Làm lại 31 slide gameplay, ghép chung khi cùng slide.
5. **Cắt gộp** 96 còn khoảng 87 slide.

**Chưa kiểm:**
- desk-light, phone-dark, chế độ low quality, reduced motion;
- bản EN;
- nguồn ngoài của các con số 2026.

Ảnh trạng thái kết phần lớn dùng lại từ lần chơi v1.
