#!/usr/bin/env node
/**
 * Verify MCP tool → backend route matrix.
 * Usage: node scripts/verify_tool_routes.js
 *        BASE_URL=http://localhost:4503 node scripts/verify_tool_routes.js
 */
const BASE = (process.env.BASE_URL || 'http://localhost:4503').replace(/\/$/, '');

/** Expected route existence: method + path → acceptable status (not 404) */
const ROUTE_MATRIX = [
  ['GET', '/internal/v1/team/health', [200]],
  ['GET', '/internal/v1/team/plane/issues', [200]],
  ['GET', '/internal/v1/team/plane/projects', [200]],
  ['POST', '/internal/v1/team/plane/issues', [400]], // missing fields = route exists
  ['PATCH', '/internal/v1/team/plane/issues/00000000-0000-0000-0000-000000000001', [404]],
  ['POST', '/internal/v1/team/plane/issues/00000000-0000-0000-0000-000000000001/review', [400]],
  ['POST', '/internal/v1/team/plane/issues/00000000-0000-0000-0000-000000000001/request-archive', [404]],
  ['GET', '/internal/v1/team/hr/team-members', [200]],
  ['POST', '/internal/v1/team/hr/team-members', [400]],
  ['POST', '/internal/v1/team/hr/team-members/register', [400]],
  ['GET', '/internal/v1/team/hr/leave-requests', [200]],
  ['POST', '/internal/v1/team/hr/leave-requests', [400]],
  ['POST', '/internal/v1/team/hr/leave-requests/00000000-0000-0000-0000-000000000001/approve', [404]],
  ['POST', '/internal/v1/team/hr/attendance/checkin', [400]],
  ['POST', '/internal/v1/team/hr/attendance/checkout', [400]],
  ['GET', '/internal/v1/team/hr/attendance', [200]],
  ['GET', '/internal/v1/team/hr/meetings', [200]],
  ['POST', '/internal/v1/team/hr/meetings', [400]],
  ['PATCH', '/internal/v1/team/hr/meetings/00000000-0000-0000-0000-000000000001', [500, 404]],
  ['GET', '/internal/v1/team/hr/announcements', [200]],
  ['POST', '/internal/v1/team/hr/announcements', [400]],
  // must NOT exist
  ['POST', '/internal/v1/team/hr/leaves', [404]],
  ['POST', '/internal/v1/team/plane/tasks', [404]],
  ['POST', '/internal/v1/team/omnitask/', [410]],
];

/** Tool → primary route (documentation check) */
const TOOL_ROUTE_MAP = {
  get_my_issues: 'GET /plane/issues',
  create_issue: 'POST /plane/issues',
  create_project: 'POST /plane/projects',
  update_issue: 'PATCH /plane/issues/:id',
  update_issue_state: 'PATCH /plane/issues/:id',
  assign_issue: 'PATCH /plane/issues/:id',
  get_issue_details: 'GET /plane/issues',
  breakdown_issue: 'POST /plane/issues + FE /api/ai/breakdown',
  update_sub_issues: 'POST/PATCH /plane/issues',
  request_issue_approval: 'POST /plane/issues/:id/request-archive',
  approve_issue_request: 'PATCH /plane/issues/:id',
  review_issue: 'POST /plane/issues/:id/review',
  submit_leave_request: 'POST /hr/leave-requests',
  list_leave_requests: 'GET /hr/leave-requests',
  approve_leave_request: 'POST /hr/leave-requests/:id/approve',
  get_leave_allowance: 'GET /hr/leave-requests + TeamMember',
  check_in_out: 'POST /hr/attendance/checkin|checkout',
  get_attendance_report: 'GET /hr/attendance',
  schedule_meeting: 'POST /hr/meetings',
  update_meeting: 'PATCH /hr/meetings/:id',
  broadcast_announcement: 'POST /hr/announcements',
  update_personal_info: 'POST /hr/team-members mode:self',
  upsert_team_member: 'POST /hr/team-members',
  get_my_payroll_slip: 'local compute (no route)',
};

async function hit(method, path) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' || method === 'HEAD' ? undefined : '{}',
  });
  return res.status;
}

async function main() {
  console.log(`\n🔍 verify_tool_routes BASE=${BASE}\n`);
  let ok = 0, fail = 0;

  for (const [method, path, accept] of ROUTE_MATRIX) {
    try {
      const code = await hit(method, path);
      const pass = accept.includes(code);
      if (pass) {
        ok++;
        console.log(`  ✅ ${method} ${code} ${path}`);
      } else {
        fail++;
        console.log(`  ❌ ${method} ${code} ${path} (expected one of ${accept.join(',')})`);
      }
    } catch (e) {
      fail++;
      console.log(`  ❌ ${method} ERR ${path} ${e.message}`);
    }
  }

  console.log(`\n📋 Tool → route map (${Object.keys(TOOL_ROUTE_MAP).length} tools):`);
  for (const [tool, route] of Object.entries(TOOL_ROUTE_MAP)) {
    console.log(`  • ${tool.padEnd(28)} → ${route}`);
  }

  console.log(`\n——— Route probe: ${ok} passed, ${fail} failed ———\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
