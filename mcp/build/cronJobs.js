"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCronJobs = startCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const api_client_1 = require("@storymee/api-client");
const issueFormatter_1 = require("./telegram/formatters/issueFormatter");
/** Xây dựng cấu trúc cây cha-con từ flat array của Plane API */
function buildHierarchy(rawTasks) {
    const parentMap = new Map();
    const topLevelIssues = [];
    rawTasks.forEach((t) => {
        t.subIssues = [];
        parentMap.set(t.id, t);
    });
    rawTasks.forEach((t) => {
        if (t.parentId && parentMap.has(t.parentId)) {
            parentMap.get(t.parentId).subIssues.push(t);
        }
        else {
            topLevelIssues.push(t);
        }
    });
    return topLevelIssues;
}
/** Lấy lịch họp trong ngày hôm nay */
async function fetchTodayMeetings(apiClient) {
    try {
        const res = await apiClient.get('/hr/meetings');
        const meetings = res?.data || [];
        const nowVN = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const todayStr = nowVN.toISOString().split('T')[0];
        return meetings.filter((m) => {
            const startDate = new Date(m.startTime || m.start_time || m.createdAt);
            return startDate.toISOString().split('T')[0] === todayStr;
        }).sort((a, b) => {
            return new Date(a.startTime || a.start_time).getTime() - new Date(b.startTime || b.start_time).getTime();
        });
    }
    catch {
        return [];
    }
}
/** Format block lịch họp cho báo cáo */
function formatMeetingBlock(m) {
    const start = new Date(m.startTime || m.start_time);
    const timeStr = start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
    const title = m.title || 'Cuộc họp';
    const host = m.host?.fullName || m.hostName || '';
    const location = m.location ? ` 📍 ${m.location}` : '';
    const hostStr = host ? ` (Host: ${host})` : '';
    return `📅 *${timeStr}* — ${title}${hostStr}${location}\n`;
}
/** Fetch tất cả data cần thiết */
async function fetchAllData(apiClient) {
    const [membersRes, tasksRes, attendanceRes] = await Promise.all([
        apiClient.get(api_client_1.API_ROUTES.HR.TEAM_MEMBERS),
        apiClient.get(api_client_1.API_ROUTES.PLANE.ISSUES),
        apiClient.get(api_client_1.API_ROUTES.HR.ATTENDANCE),
    ]);
    const members = membersRes?.data || [];
    const rawTasks = tasksRes?.data || [];
    const attendance = attendanceRes?.data || [];
    const allIssues = buildHierarchy(rawTasks);
    const todayStr = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
        .toISOString().split('T')[0];
    return { members, rawTasks, allIssues, attendance, todayStr };
}
function startCronJobs(apiClient, sendMessage) {
    console.log("🕒 Khởi động hệ thống Report tự động (Cron Jobs v2)...");
    const GROUP_ID = process.env.TELEGRAM_GROUP_ID
        ? Number(process.env.TELEGRAM_GROUP_ID)
        : null;
    // ─────────────────────────────────────────────────────────────────────────
    // CRON 1: 9:00 sáng → Gửi nhóm: Tổng kết đầu ngày (Thứ 2 - Thứ 7)
    // ─────────────────────────────────────────────────────────────────────────
    node_cron_1.default.schedule('0 9 * * 1-6', async () => {
        if (!GROUP_ID) {
            console.log("[Cron 9h Nhóm] TELEGRAM_GROUP_ID chưa cấu hình, bỏ qua.");
            return;
        }
        try {
            console.log("[Cron 9h Nhóm] Đang tạo báo cáo đầu ngày...");
            const [data, todayMeetings] = await Promise.all([
                fetchAllData(apiClient),
                fetchTodayMeetings(apiClient),
            ]);
            let msg = '';
            // Phần lịch họp đưa lên đầu nếu có
            if (todayMeetings.length > 0) {
                msg += `📆 *LỊCH HỌP HÔM NAY (${todayMeetings.length} cuộc):*\n`;
                todayMeetings.forEach((m) => { msg += formatMeetingBlock(m); });
                msg += '\n';
            }
            msg += (0, issueFormatter_1.formatGroupMorningReport)(data);
            await sendMessage(GROUP_ID, msg);
            console.log("[Cron 9h Nhóm] ✅ Đã gửi báo cáo đầu ngày vào nhóm.");
        }
        catch (err) {
            console.error("[Cron 9h Nhóm] Lỗi:", err);
        }
    }, { timezone: "Asia/Ho_Chi_Minh" });
    // ─────────────────────────────────────────────────────────────────────────
    // CRON 2: 8:20 sáng → Gửi DM cá nhân: Nhắc việc đầu ngày (Thứ 2 - Thứ 7)
    // ─────────────────────────────────────────────────────────────────────────
    node_cron_1.default.schedule('20 8 * * 1-6', async () => {
        try {
            console.log("[Cron 8h20 DM] Đang gửi nhắc nhở đầu ngày cho từng thành viên...");
            const { members, allIssues, todayStr } = await fetchAllData(apiClient);
            console.log(`[Cron 8h20 DM] ${members.length} thành viên, ${allIssues.length} issues`);
            for (const m of members) {
                if (!m.telegramChatId)
                    continue;
                const chatId = Number(m.telegramChatId);
                const myIssues = allIssues.filter((t) => {
                    const isAssigned = t.assigneeId === m.id;
                    const hasAssignedSub = t.subIssues.some((sub) => sub.assigneeId === m.id);
                    return isAssigned || hasAssignedSub;
                });
                const activeIssues = myIssues.filter((t) => !(0, issueFormatter_1.isDoneGroup)(t.State?.group || 'unstarted'));
                if (activeIssues.length === 0) {
                    await sendMessage(chatId, `☀️ *BÁO CÁO ĐẦU NGÀY (8h20)*\n\nChào *${m.fullName}*! Hôm nay bạn không có công việc nào đang mở. Chúc một ngày mới tràn đầy năng lượng! 🎉`, { inline_keyboard: [[{ text: "🌅 Vào ca (Check-in)", callback_data: "attendance_direct:present" }]] });
                    continue;
                }
                const parsed = activeIssues.map((i) => (0, issueFormatter_1.parseIssue)(i, members));
                const overdue = parsed.filter(f => f.isOverdue);
                const dueToday = parsed.filter(f => f.isDueToday);
                const inProgress = parsed.filter(f => !f.isOverdue && !f.isDueToday && f.stateGroup === 'started');
                const others = parsed.filter(f => !f.isOverdue && !f.isDueToday && f.stateGroup !== 'started');
                // Fetch lịch họp hôm nay
                const todayMeetings = await fetchTodayMeetings(apiClient);
                let msg = `☀️ *BÁO CÁO ĐẦU NGÀY (8h20)*\n`;
                msg += `Chào *${m.fullName}*! Dưới đây là công việc cần tập trung hôm nay:\n\n`;
                // Lịch họp đặt LÊN ĐẦU
                if (todayMeetings.length > 0) {
                    msg += `📆 *LỊCH HỌP HÔM NAY (${todayMeetings.length} cuộc):*\n`;
                    todayMeetings.forEach((mtg) => { msg += formatMeetingBlock(mtg); });
                    msg += '\n';
                }
                msg += `📊 Tổng: *${activeIssues.length} task* đang mở\n\n`;
                if (overdue.length > 0) {
                    msg += `🚨 *QUÁ HẠN — cần xử lý ngay (${overdue.length}):*\n`;
                    overdue.forEach(f => { msg += (0, issueFormatter_1.formatIssueBlock)(f, true); });
                    msg += '\n';
                }
                if (dueToday.length > 0) {
                    msg += `⏰ *DEADLINE HÔM NAY (${dueToday.length}):*\n`;
                    dueToday.forEach(f => { msg += (0, issueFormatter_1.formatIssueBlock)(f, true); });
                    msg += '\n';
                }
                if (inProgress.length > 0) {
                    msg += `🟡 *ĐANG TIẾN HÀNH (${inProgress.length}):*\n`;
                    inProgress.forEach(f => { msg += (0, issueFormatter_1.formatIssueBlock)(f, true); });
                    msg += '\n';
                }
                if (others.length > 0) {
                    msg += `📌 *CÔNG VIỆC KHÁC (${others.length}):*\n`;
                    others.slice(0, 4).forEach(f => { msg += (0, issueFormatter_1.formatIssueBlock)(f, false); });
                    if (others.length > 4)
                        msg += `   _(và ${others.length - 4} task khác)_\n`;
                }
                msg += `\n💪 Chúc bạn một ngày làm việc hiệu quả!`;
                await sendMessage(chatId, msg, {
                    inline_keyboard: [[{ text: "🌅 Vào ca (Check-in)", callback_data: "attendance_direct:present" }]]
                });
            }
            console.log("[Cron 8h20 DM] ✅ Đã gửi xong báo cáo đầu ngày cho tất cả thành viên.");
        }
        catch (err) {
            console.error("[Cron 8h20 DM] Lỗi:", err);
        }
    }, { timezone: "Asia/Ho_Chi_Minh" });
    // ─────────────────────────────────────────────────────────────────────────
    // CRON 3: 18:05 chiều → Gửi nhóm: Tổng kết cuối ngày (Thứ 2 - Thứ 7)
    // ─────────────────────────────────────────────────────────────────────────
    node_cron_1.default.schedule('5 18 * * 1-6', async () => {
        if (!GROUP_ID) {
            console.log("[Cron 18h05 Nhóm] TELEGRAM_GROUP_ID chưa cấu hình, bỏ qua.");
            return;
        }
        try {
            console.log("[Cron 18h05 Nhóm] Đang tạo báo cáo cuối ngày...");
            const data = await fetchAllData(apiClient);
            const msg = (0, issueFormatter_1.formatGroupEveningReport)(data);
            await sendMessage(GROUP_ID, msg);
            console.log("[Cron 18h05 Nhóm] ✅ Đã gửi báo cáo cuối ngày vào nhóm.");
        }
        catch (err) {
            console.error("[Cron 18h05 Nhóm] Lỗi:", err);
        }
    }, { timezone: "Asia/Ho_Chi_Minh" });
    // ─────────────────────────────────────────────────────────────────────────
    // CRON 4: 18:05 chiều → Gửi DM cá nhân: Nhắc tiến độ cuối ngày (Thứ 2 - Thứ 7)
    // ─────────────────────────────────────────────────────────────────────────
    node_cron_1.default.schedule('5 18 * * 1-6', async () => {
        try {
            console.log("[Cron 18h05 DM] Đang gửi tổng kết cuối ngày cho từng thành viên...");
            const { members, allIssues, todayStr } = await fetchAllData(apiClient);
            for (const m of members) {
                if (!m.telegramChatId)
                    continue;
                const chatId = Number(m.telegramChatId);
                const myIssues = allIssues.filter((t) => {
                    const isAssigned = t.assigneeId === m.id;
                    const hasAssignedSub = t.subIssues.some((sub) => sub.assigneeId === m.id);
                    return isAssigned || hasAssignedSub;
                });
                const doneToday = myIssues.filter((t) => {
                    const g = t.State?.group || 'unstarted';
                    return g === 'completed' && t.updatedAt?.startsWith(todayStr);
                });
                const stillOpen = myIssues.filter((t) => !(0, issueFormatter_1.isDoneGroup)(t.State?.group || 'unstarted'));
                const openParsed = stillOpen.map((i) => (0, issueFormatter_1.parseIssue)(i, members));
                let msg = `🌇 *TỔNG KẾT CUỐI NGÀY (18h05)*\n`;
                msg += `Chào *${m.fullName}*! Dưới đây là tóm tắt ngày làm việc của bạn:\n\n`;
                if (doneToday.length > 0) {
                    msg += `✅ *ĐÃ HOÀN THÀNH HÔM NAY (${doneToday.length}):*\n`;
                    doneToday.slice(0, 4).forEach((t) => {
                        const f = (0, issueFormatter_1.parseIssue)(t, members);
                        msg += `🟢 *${f.shortId}*: ${t.title}\n`;
                    });
                    msg += '\n';
                }
                if (stillOpen.length > 0) {
                    msg += `⏳ *CÒN MỞ (${stillOpen.length} task):*\n`;
                    openParsed.slice(0, 5).forEach(f => { msg += (0, issueFormatter_1.formatIssueBlock)(f, true); });
                    if (stillOpen.length > 5)
                        msg += `   _(và ${stillOpen.length - 5} task khác)_\n`;
                }
                else {
                    msg += `🎉 Tuyệt vời! Bạn đã hoàn thành tất cả công việc hôm nay!\n`;
                }
                msg += `\n🕐 Nhớ *Check-out* trước khi về nhé! Chúc buổi tối vui vẻ 🌙`;
                await sendMessage(chatId, msg, {
                    inline_keyboard: [[{ text: "🚪 Tan ca (Check-out)", callback_data: "attendance_direct:checkout" }]]
                });
            }
            console.log("[Cron 18h05 DM] ✅ Đã gửi tổng kết cuối ngày cho tất cả thành viên.");
        }
        catch (err) {
            console.error("[Cron 18h05 DM] Lỗi:", err);
        }
    }, { timezone: "Asia/Ho_Chi_Minh" });
    // ─────────────────────────────────────────────────────────────────────────
    // CRON 5: Mỗi phút → Kiểm tra meeting nào sắp bắt đầu trong 30 và 15 phút
    // ─────────────────────────────────────────────────────────────────────────
    // Dùng Set để tránh gửi trùng lặp trong cùng phút
    const notifiedMeeting30m = new Set();
    const notifiedMeeting15m = new Set();
    node_cron_1.default.schedule('* * * * *', async () => {
        try {
            const nowVN = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
            const meetings = await fetchTodayMeetings(apiClient);
            let members = [];
            try {
                const membersRes = await apiClient.get(api_client_1.API_ROUTES.HR.TEAM_MEMBERS);
                members = membersRes?.data || [];
            }
            catch (e) { }
            for (const m of meetings) {
                const startTime = new Date(m.startTime || m.start_time);
                const diffMs = startTime.getTime() - nowVN.getTime();
                const diffMin = Math.floor(diffMs / 60000);
                let notifType = null;
                if (diffMin >= 29 && diffMin <= 31 && !notifiedMeeting30m.has(m.id)) {
                    notifType = '30m';
                    notifiedMeeting30m.add(m.id);
                }
                else if (diffMin >= 14 && diffMin <= 16 && !notifiedMeeting15m.has(m.id)) {
                    notifType = '15m';
                    notifiedMeeting15m.add(m.id);
                }
                if (notifType) {
                    const title = m.title || 'Cuộc họp';
                    const timeStr = startTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
                    const hostName = m.host?.fullName || m.hostName || '';
                    const hostStr = hostName ? ` (Host: ${hostName})` : '';
                    let attendeesNames = [];
                    const attendeesList = m.attendees || [];
                    const dmTargets = new Set();
                    if (m.hostId)
                        dmTargets.add(m.hostId);
                    for (const attendeeId of attendeesList) {
                        const member = members.find((x) => x.id === attendeeId);
                        if (member) {
                            attendeesNames.push(member.fullName);
                            dmTargets.add(member.id);
                        }
                    }
                    const attendeesStr = attendeesNames.length > 0 ? `\\n👥 *Thành phần tham dự*: ${attendeesNames.join(', ')}` : '';
                    const notifMsg = `⏰ *NHẮC LỊCH HỌP*\\n\\n📅 *${title}*${hostStr}\\nSẽ bắt đầu lúc *${timeStr}* (còn ${notifType === '30m' ? '30' : '15'} phút)${attendeesStr}\\n\\nVui lòng chuẩn bị!`;
                    // Gửi vào nhóm
                    if (GROUP_ID) {
                        await sendMessage(GROUP_ID, notifMsg);
                    }
                    // Gửi DM cho host và attendees
                    for (const targetId of dmTargets) {
                        const member = members.find((x) => x.id === targetId);
                        if (member && member.telegramChatId) {
                            try {
                                await sendMessage(Number(member.telegramChatId), notifMsg);
                            }
                            catch { }
                        }
                    }
                    console.log(`[Cron Meeting] ✅ Đã gửi nhắc ${notifType}: "${title}" lúc ${timeStr}`);
                }
            }
            // Cleanup
            [notifiedMeeting30m, notifiedMeeting15m].forEach(set => {
                set.forEach(id => {
                    const m = meetings.find((x) => x.id === id);
                    if (m) {
                        const start = new Date(m.startTime || m.start_time);
                        if (start.getTime() < nowVN.getTime() - 40 * 60 * 1000) {
                            set.delete(id);
                        }
                    }
                });
            });
        }
        catch (err) {
            // Silent - tránh spam log
        }
    }, { timezone: "Asia/Ho_Chi_Minh" });
    console.log("✅ Đã đăng ký 5 Cron Jobs:");
    console.log("   • 8:20 sáng → DM cá nhân: nhắc việc đầu ngày + lịch họp");
    console.log("   • 9:00 sáng → Nhóm: tổng kết đầu ngày + lịch họp");
    console.log("   • 18:05 chiều → Nhóm: tổng kết cuối ngày");
    console.log("   • 18:05 chiều → DM cá nhân: nhắc tiến độ cuối ngày");
    console.log("   • */1 phút → Nhắc meeting 15 phút trước khi bắt đầu");
}
