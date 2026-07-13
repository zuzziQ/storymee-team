import cron from "node-cron";
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import {
  parseIssue,
  isDoneGroup,
  formatIssueBlock,
  formatMyIssuesDM,
  formatGroupMorningReport,
  formatGroupEveningReport,
  type TeamReportData
} from "./telegram/formatters/issueFormatter";

/** Xây dựng cấu trúc cây cha-con từ flat array của Plane API */
function buildHierarchy(rawTasks: any[]): any[] {
  const parentMap = new Map<string, any>();
  const topLevelIssues: any[] = [];
  
  rawTasks.forEach((t: any) => {
    t.subIssues = [];
    parentMap.set(t.id, t);
  });
  
  rawTasks.forEach((t: any) => {
    if (t.parentId && parentMap.has(t.parentId)) {
      parentMap.get(t.parentId).subIssues.push(t);
    } else {
      topLevelIssues.push(t);
    }
  });
  
  return topLevelIssues;
}

/** Fetch tất cả data cần thiết */
async function fetchAllData(apiClient: CoreApiClient) {
  const [membersRes, tasksRes, attendanceRes] = await Promise.all([
    apiClient.get(API_ROUTES.HR.TEAM_MEMBERS) as Promise<any>,
    apiClient.get(API_ROUTES.PLANE.ISSUES) as Promise<any>,
    apiClient.get(API_ROUTES.HR.ATTENDANCE) as Promise<any>,
  ]);

  const members: any[] = membersRes?.data || [];
  const rawTasks: any[] = tasksRes?.data || [];
  const attendance: any[] = attendanceRes?.data || [];
  const allIssues = buildHierarchy(rawTasks);
  const todayStr = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
    .toISOString().split('T')[0];

  return { members, rawTasks, allIssues, attendance, todayStr };
}

