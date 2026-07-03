"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCronJobs = startCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
function startCronJobs(apiClient, sendMessage) {
    console.log("🕒 Khởi động hệ thống Report tự động (Cron Jobs)...");
    node_cron_1.default.schedule('30 8 * * 1-6', async () => {
        try {
            console.log("Chạy Cron buổi sáng: 8:30");
            const res = await apiClient.get("/hr/team-members");
            const members = res.data || [];
            const todayStr = new Date().toISOString().split('T')[0];
            const tasksRes = await apiClient.get("/omnitask/tasks");
            const allTasks = tasksRes.data || [];
            for (const m of members) {
                if (!m.telegramChatId)
                    continue;
                const myTasks = allTasks.filter((t) => t.assigneeId === m.id && t.status !== "DONE");
                const todayTasks = myTasks.filter((t) => t.deadline && t.deadline.startsWith(todayStr));
                let msg = `🌅 *Chào buổi sáng ${m.fullName}!*\n\n`;
                msg += `👉 Sếp đừng quên *Check-in* đúng giờ nhé!\n\n`;
                if (todayTasks.length > 0) {
                    msg += `📋 *Nhiệm vụ cần hoàn thành hôm nay:*\n`;
                    todayTasks.forEach((t, idx) => {
                        msg += `${idx + 1}. ${t.title}\n`;
                    });
                }
                else if (myTasks.length > 0) {
                    msg += `📋 Bạn có ${myTasks.length} task đang mở nhưng không có deadline hôm nay.\n`;
                }
                else {
                    msg += `📋 Bạn chưa có task nào đang mở. Chúc một ngày làm việc hiệu quả!\n`;
                }
                await sendMessage(Number(m.telegramChatId), msg);
            }
        }
        catch (err) {
            console.error("Lỗi chạy Cron sáng:", err);
        }
    });
    node_cron_1.default.schedule('0 18 * * 1-6', async () => {
        try {
            console.log("Chạy Cron buổi chiều: 18:00");
            const res = await apiClient.get("/hr/team-members");
            const members = res.data || [];
            for (const m of members) {
                if (!m.telegramChatId)
                    continue;
                let msg = `🌇 *Chào buổi chiều ${m.fullName}!*\n\n`;
                msg += `🕒 Đã đến giờ nghỉ ngơi, sếp nhớ *Check-out* trước khi về nhé!\n`;
                msg += `👉 Hãy báo cáo tiến độ các task hôm nay bằng cách chat với bot. (Nếu cần dời deadline, hãy báo lại nhé).\n`;
                await sendMessage(Number(m.telegramChatId), msg);
            }
        }
        catch (err) {
            console.error("Lỗi chạy Cron chiều:", err);
        }
    });
}
