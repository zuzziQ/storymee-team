---
type: plan
title: StorymeeTeam — Kế hoạch triển khai (Now → Future)
description: Plan làm việc thực tế. Phase hiện tại CHỈ sửa StorymeeTeam (thông luồng FE+Telegram, cấu trúc future-proof). Organization/CRM để phase sau.
tags: [StorymeeTeam, roadmap, plan, core-team-api, telegram]
related_files:
  - file:///Users/imam/storymee/00-Ecosystem-Docs/01-architecture/team/team-work-management.md
  - file:///Users/imam/storymee/00-Ecosystem-Docs/01-architecture/team/team-hr-vs-account.md
  - file:///Users/imam/storymee/00-Ecosystem-Docs/01-architecture/world/multi-tenant-crm.md
  - file:///Users/imam/storymee/1-Harness-Apps/StorymeeTeam
---

# StorymeeTeam — Kế hoạch triển khai (Roadmap Plan)

**Phiên bản:** 1.0
**Ngày:** 2026-07-17
**Chủ sở hữu app:** StorymeeTeam (tên **giữ nguyên**, không rename Console)
**Phạm vi ngay bây giờ:** Chỉ **StorymeeTeam + core-team-api + storymeeteam-mcp** — thông luồng và đúng cấu trúc tương lai.
**Ngoài scope ngay:** Organization/School CRM, free-user product multi-tenant (chỉ giữ design, chưa code).

---

## 1. Mục tiêu tổng quát

| Mục tiêu | Ý nghĩa |
|---|---|
| **Thông luồng** | FE và Telegram/MCP thao tác task/HR cùng 1 SSOT, không lệch state/notify |
| **Đúng cấu trúc tương lai** | Tách rõ TeamMember (nội bộ) vs User product; task = PlIssue; không dual-write legacy |
| **Không đụng org/CRM code** | Design multi-tenant đã chốt trong doc riêng; implement spine org = phase sau |
| **Giữ tên StorymeeTeam** | Internal ops platform staff; Tenants/CRM chỉ là module sau, không đổi brand |

### Nguyên tắc làm việc phase hiện tại

1. Mọi mutation Kanban/task → `/internal/v1/team/plane/*`
2. Profile NV / HR → `/internal/v1/team/hr/*` → `omni_team_members`
3. Telegram/MCP chỉ là **client** của cùng API (không DB song song)
4. Notify admin/assignee qua **NATS** (không dual spam)
5. **Không** tạo Organization / không refactor account-api cho school trong phase này
6. Code StorymeeTeam tránh hardcode logic sẽ phá multi-tenant sau (vd. không nhét school vào TeamMember)

---

## 2. Bản đồ phase

```
NOW ──────────────► NEXT ──────────────► LATER
P0/P1               P2                   P3+
StorymeeTeam        Hardening            Organization + CRM
thông luồng         UX + auth            (design đã chốt)
+ structure         + seed admin
+ freeze legacy
```

| Phase | Tên | Scope chính | Status |
|:---:|---|---|---|
| **P0** | Foundation SSOT | Docs + unify lifecycle + freeze legacy + smoke | **Sprint A** |
| **P1** | StorymeeTeam solid | Auth team, account lifecycle, admin UI, README | **Sprint B** |
| **P2** | Hardening nội bộ | Realtime, leave/HR parity, E2E CI, dọn legacy read | Sau P1 |
| **P3** | Org spine | `organizations` + API (account-api) — **không block StorymeeTeam** | Sau khi team ổn |
| **P4** | StorymeeTeam Tenants tab | Read-only list org (platform staff) | Sau P3 |
| **P5** | CRM | Pipeline school leads | Xa |

> **Làm việc tuần này / giai đoạn hiện tại = chỉ P0 + P1.**
> P3–P5: đọc `multi-tenant-crm.md`, **không implement** trừ khi chốt kickoff riêng.

---

## 3. Phase P0 — Foundation SSOT (đã làm / còn verify)

**Mục tiêu:** Một lifecycle task, không dual-write, docs SSOT.

