import { fetchAxios } from '../../fetchAxios';
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import { 
  getCachedMembers, createCalendarKeyboard, sendMessage, 
  formatTelegramText, userFormSession, processingActions, 
  actionCache, chatHistories, KEYBOARD_MAIN, KEYBOARD_UNAUTHORIZED, 
  calculateWorkingHours, checkRealtimeOverdueDeadlines 
} from '../../telegram_agent';
import { handleTelegramMessage } from "../../telegram_agent";
import { executeMcpTool } from '../../index';
import * as dotenv from "dotenv";

dotenv.config();

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CORE_API_URL = process.env.CORE_API_URL || "https://dev-hub.storymee.com";
const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || "https://storymee-team.vercel.app";
// Telegram callbacks must hit public hub AI (same as messageHandler) — never Vercel FE or localhost.
const OMNIROUTER_API_URL =
  process.env.OMNIROUTER_API_URL ||
  `${CORE_API_URL.replace(/\/+$/, "")}/internal/v1/ai/team/chat`;
const apiClient = new CoreApiClient({ baseURL: CORE_API_URL + '/internal/v1/team', enforceApiPrefix: false });

/** Aligned with core-team-api teamAuth.service (email allowlist + role keywords). */
const DEFAULT_ADMIN_EMAILS = (process.env.TEAM_ADMIN_EMAILS ||
  'kimngan151091@gmail.com,lehuyducanh.vn@gmail.com,zuzzivn@gmail.com')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const ADMIN_ROLE_KEYWORDS = ['founder', 'it admin', 'admin', 'director', 'boss', 'manager', 'hr'];

function isMemberTeamAdmin(m: { email?: string | null; role?: string | null } | null | undefined): boolean {
  if (!m) return false;
  const email = (m.email || '').toLowerCase().trim();
  if (email && DEFAULT_ADMIN_EMAILS.includes(email)) return true;
  const role = (m.role || '').toLowerCase();
  return ADMIN_ROLE_KEYWORDS.some((k) => role.includes(k));
}

