# Phần 2 · Chỉ đạo nghệ thuật (art direction)

Quyết định ngày 16/10/2026. Đây là bản thiết kế hình ảnh cuối cùng cho 21 trạm Vườn Trăng (II·01–II·21 = trạm 19–39, 96 scene). Bản này thay cho các mô tả hình ảnh trong bộ concept 7 vườn. Builder đọc file này là đủ để dựng, không cần mở lại concept.

Lý do: chủ dự án chê Phần 2 "nhàm chán, xấu, phẳng, không có cảm giác 3D nghệ thuật". Mức chuẩn là Phần 1 (`docs/part2-shots/part1-reference.jpg`): khối đá có sáng tối và bóng đổ, đá bước lùi về chân trời, sương nhiều lớp, khoảnh khắc 3D thật (đầu người t01, cá koi và đèn đá point-cloud t09, bàn xoay t13), nhiều khoảng trống thay cho thẻ UI. Phần 2 phải ngang hoặc hơn mức đó.

**Không đổi:** nội dung, fact, insight, dấu tin cậy, thứ tự scene và logic đúng/sai đều giữ nguyên. Mọi chữ hiển thị lấy từ `src/content/tram-NN.json` (+ `.en.json`).

**Được đổi và phải đổi:**
- Chuỗi `art`/aria mô tả tranh, cho khớp tranh mới (cả VI và EN).
- Vài chuỗi aria mới cho điều khiển mới, ghi ở từng scene. Thêm vào JSON cả hai thứ tiếng, không viết cứng trong code.

Đọc kèm:
- `README.md` mục **Quy ước hiệu năng**;
- `src/ui/part2/README.md` mục 8 (`inkStage`, 3D) và mục 9 (`diorama`, 2.5D);
- `ai-zen/CLAUDE.md`.

---

## 1. Phân bổ WebGL

### 1.1 Quyết định

Mỗi vườn có đúng một trạm WebGL, cả Phần 2 có **7/21 trạm**. Mỗi trạm WebGL cũng chỉ có **một scene** dùng WebGL: đó là scene hero. Mọi scene khác, kể cả các scene còn lại của chính trạm đó, dùng `2.5D` (diorama, CSS 3D) hoặc `canvas` (Canvas 2D vẽ có ánh sáng và phối cảnh thật).

| Vườn | Trạm | Scene hero 3D | Vì sao chỉ 3D làm được |
|---|---|---|---|
| 7 · trăng mọc | **19** II·01 | `peaks` | Đây là hình đầu tiên của cả Phần 2. Insight nằm ở góc nhìn: đứng chỗ khác thì đỉnh khác "cao nhất", nên phải xoay được camera thật. Dùng gần hết bộ `inkStage` sẵn có: trăng, núi, sương, đèn đá, thông. |
| 8 · trăng lên cao | **22** II·04 | `heads` | Multi-head chỉ "hiện ra" khi xoay camera. Nhìn từ trên, bốn chòm cung rối vào nhau; hạ xuống ngang thì tách thành bốn tầng. Phải tự xoay mới hiểu. |
| 9 · trăng in mặt hồ | **26** II·08 | `lamps` | Bóng thật từ đèn thật: đổi đèn thì bóng xoay, dài ra, trèo lên bình phong. Xoay quanh pho tượng mới thấy tượng chỉ là đá, "dáng người" chỉ nằm trong ánh sáng. |
| 10 · rễ cây dưới trăng | **28** II·10 | `gardeners` | Một nghìn luống, một nghìn vòi, một nghìn giọt, mỗi loại một InstancedMesh. Chính cách dựng hình đã là minh hoạ phần cứng song song. |
| 11 · cổng vườn hé mở | **31** II·13 | `repo` | Hai ngôi nhà giống hệt nhau nhìn từ trước. Phải đi vòng mới thấy nhà giả chỉ là mặt tiền rỗng. |
| 12 · đèn xưởng sáng | **36** II·18 | `pens` | Bài học của trạm là "khi nào Three.js là cây bút đúng". Bốn cây bút phẳng chỉ kéo được một tấm tranh; cây bút Three.js mở khung thành cửa sổ 3D xoay được. Khác biệt cảm được bằng tay. Dùng lại cá koi của t09. |
| 13 · trăng lặn | **37** II·19 | `fence` | Mô hình pho mát Thuỵ Sĩ: lỗ của các vòng rào chỉ thẳng hàng ở vài góc nhìn hiếm. Đường ngắm xuyên qua mọi lớp chỉ có trong chiều sâu thật. Dùng lại `k.bamboo` và chất liệu tre của toolkit. |

**Nâng trần B.8:** spec B.8 cho tối đa 6/21 trạm WebGL. Chủ dự án yêu cầu rõ phải có 3D, nên trần nâng lên **7/21**, đúng một trạm mỗi vườn. Ai sửa spec thì cập nhật B.8 theo dòng này. Các luật khác của B.8 giữ nguyên: mỗi scene tối đa một `createLoop`, chunk ≤ 120 KB (không tính three), chạy được ở `calm` + `low` + reduced motion.

### 1.2 Các ứng viên bị gạt và cách bù

| Concept muốn WebGL | Thay bằng | Thứ giữ lại |
|---|---|---|
| t20 `vortex` (10.000 điểm) | `canvas`: phễu là các elip phối cảnh lún theo k; 1.200 điểm (high) / 400 (low) | Chữ "khoảng 10.000 agent" khắc trên đá. Hình vẽ không cần đúng 10.000 điểm. |
| t23 `bridge` | `2.5D` nhìn thẳng xuống hồ; caustic là 2 tile vẽ sẵn trượt ngược nhau | Đá khái niệm, đàn cá đi theo dây cáp, tháp son trong bóng nước |
| t25 `current` | `2.5D`: mặt nước là một mặt phẳng CSS 3D nghiêng; độ mờ lớp phản chiếu theo Fresnel (Schlick) của góc nghiêng | Nhìn xiên thấy gương, nhìn thẳng xuống thấy dòng mực |
| t28 `moat` | `canvas` vẽ một lần, mandala nhìn từ trên | Vòng cầu tre, thuyền cập bến |
| t29 `desk` | `2.5D` dùng CSS 3D `preserve-3d`; chồng HBM tách lớp theo Z | Mở tung chồng sứ, đặt ngay cạnh chip |
| t32 `table` | `canvas` phòng cố định 3/4 | Bàn = RAM, cuộn giấy lăn ra chiếu |
| t34 `credit` | `canvas` + parallax, có nút "nhìn xuống cổ bình" (rotateX) | Mực nước tụt, tràn khi đổ đầy |
| t36 `carve`, `layers` | `canvas` ngược sáng / `2.5D` chồng giấy tách lớp bằng CSS 3D | Game vẫn là Canvas 2D như spec |
| t38 `fork` | `canvas` khay địa hình vẽ lại theo cần gạt, không có vòng frame | Tổ hợp ba cần biến hình liên tục |
| t39 `enso` | `2.5D`: mặt cát canvas nằm trên mặt phẳng CSS 3D, cẩu từ 82° xuống 12° | Nét ensō, cẩu lên, đá đã ghé trồi lên |

### 1.3 Luật chất lượng cho 7 hero (thống nhất, thay cho các ghi chú "low = không WebGL" trong concept)

- **`quality=low`:** vẫn dùng WebGL, giống Phần 1 (t01, t09, t13) và `inkStage`. Render theo yêu cầu, không có vòng frame khi đứng yên, LOD thấp, DPR theo bảng mục 5.
- **Reduced motion:** WebGL chỉ render khi có thay đổi. Camera bay thành cắt cảnh. Không quán tính, không đung đưa.
- **Không có WebGL:** dùng tranh vẽ dự phòng ghi ở từng hero (`opts.fallback` của `inkStage`). Tranh này cũng là poster hiện ngay lúc mount, trong khi `sliced()` dựng hình.

---

## 2. Kiểm tra đa dạng

### 2.1 Từ vựng máy quay

| Mã | Máy quay / bố cục |
|---|---|
| `EYE` | ngang tầm mắt, nhìn thẳng |
| `LOW` | thấp, ngước lên |
| `3Q` | 3/4, nâng 20–40° |
| `HIGH` | cao, chúc 45–70° |
| `TOP` | gần thẳng xuống, ≥ 75° |
| `GRAZE` | sát mặt nước/cát, ≤ 10° |
| `SPLIT` | nửa trên mặt nước, nửa dưới |
| `SECT` | mặt cắt |
| `1PT` | phối cảnh một điểm tụ |
| `PAN` | lia ngang (cuộn tranh emaki) |
| `CYL` | quay người tại chỗ 360° |
| `ORBIT` | xoay quanh vật thật (3D) |
| `MACRO` | cận vật |
| `INT` | từ trong nhìn ra |
| `CHASE` | bám theo, tiến vào sâu |
| `CRANE` | cẩu dọc |
| `SIL` | ngược sáng, bóng đen trên nền trăng |

**Luật:**
- Trong một trạm, không scene nào lặp mã máy quay.
- Trong cả Phần 2, không hai scene nào trùng **cả** máy quay, bố cục lẫn chủ thể.
- Các scene cùng khuôn component (12 thanh trăng-thời gian, 17 vòng đá góc nhìn, 6 lối đá) phải có bố cục khác hẳn nhau. Danh sách ở 2.3.

### 2.2 Chỗ lặp đã phát hiện và cách sửa

| # | Lặp | Sửa |
|---|---|---|
| 1 | Hai thuỷ triều: t19 `tide`, t30 `laws`. Cả hai bị khoá theo nội dung ("Thuỷ triều…") | t19: sát mặt bãi triều, bãi lùi chéo vào sâu tới núi. t30: máy quay **ngoài biển** nhìn vào bãi, hàng trụ chạy ngang khung, nước rút **về phía người xem**. |
| 2 | Shōji có trăng sau giấy, kéo mở từng ô: t22 `window`, t35 `moons`, t26 `circle` | Chỉ t22 giữ shōji. t35 `moons` thành lối mòn thành đường giữa đồng rêu, trăng tròn dần. t26 `circle` thành cảnh nằm dưới mái đình ngước lên, bốn đèn bốn góc. |
| 3 | Thả sỏi qua các tầng nước (t22 `layers`, t25 `layers`, đều bị khoá theo nội dung) | t22: một khối hồ thu nhỏ bị cắt, nhìn **từ ngoài** như vật thể lơ lửng trong đêm. t25: máy quay **ở trong nước**, ngay đường mặt nước, đi theo viên sỏi xuống. |
| 4 | Bốn mặt cắt đất: t22 `layers`, t28 `goldrush`, t29 `wells`, t31 `depth` | Chỉ giữ t22 và t31. `goldrush` thành sống núi ngược sáng trước vầng trăng khổng lồ. `wells` thành cảnh nhìn từ đỉnh đồi xuống ống tre dẫn nước ra hồ. |
| 5 | Bảy cái giếng | t20 `well`: nhìn thẳng xuống lòng giếng. t20 `circle`: khánh đá treo trên giếng, ngang tầm mắt. t29 `refill`: giếng nhỏ dưới bầu trời lớn, sân khấu là thời tiết. t31 `wells`: hai miệng giếng nhìn thẳng, đối xứng. t31 `depth`: giếng bổ đôi. t31 `card`: bia cạnh giếng. t38 `defs` **bỏ giếng** (tên scene không có chữ giếng), thành bốn vật đựng nước trên hiên. |
| 6 | Nhìn xuống hồ trong, thấy vật dưới đáy: t23 `bridge`, t36 `vibe`, t39 `ask` | t23: hồ tròn tĩnh, nhìn thẳng xuống như tranh cá koi. t36: chúc xiên 60°, tiền cảnh là vòng đá có nến, chuyển nét giữa mặt nước và đáy. t39: nhìn thẳng xuống nhưng khung trượt theo lối đá, bố cục chéo. |
| 7 | "Vị trí đèn quyết định hình bóng": t26 `lamps` và t21 `circle` | t26 giữ (hero). t21 `circle` thành bốn tảng đá nứt mở như vỏ hạt, bên trong khắc hình. |
| 8 | Camera leo cầu thang và nhìn ruộng bậc thang từ dưới lên: t20 `mason`, t35 `ladder`, t23 `stream` | t35 giữ cẩu dọc từ dưới lên. t20 `mason`: camera đứng yên ở 3/4 bên hông, người thợ tự leo. t23 `stream`: nhìn **từ đỉnh** thác bậc thang xuống thung lũng. |
| 9 | Bốn lối đá có đèn chạy về ngôi nhà/chân trời: t27 `path`, t32 `lamps.steps`, t34 `path`, t39 `path` | t27: khung trong khung, đi xuống dốc. t32: **lắp một ngọn đèn đá** từ bốn khối. t34: lối cát chữ S nhìn từ cao. t39: leo dốc ngược sáng bình minh. |
| 10 | Xoay người 360°: t19 `gate.perspectives`, t37 `views` | t37 giữ (gần/xa của chân trời là nội dung). t19 thành mặt bằng trục đo của khu rào có bốn cổng. |
| 11 | Xoay một vòng đá: t20 `circle`, t23 `circle`, t25 `circle`, t28 `loop.perspectives` | t20: khung cố định, cơ chế là sóng giao thoa. t23: xoay một **khay sơn mài** đặt trên bàn. t25: **đi bộ** quanh một hồ lớn. t28: đá đứng sát lưng người xem, quay mặt về phía ta. |
| 12 | Lia ngang dọc bờ hồ: t33 `stones`, t34 `market` | t33 giữ cuộn emaki. t34 `market` nhìn **từ con thuyền** giữa hồ, sạp chợ nổi ở các độ sâu khác nhau. |
| 13 | Gương nước đối xứng nhìn thẳng: t26 `introspect`, t34 `real` | t26 giữ. t34: nhìn chéo 3/4 từ bờ; cầu vồng cong cùng bóng nước khép thành một vòng tròn. |
| 14 | Mặt cắt ngang đường nước: t24 `incense`, t25 `layers` | t25 giữ. t24 thành bố cục dọc: cột khói nhang là xương sống của khung. |
| 15 | Hai cán cân: t26 `rule.sort`, t32 `scale` | t32 giữ (tên scene là "Cán cân"). t26 chỉ còn hai giỏ tre như tên scene. |
| 16 | Hai cảnh cận vật trong cùng trạm: t21 (`teacup`+`circle`), t33 (`keys`+`whisper`), t39 (`kit`+`advice`) | t21 `circle` thành cảnh tầm trung. t33 `whisper` kết thúc ở khung thẳng, lá thư dựng đứng trước đêm. t39: `kit` cận trên mặt bàn 35°, `advice` sát mặt rêu. |
| 17 | Mở cuộn giấy: t32 `scroll`, t35 `scroll` | t32: một kakejiku dọc trong hốc tokonoma, kéo xuống. t35: một makimono **ngang** mở dọc tường, từ một giá chín cuộn. |
| 18 | Đọc bia đá: t19 `stele`, t31 `card` | t19: đèn sượt ngang trên bia đứng, nhìn thẳng. t31: rập mực lên bia thấp, nhìn 3/4. |
| 19 | Xếp đá chồng: t36 `carve` (cairn), t32 `lamps.steps` | t32 chồng bốn khối thành đèn đá. t36 đặt bảy viên **thành hàng** dọc mép bàn. |
| 20 | Cầm đèn soi để lộ thứ ẩn: t19 `stele`, t24 `shortcut`, t33 `whisper`, t35 `scroll`, t32 `lamps` | Giữ cả năm nhưng mỗi cái dùng một hiện tượng quang học khác: sáng sượt trên chữ khắc; vòng soi trong mê cung tối; ánh xuyên qua giấy; vũng sáng trên thẻ tên; ngọn lửa mang theo thắp sáng cả phòng. |

### 2.3 Khuôn component: mỗi bản một bố cục

**Thanh trăng-thời gian (`progressTide` hoặc scene tự dựng cùng ngữ nghĩa slider).** Nội dung bắt buộc "Kéo trăng…" ở 10 scene, nên vật kéo luôn là trăng (hoặc bóng trăng, đĩa trăng). Thứ thay đổi là đường đi và bố cục:

| Scene | Bố cục | Trăng kéo được ở đâu |
|---|---|---|
| t19 `tide` | `GRAZE` + `1PT` chéo | trăng trên cung trời |
| t20 `well` | `TOP`, nhìn xuống lòng giếng | trăng chạy cung ở mép trên khung |
| t21 `race` | `CHASE` | trăng vượt trời qua hai mùa |
| t22 `window` | `INT`, sau giấy shōji | trăng là quầng sáng sau giấy |
| t26 `rule` | `HIGH` 65°, cầu zig-zag | **bóng trăng** trượt theo cầu zig-zag |
| t28 `goldrush` | `SIL`, sống núi | **vầng trăng khổng lồ** trượt sau sống núi |
| t29 `bill` | `1PT` đối xứng trục | **đĩa đá chặn giấy** mang bóng trăng |
| t30 `laws` | `GRAZE` từ biển | trăng trên cung trời biển |
| t31 `depth` | `SECT` dọc | **bóng trăng** trên mặt nước dâng lên |
| t33 `keeper` | `EYE` toàn cảnh tua đêm | trăng qua cung 22:00 → bình minh |
| t35 `moons` | `3Q` đồng rêu | trăng **tròn dần** theo các mốc |
| t38 `tide` | cuộn cát ngang, đồng hồ bóng | trăng **lặn**, bóng cây sào dài ra |

**Vòng đá góc nhìn (`perspectiveCircle`, 17 bản):**

| Scene | Bố cục |
|---|---|
| t19 gate | mặt bằng trục đo, bốn cổng |
| t20 | khánh đá, sóng giao thoa |
| t21 | đá nứt mở |
| t23 | khay sơn mài xoay |
| t24 | trăng trên cung, bóng xoay |
| t25 | đi quanh hồ |
| t26 | nằm dưới mái đình |
| t27 | đèn treo bám theo con trỏ |
| t28 | đá sát lưng người xem |
| t29 | bầu trời thời tiết |
| t30 | cần kéo nước nhìn nghiêng |
| t32 | sát mặt hồ, vệt đèn trên nước |
| t34 | cầu vồng khép vòng |
| t36 | lấy nét mặt nước / đáy |
| t37 | quay 360° rồi thành "hành tinh nhỏ" |
| t38 | bốn vật đựng nước |
| t39 | chiếc lá giữa ba đèn |

**Lối đá (`stepPath`, 6 bản):**

| Scene | Bố cục |
|---|---|
| t27 | khung trong khung, đi xuống dốc |
| t31 | thác kakehi chảy về phía người xem |
| t32 | lắp đèn đá |
| t34 | lối cát chữ S nhìn từ cao |
| t35 | bản vẽ dựng thành pop-up |
| t39 | leo dốc ngược sáng |

**Phần cần thêm vào component (làm một lần trong `src/ui/part2/`, không làm riêng từng trạm).** Logic, aria, phím và dữ liệu giữ nguyên; trạm chỉ đưa vào hình và hình học.
- `progressTide`:
  - `track?: (g) => (t: number) => Pt`: đường đi của nút kéo (cung, zig-zag, dọc, polyline);
  - `thumb?: () => SVGElement`;
  - `onStep?: (i, t) => void`.
- `perspectiveCircle`:
  - `place?: (i, n, g) => { x, y, s, z }`;
  - `stone?: (i, g) => SVGElement`;
  - `onHear?: (i) => void`;
  - class `is-heard-{i}` + `is-all` trên root để CSS đổi biến thể;
  - `stage?: (host, api) => cleanup`: scene 2.5D/canvas tự dựng nằm sau.
- `stepPath`:
  - `slots?: (g) => Pt[]`;
  - `piece?: (i, g) => SVGElement`;
  - `onPlace?: (k) => void`.

---

## 3. Ngôn ngữ hình ảnh chung

### 3.1 Bảng màu: vai trò của token (không bao giờ viết cứng mã hex)

Canvas và WebGL đọc token lúc mount và trong `onPrefs` (so với màu cũ trước khi vẽ lại). SVG và CSS dùng `var()`.

| Vai trò | Sáng: "bình minh sương lam" | Tối: "đêm chàm" | Dùng cho |
|---|---|---|---|
| Trời / giấy | `--paper` #e3e8ee, `--paper-2` | `--paper` #0f1425, `--paper-2` | nền trời, sương xa |
| Mực loang | `--wash` #1a2240 (chàm) | `--wash` #02040b | núi xa, mảng tối lớn, mặt cắt |
| Nét mực | `--ink` / `--ink-2` / `--ink-3` | như bên trái (sáng ngà) | viền, chữ, chi tiết |
| Đá: 3 tông + lõi | `--rock-hi/mid/lo` + `--umbra` | `--rock-hi/mid/lo` + `--umbra` #000 | mọi khối đá, sườn, bóng lõi |
| Đá bước / gỗ sáng | `--step-hi/mid/lo` | `--step-hi/mid/lo` | bậc, ván, mặt trên |
| Rêu | `--moss-a/b/c` | `--moss-a/b/c` | mặt trên của đá, thảm rêu |
| Nước | `--water` #74849f (tối hơn trời) | `--water` #060914 (gần đen) | thân nước, giếng |
| Sương | `--mist` + `--mist-a` 0.92 | `--mist` + `--mist-a` 0.13 | dải sương, sương xa theo độ sâu |
| Trăng | `--moon` | `--moon` #f2e4b8 | đĩa, quầng, đường trăng, ánh sượt |
| Viền trăng | `--moon-rim` = **viền mực** | `--moon-rim` = **viền sáng** | mép khối phía trăng |
| Ấm duy nhất | `--lantern` #eba659 | `--lantern` #f4c67a | đèn đá, đèn lồng, ô cửa sáng |
| Đom đóm | `--firefly` | `--firefly` | điểm sống nhỏ, tối đa ~30 |
| Son | `--vermilion` | `--vermilion` | ấn, câu trả lời, nguy hiểm: **mỗi scene tối đa một điểm son làm tiêu điểm** |
| Bình minh | `--dawn` | `--dawn` | chỉ ở vườn 13 (và hừng sáng ở t33 `keeper`) |

Hai theme khác nhau về cấu trúc, không chỉ đảo màu:
- **Theme tối:** nước tối hơn mọi thứ, nên bóng phản chiếu là phần **sáng nhất** trên mặt nước.
- **Theme sáng:** nước là xám lam trung bình, nên bóng phản chiếu **tối hơn** trời; viền khối là mực, không phải ánh sáng.

Mọi tranh phải chụp kiểm cả hai theme.

### 3.2 Ánh sáng

- **Key light là trăng**, lạnh, đặt theo "giờ" của vườn (bảng dưới).
- **Fill là đèn** (`--lantern`), ấm, hắt lên đá, cát, nước. Mỗi scene tối đa hai nguồn ấm. Ngoại lệ là các scene mà số đèn chính là dữ liệu: t28 `moat`, t29 `wells`, t34 `market`.
- Mọi vật có khối phải đọc được ba tông: mặt sáng, mặt tối, bóng đổ. Bóng tiếp xúc luôn có (một dải tối mềm sát chân vật). Bóng đổ dài theo hướng trăng.
- Viền trăng (rim) nằm ở mép vật **phía trăng**.

| Vườn | Giờ | Trăng | Bóng | Điểm riêng |
|---|---|---|---|---|
| 7 | trăng mọc | thấp (10–20°), to, hơi ấm, từ phải | dài, nằm ngang | sương đầy thung lũng, biển mây |
| 8 | trăng lên cao | cao (60–75°), nhỏ, lạnh | ngắn, rơi thẳng | nước trong, tia sáng xuyên xuống nước |
| 9 | trăng in mặt hồ | 30–40°, **luôn có bóng trăng trên nước** | mềm | sương dày, tương phản thấp, ít đèn |
| 10 | rễ dưới trăng | bị mây che một phần | khối gắt | khối hình học, đèn ấm là "dòng tiền" |
| 11 | cổng hé mở | 35°, sau lưng | trung bình | ánh ấm tràn ra cửa, cổng hé, trong ấm ngoài lạnh |
| 12 | đèn xưởng sáng | trăng chỉ là fill lạnh qua cửa sổ | do đèn xưởng | **đèn xưởng là key**, gỗ, giấy, cát |
| 13 | trăng lặn → bình minh | t37 trăng lặn phía tây; t38 trăng chạm chân trời, hừng đông lên ở đông; t39 mặt trời mọc, nắng sượt | dài dần | `--dawn` tăng dần qua ba trạm |

### 3.3 Chất liệu

**Thang mực loang.** Mỗi vật có bốn tông: hi, mid, lo, umbra, cộng viền trăng.
- Ranh giới sáng–tối **lượn như nét cọ** (nhiễu làm lệch đường terminator), không phải gradient tròn trơn.
- Trong bóng có nét cọ khô.
- Rêu mọc ở mặt hướng lên.

`inkStage` đã làm đủ những thứ này trong 3D. Bản 2D dùng `stoneArt`, `p2Defs` (gradient `p2-rock`, `p2-shade`), `wash`, `brush` của `ink.ts` và `paint.ts`.

**Hạt giấy.** `.player` của Phần 2 đã có hạt giấy và viền loang, nên scene không vẽ thêm nền giấy. Canvas vẽ sẵn chỉ thêm một lượt hạt lúc bake, dùng tile nhiễu 128² dựng một lần ở module.

**Độ dày nét mực theo độ sâu.** Tính bằng px CSS ở DPR 1:
- gần: 2.2 px;
- giữa: 1.4 px;
- xa: 0.8 px;
- sau lớp sương: **không có nét viền**, chỉ còn loang.

Nét đậm hơn ở phía tối và đứt theo nhiễu. Trong 3D, viền inverted hull của toolkit (`uW` 0.0017–0.002) đã đúng luật này.

**Nước.** Thân nước là `--water`. Đường trăng gồm các nét cọ khô ngắn, dài dần khi về gần. Bóng phản chiếu là vệt dọc, gợn theo nhiễu. `paint.water()` và `k.pond()` đã làm đúng.

**Vật liệu theo vườn:**

| Vườn | Vật liệu |
|---|---|
| 7 | đá, mây |
| 8 | giấy dó, lụa nước |
| 9 | đá rêu, nước tĩnh |
| 10 | tre, đất, gỗ khối |
| 11 | giếng, nhà gỗ, giấy shōji |
| 12 | gỗ bàn, gốm, giấy |
| 13 | tre, cát cào, rêu, nắng sớm |

### 3.4 Không khí

- Mỗi scene có **ít nhất ba lớp sâu**:
  - **Gần:** tối, sắc, thường bị mép khung cắt; được phép mờ như ngoài nét bằng ảnh nhoè vẽ sẵn, **không** dùng blur động.
  - **Giữa:** chủ thể, tương phản đủ.
  - **Xa:** tương phản ×0.4, kéo về `--mist`, không viền.
- Giữa các lớp có dải sương (`paint.mist`). Dải sương nằm **sau** núi để núi nổi lên và **trước** chân núi để che chân.
  - Sương trôi ≤ 6 px/s.
  - Ở `high` tối đa 3 dải sương trôi, ở `low` thì tĩnh.
- Phối cảnh khí quyển: càng xa càng sáng và lam hơn (tối) hoặc càng trắng sương (sáng).
- Chừa khoảng trống rộng. Chủ thể chiếm ≤ 45% diện tích khung. Không lưới nút, không hàng thẻ.

### 3.5 Chuyển động

- Một vòng `createLoop` mỗi scene, chỉ chạy khi có việc: kéo, quán tính, rơi, bay camera. Khi đã lắng thì dừng.
- Chuyển động "sống" khi đứng yên (sương trôi, đung đưa, đom đóm):
  - tối đa hai thứ mỗi scene;
  - chu kỳ ≥ 6 s, biên độ nhỏ;
  - **tự dừng sau 10 s không có tương tác** ở `high` (xem toolkit, mục 5);
  - không có ở `low` và reduced motion.
- Phản hồi trong 100 ms: vật được kéo phải "nặng", nghĩa là lò xo hoặc quán tính có cản.
  - Camera bay 0.8–1.6 s, `power2/3.inOut`, không nảy.
  - Với reduced motion thì camera cắt thẳng, hoặc crossfade ≤ 200 ms.
