---
type: docs
title: StorymeeTeam — System Guide (Agents & Developers)
description: Single entry doc — architecture, all user flows, readiness matrix, UI/UX skill, API map.
tags: [StorymeeTeam, agent, onboarding]
---

# StorymeeTeam — System Guide

**Đối tượng:** Dev người + AI Agent  
**Cập nhật:** 2026-07-17  
**App name:** StorymeeTeam (giữ nguyên — internal ops, **không** school CRM)

> Đọc doc này trước khi sửa bất kỳ tab FE hoặc `core-team-api` team domain.

---

## 1. Mục đích sản phẩm

| Là | Không phải |
|---|---|
| Cổng **nội bộ** team AIFA/Storymee | App end-user StoryMee World |
| HR + Kanban + họp + bot Telegram | Multi-tenant school Organization |
| Data: `TeamMember` + `PlIssue` | `users` product (account-api) |

**Roadmap dài hạn** (Org/CRM):  
`00-Ecosystem-Docs/01-architecture/world/multi-tenant-crm.md` — **chưa implement**.  
**Plan sprint:** `team-roadmap.md`.

---

## 2. Architecture (1 trang)

```
┌─────────────────────────────────────────────────────────────┐
│  StorymeeTeam FE  :3010 (Next.js — Mac/Vercel only)         │
│  Web UI only. KHÔNG bắt buộc trên Ubuntu.                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ /internal/v1/team/*
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Hub :5100                                                  │
│    /internal/v1/team/*  → core-team-api :4503               │
│    /internal/v1/ai/*    → core-ai-api :4600                 │
└───────────┬─────────────────────────┬───────────────────────┘
            │                         │
            ▼                         ▼
     PostgreSQL                  NATS + Telegram bot
                                 bot OMNIROUTER →
                                 POST /internal/v1/ai/team/chat
                                 (core-ai-api, không FE)
```

**Telegram LLM:** `core-ai-api` `POST /internal/v1/ai/team/chat` — docs: `2-MCP-Core/core-ai-api/docs/TEAM_CHAT.md`

| Layer | Path / Port |
|---|---|
| FE | `1-Harness-Apps/StorymeeTeam` · `npm run dev` → **3010** |
| API | `2-MCP-Core/core-team-api` · **4503** |
| Bot/MCP | `2-MCP-Core/storymeeteam-mcp` |
| Env FE | `NEXT_PUBLIC_API_URL` (hub base, **không** kèm `/internal/v1/team` — client tự nối) |

---

## 3. Database map (nội bộ)

| Entity | Bảng | Ghi chú |
|---|---|---|
| Nhân sự / login | `omni_team_members` | `account_status`: pending\|active\|suspended\|rejected |
| Task/Kanban | `pl_issues` + `pl_states` + `pl_projects` | SSOT — cấm Omni SubTask mới |
| Họp | `omni_meetings` | hostId = TeamMember |
| Thông báo all | `omni_announcements` | targetUserId null = broadcast |
| Chấm công | `omni_attendance` | |
| Nghỉ phép | `omni_leave_requests` | |
| Legacy (frozen write) | `omni_tasks` / `omni_sub_tasks` | 410 on create |

**Product users** (`users`, workspaces/ipId) = account-api — **không** trộn vào HR.

---

## 4. Ma trận tính năng & độ sẵn sàng

| # | Luồng | FE | API | Bot | Status | Ghi chú audit 2026-07-17 |
|---|---|---|---|---|---|---|
| 1 | Login active only | ✅ | ✅ `/hr/auth/lookup` | — | **OK** | Pending/suspended → 403 |
| 2 | Register → admin duyệt | ✅ HR Accounts | ✅ register/approve | ✅ /register pending | **OK** | |
| 3 | Update hồ sơ self | ✅ Profile | ✅ `mode:self` | partial | **OK** | |
| 4 | Suspend / soft delete | ✅ Accounts | ✅ | Telegram admin btn | **OK** | Hard delete dễ fail FK |
| 5 | Kanban list/create/update | ✅ | ✅ plane | ✅ MCP | **OK** | |
| 5b | Done / archive / hard-delete self | ✅ | ✅ assignee\|admin | ✅ `archive_issue`/`delete_issue` | **OK** | Không admin request task |
| 6 | Submit In Review + admin review | ✅ | ✅ optional | ✅ optional | **OK** | User có thể Done thẳng |
| 7 | Projects CRUD | ✅ | ✅ plane | ✅ | **OK** | Inbox DFLT khi không chọn project |
| 8 | Chấm công | ✅ | ✅ workType resolve | ✅ nút + cron | **OK** | Full remote HR + remote leave approved → remote |
| 9 | Nghỉ phép / remote | ✅ form+list+approve | ✅ + auto att. remote | ✅ MCP+TG | **OK** | Duyệt remote → auto bảng công remote |
| 10 | **Lịch họp** | ✅ create+attendees+edit | ✅ | ✅ | **OK** | Multi-select attendees |
| 11 | **Notify all** | ✅ banner + header | ✅ | NATS | **OK** | Admin BroadcastNotify |
| 12 | Bell notifications | ✅ localStorage | Socket | — | **Partial** | Socket host fix; role admin dùng isTeamAdmin |
| 13 | AI Chat / breakdown | ✅ | Next `/api/ai/*` | — | **OK-** | Phụ thuộc LLM env |
| 14 | OmniRouter | ✅ admin | — | — | **OK-** | Admin only |
| 15 | Payroll / RAG rules | ✅ | partial | — | **UI only** | Cần validate business |
| 16 | Realtime Socket | Partial | Socket.io | — | **Fixed base URL** | Trước đây gắn nhầm origin Next |

