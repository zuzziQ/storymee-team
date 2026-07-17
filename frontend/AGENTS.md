---
type: docs
title: AGENTS
description: OKF standardized document for AGENTS in project StorymeeTeam.
tags: [StorymeeTeam]
related_files: [file:///C:/storymee/1-Harness-Apps/StorymeeTeam/AGENTS.md]
---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## StorymeeTeam — Agent scope (NOW)

### Bắt buộc đọc trước
- **Master:** `docs/SYSTEM_GUIDE.md` — toàn bộ luồng, readiness, API map
- **Plan:** `00-Ecosystem-Docs/01-architecture/team/team-roadmap.md`
- **Task SSOT:** `team-work-management.md` — PlIssue only
- **Account:** `team-internal-accounts.md`
- **HR vs product user:** `team-hr-vs-account.md`

### UI/UX
- Skill: `storymee/.agents/skills/storymeeteam-ui/SKILL.md` (+ `premium-ui` cho tokens/animation)
- Dark glass internal tool — không redesign school portal

### MCP / Telegram tools
- **Tool calling SSOT:** `2-MCP-Core/storymeeteam-mcp/docs/MCP_TOOL_CALLING.md`
- Leave/task mutations must match FE contracts documented there

### Cấm scope
- Organization/School/CRM code (design only: `multi-tenant-crm.md`)
- Lưu hồ sơ NV vào account-api `users`
- Legacy OmniTask create (410)

App name stays **StorymeeTeam**.
