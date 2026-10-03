# StorymeeTeam

Hệ thống quản trị nội bộ AIFA / Storymee bao gồm Portal Quản trị (Frontend), Core Team API (Backend Fastify), StorymeeTeam MCP & Telegram Bot.

## Cấu trúc Repository (Unified Monorepo)

```
storymee-team/
├── frontend/               # Next.js 16 Web Portal (HR, Attendance, Kanban, Meetings, AI Chat)
├── backend/                # Fastify 5 REST API (core-team-api :4503, Prisma, NATS, Socket.io)
├── mcp/                    # MCP Server & Telegram Bot Companion (storymeeteam-mcp :4504)
├── docs/                   # Tài liệu kiến trúc SSOT, API guide & roadmap
└── skills/                 # Agent Skills & UI Design System
```

## Các Dịch Vụ Chính

| Dịch vụ | Công nghệ | Cổng mặc định | Thư mục |
|---------|-----------|---------------|---------|
| **Frontend** | Next.js 16, React 19, Tailwind 4 | `3010` | `frontend/` |
| **Backend** | Fastify 5, TypeScript, Prisma | `4503` | `backend/` |
| **MCP / Telegram Bot** | Fastify 5, MCP SDK, node-telegram-bot-api | `4504` | `mcp/` |

---

## Hướng Dẫn Cài Đặt & Chạy

### 1. Frontend (Web Portal)
```bash
cd frontend
npm install
npm run dev   # Mở http://localhost:3010
```
Env tham khảo: `frontend/.env.example`

### 2. Backend (core-team-api)
```bash
cd backend
npm install
npm run dev   # Port 4503
```
Env tham khảo: `backend/.env.example`

### 3. MCP & Telegram Bot (storymeeteam-mcp)
```bash
cd mcp
npm install
npm run dev   # Port 4504
```
Env tham khảo: `mcp/.env.example`

---

## Chi nhánh (Branches)

- **`main`**: Nhánh chính chứa toàn bộ mã nguồn hợp nhất (Frontend, Backend, MCP, Docs, Skills).
- **`main-before-history-purge`**: Lưu giữ đầy đủ hơn 230+ commits lịch sử phát triển chi tiết từ giai đoạn ban đầu.
- **`polyrepo/core-team-api`**: Nhánh lưu trữ lịch sử commit độc lập của microservice Backend `core-team-api`.
- **`polyrepo/storymeeteam-mcp`**: Nhánh lưu trữ lịch sử commit độc lập của dịch vụ `storymeeteam-mcp`.
