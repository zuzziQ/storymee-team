---
type: architecture
title: Team HR Profile vs Account API — Domain Split
description: Hồ sơ nhân sự nội bộ (StorymeeTeam) không nằm trong core-account-api. Map DB + service ownership.
tags: [core-team-api, core-account-api, TeamMember, User, HR]
---

# Team HR Profile vs Account API

**Ngày:** 2026-07-17  
**Câu hỏi:** Hồ sơ nhân sự nội bộ lưu ở đâu — account-api hay team-api? Cách sắp xếp DB đúng?

---

## 1. Kết luận ngắn (SSOT)

| Domain | Service | Bảng | Dùng cho |
|---|---|---|---|
| **Product identity** (app StoryMee, parent/kid, JWT) | **`core-account-api` :4502** | `users`, `workspace_members`, `universes` (ipId) | Login app, workspace content, media/jobs partition |
| **Internal HR / Team ops** (StorymeeTeam, Telegram bot) | **`core-team-api` :4503** | `omni_team_members` (`TeamMember`) | Hồ sơ NV, chấm công, phép, lương, assignee PlIssue, Telegram |
| **Kanban work** | **`core-team-api` :4503** | `pl_issues`, `pl_projects`, `pl_states` | Task lifecycle FE + Telegram |

**Hồ sơ nhân sự nội bộ KHÔNG thuộc account-api.**  
StorymeeTeam FE đã đúng khi gọi:

```
POST /internal/v1/team/hr/team-members  →  HrService.upsertTeamMember  →  omni_team_members
```

`GET /internal/v1/account/profile` là **profile user app StoryMee** (media stats, workspaces), không phải payroll/Telegram/leave.

---

## 2. Vì sao tách 2 bảng?

```
┌─────────────────────────────────────────────────────────────┐
│  PRODUCT  (StoryMee World / Hub / Mobile)                   │
│  users ─── workspace_members ─── universes (ipId)           │
│  core-account-api :4502                                     │
│  • email + passwordHash / guest                             │
│  • role: user | admin (app)                                 │
│  • child profiles, subscription                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  INTERNAL OPS  (StorymeeTeam + Telegram Bot)                │
│  omni_team_members ─── attendance / leave / pl_issues       │
│  core-team-api :4503                                        │
│  • fullName, telegram*, bank*, salary, leave quotas         │
│  • role: Founder | IT Admin | developer | …                 │
│  • assignee của PlIssue                                     │
└─────────────────────────────────────────────────────────────┘

Optional soft-link (tương lai, không bắt buộc ngay):
  omni_team_members.email  ==  users.email
  → SSO “một email” nhưng domain data vẫn tách
```

**Lý do không nhét HR vào `users`:**

1. Account-api phục vụ **khách hàng / end-user** (scale, guest, devices) — không chứa bank account, salaryGross.
2. TeamMember có lifecycle **nội bộ** (active employee, remote quota) khác user app.
3. Telegram bot định danh bằng `telegramUsername` / `telegramChatId` — không thuộc product auth.
4. Compliance: payroll data không nên đi cùng API path public account.

---

## 3. Map field hồ sơ nhân sự (đúng chỗ)

| Field | Bảng | API |
|---|---|---|
| fullName, email, phone | `omni_team_members` | `POST /team/hr/team-members` |
| telegramUsername, telegramChatId | `omni_team_members` | same |
| bankName, bankAccount | `omni_team_members` | same |
| salaryGross, dependentCount | `omni_team_members` | same |
| workArrangement, annualLeave*, remote* | `omni_team_members` | same |
| role (Founder / IT Admin / …) | `omni_team_members` | same + `isTeamAdmin()` |
| skills[], isActive | `omni_team_members` | same |
| JWT login app, password | `users` | account-api auth |
| workspace / ipId content | `workspace_members` | account-api workspaces |
| task assignee | `pl_issues.assignee_id` → TeamMember | plane API |

FE `useAuthState.handleSaveMyProfile` → **team-api** ✅ (không gọi account profile).

---

## 4. account-api còn gì liên quan “profile”?

```
GET /internal/v1/account/profile   → users + media/job stats + workspace count
GET /internal/v1/account/me        → JWT identity
GET /internal/v1/account/workspaces
```

Dùng cho **hub-frontend / mobile StoryMee**, **không** cho tab HR StorymeeTeam.

Leftover cookie/keys trong account-api repo: đã chuyển **worker-pool** — không liên quan HR.

---

## 5. Sắp xếp đề xuất (không migrate gấp)

### Hiện tại (giữ)

- HR + Kanban + Attendance: **core-team-api** + Prisma shared DB.
- Product users: **core-account-api**.

### Tùy chọn sau (nếu cần SSO)

1. Thêm cột nullable `omni_team_members.user_id` → FK `users.id` (link khi email trùng).
2. Login StorymeeTeam có thể dùng JWT account-api, rồi resolve TeamMember by email.
3. **Không** chuyển salary/telegram sang bảng `users`.

### Không làm

- ❌ Gộp TeamMember vào User  
- ❌ Lưu payroll trên account-api  
- ❌ Dùng `workspace_members` làm org chart nhân sự  
- ❌ Coi free user là Organization — xem [multi-tenant-crm.md](../world/multi-tenant-crm.md)

---

## 6. Routing Hub (nhắc)

| Path | Service |
|---|---|
| `/internal/v1/account/*` (login, me, profile, workspaces) | account-api :4502 |
| `/internal/v1/team/hr/*` | team-api :4503 |
| `/internal/v1/team/plane/*` | team-api :4503 |
| `/internal/v1/account/cookies|keys|rotation` | **worker-pool** :4508 (không phải account) |

---

## 7. Checklist khi sửa hồ sơ NV

1. Chỉ touch `HrService.upsertTeamMember` / `TeamMember` model.  
2. FE StorymeeTeam: `API_ROUTES.HR.TEAM_MEMBERS`.  
3. Telegram register: cùng endpoint team-members.  
4. Admin detect: `isTeamAdmin` trên **TeamMember.role/email**, không dùng `users.role`.  
5. Nếu cần “user app cũng là NV”: soft-link email, không merge schema.
