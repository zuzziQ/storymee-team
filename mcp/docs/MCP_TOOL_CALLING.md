---
type: docs
title: StorymeeTeam MCP — Tool Calling Spec for Agents
description: SSOT tool catalog, auth, payloads, pairing FE+Bot. Bắt buộc đọc trước khi agent gọi tool hoặc sửa MCP.
tags: [MCP, storymeeteam-mcp, agent, tool-calling]
---

# StorymeeTeam MCP — Tool Calling Spec

**Server:** `2-MCP-Core/storymeeteam-mcp`  
**Transport:** stdio MCP (IDE) + Telegram bot (cùng `executeMcpTool`)  
**Backend SSOT:** `core-team-api` qua Hub `CORE_API_URL` + prefix `/internal/v1/team`  
**Verified:** 2026-07-17 — `node scripts/verify_tool_routes.js` → **24/24 routes OK**

> Agent **không** được invent tool name / body. Chỉ dùng bảng dưới + alias.  
> Mọi mutation task/leave **cùng contract** với StorymeeTeam FE.

---

## 1. Auth & identity

| Context | Identity |
|---|---|
| IDE MCP | Env `STORYMEE_USER_EMAIL` → resolve `TeamMember` |
| Telegram | `telegramUsername` / `telegramChatId` → `TeamMember` |
| Permission | `isBoss` / `isTeamAdmin` = email allowlist + role keywords |

**Gate account:**

- `account_status !== active` → bot chặn hầu hết lệnh (chỉ `/register`)
- Tools nhận `user` object: `{ id, email, fullName, role, telegramUsername, ... }`

---

## 2. Client HTTP rules

```ts
// Base (bot/MCP):
const apiClient = new CoreApiClient({
  baseURL: process.env.CORE_API_URL + '/internal/v1/team', // e.g. http://localhost:5100
  enforceApiPrefix: false,
});

// Paths: prefer short relative if base already has /internal/v1/team
// FE StorymeeTeam uses: /hr/..., /plane/...
// Shared package API_ROUTES may use full /internal/v1/team/hr/... — check join carefully
```

**NATS events** (bot subscribes for notify):

| Subject | Meaning |
|---|---|
| `core.team.leave.request` | Đơn nghỉ mới → admin Telegram |
| `core.team.leave.resolved` | Duyệt/từ chối → user |
| `core.team.task.submitted_for_review` | In Review |
| `core.team.task.review_approved` / `review_rejected` | Review result |
| `core.team.account.registered` / `approved` / `rejected` | Account lifecycle |
| `core.team.issue.updated` | Kanban sync |

---

## 3. Tool catalog (canonical)

### 3.1 Plane / Tasks (`planeTools.ts`)

