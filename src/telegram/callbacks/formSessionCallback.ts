import { TelegramCallbackContext, TelegramCallback } from './types';
import { fetchAxios } from '../../fetchAxios';
import { 
  sendMessage, userFormSession, createCalendarKeyboard
} from '../../telegram_agent';
import * as dotenv from "dotenv";

dotenv.config();
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export const formSessionCallback: TelegramCallback = {
  name: 'formSession',
  match: (data: string) => data.startsWith("leave_session:") || 
                           data === "start_form:leave" || 
                           data === "start_form:remote" || 
                           data.startsWith("start_remote_session:") || 
                           data.startsWith("cal_nav:") || 
                           data.startsWith("cal_day:"),
  execute: async (ctx: TelegramCallbackContext) => {
    const { chatId, messageId, data } = ctx;

    if (data.startsWith("leave_session:")) {
      const parts = data.split(":");
      const session = parts[1]; // am, pm, all
      const type = parts[2];
      
      userFormSession[chatId] = {
        type: 'leave',
        leaveType: type,
        remoteSession: session,
        step: 'awaiting_start_date'
      };
      
      const today = new Date();
      try {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📅 *[CHỌN NGÀY NGHỈ]*\n\nVui lòng chọn ngày nghỉ trên lịch dưới đây:`,
            parse_mode: "Markdown",
            reply_markup: createCalendarKeyboard(today.getFullYear(), today.getMonth() + 1, "single_date")
          })
        });
      } catch (e) {}
      return true;
    }

    if (data === "start_form:leave") {
      try {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📅 *[ĐĂNG KÝ NGHỈ PHÉP]*\n\nVui lòng chọn phương thức nghỉ phép của bạn dưới đây:`,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⏱️ Nghỉ trong ngày (Theo ca)", callback_data: "leave_mode:single:annual" },
                  { text: "📅 Nghỉ dài ngày (Nhiều ngày)", callback_data: "leave_mode:range:annual" }
                ]
              ]
            }
          })
        });
      } catch (e) {}
      return true;
    }

    if (data === "start_form:remote") {
      try {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `💻 *[ĐĂNG KÝ LÀM REMOTE]*\n\nVui lòng chọn buổi làm việc remote bạn muốn đăng ký dưới đây:`,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "Cả ngày (Full day)", callback_data: "start_remote_session:all" },
                  { text: "Buổi sáng (AM)", callback_data: "start_remote_session:am" },
                  { text: "Buổi chiều (PM)", callback_data: "start_remote_session:pm" }
                ]
              ]
            }
          })
        });
      } catch (e) {}
      return true;
    }

    if (data.startsWith("start_remote_session:")) {
      const session = data.split(":")[1];
      userFormSession[chatId] = {
        type: 'remote',
        leaveType: 'remote',
        remoteSession: session,
        step: 'awaiting_start_date'
      };
      const today = new Date();
      try {
        await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `💻 *[CHỌN NGÀY LÀM REMOTE]*\n\n👉 *Bước 1/2:* Vui lòng chọn **Ngày làm remote** trên lịch dưới đây:`,
            parse_mode: "Markdown",
            reply_markup: createCalendarKeyboard(today.getFullYear(), today.getMonth() + 1, "remote_date")
          })
        });
      } catch (e) {}
      return true;
    }

    if (data.startsWith("cal_nav:")) {
      const parts = data.split(":");
      const year = Number(parts[1]);
      const month = Number(parts[2]);
      const actionType = parts[3];
      
      try {
        await fetchAxios(`${TELEGRAM_API}/editMessageReplyMarkup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            reply_markup: createCalendarKeyboard(year, month, actionType)
          })
        });
      } catch (e) {}
      return true;
    }

    if (data.startsWith("cal_day:")) {
      const parts = data.split(":");
      const dateVal = parts[1];
      const actionType = parts[2];
      
      const session = userFormSession[chatId];
      if (!session) {
        await sendMessage(chatId, "⚠️ Phiên chọn lịch đã hết hạn. Vui lòng thử lại.");
        return true;
      }
      
      if (actionType === 'single_date') {
        session.startDate = dateVal;
        session.endDate = dateVal;
        session.step = 'awaiting_reason';
        
        const sessionStr = session.remoteSession === 'all' ? 'Nguyên ngày' : session.remoteSession === 'am' ? 'Ca sáng' : 'Ca chiều';
        try {
          await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `📅 Bạn đã chọn nghỉ: *${dateVal}* (Phân loại: *${sessionStr}*)\n\n✍️ Vui lòng nhập **Lý do nghỉ phép**:`,
              parse_mode: "Markdown",
              reply_markup: { force_reply: true, selective: true }
            })
          });
        } catch (e) {}
      } else if (actionType === 'start_date') {
        session.startDate = dateVal;
        const dateParts = dateVal.split("-");
        const year = Number(dateParts[0]);
        const month = Number(dateParts[1]);
        
        try {
          await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `📅 Ngày bắt đầu: *${dateVal}*\n\n👉 *Bước 2/2:* Vui lòng chọn **Ngày kết thúc nghỉ** trên lịch dưới đây:`,
              parse_mode: "Markdown",
              reply_markup: createCalendarKeyboard(year, month, "end_date")
            })
          });
        } catch (e) {}
      } else if (actionType === 'end_date') {
        if (new Date(dateVal) < new Date(session.startDate || '')) {
          await sendMessage(chatId, `⚠️ Ngày kết thúc (*${dateVal}*) không được trước ngày bắt đầu (*${session.startDate}*). Vui lòng chọn lại ngày kết thúc.`);
          return true;
        }
        session.endDate = dateVal;
        session.step = 'awaiting_reason';
        
        try {
          await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `📅 Thời gian nghỉ: *${session.startDate} đến ${dateVal}*\n\n✍️ Vui lòng nhập **Lý do nghỉ phép**:`,
              parse_mode: "Markdown",
              reply_markup: { force_reply: true, selective: true }
            })
          });
        } catch (e) {}
      } else if (actionType === 'remote_date') {
        session.startDate = dateVal;
        session.endDate = dateVal;
        session.step = 'awaiting_reason';
        
        try {
          await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `💻 Bạn đã chọn làm remote ngày: *${dateVal}*\n\n✍️ Vui lòng nhập **Lý do làm remote**:`,
              parse_mode: "Markdown",
              reply_markup: { force_reply: true, selective: true }
            })
          });
        } catch (e) {}
      }
      return true;
    }

    return false;
  }
};