### 3.1. Đã hoàn thành

| Hạng mục | Chi tiết | Repo |
|---|---|---|
| SSOT task docs | `team-work-management.md` | Ecosystem-Docs |
| HR vs account docs | `team-hr-vs-account.md` | Ecosystem-Docs |
| Multi-tenant design (chưa code) | `multi-tenant-crm.md` | Ecosystem-Docs |
| Backend review/submit NATS | Detect In Review; `POST /review`; `request-archive` PlIssue | core-team-api |
| `isTeamAdmin` | Email allowlist + role keywords | core-team-api |
| Freeze legacy write | 410 trên OmniTask create / SubTask create / legacy archive | core-team-api |
| Telegram submit/review | `status: in_review`; `POST /review`; bớt dual-notify | storymeeteam-mcp |
| FE archive path | `/plane/issues/:id/request-archive` | StorymeeTeam |
| Status vocabulary | `src/lib/taskStatus.ts` | StorymeeTeam |
| Smoke E2E | `core-team-api/scripts/smoke_issue_lifecycle.js` (19/19 local) | core-team-api |

### 3.2. Checklist P0 (Sprint A)

- [x] Restart local `core-team-api` + `storymeeteam-mcp`
- [x] Smoke issue lifecycle local (18–19/19)
- [x] Seed admin email allowlist (IT Admin / active)
- [ ] Smoke trên `dev-hub` / staging (khi deploy remote)
- [ ] Manual QA 2 chiều FE↔Telegram trên máy user

**Definition of Done P0:** FE ↔ Telegram cùng PlIssue lifecycle; không tạo task ghost Omni.

---

## 4. Phase P1 — StorymeeTeam solid (ưu tiên làm tiếp)

**Mục tiêu:** App StorymeeTeam ổn định, cấu trúc code future-proof, HR đúng chỗ, không còn “lệch 2 client”.

### 4.1. Backend (core-team-api) — chỉ team domain

| # | Việc | Ghi chú |
|---|---|---|
| B1 | Env `TEAM_ADMIN_EMAILS` trên mọi môi trường | Đồng bộ FE hardcode → config dần |
| B2 | `createIssue` publish `core.team.issue.created` (optional notify assignee) | Parity assign |
| B3 | Freeze/log `OmniTaskGraph` nếu còn gọi ngầm tạo SubTask | Tránh backdoor legacy |
| B4 | GET issues filter + pagination (nếu list lớn) | Performance Kanban |
| B5 | Không thêm route Organization trong team-api | Org thuộc account/tenant sau |

### 4.2. Frontend StorymeeTeam

| # | Việc | Ghi chú |
|---|---|---|
| F1 | Feature-driven polish: `features/*/index.ts` public API | Theo `project-structure.md` |
| F2 | Admin check: 1 helper `isTeamAdmin(user)` (email + role), bỏ rải hardcode 3 email | Align backend |
| F3 | Auth: load activeUser từ API `team-members` sau login (không chỉ TEAM constant) | Đúng DB |
| F4 | README project: mô tả tabs, API base, ports (thay template Next) | Onboarding |
| F5 | Error UX: toast khi PATCH/POST fail (archive, review, submit) | Tránh silent fail |
| F6 | Socket: refresh list khi `issue_updated` (giảm phụ thuộc poll 15s) | Realtime |
| F7 | **Không** UI Tenants/CRM trong P1 | Để P4 |

### 4.3. Telegram / MCP (storymeeteam-mcp)

| # | Việc | Ghi chú |
|---|---|---|
| T1 | Restart MCP sau deploy team-api | NATS + review path mới |
| T2 | Mọi create task chỉ `POST /plane/issues` | Đã phần lớn; audit formSession create |
| T3 | Leave/approve admin filter = `isTeamAdmin` | Đã partial; verify production |
| T4 | Identity: chatId + username (đã partial) | Test user đổi @username |
| T5 | Không gọi legacy `/omnitask` POST create | Expect 410 → message hướng dẫn |