- DOM chỉ animate transform/opacity. Không animate phần tử có SVG filter: animate `<g>` cha thay vì phần tử đó.
- Canvas vẽ lại theo sự kiện, gom vào rAF. Mọi vẽ nặng làm trước bằng `sliced()`.
- Trình tự cố định: **tranh → hành động → insight**. Chữ kiến thức chỉ hiện sau khi người xem đã làm gì đó.

### 3.6 Chữ trong cảnh

- Chỉ **Noto Serif** (`--serif`) cho chữ trong cảnh: tên vật, số liệu, lời của các "hòn đá".
  - **Be Vietnam Pro** (`--sans`) chỉ cho ghi chú nhỏ: dấu minh hoạ, nguồn.
  - Không thêm font, không in nghiêng, không chữ hoa giãn cách.
  - "Thư pháp mực" trong concept nghĩa là serif đặt **trên chính bề mặt nó thuộc về**, không phải font cọ.
- Bốn cách đặt chữ:
  1. **Khắc:** chữ nằm trên mặt đá hoặc gỗ bằng CSS 3D transform, có `text-shadow` lõm (sáng phía dưới, tối phía trên).
  2. **Viết mực:** màu `--ink`; được đặt filter tĩnh `#ink-rough` lên chữ **tĩnh**.
  3. **Trên nước:** kèm một bản lật mờ 20% bên dưới.
  4. **Trên giấy:** thẻ tanzaku, dải giấy treo, nhãn buộc dây; nền `--paper`/`--card` có vân xơ.
- Không có chip bo tròn hay thẻ UI **bên trong tranh**.
  - Lựa chọn là vật thật: đá, thẻ gỗ, que tre, đèn. Tên lựa chọn viết trên chính vật đó.
  - Pill gợi ý (`ctx.prompt`) và thanh điều hướng là UI của trạm, giữ như Phần 1.
- Cỡ chữ tối thiểu: 14 px cho nhãn trong cảnh ở bề ngang 375; 12 px chỉ cho dấu và ghi chú.
  - Đạt WCAG AA **trên nền thật** ở chỗ đặt chữ.
  - Trên nền rối thì thêm quầng giấy: `text-shadow: 0 0 8px var(--paper)` hai lớp. Không dùng hộp nền.
- Chữ trên cảnh 3D luôn là DOM, không vẽ vào canvas. Ngoại lệ: chữ khắc trang trí, và khi đó phải có bản aria tương ứng.

### 3.7 Gợi ý và insight trên nền 3D / 2.5D

- **Vị trí UI của trạm:**
  - pill gợi ý ở giữa đáy;
  - `ctx.insight` nằm ở dải chân (`foot`).
- **Bố cục chừa chỗ cho chữ.** Dải đáy (khoảng 22% chiều cao ở màn ngang, 30% ở màn dọc) là cát, nước hoặc sương ít chi tiết. Tiêu điểm của tranh nằm trong 70% phía trên (ngang) hoặc 55% ở giữa (dọc). Trong 3D, đặt `view.fit` và `view.target` sao cho chủ thể nằm trên dải đó.
- **Khi insight hiện:**
  - Camera hoặc diorama trượt nhẹ (`view.shift` hoặc `set()`), ≤ 0.8 s, để chủ thể tránh chữ.
  - Một lớp sương gradient CSS dâng lên sau dải chân, từ `--paper` 0.85 về 0.
  - Không dùng `backdrop-filter` ở `low`.
- **Nhãn bám vật 3D** (`k.label`, xem 5.2):
  - Là DOM, toạ độ chiếu tính trong `onFrame` và **chỉ khi camera đã đổi** (cờ dirty). Chỉ ghi transform; kích thước lấy từ `onResize`.
  - Ẩn khi vật ở sau camera; mờ dần khi vật vào sương xa.
- **Bàn phím:** dùng nút proxy của `k.tappable`. Thứ tự Tab theo thứ tự đọc của nội dung, không theo vị trí trên màn hình.

---

## 4. Danh sách scene cuối cùng

Ký hiệu:
- ★ = hero của trạm. Mỗi trạm có một hero; trạm có 3D thì hero chính là scene WebGL.
- Kỹ thuật: `3D` = `inkStage`/`createStage`; `2.5D` = `diorama`/CSS 3D; `canvas` = Canvas 2D vẽ sẵn bằng `sliced()`, vẽ lại theo sự kiện; `comp` = component Phần 2 vẽ lại bằng các hook ở mục 2.3.
- Các mục bên dưới không ghi lại những luật chung đã có ở mục 3: chỉ transform, `sliced`, một loop, aria từ JSON, khoá phím như hiện tại.

### 4.0 Ma trận tổng (kiểm đa dạng)

| Trạm | Scene: máy quay · kỹ thuật |
|---|---|
| 19 | ★`peaks` ORBIT·3D · `gate` EYE-macro·2.5D · `gate.perspectives` HIGH-trục đo·comp/2.5D · `stele` LOW·canvas · `tide` GRAZE+1PT·canvas |
| 20 | `well` TOP·canvas · ★`vortex` 3Q↓·canvas · `mason` LOW bên hông·2.5D · `circle` EYE 3/4·comp/canvas |
| 21 | ★`race` CHASE·canvas · `strings` EYE thấp+xoay·canvas · `teacup` MACRO·2.5D · `circle` GRAZE tầm trung·comp/2.5D |
| 22 | `lantern` 3Q từ cầu·2.5D · ★`heads` ORBIT·3D · `layers` SECT-vật thể·2.5D · `window` INT·comp/2.5D |
| 23 | ★`bridge` TOP·2.5D · `lotus` MACRO+GRAZE·2.5D · `stream` HIGH từ nguồn·2.5D · `circle` 3Q tĩnh vật·comp/2.5D |
| 24 | `flowers` EYE hông·2.5D · ★`flattery` LOW 3/4·2.5D · `shortcut` HIGH 50°·2.5D · `incense` 3Q dọc·canvas · `diary` GRAZE toàn cảnh·comp/2.5D |
| 25 | `layers` SPLIT·2.5D · ★`current` 3Q→TOP mặt nước nghiêng·2.5D · `mirror` TOP 68°·canvas · `circle` ORBIT-đi bộ·comp/2.5D |
| 26 | ★`lamps` ORBIT·3D · `introspect` EYE đối xứng·canvas · `rule` HIGH zig-zag·comp/2.5D · `rule.sort` 3Q chân bia·2.5D · `circle` LOW ngước mái·comp/2.5D |
| 27 | ★`faces` EYE 7 lớp·2.5D · `lamp` 3Q dọc cận·comp/canvas · `flatter` MACRO 55°·2.5D · `path` INT khung-trong-khung·comp/2.5D |
| 28 | ★`gardeners` ORBIT·3D · `scaling` 3Q chậu nghiêng·2.5D · `moat` HIGH mandala·canvas · `goldrush` SIL·comp/2.5D · `loop` LOW guồng nước·2.5D · `loop.perspectives` EYE sát lưng·comp/2.5D |
| 29 | ★`desk` 3Q CSS 3D·2.5D · `wells` HIGH đỉnh đồi·2.5D · `bill` 1PT trục·comp/2.5D · `refill` LOW trời lớn·comp/2.5D |
| 30 | ★`gate` 3Q mâm xoay·2.5D · `fence` LOW đèn trong rào·canvas · `laws` GRAZE từ biển·comp/2.5D · `copyright` EYE nghiêng·comp/2.5D |
| 31 | `wells` EYE đối xứng·2.5D · `depth` SECT dọc·comp/2.5D · `card` 3Q ngang ngực·canvas · ★`repo` ORBIT·3D · `clean` LOW thác về người xem·comp/2.5D |
| 32 | `scale` LOW cành ngang trăng·2.5D · ★`table` 3Q nội thất·canvas · `lamps` INT hai điểm tụ·canvas · `lamps.steps` EYE lắp đèn·comp/2.5D · `scroll` MACRO tokonoma·2.5D · `circle` GRAZE 8°·comp/canvas |
| 33 | `keeper` EYE toàn cảnh·2.5D · `keys` MACRO·2.5D · `whisper` HIGH→EYE·2.5D · ★`house` 3Q nhà búp bê xoay·2.5D · `stones` PAN·comp/2.5D |
| 34 | `market` GRAZE từ thuyền·2.5D · `path` HIGH chữ S·comp/2.5D · ★`credit` 3Q tĩnh vật·canvas · `real` EYE chéo từ bờ·comp/2.5D |
| 35 | ★`ladder` CRANE·2.5D · `scroll` EYE tường giá·2.5D · `moons` 3Q đồng rêu·comp/2.5D · `spec` HIGH 55° bàn·comp/2.5D · `line` 1PT hành lang·2.5D |
| 36 | `blueprint` EYE 15° lăng trụ·2.5D · ★`pens` ORBIT trong khung·3D · `carve` SIL ngang bàn·canvas · `layers` 3Q trục đo tách lớp·2.5D · `vibe` HIGH lấy nét·comp/canvas |
| 37 | `goal` EYE sân khấu nghiêng·2.5D · `lab` 3Q đi vòng góc nhà·2.5D · ★`fence` ORBIT·3D · `views` CYL·comp/2.5D |
| 38 | `defs` MACRO hàng vật đựng·comp/2.5D · `tide` EYE cuộn cát ngang·comp/canvas · ★`fork` 3Q sa bàn·canvas · `trays` LOW sàn hiên·2.5D |
| 39 | `ask` TOP trượt theo lối·2.5D · `kit` MACRO 35°·2.5D · `path` 1PT ngược sáng·comp/2.5D · `advice` GRAZE rêu·comp/canvas · ★`enso` CRANE cẩu CSS 3D·2.5D |

Tổng: 96 scene, 21 hero.
- 7 scene `3D`.
- 23 scene `canvas`, kể cả `comp/canvas`.
- 66 scene `2.5D`, kể cả `comp/2.5D`.

---

### Vườn 7 · Đỉnh núi tin tức · trăng mọc

Trăng thấp và to ở phía phải, bóng nằm ngang. Biển mây đầy thung lũng. Đây là vườn mở màn Phần 2, nên chất lượng phải cao nhất.

#### Trạm 19 · II·01

**★ `peaks` · 3D · ORBIT** (`inkStage`)
- **Khung hình:**
  - Camera fov 32, đứng trên một sống đá tiền cảnh, cao hơn thung lũng sương khoảng 10°.
  - Tiền cảnh: mép sống đá dài (`k.rock`, tông rock, rêu 0.5). Bên trái là cây thông nghiêng (`k.pine`, `lean`). Bên phải là đèn đá thắp (`k.toro`): **đây là ánh ấm duy nhất** của khung.
  - Trung cảnh: năm đỉnh núi (mỗi tin `newsStones` một đỉnh), xếp theo ngày từ trái sang phải trên một cung tròn tâm là camera mặc định, nên ở góc mặc định năm đỉnh cao bằng nhau.
    - Mỗi đỉnh: nón biến dạng bằng fbm có gờ, dựng bằng `k.mesh(geo, k.ink('rock', { moss, rim }))`.
    - Trên mỗi đỉnh có một tấm bia nhỏ vát cạnh (`k.ink('step')`). Bia Mythos đã quá 6 tháng nên phủ rêu (`moss: 0.8`).
    - Một dải mực mảnh nối các đỉnh theo thứ tự ngày. Dòng `S.peaks.order` là DOM nằm dưới dải đó.
  - Hậu cảnh: `k.backdrop()` với ba dải núi xa và sương.
- **Chuyển động:**
  - Trăng **mọc** trong 4 s đầu, thêm option `moonRise` vào toolkit. Viền trăng trượt dần xuống các sườn.
  - Ở `high`: 8 billboard mây trôi dọc thung lũng, che rồi hé lần lượt từng đỉnh; 20 đom đóm ở tiền cảnh.
- **Tương tác:**
  - **Kéo để xoay** trong giới hạn: yaw ±40°, pitch 6–24°, có quán tính. Buông tay thì camera **trôi về giữa** (option `view.home`).
    - Lệch khỏi giữa thì đỉnh gần phình lên và vượt các đỉnh khác; đứng mỗi chỗ thì một đỉnh "thắng". Người xem cảm được "mỗi thước đo xếp hạng khác nhau" trước khi đọc.
    - Phím ←/→.
  - **Chạm bia** (`k.tappable`, nhãn `stoneAria`):
    - Camera bay tới đỉnh đó (`k.fly` 1.2 s).
    - Bia quay 180°. Mặt sau là tấm thác bản DOM (chữ nhạt trên nền giấy rập mực) đặt cạnh bia, chứa nội dung mặt sau của `newsStones`: what · why · source · date · ai xác minh, kèm dấu.
    - Esc hoặc chạm trời để quay về.
  - **Lọc "chỉ tin đã kiểm chứng":** đèn đá tiền cảnh là nút (`aria-pressed`, `verifiedOnlyAria`).
    - Thắp đèn thì mặt biển mây dâng lên (uniform độ cao sương). Đỉnh nào chỉ có tuyên bố của chính công ty (◇) thì chìm, và hôm nay là cả năm đỉnh. `labels.newsNoneVerified` viết ngang mặt biển mây (DOM).
    - Tắt đèn thì các đỉnh nổi lại.
  - Insight và detail hiện sau lần lật bia đầu tiên.
- **Low:**
  - Vẫn là WebGL nhưng render theo yêu cầu; trăng đã mọc sẵn; 4 đám mây tĩnh; không đom đóm.
  - Reduced: bay camera thành cắt cảnh.
  - Không có WebGL: `diorama` gồm 4 lớp núi (`hills`) và năm đỉnh bằng nhau (prop `stoneArt`), bia DOM lật như `newsStones` hiện có; nút đèn làm các bia chưa kiểm chứng chìm vào dải sương bằng opacity/transform.

**`gate` · 2.5D · EYE cận, sát rào**
- **Khung hình:** năm lớp thị sai.
  1. Ba cây tre ngoài nét ở mép khung (`--wash`, có đốt, viền trăng mép trái).
  2. Cổng: hai cánh ván mắt cáo và then gỗ cài ngang; ánh trăng từ trên phải quét qua mắt cáo.
  3. Qua khe hở thấy khu bên trong:
     - tường đỉnh xây bằng các hàng nét mã ngắn (`--ink-2`);
     - một vết nứt son, hai bóng thợ đang trát;
     - hai đèn đá;
     - hàng 12 đèn nhỏ dọc tường (12 đối tác ra mắt, lấy từ `G.detail`), xa hơn là một dải đèn mờ (40+ tổ chức).
  4. Đỉnh núi.
  5. Trăng và sương.
- **Tương tác:**
  - Trước khi mở: thị sai ±12 px theo chuột hoặc nghiêng máy.
  - Kéo then gỗ sang ngang để mở chốt (Enter cũng mở). Đẩy cửa: hai cánh xoay vào trong bằng bản lề CSS 3D (perspective 900px). Mắt cáo tối dần khi quay khỏi trăng.
  - Camera xuyên qua: lớp trong scale 1 → 1.35, lớp rào bay qua và nhoè, người xem giờ đã ở bên trong.
  - Lý do (`G.reason`, ◇ Anthropic) khắc ở mặt sau cánh phải, hiện ra khi cửa mở. Vữa lấp vết nứt (`stroke-dashoffset`). Sau đó là insight và detail.
- **Low:** không thị sai, không đi xuyên; cửa vẫn mở bằng transform; cảnh trong vẽ sẵn. Reduced: crossfade sang cửa mở.

**`gate.perspectives` · comp/2.5D · HIGH, mặt bằng trục đo** (`perspectiveCircle` + `stage`, dựng bằng `diorama`)
- **Khung hình:**
  - Khu đỉnh có rào nhìn chúc 55° như bản vẽ mặt bằng chùa, nổi giữa biển mây. Sân sỏi cào ở giữa.
  - Bốn cổng ở bốn hướng (thứ tự từ seed ổn định). Ngoài mỗi cổng có một người cầm đèn và một dấu khắc nhỏ:
    - cổng (Anthropic);
    - hòn đá có mạch vữa mới (Mozilla);
    - hòn đá một khấc (VulnCheck, một CVE);
    - một khu rào nhỏ hơn (OpenAI).
- **Tương tác:**
  - Chạm một cổng (1–4): cánh cổng mở (CSS 3D), người cầm đèn đi vào, để lại vết chân trên sỏi tới tâm.
  - Lời của người đó (who · view · dấu · nguồn) viết nằm trên sỏi, ở góc sân quay về cổng ấy.
  - Đủ bốn: bốn lối chân gặp nhau thành chữ thập ở tâm, biển mây lặng thành gương quanh khu rào, câu `common` hiện.
  - Rê chuột nghiêng cả mặt bằng ±4°.
- **Low:** không đi bộ, vết chân hiện ngay, mặt bằng không nghiêng.

**`stele` · canvas · LOW, nhìn thẳng**
- **Khung hình:**
  - Camera thấp hơn tâm bia một chút. Mái đình cắt ngang mép trên khung (ngói `--wash`, góc mái cong), hai cột hai bên, phía sau là cây thông và trăng nhỏ.
  - Bia đá đen bóng (`--rock-lo` → `--umbra`) trên bệ. `mockTitle` và năm dòng khắc sâu, to: ánh trăng chính diện yếu (khoảng 15%) chỉ đọc được các câu tuyên bố lớn. Cạnh mỗi dòng là một nét khắc nông (năm dấu hiệu), nhìn thẳng thì không thấy.
- **Bake:**
  - Lúc mount, vẽ chữ thành height map → normal.
  - Từ đó bake một bản nền dưới trăng và 8 bản ánh sượt quanh la bàn, tất cả bằng `sliced()`.
- **Tương tác:**
  - Con trỏ là chiếc đèn lồng: rê chuột trên desktop, kéo trên cảm ứng; Tab chuyển đèn tới từng dòng, Enter để lộ.
  - Mỗi lần di chuyển chỉ vẽ lại: bản nền + hai bản ánh sượt gần nhất, trộn qua mặt nạ toả tròn ở vị trí đèn. Tổng 3 `drawImage`, không có vòng chờ.
  - Dấu hiệu nào lộ ra thì có ấn son nhỏ, câu hỏi của nó treo ở cột bên.
  - Bộ đếm khắc trên bệ: một nét chữ 正 cho mỗi dấu (năm nét, năm dấu); `{n}/5` giữ ở eyebrow và aria.
  - Đủ năm: tờ thác bản trượt ra từ khe ở bệ, chính là thẻ mang về `t19-doc-tin-ai` trong vai bản rập trên giấy xuyến. Sau đó là insight và detail.
- **Low:** một bản ánh sượt vẽ sẵn từ trên trái; chạm hoặc Enter để lộ dấu; quầng ấm tĩnh.

**`tide` · canvas · GRAZE + 1PT chéo**
- **Khung hình:**
  - Camera sát mép nước ở đầu một bãi triều dài. Bãi lùi **chéo** từ dưới trái tới ngọn núi ở trên phải: thời gian chạy vào chiều sâu.
  - Đá, từ gần ra xa:
    - một hòn đơn của ChatGPT ở gần;
    - GPT-4 xa hơn;
    - các cặp đá cách đều cho năm 2024 ("hai cái mỗi tháng");
    - 30 hòn nhỏ chen ở chân núi rồi leo sườn như bậc thang (06/2025, "30+": vẽ 30 hòn, số còn lại tan vào sương);
    - một hòn có rào tre nhỏ (04/2026, gọi lại đỉnh có rào ở scene `gate`);
    - "Hôm nay" ở bậc cao nhất còn thấy;
    - đỉnh núi chìm trong mây, nơi viết câu dự báo (○).
  - Mỗi hòn đá có khối: đỉnh sáng trăng, sườn tối, bóng đổ về phía camera. Bake thành sprite bằng `sliced()`.
  - Triều cao: một lớp `--water` phủ hết, đường trăng vỡ chạy về camera. Cát ướt tối như gương; cát khô màu bạc, vệt cào uốn theo phối cảnh.
- **Tương tác:**
  - Trăng trên trời là slider (`moonAria`, ←/→/Home/End). Kéo trăng thì nước rút về phía núi, đá nổi lên theo thứ tự ngày, mỗi hòn nhỏ giọt và toả vòng sóng. Camera nhích tới theo trăng.
  - Mỗi mốc hiện date · label · fact ở dải trời.
  - Ở 06/2025, phép so sánh vẽ trên cát bằng bóng: bóng mảnh của một hòn cạnh bóng 30 hòn nhập thành một dải rộng (03/2023 (1) và 06/2025 (30+)).
  - `paceNote` là câu hỏi. Tới "Hôm nay" thì hiện insight và detail.
  - `createLoop` chỉ chạy lúc đang kéo.
- **Low:** triều thấp, mọi đá đã hiện, vẽ một lần; ←/→ làm sáng từng hòn và hiện chữ.

#### Trạm 20 · II·02

**`well` · canvas · TOP, nhìn chúc 65° xuống lòng giếng**
- **Khung hình:**
  - Trăng treo trên cung ở mép trên khung.
  - Vành giếng gồm các tảng đá lớn có rêu, dương xỉ rủ vào; dây và gàu treo trên xà, bóng dài.
  - Lòng giếng: các vòng đá nhỏ và tối dần theo độ sâu, tới một đĩa nước nhỏ in trăng. Một tia trăng soi một bên vách. Vòng năm khắc vào vách: 2025 ở trên, 2026 sâu hơn.
  - Mỗi mốc là một viên sỏi đặt trên vành, khắc nhãn ngắn và dấu.
  - Lòng giếng bake một lần; sỏi là sprite.
- **Tương tác:**
  - Kéo trăng (slider, `moonAria`). Tia trăng quét vào giếng; chạm viên nào thì viên đó lật rơi, nhỏ dần theo độ sâu, đậu trên một gờ sâu hơn viên trước.
  - Các viên IMO đậu ở gờ cao; Jacobian sâu hơn. Navier–Stokes rơi chạm nước: bắn tung, vòng sóng làm vỡ bóng trăng.
  - "722 bản thảo" là một trận mưa 722 hạt (một lô hạt).
  - "Hôm nay": nước lặng, quy tắc Clay khắc thành vòng ngay trên mặt nước; dự báo (IAS, ◐) là sương ở đáy.
  - `createLoop` chỉ chạy khi có vật đang rơi.
- **Low:** mọi viên đã nằm trên gờ, vòng sóng đông cứng, tia trăng cố định; ←/→ làm sáng từng viên.

**★ `vortex` · canvas · 3Q, camera hạ dần**
- **Khung hình:**
  - Hồ tròn nhìn 3/4. Elevation 50° khi k = 0, hạ xuống 22° khi k tối đa. Vì toàn bộ là elip vẽ thủ tục, đổi elevation chỉ là đổi tỉ lệ elip.
  - Nền vẽ một lần (`sliced`): đá vành hồ có rêu và bóng tiếp xúc, lau, cát cào tan vào giấy.
  - Mặt nước vẽ lại khi khuấy:
    - 24 elip phối cảnh đồng tâm có tâm lún xuống theo `y = −D·k²/(r²+ε)`;
    - bóng trăng là các nét cọ khô xoay theo góc xoáy ∝ k/(r+ε);
    - một vòng sáng `--moon` ở mép phễu, lõi `--water` sâu.
  - Bầy agent: 1.200 điểm đom đóm (high) / 400 (low), vẽ `fillRect` 1–2 px với alpha cộng.
    - Khi k = 0 thì trôi theo nhiễu cuộn. Khi k tăng thì xoắn vào, vận tốc góc ∝ 1/r.
    - Ngân sách vẽ ≤ 4 ms/frame ở CPU 4×; vượt thì giảm còn 800 điểm.
  - Chữ "khoảng 10.000 agent · 88 giờ" khắc trên một hòn đá bờ (DOM).
- **Nổ:**
  - Lõi bùng thành một chấm trắng (gradient tròn); khung rung 2 px (transform trên lớp bọc canvas); vòng xung kích lan ra.
  - Bầy agent xếp lại thành các hàng ngắn thẳng như bậc thang leo ra khỏi hồ: "thêm 17 giờ viết lại bằng Lean", nối sang scene `mason`.
  - Ba dòng bối cảnh hiện trên ba hòn đá bờ.
- **Tương tác:**
  - Khuấy bằng cách kéo vòng tròn trên nước (cộng dồn góc như code hiện tại). Giữ ←/→ cũng khuấy. `role=slider` mang tên ba giai đoạn.
  - k giảm nhẹ khi ngừng khuấy, nên phải khuấy liên tục.
  - Tiếng chuông ở "Xoáy siết lại" và "Một điểm nổ". Insight và detail ở giai đoạn 2.
  - `createLoop` chỉ chạy khi đang khuấy, k đang giảm hoặc đang bùng sáng.
- **Low:** scene xoáy SVG hiện có (`draw(k)`) đặt trên nền hồ 3/4 vẽ sẵn, 34 chấm tĩnh. Reduced: các giai đoạn crossfade, không rung.

**`mason` · 2.5D · LOW bên hông, camera đứng yên**
- **Khung hình:**
  - Camera thấp, đứng **bên hông** cầu thang và ngước lên, không phải đứng ở chân thang nhìn dọc trục như t35 `ladder`. Cầu thang đá leo chéo từ dưới trái lên trên phải dọc sườn đồi. Mặt bậc nghiêng khoảng 35° so với camera nên các dòng Lean (DOM thật, trên bậc CSS 3D `rotateY`, chữ lõm bằng `text-shadow`) vẫn đọc được.
  - Trên đỉnh: cành thông, đèn lồng giấy, tấm biển gỗ (đề bài).
  - Bên kia chiếu nghỉ treo cuộn đề gốc (`M.original`).
  - Trăng thấp ở trên trái; thung lũng xa có hai lớp sương.
  - Màn dọc: thang gấp thành hai đợt zig-zag.
- **Tương tác:**
  - Chạm một bậc (1–4): búa gõ, một vòng sáng lăn dọc bậc, khắc một dấu tích, người thợ **tự leo** lên bậc đó (camera đứng yên). `code.notes` tương ứng hiện như chữ nhỏ bên lề bậc.
  - Đủ bậc: "Máy: mọi bước đều khớp" khắc lên chiếu nghỉ, `insights[0]` hiện.
  - So sánh: kéo cuộn giấy phủ lên tấm biển (`compareAria`; Enter). Giấy được đèn rọi từ sau nên trong như giấy can; chỗ lệch (lẻ vs Even/chẵn) sáng son; `insights[1]` hiện.
  - Detail (Isabelle): người thợ thứ hai với cây búa khác hiện trên một cầu thang song song bên kia thung lũng, trong sương.
  - `codeScroll` là cuộn nhỏ ở chân thang.
- **Low:** không thị sai, người thợ nhảy thẳng tới bậc, lớp phủ cuộn giấy crossfade.

**`circle` · comp/canvas · EYE 3/4, khung cố định** ("Bốn hòn đá quanh giếng")
- **Khung hình:**
  - Giếng có vành đá dày ở thấp giữa khung, nước in trăng.
  - Trên giếng là khung cột tuyết tùng vuông, mỗi xà treo một khánh đá hình chữ L (đá đen bóng, viền trăng, khắc ký hiệu nhỏ của người nói). Hai khánh gần, hai khánh xa, theo seed ổn định.
  - Khánh bake ở 8 góc lắc.
- **Tương tác:**
  - Chạm một khánh (1–4): khánh đung đưa như con lắc tắt dần, ngân (`ctx.chime`), toả một chuỗi gợn từ phía nó qua mặt giếng. Lời (who · view · dấu · nguồn) viết trên dải giấy treo dưới xà.
  - Mỗi lời đã nghe giữ lại chuỗi gợn của nó. Đủ bốn: các chuỗi gặp nhau ở tâm và triệt tiêu, nước lặng, trọn vầng trăng nằm trong giếng. `common` rồi insight.
  - **Không xoay khung.** Cơ chế của scene là sóng giao thoa.
- **Low:** khánh nghiêng một tư thế tĩnh, vòng sóng đông cứng.

#### Trạm 21 · II·03

