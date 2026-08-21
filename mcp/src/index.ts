import { fetchAxios } from './fetchAxios';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import { sendMessage, getCachedMembers } from "./telegram_agent";
import * as dotenv from "dotenv";
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import { connect } from "nats";
import { createTeamServiceClient } from './serviceRoutes';

import { PLANE_TOOLS_SCHEMA, executePlaneTool } from './mcp/tools/planeTools';
import { HR_TOOLS_SCHEMA, executeHrTool } from './mcp/tools/hrTools';
import { ATTENDANCE_TOOLS_SCHEMA, executeAttendanceTool } from './mcp/tools/attendanceTools';

dotenv.config();


import { startTelegramPolling } from './telegram_agent';
import { startCronJobs } from './cronJobs';

let apiClient = createTeamServiceClient();

let cachedMembers: any[] | null = null;
let lastCacheTime = 0;

export async function getTeamMembersCache(): Promise<any[]> {
  if (cachedMembers && Date.now() - lastCacheTime < 60000) {
    return cachedMembers;
  }
  try {
    const data = (await apiClient.get(API_ROUTES.HR.TEAM_MEMBERS)) as any;
    cachedMembers = data.data || [];
    lastCacheTime = Date.now();
    return cachedMembers as any[];
  } catch (err: any) {
    console.error("[MCP Error] 32603 - Core API connect failed:", err.message);
    throw new McpError(ErrorCode.InternalError, `Không thể kết nối đến Core API Service (32603): ${err.message}`);
  }
}

const DEFAULT_ADMIN_EMAILS = (process.env.TEAM_ADMIN_EMAILS ||
  'kimngan151091@gmail.com,lehuyducanh.vn@gmail.com,zuzzivn@gmail.com')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const ADMIN_ROLE_KEYWORDS = ['founder', 'it admin', 'admin', 'director', 'boss', 'manager', 'hr'];

function isTeamAdminMember(m: { email?: string | null; role?: string | null } | null | undefined): boolean {
  if (!m) return false;
  const email = (m.email || '').toLowerCase().trim();
  if (email && DEFAULT_ADMIN_EMAILS.includes(email)) return true;
  const role = (m.role || '').toLowerCase();
  return ADMIN_ROLE_KEYWORDS.some((k) => role.includes(k));
}

// Trợ giúp phân quyền & xác thực
async function authorizeClient() {
  const email = process.env.STORYMEE_USER_EMAIL;
  if (!email) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "LỖI BẢO MẬT: Chưa cấu hình biến môi trường STORYMEE_USER_EMAIL trong file settings MCP."
    );
  }

  const members = await getTeamMembersCache();
  
  const user = members.find((m: any) => m.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `LỖI BẢO MẬT: Không tìm thấy nhân sự có email ${email} trong hệ thống.`
    );
  }

  const isBoss = isTeamAdminMember(user);
  return { user, isBoss, members };
}

// Khởi tạo MCP Server
const server = new Server(
  {
    name: "storymeeteam-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Định nghĩa danh sách các công cụ bằng Dynamic AST Loading
const allTools = [
  ...PLANE_TOOLS_SCHEMA,
  ...HR_TOOLS_SCHEMA,
  ...ATTENDANCE_TOOLS_SCHEMA
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools as any
  };
});

// Xử lý thực thi công cụ
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const { user } = await authorizeClient();
  return executeMcpTool(name, args, user);
});

/**
 * Alias LLM hay gọi sai tên → canonical tool.
 * Tránh "Unknown tool" / thiếu tool call.
 */