async function handleCallbackQuery(callbackQuery: any) {
  const queryId = callbackQuery.id;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  const username = callbackQuery.from.username;

  console.log(`[Telegram Callback from @${username}]: ${data}`);

  // 1. Phản hồi để tắt trạng thái loading của nút bấm trên client
  try {
    await fetchAxios(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: queryId })
    });
  } catch (err) {}

  // 2. Xác định nhân sự click nút (ưu tiên chatId, fallback username)
  let member: any = null;
  let allMembers: any[] = [];
  try {
    allMembers = await getCachedMembers();
    if (allMembers && allMembers.length > 0) {
      const cleanUsername = (username || "").replace(/^@/, "").toLowerCase().trim();
      member = allMembers.find((m: any) => {
        if (m.telegramChatId && Number(m.telegramChatId) === Number(chatId)) return true;
        if (!cleanUsername) return false;
        const cleanDB = (m.telegramUsername || "").replace(/^@/, "").toLowerCase().trim();
        return cleanDB === cleanUsername;
      });
    }
  } catch (err) {
    console.error("Lỗi tìm kiếm nhân sự click nút:", err);
  }

  if (!member) {
    // Only warn if it's a private chat, for group chats just ignore it
    if (chatId > 0) {
      await sendMessage(chatId, "❌ LỖI: Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào trong hệ thống.");
    }
    return;
  }

  // Handle Group Commands

  if (data === 'meeting_list') {
    try {
      const res = await apiClient.get('/hr/meetings') as any;
      const meetings = res?.data || [];
      if (meetings.length === 0) {
        await sendMessage(chatId, "Không có lịch họp nào sắp tới.");
        return;
      }
      let msg = "📅 *CÁC LỊCH HỌP SẮP TỚI*\n\n";
      meetings.slice(0, 5).forEach((m: any) => {
        const d = new Date(m.startTime);
        msg += `• *${m.title}*\n  ⏰ ${d.toLocaleTimeString()} - ${d.toLocaleDateString()}\n  🎤 Host: ${m.host?.fullName || 'N/A'}\n\n`;
      });
      await sendMessage(chatId, msg);
    } catch (e) {
      await sendMessage(chatId, "Lỗi khi lấy danh sách lịch họp.");
    }
    return;
  }

  if (data === 'meeting_create') {
    userFormSession[chatId] = {
      step: 'await_meeting_title',
      type: 'meeting_create',
      memberId: member?.id
    };
    await sendMessage(chatId, "Vui lòng nhập tên cuộc họp:\n(Gõ /cancel để hủy)");
    return;
  }

  if (data === "group_cmd:check_team") {
    // Simulate user typing /check_team to trigger the report logic
    await handleTelegramMessage({
      chat: { id: chatId },
      from: { username: username, first_name: "" },
      text: "/check_team"
    });
    return;
  }
  
  if (data === "group_cmd:ai_help") {
    await sendMessage(chatId, "🤖 *HƯỚNG DẪN AI CHO NHÓM*\n\nSếp có thể giao việc bằng cách tag bot và ra lệnh trực tiếp trong nhóm. \n\nVí dụ:\n_@Storymeebot Tạo task 'Khảo sát người dùng', giao cho @quangminh, deadline ngày mai_");
    return;
  }

  // Xử lý điểm danh nhanh qua nút bấm — KHÔNG edit đè báo cáo ngày (cron 8:20/18:05)
  // Formats: attendance_direct:present | attendance_direct:checkout | attendance_direct:present:remote
  if (data.startsWith("attendance_direct:")) {
    const parts = data.split(":");
    const status = parts[1] || "present";
    const workTypeHint = parts[2] === "remote" || parts[2] === "office" ? parts[2] : undefined;
    const isFullRemote =
      String(member?.workArrangement || "").toLowerCase() === "remote" ||
      String(member?.workArrangement || "").toLowerCase() === "full_remote";

    // Answer callback so Telegram stops loading spinner
    try {
      await fetchAxios(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: queryId,
          text: status === "checkout" ? "Đang check-out…" : "Đang check-in…",
        }),
      });
    } catch (e) {}

    try {
      const result = await executeMcpTool(
        "check_in_out",
        {
          status,
          workType: workTypeHint || (isFullRemote && status !== "checkout" ? "remote" : undefined),
          notes:
            status === "checkout"
              ? "Điểm danh nhanh qua nút bấm Telegram"
              : isFullRemote || workTypeHint === "remote"
                ? "Check-in Remote qua nút bấm Telegram"
                : "Điểm danh nhanh qua nút bấm Telegram",
        },
        member
      );

      // Gửi tin NHỚI — giữ nguyên tin báo cáo ngày (message_id) + ẩn nút trên tin gốc
      try {
        await fetchAxios(`${TELEGRAM_API}/editMessageReplyMarkup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [] },
          }),
        });
      } catch (e) {}

      await sendMessage(
        chatId,
        `✅ *Điểm danh xong*\n${result.content[0].text}\n\n_(Báo cáo ngày phía trên vẫn giữ nguyên.)_`,
        KEYBOARD_MAIN
      );
    } catch (err: any) {
      console.error("Lỗi điểm danh qua callback:", err);
      await sendMessage(
        chatId,
        `❌ Lỗi điểm danh: ${err.message || String(err)}`,
        KEYBOARD_MAIN
      );
    }
    return;
  }

  // Handle Project & Task creation
  if (data === "start_create_project") {
    userFormSession[chatId] = { action: 'create_project', step: 'create_project_name' };
    await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `📂 *TẠO DỰ ÁN MỚI*\n\nVui lòng nhập **Tên Dự án**:`,
        reply_markup: { force_reply: true, selective: true }
      })
    });
    return;
  }

  if (data === "start_create_task") {
    try {
      const res = await apiClient.get(API_ROUTES.PLANE.PROJECTS) as any;
      const projects = (res.data || res) || [];
      if (!Array.isArray(projects) || projects.length === 0) {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: `❌ Bạn cần tạo ít nhất 1 Dự án trước khi tạo Task.` })
        });
        return;
      }
      
      const keyboard = projects.map((p: any) => [{ text: `📁 ${p.name}`, callback_data: `select_project:${p.id}` }]);
      keyboard.push([{ text: `➡️ Bỏ qua (Không thuộc dự án nào)`, callback_data: `select_project:default` }]);
      await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📋 *TẠO TASK MỚI*\n\nVui lòng chọn Dự án cho Task.\n_Bỏ qua_ → gán bucket *Không thuộc dự án nào* (DFLT), không mặc định StorymeeTeam.`,
          reply_markup: { inline_keyboard: keyboard }
        })
      });
    } catch (e) {
      console.error(e);
      await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: `❌ Lỗi lấy danh sách dự án.` })
      });
    }
    return;
  }

  if (data.startsWith("select_project:")) {
    const projectId = data.split(":")[1];
    userFormSession[chatId] = { action: 'create_task', step: 'create_task_title', projectId };
    await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `📋 *TẠO TASK MỚI*\n\nVui lòng nhập **Tiêu đề Task**:`,
        reply_markup: { force_reply: true, selective: true }
      })
    });
    return;
  }

  // Xử lý các Inline Keyboard tác vụ nhanh
  if (data.startsWith("leave_mode:")) {
    const parts = data.split(":");
    const mode = parts[1]; // single hoặc range
    const type = parts[2] || 'annual'; // sick, annual, personal
    
    if (mode === 'single') {
      try {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `⏱️ *[NGHỈ TRONG NGÀY (THEO CA)]*\n\nVui lòng chọn ca nghỉ của bạn dưới đây:`,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🌅 Buổi Sáng (AM)", callback_data: `leave_session:am:${type}` },
                  { text: "🌇 Buổi Chiều (PM)", callback_data: `leave_session:pm:${type}` }
                ],
                [
                  { text: "☀️ Nguyên Ngày (Full)", callback_data: `leave_session:all:${type}` }
                ]
              ]
            }
          })
        });
      } catch (e) {}
    } else {
      userFormSession[chatId] = {
        type: 'leave',
        leaveType: type,
        remoteSession: 'range',
        step: 'awaiting_start_date'
      };
      const today = new Date();
      try {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📅 *[NGHỈ DÀI NGÀY]*\n\n👉 *Bước 1/2:* Vui lòng chọn **Ngày bắt đầu nghỉ** trên lịch dưới đây:`,
            parse_mode: "Markdown",
            reply_markup: createCalendarKeyboard(today.getFullYear(), today.getMonth() + 1, "start_date")
          })
        });
      } catch (e) {}
    }
    return;
  }

  const { formSessionCallback } = require('../callbacks/formSessionCallback');
  const ctx = {
    chatId, messageId, callbackQueryId: queryId, data, member, allMembers, apiClient, callbackQuery
  };
  if (await formSessionCallback.execute(ctx)) {
    return;
  }

  if (data.startsWith("ask_faq:")) {
    const query = data.split(":")[1].trim().toLowerCase();
    
    // 1. Định nghĩa nội dung FAQ tĩnh về quy chế đãi ngộ
    if (query === "lương tháng 13") {
      const textResponse = `💵 *QUY ĐỊNH LƯƠNG THÁNG 13 & THƯỞNG*

• *Lương tháng 13:* Toàn bộ nhân viên chính thức làm việc đủ 12 tháng tại công ty sẽ được hưởng lương tháng 13 bằng 1 tháng lương cơ bản theo hợp đồng lao động. Nếu chưa đủ 12 tháng, sẽ tính theo tỷ lệ số tháng làm việc thực tế.
• *Thưởng hiệu quả công việc (KPI):* Xét duyệt dựa trên đánh giá hiệu suất cuối năm (OKR/KPI) của cá nhân và phòng ban do Ban Giám Đốc phê duyệt.`;
      await sendMessage(chatId, textResponse);
      return;
    }
    
    if (query === "quy chế thử việc") {
      const textResponse = `⏱️ *QUY ĐỊNH VỀ THỬ VIỆC*

• *Thời gian thử việc:* 02 tháng đối với vị trí chuyên môn, kỹ thuật hoặc quản lý. 01 tháng đối với vị trí nghiệp vụ khác.
• *Mức lương thử việc:* Hưởng *85%* mức lương chính thức thỏa thuận trong hợp đồng lao động.
• *Đánh giá thử việc:* Sau thời gian thử việc, quản lý trực tiếp sẽ đánh giá hiệu suất để quyết định ký hợp đồng chính thức.`;
      await sendMessage(chatId, textResponse);
      return;
    }
    
    if (query === "quy định nghỉ phép năm") {
      const textResponse = `📅 *QUY ĐỊNH SỐ NGÀY PHÉP & NGHỈ LỄ*

• *Nghỉ phép năm:* Nhân viên chính thức hưởng *12 ngày phép năm* có hưởng lương/năm (tích lũy 1 ngày/tháng). Thâm niên làm việc cứ mỗi năm tăng thêm sẽ cộng thêm 1 ngày phép.
• *Nghỉ lễ Tết:* Được nghỉ và hưởng nguyên lương theo lịch ban hành của Nhà nước (Tết Dương Lịch, Tết Nguyên Đán, Giỗ tổ Hùng Vương, 30/4 - 1/5, Quốc Khánh 2/9).`;
      await sendMessage(chatId, textResponse);
      return;
    }
    
    if (query === "chế độ bảo hiểm") {
      const textResponse = `🏥 *QUY CHẾ BẢO HIỂM & PHÚC LỢI*

• *Bảo hiểm xã hội:* Đóng đầy đủ BHXH, BHYT, BHTN theo quy định của Luật lao động ngay sau khi ký hợp đồng chính thức.
• *Khám sức khỏe định kỳ:* Công ty tổ chức khám sức khỏe tổng quát định kỳ hàng năm cho toàn bộ nhân sự chính thức.
• *Phúc lợi Công đoàn:* Teambuilding, du lịch hàng năm, quà tặng sinh nhật, trợ cấp hiếu hỉ, thai sản theo chính sách của Công đoàn công ty.`;
      await sendMessage(chatId, textResponse);
      return;
    }

    // Fallback: Nếu là các câu hỏi khác, mới gọi AI xử lý
    await sendMessage(chatId, `🔍 Đang chuyển câu hỏi của bạn cho Trợ lý AI: *"${query}"*...`);
    await handleTelegramMessage({
      chat: { id: chatId },
      from: { username: username, first_name: callbackQuery.from.first_name || '' },
      text: query
    });
    return;
  }

  // 3. Xử lý hành động gửi đơn xin nghỉ (Nhân viên click)
  if (data.startsWith("confirm_action:")) {
    const actionId = data.split(":")[1];
    if (processingActions.has(actionId)) {
      console.log(`[Telegram] Bỏ qua click trùng lặp cho actionId: ${actionId}`);
      return;
    }
    
    const actionData = actionCache[actionId];
    if (!actionData) {
      await sendMessage(chatId, "⚠️ Lỗi: Phiên xác nhận đã hết hạn hoặc không tồn tại.");
      return;
    }

    // Normalize payload type from AI response
    if (actionData.payload && actionData.payload.request_type && !actionData.payload.type) {
      actionData.payload.type = actionData.payload.request_type;
    }

    processingActions.add(actionId);

    // Edit message sang trạng thái Đang xử lý ngay lập tức để người dùng không bấm lại được nữa
    try {
      await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: `⏳ *Hệ thống:* Đang xử lý và lưu thông tin vào Database... Vui lòng đợi trong giây lát.`,
          parse_mode: "Markdown"
        })
      });
    } catch (e) {}

    const { action, payload, member: actionMember } = actionData;

    try {
      if (action === 'leave_request') {
        const result = await executeMcpTool("submit_leave_request", {
          startDate: payload.startDate,
          endDate: payload.endDate,
          leaveType: payload.leaveType,
          session: payload.session,
          reason: payload.reason || "Xin nghỉ phép qua Bot Telegram"
        }, actionMember);

        const requestId = (result as any).requestId;

        // Edit message để xoá nút xác nhận
        try {
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `🚀 *Hệ thống:* Đã gửi yêu cầu nghỉ phép của bạn thành công! Phiếu đang ở trạng thái *Chờ duyệt*.`,
              parse_mode: "Markdown"
            })
          });
        } catch (e) {}


      } else if (action === 'update_issue') {
        let estimateVal = payload.estimate;
        if (payload.deadline && (!estimateVal || estimateVal === 0)) {
          const dDate = new Date(payload.deadline);
          const now = new Date();
          estimateVal = calculateWorkingHours(now, dDate);
        }

        try {
          await executeMcpTool("update_issue", {
            task_id: payload.id,
            status: payload.status || undefined,
            assignee: payload.assignee || undefined,
            estimate: estimateVal || undefined,
            priority: payload.priority || undefined,
            deadline: payload.deadline || undefined
          }, actionMember, username);

          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ *Hệ thống:* Đã cập nhật thành công công việc *${payload.id}* qua MCP!`,
              parse_mode: "Markdown"
            })
          });
        } catch (err: any) {
          const errorMsg = err.message || "Lỗi không xác định";
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `❌ *Lỗi khi cập nhật:* ${errorMsg}`,
              parse_mode: "Markdown"
            })
          });
          return;
        }
      } else if (action === 'update_issues') {
        // Batch update nhiều task cùng lúc (e.g. "STO80-5 và STO80-2 done")
        const taskList: any[] = payload.tasks || (payload.id ? [payload] : []);
        const results: string[] = [];
        for (const t of taskList) {
          try {
            await executeMcpTool("update_issue", {
              task_id: t.id,
              status: t.status || payload.status || undefined,
              assignee: t.assignee || undefined,
              priority: t.priority || undefined,
              deadline: t.deadline || undefined
            }, actionMember, username);
            results.push(`✅ ${t.id}`);
          } catch (e: any) {
            results.push(`❌ ${t.id}: ${e.message || 'Lỗi'}`);
          }
        }
        try {
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ *Hệ thống:* Đã cập nhật ${taskList.length} công việc:\n${results.join('\n')}`,
              parse_mode: "Markdown"
            })
          });
        } catch (e) {}
      } else if (action === 'create_issue') {
        let estimateVal = payload.estimate;
        if (payload.deadline && (!estimateVal || estimateVal === 0)) {
          const dDate = new Date(payload.deadline);
          const now = new Date();
          estimateVal = calculateWorkingHours(now, dDate);
        }

        const result = await executeMcpTool("create_issue", {
          title: payload.title || "Nhiệm vụ mới từ Telegram",
          description: payload.description,
          links: payload.links || payload.link_urls,
          media_urls: payload.media_urls || payload.mediaUrls,
          tags: payload.tags,
          project_id: payload.project_id || payload.projectId || payload.project,
          assignee: payload.assignee || actionMember.fullName,
          estimate: estimateVal || undefined,
          priority: payload.priority || "Medium",
          target_date: payload.deadline || payload.target_date || undefined
        }, actionMember);

        try {
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ *Hệ thống:* Đã tạo mới công việc qua MCP thành công!\n${result.content[0].text.split('\n').slice(1).join('\n')}`,
              parse_mode: "Markdown"
            })
          });
        } catch (e) {}
      } else if (action === 'create_project') {
        const result = await executeMcpTool("create_project", {
          title: payload.title,
          description: payload.description
        }, actionMember);

        try {
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ *Hệ thống:* Đã tạo mới dự án qua MCP thành công!\n${result.content[0].text}`,
              parse_mode: "Markdown"
            })
          });
        } catch (e) {}
      } else if (action === 'check_in_out') {
        const result = await executeMcpTool("check_in_out", {
          status: payload.status || payload.action,
          action: payload.action,
          notes: payload.notes,
          employee_name: payload.employee_name,
          workType: payload.workType || payload.work_type,
        }, actionMember);

        try {
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ *Hệ thống:* ${result.content[0].text}`,
              parse_mode: "Markdown"
            })
          });
        } catch (e) {}
      } else if (action === 'breakdown_issue') {
        const result = await executeMcpTool("breakdown_issue", {
          task_id: payload.task_id
        }, actionMember);

        try {
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ *Hệ thống:* ${result.content[0].text}`,
              parse_mode: "Markdown"
            })
          });
        } catch (e) {}
      } else if (action === 'update_sub_issues') {
        try {
          const result = await executeMcpTool("update_sub_issues", {
            task_id: payload.task_id,
            titles: payload.titles
          }, actionMember);

          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ *Hệ thống:* ${result.content[0].text}`,
              parse_mode: "Markdown"
            })
          });
        } catch (err: any) {
          const errorMsg = err.message || "Lỗi không xác định";
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `❌ *Lỗi khi cập nhật việc con:* ${errorMsg}`,
              parse_mode: "Markdown"
            })
          });
          return;
        }
      } else if (action === 'archive_issue' || action === 'delete_issue') {
        try {
          const tool = action === 'delete_issue' ? 'delete_issue' : 'archive_issue';
          const result = await executeMcpTool(tool, {
            task_id: payload.task_id || payload.id || payload.issue_id,
            reason: payload.reason,
          }, actionMember, username);
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ *Hệ thống:* ${result.content[0].text}`,
              parse_mode: "Markdown"
            })
          });
        } catch (err: any) {
          const errorMsg = err.message || "Lỗi không xác định";
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `❌ *Lỗi ${action === 'delete_issue' ? 'xoá' : 'archive'}:* ${errorMsg}`,
              parse_mode: "Markdown"
            })
          });
        }
      } else if (action === 'request_issue_approval') {
        // Legacy: archive/delete → self-service tools; extend → update deadline
        const typ = String(payload.type || '').toLowerCase();
        try {
          let resultText = '';
          if (typ === 'archive' || typ === 'delete' || typ === 'remove') {
            const tool = typ === 'delete' || typ === 'remove' ? 'delete_issue' : 'archive_issue';
            const result = await executeMcpTool(tool, {
              task_id: payload.task_id,
              reason: payload.reason || 'Qua chat',
            }, actionMember, username);
            resultText = result.content[0].text;
          } else {
            await executeMcpTool("update_issue", {
              task_id: payload.task_id,
              deadline: payload.new_deadline
            }, actionMember, username);
            resultText = `Đã cập nhật hạn chót *${payload.task_id}* → *${payload.new_deadline || '?'}*`;
          }
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ *Hệ thống:* ${resultText}`,
              parse_mode: "Markdown"
            })
          });
        } catch (err: any) {
          const errorMsg = err.message || "Lỗi không xác định";
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `❌ *Lỗi:* ${errorMsg}`,
              parse_mode: "Markdown"
            })
          });
        }

      } else if (action === 'create_meeting' || action === 'update_meeting') {
        const mcpTool = action === 'create_meeting' ? 'schedule_meeting' : 'update_meeting';
        try {
          const result = await executeMcpTool(mcpTool, payload, actionMember);
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ *Hệ thống:* ${result.content[0].text}`,
              parse_mode: "Markdown"
            })
          });
        } catch (err: any) {
          const errorMsg = err.message || "Lỗi không xác định";
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `❌ *Lỗi khi thực thi:* ${errorMsg}`,
              parse_mode: "Markdown"
            })
          });
        }
      } else if (action === 'approve_issue_request') {
        const result = await executeMcpTool("approve_issue_request", {
          task_id: payload.task_id,
          type: payload.type,
          decision: payload.decision,
          new_deadline: payload.new_deadline
        }, actionMember);

        try {
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ *Hệ thống:* ${result.content[0].text}`,
              parse_mode: "Markdown"
            })
          });
        } catch (e) {}
      } else if (action === 'get_attendance_report') {
        const result = await executeMcpTool("get_attendance_report", {
          employee_name: payload.employee_name,
          month: payload.month,
          year: payload.year
        }, actionMember);

        try {
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: result.content[0].text,
              parse_mode: "Markdown"
            })
          });
        } catch (e) {}
      }

      delete actionCache[actionId];
    } catch (err) {
      console.error("Lỗi xác nhận hành động:", err);
      await sendMessage(chatId, "❌ Lỗi kết nối hệ thống khi xác nhận hành động.");
    } finally {
      processingActions.delete(actionId);
    }

    return;
  }

  if (data.startsWith("cancel_action:")) {
    const actionId = data.split(":")[1];
    delete actionCache[actionId];
    try {
      await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: `❌ Yêu cầu hành động đã được hủy bỏ.`,
          parse_mode: "Markdown"
        })
      });
    } catch (e) {}
    return;
  }

  if (data.startsWith("submit_leave:") || data.startsWith("submit_remote:")) {
    const parts = data.split(":");
    const leaveType = parts[1];
    const startDate = parts[2];
    const endDate = parts[3];
    const reason = parts.slice(4).join(":"); // Hỗ trợ lý do có dấu hai chấm

    try {
      const result = await executeMcpTool("submit_leave_request", {
        startDate: startDate,
        endDate: endDate,
        leaveType: leaveType,
        reason: reason || "Xin nghỉ phép qua Bot Telegram"
      }, member);
      
      const requestId = (result as any).requestId;

      try {
        await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `🚀 *Hệ thống:* ${result.content[0].text}`,
            parse_mode: "Markdown"
          })
        });
      } catch (e) {}


    } catch (err: any) {
      console.error("Lỗi gọi API leave-request:", err);
      await sendMessage(chatId, `❌ Lỗi: ${err.message || "Không thể khởi tạo phiếu nghỉ phép."}`);
    }

  } else 
  if (data.startsWith("approve_issue:") || data.startsWith("reject_issue:")) {
    const parts = data.split(":");
    const action = parts[0] === "approve_issue" ? "approve" : "reject";
    const taskId = parts[1];
    const reqType = parts[2] || 'archive'; // fallback if undefined

    try {
      try {
          await executeMcpTool("approve_issue_request", {
            task_id: taskId,
            type: reqType,
            decision: action
          }, member);
          const actionStr = action === "approve" ? "Đã Phê duyệt" : "Đã Từ chối";
          const emoji = action === "approve" ? "✅" : "❌";

          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: callbackQuery.message?.text + `\n\n${emoji} *${actionStr}*`,
              parse_mode: "Markdown"
            })
          });
        } catch (err: any) {
          await sendMessage(chatId, "❌ Lỗi hệ thống khi duyệt task.");
          throw err;
        }
    } catch (err) {
      console.error("Lỗi gọi API duyệt task:", err);
      await sendMessage(chatId, "❌ Lỗi kết nối hệ thống.");
    }
    return;
  }

  if (data === "cancel_leave") {
    try {
      await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: `❌ Yêu cầu xin nghỉ phép đã được hủy bỏ.`,
          parse_mode: "Markdown"
        })
      });
    } catch (e) {}


  } else if (data.startsWith('submit_output_done:') || data.startsWith('submit_no_output:')) {
    // SSOT: PATCH status=in_review + output → NATS notifies admins (không dual-notify)
    const parts = data.split(':');
    const issueId = parts[1];
    const issueShortId = parts[2] || issueId;
    const { outputSessions } = await import('../../sessionStore');
    const session = outputSessions.get(chatId);
    if (data.startsWith('submit_no_output:') || !session) {
      const texts = session?.texts?.length
        ? session.texts
        : ['(Nhan su xac nhan khong co output)'];
      const urls = session?.urls || [];
      outputSessions.delete(chatId);
      try {
        await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${issueId}`, {
          status: 'in_review',
          outputContent: texts.join('\n') || '(khong co output)',
          outputUrls: urls,
          submittedById: member.id,
        });
      } catch (e) {
        console.error('[submit_no_output] PATCH error:', e);
        await sendMessage(chatId, 'Loi khi nop ket qua. Vui long thu lai.');
        return;
      }
      await sendMessage(chatId, `Da gui cho Admin duyet. Ban se nhan thong bao khi co ket qua.`, KEYBOARD_MAIN);
    } else {
      outputSessions.delete(chatId);
      const outputContent = session.texts.join('\n') || '(khong co text)';
      const outputUrls = session.urls;
      try {
        await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${session.issueId}`, {
          status: 'in_review',
          outputContent,
          outputUrls,
          submittedById: member.id,
        });
      } catch (e) {
        console.error('[submit_output_done] PATCH error:', e);
        await sendMessage(chatId, 'Loi khi nop ket qua. Vui long thu lai.');
        return;
      }
      await sendMessage(chatId, `Da gui ket qua cho Admin duyet. Ban se nhan thong bao khi co ket qua.`, KEYBOARD_MAIN);
    }

  } else if (data.startsWith('review_approve:') || data.startsWith('review_reject:')) {
    // SSOT: POST /plane/issues/:id/review — không PATCH status=done
    if (!isMemberTeamAdmin(member)) {
      await sendMessage(chatId, 'Ban khong co quyen duyet task.');
      return;
    }
    const issueId = data.split(':')[1];
    const isApprove = data.startsWith('review_approve:');

    if (isApprove) {
      try {
        await apiClient.post(`${API_ROUTES.PLANE.ISSUES}/${issueId}/review`, {
          decision: 'approve',
          reviewerId: member.id,
          reviewNote: 'Da duoc Admin duyet qua Telegram',
        });
        // Assignee notify via NATS core.team.task.review_approved
        await sendMessage(chatId, `Da duyet task thanh Done.`);
        try {
          await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId, message_id: messageId,
              text: `${callbackQuery.message?.text}\n\nDA DUYET boi ${member.fullName}`,
              parse_mode: 'Markdown'
            })
          });
        } catch (e) {}
      } catch (e) {
        console.error('[review_approve] error:', e);
        await sendMessage(chatId, 'Loi duyet task.');
      }
    } else {
      // Tu choi: hoi ly do → messageHandler await_reject_reason → POST /review reject
      const { userFormSession } = await import('../../telegram_agent');
      userFormSession[chatId] = { step: 'await_reject_reason', issueId, adminId: member.id };
      await sendMessage(chatId, `Nhap ly do tu choi (se gui cho nhan su):`);
    }

  } else if (data.startsWith('account_approve:') || data.startsWith('account_reject:')) {
    if (!isMemberTeamAdmin(member)) {
      await sendMessage(chatId, 'Chỉ Admin mới được duyệt tài khoản nội bộ.');
      return;
    }
    const memberId = data.split(':')[1];
    const isApprove = data.startsWith('account_approve:');
    try {
      const path = isApprove
        ? `${API_ROUTES.HR.TEAM_MEMBERS}/${memberId}/approve`
        : `${API_ROUTES.HR.TEAM_MEMBERS}/${memberId}/reject`;
      await apiClient.post(path, {
        reviewerId: member.id,
        note: isApprove ? 'Duyệt qua Telegram' : 'Từ chối qua Telegram',
      });
      await sendMessage(chatId, isApprove ? '✅ Đã duyệt tài khoản.' : '❌ Đã từ chối đăng ký.');
      try {
        await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `${callbackQuery.message?.text || ''}\n\n→ ${isApprove ? 'DUYỆT' : 'TỪ CHỐI'} bởi ${member.fullName}`,
            parse_mode: 'Markdown',
          }),
        });
      } catch (e) {}
    } catch (e: any) {
      console.error('[account_approve/reject]', e);
      await sendMessage(chatId, `Lỗi: ${e?.message || e}`);
    }
    return;

  } else if (data.startsWith('approve_leave:') || data.startsWith('reject_leave:')) {
    // 4. Xử lý Admin phê duyệt hoặc từ chối đơn
    if (!isMemberTeamAdmin(member)) {
      await sendMessage(chatId, "Chi Admin moi co quyen phe duyet don xin nghi phep.");
      return;
    }

    const action = data.startsWith("approve_leave:") ? "approve" : "reject";
    const requestId = data.split(":")[1];

    try {
      const statusParam = action === "approve" ? "approved" : "rejected";
      try {
          const resJson = await apiClient.post(`${API_ROUTES.HR.LEAVE_REQUESTS}/${requestId}/approve`, { status: statusParam }) as any;
          const actionStr = action === "approve" ? "Da Phe duyet" : "Da Tu choi";
          const emoji = action === "approve" ? "OK" : "X";

          try {
            await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: `${callbackQuery.message?.text}\n\n${emoji} KET QUA: Admin ${member.fullName} da ${actionStr} don xin nghi phep nay.`,
                parse_mode: "Markdown"
              })
            });
          } catch (e) {}

        } catch (err: any) {
          await sendMessage(chatId, "Loi: Cong HR Service phan hoi that bai khi thuc thi duyet phep.");
          throw err;
        }
    } catch (err) {
      console.error("Loi goi API duyet phep:", err);
    }
  }
}
export { handleCallbackQuery };