### Legend

- **OK** — end-to-end dùng được  
- **OK-** — dùng được, còn edge case  
- **Partial** — thiếu nhánh  
- **UI only** — chưa tin cậy production  

---

## 5. Chi tiết luồng quan trọng

### 5.1 Account lifecycle

```
Telegram /register → POST /hr/team-members/register → pending
Admin: FE HR→Tài khoản OR Telegram nút → POST .../approve
Login FE: GET /hr/auth/lookup?q=email|@telegram (active only)
```

Doc: `team-internal-accounts.md`

### 5.2 Task lifecycle (FE + Telegram thống nhất)

```
POST/PATCH /plane/issues
  - assignee: status → Done | cancelled (archive) | any board state
  - optional: in_review + output → POST .../review (admin)
DELETE /plane/issues/:id  → hard delete (assignee | admin)
NATS → Telegram + FE socket
```

**LLM actions (normalize):** `update_issue` | `archive_issue` | `delete_issue` | `create_issue` | `leave_request` | `check_in_out`  
FE chat: `src/lib/llmActions.ts` · AI: `core-ai-api` `teamChat.service` ACTION_ALIASES.

Doc: `team-work-management.md` · MCP: `MCP_TOOL_CALLING.md`

### 5.2b Attendance + remote leave

| Rule | Behavior |
|------|----------|
| `TeamMember.workArrangement=remote` | Check-in luôn `workType=remote` (FE khoá Office) |
| Đơn leave `type=remote` **approved** | Auto attendance remote từng ngày; hôm nay/quá khứ auto check-in |
| Check-in thường | API resolve: full remote → approved remote leave → body.workType → office |
| Telegram button | Full remote: `attendance_direct:present:remote` · Office: present (API still forces remote if leave) |

### 5.3 Meetings

| Action | Endpoint | FE |
|---|---|---|
| List | `GET /hr/meetings` | Meetings tab + dashboard |
| Create | `POST /hr/meetings` | **+ Tạo lịch họp** form |
| Update | `PATCH /hr/meetings/:id` | Edit title/docs/outputs |
| Reminder | FE poll 60s | Bell ~15 phút trước |
| Realtime | NATS `meeting.created` | Socket refresh |

Body create: `{ title, startTime, endTime, hostId, description?, meetLink?, attendees? }`

### 5.4 Notify all (announcements)

| Action | Endpoint | FE |
|---|---|---|
| List | `GET /hr/announcements` | Banner + bell |
| Broadcast | `POST /hr/announcements` `{ title, content, senderId }` không `targetUserId` | Header **Notify all** (admin) |
| Mark read | `POST /hr/announcements/:id/read` `{ userId }` | Banner “Xác nhận đã đọc” |
| Target 1 user | `targetUserId` set | (chưa UI dedicated) |

**Bug đã sửa:** client trước parse `res.data.status` sai (body đã unwrap) → banner trống dù API có data.

### 5.5 Socket events (bridge NATS `core.team.X.Y` → `x_y`)

| Event | FE handler |
|---|---|
| `issue_updated` | refresh tasks |
| `announcement_created` | prepend banner + bell |
| `meeting_created` / `meeting_updated` | refresh meetings |
| `leave_resolved` | notif user |
| `account_registered` | notif admin |

Connect: `io(NEXT_PUBLIC_API_URL host, { path: '/internal/v1/team/socket.io' })`

---

## 6. FE structure (agents)

```
src/app/
  page.tsx                 # shell tabs
  login/page.tsx           # auth lookup
  features/
    dashboard/             # overview widgets
    projects/ kanban/ chat/ hr/ meetings/ omnirouter/
    shared/
      hooks/useAppState.ts # orchestrator
      hooks/useAuthState.ts useTaskState useHrState useSocketState...
      components/HeaderBar SidebarNav TaskDetailModal BroadcastNotify
  lib/
    apiClient.ts           # CoreApiClient + API_ROUTES
    teamAuth.ts            # isTeamAdmin, isAccountActive
    taskStatus.ts          # UI ↔ API status map
```

**Quy tắc import API:** dùng `coreApiClient` + path relative sau prefix team (`/hr/...`, `/plane/...`).

