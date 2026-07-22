/**
 * Heuristic intent router — replaces Gemini Flash first-pass (saves 300–1500ms).
 * Returns: TASK | HR | PROJECT_MANAGEMENT | MEETING | CHAT
 */
export type UserIntent = 'TASK' | 'HR' | 'PROJECT_MANAGEMENT' | 'MEETING' | 'CHAT';

const MEETING_RE =
  /\b(lịch họp|lich hop|cuộc họp|cuoc hop|setup lịch|setup lich|đặt lịch|dat lich|họp|meeting|review website|review design|họp team|hop team|schedule meeting|tạo lịch|tao lich|lịch review|lich review|cancel lịch|hủy lịch|huy lich)\b/i;

const HR_RE =
  /\b(nghỉ|nghi|phép|phep|remote|check[\s-]?in|check[\s-]?out|điểm danh|diem danh|chấm công|cham cong|lương|luong|payroll|bảng công|bang cong|xin nghỉ|xin nghi|làm remote|lam remote)\b/i;

const PROJECT_RE =
  /\b(dự án|du an|project|tạo project|tao project|danh sách dự án|danh sach du an)\b/i;

const TASK_RE =
  /\b(task|công việc|cong viec|kanban|deadline|giao việc|giao viec|subtask|phân rã|phan ra|in review|done|todo|assignee|bàn giao|ban giao|issue|xoá task|xoa task|archive|lưu trữ|luu tru)\b/i;

const CHAT_RE =
  /\b(xin chào|hello|hi\b|cảm ơn|cam on|bạn là ai|ban la ai|quy chế|quy che|đãi ngộ|dai ngo|tháng 13|thang 13|thưởng|thuong)\b/i;

export function classifyIntentFast(text: string): UserIntent {
  const t = (text || '').trim();
  if (!t) return 'CHAT';
  // MEETING phải check TRƯỚC HR/TASK để tránh bị nuốt bởi keyword chung
  if (MEETING_RE.test(t)) return 'MEETING';
  if (HR_RE.test(t)) return 'HR';
  if (PROJECT_RE.test(t)) return 'PROJECT_MANAGEMENT';
  if (TASK_RE.test(t)) return 'TASK';
  if (CHAT_RE.test(t)) return 'CHAT';
  // Default TASK only if looks operational; else CHAT (lighter path)
  if (t.length < 12) return 'CHAT';
  return 'TASK';
}

/** Lightweight roster for LLM context (names only). */
export function buildSlimRoster(members: any[]): string {
  return (members || [])
    .filter((m) => (m.accountStatus || 'active') === 'active' && m.isActive !== false)
    .slice(0, 40)
    .map((m) => `- ${m.fullName}${m.role ? ` (${m.role})` : ''}`)
    .join('\n');
}
