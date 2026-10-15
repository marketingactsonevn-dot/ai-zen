# AI Zen — quy tắc cho agent

- Trước khi viết hoặc sửa một trạm/scene: đọc `README.md` mục **Quy ước hiệu năng** và làm đúng từ đầu. Phần 1 đã phải tối ưu lại cả loạt (nhóm A, `docs/perf-after.md`); Phần 2 không lặp lại.
- Dùng sẵn, không tự viết lại: `createLoop` (`src/core/loop.ts`), `createStage` (`src/core/three-stage.ts`), `sliced` (`src/core/chunk.ts`).
- Một trạm chỉ xong khi qua checklist "Trạm mới chỉ xong khi" trong README (perf-walk ở CPU 4×, `--passes 2`, perf-shots).
- Chữ hiển thị chỉ nằm trong `src/content/*.json` (+ `*.en.json`), fact có `asOf` + `source`.
