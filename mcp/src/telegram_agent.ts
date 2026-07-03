import { fetchAxios } from './fetchAxios';
import * as dotenv from "dotenv";
import express from "express";
import * as fs from "fs";
import * as path from "path";
import { executeMcpTool } from "./index";
import { CoreApiClient } from "@storymee/api-client";

dotenv.config();

// --- CACHE HỆ THỐNG ---
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let membersCache: { data: any[], timestamp: number } | null = null;

async function getCachedMembers(): Promise<any[]> {
  const now = Date.now();
  if (membersCache && (now - membersCache.timestamp < CACHE_TTL)) {
    return membersCache.data;
  }
  
  try {
    const json = await apiClient.get("/hr/team-members") as any;
    const dataArr = Array.isArray(json) ? json : (json?.data || []);
    if (Array.isArray(dataArr)) {
      const now = Date.now();
      membersCache = { data: dataArr, timestamp: now };
      return dataArr;
    }
  } catch (err) {
    console.error("Lỗi fetch team-members:", err);
  }
  return membersCache ? membersCache.data : [];
}

// ----------------------


function calculateWorkingHours(start: Date, end: Date): number {
  if (start >= end) return 0;
  
  let totalHours = 0;
  let current = new Date(start.getTime());
  
  while (current < end) {
    const currentDay = current.getDay();
    const isWeekend = currentDay === 0 || currentDay === 6;
    
    if (!isWeekend) {
      const morningStart = new Date(current);
      morningStart.setHours(8, 30, 0, 0);
      
      const morningEnd = new Date(current);
      morningEnd.setHours(12, 0, 0, 0);
      
      const afternoonStart = new Date(current);
      afternoonStart.setHours(13, 30, 0, 0);
      
      const afternoonEnd = new Date(current);
      afternoonEnd.setHours(18, 0, 0, 0);
      
      const morningOverlapStart = current > morningStart ? current : morningStart;
      const morningOverlapEnd = end < morningEnd ? end : morningEnd;
      if (morningOverlapStart < morningOverlapEnd) {
        totalHours += (morningOverlapEnd.getTime() - morningOverlapStart.getTime()) / (1000 * 60 * 60);
      }
      
      const afternoonOverlapStart = current > afternoonStart ? current : afternoonStart;
      const afternoonOverlapEnd = end < afternoonEnd ? end : afternoonEnd;
      if (afternoonOverlapStart < afternoonOverlapEnd) {
        totalHours += (afternoonOverlapEnd.getTime() - afternoonOverlapStart.getTime()) / (1000 * 60 * 60);
      }
    }
    
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }
  
  return Math.round(totalHours * 10) / 10;
}

