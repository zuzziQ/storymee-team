import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import { fetchAxios } from "../../fetchAxios";

export const PLANE_TOOLS_SCHEMA = [
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
  }
];

export async function executePlaneTool(name: string, args: any, user: any, isBoss: boolean, apiClient: CoreApiClient, members: any[]): Promise<{ content: Array<{ type: string; text: string }> }> {

  switch (name) {
case "get_my_issues": {
      const targetName = args?.employee_name || user.fullName;
      
      if (!isBoss && targetName.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không có quyền xem danh sách công việc của nhân sự ${targetName}.`
        );
      }

      let resJson;
          try {
            resJson = (await apiClient.get(API_ROUTES.PLANE.ISSUES)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch issues từ Core API");
          }
      const dbIssues = resJson.data || [];
      
      const myIssues: any[] = [];
      dbIssues.forEach((issue: any) => {
        const assigneeName = issue.Assignee ? issue.Assignee.fullName : "";
        if (assigneeName.toLowerCase() === targetName.toLowerCase()) {
          myIssues.push(issue);
        }
      });

      // Lọc task cha và subtask
      const parentTasks = myIssues.filter(i => i.parentId === null);
      const subTasks = myIssues.filter(i => i.parentId !== null);

      let outputText = `📝 CÔNG VIỆC CỦA BẠN (*${targetName}*)\n──────────────────────────────\n\n`;
      
      const formatIssue = (pt: any, isSub: boolean = false) => {
          const statusStr = pt.State ? pt.State.name : 'Unknown';
          const dlStr = pt.targetDate ? pt.targetDate.split('T')[0] : 'Chưa đặt';
          
          let emoji = '⚪';
          const isOverdue = pt.targetDate && new Date(pt.targetDate) < new Date(new Date().setHours(0,0,0,0));
          if (isOverdue) emoji = '🔴';
          else if (statusStr === 'In Review') emoji = '🔵';
          else if (statusStr === 'In Progress') emoji = '🟡';
          else if (statusStr === 'Done') emoji = '🟢';

          const ident = pt.Project ? pt.Project.identifier : 'ID';
          const shortId = `*${ident}-${pt.sequenceId}*`;
          
          if (isSub) {
              return `   ┣ ${emoji} ${shortId}: ${pt.title} (${statusStr})\n`;
          } else {
              const dlText = isOverdue ? `📅 ${dlStr} ⚠️ *QUÁ HẠN*` : `📅 ${dlStr}`;
              return `${emoji} ${shortId}: ${pt.title}\n   Trạng thái: \`${statusStr}\`  |  ${dlText}\n`;
          }
      };

      if (parentTasks.length === 0 && subTasks.length === 0) {
        return {
          content: [{
            type: "text",
            text: `Nhân sự ${targetName} hiện không có công việc nào đang mở.`
          }]
        };
      }

      parentTasks.forEach(pt => {
          outputText += formatIssue(pt);
          const subs = subTasks.filter(sub => sub.parentId === pt.id);
          subs.forEach((sub, idx) => {
              const isLast = idx === subs.length - 1;
              const formattedSub = formatIssue(sub, true);
              outputText += isLast ? formattedSub.replace('┣', '┗') : formattedSub;
          });
          outputText += '\n';
      });

      // Nếu có subtask bị mồ côi (Task mẹ do người khác cầm)
      const orphanSubs = subTasks.filter(sub => !parentTasks.find(p => p.id === sub.parentId));
      if (orphanSubs.length > 0) {
          orphanSubs.forEach(pt => {
              outputText += formatIssue(pt);
              outputText += '\n';
          });
      }

      return {
        content: [{
          type: "text",
          text: outputText.trim()
        }]
      };
    }
case "create_project": {
      const { title, description } = args as any;
      
      if (!isBoss) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "TỪ CHỐI TRUY CẬP: Bạn không có quyền tạo Dự án. Hãy nhờ Quản lý hoặc Giám đốc."
        );
      }

      try {
        const res = await apiClient.post(API_ROUTES.PLANE.PROJECTS, {
          name: title,
          description: description || ''
        });

        const newProject = (res as any).data;
        return {
          content: [{
            type: "text",
            text: `🎉 Khởi tạo Dự án thành công!\n\n- ID Dự án: ${newProject.id}\n- Tên Dự án: ${newProject.name}\n\nBạn có thể tiếp tục tạo Issue cho dự án này.`
          }]
        };
      } catch (err: any) {
        throw new McpError(ErrorCode.InternalError, `Lỗi khởi tạo dự án: ${err.message}`);
      }
    }
