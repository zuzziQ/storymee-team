---
name: storymeeteam-ui
description: Thiết kế UI/UX Dark Glass và mật độ thông tin cao cho StorymeeTeam (Internal Ops, Kanban, HR, Meetings, Quản trị phân quyền). Kế thừa Layout Defense Engine từ premium-ui.
---

# SKILL: STORYMEETEAM UI/UX (DARK GLASS & HIGH-DENSITY INTERNAL OPS)

> [!IMPORTANT]
> Kỹ năng này do **@FE-agent** hoặc **@Design-agent** kích hoạt khi làm việc với ứng dụng nội bộ **StorymeeTeam** (`1-Harness-Apps/StorymeeTeam`).
> Kế thừa toàn bộ Lõi Bố Cục Phòng Thủ (Zero-Overflow Layout Engine) từ **[premium-ui](file:///Users/imam/storymee/.agents/skills/premium-ui/SKILL.md)** nhưng áp dụng phong cách tối ưu hóa cho công cụ vận hành: Dark Glass, Scannable, High Density, không mang màu sắc White SaaS tiếp thị.

---

## 1. Intent & Scope (Mục Đích & Phạm Vi)

StorymeeTeam là **công cụ vận hành nội bộ** (Operations, Nhân sự HR, Bảng điều phối Kanban, Lịch họp Meetings). Trải nghiệm người dùng phải ưu tiên:
1. **Scannable:** Bảng dữ liệu, danh sách thẻ, status badge phải lướt nhanh bằng mắt trong 1-2 giây.
2. **Low Friction:** Tối thiểu số lần click cho các thao tác lặp lại: điểm danh check-in, duyệt nhanh task, thông báo toàn đội.
3. **High Trust:** Khi API lỗi, hiển thị Toast cảnh báo chi tiết, tuyệt đối không âm thầm nuốt lỗi (silent failure).
4. **Role-Aware:** Phân định rạch ròi giao diện giữa Quản trị viên (`isTeamAdmin`) và Thành viên thông thường.
5. **Dark Glass Consistency:** Đồng bộ với giao diện Dark Glass đặc trưng của StorymeeTeam.

---

## 2. Trigger Conditions (Điều Kiện Kích Hoạt)

Agent tự động kích hoạt kỹ năng này khi:
1. Tạo hoặc chỉnh sửa các tab trong StorymeeTeam: Kanban Board, HR Directory, Meetings, System Health, Notifications.
2. Sửa đổi Header, Sidebar, các bảng dữ liệu hoặc modal chi tiết công việc.
3. Khi nhận lệnh `/skill storymeeteam-ui` hoặc yêu cầu "nâng cấp giao diện StorymeeTeam".

---

## 3. Execution Protocol (Quy Trình Thực Thi)

### Step 1: Kế Thừa Lõi Layout Engine & Thiết Lập Bố Cục Chuẩn
Áp dụng kỷ luật từ `premium-ui`:
- Khung root ứng dụng: `h-[100dvh] overflow-hidden flex`.
- Vùng nội dung chính: `flex-1 min-h-0 flex flex-col`.
- Vùng cuộn dữ liệu: `flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6`.

```
┌──────── Sidebar 240px ──┬──────── Header 56px ────────────────┐
│ Brand: StorymeeTeam     │ Tab title | Project | Notify | User │
│ Nav tabs                ├─────────────────────────────────────┤
│                         │ Announcement banner (optional)      │
│                         │ Content scroll (flex-1 min-h-0)     │
└─────────────────────────┴─────────────────────────────────────┘
```

### Step 2: Sử Dụng Design Tokens Đang Dùng (CSS Variables)
Khai báo trong `src/app/globals.css`:

| Token / Class | Vai Trò Trong Giao Diện |
|:---|:---|
| `--bg-base` | Nền ứng dụng tối (`#090d16` / `#0b0f19`) |
| `--bg-surface` | Sidebar, Header, Kanban Columns, Card containers |
| `--bg-muted` | Chip phân loại, Input background, Tag nền |
| `--border` | Đường viền mảnh 1px phân tách khu vực |
| `.glass` | Hiệu ứng Dark Glassmorphism (`backdrop-blur-md bg-slate-900/40 border border-slate-700/40`) |
| `.btn-primary` | CTA chính chuyển sắc Indigo (`#6366f1`) → Violet (`#8b5cf6`) |
| `Badge colors` | Trạng thái công việc: `backlog`, `todo`, `in-progress`, `review`, `done` |

### Step 3: Triển Khai Theo Feature Pattern
- **Kanban Board:** Các cột phân loại có chiều rộng tối thiểu `min-w-[280px]`, cuộn ngang container cha mượt mà; thẻ task kéo thả gọn gàng, hiển thị avatar, tag độ ưu tiên và số subtasks.
- **HR & Thành viên:** Bố cục chia đôi: Danh sách/bộ lọc bên trái, Thông tin chi tiết/Org chart bên phải.
- **Meetings:** Mô hình Master-Detail: Danh sách cuộc họp dạng list compact bên trái, biên bản/nội dung họp bên phải.
- **Thông Báo (Notify All):** Popover ở Header dành riêng cho Admin; hiển thị banner toàn màn hình khi có thông báo khẩn chưa đọc.
- **Empty States:** Hiển thị 1 dòng ngắn gọn kèm nút CTA (không dùng hình minh họa hoạt hình lớn gây choán chỗ).

### Step 4: Tích Hợp API & State Đúng Chuẩn
1. Luôn đọc `1-Harness-Apps/StorymeeTeam/docs/SYSTEM_GUIDE.md` trước khi gọi API mới.
2. Quản lý state qua hooks `use*State` hoặc `useAppState` — không gọi `fetch` phân mảnh ở component lá.
3. Sử dụng `@/lib/apiClient` (`coreApiClient`) kết hợp hằng số `API_ROUTES`.
4. Kiểm tra quyền quản trị tập trung qua `@/lib/teamAuth` với hàm `isTeamAdmin`.
5. Báo lỗi và thông báo bằng thư viện `react-hot-toast` đã tích hợp sẵn tại layout.

---

## 4. Guardrails & Anti-patterns

| Hành Vi Bị Cấm | Lý Do | Giải Pháp Thay Thế |
|:---|:---|:---|
| **Dùng White SaaS Marketing Layout** | Sai đối tượng sử dụng, gây chói mắt cho dev/ops làm ca đêm | Duy trì Dark Glass Theme hiện hành |
| **Hardcode danh sách email Admin** | Dễ rò rỉ logic và khó phân quyền động | Bắt buộc dùng `isTeamAdmin(user)` |
| **Dùng `alert()` để báo lỗi** | Trải nghiệm thô sơ, chặn luồng người dùng | Dùng `toast.error(message)` từ `react-hot-toast` |
| **Component phình to > 500 dòng** | Khó bảo trì, dễ gây lỗi re-render diện rộng | Tách thành các component con trong `features/*/components` |
| **Dùng dữ liệu giả (fake data) che lỗi API** | Đánh lừa người dùng, khiến sự cố API bị chôn vùi | Hiển thị Empty state rõ ràng kèm nút Thử lại (Retry) |
| **Gọi API `account-api` cho profile nhân viên** | Sai bounded context của kiến trúc microservices | Dùng đúng API nội bộ của team |

---

## 5. Verification Checklist

Trước khi hoàn tất chỉnh sửa giao diện StorymeeTeam, `@FE-agent` phải tích đủ:
- [ ] Tuân thủ bảng màu và tokens Dark Glass của StorymeeTeam.
- [ ] Áp dụng đúng Lõi Layout Engine từ `premium-ui` (`min-w-0`, `min-h-0`, không có cuộn kép).
- [ ] Các thao tác gửi dữ liệu có trạng thái Loading và vô hiệu hóa nút bấm (disabled) chống spam click.
- [ ] Mọi phản hồi API đều có Toast thông báo rõ ràng (Success / Error).
- [ ] Phân quyền hiển thị chuẩn xác giữa User thường và `isTeamAdmin`.
- [ ] Chạy `npx tsc --noEmit` đạt 0 lỗi biên dịch.

---

## 6. Version History & Extension Log

| Phiên Bản | Ngày | Tác Giả | Nội Dung Cải Tiến |
|:---:|:---:|:---:|:---|
| `v1.0` | 2026-08-01 | Antigravity Core | Tài liệu khởi tạo quy chuẩn giao diện StorymeeTeam |
| `v2.0` | 2026-09-19 | `@BE-agent` | Nâng cấp Standard Skill Spec v2.0, gắn kết kế thừa trực tiếp từ Lõi Layout Engine của `premium-ui`, chuẩn hóa Dark Glass High-Density |
