/**
 * Shared status vocabulary — keep FE aligned with core-team-api PlaneController
 * and storymeeteam-mcp Telegram/MCP tools.
 *
 * SSOT: pl_states (name + group). Clients send `status` string; API maps to PlState.
 */

export type UiTaskStatus = 'Backlog' | 'Todo' | 'In Progress' | 'In Review' | 'Done';

/** FE UI label → API body `status` for PATCH /plane/issues/:id */
export const UI_TO_API_STATUS: Record<string, string> = {
  Backlog: 'backlog',
  Todo: 'pending',
  'In Progress': 'working',
  'In Review': 'in_review',
  Done: 'done',
};

export function mapIssueStatus(nameLower: string, group: string): UiTaskStatus {
  if (nameLower === 'backlog' || group === 'backlog') return 'Backlog';
  if (nameLower === 'in review' || nameLower === 'in_review') return 'In Review';
  if (nameLower === 'in progress' || nameLower === 'working' || group === 'started') {
    // group=started covers both In Progress and In Review — prefer name
    if (nameLower.includes('review')) return 'In Review';
    return 'In Progress';
  }
  if (nameLower === 'done' || nameLower === 'completed' || group === 'completed' || group === 'cancelled') {
    return 'Done';
  }
  return 'Todo';
}

export function toApiStatus(uiStatus: string): string {
  return UI_TO_API_STATUS[uiStatus] || 'pending';
}
