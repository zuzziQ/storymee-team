import { fetchAxios } from '../../fetchAxios';
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import { 
  getCachedMembers, getCachedProjects, getCachedIssues, invalidateIssuesCache,
  createCalendarKeyboard, sendMessage, sendChatAction,
  formatTelegramText, userFormSession, processingActions, 
  actionCache, chatHistories, KEYBOARD_MAIN, KEYBOARD_UNAUTHORIZED, 
  calculateWorkingHours, checkRealtimeOverdueDeadlines 
} from '../../telegram_agent';
import { executeMcpTool } from '../../index';
import { formatMyIssuesDM, isDoneGroup, parseIssue } from '../formatters/issueFormatter';
import { outputSessions, pendingOutputByUsername } from '../../sessionStore';
import { classifyIntentFast, buildSlimRoster } from '../fastIntent';
import * as dotenv from "dotenv";
import { createTeamServiceClient, serviceAuthHeaders, TEAM_AI_SERVICE_URL } from '../../serviceRoutes';

dotenv.config();

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:5100";
const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || "https://dev-hub.storymee.com";
const OMNIROUTER_API_URL =
  process.env.OMNIROUTER_API_URL ||
  TEAM_AI_SERVICE_URL;
/** Skip Gemini Flash first-pass (default true — heuristic is enough) */
const USE_FLASH_INTENT = process.env.TELEGRAM_USE_FLASH_INTENT === '1';
const LLM_TIMEOUT_MS = Number(process.env.TELEGRAM_LLM_TIMEOUT_MS || 35000);
const HISTORY_TURNS = Number(process.env.TELEGRAM_HISTORY_TURNS || 6);
const apiClient = createTeamServiceClient();