/**
 * TELEGRAM AGENT - KẾT NỐI POSTGRES API VÀ OMNIROUTER THỰC TẾ
 * 
 * Lắng nghe tin nhắn qua Long Polling, định danh nhân viên qua Telegram Username,
 * tự động lưu Chat ID, và chạy cronjob nhắc nhở/cảnh báo deadline quá hạn qua Postgres.
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || "http://localhost:3010";
const OMNIROUTER_API_URL = process.env.OMNIROUTER_API_URL || `${WEB_PORTAL_URL}/api/ai/chat`;
const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:4500";
let apiClient = new CoreApiClient({ baseURL: CORE_API_URL });

interface ChatMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

const chatHistories: Record<number, ChatMessage[]> = {};
const actionCache: Record<string, { action: string; payload: any; member: any }> = {};
const userFormSession: Record<number, {
  type: 'leave' | 'remote';
  leaveType?: string;
  remoteSession?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  step: 'awaiting_start_date' | 'awaiting_end_date' | 'awaiting_reason';
}> = {};
const processingActions = new Set<string>();

function createCalendarKeyboard(year: number, month: number, actionType: string) {
  const inline_keyboard: any[] = [];
  
  // Hàng 1: Navigation chuyển tháng
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  
  inline_keyboard.push([
    { text: "◀️", callback_data: `cal_nav:${prevYear}:${prevMonth}:${actionType}` },
    { text: `${month}/${year}`, callback_data: "cal_ignore" },
    { text: "▶️", callback_data: `cal_nav:${nextYear}:${nextMonth}:${actionType}` }
  ]);
  
  // Hàng 2: Thứ
  inline_keyboard.push([
    { text: "Hai", callback_data: "cal_ignore" },
    { text: "Ba", callback_data: "cal_ignore" },
    { text: "Tư", callback_data: "cal_ignore" },
    { text: "Năm", callback_data: "cal_ignore" },
    { text: "Sáu", callback_data: "cal_ignore" },
    { text: "Bảy", callback_data: "cal_ignore" },
    { text: "CN", callback_data: "cal_ignore" }
  ]);
  
  // Tính ngày trong tháng
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const totalDays = endDate.getDate();
  
  // Lấy thứ của ngày đầu tiên (0: CN, 1: T2, ..., 6: T7)
  // Chuyển đổi sang chuẩn T2=0, ..., CN=6
  let startDay = startDate.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1; 
  
  let currentWeek: any[] = [];
  
  // Thêm khoảng trống đầu tháng
  for (let i = 0; i < startDay; i++) {
    currentWeek.push({ text: " ", callback_data: "cal_ignore" });
  }
  
  // Thêm các ngày (không cho phép chọn ngày quá khứ)
  const now = new Date();
  const vietnamOffset = 7 * 60 * 60 * 1000;
  const todayVn = new Date(now.getTime() + vietnamOffset);
  const todayStr = todayVn.toISOString().split('T')[0];

  for (let day = 1; day <= totalDays; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const dateVal = `${year}-${monthStr}-${dayStr}`;
    
    const isPast = dateVal < todayStr;
    const btnText = isPast ? "·" : `${day}`;
    const btnCallback = isPast ? "cal_ignore" : `cal_day:${dateVal}:${actionType}`;
    
    currentWeek.push({ text: btnText, callback_data: btnCallback });
    
    if (currentWeek.length === 7) {
      inline_keyboard.push(currentWeek);
      currentWeek = [];
    }
  }
  
  // Điền nốt khoảng trống cuối tháng
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ text: " ", callback_data: "cal_ignore" });
    }
    inline_keyboard.push(currentWeek);
  }
  
  return { inline_keyboard };
}

const KEYBOARD_MAIN = {
  keyboard: [
    [
      { text: "🌅 Điểm danh (Check-in/out)" },
      { text: "📊 Trạng thái thành viên" }
    ],
    [
      { text: "📝 Công việc của tôi" },
      { text: "📝 Đăng ký Nghỉ phép / Remote" }
    ],
    [
      { text: "👤 Hồ sơ của tôi" },
      { text: "🌐 Mở Web Portal" }
    ]
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

const KEYBOARD_UNAUTHORIZED = {
  keyboard: [
    [
      { text: "👤 Đăng ký nhân viên mới" }
    ]
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

function formatTelegramText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<\/?ul>/gi, '')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<b>(.*?)<\/b>/gi, '*$1*')
    .replace(/<strong>(.*?)<\/strong>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '_$1_')
    .replace(/<em>(.*?)<\/em>/gi, '_$1_')
    .replace(/<br\s*\/?>/gi, '\n');
}

const KEYBOARD_REMOVE = {
  remove_keyboard: true
};

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log(`[Mock Telegram Send to ${chatId}]: ${text}`);
    return;
  }
  const formattedText = formatTelegramText(text);
  const isGroup = chatId < 0;
  
  let finalMarkup = replyMarkup;
  if (!finalMarkup) {
    finalMarkup = isGroup ? KEYBOARD_REMOVE : KEYBOARD_MAIN;
  }
  
  try {
    let res = await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: formattedText, 
        parse_mode: "Markdown",
        reply_markup: finalMarkup
      }),
    });
    
    // If Markdown parsing fails (Telegram is very strict), fallback to plain text
    if (res.status === 400) {
      const errText = await res.text();
      console.warn(`[Telegram API Warning] Markdown failed (${errText}). Falling back to plain text...`);
      res = await fetchAxios(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          chat_id: chatId, 
          text: formattedText,
          reply_markup: finalMarkup
        }),
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Telegram API Error] /sendMessage status=${res.status}:`, errText);
    }
  } catch (err) {
    console.error("Lỗi gửi tin nhắn Telegram:", err);
  }
}

// Helper filter rules tương tự ở frontend
export function parseMarkdownRules(mdText: string) {
  if (!mdText) return [];
  const blocks = mdText.split(/###\s*(?=ĐIỀU|Chương)/gi);
  return blocks.map(block => {
    const lines = block.trim().split('\n');
    const title = lines[0]?.replace(/^###\s*/, '').trim() || 'Quy định bổ sung';
    const content = lines.slice(1).join('\n').trim();
    const keywords = title.toLowerCase()
      .replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

    return { title, content, keywords };
  });
}

