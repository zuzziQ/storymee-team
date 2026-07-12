import cron from "node-cron";
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";

/**
 * Hàm chuẩn hóa status từ State DB object
 * API trả về State: { group: "started"|"completed"|"unstarted"|"backlog"|"cancelled", name: "In Progress"|... }
 */
function getStatusFromState(state: { group: string; name: string } | null | undefined): string {
  if (!state) return 'pending';
  const g = state.group;
  const n = state.name.toLowerCase();
  if (g === 'backlog') return 'backlog';
  if (n === 'in review' || n === 'in_review') return 'in_review';
  if (g === 'started') return 'working';
  if (g === 'completed') return 'done';
  if (g === 'cancelled') return 'cancelled';
  return 'pending'; // unstarted = Todo
}

function isDoneStatus(state: any): boolean {
  const status = getStatusFromState(state);
  return status === 'done' || status === 'cancelled';
}

export function startCronJobs(apiClient: CoreApiClient, sendMessage: (chatId: number, text: string, replyMarkup?: any) => Promise<void>) {
  console.log("🕒 Khởi động hệ thống Report tự động (Cron Jobs)...");

  // Cron buổi sáng 8:30 (Thứ 2 - Thứ 7)
  cron.schedule('30 8 * * 1-6', async () => {
    try {
      console.log("Chạy Cron buổi sáng: 8:30");
      const res = await apiClient.get(API_ROUTES.HR.TEAM_MEMBERS) as any;
      const members = res.data || [];
      const todayStr = new Date().toISOString().split('T')[0];
      
      const tasksRes = await apiClient.get(API_ROUTES.PLANE.ISSUES) as any;
      // allTasks bao gồm cả parent issues + subIssues (API flatten hoặc nested)
      const rawTasks = tasksRes.data || [];
      
      // Flatten: lấy cả parent và subIssues
      const allTasks: any[] = [];
      rawTasks.forEach((t: any) => {
        allTasks.push(t);
        (t.subIssues || []).forEach((sub: any) => allTasks.push(sub)); // API field là subIssues
      });

      console.log(`[Cron Sáng] Tìm thấy ${members.length} thành viên, ${allTasks.length} tasks`);

      for (const m of members) {
        if (!m.telegramChatId) continue;
        
        // Filter task chưa done, assignee là member này
        const myTasks = allTasks.filter((t: any) =>
          t.assigneeId === m.id && !isDoneStatus(t.State)
        );
        // Deadline hôm nay dùng targetDate (không phải deadline)
        const todayTasks = myTasks.filter((t: any) =>
          t.targetDate && t.targetDate.startsWith(todayStr)
        );
        
        let msg = `🌅 *Báo cáo đầu ngày (8h30): ${m.fullName}*\n\n`;
        msg += `👉 Hệ thống tự động nhắc nhở đầu ngày cho ${m.fullName}. `;
        
        if (myTasks.length > 0) {
          msg += `Số task cần làm: ${myTasks.length}.\n\n`;
          if (todayTasks.length > 0) {
            msg += `📋 *Nhiệm vụ deadline hôm nay (${todayStr}):*\n`;
            todayTasks.slice(0, 5).forEach((t: any, idx: number) => {
              const projIdent = typeof t.Project === 'string' ? t.Project : (t.Project?.identifier || '');
              const taskId = projIdent && t.sequenceId ? `${projIdent}-${t.sequenceId}` : t.id.substring(0, 8);
              msg += `${idx + 1}. *${taskId}*: ${t.title}\n`;
            });
            if (todayTasks.length > 5) msg += `... và ${todayTasks.length - 5} task khác\n`;
          } else {
            msg += `📋 *${myTasks.length} task đang mở* (không có deadline hôm nay):\n`;
            myTasks.slice(0, 3).forEach((t: any, idx: number) => {
              const projIdent = typeof t.Project === 'string' ? t.Project : (t.Project?.identifier || '');
              const taskId = projIdent && t.sequenceId ? `${projIdent}-${t.sequenceId}` : t.id.substring(0, 8);
              msg += `${idx + 1}. *${taskId}*: ${t.title}\n`;
            });
            if (myTasks.length > 3) msg += `... và ${myTasks.length - 3} task khác\n`;
          }
        } else {
          msg += `Chưa có task nào được giao. Chúc một ngày làm việc hiệu quả!\n`;
        }
        
        const replyMarkup = {
          inline_keyboard: [
            [{ text: "🌅 Vào ca (Check-in)", callback_data: `attendance_direct:present` }]
          ]
        };
        await sendMessage(Number(m.telegramChatId), msg, replyMarkup);
      }
    } catch (err) {
      console.error("Lỗi chạy Cron sáng:", err);
    }
  }, { timezone: "Asia/Ho_Chi_Minh" });

  // Cron buổi chiều 17:00 (Thứ 2 - Thứ 7)
  cron.schedule('0 17 * * 1-6', async () => {
    try {
      console.log("Chạy Cron buổi chiều: 17:00");
      const res = await apiClient.get(API_ROUTES.HR.TEAM_MEMBERS) as any;
      const members = res.data || [];
      
      const tasksRes = await apiClient.get(API_ROUTES.PLANE.ISSUES) as any;
      const rawTasks = tasksRes.data || [];
      const todayStr = new Date().toISOString().split('T')[0];

      // Flatten parent + subIssues
      const allTasks: any[] = [];
      rawTasks.forEach((t: any) => {
        allTasks.push(t);
        (t.subIssues || []).forEach((sub: any) => allTasks.push(sub));
      });

      console.log(`[Cron Chiều] Tìm thấy ${members.length} thành viên, ${allTasks.length} tasks`);
      
      for (const m of members) {
        if (!m.telegramChatId) continue;
        
        const myTasks = allTasks.filter((t: any) => t.assigneeId === m.id);
        
        // Task done hôm nay: State.group === 'completed' và updatedAt hôm nay
        const doneTodayTasks = myTasks.filter((t: any) =>
          isDoneStatus(t.State) && t.updatedAt && t.updatedAt.startsWith(todayStr)
        );
        // Task còn mở: không phải done, không phải cancelled
        const openTasks = myTasks.filter((t: any) => !isDoneStatus(t.State));
        
        let msg = `🌇 *Nhắc tiến độ cuối ngày (17h00): ${m.fullName}*\n\n`;
        msg += `Hệ thống nhắc nhở cập nhật trạng thái cuối ngày cho ${m.fullName}.\n\n`;
        
        if (doneTodayTasks.length > 0) {
          msg += `✅ *Đã hoàn thành hôm nay: ${doneTodayTasks.length} task*\n`;
          doneTodayTasks.slice(0, 3).forEach((t: any, idx: number) => {
            msg += `${idx + 1}. ~~${t.title}~~\n`;
          });
          msg += `\n`;
        }
        
        if (openTasks.length > 0) {
          msg += `⏳ *Còn ${openTasks.length} task đang mở:*\n`;
          openTasks.slice(0, 5).forEach((t: any, idx: number) => {
            const projIdent = typeof t.Project === 'string' ? t.Project : (t.Project?.identifier || '');
            const taskId = projIdent && t.sequenceId ? `${projIdent}-${t.sequenceId}` : t.id.substring(0, 8);
            const stateName = t.State?.name || 'Todo';
            msg += `${idx + 1}. *${taskId}*: ${t.title} _(${stateName})_\n`;
          });
          if (openTasks.length > 5) msg += `... và ${openTasks.length - 5} task khác\n`;
        } else {
          msg += `🎉 Tuyệt vời! Không còn task nào đang mở.\n`;
        }
        
        msg += `\n🕒 Đã đến giờ nghỉ ngơi, nhớ *Check-out* trước khi về nhé!`;
        
        const replyMarkup = {
          inline_keyboard: [
            [{ text: "🚪 Tan ca (Check-out)", callback_data: `attendance_direct:checkout` }]
          ]
        };
        await sendMessage(Number(m.telegramChatId), msg, replyMarkup);
      }
    } catch (err) {
      console.error("Lỗi chạy Cron chiều:", err);
    }
  }, { timezone: "Asia/Ho_Chi_Minh" });
}