| Tool | Khi agent gọi | Input chính | API thực |
|---|---|---|---|
| `get_my_issues` | Xem việc của tôi / filter NV | `employee_name?`, `project_id?` | `GET /plane/issues` |
| `get_issue_details` | Chi tiết 1 task | `task_id` (UUID hoặc `PROJ-1`) | `GET /plane/issues` + find |
| `create_issue` | Tạo task | `title`, `project_id`, `assignee?`, `priority?`, `target_date?`, `parent_id?` | `POST /plane/issues` |
| `create_project` | Tạo project | `title`, `description?` | `POST /plane/projects` (boss) |
| `update_issue` | Sửa status/assignee/deadline… | `task_id`, fields optional | `PATCH /plane/issues/:id` |
| `update_issue_state` | Đổi state Todo/In Progress/**Done** | `issue_id`, `state` | `PATCH` status — assignee **Done thẳng** (không ép In Review) |
| `assign_issue` | Bàn giao | `issue_id`, `assignee` | `PATCH` assigneeId |
| `breakdown_issue` | AI tách subtask | `task_id` | FE `/api/ai/breakdown` + `POST` issues |
| `update_sub_issues` | Set list subtasks | `task_id`, `titles[]`, `overwrite?` | POST/PATCH plane |
| **`archive_issue`** | Lưu trữ (self) | `task_id`, `reason?` | `PATCH status=cancelled` assignee\|admin |
| **`delete_issue`** | Hard delete (self) | `task_id` | `DELETE /plane/issues/:id` assignee\|admin |
| `request_issue_approval` | **Deprecated** archive; extend optional | `task_id`, `type=extend`… | archive/delete → archive_issue/delete_issue |
| `approve_issue_request` | Admin legacy | `task_id`, `type`, `decision` | PATCH cancelled / targetDate |
| **`review_issue`** | Admin optional In Review→Done | `task_id`, `decision`, `review_note?` | **`POST .../review`** |

**Status vocabulary (PATCH body `status`):**

| UI / tool | API status string |
|---|---|
| Todo | `todo` / `pending` |
| In Progress | `working` / `in_progress` |
| In Review | `in_review` |
| Done | `done` (admin review prefer `POST .../review`) |
| Archive | `cancelled` |

**Review SSOT (không dùng tool riêng — FE + Telegram callback):**

```
POST /plane/issues/:id/review
{ decision: "approve"|"reject", reviewerId, reviewNote? }
```

---

### 3.2 HR / Leave / Meetings (`hrTools.ts`)

| Tool | Khi gọi | Input | API |
|---|---|---|---|
| **`submit_leave_request`** | Xin nghỉ / remote | xem §4 | `POST /hr/leave-requests` |
| **`list_leave_requests`** | List đơn | `status?` pending\|approved\|rejected\|all | `GET /hr/leave-requests` |
| **`approve_leave_request`** | Admin duyệt đơn | `leave_id`, `decision` | `POST .../leave-requests/:id/approve` |
| `get_leave_allowance` | Xem hạn mức phép | `employee_name?` | TeamMember counters |
| `get_my_payroll_slip` | Phiếu lương | `month` YYYY-MM | Local compute (no HTTP) |
| `update_personal_info` | Đổi bank | `bank_account`, `bank_name` | `POST /hr/team-members` **mode:self** |
| `upsert_team_member` | Admin HR upsert | email, fullName, … | `POST /hr/team-members` |
| `schedule_meeting` | Tạo họp | title, startTime, endTime, attendees? | `POST /hr/meetings` |
| `update_meeting` | Sửa/hủy họp | meeting_id, fields | `PATCH /hr/meetings/:id` |
| **`broadcast_announcement`** | Notify all | title, content | `POST /hr/announcements` |

---

### 3.3 Attendance (`attendanceTools.ts`)

| Tool | Input | API |
|---|---|---|
| `check_in_out` | `status` present\|late\|absent\|**checkin\|checkout**, `action?`, `workType?` | `POST /hr/attendance/checkin` **hoặc** `checkout` |
| `get_attendance_report` | employee, month, year | `GET /hr/attendance` |

**workType resolve (server, 2026-07):** full remote HR → remote; approved remote leave covering today → remote; else body/notes; else office.  
Telegram: `attendance_direct:present` \| `attendance_direct:present:remote` \| `attendance_direct:checkout`.

### 3.4 Alias LLM (tự map trong `executeMcpTool`)

| Agent hay gọi | Canonical tool |
|---|---|
| `get_my_tasks`, `list_tasks`, `my_tasks` | `get_my_issues` |
| `create_task`, `add_task` | `create_issue` |
| `update_task`, `update_task_status` | `update_issue` / `update_issue_state` |
| `assign_task` | `assign_issue` |
| `approve_task`, `review_task`, `reject_task` | `review_issue` |
| `archive_task`, `luu_tru` | **`archive_issue`** (self-service) |
| `delete_task`, `remove_task`, `xoa_task` | **`delete_issue`** (assignee\|admin) |
| `submit_leave`, `request_leave`, `xin_nghi` | `submit_leave_request` |
| `approve_leave`, `reject_leave` | `approve_leave_request` |
| `list_leaves` | `list_leave_requests` |
| `checkin`, `checkout`, `diem_danh` | `check_in_out` |
| `create_meeting` | `schedule_meeting` |
| `notify_all`, `send_announcement` | `broadcast_announcement` |

---

## 4. Leave request — FE + Bot **cùng contract** (bắt buộc)

### 4.1 Canonical body

```http
POST /internal/v1/team/hr/leave-requests
Content-Type: application/json

{
  "memberId": "<uuid TeamMember>",
  "leaveType": "annual" | "remote" | "sick" | "personal",
  "startDate": "ISO-8601",
  "endDate": "ISO-8601",
  "reason": "string"
}
```

### 4.2 Mapping tool → body

| MCP / FE UI | leaveType API |
|---|---|
| type=`leave` / “Nghỉ phép” | `annual` |
| type=`remote` | `remote` |
| type=`sick` | `sick` |
| session=`all` | start 00:00Z → end 23:59Z |
| session=`am` | end 12:00Z |
| session=`pm` | start 12:00Z |

Helpers FE: `src/lib/leaveApi.ts`  
MCP: `submit_leave_request` trong `hrTools.ts`

### 4.3 Approve (admin)

```http
POST /hr/leave-requests/:id/approve
{ "status": "approved" | "rejected" }
```

**Khi `leaveType=remote` + approved:** core-team-api auto ghi `omni_attendance` workType=`remote` cho từng ngày trong khoảng (hôm nay/quá khứ: auto check-in; tương lai: pre-row).
```

- FE: HR → Đơn xin phép  
- Telegram: `approve_leave:` / `reject_leave:` callbacks  
- NATS: `core.team.leave.request` → admin; `core.team.leave.resolved` → user  

### 4.4 Agent rules

1. User “xin nghỉ ngày mai” → **chỉ** `submit_leave_request` (không tạo issue).  
2. Không fake success nếu API lỗi.  
3. Non-boss không submit thay người khác.  
4. Sau submit: nhắc user chờ admin (web + Telegram).

---

## 5. Tool selection cheat-sheet (agent)

| User intent (VN) | Tool |
|---|---|
| Việc của tôi / task list | `get_my_issues` |
| Tạo task giao X | `create_issue` |
| Chuyển Done (NV) | `update_issue_state` → In Review + output |
| Admin duyệt task | (callback/FE) `POST .../review` — không invent tool |
| Xin nghỉ / remote | **`submit_leave_request`** |
| Check-in | `check_in_out` |
| Lịch họp | `schedule_meeting` |
| Đăng ký NV mới | Telegram `/register` → API register (pending) — **không** upsert active |

---

## 6. Response format MCP

Mọi tool return:

```json
{
  "content": [{ "type": "text", "text": "Markdown readable for human" }]
}
```

Lỗi: throw `McpError` với `ErrorCode.InvalidParams | InvalidRequest | InternalError`.

---

## 7. File map (sửa tool ở đâu)

```
storymeeteam-mcp/src/
  index.ts                 # list tools, executeMcpTool, NATS, auth
  mcp/tools/
    planeTools.ts          # Kanban/tasks
    hrTools.ts             # leave, payroll, meeting, member
    attendanceTools.ts     # check-in
  telegram/handlers/       # message + callback → executeMcpTool
  telegram/commands/       # /register, forms
```

FE pair:

```
StorymeeTeam/src/lib/leaveApi.ts
StorymeeTeam/src/app/features/hr/components/LeaveRequestForm.tsx
StorymeeTeam/docs/SYSTEM_GUIDE.md
```

---

## 8. Adding a new tool (checklist)

1. Schema + `execute*` trong đúng file plane/hr/attendance  
2. Register trong `index.ts` allTools / switch  
3. Document trong **this file** §3  
4. Nếu mutation shared với FE → ghi contract §4-style  
5. Test: MCP call + (nếu có) FE button cùng body  
6. NATS notify nếu admin/user cần biết  

---

## 9. Anti-patterns

| Cấm | Lý do |
|---|---|
| Gọi legacy `POST /omnitask` create task | 410 frozen |
| PATCH Done thay review admin | Miss reviewedAt/NATS |
| Register = upsert active | Bypass admin |
| Double path leave (khác body FE/bot) | Drift |
| Hardcode role `=== 'admin'` | Dùng isTeamAdmin |

---

## 10. Verify routes (bắt buộc trước deploy)

```bash
cd 2-MCP-Core/storymeeteam-mcp
node scripts/verify_tool_routes.js
# optional: BASE_URL=https://dev-hub.storymee.com node scripts/verify_tool_routes.js
```

Probe chấp nhận: **200** (GET list), **400** (POST thiếu field = route có), **404** (id giả), **410** legacy frozen.  
**Fail** nếu GET/POST chính trả **404 Route not found**.

```bash
# Leave smoke
curl -sS -X POST http://localhost:4503/internal/v1/team/hr/leave-requests \
  -H 'Content-Type: application/json' \
  -d '{"memberId":"<uuid>","leaveType":"annual","startDate":"2026-07-20T00:00:00.000Z","endDate":"2026-07-20T23:59:59.000Z","reason":"smoke"}'
```

---

## 11. Audit 2026-07-17 — findings & fixes

| Issue | Risk | Fix |
|---|---|---|
| `check_in_out` enum không có `checkout` | LLM không check-out được | Schema + action checkout |
| Thiếu `review_issue` tool | Admin MCP không duyệt output | Added → POST `/review` |
| Thiếu `approve_leave_request` | Admin MCP không duyệt phép | Added |
| Thiếu list leave / broadcast | Agent invent route 404 | `list_leave_requests`, `broadcast_announcement` |
| `update_personal_info` không `mode:self` | Có thể ghi đè status | mode:self |
| LLM gọi `create_task` / `get_my_tasks` | Unknown tool | TOOL_ALIASES map |
| Wrong paths `/hr/leaves`, `/plane/tasks` | 404 | Documented cấm; verify script asserts 404 |

**Route probe result:** 24/24 passed against `core-team-api:4503`.


## 12. Latency (Telegram LLM)

| Tối ưu | Chi tiết |
|---|---|
| **AI host = core-ai-api Ubuntu** | `OMNIROUTER_API_URL=.../internal/v1/ai/team/chat` — **không FE** |
| Skip Flash intent | Heuristic `fastIntent.ts` (mặc định) |
| Skip Letta | Always on core-ai-api team-chat |
| Slim HR | Counters trên currentUser |
| Cache | members 5m, projects 3m, issues 25s |
| History | 6 turns |
| `/cong_viec` | Fast path không LLM |
| Model | `gemini-2.5-flash` (TEAM_CHAT_GEMINI_MODEL) |
| Timeout | TELEGRAM_LLM_TIMEOUT_MS=35000 |

Log bot: `[Telegram LLM] intent=... latency=...ms`  
Log AI: `[TeamChat] source=telegram model=... latency=...ms`

### OMNIROUTER_API_URL (Ubuntu)

```bash
# Cùng máy hub
OMNIROUTER_API_URL=http://127.0.0.1:5100/internal/v1/ai/team/chat
# Direct core-ai-api
OMNIROUTER_API_URL=http://127.0.0.1:4600/internal/v1/ai/team/chat
```