export function filterRelevantRules(message: string, rawRules: string): string {
  if (!rawRules) return '';
  const m = message.toLowerCase();
  const parsedRules = parseMarkdownRules(rawRules);
  let relevantContent = '';

  parsedRules.forEach(rule => {
    const titleMatch = rule.title.toLowerCase().includes(m) || m.includes(rule.title.toLowerCase());
    const kwMatch = rule.keywords.some(kw => m.includes(kw));
    if (titleMatch || kwMatch) {
      relevantContent += `### ${rule.title}\n${rule.content}\n\n`;
    }
  });

  return relevantContent.trim();
}

/**
 * 1A. Gửi báo cáo tổng hợp 8h30 sáng và 17h chiều hàng ngày
 */
export async function sendDailySummaryAndNotify(type: "morning" | "evening") {
  console.log(`⏰ [Cron Summary] Bắt đầu gửi báo cáo tổng hợp: ${type}`);
  try {
    const members = await getCachedMembers();
    if (!members || members.length === 0) throw new Error("Không thể fetch team members");

    let dbTasks: any[] = [];
    try {
      const tasksData = (await apiClient.get("/omnitask/")) as any;
      dbTasks = Array.isArray(tasksData) ? tasksData : (tasksData?.data || []);
    } catch (err: any) {
      throw new Error("Không thể fetch tasks");
    }

    // Send group summary if configured
    const groupId = process.env.TELEGRAM_GROUP_ID;
    if (groupId) {
      if (type === "morning") {
        await handleTelegramMessage({
          chat: { id: Number(groupId) },
          from: { username: "cron_system", first_name: "System" },
          text: "/check_team"
        });
        await sendMessage(Number(groupId), "🌅 Chúc toàn đội ngũ một ngày làm việc năng suất! Nhớ cập nhật trạng thái các task trên bảng Kanban nhé.");
      } else {
        await sendMessage(Number(groupId), "🌙 17h00 rồi! Đội ngũ vui lòng dành ít phút review lại tiến độ công việc trong ngày và kéo thẻ Kanban trước khi ra về nhé. Cảm ơn mọi người!");
      }
    }

    for (const m of members) {
      if (!m.telegramChatId) continue;
      const chatId = Number(m.telegramChatId);

      // Lọc subtask của người này
      const mySubTasks: any[] = [];
      dbTasks.forEach((t: any) => {
        if (Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            if (sub.assigneeId === m.id) {
              mySubTasks.push(sub);
            }
          });
        }
      });

      if (type === "morning") {
        const pendingTasks = mySubTasks.filter(s => s.status !== 'done');
        if (pendingTasks.length === 0) {
          await sendMessage(chatId, `☀️ *BÁO CÁO ĐẦU NGÀY (8h30)*\n\nChào *${m.fullName}*, hôm nay bạn không có công việc nào đang chờ xử lý. Chúc bạn một ngày mới làm việc tràn đầy năng lượng!`);
          continue;
        }

        let taskListStr = "";
        pendingTasks.forEach(s => {
          const dlStr = s.deadline ? s.deadline.split('T')[0] : 'Chưa có';
          taskListStr += `• *${s.planeTaskId || 'Task'}: ${s.title}* (Trạng thái: *${s.status}*, Hạn chót: *${dlStr}*)\n`;
        });

        const msg = `☀️ *BÁO CÁO CÔNG VIỆC ĐẦU NGÀY (8h30)*\n\nChào *${m.fullName}*, dưới đây là danh sách các công việc bạn cần tập trung xử lý trong hôm nay:\n\n${taskListStr}\n💪 Chúc bạn một ngày làm việc hiệu quả và hoàn thành xuất sắc mục tiêu!`;
        await sendMessage(chatId, msg);

        // Gửi thông báo lên Web Dashboard Bell icon
        try {
          await fetchAxios(`${WEB_PORTAL_URL}/api/ai/announcements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `☀️ Báo cáo đầu ngày (8h30): ${m.fullName}`,
              content: `Hệ thống tự động nhắc nhở đầu ngày cho ${m.fullName}. Số task cần làm: ${pendingTasks.length}.`,
              sender: "Bot AI Tự động"
            })
          });
        } catch (e) {}

      } else {
        const activeTasks = mySubTasks.filter(s => s.status === 'in_progress' || s.status === 'pending');
        if (activeTasks.length === 0) continue;

        let taskListStr = "";
        activeTasks.forEach(s => {
          taskListStr += `• *${s.planeTaskId || 'Task'}: ${s.title}* (Trạng thái: *${s.status}*)\n`;
        });

        const msg = `🌙 *CẬP NHẬT TIẾN ĐỘ CUỐI NGÀY (17h00)*\n\nChào *${m.fullName}*, bạn vui lòng dành ít phút cập nhật tiến trình hoặc trạng thái hoàn thành của các công việc sau lên bảng Kanban trước khi ra về nhé:\n\n${taskListStr}\n🙏 Cảm ơn bạn và chúc bạn có một buổi tối thư giãn vui vẻ!`;
        await sendMessage(chatId, msg);

        // Gửi thông báo lên Web Dashboard Bell icon
        try {
          await fetchAxios(`${WEB_PORTAL_URL}/api/ai/announcements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `🌙 Nhắc tiến độ cuối ngày (17h00): ${m.fullName}`,
              content: `Hệ thống nhắc nhở cập nhật trạng thái cuối ngày cho ${m.fullName}. Số task đang làm: ${activeTasks.length}.`,
              sender: "Bot AI Tự động"
            })
          });
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error("Lỗi gửi báo cáo summary:", err);
  }
}

