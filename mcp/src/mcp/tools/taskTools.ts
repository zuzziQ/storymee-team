import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import { fetchAxios } from "../../fetchAxios";

export async function executeTaskTool(name: string, args: any, user: any, isBoss: boolean, apiClient: CoreApiClient): Promise<{ content: Array<{ type: string; text: string }> }> {
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
            resJson = (await apiClient.post(API_ROUTES.OMNITASK.ROOT, {
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
                  })) as any;
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
            await apiClient.patch(`${API_ROUTES.HR.SUBTASKS}/${foundSubtask.id}`, { status: apiStatus });
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
            await apiClient.patch(`${API_ROUTES.HR.SUBTASKS}/${foundSubtask.id}`, { assigneeId: targetUser.id });
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
            await apiClient.patch(`${API_ROUTES.HR.SUBTASKS}/${foundSubtask.id}`, {
                    status: apiStatus,
                    assigneeId: assigneeId,
                    priority: priority ? priority.toLowerCase() : undefined,
                    deadline: deadline || undefined,
                    estimatedHours: estimate || undefined
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
            await apiClient.post(`/omnitask/hr/tasks/${foundSubtask.id}/request`, { type, reason, newDeadline: new_deadline });
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
            await apiClient.post(`/omnitask/hr/tasks/${foundSubtask.id}/approve`, { type, decision, newDeadline: new_deadline });
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