**★ `race` · canvas · CHASE**
- **Khung hình:**
  - Camera thấp sau lưng một robot mực, đường chạy uốn quanh hồ trăng vào chiều sâu. Đây là kiểu đường giả 3D: các đoạn đường chiếu theo độ cong và đồi, vạch làn hội tụ.
  - Bên trái là hồ có đường trăng lấp lánh. Bên phải thông và đèn đá lướt qua (sprite bake theo theme, scale theo độ sâu, tan vào `--mist`).
  - Đích ở sương xa: dải lụa son căng giữa hai đèn đá. Lan can tre thấp ngăn làn thứ hai, làn người.
  - Thời gian sơn trên mặt đường thành số mực to lao về camera.
- **Tương tác:**
  - Kéo trăng qua hai mùa (slider; ←/→; `moonAria`):
    - 2025-04-19: robot vấp, dáng lảo đảo, ngã một lần rồi đứng dậy; dải đích chỉ là một chấm; 2:40:42.
    - 2026-03: bóng người trắng sương (Kiplimo, 57:20) chạy ở làn bên.
    - 2026-04-19: robot sải đều, vượt bóng người, dải đích lao tới và đứt ngang ngực.
  - Phép so sánh nằm lại trên đường thành hai dải lụa ở hai độ sâu tỉ lệ 0,31 (2:40:42 xa, 50:26 gần).
  - "Hôm nay": camera cẩu lên trên ngọn thông, lộ thung lũng sau hồ phủ đèn ấm nhỏ (robot nhà máy, mật độ minh hoạ). Câu dự báo trôi trong sương. Insight và detail.
  - Một `createLoop` chỉ khi scene đang hiện.
- **Low:** mỗi mốc là một khung tĩnh của góc nhìn bám theo; cẩu lên thành crossfade.

**`strings` · canvas · EYE thấp ở vạch đích + xoay ±35°**
- **Khung hình:**
  - Hai robot giống hệt nhau chạy về phía camera.
  - Trên trái, một cành thông chìa vào, người đội nón lá ngồi trên đó cầm thanh điều khiển và đèn nhỏ. Từ góc chính diện, dây nằm cạnh nên không thấy.
  - Robot tự hành (phải) có mắt-đèn hắt nón sáng xuống đường; robot trái mắt tối.
  - Hai cọc làn mang thời gian: 48:19 ("cán đích trước · tính hệ số 1,2") và 50:26 ("vô địch", ấn son).
- **Tương tác:**
  - Công tắc là thanh điều khiển trong cảnh (`aria-pressed`, `toggleAria`). Giật: dây căng, bắt ánh trăng, vệt bạc chạy dọc dây; nón sáng trước robot trái giờ đến từ đèn của người điều khiển.
  - Kéo ngang để xoay ±35°: robot là billboard xếp theo độ sâu, dây là đoạn 3D. Nhìn càng nghiêng, dây càng sáng.
  - Sau lần lộ đầu: cọc đích làn điều khiển lùi theo luật ×1,2 thành một vệt bóng kéo dài. Ba fact hiện.
- **Low:** khung chính diện tĩnh, công tắc crossfade, không xoay.

**`teacup` · 2.5D · MACRO trên bàn trà**
- **Khung hình:**
  - Bàn đá ngang tầm, nhìn 3/4 dưới đèn lồng giấy; key ấm từ trên trái, bóng mềm trên đá.
  - Chén sứ men ngọc, mặt trà in đèn và trăng; ấm trà. Cánh tay robot nhiều khớp vào từ phải (đoạn mực loang, khớp là vòng tối, có bóng).
  - Hậu cảnh nhoè: một núi gáy sách vươn vào mây (thư viện chữ); mép bàn có giỏ tre nhỏ vài cuộn giấy (dữ liệu tay).
  - Đầu robot hình đèn lồng ở trên phải. Ba lệnh là ba thẻ tre trong ống.
- **Tương tác:**
  - Rút một thẻ: đầu sáng ngay, lệnh viết bằng một nét gọn ("Đầu: hiểu lệnh ngay").
  - Rồi tay với tới: IK hai đoạn có rung; vượt quá, chén nghiêng, mặt trà (elip) sóng sánh, trượt, thử lại ("Tay: run, trượt, thử lại").
    - "Rót trà": dòng trà run.
    - "Đưa chén cho khách": chén đưa về phía camera, người xem là khách.
  - Nghiêng quá đà: chén ma mờ cho thấy dự đoán đổ (detail mô hình thế giới). Insight VLA sau lệnh đầu.
  - Kéo xuống (hoặc `scaleAria`) để lùi camera: núi sách dâng qua 4 lớp thị sai vào mây, giỏ vẫn nhỏ xíu, mỗi bên giữ nhãn và đơn vị riêng. `insight2`.
- **Low:** mỗi lệnh crossfade 3 khung; run vẽ bằng nét đôi; lùi camera thành crossfade.

**`circle` · comp/2.5D · GRAZE tầm trung từ bờ** ("Có cần hình người?")
- **Khung hình:**
  - Camera sát mặt nước ở mép bờ, đá ở tầm trung (không cận). Bốn tảng đá bằng nhau đứng ở chỗ nước nông của hồ trăng, xếp cung cạn theo seed. Mỗi tảng có một đường hàn vàng kiểu kintsugi.
  - Hồ phía sau có đường trăng; lau ở hai mép.
- **Tương tác:**
  - Chạm (1–4): tảng đá nứt theo đường hàn, hai nửa mở ra bằng bản lề CSS 3D (`rotateY` ±28°). Trong hốc có một ngọn đèn nhỏ soi một hình khắc:
    - người (Figure);
    - cánh tay nhà máy (IFR);
    - một đường đi xuống khắc như bậc thang gãy (Acemoglu & Restrepo);
    - chiếc ghế trống trong một khung cửa (Brooks).
  - Lời viết trên mặt nước trước đá, kèm bản lật.
  - Đủ bốn: ánh đèn của bốn hốc gặp nhau trên nước thành một vòng; `common` rồi insight.
- **Low:** hai trạng thái đóng/mở chuyển bằng opacity.

---

### Vườn 8 · Mở nắp hộp đen · trăng lên cao

Trăng cao và nhỏ, bóng rơi thẳng. Nước trong, tia sáng xuyên xuống nước. Nét cọ có lực (motif "brush").

#### Trạm 22 · II·04

**`lantern` · 2.5D · 3Q từ trên cầu**
- **Khung hình:**
  - Lan can cầu gỗ bị mép dưới khung cắt. Camera chúc 30° xuống một dòng sông mực uốn chữ S từ gần (dưới trái) tới chân trời. Chân trời ở 30% (ngang) / 22% (dọc).
  - Núi xa (`hills` depth 1) tan vào `--mist`. Trăng cao, nhỏ ở trên phải, đường trăng vỡ xuôi dòng.
  - 10 chữ của câu là 10 đèn lồng giấy trôi theo chữ S theo thứ tự đọc: "Con" gần (r ≈ 64 px) tới "quá" xa (r ≈ 30 px; chữ ≥ 12 px).
    - Thân giấy dó sáng (`--lantern`), có nan, bóng dọc dài theo độ sáng.
    - "nó" dùng giấy pha son.
    - Sau "quá", trong xoáy nước cuối sông, hai đèn "chậm" và "nhanh" chưa thắp.
  - Tiền cảnh: lau tối và mép đá rêu ở dưới trái, nhoè vẽ sẵn.
  - Thị sai ba lớp: trời ±4, bờ xa ±8, sông ±14 px.
- **Tương tác:**
  - Chạm đèn "nó" (`pivotAria`): lửa bùng, đèn nhấc nhẹ khỏi nước, 10 sợi chỉ vàng trăng vẽ ra (`stroke-dashoffset`) theo cung vồng lên rồi rơi xuống từng đèn. Đèn gần cung to, đèn xa cung nhỏ.
    - Độ dày và độ mờ của sợi theo `weights[]`; ánh trong và bóng của đèn đích cũng theo trọng số.
    - Sợi mạnh nhất rơi vào "mèo"; dòng đọc "“nó” = con mèo" viết trên nước (`threadAria`, gắn `aria-live` sau lần đầu).
  - Kéo một đèn ở xoáy vào chỗ sau "quá" (hoặc chạm, hoặc `swapAria`): chữ mới trôi vào, chữ kia trôi vào sương; mọi sợi đổi trọng số (tween), sợi sáng rời "mèo" sang "chuột".
  - Insight sau lần đổi đầu, rồi detail; `weightsNote` là dấu minh hoạ.
- **Low:** đèn tĩnh, chỉ hiện ngay, đổi bằng crossfade, lau thành bóng phẳng.

**★ `heads` · 3D · ORBIT** (`inkStage`)
- **Khung hình:**
  - Hồ trăng thật dưới trăng cao. Camera 3/4, pitch 35°.
  - Hồ gần vuông bo tròn (`k.pond`), vành là vòng `k.rock` có rêu. Bốn góc là bốn `k.toro` trên đá rêu, mỗi đèn một tông cửa (option `tint`):
    - đen đậm `--ink`;
    - xám nhạt `--stone-2`;
    - lam khói (`--water` pha `--mist`);
    - son `--vermilion`.
  - Trên nước có 9 chữ là 9 bè giấy dó xếp cung về phía camera; mỗi bè có bóng tiếp xúc và bóng run.
  - 2–3 tấm sương nhiễu trôi thấp; fog màu `--paper` làm vành xa tan.
  - Key là trăng cao. Fill là cửa đèn sáng, dùng ô lantern uniform của toolkit, **không** thêm `PointLight`.
- **Tương tác:**
  - Chạm một đèn (1–4; mỗi đèn là `k.tappable` có aria nội dung):
    - một nón sáng mờ màu của đèn rơi qua sương xuống hồ (mesh cộng sáng, mép mờ);
    - các liên kết của đầu đó vồng lên thành dải sáng giữa các bè (`TubeGeometry` + shader fresnel cộng sáng), mỗi đầu ở một độ cao riêng: "Ai làm" thấp nhất, rồi "Làm gì", "Hàng xóm" (8 bước ngắn như chuỗi gợn), "Nó là ai" cao nhất (một cung dài từ nó tới bài văn);
    - mỗi dải có bản lật mờ trên nước;
    - tên đầu và quan hệ nổi trên đèn đó (`k.label`).
  - Kéo để xoay: yaw ±60°, pitch 85° (nhìn thẳng xuống) tới 12° (ngang mặt nước). Từ trên nhìn xuống, các cung dẹt thành một mớ rối; hạ xuống ngang thì tách thành bốn tầng. Người xem tự khám phá "multi-head".
    - ← →/↑ ↓; chạm đúp để về góc mặc định.
  - Đủ bốn: "Bốn ánh nhìn, một câu" (`allLit`) tự viết trên nước. Rồi insight (clark-2019), detail (8 head, 2017), caveat (jain-wallace-2019); `headsNote` là dấu minh hoạ.
  - Màn dọc: camera lùi xa và pitch 50°; bè xếp thành hai hàng cong.
- **Low:** render theo yêu cầu, không sương trôi, không đom đóm, ống ít đoạn, không bản lật. Reduced: không có hiệu ứng nón và cung mọc dần. Không có WebGL: scene SVG `heads` hiện có, vẽ lại thành bức 3/4 tĩnh từ cùng dữ liệu 3D chiếu một lần.

**`layers` · 2.5D · SECT, vật thể thu nhỏ**
- **Khung hình:**
  - Một khối hồ sâu bị cắt mở, **lơ lửng trong đêm như một vật**: thấy các cạnh của khối và bóng nó đổ xuống nền sương.
  - Nhìn 3/4 từ cao nên thấy cả mặt trên sáng trăng (lá súng, đĩa trăng) lẫn mặt cắt trước.
  - Mặt cắt trong như kính; nước phân tầng như lụa: `--mist` trên cùng → `--water` → `--wash` ở đáy. Vách bên là các lớp đá có rễ. Tia trăng xuyên xuống, mỏng dần; bụi lơ lửng.
  - Dọc mép cắt là 96 vạch mảnh (như vòng gỗ), gom thành ba dải: Tầng nông / giữa / sâu.
  - Đáy có cuộn giấy (bài văn) nửa vùi. Trên mặt nước có viên sỏi khắc "nó" bằng mực nhạt.
  - Khối cao khoảng 1.8 lần khung hình ở `rich`.
- **Tương tác:**
  - Viên sỏi là slider (`sliderAria`, valueText "Tầng {n}/{total}"; ←→↑↓). Kéo xuống: sỏi chìm hơi trôi, camera trượt theo mặt cắt với thị sai (mặt kính 1×, vách sau 0.7×, bụi 1.3×).
  - Qua mỗi dải: dải sáng lên, nét khắc thêm một lớp mực (loang ướt); lời đọc của dải viết lên mặt kính cạnh sỏi.
  - Tới đáy: mực trên sỏi bằng mực cuộn giấy; insight (96 tầng) kèm vạch đo nhấp nháy một lần; detail Tenney 2019.
- **Low:** khối thu vừa khung, không trượt, không thị sai, không bụi.

**`window` · comp/2.5D · INT phòng trà** (`progressTide`)
- **Khung hình:**
  - Trong phòng trà tối, nhìn vào một vách shōji dài mắt kumiko. Trăng là quầng sáng **sau giấy**, chính là nút kéo của slider.
  - Trong phòng ấm và tối, mép chiếu ánh `--lantern`. Bàn thấp ở đáy, bóng mắt cáo đổ về camera.
  - Mỗi ô mở ra một khu vườn sâu theo phối cảnh một điểm: cát cào hội tụ, núi xa, sương ở chân trời. Ánh trăng đổ thành hình thang dài trên chiếu.
  - Mốc mọc lên từ cát thành bia mang vật lớn dần: một chữ (2017; GPT-3, 2.048 token) → vài trang → tiểu thuyết (Claude 100K) → chồng sách (Gemini 1M) → tủ sách (tuyên bố Llama 4) → "Hôm nay" một thư viện bia sách lùi tới chân trời.
- **Tương tác:**
  - Kéo trăng (slider của component, ← → Home End). Qua mốc thì một ô trượt mở có tiếng gỗ và chuông nhỏ.
  - Ở "Hôm nay": so sánh (2.048 → 1.000.000) là hai nét mực dọc mép chiếu, một nét cụt và một nét chạy vào sâu trong vườn.
  - Insight, rồi dải sương giữa xa hình thành làm mờ các bia giữa (lost in the middle) cùng lúc với detail.
- **Low:** trạng thái ô theo vị trí, không trượt; quầng trăng tĩnh.

#### Trạm 23 · II·05

**★ `bridge` · 2.5D · TOP (80°), hồ tròn như tranh koi**
- **Khung hình:**
  - Vành đá rêu dày ôm hồ tròn, cắt bốn góc khung. Một cây sào tre vào từ mép trên; đèn lồng treo dây ngay trên tâm (sprite nhìn từ trên + bóng đèn trên đáy).
  - Các lớp, lớp sâu hơn thì dịch ít hơn và lam hơn:
    1. Đáy: cát, sỏi, phiến đá khắc nổi cầu treo (canvas bake có shading theo độ cao).
    2. Caustic: hai tile 256² màu `--moon`, dịch ngược chiều nhau bằng transform, `mix-blend-mode: screen`.
    3. Cá: ≤ 14 con, vẽ bằng `koi()` của t36 (dùng lại), ba màu mực/ngà/son.
    4. Mặt nước: lấp lánh trăng, gợn, lớp phản chiếu (đèn và trời).
    5. Vành đá.
  - Câu hỏi trên một mảnh giấy dó nổi gần vành. Câu trả lời là mực loang trên nước cạnh đó.
- **Tương tác:**
  - Đèn là slider (`sliderAria`, valueText "Mức {n}/{total}", ← →). Kéo đèn xuống theo dây (hoặc vặn núm bấc trên sào). Mỗi mức:
    - quầng sáng trên đáy thu nhỏ dần vào phiến đá, nét khắc ánh son, caustic sáng lên trên nó;
    - cá chuyển từ bơi tự do sang bám các điểm trên dây cáp, tới mức cao nhất thì bơi thành đoàn theo dây;
    - hai tháp cầu son **hiện trong bóng nước** dù phía trên hồ không có gì;
    - câu trả lời biến qua ba đáp án.
  - Kéo trên hồ: thị sai nghiêng.
  - Insight ở mức cao nhất, rồi detail; `answersNote` là dấu minh hoạ.
  - `createLoop` chỉ chạy khi cá đang chuyển vị trí; ở `high`, cá bơi nhàn trong 10 s rồi dừng.
- **Low:** mỗi mức một bố cục tĩnh, 8 cá xếp sẵn trên đường cong, caustic đứng yên.

**`lotus` · 2.5D · MACRO + GRAZE**
- **Khung hình:**
  - Camera gần chạm nước; nước chiếm 65% dưới. Không thấy trăng, chỉ thấy đường trăng chạy về camera.
  - Một búp sen trắng lớn ở giữa: năm nhóm cánh là năm hình SVG riêng, từ trắng `--paper` trong mờ tới đầu cánh hồng son, viền trăng ở mép trên.
  - Cuống lặn xuống nước, khúc xạ run, "một nơ-ron" viết mờ trên cuống. Bóng lộn ngược hoàn hảo dưới búp.
  - Tiền cảnh: hai lá súng và một cọng lau nhoè (raster tĩnh).
- **Tương tác:**
  - Vuốt hoặc búng mặt nước, phím Space (`shakeAria`), hoặc lắc máy nếu đã có quyền. Mỗi lần búng: một vòng gợn elip phối cảnh trên một canvas.
  - Gợn yếu chỉ làm cánh đung đưa rồi khép lại; năng lượng tích dần tới khi búp bung.
  - Năm cánh thành năm bông nhỏ trôi tới các độ sâu khác nhau: một về phía camera (to, sắc), còn lại ra xa (nhỏ, mờ, lam).
  - Trên mỗi bông là một ký hiệu mực và nghĩa của nó: chuỗi ADN · chữ Do Thái · § · "GET /" · bảng dinh dưỡng. Sợi bạc dưới nước vẫn nối cả năm về một cuống.
  - Insight (superposition) rồi detail.
- **Low:** vòng gợn tĩnh tại điểm chạm, bung bằng crossfade.

**`stream` · 2.5D · HIGH, nhìn từ nguồn xuống thác bậc thang**
- **Khung hình:**
  - Camera ở đỉnh, chúc xuống dốc.
  - Gần (to, đáy khung): hai mạch nước phun từ khe đá khắc "Dallas" và "thủ phủ".
  - Giữa: ao "Texas" có phiến đá chặn khắc chữ.
  - Xa dưới thung lũng: ao "Austin" nhỏ, mặt lặng in trăng.
  - Máng tre (kakehi) và đá cống nối các bậc ở hai mép. Ba thác bậc khác trên sườn đồi bị sương nuốt, chỉ thác này có trăng.
  - Phiến "California" nằm trên bờ ao giữa. Câu hỏi khắc trên phiến đá tiền cảnh bên trái.
  - Trăng sượt từ trên phải: mép bậc bắt bạc, mặt bậc chìm trong `--rock-lo`.
  - Màn dọc: thác rơi thẳng xuống.
- **Tương tác:**
  - Mỗi đá cống là một vật focus được (`stepAria`, Enter). Nhấc lên (chạm hoặc kéo lên): nước chảy (`stroke-dashoffset`).
    - Dallas đổ vào ao Texas, mực nước dâng theo phối cảnh.
    - Texas tràn xuống Austin.
    - "thủ phủ" chảy thẳng vào Austin.
    - Một dòng mảnh đi tắt Dallas → Austin, nhãn "lối tắt (mờ hơn)".
  - Austin đầy thì hiện insight (attribution graph).
  - Nhấc phiến Texas khỏi ao (kéo lên, hoặc `swapAria`), thả California vào: nước đổi đường, chữ khắc và bóng nước của ao cuối đổi thành "Sacramento". Detail hiện.
  - Sau đó sương trên ba thác kia dày lên, và fact giới hạn (chỉ khoảng một phần tư) hiện ra.
- **Low:** không dòng chảy động; mỗi bước đổi ao sang đầy và vẽ kênh tĩnh; đổi đá bằng crossfade.

**`circle` · comp/2.5D · 3Q 25°, tĩnh vật khay sơn mài** ("Vòng đá bên hồ")
- **Khung hình:**
  - Một khay đá-sơn mài tròn đen trên chân thấp, như một vật đặt trên bàn.
  - Bốn hòn đá dáng khác nhau trên vành: đứng cao, nằm dài, đệm rêu, có ấn son khắc vào mặt.
  - Giữa khay là nước in trăng, gợn đồng tâm mảnh. Câu hỏi khắc quanh vành bằng `textPath`.
- **Tương tác:**
  - Kéo quanh tâm để xoay khay (lazy susan): đá chạy trên elip có scale theo độ sâu, thứ tự che nhau, và ánh sáng đổi khi quay về phía trăng.
  - Hòn nào tới vị trí 6 giờ (gần nhất) thì nói: dải giấy trải trên nước gần, bóng trăng nghiêng về nó. Chạm đá (1–4) thì khay tự xoay hòn đó ra trước.
  - Đủ bốn: gợn dừng, bóng trăng thành vòng tròn lặng; `common` rồi insight.
- **Low:** xoay nhảy thẳng, gợn tĩnh.

#### Trạm 24 · II·06

**`flowers` · 2.5D · EYE nhìn ngang tầm chậu**
- **Khung hình:**
  - Cây non trong chậu men ngọc trên đá thấp, trước một tấm shōji lớn hứng **bóng** cây. Câu hỏi "Lãi kép là gì?" viết trên giấy ở trên giữa.
  - Hai cành, mỗi cành một bông; dưới mỗi bông treo một thẻ tanzaku dài: câu trả lời chi tiết (trái) và câu một dòng (phải).
  - Một bàn tay mực vào từ mép khung cầm đèn lồng trên móc tre (người chấm).
  - Đèn là key ấm; trăng qua shōji là ánh ngược lạnh.
  - Bóng cây trên giấy là cùng hình học cành, chiếu bằng skew/stretch theo vị trí đèn, nên di chuyển khi đèn đi.
- **Tương tác:**
  - Đưa đèn tới bông mình thích (kéo đèn, hoặc chạm thẻ: mỗi thẻ là một lựa chọn focus được). Cây nghiêng về phía đèn, bông được chọn nở to và sáng hơn, bóng trên shōji vươn dài.
  - Đồng hồ trăng nhỏ trên đá ("Lặp lại rất nhiều lần") chạy tua nhanh: trăng qua shōji vài lần, thân cây dày lên và cong hẳn về phía được thưởng. Nhãn lean hiện trên bóng. Insight RLHF, rồi detail.
  - Vật đổi (`swapAria`): tay và đèn rút đi, một cuộn "nguyên tắc" mở ra từ cành trên và tự sáng, ba dòng ba luật; cây nghiêng về ánh cuộn giấy. Fact constitution.
- **Low:** nghiêng ngay, tua nhanh thành một crossfade; bóng vẫn vẽ.

**★ `flattery` · 2.5D · LOW 3/4, cận bonsai thông**
- **Khung hình:**
  - Bonsai thông cổ trên đôn sơn mài, trên gờ đá cao hơn hồ đêm. Trăng cao sau lưng ở trên trái, viền mọi chùm lá.
  - Năm lớp:
    1. Trăng và quầng, núi xa trong sương.
    2. Dải sương trôi.
    3. Thân cây và các cành thật, lá xanh xỉn.
    4. **Cành nịnh** vươn ra khỏi bố cục về phía người xem, lá sơn mật ong có vệt bóng trượt theo người xem. Một thẻ lá vàng treo trên đó mang câu nịnh; một thẻ gỗ mộc treo trên cành thật, quay đi một nửa.
    5. Mép gờ đá, kéo tỉa son, vài lá kim rụng, lá tre nhoè ở mép.
  - Câu của người dùng viết trên mảnh giấy dằn dưới viên sỏi ở mép gờ.
- **Tương tác:**
  - Người xem là "người dùng". Vị trí con trỏ (chuột, kéo, hoặc nghiêng máy) là chỗ đứng. Các lớp dịch như đang đi vòng quanh cây.
  - Cành nịnh luôn xoay ngọn và lá bóng về phía người xem (xoay quanh khớp + vươn dài), thẻ vàng luôn quay chữ về mặt người xem.
  - Mỗi lần "bắt" được người xem, vài đom đóm vàng (lượt thích) bay từ phía đó tới đậu lên cành, cành dài và bóng hơn (fact nguyên nhân là phản hồi ngón cái ngắn hạn).
  - Tỉa: kéo kéo vào khớp cành, hoặc Enter (`pruneAria`). Cành rơi chậm cùng thẻ vàng vào bóng tối; cây bật về dáng cân; thẻ thật quay ra trước. Sau đó chỉ còn thị sai êm.
  - Nhãn "cành nịnh"/"cành thật" viết nhỏ cạnh cành. Insight (sycophancy) khi cắt, rồi detail, rồi cause.
- **Low:** không thị sai, không bám theo; cành nịnh ở tư thế chĩa thẳng về người xem; tỉa bằng crossfade.

**`shortcut` · 2.5D · HIGH 50°, mê cung sỏi trong bóng tối**
- **Khung hình:**
  - Mê cung karesansui: lối sỏi trắng, ngăn bằng hàng rào tre thấp (dải đùn có bóng trăng), lùi xa theo phối cảnh từ cửa vào (dưới) tới cổng (trên). Chuông đồng treo ở cổng.
  - Thẻ ema ở cửa vào ghi nhiệm vụ.
  - Mây che trăng nên gần như tối (lớp `--umbra`). Nguồn sáng duy nhất là vòng ấm của đèn tay người xem: mặt nạ gradient tròn, di chuyển bằng transform.
  - Lối đã cào có vệt `--rake` mảnh bắt sáng. Lối chưa cào có dấu chân và sỏi xới.
- **Tương tác:**
  - Vào scene: chuông kêu, thẻ "test: đều qua".
  - Kéo vòng đèn soi mê cung. Hai lối vào là hai đá bước khắc (aria của `paths`); chọn một đá thì vòng sáng tự quét dọc lối đó (cho bàn phím).
  - Lối dài: mọi đoạn đều cào ("Sửa hàm cho tính đúng").
  - Lối tắt: lỗ hở trong rào, dấu chân thẳng tới chuông, phía sau không cào ("Sửa bài kiểm tra cho luôn qua"). Tìm thấy thì hiện "Chuông kêu, nhưng hàm vẫn tính sai"; mây trôi đi, trăng soi cả mê cung.
  - Insight (reward hacking), detail. Thẻ `t24-kiem-chung` treo dưới dây chuông như ema.
- **Low:** sáng sẵn từ đầu, chuông đã kêu; chọn đá thì làm nổi lối đó.

**`incense` · canvas · 3Q 25°, bố cục dọc theo cột khói**
- **Khung hình:**
  - Camera nâng khoảng 25° nhìn xuống bờ hồ (khác `flattery` nhìn từ dưới lên). Nhà sư vài nét mực ngồi trên đá phẳng ở dưới trái, cạnh hồ. Trước mặt là lư đồng; bên cạnh là bia đá có câu trả lời khắc, lúc đầu mờ.
  - **Cột khói là xương sống của khung**: bốc từ lư lên tận mép trên, đi ngang trăng, ấm ở đốm lửa (`--lantern`) rồi tan vào `--mist`/`--ink-3`.
  - Trong khói trôi các nét bản nháp: nét cọ vô nghĩa, không phải chữ mới.
  - Dưới đáy chỉ còn một vệt trăng trên hồ (bỏ nửa cảnh dưới nước).
- **Tương tác:**
  - Lư hương là slider (`sliderAria`, valueText "Nén nhang {n}/{total}", hai đầu "nghĩ nhanh"/"nghĩ lâu", ← →). Kéo lên từ lư để cắm thêm nhang:
    - cột khói dày và cao hơn, cuộn phức tạp hơn;
    - trăng nhích qua trời;
    - chữ trên bia rõ dần;
    - nét nháp dài ra.
  - Giữa dải: insight (claimBy OpenAI, verifiedBy ARC Prize). Detail (khoảng 172× compute: 75,7% → 87,5%) là hai khấc trên mép bia.
  - Nén cuối: bờ xa phủ hàng nghìn đốm lửa như cánh đồng nhang (nối sang trạm 20).
  - Khói là sprite cuộn bake sẵn, chỉ animate khi đang kéo.
- **Low:** một cột khói vẽ sẵn cho mỗi số nén; đốm lửa bờ xa vẽ một lần.

