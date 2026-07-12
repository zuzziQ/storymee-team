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
const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:5100";
const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || "https://dev-hub.storymee.com";
const OMNIROUTER_API_URL = process.env.OMNIROUTER_API_URL || "https://dev-hub.storymee.com/api/ai/chat";
const apiClient = new CoreApiClient({ baseURL: CORE_API_URL + '/internal/v1/team', enforceApiPrefix: false });

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

  // 2. Xác định nhân sự click nút qua Postgres API
  let member: any = null;
  let allMembers: any[] = [];
  try {
    allMembers = await getCachedMembers();
    if (allMembers && allMembers.length > 0) {
      const cleanUsername = (username || "").replace(/^@/, "").toLowerCase().trim();
      member = allMembers.find((m: any) => {
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

  // Xử lý điểm danh nhanh qua nút bấm
  if (data.startsWith("attendance_direct:")) {
    const status = data.split(":")[1] || "present";
    
    try {
      await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: `⏳ *Hệ thống:* Đang gửi thông tin điểm danh đến API Server...`
        })
      });
    } catch (e) {}

    try {
      const result = await executeMcpTool("check_in_out", {
        status,
        notes: "Điểm danh nhanh qua nút bấm Telegram"
      }, member);

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
      console.error("Lỗi điểm danh qua callback:", err);
      try {
        await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `❌ *Hệ thống:* Lỗi điểm danh: ${err.message || String(err)}`
          })
        });
      } catch (e) {}
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
      await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📋 *TẠO TASK MỚI*\n\nVui lòng chọn Dự án cho Task:`,
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

        // Gửi thông báo cho các Admin duyệt ngay lập tức
        if (requestId) {
          const adminEmails = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'];
          console.log("SENDING ADMIN: allMembers count:", allMembers.length, "requestId:", requestId);
          for (const targetMem of allMembers) {
            if ((adminEmails.includes((targetMem.email || "").toLowerCase()) || targetMem.telegramUsername?.toLowerCase() === 'mlq007') && targetMem.telegramChatId) {
              const adminChatId = Number(targetMem.telegramChatId);
              console.log("Found ADMIN:", targetMem.email, "ChatId:", adminChatId);
              const leaveTypeStr = payload.leaveType === 'sick' ? 'Nghỉ ốm' : payload.leaveType === 'annual' ? 'Nghỉ phép năm' : payload.leaveType === 'remote' ? 'Đăng ký Remote' : 'Việc riêng';
              try {
                await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: adminChatId,
                    text: `🔔 *YÊU CẦU DUYỆT PHÉP MỚI*\n\n• Nhân viên: *${actionMember.fullName}*\n• Loại nghỉ: *${leaveTypeStr}*\n• Thời gian: *${payload.startDate} đến ${payload.endDate}*\n• Lý do: *${payload.reason || 'Không có'}*\n\n👉 Vui lòng duyệt hoặc từ chối yêu cầu này dưới đây:`,
                    parse_mode: "Markdown",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          { text: "✅ Duyệt nghỉ", callback_data: `approve_leave:${requestId}` },
                          { text: "❌ Từ chối", callback_data: `reject_leave:${requestId}` }
                        ]
                      ]
                    }
                  })
                });
              } catch (err) {
                console.error("Lỗi gửi tin nhắn duyệt cho admin:", err);
              }
            }
          }
        }
      } else if (action === 'update_issue') {
        let estimateVal = payload.estimate;
        if (payload.deadline && (!estimateVal || estimateVal === 0)) {
          const dDate = new Date(payload.deadline);
          const now = new Date();
          estimateVal = calculateWorkingHours(now, dDate);
        }

        await executeMcpTool("update_issue", {
          task_id: payload.id,
          status: payload.status || undefined,
          assignee: payload.assignee || undefined,
          estimate: estimateVal || undefined,
          priority: payload.priority || undefined,
          deadline: payload.deadline || undefined
        }, actionMember);

        try {
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
          project_id: payload.project_id || payload.projectId || payload.project,
          assignee: payload.assignee || actionMember.fullName,
          estimate: estimateVal || undefined,
          priority: payload.priority || "Medium",
          target_date: payload.deadline || undefined
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
          status: payload.status,
          notes: payload.notes,
          employee_name: payload.employee_name
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
        const result = await executeMcpTool("update_sub_issues", {
          task_id: payload.task_id,
          titles: payload.titles
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
      } else if (action === 'request_issue_approval') {
        const result = await executeMcpTool("request_issue_approval", {
          task_id: payload.task_id,
          type: payload.type,
          reason: payload.reason || "Không có lý do",
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

        // Gửi thông báo cho Admin
        try {
          const allMems = await getCachedMembers();
          if (allMems && allMems.length > 0) {
            const adminEmails = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'];
            for (const targetMem of allMems) {
              if ((adminEmails.includes((targetMem.email || "").toLowerCase()) || targetMem.telegramUsername?.toLowerCase() === 'mlq007') && targetMem.telegramChatId) {
                const adminChatId = Number(targetMem.telegramChatId);
                const reqTypeStr = payload.type === 'extend' || payload.type === 'extend_deadline' ? 'Xin dời deadline' : (payload.type === 'archive' || payload.type === 'delete') ? 'Xin lưu trữ' : 'Yêu cầu không hợp lệ';
                if (payload.type === 'delete') payload.type = 'archive';
                
                await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: adminChatId,
                    text: `🔔 *YÊU CẦU PHÊ DUYỆT MỚI*\n\n• Nhân sự: **${actionMember.fullName}**\n• Task ID: **${payload.task_id}**\n• Yêu cầu: **${reqTypeStr}**\n• Lý do: _${payload.reason || 'Không có'}_` + (payload.new_deadline ? `\n• Hạn mới đề xuất: *${payload.new_deadline}*` : ``),
                    parse_mode: "Markdown",
                    reply_markup: {
                      inline_keyboard: [
                        [{ text: "✅ Phê duyệt", callback_data: `approve_issue:${payload.task_id}:${payload.type}` }],
                        [{ text: "❌ Từ chối", callback_data: `reject_issue:${payload.task_id}:${payload.type}` }]
                      ]
                    }
                  })
                });
              }
            }
          }
        } catch (err) {
          console.error("Lỗi gửi tin nhắn duyệt task cho admin:", err);
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

      const adminEmails = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'];
      for (const targetMem of allMembers) {
        if ((adminEmails.includes((targetMem.email || "").toLowerCase()) || targetMem.telegramUsername?.toLowerCase() === 'mlq007') && targetMem.telegramChatId) {
          const adminChatId = Number(targetMem.telegramChatId);
          const leaveTypeStr = leaveType === 'sick' ? 'Nghỉ ốm' : leaveType === 'annual' ? 'Nghỉ phép năm' : leaveType === 'remote' ? 'Đăng ký Remote' : 'Việc riêng';
          
          try {
            await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: `🔔 *YÊU CẦU DUYỆT PHÉP MỚI*\n\n• Nhân viên: *${member.fullName}*\n• Loại nghỉ: *${leaveTypeStr}*\n• Thời gian: *${startDate} đến ${endDate}*\n• Lý do: *${reason || 'Không có'}*\n\n👉 Vui lòng duyệt hoặc từ chối yêu cầu này dưới đây:`,
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "✅ Duyệt nghỉ", callback_data: `approve_leave:${requestId}` },
                      { text: "❌ Từ chối", callback_data: `reject_leave:${requestId}` }
                    ]
                  ]
                }
              })
            });
          } catch (err) {
            console.error("Lỗi gửi tin nhắn duyệt cho admin:", err);
          }
        }
      }
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

  } else if (data.startsWith("approve_leave:") || data.startsWith("reject_leave:")) {
    // 4. Xử lý Admin phê duyệt hoặc từ chối đơn
    const isAdmin = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'].includes(member.email.toLowerCase());
    if (!isAdmin) {
      await sendMessage(chatId, "⚠️ Quyền hạn không đủ! Bạn không có quyền phê duyệt đơn xin nghỉ phép này.");
      return;
    }

    const action = data.startsWith("approve_leave:") ? "approve" : "reject";
    const requestId = data.split(":")[1];

    try {
      const statusParam = action === "approve" ? "approved" : "rejected";
      try {
          const resJson = await apiClient.post(`${API_ROUTES.HR.LEAVE_REQUESTS}/${requestId}/approve`, { status: statusParam }) as any;
          const actionStr = action === "approve" ? "Đã Phê duyệt" : "Đã Từ chối";
          const emoji = action === "approve" ? "✅" : "❌";

          try {
            await fetchAxios(`${TELEGRAM_API}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: `${callbackQuery.message?.text}\n\n${emoji} *KẾT QUẢ:* Admin *${member.fullName}* đã *${actionStr}* đơn xin nghỉ phép này.`,
                parse_mode: "Markdown"
              })
            });
          } catch (e) {}

        } catch (err: any) {
          await sendMessage(chatId, "❌ Lỗi: Cổng HR Service phản hồi thất bại khi thực thi duyệt phép.");
          throw err;
        }
    } catch (err) {
      console.error("Lỗi gọi API duyệt phép:", err);
    }
  }
}
export { handleCallbackQuery };
