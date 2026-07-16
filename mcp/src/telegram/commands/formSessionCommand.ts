import { TelegramMessageContext, TelegramCommand } from './types';
import { fetchAxios } from '../../fetchAxios';
import { executeMcpTool } from '../../index';
import { 
  sendMessage, userFormSession, KEYBOARD_MAIN
} from '../../telegram_agent';
import { API_ROUTES } from '@storymee/api-client';
import * as dotenv from "dotenv";

dotenv.config();
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export const formSessionCommand: TelegramCommand = {
  name: 'formSession',
  description: 'Xử lý các bước nhập Form đăng ký (nghỉ phép/remote)',
  match: (text: string, lowerText: string) => false, // This is executed conditionally based on session state, not by matching text
  execute: async (ctx: TelegramMessageContext) => {
    const { chatId, text, apiClient } = ctx;
    const session = userFormSession[chatId];
    
    if (!session) return false;

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
        return true;
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
        return true;
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
      return true;
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
        return true;
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
        return true;
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
      return true;
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
        const targetMonth = targetDate.getMonth() + 1;
        
        // Gọi API lấy lịch sử HR của nhân sự trong năm
        const hrRes = await apiClient.get(`${API_ROUTES.HR.ATTENDANCE}/report?year=${targetYear}&memberId=${ctx.member.id}`);
        const hrData = hrRes as any;
        if (hrData && hrData.status === 'success' && Array.isArray(hrData.data)) {
           // Lọc các bản ghi trong tháng
           const monthRecords = hrData.data.filter((r: any) => {
              const d = new Date(r.date);
              return d.getMonth() + 1 === targetMonth && d.getFullYear() === targetYear;
           });
           
           if (formType === 'leave') {
             // Đếm số ngày nghỉ phép năm
             const monthLeaves = monthRecords.filter((r: any) => r.status === 'leave' && r.leaveType !== 'unpaid' && r.leaveType !== 'sick');
             if (monthLeaves.length >= 1) {
                quotaStatusMsg = `\n⚠️ *Cảnh báo:* Bạn đã sử dụng ${monthLeaves.length}/1 ngày phép trong tháng ${targetMonth}. Quản lý có thể sẽ duyệt thành phép không lương.`;
             } else {
                quotaStatusMsg = `\n✅ *Hạn mức:* Bạn chưa sử dụng phép trong tháng ${targetMonth} (0/1 ngày).`;
             }
           } else {
             // Đếm số ngày remote
             const monthRemotes = monthRecords.filter((r: any) => r.isRemote === true);
             const limit = ctx.member.role === 'Lead' ? 4 : 2;
             if (monthRemotes.length >= limit) {
                quotaStatusMsg = `\n⚠️ *Cảnh báo:* Bạn đã sử dụng ${monthRemotes.length}/${limit} ngày Remote trong tháng ${targetMonth}. Vui lòng cẩn nhắc, quản lý có thể sẽ từ chối.`;
             } else {
                quotaStatusMsg = `\n✅ *Hạn mức:* Bạn đã dùng ${monthRemotes.length}/${limit} ngày Remote trong tháng ${targetMonth}.`;
             }
           }
        }
      } catch (err) {
        console.error("Lỗi khi fetch HR report check quota:", err);
      }

      const summaryText = formType === 'leave' 
        ? `📝 **TÓM TẮT ĐƠN XIN NGHỈ PHÉP**\n\n• Loại nghỉ: **${leaveType === 'annual' ? 'Phép năm' : leaveType === 'unpaid' ? 'Không lương' : 'Nghỉ ốm'}**\n• Từ ngày: **${startDate}**\n• Đến ngày: **${endDate}**\n• Lý do: **${reason}**${quotaStatusMsg}\n\n👉 Nhấn Submit để gửi đơn cho Quản lý duyệt.`
        : `💻 **TÓM TẮT ĐĂNG KÝ REMOTE**\n\n• Ngày remote: **${startDate}**\n• Buổi: **${remoteSession === 'am' ? 'Sáng' : remoteSession === 'pm' ? 'Chiều' : 'Cả ngày'}**\n• Lý do: **${reason}**${quotaStatusMsg}\n\n👉 Nhấn Submit để đăng ký.`;
      
      const payloadObj = {
        leaveType: leaveType,
        startDate: startDate,
        endDate: endDate || startDate,
        session: remoteSession,
        reason: reason
      };

      await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: summaryText,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Submit Đơn", callback_data: `confirm_action:${actionId}` },
                { text: "❌ Hủy Bỏ", callback_data: `cancel_action:${actionId}` }
              ]
            ]
          }
        })
      });

      // Lưu payload vào Redis/Cache để callback xử lý
      const { actionCache } = require('../../telegram_agent');
      actionCache[actionId] = {
        action: 'leave_request',
        payload: payloadObj,
        member: ctx.member
      };
      
      return true;
    }

    if (session.step === 'create_project_name') {
      if (!cleanText) {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ Tên Dự án không được để trống! Vui lòng nhập lại **Tên Dự án**:`,
            reply_markup: { force_reply: true, selective: true }
          })
        });
        return true;
      }
      
      session.projectName = cleanText;
      session.step = 'create_project_desc';
      
      await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📝 *TẠO DỰ ÁN MỚI*\n\nVui lòng nhập **Mô tả Dự án** (hoặc gõ "Bỏ qua" nếu không có):`,
          reply_markup: { force_reply: true, selective: true }
        })
      });
      return true;
    }
    
    if (session.step === 'create_project_desc') {
      const description = cleanText.toLowerCase() === "bỏ qua" ? "" : cleanText;
      
      await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⏳ Đang khởi tạo Dự án **${session.projectName}**...`
        })
      });
      
      try {
        const result = await executeMcpTool("create_project", {
          title: session.projectName,
          description: description
        }, ctx.member);
        
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🎉 **TẠO DỰ ÁN THÀNH CÔNG!**\n\n• Tên Dự án: **${session.projectName}**\n• Mô tả: ${description || "Không có"}\n\nBạn có thể bắt đầu tạo Task và gán cho dự án này!`,
            reply_markup: KEYBOARD_MAIN
          })
        });
      } catch (err: any) {
        console.error("Lỗi tạo dự án:", err);
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ Lỗi khi tạo dự án: ${err.message || "Lỗi hệ thống"}`
          })
        });
      }
      
      delete userFormSession[chatId];
      return true;
    }
    
    if (session.step === 'create_task_title') {
      if (!cleanText) {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ Tiêu đề Task không được để trống! Vui lòng nhập lại **Tiêu đề Task**:`,
            reply_markup: { force_reply: true, selective: true }
          })
        });
        return true;
      }
      
      session.taskTitle = cleanText;
      session.step = 'create_task_desc';
      
      await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📝 *TẠO TASK MỚI*\n\nVui lòng nhập **Mô tả chi tiết** cho Task (hoặc gõ "Bỏ qua"):`,
          reply_markup: { force_reply: true, selective: true }
        })
      });
      return true;
    }
    
    if (session.step === 'create_task_desc') {
      const description = cleanText.toLowerCase() === "bỏ qua" ? "" : cleanText;
      
      await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⏳ Đang tạo Task **${session.taskTitle}** và gán cho bạn...`
        })
      });
      
      try {
        const resJson = await executeMcpTool("create_issue", {
          title: session.taskTitle,
          description: description,
          project_id: session.projectId === 'default' ? undefined : session.projectId,
          assignee: ctx.member.id,
          priority: 'medium'
        }, ctx.member);
        
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🎉 **TẠO TASK THÀNH CÔNG!**\n\n• Tiêu đề: **${session.taskTitle}**\n• Người nhận: **${ctx.member.fullName}**\n\nTask đã được thêm vào danh sách công việc của bạn.`,
            reply_markup: KEYBOARD_MAIN
          })
        });
      } catch (err: any) {
        console.error("Lỗi tạo task:", err);
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ Lỗi khi tạo Task: ${err.message || "Lỗi hệ thống"}`
          })
        });
      }
      
      delete userFormSession[chatId];
      return true;
    }
    
    
    if (session.step === 'await_meeting_title') {
      const textContent = text.trim();
      if (textContent === '/cancel') { delete userFormSession[chatId]; await fetchAxios(`${TELEGRAM_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "Đã hủy." }) }); return true; }
      userFormSession[chatId].step = 'await_meeting_time';
      userFormSession[chatId].meetingTitle = textContent;
      await fetchAxios(`${TELEGRAM_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "Vui lòng nhập thời gian bắt đầu (vd: 15:30 ngày mai, hoặc 2026-07-15T15:30):" }) });
      return true;
    }
    
    if (session.step === 'await_meeting_time') {
      const textContent = text.trim();
      if (textContent === '/cancel') { delete userFormSession[chatId]; await fetchAxios(`${TELEGRAM_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "Đã hủy." }) }); return true; }
      
      let startTime = new Date();
      startTime.setHours(startTime.getHours() + 1); // fallback
      
      try {
        const prompt = `You are a datetime parser. Convert this Vietnamese time text "${textContent}" into an ISO 8601 datetime string. The current time is ${new Date().toISOString()}. Only return the raw ISO 8601 string, nothing else.`;
        const flashRes = await fetchAxios(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 30 }
          })
        });
        const flashJson = await flashRes.json() as any;
        const rawOutput = flashJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawOutput) {
          const parsedStr = rawOutput.trim().replace(/```/g, '');
          const parsedDate = new Date(parsedStr);
          if (!isNaN(parsedDate.getTime())) {
            startTime = parsedDate;
          }
        }
      } catch (e) {
        console.error("Parse time error", e);
      }

      let endTime = new Date(startTime.getTime() + 60*60*1000);
      try {
        await apiClient.post('/hr/meetings', {
          title: userFormSession[chatId].meetingTitle,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          hostId: ctx.member.id,
          meetLink: "https://meet.google.com/abc-defg-hij"
        });
        delete userFormSession[chatId];
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "✅ Đã tạo lịch họp thành công!" }) });
      } catch (e) {
        console.error("CREATE MEETING ERROR:", e);
        delete userFormSession[chatId];
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "❌ Gặp lỗi khi tạo lịch họp." }) });
      }
      return true;
    }

    if (session.step === 'await_announcement_text') {
      const textContent = text.trim();
      const senderId = userFormSession[chatId].memberId;
      delete userFormSession[chatId];
      if (textContent === '/cancel') {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "Đã hủy gửi thông báo." }) });
        return true;
      }
      try {
        await apiClient.post('/hr/announcements', {
          title: "Thông báo từ Ban Giám Đốc",
          content: textContent,
          senderId: senderId
        });
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "✅ Đã gửi thông báo thành công tới toàn bộ hệ thống!" }) });
      } catch (e) {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "❌ Gặp lỗi khi gửi thông báo." }) });
      }
      return true;
    }

    // Nếu có session nhưng chưa cover hết các step, mặc định return true để chặn chat tự do
    return true;
  }
};
