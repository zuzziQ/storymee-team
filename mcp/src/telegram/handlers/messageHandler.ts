import { fetchAxios } from '../../fetchAxios';
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import { 
  getCachedMembers, createCalendarKeyboard, sendMessage, 
  formatTelegramText, userFormSession, processingActions, 
  actionCache, chatHistories, KEYBOARD_MAIN, KEYBOARD_UNAUTHORIZED, 
  calculateWorkingHours, checkRealtimeOverdueDeadlines 
} from '../../telegram_agent';
import { executeMcpTool } from '../../index';
import * as dotenv from "dotenv";

dotenv.config();

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:4500";
const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || "https://hub.storymee.com";
const OMNIROUTER_API_URL = process.env.OMNIROUTER_API_URL || "https://hub.storymee.com/api/ai/chat";
const apiClient = new CoreApiClient({ baseURL: CORE_API_URL });

export async function handleTelegramMessage(message: {
  chat: { id: number };
  from: { username: string; first_name: string };
  text: string;
}) {
  const chatId = message.chat.id;
  const username = message.from.username;
  let text = (message.text || "").replace(/@storymeebot/gi, "").trim();
  const isGroup = chatId < 0;

  // Hỗ trợ lệnh /ai trong group để bypass Privacy Mode
  let isAiCommand = false;
  if (text.toLowerCase().startsWith("/ai ")) {
    text = text.substring(4).trim();
    isAiCommand = true;
  } else if (text.toLowerCase() === "/ai") {
    text = "";
    isAiCommand = true;
  }

  // Trong group chat, chỉ xử lý nếu bắt đầu bằng /ai hoặc các lệnh hệ thống (vd: /checkin, /register)
  if (isGroup && !isAiCommand && !text.startsWith('/')) {
    return; // Bỏ qua tin nhắn thường trong group
  }

  console.log(`[Telegram Msg from @${username} in ${isGroup ? 'Group' : 'Private'} ${chatId}]: ${text}`);

  if (!username) {
    if (!isGroup) {
      await sendMessage(chatId, "⚠️ Vui lòng cấu hình Username trên Telegram của bạn để hệ thống định danh quyền hạn.");
    }
    return;
  }


  // PRE-FETCH Tasks để tối ưu hoá tốc độ (ẩn độ trễ mạng)
  const prefetchTasksPromise = apiClient.get("/omnitask/").catch(err => {
    console.error("Lỗi prefetch tasks:", err);
    return null;
  });

  // A. Định danh người dùng qua Postgres API
  let member: any = null;
  let allMembers: any[] = [];
  try {
    allMembers = await getCachedMembers();
    if (allMembers && allMembers.length > 0) {
      const cleanUsername = (username || "").replace(/^@/, "").toLowerCase().trim();
      member = allMembers.find((m: any) => {
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
  } catch (err) {
    console.error("Lỗi định danh nhân sự qua Postgres API:", err);
  }

  // Hỗ trợ đăng ký nhanh cho nhân viên mới
  const lowerText = (text || "").trim().toLowerCase();
  if (lowerText === "👤 đăng ký nhân viên mới") {
    await sendMessage(chatId, "💡 *Cú pháp đăng ký:* `/register [email] [Họ và Tên]`\n\nVí dụ: `/register an.nguyen@storymee.com Nguyễn Văn An` (Hệ thống sẽ tự nhận diện Telegram ID & Username của bạn)");
    return;
  }

  if (lowerText.startsWith("/register")) {
    const parts = text.split(/\s+/);
    if (parts.length < 3) {
      await sendMessage(chatId, "💡 *Cú pháp đăng ký:* `/register [email] [Họ và Tên]`\n\nVí dụ: `/register an.nguyen@storymee.com Nguyễn Văn An` (Hệ thống sẽ tự nhận diện Telegram ID & Username của bạn)");
      return;
    }
    const email = parts[1].trim().toLowerCase();
    const fullName = parts.slice(2).join(" ").trim();
    
    // Kiểm tra định dạng email hợp lệ
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await sendMessage(chatId, "❌ *Lỗi đăng ký:* Email không đúng định dạng. Vui lòng nhập đúng email công ty để liên kết.\n\nVí dụ: `/register an.nguyen@storymee.com Nguyễn Văn An` (Họ tên phải có đầy đủ họ và tên)");
      return;
    }

    // Kiểm tra độ dài Họ tên
    if (fullName.length < 2) {
      await sendMessage(chatId, "❌ *Lỗi đăng ký:* Họ tên quá ngắn. Vui lòng nhập đầy đủ Họ và Tên của bạn.");
      return;
    }

    // 1. Kiểm tra xem Telegram Username này đã được liên kết với ai chưa
    if (member) {
      await sendMessage(chatId, `⚠️ *Tài khoản đã liên kết:* Tài khoản Telegram của bạn đã được liên kết với hồ sơ **${member.fullName}** (Email: \`${member.email}\`) trên hệ thống rồi. Không cần đăng ký lại.\n\n💡 Nếu cần thay đổi liên kết, vui lòng liên hệ Admin.`);
      return;
    }

    try {
      // Fetch tất cả members để kiểm tra trùng lặp email
      const allMems = await getCachedMembers();
      if (allMems && allMems.length > 0) {
          // 2. Kiểm tra xem email này đã tồn tại trong hệ thống chưa
          const existingEmailMember = allMems.find((m: any) => m.email.toLowerCase() === email);
          
          if (existingEmailMember) {
            // Nếu email đã được liên kết với một tài khoản Telegram khác
            if (existingEmailMember.telegramUsername) {
              await sendMessage(chatId, `❌ *Email đã có chủ:* Email \`${email}\` đã được liên kết với tài khoản Telegram **@${existingEmailMember.telegramUsername}**. Không thể đăng ký đè.\n\n💡 Vui lòng kiểm tra lại hoặc liên hệ Admin.`);
              return;
            }
            
            // Nếu email tồn tại nhưng chưa liên kết Telegram -> Thực hiện liên kết hồ sơ sẵn có
            await sendMessage(chatId, "⏳ Đang liên kết tài khoản Telegram của bạn với hồ sơ sẵn có...");
            try {
                const updateRes = await apiClient.post("/hr/team-members", {
                  ...existingEmailMember,
                  telegramUsername: username,
                  telegramChatId: chatId
                });
                await sendMessage(chatId, `🎉 **Liên kết tài khoản thành công!**\n\n• Họ tên: **${existingEmailMember.fullName}**\n• Email: **${existingEmailMember.email}**\n• Chức vụ: **${existingEmailMember.role || 'Nhân viên'}**\n• Telegram: **@${username}**\n\nBạn đã có thể sử dụng tất cả các lệnh của bot.`, KEYBOARD_MAIN);
              } catch (err: any) {
                await sendMessage(chatId, "❌ Lỗi: Cổng đăng ký từ chối liên kết tài khoản.");
                throw err;
              }
            return;
          }
      }

      // 3. Nếu là email hoàn toàn mới -> Tạo mới nhân sự mới
      await sendMessage(chatId, "⏳ Đang tạo hồ sơ nhân sự mới trên hệ thống...");
      try {
          const registerRes = await apiClient.post("/hr/team-members", {
            email,
            fullName,
            telegramUsername: username,
            telegramChatId: chatId,
            role: "Developer",
            skills: []
          });
          await sendMessage(chatId, `🎉 **Đăng ký nhân sự mới thành công!**\n\n• Họ tên: **${fullName}**\n• Email: **${email}**\n• Telegram: **@${username}**\n• Chat ID: **${chatId}**\n\nHệ thống đã tự động tạo hồ sơ của bạn. Bạn đã có thể bắt đầu sử dụng bot!`, KEYBOARD_MAIN);
        } catch (err: any) {
          await sendMessage(chatId, "❌ Lỗi: Cổng đăng ký từ chối tạo tài khoản mới.");
          throw err;
        }
    } catch (err) {
      await sendMessage(chatId, "❌ Lỗi kết nối hệ thống khi đăng ký.");
    }
    return;
  }

  if (!member) {
    if (!isGroup) {
      await sendMessage(
        chatId,
        `❌ LỖI BẢO MẬT: Tài khoản Telegram **@${username}** chưa được liên kết với nhân sự nào trong hệ thống Storymee.\n\n💡 *Cách xử lý nhanh:* Hãy click nút **👤 Đăng ký nhân viên mới** bên dưới hoặc gõ lệnh đăng ký:\n\n\`/register [email_công_ty] [Họ_và_Tên]\`\n\n_(Ví dụ: \`/register an.nguyen@storymee.com Nguyễn Văn An\`)_`,
        KEYBOARD_UNAUTHORIZED
      );
    }
    return;
  }

  // Group commands (Inline Keyboard)
  if (isGroup && (lowerText === "/menu" || lowerText.startsWith("/menu@"))) {
    await sendMessage(chatId, "🤖 *STORYMEE TEAM BOT*\nChọn chức năng quản lý nhóm:", {
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
        } catch (err: any) {
          throw err;
        }
    } catch (err) {
      console.error("Lỗi đồng bộ chat_id lên Postgres API:", err);
    }
  }

  // Xử lý các bước nhập Form đăng ký (nghỉ phép/remote)
  const session = userFormSession[chatId];
  if (session) {
    const cleanText = text.trim();
    if (session.step === 'awaiting_start_date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanText)) {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ Định dạng ngày không đúng! Vui lòng nhập lại dạng \`YYYY-MM-DD\` (ví dụ: \`2026-07-01\`):`,
            reply_markup: { force_reply: true, selective: true }
          })
        });
        return;
      }

      // Kiểm tra ngày không được ở quá khứ
      const now = new Date();
      const vietnamOffset = 7 * 60 * 60 * 1000;
      const todayVn = new Date(now.getTime() + vietnamOffset);
      const todayStr = todayVn.toISOString().split('T')[0];

      if (cleanText < todayStr) {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ Lỗi: Bạn không thể chọn ngày trong quá khứ! Vui lòng nhập lại ngày hiện tại hoặc tương lai (dạng \`YYYY-MM-DD\`, ví dụ: \`${todayStr}\`):`,
            reply_markup: { force_reply: true, selective: true }
          })
        });
        return;
      }

      session.startDate = cleanText;
      
      if (session.type === 'leave') {
        session.step = 'awaiting_end_date';
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📅 *Bước 2/3:* Vui lòng nhập ngày kết thúc nghỉ (định dạng \`YYYY-MM-DD\`, ví dụ: \`2026-07-02\`):`,
            reply_markup: { force_reply: true, selective: true }
          })
        });
      } else {
        session.endDate = cleanText;
        session.step = 'awaiting_reason';
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `💻 *Bước 2/2:* Vui lòng nhập **Lý do làm remote**:`,
            reply_markup: { force_reply: true, selective: true }
          })
        });
      }
      return;
    }

    if (session.step === 'awaiting_end_date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanText)) {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ Định dạng ngày không đúng! Vui lòng nhập lại dạng \`YYYY-MM-DD\` (ví dụ: \`2026-07-02\`):`,
            reply_markup: { force_reply: true, selective: true }
          })
        });
        return;
      }

      // Kiểm tra ngày kết thúc không được nhỏ hơn ngày bắt đầu
      if (cleanText < session.startDate!) {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ Lỗi: Ngày kết thúc không thể trước ngày bắt đầu (${session.startDate})! Vui lòng nhập lại ngày kết thúc (dạng \`YYYY-MM-DD\`):`,
            reply_markup: { force_reply: true, selective: true }
          })
        });
        return;
      }

      session.endDate = cleanText;
      session.step = 'awaiting_reason';
      await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📅 *Bước 3/3:* Vui lòng nhập **Lý do xin nghỉ phép**:`,
          reply_markup: { force_reply: true, selective: true }
        })
      });
      return;
    }

    if (session.step === 'awaiting_reason') {
      session.reason = cleanText;
      
      const formType = session.type;
      let leaveType = session.leaveType || 'annual';
      const remoteSession = session.remoteSession || '';
      const startDate = session.startDate || '';
      const endDate = session.endDate || '';
      const reason = session.reason || '';
      
      delete userFormSession[chatId]; // Xóa session

      const actionId = Math.random().toString(36).substring(2, 10);

      // Tính toán hạn mức dùng phép / remote trong tháng của startDate
      let quotaStatusMsg = '';
      try {
        const targetDate = new Date(startDate);
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth() + 1; // 1-indexed

        try {
            const hrData = (await apiClient.get("/omnitask/hr/leave-requests")) as any;
            if (hrData && hrData.status === 'success' && Array.isArray(hrData.data)) {
              const memberRequests = hrData.data.filter((r: any) => r.memberId === member.id && r.status === 'approved');
              
              if (formType === 'leave') {
                const monthLeaves = memberRequests.filter((r: any) => {
                  const rDate = new Date(r.startDate);
                  return r.leaveType !== 'remote' && rDate.getFullYear() === targetYear && (rDate.getMonth() + 1) === targetMonth;
                });
                
                if (monthLeaves.length >= 1) {
                  leaveType = 'personal'; 
                  quotaStatusMsg = `⚠️ *Cảnh báo hạn mức:* Trong tháng ${targetMonth}/${targetYear}, bạn đã nghỉ *${monthLeaves.length}* ngày phép. Theo quy định, ngày nghỉ tiếp theo này sẽ được tính là *Nghỉ không phép (Không lương)*.`;
                } else {
                  quotaStatusMsg = `✅ *Trong hạn mức:* Bạn chưa nghỉ ngày phép nào trong tháng ${targetMonth}/${targetYear} (Hạn mức: 1 ngày phép/tháng có lương).`;
                }
              } else {
                const monthRemotes = memberRequests.filter((r: any) => {
                  const rDate = new Date(r.startDate);
                  return r.leaveType === 'remote' && rDate.getFullYear() === targetYear && (rDate.getMonth() + 1) === targetMonth;
                });
                const limit = member.remoteLimit || 4;
                if (monthRemotes.length >= limit) {
                  quotaStatusMsg = `⚠️ *Cảnh báo hạn mức:* Trong tháng ${targetMonth}/${targetYear}, bạn đã làm remote *${monthRemotes.length} / ${limit}* ngày. Yêu cầu remote tiếp theo này sẽ vượt quá hạn mức làm việc từ xa của tháng.`;
                } else {
                  quotaStatusMsg = `✅ *Trong hạn mức:* Bạn đã làm remote *${monthRemotes.length} / ${limit}* ngày trong tháng ${targetMonth}/${targetYear}.`;
                }
              }
            }
          } catch (err: any) {
            throw err;
          }
      } catch (err) {
        console.error("Lỗi truy vấn hạn mức phép/remote:", err);
      }

      if (formType === 'leave') {
        actionCache[actionId] = {
          action: 'leave_request',
          payload: { leaveType, startDate, endDate, reason: leaveType === 'personal' ? `[Nghỉ không phép] ${reason}` : reason },
          member
        };
        
        const typeStr = leaveType === 'personal' ? 'Nghỉ không phép (Không lương)' : 'Nghỉ phép năm (Có lương)';
        const infoMsg = `💡 *ĐỀ XUẤT XIN NGHỈ PHÉP:*\n• Loại phép: *${typeStr}*\n• Thời gian: *${startDate} đến ${endDate}*\n• Lý do: *${reason}*\n\n${quotaStatusMsg}\n\n👉 Vui lòng xác nhận thực thi hành động này dưới đây:`;
        
        await sendMessage(chatId, infoMsg, {
          inline_keyboard: [
            [
              { text: "✅ Xác nhận", callback_data: `confirm_action:${actionId}` },
              { text: "❌ Hủy bỏ", callback_data: `cancel_action:${actionId}` }
            ]
          ]
        });
      } else {
        actionCache[actionId] = {
          action: 'leave_request',
          payload: { leaveType: 'remote', startDate, endDate, reason: `[Remote ${remoteSession}] ${reason}` },
          member
        };

        const sessionStr = remoteSession === 'all' ? 'Cả ngày' : remoteSession === 'am' ? 'Buổi sáng (AM)' : 'Buổi chiều (PM)';
        const infoMsg = `💡 *ĐỀ XUẤT ĐĂNG KÝ LÀM REMOTE:*\n• Phiên làm: *${sessionStr}*\n• Ngày: *${startDate}*\n• Lý do: *${reason}*\n\n${quotaStatusMsg}\n\n👉 Vui lòng xác nhận thực thi hành động này dưới đây:`;
        
        await sendMessage(chatId, infoMsg, {
          inline_keyboard: [
            [
              { text: "✅ Xác nhận", callback_data: `confirm_action:${actionId}` },
              { text: "❌ Hủy bỏ", callback_data: `cancel_action:${actionId}` }
            ]
          ]
        });
      }
      return;
    }
    if (session.step === 'create_project_name') {
      session.name = cleanText;
      session.step = 'create_project_desc';
      await sendMessage(chatId, `📝 *Dự án:* ${session.name}\n\nNhập **Mô tả dự án** (hoặc gõ 'bỏ qua' nếu không có):`, { reply_markup: { force_reply: true, selective: true } });
      return;
    }

    if (session.step === 'create_project_desc') {
      const desc = cleanText === 'bỏ qua' ? '' : cleanText;
      delete userFormSession[chatId];
      
      await sendMessage(chatId, "⏳ Đang tạo dự án...");
      try {
        await apiClient.post("/admin/projects", { name: session.name, description: desc });
        await sendMessage(chatId, `✅ **Tạo Dự án thành công!**\n\n• Tên: **${session.name}**\n• Mô tả: ${desc || 'Trống'}`);
      } catch (err: any) {
        await sendMessage(chatId, `❌ Lỗi khi tạo dự án: ${err.message}`);
      }
      return;
    }

    if (session.step === 'create_task_title') {
      session.title = cleanText;
      session.step = 'create_task_desc';
      await sendMessage(chatId, `📝 *Task:* ${session.title}\n\nNhập **Mô tả Task** (hoặc gõ 'bỏ qua'):`, { reply_markup: { force_reply: true, selective: true } });
      return;
    }

    if (session.step === 'create_task_desc') {
      session.description = cleanText === 'bỏ qua' ? '' : cleanText;
      session.step = 'create_task_project';
      await sendMessage(chatId, `Vui lòng nhập **ID Dự án** mà Task này thuộc về (hoặc gõ 'bỏ qua' để không gắn dự án):`, { reply_markup: { force_reply: true, selective: true } });
      return;
    }

    if (session.step === 'create_task_project') {
      const projectId = cleanText === 'bỏ qua' ? null : cleanText;
      delete userFormSession[chatId];
      
      await sendMessage(chatId, "⏳ Đang tạo Task...");
      try {
        await apiClient.post("/admin/tasks", { title: session.title, description: session.description, projectId });
        await sendMessage(chatId, `✅ **Tạo Task thành công!**\n\n• Tiêu đề: **${session.title}**\n• Dự án: ${projectId || 'Không gắn'}`);
      } catch (err: any) {
        await sendMessage(chatId, `❌ Lỗi khi tạo Task: ${err.message}`);
      }
      return;
    }
  }

  // C. Lệnh /start
  if (text.trim() === "/start") {
    chatHistories[chatId] = []; // Reset context chat
    await sendMessage(
      chatId,
      `👋 Chào mừng *${member.fullName}* đến với Storymee AI Task Manager!\n\n🤖 Tôi là trợ lý bot tự động hóa. Tôi đã ghi nhận Chat ID của bạn để gửi thông báo công việc & deadline định kỳ.\n\n💡 Sử dụng **khay nút bấm bên dưới** để thực hiện nhanh các tác vụ, hoặc chat trực tiếp bằng tiếng Việt với tôi.`,
      KEYBOARD_MAIN
    );
    return;
  }

  // D. Lệnh kiểm tra deadline thủ công dành cho sếp/admin
  if (text.trim() === "/check") {
    const isAdmin = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'].includes(member.email.toLowerCase());
    if (!isAdmin) {
      await sendMessage(chatId, "⚠️ Quyền hạn không đủ! Lệnh `/check` chỉ dành cho Ban Giám Đốc.");
      return;
    }
    await sendMessage(chatId, "🔍 Đang tiến hành quét và gửi thông báo deadline tới toàn bộ nhân viên...");
    await checkRealtimeOverdueDeadlines();
    await sendMessage(chatId, "✅ Đã quét xong!");
    return;
  }

  // D2. Lệnh check trạng thái toàn bộ member, xếp theo deadline hoặc quá hạn lên đầu
  
  // F1. Lệnh /team_status
  if (lowerText === "/team_status" || lowerText === "trạng thái checkin") {
    await sendMessage(chatId, "🔍 Đang truy vấn trạng thái check-in hôm nay...");
    try {
      const res = await fetchAxios(CORE_API_URL + "/hr/attendance");
      const json = await res.json();
      const allRecords = Array.isArray(json) ? json : (json?.data || []);
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = allRecords.filter((r: any) => (r.date || "").startsWith(today));
      
      if (todayRecords.length === 0) {
        await sendMessage(chatId, "📊 *Báo cáo Check-in hôm nay*\nChưa có ai check-in hôm nay.");
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
        if (r.status === "late") { icon = "⚠️"; late++; }
        else if (r.status === "leave") icon = "🏖️";
        if (r.checkIn) checkedIn++;
        lines.push(`• ${icon} *${memberName}* (${workType}): ${ci} - ${co}`);
      }
      reportMsg += `👥 Đã check-in: *${checkedIn}* | Đi muộn: *${late}*\n\n` + lines.join("\n");
      await sendMessage(chatId, reportMsg);
    } catch (err) {
      console.error("Lỗi lấy team status:", err);
      await sendMessage(chatId, "❌ Lỗi lấy dữ liệu chấm công.");
    }
    return;
  }

  // F2. Lệnh /subtask
  if (lowerText.startsWith("/subtask")) {
    const query = text.substring(8).trim();
    if (!query) {
      await sendMessage(chatId, "⚠️ Vui lòng cung cấp mã task hoặc tên task. Ví dụ: `/subtask T-104`\n\n💡 Bạn cũng có thể dùng nút trên Web Portal.");
      return;
    }
    await sendMessage(chatId, `🤖 Đang phân rã task ${query} bằng AI...`);
    try {
      // Gọi API phân rã của OmniRouter (Web Portal API)
      const res = await fetchAxios(WEB_PORTAL_URL + "/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: query })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success || json.status === "success") {
           await sendMessage(chatId, "✅ Đã phân rã và tạo subtasks thành công trên hệ thống!");
        } else {
           await sendMessage(chatId, "🤖 Lỗi kết nối AI hoặc task không tồn tại. Vui lòng thử lại sau.");
        }
      } else {
        await sendMessage(chatId, "🤖 Lỗi kết nối AI. Vui lòng thử lại sau.");
      }
    } catch(err) {
      console.error("Lỗi phân rã task:", err);
      await sendMessage(chatId, "🤖 Lỗi kết nối AI. Vui lòng thử lại sau.");
    }
    return;
  }
if (lowerText === "/check_all" || lowerText === "/check_team" || lowerText.startsWith("/check_team@") || lowerText === "📊 trạng thái thành viên") {
    await sendMessage(chatId, "🔍 Đang truy vấn cơ sở dữ liệu và tổng hợp báo cáo trạng thái toàn bộ thành viên...");
    
    let dbTasks: any[] = [];
    let mappedTasks: any[] = [];
    try {
      const json = await apiClient.get("/omnitask/") as any;
      dbTasks = Array.isArray(json) ? json : (json?.data || []);
      
      const allMembers = await getCachedMembers();
      
      dbTasks.forEach((t: any) => {
        if (Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            const memberName = (allMembers || []).find((m:any) => m.id === sub.assigneeId)?.fullName || 'Không rõ';
            
            // Map status text (e.g. pending, in_progress, in_review, done)
            let st = 'Pending';
            if (sub.status === 'in_progress') st = 'In Progress';
            else if (sub.status === 'in_review') st = 'In Review';
            else if (sub.status === 'done') st = 'Done';
            else if (sub.status === 'pending') st = 'Pending';
            else st = sub.status;
            
            mappedTasks.push({
              title: sub.title,
              status: st,
              deadline: sub.deadline ? sub.deadline.split('T')[0] : 'Chưa có',
              rawDeadline: sub.deadline ? new Date(sub.deadline) : null,
              assignee: memberName,
              planeTaskId: sub.planeTaskId || 'Task'
            });
          });
        }
      });
    } catch (err) {
      console.error("Lỗi fetch tasks cho report:", err);
      await sendMessage(chatId, "❌ Lỗi kết nối cổng dữ liệu để tải danh sách công việc.");
      return;
    }

    if (mappedTasks.length === 0) {
      await sendMessage(chatId, "📭 Hiện không có công việc nào trên hệ thống.");
      return;
    }

    // Sắp xếp: In Review → Quá hạn → theo deadline tăng dần. Ẩn Done.
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Lọc bỏ Done
    const activeTasks = mappedTasks.filter(t => t.status !== 'Done');

    activeTasks.sort((a, b) => {
      const aReview = a.status === 'In Review';
      const bReview = b.status === 'In Review';
      if (aReview !== bReview) return aReview ? -1 : 1; // In Review lên đầu

      const aOverdue = a.rawDeadline && a.rawDeadline < now;
      const bOverdue = b.rawDeadline && b.rawDeadline < now;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      if (!a.rawDeadline && b.rawDeadline) return 1;
      if (a.rawDeadline && !b.rawDeadline) return -1;
      if (!a.rawDeadline && !b.rawDeadline) return 0;

      return a.rawDeadline!.getTime() - b.rawDeadline!.getTime();
    });

    const doneCount = mappedTasks.filter(t => t.status === 'Done').length;
    const overdueCount = activeTasks.filter(t => t.rawDeadline && t.rawDeadline < now).length;
    const reviewCount = activeTasks.filter(t => t.status === 'In Review').length;

    let reportMsg = `📊 *BÁO CÁO TIẾN ĐỘ ĐỘI NGŨ*\n`
      + `🔵 Review: *${reviewCount}* | 🔴 Quá hạn: *${overdueCount}* | 🟢 Done: *${doneCount}* | 📋 Tổng đang mở: *${activeTasks.length}*\n`
      + `${'─'.repeat(30)}\n`;

    for (const task of activeTasks) {
      const isOverdue = task.rawDeadline && task.rawDeadline < now;

      let emoji = '⚪';
      if (isOverdue) emoji = '🔴';
      else if (task.status === 'In Review') emoji = '🔵';
      else if (task.status === 'In Progress') emoji = '🟡';
      else if (task.status === 'Todo') emoji = '⚪';

      const dlText = task.deadline
        ? (isOverdue ? `📅 ${task.deadline} ⚠️ QUÁ HẠN` : `📅 ${task.deadline}`)
        : '📅 Chưa đặt';

      reportMsg += `\n${emoji} *${task.planeTaskId}*: ${task.title}\n`;
      reportMsg += `   👤 ${task.assignee}  |  \`${task.status}\`  ${dlText}\n`;

      if (reportMsg.length > 3500) {
        await sendMessage(chatId, reportMsg);
        reportMsg = '';
      }
    }

    if (reportMsg.trim()) {
      await sendMessage(chatId, reportMsg);
    }
    return;
  }

  // E. Xử lý các nút bấm Reply Keyboard & Commands Tác vụ nhanh
  const cleanText = text.trim().toLowerCase();

  if (cleanText === "👤 hồ sơ của tôi" || cleanText === "/ho_so") {
    if (!member) {
      await sendMessage(chatId, "❌ Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào. Vui lòng bấm nút đăng ký hoặc liên kết trước.");
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
    await sendMessage(chatId, profileMsg);
    return;
  }

  if (cleanText === "/portal" || cleanText === "🌐 mở web portal") {
    if (!member) {
      await sendMessage(chatId, "❌ Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào. Vui lòng bấm nút đăng ký hoặc liên kết trước.");
      return;
    }
    
    const token = member.lettaConversationId || `conv-${member.id}`;
    const portalUrl = `${WEB_PORTAL_URL}/login?token=${token}`;
    
    await sendMessage(chatId, "🌐 Bấm nút dưới đây để mở giao diện Web Portal:", {
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
      await sendMessage(chatId, "❌ Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào.");
      return;
    }
    await sendMessage(chatId, "🚀 *QUẢN LÝ DỰ ÁN & TASK*\n\nVui lòng chọn chức năng bạn muốn thực hiện:", {
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
      await sendMessage(chatId, "❌ Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào. Vui lòng liên kết trước.");
      return;
    }
    await sendMessage(chatId, "🌅 *BÁO CÁO ĐIỂM DANH HÀNG NGÀY*\n\nVui lòng chọn ca điểm danh của bạn dưới đây:", {
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
    await sendMessage(chatId, "📝 *ĐĂNG KÝ NGHỈ PHÉP & REMOTE*\n\nVui lòng chọn loại đăng ký bạn muốn thực hiện dưới đây:", {
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
    await sendMessage(chatId, "🔍 Đang truy vấn danh sách công việc của bạn...");
    try {
      const result = await executeMcpTool("get_my_tasks", { employee_name: member.fullName }, member);
      const text = result.content[0].text;
      
      // Chỉ thay tiêu đề, giữ nguyên format compact từ MCP tool
      const formattedText = text.replace(/Danh sách task của [^:]+:/i, `📋 *CÔNG VIỆC CỦA BẠN:*`);
      
      await sendMessage(chatId, formattedText);
    } catch (e: any) {
      console.error("Lỗi fetch task qua MCP:", e);
      await sendMessage(chatId, "❌ Gặp lỗi khi truy vấn danh sách công việc.");
    }
    return;
  }

  if (cleanText === "📊 hỏi quy chế đãi ngộ" || cleanText === "/quy_che") {
    await sendMessage(chatId, "📊 *HỎI ĐÁP QUY CHẾ ĐÃI NGỘ*\n\nBạn muốn tìm hiểu về quy chế nào dưới đây? Click để hỏi trợ lý AI ngay lập tức:", {
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
    if (isGroup) return; // Bỏ qua nếu tin nhắn rỗng (ví dụ: chỉ gõ /ai)
    await sendMessage(chatId, "Vui lòng nhập nội dung để AI hỗ trợ.");
    return;
  }

  await sendMessage(chatId, `⏳ Trợ lý AI đang xử lý yêu cầu của bạn, **${member.fullName}**...`);

  // E. Fetch Tasks & Projects thực tế từ Postgres để truyền cho AI làm ngữ cảnh
  let dbTasks: any[] = [];
  let mappedTasks: any[] = [];
  try {
    const tasksData = await prefetchTasksPromise;
    if (tasksData) {
      dbTasks = tasksData.data || [];
      
      dbTasks.forEach((t: any) => {
        if (Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            mappedTasks.push({
              id: sub.planeTaskId || sub.id,
              title: sub.title,
              description: sub.description || '',
              assignee: sub.Assignee ? sub.Assignee.fullName : 'Chưa phân công',
              priority: sub.priority.charAt(0).toUpperCase() + sub.priority.slice(1),
              status: sub.status === 'pending' ? 'Todo' : sub.status === 'in_progress' ? 'In Progress' : sub.status === 'done' ? 'Done' : sub.status,
              deadline: sub.deadline ? sub.deadline.split('T')[0] : '',
              estimate: sub.estimatedHours || 0,
              projectId: t.id,
              uuid: sub.id // Lưu ID UUID thật của subtask để thao tác update sau này
            });
          });
        }
      });
    }
  } catch (err) {
    console.error("Lỗi fetch tasks/projects cho AI context:", err);
  }

  const projects = dbTasks.map((t: any) => ({
    id: t.id,
    title: t.title
  }));

  // F. Định tuyến cuộc gọi đến OmniRouter AI
  try {
    const history = chatHistories[chatId] || [];
    const res = await fetchAxios(OMNIROUTER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: history,
        currentUser: { ...member, name: member.fullName },
        tasks: mappedTasks,
        projects: projects,
        companyRules: "Danh sách nhân sự công ty thực tế từ Database:\n" + allMembers.map((m:any) => `- ${m.fullName} (Role: ${m.role || 'Nhân viên'})`).join("\n"),
        config: { useCloud: true, useFallback: true, useMasking: true, useCompression: true }
      })
    });

    if (res.ok) {
      const json = (await res.json()) as any;
      if (json.status === "success" && json.data) {
        const aiResponse = json.data;
        await sendMessage(chatId, aiResponse.reply);

        // Lưu hội thoại vào history
        history.push({ role: "user", parts: [{ text: text }] });
        history.push({ role: "model", parts: [{ text: aiResponse.reply }] });
        chatHistories[chatId] = history.slice(-15); // Giới hạn 15 tin nhắn gần nhất

        // G. Xử lý Action từ AI: Lưu vào cache và gửi Inline Keyboard xác nhận
        if (aiResponse.action === 'get_attendance_report') {
          const rp = aiResponse.reportPayload || {};
          const result = await executeMcpTool("get_attendance_report", {
            employee_name: rp.employee_name,
            month: rp.month,
            year: rp.year
          }, member);
          await sendMessage(chatId, result.content[0].text);
        } else if (aiResponse.action === 'get_team_leaves') {
          const result = await executeMcpTool("get_team_leaves", aiResponse.teamLeavesPayload || {}, member);
          await sendMessage(chatId, result.content[0].text);
        } else if (['update_task', 'create_task', 'leave_request', 'check_in_out', 'breakdown_task', 'update_subtasks', 'request_task_approval'].includes(aiResponse.action)) {
          const actionId = Math.random().toString(36).substring(2, 10);
          actionCache[actionId] = {
            action: aiResponse.action,
            payload: aiResponse.action === 'leave_request'
              ? aiResponse.leavePayload
              : aiResponse.action === 'check_in_out'
                ? aiResponse.checkInOutPayload
                : aiResponse.action === 'breakdown_task'
                  ? aiResponse.breakdownPayload
                  : aiResponse.action === 'update_subtasks'
                    ? aiResponse.updateSubtasksPayload
                    : aiResponse.action === 'request_task_approval'
                      ? aiResponse.approvalPayload
                      : aiResponse.taskPayload,
            member: member
          };

          let confirmMsg = '';
          if (aiResponse.action === 'leave_request') {
            const lp = aiResponse.leavePayload;
            confirmMsg = `💡 *ĐỀ XUẤT XIN NGHỈ PHÉP:*\n• Loại phép: *${lp.leaveType === 'sick' ? 'Nghỉ ốm' : lp.leaveType === 'annual' ? 'Nghỉ phép năm' : 'Việc riêng'}*\n• Thời gian: *${lp.startDate} đến ${lp.endDate}*\n• Lý do: *${lp.reason || 'Không có'}*`;
          } else if (aiResponse.action === 'check_in_out') {
            const cp = aiResponse.checkInOutPayload;
            confirmMsg = `💡 *ĐỀ XUẤT ĐIỂM DANH:*\n• Trạng thái: *${cp.status === 'present' ? 'Đi làm' : cp.status === 'late' ? 'Đi muộn' : 'Vắng'}*\n• Ghi chú: *${cp.notes || 'Không có'}*${cp.employee_name ? `\n• Nhân sự: *${cp.employee_name}*` : ''}`;
          } else if (aiResponse.action === 'breakdown_task') {
            const bp = aiResponse.breakdownPayload;
            confirmMsg = `💡 *ĐỀ XUẤT PHÂN RÃ CÔNG VIỆC ${bp.task_id}:*\n• Hệ thống AI sẽ tự động sinh danh sách việc con và lưu vào DB.`;
          } else if (aiResponse.action === 'update_subtasks') {
            const up = aiResponse.updateSubtasksPayload;
            const listStr = up.titles ? up.titles.map((t: string) => `  • ${t}`).join('\n') : '';
            confirmMsg = `💡 *ĐỀ XUẤT CẬP NHẬT CÁC CÔNG VIỆC CON CHO ${up.task_id}:*\n${listStr}\n\n👉 Bấm Xác nhận sẽ xóa toàn bộ việc con cũ của task này và thay bằng danh sách trên.`;
          } else if (aiResponse.action === 'update_task') {
            const tp = aiResponse.taskPayload;
            const statusText = tp.status ? `\n• Trạng thái mới: *${tp.status}*` : '';
            const assigneeText = tp.assignee ? `\n• Người phụ trách: *${tp.assignee}*` : '';
            const deadlineText = tp.deadline ? `\n• Hạn chót mới: *${tp.deadline}*` : '';
            const estimateText = tp.estimate ? `\n• Ước tính mới: *${tp.estimate}h*` : '';
            const priorityText = tp.priority ? `\n• Độ ưu tiên: *${tp.priority}*` : '';
            confirmMsg = `💡 *ĐỀ XUẤT CẬP NHẬT CÔNG VIỆC ${tp.id}:*${statusText}${assigneeText}${deadlineText}${estimateText}${priorityText}`;
          } else if (aiResponse.action === 'request_task_approval') {
            const ap = aiResponse.approvalPayload;
            confirmMsg = `💡 *ĐỀ XUẤT XIN DUYỆT CÔNG VIỆC ${ap.task_id}:*\n• Yêu cầu: *${ap.type}*\n• Hạn chót xin dời (nếu có): *${ap.new_deadline || 'Không'}*\n• Ghi chú: *${ap.reason || 'Không'}*`;
          } else {
            const tp = aiResponse.taskPayload;
            const assigneeText = tp.assignee ? `\n• Người phụ trách: *${tp.assignee}*` : '';
            const estimateText = tp.estimate ? `\n• Ước tính: *${tp.estimate}h*` : '';
            const priorityText = tp.priority ? `\n• Độ ưu tiên: *${tp.priority}*` : '';
            confirmMsg = `💡 *ĐỀ XUẤT TẠO CÔNG VIỆC MỚI:*\n• Tiêu đề: *${tp.title}*${assigneeText}${estimateText}${priorityText}`;
          }

          await sendMessage(chatId, `${confirmMsg}\n\n👉 Vui lòng xác nhận thực thi hành động này dưới đây:`, {
            inline_keyboard: [
              [
                { text: "✅ Xác nhận", callback_data: `confirm_action:${actionId}` },
                { text: "❌ Hủy bỏ", callback_data: `cancel_action:${actionId}` }
              ]
            ]
          });
        }
      } else {
        await sendMessage(chatId, "⚠️ Trợ lý AI đã nhận yêu cầu nhưng gặp lỗi định cấu hình phản hồi.");
      }
    } else {
      const errorText = await res.text().catch(() => "N/A");
      throw new Error(`Lỗi gọi OmniRouter API: status=${res.status}, body=${errorText}`);
    }
  } catch (err) {
    console.error("Lỗi kết nối AI:", err);
    await sendMessage(chatId, `🤖 Cổng AI Gateway hiện chưa cấu hình hoặc đang bảo trì. Đã ghi nhận câu lệnh của bạn: *"${text}"*`);
  }
}