/**
 * 1B. Quét deadline quá hạn realtime và gửi thông báo ngay lập tức
 */
export async function checkRealtimeOverdueDeadlines() {
  console.log("⏰ [Cron Overdue] Đang quét deadline quá hạn realtime...");
  try {
    const members = await getCachedMembers();
    if (!members || members.length === 0) throw new Error("Không thể fetch team members");

    let dbTasks: any[] = [];
    try {
      const tasksData = (await apiClient.get("/omnitask/")) as any;
      dbTasks = Array.isArray(tasksData) ? tasksData : (tasksData?.data || []);
    } catch (err: any) {
      throw new Error("Không thể fetch tasks");
    }

    const now = new Date();
    
    // Đọc cache danh sách đã cảnh báo để tránh trùng lặp
    const alertedDir = path.join(__dirname, "../data");
    if (!fs.existsSync(alertedDir)) {
      fs.mkdirSync(alertedDir, { recursive: true });
    }
    const alertedFile = path.join(alertedDir, "alerted_subtasks.json");
    let alertedIds = new Set();
    if (fs.existsSync(alertedFile)) {
      try {
        const arr = JSON.parse(fs.readFileSync(alertedFile, "utf-8"));
        alertedIds = new Set(arr);
      } catch (e) {}
    }

    let alertCount = 0;

    for (const t of dbTasks) {
      if (Array.isArray(t.subTasks)) {
        for (const sub of t.subTasks) {
          if (sub.status === 'done') continue;
          if (!sub.deadline) continue;

          const deadline = new Date(sub.deadline);
          // Quá hạn và chưa từng gửi thông báo cho id này
          if (deadline <= now && !alertedIds.has(sub.id)) {
            // Tìm nhân sự phụ trách
            const member = (members || []).find((m: any) => m.id === sub.assigneeId);
            if (!member || !member.telegramChatId) continue;

            const chatId = Number(member.telegramChatId);
            const dlStr = sub.deadline.split('T')[0] + ' ' + sub.deadline.split('T')[1].substring(0, 5);

            // 1. Gửi tin nhắn Telegram
            await sendMessage(
              chatId,
              `🚨 *CẢNH BÁO QUÁ HẠN DEADLINE REALTIME!*\n\n• Nhiệm vụ: *${sub.planeTaskId || 'Task'}: ${sub.title}*\n• Người phụ trách: *${member.fullName}*\n• Hạn chót: *${dlStr}* (Đã quá hạn)\n\n⚠️ Vui lòng cập nhật trạng thái công việc hoặc liên hệ admin hoãn task ngay lập tức!`
            );

            // 2. Gửi thông báo lên Web Bell icon
            try {
              await fetchAxios(`${WEB_PORTAL_URL}/api/ai/announcements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: `🚨 Quá hạn Realtime: ${sub.title}`,
                  content: `Nhiệm vụ '${sub.title}' giao cho ${member.fullName} đã quá hạn vào lúc ${dlStr}.`,
                  sender: "Cảnh báo Hệ thống"
                })
              });
            } catch (e) {}

            alertedIds.add(sub.id);
            alertCount++;
          }
        }
      }
    }

    if (alertCount > 0) {
      fs.writeFileSync(alertedFile, JSON.stringify(Array.from(alertedIds), null, 2));
      console.log(`⏰ [Cron Overdue] Đã gửi ${alertCount} thông báo quá hạn realtime.`);
      
      const groupId = process.env.TELEGRAM_GROUP_ID;
      if (groupId) {
        await sendMessage(
          Number(groupId),
          `🚨 *CẢNH BÁO NHÓM:* Có ${alertCount} nhiệm vụ vừa bị quá hạn! Vui lòng gọi lệnh /check_team để xem danh sách tiến độ.`
        );
      }
    }
  } catch (err) {
    console.error("Lỗi check deadline realtime:", err);
  }
}

/**
 * 2. Hàm xử lý tin nhắn tương tác
 */
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
  if (text.toLowerCase().startsWith("/ai ")) {
    text = text.substring(4).trim();
  } else if (text.toLowerCase() === "/ai") {
    text = "";
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

      reportMsg += `\n${emoji} *${task.id}*: ${task.title}\n`;
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
    
    // Nếu chưa có Letta Conversation ID, chúng ta có thể dùng ID của member hoặc tự tạo làm token
    const token = member.lettaConversationId || `conv-${member.id}`;
    const portalUrl = `${WEB_PORTAL_URL}/login?token=${token}`;
    
    console.log(`[Portal Link] Generating portal login URL for ${member.fullName}: ${portalUrl}`);
    
    await sendMessage(chatId, `🌐 *ĐĂNG NHẬP NHANH VÀO WEB PORTAL*\n\nBạn có thể click vào đường dẫn sau để đăng nhập tự động vào hệ thống Web Portal:\n👉 ${portalUrl}`);
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
          { text: "🚪 Tan ca (Check-out)", callback_data: `attendance_direct:present` }
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

/**
 * 2B. Xử lý click nút bấm (Callback Query) từ Telegram Inline Keyboard
 */
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
    return;
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
    return;
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
    return;
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
    return;
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
    return;
  }

  if (data.startsWith("cal_day:")) {
    const parts = data.split(":");
    const dateVal = parts[1];
    const actionType = parts[2];
    
    const session = userFormSession[chatId];
    if (!session) {
      await sendMessage(chatId, "⚠️ Phiên chọn lịch đã hết hạn. Vui lòng thử lại.");
      return;
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
        return;
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
      } else if (action === 'update_task') {
        let estimateVal = payload.estimate;
        if (payload.deadline && (!estimateVal || estimateVal === 0)) {
          const dDate = new Date(payload.deadline);
          const now = new Date();
          estimateVal = calculateWorkingHours(now, dDate);
        }

        await executeMcpTool("update_task", {
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
      } else if (action === 'create_task') {
        let estimateVal = payload.estimate;
        if (payload.deadline && (!estimateVal || estimateVal === 0)) {
          const dDate = new Date(payload.deadline);
          const now = new Date();
          estimateVal = calculateWorkingHours(now, dDate);
        }

        const result = await executeMcpTool("create_task", {
          title: payload.title || "Nhiệm vụ mới từ Telegram",
          assignee: payload.assignee || actionMember.fullName,
          estimate: estimateVal || undefined,
          priority: payload.priority || "Medium",
          deadline: payload.deadline || undefined
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
      } else if (action === 'breakdown_task') {
        const result = await executeMcpTool("breakdown_task", {
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
      } else if (action === 'update_subtasks') {
        const result = await executeMcpTool("update_subtasks", {
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
      } else if (action === 'request_task_approval') {
        const result = await executeMcpTool("request_task_approval", {
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
                        [{ text: "✅ Phê duyệt", callback_data: `approve_task:${payload.task_id}:${payload.type}` }],
                        [{ text: "❌ Từ chối", callback_data: `reject_task:${payload.task_id}:${payload.type}` }]
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

      } else if (action === 'approve_task_request') {
        const result = await executeMcpTool("approve_task_request", {
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

  if (data.startsWith("submit_leave:")) {
    const parts = data.split(":");
    const leaveType = parts[1];
    const startDate = parts[2];
    const endDate = parts[3];
    const reason = parts.slice(4).join(":"); // Hỗ trợ lý do có dấu hai chấm

    try {
      try {
          const resJson = await apiClient.post("/omnitask/hr/leave-request", {
            telegramUsername: member.telegramUsername,
            leaveType,
            startDate: startDate + "T00:00:00.000Z",
            endDate: endDate + "T23:59:59.000Z",
            reason: reason || "Xin nghỉ phép qua Bot Telegram"
          }) as any;
          
          if (resJson && resJson.data && resJson.data.id) {
            const requestId = resJson.data.id;
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
          }
        } catch (err: any) {
          await sendMessage(chatId, "❌ Lỗi: Cổng HR Service không thể khởi tạo phiếu nghỉ phép.");
          throw err;
        }
    } catch (err) {
      console.error("Lỗi gọi API leave-request:", err);
    }

  } else 
  if (data.startsWith("approve_task:") || data.startsWith("reject_task:")) {
    const parts = data.split(":");
    const action = parts[0] === "approve_task" ? "approve" : "reject";
    const taskId = parts[1];
    const reqType = parts[2] || 'archive'; // fallback if undefined

    try {
      try {
          await apiClient.post(`/omnitask/hr/tasks/${taskId}/approve`, { type: reqType, decision: action });
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
      const endpoint = action === "approve" ? "approve-leave" : "reject-leave";
      try {
          const resJson = await apiClient.post(`/omnitask/hr/${endpoint}`, { requestId }) as any;
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

          const leaveReq = resJson?.data?.leaveRequest;
          if (resJson?.status === 'success' && leaveReq && leaveReq.memberId) {
            const emp = allMembers.find((m: any) => m.id === leaveReq.memberId);
            if (emp && emp.telegramChatId) {
              const empChatId = Number(emp.telegramChatId);
              const startD = leaveReq.startDate.split('T')[0];
              const endD = leaveReq.endDate.split('T')[0];
              const typeStr = leaveReq.leaveType === 'sick' ? 'Nghỉ ốm' : leaveReq.leaveType === 'annual' ? 'Nghỉ phép năm' : leaveReq.leaveType === 'remote' ? 'Làm Remote' : 'Việc riêng';
              await sendMessage(
                empChatId,
                `🔔 *CẬP NHẬT TRẠNG THÁI PHÉP PHÉP*\n\nYêu cầu ${typeStr} từ ngày *${startD} đến ${endD}* của bạn đã được Admin *${member.fullName}* xử lý: *${actionStr}* ${emoji}`
              );
            }
          }
        } catch (err: any) {
          await sendMessage(chatId, "❌ Lỗi: Cổng HR Service phản hồi thất bại khi thực thi duyệt phép.");
          throw err;
        }
    } catch (err) {
      console.error("Lỗi gọi API duyệt phép:", err);
    }
  }
}

/**
 * 3. Bắt đầu cơ chế Long Polling & Cron Job nội bộ
 */
async function setupBotCommands() {
  try {
    const res = await fetchAxios(`${TELEGRAM_API}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: "start", description: "Khởi động trợ lý AI & hiện khay phím tắt" },
          { command: "register", description: "Đăng ký liên kết tài khoản cho nhân sự mới" },
          { command: "ho_so", description: "Xem thông tin hồ sơ cá nhân của tôi" },
          { command: "portal", description: "Đăng nhập nhanh vào Web Portal" },
          { command: "dang_ky", description: "Đăng ký Nghỉ phép / Làm Remote" },
          { command: "cong_viec", description: "Xem danh sách công việc của tôi" },
          { command: "check", description: "Quét deadline quá hạn realtime (Admin)" },
          { command: "check_all", description: "Báo cáo trạng thái toàn bộ nhân viên" }
        ]
      })
    });
    if (res.ok) {
      console.log("🤖 [Telegram] Đã tự động cấu hình các nút lệnh Commands thành công!");
    }
  } catch (err) {
    console.error("Lỗi setMyCommands:", err);
  }
}

