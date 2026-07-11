# Khắc phục lỗi chuyển trạng thái pipeline (Kanban) trên Frontend

**Vấn đề:**
- Khi user kéo thả task trong Kanban, hoặc click chọn chuyển trạng thái trong Modal, frontend tạo payload gửi lên Backend Plane API.
- Hàm `handleUpdateTask` trong `useAppState.ts` nhận trạng thái dạng hiển thị (ví dụ: `"In Progress"`, `"Done"`), chuyển đổi sang `apiStatus` tương thích backend (ví dụ: `"working"`, `"done"`).
- TUY NHIÊN, khi gửi API call (HTTP PATCH), payload lại truyền nhầm biến `status: task.status` (giá trị thô) thay vì biến `status: apiStatus` (đã map) khiến Backend từ chối cập nhật hoặc lưu sai state, làm cho UI giật lùi trạng thái về như cũ khi load lại.

**Giải pháp:**
- Đã sửa lại file `src/app/features/shared/hooks/useAppState.ts` (Dòng 568), truyền đúng biến `apiStatus` vào payload của `coreApiClient.patch`.

**Kết quả:**
- Pipeline transition (Kanban Drag-Drop và Task Detail Tracker) hiện đã hoạt động trơn tru.
