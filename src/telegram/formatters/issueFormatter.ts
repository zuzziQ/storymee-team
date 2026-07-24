/**
 * issueFormatter.ts — Module chuẩn hóa format tin nhắn Telegram
 * Dùng thống nhất cho: cronJobs, messageHandler, planeTools
 */

/** YYYY-MM-DD theo múi giờ Việt Nam (GMT+7). */
function todayVnStr(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().substring(0, 10);
}

/** Escape ký tự đặc biệt trong Markdown mô tả tiêu đề task */
function esc(text: string): string {
  if (!text) return '';
  // Escape * và _ nằm trong free text (không phải bold/italic cố ý)
  // Chỉ cần thoát các ký tự gây lỗi parse khi nằm giữa nội dung
  return text.replace(/([_*`\[\]])/g, '\\$1');
}

export interface FormattedIssue {
  shortId: string;
  title: string;
  stateName: string;
  stateGroup: string;
  deadline: string;
  deadlineDate: Date | null;
  assigneeName: string;
  isOverdue: boolean;
  isDueSoon: boolean; // deadline trong vòng 2 ngày
  isDueToday: boolean;
  subIssues: any[];
}

export function parseIssue(issue: any, members: any[] = []): FormattedIssue {
  const projIdent = typeof issue.Project === 'string'
    ? issue.Project
    : (issue.Project?.identifier || '');
  const shortId = projIdent && issue.sequenceId
    ? `${projIdent}-${issue.sequenceId}`
    : (issue.id?.substring(0, 8) || 'Task');

  const stateGroup = issue.State?.group || 'unstarted';
  const stateName = issue.State?.name || 'Todo';

  const deadlineDate = issue.targetDate ? new Date(issue.targetDate) : null;
  const todayStr = todayVnStr();
  const deadline = issue.targetDate ? issue.targetDate.split('T')[0] : 'Chưa đặt';

  const soon = new Date(Date.now() + 7 * 3600 * 1000);
  soon.setUTCDate(soon.getUTCDate() + 2);
  const soonStr = soon.toISOString().substring(0, 10);

  const isOverdue = !!deadlineDate && deadline < todayStr;
  const isDueToday = deadline === todayStr;
  const isDueSoon = !!deadlineDate && !isOverdue && deadline !== 'Chưa đặt' && deadline <= soonStr;

  const assigneeName = issue.Assignee?.fullName
    || members.find((m: any) => m.id === issue.assigneeId)?.fullName
    || 'Chưa phân công';

  return {
    shortId,
    title: issue.title,
    stateName,
    stateGroup,
    deadline,
    deadlineDate,
    assigneeName,
    isOverdue,
    isDueSoon,
    isDueToday,
    subIssues: issue.subIssues || [],
  };
}

export function isDoneGroup(stateGroup: string): boolean {
  return stateGroup === 'completed' || stateGroup === 'cancelled';
}

/** Format block 1 task (dùng cho DM cá nhân) */
export function formatIssueBlock(f: FormattedIssue, showSubs = true): string {
  let emoji = '⬜';
  if (f.isOverdue) emoji = '🔴';
  else if (f.isDueToday) emoji = '⏰';
  else if (f.stateGroup === 'started') emoji = '🟡';
  else if (f.stateGroup === 'backlog') emoji = '🔘';

  const dlText = f.deadline !== 'Chưa đặt'
    ? (f.isOverdue ? ` | 📅 ${f.deadline} ⚠️ QUÁ HẠN` : ` | 📅 ${f.deadline}`)
    : '';

  let block = `${emoji} *${f.shortId}*: ${esc(f.title)}\n`;
  block += `   \`${f.stateName}\`${dlText}\n`;

  if (showSubs && f.subIssues.length > 0) {
    const total = f.subIssues.length;
    const done = f.subIssues.filter((s: any) => {
      const g = s.State?.group || 'unstarted';
      return g === 'completed' || g === 'cancelled';
    }).length;
    const subList = f.subIssues.slice(0, 4).map((s: any) => {
      const g = s.State?.group || 'unstarted';
      const isDone = g === 'completed' || g === 'cancelled';
      const sTitle = s.title.length > 30 ? s.title.substring(0, 30) + '…' : s.title;
      return `${isDone ? '✅' : '⬜'} ${esc(sTitle)}`;
    }).join(', ');
    const more = total > 4 ? ` +${total - 4}` : '';
    block += `   ↳ [${done}/${total}] ${subList}${more}\n`;
  }

  return block;
}

/** Format "Công việc của tôi" đầy đủ cho DM */
export function formatMyIssuesDM(issues: any[], memberName: string): string {
  const todayStr = todayVnStr();
  const active = issues.filter(i => !isDoneGroup(i.State?.group || 'unstarted'));

  if (active.length === 0) {
    return `🎉 *${memberName}*, hiện bạn không có công việc nào đang mở. Chúc mừng!`;
  }

  const parsed = active.map(i => parseIssue(i));

  const overdue = parsed.filter(f => f.isOverdue);
  const dueToday = parsed.filter(f => f.isDueToday);
  const inProgress = parsed.filter(f => !f.isOverdue && !f.isDueToday && f.stateGroup === 'started');
  const others = parsed.filter(f => !f.isOverdue && !f.isDueToday && f.stateGroup !== 'started');

  let msg = `📋 *CÔNG VIỆC CỦA BẠN — ${memberName}*\n`;
  msg += `📊 Tổng: ${active.length} task đang mở\n\n`;

  if (overdue.length > 0) {
    msg += `🚨 *QUÁ HẠN (${overdue.length}):*\n`;
    overdue.forEach(f => { msg += formatIssueBlock(f, true); });
    msg += '\n';
  }

  if (dueToday.length > 0) {
    msg += `⏰ *DEADLINE HÔM NAY (${dueToday.length}):*\n`;
    dueToday.forEach(f => { msg += formatIssueBlock(f, true); });
    msg += '\n';
  }

  if (inProgress.length > 0) {
    msg += `🟡 *ĐANG LÀM (${inProgress.length}):*\n`;
    inProgress.forEach(f => { msg += formatIssueBlock(f, true); });
    msg += '\n';
  }

  if (others.length > 0) {
    msg += `📌 *KHÁC (${others.length}):*\n`;
    others.slice(0, 5).forEach(f => { msg += formatIssueBlock(f, true); });
    if (others.length > 5) msg += `   _(và ${others.length - 5} task khác)_\n`;
  }

  return msg;
}

export interface TeamReportData {
  members: any[];
  allIssues: any[];
  attendance: any[];
  todayStr: string;
}

/** Format tin 9h sáng gửi nhóm */
export function formatGroupMorningReport(data: TeamReportData): string {
  const { members, allIssues, attendance, todayStr } = data;
  const activeMembers = members.filter(m => m.isActive !== false);

  // Checkin
  const checkedIn = attendance
    .filter(a => a.date?.startsWith(todayStr) && a.checkIn)
    .map(a => a.memberId);
  const checkedInNames = activeMembers.filter(m => checkedIn.includes(m.id)).map(m => m.fullName.split(' ').pop());
  const notCheckedIn = activeMembers.filter(m => !checkedIn.includes(m.id)).map(m => m.fullName.split(' ').pop());

  // Tasks
  const activeIssues = allIssues.filter(i => !isDoneGroup(i.State?.group || 'unstarted'));
  const parsed = activeIssues.map(i => parseIssue(i, members));
  const overdue = parsed.filter(f => f.isOverdue);
  const dueToday = parsed.filter(f => f.isDueToday);

  const dow = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'][new Date().getDay()];
  const dateStr = todayStr.split('-').reverse().join('/');

  let msg = `📊 *TỔNG KẾT ĐẦU NGÀY*\n`;
  msg += `📅 ${dow}, ${dateStr} | 9:00 sáng\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Checkin
  msg += `👥 *ĐIỂM DANH (${checkedInNames.length}/${activeMembers.length} người):*\n`;
  if (checkedInNames.length > 0) msg += `✅ ${checkedInNames.join(', ')}\n`;
  if (notCheckedIn.length > 0) msg += `⏳ Chưa vào: ${notCheckedIn.join(', ')}\n`;
  msg += '\n';

  // Overdue
  if (overdue.length > 0) {
    msg += `🚨 *TASK QUÁ HẠN (${overdue.length}):*\n`;
    overdue.slice(0, 5).forEach(f => {
      const dayOver = f.deadlineDate
        ? Math.floor((Date.now() - f.deadlineDate.getTime()) / 86400000)
        : 0;
      msg += `🔴 *${f.shortId}*: ${f.title.substring(0, 35)}\n`;
      msg += `   👤 ${f.assigneeName} | +${dayOver} ngày quá hạn\n`;
    });
    if (overdue.length > 5) msg += `   _...và ${overdue.length - 5} task khác_\n`;
    msg += '\n';
  }

  // Due today
  if (dueToday.length > 0) {
    msg += `⏰ *DEADLINE HÔM NAY (${dueToday.length}):*\n`;
    dueToday.slice(0, 5).forEach(f => {
      msg += `⚡ *${f.shortId}*: ${f.title.substring(0, 35)} — 👤 ${f.assigneeName}\n`;
    });
    msg += '\n';
  }

  if (overdue.length === 0 && dueToday.length === 0) {
    msg += `✨ Không có task quá hạn hay deadline hôm nay. Tuyệt vời!\n\n`;
  }

  msg += `📋 Tổng: *${activeIssues.length}* task đang chạy | *${overdue.length}* quá hạn\n`;
  msg += `\n💪 Chúc cả team một ngày làm việc năng suất!`;

  return msg;
}

/** Format tin 17h chiều gửi nhóm */
export function formatGroupEveningReport(data: TeamReportData): string {
  const { members, allIssues, attendance, todayStr } = data;
  const activeMembers = members.filter(m => m.isActive !== false);

  // Checkout
  const checkedOut = attendance
    .filter(a => a.date?.startsWith(todayStr) && a.checkOut)
    .map(a => a.memberId);
  const notCheckedOut = attendance
    .filter(a => a.date?.startsWith(todayStr) && a.checkIn && !a.checkOut)
    .map(a => {
      const m = members.find((m: any) => m.id === a.memberId);
      return m?.fullName.split(' ').pop() || a.memberId;
    });

  // Done today
  const doneToday = allIssues.filter(i => {
    const g = i.State?.group || 'unstarted';
    return (g === 'completed') && i.updatedAt?.startsWith(todayStr);
  });

  // Still open
  const stillOpen = allIssues.filter(i => !isDoneGroup(i.State?.group || 'unstarted'));

  const dow = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'][new Date().getDay()];
  const dateStr = todayStr.split('-').reverse().join('/');

  let msg = `🌇 *TỔNG KẾT CUỐI NGÀY*\n`;
  msg += `📅 ${dow}, ${dateStr} | 17:00 chiều\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Done today
  if (doneToday.length > 0) {
    msg += `✅ *HOÀN THÀNH HÔM NAY (${doneToday.length}):*\n`;
    doneToday.slice(0, 6).forEach(i => {
      const f = parseIssue(i, members);
      msg += `🟢 *${f.shortId}*: ${i.title.substring(0, 40)} — 👤 ${f.assigneeName}\n`;
    });
    if (doneToday.length > 6) msg += `   _...và ${doneToday.length - 6} task khác_\n`;
    msg += '\n';
  } else {
    msg += `📋 Hôm nay chưa có task nào được đánh dấu hoàn thành.\n\n`;
  }

  msg += `⏳ *CÒN TỒN ĐỌNG: ${stillOpen.length} task đang mở*\n\n`;

  // Checkout status
  msg += `👥 *CHẤM CÔNG (${checkedOut.length}/${activeMembers.length}):*\n`;
  if (checkedOut.length > 0) {
    const names = activeMembers.filter(m => checkedOut.includes(m.id)).map(m => m.fullName.split(' ').pop());
    msg += `✅ Check-out: ${names.join(', ')}\n`;
  }
  if (notCheckedOut.length > 0) {
    msg += `⚠️ Chưa check-out: ${notCheckedOut.join(', ')}\n`;
  }

  msg += `\n🙏 Cảm ơn cả team! Chúc mọi người buổi tối thư giãn vui vẻ! 🌙`;

  return msg;
}