export async function startTelegramPolling() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log("⚠️ CHƯA CẤU HÌNH TELEGRAM_BOT_TOKEN. Chạy bot ở chế độ MOCK (Giả lập console).");
    return;
  }
  
  console.log(`🤖 Telegram Bot đang khởi động chế độ Webhook (Token: ...${TELEGRAM_BOT_TOKEN.substring(0, 8)})...`);
  await setupBotCommands();
  
  // Vòng lặp Cron Worker nội bộ check giờ từng phút
  setInterval(async () => {
    try {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Trigger lúc 8h30 sáng
      if (hours === 8 && minutes === 30) {
        console.log("⏰ [Cron Summary] Đến giờ 8h30 sáng, gửi báo cáo đầu ngày...");
        await sendDailySummaryAndNotify("morning");
      }

      // Trigger lúc 17h00 chiều
      if (hours === 17 && minutes === 0) {
        console.log("⏰ [Cron Summary] Đến giờ 17h00 chiều, gửi nhắc nhở cuối ngày...");
        await sendDailySummaryAndNotify("evening");
      }

      // Quét deadline quá hạn realtime mỗi 5 phút (khi minutes chia hết cho 5)
      if (minutes % 5 === 0) {
        await checkRealtimeOverdueDeadlines();
      }
    } catch (err) {
      console.error("Lỗi cron check giờ:", err);
    }
  }, 60 * 1000); // 1 phút
  
  // Quét ngay lần đầu chạy
  setTimeout(() => {
    checkRealtimeOverdueDeadlines();
  }, 5000);

  
  // SETUP EXPRESS WEBHOOK SERVER
  const app = express();
  app.use(express.json());

  // Webhook Route
  app.post('/bot-webhook', async (req, res) => {
    try {
      const update = req.body;
      if (update.message && update.message.text) {
        await handleTelegramMessage(update.message);
      } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
      }
      res.sendStatus(200);
    } catch (err) {
      console.error("Lỗi xử lý webhook:", err);
      // TRẢ VỀ 200 OK NGAY LẬP TỨC để Telegram không gửi lại (retry) tin nhắn
      res.sendStatus(200);
    }
  });

  const WEBHOOK_PORT = 4501; // Cổng chạy riêng cho Bot Webhook
  app.listen(WEBHOOK_PORT, async () => {
    console.log(`🚀 Telegram Webhook Server đang chạy tại port ${WEBHOOK_PORT}...`);
    
    // Đăng ký Webhook URL với Telegram
    const WEBHOOK_URL = `https://hub.storymee.com/bot-webhook`; 
    try {
      const res = await fetchAxios(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`);
      const data = await res.json() as any;
      if (data.ok) {
        console.log(`✅ Đã đăng ký Telegram Webhook thành công: ${WEBHOOK_URL}`);
      } else {
        console.error("❌ Lỗi đăng ký Webhook:", data);
      }
    } catch (e) {
      console.error("❌ Lỗi kết nối đăng ký Webhook:", e);
    }
  });

}

// Khởi chạy
import { startCronJobs } from "./cronJobs.js";
startCronJobs(apiClient, sendMessage);
startTelegramPolling();
