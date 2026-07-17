/**
 * Normalize LLM JSON actions so FE / bot / MCP share one vocabulary.
 * Models often emit update_task / create_task / archive_task / xoa_task …
 */
export const LLM_ACTION_ALIASES: Record<string, string> = {
  // tasks
  update_task: 'update_issue',
  update_task_status: 'update_issue',
  set_task_status: 'update_issue',
  change_status: 'update_issue',
  create_task: 'create_issue',
  add_task: 'create_issue',
  archive_task: 'archive_issue',
  luu_tru: 'archive_issue',
  delete_task: 'delete_issue',
  remove_task: 'delete_issue',
  remove_issue: 'delete_issue',
  xoa_task: 'delete_issue',
  // leave
  submit_leave: 'leave_request',
  request_leave: 'leave_request',
  xin_nghi: 'leave_request',
  // attendance
  checkin: 'check_in_out',
  checkout: 'check_in_out',
  check_in: 'check_in_out',
  check_out: 'check_in_out',
  diem_danh: 'check_in_out',
  // meetings
  schedule_meeting: 'create_meeting',
  book_meeting: 'create_meeting',
  // list
  get_my_tasks: 'show_my_issues',
  list_tasks: 'show_my_issues',
  my_tasks: 'show_my_issues',
  get_team_leaves: 'list_leave_requests',
  // legacy archive request → self-service archive
  request_issue_approval: 'archive_issue',
};

/** Canonical mutation actions the FE chat can confirm */
export const FE_CONFIRMABLE_ACTIONS = new Set([
  'update_issue',
  'create_issue',
  'leave_request',
  'archive_issue',
  'delete_issue',
]);

export function normalizeLlmAction(raw: string | null | undefined): string {
  const a = (raw || 'none').trim();
  if (!a || a === 'none') return 'none';
  return LLM_ACTION_ALIASES[a] || LLM_ACTION_ALIASES[a.toLowerCase()] || a;
}

/** Pick payload for a normalized action from full LLM response data */
export function pickLlmPayload(action: string, data: Record<string, any>): any {
  if (action === 'leave_request') return data.leavePayload || data.payload || {};
  if (action === 'check_in_out') return data.checkInOutPayload || data.payload || {};
  if (action === 'create_meeting') return data.meetingPayload || data.payload || {};
  if (action === 'update_meeting') return data.updateMeetingPayload || data.payload || {};
  if (action === 'create_project') return data.projectPayload || data.payload || {};
  if (action === 'breakdown_issue') return data.breakdownPayload || data.payload || {};
  // archive/delete may arrive as approvalPayload (legacy) or taskPayload
  if (action === 'archive_issue' || action === 'delete_issue') {
    const tp = data.taskPayload || data.approvalPayload || data.payload || {};
    return {
      ...tp,
      task_id: tp.task_id || tp.id || tp.issue_id,
      id: tp.id || tp.task_id || tp.issue_id,
      reason: tp.reason || tp.note,
    };
  }
  return data.taskPayload || data.payload || {};
}