### 4.4. HR / Profile (đúng chỗ tương lai)

| # | Việc | Ghi chú |
|---|---|---|
| H1 | Profile chỉ `POST /hr/team-members` | Đã đúng — không chuyển account-api |
| H2 | Document trong README StorymeeTeam: TeamMember ≠ User app | Tránh agent nhầm |
| H3 | Map field hồ sơ (bank, leave, telegram) smoke test | Upsert + re-fetch |
| H4 | **Không** soft-link User trong P1 | Optional P2+ |

### 4.5. Checklist P1 (Sprint B) — 2026-07-17

- [x] `teamAuth.ts` + isTeamAdmin (email/role)
- [x] Login gate `GET /hr/auth/lookup` (chỉ active)
- [x] Register → pending + admin approve/reject/suspend
- [x] Self profile update `mode: self`
- [x] FE HR tab **Tài khoản nội bộ**
- [x] Telegram register pending + gate bot
- [x] README StorymeeTeam + `team-internal-accounts.md`
- [x] Toast (react-hot-toast) layout
- [ ] Feature `index.ts` public API từng module (incremental)
- [ ] QA staging remote

**Definition of Done P1:** Account lifecycle rõ; admin duyệt trước khi vào app; update/khoá hoạt động.

---

## 5. Phase P2 — Hardening nội bộ (sau P1)

| # | Việc |
|---|---|
| R1 | Leave request: FE + Telegram cùng NATS admin fan-out (verify Founder nhận) |
| R2 | Meetings/announcements parity FE ↔ bot |
| R3 | Migrate **read** paths còn đụng SubTask (handover leave?) sang PlIssue nếu còn dùng production |
| R4 | Script migrate optional: SubTask cũ → PlIssue (one-shot, có backup) |
| R5 | Rate limit / auth JWT cho team API nếu mở public URL |
| R6 | Soft-link `TeamMember.email` ↔ `users.email` (SSO StorymeeTeam) — optional |

**DoD P2:** Legacy tables chỉ archive/historical; mọi flow team production đi Plane + TeamMember.

---

## 6. Phase P3+ — Ngoài StorymeeTeam core (chỉ plan, chưa làm)

Chi tiết đầy đủ: [`multi-tenant-crm.md`](../world/multi-tenant-crm.md)

| Phase | Việc | Phụ thuộc |
|---|---|---|
| **P3 Org spine** | Prisma Organization/OrgMember/OrgWorkspace + API `/internal/v1/orgs` | account-api; **không** block P0–P2 |
| **P4 Tenants UI** | Tab trong StorymeeTeam (isTeamAdmin): list schools | P3 |
| **P5 CRM** | Leads/deals gắn `organizationId` | P3–P4 |

### Quyết định đã chốt (nhắc)

- School = Organization
- Free user **không** là Organization
- StorymeeTeam **giữ tên**
- Personal = `users` + ipId

**Cấm trong P0–P2:** implement org tables “vì sợ thiếu” nếu chưa onboard school thật — chỉ giữ design.

---

## 7. Cấu trúc thư mục StorymeeTeam mục tiêu (P1)

Không big-bang rewrite; incremental:

```
src/
├── app/
│   ├── page.tsx                 # shell tabs
│   ├── login/
│   ├── api/ai/                  # AI routes (breakdown, chat)
│   └── features/
│       ├── dashboard/
│       ├── projects/
│       ├── kanban/
│       ├── chat/
│       ├── hr/
│       ├── meetings/
│       ├── omnirouter/          # admin only
│       └── shared/
│           ├── components/
│           ├── hooks/           # useAppState orchestrator
│           └── index.ts         # public exports (P1)
├── lib/
│   ├── apiClient.ts             # browser base /api/v1/team + Team JWT
│   ├── taskStatus.ts            # SSOT status map
│   └── teamAuth.ts              # isTeamAdmin helper (P1)
└── ...
```

**Cấm P1:** folder `organizations/` hoặc call account workspaces cho HR.

---