case "create_issue": {
      const { title, project_id, assignee, priority, target_date } = args as any;
      
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

      let resJson;
          try {
            resJson = (await apiClient.post(API_ROUTES.PLANE.ISSUES, {
                    title,
                    projectId: project_id,
                    description: "Tạo tự động qua Model Context Protocol (MCP)",
                    assigneeId: targetUser.id,
                    priority: priority ? priority.toLowerCase() : "medium",
                    targetDate: target_date || undefined
                  })) as any;
            
            if (resJson.success === false) {
              throw new Error(resJson.message || "Lỗi tạo issue tại Core API Service.");
            }
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, err.message || "Lỗi tạo issue tại Core API Service.");
          }
      
      const newIssue = resJson.data;
      const newId = newIssue?.id || "N/A";

      return {
        content: [{
          type: "text",
          text: `Đã tạo công việc thành công! ✓\n• **ID**: ${newId}\n• **Tiêu đề**: ${title}\n• **Người thực hiện**: ${targetUser.fullName}\n• **Hạn chót**: ${target_date || 'None'}`
        }]
      };
    }
case "update_issue_state": {
      const { issue_id, state } = args as any;

      let resJson;
          try {
            resJson = (await apiClient.get(`${API_ROUTES.PLANE.ISSUES}`)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch issues từ Core API");
          }
      const dbIssues = resJson.data || [];
      
      const foundIssue = dbIssues.find((i: any) => i.id.toLowerCase() === issue_id.toLowerCase());

      if (!foundIssue) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy công việc mã ID ${issue_id}.`);
      }

      const assigneeName = foundIssue.Assignee ? foundIssue.Assignee.fullName : "";
      if (!isBoss && assigneeName.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không có quyền cập nhật trạng thái của issue ${issue_id} do người khác nắm giữ.`
        );
      }

      // We need to fetch the project states to find the correct state ID
      let statesRes;
      try {
        statesRes = (await apiClient.get(`${API_ROUTES.PLANE.PROJECTS}`)) as any;
      } catch (err) {
        throw new McpError(ErrorCode.InternalError, "Lỗi fetch projects từ Core API");
      }
      const projects = statesRes.data || [];
      const parentProject = projects.find((p: any) => p.id === foundIssue.projectId);
      if (!parentProject) {
        throw new McpError(ErrorCode.InternalError, "Không tìm thấy dự án chứa issue này.");
      }
      
      const targetState = parentProject.states.find((s: any) => s.name.toLowerCase() === state.toLowerCase());
      if (!targetState) {
        throw new McpError(ErrorCode.InvalidParams, `Trạng thái ${state} không tồn tại trong dự án này. Các trạng thái hợp lệ: ${parentProject.states.map((s:any) => s.name).join(", ")}`);
      }

      try {
            await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${foundIssue.id}`, { stateId: targetState.id });
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi cập nhật trạng thái issue tại Core API.");
          }
      return {
        content: [{
          type: "text",
          text: `Cập nhật trạng thái thành công! ✓\n• **Issue**: ${issue_id} (${foundIssue.title})\n• **Trạng thái**: ${foundIssue.State?.name} ➔ ${targetState.name}`
        }]
      };
    }
case "assign_issue": {
      const { issue_id, assignee } = args as any;

      let resJson;
          try {
            resJson = (await apiClient.get(`${API_ROUTES.PLANE.ISSUES}`)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch issues từ Core API");
          }
      const dbIssues = resJson.data || [];
      
      const foundIssue = dbIssues.find((i: any) => i.id.toLowerCase() === issue_id.toLowerCase());

      if (!foundIssue) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy công việc mã ID ${issue_id}.`);
      }

      const assigneeName = foundIssue.Assignee ? foundIssue.Assignee.fullName : "";
      if (!isBoss && assigneeName.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không được phép bàn giao công việc ${issue_id} của người khác.`
        );
      }

      const targetUser = members.find((m: any) => m.fullName.toLowerCase() === assignee.toLowerCase());
      if (!targetUser) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy nhân sự ${assignee} để bàn giao.`);
      }

      try {
            await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${foundIssue.id}`, { assigneeId: targetUser.id });
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi bàn giao công việc tại Core API.");
          }
      return {
        content: [{
          type: "text",
          text: `Bàn giao công việc thành công! ✓\n• **Issue**: ${issue_id} (${foundIssue.title})\n• **Người phụ trách**: ${assigneeName || 'Chưa có'} ➔ ${targetUser.fullName}`
        }]
      };
    }
case "update_issue": {
      const { task_id, status, assignee, estimate, priority, deadline } = args as any;

      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.PLANE.ISSUES)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
          }
      const dbTasks = tasksData.data || [];
      
      let foundSubtask: any = null;
      dbTasks.forEach((t: any) => {
        if (t.id.toLowerCase() === task_id.toLowerCase() || (t.planeTaskId && t.planeTaskId.toLowerCase() === task_id.toLowerCase())) {
          foundSubtask = t;
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

      let assigneeId = undefined;
      if (assignee) {
        const targetMem = members.find((m: any) => m.fullName.toLowerCase().includes(assignee.toLowerCase()));
        if (targetMem) assigneeId = targetMem.id;
      }

      try {
            await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${foundSubtask.id}`, {
                    status: status ? status : undefined,
                    assigneeId: assigneeId,
                    priority: priority ? priority.toLowerCase() : undefined,
                    targetDate: deadline || undefined,
                    estimateHours: estimate || undefined
                  });
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
case "get_issue_details": {
      const { task_id } = args as any;

      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.PLANE.ISSUES)) as any;
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
case "breakdown_issue": {
      const { task_id } = args as any;
      
      // 1. Tìm task có planeTaskId bằng task_id
      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.PLANE.ISSUES)) as any;
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
        body: {
          title: matchedSubtask.title,
          description: matchedSubtask.description || ""
        }
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
            await apiClient.post("/hr/subtasks", {
                      title: `[${task_id}] ${item.title}`,
                      estimatedHours: 2, // Mặc định 2 giờ mỗi subtask
                      priority: matchedSubtask.priority || "medium",
                      assigneeId: matchedSubtask.assigneeId,
                      parentTaskId: matchedSubtask.projectId,
                      status: "pending",
                      planeTaskId: subtaskIdStr
                    });
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
case "update_sub_issues": {
      const { task_id, titles } = args as any;

      if (!Array.isArray(titles)) {
        throw new McpError(ErrorCode.InvalidParams, "Danh sách tiêu đề công việc con phải là một mảng.");
      }

      // 1. Tìm task có planeTaskId bằng task_id
      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.PLANE.ISSUES)) as any;
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
            await apiClient.post("/hr/subtasks", {
                      title: `[${task_id}] ${cleanTitle}`,
                      estimatedHours: 2,
                      priority: matchedSubtask.priority || "medium",
                      assigneeId: matchedSubtask.assigneeId,
                      parentTaskId: matchedSubtask.projectId,
                      status: "pending",
                      planeTaskId: subtaskIdStr
                    });
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
case "request_issue_approval": {
      const { task_id, type, reason, new_deadline } = args as any;

      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.PLANE.ISSUES)) as any;
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
        await apiClient.post(`${API_ROUTES.HR.TASKS}/${foundSubtask.id}/request`, { type, reason, newDeadline: new_deadline });
      } catch (err: any) {
        throw new McpError(ErrorCode.InternalError, "Lỗi khi gọi API xin duyệt.");
      }

      // Telegram Bot will handle sending notification to Admin. We just need to return success.
      return {
        content: [{
          type: "text",
          text: `Đã gửi yêu cầu ${type === 'extend' ? 'dời deadline' : 'xoá/lưu trữ'} cho task ${task_id} thành công! Hãy đợi Admin duyệt nhé.`
        }]
      };
    }
case "approve_issue_request": {
      const { task_id, type, decision, new_deadline } = args as any;
      if (!isBoss) {
        throw new McpError(ErrorCode.InvalidRequest, "TỪ CHỐI TRUY CẬP: Chỉ Admin/Boss mới có quyền duyệt yêu cầu task.");
      }

      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.PLANE.ISSUES)) as any;
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
        await apiClient.post(`${API_ROUTES.HR.TASKS}/${foundSubtask.id}/approve`, { type, decision, newDeadline: new_deadline });
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

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Công cụ task ${name} chưa được hỗ trợ`);
  }
}
