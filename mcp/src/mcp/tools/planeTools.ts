import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import { fetchAxios } from "../../fetchAxios";
import { pendingOutputByUsername } from "../../sessionStore";

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
        target_date: { type: "string", description: "Hạn chót hoàn thành định dạng YYYY-MM-DD" },
        parent_id: { type: "string", description: "ID của task cha (nếu đây là subtask). Truyền ID dạng UUID hoặc Short ID đều được (mcp sẽ tự map)" }
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
    name: "update_issue",
    description: "Cập nhật các thông tin của một task trên Kanban (trạng thái, người gán, ước lượng, độ ưu tiên, hạn chót).",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Mã ID công việc (ví dụ: T-103)" },
        status: { type: "string", enum: ["Todo", "In Progress", "Done"], description: "Trạng thái mới (tùy chọn)" },
        assignee: { type: "string", description: "Tên người phụ trách mới (tùy chọn)" },
        estimate: { type: "number", description: "Ước tính thời gian mới (giờ, tùy chọn)" },
        priority: { type: "string", enum: ["Low", "Medium", "High"], description: "Độ ưu tiên mới (tùy chọn)" },
        deadline: { type: "string", description: "Hạn chót mới định dạng YYYY-MM-DD hoặc ISO string (tùy chọn)" },
        project_name: { type: "string", description: "Tên dự án mới muốn chuyển task sang (tùy chọn)" }
      },
      required: ["task_id"]
    }
  },
  {
    name: "get_issue_details",
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
    name: "breakdown_issue",
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
    name: "update_sub_issues",
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
    name: "request_issue_approval",
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
    name: "approve_issue_request",
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

function findIssueHelper(dbTasks: any[], taskIdStr: string): any {
    if (!taskIdStr) return null;
    const str = taskIdStr.toLowerCase().trim();

    // 1. Direct match by UUID or planeTaskId
    let found = dbTasks.find((t: any) =>
        (t.id && t.id.toLowerCase() === str) ||
        (t.planeTaskId && t.planeTaskId.toLowerCase() === str)
    );
    if (found) return found;

    // 2. Match Short ID (e.g. STO80-5, MP-3)
    // API trả về Project là string identifier HOẶC object { identifier: "STO80" }
    if (taskIdStr.includes('-')) {
        const parts = taskIdStr.split('-');
        if (parts.length >= 2) {
            const ident = parts[0].toUpperCase();
            const seqId = parseInt(parts[1], 10);
            if (!isNaN(seqId)) {
                const projectMatch = dbTasks.find((t: any) => {
                    if (t.sequenceId !== seqId) return false;
                    // Project có thể là string hoặc object
                    const projIdent = typeof t.Project === 'string'
                        ? t.Project.toUpperCase()
                        : (t.Project?.identifier || '').toUpperCase();
                    return projIdent === ident;
                });
                if (projectMatch) return projectMatch;

                // Tìm cả trong subIssues (subtask)
                for (const parent of dbTasks) {
                    const subs = parent.subIssues || [];
                    const subFound = subs.find((s: any) => {
                        if (s.sequenceId !== seqId) return false;
                        const projIdent = typeof s.Project === 'string'
                            ? s.Project.toUpperCase()
                            : (s.Project?.identifier || '').toUpperCase();
                        return projIdent === ident;
                    });
                    if (subFound) return subFound;
                }
            }
        }
    }

    // 3. Fuzzy fallback: match by title substring
    const titleMatch = dbTasks.find((t: any) =>
        t.title && t.title.toLowerCase().includes(str)
    );
    if (titleMatch) return titleMatch;

    return null;
}


export async function executePlaneTool(name: string, args: any, user: any, isBoss: boolean, apiClient: CoreApiClient, members: any[], username?: string): Promise<{ content: Array<{ type: string; text: string }> }> {

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
      
      // Tập hợp các ID liên quan đến user (User là assignee của task cha hoặc task con)
      const involvedParentIds = new Set<string>();
      dbIssues.forEach((issue: any) => {
        const assigneeName = issue.Assignee ? issue.Assignee.fullName : "";
        if (assigneeName.toLowerCase() === targetName.toLowerCase()) {
          if (issue.parentId) involvedParentIds.add(issue.parentId);
          else involvedParentIds.add(issue.id);
        }
      });

      // Lấy tất cả task cha có liên quan
      const parentTasks = dbIssues.filter((i: any) => i.parentId === null && involvedParentIds.has(i.id));
      // Lấy tất cả subtask của các task cha này (hoặc subtask được assign cho user nhưng cha bị xóa)
      const subTasks = dbIssues.filter((i: any) => i.parentId !== null && (involvedParentIds.has(i.parentId) || (i.Assignee?.fullName || '').toLowerCase() === targetName.toLowerCase()));

      let outputText = `📝 CÔNG VIỆC CỦA BẠN (*${targetName}*)\n\n`;
      
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

      parentTasks.forEach((pt: any) => {
          outputText += formatIssue(pt);
          const subs = subTasks.filter((sub: any) => sub.parentId === pt.id);
          subs.forEach((sub: any, idx: number) => {
              const isLast = idx === subs.length - 1;
              const formattedSub = formatIssue(sub, true);
              outputText += isLast ? formattedSub.replace('┣', '┗') : formattedSub;
          });
          outputText += '\n';
      });

      // Nếu có subtask bị mồ côi (Task mẹ do người khác cầm)
      const orphanSubs = subTasks.filter((sub: any) => !parentTasks.find((p: any) => p.id === sub.parentId));
      if (orphanSubs.length > 0) {
          orphanSubs.forEach((pt: any) => {
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
      const { title, project_id, assignee, priority, target_date, parent_id } = args as any;
      
      if (!isBoss && assignee && assignee.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "TỪ CHỐI TRUY CẬP: Bạn không có quyền tạo task và gán cho nhân sự khác."
        );
      }

      let targetUser: any = user;
      if (assignee) {
        const lowerAssignee = assignee.toLowerCase();
        if (lowerAssignee === 'chưa phân công' || lowerAssignee === 'none' || lowerAssignee === 'unassigned') {
          targetUser = null;
        } else {
          targetUser = members.find((m: any) => m.fullName.toLowerCase() === lowerAssignee);
          if (!targetUser) {
            throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy nhân sự ${assignee} trong hệ thống.`);
          }
        }
      }

      let actualParentId = parent_id;
      // Convert Short ID to UUID if needed
      if (parent_id && !parent_id.includes('-') === false && parent_id.split('-').length === 2 && parent_id.length < 15) {
          try {
              const resJson = (await apiClient.get(API_ROUTES.PLANE.ISSUES)) as any;
              const allIssues = resJson.data || [];
              const parts = parent_id.split('-');
              const seqId = parseInt(parts[1], 10);
              const ident = parts[0].toUpperCase();
              const found = allIssues.find((i: any) => i.sequenceId === seqId && (i.Project?.identifier || '').toUpperCase() === ident);
              if (found) actualParentId = found.id;
          } catch (e) {
              // ignore
          }
      }

      let finalProjectId = project_id;
      if (finalProjectId && finalProjectId.length !== 36) {
          try {
              const projRes = (await apiClient.get(API_ROUTES.PLANE.PROJECTS)) as any;
              const allProjects = projRes.data || [];
              const foundProj = allProjects.find((p: any) => p.name.toLowerCase() === finalProjectId.toLowerCase() || p.identifier.toLowerCase() === finalProjectId.toLowerCase());
              
              if (foundProj) {
                  finalProjectId = foundProj.id;
              } else {
                  // Tạo mới project nếu không tồn tại
                  let ident = finalProjectId.replace(/[^A-Za-z0-9]/g, '').substring(0, 3).toUpperCase();
                  if (ident.length < 3) ident = "PRJ";
                  const newProj = (await apiClient.post(API_ROUTES.PLANE.PROJECTS, {
                      name: finalProjectId,
                      description: "Tạo tự động qua MCP",
                      identifier: ident
                  })) as any;
                  if (newProj.success !== false && newProj.data) {
                      finalProjectId = newProj.data.id;
                  }
              }
          } catch (e) {
              console.error("Lỗi tự động tạo project:", e);
          }
      }
      
      // Fallback nếu vẫn không có dự án
      if (!finalProjectId) {
          try {
              const projRes = (await apiClient.get(API_ROUTES.PLANE.PROJECTS)) as any;
              if (projRes.data && projRes.data.length > 0) {
                  finalProjectId = projRes.data[0].id;
              }
          } catch (e) {}
      }

      let resJson;
          try {
            resJson = (await apiClient.post(API_ROUTES.PLANE.ISSUES, {
                    title,
                    projectId: finalProjectId,
                    description: "Tạo tự động qua Model Context Protocol (MCP)",
                    assigneeId: targetUser ? targetUser.id : undefined,
                    priority: priority ? priority.toLowerCase() : "medium",
                    targetDate: target_date || undefined,
                    parentId: actualParentId || undefined
                  })) as any;
            
            if (resJson.success === false) {
              throw new Error(resJson.message || "Lỗi tạo issue tại Core API Service.");
            }
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, err.message || "Lỗi tạo issue tại Core API Service.");
          }
      
      const newIssue = resJson.data;
      const newId = newIssue?.id || "N/A";
      const assigneeText = targetUser ? targetUser.fullName : 'Chưa phân công';

      return {
        content: [{
          type: "text",
          text: `Đã tạo công việc thành công! ✓\n• **ID**: ${newId.split('-')[0]}\n• **Tiêu đề**: ${title}\n• **Người thực hiện**: ${assigneeText}\n• **Hạn chót**: ${target_date || 'None'}`
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
      
      const foundIssue = dbIssues.find((i: any) => i.id.toLowerCase().startsWith(issue_id.toLowerCase()) || i.id.toLowerCase() === issue_id.toLowerCase());

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

      if (targetState.group === 'completed' && !isBoss) {
        // Tìm state 'In Review' trong project
        const inReviewState = parentProject.states.find((s: any) =>
          s.name.toLowerCase() === 'in review' || s.name.toLowerCase() === 'inreview'
        );
        if (inReviewState) {
          await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${foundIssue.id}`, { stateId: inReviewState.id });
          // Đánh dấu cần thu thập output
          if (username) {
            pendingOutputByUsername.set(username.toLowerCase().replace(/^@/, ''), {
              issueId: foundIssue.id,
              issueShortId: foundIssue.shortId || issue_id,
              issueTitle: foundIssue.title,
              memberId: user.id,
            });
          }
          return {
            content: [{
              type: "text",
              text: `IN_REVIEW_REDIRECT:${foundIssue.id}:${foundIssue.shortId || issue_id}:${foundIssue.title}`
            }]
          };
        }
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
      const { task_id, status, assignee, estimate, priority, deadline, project_name } = args as any;

      let tasksData;
          try {
            tasksData = (await apiClient.get(API_ROUTES.PLANE.ISSUES)) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
          }
      const dbTasks = tasksData.data || [];
      
      let foundSubtask: any = findIssueHelper(dbTasks, task_id);


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

      if (status && (status.toLowerCase() === 'done' || status.toLowerCase() === 'completed') && !isBoss) {
        // Tự động chuyển sang in_review thay vì block
        await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${foundSubtask.id}`, { status: 'in_review' });
        // Đánh dấu cần thu thập output
        if (username) {
          pendingOutputByUsername.set(username.toLowerCase().replace(/^@/, ''), {
            issueId: foundSubtask.id,
            issueShortId: foundSubtask.shortId || task_id,
            issueTitle: foundSubtask.title,
            memberId: user.id,
          });
        }
        return {
          content: [{
            type: "text",
            text: `IN_REVIEW_REDIRECT:${foundSubtask.id}:${foundSubtask.shortId || task_id}:${foundSubtask.title}`
          }]
        };
      }

      let projectId = undefined;
      if (project_name) {
        let projectsData;
        try {
          projectsData = (await apiClient.get(API_ROUTES.PLANE.PROJECTS)) as any;
        } catch(e) {}
        const dbProjects = projectsData?.data || [];
        const targetProj = dbProjects.find((p: any) => p.name.toLowerCase().includes(project_name.toLowerCase()) || (p.identifier && p.identifier.toLowerCase() === project_name.toLowerCase()));
        if (targetProj) {
          projectId = targetProj.id;
        } else {
          throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy dự án nào có tên chứa "${project_name}".`);
        }
      }

      try {
            await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${foundSubtask.id}`, {
                    status: status ? status : undefined,
                    assigneeId: assigneeId,
                    priority: priority ? priority.toLowerCase() : undefined,
                    targetDate: deadline || undefined,
                    estimateHours: estimate || undefined,
                    projectId: projectId
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
      
      let foundSubtask: any = findIssueHelper(dbTasks, task_id);
      let parentTask: any = foundSubtask && foundSubtask.parentId ? dbTasks.find((t: any) => t.id === foundSubtask.parentId) : null;


      if (!foundSubtask) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy công việc mã ID ${task_id}.`);
      }

      const assigneeName = foundSubtask.Assignee ? foundSubtask.Assignee.fullName : "Chưa phân công";
      const stateName = foundSubtask.State?.name || 'Todo';
      const deadlineStr = foundSubtask.targetDate ? foundSubtask.targetDate.split('T')[0] : 'Chưa đặt';
      const projIdent = typeof foundSubtask.Project === 'string'
        ? foundSubtask.Project
        : (foundSubtask.Project?.identifier || '');
      const shortId = projIdent && foundSubtask.sequenceId ? `${projIdent}-${foundSubtask.sequenceId}` : task_id.toUpperCase();
      const projName = typeof foundSubtask.Project === 'string'
        ? foundSubtask.Project
        : (foundSubtask.Project?.name || (parentTask?.title || 'N/A'));
      return {
        content: [{
          type: "text",
          text: `📄 **CHI TIẾT CÔNG VIỆC ${shortId}:**\n\n` +
            `• **Tiêu đề**: ${foundSubtask.title}\n` +
            `• **Mô tả**: ${foundSubtask.description || "Không có mô tả"}\n` +
            `• **Dự án**: ${projName}\n` +
            `• **Người phụ trách**: ${assigneeName}\n` +
            `• **Trạng thái**: ${stateName}\n` +
            `• **Độ ưu tiên**: ${foundSubtask.priority.charAt(0).toUpperCase() + foundSubtask.priority.slice(1)}\n` +
            `• **Hạn chót**: ${deadlineStr}\n` +
            `• **Thời gian ước tính**: ${foundSubtask.estimateHours || 0} giờ`
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
      
      let matchedSubtask: any = findIssueHelper(dbTasks, task_id);


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
      const generatedList = breakdownData.data?.subtasks || breakdownData.subtasks || [];
      
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
            const resJson = await apiClient.post(API_ROUTES.PLANE.ISSUES, {
                title: item.title,
                projectId: matchedSubtask.projectId,
                description: `Tạo tự động từ kết quả phân rã của công việc mẹ [${task_id}].`,
                assigneeId: matchedSubtask.assigneeId || undefined,
                priority: matchedSubtask.priority || "medium",
                parentId: matchedSubtask.id
            }) as any;
            
            if (resJson.success === false) {
                throw new Error(resJson.message || "Lỗi tạo subtask.");
            }
        } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi tạo subtask: " + err.message);
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

      let matchedSubtask: any = findIssueHelper(dbTasks, task_id);


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
      for (const sub of dbTasks) {
        if (sub.parentId === matchedSubtask.id) {
          if (sub.title && sub.title.startsWith(`[${task_id}]`)) {
            try {
                apiClient.delete(`${API_ROUTES.HR.SUBTASKS}/${sub.id}`)
            } catch(e) {}
          }
        }
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
            await apiClient.post(API_ROUTES.HR.SUBTASKS, {
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
      
      let foundSubtask: any = findIssueHelper(dbTasks, task_id);


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
      
      let foundSubtask: any = findIssueHelper(dbTasks, task_id);


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
