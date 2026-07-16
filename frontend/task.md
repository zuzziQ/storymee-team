# Task Checklist - StorymeeTeam Edit/Delete Features

## Các mục tiêu cần sửa:
- [x] `src/app/features/shared/hooks/useTaskState.ts`: Bổ sung hàm xoá task (dùng API PATCH status='cancelled' hoặc gọi API delete của Plane), đổi tên task, đổi deadline.
- [x] `src/app/features/shared/components/TaskDetailModal.tsx`:
   - [x] Sửa Tên Task: Bấm vào thẻ h2 để biến thành ô input (Click to edit).
   - [x] Thêm nút Xoá Task (icon Trash màu đỏ) nằm cạnh nút đóng modal X.
   - [x] Subtasks: Thêm nút Edit và Xoá (Trash) cho từng item. Cho phép đổi tên subtask.
   - [x] Thêm input cho Deadline (type='date') và Estimate Time.
- [x] Tạo mới `src/app/features/shared/components/EditProjectModal.tsx` và bổ sung hàm updateProject vào `useProjectState.ts` (API PATCH `PLANE.PROJECTS/{id}`). Gắn nút Sửa/Xoá vào Card Project ở UI trang chính.

**Trạng thái:** Hoàn thành toàn bộ các tính năng Edit/Delete cho Task, Subtask, Project.
