"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeamMembersCache = getTeamMembersCache;
exports.executeMcpTool = executeMcpTool;
var index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
var stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
var types_js_1 = require("@modelcontextprotocol/sdk/types.js");
var dotenv = require("dotenv");
var api_client_1 = require("@storymee/api-client");
var nats_1 = require("nats");
dotenv.config();
var telegram_agent_1 = require("./telegram_agent");
var CORE_API_URL = process.env.CORE_API_URL || "http://localhost:5100/internal/v1/team";
var apiClient = new api_client_1.CoreApiClient({ baseURL: CORE_API_URL, enforceApiPrefix: false });
var cachedMembers = null;
var lastCacheTime = 0;
function getTeamMembersCache() {
    return __awaiter(this, void 0, void 0, function () {
        var data, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (cachedMembers && Date.now() - lastCacheTime < 60000) {
                        return [2 /*return*/, cachedMembers];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, apiClient.get(api_client_1.API_ROUTES.HR.TEAM_MEMBERS)];
                case 2:
                    data = (_a.sent());
                    cachedMembers = data.data || [];
                    lastCacheTime = Date.now();
                    return [2 /*return*/, cachedMembers];
                case 3:
                    err_1 = _a.sent();
                    console.error("[MCP Error] 32603 - Core API connect failed:", err_1.message);
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Kh\u00F4ng th\u1EC3 k\u1EBFt n\u1ED1i \u0111\u1EBFn Core API Service (32603): ".concat(err_1.message));
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Trợ giúp phân quyền & xác thực
function authorizeClient() {
    return __awaiter(this, void 0, void 0, function () {
        var email, members, user, isBoss;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    email = process.env.STORYMEE_USER_EMAIL;
                    if (!email) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "LỖI BẢO MẬT: Chưa cấu hình biến môi trường STORYMEE_USER_EMAIL trong file settings MCP.");
                    }
                    return [4 /*yield*/, getTeamMembersCache()];
                case 1:
                    members = _a.sent();
                    user = members.find(function (m) { return m.email.toLowerCase() === email.toLowerCase(); });
                    if (!user) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "L\u1ED6I B\u1EA2O M\u1EACT: Kh\u00F4ng t\u00ECm th\u1EA5y nh\u00E2n s\u1EF1 c\u00F3 email ".concat(email, " trong h\u1EC7 th\u1ED1ng."));
                    }
                    isBoss = ["kimngan151091@gmail.com", "lehuyducanh.vn@gmail.com", "zuzzivn@gmail.com"].includes(email.toLowerCase());
                    return [2 /*return*/, { user: user, isBoss: isBoss, members: members }];
            }
        });
    });
}
// Khởi tạo MCP Server
var server = new index_js_1.Server({
    name: "storymeeteam-mcp",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Định nghĩa danh sách các công cụ
server.setRequestHandler(types_js_1.ListToolsRequestSchema, function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, {
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
            }];
    });
}); });
// Xử lý thực thi công cụ
server.setRequestHandler(types_js_1.CallToolRequestSchema, function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, name, args, user;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = request.params, name = _a.name, args = _a.arguments;
                return [4 /*yield*/, authorizeClient()];
            case 1:
                user = (_b.sent()).user;
                return [2 /*return*/, executeMcpTool(name, args, user)];
        }
    });
}); });
function executeMcpTool(name, args, user) {
    return __awaiter(this, void 0, void 0, function () {
        var isBoss, members;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    isBoss = ["kimngan151091@gmail.com", "lehuyducanh.vn@gmail.com", "zuzzivn@gmail.com"].includes(user.email.toLowerCase());
                    return [4 /*yield*/, getTeamMembersCache()];
                case 1:
                    members = _a.sent();
                    if (!['get_my_tasks', 'create_task', 'update_task', 'update_task_status', 'assign_task', 'breakdown_task', 'update_subtasks', 'request_task_approval', 'approve_task_request', 'get_task_details'].includes(name)) return [3 /*break*/, 3];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('./mcp/tools/taskTools'); })];
                case 2: return [2 /*return*/, (_a.sent()).executeTaskTool(name, args, user, isBoss, apiClient, members)];
                case 3:
                    if (!['submit_leave_request', 'get_leave_allowance', 'get_my_payroll_slip', 'update_personal_info', 'upsert_team_member'].includes(name)) return [3 /*break*/, 5];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('./mcp/tools/hrTools'); })];
                case 4: return [2 /*return*/, (_a.sent()).executeHrTool(name, args, user, isBoss, apiClient, members)];
                case 5:
                    if (!['check_in_out', 'get_attendance_report'].includes(name)) return [3 /*break*/, 7];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('./mcp/tools/attendanceTools'); })];
                case 6: return [2 /*return*/, (_a.sent()).executeAttendanceTool(name, args, user, isBoss, apiClient, members)];
                case 7: throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, "Unknown tool: ".concat(name));
            }
        });
    });
}
// Chạy server StdIO
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var transport, natsUrl, nc, js, kv_1, sendHeartbeat, err_2, err_3;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    transport = new stdio_js_1.StdioServerTransport();
                    return [4 /*yield*/, server.connect(transport)];
                case 1:
                    _a.sent();
                    console.error("StorymeeTeam MCP Server đã khởi chạy và kết nối qua StdIO!");
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, , 7]);
                    natsUrl = process.env.NATS_URL || "nats://localhost:4222";
                    return [4 /*yield*/, (0, nats_1.connect)({ servers: natsUrl, maxReconnectAttempts: -1 })];
                case 3:
                    nc = _a.sent();
                    js = nc.jetstream();
                    return [4 /*yield*/, js.views.kv("system_radar", { history: 1 })];
                case 4:
                    kv_1 = _a.sent();
                    sendHeartbeat = function () { return __awaiter(_this, void 0, void 0, function () {
                        var payload, err_4;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    payload = JSON.stringify({
                                        status: "online",
                                        lastSeen: Date.now(),
                                        type: "mcp",
                                        name: "storymeeteam-mcp"
                                    });
                                    return [4 /*yield*/, kv_1.put("storymeeteam-mcp", new TextEncoder().encode(payload))];
                                case 1:
                                    _a.sent();
                                    return [3 /*break*/, 3];
                                case 2:
                                    err_4 = _a.sent();
                                    console.error("[NATS] Heartbeat error:", err_4.message);
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, sendHeartbeat()];
                case 5:
                    _a.sent();
                    setInterval(sendHeartbeat, 10000);
                    console.error("[NATS] Heartbeat initialized for storymeeteam-mcp");
                    return [3 /*break*/, 7];
                case 6:
                    err_2 = _a.sent();
                    console.error("[NATS] Failed to initialize NATS heartbeat:", err_2.message);
                    return [3 /*break*/, 7];
                case 7:
                    _a.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, (0, telegram_agent_1.startTelegramPolling)()];
                case 8:
                    _a.sent();
                    console.error("Telegram Webhook/Polling started successfully.");
                    return [3 /*break*/, 10];
                case 9:
                    err_3 = _a.sent();
                    console.error("Failed to start Telegram Bot:", err_3.message);
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error("Lỗi khởi chạy server:", error);
    process.exit(1);
});
