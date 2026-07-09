import { fetchAxios } from './fetchAxios';
import * as dotenv from "dotenv";
import Fastify from 'fastify';
import * as fs from "fs";
import * as path from "path";
import cron from "node-cron";
import { executeMcpTool } from "./index";
import { CoreApiClient } from "@storymee/api-client";

dotenv.config();

// --- CACHE HỆ THỐNG ---
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let membersCache: { data: any[], timestamp: number } | null = null;

export async function getCachedMembers(): Promise<any[]> {
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


export function calculateWorkingHours(start: Date, end: Date): number {
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
const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:5100";
let apiClient = new CoreApiClient({ baseURL: CORE_API_URL });

interface ChatMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export const chatHistories: Record<number, ChatMessage[]> = {};
export const actionCache: Record<string, { action: string; payload: any; member: any }> = {};
export const userFormSession: Record<number, any> = {};
export const processingActions = new Set<string>();

export function createCalendarKeyboard(year: number, month: number, actionType: string) {
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

export const KEYBOARD_MAIN = {
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
    ],
    [
      { text: "📁 Quản lý Dự án & Task" }
    ]
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

export const KEYBOARD_UNAUTHORIZED = {
  keyboard: [
    [
      { text: "👤 Đăng ký nhân viên mới" }
    ]
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

export function formatTelegramText(text: string): string {
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

export async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
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
    if (!members || members.length === 0) return;

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
        await sendMessage(Number(groupId), "🌙 18h00 rồi! Đội ngũ vui lòng dành ít phút review lại tiến độ công việc trong ngày, kéo thẻ Kanban và điểm danh ra về nhé. Cảm ơn mọi người!");
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
          await sendMessage(chatId, `☀️ *BÁO CÁO ĐẦU NGÀY (8h30)*\n\nChào *${m.fullName}*, hôm nay bạn không có công việc nào đang chờ xử lý. Chúc bạn một ngày mới làm việc tràn đầy năng lượng!`, {
            inline_keyboard: [[{ text: "🌅 Vào ca (Check-in)", callback_data: `attendance_direct:present` }]]
          });
          continue;
        }

        let taskListStr = "";
        pendingTasks.forEach(s => {
          const dlStr = s.deadline ? s.deadline.split('T')[0] : 'Chưa có';
          taskListStr += `• *${s.planeTaskId || 'Task'}: ${s.title}* (Trạng thái: *${s.status}*, Hạn chót: *${dlStr}*)\n`;
        });

        const msg = `☀️ *BÁO CÁO CÔNG VIỆC ĐẦU NGÀY (8h30)*\n\nChào *${m.fullName}*, dưới đây là danh sách các công việc bạn cần tập trung xử lý trong hôm nay:\n\n${taskListStr}\n💪 Chúc bạn một ngày làm việc hiệu quả và hoàn thành xuất sắc mục tiêu!`;
        await sendMessage(chatId, msg, {
          inline_keyboard: [[{ text: "🌅 Vào ca (Check-in)", callback_data: `attendance_direct:present` }]]
        });

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
        
        let taskListStr = "";
        if (activeTasks.length > 0) {
          activeTasks.forEach(s => {
            taskListStr += `• *${s.planeTaskId || 'Task'}: ${s.title}* (Trạng thái: *${s.status}*)\n`;
          });
        } else {
          taskListStr = "Không có công việc nào đang mở.";
        }

        const msg = `🌙 *CẬP NHẬT TIẾN ĐỘ CUỐI NGÀY (18h00)*\n\nChào *${m.fullName}*, bạn vui lòng dành ít phút cập nhật tiến trình của các công việc sau lên bảng Kanban trước khi ra về nhé:\n\n${taskListStr}\n🙏 Cảm ơn bạn và chúc bạn có một buổi tối thư giãn vui vẻ!`;
        await sendMessage(chatId, msg, {
          inline_keyboard: [[{ text: "🚪 Tan ca (Check-out)", callback_data: `attendance_direct:checkout` }]]
        });

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
    if (!members || members.length === 0) return;

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


export async function handleTelegramMessage(message: any) {
  return (await import('./telegram/handlers/messageHandler')).handleTelegramMessage(message);
}



export async function handleCallbackQuery(callbackQuery: any) {
  return (await import('./telegram/handlers/callbackQueryHandler')).handleCallbackQuery(callbackQuery);
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
          { command: "check_all", description: "Báo cáo trạng thái toàn bộ nhân viên" },
          { command: "team_status", description: "Báo cáo chấm công hôm nay" },
          { command: "subtask", description: "Phân rã task bằng AI" }
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
  
  // Vòng lặp Cron Worker nội bộ với timezone cụ thể
  cron.schedule('30 8 * * 1-6', async () => {
    console.log("⏰ [Cron Summary] Đến giờ 8h30 sáng, gửi báo cáo đầu ngày...");
    await sendDailySummaryAndNotify("morning");
  }, { timezone: "Asia/Ho_Chi_Minh" });

  cron.schedule('0 18 * * 1-6', async () => {
    console.log("⏰ [Cron Summary] Đến giờ 18h00 chiều, gửi nhắc nhở cuối ngày...");
    await sendDailySummaryAndNotify("evening");
  }, { timezone: "Asia/Ho_Chi_Minh" });

  cron.schedule('*/5 * * * *', async () => {
    try {
      await checkRealtimeOverdueDeadlines().catch(e => console.error(e));
    } catch (err) {
      console.error("Lỗi cron check deadline:", err);
    }
  }, { timezone: "Asia/Ho_Chi_Minh" });
  
  
  // Quét ngay lần đầu chạy
  setTimeout(() => {
    checkRealtimeOverdueDeadlines().catch(e => console.error(e));
  }, 5000);

  
  // SETUP FASTIFY WEBHOOK SERVER
  const app = Fastify({ logger: false });

  // Webhook Route
  app.post('/worker/v1/telegram/webhook', async (req, reply) => {
    try {
      const update = req.body as any;
      if (update.message && update.message.text) {
        await handleTelegramMessage(update.message);
      } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
      }
      return reply.code(200).send({ status: 'ok' });
    } catch (err) {
      console.error("Lỗi xử lý webhook:", err);
      // TRẢ VỀ 200 OK NGAY LẬP TỨC để Telegram không gửi lại (retry) tin nhắn
      return reply.code(200).send({ status: 'error' });
    }
  });

  const WEBHOOK_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4511; // Cổng chạy riêng cho Bot Webhook
  try {
    await app.listen({ port: WEBHOOK_PORT, host: '0.0.0.0' });
    console.log(`🚀 Telegram Webhook Server đang chạy tại port ${WEBHOOK_PORT}...`);
    
    // Đăng ký Webhook URL với Telegram
    const WEBHOOK_URL = `https://dev-hub.storymee.com/worker/v1/telegram/webhook`; 
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
  } catch (err) {
    console.error("Fastify Listen Error:", err);
    process.exit(1);
  }

}

// Khởi chạy
// import { startCronJobs } from "./cronJobs.js";
// startCronJobs(apiClient, sendMessage); // Đã gộp vào vòng lặp cron bên trong
// startTelegramPolling() has been moved to index.ts