## 8. API map “được / cấm” (StorymeeTeam clients)

| Được (SSOT) | Cấm (legacy / wrong domain) |
|---|---|
| `GET/POST/PATCH /plane/issues` | `POST /omnitask/` create task |
| `POST /plane/issues/:id/review` | `PATCH status=done` thay review |
| `POST /plane/issues/:id/request-archive` | `POST /hr/tasks/:id/request-archive` |
| `GET/POST /hr/team-members` | `POST /account/profile` cho hồ sơ NV |
| `GET/POST /hr/attendance/*` | Ghi `omni_sub_tasks` mới |
| `GET/POST /hr/leave-requests*` | — |
| `GET/POST /hr/meetings` | — |

Base URL FE: `NEXT_PUBLIC_API_URL` → Hub + consumer prefix `/api/v1/team` và `Authorization: Bearer <Team JWT>`.

`/internal/v1/team/*` chỉ dành cho Telegram/MCP hoặc service trong trusted mesh, bắt buộc `STORYMEE_SERVICE_API_KEY`. Browser không được gọi namespace này.

---

## 9. Thứ tự công việc đề xuất (sprint-style)

### Sprint A — Đóng P0 trên môi trường thật

1. Restart/deploy core-team-api + storymeeteam-mcp
2. Seed admin production
3. Smoke + manual QA 2 chiều FE/Telegram
4. Fix bug còn sót (nếu có)

### Sprint B — P1 FE structure + auth

1. `teamAuth.ts` + thay hardcode admin
2. Load user từ API sau login
3. Toast errors + socket refresh
4. README

### Sprint C — P1 backend/MCP parity

1. Audit formSession Telegram create path
2. issue.created notify
3. Freeze OmniTaskGraph backdoor
4. Smoke trong ops checklist

### Sau đó

- P2 hardening hoặc kickoff P3 org (quyết định product riêng)
- [ ] **[Backlog] Tạo workflow tạo public URL cho Landing Page**
  - **Mô tả:** Xây dựng workflow tự động sinh & quản lý Public URL cho các Landing Page (Public Routing qua Gateway/CDN, quản lý trạng thái Draft/Published, tích hợp trigger từ UI & Telegram Bot).

---

## 10. Rủi ro & mitigation

| Rủi ro | Mitigation |
|---|---|
| MCP/bot vẫn cache code cũ | Restart PM2 `storymeeteam-mcp` sau mọi deploy team-api |
| DB không có admin → review 403 | Seed + smoke bootstrap; checklist P0 |
| Form Telegram cũ tạo OmniTask | 410 + message; audit T2 |
| Agent AI nhầm sửa account-api cho HR | Docs H2 + AGENTS pointer |
| Scope creep Organization | Plan này: P3+ blocked until explicit kickoff |

---

## 11. Tài liệu liên quan (đọc theo việc)

| Việc | Doc |
|---|---|
| Task lifecycle FE+Telegram | [`team-work-management.md`](./team-work-management.md) |
| Hồ sơ NV vs account | [`team-hr-vs-account.md`](./team-hr-vs-account.md) |
| School/org/CRM (sau) | [`multi-tenant-crm.md`](../world/multi-tenant-crm.md) |
| Feature folder chuẩn | [`project-structure.md`](../world/project-structure.md) |
| Hub ports | [`gateway-and-clients.md`](../gateway/gateway-and-clients.md) |

---

## 12. Tóm tắt một dòng

> **Hiện tại:** chỉ làm StorymeeTeam thông luồng (PlIssue + TeamMember + NATS) và structure sạch.
> **Chưa làm:** Organization / free-tenant CRM.
> **Tên app:** StorymeeTeam giữ nguyên.

---

## 13. Changelog plan

| Ngày | Thay đổi |
|---|---|
| 2026-07-17 | v1.0 — Tạo plan; P0 partial done; P1 next; P3+ deferred design-only |
| 2026-07-29 | v1.1 — Bổ sung task Backlog: "Tạo workflow tạo public URL cho Landing Page" |