**Admin:** `isTeamAdmin(member)` — email allowlist + role keywords (Founder, IT Admin…).

**Authorization boundary:** quyền thật được kiểm tra tại `core-team-api` bằng
Team JWT. Client không được dùng user selector hoặc các trường
`actorEmail/reviewerId/viewerEmail` để thay identity đã xác thực. Các Next AI
routes cũng bắt buộc Team JWT và rate limit trước khi gọi provider.

---

## 7. API quick reference

```
# Health
GET  /internal/v1/team/health

# Auth / members
GET  /hr/auth/lookup?q=
GET  /hr/team-members?status=all|pending|active
POST /hr/team-members/register
POST /hr/team-members                    # admin upsert | mode:self
POST /hr/team-members/:id/approve|reject|suspend
DELETE /hr/team-members/:id

# Plane (tasks)
GET|POST /plane/issues
PATCH    /plane/issues/:id
DELETE   /plane/issues/:id          # hard-delete assignee|admin
POST     /plane/issues/:id/review   # admin optional
POST     /plane/issues/:id/request-archive  # legacy; prefer PATCH cancelled
GET|POST /plane/projects

# Meetings & announcements
GET|POST /hr/meetings
PATCH    /hr/meetings/:id
GET|POST /hr/announcements
POST     /hr/announcements/:id/read

# HR ops
GET  /hr/attendance
POST /hr/attendance/checkin   # body: memberId, workType?, notes — server resolves remote
POST /hr/attendance/checkout
GET|POST /hr/leave-requests
POST /hr/leave-requests/:id/approve  # remote approve → auto attendance

# AI (hub)
POST /internal/v1/ai/team/chat
```

Legacy create task: **410** `LEGACY_TASK_CREATE_FROZEN`.

---

## 8. UI/UX — skill cho agent

Dùng skill:

1. **Global premium UI:** `storymee/.agents/skills/premium-ui/SKILL.md`  
2. **StorymeeTeam-specific:** `storymee/.agents/skills/storymeeteam-ui/SKILL.md` (design tokens, patterns app này)

Nguyên tắc app này:

- Dark glass (`--bg-base`, `--bg-surface`, `--border`, class `glass`, `btn-primary`)
- Inline styles + CSS vars hiện tại (chưa full Tailwind component library)
- Không redesign brand sang school portal
- Density: internal tool — ưu tiên scannable tables/boards, không marketing landing

---

## 9. Checklist khi agent nhận task

1. [ ] Đọc section 4 — feature đã OK chưa?  
2. [ ] Task/Kanban? → chỉ `/plane/*`  
3. [ ] HR profile? → `TeamMember` team-api, không account-api  
4. [ ] School/org? → **từ chối scope** trừ khi user kickoff P3  
5. [ ] UI change? → load `storymeeteam-ui` + `premium-ui`  
6. [ ] Sau sửa: `npx tsc --noEmit` FE; smoke API nếu chạm backend  

---

## 10. Known gaps (còn lại sau fix partial)

| Gap | Status |
|---|---|
| Leave FE form + list parity bot | **Fixed** — `LeaveRequestForm` + `leaveApi.ts` |
| Meeting attendee multi-select | **Fixed** |
| Notify all + announcements load | **Fixed** |
| Socket host | **Fixed** (verify prod nginx) |
| Done/archive/delete self-service | **Fixed** 2026-07-17 |
| Full remote workType office bug | **Fixed** — API + FE + bot |
| Remote leave → auto attendance | **Fixed** on approve |
| FE chat LLM action aliases | **Fixed** — `llmActions.ts` |
| Payroll business rules | Still soft / UI |
| Inline CSS → design system | Ongoing via storymeeteam-ui |
| Feature `index.ts` public API | Incremental |

### MCP tool-calling (agents)

**SSOT:** `2-MCP-Core/storymeeteam-mcp/docs/MCP_TOOL_CALLING.md`  

Leave FE + MCP **cùng body** `POST /hr/leave-requests`.

---

## 11. Related docs index

| Doc | Nội dung |
|---|---|
| `README.md` (repo) | Quick start |
| `docs/SYSTEM_GUIDE.md` (this) | Master |
| `team-work-management.md` | Task SSOT |
| `team-internal-accounts.md` | Account |
| `team-hr-vs-account.md` | HR vs product user |
| `team-roadmap.md` | Phases |
| `multi-tenant-crm.md` | Future only |
| `project-structure.md` | Feature-driven folders |

---

## 12. Smoke commands

```bash
# API
curl -s localhost:4503/internal/v1/team/health
curl -s localhost:4503/internal/v1/team/hr/meetings
curl -s localhost:4503/internal/v1/team/hr/announcements
node 2-MCP-Core/core-team-api/scripts/smoke_issue_lifecycle.js

# FE
cd 1-Harness-Apps/StorymeeTeam && npm run dev   # :3010
npx tsc --noEmit
```
