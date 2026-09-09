---
type: architecture
title: StorymeeTeam Internal Account Lifecycle
description: Register → admin review → active; update/delete. SSOT omni_team_members.
tags: [StorymeeTeam, TeamMember, HR, auth]
---

# Internal Account Lifecycle (StorymeeTeam)

**SSOT:** bảng `omni_team_members` · service `core-team-api`
**Không** dùng `users` / account-api cho nhân sự nội bộ.

## Status machine

```
        register
           │
           ▼
       pending ──────admin reject────► rejected
           │
      admin approve
           │
           ▼
        active ◄────admin re-activate── suspended
           │
      admin suspend / soft-delete
           │
           ▼
       suspended
```

## Database columns (TeamMember)

| Column | Ý nghĩa |
|---|---|
| `email` | Unique login key |
| `full_name` | Họ tên |
| `telegram_username` / `telegram_chat_id` | Bot identity |
| `role` | Founder / IT Admin / Nhân viên… (isTeamAdmin) |
| `is_active` | Mirror operational flag (true iff active) |
| `account_status` | `pending` \| `active` \| `suspended` \| `rejected` |
| `account_note` | Ghi chú duyệt/từ chối/khoá |
| `reviewed_at` / `reviewed_by_id` | Audit admin |

### One-time login table

`team_login_tokens` liên kết FK tới `omni_team_members`. DB chỉ lưu SHA-256 hash, không lưu raw token. Token mặc định sống 10 phút, chỉ đổi được một lần và mọi token chưa dùng trước đó của cùng member bị revoke khi phát link mới.

## Flows

### Register (self)

1. Telegram `/register email Họ Tên` hoặc API `POST /hr/team-members/register`
2. Tạo row `account_status=pending`, `is_active=false`
3. NATS `core.team.account.registered` → admin Telegram buttons
4. **Không** đăng nhập FE / bot đầy đủ

### Admin approve / reject

- Web: HR → Tài khoản nội bộ
- Telegram: nút Duyệt / Từ chối
- API: `POST .../approve|reject` + `reviewerId` (must isTeamAdmin)
- NATS notify user nếu có `telegramChatId`

### Update profile

- Self: `POST /hr/team-members` + `mode: 'self'` — không đổi status/role/salary
- Admin: upsert full fields + optional `accountStatus`

### Delete

- Soft (default): `suspend` — vẫn giữ row, không login
- Hard: `DELETE ?hard=true` — có thể fail FK (attendance/tasks)

### Login

1. Telegram/MCP gọi `POST /internal/v1/team/auth/one-time/issue` bằng service credential.
2. Bot gửi `https://storymee-team.vercel.app/login#token=...`; fragment không đi vào HTTP/proxy log.
3. Browser gọi public bootstrap `POST /api/v1/team/auth/one-time/exchange`.
4. Backend consume token atomically và trả Team JWT có `actor=team`, `aud=storymee-team`.
5. Browser gọi `/api/v1/team/*` và Socket.IO `/api/v1/team/socket.io` bằng Team JWT; `/auth/me` là nguồn xác minh session.

Mọi quyết định phân quyền HTTP phải lấy actor từ Team JWT đã xác minh
(`request.teamMember`). Các trường `actorEmail`, `actorId`, `reviewerId`,
`viewerEmail` do browser gửi chỉ là dữ liệu tương thích và không được dùng để
leo thang quyền. Telegram/MCP chỉ được chỉ định actor khi request đã xác thực
bằng service credential.

`GET /hr/auth/lookup?q=` không phải endpoint đăng nhập và không được dùng để tạo session. Không dùng `lettaConversationId` hoặc `conv-<memberId>` làm token vì có thể đoán được.

Core AI `POST /internal/v1/ai/team/chat` là machine-to-machine và bắt buộc `STORYMEE_SERVICE_API_KEY`.

## Liên quan

- Plan: `team-roadmap.md`
- HR vs product: `team-hr-vs-account.md`
