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

const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:4500";
let apiClient = new CoreApiClient({ baseURL: CORE_API_URL });

// Trợ giúp phân quyền & xác thực
async function authorizeClient() {
  const email = process.env.STORYMEE_USER_EMAIL;
  if (!email) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "LỖI BẢO MẬT: Chưa cấu hình biến môi trường STORYMEE_USER_EMAIL trong file settings MCP."
    );
  }

  let data;
    try {
      data = (await apiClient.get(API_ROUTES.HR.TEAM_MEMBERS)) as any;
    } catch (err: any) {
      throw new McpError(ErrorCode.InternalError, "Không thể kết nối đến Core API Service.");
    }
  const members = data.data || [];
  
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

  let data;
    try {
      data = (await apiClient.get(API_ROUTES.HR.TEAM_MEMBERS)) as any;
    } catch (err: any) {
      throw new McpError(ErrorCode.InternalError, "Không thể kết nối đến Core API Service để lấy danh sách thành viên.");
    }
  const members = data.data || [];

  switch (name) {
    case "get_my_tasks": {
      const targetName = args?.employee_name || user.fullName;
      
      if (!isBoss && targetName.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không có quyền xem danh sách công việc của nhân sự ${targetName}.`
        );
      }

      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.OMNITASK.ROOT)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
          }
      const dbTasks = tasksData.data || [];
      
      const mySubTasks: any[] = [];
      dbTasks.forEach((t: any) => {
        if (Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            const assigneeName = sub.Assignee ? sub.Assignee.fullName : "";
            if (assigneeName.toLowerCase() === targetName.toLowerCase()) {
              mySubTasks.push(sub);
            }
          });
        }
      });

      let outputText = `Danh sách task của ${targetName}:\n\n`;
      const groupedTasks: Record<string, { parent: any, children: any[] }> = {};

      mySubTasks.forEach(t => {
        const pId = t.planeTaskId || t.id;
        const parts = pId.split('-');
        const rootId = (parts.length >= 2 && parts[0] === 'T') ? `${parts[0]}-${parts[1]}` : pId;

        if (!groupedTasks[rootId]) {
          groupedTasks[rootId] = { parent: null, children: [] };
        }

        if (pId === rootId) {
          groupedTasks[rootId].parent = t;
        } else {
          t.cleanTitle = t.title.replace(/^\[T-\d+\]\s*/, '');
          groupedTasks[rootId].children.push(t);
        }
      });

      Object.keys(groupedTasks).forEach(rootId => {
        const group = groupedTasks[rootId];
        if (group.parent) {
          const pt = group.parent;
          const statusStr = pt.status === 'pending' ? 'Todo' : (pt.status === 'in_progress' || pt.status === 'working') ? 'In Progress' : pt.status === 'done' ? 'Done' : pt.status;
          const dlStr = pt.deadline ? pt.deadline.split('T')[0] : 'None';
          outputText += `🎯 *${pt.planeTaskId || pt.id}*: ${pt.title}  |  \`${statusStr}\`  📅 ${dlStr}\n`;
        } else {
          outputText += `🎯 *[${rootId}]* (Task cha do người khác quản lý)\n`;
        }

        group.children.forEach(ct => {
          const statusStr = ct.status === 'pending' ? 'Todo' : (ct.status === 'in_progress' || ct.status === 'working') ? 'In Progress' : ct.status === 'done' ? 'Done' : ct.status;
          const dlStr = ct.deadline ? ct.deadline.split('T')[0] : 'None';
          outputText += `   ↳ *${ct.planeTaskId || ct.id}*: ${ct.cleanTitle}  |  \`${statusStr}\`  📅 ${dlStr}\n`;
        });
        outputText += `\n`;
      });

      return {
        content: [{
          type: "text",
          text: mySubTasks.length > 0 ? outputText.trim() : `Nhân sự ${targetName} hiện không có công việc nào đang mở.`
        }]
      };
    }

    case "create_task": {
      const { title, assignee, estimate, priority, deadline } = args as any;
      
      if (!isBoss && assignee.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "TỪ CHỐI TRUY CẬP: Bạn không có quyền tạo task và gán cho nhân sự khác."
        );
      }

      const targetUser = members.find((m: any) => m.fullName.toLowerCase() === assignee.toLowerCase());
      if (!targetUser) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy nhân sự ${assignee} trong hệ thống.`);
      }

      // Tính deadlineDays nếu có truyền deadline
      let deadlineDays = 7; // Mặc định 7 ngày
      if (deadline) {
        const dDate = new Date(deadline);
        const now = new Date();
        const diffTime = dDate.getTime() - now.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        deadlineDays = diffDays >= 0 ? diffDays : 0;
      }

      let resJson;
          try {
            resJson = (await apiClient.post(API_ROUTES.OMNITASK.ROOT, JSON.stringify({
                    title,
                    description: "Tạo tự động qua Model Context Protocol (MCP)",
                    subtasks: [
                      {
                        title,
                        description: "Tạo tự động qua Model Context Protocol (MCP)",
                        suggestedAssigneeName: targetUser.fullName,
                        priority: priority ? priority.toLowerCase() : "medium",
                        estimatedHours: estimate || undefined, // undefined để Core API tự động tính working hours
                        deadlineDays: deadlineDays
                      }
                    ]
                  }))) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi tạo task tại Core API Service.");
          }
      const subtask = resJson.data?.subtasks?.[0];
      const newId = subtask?.planeTaskId || subtask?.id || "N/A";
      const actualEstimate = subtask?.estimatedHours || estimate || 4;

      return {
        content: [{
          type: "text",
          text: `Đã tạo công việc thành công! ✓\n• **ID**: ${newId}\n• **Tiêu đề**: ${title}\n• **Người thực hiện**: ${targetUser.fullName}\n• **Ước tính**: ${actualEstimate}h\n• **Hạn chót**: ${deadline ? deadline.split('T')[0] : '7 ngày'}`
        }]
      };
    }

    case "update_task_status": {
      const { task_id, status } = args as any;

      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.OMNITASK.ROOT)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
          }
      const dbTasks = tasksData.data || [];
      
      let foundSubtask: any = null;
      dbTasks.forEach((t: any) => {
        if (Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            if (sub.id.toLowerCase() === task_id.toLowerCase() || (sub.planeTaskId && sub.planeTaskId.toLowerCase() === task_id.toLowerCase())) {
              foundSubtask = sub;
            }
          });
        }
      });

      if (!foundSubtask) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy công việc mã ID ${task_id}.`);
      }

      const assigneeName = foundSubtask.Assignee ? foundSubtask.Assignee.fullName : "";
      if (!isBoss && assigneeName.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không có quyền cập nhật trạng thái của task ${task_id} do người khác nắm giữ.`
        );
      }

      const apiStatus = status === 'Todo' ? 'pending' : status === 'In Progress' ? 'working' : 'done';

      try {
            await apiClient.patch(`${API_ROUTES.HR.SUBTASKS}/${foundSubtask.id}`, JSON.stringify({ status: apiStatus }));
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi cập nhật trạng thái task tại Core API.");
          }
      return {
        content: [{
          type: "text",
          text: `Cập nhật trạng thái thành công! ✓\n• **Task**: ${task_id} (${foundSubtask.title})\n• **Trạng thái**: ${foundSubtask.status} ➔ ${status}`
        }]
      };
    }

    case "assign_task": {
      const { task_id, assignee } = args as any;

      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.OMNITASK.ROOT)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
          }
      const dbTasks = tasksData.data || [];
      
      let foundSubtask: any = null;
      dbTasks.forEach((t: any) => {
        if (Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            if (sub.id.toLowerCase() === task_id.toLowerCase() || (sub.planeTaskId && sub.planeTaskId.toLowerCase() === task_id.toLowerCase())) {
              foundSubtask = sub;
            }
          });
        }
      });

      if (!foundSubtask) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy công việc mã ID ${task_id}.`);
      }

      const assigneeName = foundSubtask.Assignee ? foundSubtask.Assignee.fullName : "";
      if (!isBoss && assigneeName.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không được phép bàn giao công việc ${task_id} của người khác.`
        );
      }

      const targetUser = members.find((m: any) => m.fullName.toLowerCase() === assignee.toLowerCase());
      if (!targetUser) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy nhân sự ${assignee} để bàn giao.`);
      }

      try {
            await apiClient.patch(`${API_ROUTES.HR.SUBTASKS}/${foundSubtask.id}`, JSON.stringify({ assigneeId: targetUser.id }));
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi bàn giao công việc tại Core API.");
          }
      return {
        content: [{
          type: "text",
          text: `Bàn giao công việc thành công! ✓\n• **Task**: ${task_id} (${foundSubtask.title})\n• **Người phụ trách**: ${assigneeName || 'Chưa có'} ➔ ${targetUser.fullName}`
        }]
      };
    }

    case "submit_leave_request": {
      const { date, session, type, reason, startDate, endDate, leaveType } = args as any;

      const employeeName = user.fullName;
      const sessionText = session === "all" ? "Cả ngày" : session === "am" ? "Buổi sáng" : "Buổi chiều";
      
      const finalStartDate = date ? date + "T00:00:00.000Z" : (startDate ? startDate + "T00:00:00.000Z" : null);
      const finalEndDate = date ? date + "T23:59:59.000Z" : (endDate ? endDate + "T23:59:59.000Z" : null);
      const finalLeaveType = leaveType || (type === "leave" ? "annual" : "remote");

      if (!finalStartDate || !finalEndDate) {
        throw new McpError(ErrorCode.InvalidParams, "Thiếu thông tin ngày xin nghỉ.");
      }

      let resJson;
          try {
            resJson = (await apiClient.post(API_ROUTES.HR.LEAVE_REQUESTS, JSON.stringify({
                    telegramUsername: user.telegramUsername || user.fullName,
                    leaveType: finalLeaveType,
                    startDate: finalStartDate,
                    endDate: finalEndDate,
                    reason: reason || "Xin nghỉ phép qua Bot Telegram"
                  }))) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi tạo đơn xin nghỉ phép tại Core API.");
          }
      const statusStr = resJson.data?.status === 'approved' ? 'Approved' : 'Pending';
      const requestId = resJson.data?.id;

      const leaveTypeStr = finalLeaveType === 'sick' ? 'Nghỉ ốm' : finalLeaveType === 'annual' ? 'Nghỉ phép năm' : finalLeaveType === 'remote' ? 'Đăng ký Remote' : 'Việc riêng';

      return {
        content: [{
          type: "text",
          text: `Nộp đơn đăng ký thành công! ✓\n• **Họ tên**: ${employeeName}\n• **Loại đơn**: ${leaveTypeStr} (${sessionText})\n• **Thời gian**: ${finalStartDate.split('T')[0]} đến ${finalEndDate.split('T')[0]}\n• **Lý do**: ${reason || 'Không có'}\n• **Trạng thái**: ${statusStr}`
        }],
        requestId: requestId
      } as any;
    }

    case "get_leave_allowance": {
      const targetName = args?.employee_name || user.fullName;

      if (!isBoss && targetName.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không có quyền tra cứu hạn ngạch nghỉ phép của nhân sự ${targetName}.`
        );
      }

      const targetUser = members.find((m: any) => m.fullName.toLowerCase() === targetName.toLowerCase());
      if (!targetUser) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy nhân sự ${targetName}.`);
      }

      const leavesRes = await apiClient.get("/omnitask/hr/leave-requests");
      let annualUsed = 0;
      let remoteUsed = 0;

      if (leavesRes.ok) {
        const leavesData = await leavesRes.json() as any;
        const leaves = leavesData.data || [];
        
        leaves.forEach((l: any) => {
          if (l.memberId === targetUser.id && l.status === 'approved') {
            const start = new Date(l.startDate);
            const end = new Date(l.endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
            
            if (l.leaveType === 'remote') {
              remoteUsed += diffDays;
            } else {
              annualUsed += diffDays;
            }
          }
        });
      }

      return {
        content: [{
          type: "text",
          text: `Hạn ngạch phép năm & làm remote của **${targetUser.fullName}**:\n` +
            `• Nghỉ phép năm: Đã dùng **${annualUsed}** / **12** ngày.\n` +
            `• Làm việc từ xa (Remote): Đã dùng **${remoteUsed}** / **4** ngày trong tháng.`
        }]
      };
    }

    case "get_my_payroll_slip": {
      const { employee_name, month } = args as any;
      const targetName = employee_name || user.fullName;

      if (!isBoss && targetName.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không được phép xem bảng lương của nhân sự ${targetName}.`
        );
      }

      const targetUser = members.find((m: any) => m.fullName.toLowerCase() === targetName.toLowerCase());
      if (!targetUser) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy nhân sự ${targetName} để tính lương.`);
      }

      const salaryMap: Record<string, { gross: number, dependent: number }> = {
        "trần thị kim ngân": { gross: 45000000, dependent: 1 },
        "lê huy đức anh": { gross: 35000000, dependent: 0 },
        "trần thanh tú": { gross: 25000000, dependent: 2 },
        "nguyễn đức trung dũng": { gross: 18000000, dependent: 0 },
        "nguyễn thảo lan": { gross: 12000000, dependent: 0 },
        "bùi hương giang": { gross: 18000000, dependent: 0 },
        "lê quang minh": { gross: 22000000, dependent: 0 },
        "trần hải dương": { gross: 16000000, dependent: 1 },
        "đậu thị linh": { gross: 15000000, dependent: 0 },
        "phạm hoàng quỳnh hương": { gross: 17000000, dependent: 0 }
      };

      const salaryInfo = salaryMap[targetUser.fullName.toLowerCase()] || { gross: 15000000, dependent: 0 };
      const gross = salaryInfo.gross;
      const dependent = salaryInfo.dependent;

      const insuranceBase = 5310000;
      const bhxh = insuranceBase * 0.08;
      const bhyt = insuranceBase * 0.015;
      const bhtn = insuranceBase * 0.01;
      const totalInsurance = bhxh + bhyt + bhtn;

      const selfDeduction = 11000000;
      const dependentDeduction = dependent * 4400000;
      const taxableIncome = Math.max(0, gross - totalInsurance - selfDeduction - dependentDeduction);

      let pit = 0;
      if (taxableIncome > 0) {
        if (taxableIncome <= 5000000) pit = taxableIncome * 0.05;
        else if (taxableIncome <= 10000000) pit = taxableIncome * 0.1 - 250000;
        else if (taxableIncome <= 18000000) pit = taxableIncome * 0.15 - 750000;
        else if (taxableIncome <= 32000000) pit = taxableIncome * 0.2 - 1650000;
        else if (taxableIncome <= 52000000) pit = taxableIncome * 0.25 - 3250000;
        else if (taxableIncome <= 80000000) pit = taxableIncome * 0.3 - 5850000;
        else pit = taxableIncome * 0.35 - 9850000;
      }

      const netSalary = gross - totalInsurance - pit;

      return {
        content: [{
          type: "text",
          text: `Phiếu lương nhân sự **${targetUser.fullName}** (Tháng ${month}):\n` +
            `• Vị trí: ${targetUser.role || 'Nhân sự'}\n` +
            `• Lương Gross: **${gross.toLocaleString("vi-VN")} VNĐ**\n` +
            `• Khấu trừ bảo hiểm (10.5% mức đóng tối thiểu 5.310.000đ): **-${totalInsurance.toLocaleString("vi-VN")} VNĐ**\n` +
            `  (BHXH: -${bhxh.toLocaleString("vi-VN")}đ, BHYT: -${bhyt.toLocaleString("vi-VN")}đ, BHTN: -${bhtn.toLocaleString("vi-VN")}đ)\n` +
            `• Thuế TNCN khấu trừ: **-${pit.toLocaleString("vi-VN")} VNĐ** (Số người phụ thuộc: ${dependent})\n` +
            `• **LƯƠNG NET THỰC NHẬN**: **${Math.round(netSalary).toLocaleString("vi-VN")} VNĐ**\n` +
            `• Tài khoản chuyển khoản: ${targetUser.bankAccount || 'Chưa cập nhật'} (${targetUser.bankName || 'Chưa cập nhật'})`
        }]
      };
    }

    case "update_personal_info": {
      const { bank_account, bank_name } = args as any;

      try {
            await apiClient.post(API_ROUTES.HR.TEAM_MEMBERS, JSON.stringify({
                    fullName: user.fullName,
                    email: user.email,
                    bankName: bank_name,
                    bankAccount: bank_account,
                    telegramUsername: user.telegramUsername,
                    telegramChatId: user.telegramChatId ? Number(user.telegramChatId) : null,
                    role: user.role,
                    skills: user.skills,
                    phone: user.phone
                  }));
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi cập nhật thông tin tại Core API.");
          }
      return {
        content: [{
          type: "text",
          text: `Cập nhật thông tin nhận lương thành công! ✓\n• **Chủ tài khoản**: ${user.fullName}\n• **Số tài khoản mới**: ${bank_account}\n• **Ngân hàng**: ${bank_name}`
        }]
      };
    }

    case "update_task": {
      const { task_id, status, assignee, estimate, priority, deadline } = args as any;

      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.OMNITASK.ROOT)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
          }
      const dbTasks = tasksData.data || [];
      
      let foundSubtask: any = null;
      dbTasks.forEach((t: any) => {
        if (Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            if (sub.id.toLowerCase() === task_id.toLowerCase() || (sub.planeTaskId && sub.planeTaskId.toLowerCase() === task_id.toLowerCase())) {
              foundSubtask = sub;
            }
          });
        }
      });

      if (!foundSubtask) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy công việc mã ID ${task_id}.`);
      }

      const assigneeName = foundSubtask.Assignee ? foundSubtask.Assignee.fullName : "";
      if (!isBoss && assigneeName.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không được phép cập nhật công việc ${task_id} của người khác.`
        );
      }

      let apiStatus = undefined;
      if (status) {
        apiStatus = (status === 'Todo' || status === 'pending') ? 'pending' : (status === 'In Progress' || status === 'in_progress' || status === 'working') ? 'in_progress' : 'done';
      }

      let assigneeId = undefined;
      if (assignee) {
        const targetMem = members.find((m: any) => m.fullName.toLowerCase().includes(assignee.toLowerCase()));
        if (targetMem) assigneeId = targetMem.id;
      }

      try {
            await apiClient.patch(`${API_ROUTES.HR.SUBTASKS}/${foundSubtask.id}`, JSON.stringify({
                    status: apiStatus,
                    assigneeId: assigneeId,
                    priority: priority ? priority.toLowerCase() : undefined,
                    deadline: deadline || undefined,
                    estimatedHours: estimate || undefined
                  }));
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi cập nhật task tại Core API.");
          }
      return {
        content: [{
          type: "text",
          text: `Cập nhật công việc ${task_id} thành công! ✓`
        }]
      };
    }

    case "get_task_details": {
      const { task_id } = args as any;

      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.OMNITASK.ROOT)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
          }
      const dbTasks = tasksData.data || [];
      
      let foundSubtask: any = null;
      let parentTask: any = null;
      dbTasks.forEach((t: any) => {
        if (Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            if (sub.id.toLowerCase() === task_id.toLowerCase() || (sub.planeTaskId && sub.planeTaskId.toLowerCase() === task_id.toLowerCase())) {
              foundSubtask = sub;
              parentTask = t;
            }
          });
        }
      });

      if (!foundSubtask) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy công việc mã ID ${task_id}.`);
      }

      const assigneeName = foundSubtask.Assignee ? foundSubtask.Assignee.fullName : "Chưa phân công";
      const deadlineStr = foundSubtask.deadline ? foundSubtask.deadline.split('T')[0] : "Chưa đặt";
      
      return {
        content: [{
          type: "text",
          text: `📄 **CHI TIẾT CÔNG VIỆC ${task_id.toUpperCase()}:**\n\n` +
            `• **Tiêu đề**: ${foundSubtask.title}\n` +
            `• **Mô tả**: ${foundSubtask.description || "Không có mô tả"}\n` +
            `• **Dự án**: ${parentTask ? parentTask.title : "N/A"}\n` +
            `• **Người phụ trách**: ${assigneeName}\n` +
            `• **Trạng thái**: ${foundSubtask.status === 'pending' ? 'Todo' : foundSubtask.status === 'working' ? 'In Progress' : 'Done'} (${foundSubtask.status})\n` +
            `• **Độ ưu tiên**: ${foundSubtask.priority.charAt(0).toUpperCase() + foundSubtask.priority.slice(1)}\n` +
            `• **Hạn chót**: ${deadlineStr}\n` +
            `• **Thời gian ước tính**: ${foundSubtask.estimatedHours || 0} giờ\n` +
            `• **Gợi ý đầu ra (Deliverables)**: ${foundSubtask.outputSuggested || "Không có"}`
        }]
      };
    }

    case "upsert_team_member": {
      const { email, fullName, role, skills, phone, telegramUsername, telegramChatId, bankName, bankAccount } = args as any;

      if (!isBoss) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "TỪ CHỐI TRUY CẬP: Chỉ có Admin/Boss mới có quyền thêm hoặc cập nhật thông tin nhân sự."
        );
      }

      try {
            await apiClient.post(API_ROUTES.HR.TEAM_MEMBERS, JSON.stringify({
                    email,
                    fullName,
                    role: role || undefined,
                    skills: skills || [],
                    phone: phone || undefined,
                    telegramUsername: telegramUsername || undefined,
                    telegramChatId: telegramChatId ? Number(telegramChatId) : undefined,
                    bankName: bankName || undefined,
                    bankAccount: bankAccount || undefined
                  }));
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi cập nhật nhân sự tại Core API.");
          }
      return {
        content: [{
          type: "text",
          text: `Cập nhật nhân sự thành công! ✓\n• **Họ tên**: ${fullName}\n• **Email**: ${email}\n• **Vai trò**: ${role || 'Chưa rõ'}\n• **Telegram**: ${telegramUsername ? '@' + telegramUsername : 'Chưa có'} (Chat ID: ${telegramChatId || 'Chưa có'})`
        }]
      };
    }

    case "check_in_out": {
      const { status, notes, employee_name } = args as any;
      
      let targetMember = user;
      if (employee_name && employee_name.toLowerCase() !== user.fullName.toLowerCase()) {
        if (!isBoss) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "TỪ CHỐI TRUY CẬP: Chỉ có Admin/Boss mới có quyền điểm danh hộ nhân sự khác."
          );
        }
        const found = members.find((m: any) => m.fullName.toLowerCase() === employee_name.toLowerCase());
        if (!found) {
          throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy nhân sự ${employee_name} trong hệ thống.`);
        }
        targetMember = found;
      }

      let checkinData;
          try {
            checkinData = (await apiClient.post("/omnitask/hr/attendance/checkin", JSON.stringify({
                    memberId: targetMember.id,
                    status: status || "present",
                    notes: notes || `Checkin/checkout từ Telegram`
                  }))) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi kết nối điểm danh với Core API.");
          }
      const att = checkinData.data;

      // Định dạng phản hồi
      const formatTime = (isoStr: string) => {
        if (!isoStr) return "";
        return new Date(isoStr).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
      };

      const inTime = formatTime(att.checkIn);
      const outTime = att.checkOut ? formatTime(att.checkOut) : "";
      
      const actionType = att.checkOut ? "CHECK-OUT 🚪" : "CHECK-IN 🌅";
      const detailStr = att.checkOut
        ? `Check-in lúc: *${inTime}* | Check-out lúc: *${outTime}*`
        : `Check-in lúc: *${inTime}*`;

      return {
        content: [{
          type: "text",
          text: `🔔 *ĐIỂM DANH THÀNH CÔNG (${actionType}):*\n• Nhân viên: *${targetMember.fullName}*\n• Trạng thái: *${att.status}*\n• ${detailStr}\n• Ghi chú: *${att.notes || "Không có"}*`
        }]
      };
    }

    case "breakdown_task": {
      const { task_id } = args as any;
      
      // 1. Tìm task có planeTaskId bằng task_id
      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.OMNITASK.ROOT)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
          }
      const dbTasks = tasksData.data || [];
      
      let matchedSubtask: any = null;
      dbTasks.forEach((t: any) => {
        if (Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            if (sub.planeTaskId === task_id || sub.id === task_id) {
              matchedSubtask = { ...sub, projectId: t.id };
            }
          });
        }
      });

      if (!matchedSubtask) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy công việc với mã ID ${task_id}.`);
      }

      // Chỉ quản lý hoặc chính người phụ trách mới được phân rã
      const assigneeEmail = matchedSubtask.Assignee ? matchedSubtask.Assignee.email : "";
      if (!isBoss && assigneeEmail.toLowerCase() !== user.email.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không có quyền phân rã công việc của ${matchedSubtask.Assignee ? matchedSubtask.Assignee.fullName : "người khác"}.`
        );
      }

      const portalUrl = process.env.WEB_PORTAL_URL || "https://storymee-team.vercel.app";
      const breakdownRes = await fetchAxios(`${portalUrl}/api/ai/breakdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: matchedSubtask.title,
          description: matchedSubtask.description || ""
        })
      });

      if (!breakdownRes.ok) {
        throw new McpError(ErrorCode.InternalError, "Lỗi gọi AI phân rã công việc qua Vercel API.");
      }

      const breakdownData = await breakdownRes.json() as any;
      const generatedList = breakdownData.subtasks || [];
      
      if (!Array.isArray(generatedList) || generatedList.length === 0) {
        throw new McpError(ErrorCode.InternalError, "AI không trả về danh sách công việc con nào.");
      }

      // 2. Tạo các subtask mới trong database dưới cùng một dự án mẹ, gán cho cùng một người phụ trách
      const createdSubtasks: string[] = [];
      let subIdx = 1;
      for (const item of generatedList) {
        const subtaskIdStr = `${task_id}-${String(subIdx).padStart(2, '0')}`;
        subIdx++;

        try {
            await apiClient.post("/hr/subtasks", JSON.stringify({
                      title: `[${task_id}] ${item.title}`,
                      estimatedHours: 2, // Mặc định 2 giờ mỗi subtask
                      priority: matchedSubtask.priority || "medium",
                      assigneeId: matchedSubtask.assigneeId,
                      parentTaskId: matchedSubtask.projectId,
                      status: "pending",
                      planeTaskId: subtaskIdStr
                    }));
          } catch (err: any) {
            throw err;
          }
      }

      return {
        content: [{
          type: "text",
          text: `🌱 *ĐÃ PHÂN RÃ CÔNG VIỆC ${task_id} THÀNH CÔNG:*\n` +
                `Công việc gốc: *${matchedSubtask.title}*\n` +
                `Đã tạo thêm ${createdSubtasks.length} công việc con tự động lưu vào DB:\n` +
                createdSubtasks.join("\n")
        }]
      };
    }

    case "update_subtasks": {
      const { task_id, titles } = args as any;

      if (!Array.isArray(titles)) {
        throw new McpError(ErrorCode.InvalidParams, "Danh sách tiêu đề công việc con phải là một mảng.");
      }

      // 1. Tìm task có planeTaskId bằng task_id
      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.OMNITASK.ROOT)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
          }
      const dbTasks = tasksData.data || [];

      let matchedSubtask: any = null;
      dbTasks.forEach((t: any) => {
        if (Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            if (sub.planeTaskId === task_id || sub.id === task_id) {
              matchedSubtask = { ...sub, projectId: t.id };
            }
          });
        }
      });

      if (!matchedSubtask) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy công việc với mã ID ${task_id}.`);
      }

      // Chỉ quản lý hoặc chính người phụ trách mới được cập nhật
      const assigneeEmail = matchedSubtask.Assignee ? matchedSubtask.Assignee.email : "";
      if (!isBoss && assigneeEmail.toLowerCase() !== user.email.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không có quyền sửa đổi công việc của ${matchedSubtask.Assignee ? matchedSubtask.Assignee.fullName : "người khác"}.`
        );
      }

      // 2. Xóa các subtask cũ có tiêu đề bắt đầu bằng [task_id] trong cùng dự án mẹ
      const deletePromises: Promise<any>[] = [];
      dbTasks.forEach((t: any) => {
        if (t.id === matchedSubtask.projectId && Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            if (sub.title && sub.title.startsWith(`[${task_id}]`)) {
              deletePromises.push(
                apiClient.delete(`${API_ROUTES.HR.SUBTASKS}/${sub.id}`)
              );
            }
          });
        }
      });

      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }

      // 3. Tạo các subtask mới do người dùng tùy chỉnh
      const createdSubtasks: string[] = [];
      let subIdx = 1;
      for (const title of titles) {
        const cleanTitle = title.replace(/^-\s*/, '').replace(/^\d+\.\s*/, '').trim();
        if (!cleanTitle) continue;
        const subtaskIdStr = `${task_id}-${String(subIdx).padStart(2, '0')}`;
        subIdx++;

        try {
            await apiClient.post("/hr/subtasks", JSON.stringify({
                      title: `[${task_id}] ${cleanTitle}`,
                      estimatedHours: 2,
                      priority: matchedSubtask.priority || "medium",
                      assigneeId: matchedSubtask.assigneeId,
                      parentTaskId: matchedSubtask.projectId,
                      status: "pending",
                      planeTaskId: subtaskIdStr
                    }));
          } catch (err: any) {
            throw err;
          }
      }

      return {
        content: [{
          type: "text",
          text: titles.length === 0
            ? `📝 *ĐÃ XÓA TOÀN BỘ CÔNG VIỆC CON CHO ${task_id} THÀNH CÔNG:*\n` +
              `Công việc gốc: *${matchedSubtask.title}*\n` +
              `Đã dọn dẹp sạch toàn bộ subtask cũ của công việc này.`
            : `📝 *ĐÃ CẬP NHẬT CÁC CÔNG VIỆC CON CHO ${task_id} THÀNH CÔNG:*\n` +
              `Công việc gốc: *${matchedSubtask.title}*\n` +
              `Đã xóa việc cũ và tạo mới ${createdSubtasks.length} việc con:\n` +
              createdSubtasks.join("\n")
        }]
      };
    }

    
    case "request_task_approval": {
      const { task_id, type, reason, new_deadline } = args as any;

      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.OMNITASK.ROOT)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
          }
      const dbTasks = tasksData.data || [];
      
      let foundSubtask: any = null;
      dbTasks.forEach((t: any) => {
        if (Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            if (sub.id.toLowerCase() === task_id.toLowerCase() || (sub.planeTaskId && sub.planeTaskId.toLowerCase() === task_id.toLowerCase())) {
              foundSubtask = sub;
            }
          });
        }
      });

      if (!foundSubtask) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy công việc mã ID ${task_id}.`);
      }

      try {
            await apiClient.post(`/omnitask/hr/tasks/${foundSubtask.id}/request`, JSON.stringify({ type, reason, newDeadline: new_deadline }));
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi khi gọi API xin duyệt.");
          }
      return {
        content: [{
          type: "text",
          text: `Đã gửi yêu cầu ${type === 'extend' ? 'dời deadline' : 'xoá/lưu trữ'} cho task ${task_id} thành công! Hãy đợi Admin duyệt nhé.`
        }]
      };
    }

    case "approve_task_request": {
      const { task_id, type, decision, new_deadline } = args as any;
      if (!isBoss) {
        throw new McpError(ErrorCode.InvalidRequest, "TỪ CHỐI TRUY CẬP: Chỉ Admin/Boss mới có quyền duyệt yêu cầu task.");
      }

      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.OMNITASK.ROOT)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
          }
      const dbTasks = tasksData.data || [];
      
      let foundSubtask: any = null;
      dbTasks.forEach((t: any) => {
        if (Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            if (sub.id.toLowerCase() === task_id.toLowerCase() || (sub.planeTaskId && sub.planeTaskId.toLowerCase() === task_id.toLowerCase())) {
              foundSubtask = sub;
            }
          });
        }
      });

      if (!foundSubtask) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy công việc mã ID ${task_id}.`);
      }

      try {
            await apiClient.post(`/omnitask/hr/tasks/${foundSubtask.id}/approve`, JSON.stringify({ type, decision, newDeadline: new_deadline }));
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi khi gọi API duyệt yêu cầu.");
          }
      return {
        content: [{
          type: "text",
          text: `Đã ${decision === 'approve' ? 'DUYỆT' : 'TỪ CHỐI'} yêu cầu ${type} cho task ${task_id} thành công!`
        }]
      };
    }


    case "get_team_leaves": {
      const { period } = args as any;
      if (!isBoss) {
        throw new McpError(ErrorCode.InvalidRequest, "TỪ CHỐI TRUY CẬP: Chỉ Admin/Boss mới có quyền xem danh sách xin nghỉ/remote của toàn team.");
      }

      let leavesData;
          try {
            leavesData = (await apiClient.get("/omnitask/hr/leave-requests")) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch dữ liệu leave-requests.");
          }
      const list = leavesData.data || [];

      const now = new Date();
      const vietnamOffset = 7 * 60 * 60 * 1000;
      const today = new Date(now.getTime() + vietnamOffset);
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Thứ 2
      startOfWeek.setHours(0,0,0,0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23,59,59,999);

      let filtered = list.filter((l: any) => {
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        if (period === 'this_week') {
          return (start <= endOfWeek && end >= startOfWeek);
        } else if (period === 'this_month') {
          return (start.getMonth() === today.getMonth() && start.getFullYear() === today.getFullYear()) ||
                 (end.getMonth() === today.getMonth() && end.getFullYear() === today.getFullYear());
        } else if (period === 'today') {
          return (start.toISOString().split('T')[0] <= today.toISOString().split('T')[0] && end.toISOString().split('T')[0] >= today.toISOString().split('T')[0]);
        }
        return true;
      });

      if (filtered.length === 0) {
        return {
          content: [{ type: "text", text: `Không có nhân sự nào xin nghỉ hoặc làm remote trong thời gian "${period || 'tất cả'}".` }]
        };
      }

      let reportText = `📋 **Danh sách xin phép/remote (${period}):**\n\n`;
      filtered.forEach((l: any) => {
        const m = members.find((mem: any) => mem.id === l.memberId);
        const name = m ? m.fullName : "Unknown";
        const typeStr = l.leaveType === 'remote' ? 'Làm Remote' : l.leaveType === 'sick' ? 'Nghỉ ốm' : 'Nghỉ phép năm';
        const statusStr = l.status === 'approved' ? '✅ Đã duyệt' : l.status === 'rejected' ? '❌ Từ chối' : '⏳ Chờ duyệt';
        reportText += `- **${name}**: ${typeStr} (${l.startDate} đến ${l.endDate}) - [${statusStr}]\n  Lý do: ${l.reason || 'Không có'}\n`;
      });

      return {
        content: [{ type: "text", text: reportText }]
      };
    }

    case "get_attendance_report": {
      const { employee_name, month, year } = args as any;
      
      let targetMem = null;
      if (employee_name) {
        targetMem = members.find((m: any) => m.fullName.toLowerCase().includes(employee_name.toLowerCase()));
        if (!targetMem) {
          throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy nhân viên tên "${employee_name}" trong hệ thống.`);
        }
      } else if (!isBoss) {
        targetMem = user;
      }

      const queryPath = targetMem 
        ? `/omnitask/hr/attendance?memberId=${targetMem.id}`
        : `/omnitask/hr/attendance`;
        
      let attData;
      try {
        attData = (await apiClient.get(queryPath)) as any;
      } catch (err: any) {
        throw new McpError(ErrorCode.InternalError, "Lỗi fetch dữ liệu chấm công từ hệ thống HR.");
      }
      
      const list = attData.data || [];

      // Filter by month/year
      const d = new Date();
      const mTarget = month ? Number(month) : d.getMonth() + 1;
      const yTarget = year ? Number(year) : d.getFullYear();

      let totalHoursStr = 0;
      let presentDays = 0;
      let lateDays = 0;

      list.forEach((item: any) => {
        const itemD = new Date(item.date);
        if (itemD.getMonth() + 1 === mTarget && itemD.getFullYear() === yTarget) {
          totalHoursStr += (item.totalHours || 0);
          if (item.status === 'present') presentDays++;
          if (item.status === 'late') lateDays++;
        }
      });

      totalHoursStr = Math.round(totalHoursStr * 100) / 100;

      const title = targetMem 
        ? `Báo cáo công tháng ${mTarget}/${yTarget} của ${targetMem.fullName}`
        : `Báo cáo tổng hợp công tháng ${mTarget}/${yTarget} của toàn Team`;

      return {
        content: [{
          type: "text",
          text: `📊 *${title}*
• Tổng giờ làm: **${totalHoursStr} giờ**
• Số ngày đi đúng giờ: ${presentDays}
• Số ngày đi muộn: ${lateDays}`
        }]
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Công cụ ${name} không được hỗ trợ.`);
  }
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
}

main().catch((error) => {
  console.error("Lỗi khởi chạy server:", error);
  process.exit(1);
});
