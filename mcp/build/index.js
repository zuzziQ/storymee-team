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
const dotenv = __importStar(require("dotenv"));
const api_client_1 = require("@storymee/api-client");
const nats_1 = require("nats");
dotenv.config();
const telegram_agent_1 = require("./telegram_agent");
const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:5100";
let apiClient = new api_client_1.CoreApiClient({ baseURL: CORE_API_URL, enforceApiPrefix: false });
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
// Định nghĩa danh sách các công cụ
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_my_tasks",
                description: "Truy vấn danh sách công việc (tasks) trên bảng Kanban. Nhân viên chỉ xem được task của mình. Admin/Boss xem được của tất cả.",
                inputSchema: {
                    type: "object",
                    properties: {
                        employee_name: { type: "string", description: "Tên nhân sự cần lọc (Ví dụ: Trung Dũng, Quang Minh). Để trống nếu tự xem của mình." }
                    }
                }
            },
            {
                name: "create_task",
                description: "Tạo một task mới trên Kanban. Yêu cầu tiêu đề và người gán. Có thể truyền thêm ước tính giờ công hoặc deadline. Nếu không truyền ước tính, hệ thống sẽ tự tính toán dựa trên deadline.",
                inputSchema: {
                    type: "object",
                    properties: {
                        title: { type: "string", description: "Tiêu đề công việc" },
                        assignee: { type: "string", description: "Tên nhân sự thực hiện (ví dụ: Trung Dũng, Quang Minh)" },
                        estimate: { type: "number", description: "Thời gian ước lượng (giờ). Để trống để tự tính." },
                        priority: { type: "string", enum: ["Low", "Medium", "High"], description: "Độ ưu tiên (mặc định Medium)" },
                        deadline: { type: "string", description: "Hạn chót hoàn thành định dạng YYYY-MM-DD hoặc ISO string (ví dụ: 2026-06-30T12:00:00). Để trống nếu không có." }
                    },
                    required: ["title", "assignee"]
                }
            },
            {
                name: "update_task_status",
                description: "Cập nhật trạng thái Kanban của task (Todo, In Progress, Done). Nhân sự chỉ được sửa task được gán cho chính mình. Admin/Boss sửa được tất cả.",
                inputSchema: {
                    type: "object",
                    properties: {
                        task_id: { type: "string", description: "Mã ID công việc (ví dụ: T-103)" },
                        status: { type: "string", enum: ["Todo", "In Progress", "Done"], description: "Trạng thái mới" }
                    },
                    required: ["task_id", "status"]
                }
            },
            {
                name: "assign_task",
                description: "Bàn giao/giao lại công việc cho nhân sự khác. Nhân viên chỉ bàn giao được task của chính mình. Admin/Boss bàn giao được bất kỳ task nào.",
                inputSchema: {
                    type: "object",
                    properties: {
                        task_id: { type: "string", description: "Mã ID công việc (ví dụ: T-103)" },
                        assignee: { type: "string", description: "Tên nhân sự mới nhận công việc" }
                    },
                    required: ["task_id", "assignee"]
                }
            },
            {
                name: "submit_leave_request",
                description: "Đăng ký đơn xin nghỉ phép thường niên hoặc làm việc từ xa (remote). Bắt buộc phải có ngày nghỉ, buổi nghỉ, loại đơn và lý do.",
                inputSchema: {
                    type: "object",
                    properties: {
                        date: { type: "string", description: "Ngày xin nghỉ định dạng YYYY-MM-DD" },
                        session: { type: "string", enum: ["all", "am", "pm"], description: "Cả ngày (all), sáng (am), hoặc chiều (pm)" },
                        type: { type: "string", enum: ["leave", "remote"], description: "Nghỉ phép (leave) hoặc làm remote (remote)" },
                        reason: { type: "string", description: "Lý do xin phép cụ thể" }
                    },
                    required: ["date", "session", "type", "reason"]
                }
            },
            {
                name: "get_leave_allowance",
                description: "Xem hạn mức ngày nghỉ phép/remote còn lại của nhân sự.",
                inputSchema: {
                    type: "object",
                    properties: {
                        employee_name: { type: "string", description: "Tên nhân sự tra cứu. Để trống nếu tự xem của mình." }
                    }
                }
            },
            {
                name: "get_my_payroll_slip",
                description: "Tra cứu chi tiết phiếu lương cá nhân (Gross, Net, BHXH, Thuế TNCN). Nhân viên chỉ xem được của chính mình. Admin/Boss xem được của tất cả.",
                inputSchema: {
                    type: "object",
                    properties: {
                        employee_name: { type: "string", description: "Tên nhân sự cần xem. Để trống nếu tự xem của mình." },
                        month: { type: "string", description: "Tháng tra cứu định dạng YYYY-MM (Ví dụ: 2026-06)" }
                    },
                    required: ["month"]
                }
            },
            {
                name: "update_personal_info",
                description: "Cập nhật số tài khoản ngân hàng và tên ngân hàng nhận lương của cá nhân.",
                inputSchema: {
                    type: "object",
                    properties: {
                        bank_account: { type: "string", description: "Số tài khoản ngân hàng mới" },
                        bank_name: { type: "string", description: "Tên ngân hàng (ví dụ: Techcombank, Vietcombank)" }
                    },
                    required: ["bank_account", "bank_name"]
                }
            },
            {
                name: "update_task",
                description: "Cập nhật các thông tin của một task trên Kanban (trạng thái, người gán, ước lượng, độ ưu tiên, hạn chót).",
                inputSchema: {
                    type: "object",
                    properties: {
                        task_id: { type: "string", description: "Mã ID công việc (ví dụ: T-103)" },
                        status: { type: "string", enum: ["Todo", "In Progress", "Done"], description: "Trạng thái mới (tùy chọn)" },
                        assignee: { type: "string", description: "Tên người phụ trách mới (tùy chọn)" },
                        estimate: { type: "number", description: "Ước tính thời gian mới (giờ, tùy chọn)" },
                        priority: { type: "string", enum: ["Low", "Medium", "High"], description: "Độ ưu tiên mới (tùy chọn)" },
                        deadline: { type: "string", description: "Hạn chót mới định dạng YYYY-MM-DD hoặc ISO string (tùy chọn)" }
                    },
                    required: ["task_id"]
                }
            },
            {
                name: "get_task_details",
                description: "Truy vấn thông tin chi tiết của một công việc (task/subtask) cụ thể theo mã ID (ví dụ: T-102).",
                inputSchema: {
                    type: "object",
                    properties: {
                        task_id: { type: "string", description: "Mã ID công việc (ví dụ: T-102)" }
                    },
                    required: ["task_id"]
                }
            },
            {
                name: "upsert_team_member",
                description: "Tạo mới hoặc cập nhật thông tin chi tiết của một nhân sự (Họ tên, email, vai trò, kỹ năng, số điện thoại, ngân hàng, Telegram ID...).",
                inputSchema: {
                    type: "object",
                    properties: {
                        email: { type: "string", description: "Email của nhân viên (khóa định danh chính)" },
                        fullName: { type: "string", description: "Họ và tên đầy đủ" },
                        role: { type: "string", description: "Vai trò/Chức danh (ví dụ: Developer, Designer)" },
                        skills: { type: "array", items: { type: "string" }, description: "Danh sách kỹ năng" },
                        phone: { type: "string", description: "Số điện thoại liên hệ" },
                        telegramUsername: { type: "string", description: "Username Telegram (không chứa ký tự @)" },
                        telegramChatId: { type: "number", description: "ID Chat Telegram (số nguyên)" },
                        bankName: { type: "string", description: "Tên ngân hàng" },
                        bankAccount: { type: "string", description: "Số tài khoản ngân hàng" }
                    },
                    required: ["email", "fullName"]
                }
            },
            {
                name: "check_in_out",
                description: "Điểm danh hàng ngày: thực hiện check-in hoặc check-out cho nhân sự. Lần check đầu tiên trong ngày là check-in, lần thứ hai là check-out.",
                inputSchema: {
                    type: "object",
                    properties: {
                        status: { type: "string", enum: ["present", "late", "absent"], description: "Trạng thái đi làm (mặc định present)" },
                        notes: { type: "string", description: "Ghi chú điểm danh" },
                        employee_name: { type: "string", description: "Tên nhân sự điểm danh hộ (chỉ Admin/Boss có quyền này)" }
                    }
                }
            },
            {
                name: "breakdown_task",
                description: "Phân rã một công việc lớn (ví dụ: T-103) thành các công việc con (subtasks) nhỏ hơn bằng AI và tự động lưu vào database, gán cho cùng một nhân sự.",
                inputSchema: {
                    type: "object",
                    properties: {
                        task_id: { type: "string", description: "Mã ID công việc lớn (ví dụ: T-103, T-004)" }
                    },
                    required: ["task_id"]
                }
            },
            {
                name: "update_subtasks",
                description: "Cập nhật hoặc thay thế toàn bộ danh sách công việc con (subtasks) của một công việc lớn (ví dụ: T-103) bằng danh sách tiêu đề mới, tự động xóa các việc con cũ của task này và gán các việc con mới cho cùng một nhân sự.",
                inputSchema: {
                    type: "object",
                    properties: {
                        task_id: { type: "string", description: "Mã ID công việc lớn (ví dụ: T-103, T-004)" },
                        titles: { type: "array", items: { type: "string" }, description: "Mảng chứa danh sách các tiêu đề việc con mới" }
                    },
                    required: ["task_id", "titles"]
                }
            },
            {
                name: "request_task_approval",
                description: "Gửi yêu cầu xin duyệt liên quan đến task (ví dụ: xin dời deadline, xin xoá/lưu trữ task).",
                inputSchema: {
                    type: "object",
                    properties: {
                        task_id: { type: "string", description: "Mã ID công việc (ví dụ: T-103)" },
                        type: { type: "string", enum: ["archive", "extend"], description: "Loại yêu cầu: archive (xoá/lưu trữ) hoặc extend (dời deadline)" },
                        reason: { type: "string", description: "Lý do xin duyệt" },
                        new_deadline: { type: "string", description: "Hạn chót mới (chỉ dùng cho type extend), định dạng YYYY-MM-DD" }
                    },
                    required: ["task_id", "type", "reason"]
                }
            },
            {
                name: "approve_task_request",
                description: "Duyệt hoặc từ chối yêu cầu của nhân viên (ví dụ: đồng ý dời deadline, đồng ý lưu trữ task). CHỈ DÀNH CHO ADMIN/BOSS.",
                inputSchema: {
                    type: "object",
                    properties: {
                        task_id: { type: "string", description: "Mã ID công việc (ví dụ: T-103)" },
                        type: { type: "string", enum: ["archive", "extend"], description: "Loại yêu cầu đang duyệt" },
                        decision: { type: "string", enum: ["approve", "reject"], description: "Quyết định: duyệt hay từ chối" },
                        new_deadline: { type: "string", description: "Hạn chót mới được duyệt (dành cho type extend, nếu có)" }
                    },
                    required: ["task_id", "type", "decision"]
                }
            },
            {
                name: "get_attendance_report",
                description: "Lấy báo cáo chấm công của bản thân hoặc toàn team trong tháng. (totalHours, số ngày đi làm, số ngày đi muộn, vv)",
                inputSchema: {
                    type: "object",
                    properties: {
                        employee_name: { type: "string", description: "Tên nhân sự cần tra cứu. Để trống nếu muốn xem của toàn team hoặc cá nhân (tuỳ quyền)." },
                        month: { type: "number", description: "Tháng (1-12). Để trống là tháng hiện tại." },
                        year: { type: "number", description: "Năm (ví dụ: 2026). Để trống là năm hiện tại." }
                    }
                }
            }
        ]
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
    if (['get_my_tasks', 'create_task', 'update_task', 'update_task_status', 'assign_task', 'breakdown_task', 'update_subtasks', 'request_task_approval', 'approve_task_request', 'get_task_details'].includes(name)) {
        return (await Promise.resolve().then(() => __importStar(require('./mcp/tools/taskTools')))).executeTaskTool(name, args, user, isBoss, apiClient, members);
    }
    if (['submit_leave_request', 'get_leave_allowance', 'get_my_payroll_slip', 'update_personal_info', 'upsert_team_member'].includes(name)) {
        return (await Promise.resolve().then(() => __importStar(require('./mcp/tools/hrTools')))).executeHrTool(name, args, user, isBoss, apiClient, members);
    }
    if (['check_in_out', 'get_attendance_report'].includes(name)) {
        return (await Promise.resolve().then(() => __importStar(require('./mcp/tools/attendanceTools')))).executeAttendanceTool(name, args, user, isBoss, apiClient, members);
    }
    throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
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
    // Khởi chạy Telegram Bot Webhook
    try {
        await (0, telegram_agent_1.startTelegramPolling)();
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
