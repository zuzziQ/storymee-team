const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('browser authorization is derived from the verified Team session', () => {
  const middleware = read('src/middlewares/teamSessionAuth.ts');
  assert.match(middleware, /if \(request\.teamMember\) return request\.teamMember/);
  assert.match(middleware, /if \(!request\.teamService\) return null/);
});

test('privileged controllers resolve the authenticated actor', () => {
  const hr = read('src/controllers/hr.controller.ts');
  const plane = read('src/controllers/plane.controller.ts');
  const announcements = read('src/controllers/announcement.controller.ts');

  assert.doesNotMatch(hr, /TeamAccountService\.getById\(reviewerId\)/);
  assert.match(hr, /const reviewer = await resolveTeamActor\(req/);
  assert.match(hr, /Không thể chấm công thay người khác/);
  assert.match(hr, /Chỉ Admin mới được duyệt đơn/);
  assert.match(plane, /Chỉ assignee hoặc Admin được cập nhật task/);
  assert.match(announcements, /Chỉ Admin mới gửi thông báo/);
});
