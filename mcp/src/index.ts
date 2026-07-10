import { fetchAxios } from './fetchAxios';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import { connect } from "nats";

dotenv.config();


import { startTelegramPolling } from './telegram_agent';

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

// Định nghĩa danh sách các công cụ
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_my_issues",
        description: "Truy vấn danh sách công việc (issues) trên bảng Kanban chuẩn Plane. Nhân viên chỉ xem được issue của mình. Admin/Boss xem được của tất cả.",
        inputSchema: {
          type: "object",
          properties: {
            employee_name: { type: "string", description: "Tên nhân sự cần lọc. Để trống nếu tự xem của mình." },
            project_id: { type: "string", description: "Lọc theo dự án (tuỳ chọn)" }
          }
        }
      },
      {
        name: "create_project",
        description: "Tạo một Dự án (Project) lớn mới trong cấu trúc Plane.io.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Tên của dự án mới" },
            description: { type: "string", description: "Mô tả chi tiết dự án (tuỳ chọn)" }
          },
          required: ["title"]
        }
      },
      {
        name: "create_issue",
        description: "Tạo một issue mới. Yêu cầu tiêu đề và người gán. Plane structure hỗ trợ project_id, state, priority.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Tiêu đề công việc" },
            project_id: { type: "string", description: "ID của dự án (Plane Project ID)" },
            assignee: { type: "string", description: "Tên nhân sự thực hiện (ví dụ: Trung Dũng)" },
            priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"], description: "Độ ưu tiên (mặc định medium)" },
            target_date: { type: "string", description: "Hạn chót hoàn thành định dạng YYYY-MM-DD" }
          },
          required: ["title", "project_id"]
        }
      },
      {
        name: "update_issue_state",
        description: "Cập nhật trạng thái (State) của issue (Todo, In Progress, Done).",
        inputSchema: {
          type: "object",
          properties: {
            issue_id: { type: "string", description: "Mã ID công việc (ví dụ: UUID)" },
            state: { type: "string", enum: ["Todo", "In Progress", "Done"], description: "Trạng thái mới" }
          },
          required: ["issue_id", "state"]
        }
      },
      {
        name: "assign_issue",
        description: "Bàn giao công việc (issue) cho nhân sự khác.",
        inputSchema: {
          type: "object",
          properties: {
            issue_id: { type: "string", description: "Mã ID công việc" },
            assignee: { type: "string", description: "Tên nhân sự mới nhận công việc" }
          },
          required: ["issue_id", "assignee"]
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
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const { user } = await authorizeClient();
  return executeMcpTool(name, args, user);
});

export async function executeMcpTool(
  name: string,
  args: any,
  user: any
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const isBoss = ["kimngan151091@gmail.com", "lehuyducanh.vn@gmail.com", "zuzzivn@gmail.com"].includes(user.email.toLowerCase());
  const members = await getTeamMembersCache();

  // ALIAS mapping for LLM compatibility
  let toolName = name;
  if (toolName === 'create_task') toolName = 'create_issue';
  if (toolName === 'update_task') toolName = 'update_issue';
  if (toolName === 'breakdown_task') toolName = 'breakdown_issue';
  if (toolName === 'update_subtasks') toolName = 'update_sub_issues';
  if (toolName === 'request_task_approval') toolName = 'request_issue_approval';
  if (toolName === 'approve_task_request') toolName = 'approve_issue_request';
  if (toolName === 'get_task_details') toolName = 'get_issue_details';

      if (['get_my_issues', 'create_issue', 'update_issue', 'update_issue_state', 'assign_issue', 'breakdown_issue', 'update_sub_issues', 'request_issue_approval', 'approve_issue_request', 'get_issue_details'].includes(toolName)) {
        return (await import('./mcp/tools/planeTools')).executePlaneTool(toolName, args, user, isBoss, apiClient, members);
      }
      if (['submit_leave_request', 'get_leave_allowance', 'get_my_payroll_slip', 'update_personal_info', 'upsert_team_member'].includes(toolName)) {
        return (await import('./mcp/tools/hrTools')).executeHrTool(toolName, args, user, isBoss, apiClient, members);
      }
      if (['check_in_out', 'get_attendance_report'].includes(toolName)) {
        return (await import('./mcp/tools/attendanceTools')).executeAttendanceTool(toolName, args, user, isBoss, apiClient, members);
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

  // Khởi chạy Telegram Bot Webhook
  try {
    await startTelegramPolling();
    console.error("Telegram Webhook/Polling started successfully.");
  } catch (err: any) {
    console.error("Failed to start Telegram Bot:", err.message);
  }
}

main().catch((error) => {
  console.error("Lỗi khởi chạy server:", error);
  process.exit(1);
});
