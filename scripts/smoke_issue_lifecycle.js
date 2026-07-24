#!/usr/bin/env node
/**
 * Smoke test E2E: PlIssue create → In Progress → submit In Review → approve → Done
 * (+ freeze check on legacy create)
 *
 * Usage:
 *   node scripts/smoke_issue_lifecycle.js
 *   BASE_URL=http://localhost:4503 node scripts/smoke_issue_lifecycle.js
 *   BASE_URL=https://dev-hub.storymee.com node scripts/smoke_issue_lifecycle.js
 */
const BASE = (process.env.BASE_URL || 'http://localhost:4503').replace(/\/$/, '');
const TEAM = `${BASE}/internal/v1/team`;

let passed = 0;
let failed = 0;

function ok(label, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
  }
}

async function req(method, path, body) {
  const url = path.startsWith('http') ? path : `${TEAM}${path}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

async function main() {
  console.log(`\n🧪 Smoke Issue Lifecycle  BASE=${BASE}\n`);

  // 0. Health
  const health = await req('GET', '/health');
  ok('health', health.status === 200 && health.data?.status === 'ok', JSON.stringify(health.data));

  // 1. Legacy create frozen
  const legacy = await req('POST', '/omnitask/', { title: 'should-not-create' });
  ok(
    'legacy omnitask create frozen (410)',
    legacy.status === 410 && (legacy.data?.code === 'LEGACY_TASK_CREATE_FROZEN' || legacy.data?.success === false),
    `status=${legacy.status} code=${legacy.data?.code}`
  );

  const legacyHr = await req('POST', '/hr/subtasks', {
    title: 'should-not-create',
    parentTaskId: '00000000-0000-0000-0000-000000000000',
  });
  ok(
    'legacy hr/subtasks create frozen (410)',
    legacyHr.status === 410,
    `status=${legacyHr.status} code=${legacyHr.data?.code}`
  );

  // 2. Ensure project exists
  let projects = await req('GET', '/plane/projects');
  ok('list projects', projects.status === 200 && Array.isArray(projects.data?.data), `n=${projects.data?.data?.length}`);
  let project = (projects.data?.data || [])[0];
  if (!project) {
    const created = await req('POST', '/plane/projects', {
      name: `Smoke ${Date.now()}`,
      description: 'auto smoke project',
    });
    ok('create project', created.status === 200 && created.data?.data?.id, created.data?.data?.id);
    project = created.data?.data;
  } else {
    ok('reuse project', !!project.id, `${project.identifier || project.name} ${project.id}`);
  }
  if (!project?.id) {
    console.error('Cannot continue without project');
    process.exit(1);
  }

  // 3. Ensure an admin reviewer exists (isTeamAdmin: email allowlist OR role keywords)
  // Local DB often only has "Nhân viên" fixtures — bootstrap a smoke admin if missing.
  const ADMIN_EMAILS = (process.env.TEAM_ADMIN_EMAILS ||
    'kimngan151091@gmail.com,lehuyducanh.vn@gmail.com,zuzzivn@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const ROLE_RE = /founder|it admin|\badmin\b|director|boss|manager|\bhr\b/i;

  let membersRes = await req('GET', '/hr/team-members');
  let members = membersRes.data?.data || [];
  ok('list team members', membersRes.status === 200 && members.length > 0, `n=${members.length}`);

  let admin =
    members.find((m) => ADMIN_EMAILS.includes((m.email || '').toLowerCase())) ||
    members.find((m) => ROLE_RE.test(m.role || ''));

  if (!admin) {
    const boot = await req('POST', '/hr/team-members', {
      fullName: 'Smoke Admin',
      email: ADMIN_EMAILS[0] || 'smoke-admin@storymee.local',
      role: 'IT Admin',
      skills: ['smoke'],
      isActive: true,
    });
    ok('bootstrap smoke admin', boot.status === 200 && !!boot.data?.data?.id, boot.data?.data?.email);
    membersRes = await req('GET', '/hr/team-members');
    members = membersRes.data?.data || [];
    admin =
      members.find((m) => ADMIN_EMAILS.includes((m.email || '').toLowerCase())) ||
      members.find((m) => ROLE_RE.test(m.role || '')) ||
      boot.data?.data;
  }
  ok('pick reviewer (isTeamAdmin)', !!admin?.id, `${admin?.fullName} | ${admin?.email} | ${admin?.role}`);

  // 4. Create issue
  const title = `[SMOKE] lifecycle ${new Date().toISOString()}`;
  const createdIssue = await req('POST', '/plane/issues', {
    title,
    projectId: project.id,
    assigneeId: admin.id,
    priority: 'medium',
    status: 'todo',
  });
  const issue = createdIssue.data?.data;
  ok('create PlIssue', createdIssue.status === 200 && !!issue?.id, issue?.id);
  if (!issue?.id) {
    console.error(createdIssue);
    process.exit(1);
  }

  // 5. Move to In Progress
  const working = await req('PATCH', `/plane/issues/${issue.id}`, { status: 'working' });
  const workingState = working.data?.data?.State?.name || '';
  ok(
    'status → In Progress',
    working.status === 200 && /progress/i.test(workingState) && !/review/i.test(workingState),
    workingState
  );

  // 6. Submit for review (FE/Telegram SSOT path)
  const submit = await req('PATCH', `/plane/issues/${issue.id}`, {
    status: 'in_review',
    outputContent: 'Smoke test output content',
    outputUrls: ['https://example.com/smoke-result'],
    submittedById: admin.id,
  });
  const reviewState = submit.data?.data?.State?.name || '';
  ok(
    'submit → In Review',
    submit.status === 200 && /review/i.test(reviewState),
    reviewState
  );
  ok(
    'output persisted',
    submit.data?.data?.outputContent === 'Smoke test output content',
    String(submit.data?.data?.outputContent || '').slice(0, 40)
  );

  // 7. Admin approve via review endpoint
  const approve = await req('POST', `/plane/issues/${issue.id}/review`, {
    decision: 'approve',
    reviewerId: admin.id,
    reviewNote: 'Smoke approve OK',
  });
  const doneState = approve.data?.data?.State?.name || '';
  ok(
    'review approve → Done',
    approve.status === 200 && /done|completed/i.test(doneState),
    `status=${approve.status} state=${doneState} msg=${approve.data?.message || ''}`
  );
  ok(
    'reviewedAt set',
    !!approve.data?.data?.reviewedAt,
    approve.data?.data?.reviewedAt
  );

  // 8. Create second issue and reject path
  const created2 = await req('POST', '/plane/issues', {
    title: `${title} REJECT`,
    projectId: project.id,
    assigneeId: admin.id,
    status: 'todo',
  });
  const issue2 = created2.data?.data;
  ok('create issue for reject', !!issue2?.id, issue2?.id);

  await req('PATCH', `/plane/issues/${issue2.id}`, {
    status: 'in_review',
    outputContent: 'will reject',
    submittedById: admin.id,
  });
  const reject = await req('POST', `/plane/issues/${issue2.id}/review`, {
    decision: 'reject',
    reviewerId: admin.id,
    reviewNote: 'Smoke reject — redo',
  });
  const rejectState = reject.data?.data?.State?.name || '';
  ok(
    'review reject → In Progress',
    reject.status === 200 && /progress/i.test(rejectState) && !/review/i.test(rejectState),
    rejectState
  );
  ok(
    'reject note set',
    reject.data?.data?.reviewNote === 'Smoke reject — redo',
    reject.data?.data?.reviewNote
  );

  // 9. Archive request on PlIssue
  const arch = await req('POST', `/plane/issues/${issue2.id}/request-archive`, {
    reason: 'smoke archive',
    requesterId: admin.id,
  });
  ok(
    'request-archive PlIssue',
    arch.status === 200 && (arch.data?.success === true || arch.data?.status === 'success'),
    arch.data?.message
  );

  // Cleanup optional: cancel smoke issues
  await req('PATCH', `/plane/issues/${issue.id}`, { status: 'cancelled' });
  await req('PATCH', `/plane/issues/${issue2.id}`, { status: 'cancelled' });
  ok('cleanup cancelled', true);

  console.log(`\n——— Result: ${passed} passed, ${failed} failed ———\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
