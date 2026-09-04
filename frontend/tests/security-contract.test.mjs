import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('chat messages are rendered as text instead of injected HTML', () => {
  const chat = read('src/app/features/chat/components/ChatWidgetContent.tsx');
  assert.doesNotMatch(chat, /dangerouslySetInnerHTML/);
  assert.match(chat, /\{m\.text\}/);
});

test('AI routes require a verified Team session', () => {
  const routes = ['chat', 'breakdown', 'project-insights', 'logs', 'omni-status', 'test_echo'];
  for (const route of routes) {
    const source = read(`src/app/api/ai/${route}/route.ts`);
    assert.match(source, /authenticateTeamRoute\(request,/);
  }
});

test('OmniRouter credential is environment-backed', () => {
  const router = read('src/lib/omniRouter.ts');
  assert.doesNotMatch(router, /omnir-free-token-pool-key/);
  assert.match(router, /process\.env\.OMNIR_API_KEY/);
});