async function getTelegramFileUrl(fileId: string): Promise<string | null> {
  try {
    const res = await fetchAxios(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
    const data = await res.json() as any;
    if (data.ok && data.result?.file_path) {
      return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
    }
  } catch (e) { console.error('[getFile] error:', e); }
  return null;
}

/**
 * Nộp output + chuyển In Review (SSOT).
 * Backend PlaneController fire NATS core.team.task.submitted_for_review → bot notify admins.
 * Không dual-notify trực tiếp từ đây (tránh double message).
 */
async function finalizeOutputSession(chatId: number, session: any, member: any) {
  if (!session) return;
  outputSessions.delete(chatId);
  const outputContent = session.texts.join('\n') || '(khong co output)';
  const outputUrls = session.urls;
  try {
    await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${session.issueId}`, {
      status: 'in_review',
      outputContent,
      outputUrls,
      submittedById: session.memberId || member?.id,
    });
  } catch (e) {
    console.error('[finalizeOutputSession] PATCH error:', e);
    await sendMessage(chatId, `Loi khi nop ket qua. Vui long thu lai.`, KEYBOARD_MAIN);
    return;
  }
  await sendMessage(chatId, `Da gui ket qua task *${session.issueShortId}* cho Admin duyet.\nBan se nhan thong bao khi Admin xac nhan.`, KEYBOARD_MAIN);
}

export async function handleTelegramMessage(message: any) {
  const chatId = message.chat.id;
  const username = message.from?.username;
  const originalText = (message.text || message.caption) || "";
  let text = originalText
    .replace(/^(\/[a-zA-Z0-9_]+)@[a-zA-Z0-9_]+/i, '$1')
    .trim();
  const isGroup = chatId < 0;

  // Hỗ trợ lệnh /ai và tag @bot trong group để bypass Privacy Mode
  let isAiCommand = false;
  if (/^@.*bot\s*/i.test(originalText) || /^@storymee[a-zA-Z0-9_]*\s*/i.test(originalText)) {
    isAiCommand = true;
    text = text.replace(/^@[a-zA-Z0-9_]+\s*/i, '').trim();
  } else if (text.toLowerCase().startsWith("/ai ")) {
    text = text.substring(4).trim();
    isAiCommand = true;
  } else if (text.toLowerCase() === "/ai") {
    text = "";
    isAiCommand = true;
  }

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
    "/cancel", "hủy", "cancel", "huy",
    "/lichhop", "📅 lịch họp", "/thongbao", "/notify", "/menu"
  ];

  // Trong group chat, chỉ xử lý nếu bắt đầu bằng /ai hoặc các lệnh hệ thống
  if (isGroup && !isAiCommand && !text.startsWith('/') && !userFormSession[chatId]) {
    if (!GLOBAL_COMMANDS.includes(text.trim().toLowerCase())) {
      return; // Bỏ qua tin nhắn thường trong group
    }
  }

  console.log(`[Telegram Msg from @${username} in ${isGroup ? 'Group' : 'Private'} ${chatId}]: ${text}`);

  const lowerText = (text || "").trim().toLowerCase();

  if (!username) {
    if (!isGroup) {
      await sendMessage(chatId, "⚠️ Vui lòng cấu hình Username trên Telegram của bạn để hệ thống định danh quyền hạn.");
    }
    return;
  }


  // A. Định danh người dùng (cache 5 phút — không block prefetch nặng trước auth)
  let member: any = null;
  let allMembers: any[] = [];
  try {
    allMembers = await getCachedMembers();
    if (allMembers && allMembers.length > 0) {
      const cleanUsername = (username || "").replace(/^@/, "").toLowerCase().trim();
      member = allMembers.find((m: any) => {
        if (m.telegramChatId && Number(m.telegramChatId) === Number(chatId)) {
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
      await sendMessage(
        chatId,
        `❌ LỖI BẢO MẬT: Tài khoản Telegram **@${username}** chưa được liên kết với nhân sự nào trong hệ thống Storymee.\n\n💡 *Cách xử lý nhanh:* Hãy click nút **👤 Đăng ký nhân viên mới** bên dưới hoặc gõ lệnh đăng ký:\n\n\`/register [email_công_ty] [Họ_và_Tên]\`\n\n_(Ví dụ: \`/register an.nguyen@storymee.com Nguyễn Văn An\`)_`,
        KEYBOARD_UNAUTHORIZED
      );
    }
    return;
  }

  // Gate: only active accounts use full bot (pending/rejected/suspended blocked)
  const acctStatus = (member.accountStatus || (member.isActive === false ? 'suspended' : 'active')).toLowerCase();
  if (acctStatus !== 'active') {
    if (!isGroup) {
      const msg =
        acctStatus === 'pending'
          ? `⏳ Tài khoản **${member.fullName}** đang *chờ Admin duyệt*. Bạn chưa dùng được bot/StorymeeTeam.\nAdmin sẽ thông báo khi duyệt.`
          : acctStatus === 'rejected'
            ? `❌ Tài khoản bị *từ chối*. Liên hệ Admin nếu cần hỗ trợ.`
            : `🔒 Tài khoản đang *bị khoá* (${acctStatus}). Liên hệ Admin.`;
      await sendMessage(chatId, msg, KEYBOARD_UNAUTHORIZED);
    }
    return;
  }

  // Group commands
  if (isGroup && (lowerText === "/menu" || lowerText.startsWith("/menu@"))) {
    await sendMessage(chatId, "🤖 *STORYMEE TEAM BOT*\nĐể sử dụng bot trong nhóm, vui lòng gõ `/` để chọn lệnh hoặc dùng trực tiếp:\n\n/checkin - Điểm danh vào ca\n/checkout - Điểm danh ra về\n/cong_viec - Xem việc của tôi\n/lichhop - Quản lý lịch họp\n/dang_ky - Xin nghỉ phép / remote\n/check_team - Tiến độ công việc nhóm\n/team_status - Trạng thái check-in hôm nay\n/subtask [ID] - Phân rã task bằng AI\n\n_(Lưu ý: Bạn cũng có thể tag bot kèm câu hỏi tiếng Việt để nhờ AI hỗ trợ)_", { remove_keyboard: true });
    return;
  }

  // B. Tự động ghi nhận chat_id vào Postgres nếu chưa có hoặc thay đổi (chỉ lưu cho Private chat)
  if (!isGroup && (!member.telegramChatId || Number(member.telegramChatId) !== chatId)) {
    try {
      console.log(`[Postgres API] Đang cập nhật chat_id ${chatId} cho @${username}...`);
      try {
          await apiClient.post(API_ROUTES.HR.TEAM_MEMBERS, {
            mode: 'self',
            actorEmail: member.email,
            fullName: member.fullName,
            email: member.email,
            telegramUsername: member.telegramUsername || username,
            telegramChatId: chatId,
            phone: member.phone,
            skills: member.skills || [],
            bankName: member.bankName,
            bankAccount: member.bankAccount,
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

  // C0. Kich hoat output session neu planeTools da danh dau pending
  if (!isGroup) {
    const uname = (username || '').toLowerCase().replace(/^@/, '');
    if (uname && pendingOutputByUsername.has(uname)) {
      const pending = pendingOutputByUsername.get(uname)!;
      pendingOutputByUsername.delete(uname);
      outputSessions.set(chatId, {
        issueId: pending.issueId,
        issueShortId: pending.issueShortId,
        issueTitle: pending.issueTitle,
        memberId: pending.memberId,
        texts: [],
        urls: [],
        startedAt: new Date(),
      });
      await sendMessage(chatId,
        `Task *${pending.issueShortId}* da chuyen sang In Review.\n\nVui long nop ket qua cong viec:\n- Goi ta van ban mo ta\n- Gui link (Google Drive, Figma, Github,...)\n- Gui anh chup man hinh truc tiep vao day\n- Hoac chon khong co output`,
        {
          inline_keyboard: [
            [{ text: 'Khong co output', callback_data: `submit_no_output:${pending.issueId}:${pending.issueShortId}` }],
            [{ text: 'Hoan tat nop ket qua', callback_data: `submit_output_done:${pending.issueId}:${pending.issueShortId}` }],
          ]
        }
      );
      return;
    }
  }

  // C1. Xu ly khi dang trong output session
  const activeSession = !isGroup ? outputSessions.get(chatId) : undefined;
  if (activeSession) {
    // /done_output hoac tuong tu
    if (lowerText === '/done_output' || lowerText === 'xong' || lowerText === 'done output') {
      await finalizeOutputSession(chatId, activeSession, member);
      return;
    }
    // Khong co output
    const NO_OUTPUT_KEYWORDS = ['khong co output', 'ko co output', 'không có output', 'no output', 'khong co ket qua', 'no result'];
    if (NO_OUTPUT_KEYWORDS.some(k => lowerText.includes(k))) {
      activeSession.texts.push('(Nhan su xac nhan khong co output/ket qua cu the)');
      await finalizeOutputSession(chatId, activeSession, member);
      return;
    }
    // Nhan anh/video/document
    let collectedFile = false;
    if (message.photo && message.photo.length > 0) {
      const largestPhoto = message.photo[message.photo.length - 1];
      const url = await getTelegramFileUrl(largestPhoto.file_id);
      if (url) { activeSession.urls.push(url); collectedFile = true; }
    } else if (message.document?.file_id) {
      const url = await getTelegramFileUrl(message.document.file_id);
      if (url) { activeSession.urls.push(url); collectedFile = true; }
    } else if (message.video?.file_id) {
      const url = await getTelegramFileUrl(message.video.file_id);
      if (url) { activeSession.urls.push(url); collectedFile = true; }
    }
    // Thu thap text & link tu text
    if (text) {
      const urlPattern = /https?:\/\/[^\s]+/g;
      const linksInText = text.match(urlPattern) || [];
      activeSession.urls.push(...linksInText);
      const textWithoutUrls = text.replace(urlPattern, '').trim();
      if (textWithoutUrls) activeSession.texts.push(textWithoutUrls);
    }
    if (text || collectedFile) {
      const count = activeSession.texts.length + activeSession.urls.length;
      await sendMessage(chatId,
        `Da ghi nhan (${count} muc). Tiep tuc gui them hoac nhan "Hoan tat nop ket qua".`,
        {
          inline_keyboard: [
            [{ text: 'Hoan tat nop ket qua', callback_data: `submit_output_done:${activeSession.issueId}:${activeSession.issueShortId}` }]
          ]
        }
      );
    }
    return;
  }

  // C. Intercept Global Commands & Buttons để Hủy Session (Tránh kẹt Form)
  if (GLOBAL_COMMANDS.includes(lowerText) || lowerText.startsWith("/subtask")) {
    if (userFormSession[chatId]) {
      delete userFormSession[chatId];
    }
  }

  if (lowerText === "/cancel" || lowerText === "hủy" || lowerText === "cancel" || lowerText === "huy") {
    await sendMessage(chatId, "✅ Đã hủy thao tác hiện tại.", KEYBOARD_MAIN);
    return;
  }

  // Xu ly reject reason cho admin tu choi task — SSOT: POST /plane/issues/:id/review
  const fSession = userFormSession[chatId];
  if (fSession?.step === 'await_reject_reason' && text) {
    const { issueId, adminId } = fSession;
    delete userFormSession[chatId];
    try {
      await apiClient.post(`${API_ROUTES.PLANE.ISSUES}/${issueId}/review`, {
        decision: 'reject',
        reviewerId: adminId,
        reviewNote: text,
      });
      // Assignee notify via NATS core.team.task.review_rejected (index.ts subscriber)
      await sendMessage(chatId, `Da tu choi. Task chuyen ve In Progress (nhan su se nhan thong bao).`);
    } catch (e) {
      console.error('[await_reject_reason] review API error:', e);
      await sendMessage(chatId, `Loi khi tu choi task.`);
    }
    return;
  }

  // Xử lý các bước nhập Form đăng ký (nghỉ phép/remote/tạo task/dự án)
  const session = userFormSession[chatId];
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
      const resJson = await apiClient.get(API_ROUTES.HR.ATTENDANCE) as any;
      const allRecords = Array.isArray(resJson) ? resJson : (resJson?.data || []);
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
      const json = await apiClient.get(API_ROUTES.PLANE.ISSUES) as any;
      dbTasks = Array.isArray(json) ? json : (json?.data || []);
      
      const allMembers = await getCachedMembers();
      
      dbTasks.forEach((sub: any) => {
        const memberName = (allMembers || []).find((m:any) => m.id === sub.assigneeId)?.fullName || sub.Assignee?.fullName || 'Chưa phân công';
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
    } catch (err) {
      console.error("Lỗi fetch tasks cho report:", err);
      await sendMessage(chatId, "❌ Lỗi kết nối cổng dữ liệu để tải danh sách công việc.");
      return;
    }

    // Chỉ hiển thị các task cha
    const parentTasks = mappedTasks.filter(t => t.parentId === null);
    if (parentTasks.length === 0) {
      await sendMessage(chatId, "📭 Hiện không có công việc nào trên hệ thống.");
      return;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Lọc bỏ Done
    const activeTasks = parentTasks.filter(t => t.status !== 'Done');

    activeTasks.sort((a, b) => {
      const aReview = a.status === 'In Review';
      const bReview = b.status === 'In Review';
      if (aReview !== bReview) return aReview ? -1 : 1;

      const aOverdue = a.rawDeadline && a.rawDeadline < now;
      const bOverdue = b.rawDeadline && b.rawDeadline < now;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      if (!a.rawDeadline && b.rawDeadline) return 1;
      if (a.rawDeadline && !b.rawDeadline) return -1;
      if (!a.rawDeadline && !b.rawDeadline) return 0;

      return a.rawDeadline!.getTime() - b.rawDeadline!.getTime();
    });

    const doneCount = parentTasks.filter(t => t.status === 'Done').length;
    const overdueCount = activeTasks.filter(t => t.rawDeadline && t.rawDeadline < now).length;
    const reviewCount = activeTasks.filter(t => t.status === 'In Review').length;

    let reportMsg = `📊 *BÁO CÁO TIẾN ĐỘ ĐỘI NGŨ*\n`
      + `🔵 Review: ${reviewCount} | 🔴 Quá hạn: ${overdueCount} | 🟢 Done: ${doneCount} | 📋 Đang mở: ${activeTasks.length}\n`;

    for (const task of activeTasks) {
      const isOverdue = task.rawDeadline && task.rawDeadline < now;

      let emoji = '⚪';
      if (isOverdue) emoji = '🔴';
      else if (task.status === 'In Review') emoji = '🔵';
      else if (task.status === 'In Progress') emoji = '🟡';
      else if (task.status === 'Done') emoji = '🟢';

      const dlText = task.deadline !== 'Chưa đặt'
        ? (isOverdue ? `📅 ${task.deadline} ⚠️ *QUÁ HẠN*` : `📅 ${task.deadline}`)
        : '📅 Chưa đặt';

      const shortId = `*${task.projectIdentifier}-${task.sequenceId}*`;
      reportMsg += `\n${emoji} ${shortId}: ${task.title}\n`;
      reportMsg += `   👤 *${task.assignee}*  |  \`${task.status}\`  |  ${dlText}\n`;

      if (task.subIssues && task.subIssues.length > 0) {
        const totalSubs = task.subIssues.length;
        const doneSubs = task.subIssues.filter((s: any) => s.State?.name === 'Done').length;
        reportMsg += `   ↳ Tiến độ subtask: ${doneSubs}/${totalSubs} hoàn thành\n`;
      }

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


  if (cleanText === "/lichhop" || cleanText === "📅 lịch họp") {
    await sendMessage(chatId, "📅 *QUẢN LÝ LỊCH HỌP*\n\nVui lòng chọn:", {
      inline_keyboard: [
        [
          { text: "➕ Tạo lịch họp mới", callback_data: "meeting_create" },
          { text: "📋 Xem lịch sắp tới", callback_data: "meeting_list" }
        ]
      ]
    });
    return;
  }

  if (cleanText === "/thongbao" || cleanText === "/notify") {
    const isAdmin = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'].includes((member.email || '').toLowerCase());
    if (!isAdmin) {
      await sendMessage(chatId, "⚠️ Chỉ Ban Giám Đốc mới được dùng lệnh /thongbao.");
      return;
    }
    userFormSession[chatId] = { step: 'await_announcement_text', memberId: member.id };
    await sendMessage(chatId, "📢 Vui lòng nhập nội dung Thông báo toàn hệ thống:\n(Gõ /cancel để hủy)");
    return;
  }

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
    
    try {
      const issued: any = await apiClient.post('/auth/one-time/issue', {
        teamMemberId: member.id,
        source: 'telegram',
      });
      const portalUrl = issued.data?.loginUrl || issued.loginUrl;
      if (!portalUrl) throw new Error('Backend did not return loginUrl');
    
    await sendMessage(chatId, "🌐 Bấm nút dưới đây để mở giao diện Web Portal:", {
      inline_keyboard: [
        [
          { text: "🚀 Mở Storymee Portal", url: portalUrl }
        ]
      ]
    });
    } catch (error: any) {
      console.error('[portal] issue one-time login failed:', error?.message || error);
      await sendMessage(chatId, '❌ Không thể tạo liên kết đăng nhập lúc này. Vui lòng thử lại sau.');
    }
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
    const isFullRemoteMem =
      String(member?.workArrangement || "").toLowerCase() === "remote" ||
      String(member?.workArrangement || "").toLowerCase() === "full_remote";
    const checkinLabel = isFullRemoteMem ? "🏠 Vào ca Remote" : "🌅 Vào ca (Check-in)";
    const checkinCb = isFullRemoteMem
      ? "attendance_direct:present:remote"
      : "attendance_direct:present";
    await sendMessage(
      chatId,
      isFullRemoteMem
        ? "🏠 *ĐIỂM DANH REMOTE*\n\nBạn là full remote (HR). Check-in sẽ ghi **Remote**."
        : "🌅 *BÁO CÁO ĐIỂM DANH HÀNG NGÀY*\n\nVui lòng chọn ca điểm danh. _(Đơn remote đã duyệt hôm nay → tự ghi Remote.)_",
      {
        inline_keyboard: [
          [
            { text: checkinLabel, callback_data: checkinCb },
            { text: "🚪 Tan ca (Check-out)", callback_data: `attendance_direct:checkout` },
          ],
        ],
      }
    );
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

  // Fast path: button /cong_viec + NL "công việc của tôi / trong ngày" — no LLM
  const isMyWorkQuery =
    cleanText === "📝 công việc của tôi" ||
    cleanText === "/cong_viec" ||
    /^(kiểm tra |xem |cho tôi xem |liệt kê |list )?(các )?(công việc|task|issue)s?( trong ngày| hôm nay| hôm nay của tôi| của tôi| của mình)?[\s!?.]*$/i.test(
      text.trim()
    ) ||
    /công việc (trong ngày|hôm nay|của tôi|của mình)/i.test(text.trim());

  if (isMyWorkQuery) {
    sendChatAction(chatId, 'typing').catch(() => {});
    try {
      invalidateIssuesCache();
      const rawTasks: any[] = await getCachedIssues();
      const parentMap = new Map<string, any>();
      const topLevelIssues: any[] = [];
      rawTasks.forEach((t: any) => {
        const clone = { ...t, subIssues: [] as any[] };
        parentMap.set(t.id, clone);
      });
      parentMap.forEach((t) => {
        if (t.parentId && parentMap.has(t.parentId)) {
          parentMap.get(t.parentId).subIssues.push(t);
        } else if (!t.parentId) {
          topLevelIssues.push(t);
        }
      });
      parentMap.forEach((t) => {
        if (t.parentId && !parentMap.has(t.parentId)) topLevelIssues.push(t);
      });

      const myIssues = topLevelIssues.filter((t: any) => {
        const isAssigned = t.assigneeId === member.id;
        const hasAssignedSub = (t.subIssues || []).some((sub: any) => sub.assigneeId === member.id);
        return isAssigned || hasAssignedSub;
      });
      await sendMessage(chatId, formatMyIssuesDM(myIssues, member.fullName));
    } catch (e: any) {
      console.error("Lỗi fetch task:", e);
      await sendMessage(chatId, "❌ Gặp lỗi khi truy vấn danh sách công việc. Thử lại hoặc gõ /cong_viec.");
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

  // Typing indicator (non-blocking) + keep-alive interval (Telegram expires ~5s)
  sendChatAction(chatId, 'typing').catch(() => {});
  const typingTimer = setInterval(() => {
    sendChatAction(chatId, 'typing').catch(() => {});
  }, 4000);

  // E. Fast intent (heuristic) — skip Gemini Flash unless TELEGRAM_USE_FLASH_INTENT=1
  let userIntent = classifyIntentFast(text);
  if (USE_FLASH_INTENT && process.env.GEMINI_API_KEY) {
    try {
      const flashRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: `Classify into exactly one of TASK,HR,PROJECT_MANAGEMENT,CHAT. Output one word only.\nText: ${text}` }],
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 8 },
          }),
          signal: AbortSignal.timeout(2000),
        }
      );
      if (flashRes.ok) {
        const flashJson = (await flashRes.json()) as any;
        const rawOutput = flashJson.candidates?.[0]?.content?.parts?.[0]?.text || userIntent;
        const parsed = rawOutput.trim().toUpperCase().replace(/[^A-Z_]/g, '');
        if (['TASK', 'HR', 'PROJECT_MANAGEMENT', 'MEETING', 'CHAT'].includes(parsed)) {
          userIntent = parsed as any;
        }
      }
    } catch {
      /* keep heuristic */
    }
  }

  // F. Projects only when needed (cached 3m)
  let projects: any[] = [];
  if (userIntent === 'TASK' || userIntent === 'PROJECT_MANAGEMENT') {
    try {
      const projData = await getCachedProjects();
      projects = (projData || []).map((p: any) => ({
        id: p.id,
        title: p.name,
        identifier: p.identifier,
      }));
    } catch (err) {
      console.error('Lỗi projects cache:', err);
    }
  }

  // MEETING intent: load danh sách thành viên để LLM có context tính năng tạo lịch họp
  const slimRosterForMeeting = userIntent === 'MEETING' ? buildSlimRoster(allMembers) : '';

  // F. OmniRouter / FE chat — preferFastLLM skips Letta + heavy HR on server
  try {
    const history = chatHistories[chatId] || [];
    const slimRoster = buildSlimRoster(allMembers);
    const t0 = Date.now();
    const res = await fetchAxios(OMNIROUTER_API_URL, {
      method: 'POST',
      headers: serviceAuthHeaders({ 'Content-Type': 'application/json' }),
      timeout: LLM_TIMEOUT_MS,
      body: JSON.stringify({
        message: text,
        history: history.slice(-HISTORY_TURNS),
        currentUser: {
          id: member.id,
          email: member.email,
          fullName: member.fullName,
          name: member.fullName,
          role: member.role,
          annualLeaveLimit: member.annualLeaveLimit,
          annualLeaveUsed: member.annualLeaveUsed,
          remoteLimit: member.remoteLimit,
          remoteUsed: member.remoteUsed,
          lettaConversationId: member.lettaConversationId,
        },
        tasks: [],
        projects,
        companyRules:
          `Nhân sự active:\n${slimRoster}\n\n` +
          `QUY TẮC: Không bịa project_id. Không hỏi gặng estimate. Trả JSON action chuẩn.\n\n` +
          (userIntent === 'MEETING'
            ? `MEETING MODE: Người dùng muốn ĐẶT LỊCH HỌP. Bắt buộc trả về action="create_meeting" với meetingPayload gồm: title (string), startTime (ISO 8601 kèm +07:00), endTime (ISO 8601, mặc định startTime+1h), attendees (array tên/email). Ngày "mai" = ${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}. KHÔNG trả lời "không có chức năng" — LUÔN tạo lịch.\nDanh sách nhân sự để resolve attendees:\n${slimRosterForMeeting}`
            : ''),
        config: {
          source: 'telegram',
          preferFastLLM: true,
          skipLetta: true,
          useCloud: false,
          useFallback: true,
          useMasking: false,
          useCompression: true,
          intent: userIntent,
        },
      }),
    });
    console.log(`[Telegram LLM] intent=${userIntent} latency=${Date.now() - t0}ms status=${res.status}`);

    if (res.ok) {
      const json = (await res.json()) as any;
      if (json.status === "success" && json.data) {
        const aiResponse = json.data;
        await sendMessage(chatId, aiResponse.reply);

        // Lưu hội thoại vào history (ngắn — tiết kiệm tokens)
        history.push({ role: "user", parts: [{ text: text }] });
        history.push({ role: "model", parts: [{ text: aiResponse.reply }] });
        chatHistories[chatId] = history.slice(-HISTORY_TURNS);

        // G. Xử lý Action từ AI: Lưu vào cache và gửi Inline Keyboard xác nhận
        if (aiResponse.action === 'get_attendance_report') {
          const rp = aiResponse.reportPayload || {};
          const result = await executeMcpTool("get_attendance_report", {
            employee_name: rp.employee_name,
            month: rp.month,
            year: rp.year
          }, member);
          if (result?.content?.[0]?.text) await sendMessage(chatId, result.content[0].text);
        } else if (aiResponse.action === 'show_my_issues') {
          try {
            invalidateIssuesCache();
            const rawTasks: any[] = await getCachedIssues();
            const parentMap = new Map<string, any>();
            const topLevelIssues: any[] = [];
            rawTasks.forEach((t: any) => parentMap.set(t.id, { ...t, subIssues: [] }));
            parentMap.forEach((t) => {
              if (t.parentId && parentMap.has(t.parentId)) parentMap.get(t.parentId).subIssues.push(t);
              else if (!t.parentId) topLevelIssues.push(t);
            });
            const myIssues = topLevelIssues.filter((t: any) => {
                const isAssigned = t.assigneeId === member.id;
                const hasAssignedSub = (t.subIssues || []).some((sub: any) => sub.assigneeId === member.id);
                return isAssigned || hasAssignedSub;
            });
            await sendMessage(chatId, formatMyIssuesDM(myIssues, member.fullName));
          } catch (e: any) {
            console.error("Lỗi fetch task AI action:", e);
            await sendMessage(chatId, "❌ Gặp lỗi khi đồng bộ danh sách công việc.");
          }
        } else if (aiResponse.action === 'get_team_leaves' || aiResponse.action === 'list_leave_requests') {
          const result = await executeMcpTool("list_leave_requests", aiResponse.teamLeavesPayload || { status: 'pending' }, member);
          await sendMessage(chatId, result.content[0].text);
        } else if (aiResponse.action === 'create_issue') {
          await sendMessage(chatId, "⏳ Đang tự động tạo Task theo yêu cầu...");
          try {
            // Extract URLs from original user message if AI forgot
            const urlRe = /https?:\/\/[^\s)>\]]+/gi;
            const urlsFromMsg = (text.match(urlRe) || []) as string[];
            const tp = { ...(aiResponse.taskPayload || {}) };
            if (urlsFromMsg.length) {
              const links = Array.isArray(tp.links) ? tp.links : [];
              const media = Array.isArray(tp.media_urls) ? tp.media_urls : [];
              for (const u of urlsFromMsg) {
                if (/\.(png|jpe?g|gif|webp|mp4|mov|webm)(\?|$)/i.test(u) || /imgur|giphy|cloudinary|cdn/i.test(u)) {
                  if (!media.includes(u)) media.push(u);
                } else if (!links.includes(u)) links.push(u);
              }
              tp.links = links;
              tp.media_urls = media;
            }
            // If user wrote a long message, keep as description when AI only set title
            if (!tp.description && text && text.length > 40 && tp.title) {
              tp.description = text;
            }
            const result = await executeMcpTool("create_issue", tp, member);
            await sendMessage(chatId, result.content[0].text);
          } catch (e: any) {
            await sendMessage(chatId, `❌ Lỗi khi tạo Task: ${e.message}`);
          }
        } else if (aiResponse.action === 'leave_request') {
          await sendMessage(chatId, "⏳ Đang tự động tạo Đơn xin nghỉ phép...");
          try {
            const result = await executeMcpTool("submit_leave_request", aiResponse.leavePayload, member);
            await sendMessage(chatId, result.content[0].text);
          } catch (e: any) {
            await sendMessage(chatId, `❌ Lỗi khi nộp đơn: ${e.message}`);
          }
        } else if (
          aiResponse.action === 'delete_issue' ||
          aiResponse.action === 'delete_task' ||
          aiResponse.action === 'archive_issue' ||
          aiResponse.action === 'archive_task' ||
          (aiResponse.action === 'update_issue' &&
            ['delete', 'cancelled', 'archive', 'remove'].includes(
              String(aiResponse.taskPayload?.status || '').toLowerCase()
            )) ||
          (aiResponse.action === 'request_issue_approval' &&
            ['archive', 'delete', 'remove'].includes(
              String(aiResponse.approvalPayload?.type || '').toLowerCase()
            ))
        ) {
          // User tự archive/xoá (assignee|admin) — không xin admin
          const tp = aiResponse.taskPayload || aiResponse.approvalPayload || {};
          const taskId = tp.task_id || tp.id || tp.issue_id;
          const wantDelete =
            aiResponse.action === 'delete_issue' ||
            aiResponse.action === 'delete_task' ||
            String(aiResponse.approvalPayload?.type || '').toLowerCase() === 'delete' ||
            String(tp.status || '').toLowerCase() === 'delete' ||
            String(tp.status || '').toLowerCase() === 'remove';
          aiResponse.action = wantDelete ? 'delete_issue' : 'archive_issue';
          aiResponse.taskPayload = {
            task_id: taskId,
            reason: tp.reason || tp.note || (wantDelete ? 'User xoá task qua chat' : 'User archive task qua chat'),
          };
        }

        if (['create_project', 'update_issue', 'update_issues', 'check_in_out', 'breakdown_issue', 'update_sub_issues', 'request_issue_approval', 'create_meeting', 'update_meeting', 'delete_issue', 'archive_issue'].includes(aiResponse.action)) {
          const actionId = Math.random().toString(36).substring(2, 10);
          actionCache[actionId] = {
            action: aiResponse.action,
            payload: aiResponse.action === 'check_in_out'
                ? aiResponse.checkInOutPayload
                : aiResponse.action === 'breakdown_issue'
                  ? aiResponse.breakdownPayload
                  : aiResponse.action === 'update_sub_issues'
                    ? aiResponse.updateSubtasksPayload
                    : aiResponse.action === 'request_issue_approval'
                      ? { ...(aiResponse.approvalPayload || {}) }
                      : aiResponse.action === 'create_project'
                        ? aiResponse.projectPayload
                        : aiResponse.action === 'create_meeting'
                          ? aiResponse.meetingPayload
                          : aiResponse.action === 'update_meeting'
                            ? aiResponse.updateMeetingPayload
                            : aiResponse.action === 'delete_issue' || aiResponse.action === 'archive_issue'
                              ? (aiResponse.taskPayload || {})
                              : aiResponse.taskPayload,
            member: member
          };

          let confirmMsg = '';
          if (aiResponse.action === 'check_in_out') {
            const cp = aiResponse.checkInOutPayload || {};
            confirmMsg = `💡 *ĐỀ XUẤT ĐIỂM DANH:*\n• Trạng thái: *${cp.status === 'present' ? 'Đi làm' : cp.status === 'late' ? 'Đi muộn' : cp.status === 'checkout' ? 'Tan ca' : 'Vắng'}*\n• Ghi chú: *${cp.notes || 'Không có'}*${cp.employee_name ? `\n• Nhân sự: *${cp.employee_name}*` : ''}`;
          } else if (aiResponse.action === 'breakdown_issue') {
            const bp = aiResponse.breakdownPayload || {};
            confirmMsg = `💡 *ĐỀ XUẤT PHÂN RÃ CÔNG VIỆC ${bp.task_id}:*\n• Hệ thống AI sẽ tự động sinh danh sách việc con và lưu vào DB.`;
          } else if (aiResponse.action === 'update_sub_issues') {
            const up = aiResponse.updateSubtasksPayload || {};
            const listStr = up.titles ? up.titles.map((t: string) => `  • ${t}`).join('\n') : '';
            const actionTitle = up.overwrite ? 'THAY THẾ TOÀN BỘ' : 'TẠO THÊM';
            const actionDesc = up.overwrite 
              ? '👉 Bấm Xác nhận sẽ xóa toàn bộ việc con cũ của task này và thay bằng danh sách trên.'
              : '👉 Bấm Xác nhận sẽ tạo thêm các việc con này vào danh sách hiện tại.';
            confirmMsg = `💡 *ĐỀ XUẤT ${actionTitle} CÁC CÔNG VIỆC CON CHO ${up.task_id}:*\n${listStr}\n\n${actionDesc}`;
          } else if (aiResponse.action === 'create_meeting') {
            const mp = aiResponse.meetingPayload || {};
            confirmMsg = `💡 *ĐỀ XUẤT ĐẶT LỊCH HỌP:*\n• Tiêu đề: *${mp.title}*\n• Thời gian: *${new Date(mp.startTime).toLocaleString('vi-VN')}* đến *${new Date(mp.endTime).toLocaleString('vi-VN')}*\n• Tham gia: *${mp.attendees?.join(', ') || 'Chỉ mình bạn'}*`;
          } else if (aiResponse.action === 'update_meeting') {
            const mp = aiResponse.updateMeetingPayload || {};
            const isCancel = mp.status === 'cancelled';
            confirmMsg = `💡 *ĐỀ XUẤT ${isCancel ? 'HỦY' : 'CẬP NHẬT'} LỊCH HỌP ${mp.meeting_id}:*\n• Tiêu đề: *${mp.title}*\n• Thời gian: *${new Date(mp.startTime).toLocaleString('vi-VN')}* đến *${new Date(mp.endTime).toLocaleString('vi-VN')}*`;
          } else if (aiResponse.action === 'update_issue') {
            const tp = aiResponse.taskPayload || {};
            const statusText = tp.status ? `\n• Trạng thái mới: *${tp.status}*` : '';
            const assigneeText = tp.assignee ? `\n• Người phụ trách: *${tp.assignee}*` : '';
            const deadlineText = tp.deadline ? `\n• Hạn chót mới: *${tp.deadline}*` : '';
            const estimateText = tp.estimate ? `\n• Ước tính mới: *${tp.estimate}h*` : '';
            const priorityText = tp.priority ? `\n• Độ ưu tiên: *${tp.priority}*` : '';
            confirmMsg = `💡 *ĐỀ XUẤT CẬP NHẬT CÔNG VIỆC ${tp.id}:*${statusText}${assigneeText}${deadlineText}${estimateText}${priorityText}`;
          } else if (aiResponse.action === 'archive_issue') {
            const tp = aiResponse.taskPayload || {};
            confirmMsg = `💡 *ĐỀ XUẤT LƯU TRỮ (ARCHIVE) TASK ${tp.task_id || tp.id}:*\n• Lý do: *${tp.reason || 'Ẩn khỏi Kanban'}*\n\n_(Assignee/Admin tự archive — không cần Admin duyệt.)_`;
          } else if (aiResponse.action === 'delete_issue') {
            const tp = aiResponse.taskPayload || {};
            confirmMsg = `💡 *ĐỀ XUẤT XOÁ VĨNH VIỄN TASK ${tp.task_id || tp.id}:*\n• ⚠️ Không hoàn tác (kèm subtask).\n• Lý do: *${tp.reason || '—'}*\n\n_(Assignee/Admin tự xoá. Nên Archive nếu chỉ cần ẩn.)_`;
          } else if (aiResponse.action === 'request_issue_approval') {
            const ap = aiResponse.approvalPayload || {};
            confirmMsg = `💡 *ĐỀ XUẤT CẬP NHẬT TASK ${ap.task_id || ap.id}:*\n• Loại: *${ap.type || 'extend'}*\n• Hạn chót: *${ap.new_deadline || 'Không'}*\n• Lý do: *${ap.reason || '—'}*`;
          } else if (aiResponse.action === 'create_project') {
            const pp = aiResponse.projectPayload || {};
            confirmMsg = `💡 *ĐỀ XUẤT TẠO DỰ ÁN MỚI:*\n• Tên dự án: *${pp.title}*\n• Mô tả: *${pp.description || 'Không'}*`;
          } else {
            const tp = aiResponse.taskPayload || {};
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
  } finally {
    clearInterval(typingTimer);
  }
}
