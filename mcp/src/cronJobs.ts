import cron from "node-cron";
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";

export function startCronJobs(apiClient: CoreApiClient, sendMessage: (chatId: number, text: string, replyMarkup?: any) => Promise<void>) {
  console.log("🕒 Khởi động hệ thống Report tự động (Cron Jobs)...");

  // Cron buổi sáng 8:30 (Thứ 2 - Thứ 7)
  cron.schedule('30 8 * * 1-6', async () => {
    try {
      console.log("Chạy Cron buổi sáng: 8:30");
      // Dùng API_ROUTES để tránh lỗi Axios Absolute Path Override
      const res = await apiClient.get(API_ROUTES.HR.TEAM_MEMBERS) as any;
      const members = res.data || [];
      const todayStr = new Date().toISOString().split('T')[0];
      
      const tasksRes = await apiClient.get(API_ROUTES.PLANE.ISSUES) as any;
      const allTasks = tasksRes.data || [];

      console.log(`[Cron Sáng] Tìm thấy ${members.length} thành viên, ${allTasks.length} tasks`);

      for (const m of members) {
        if (!m.telegramChatId) continue;
        const myTasks = allTasks.filter((t: any) => t.assigneeId === m.id && t.status !== "DONE" && t.status !== "done" && t.status !== "cancelled");
        const todayTasks = myTasks.filter((t: any) => t.deadline && t.deadline.startsWith(todayStr));
        
        let msg = `🌅 *Báo cáo đầu ngày (8h30): ${m.fullName}*\n\n`;
        msg += `👉 Hệ thống tự động nhắc nhở đầu ngày cho ${m.fullName}. `;
        
        if (myTasks.length > 0) {
          msg += `Số task cần làm: ${myTasks.length}.\n\n`;
          if (todayTasks.length > 0) {
            msg += `📋 *Nhiệm vụ deadline hôm nay (${todayStr}):*\n`;
            todayTasks.slice(0, 5).forEach((t: any, idx: number) => {
              msg += `${idx + 1}. ${t.title || t.name}\n`;
            });
            if (todayTasks.length > 5) msg += `... và ${todayTasks.length - 5} task khác\n`;
          } else {
            msg += `📋 *${myTasks.length} task đang mở* (không có deadline hôm nay):\n`;
            myTasks.slice(0, 3).forEach((t: any, idx: number) => {
              msg += `${idx + 1}. ${t.title || t.name}\n`;
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
  });

  // Cron buổi chiều 17:00 (Thứ 2 - Thứ 7)
  cron.schedule('0 17 * * 1-6', async () => {
    try {
      console.log("Chạy Cron buổi chiều: 17:00");
      const res = await apiClient.get(API_ROUTES.HR.TEAM_MEMBERS) as any;
      const members = res.data || [];
      
      const tasksRes = await apiClient.get(API_ROUTES.PLANE.ISSUES) as any;
      const allTasks = tasksRes.data || [];
      const todayStr = new Date().toISOString().split('T')[0];

      console.log(`[Cron Chiều] Tìm thấy ${members.length} thành viên, ${allTasks.length} tasks`);
      
      for (const m of members) {
        if (!m.telegramChatId) continue;
        
        const myTasks = allTasks.filter((t: any) => t.assigneeId === m.id);
        const doneTodayTasks = myTasks.filter((t: any) => 
          (t.status === "DONE" || t.status === "done") && t.updatedAt && t.updatedAt.startsWith(todayStr)
        );
        const openTasks = myTasks.filter((t: any) => t.status !== "DONE" && t.status !== "done" && t.status !== "cancelled");
        
        let msg = `🌇 *Nhắc tiến độ cuối ngày (17h00): ${m.fullName}*\n\n`;
        msg += `Hệ thống nhắc nhở cập nhật trạng thái cuối ngày cho ${m.fullName}.\n\n`;
        
        if (doneTodayTasks.length > 0) {
          msg += `✅ *Đã hoàn thành hôm nay: ${doneTodayTasks.length} task*\n`;
          doneTodayTasks.slice(0, 3).forEach((t: any, idx: number) => {
            msg += `${idx + 1}. ~~${t.title || t.name}~~\n`;
          });
          msg += `\n`;
        }
        
        if (openTasks.length > 0) {
          msg += `⏳ *Còn ${openTasks.length} task đang mở:*\n`;
          openTasks.slice(0, 5).forEach((t: any, idx: number) => {
            msg += `${idx + 1}. ${t.title || t.name}\n`;
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
  });
}