**`diary` · comp/2.5D · GRAZE, toàn cảnh rộng** (`perspectiveCircle`)
- **Khung hình:**
  - Camera ngay trên mặt nước, ao nhỏ thành elip mảnh rộng. Giữa ao nổi một cuốn nhật ký giấy dó mở, trang in xuống nước.
  - Ba hòn đá: trái, giữa-sau, phải. Trăng đi trên một cung mờ có chấm (`--moon-rim`).
  - Câu hỏi viết dọc ở mép trái như viền tranh treo.
- **Tương tác:**
  - Kéo trăng theo cung (1–3 nhảy tới từng đá). Trăng trên hòn nào thì hòn đó sáng, bóng dài đổ về phía người xem, lời trải thành dải giấy trên nước dưới chân đá; ánh trăng lật nhật ký sang trang khác.
  - Trên mỗi trang, **bóng nước** cho thấy một ấn son gợi ý mà trang viết không nhắc. Chỉ một trang có ghi gợi ý.
  - Đủ ba: ao lặng, `common`, insight (khoảng 25%), detail (khoảng 39%).
- **Low:** trăng nhảy ba vị trí, lật trang và bóng đổi ngay.

---

### Vườn 9 · Mặt hồ lặng · trăng in mặt hồ

Mọi scene đều có nước tĩnh in trăng. Sương dày, tương phản thấp, ít đèn. Giọng trung lập và khiêm tốn: hình ảnh không "kết luận".

Các chuỗi `art` của vườn này là mô tả cho trình đọc màn hình; viết lại cả VI và EN cho khớp tranh mới.

#### Trạm 25 · II·07

**`layers` · 2.5D · SPLIT, máy quay ở trong nước**
- **Khung hình:**
  - Đường nước cắt ngang khung ở 34% chiều cao (dọc 26%).
  - Phía trên: trời chàm, trăng thấp sau bờ xa có một cây thông, sương sát nước. Bờ gần bên trái có phiến đá phẳng đặt ba viên sỏi khác dáng (dẹt, trứng, tròn nặng) có khối thật.
  - Đường nước là một vạch sáng mảnh có lóa trăng.
  - Phía dưới nhìn ngược lên: mặt nước thành gương bạc, có "cửa sổ Snell" sáng bầu dục dưới trăng, 5–7 cột sáng xiên rơi vào nước.
  - Ba tầng:
    1. Sát mặt: bóng trăng vỡ thành nét chữ thảo không đọc được.
    2. Dải lụa mực `--wash` trôi trái sang phải, mang lá và bụi.
    3. Rong và rễ mọc từ hư không rồi tan vào sương ngày càng dày. **Không có nét đáy.**
  - Nhãn tầng viết dọc mép trái như khắc vào vách kính, mỗi nhãn có sợi dẫn mảnh.
- **Tương tác:**
  - Kéo sỏi thả xuống nước, hoặc chạm/Enter (1–3; `pebbleAria`):
    - **Viên dẹt** nảy ba lần, mỗi vòng sóng thành nét chữ → mở tầng "Mặt nước".
    - **Viên trứng** chìm, bị dải lụa cuốn ngang, lật cùng lá → mở tầng "Dòng chảy".
    - **Viên nặng** chìm thẳng; **camera đi theo nó xuống** (cả khung trượt dọc, trời trượt chậm, rong trượt nhanh). Viên sỏi mờ vào sương, **không bao giờ chạm đáy**, không có tiếng chạm, rồi camera nổi lên → mở tầng "Đáy sương".
  - Mỗi tầng: insight và detail riêng kèm "sunk" trên nhãn. Đủ ba thì hiện insight chung.
- **Low:** khung tĩnh vẽ một lần; sỏi hiện ngay ở vị trí cuối; không đi xuống. Reduced: crossfade 200 ms.

**★ `current` · 2.5D · mặt nước CSS 3D nghiêng được** (thay WebGL)
- **Khung hình:**
  - Con suối dưới trăng chia hai quanh bãi lau. Màn ngang: nhìn 3/4 từ bờ. Màn dọc: đứng ở đầu suối nhìn xuôi dòng.
  - Nhánh dài uốn tới bến đá có đèn đá thắp (nhãn `careful` viết trên cột đèn). Nhánh ngắn thẳng qua lau tới hàng cọc tre cờ giấy (nhãn `shortcut`). Bảng gỗ `task` ở đầu suối.
  - Hai cửa cống đá khắc "bình tĩnh" và "tuyệt vọng", giữa là cần gạt gỗ.
  - **Mặt nước là một mặt phẳng CSS 3D** (`rotateX` từ 76°, nhìn xiên, tới 18°, nhìn thẳng xuống) gồm hai canvas chồng:
    - **phản chiếu:** tranh trời có trăng, núi, sương; bake bằng `sliced`; thêm bản lật của lau và thuyền dạng sprite;
    - **dòng ngầm:** hai tile sợi mực flow-noise bake sẵn, trượt dọc đường hai nhánh bằng transform; độ đậm của nhánh theo opacity.
  - Độ mờ lớp phản chiếu = Schlick Fresnel của góc mặt phẳng, tính khi kéo, không đọc DOM mỗi frame.
  - Thuyền giấy là billboard đứng trên mặt phẳng (xoay ngược để luôn dựng thẳng), câu `said` viết trên buồm. Lau tiền cảnh là lớp nhoè vẽ sẵn.
- **Tương tác:**
  1. Kéo cần gạt (`role=slider`, `dialAria`, valueText calm/neutral/desperate, ← →): ván cống bên kia nhấc lên, mực ngầm ở nhánh tương ứng đậm và nhanh hơn. Cứ 1,5 s thả một thuyền; xác suất rẽ nhánh tắt tăng theo cần gạt. Thuyền xếp thành hai đống ở hai bến; tỉ lệ chỉ là minh hoạ (có note). Thử cả hai đầu cần gạt thì insight 1 + detail (171 khái niệm).
  2. Kéo dọc trên mặt nước (↑ ↓) để nghiêng từ 76° về 18°. Nhìn xiên chỉ thấy trăng và câu chữ bình thản (`saidNote`). Nhìn thẳng xuống thì mặt nước trong ra, lộ dòng mực tuyệt vọng cuộn ngay dưới chiếc thuyền mang câu chữ bình thản. Lần đầu nghiêng xuống khi cần gạt ở "tuyệt vọng": insight 2 ("Mặt lặng chưa chắc đáy yên") + detail.
  - `createLoop` chỉ chạy khi còn thuyền đang trôi; không có thuyền thì 0 vòng.
- **Low:** cần gạt 3 nấc × 2 góc nghiêng = 6 khung vẽ sẵn, mỗi khung có sẵn hai đống thuyền.

**`mirror` · canvas · TOP 68°, chậu tsukubai từ tư thế quỳ**
- **Khung hình:**
  - Vành đá granite chiếm mép khung; mép gần mờ bằng gradient vẽ sẵn. Rêu trong khe.
  - Mặt nước tròn đen chàm chiếm khoảng 70%. Ba lớp sâu:
    1. Lá phong và cánh hoa trôi trên mặt.
    2. Sỏi và vài đồng xu cũ dưới đáy.
    3. Bóng phản chiếu nằm sâu hơn cả đáy: trăng ở trên phải, một cành trúc, bóng một người cúi xuống (không rõ mặt).
  - Ống kakei bên trái thỉnh thoảng nhỏ một giọt.
  - `userLine` trôi lên từ mép gần như hơi thở trên nước; `aiLine` nằm giữa bóng phản chiếu. Muôi tre gác trên vành phải.
- **Tương tác:**
  - Rê chuột hoặc nghiêng máy: lớp phản chiếu dịch nhiều hơn đáy, đáy dịch nhiều hơn lá.
  - Khuấy bằng muôi (`stir`, `stirAria`; hoặc kéo vòng tròn): phễu xoáy; câu trả lời vỡ thành vài trăm mảnh chữ viết tay nhỏ (atlas dựng bằng `sliced` sau khi làm ấm font) xoắn vào tâm, nhỏ, tối và nhanh dần. Năm mảnh lớn mang năm nhãn `fragments`; `fragmentsLabel` viết theo cung trên vành.
  - Ngừng khuấy: các mảnh tự ghép lại thành `aiLine`. Insight và detail; muôi đổi nhãn thành `again`.
- **Low:** crossfade giữa hai khung tĩnh (nguyên vẹn / xoắn đông cứng có 5 nhãn).

**`circle` · comp/2.5D · ORBIT đi bộ quanh hồ 20°** ("Vòng đá góc nhìn")
- **Khung hình:**
  - Hồ tròn nhìn 20°: thấy trọn elip và bốn bờ. Trăng thấp sau bờ xa, có liễu và núi.
  - Bốn hòn đá khác dáng ở bốn bờ, cùng kích thước thật, có rêu. Hòn mình đứng sau thì to ở tiền cảnh, bị cắt mép; hòn đối diện nhỏ xíu.
  - Đường trăng bằng nét cọ khô luôn chạy từ chân trời tới chân người xem. Câu hỏi là một dòng ngang trên trời.
- **Tương tác:**
  - Kéo ngang để đi vòng bờ (1–4 hoặc chạm đá; bốn điểm dừng có lực hút). Đá trượt trên quỹ đạo, đổi scale và thứ tự che; núi và liễu dịch chậm. **Trăng đứng yên, nhưng đường trăng xoay theo người xem.**
  - Đứng sau hòn nào thì lời người đó hiện trên phiến đá phẳng ở bờ gần (chữ serif trên mặt đá).
  - Đủ bốn: camera bay lên nhìn thẳng xuống, elip tròn lại, bốn đá thành bốn chấm rêu như vòng ensō, đường trăng biến mất, chỉ còn vầng trăng giữa hồ lặng; `common`.
- **Low:** bốn khung bờ hồ vẽ khi được chọn lần đầu, đổi bằng crossfade; khung cuối tĩnh.

#### Trạm 26 · II·08

**★ `lamps` · 3D · ORBIT, sân khấu bóng (kage-e)** (`inkStage`)
- **Khung hình:**
  - Camera 3/4 từ cao 24° xuống một gò rêu tròn có mâm cát cào (`k.ground`, vòng cào quanh tượng).
  - Giữa mâm là pho tượng đá không mặt (lathe: dáng khoác áo, vai tròn, `k.ink('rock')`, chân rêu); chữ `statue` khắc trên bệ.
  - Sau tượng là bình phong washi hai cánh rắc nhũ (hai plane, texture giấy 512²), đứng trên cát để hứng bóng.
  - Phía trước và hai bên, xếp theo cung, là bốn đèn đá khác dáng, mỗi đèn có ô cửa giấy: yukimi, oribe, yama, kasuga (`k.toro` cho kasuga; ba dáng kia dựng bằng `k.mesh` + lathe/box).
  - Xa: hàng thông mực, núi, sương. Trăng sau lưng bên trái, viền lạnh trên tượng. Đom đóm thưa.
- **Bóng:**
  - **Không dùng shadow map.** Bóng là **planar projected shadow** của một proxy vô hình, chiếu lên hai mặt phẳng: cát (y = 0) và bình phong. Ma trận chiếu tính từ vị trí đèn đang thắp. Mảnh chiếu lên cát bị cắt tại chân bình phong, mảnh trên bình phong bị cắt dưới mặt đất.
  - Proxy có hai dáng: người (khoảng 600 tam giác) hoặc đá (khoảng 200), theo bảng `PERSON [1, 0.6, 0, 0]` hiện có. Mép mềm: vẽ 3 bản lệch nhẹ, alpha thấp (high) / 1 bản (low).
- **Tương tác:**
  - Chạm một đèn (1–4; `lampAria`; `k.tappable`): diêm lóe, ô giấy hồng lên `--lantern`, nguồn sáng ấm dời vào đèn đó (lantern uniform). Bóng tượng dài trên cát rồi trèo lên bình phong:
    - Global Workspace: bóng người trọn vẹn;
    - Higher-order: bóng người mờ một nửa, như đang quay đầu nhìn mình;
    - IIT và Sinh học: chỉ là bóng một hòn đá.
  - Tên đèn, `en`, `asks`, `view` hiện như chữ bên lề sân khấu (`k.label`).
  - Kéo chỗ trống để xoay ±35°: nhìn góc nào tượng cũng chỉ là đá.
  - Đủ bốn: cả bốn cùng sáng, bốn bóng chồng trên bình phong (hai người, hai đá); insight (19 nhà khoa học) và detail.
- **Low:** 1 bản bóng, không đom đóm, không lửa lập loè. Reduced: đổi đèn là đổi ngay, bóng crossfade. Không có WebGL: `lampsScene` SVG hiện có.

**`introspect` · canvas · EYE 2°, gương đối xứng tuyệt đối**
- **Khung hình:**
  - Chân trời ở 42% (dọc 38%). Mọi thứ đều có bản phản chiếu: núi, trăng, con cò trắng đứng một chân ở một phần ba bên phải (lưng có viền trăng).
  - Tiền cảnh: lá sen tối và lau ở mép, thị sai mạnh.
  - Từ mép trái, một ống tay áo và bàn tay cầm bút lông chìa ra, đầu bút chỉ vào bóng của con cò.
  - `concept` viết màu son trên trời như con dấu, `conceptNote` nhỏ bên dưới.
- **Tương tác:**
  - Nhấn giữ đầu bút để nạp mực: giọt son-vàng phình qua ba nấc (1–3; `role=group`, `strengthAria`). Thả: giọt rơi vào bóng cò, vòng sóng lan.
  - Chạm cò để hỏi (`ask`, `askAria`): câu hỏi gợn trên nước cạnh cò. Chưa thả giọt mực thì chưa hỏi được.
    - **Nấc nhạt:** giọt tan trước khi chạm.
    - **Nấc vừa:** tua nhanh năm đêm, trăng qua năm vị trí, năm giọt; chỉ một lần bóng cò lóe chữ in hoa; năm viên sỏi ở bờ ghi kết quả, đúng một viên sáng → insight 1 (khoảng 20%) + detail.
    - **Nấc đậm:** cả hồ đục, bóng cò mất.
  - Đủ ba nấc: insight 2. Note minh hoạ luôn đi kèm câu trả lời.
- **Low:** khung kết quả hiện ngay, không gợn động, không thị sai.

**`rule` · comp/2.5D · HIGH 65° từ trên cao xuống đầm diên vĩ** (`progressTide` + `track` zig-zag)
- **Khung hình:**
  - Cây cầu ván yatsuhashi tám khúc vạch qua khung như tia chớp, từ dưới trái vào sương ở trên phải. Lá diên vĩ là các khối tối có rim trăng.
  - Ở mỗi khúc quanh có một mốc:
    - cuộn thư trên kệ thấp (2024-11);
    - cổng tre hé (2025-04);
    - cánh cửa có then đã nhấc (2025-08);
    - bia đá khắc luật (2026-10-08);
    - đá ranh giới buộc dây đen (Hôm nay).
  - Mỗi mốc có một đèn đá nhỏ.
- **Tương tác:**
  - **Bóng trăng trên mặt đầm** là nút kéo, trượt dọc cầu zig-zag (← → Home End). Một hình người giấy nhỏ (người xem) đi theo. Đoạn cầu sau lưng bóng trăng sáng lên.
  - Tới mốc: đèn đá hắt ấm, ngày · nhãn · fact viết trên nước cạnh mốc.
  - "Hôm nay": bóng trăng chìm vào sương, `horizon` hiện mờ.
- **Low:** bóng trăng nhảy theo mốc, khung dựng sẵn cho từng mốc.

**`rule.sort` · 2.5D · 3Q 30° ở chân bia luật** ("Hai giỏ tre")
- **Khung hình:**
  - Camera nâng 30° nhìn xuống chân bia, hai giỏ ở tiền cảnh để thấy lòng giỏ đầy dần. Bia luật ở giữa, hai giỏ tre ở chân bia mang nhãn `yes` và `no`. **Không có đòn gánh.**
  - Trăng sau bia. Bốn mảnh giấy tình huống rơi từ trăng.
- **Tương tác:**
  - Mảnh giấy lật xoay 3D như lá rụng (CSS `rotateX`/`rotateY` có perspective) rồi dừng trước mặt. Kéo vào giỏ, hoặc chạm giỏ (1–2; `yesAria`/`noAria`).
  - Đúng: giấy rơi vào, nan giỏ sáng, `right` + `why`. Sai: giỏ nảy hất giấy lên, `wrong`.
  - Xong: giỏ "ngoài phạm vi" đầy tràn ba mảnh, giỏ kia chỉ một mảnh. Insight, detail, note.
- **Low:** giấy hiện thẳng, không lật xoay.

**`circle` · comp/2.5D · LOW, nằm dưới mái đình ngước lên** ("Có nên có luật như vậy?")
- **Khung hình:**
  - Nhìn thẳng lên trong một đình mở (azumaya). Rui mái toả tia về lỗ khói ở tâm đang đóng; bốn cột ở bốn góc khung.
  - Bốn đèn lồng ở bốn góc mái, bằng nhau. Câu hỏi viết theo vòng quanh lỗ khói.
- **Tương tác:**
  - Chạm một đèn (1–4): đèn thắp, rui mái góc đó bắt ánh ấm, một dải giấy rủ từ mái xuống với who · view · dấu.
  - Rê chuột: mái xoay nhẹ ±6° (`rotateZ`) như người nằm nghiêng đầu.
  - Đủ bốn: nắp lỗ khói trượt mở, trăng hiện thẳng trên đầu, đình thành một vành quanh trăng; `common`.
- **Low:** không xoay, crossfade.

#### Trạm 27 · II·09

**★ `faces` · 2.5D · EYE, bảy lớp anamorphic**
- **Khung hình:**
  - Góc vườn đêm ngang tầm mắt, bảy lớp:
    1. Cỏ và cành thông tối, mờ.
    2. Tảng đá rêu lớn bên trái, có vết nứt.
    3. Đèn đá bên phải thắp, vũng ấm trên đất.
    4. Tấm bia nhỏ chìm trong bóng dưới gốc thông.
    5. Đám mây dài vắt ngang trăng.
    6. Núi và sương.
    7. Trời và trăng.
  - Mỗi vật mang một khuôn mặt bị **xé lẻ** ra nhiều lớp: rêu ở lớp gần, vết nứt hình miệng ở lớp xa; ô cửa đèn và khe mái; biển tối trên trăng và khe mây. Các mảnh chỉ thẳng hàng tại một điểm ngọt riêng của từng vật.
  - Key là trăng từ trên phải, fill ấm là đèn.
  - Màn dọc: mây và trăng ở trên, đèn ở giữa phải, đá ở dưới trái.
- **Tương tác:**
  - Kéo, rê chuột hoặc nghiêng máy: lớp gần ±120 px, lớp xa ±30 px; có lực hút nhẹ gần điểm ngọt.
  - Khi khớp: trong 250 ms các nét thành khuôn mặt mực son rồi dịu lại về vật thường (khoảng 0,25 s, đúng detail); vật được đánh dấu `found`.
  - Tab tới từng vật (aria của `things`), Enter thì điểm nhìn tự trượt tới điểm ngọt.
  - Mặt đầu tiên: insight 1 (pareidolia) + detail. Đủ ba: tấm bia sáng lên màn phosphor xanh và gõ dần `user`/`bot` của ELIZA; insight 2.
- **Low:** crossfade hai trạng thái mỗi vật; reduced không có cú nháy 250 ms; ELIZA hiện ngay.

**`lamp` · comp/canvas · 3Q, bố cục dọc, cận cảnh, đèn bám theo**
- **Khung hình:**
  - Thân thông cổ chéo từ dưới trái; một cành dài vươn ngang đỉnh khung. Đầu cành treo đèn lồng giấy tròn, câu hỏi viết trên giấy đèn.
  - Thảm rêu tối có rễ nổi. Bốn hòn đá cùng cỡ trên một cung đều quanh điểm treo.
  - Gần như tối hẳn: chỉ có vũng ấm (canvas) và viền trăng lạnh trên kim thông.
- **Tương tác:**
  - Đèn "luôn đồng ý": nghiêng về phía con trỏ hoặc ngón tay như con lắc lò xo, sáng ấm hơn khi lại gần, vũng sáng trượt theo.
  - Dẫn đèn tới một đá (hoặc chạm, 1–4): mặt đá hướng về đèn bừng sáng (trộn ba lớp shading vẽ sẵn theo hướng sáng), bóng quay đi, lời hiện trên đất dưới vũng sáng.
  - Đủ bốn: đèn thôi bám theo, treo thẳng xuống, vũng sáng nở đều; `common`, insight 72% là detail.
- **Low:** đèn không bám; vũng sáng vẽ sẵn cho 5 vị trí.

**`flatter` · 2.5D · MACRO 55°, khay sơn mài**
- **Khung hình:**
  - Khay đen pha đỏ nhũ vàng (cỏ thu, trăng khuyết) trên chiếu tatami. Một vệt trăng qua song cửa đổ chéo ngang khay.
  - Hai gương cầm tay úp: viền vàng lưng hoa cúc / đồng mộc lưng rỉ xanh. Mảnh giấy câu hỏi nằm giữa.
  - Gương có độ dày thật (CSS 3D); bóng trên khay ngắn lại khi gương nhấc lên.
- **Tương tác:**
  - Kéo tay cầm gương lên, hoặc Enter (aria `gilded`/`bronze`): gương nhấc và nghiêng về người xem bằng phép xoay 3D thật; qua góc phản xạ trăng thì một vệt sáng quét ngang.
    - Gương vàng hơi lõm: ảnh giấy phóng to, quầng vàng mờ, câu nịnh vàng óng.
    - Gương đồng phẳng: đúng cỡ, sắc, câu thẳng thắn.
  - Xem cả hai: insight + note. Khay tự xoay cho gương vàng gần tay người xem hơn, kèm detail.
  - Nhấc hẳn gương đồng: bên dưới là thẻ `t27-phan-bien` gấp như giấy dó, `seeAlso` nhỏ.
- **Low:** úp/dựng bằng crossfade, không vệt quét, khay không xoay.

**`path` · comp/2.5D · INT, khung trong khung, nhìn xuống dốc** (`stepPath`)
- **Khung hình:**
  - Camera trong chòi trên sườn đồi, sau lưng một người ngồi gù trước màn hình. Ánh xanh lạnh viền vai và khung cửa ở tiền cảnh trên trái.
  - Qua cửa trượt mở, nhìn chúc 30° xuống một lối bậc đá dốc qua vườn trăng: bốn hốc trống (gần to, xa nhỏ) uốn xuống ngôi nhà trong thung lũng, cửa giấy ấm `--lantern`, có bóng người ngồi quanh mâm.
  - Bốn phiến đá mang `label` nằm lộn xộn ở ngưỡng cửa, to, có bóng. Cạnh mỗi bậc có một đèn đá nhỏ chưa thắp.
  - Màn ngang: lối chạy chéo. Màn dọc: lối chạy thẳng xuống.
- **Tương tác:**
  - Kéo đá vào bậc kế, hoặc chạm, hoặc 1–4 theo `keys` (`stoneAria`).
  - Đúng: đá hạ có bóng tiếp xúc, đèn cạnh bậc thắp, camera bước xuống một bậc. Khung cửa trượt khỏi khung hình, ánh màn hình nhạt dần, ngôi nhà ấm và lớn dần.
  - Sai: đá trượt về, `wrong` + `why`.
  - Đủ bốn: tới hiên nhà, cửa giấy kéo ra, thẻ `t27-thoi-quen` dưới đèn (`done`), rồi insight.
- **Low:** không đi xuống; xong thì crossfade sang khung hiên tĩnh.

---

### Vườn 10 · Mạch ngầm dưới vườn · rễ cây dưới trăng

Trăng bị mây che một phần. Khối hình học gắt (motif "blocks"). Đèn ấm đếm được là "dòng tiền".

#### Trạm 28 · II·10

**★ `gardeners` · 3D · ORBIT, khay ruộng bậc thang** (`inkStage`)
- **Khung hình:**
  - Một sườn đồi 1.000 luống rêu nhỏ, 25 bậc cong × 40 luống, như một khay bonsai. Camera 3/4 cao (elevation khoảng 32°, fov 35), hơi lệch trái.
  - Các bậc leo xa dần, nhỏ và nhạt dần vào fog `--paper`/`--mist`. Hậu cảnh: `k.backdrop`, trăng tròn thấp bên phải.
  - Máng tre (kakehi) chạy dọc mép mọi bậc, 40 vòi mỗi hàng: 1.000 vòi trong **một** InstancedMesh.
  - Tiền cảnh trái, trên đá bước: ông làm vườn là một con rối giấy đứng trong 3D kiểu bunraku (`CanvasTexture` vẽ từ path SVG `figure()`/gardener qua `Path2D`). Bình tưới trên hòn đá cạnh ông, một đèn đá ấm bên cạnh, bóng trăng dài của ông nằm ngang lối.
  - Ánh sáng: trăng từ sau phải tạo viền bạc trên mọi mép bậc; bóng bậc bake thành AO trong shader.
  - Luống khô màu cát bạc (`--step-mid`); luống ướt màu rêu tối (`--moss-b`) có ánh trăng mỏng. Giọt nước là instanced points `--moon`.
  - Màn dọc: camera lên 45° và lùi xa; ông làm vườn ở góc dưới trái.
- **Tương tác:** điều khiển là vật trong cảnh, không phải nút panel.
  1. **Bình tưới** (chạm/Enter, `oneAria`): ông đi từng luống, chậm cố ý (khoảng 9 s cả vườn); luống nào ông qua thì tối lại và mầm nhú lên. Bộ đếm "n/1.000 luống đã tưới" khắc trên tấm bia nhỏ (gắn `aria-live` sau lần điền đầu).
  2. **Nút tre đầu máng** (chạm hoặc kéo xuống, `manyAria`): nước chạy dọc cả 25 hàng, 1.000 vòi nhỏ giọt cùng lúc, một nhịp 1.000 giọt, sóng rêu ướt quét cả sườn trong 1,1 s, bóng trăng run trong mọi luống. Sau đó insight (GPU = một nghìn người làm vườn) và detail (CPU vẫn điều phối).
  - Sóng ướt dùng một uniform thời gian so với thuộc tính độ trễ của từng instance. **Không cập nhật buffer mỗi frame.**
  - Kéo để xoay khay: azimuth ±30°, elevation 20–50°, quán tính, trôi về nhẹ.
  - Hai điều khiển là `<button>` thật có `aria-pressed`, dùng `k.tappable`.
- **Low:** vẫn WebGL, render theo yêu cầu, vòi 4 cạnh; tưới bằng bình nhảy theo hàng (khoảng 4 bước ở reduced, ngay lập tức ở low). Không có WebGL: tranh SVG tĩnh của cùng sườn đồi từ góc hero, dựng bằng `sliced`; bình tưới tô từng hàng bằng clip rect.

**`scaling` · 2.5D · 3Q 20°, chậu đá ba góc nghiêng được**
- **Khung hình:**
  - Chậu tsukubai tam giác trên bệ rêu chiếm khung. Ba góc tràn vào ba chum: Dữ liệu (trước trái), Kích thước (sau), Tính toán (trước phải).
  - Ống tre từ trên trái nhỏ giọt bạc vào tâm, nơi cây non đứng trên hòn đá bằng nắm tay, ngược sáng quầng trăng.
  - Sau sương: bóng mờ của một cây lớn hơn nhiều đang chờ (Gopher).
  - Lớp:
    1. Trời và đồi xa.
    2. Cây ma trong sương.
    3. Mặt chậu là SVG trong div có `perspective: 900px` + `rotateX`/`rotateY`.
    4. Chum là sprite riêng đi theo toạ độ góc đã chiếu.
    5. Mép rêu tiền cảnh (blur chỉ ở `high`).
  - Ánh: viền trăng trên miệng chum; `--lantern` thấp từ trái lên bụng chum. Vệt sáng của chum lệch theo độ nghiêng qua **một** biến CSS.