export function startCronJobs(
  apiClient: CoreApiClient,
  sendMessage: (chatId: number, text: string, replyMarkup?: any) => Promise<void>
) {
  console.log("🕒 Khởi động hệ thống Report tự động (Cron Jobs v2)...");

  const GROUP_ID = process.env.TELEGRAM_GROUP_ID
    ? Number(process.env.TELEGRAM_GROUP_ID)
    : null;

  // ─────────────────────────────────────────────────────────────────────────
  // CRON 1: 9:00 sáng → Gửi nhóm: Tổng kết đầu ngày (Thứ 2 - Thứ 7)
  // ─────────────────────────────────────────────────────────────────────────
  cron.schedule('0 9 * * 1-6', async () => {
    if (!GROUP_ID) {
      console.log("[Cron 9h Nhóm] TELEGRAM_GROUP_ID chưa cấu hình, bỏ qua.");
      return;
    }
    try {
      console.log("[Cron 9h Nhóm] Đang tạo báo cáo đầu ngày...");
      const data = await fetchAllData(apiClient);
      const msg = formatGroupMorningReport(data as TeamReportData);
      await sendMessage(GROUP_ID, msg);
      console.log("[Cron 9h Nhóm] ✅ Đã gửi báo cáo đầu ngày vào nhóm.");
    } catch (err) {
      console.error("[Cron 9h Nhóm] Lỗi:", err);
    }
  }, { timezone: "Asia/Ho_Chi_Minh" });

  // ─────────────────────────────────────────────────────────────────────────
  // CRON 2: 8:30 sáng → Gửi DM cá nhân: Nhắc việc đầu ngày (Thứ 2 - Thứ 7)
  // ─────────────────────────────────────────────────────────────────────────
  cron.schedule('30 8 * * 1-6', async () => {
    try {
      console.log("[Cron 8h30 DM] Đang gửi nhắc nhở đầu ngày cho từng thành viên...");
      const { members, allIssues, todayStr } = await fetchAllData(apiClient);
      console.log(`[Cron 8h30 DM] ${members.length} thành viên, ${allIssues.length} issues`);

      for (const m of members) {
        if (!m.telegramChatId) continue;
        const chatId = Number(m.telegramChatId);

        const myIssues = allIssues.filter((t: any) => {
          const isAssigned = t.assigneeId === m.id;
          const hasAssignedSub = t.subIssues.some((sub: any) => sub.assigneeId === m.id);
          return isAssigned || hasAssignedSub;
        });
        const activeIssues = myIssues.filter((t: any) => !isDoneGroup(t.State?.group || 'unstarted'));

        if (activeIssues.length === 0) {
          await sendMessage(chatId,
            `☀️ *BÁO CÁO ĐẦU NGÀY (8h30)*\n\nChào *${m.fullName}*! Hôm nay bạn không có công việc nào đang mở. Chúc một ngày mới tràn đầy năng lượng! 🎉`,
            { inline_keyboard: [[{ text: "🌅 Vào ca (Check-in)", callback_data: "attendance_direct:present" }]] }
          );
          continue;
        }

        const parsed = activeIssues.map((i: any) => parseIssue(i, members));
        const overdue = parsed.filter(f => f.isOverdue);
        const dueToday = parsed.filter(f => f.isDueToday);
        const inProgress = parsed.filter(f => !f.isOverdue && !f.isDueToday && f.stateGroup === 'started');
        const others = parsed.filter(f => !f.isOverdue && !f.isDueToday && f.stateGroup !== 'started');

        let msg = `☀️ *BÁO CÁO ĐẦU NGÀY (8h30)*\n`;
        msg += `Chào *${m.fullName}*! Dưới đây là công việc cần tập trung hôm nay:\n`;
        msg += `📊 Tổng: *${activeIssues.length} task* đang mở\n\n`;

        if (overdue.length > 0) {
          msg += `🚨 *QUÁ HẠN — cần xử lý ngay (${overdue.length}):*\n`;
          overdue.forEach(f => { msg += formatIssueBlock(f, true); });
          msg += '\n';
        }

        if (dueToday.length > 0) {
          msg += `⏰ *DEADLINE HÔM NAY (${dueToday.length}):*\n`;
          dueToday.forEach(f => { msg += formatIssueBlock(f, true); });
          msg += '\n';
        }

        if (inProgress.length > 0) {
          msg += `🟡 *ĐANG TIẾN HÀNH (${inProgress.length}):*\n`;
          inProgress.forEach(f => { msg += formatIssueBlock(f, true); });
          msg += '\n';
        }

        if (others.length > 0) {
          msg += `📌 *CÔNG VIỆC KHÁC (${others.length}):*\n`;
          others.slice(0, 4).forEach(f => { msg += formatIssueBlock(f, false); });
          if (others.length > 4) msg += `   _(và ${others.length - 4} task khác)_\n`;
        }

        msg += `\n💪 Chúc bạn một ngày làm việc hiệu quả!`;

        await sendMessage(chatId, msg, {
          inline_keyboard: [[{ text: "🌅 Vào ca (Check-in)", callback_data: "attendance_direct:present" }]]
        });
      }
      console.log("[Cron 8h30 DM] ✅ Đã gửi xong báo cáo đầu ngày cho tất cả thành viên.");
    } catch (err) {
      console.error("[Cron 8h30 DM] Lỗi:", err);
    }
  }, { timezone: "Asia/Ho_Chi_Minh" });

  // ─────────────────────────────────────────────────────────────────────────
  // CRON 3: 17:00 chiều → Gửi nhóm: Tổng kết cuối ngày (Thứ 2 - Thứ 7)
  // ─────────────────────────────────────────────────────────────────────────
  cron.schedule('0 17 * * 1-6', async () => {
    if (!GROUP_ID) {
      console.log("[Cron 17h Nhóm] TELEGRAM_GROUP_ID chưa cấu hình, bỏ qua.");
      return;
    }
    try {
      console.log("[Cron 17h Nhóm] Đang tạo báo cáo cuối ngày...");
      const data = await fetchAllData(apiClient);
      const msg = formatGroupEveningReport(data as TeamReportData);
      await sendMessage(GROUP_ID, msg);
      console.log("[Cron 17h Nhóm] ✅ Đã gửi báo cáo cuối ngày vào nhóm.");
    } catch (err) {
      console.error("[Cron 17h Nhóm] Lỗi:", err);
    }
  }, { timezone: "Asia/Ho_Chi_Minh" });

  // ─────────────────────────────────────────────────────────────────────────
  // CRON 4: 17:30 chiều → Gửi DM cá nhân: Nhắc tiến độ cuối ngày (Thứ 2 - Thứ 7)
  // ─────────────────────────────────────────────────────────────────────────
  cron.schedule('30 17 * * 1-6', async () => {
    try {
      console.log("[Cron 17h30 DM] Đang gửi tổng kết cuối ngày cho từng thành viên...");
      const { members, allIssues, todayStr } = await fetchAllData(apiClient);

      for (const m of members) {
        if (!m.telegramChatId) continue;
        const chatId = Number(m.telegramChatId);

        const myIssues = allIssues.filter((t: any) => {
          const isAssigned = t.assigneeId === m.id;
          const hasAssignedSub = t.subIssues.some((sub: any) => sub.assigneeId === m.id);
          return isAssigned || hasAssignedSub;
        });
        const doneToday = myIssues.filter((t: any) => {
          const g = t.State?.group || 'unstarted';
          return g === 'completed' && t.updatedAt?.startsWith(todayStr);
        });
        const stillOpen = myIssues.filter((t: any) => !isDoneGroup(t.State?.group || 'unstarted'));
        const openParsed = stillOpen.map((i: any) => parseIssue(i, members));

        let msg = `🌇 *TỔNG KẾT CUỐI NGÀY (17h30)*\n`;
        msg += `Chào *${m.fullName}*! Dưới đây là tóm tắt ngày làm việc của bạn:\n\n`;

        if (doneToday.length > 0) {
          msg += `✅ *ĐÃ HOÀN THÀNH HÔM NAY (${doneToday.length}):*\n`;
          doneToday.slice(0, 4).forEach((t: any) => {
            const f = parseIssue(t, members);
            msg += `🟢 *${f.shortId}*: ${t.title}\n`;
          });
          msg += '\n';
        }

        if (stillOpen.length > 0) {
          msg += `⏳ *CÒN MỞ (${stillOpen.length} task):*\n`;
          openParsed.slice(0, 5).forEach(f => { msg += formatIssueBlock(f, true); });
          if (stillOpen.length > 5) msg += `   _(và ${stillOpen.length - 5} task khác)_\n`;
        } else {
          msg += `🎉 Tuyệt vời! Bạn đã hoàn thành tất cả công việc hôm nay!\n`;
        }

        msg += `\n🕐 Nhớ *Check-out* trước khi về nhé! Chúc buổi tối vui vẻ 🌙`;

        await sendMessage(chatId, msg, {
          inline_keyboard: [[{ text: "🚪 Tan ca (Check-out)", callback_data: "attendance_direct:checkout" }]]
        });
      }
      console.log("[Cron 17h30 DM] ✅ Đã gửi tổng kết cuối ngày cho tất cả thành viên.");
    } catch (err) {
      console.error("[Cron 17h30 DM] Lỗi:", err);
    }
  }, { timezone: "Asia/Ho_Chi_Minh" });

  console.log("✅ Đã đăng ký 4 Cron Jobs:");
  console.log("   • 8:30 sáng → DM cá nhân: nhắc việc đầu ngày (có subtask)");
  console.log("   • 9:00 sáng → Nhóm: tổng kết đầu ngày toàn team");
  console.log("   • 17:00 chiều → Nhóm: tổng kết cuối ngày");
  console.log("   • 17:30 chiều → DM cá nhân: nhắc tiến độ cuối ngày (có subtask)");
}
