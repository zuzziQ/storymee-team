/**
 * Leave request SSOT helpers — same contract as Telegram MCP submit_leave_request.
 *
 * API: POST /hr/leave-requests
 * Body: { memberId, leaveType, startDate, endDate, reason }
 * leaveType: annual | remote | sick | personal
 */

export type LeaveTypeApi = 'annual' | 'remote' | 'sick' | 'personal';
export type LeaveSession = 'all' | 'am' | 'pm';

export function mapUiLeaveType(type: string): LeaveTypeApi {
  const t = (type || '').toLowerCase();
  if (t === 'leave' || t === 'annual' || t === 'phép') return 'annual';
  if (t === 'remote' || t === 'làm remote') return 'remote';
  if (t === 'sick' || t === 'ốm') return 'sick';
  if (t === 'personal' || t === 'việc riêng') return 'personal';
  return 'annual';
}

export function leaveTypeLabel(leaveType: string): string {
  switch (leaveType) {
    case 'remote':
      return 'Remote';
    case 'annual':
      return 'Nghỉ phép';
    case 'sick':
      return 'Nghỉ ốm';
    case 'personal':
      return 'Việc riêng';
    default:
      return leaveType || '—';
  }
}

/** Build ISO start/end from date + session (parity with MCP hrTools). */
export function buildLeaveDateRange(
  date: string,
  session: LeaveSession = 'all',
  endDate?: string
): { startDate: string; endDate: string } {
  const startDay = date.includes('T') ? date.split('T')[0] : date;
  const endDay = endDate
    ? endDate.includes('T')
      ? endDate.split('T')[0]
      : endDate
    : startDay;

  let startDate = `${startDay}T00:00:00.000Z`;
  let endDateIso = `${endDay}T23:59:59.000Z`;

  if (session === 'am') {
    endDateIso = `${endDay}T12:00:00.000Z`;
  } else if (session === 'pm') {
    startDate = `${startDay}T12:00:00.000Z`;
  }

  return { startDate, endDate: endDateIso };
}

export function countLeaveDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);
}

export function mapLeaveFromApi(l: any) {
  return {
    id: l.id,
    name: l.member?.fullName || 'Không rõ',
    type: leaveTypeLabel(l.leaveType),
    leaveType: l.leaveType as string,
    date: l.startDate ? new Date(l.startDate).toLocaleDateString('vi-VN') : '',
    dateEnd: l.endDate ? new Date(l.endDate).toLocaleDateString('vi-VN') : '',
    reason: l.reason || '',
    handover: '',
    days:
      l.endDate && l.startDate
        ? countLeaveDays(l.startDate, l.endDate)
        : 1,
    status:
      l.status === 'approved'
        ? 'Approved'
        : l.status === 'rejected'
          ? 'Rejected'
          : 'Pending',
    memberId: l.memberId,
    raw: l,
  };
}