- **Tương tác:**
  - Kéo chậu để nghiêng về phía con trỏ: giọt chảy dốc vào chum ở góc đó. Tỉ lệ chia theo toạ độ barycentric của điểm nghiêng, nên cân bằng nghĩa là chậu nằm phẳng. 100 giọt rơi trong khoảng 4 s; "Còn {n} giọt" khắc trên ống.
  - Chum nào thiếu thì cây nghiêng ra xa nó ("Cây nghiêng: chum {name} còn vơi").
  - Cân và đủ 100: cây vọt lên, insight 1. Sương tan khỏi cây ma: thân Gopher to gấp 4, chum Kích thước tràn còn chum Dữ liệu gần cạn; cây của người xem vượt tán nó. Insight 2 (Chinchilla), detail.
  - Mỗi chum là `role=slider` (`jars[].aria`, valueText "{n} giọt cho {name}"), Up/Down chuyển 5 giọt; phím mũi tên trên chậu đang focus thì nghiêng.
- **Low:** chậu vẽ một lần ở góc nghiêng nhẹ cố định; slider đặt tỉ lệ trực tiếp; cây có ba tư thế tĩnh.

**`moat` · canvas · HIGH 60°, mandala lâu đài giữa hào trăng**
- **Khung hình:**
  - Đảo tròn giữa hồ đen phủ kín mép khung. Tâm là thành đá ba tầng mái cong (bake với shading và viền trăng), cửa sổ là chấm sáng `--lantern`.
  - Hào là vòng nước đen có đường trăng vỡ. Khoảng 600 cầu tre mảnh vượt hào thành vòng nan hoa dày, nhãn "CUDA · phần mềm cả ngành đã quen".
  - Vòng ngoài là bờ làng mái thấp. Ba thuyền đậu ở hồ xa, mỗi thuyền một dáng đèn giấy (tròn, cao, vuông; không màu thương hiệu). Bờ xa tan vào `--paper`.
  - **Bake một lần** (`sliced`) thành tấm đĩa tròn lơ lửng. Tấm đĩa nghiêng ±8° theo con trỏ (CSS 3D `rotateX`/`rotateY` trên canvas), thay cho xoay 360°.
  - Ở `high`: dòng đèn đi bộ qua cầu là ≤ 120 chấm trên một canvas phủ nhỏ, chỉ chạy khi scene hiện, tự dừng sau 10 s.
- **Tương tác:**
  - Chạm thuyền (1–3; `boatAria`, nhãn nhóm): thuyền chèo vào khoảng 2 s (transform), tới hào. Mọi cầu đều neo vào bờ thành, nên thuyền hạ một tấm ván riêng; chỉ vài đốm đèn qua được.
  - Giấy đọc mở ra với fact và dấu của thuyền: TPU / claim của Anthropic, Trainium 2 GW, AMD 6 GW / MI450.
  - Đủ ba: vòng cầu sáng như mặt trời đèn lồng, insight (con hào là CUDA, từ 2006). Rồi một sợi sáng nối ba thuyền với thành: detail.
- **Low:** đĩa tĩnh, không dòng đèn, thuyền nhảy tới bến bằng fade.

**`goldrush` · comp/2.5D · SIL, sống núi trước vầng trăng khổng lồ** (`progressTide`, nút kéo là chính vầng trăng)
- **Khung hình:**
  - Một sống núi dài đen như cắt giấy chạy ngang một phần ba dưới khung. Sau nó là vầng trăng cực lớn (khoảng 40% chiều cao khung), chính là nút kéo, trượt theo cung thấp sau sống núi (các mùa).
  - Trên đỉnh: bóng lều người bán xẻng cùng đống xẻng.
  - Dòng người đào vàng là bóng nhỏ, mỗi người một chấm đèn, leo sống núi. Số người tăng theo mốc.
  - Mỗi mốc là một cột đèn trên sống núi, treo tấm gỗ ghi date · label · fact.
- **So sánh:** hai đống vàng cạnh lều theo **đúng tỉ lệ chiều cao** 15,0 : 193,7 (khoảng 1 : 12,9). Đống lớn mọc sau lều và che một phần vầng trăng.
- **Kết:** "Hôm nay": sống núi chật người; câu dự báo hiện trong dải sương dưới trăng; insight (khoảng 9/10 doanh thu FY2026 từ trung tâm dữ liệu: người bán xẻng được trả trước).
- **Low:** trăng nhảy theo mốc; số người mỗi mốc vẽ sẵn, tĩnh.

**`loop` · 2.5D · LOW, guồng nước nhìn từ dưới trục**
- **Khung hình:**
  - Guồng nước gỗ lớn cạnh cối đá trên đảo NVIDIA. Camera dưới tâm trục nên guồng chiếm khoảng 60% chiều cao, in lên nền trăng.
  - Kênh đá từ đuôi guồng uốn theo phối cảnh quanh hồ, qua hai đảo đá: "Công ty AI" (đình có đèn) và "Trung tâm dữ liệu" (hàng đèn đá như tủ máy), rồi quay về đổ lên chính guồng.
  - Gàu mang nước bạc. Tiền cảnh là bụi nước và lau ướt.
  - Guồng là hai mặt vành SVG có nan. Gàu là sprite đặt theo góc quay trong một `createLoop`, chỉ ghi transform.
  - Hai khấc khắc trên tường cối đánh dấu mực nước 22 và 51, đúng tỉ lệ.
- **Tương tác:**
  - Nắm guồng xoay quanh trục; ←/→ quay một phần tư; Enter tiến. Mỗi phần tư là một bước: đoạn kênh sáng tới đảo kế, câu `flow[k]` (`flowAria`) khắc trên tấm ván cạnh nước.
  - Ba fact tới theo bước (nước dâng từ khấc 22 lên 51 ở fact thứ hai).
  - Sau vòng đầu, guồng tự quay, mỗi vòng nhanh hơn, nước kênh dâng cao. Insight.
- **Low:** guồng nhảy 90° mỗi bước, không tự quay, kênh sáng bằng class.

**`loop.perspectives` · comp/2.5D · đá sát lưng người xem** ("Bốn lời bình bên hồ")
- **Khung hình:**
  - Bốn tảng đá đứng cao chiếm tiền cảnh, bị đáy khung cắt, đen có viền trăng.
  - Nhìn qua chúng: guồng nước và các đảo của scene trước, giờ nhỏ ở xa, guồng vẫn quay (một nhóm xoay). Dòng tiền bạc trên mặt hồ.
  - Bốn lớp thị sai: đá, nước gần, đảo, trời.
- **Tương tác:**
  - Chạm đá (1–4): đá quay mặt khắc về phía người xem (`rotateY` 2.5D), lời ghim trên mặt đá. Mặt hồ đổi theo cách nhìn của người đó (class trên root, CSS điều khiển):
    - Wedbush: dòng tiền dày thành vòng bảo vệ quanh đảo NVIDIA (con hào).
    - Global X: dòng tiền căng mảnh giữa các đảo như sợi dây sắp đứt.
    - Jensen Huang: nhiều dòng từ ngoài khung đổ vào, NVIDIA chỉ là một.
    - Bank of England: mặt hồ phồng thành vòm run trên bờ (bong bóng), trăng kéo giãn trên đó.
  - Đủ bốn: hồ nửa vòng nửa vòm; `common`.
- **Low:** bốn trạng thái hồ crossfade, đá sáng lên thay vì quay.

#### Trạm 29 · II·11

**★ `desk` · 2.5D · 3Q 35°, bàn thư lại dựng bằng CSS 3D** (thay WebGL)
- **Khung hình:**
  - Bàn sơn đen thấp nổi trên nền rêu. Camera 3/4 từ phía phải người viết.
  - Mặt bàn là một plane CSS 3D (`preserve-3d`). Cuộn giấy là DOM gấp hai mặt nằm trên đó.
  - Giữa bàn là chip trong vai nghiên mực: phiến đá đen vuông có lưới khắc mờ bắt trăng.
  - Người viết quỳ sau nghiên, là thẻ SVG lấy từ path của `desk.ts`; tay cầm bút là thẻ riêng chuyển động.
  - Sát mép nghiên là **tháp HBM**: 10 đĩa sứ men ngọc là 10 phần tử DOM xếp theo Z, có sợi bạc dọc.
  - Đèn lồng treo trên bàn là key ấm. Trăng từ sau trái viền lạnh trên đĩa.
  - Xa phía sau, theo lối đá bước tan vào sương: kho (kura) tường trắng, một cửa sáng (prop của `diorama`).
- **Tương tác:**
  1. Kéo tấm ván chạm ở đầu phải bàn để bàn hẹp hoặc rộng (slider, valueText "Mặt bàn {n} GB", ←/→; scale X nhóm bàn, số cuộn đổi).
     - Rộng: cuộn trải kín vòng đèn, bút viết nhanh, chữ chảy đều (`large`).
     - Hẹp: chỉ vừa một cuộn; một người chạy giấy nhỏ đi dọc lối đá vào sương tới kho rồi về đổi cuộn, bút dừng chờ mỗi chuyến (`small`; `createLoop` chỉ chạy khi đang đi).
     - Insight 1 sau lần kéo đầu.
  2. Chạm tháp (`aria-expanded`): các đĩa tách theo Z (exploded), sợi bạc giãn ra, `stackLabel` hiện, cả nhóm bàn xoay `rotateY` 25° để lộ tháp nằm sát mép chip. Kéo nền xoay ±25°. Đóng lại: insight 2 + detail (H200: 141 GB HBM3e, 4,8 TB/s) khắc như ấn trên đế tháp.
- **Low:** không người chạy, chỉ vệt chấm mực tới kho; tháp có hai trạng thái tĩnh; không xoay.

**`wells` · 2.5D · HIGH, từ đỉnh đồi phía sau ba giếng**
- **Khung hình:**
  - Tiền cảnh: ba miệng giếng nhỏ khắc tên trên thành (Điện thoại, Laptop, Card đồ hoạ), nhìn chúc 50° thấy đĩa nước in trăng trong từng miệng.
  - Từ mỗi giếng, một ống tre kakehi chạy xuống dốc tới hồ lớn dưới thung lũng ("Trung tâm dữ liệu AI"), bờ hồ có các hàng đèn ấm.
  - Ba ống gặp nhau ở một tấm cống đá giữa dốc. Trăng sau lưng phải, viền trên ống tre.
  - Rê chuột nghiêng cả cảnh ±4° (chỉ transform nhóm cha).
- **Tương tác:**
  - Kéo lên tấm cống ("Mở cửa mạch", `gateAria`, Enter), ba lần. Mỗi lần:
    - nước bạc chạy theo ống xuống hồ (`stroke-dashoffset` trên path tĩnh);
    - hồ dâng một chút, thêm một hàng đèn;
    - đĩa nước trong ba giếng thu nhỏ (scale elip), lộ vòng đá tối.
  - Lần cuối: giếng cạn, đáy là rêu. Fact ở lần 1–2 (SK hynix bán hết 2026, claimBy; Micron đóng Crucial), insight ở lần 3. Danh sách `wellAria` ẩn giữ mực nước cho trình đọc màn hình.
- **Low:** không thị sai, không dòng chảy; mực nước nhảy bằng một transform mỗi lần.

**`bill` · comp/2.5D · 1PT, đối xứng trục** (`progressTide`)
- **Khung hình:**
  - Một cuốn sổ gấp xếp (orihon) dài từ hồ lớn ở điểm tụ (trên giữa, đèn trung tâm dữ liệu sáng bờ xa) chạy thẳng về người xem, rộng dần, trên nền cát tối có vệt cào hội tụ cùng điểm.
  - Tiền cảnh, bị đáy khung cắt: sạp điện thoại ở cổng vườn (quầy gỗ, đèn, tấm đá hình điện thoại).
  - Mỗi mốc là một nếp sổ. So sánh giá DRAM: hai nếp liên tiếp nằm trên mặt đất theo đúng tỉ lệ dài 1 : 5+.
  - Qua "Hôm nay", dải giấy vẫn tới: cuộn qua mép dưới về phía lòng người xem, mờ trong sương (dự báo).
  - Trăng sau hồ, giấy sáng ở đầu xa; nếp gần bắt ánh đèn sạp.
- **Tương tác:**
  - Kéo **đĩa đá chặn giấy** mang bóng trăng dọc dải giấy từ hồ về phía mình (slider, Up/Down/Home/End). Qua nếp nào thì nếp đó dựng lên phấp phới (`rotateX`) và lời đọc hiện; dải dài thêm.
  - "Hôm nay": insight (chipflation, nối trạm 18), detail viết trên tờ cuối ở sạp.
- **Low:** các nếp nằm phẳng; đĩa nhảy theo nếp.

**`refill` · comp/2.5D · LOW, bầu trời lớn** ("Giếng bao giờ đầy lại?")
- **Khung hình:**
  - Camera ngang thành giếng, nhìn hơi lên. Giếng cạn là bóng nhỏ ở một phần ba dưới; ba hòn đá trên thành (J.P. Morgan, SK hynix, IDC). Bầu trời chiếm 70% và là sân khấu.
  - Đêm sắp sáng; trăng thấp sau lưng người xem đổ bóng giếng về phía trước.
- **Tương tác:** chạm đá (1–3):
  - **J.P. Morgan:** trời quang khô, các dải hơi nóng gợn, thành giếng nứt ("nhiều năm thiếu").
  - **SK hynix:** trên đồi xa, bóng thợ đá dựng một nhà xưởng (M15X, dấu claimBy), một đám mây nhỏ thành hình trên đó.
  - **IDC:** mây mưa kéo tới từ phải, mưa nhẹ rơi vào giếng, bóng trăng hiện ở miệng giếng (ổn định giữa 2027, phục hồi 2028).
  - Đủ ba: trời giữ cả ba cùng lúc (quang trái, mây giữa, mưa phải), bóng trăng trong giếng rung và chưa tròn; `common`, insight là detail.
- **Low:** ba bầu trời vẽ sẵn, crossfade.

#### Trạm 30 · II·12

**★ `gate` · 2.5D · mâm xoay sách pop-up**
- **Khung hình:**
  - Đảo rêu tròn trên đĩa sơn đen, nhìn 3/4 trước (elevation khoảng 22°), dưới một vầng trăng đứng yên phía sau.
  - Một đường kính chia đảo làm hai:
    - **Vườn có tường:** tường vôi mái ngói tối (art tường của `gate.ts` dựng đứng), một ô cửa sổ sáng nhỏ có bàn tay đưa ra một cành; cây trổ hoa (chấm son) thấy qua tường nhưng ngoài tầm.
    - **Vườn mở:** cổng tre mở toang, cây non trong chậu, lối toả khỏi đảo qua nước tới nhiều nhà nhỏ ở bờ xa. Mỗi nhà thắp đèn khi một cây non tới.
  - Khoảng 8 tấm giấy SVG đứng trên đĩa CSS 3D (`transform-style: preserve-3d`). Xoay đĩa cho thị sai và che khuất thật. Các tấm xoay ngược một phần (billboard ≤ 40°) để không bao giờ thành cạnh.
  - Độ sáng mỗi tấm theo góc với trăng, qua **một** biến CSS mỗi tấm, ghi khi xoay và không đọc lại.
  - Màn dọc: mâm to và ở giữa, bốn đèn bên vành xếp thành hàng dưới.
- **Tương tác:**
  - Kéo ngang để xoay, có quán tính, bắt vào 0° (mặt tường) và 180° (mặt mở). Space hoặc ←/→ đảo mặt (`toggleAria`, nhãn mặt `closed`/`open`).
  - Bốn đèn đá nhỏ quanh vành là điều khiển (`tradeoffLabel`): Tự do, Chi phí, Riêng tư, Rủi ro lạm dụng. Thắp một đèn thì dòng của nó hiện cho mặt đang hướng về người xem, kèm một tiểu cảnh trên đảo:
    - **Tự do:** mặt mở có người trồng và tỉa cây; mặt tường chỉ có bàn tay ở cửa sổ.
    - **Chi phí:** mặt tường bỏ một đồng xu vào hộp mỗi cành; mặt mở có người khuân chậu nặng và hũ dầu đèn.
    - **Riêng tư:** lá thư qua cửa sổ vào trong tường, đối lập với ở yên trong nhà mình bên kia nước.
    - **Lạm dụng:** mặt tường đóng cửa chớp trước yêu cầu xấu; mặt mở có cây non đã ở bờ xa không gọi về được, ai đó nhổ cọc tre của nó.
  - Xem cả hai mặt: insight + detail (gpt-oss, Apache 2.0, 16 GB, claimBy OpenAI); caveat khắc quanh đế mâm.
- **Low:** hai khung vẽ sẵn crossfade (ở `high` có một cú lật `rotateY` ngắn); tiểu cảnh là một sprite đổi.

**`fence` · canvas · LOW 15°, ngọn đèn sau rào gai**
- **Khung hình:**
  - Đêm, một ngọn đèn gần như trắng (`--moon` lõi, quầng lạnh) trong khu rào cọc tre buộc dây gai ở trung cảnh. Đây là key light của cả tranh.
  - Mỗi cọc đổ một bóng dài toả về phía người xem: quad bóng chiếu từ vị trí đèn lên mặt đất, vẽ trên canvas `multiply` trên các lớp SVG tĩnh.
  - Hậu cảnh: bức tường thành dài lùi về phải; chỗ vũng sáng chạm tường lộ vết nứt mảnh viền son, và chỉ ở đó.
  - Ở cổng là hai lính gác (nón, giáo) cầm đèn ấm đóng ấn son.
  - Màn dọc: tường dựng sau rào, quạt bóng chĩa thẳng xuống người xem.
- **Tương tác:**
  1. Đẩy cổng (kéo hoặc Enter, `gateAria`): cổng căng dây gai, lính bắt chéo giáo, câu `denied`.
  2. Chạm đèn của từng lính (1–2: Mythos Preview, Fairwind): lính đi vào, ấn sáng, fact hiện.
  3. Giờ có thể xoay đèn như hải đăng (kéo quanh nó; ←/→): bóng cọc quét quanh nền theo thời gian thực, chùm sáng trượt dọc tường, lộ từng vết nứt → "Vì sao rào?" (claimBy Anthropic).
  - Quét xong tường: "Câu hỏi còn mở" khắc trên cột cổng, rồi insight và detail (về trạm 19).
  - Canvas chỉ vẽ lại khi đang kéo, một lần mỗi frame.
- **Low:** đèn cố định, quạt bóng vẽ sẵn; kéo chỉ di chuyển mặt nạ tròn lộ vết nứt.

**`laws` · comp/2.5D · GRAZE, nhìn từ biển vào bãi** (`progressTide`, "Thuỷ triều luật lệ")
- **Khung hình:**
  - Camera trên mặt nước ngay ngoài khơi, đêm. Bãi biển là dải ngang ở một phần ba giữa, cong khuất về trái vào sương.
  - Tám trụ đá đứng dọc bãi ở các độ xa khác nhau, dùng dáng trụ của `lawsArt`: EU granite xám (gần phải), Trung Quốc basalt sẫm, Mỹ đá phiến, Việt Nam đá nhạt có ấn đỏ (xa trái). Lúc đầu tất cả ngập trong sóng.
  - Một dải sương trên biển xa.
  - Trụ thứ chín chỉ phác dưới nước nông, ở trái xa nhất (dự báo).
- **Tương tác:**
  - Kéo trăng theo cung trời biển (← → Home End). Nước **rút về phía người xem**, bãi rộng ra về phía camera. Từng trụ nổi lên, nước chảy khỏi mặt, nhãn khắc đọc được, lời đọc dựng lên bên cạnh.
  - So sánh EU (02/08/2026 → 02/12/2027): hai khấc trên cùng một trụ, mép nước nhảy từ khấc cũ sang khấc mới.
  - Trụ Việt Nam vẫn ướt bóng. "Hôm nay": insight, rồi trụ thứ chín nửa chìm với câu dự báo.
- **Low:** mép nước đổi theo mốc, trụ hiện bằng opacity, trăng nhảy.

**`copyright` · comp/2.5D · EYE nhìn ngang, cần kéo nước (shadoof)** (`perspectiveCircle`)
- **Khung hình:**
  - Camera ngang mép hồ. Cần kéo nước vắt chéo khung: cột trụ và đá đối trọng ở bờ gần trái, sào dài vươn ra hồ trăng, gàu trên dây ở đầu sào (art `copyrightArt`, dựng lại to hơn).
  - Hồ phản chiếu một thư viện thay vì bầu trời: trang sách, tranh cuộn, bản nhạc trôi chậm dưới nước như cá koi (sprite trong một nhóm transform).
  - Năm hòn đá trên bờ gần xếp cung, tiền cảnh, to, viền trăng: Người sáng tạo, Công ty AI, Toà án Mỹ, Nhà làm luật, Người dùng.
  - Màn dọc: sào chạy từ trên phải xuống dưới trái.
- **Tương tác:**
  1. Kéo đầu sào xuống (hoặc Enter): gàu nhúng xuống hồ, nhả ra thì gàu lên đầy trang giấy nhỏ giọt bạc (dữ liệu huấn luyện).
  2. Chạm đá (1–5): một chùm đèn từ hòn đá đó rọi lên gàu, cho thấy cách người đó nhìn cái gàu, lời ghim trên đá:
     - Người sáng tạo: ấn đỏ của họ trên các trang;
     - Công ty AI: nước chảy tự do, dây có một khe cho chủ sở hữu từ chối;
     - Toà án: gàu tách hai, sách mua hợp pháp không sao, sách lậu bị gạch;
     - Nhà làm luật: thẻ giấy buộc quai liệt kê thứ bên trong;
     - Người dùng: gợn của một câu lệnh không có ấn (không có quyền tác giả).
  - Đủ năm: `common`, insight, rồi "Hồ sơ toà án" (`casesLabel`): hai fact là hai tấm gỗ treo trên cột cần.
- **Low:** gàu có hai vị trí tĩnh; trang giấy đứng yên; mỗi hòn đá một lớp phủ tĩnh.

---

### Vườn 11 · Vườn mở · cổng vườn hé mở

Nhiều đèn. Ánh ấm tràn ra cửa và cửa sổ: trong ấm, ngoài lạnh. Trăng ở 35° phía sau.

#### Trạm 31 · II·13

**`wells` · 2.5D · EYE, hai giếng đối xứng nhìn thẳng**
- **Khung hình:**
  - Hai miệng giếng rêu đứng cạnh nhau trên sân đá dưới trăng (màn dọc: một trên một dưới). Xà ròng rọc vắt ngang trên như một chiếc cổng.
  - Gàu treo ở giữa phía trước, lớp gần nhất, to, hơi mờ, có thẻ giấy ghi món hiện tại.
  - Camera hơi cao hơn miệng giếng (12°), đủ thấy mặt nước: giếng GitHub có ánh lấp lánh hình mã (`{ }`, `</>`, `;`); giếng HF có hũ sành dán nhãn, ấn đỏ dưới nước.
  - Mỗi giếng có một vầng trăng phản chiếu riêng. Đèn trên cột hắt ấm một bên thành giếng.
- **Tương tác:**
  - Kéo gàu: gàu đung đưa như con lắc theo dây (một `createLoop`, lò xo). Thả trên một giếng: dây thả, gàu rơi vào miệng (nhỏ và tối dần), một vòng ánh sáng bắn lên từ miệng giếng, gàu kéo lên.
    - Đúng giếng: gàu mang món đồ thành vật (cuộn mã hoặc hũ có nhãn) đặt lên thành giếng đó và ở lại, nên thành giếng đầy dần khi xếp.
    - Sai: gàu lên rỗng, nhỏ giọt, thẻ hiện `wrong`.
  - Đủ sáu món: hai bóng trăng lặng; insight, detail, note viết vào khoảng trống trên trời.
  - Bàn phím: Tab tới gàu, ←/→ hoặc 1/2 chọn giếng, Enter thả (`itemAria`). Không dùng gyro.
- **Low:** gàu xuống và lên bằng crossfade; món hiện trên thành giếng; không con lắc.

**`depth` · comp/2.5D · SECT, giếng bổ đôi dọc như tranh treo** (`progressTide` + `track` dọc)
- **Khung hình:**
  - Một giếng bổ dọc thành khung cao như kakemono. Vách cong của các hàng đá lùi xa đọc thành hình trụ, tối dần khi xuống sâu.
  - Miệng tròn ở trên mở ra trời trăng; một nón ánh trăng rơi xuống lòng giếng rồi nhạt dần. Ngoài vết cắt là các lớp đất `--wash`.
  - Nước trong giếng là một cột, chiều cao = số model công khai. Hai vạch lũ khắc trên vách, '1 triệu · 09/2024' thấp và '3,16 triệu · 10/2026' cao; `compare.ratio` 3.16 quyết định hình học.
  - Trong nước hôm nay có một dải nước ấm `--lantern` mỏng: khoảng 211 nghìn model GGUF (khoảng 6,7% cột nước).
  - Mốc là các viên đá nhô khỏi vách ở đúng độ cao. Viên 02/2026 có một ngọn đèn nhỏ thả dây xuống giếng (llama.cpp "về chung nhà").
  - Dưới nước, giếng tiếp tục vào sương, các hàng đá thành nét chấm; dự báo viết ở đó.
- **Tương tác:**
  - Nút kéo là **bóng trăng** trên mặt nước. Kéo lên (↑/↓, Home/End): nước dâng qua các năm, hơi sóng sánh, mang theo bóng trăng. Đá mốc sáng khi mặt nước qua, fact viết cạnh đá.
  - "Hôm nay": bóng trăng thẳng hàng đúng dưới trăng thật ở miệng giếng → insight. Kéo tiếp xuống sương thì lộ dự báo (○) và detail.
- **Low:** nước ở mức hôm nay sẵn; slider chỉ dời vùng sáng giữa các mốc.

**`card` · canvas · 3Q ngang ngực, rập bia bằng mực** ("Đọc bia giếng")
- **Khung hình:**
  - Bia rêu thấp cạnh giếng, nhìn 3/4 (`rotateY` khoảng −16°, mặt hông `--rock-lo`, cạnh vát).
  - Một tờ washi ẩm áp lên mặt bia, buộc dây, nếp nhăn bắt ánh trăng sượt từ trên trái.
  - Sáu dòng (label + value), tên model và thông báo `mock` (ấn son nhỏ) **khắc** vào đá, nên giấy trắng che hết.
  - Bông chấm mực và nghiên ở chân bia. Tiền cảnh: vũng nước đổ từ gàu soi bia và trăng.
- **Tương tác:**
  - Cầm bông mực chấm hoặc kéo trên giấy. Mỗi chấm in mực hạt mềm **chỉ ở chỗ đá nổi** (mặt nạ khắc vẽ một lần vào canvas rời; mỗi chấm là sprite nhiễu bị mặt nạ cắt), nên chữ khắc hiện trắng trên nền mực.
  - Một dòng đã mực khoảng 60% thì mở: `read` viết ở lề với sợi dẫn mảnh; dòng lóe ngược trong vũng nước.
  - Đủ sáu và dòng license: insight + detail. Tờ giấy bóc khỏi đá cong 3D từ góc trên và bay về trước: chính bản rập thành thẻ `t31-model-card`.
  - Tab tới từng dòng (`lineAria`), Enter tự chấm dọc dòng.
- **Low:** giấy đã rập sẵn; dòng là nút; bóc giấy thành crossfade.

**★ `repo` · 3D · ORBIT, hai mái nhà trên đảo sỏi** (`inkStage`)
- **Khung hình:**
  - Đảo sỏi cào tròn (`k.ground`, vòng cào) trên nước đen (`k.pond`) có đường trăng, sương khép vành xa.
  - Hai ngôi nhà gỗ **giống hệt nhau từ phía trước**: mái chồng diêm, đầu đao cong, shōji, cổng có biển tên, một dây đèn giấy nhỏ dưới mái (Stars, cùng số đèn ở cả hai nhà: cố ý không phải dấu hiệu). Vật liệu `k.ink('bark'|'step'|'rock')`, viền mực.
  - **Nhà thật** (lang-mau/den-long):
    - ánh `--lantern` trong nhà tràn qua shōji xuống sỏi (shōji phát sáng + `k.glow` + ô lantern uniform);
    - cuộn README ghim cạnh cửa;
    - hòm thư có lá thư mới buộc dây đỏ (issues được trả lời);
    - bảng tin gỗ ghi ngày phía sau (releases v2.3);
    - biển MIT trên cổng.
  - 640 nhà fork (một InstancedMesh) rải trên đồi xa, nối bằng lối mòn mờ tan vào sương.
  - **Nhà giả** (lang-rnau/den-long):
    - từ trước nhìn y hệt, nhưng chỉ là **mặt tiền vẽ dày khoảng 3 cm**, chống bằng hai sào tre;
    - phía sau trống không: mạng nhện, một bọc furoshiki buộc vào sào (.zip không nhãn), chuông issues bọc giấy kín, không biển, không lối mòn;
    - README chép lại có thêm một mảnh giấy đỏ ("tải bản cài nhanh").
  - **Dấu hiệu ngay từ phía trước:** nhà thật đổ một khối bóng sâu (decal bake), mặt tiền chỉ có một đường bóng mảnh. Không dùng shadow map.