const TOOL_ALIASES: Record<string, string> = {
  // tasks
  get_my_tasks: 'get_my_issues',
  list_tasks: 'get_my_issues',
  list_issues: 'get_my_issues',
  my_tasks: 'get_my_issues',
  create_task: 'create_issue',
  add_task: 'create_issue',
  update_task: 'update_issue',
  update_task_status: 'update_issue_state',
  set_task_status: 'update_issue_state',
  change_status: 'update_issue_state',
  assign_task: 'assign_issue',
  reassign_task: 'assign_issue',
  task_details: 'get_issue_details',
  get_task: 'get_issue_details',
  breakdown_task: 'breakdown_issue',
  approve_task: 'review_issue',
  review_task: 'review_issue',
  reject_task: 'review_issue',
  // Archive / xoá: user self-service (assignee hoặc admin) — không còn xin admin
  archive_task: 'archive_issue',
  archive_issue: 'archive_issue',
  luu_tru: 'archive_issue',
  delete_task: 'delete_issue',
  remove_task: 'delete_issue',
  remove_issue: 'delete_issue',
  xoa_task: 'delete_issue',
  // leave
  submit_leave: 'submit_leave_request',
  request_leave: 'submit_leave_request',
  leave_request: 'submit_leave_request',
  xin_nghi: 'submit_leave_request',
  approve_leave: 'approve_leave_request',
  reject_leave: 'approve_leave_request',
  list_leaves: 'list_leave_requests',
  get_leaves: 'list_leave_requests',
  leave_balance: 'get_leave_allowance',
  // attendance
  checkin: 'check_in_out',
  checkout: 'check_in_out',
  check_in: 'check_in_out',
  check_out: 'check_in_out',
  diem_danh: 'check_in_out',
  // meetings
  create_meeting: 'schedule_meeting',
  book_meeting: 'schedule_meeting',
  // announce
  notify_all: 'broadcast_announcement',
  send_announcement: 'broadcast_announcement',
  announcement: 'broadcast_announcement',
};

function normalizeToolArgs(name: string, args: any): any {
  const a = { ...(args || {}) };
  // checkout aliases → status
  if (name === 'check_in_out' || name === 'checkout' || name === 'check_out') {
    if (!a.status && !a.action) {
      if (name === 'checkout' || name === 'check_out') a.action = 'checkout';
    }
  }
  // reject_task without decision
  if ((name === 'reject_task' || name === 'reject_leave') && !a.decision) {
    a.decision = 'reject';
  }
  if ((name === 'approve_task' || name === 'approve_leave') && !a.decision) {
    a.decision = 'approve';
  }
  // archive / delete aliases → normalize task_id
  const taskIdAliases = [
    'archive_task', 'archive_issue', 'delete_task', 'delete_issue',
    'remove_task', 'remove_issue', 'xoa_task', 'luu_tru',
  ];
  if (taskIdAliases.includes(name) || taskIdAliases.includes(name.toLowerCase())) {
    if (a.id && !a.task_id) a.task_id = a.id;
    if (a.issue_id && !a.task_id) a.task_id = a.issue_id;
    a.reason = a.reason || a.note;
  }
  return a;
}

export async function executeMcpTool(
  name: string,
  args: any,
  user: any,
  username?: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const isBoss = isTeamAdminMember(user);
  const members = await getTeamMembersCache();

  const rawName = (name || '').trim();
  let toolName = TOOL_ALIASES[rawName] || TOOL_ALIASES[rawName.toLowerCase()] || rawName;
  let normalizedArgs = normalizeToolArgs(rawName, args);

  // User (assignee) được delete/archive trực tiếp — planeTools enforce assignee|admin
  if (toolName === 'delete_issue' || toolName === 'archive_issue') {
    normalizedArgs = {
      ...normalizedArgs,
      task_id: normalizedArgs.task_id || normalizedArgs.id || normalizedArgs.issue_id,
    };
  }

  const planeNames = PLANE_TOOLS_SCHEMA.map(t => t.name);
  const hrNames = HR_TOOLS_SCHEMA.map(t => t.name);
  const attendanceNames = ATTENDANCE_TOOLS_SCHEMA.map(t => t.name);

  if (planeNames.includes(toolName)) {
    return executePlaneTool(toolName, normalizedArgs, user, isBoss, apiClient, members, username);
  }
  if (hrNames.includes(toolName)) {
    return executeHrTool(toolName, normalizedArgs, user, isBoss, apiClient, members);
  }
  if (attendanceNames.includes(toolName)) {
    return executeAttendanceTool(toolName, normalizedArgs, user, isBoss, apiClient, members);
  }
  throw new McpError(
    ErrorCode.MethodNotFound,
    `Unknown tool: ${rawName} (resolved: ${toolName}). Xem docs/MCP_TOOL_CALLING.md`
  );
}

