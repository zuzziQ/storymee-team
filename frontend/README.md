# StorymeeTeam

Cổng **quản trị nội bộ** AIFA / Storymee (HR, Kanban, Meetings, Telegram bot companion).

**Tên app giữ nguyên** — không phải multi-tenant school CRM (xem roadmap ecosystem).

## Documentation (start here)

| Doc | For |
|---|---|
| **[docs/SYSTEM_GUIDE.md](./docs/SYSTEM_GUIDE.md)** | **Master** — architecture, all flows, readiness, API |
| Ecosystem catalog | `00-Ecosystem-Docs/00-index/DOC_MAP.md` |
| Work mgmt SSOT | `00-Ecosystem-Docs/01-architecture/team/team-work-management.md` |
| MCP tools | `2-MCP-Core/storymeeteam-mcp/docs/MCP_TOOL_CALLING.md` |
| Ecosystem plan | `00-Ecosystem-Docs/01-architecture/team/team-roadmap.md` |
| UI skill | `.agents/skills/storymeeteam-ui/SKILL.md` |

**Prod:** FE https://storymee-team.vercel.app · API https://dev-hub.storymee.com

## Quick start

```bash
npm install
npm run dev    # http://localhost:3010
```

Env (`.env.local`):

```env
NEXT_PUBLIC_API_URL=https://dev-hub.storymee.com
# optional admin list override:
# NEXT_PUBLIC_TEAM_ADMIN_EMAILS=a@x.com,b@y.com
```

API client tự gắn prefix `/internal/v1/team`.

## Tài khoản nội bộ (SSOT)

| | |
|---|---|
| **Bảng** | `omni_team_members` (`TeamMember`) |
| **Service** | `core-team-api` :4503 |
| **Không dùng** | `users` (account-api) — đó là product identity |

### Lifecycle

```
Telegram /register  →  account_status=pending  →  Admin duyệt  →  active
                                                      ↓
                                                   reject / suspend
```

| Status | Đăng nhập FE | Bot đầy đủ |
|---|---|---|
| `pending` | ❌ | ❌ (chỉ register) |
| `active` | ✅ | ✅ |
| `suspended` | ❌ | ❌ |
| `rejected` | ❌ | ❌ |

### API chính

```
GET  /hr/auth/lookup?q=email|telegram   # login gate (active only)
POST /hr/team-members/register          # self-register → pending
POST /hr/team-members                   # admin upsert / mode:self profile
POST /hr/team-members/:id/approve
POST /hr/team-members/:id/reject
POST /hr/team-members/:id/suspend
DELETE /hr/team-members/:id             # soft=suspend; ?hard=true
GET  /hr/team-members?status=all|pending|active
```

UI Admin: **HR → 🔐 Tài khoản nội bộ**

## Task / Kanban

SSOT: `pl_issues` via `/plane/*` — xem  
`00-Ecosystem-Docs/01-architecture/team/team-work-management.md`

## Plan

`00-Ecosystem-Docs/01-architecture/team/team-roadmap.md`

## Stack

Next.js 16 · React 19 · Tailwind 4 · socket.io-client · port **3010**
