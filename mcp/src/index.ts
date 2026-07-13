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

import { PLANE_TOOLS_SCHEMA, executePlaneTool } from './mcp/tools/planeTools';
import { HR_TOOLS_SCHEMA, executeHrTool } from './mcp/tools/hrTools';
import { ATTENDANCE_TOOLS_SCHEMA, executeAttendanceTool } from './mcp/tools/attendanceTools';

dotenv.config();


import { startTelegramPolling } from './telegram_agent';
import { startCronJobs } from './cronJobs';

const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:5100";
let apiClient = new CoreApiClient({ 
    baseURL: CORE_API_URL + '/internal/v1/team', 
    enforceApiPrefix: false
});

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

  const isBoss = ["kimngan151091@gmail.com", "lehuyducanh.vn@gmail.com", "zuzzivn@gmail.com"].includes(email.toLowerCase());
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

export async function executeMcpTool(
  name: string,
  args: any,
  user: any,
  username?: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const isBoss = ["kimngan151091@gmail.com", "lehuyducanh.vn@gmail.com", "zuzzivn@gmail.com"].includes(user.email.toLowerCase());
  const members = await getTeamMembersCache();

  let toolName = name;
      const planeNames = PLANE_TOOLS_SCHEMA.map(t => t.name);
      const hrNames = HR_TOOLS_SCHEMA.map(t => t.name);
      const attendanceNames = ATTENDANCE_TOOLS_SCHEMA.map(t => t.name);

      if (planeNames.includes(name)) {
        return executePlaneTool(toolName, args, user, isBoss, apiClient, members, username);
      }
      if (hrNames.includes(name)) {
        return executeHrTool(toolName, args, user, isBoss, apiClient, members);
      }
      if (attendanceNames.includes(name)) {
        return executeAttendanceTool(toolName, args, user, isBoss, apiClient, members);
      }
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName} (original: ${name})`);

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
    nc.subscribe('core.team.leave.request', {
      callback: async (err, msg) => {
        if (!err) {
          try {
            const data = JSON.parse(msg.data.toString());
            const leave = data.leaveRequest;
            const members = await getCachedMembers();
            const admins = members.filter((m: any) => m.role === 'admin' || m.role === 'hr' || m.role === 'manager' || m.role === 'director' || m.role === 'boss');
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
              if (admin.telegramChatId) {
                await sendMessage(Number(admin.telegramChatId), txt, {
                  inline_keyboard: [[
                    { text: "✅ Duyệt nghỉ", callback_data: `approve_leave:${leave.id}` },
                    { text: "❌ Từ chối", callback_data: `reject_leave:${leave.id}` }
                  ]]
                });
              }
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
            const admins = members.filter((m: any) => m.role === 'admin' || m.role === 'hr' || m.role === 'manager' || m.role === 'director' || m.role === 'boss');
            
            let txt = `🔔 *YÊU CẦU PHÊ DUYỆT TASK* 🔔\n\n` +
                      `📌 Task: *${task.title}* (${task.planeTaskId || task.id})\n` +
                      `👤 Loại yêu cầu: ${data.type === 'archive' ? 'Lưu trữ (Archive)' : 'Gia hạn Deadline'}\n` +
                      `💬 Lý do: ${data.reason || 'Không có lý do'}\n`;
            if (data.type === 'extend') txt += `⏰ Deadline mới: ${data.newDeadline}\n`;
            txt += `\nVui lòng duyệt qua Dashboard.`;
            
            for (const admin of admins) {
              if (admin.telegramChatId) {
                await sendMessage(Number(admin.telegramChatId), txt, {
                  inline_keyboard: [[
                    { text: "✅ Duyệt", callback_data: `approve_issue_request:${task.id}:${data.type}:${data.newDeadline || ''}` },
                    { text: "❌ Từ chối", callback_data: `reject_issue_request:${task.id}:${data.type}` }
                  ]]
                });
              }
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