// Chạy server StdIO
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("StorymeeTeam MCP Server đã khởi chạy và kết nối qua StdIO!");

  // 💓 NATS JetStream Heartbeat
  try {
    const natsUrl = process.env.NATS_URL || "nats://localhost:4222";
    const nc = await connect({ servers: natsUrl, maxReconnectAttempts: -1 });
    const js = nc.jetstream();
    const kv = await js.views.kv("system_radar", { history: 1 });
    
    const sendHeartbeat = async () => {
      try {
        const payload = JSON.stringify({
          status: "online",
          lastSeen: Date.now(),
          type: "mcp",
          name: "storymeeteam-mcp"
        });
        await kv.put("storymeeteam-mcp", new TextEncoder().encode(payload));

        const botPayload = JSON.stringify({
          status: "online",
          lastSeen: Date.now(),
          type: "bot",
          name: "StorymeeTeam Bot"
        });
        await kv.put("storymeeteam-bot-agent", new TextEncoder().encode(botPayload));
      } catch (err: any) {
        console.error("[NATS] Heartbeat error:", err.message);
      }
    };

    await sendHeartbeat();
    setInterval(sendHeartbeat, 10000);
    console.error("[NATS] Heartbeat initialized for storymeeteam-mcp");
  } catch (err: any) {
    console.error("[NATS] Failed to initialize NATS heartbeat:", err.message);
  }

  // Subscribe to Notifications
  try {
    const nc = await connect({ servers: process.env.NATS_URL || "nats://localhost:4222" });

    nc.subscribe('core.team.auth.login_requested', {
      callback: async (err, msg) => {
        if (!err) {
          try {
            const data = JSON.parse(msg.data.toString());
            if (data.telegramChatId && data.loginUrl) {
              const txt = `🌐 *YÊU CẦU ĐĂNG NHẬP*\n\nBạn vừa yêu cầu đăng nhập từ Web Portal. Bấm nút dưới đây để vào thẳng hệ thống:`;
              await sendMessage(Number(data.telegramChatId), txt, {
                inline_keyboard: [[
                  { text: "🚀 Mở Storymee Portal", url: data.loginUrl }
                ]]
              });
            }
          } catch (e) {
            console.error('[NATS] Error processing login_requested', e);
          }
        }
      }
    });

    nc.subscribe('core.team.leave.request', {
      callback: async (err, msg) => {
        if (!err) {
          try {
            const data = JSON.parse(msg.data.toString());
            const leave = data.leaveRequest;
            const members = await getCachedMembers();
            const admins = members.filter((m: any) => isTeamAdminMember(m) && m.telegramChatId);
            const startD = leave.startDate.split('T')[0];
            const endD = leave.endDate.split('T')[0];
            const typeStr = leave.leaveType === 'sick' ? 'Nghỉ ốm' : leave.leaveType === 'annual' ? 'Nghỉ phép năm' : leave.leaveType === 'remote' ? 'Làm Remote' : 'Việc riêng';
            
            const txt = `🔔 *YÊU CẦU XIN NGHỈ PHÉP* 🔔\n\n` +
                        `👤 Nhân sự: *${leave.member.fullName}*\n` +
                        `Loại: ${typeStr}\n` +
                        `Từ ngày: ${startD}\n` +
                        `Đến ngày: ${endD}\n` +
                        `Lý do: ${leave.reason}\n\n` +
                        `Vui lòng duyệt qua Dashboard.`;
            
            for (const admin of admins) {
              await sendMessage(Number(admin.telegramChatId), txt, {
                inline_keyboard: [[
                  { text: "✅ Duyệt nghỉ", callback_data: `approve_leave:${leave.id}` },
                  { text: "❌ Từ chối", callback_data: `reject_leave:${leave.id}` }
                ]]
              });
            }
          } catch (e) {
            console.error('[NATS] Error processing leave request', e);
          }
        }
      }
    });

    nc.subscribe('core.team.leave.resolved', {
      callback: async (err, msg) => {
        if (!err) {
          try {
            const data = JSON.parse(msg.data.toString());
            const leave = data.leaveRequest;
            if (leave.member && leave.member.telegramChatId) {
              const startD = leave.startDate.split('T')[0];
              const endD = leave.endDate.split('T')[0];
              const typeStr = leave.leaveType === 'sick' ? 'Nghỉ ốm' : leave.leaveType === 'annual' ? 'Nghỉ phép năm' : leave.leaveType === 'remote' ? 'Làm Remote' : 'Việc riêng';
              let txt = `🔔 *CẬP NHẬT TRẠNG THÁI PHÉP* 🔔\n\n` +
                        `👤 Nhân sự: *${leave.member.fullName}*\n` +
                        `Loại: ${typeStr}\n` +
                        `Từ ngày: ${startD}\nĐến ngày: ${endD}\n\n` +
                        `Trạng thái: *${leave.status === 'approved' ? 'ĐÃ ĐƯỢC DUYỆT ✅' : 'BỊ TỪ CHỐI ❌'}*`;
              if (data.handover && data.handover.handoverMember) {
                 txt += `\n• Chuyển giao việc cho: *${data.handover.handoverMember.fullName}*`;
              }
              await sendMessage(Number(leave.member.telegramChatId), txt);
            }
          } catch (e) {
            console.error('[NATS] Error processing leave resolved', e);
          }
        }
      }
    });
    
    nc.subscribe('core.team.task.request_approval', {
      callback: async (err, msg) => {
        if (!err) {
          try {
            const data = JSON.parse(msg.data.toString());
            const task = data.task;
            const members = await getCachedMembers();
            const admins = members.filter((m: any) => isTeamAdminMember(m) && m.telegramChatId);
            
            let txt = `🔔 *YÊU CẦU PHÊ DUYỆT TASK* 🔔\n\n` +
                      `📌 Task: *${task.title}* (${task.planeTaskId || task.id})\n` +
                      `👤 Loại yêu cầu: ${data.type === 'archive' ? 'Lưu trữ (Archive)' : 'Gia hạn Deadline'}\n` +
                      `💬 Lý do: ${data.reason || 'Không có lý do'}\n`;
            if (data.type === 'extend') txt += `⏰ Deadline mới: ${data.newDeadline}\n`;
            txt += `\nVui lòng duyệt qua Dashboard.`;
            
            for (const admin of admins) {
              await sendMessage(Number(admin.telegramChatId), txt, {
                inline_keyboard: [[
                  { text: "✅ Duyệt", callback_data: `approve_issue_request:${task.id}:${data.type}:${data.newDeadline || ''}` },
                  { text: "❌ Từ chối", callback_data: `reject_issue_request:${task.id}:${data.type}` }
                ]]
              });
            }
          } catch (e) {
            console.error('[NATS] Error processing task approval', e);
          }
        }
      }
    });

    nc.subscribe('core.team.task.approved', {
      callback: async (err, msg) => {
        if (!err) {
          try {
            const data = JSON.parse(msg.data.toString());
            const members = await getCachedMembers();
            const assignee = members.find((m: any) => m.id === data.task.assigneeId);
            if (assignee && assignee.telegramChatId) {
              await sendMessage(Number(assignee.telegramChatId), `✅ *YÊU CẦU ĐƯỢC PHÊ DUYỆT*\n\nAdmin đã duyệt yêu cầu cho Task: *${data.task.title}*`);
            }
          } catch (e) {}
        }
      }
    });
    
    nc.subscribe('core.team.task.rejected', {
      callback: async (err, msg) => {
        if (!err) {
          try {
            const data = JSON.parse(msg.data.toString());
            const members = await getCachedMembers();
            const assignee = members.find((m: any) => m.id === data.task.assigneeId);
            if (assignee && assignee.telegramChatId) {
              await sendMessage(Number(assignee.telegramChatId), `❌ *YÊU CẦU BỊ TỪ CHỐI*\n\nAdmin đã từ chối yêu cầu cho Task: *${data.task.title}*`);
            }
          } catch (e) {}
        }
      }
    });

    // ─── REVIEW SYSTEM: Nhân sự nộp output → Notify Admins ──────────────────
    nc.subscribe('core.team.task.submitted_for_review', {
      callback: async (err, msg) => {
        if (!err) {
          try {
            const data = JSON.parse(msg.data.toString());
            const issue = data.issue;
            const admins: any[] = data.admins || [];

            const projIdent = issue.Project?.identifier || '';
            const shortId = projIdent && issue.sequenceId ? `${projIdent}-${issue.sequenceId}` : issue.id?.substring(0, 8);
            const submitterName = issue.Assignee?.fullName || 'Nhân sự';
            const now = new Date();
            const timeStr = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

            let txt = `🔵 *TASK CẦN DUYỆT OUTPUT*\n\n`;
            txt += `📋 *${shortId}*: ${issue.title}\n`;
            txt += `👤 Nộp bởi: *${submitterName}*\n`;
            txt += `🕐 Nộp lúc: ${timeStr}\n\n`;
            if (issue.outputContent) {
              txt += `📝 *Output:*\n${issue.outputContent.substring(0, 300)}${issue.outputContent.length > 300 ? '...' : ''}\n\n`;
            }
            const urls: string[] = Array.isArray(issue.outputUrls) ? issue.outputUrls : [];
            if (urls.length > 0) {
              txt += `🔗 *Links đính kèm (${urls.length}):*\n`;
              urls.slice(0, 3).forEach((u: string) => { txt += `• ${u}\n`; });
            }
            txt += `\n_Vui lòng xem xét và phê duyệt hoặc từ chối:_`;

            for (const admin of admins) {
              if (admin.telegramChatId) {
                await sendMessage(Number(admin.telegramChatId), txt, {
                  inline_keyboard: [[
                    { text: '✅ APPROVE — Xác nhận Done', callback_data: `review_approve:${issue.id}` },
                    { text: '❌ REJECT — Làm lại', callback_data: `review_reject:${issue.id}` }
                  ]]
                });
              }
            }
            console.log(`[NATS Review] Đã notify ${admins.length} admin về task ${shortId} cần duyệt.`);
          } catch (e) {
            console.error('[NATS] Error processing submitted_for_review', e);
          }
        }
      }
    });

    // ─── REVIEW APPROVED: Admin duyệt → Notify assignee ─────────────────────
    nc.subscribe('core.team.task.review_approved', {
      callback: async (err, msg) => {
        if (!err) {
          try {
            const data = JSON.parse(msg.data.toString());
            const issue = data.issue;
            const assignee = data.assignee;
            const reviewer = data.reviewer;

            if (assignee?.telegramChatId) {
              const projIdent = issue.Project?.identifier || '';
              const shortId = projIdent && issue.sequenceId ? `${projIdent}-${issue.sequenceId}` : issue.id?.substring(0, 8);
              const txt = `✅ *TASK ĐÃ ĐƯỢC DUYỆT!*\n\n` +
                `📋 *${shortId}*: ${issue.title}\n` +
                `👔 Duyệt bởi: *${reviewer?.fullName || 'Admin'}*\n\n` +
                `🎉 Chúc mừng! Task của bạn đã được xác nhận *Done*.\n` +
                `Cảm ơn bạn đã hoàn thành xuất sắc công việc! 🌟`;
              await sendMessage(Number(assignee.telegramChatId), txt);
            }
          } catch (e) {
            console.error('[NATS] Error processing review_approved', e);
          }
        }
      }
    });

    // ─── REVIEW REJECTED: Admin từ chối → Notify assignee ───────────────────
    nc.subscribe('core.team.task.review_rejected', {
      callback: async (err, msg) => {
        if (!err) {
          try {
            const data = JSON.parse(msg.data.toString());
            const issue = data.issue;
            const assignee = data.assignee;
            const reviewer = data.reviewer;
            const reviewNote = data.reviewNote;

            if (assignee?.telegramChatId) {
              const projIdent = issue.Project?.identifier || '';
              const shortId = projIdent && issue.sequenceId ? `${projIdent}-${issue.sequenceId}` : issue.id?.substring(0, 8);
              let txt = `❌ *OUTPUT BỊ TỪ CHỐI — Cần làm lại*\n\n` +
                `📋 *${shortId}*: ${issue.title}\n` +
                `👔 Xem xét bởi: *${reviewer?.fullName || 'Admin'}*\n\n`;
              if (reviewNote) {
                txt += `💬 *Lý do:* ${reviewNote}\n\n`;
              }
              txt += `⚡ Vui lòng xem lại, hoàn thiện và nộp lại output khi sẵn sàng.`;
              await sendMessage(Number(assignee.telegramChatId), txt);
            }
          } catch (e) {
            console.error('[NATS] Error processing review_rejected', e);
          }
        }
      }
    });
    // ─── ACCOUNT LIFECYCLE: đăng ký pending → notify admins ─────────────────
    nc.subscribe('core.team.account.registered', {
      callback: async (err, msg) => {
        if (err) return;
        try {
          const data = JSON.parse(msg.data.toString());
          const member = data.member;
          if (!member || member.accountStatus !== 'pending') return;
          const members = await getCachedMembers();
          const admins = members.filter((m: any) => isTeamAdminMember(m) && m.telegramChatId);
          const txt =
            `🆕 *ĐĂNG KÝ TÀI KHOẢN NỘI BỘ*\n\n` +
            `👤 *${member.fullName}*\n` +
            `📧 ${member.email}\n` +
            `📱 Telegram: @${member.telegramUsername || '—'}\n\n` +
            `Trạng thái: *pending* — duyệt trên StorymeeTeam → HR → Hồ sơ.`;
          for (const admin of admins) {
            await sendMessage(Number(admin.telegramChatId), txt, {
              inline_keyboard: [[
                { text: '✅ Duyệt account', callback_data: `account_approve:${member.id}` },
                { text: '❌ Từ chối', callback_data: `account_reject:${member.id}` },
              ]],
            });
          }
        } catch (e) {
          console.error('[NATS] account.registered error', e);
        }
      },
    });

    nc.subscribe('core.team.account.approved', {
      callback: async (err, msg) => {
        if (err) return;
        try {
          const data = JSON.parse(msg.data.toString());
          const member = data.member;
          if (member?.telegramChatId) {
            await sendMessage(
              Number(member.telegramChatId),
              `✅ *TÀI KHOẢN ĐÃ ĐƯỢC DUYỆT*\n\nXin chào *${member.fullName}*!\nBạn có thể đăng nhập StorymeeTeam và dùng đầy đủ bot.`
            );
          }
        } catch (e) {
          console.error('[NATS] account.approved error', e);
        }
      },
    });

    nc.subscribe('core.team.account.rejected', {
      callback: async (err, msg) => {
        if (err) return;
        try {
          const data = JSON.parse(msg.data.toString());
          const member = data.member;
          if (member?.telegramChatId) {
            await sendMessage(
              Number(member.telegramChatId),
              `❌ *ĐĂNG KÝ BỊ TỪ CHỐI*\n\nTài khoản *${member.fullName}* không được duyệt.\n${member.accountNote ? `Lý do: ${member.accountNote}` : 'Liên hệ Admin nếu cần hỗ trợ.'}`
            );
          }
        } catch (e) {
          console.error('[NATS] account.rejected error', e);
        }
      },
    });
  } catch (err: any) {
    console.error("[NATS] Failed to initialize NATS subscribers:", err.message);
  }

  // Khởi chạy Telegram Bot Webhook
  try {
    await startTelegramPolling();
    console.error("Telegram Webhook/Polling started successfully.");
  } catch (err: any) {
    console.error("Failed to start Telegram Bot:", err.message);
  }

  // Khởi chạy Cron Jobs (báo cáo tự động)
  try {
    startCronJobs(apiClient, sendMessage);
  } catch (err: any) {
    console.error("Failed to start Cron Jobs:", err.message);
  }
}

main().catch((error) => {
  console.error("Lỗi khởi chạy server:", error);
  process.exit(1);
});
