import { TelegramMessageContext, TelegramCommand } from './types';
import { fetchAxios } from '../../fetchAxios';
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import { 
  sendMessage, userFormSession, KEYBOARD_MAIN
} from '../../telegram_agent';
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
        const hrRes = await apiClient.get(`/hr/attendance/report?year=${targetYear}&memberId=${ctx.member.id}`);
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
        : `💻 **TÓM TẮT ĐĂNG KÝ REMOTE**\n\n• Ngày remote: **${startDate}**\n• Buổi: **${remoteSession === 'morning' ? 'Sáng' : remoteSession === 'afternoon' ? 'Chiều' : 'Cả ngày'}**\n• Lý do: **${reason}**${quotaStatusMsg}\n\n👉 Nhấn Submit để đăng ký.`;
      
      const actionData = JSON.stringify({
        action: formType === 'leave' ? 'submit_leave' : 'submit_remote',
        type: leaveType,
        start: startDate,
        end: endDate || startDate,
        session: remoteSession,
        reason: reason
      });

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
      actionCache.set(actionId, {
        payload: JSON.parse(actionData)
      });
      
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
        await apiClient.post(API_ROUTES.PLANE.PROJECTS, {
          name: session.projectName,
          description: description
        });
        
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
        const resJson = await apiClient.post(API_ROUTES.PLANE.ISSUES, {
          title: session.taskTitle,
          description: description,
          projectId: session.projectId,
          assigneeId: ctx.member.id,
          priority: 'medium'
        }) as any;
        
        if (resJson.success === false) {
          throw new Error(resJson.message || "Lỗi tạo issue tại Core API Service.");
        }
        
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
    
    // Nếu có session nhưng chưa cover hết các step, mặc định return true để chặn chat tự do
    return true;
  }
};
