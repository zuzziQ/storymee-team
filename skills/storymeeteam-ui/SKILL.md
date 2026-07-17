---
name: storymeeteam-ui
description: UI/UX cho app StorymeeTeam (internal ops). Dùng khi sửa/build giao diện Kanban, HR, Meetings, dashboard — dark glass, density cao, không marketing.
---

# SKILL: StorymeeTeam UI/UX

> Kích hoạt khi: redesign tab StorymeeTeam, component mới, polish Kanban/HR/Meetings/Header, “làm đẹp FE”, “UX nội bộ”.  
> Kết hợp **premium-ui** (tokens/animation) nhưng **không** biến app thành landing page.

## Intent

StorymeeTeam là **công cụ nội bộ** (ops/HR/Kanban). UX ưu tiên:

1. **Scannable** — board, list, status badge đọc nhanh  
2. **Low friction** — ít click cho check-in, duyệt task, notify  
3. **Trust** — lỗi API hiện toast, không silent fail  
4. **Role-aware** — admin vs nhân viên (isTeamAdmin)  
5. **Consistent** với dark theme hiện có

## Design tokens (đang dùng)

Trong `src/app/globals.css` / CSS vars:

| Token | Vai trò |
|---|---|
| `--bg-base` | Nền app |
| `--bg-surface` | Sidebar, header, cards |
| `--bg-muted` | Chip, input bg |
| `--border` | Viền 1px |
| `.glass` | Card glassmorphism |
| `.btn-primary` | CTA tím indigo gradient |
| `.sidebar-item` / `.active` | Nav |
| Badge colors | backlog/todo/progress/review/done |

Primary accent: indigo `#6366f1` → violet `#8b5cf6`.

## Layout chuẩn

```
┌──────── Sidebar 240px ──┬──────── Header 56px ────────────────┐
│ Brand StorymeeTeam      │ Tab title | Project | Notify | User │
│ Nav tabs                ├─────────────────────────────────────┤
│                         │ Announcement banners (optional)     │
│                         │ Content scroll (padding 24)         │
└─────────────────────────┴─────────────────────────────────────┘
```

- **Không** đổi tên brand / không thêm school portal chrome  
- Content max density; tránh hero sections  

## Patterns theo feature

| Feature | Pattern |
|---|---|
| Kanban | Columns + cards; drag; modal detail; review panel |
| HR | Sub-tabs; form trái / org chart phải; Accounts admin |
| Meetings | Master-detail list | panel; form tạo họp compact |
| Notify all | Header popover (admin); banner full-width unread |
| Dashboard | KPI cards + lists; recharts sparingly |
| Empty states | 1 dòng + CTA (không illustration lớn) |

## Quy tắc implement

1. **Đọc** `1-Harness-Apps/StorymeeTeam/docs/SYSTEM_GUIDE.md` trước khi đụng API.  
2. State: hooks `use*State` / `useAppState` — không nhân đôi fetch trong leaf lung tung.  
3. API: `@/lib/apiClient` `coreApiClient` + `API_ROUTES`.  
4. Admin: `@/lib/teamAuth` `isTeamAdmin`.  
5. Feedback: `react-hot-toast` (đã Toaster ở layout).  
6. Status task: `@/lib/taskStatus` — không hardcode map lệch backend.  
7. Prefer reuse `glass`, existing buttons; khi thêm CSS dùng var.  
8. **Cấm** gọi account-api cho profile NV.  
9. **Cấm** scope Organization/school UI trừ task P3+ explicit.  

## Micro-UX bắt buộc khi sửa

- [ ] Loading / disabled khi submit  
- [ ] Toast success + error message từ API  
- [ ] Confirm destructive (xoá, suspend)  
- [ ] Keyboard: Enter submit form chính (nếu có)  
- [ ] Mobile: sidebar có thể kém — desktop-first OK cho internal tool  

## Anti-patterns

| Cấm | Lý do |
|---|---|
| White SaaS marketing layout | Sai persona |
| Hardcode 3 admin emails rải rác | Dùng isTeamAdmin |
| alert() cho mọi error | Toast |
| Component 2000 dòng | Tách features/*/components |
| Fake data che API fail | Hiện empty + error |

## Handoff checklist

1. UI match tokens StorymeeTeam  
2. Luồng API đúng SYSTEM_GUIDE §5  
3. `npx tsc --noEmit`  
4. Manual: login active, kanban, 1 meeting create, notify all (admin)  

## Related

- premium-ui (global aesthetic)  
- SYSTEM_GUIDE.md (flows)  
- project-structure.md (folders)