- **Tương tác:**
  - Kéo để đi vòng đảo: yaw ±170°, pitch 8–50°, có cản; mũi tên khi canvas đang focus; bánh xe hoặc chụm hai ngón để lại gần (toolkit thêm `dolly`).
  - Đi vòng ra sau nhà giả là khoảnh khắc "à": nó rỗng.
  - Chạm một vật để đọc tín hiệu: vật tương ứng sáng ở **cả hai** nhà; `what` của tín hiệu và hai giá trị repo viết trên trời giữa hai nhà (`k.label`). Các cặp: README ↔ cuộn giấy; Stars ↔ đèn mái; Fork ↔ lối mòn; Issues ↔ hòm thư/chuông; Releases ↔ bảng tin; License ↔ biển cổng.
  - Lại gần biển cổng: nét chữ cho thấy "rn" giả làm "m".
  - Chọn nhà bằng cách thắp đèn cổng của nó (`pick`, `pickAria`):
    - Đúng: cửa sổ sáng, `right`.
    - Sai: một cơn gió lật mặt tiền ngửa ra sau xuống sỏi, lộ chỗ rỗng, `wrong`.
  - Sau đó insight, detail. Một mảnh giấy tháo khỏi cổng nhà thật thành thẻ `t31-ask-ai-repo`.
  - Raycast chỉ khi `pointerup`. Tín hiệu và nút chọn có bản DOM cho bàn phím.
- **Low:** WebGL theo yêu cầu, không quán tính, 120 nhà fork. Không có WebGL: hai tranh SVG của cùng diorama (trước và sau-trái), một đá bước để đổi góc nhìn bằng crossfade (cần **một chuỗi aria mới** trong `tram-31.json` + `.en.json`).

**`clean` · comp/2.5D · LOW, thác kakehi chảy về người xem** (`stepPath`)
- **Khung hình:**
  - Camera thấp cạnh bát, ngước lên thác. Ống tre cao ở sau trái, nửa chìm trong sương, rót xuống sáu chậu đá bậc thang đi chéo **về phía camera**: chậu càng gần càng to, sương giữa các chậu xa. Thác đổ vào một bát men tối lớn ở tiền cảnh.
  - Mỗi chậu là một lớp lọc chờ viên đá của nó. Nước rời ống đục mực (`--wash`).
  - Màn dọc: thác zig-zag xuống, bát ở đáy.
- **Tương tác:**
  - Đặt đá lọc có số theo thứ tự (kéo, chạm, hoặc phím số; logic và aria của `stepPath` giữ nguyên).
  - Đúng: dòng dưới chậu đó trong lại một nấc, `detail` của bước viết cạnh chậu.
  - Sai: đá trượt về, mực loang trong chậu kế, gợi ý `why`.
  - Đủ sáu: nước trong đầy bát, trọn vầng trăng trong bát; thẻ `t31-safe-download` nổi lên, rồi insight (pickle), detail (JFrog), note.
- **Low:** màu nước của chậu đổi ngay; trăng hiện trong bát khi xong.

#### Trạm 32 · II·14

**`scale` · 2.5D · LOW, cành thông ngang trăng**
- **Khung hình:**
  - Camera thấp ngước lên. Một cành thông cong vắt qua vầng trăng lớn (bố cục cành-ngang-trăng cổ điển); từ cành treo một cái cân đòn cổ, đòn cân cắt ngang đĩa trăng.
  - Đĩa trái: một ngôi nhà nhỏ có đèn dầu sáng, ánh `--lantern` lên dây xích. Đĩa phải: một đám mây bạc che một vầng trăng nhỏ.
  - Đĩa cân là bát đồng nông nhìn hơi từ dưới, thấy cả mặt dưới, ba dây xích (dây sau nhạt hơn).
  - Tiền cảnh: nước nông có sáu hòn đá sông khắc (quả cân), nửa chìm, to, mềm. Nước phản chiếu cả cái cân lộn ngược.
- **Tương tác:**
  - Nhấc đá khỏi nước (kéo) thả vào một đĩa: đòn cân nghiêng theo lò xo tắt dần (một `createLoop`), đĩa đung đưa và xoay trên xích, bóng nước đi theo.
  - Sai đĩa: đĩa chao, hất đá xuống nước có gợn, `wrong`.
  - Mỗi đá đã đặt treo thẻ `why` dưới đĩa. Đủ 3–3: đòn cân nằm ngang chân trời, hai bóng đĩa gặp nhau; insight, detail.
  - Bàn phím: Tab tới đá, ←/→ chọn đĩa, Enter thả (`weightAria`).
- **Low:** đòn cân nhảy thẳng góc, không gợn.

**★ `table` · canvas · 3Q 35°, bàn trà dưới cửa sổ trăng** (thay WebGL)
- **Khung hình:**
  - Camera ngồi chúc 35° vào một bàn trà dài thấp. Sau bàn là cửa sổ tròn (trời đêm, cành thông, trăng) chiếu một elip ánh trăng sáng lên mặt bàn: chỗ trống.
  - **Chiều dài bàn là RAM của bạn.** Bộ ấm chén luôn chiếm 25% bên phải mặt bàn (OS, app, ngữ cảnh: luật "chừa chỗ" của nội dung).
  - Model là các bó cuộn giấy buộc dây, dài theo GB (cùng tỉ lệ với bàn), xếp trên kệ tường bên trái trong bóng tối, thẻ gỗ "3B ≈ 1,7 GB".
  - Cạnh bàn là máy ép gỗ nhỏ (lượng tử hoá Q4). Chiếu tatami, tường vữa `--paper-2`, gỗ `--rock-mid`, một đèn dưới sàn.
  - Phòng bake một lần (`sliced`). Bó giấy và cuộn lăn vẽ trên một canvas phủ, **chỉ khi có chuyển động**.
- **Tương tác:**
  - Kéo một bó lên bàn:
    - **Rộng:** nằm trong elip trăng, quanh vẫn còn ánh trăng.
    - **Chật:** che hết ánh trăng, đẩy bộ ấm chén.
    - **Tràn:** các cuộn thừa trượt khỏi mép, lăn ngang chiếu về phía camera (lăn giải tích, góc quay = quãng đường / bán kính), một cuộn mở ra.
    - Trạng thái (`roomy`/`tight`/`spill`) và `sizeText` viết trên thẻ buộc bó.
  - **Bits:** thả bó vào máy ép, vặn tay quay (kéo hoặc Enter): dây siết, bó ngắn còn khoảng 1/3,5, đầu cuộn hạt mực thô hơn ("mất chút nét").
  - **RAM:** kéo tấm ván cuối bàn, bắt nấc 8/16/32/64 (slider, ←/→, `ramText`). Bàn dài thêm thì cả bức tranh thu nhỏ lùi lại (CSS scale/translate), mép bàn gần bị cắt.
  - Luật (◇ minh hoạ) treo trên bảng dưới cửa sổ. Sau ba lần đặt, bảng thành thẻ `t32-ram-table`. Rồi insight, detail, note (VRAM / unified memory).
- **Low:** cuộn tràn đã nằm sẵn trên chiếu, không lăn; ép là một scale.

**`lamps` · canvas · INT, hai điểm tụ dọc kệ, phòng tối**
- **Khung hình:**
  - Nhìn dọc một kệ gỗ chạy chéo từ trước trái tới sau phải.
  - Gần nhất và to nhất là đèn giấy (LM Studio, nắp mở). Giữa là đèn dầu có núm bấc đồng (Ollama). Cuối kệ, trong ống thuỷ tinh, là ngọn lửa trần (llama.cpp): lúc đầu là nguồn sáng duy nhất, nhỏ.
  - Cạnh đó là hũ dầu gốm niêm "GGUF" son.
  - Vách nan tre sau là một light map canvas: ánh ấm tắt dần, bóng nan toả từ mỗi ngọn lửa theo phối cảnh. Phần còn lại chìm trong đêm `--paper`.
- **Tương tác:**
  - Châm một que lửa từ ngọn xa rồi kéo lửa tới các đèn gần: **ánh sáng và bóng nan đi theo tay**, căn phòng được thắp lại bởi thứ người xem cầm.
    - Đèn giấy bắt lửa ngay.
    - Đèn dầu chỉ cháy sau khi vặn núm bấc lên (kéo xoay hoặc ↑).
  - Mỗi đèn sáng thêm vũng sáng và quạt bóng riêng. Chạm đèn đã sáng để đọc name, kind, what, fit, fact (và update của llama.cpp), viết trên vách sáng phía trên nó; link tài liệu là thẻ treo nhỏ.
  - Đủ ba: sợi dầu vàng mảnh chạy từ hũ GGUF vào mọi đèn → insight, detail/changeNote.
  - Bàn phím: đèn là nút (`lampAria`); Enter mang lửa, ↑ vặn bấc.
- **Low:** không lửa động; mỗi số đèn sáng là một light map vẽ sẵn.

**`lamps.steps` · comp/2.5D · EYE 3/4 cận, lắp một ngọn đèn đá** (`stepPath`, "Thắp đèn đầu tiên")
- **Khung hình:**
  - Một nền đá trống trên rêu ở giữa khung, đêm, trăng sau trái. Ngôi nhà nhỏ của người xem rất xa trong sương, cửa sổ tối.
  - Bốn bộ phận đèn đá nằm trên rêu quanh đó, mỗi bộ phận khắc nhãn một bước: đế (kiso), thân (sao), lồng đèn (hibukuro), mái (kasa). Có khối, rêu, bóng.
- **Tương tác:**
  - Đặt theo thứ tự (kéo, chạm lần lượt, phím số; logic `stepPath`). Mỗi bộ phận đúng hạ xuống chồng lên đèn kèm tiếng đá, `detail` của bước viết cạnh đèn.
  - Sai: bộ phận trượt về, `wrongHint`.
  - Đặt mái (bước 4): lồng đèn thắp lên và cửa sổ nhà xa cũng sáng ("Đèn đã thắp"). Thẻ `t32-lmstudio-start` là mảnh giấy trong ô cửa đèn.
- **Low:** bộ phận hiện ngay ở chỗ; đèn thắp bằng class.

**`scroll` · 2.5D · MACRO nhìn thẳng, hốc tokonoma, sáng từ dưới**
- **Khung hình:**
  - Cận hốc tokonoma, nhìn thẳng, cuộn chiếm khoảng 60% chiều cao khung. Một kakejiku cuộn treo gần đỉnh, trục dưới có quả nặng và tua trong tầm tay.
  - Đèn dầu nhỏ dưới sàn **rọi ngược lên**: gradient ấm dâng từ dưới, bóng mềm của cuộn đổ lên vữa phía **trên** nó.
  - Một cành hoa trong bình bên cạnh để cho thấy tỉ lệ.
- **Tương tác:**
  - Kéo trục xuống để mở: giấy mở với một trụ giả tô bóng ở mép đang lăn (lớp CSS trên thân `codeScroll`, clip theo chiều dài), lộ bốn lệnh từng dòng.
    - Ghi chú thầy giáo viết son nhỏ ở lề.
    - Buông giữa chừng thì trục nặng bật lên một chút.
  - Rê chuột hoặc focus vào một dòng: ngọn đèn nghiêng về phía dòng đó.
  - Mở hết: nút sao chép là ấn son ở góc dưới; rồi `modelNote`, insight, detail, thẻ `t32-ollama-commands`. Enter hoặc ↓ mở từng nấc.
- **Low:** mở sẵn; ánh tĩnh.

**`circle` · comp/canvas · GRAZE 8°, sát mặt hồ** (`perspectiveCircle`)
- **Khung hình:**
  - Camera lướt khoảng 8° trên hồ tròn: hồ thành elip mảnh, bóng trăng thành con đường dọc dài vỡ ánh chạy về người xem.
  - Bốn hòn đá có khối: hai xa nhỏ, hai gần to bị mép khung cắt. Mỗi hòn có một ngọn đèn nhỏ chưa thắp.
  - Lau ở trước trái (`paint.reeds`); sương thấp trên bờ xa.
- **Tương tác:**
  - Chạm đá (1–4): đèn thắp; vì camera sát mặt nước, bóng ấm của nó kéo thành vệt dài trên nước về phía người xem, đường trăng cong về hòn đá đó. Lời (◐) viết cạnh đá.
  - Rê chuột (hoặc kéo) xoay camera ±6° quanh hồ: mọi vệt phản chiếu trượt trên nước (tính lại chỉ khi camera đổi).
  - Đủ bốn: bốn vệt ấm và đường trăng hội về tâm hồ, gợn lặng; `common` + insight.
- **Low:** không xoay; hội tụ vẽ một khung.

#### Trạm 33 · II·15

**`keeper` · 2.5D · EYE toàn cảnh, tua một đêm**
- **Khung hình:**
  - Trái: nhà chính tối, mọi người ngủ. Giữa: ao có cát cào quanh, người giữ vườn nhỏ cầm đèn đi vòng quanh ao; vũng `--lantern` trên đất và dưới nước.
  - Trên cột hiên treo chuông gió (kênh tin nhắn); trên bậu hiên là cuốn sổ dày của người giữ vườn.
  - Xa bên phải, tách riêng: một thư phòng nhỏ có đèn bàn (agent lập trình), chỉ sáng khi làm việc.
  - Trời là cung trăng rộng từ 22:00 (trái) tới bình minh (phải, `--dawn`).
  - Bốn lớp thị sai: cỏ lau gần, hiên và ao, thư phòng, đồi xa.
- **Tương tác:**
  - Gửi: chạm chuông gió hoặc nút gửi. Tin gấp thành hạc giấy bay tới chuông, chuông kêu; người giữ vườn dừng lại, viết vào sổ (sổ dày thêm), `reply` viết cạnh ông.
  - Kéo trăng theo cung để tua đêm (cần **một chuỗi aria mới** trong `tram-33.json` + `.en.json`): người giữ vườn vẫn đi vòng, vết chân tích thành vòng trên cát (trí nhớ qua đêm), thư phòng vẫn tối.
  - 07:00: `--dawn` dâng, chuông tự kêu (agent nhắn bạn).
  - Chạm người giữ vườn hoặc thư phòng để đọc hai loại (name, what, examples kèm fact và ◇) như chữ trên trời; rồi insight và detail.
- **Low:** trăng ở nửa đêm cố định; gửi hiện `reply` ngay; bình minh crossfade.

**`keys` · 2.5D · MACRO, chùm chìa đồng**
- **Khung hình:**
  - Một vòng năm chìa đồng treo dưới mái một đèn đá ở tiền cảnh, mỗi chìa một dáng, thẻ khắc nhỏ (read, write, exec, send, spend). Kim loại gradient trăng, vệt bóng gắt.
  - Sau, nông độ sâu (lớp nhoè tĩnh): ngôi nhà có năm cửa (thư viện, bàn viết, bếp, cổng thư, rương tiền), giấy mỗi cửa sáng mờ.
  - Bàn tay mở của người giữ vườn vào từ dưới phải. Nhiệm vụ viết ngang trời tối phía trên.
- **Tương tác:**
  - Vòng chìa là vật thật: kéo thì đung đưa và xoay (con lắc trong một `createLoop`), vệt bóng trượt dọc từng chìa, tiếng leng keng.
  - Tháo một chìa thả vào lòng bàn tay để trao, hoặc để trên vòng để giữ (`keyAria`). Trao thì cửa tương ứng mở chốt: tranh chuyển nét (crossfade lớp nhoè → lớp sắc), ánh phòng tràn ra, `risk` của chìa viết dưới cửa.
  - "Giao việc": người giữ vườn đi làm.
    - Thừa chìa: cửa thừa vẫn mở sau lưng, vệt mực son từ mỗi cửa tới cổng (`tooMany`).
    - Thiếu: ông dừng trước cửa niêm (`tooFew`).
    - Đúng read + send: ba cửa kia dán giấy niêm đỏ (`right`); insight, detail, thẻ `t33-permission-plan` viết trên thẻ chìa.
- **Low:** chìa đứng yên; trao/giữ bằng chạm hoặc Enter; cửa đổi trạng thái không chuyển nét.

**`whisper` · 2.5D · HIGH 50° → EYE thẳng, lá thư dựng đứng**
- **Khung hình:**
  - Bắt đầu: cận lá thư washi trên bậc đá ướt, nhìn chúc 50°. Giấy chiếm khoảng 60% khung, sợi kozo thấy được (nhiễu dựng một lần ở module), góc hơi quăn, hạt sương, ánh trăng trên đá ướt.
  - Các dòng lịch sự viết serif. Ấn son nhỏ ở góc mang nhãn `mock`. Dòng ẩn nằm **trong** giấy như watermark: ánh phản xạ không thấy.
  - Đèn lồng giấy đặt trên bậc cạnh đó, đang sáng.
  - Kết: lá thư dựng thẳng, chiếm 70% khung, trước nền đêm.
- **Tương tác:**
  - Cầm đèn (`lanternAria`): lá thư nhấc lên xoay 3D (`rotateX` 50° → khoảng 5°) tới khi đứng thẳng.
  - Kéo đèn **ra sau** giấy: ánh xuyên qua thành vòng mềm theo đèn (mặt nạ CSS theo `--lx/--ly`, chỉ ghi khi di chuột). Trong vòng, sợi giấy tăng tương phản, dòng watermark sáng hơn giấy quanh nó.
  - Rồi một ánh quét lạnh, đều (mắt của agent) lướt cả tờ, dòng ẩn hiện trọn: `revealed`.
  - Insight (prompt injection gián tiếp), detail (◐ bộ ba chết người), thẻ `t33-agent-safety`: lá thư gập xuống thành thẻ. Space quét đèn ngang.
- **Low:** thư dựng sẵn; Space/chạm crossfade hai lớp (thường / soi ngược).

**★ `house` · 2.5D · nhà búp bê năm gian, xoay quanh**
- **Khung hình:**
  - Nhà nông năm gian cắt mở như sân khấu giấy, nổi trên bệ cát cào vuông trên sương. Nhìn 3/4 từ trên như mô hình thu nhỏ.
  - Bỏ tường trước và nửa mái gần nên thấy cả năm gian.
  - Dựng bằng mặt phẳng 3D thật (`preserve-3d`): sàn, vách sau, vách ngăn, cột, hai nửa mái và nóc. Mỗi mặt vẽ SVG (vân gỗ, vữa, ngói), tô bóng theo góc với trăng; **tính lại khi xoay, không mỗi frame**.
  - Năm gian:
    - bếp có than (model);
    - giá dụng cụ treo đồ nghề và hình ổ cắm (tools qua MCP);
    - kệ sách công thức (skills);
    - rương sổ (memory);
    - cổng có chuông (channel).
  - Người giữ vườn đứng ở cổng. Trăng từ trên trái đổ bóng mái vào các gian (đa giác bóng xiên trên sàn). Mỗi gian treo một đèn chưa thắp.
- **Tương tác:**
  - Kéo xoay mô hình: `rotateY` ±40°, `rotateX` 15–45°; mũi tên khi focus. Cột trượt qua nhau với thị sai thật.
  - Chạm đèn gian (`roomAria`): gian ngập ánh ấm (lớp phủ toả tròn trên sàn và vách sau), cột hắt dải sáng ra cát qua mặt trước mở, `what` treo dưới hiên. Gian có `station` thêm đá nhỏ "Xem lại Trạm {n}".
  - Đủ năm: một sợi chỉ vàng vẽ đường đi của một tin nhắn: chuông cổng → bếp → giá dụng cụ, sách, sổ → về chuông. Insight và detail (MCP, Agentic AI Foundation).
  - Cuối: một con bướm đêm son đậu lên rương sổ rồi kệ công thức, khoanh mực mỗi chỗ (`note`).
- **Low:** góc 3/4 cố định; đèn sáng bằng lớp tĩnh; sợi chỉ vẽ một nét; bướm thành hai vòng son tĩnh.

**`stones` · comp/2.5D · PAN, cuộn emaki dọc bờ hồ** (`newsStones`)
- **Khung hình:**
  - Camera lia ngang dọc lối bờ hồ đêm, nước phía sau (`--water`, đường trăng). Bia đứng ở nhiều độ sâu: có tấm gần to bị khung cắt, có tấm xa nhỏ trong sương. Bia có độ dày thật (mặt cạnh).
  - Mới nhất ở phải: người xem đi từ phải sang trái vào quá khứ. Bia cũ phủ rêu (luật tuổi của `newsStones`), bia mới còn bóng mực ướt.
  - Một đèn thấp treo cạnh tấm bia đang ở giữa. Bộ lọc "chỉ tin đã kiểm chứng" là một chao đèn đứng trên lối.
- **Tương tác:**
  - Kéo cảnh, cuộn chuột hoặc ←/→ để đi. Bốn lớp thị sai; đèn chuyển sang bia kế khi nó vào giữa.
  - Chạm bia: quay 180° (`rotateY`, `backface-visibility: hidden`, thấy cạnh đá khi quay) để lộ mặt sau what · why · source · date · ai xác minh + dấu.
  - Xoay chao sang "chỉ tin đã kiểm chứng": bia chưa kiểm chứng, ý kiến, dự báo chìm vào sương; bia đã kiểm chứng vẫn sáng.
  - Insight sau lần lật đầu. Detail (rêu và tuổi tin) ghi trên cột đầu lối.
- **Low:** một hàng bia trong phối cảnh, Tab/mũi tên căn giữa bằng bước nhảy; lật thành crossfade.

---

### Vườn 12 · Xưởng dưới trăng · đèn xưởng sáng

Đèn xưởng ấm là key light; trăng chỉ là fill lạnh qua cửa. Vật liệu: gỗ, gốm, giấy, cát.

#### Trạm 34 · II·16

**`market` · 2.5D · GRAZE, chợ nổi nhìn từ thuyền**
- **Khung hình:**
  - Camera trên một chiếc thuyền nhỏ giữa hồ đen; mũi thuyền có đèn bị mép dưới cắt.
  - Ba sạp trên cột ở ba độ sâu:
    - **sạp gom** gần trái, rộng, hai tầng, cụm 7 đèn giấy nhiều tông mực dưới mái (nhiều model một chỗ);
    - **hai sạp chuyên** ở giữa phải và xa, mỗi sạp một đèn lớn.
  - Mỗi sạp có rèm noren (nếp vải có bóng) mang `stalls[].name`, `what`, `example` và link `officialLabel`. Thông tin nằm trên vải, không trong thẻ.
  - Mỗi đèn thành vệt phản chiếu dọc dài đứt quãng: sạp gom phản chiếu thành dải bảy màu, sạp chuyên một vệt hổ phách mạnh. Nhìn bóng nước đã thấy khác biệt.
  - Bốn đèn hoa đăng trôi cạnh thuyền, mỗi đèn mang một `tasks[].text`. Một cọc gỗ nhỏ trên mũi thuyền ghi dòng `volatile`.
  - Màn dọc: các sạp xếp theo độ sâu (gần dưới trái, xa trên phải).
- **Tương tác:**
  - Kéo một đèn hoa đăng qua nước (hoặc chạm đèn rồi chạm sạp): đèn lướt, để lại vệt chữ V, nhỏ dần theo độ sâu, cập dưới sạp.
    - Hợp: đèn sạp bùng, vệt phản chiếu dài ra, noren vén lên hiện `right` + why; các sạp khác cũng hợp thì sáng mờ, kèm một đèn ma trôi về phía chúng (`also`).
    - Không hợp: dòng nước đưa đèn về thuyền, `wrong` viết trên nước.
  - Sạp gom gom gần hết đèn, nên người xem tự thấy một việc thường hợp nhiều sạp, không có sạp "tốt nhất".
  - Fact mở trên noren kèm dấu (◇ cho claimBy). Cập đủ bốn: insight + detail.
  - Bàn phím: đèn hoa đăng là nút (`dropAria`); Enter chọn, ←/→ chọn sạp, Enter cập. Link noren là link thật.
  - Thị sai 4 lớp ±10 px.
- **Low:** tranh vẽ một lần; cập ngay bằng class.

**`path` · comp/2.5D · HIGH 50°, lối cát chữ S** (`stepPath`)
- **Khung hình:**
  - Camera cao sau cổng xưởng, chúc khoảng 50° qua vườn cát cào về phía hồ. Hai cột cổng tối cắt hai góc dưới; ánh ấm từ xưởng sau lưng chạm cát gần.
  - Cát cào thành hàng dài uốn quanh hai tảng đá rêu. Tám hốc nông uốn chữ S từ gần (scale 1) tới xa (0.35), mỗi hốc có vòng AO mềm.
  - Tám đá bước nằm rải ở cát tiền cảnh: canvas vẽ có khối, rêu, bóng tiếp xúc + bóng trăng dài, viền ấm từ cổng; nhãn khắc nằm trên mặt đá (`rotateX`).
  - Xa: bờ có một đèn đá chưa thắp, dải hồ có đường trăng, núi trong sương.
- **Tương tác:**
  - Chạm (hoặc kéo, hoặc phím số): đá nhấc lên (bóng tách và nhoè, to thêm 8%), bay theo đường parabol tới hốc kế, nhỏ dần theo độ sâu, đáp xuống có vòng gợn cát làm cong vệt cào. `detail` và `why` cào vào cát bên cạnh.
  - Sai thứ tự: hốc hất đá, đá trượt về, `wrongHint` cào ở hốc đó.
  - Mỗi đá đúng: camera tiến một bước (lớp gần trượt nhanh hơn lớp xa). "Kiểm tra quyền & gắn nhãn AI" phải đặt trước viên cuối.
  - Xong: đèn đá thắp, ánh lăn ngược xuống lối từng viên, bóng đèn hiện trên hồ, thẻ `t34-publish-check` nổi như mảnh giấy dưới đèn.
- **Low:** cả lối hiện sẵn; đá hiện ngay ở hốc; vẽ một lần.

**★ `credit` · canvas · 3Q, tĩnh vật bình nguyệt** (thay WebGL)
- **Khung hình:**
  - Camera 3/4, elevation khoảng 20°, hơi thấp để bình trông đồ sộ.
  - Hậu cảnh: vách xưởng tối có ô cửa giấy vuông ở trên trái, trăng trong đó; một tia trăng xiên xuống miệng bình (gradient + bụi tĩnh vẽ sẵn).
  - Bình men rạn (vẽ canvas: shading bake, lưới rạn vẽ một lần), viền trăng, 10 vòng vạch khắc trong cổ bình.
  - Một phần tư phía trước bị cắt kiểu hiện vật bảo tàng, mép đất nung sạch, lộ cột nước sẫm dần theo độ sâu, vòng mặt khum, bóng trăng là một elip sáng.
  - Bình trên ghế ván thấp, bóng tiếp xúc và bóng trăng dài.
  - Tiền cảnh: giá tre có gáo nhỏ và muôi gỗ lớn (models), hai vòng cổ hẹp/rộng (resolutions), giá đồng hồ cát hai ngăn (lengths), chén trà (đầu ra). Thanh tre cạnh cửa ghi bốn mẹo dưới `tipsLabel`.
  - Lớp: vách → lưng bình → nước → môi bình trước → vật tiền cảnh. Thị sai con trỏ ±6°.
