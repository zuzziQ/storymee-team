"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTelegramMessage = handleTelegramMessage;
const fetchAxios_1 = require("../../fetchAxios");
const api_client_1 = require("@storymee/api-client");
const telegram_agent_1 = require("../../telegram_agent");
const index_1 = require("../../index");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:5100";
const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || "https://dev-hub.storymee.com";
const OMNIROUTER_API_URL = process.env.OMNIROUTER_API_URL || "https://dev-hub.storymee.com/api/ai/chat";
const apiClient = new api_client_1.CoreApiClient({ baseURL: CORE_API_URL + '/internal/v1/team', enforceApiPrefix: false });
async function handleTelegramMessage(message) {
    const chatId = message.chat.id;
    const username = message.from.username;
    let text = (message.text || "").replace(/@storymeebot/gi, "").trim();
    const isGroup = chatId < 0;
    // Hỗ trợ lệnh /ai trong group để bypass Privacy Mode
    let isAiCommand = false;
    if (text.toLowerCase().startsWith("/ai ")) {
        text = text.substring(4).trim();
        isAiCommand = true;
    }
    else if (text.toLowerCase() === "/ai") {
        text = "";
        isAiCommand = true;
    }
    // Trong group chat, chỉ xử lý nếu bắt đầu bằng /ai hoặc các lệnh hệ thống (vd: /checkin, /register)
    if (isGroup && !isAiCommand && !text.startsWith('/')) {
        return; // Bỏ qua tin nhắn thường trong group
    }
    console.log(`[Telegram Msg from @${username} in ${isGroup ? 'Group' : 'Private'} ${chatId}]: ${text}`);
    const lowerText = (text || "").trim().toLowerCase();
    if (!username) {
        if (!isGroup) {
            await (0, telegram_agent_1.sendMessage)(chatId, "⚠️ Vui lòng cấu hình Username trên Telegram của bạn để hệ thống định danh quyền hạn.");
        }
        return;
    }
    // PRE-FETCH Tasks để tối ưu hoá tốc độ (ẩn độ trễ mạng)
    const prefetchTasksPromise = apiClient.get("/internal/v1/team/plane/issues").catch(err => {
        console.error("Lỗi prefetch tasks:", err);
        return null;
    });
    const prefetchProjectsPromise = apiClient.get("/internal/v1/team/plane/projects").catch(err => {
        console.error("Lỗi prefetch projects:", err);
        return null;
    });
    // A. Định danh người dùng qua Postgres API
    let member = null;
    let allMembers = [];
    try {
        allMembers = await (0, telegram_agent_1.getCachedMembers)();
        if (allMembers && allMembers.length > 0) {
            const cleanUsername = (username || "").replace(/^@/, "").toLowerCase().trim();
            member = allMembers.find((m) => {
                if (m.telegramChatId && m.telegramChatId === chatId) {
                    return true;
                }
                if (cleanUsername) {
                    const cleanDB = (m.telegramUsername || "").replace(/^@/, "").toLowerCase().trim();
                    return cleanDB === cleanUsername;
                }
                return false;
            });
        }
    }
    catch (err) {
        console.error("Lỗi định danh nhân sự qua Postgres API:", err);
    }
    // Hỗ trợ đăng ký nhanh cho nhân viên mới
    const { registerCommand } = require('../commands/registerCommand');
    const ctx = {
        chatId, username, text, lowerText: text.toLowerCase().trim(), isGroup, member, allMembers, apiClient, message
    };
    if (registerCommand.match(text, ctx.lowerText)) {
        if (await registerCommand.execute(ctx)) {
            return;
        }
    }
    if (!member) {
        if (!isGroup) {
            await (0, telegram_agent_1.sendMessage)(chatId, `❌ LỖI BẢO MẬT: Tài khoản Telegram **@${username}** chưa được liên kết với nhân sự nào trong hệ thống Storymee.\n\n💡 *Cách xử lý nhanh:* Hãy click nút **👤 Đăng ký nhân viên mới** bên dưới hoặc gõ lệnh đăng ký:\n\n\`/register [email_công_ty] [Họ_và_Tên]\`\n\n_(Ví dụ: \`/register an.nguyen@storymee.com Nguyễn Văn An\`)_`, telegram_agent_1.KEYBOARD_UNAUTHORIZED);
        }
        return;
    }
    // Group commands (Inline Keyboard)
    if (isGroup && (lowerText === "/menu" || lowerText.startsWith("/menu@"))) {
        await (0, telegram_agent_1.sendMessage)(chatId, "🤖 *STORYMEE TEAM BOT*\nChọn chức năng quản lý nhóm:", {
            inline_keyboard: [
                [
                    { text: "📊 Báo cáo Tiến độ Team", callback_data: "group_cmd:check_team" },
                    { text: "🔍 Hỗ trợ AI", callback_data: "group_cmd:ai_help" }
                ],
                [
                    { text: "🌐 Mở Web Quản trị", url: "https://storymee-team.vercel.app/" }
                ]
            ]
        });
        return;
    }
    // B. Tự động ghi nhận chat_id vào Postgres nếu chưa có hoặc thay đổi (chỉ lưu cho Private chat)
    if (!isGroup && (!member.telegramChatId || Number(member.telegramChatId) !== chatId)) {
        try {
            console.log(`[Postgres API] Đang cập nhật chat_id ${chatId} cho @${username}...`);
            try {
                await apiClient.post("/hr/team-members", {
                    fullName: member.fullName,
                    email: member.email,
                    telegramUsername: member.telegramUsername,
                    telegramChatId: chatId,
                    role: member.role,
                    skills: member.skills,
                    bankName: member.bankName,
                    bankAccount: member.bankAccount,
                    phone: member.phone
                });
                console.log(`[Postgres API] Đã đồng bộ thành công chat_id ${chatId} cho @${username} (${member.fullName})`);
                member.telegramChatId = chatId;
            }
            catch (err) {
                throw err;
            }
        }
        catch (err) {
            console.error("Lỗi đồng bộ chat_id lên Postgres API:", err);
        }
    }
    // C. Intercept Global Commands & Buttons để Hủy Session (Tránh kẹt Form)
    const GLOBAL_COMMANDS = [
        "/start", "/check", "/team_status", "trạng thái checkin",
        "/check_all", "/check_team", "📊 trạng thái thành viên",
        "👤 hồ sơ của tôi", "/ho_so",
        "/portal", "🌐 mở web portal",
        "📁 quản lý dự án & task",
        "🌅 điểm danh (check-in/out)", "/checkin", "/checkout",
        "📝 đăng ký nghỉ phép / remote", "/dang_ky", "/nghi_phep", "/remote",
        "📝 công việc của tôi", "/cong_viec",
        "📊 hỏi quy chế đãi ngộ", "/quy_che",
        "/cancel", "hủy", "cancel", "huy"
    ];
    if (GLOBAL_COMMANDS.includes(lowerText) || lowerText.startsWith("/subtask")) {
        if (telegram_agent_1.userFormSession[chatId]) {
            delete telegram_agent_1.userFormSession[chatId];
        }
    }
    if (lowerText === "/cancel" || lowerText === "hủy" || lowerText === "cancel" || lowerText === "huy") {
        await (0, telegram_agent_1.sendMessage)(chatId, "✅ Đã hủy thao tác hiện tại.", telegram_agent_1.KEYBOARD_MAIN);
        return;
    }
    // Xử lý các bước nhập Form đăng ký (nghỉ phép/remote/tạo task/dự án)
    const session = telegram_agent_1.userFormSession[chatId];
    if (session) {
        const { formSessionCommand } = require('../commands/formSessionCommand');
        const ctx = {
            chatId, username, text, lowerText, isGroup, member, allMembers, apiClient, message
        };
        if (await formSessionCommand.execute(ctx)) {
            return;
        }
    }
    if (lowerText === "/start") {
        telegram_agent_1.chatHistories[chatId] = []; // Reset context chat
        await (0, telegram_agent_1.sendMessage)(chatId, `👋 Chào mừng *${member.fullName}* đến với Storymee AI Task Manager!\n\n🤖 Tôi là trợ lý bot tự động hóa. Tôi đã ghi nhận Chat ID của bạn để gửi thông báo công việc & deadline định kỳ.\n\n💡 Sử dụng **khay nút bấm bên dưới** để thực hiện nhanh các tác vụ, hoặc chat trực tiếp bằng tiếng Việt với tôi.`, telegram_agent_1.KEYBOARD_MAIN);
        return;
    }
    // D. Lệnh kiểm tra deadline thủ công dành cho sếp/admin
    if (text.trim() === "/check") {
        const isAdmin = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'].includes(member.email.toLowerCase());
        if (!isAdmin) {
            await (0, telegram_agent_1.sendMessage)(chatId, "⚠️ Quyền hạn không đủ! Lệnh `/check` chỉ dành cho Ban Giám Đốc.");
            return;
        }
        await (0, telegram_agent_1.sendMessage)(chatId, "🔍 Đang tiến hành quét và gửi thông báo deadline tới toàn bộ nhân viên...");
        await (0, telegram_agent_1.checkRealtimeOverdueDeadlines)();
        await (0, telegram_agent_1.sendMessage)(chatId, "✅ Đã quét xong!");
        return;
    }
    // D2. Lệnh check trạng thái toàn bộ member, xếp theo deadline hoặc quá hạn lên đầu
    // F1. Lệnh /team_status
    if (lowerText === "/team_status" || lowerText === "trạng thái checkin") {
        await (0, telegram_agent_1.sendMessage)(chatId, "🔍 Đang truy vấn trạng thái check-in hôm nay...");
        try {
            const resJson = await apiClient.get(api_client_1.API_ROUTES.HR.ATTENDANCE);
            const allRecords = Array.isArray(resJson) ? resJson : (resJson?.data || []);
            const today = new Date().toISOString().split('T')[0];
            const todayRecords = allRecords.filter((r) => (r.date || "").startsWith(today));
            if (todayRecords.length === 0) {
                await (0, telegram_agent_1.sendMessage)(chatId, "📊 *Báo cáo Check-in hôm nay*\nChưa có ai check-in hôm nay.");
                return;
            }
            let checkedIn = 0;
            let late = 0;
            let reportMsg = `📊 *Báo cáo Check-in hôm nay (${today})*\n`;
            const lines = [];
            for (const r of todayRecords) {
                const memberName = r.member?.fullName || "Unknown";
                const workType = r.workType === "remote" ? "Remote" : "Office";
                const ci = r.checkIn ? r.checkIn.substring(11, 16) : "?";
                const co = r.checkOut ? r.checkOut.substring(11, 16) : "Chưa out";
                let icon = "✅";
                if (r.status === "late") {
                    icon = "⚠️";
                    late++;
                }
                else if (r.status === "leave")
                    icon = "🏖️";
                if (r.checkIn)
                    checkedIn++;
                lines.push(`• ${icon} *${memberName}* (${workType}): ${ci} - ${co}`);
            }
            reportMsg += `👥 Đã check-in: *${checkedIn}* | Đi muộn: *${late}*\n\n` + lines.join("\n");
            await (0, telegram_agent_1.sendMessage)(chatId, reportMsg);
        }
        catch (err) {
            console.error("Lỗi lấy team status:", err);
            await (0, telegram_agent_1.sendMessage)(chatId, "❌ Lỗi lấy dữ liệu chấm công.");
        }
        return;
    }
    // F2. Lệnh /subtask
    if (lowerText.startsWith("/subtask")) {
        const query = text.substring(8).trim();
        if (!query) {
            await (0, telegram_agent_1.sendMessage)(chatId, "⚠️ Vui lòng cung cấp mã task hoặc tên task. Ví dụ: `/subtask T-104`\n\n💡 Bạn cũng có thể dùng nút trên Web Portal.");
            return;
        }
        await (0, telegram_agent_1.sendMessage)(chatId, `🤖 Đang phân rã task ${query} bằng AI...`);
        try {
            // Gọi API phân rã của OmniRouter (Web Portal API)
            const res = await (0, fetchAxios_1.fetchAxios)(WEB_PORTAL_URL + "/api/ai/breakdown", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ taskId: query })
            });
            if (res.ok) {
                const json = await res.json();
                if (json.success || json.status === "success") {
                    await (0, telegram_agent_1.sendMessage)(chatId, "✅ Đã phân rã và tạo subtasks thành công trên hệ thống!");
                }
                else {
                    await (0, telegram_agent_1.sendMessage)(chatId, "🤖 Lỗi kết nối AI hoặc task không tồn tại. Vui lòng thử lại sau.");
                }
            }
            else {
                await (0, telegram_agent_1.sendMessage)(chatId, "🤖 Lỗi kết nối AI. Vui lòng thử lại sau.");
            }
        }
        catch (err) {
            console.error("Lỗi phân rã task:", err);
            await (0, telegram_agent_1.sendMessage)(chatId, "🤖 Lỗi kết nối AI. Vui lòng thử lại sau.");
        }
        return;
    }
    if (lowerText === "/check_all" || lowerText === "/check_team" || lowerText.startsWith("/check_team@") || lowerText === "📊 trạng thái thành viên") {
        await (0, telegram_agent_1.sendMessage)(chatId, "🔍 Đang truy vấn cơ sở dữ liệu và tổng hợp báo cáo trạng thái toàn bộ thành viên...");
        let dbTasks = [];
        let mappedTasks = [];
        try {
            const json = await apiClient.get("/internal/v1/team/plane/issues");
            dbTasks = Array.isArray(json) ? json : (json?.data || []);
            const allMembers = await (0, telegram_agent_1.getCachedMembers)();
            dbTasks.forEach((sub) => {
                const memberName = (allMembers || []).find((m) => m.id === sub.assigneeId)?.fullName || sub.Assignee?.fullName || 'Chưa phân công';
                let st = sub.State?.name || 'Todo';
                mappedTasks.push({
                    title: sub.title,
                    status: st,
                    deadline: sub.targetDate ? sub.targetDate.split('T')[0] : 'Chưa đặt',
                    rawDeadline: sub.targetDate ? new Date(sub.targetDate) : null,
                    assignee: memberName,
                    planeTaskId: sub.id,
                    parentId: sub.parentId,
                    sequenceId: sub.sequenceId,
                    projectIdentifier: sub.Project?.identifier || 'ID',
                    subIssues: sub.subIssues || []
                });
            });
        }
        catch (err) {
            console.error("Lỗi fetch tasks cho report:", err);
            await (0, telegram_agent_1.sendMessage)(chatId, "❌ Lỗi kết nối cổng dữ liệu để tải danh sách công việc.");
            return;
        }
        // Chỉ hiển thị các task cha
        const parentTasks = mappedTasks.filter(t => t.parentId === null);
        if (parentTasks.length === 0) {
            await (0, telegram_agent_1.sendMessage)(chatId, "📭 Hiện không có công việc nào trên hệ thống.");
            return;
        }
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        // Lọc bỏ Done
        const activeTasks = parentTasks.filter(t => t.status !== 'Done');
        activeTasks.sort((a, b) => {
            const aReview = a.status === 'In Review';
            const bReview = b.status === 'In Review';
            if (aReview !== bReview)
                return aReview ? -1 : 1;
            const aOverdue = a.rawDeadline && a.rawDeadline < now;
            const bOverdue = b.rawDeadline && b.rawDeadline < now;
            if (aOverdue && !bOverdue)
                return -1;
            if (!aOverdue && bOverdue)
                return 1;
            if (!a.rawDeadline && b.rawDeadline)
                return 1;
            if (a.rawDeadline && !b.rawDeadline)
                return -1;
            if (!a.rawDeadline && !b.rawDeadline)
                return 0;
            return a.rawDeadline.getTime() - b.rawDeadline.getTime();
        });
        const doneCount = parentTasks.filter(t => t.status === 'Done').length;
        const overdueCount = activeTasks.filter(t => t.rawDeadline && t.rawDeadline < now).length;
        const reviewCount = activeTasks.filter(t => t.status === 'In Review').length;
        let reportMsg = `📊 *BÁO CÁO TIẾN ĐỘ ĐỘI NGŨ*\n`
            + `🔵 Review: ${reviewCount} | 🔴 Quá hạn: ${overdueCount} | 🟢 Done: ${doneCount} | 📋 Đang mở: ${activeTasks.length}\n`;
        for (const task of activeTasks) {
            const isOverdue = task.rawDeadline && task.rawDeadline < now;
            let emoji = '⚪';
            if (isOverdue)
                emoji = '🔴';
            else if (task.status === 'In Review')
                emoji = '🔵';
            else if (task.status === 'In Progress')
                emoji = '🟡';
            else if (task.status === 'Done')
                emoji = '🟢';
            const dlText = task.deadline !== 'Chưa đặt'
                ? (isOverdue ? `📅 ${task.deadline} ⚠️ *QUÁ HẠN*` : `📅 ${task.deadline}`)
                : '📅 Chưa đặt';
            const shortId = `*${task.projectIdentifier}-${task.sequenceId}*`;
            reportMsg += `\n${emoji} ${shortId}: ${task.title}\n`;
            reportMsg += `   👤 *${task.assignee}*  |  \`${task.status}\`  |  ${dlText}\n`;
            if (task.subIssues && task.subIssues.length > 0) {
                const totalSubs = task.subIssues.length;
                const doneSubs = task.subIssues.filter((s) => s.State?.name === 'Done').length;
                reportMsg += `   ↳ Tiến độ subtask: ${doneSubs}/${totalSubs} hoàn thành\n`;
            }
            if (reportMsg.length > 3500) {
                await (0, telegram_agent_1.sendMessage)(chatId, reportMsg);
                reportMsg = '';
            }
        }
        if (reportMsg.trim()) {
            await (0, telegram_agent_1.sendMessage)(chatId, reportMsg);
        }
        return;
    }
    // E. Xử lý các nút bấm Reply Keyboard & Commands Tác vụ nhanh
    const cleanText = text.trim().toLowerCase();
    if (cleanText === "👤 hồ sơ của tôi" || cleanText === "/ho_so") {
        if (!member) {
            await (0, telegram_agent_1.sendMessage)(chatId, "❌ Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào. Vui lòng bấm nút đăng ký hoặc liên kết trước.");
            return;
        }
        const skillsStr = Array.isArray(member.skills) && member.skills.length > 0 ? member.skills.join(", ") : "Chưa cập nhật";
        const bankNameStr = member.bankName || "Chưa cập nhật";
        const bankAccountStr = member.bankAccount || "Chưa cập nhật";
        const phoneStr = member.phone || "Chưa cập nhật";
        const leaveLimit = member.annualLeaveLimit || 12;
        const leaveUsed = member.annualLeaveUsed || 0;
        const remoteLimit = member.remoteLimit || 4;
        const remoteUsed = member.remoteUsed || 0;
        const profileMsg = `👤 **HỒ SƠ CÁ NHÂN CỦA BẠN**
    
• Họ và tên: **${member.fullName}**
• Email: **${member.email}**
• Chức danh: **${member.role || 'Nhân viên'}**
• SĐT: **${phoneStr}**
• Tài khoản NH: **${bankNameStr} - ${bankAccountStr}**
• Kỹ năng: *${skillsStr}*

📊 **Hạn mức nghỉ phép & Remote:**
• Nghỉ phép năm: **${leaveUsed} / ${leaveLimit} ngày** đã dùng
• Làm việc từ xa: **${remoteUsed} / ${remoteLimit} ngày** đã dùng

💡 *Lưu ý:* Để cập nhật thông tin cá nhân (SĐT, số tài khoản, kỹ năng...), vui lòng truy cập giao diện Web Portal hoặc gửi yêu cầu cho AI Assistant.`;
        await (0, telegram_agent_1.sendMessage)(chatId, profileMsg);
        return;
    }
    if (cleanText === "/portal" || cleanText === "🌐 mở web portal") {
        if (!member) {
            await (0, telegram_agent_1.sendMessage)(chatId, "❌ Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào. Vui lòng bấm nút đăng ký hoặc liên kết trước.");
            return;
        }
        const token = member.lettaConversationId || `conv-${member.id}`;
        const portalUrl = `${WEB_PORTAL_URL}/login?token=${token}`;
        await (0, telegram_agent_1.sendMessage)(chatId, "🌐 Bấm nút dưới đây để mở giao diện Web Portal:", {
            inline_keyboard: [
                [
                    { text: "🚀 Mở Storymee Portal", url: portalUrl }
                ]
            ]
        });
        return;
    }
    if (cleanText === "📁 quản lý dự án & task") {
        if (!member) {
            await (0, telegram_agent_1.sendMessage)(chatId, "❌ Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào.");
            return;
        }
        await (0, telegram_agent_1.sendMessage)(chatId, "🚀 *QUẢN LÝ DỰ ÁN & TASK*\n\nVui lòng chọn chức năng bạn muốn thực hiện:", {
            inline_keyboard: [
                [
                    { text: "📂 Tạo Dự án mới", callback_data: "start_create_project" }
                ],
                [
                    { text: "📋 Tạo Task mới", callback_data: "start_create_task" }
                ]
            ]
        });
        return;
    }
    if (cleanText === "🌅 điểm danh (check-in/out)" || cleanText === "/checkin" || cleanText === "/checkout") {
        if (!member) {
            await (0, telegram_agent_1.sendMessage)(chatId, "❌ Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào. Vui lòng liên kết trước.");
            return;
        }
        await (0, telegram_agent_1.sendMessage)(chatId, "🌅 *BÁO CÁO ĐIỂM DANH HÀNG NGÀY*\n\nVui lòng chọn ca điểm danh của bạn dưới đây:", {
            inline_keyboard: [
                [
                    { text: "🌅 Vào ca (Check-in)", callback_data: `attendance_direct:present` },
                    { text: "🚪 Tan ca (Check-out)", callback_data: `attendance_direct:checkout` }
                ]
            ]
        });
        return;
    }
    if (cleanText === "📝 đăng ký nghỉ phép / remote" || cleanText === "/dang_ky" || cleanText === "/nghi_phep" || cleanText === "/remote") {
        await (0, telegram_agent_1.sendMessage)(chatId, "📝 *ĐĂNG KÝ NGHỈ PHÉP & REMOTE*\n\nVui lòng chọn loại đăng ký bạn muốn thực hiện dưới đây:", {
            inline_keyboard: [
                [
                    { text: "📅 Xin Nghỉ Phép", callback_data: "start_form:leave" },
                    { text: "💻 Xin làm Remote", callback_data: "start_form:remote" }
                ]
            ]
        });
        return;
    }
    if (cleanText === "📝 công việc của tôi" || cleanText === "/cong_viec") {
        await (0, telegram_agent_1.sendMessage)(chatId, "🔍 Đang truy vấn danh sách công việc của bạn...");
        try {
            const result = await (0, index_1.executeMcpTool)("get_my_issues", { employee_name: member.fullName }, member);
            const text = result.content[0].text;
            // Chỉ thay tiêu đề, giữ nguyên format compact từ MCP tool
            const formattedText = text.replace(/Danh sách task của [^:]+:/i, `📋 *CÔNG VIỆC CỦA BẠN:*`);
            await (0, telegram_agent_1.sendMessage)(chatId, formattedText);
        }
        catch (e) {
            console.error("Lỗi fetch task qua MCP:", e);
            await (0, telegram_agent_1.sendMessage)(chatId, "❌ Gặp lỗi khi truy vấn danh sách công việc.");
        }
        return;
    }
    if (cleanText === "📊 hỏi quy chế đãi ngộ" || cleanText === "/quy_che") {
        await (0, telegram_agent_1.sendMessage)(chatId, "📊 *HỎI ĐÁP QUY CHẾ ĐÃI NGỘ*\n\nBạn muốn tìm hiểu về quy chế nào dưới đây? Click để hỏi trợ lý AI ngay lập tức:", {
            inline_keyboard: [
                [
                    { text: "💵 Lương tháng 13 & Thưởng", callback_data: "ask_faq:lương tháng 13" },
                    { text: "⏱️ Quy định thử việc", callback_data: "ask_faq:quy chế thử việc" }
                ],
                [
                    { text: "📅 Số ngày phép & nghỉ lễ", callback_data: "ask_faq:quy định nghỉ phép năm" },
                    { text: "🏥 Bảo hiểm & phúc lợi", callback_data: "ask_faq:chế độ bảo hiểm" }
                ]
            ]
        });
        return;
    }
    if (!text) {
        if (isGroup)
            return; // Bỏ qua nếu tin nhắn rỗng (ví dụ: chỉ gõ /ai)
        await (0, telegram_agent_1.sendMessage)(chatId, "Vui lòng nhập nội dung để AI hỗ trợ.");
        return;
    }
    await (0, telegram_agent_1.sendChatAction)(chatId, 'typing');
    // E. First-Pass LLM Routing: Phân loại Intent cực nhanh (Gemini 1.5 Flash)
    let userIntent = "TASK"; // Mặc định là TASK nếu có lỗi
    try {
        const flashRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                        role: "user",
                        parts: [{ text: `Phân loại câu sau thuộc nhóm nào: [TASK, HR, PROJECT_MANAGEMENT, CHAT]. Chỉ in ra 1 từ duy nhất. Câu: "${text}"` }]
                    }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 10 }
            })
        });
        if (flashRes.ok) {
            const flashJson = (await flashRes.json());
            const rawOutput = flashJson.candidates?.[0]?.content?.parts?.[0]?.text || "TASK";
            userIntent = rawOutput.trim().toUpperCase().replace(/[^A-Z_]/g, '');
        }
    }
    catch (err) {
        console.error("Lỗi First-Pass LLM Routing:", err);
    }
    // Tái kích hoạt "typing" (vì Telegram timeout action sau 5s)
    await (0, telegram_agent_1.sendChatAction)(chatId, 'typing');
    // F. Fetch Tasks & Projects thực tế từ Postgres CHỈ NẾU intent = TASK hoặc PROJECT_MANAGEMENT
    let dbTasks = [];
    let mappedTasks = [];
    let projects = [];
    if (userIntent === "TASK" || userIntent === "PROJECT_MANAGEMENT" || userIntent === "") {
        try {
            const tasksData = await prefetchTasksPromise;
            if (tasksData) {
                dbTasks = tasksData.data || [];
                dbTasks.forEach((sub) => {
                    mappedTasks.push({
                        id: sub.Project && sub.sequenceId ? `${sub.Project.identifier}-${sub.sequenceId}` : sub.id,
                        title: sub.title,
                        description: sub.description || '',
                        assignee: sub.Assignee ? sub.Assignee.fullName : 'Chưa phân công',
                        priority: sub.priority ? sub.priority.charAt(0).toUpperCase() + sub.priority.slice(1) : 'None',
                        status: sub.State?.name || 'Todo',
                        deadline: sub.targetDate ? sub.targetDate.split('T')[0] : '',
                        estimate: 0,
                        projectId: sub.projectId,
                        uuid: sub.id // Lưu ID UUID thật của subtask để thao tác update sau này
                    });
                });
            }
        }
        catch (err) {
            console.error("Lỗi fetch tasks/projects cho AI context:", err);
        }
        try {
            const projData = await prefetchProjectsPromise;
            if (projData && projData.data) {
                projects = projData.data.map((p) => ({
                    id: p.id,
                    title: p.name,
                    identifier: p.identifier
                }));
            }
        }
        catch (err) {
            console.error("Lỗi parse projects cho AI context:", err);
        }
    }
    // F. Định tuyến cuộc gọi đến OmniRouter AI
    try {
        const history = telegram_agent_1.chatHistories[chatId] || [];
        const res = await (0, fetchAxios_1.fetchAxios)(OMNIROUTER_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: text,
                history: history,
                currentUser: { ...member, name: member.fullName },
                tasks: mappedTasks,
                projects: projects,
                companyRules: "Danh sách nhân sự công ty thực tế từ Database:\n" + allMembers.map((m) => `- ${m.fullName} (Role: ${m.role || 'Nhân viên'})`).join("\n"),
                config: { useCloud: true, useFallback: true, useMasking: true, useCompression: true }
            })
        });
        if (res.ok) {
            const json = (await res.json());
            if (json.status === "success" && json.data) {
                const aiResponse = json.data;
                await (0, telegram_agent_1.sendMessage)(chatId, aiResponse.reply);
                // Lưu hội thoại vào history
                history.push({ role: "user", parts: [{ text: text }] });
                history.push({ role: "model", parts: [{ text: aiResponse.reply }] });
                telegram_agent_1.chatHistories[chatId] = history.slice(-15); // Giới hạn 15 tin nhắn gần nhất
                // G. Xử lý Action từ AI: Lưu vào cache và gửi Inline Keyboard xác nhận
                if (aiResponse.action === 'get_attendance_report') {
                    const rp = aiResponse.reportPayload || {};
                    const result = await (0, index_1.executeMcpTool)("get_attendance_report", {
                        employee_name: rp.employee_name,
                        month: rp.month,
                        year: rp.year
                    }, member);
                    await (0, telegram_agent_1.sendMessage)(chatId, result.content[0].text);
                }
                else if (aiResponse.action === 'get_team_leaves') {
                    const result = await (0, index_1.executeMcpTool)("get_team_leaves", aiResponse.teamLeavesPayload || {}, member);
                    await (0, telegram_agent_1.sendMessage)(chatId, result.content[0].text);
                }
                else if (['create_project', 'update_issue', 'create_issue', 'leave_request', 'check_in_out', 'breakdown_issue', 'update_sub_issues', 'request_issue_approval'].includes(aiResponse.action)) {
                    const actionId = Math.random().toString(36).substring(2, 10);
                    telegram_agent_1.actionCache[actionId] = {
                        action: aiResponse.action,
                        payload: aiResponse.action === 'leave_request'
                            ? aiResponse.leavePayload
                            : aiResponse.action === 'check_in_out'
                                ? aiResponse.checkInOutPayload
                                : aiResponse.action === 'breakdown_issue'
                                    ? aiResponse.breakdownPayload
                                    : aiResponse.action === 'update_sub_issues'
                                        ? aiResponse.updateSubtasksPayload
                                        : aiResponse.action === 'request_issue_approval'
                                            ? aiResponse.approvalPayload
                                            : aiResponse.action === 'create_project'
                                                ? aiResponse.projectPayload
                                                : aiResponse.taskPayload,
                        member: member
                    };
                    let confirmMsg = '';
                    if (aiResponse.action === 'leave_request') {
                        const lp = aiResponse.leavePayload;
                        confirmMsg = `💡 *ĐỀ XUẤT XIN NGHỈ PHÉP:*\n• Loại phép: *${lp.leaveType === 'sick' ? 'Nghỉ ốm' : lp.leaveType === 'annual' ? 'Nghỉ phép năm' : 'Việc riêng'}*\n• Thời gian: *${lp.startDate} đến ${lp.endDate}*\n• Lý do: *${lp.reason || 'Không có'}*`;
                    }
                    else if (aiResponse.action === 'check_in_out') {
                        const cp = aiResponse.checkInOutPayload;
                        confirmMsg = `💡 *ĐỀ XUẤT ĐIỂM DANH:*\n• Trạng thái: *${cp.status === 'present' ? 'Đi làm' : cp.status === 'late' ? 'Đi muộn' : 'Vắng'}*\n• Ghi chú: *${cp.notes || 'Không có'}*${cp.employee_name ? `\n• Nhân sự: *${cp.employee_name}*` : ''}`;
                    }
                    else if (aiResponse.action === 'breakdown_issue') {
                        const bp = aiResponse.breakdownPayload;
                        confirmMsg = `💡 *ĐỀ XUẤT PHÂN RÃ CÔNG VIỆC ${bp.task_id}:*\n• Hệ thống AI sẽ tự động sinh danh sách việc con và lưu vào DB.`;
                    }
                    else if (aiResponse.action === 'update_sub_issues') {
                        const up = aiResponse.updateSubtasksPayload;
                        const listStr = up.titles ? up.titles.map((t) => `  • ${t}`).join('\n') : '';
                        confirmMsg = `💡 *ĐỀ XUẤT CẬP NHẬT CÁC CÔNG VIỆC CON CHO ${up.task_id}:*\n${listStr}\n\n👉 Bấm Xác nhận sẽ xóa toàn bộ việc con cũ của task này và thay bằng danh sách trên.`;
                    }
                    else if (aiResponse.action === 'update_issue') {
                        const tp = aiResponse.taskPayload;
                        const statusText = tp.status ? `\n• Trạng thái mới: *${tp.status}*` : '';
                        const assigneeText = tp.assignee ? `\n• Người phụ trách: *${tp.assignee}*` : '';
                        const deadlineText = tp.deadline ? `\n• Hạn chót mới: *${tp.deadline}*` : '';
                        const estimateText = tp.estimate ? `\n• Ước tính mới: *${tp.estimate}h*` : '';
                        const priorityText = tp.priority ? `\n• Độ ưu tiên: *${tp.priority}*` : '';
                        confirmMsg = `💡 *ĐỀ XUẤT CẬP NHẬT CÔNG VIỆC ${tp.id}:*${statusText}${assigneeText}${deadlineText}${estimateText}${priorityText}`;
                    }
                    else if (aiResponse.action === 'request_issue_approval') {
                        const ap = aiResponse.approvalPayload;
                        confirmMsg = `💡 *ĐỀ XUẤT XIN DUYỆT CÔNG VIỆC ${ap.task_id}:*\n• Yêu cầu: *${ap.type}*\n• Hạn chót xin dời (nếu có): *${ap.new_deadline || 'Không'}*\n• Ghi chú: *${ap.reason || 'Không'}*`;
                    }
                    else if (aiResponse.action === 'create_project') {
                        const pp = aiResponse.projectPayload;
                        confirmMsg = `💡 *ĐỀ XUẤT TẠO DỰ ÁN MỚI:*\n• Tên dự án: *${pp.title}*\n• Mô tả: *${pp.description || 'Không'}*`;
                    }
                    else {
                        const tp = aiResponse.taskPayload;
                        const assigneeText = tp.assignee ? `\n• Người phụ trách: *${tp.assignee}*` : '';
                        const estimateText = tp.estimate ? `\n• Ước tính: *${tp.estimate}h*` : '';
                        const priorityText = tp.priority ? `\n• Độ ưu tiên: *${tp.priority}*` : '';
                        confirmMsg = `💡 *ĐỀ XUẤT TẠO CÔNG VIỆC MỚI:*\n• Tiêu đề: *${tp.title}*${assigneeText}${estimateText}${priorityText}`;
                    }
                    await (0, telegram_agent_1.sendMessage)(chatId, `${confirmMsg}\n\n👉 Vui lòng xác nhận thực thi hành động này dưới đây:`, {
                        inline_keyboard: [
                            [
                                { text: "✅ Xác nhận", callback_data: `confirm_action:${actionId}` },
                                { text: "❌ Hủy bỏ", callback_data: `cancel_action:${actionId}` }
                            ]
                        ]
                    });
                }
            }
            else {
                await (0, telegram_agent_1.sendMessage)(chatId, "⚠️ Trợ lý AI đã nhận yêu cầu nhưng gặp lỗi định cấu hình phản hồi.");
            }
        }
        else {
            const errorText = await res.text().catch(() => "N/A");
            throw new Error(`Lỗi gọi OmniRouter API: status=${res.status}, body=${errorText}`);
        }
    }
    catch (err) {
        console.error("Lỗi kết nối AI:", err);
        await (0, telegram_agent_1.sendMessage)(chatId, `🤖 Cổng AI Gateway hiện chưa cấu hình hoặc đang bảo trì. Đã ghi nhận câu lệnh của bạn: *"${text}"*`);
    }
}
