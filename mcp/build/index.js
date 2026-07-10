"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeamMembersCache = getTeamMembersCache;
exports.executeMcpTool = executeMcpTool;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const telegram_agent_1 = require("./telegram_agent");
const dotenv = __importStar(require("dotenv"));
const api_client_1 = require("@storymee/api-client");
const nats_1 = require("nats");
const planeTools_1 = require("./mcp/tools/planeTools");
const hrTools_1 = require("./mcp/tools/hrTools");
const attendanceTools_1 = require("./mcp/tools/attendanceTools");
dotenv.config();
const telegram_agent_2 = require("./telegram_agent");
const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:5100";
let apiClient = new api_client_1.CoreApiClient({
    baseURL: CORE_API_URL + '/internal/v1/team',
    enforceApiPrefix: false
});
let cachedMembers = null;
let lastCacheTime = 0;
async function getTeamMembersCache() {
    if (cachedMembers && Date.now() - lastCacheTime < 60000) {
        return cachedMembers;
    }
    try {
        const data = (await apiClient.get(api_client_1.API_ROUTES.HR.TEAM_MEMBERS));
        cachedMembers = data.data || [];
        lastCacheTime = Date.now();
        return cachedMembers;
    }
    catch (err) {
        console.error("[MCP Error] 32603 - Core API connect failed:", err.message);
        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Không thể kết nối đến Core API Service (32603): ${err.message}`);
    }
}
// Trợ giúp phân quyền & xác thực
async function authorizeClient() {
    const email = process.env.STORYMEE_USER_EMAIL;
    if (!email) {
        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "LỖI BẢO MẬT: Chưa cấu hình biến môi trường STORYMEE_USER_EMAIL trong file settings MCP.");
    }
    const members = await getTeamMembersCache();
    const user = members.find((m) => m.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `LỖI BẢO MẬT: Không tìm thấy nhân sự có email ${email} trong hệ thống.`);
    }
    const isBoss = ["kimngan151091@gmail.com", "lehuyducanh.vn@gmail.com", "zuzzivn@gmail.com"].includes(email.toLowerCase());
    return { user, isBoss, members };
}
// Khởi tạo MCP Server
const server = new index_js_1.Server({
    name: "storymeeteam-mcp",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Định nghĩa danh sách các công cụ bằng Dynamic AST Loading
const allTools = [
    ...planeTools_1.PLANE_TOOLS_SCHEMA,
    ...hrTools_1.HR_TOOLS_SCHEMA,
    ...attendanceTools_1.ATTENDANCE_TOOLS_SCHEMA
];
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return {
        tools: allTools
    };
});
// Xử lý thực thi công cụ
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const { user } = await authorizeClient();
    return executeMcpTool(name, args, user);
});
async function executeMcpTool(name, args, user) {
    const isBoss = ["kimngan151091@gmail.com", "lehuyducanh.vn@gmail.com", "zuzzivn@gmail.com"].includes(user.email.toLowerCase());
    const members = await getTeamMembersCache();
    let toolName = name;
    const planeNames = planeTools_1.PLANE_TOOLS_SCHEMA.map(t => t.name);
    const hrNames = hrTools_1.HR_TOOLS_SCHEMA.map(t => t.name);
    const attendanceNames = attendanceTools_1.ATTENDANCE_TOOLS_SCHEMA.map(t => t.name);
    if (planeNames.includes(name)) {
        return (0, planeTools_1.executePlaneTool)(toolName, args, user, isBoss, apiClient, members);
    }
    if (hrNames.includes(name)) {
        return (0, hrTools_1.executeHrTool)(toolName, args, user, isBoss, apiClient, members);
    }
    if (attendanceNames.includes(name)) {
        return (0, attendanceTools_1.executeAttendanceTool)(toolName, args, user, isBoss, apiClient, members);
    }
    throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${toolName} (original: ${name})`);
}
// Chạy server StdIO
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("StorymeeTeam MCP Server đã khởi chạy và kết nối qua StdIO!");
    // 💓 NATS JetStream Heartbeat
    try {
        const natsUrl = process.env.NATS_URL || "nats://localhost:4222";
        const nc = await (0, nats_1.connect)({ servers: natsUrl, maxReconnectAttempts: -1 });
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
            }
            catch (err) {
                console.error("[NATS] Heartbeat error:", err.message);
            }
        };
        await sendHeartbeat();
        setInterval(sendHeartbeat, 10000);
        console.error("[NATS] Heartbeat initialized for storymeeteam-mcp");
    }
    catch (err) {
        console.error("[NATS] Failed to initialize NATS heartbeat:", err.message);
    }
    // Subscribe to Notifications
    try {
        const nc = await (0, nats_1.connect)({ servers: process.env.NATS_URL || "nats://localhost:4222" });
        nc.subscribe('core.team.leave.request', {
            callback: async (err, msg) => {
                if (!err) {
                    try {
                        const data = JSON.parse(msg.data.toString());
                        const leave = data.leaveRequest;
                        const members = await (0, telegram_agent_1.getCachedMembers)();
                        const admins = members.filter((m) => m.role === 'admin' || m.role === 'hr' || m.role === 'manager' || m.role === 'director' || m.role === 'boss');
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
                                await (0, telegram_agent_1.sendMessage)(Number(admin.telegramChatId), txt, {
                                    inline_keyboard: [[
                                            { text: "✅ Duyệt nghỉ", callback_data: `approve_leave:${leave.id}` },
                                            { text: "❌ Từ chối", callback_data: `reject_leave:${leave.id}` }
                                        ]]
                                });
                            }
                        }
                    }
                    catch (e) {
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
                            await (0, telegram_agent_1.sendMessage)(Number(leave.member.telegramChatId), txt);
                        }
                    }
                    catch (e) {
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
                        const members = await (0, telegram_agent_1.getCachedMembers)();
                        const admins = members.filter((m) => m.role === 'admin' || m.role === 'hr' || m.role === 'manager' || m.role === 'director' || m.role === 'boss');
                        let txt = `🔔 *YÊU CẦU PHÊ DUYỆT TASK* 🔔\n\n` +
                            `📌 Task: *${task.title}* (${task.planeTaskId || task.id})\n` +
                            `👤 Loại yêu cầu: ${data.type === 'archive' ? 'Lưu trữ (Archive)' : 'Gia hạn Deadline'}\n` +
                            `💬 Lý do: ${data.reason || 'Không có lý do'}\n`;
                        if (data.type === 'extend')
                            txt += `⏰ Deadline mới: ${data.newDeadline}\n`;
                        txt += `\nVui lòng duyệt qua Dashboard.`;
                        for (const admin of admins) {
                            if (admin.telegramChatId) {
                                await (0, telegram_agent_1.sendMessage)(Number(admin.telegramChatId), txt, {
                                    inline_keyboard: [[
                                            { text: "✅ Duyệt", callback_data: `approve_issue_request:${task.id}:${data.type}:${data.newDeadline || ''}` },
                                            { text: "❌ Từ chối", callback_data: `reject_issue_request:${task.id}:${data.type}` }
                                        ]]
                                });
                            }
                        }
                    }
                    catch (e) {
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
                        const members = await (0, telegram_agent_1.getCachedMembers)();
                        const assignee = members.find((m) => m.id === data.task.assigneeId);
                        if (assignee && assignee.telegramChatId) {
                            await (0, telegram_agent_1.sendMessage)(Number(assignee.telegramChatId), `✅ *YÊU CẦU ĐƯỢC PHÊ DUYỆT*\n\nAdmin đã duyệt yêu cầu cho Task: *${data.task.title}*`);
                        }
                    }
                    catch (e) { }
                }
            }
        });
        nc.subscribe('core.team.task.rejected', {
            callback: async (err, msg) => {
                if (!err) {
                    try {
                        const data = JSON.parse(msg.data.toString());
                        const members = await (0, telegram_agent_1.getCachedMembers)();
                        const assignee = members.find((m) => m.id === data.task.assigneeId);
                        if (assignee && assignee.telegramChatId) {
                            await (0, telegram_agent_1.sendMessage)(Number(assignee.telegramChatId), `❌ *YÊU CẦU BỊ TỪ CHỐI*\n\nAdmin đã từ chối yêu cầu cho Task: *${data.task.title}*`);
                        }
                    }
                    catch (e) { }
                }
            }
        });
    }
    catch (err) {
        console.error("[NATS] Failed to initialize NATS subscribers:", err.message);
    }
    // Khởi chạy Telegram Bot Webhook
    try {
        await (0, telegram_agent_2.startTelegramPolling)();
        console.error("Telegram Webhook/Polling started successfully.");
    }
    catch (err) {
        console.error("Failed to start Telegram Bot:", err.message);
    }
}
main().catch((error) => {
    console.error("Lỗi khởi chạy server:", error);
    process.exit(1);
});