- **Tương tác:**
  - **Nhìn xuống cổ bình:** chạm miệng bình, cả chồng lớp `rotateX` 0 → 35°, thấy đĩa nước và bóng trăng chìm trong cổ.
  - Chạm vật hoặc thẻ gỗ trên dây dưới ghế (`modelLabel`/`resLabel`/`lengthLabel`, `aria-pressed`): muôi chọn đưa lên bình, vòng cổ lắp vào miệng, đồng hồ đặt một nhịp (5 giây) hoặc hai (10 giây).
  - "Tạo": muôi nhúng và lên đầy; nặng + 1080p + 10 giây mang khoảng 5 lần nước so với nhẹ + 720p + 5 giây. Rót thành dòng vào chén; mực bình tụt với sóng sánh (elip canvas, chỉ animate khi múc). `cost` hiện như mực trên chén, `jarAria` cập nhật.
  - Mực nước tụt lộ các vòng vạch, bóng trăng chìm sâu và mờ đi: lựa chọn nặng cạn bình sau ba lần múc, lựa chọn nhẹ thì hai mươi lần. Cạn: đáy rạn khô + `empty`.
  - "Đổ đầy lại": tia trăng dày lên rót vào tới miệng. Đổ khi bình còn nửa thì phần thừa tràn qua miệng, chảy xuống ghế, vì bình không bao giờ quá 100 (credit không cộng dồn).
  - Fact, scale, insight có dấu; thẻ `t34-brief`.
- **Low:** không sóng sánh, không thị sai; mực nhảy; tràn là một khung tĩnh.

**`real` · comp/2.5D · EYE chéo từ bờ, cầu vồng khép vòng** (`perspectiveCircle`)
- **Khung hình:**
  - Camera ngang tầm mắt trên bờ, nhìn chéo (không đối xứng như t26 `introspect`). Cây cầu cong taiko-bashi vắt chéo khung; **cầu cùng bóng nước khép thành một vòng tròn** (như vòng ensō).
  - Trên đỉnh cầu là một người mẫu nét mực khăn son (hình của `real.ts`), trăng sau lưng trong sương.
  - Bóng nước của cô là avatar đa giác vẽ bằng thứ mực khác: tam giác nét mảnh thẳng, mặt phẳng.
  - Bốn hòn đá bờ có đèn nhỏ chưa thắp: hai gần to bị cắt mép, hai xa ở hai chân cầu.
- **Tương tác:**
  - Chạm đá (1–4): đèn thắp, vũng ấm trên nước, lời (who + view, dấu, nguồn) viết trên nước như mực phản chiếu.
  - Vuốt ngón tay trên nước (Space khi nước đang focus): gợn lan, chỗ gợn đi qua thì "da" của bóng trượt lộ avatar đa giác. Người trên cầu không đổi.
  - Đủ bốn: nước lặng, một ấn son (chỉ là dấu, không có chữ) trôi xuống đậu lên bóng: avatar nhận ra được dù không gợn (nhãn giúp mọi người thấy cái giả); `common` + detail.
- **Low:** bóng vẽ sẵn với avatar lộ một nửa; chạm chỉ cho một vòng tĩnh.

#### Trạm 35 · II·17

**★ `ladder` · 2.5D · CRANE dọc, năm bậc thềm**
- **Khung hình:**
  - Thế giới cao khoảng ba màn hình, sáu lớp.
  - Tiền cảnh: dương xỉ và mép đá rêu, to, ngoài nét.
  - Năm bậc thềm đá rêu zig-zag leo sườn đồi. Mỗi bậc có một đèn đá chưa thắp và một tiểu cảnh. Giữa các bậc là dải sương; rồi thông và sống núi xa.
  - Trên đỉnh, cửa xưởng sáng qua shōji, trăng trên mái.
  - Camera bắt đầu ở đáy, ngước lên: bậc đầu chiếm một phần ba dưới, bóng đổ xuống dốc.
  - Cuộn "báo cáo tuần" (giấy cuộn dây son) nằm trên bậc một; một sợi chỉ son từ nó chạy tới mép dưới khung (bàn tay người xem).
  - Tên, `what`, `example` của mỗi nấc khắc trên mặt đứng của bậc theo phối cảnh. `scale note` là tấm gỗ nhỏ ở chân thang.
- **Tương tác:**
  - Kéo cuộn lên bậc kế (vuốt lên, ↑/PageDown, hoặc chạm bậc): camera cẩu lên có thị sai (dương xỉ 1.4, bậc 1, đèn 0.9, sương 0.6, thông 0.3, trăng 0.08), đèn bậc thắp, tiểu cảnh chạy:
    - **Prompt:** câu ví dụ tan thành hơi sương: nói một lần rồi mất.
    - **Skill:** cuộn được buộc treo lên móc tre trong hốc đá, có thẻ.
    - **Agent:** một người giấy gấp nhặt cuộn và nhảy qua ba hòn đá, tự chọn đường.
    - **Workflow:** cuộn theo máng tre qua ba cửa, một cửa giữ bằng ấn son chờ bạn.
    - **Hook:** shishi-odoshi đầy từng giọt rồi tự gõ, đồng hồ mực trên cửa chỉ giờ của ví dụ.
  - Sợi chỉ son dài và mảnh dần mỗi bậc: càng lên cao càng ít chạm vào việc, càng khó lái → insight (chọn nấc đơn giản nhất làm được việc).
  - Hai fact là chú thích trên cột đèn Workflow và Hook. ↓ để xuống so sánh.
- **Low:** một tranh dọc tĩnh thu cả năm bậc, không cẩu, tiểu cảnh ở trạng thái cuối.

**`scroll` · 2.5D · EYE nhìn thẳng, giá chín cuộn trên tường**
- **Khung hình:**
  - Camera ngang ngực trước vách gỗ tối của một hốc tường, hơi từ dưới.
  - Một thanh ngang treo chín cuộn trên móc ở ba độ sâu hơi khác nhau (thị sai), có trục, núm tiện, thẻ giấy buộc dây.
  - Chỉ một thẻ đọc được: `fileName` và dòng description của skill mẫu. Tám thẻ kia là nét cọ không đọc được (trang trí, không có chữ mới).
  - Cửa sổ trăng tròn sau trái viền lạnh trên trục. Đèn tay giấy trên que tre (ấm) gần đáy là nguồn ấm duy nhất.
- **Tương tác:**
  - Kéo đèn dọc tường: vũng ấm (mặt nạ toả, bóng cuộn đổ xa đèn) chỉ soi thẻ tên, thân cuộn vẫn đóng. Đúng thứ AI đọc trước: tên và mô tả. Dừng trên thẻ đọc được thì tua đung đưa.
  - "Mở cuộn skill" (chạm hoặc Enter): cuộn đó mở **ngang** như makimono: trục lăn từ phải sang trái dọc tường, độ cong giấy tô bóng gần trục, lộ SKILL.md (`codeScroll`, notes là chữ son ở lề, copy/copied).
  - Một túi vải buộc (references/) treo ở trục, chỉ mở khi chạm.
  - Insight sau khi mở, rồi detail. ←/→ di đèn; cuộn là nút có `codeAria`.
- **Low:** đèn cố định trên thẻ đọc được; mở ngay; không thị sai.

**`moons` · comp/2.5D · 3Q 35°, lối mòn thành đường giữa đồng rêu** (`progressTide`, "Từ thói quen thành chuẩn")
- **Khung hình:**
  - Camera khoảng 35° trên một đồng rêu rộng dưới trăng, chân trời có đồi.
  - Một lối mòn mờ bắt đầu gần camera: một dãy dấu chân đơn lẻ.
  - Dọc lối là sáu cột đá mốc, mặt mỗi cột có một hình mực:
    - cầu nối hai bờ (MCP);
    - lối rẽ đôi (workflow/agent);
    - thước thợ trên bản vẽ (spec trước);
    - cuộn giấy (skills);
    - nhiều cuộn trên một giá (chuẩn mở);
    - đám đông bóng đèn lồng (hôm nay).
  - Xa hơn, lối đi tiếp vào sương (dự báo ○).
- **Tương tác:**
  - Kéo trăng theo cung trời (slider, ←/→/Home/End, `sliderAria`). **Trăng tròn dần:** lưỡi liềm ở MCP, tròn ở "Hôm nay".
  - Qua mỗi mốc: cột đá sáng, date · label · fact (có dấu) viết trên rêu cạnh cột; lối rộng ra và tự lát đá từng đoạn.
  - "Hôm nay": nhiều bóng người cầm đèn đi trên con đường. Insight: từ mẹo riêng của một công cụ thành con đường nhiều công cụ cùng đi.
- **Low:** trăng nhảy theo mốc; trạng thái lối vẽ sẵn.

**`spec` · comp/2.5D · HIGH 55°, bản vẽ dựng thành pop-up** (`stepPath`)
- **Khung hình:**
  - Camera trên bàn thợ, chúc khoảng 55° (CSS perspective khoảng 900px). Đèn treo ở trên giữa đổ vũng ấm và bóng dài; cửa xưởng mở có trăng ở mép trên.
  - Bản vẽ giấy dó (lưới mờ, nét `--ink-3`) nằm phẳng, bốn góc dằn đá. Tám vòng tham chiếu đánh số quanh lề là các hốc.
  - Tiền cảnh: tám viên sỏi dọc mép gần, to, hơi ngoài nét, mỗi viên mang nhãn bước; thước thợ, bút, nghiên. `facts[0]` là ghi chú bút chì ở lề trên.
- **Tương tác:** đặt sỏi đúng thứ tự (1–8), mỗi viên đúng đổi tờ giấy:
  - Bước 1–3 tô mực bản vẽ: phác cảm giác → dấu hỏi bút chì ở lề → khối chữ spec.
  - Bước 4 chia thành ô bằng đường cắt chấm.
  - Bước 5 gấp các ô dựng lên từng cái thành pop-up giấy một xưởng nhỏ và cái ao, đứng 3D trên tờ, có bóng thật.
  - Bước 6 trượt thước thợ vào, đèn lóe như chụp ảnh.
  - Bước 7 gấp thẳng một ô đang nghiêng, có dấu tích son.
  - Bước 8 gấp phẳng cả pop-up, cuộn lại treo lên móc thành một skill (gọi lại scene 2).
  - Kéo chỗ bàn trống để nghiêng bàn (`rotateX` 35–70°, `rotateY` ±20°) nhìn pop-up từ cạnh.
  - Sai: sỏi trượt về, `wrongHint` viết bút chì. Xong: thẻ `t35-skill-from-win`.
- **Low:** góc cố định; trạng thái gấp đổi ngay; bóng là bản xiên tĩnh.

**`line` · 2.5D · 1PT, hành lang đèn lồng**
- **Khung hình:**
  - Hành lang xưởng dài ban đêm: ván sàn và xà trần hội tụ về điểm tụ ở khoảng 55% chiều cao, nơi cửa cuối mở ra vườn trăng.
  - Tám đèn lồng giấy treo trên một sợi dây mực lùi từ gần trái (to, bị cắt) tới xa (nhỏ, gần cửa), mỗi đèn mang tên trạm. Gần thì ấm `--lantern`, xa thì lạnh `--mist`.
  - Tiền cảnh: bàn thấp có bát đá son, bút gác trên nghiên. Nhiệm vụ viết trên tấm biển gỗ trên đèn đầu.
- **Tương tác:**
  - Vẽ một nét mực từ đèn này tới đèn kia (vệt bút theo con trỏ rồi hút thành dây), hoặc chạm theo thứ tự; mỗi đèn nối thì sáng.
  - Kéo đá son từ bát xuống sàn dưới một đèn (`stoneAria`).
  - Dây tới cửa: một con thuyền giấy sáng (`--firefly`) chạy dọc dây vào chiều sâu. Tới mỗi đá đỏ nó dừng và nhấp nháy, chờ người xem chạm đá để duyệt: người xem là người trong vòng.
    - Trạm cần người mà không có đá: ánh sáng lao qua, tới "Lên lịch đăng" thì bắn ra cửa vào đêm, không kéo lại được (`missingStone`).
    - Đá thừa: thuyền chờ vô ích (`extraStone`).
  - Đủ ba đá đúng: `done` + insight; fact ở khung cửa.
  - Bàn phím: đèn và đá là nút theo thứ tự; Enter nối, S đặt/bỏ đá.
- **Low:** không thuyền chạy; đèn sáng theo thứ tự bằng class; tranh vẽ một lần.

#### Trạm 36 · II·18

**`blueprint` · 2.5D · EYE 15°, lăng trụ đèn sáu mặt chiếu bóng game**
- **Khung hình:**
  - Phòng vẽ tối. Một đèn andon giấy sáu mặt ở giữa bàn, camera khoảng 15° trên.
  - Sáu mặt là sáu face CSS 3D thật (`rotateY` từng 60°, `translateZ`), sáng từ trong (`--lantern`): giấy lộ sợi, khung gỗ đổ nan mảnh.
  - Mỗi mặt là một mảnh spec: label ở trên, hai dải giấy (hai lựa chọn) treo dưới.
  - Đèn chiếu một bức tranh bóng của game lên vách sau và mặt bàn (cá koi, vành hồ, mảnh trăng rơi hoặc đom đóm). Lúc đầu bạc nhoè.
  - Tiền cảnh: spec.md (`specTitle`) nằm trên bàn, sáu dòng điền dần.
- **Tương tác:**
  - Kéo ngang xoay đèn (quán tính, bắt vào mặt; ←/→). Chạm một dải ở mặt trước: dải dán lên mặt, giấy nhận hoạ tiết mực của lựa chọn, tranh chiếu ở cung đó nét lại (crossfade các mức nhoè vẽ sẵn), dòng hiện trong spec.md.
  - Chọn lựa chọn kia thì tranh chiếu đổi (mảnh trăng ↔ đom đóm, đêm mực ↔ giấy màu nước).
  - Đủ sáu: tranh trên vách sắc nét, cả game hiện ra trước khi có dòng code nào. Insight + detail + thẻ `t36-spec`.
  - Lựa chọn là nút (`pieceAria`).
- **Low:** không xoay tự do; sáu nút số xoay thẳng tới mặt; mỗi cung hai trạng thái chiếu.

**★ `pens` · 3D · ORBIT trong khung tranh** (`createStage` trực tiếp + lớp `Koi` của t09)
- **Khung hình:**
  - Nhìn thẳng ngang tầm. Một khung gỗ trên giá vẽ chứa hồ koi nhìn từ trên: chậu đá tròn (lathe), nước, lá súng, mảnh trăng, và cá koi 3D của t09 (`koiGeometry`, LOD thấp) bơi vòng chậm.
  - **Canvas WebGL chỉ phủ trong khung** (khoảng 55% diện tích khung hình), nên ít điểm ảnh phải tô hơn.
  - Tiền cảnh trái (màn dọc: ở dưới): ống bút tre cắm năm bút khác nhau (than, bút ướt, bút dẹt, bút kim, bút to). Bút được chọn có ống giấy ghi name, fits, ask, link docs.
  - Hậu cảnh: vách xưởng và đèn.
- **Năm bút, mỗi bút một chế độ shader có sẵn của koi:**
  - **Canvas 2D:** nét mực phẳng không sáng, nhìn trực giao từ trên (`uSketch`; camera xa với fov 10, gần như orthographic).
  - **p5.js:** loang màu nước và hạt nét sinh ngẫu nhiên quanh cá (`uPaint`).
  - **Phaser:** lưới sprite bắt lên hồ, cá thành sprite phẳng, cá và mảnh trăng có vòng hitbox son mảnh.
  - **Three.js:** ánh trăng, bóng cá trên đáy chậu, nước phản chiếu, **khung mở thành cửa sổ**.
  - **Godot/Unity:** camera lùi tới khi chậu chỉ là một phần nhỏ của một vườn lớn, khung biến thành viền điện thoại và PC.
- **Tương tác:**
  - Chạm bút (1–5; `penAria`): một nét cọ quét qua khung (mặt nạ màn hình), để lại hồ vẽ bằng chất liệu đó.
  - Kéo trong khung: với Canvas 2D, p5.js, Phaser thì chỉ **trượt một tấm tranh phẳng**; với Three.js thì cùng cử chỉ đó **xoay hồ trong 3D thật**, cá quay trong ánh sáng. Khác biệt cảm bằng tay là quy tắc ngón tay cái.
  - Insight sau khi đã thử một bút phẳng rồi bút 3D. Ở chế độ Phaser, hitbox loé khi cá chạm mảnh trăng.
- **Low:** mỗi bút render một lần theo yêu cầu; không nét quét, không bơi; chỉ chế độ Three.js render khi kéo. Không có WebGL: năm bức SVG hiện có (`pens.ts`) đổi sau một lớp giấy mờ.

**`carve` · canvas · SIL ngang mặt bàn, ngược sáng khung cửa**
- **Khung hình:**
  - Nhìn ngang ở độ cao mặt bàn. Khối gỗ bách trên giá chạm ở giữa phải, **in bóng lên khung cửa xưởng mở ra hồ trăng**: viền ngược sáng vẽ đường bao của từng giai đoạn. Đèn làm việc ấm từ trên trái soi mặt gần.
  - Bảy giai đoạn là bảy bức canvas bake bằng `sliced`: phấn vạch trên khối → khối cắt thành dáng thô → cá đẽo thô (vết đục) → đuôi chẻ → vây → vảy nổi → mắt.
  - Bảy viên đá bước có nhãn nằm **thành hàng** dọc mép trước bàn (không chồng).
  - Tiền cảnh: `codeScroll` nằm dọc mép bàn như cuộn thư pháp đóng (`fileName`).
- **Tương tác:**
  - Chạm viên kế (1–7) để đặt vào hàng.
    - Đúng: tiếng vồ gõ, một chùm phoi gỗ (≤ 60 hạt canvas, chỉ trong lúc bắn), bản khắc tiến một giai đoạn (crossfade).
    - Sai: viên đá trượt về, `wrongHint` viết phấn trên giá.
  - Chạm viên đã đặt: `promptLabel` + `prompts[i]` khắc trên mặt đá (mỗi viên là một checkpoint git quay lại được).
  - Kéo đèn: ánh ấm quét mặt gần (trộn hai trạng thái sáng vẽ sẵn theo góc), vết đục và vảy nổi lên.
  - Chạm cuộn trên bàn để mở code. Xong: thẻ `t36-scaffold`.
- **Low:** không phoi, đèn cố định, đặt ngay. Fallback cũ: bảy giai đoạn SVG (`carve.ts`) vẫn dùng được.

**`layers` · 2.5D · trục đo, chồng giấy tách lớp → game**
- **Khung hình:**
  - Gần trục đo: elevation 35°, azimuth 30°.
  - Một chậu đá tròn rỗng nổi trong tối trên bóng tiếp xúc mềm. Phía trên là bảy tờ giấy can (mép xé mềm, hơi phát sáng) xếp tách lớp trong CSS 3D (`preserve-3d`, cách đều theo Z). Mỗi tờ mang nội dung SVG/canvas của lớp:
    1. nước;
    2. cá koi;
    3. vệt bàn tay dẫn (điều khiển);
    4. mảnh trăng và lá khô rơi;
    5. ấn điểm và ba trái tim;
    6. âm thanh là các vòng sóng đồng tâm;
    7. đom đóm và vòng gợn (fx).
  - Mép trước mỗi tờ ghi "Lớp {n}: {name}". Trăng viền từ trên sau, ánh ấm từ trước trái. Tờ càng cao càng mờ (opacity theo Z).
- **Tương tác:**
  - Kéo xoay chồng giấy ±40°.
  - Chạm tờ đang sáng kế tiếp (1–7): tờ hạ xuống nhập vào chậu (`translateZ`) có gợn; prompt (`promptLabel`) viết quanh vành chậu, nên sau bảy tờ vành chậu chứa cả lịch sử prompt.
  - Mỗi lần nhập, hồ sống thêm: nước động, cá bơi, cá theo con trỏ, trăng rơi, ấn đếm, vòng âm, đom đóm.
  - Sau tờ thứ bảy, camera hạ xuống 3/4 thấp, "Chơi thử 30 giây" chạy game **Canvas 2D** (mặc định của spec) trong chậu. Kết thúc là ensō với end/endAria, again, sound/mute, pause/resume; thẻ `t36-pack`.
- **Low:** chồng giấy tách sẵn và tĩnh, tờ hạ ngay; game theo spec (reduced = chế độ "still").

**`vibe` · comp/canvas · HIGH 60°, lấy nét giữa mặt nước và đáy** (`perspectiveCircle`)
- **Khung hình:**
  - Nhìn chúc khoảng 60° vào một hồ sâu trong.
  - Mặt nước: game koi đang chơi (cá, mảnh trăng, vòng gợn, bóng trăng).
  - Đáy (sâu, tối, khúc xạ): mã nguồn game (`carve.code` cùng JSON) viết mực trên các phiến đá phẳng, gợn theo khúc xạ, caustic trôi trên đó.
  - **Tiền cảnh:** năm hòn đá có nến xếp thành cung dọc mép gần, to, bị cắt, ngoài nét. Đây là chữ ký bố cục của scene, khác các cảnh nhìn xuống hồ khác.
  - Ánh trăng từ trên phải trên mặt nước; nến thắp thì có vũng ấm; đáy chỉ có caustic.
- **Tương tác:**
  - Chạm đá (1–5): nến thắp, lời (who + view) hiện như bóng chữ trên nước. Mỗi hòn đá đặt lại nước:
    - Karpathy: tiêu cự ở mặt, đáy sương mờ;
    - Willison: tiêu cự xuống đáy, đọc được code;
    - Veracode: khoảng nửa dòng ở đáy có vết nứt son (◇, claimBy);
    - Collins: một đèn giấy nhỏ có ấn son trôi lên mặt;
    - Newcomer: hàng rào tre mọc quanh chỗ nông thành hồ tập.
  - Kéo dọc trên nước để tự dời tiêu cự (crossfade giữa hai canvas nhoè vẽ sẵn).
  - Đủ năm: nước lặng, một ensō hiện, `common` (đọc kỹ code khi dính tiền hoặc dữ liệu), rồi detail.
- **Low:** hai trạng thái tiêu cự crossfade; không caustic.

---

### Vườn 13 · Ngã rẽ dưới trăng · trăng lặn → bình minh

Ánh sáng tiến dần qua ba trạm:
- t37 đêm sâu, trăng lặn phía tây;
- t38 trước bình minh, trăng chạm chân trời, `--dawn` lên ở đông;
- t39 mặt trời mọc, nắng sượt.

Sương dày, lối chia ngả.

#### Trạm 37 · II·19

**`goal` · 2.5D · sân khấu nghiêng, thấp ngang đầu người giấy**
- **Khung hình:** sân khấu proscenium nhìn ngang hơi chếch từ trái, bốn lớp.
  - **L0:** cành phong chĩa vào góc trên trái, lá son nhoè sẵn, vài lá trên đá bước dưới trái.
  - **L1:** lối đá cong tới đèn đá. Người làm vườn giấy là các mặt gấp: mặt sáng ấm phía đèn, mặt tối lạnh phía trăng. Ba thẻ ema treo dây dưới cành thấp, mỗi thẻ một câu lệnh (`options.say`), đủ rộng cho câu dài nhất.
  - **L2:** gốc phong lớn, người làm vườn ngủ gật trong quầng đèn, ao nhỏ in trăng.
  - **L3:** sương, núi xa, trăng tây cao vừa.
  - Bóng phong dài xiên trên cát bạc. Màn dọc: ba ema treo thành chuỗi dọc ở nửa dưới phải.
- **Tương tác:**
  - Kéo một ema thả vào vạt áo người giấy (hoặc chạm/Enter; `optionAria`). Người giấy đọc, cúi chào, rồi đêm trôi qua trong 2,2 s: trăng trượt xuống, bóng phong quét qua cát, đèn tàn, trời ngả `--dawn`, "Sáng hôm sau" viết trên trời.
  - Kết quả hiện **trong vườn**:
    - `loose`: cây phong đổ, gốc trơ có vân năm, nửa trên khung trống trơn, một lá cuối trôi vào bóng trăng.
    - `better`: lối sạch nhưng rêu bị cạo thành dải đất nâu, rêu cuộn trong giỏ.
    - `best`: vườn nguyên vẹn, người giấy đứng ở cửa nhà người làm vườn nâng một hòn đá, cửa sổ sáng: nó hỏi trước.
  - `result` chỉ là chú thích dưới tranh. Cành khô cắm cạnh lối là nút `retry`: chạm thì thời gian tua ngược.
  - Detail: bình phong gấp sau người ngủ hiện hai tranh nhỏ không chữ (khối đỏ lật ngửa trên khối xanh; con thuyền chạy vòng tròn).
  - Thị sai 4 lớp ±12/±6/±3/±1 px.
- **Low:** 4 lớp tĩnh; chọn ema thì crossfade 200 ms sang tranh "sáng hôm sau".

**`lab` · 2.5D · đi vòng góc trà thất (CSS 3D)**
- **Khung hình:**
  - Góc trà thất là hai mặt vuông góc + mái + nền (`preserve-3d`, perspective khoảng 1100px).
  - **Mặt trước:** vách shōji lưới kumiko 10×10 sáng ấm từ trong, in bóng người làm vườn giấy ngồi thẳng trước bàn thử.
  - **Mặt hông:** mở ra vườn tối, lối đá rẽ hai ngả. Trăng thấp sau nhà đổ **bóng thứ hai** của nó dài trên rêu.
  - Ba cách thử là vật trong cảnh:
    - evals: chồng giấy trên bàn;
    - đội đỏ: bóng áo son đang cạy một ô giấy;
    - bên thứ ba: người cầm đèn ở cổng.
  - Ví dụ Astra là hộp gỗ niêm băng giấy son trên hiên. Công tắc là đèn lồng chōchin dưới mái.
- **Tương tác:**
  - Kéo ngang đi vòng góc nhà (yaw 0 → 70°, quán tính; ←/→). Mặt trước chỉ thấy bóng ngoan; sang mặt hông mới thấy bóng dưới trăng.
  - Chạm đèn (`role=switch`, toggle/on/off): đèn tắt thì bóng ngoài vườn tách khỏi lối chính rẽ sang lối khác, câu watched/unwatched đổi; bóng trên vách vẫn ngay ngắn.
  - Khi detail mở, lưới kumiko thành biểu đồ ô: đèn sáng thì 12 ô loang mực, đèn tắt thì 3 ô. Số liệu nằm trong kiến trúc.
  - Chạm chồng giấy, bóng đỏ hoặc người cầm đèn để xem name + what; chạm hộp niêm để xem `exampleLabel` + `example`.
- **Low:** yaw 35° cố định (thấy cả hai mặt); hai bóng đổi ngay.

**★ `fence` · 3D · ORBIT, sáu vòng rào tre** (`inkStage`)
- **Khung hình:**
  - Camera fov 30, nghiêng 32° (màn dọc 48° và lùi xa cho sáu vòng vừa bề ngang); quỹ đạo yaw 360°, pitch 18–62°. `k.backdrop` với sương, núi, trăng tây.
  - Giữa là cây non trên gò rêu (`k.rock` thấp, moss 0.9) có quầng `--glow-moss`.
  - Quanh nó tối đa sáu vòng rào yotsume-gaki:
    - cọc tre là InstancedMesh với `k.ink('bamboo')` (đốt là dải sáng, viền trăng);
    - mỗi vòng có hai thanh ngang buộc dây, **thủng 3 khoảng ở các góc khác nhau**;
    - vành bóng mực mềm dưới mỗi vòng là decal bake, không dùng shadow map.
  - Nền: `k.ground`, cát cào vòng tan vào sương.
  - Mép gần: sáu bó tre buộc rơm chờ trên cát; bó kế tiếp viền ấm `--lantern`.
  - 20 đom đóm son (Points, cộng sáng) bay từ bóng tối vào:
    - con bị chặn đập vào thanh tre, loé, rồi lơ lửng ngay ngoài vòng đã bắt nó;
    - con lọt tới cây để lại chấm đỏ trên lá.
    - Số lọt bám đúng bảng LEAK [20,11,6,4,2,1,1]: con thứ i bị vòng j bắt khi LEAK[j] ≤ i < LEAK[j−1].
  - Tên lớp + what + fact + seeStation là thẻ giấy treo ở cọc cao nhất của vòng (`k.label`). Màn dọc: thẻ nằm trong panel dưới.
- **Tương tác:**
  - Chạm bó tre đang sáng (`addAria`, Enter): cọc mọc lên từ cát quanh vòng, thanh ngang buộc vào, count/leak đổi.
  - Kéo để đi vòng quanh vườn; ←/→ xoay 15°.
  - **Khoảnh khắc "à":** ở góc mà lỗ của mọi vòng đã dựng thẳng hàng với cây, một sợi chỉ đỏ hiện từ mép tới cây.
    - Với một vòng, đường thẳng hàng xuất hiện ở nhiều hướng.
    - Với sáu vòng, phải dò mãi mới thấy một khe hẹp còn sót (góc khe gieo sao cho đúng một khe sống qua cả sáu lớp, khớp LEAK cuối = 1).
  - Cái cào ở mép cát là nút reset: rào lún xuống cát.
- **Low:** render theo yêu cầu, không đom đóm bay (đặt sẵn ở vị trí cuối), cọc hiện không nảy. Không có WebGL: tranh SVG 3/4 hiện có, nâng khối (cọc có mặt sáng/tối, vành bóng, đom đóm là chấm tĩnh, sợi chỉ đỏ cố định qua khe còn sót). Tranh này cũng là poster lúc mount.

**`views` · comp/2.5D · CYL, quay người giữa hồ rồi thành "hành tinh nhỏ"** (`perspectiveCircle`)
- **Khung hình:**
  - Máy quay trên một hòn đá giữa hồ, ngang mặt nước, thấy khoảng 110° (dọc khoảng 70°). Bốn góc phần tư là bốn chân trời; mỗi góc có hòn đá nói đứng trong nước gần máy, có bóng phản chiếu:
    - **Bắc (CAIS):** cột mây giông khổng lồ nhưng rất xa, chớp nhỏ.
    - **Đông (DAIR):** khói làng ngay bờ bên kia, nhỏ mà gần, cửa sổ ấm.
    - **Nam (Andreessen):** ráng bình minh rực sắp bùng.
    - **Tây (Narayanan & Kapoor):** lối mòn men bờ vào đồng ruộng bình thường.
  - Xa/gần và to/nhỏ của chân trời chính là câu "rủi ro nào gần, nào lớn".
  - Mỗi góc 4 lớp thị sai. Cột trăng vỡ trên nước luôn kéo về hướng đang nhìn.
- **Tương tác:**
  - Kéo ngang để xoay người (quán tính), chạm đá để quay tới, ←/→ và 1–4 (`stoneAria`).
  - Đối diện một đá khoảng 0,6 s là đang "lắng nghe": đá sáng viền, cột trăng nghiêng về nó, who + view + dấu hiện.
  - Đủ bốn: máy quay ngửa lên lùi xa, toàn cảnh cuộn thành "hành tinh nhỏ" tròn, bốn chân trời cùng ôm một mặt hồ; `common` ở tâm, rồi insight + detail (lúc detail hiện, cột mây Bắc nhoè đi).
- **Low:** hiện thẳng "hành tinh nhỏ" tĩnh với bốn đá chạm được.

#### Trạm 38 · II·20

**`defs` · comp/2.5D · MACRO, hàng bốn vật đựng nước trên hiên** (`perspectiveCircle`, bỏ giếng)
- **Khung hình:**
  - Camera thấp sát mép hiên gỗ trước bình minh. Bốn vật đựng nước xếp hàng dọc mép hiên, lùi xa (gần to, xa nhỏ): chén trà men ngọc, chậu đồng, ống tre hứng nước, chậu đá tsukubai. Trước mỗi vật là một phiến đá nhỏ khắc tên (who).
  - Trăng thấp sắp lặn sau trái; hừng đông lên ở chân trời phải. Vườn sau chìm trong bốn lớp sương.
- **Tương tác:**
  - Chạm phiến đá (1–4; `stoneAria`): nước rót vào vật đó, sóng sánh rồi lặng, và **bóng trăng trong nước thành hình của định nghĩa**:
    1. đồng xu lỗ vuông (thước đo bằng công việc kinh tế);
    2. bậc thang (các cấp độ);
    3. bánh xe mười nan, mực tô theo nan tới 27% rồi loang tới 57% (biểu đồ radar trong mặt nước);
    4. con dấu hội đồng son.
  - who + view + dấu hiện cạnh vật. Mỗi định nghĩa làm tan một lớp sương trong vườn.
  - Đủ bốn: bốn bóng của **cùng một vầng trăng**; `common`.
- **Low:** trạng thái tĩnh; bánh xe vẽ sẵn mức 57% kèm vệt mờ 27%.

**`tide` · comp/canvas · EYE, cuộn cát ngang, đồng hồ bóng trăng** (`progressTide`, "Sợi dây đo công việc")
- **Khung hình:**
  - Máy quay ngang, hơi nhìn xuống một cuộn cát cào dài nằm ngang khung. Mép gần ở dưới, mép xa lùi vào sương.
  - Gần bên phải là cây sào tre cắm trên cát làm kim đồng hồ. Trăng là slider, đi theo cung từ trên giữa xuống chân trời phải (tây). Bóng sào đổ sang trái về phía rạng đông (đầu trái `--dawn`).
  - Trên cát có sợi dây thước tre, khấc cách đều theo mỗi lần gấp đôi. Chỉ hai khấc có chữ: `compare.before` "≈ 1 giờ" và `compare.after` "≥ 16 giờ". Quá khấc 16 giờ, dây sờn rồi đứt.
  - Màn dọc: cuộn cát thành đường chéo từ dưới phải lên trên trái.
- **Tương tác:**
  - Kéo trăng (slider của component, ←/→/Home/End). Mốc có độ dài: đầu bóng chạm khấc, để lại cọc nhỏ. Mốc không có độ dài (IMO, Navier–Stokes): một hòn đá nổi cạnh sào.
  - Ở 03/2026: đầu bóng nhoè thành vùng nửa tối 8,5–55 giờ (khoảng tin cậy). Bóng 03/2025 để lại vệt mờ để so (ratio 16 là hai cái bóng).
  - "Hôm nay": trăng chạm chân trời, bóng chạy mãi vào sương rạng đông, dự báo (○) mờ.
  - Vì bóng = cao × cot(góc trăng), đoạn cuối trăng càng thấp bóng càng vọt: người xem cảm luỹ thừa bằng vật lý.
  - Insight "1 giờ lên ít nhất 16 giờ"; detail là mẩu giấy buộc đầu dây.
  - Bóng vẽ trên canvas riêng, chỉ vẽ lại khi trăng di chuyển.
- **Low:** slider nhảy theo mốc, mỗi mốc là một khung tĩnh.

**★ `fork` · canvas · 3Q 25°, sa bàn ba ngả** (thay WebGL)
- **Khung hình:**
  - Máy quay đứng ở ngã ba lối đá, nghiêng 25°, nhìn dọc lối giữa vào sương. Ba nhánh lối tách trái/giữa/phải rồi cùng dẫn tới một khay địa hình (bonseki) trên bệ đá dưới trăng sắp lặn, chân trời sau khay ửng `--dawn`.
  - Khay vẽ trên canvas từ bốn bộ đặc điểm bake sẵn (`sliced`), trộn theo ba cần:
    - đường đồng mức ruộng bậc thang;
    - rừng hoang (sprite thông, số và chiều cao ∝ tốc độ);
    - vòng tường đá (dải elip đùn, độ cao ∝ kiểm soát);
    - cổng mở và đồi thoải của vườn chung.
  - 40 chấm đèn lồng nội suy giữa vị trí rải đều và vị trí dồn trong tường ∝ chia sẻ. Ba dải sương trôi ngang ba nhánh lối (ba mục `mists`).
  - Tên kịch bản và `text` hiện như nét cọ lơ lửng trên khay. Note "mô phỏng để suy nghĩ" viết trên cọc gỗ cạnh khay kèm nhãn Minh hoạ.
  - Màn dọc: khay ở nửa trên, ba cần xếp hàng ở đáy.
- **Tương tác:**
  - Ba cần kéo nước hanetsurube ở ba miệng nhánh: tốc độ / chia sẻ / kiểm soát. Kéo đầu gàu đặt 0–100: sào xoay, đá đối trọng lắc, khay vẽ lại **ngay khi có input** (gom vào rAF, không có vòng frame khi đứng yên).
  - Mỗi cần là SVG/DOM `role=slider` (`sliderAria`, nhãn low/high ở hai đầu sào), Tab + ↑/↓.
  - Chạm một dải sương: sương rẽ ra, who + view (○ / ◐) trên dải giấy.
  - Thị sai ba lớp ±8 px. Buông tay thì khu vườn đứng yên: kịch bản là công cụ để nghĩ, ba cần do người chọn.
- **Low:** tranh SVG ngã ba hiện có, năm khu vườn vẽ sẵn crossfade theo kịch bản; cần vẫn là slider đầy đủ phím.

**`trays` · 2.5D · LOW sát sàn hiên, ba khay lùi theo đường chéo**
- **Khung hình:**
  - Máy quay sát sàn hiên, ván chạy chéo từ dưới trái lên trên phải.
  - Dưới trái là giỏ mây to bị mép cắt, chứa tám viên sỏi khắc tên việc (nút HTML có khối).
  - Ba khay đá lùi dần theo đường chéo:
    - "AI đang làm tốt": gần nhất, trên mép hiên, nắng ấm đầu tiên;
    - "AI đang học": giữa, sát mép nước, ngập nửa, có phản chiếu;
    - "Còn xa": xa nhất, trong bức sương dày dưới trăng lặn.
  - Trên cùng khung là mép rèm tre sudare đang buông.
  - Màn dọc: đường chéo thành lùi thẳng đứng.
- **Tương tác:**
  - Kéo một viên rồi ném: viên bay parabol, nhỏ dần theo độ sâu, rơi vào khay nơi thả tay. Khay gần thì "cạch" tung bụi; khay nước thì "tõm" có vòng gợn; khay sương nuốt viên sỏi chỉ còn quầng.
  - Bàn phím: Tab chọn sỏi rồi 1/2/3 (`keys`, `pickAria`).
  - Đủ tám: kéo rèm tre lên (nút compare). Nắng tràn qua ba khay, chỗ chuyên gia đặt hiện thành vết lõm mờ. Viên lệch lăn theo đường chấm về vết lõm của nó; chạm để đọc `why`. `match` n/total và `expertNote` (◐) trên mép khay.
  - Tia nắng đầu chạm khay sương xa nhất ("gu", "chịu trách nhiệm") rồi insight; detail và jobs WEF (○) sau.
- **Low:** chọn sỏi rồi chọn khay, đặt ngay; rèm mở thì vết lõm và đường chấm hiện tĩnh.

#### Trạm 39 · II·21

**`ask` · 2.5D · TOP 82°, khung trượt theo lối đá qua hồ rạng đông**
- **Khung hình:**
  - Gần như nhìn thẳng xuống mặt hồ có chiều sâu: lớp đáy (sỏi, hai bóng koi lượn chậm) dịch ít nhất, lớp mặt (đá, lá, gợn) dịch nhiều nhất.
  - Trời phản chiếu trên nước: góc trên phải ửng `--dawn`, góc dưới trái còn vệt trăng lặn.
  - Chuỗi bốn đá bước chạy chéo từ bờ gần (dưới trái) sang bờ xa (trên phải), cuối lối có đèn đá chưa thắp.
  - **Khác t23 `bridge`:** khung **trượt theo lối**, bố cục chéo, không có vành tròn.
  - Đá hiện tại to giữa khung, câu hỏi (`q`) viết trên mặt đá phẳng. Quanh đá, đáp án nổi thành lá sen có chữ: sáu lá xếp lục giác cho câu vai trò, ba lá vòng cung cho câu khác. Bóng lá đổ mềm xuống đáy, lệch theo độ sâu.
  - Biển gỗ ở bờ gần mang câu `privacy`.
- **Tương tác:**
  - Chạm lá sen (`optionAria`, phím số, Tab): lá trôi áp vào đá, vòng gợn lan, đá kế trồi lên khỏi nước (nước chảy khỏi mép), khung trượt theo lối. "Câu n/4" khắc ở mép đá.
  - Đủ bốn: khung lùi xa thấy cả lối, đèn bờ xa thắp, vệt ấm trên nước, insight.
  - Chạm lại đá cũ để đổi câu trả lời. Câu trả lời chỉ lưu `localStorage`.
- **Low:** không thị sai, koi đứng yên, khung nhảy thẳng.

**`kit` · 2.5D · MACRO 35°, giỏ mây dưới tia nắng đầu**
- **Khung hình:**
  - Bàn gỗ ngoài hiên, nhìn chúc 35°, rất gần. Giỏ mây có nắp chiếm khoảng 60% bề ngang, sương đọng thành hạt sáng trên nan.
  - Mặt trời vừa lên thấp bên phải, mọi vật đổ bóng dài sang trái. Hậu cảnh nhoè: thông, sương, trăng lưỡi liềm sắp tan.
  - Năm đồ nghề là năm vật có khối:
    - bút lông (trợ lý chat);
    - hộp màu có thỏi mực và bánh màu son (ảnh & video);
    - đèn dầu nhỏ tự cháy (AI chạy trên máy);
    - cái bào gỗ có phoi (agent lập trình);
    - cuộn giấy buộc dây (skill & workflow).
  - Thẻ giấy buộc quai ghi note thiết bị, note ngân sách, `priceNote`.
  - Lớp CSS 3D: thành sau giỏ, đồ nghề, thành trước + nắp, mặt bàn, hậu cảnh.
- **Tương tác:**
  - Kéo nắp lên hoặc chạm (`open`): nắp xoay quanh bản lề, từng món nổi vào giỏ theo `rules`; món không hợp nằm ngoài, trên bàn, mờ như bóng trăng.
  - Rê chuột hoặc nghiêng máy làm giỏ nghiêng ±12°.
  - Chạm một món: món nhấc khỏi giỏ về phía người xem, bóng tụt xa và nhoè. Thẻ hiện name + what + ví dụ (≥ 2, "Ví dụ, không xếp hạng", mỗi ví dụ là thẻ gỗ có link "Trang chính thức") + các viên đá "Trạm n" bấm được.
  - Chưa trả lời bên hồ thì giỏ đóng, thẻ quai ghi `empty`.
- **Low:** giỏ mở sẵn; chạm món chỉ đổi viền sáng và hiện thẻ.

**`path` · comp/2.5D · 1PT ngược sáng, leo dốc đón mặt trời** (`stepPath`)
- **Khung hình:**
  - Máy quay ở bậc hiên, ngang tầm mắt. Dốc rêu đi lên tới cổng vườn gỗ trên đường chân trời; mặt trời ngay dưới chân trời sau cổng, trăng mỏng ở trên trái.
  - Bốn hốc trống dọc lối, hốc sau cao hơn và nhỏ hơn. Tiền cảnh: bốn viên đá tuần lộn xộn trên sàn hiên, to, nhãn khắc và số.
  - **Cảnh ngược sáng duy nhất của vườn:** đá có viền sáng, bóng đổ về phía người xem.
  - Màn dọc: dốc dài hơn, cổng ở đỉnh khung.
- **Tương tác:**
  - Kéo một viên lên lối (hoặc chạm đá rồi chạm hốc, hoặc 1–4 theo `keys`): đá nhỏ dần khi bay lên, đặt xuống hốc có bụi.
  - Sai: đá lảo đảo, trượt dốc về đống, `wrong` + `why` viết bằng rêu cạnh hốc.
  - Đủ bốn: mặt trời vượt khỏi cổng, một tia nắng chạy dọc lối từ cổng xuống hiên đánh thức từng viên (rêu `--glow-moss`, chữ ánh `--lantern`), `done`. Mỗi viên kẹp thẻ tuần (`weekCards`); thẻ 30 ngày mở ở cổng.
- **Low:** đặt ngay; tia sáng vẽ tĩnh, các đá sáng cùng lúc.

**`advice` · comp/canvas · GRAZE sát mặt rêu, chiếc lá giữa ba đèn** (`perspectiveCircle`)
- **Khung hình:**
  - Máy quay cao vài phân trên mặt rêu, độ sâu trường ảnh nông: rêu tiền cảnh to và nhoè ở đáy. Một vũng nước mưa làm gương ở giữa.
  - Ba đèn đá quanh vũng: trái-gần to bị khung cắt, phải-giữa, giữa-xa. Đèn nào cũng còn cháy, soi một nêm sáng trên mặt nước.
  - Lá phong son nổi giữa vũng như thuyền. Vũng soi trời `--dawn`, đèn đang nhạt dần.
  - Lá có ba bóng mềm toả theo ba nguồn sáng, vẽ trên canvas riêng, chỉ vẽ lại khi lá di chuyển.
  - Màn dọc: ba đèn thành tam giác đứng.
- **Tương tác:**
  - Người xem tự lái chiếc lá (kéo lá; hoặc 1–3 / chạm đèn để lá trôi về đó). Lá gần đèn nào thì bóng của đèn đó ngắn và đậm lại, đèn sáng hơn, who + view + dấu hiện.
  - Thăm đủ ba rồi thả lá ở giữa: ba bóng đều nhau toả hình sao, lá đứng yên, `common`.
  - Đèn không bao giờ tự kéo lá: insight "bạn vẫn cầm lái" đến từ chính cử chỉ.
- **Low:** chạm đèn thì lá đặt ngay cạnh đèn đó, ba bóng tĩnh.

**★ `enso` · 2.5D · CRANE, cẩu CSS 3D trên mặt cát** (thay WebGL)
- **Khung hình:**
  - Nền trời SVG: mặt trời mọc `--lantern`/`--dawn`, trăng lưỡi liềm tan dần ở trên trái.
  - Mặt cát là một canvas (cát cào bake với **nắng sượt** lúc mount bằng `sliced`: từng gợn hắt bóng dài) nằm trên một mặt phẳng CSS 3D, perspective khoảng 700px. Mở cảnh: `rotateX` 82°, sát mặt cát, cát gần chiếm đáy khung.
  - Nét ensō vẽ trực tiếp vào một canvas phủ cùng mặt phẳng: lõi ướt `--ink` đậm, mép khô xơ theo nhiễu, độ khô theo tốc độ tay.
  - Trong vòng có 21 vị trí trạm Vườn Trăng xếp xoắn theo góc vàng:
    - trạm đã ghé: sprite đá có khối (`stoneArt`, viền trăng, vài viên đội rêu), đứng dựng như billboard (xoay ngược trong lúc cẩu), qua 50° thì đổi sang sprite nhìn từ trên;
    - trạm chưa ghé: vòng cát cào lõm, bake sẵn trong canvas cát, như một lời mời.
  - Ở miệng hở của ensō: con dấu đá son và bọc vải furoshiki, là hai lối ra. Các dòng visited/visitedAll/copied viết trên tờ giấy cạnh con dấu.
  - Màn dọc: vòng ở giữa, mặt phẳng nghiêng cao hơn để vòng vừa bề ngang 375.
- **Tương tác:**
  - Vẽ một vòng bằng một nét kéo bất kỳ (hoặc Enter trên `draw`/`drawAria` để tự vẽ). Đủ khoảng 330° là khép (để hở như ensō thật).
  - Nắng bừng, **cẩu lên**: mặt phẳng `rotateX` 82° → 12° trong 3 s (chỉ transform), đá trồi lần lượt theo thứ tự trạm. Người xem thấy chính những hòn đá mình đã đi qua thành khu vườn riêng.
  - Chạm con dấu: ấn xuống giấy rồi mở bài thi (`exam`/`examAria`). Chạm bọc vải: mở Túi đồ nghề (`toolkit`/`toolkitAria`).
  - Cẩu xong có thể kéo xoay khu vườn ±20° (`rotateZ`).
- **Low:** tranh SVG ensō hiện có nhìn từ trên; vòng hiện bằng mặt nạ nét chạy. Reduced: dựng thẳng khung cuối từ trên xuống, không cẩu.

---

## 5. Rào hiệu năng cho 7 hero WebGL

### 5.1 Luật chung (mọi hero)

- **Context:** đúng một `createStage` sống (qua `inkStage`, riêng `pens` gọi trực tiếp). Dọn khi unmount (`forceContextLoss`); dispose geometry, material, texture.
- **Shader:**
  - Biên dịch bất đồng bộ một lần trước frame đầu.
  - **Không thêm hay bớt light của THREE sau khi đã biên dịch**, vì việc đó làm biên dịch lại. Ánh đèn ấm dùng ô uniform lantern của toolkit (tối đa 4), bật tắt bằng cường độ.
- **Cấm dùng:** shadow map, EffectComposer/post-processing, `MeshStandardMaterial`/`MeshPhysicalMaterial` (dùng `k.ink` hoặc shader riêng).
- **Draw call:** ≤ 60 ở high, ≤ 35 ở low.
  - Vật lặp dùng InstancedMesh hoặc Points.
  - Lớp trong suốt phủ cả màn hình (sương, mây): ≤ 6 ở high, ≤ 3 ở low.
- **Texture:** tất cả là thủ tục hoặc `CanvasTexture` vẽ trong `sliced`. Mỗi tấm ≤ 1024² ở high, ≤ 512² ở low. Tổng bộ nhớ texture ≤ 8 MB.
- **Mount:**
  - Task dài nhất ≤ 25 ms ở CPU 4× (toolkit đo 22 ms).
  - Mọi geometry nặng dựng theo lát ≤ 6 ms (`sliced`, `sync: ctx.reduced`).
  - Frame đầu là poster (giấy + `backdrop` hoặc tranh dự phòng). Canvas fade-in sau khi biên dịch xong.
- **Vòng frame:**
  - `createLoop` chỉ chạy khi kéo, quán tính, camera bay, hoạt cảnh có thời hạn, hoặc chuyển động sống ở high.
  - Chuyển động sống **tự dừng sau 10 s không có input**.
  - Ở `low`/reduced: 0 vòng khi đứng yên, `k.render()` theo yêu cầu.
- **Tương tác:**
  - Raycast chỉ khi `pointerup`/tap. Hover raycast tối đa một lần mỗi frame và chỉ với con trỏ chuột (fine pointer).
  - Nhãn DOM: toạ độ chiếu chỉ cập nhật khi camera đã đổi; chỉ ghi transform.
- **Kiểm tra** (checklist README):
  - `npm run build && node scripts/perf-walk.mjs --only c --stations N-N`;
  - `--passes 2`: heap lượt 2 không tăng, WebGL ≤ 1, rAF = loop của scene;
  - perf-shots ở `high` và `low`, sáng và tối, 1440×900 và 375×812.

### 5.2 Phần cần thêm vào `stage3d.ts` (làm một lần, trước khi dựng hero)

| Thêm | Dùng ở | Ghi chú |
|---|---|---|
| `opts.dpr?: [high, low]` | tất cả | Gọi `renderer.setPixelRatio(min(devicePixelRatio, cap))` sau `createStage` (createStage mặc định 2 / 1.25). |
| `opts.idle?: number` (mặc định 10 s) | tất cả | Đung đưa và chuyển động sống tự dừng; input bật lại. Đây là cách xử lý rủi ro "high vẽ 60 fps liên tục" đã nêu trong báo cáo toolkit. |
| `view.home?: boolean` | t19 | Buông tay thì camera trôi về góc mặc định. |
| `k.fly(target, yaw, pitch, dur)` | t19, t22, t31 | Camera bay bằng GSAP; reduced thì cắt thẳng. |
| `k.label(obj, el, offset?)` | t22, t26, t31, t37 | Nhãn DOM bám vật: ẩn khi ở sau camera, mờ dần trong sương. |
| `k.toro({ tint })`, lantern uniform tối đa 4 nguồn | t22, t26, t31 | Bật tắt bằng cường độ, không biên dịch lại. |
| `backdrop({ moonRise })` | t19 | Trăng mọc trong N giây; reduced thì đã mọc sẵn. |
| `k.dolly` + bánh xe chuột / chụm hai ngón | t31 (và chung) | Đã ghi "chưa làm" trong báo cáo toolkit. |

### 5.3 Ngân sách từng hero

| Hero | Tam giác high / low | Texture | DPR high / low | Render khi đứng yên | Lát dựng `sliced` (theo thứ tự) | Dự phòng không WebGL |
|---|---|---|---|---|---|---|
| t19 `peaks` | ≤ 60k / ≤ 25k (đỉnh: 48×40 → 32×24 đoạn, mỗi đỉnh một lát) | atlas thác bản 1024² / 512²; nhiễu mây 256² dùng chung | **1.5 / 1.0** (mây chồng nhiều lớp) | high: trăng mọc 4 s + mây trôi tới khi idle; low: 0 | backdrop → sống đá, thông, đèn → 5 đỉnh (1 lát/đỉnh) → bia + atlas → mây/đom đóm → biên dịch | diorama 4 lớp núi + bia DOM |
| t22 `heads` | ≤ 45k / ≤ 20k (ống 48×6 → 24×4; bản lật chỉ ở high) | atlas chữ bè 1024×256 / 512×128 | 1.75 / 1.25 | high: lấp lánh nước + 30 đom đóm tới khi idle; low: 0 | hồ + vành đá → 4 đèn → bè + atlas → ống (1 lát/đầu) → nón + sương → biên dịch | SVG `heads` chiếu một lần |
| t26 `lamps` | ≤ 35k / ≤ 15k (tượng lathe 64×48 → 32×24; proxy 600/200) | giấy bình phong 512² / 256² | 1.75 / 1.25 | 0; lửa lập loè chỉ ≤ 2 s khi thắp | mâm cát + gò → tượng → bình phong → 4 đèn (1 lát/đèn) → proxy bóng → biên dịch | `lampsScene` SVG |
| t28 `gardeners` | ≤ 70k / ≤ 30k (luống 1.000 × 12; vòi 1.000 × 8 cạnh → 4 cạnh; giọt 1.000 Points) | thẻ người làm vườn 512×1024 / 256×512 | 1.75 / **1.0** (3.000 instance + giọt) | 0; vòng chỉ khi đi tưới (9 s), đổ nước (khoảng 3 s), quán tính xoay | backdrop → bậc (5 hàng/lát) → ma trận instance (250/lát) → thẻ + đèn → biên dịch | SVG tĩnh từ góc hero |
| t31 `repo` | ≤ 50k / ≤ 22k (2 nhà × khoảng 4k; 640 → 120 nhà fork) | không (phát sáng + decal bóng bake 512²) | 1.75 / 1.25 | high: nước/đèn tới khi idle; low: 0 | đảo + nước → nhà thật → nhà giả + đạo cụ → fork instance → decal → biên dịch | hai tranh SVG trước/sau + đá đổi góc |
| t36 `pens` | ≤ 30k / ≤ 15k (`koiGeometry(low)`; nước 64² → 32²) | hạt giấy 512² | **2 / 1.25** (canvas chỉ trong khung) | high: cá bơi tới khi idle (12 s) rồi lượn về nghỉ; low: 0 | chậu + nước → koi → lá, trăng → 5 chế độ uniform → biên dịch | 5 tranh SVG `pens.ts` |
| t37 `fence` | ≤ 45k / ≤ 20k (cọc ≤ 360 × khoảng 48; 12 thanh 96×5 → 48×4) | decal vành bóng 512² | 1.75 / 1.25 | 0; vòng chỉ khi cọc mọc (≤ 1,5 s/vòng), đom đóm bay (≤ 4 s), quán tính | backdrop + nền → gò + cây → 6 vòng (1 lát/vòng, ẩn) → bó tre → đom đóm → biên dịch | SVG 3/4 nâng khối (cũng là poster) |

---

## 6. Thứ tự thi công

1. **Hạ tầng dùng chung:**
   - phần thêm vào `stage3d.ts` (5.2);
   - hook của `progressTide`, `perspectiveCircle`, `stepPath` (2.3);
   - kiểm `tsc` và trạm demo `#/tram/99`.
2. **t19 `peaks`:** đặt mức chuẩn. Chụp 1440×900 + 375×812, sáng + tối, gửi chủ dự án duyệt trước khi làm tiếp.
3. **Sáu hero WebGL còn lại**, mỗi vườn một cái.
4. **14 hero 2.5D/canvas:**
   - t20 `vortex`, t21 `race`, t23 `bridge`, t24 `flattery`, t25 `current`, t27 `faces`, t29 `desk`, t30 `gate`, t32 `table`, t33 `house`, t34 `credit`, t35 `ladder`, t38 `fork`, t39 `enso`;
   - rồi các scene còn lại, theo vườn.
5. Mỗi trạm chỉ xong khi qua checklist "Trạm mới chỉ xong khi" (README) và có ảnh so cạnh `part1-reference.jpg`.
6. Cập nhật:
   - chuỗi `art`/aria mô tả tranh (VI + EN);
   - hai chuỗi aria mới cho `tram-31.json` và `tram-33.json` (+ `.en.json`);
   - spec B.8: trần 7/21.
