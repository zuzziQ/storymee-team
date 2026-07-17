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
    description:
      "Tạo issue mới. Hỗ trợ mô tả dài, link tài liệu, URL ảnh/video (gắn vào description + outputUrls tham chiếu). project_id tuỳ chọn → DFLT nếu trống. tags ghi vào description dạng #tag. Không có ACL phức tạp ngoài assignee.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Tiêu đề công việc" },
        description: { type: "string", description: "Mô tả chi tiết markdown / text dài" },
        links: {
          type: "array",
          items: { type: "string" },
          description: "Danh sách URL tài liệu (Drive, Notion, Figma…)",
        },
        media_urls: {
          type: "array",
          items: { type: "string" },
          description: "URL ảnh/video đính kèm tham chiếu",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Nhãn/tag (lưu trong description dạng #tag)",
        },
        project_id: {
          type: "string",
          description:
            "ID/identifier dự án. Bỏ trống | default | none = Không thuộc dự án nào (DFLT).",
        },
        assignee: { type: "string", description: "Tên nhân sự thực hiện (ví dụ: Trung Dũng)" },
        priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"], description: "Độ ưu tiên (mặc định medium)" },
        target_date: { type: "string", description: "Hạn chót hoàn thành định dạng YYYY-MM-DD" },
        parent_id: { type: "string", description: "ID của task cha (nếu đây là subtask). Truyền ID dạng UUID hoặc Short ID đều được (mcp sẽ tự map)" }
      },
      required: ["title"]
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
    description: "Tạo thêm hoặc thay thế danh sách công việc con (subtasks) của một công việc lớn (ví dụ: T-103) bằng danh sách tiêu đề mới.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Mã ID công việc lớn (ví dụ: T-103, T-004)" },
        titles: { type: "array", items: { type: "string" }, description: "Mảng chứa danh sách các tiêu đề việc con mới" },
        overwrite: { type: "boolean", description: "Nếu true, sẽ xóa hết các việc con cũ đang có trước khi tạo. Nếu false (mặc định), sẽ tạo thêm (append) việc con mới." }
      },
      required: ["task_id", "titles"]
    }
  },
  {
    name: "request_issue_approval",
    description:
      "DEPRECATED cho archive/xoá. User tự archive/delete. Chỉ dùng hiếm khi xin dời deadline (type=extend). Xin nghỉ/remote dùng submit_leave_request.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Mã ID công việc (ví dụ: T-103)" },
        type: { type: "string", enum: ["extend"], description: "Chỉ còn type extend (dời deadline) nếu cần xin admin" },
        reason: { type: "string", description: "Lý do xin duyệt" },
        new_deadline: { type: "string", description: "Hạn chót mới (type extend), YYYY-MM-DD" }
      },
      required: ["task_id", "type", "reason"]
    }
  },
  {
    name: "approve_issue_request",
    description: "Admin duyệt yêu cầu extend deadline (legacy). Archive/delete user tự làm. CHỈ ADMIN.",
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
    name: "review_issue",
    description: "Admin duyệt output task (In Review → Done) hoặc từ chối (→ In Progress). Tuỳ chọn — user đã có thể tự Done. CHỈ ADMIN.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "UUID hoặc shortId PROJ-n" },
        decision: { type: "string", enum: ["approve", "reject"], description: "approve=Done, reject=In Progress" },
        review_note: { type: "string", description: "Ghi chú / lý do từ chối" }
      },
      required: ["task_id", "decision"]
    }
  },
  {
    name: "archive_issue",
    description:
      "Lưu trữ (archive) task — set status cancelled, ẩn khỏi Kanban. Assignee hoặc Admin. Ưu tiên hơn hard-delete khi chỉ cần ẩn.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "UUID hoặc shortId PROJ-n" },
        reason: { type: "string", description: "Ghi chú lý do (tuỳ chọn)" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "delete_issue",
    description:
      "XOÁ VĨNH VIỄN task (hard delete + cascade subtasks). Assignee của task hoặc Admin. Ưu tiên archive_issue nếu chỉ cần ẩn.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "UUID hoặc shortId PROJ-n" },
      },
      required: ["task_id"],
    },
  },
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
      const {
        title,
        project_id,
        assignee,
        priority,
        target_date,
        parent_id,
        description: rawDesc,
        links,
        media_urls,
        tags,
      } = args as any;
      
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
          targetUser = members.find((m: any) => 
            m.fullName.toLowerCase() === lowerAssignee || 
            m.id.toLowerCase() === lowerAssignee ||
            (m.email && m.email.toLowerCase() === lowerAssignee) ||
            (m.telegramUsername && m.telegramUsername.toLowerCase() === lowerAssignee.replace('@', ''))
          );
          if (!targetUser) {
            targetUser = members.find((m: any) => 
               m.fullName.toLowerCase().includes(lowerAssignee) ||
               (m.email && m.email.toLowerCase().includes(lowerAssignee)) ||
               (m.telegramUsername && m.telegramUsername.toLowerCase().includes(lowerAssignee.replace('@', '')))
            );
          }
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

      const noProjectSentinel = (v: any) => {
        if (v == null || v === '') return true;
        const s = String(v).trim().toLowerCase();
        return [
          'default', 'default_no_project', 'none', 'null', 'undefined',
          'no_project', 'no-project', 'inbox', 'dflt', 'all',
          'không thuộc dự án', 'khong thuoc du an',
        ].some((k) => s === k || s.includes(k));
      };

      const pickInboxProject = (allProjects: any[]) => {
        const byIdent = allProjects.find((p: any) =>
          ['DFLT', 'INBOX', 'NONE', 'NOPROJ'].includes(String(p.identifier || '').toUpperCase())
        );
        if (byIdent) return byIdent.id;
        const byName = allProjects.find((p: any) => {
          const n = String(p.name || '').toLowerCase();
          return (
            n.includes('không thuộc dự án') ||
            n.includes('khong thuoc du an') ||
            n.includes('no project') ||
            n.includes('mặc định') ||
            n.includes('mac dinh')
          );
        });
        return byName?.id || null;
      };

      let finalProjectId: string | undefined = project_id;
      // Explicit no-project / skip
      if (noProjectSentinel(finalProjectId)) {
        finalProjectId = undefined;
      }

      if (finalProjectId && finalProjectId.length !== 36) {
          try {
              const projRes = (await apiClient.get(API_ROUTES.PLANE.PROJECTS)) as any;
              const allProjects = projRes.data || [];
              const foundProj = allProjects.find((p: any) =>
                (p.name || '').toLowerCase() === finalProjectId!.toLowerCase() ||
                (p.identifier || '').toLowerCase() === finalProjectId!.toLowerCase()
              );
              
              if (foundProj) {
                  finalProjectId = foundProj.id;
              } else if (!noProjectSentinel(finalProjectId)) {
                  // Chỉ auto-create project khi user chỉ định tên dự án thật (không phải sentinel)
                  let ident = finalProjectId.replace(/[^A-Za-z0-9]/g, '').substring(0, 3).toUpperCase();
                  if (ident.length < 3) ident = "PRJ";
                  const newProj = (await apiClient.post(API_ROUTES.PLANE.PROJECTS, {
                      name: finalProjectId,
                      description: "Tạo tự động qua MCP",
                      identifier: ident
                  })) as any;
                  if (newProj.success !== false && newProj.data) {
                      finalProjectId = newProj.data.id;
                  } else {
                      finalProjectId = undefined;
                  }
              } else {
                  finalProjectId = undefined;
              }
          } catch (e) {
              console.error("Lỗi resolve project:", e);
              finalProjectId = undefined;
          }
      }
      
      // No project → inbox DFLT only (API also auto-resolves if projectId omitted)
      if (!finalProjectId) {
          try {
              const projRes = (await apiClient.get(API_ROUTES.PLANE.PROJECTS)) as any;
              const allProjects = projRes.data || [];
              finalProjectId = pickInboxProject(allProjects) || undefined;
          } catch (e) {}
      }

      // Build rich description: user text + tags + links + media
      const descParts: string[] = [];
      if (rawDesc && String(rawDesc).trim()) descParts.push(String(rawDesc).trim());
      const tagList = Array.isArray(tags) ? tags.map((t: string) => String(t).replace(/^#/, '').trim()).filter(Boolean) : [];
      if (tagList.length) descParts.push('Tags: ' + tagList.map((t: string) => `#${t}`).join(' '));
      const linkList = Array.isArray(links) ? links.map((u: string) => String(u).trim()).filter(Boolean) : [];
      const mediaList = Array.isArray(media_urls) ? media_urls.map((u: string) => String(u).trim()).filter(Boolean) : [];
      if (linkList.length) {
        descParts.push('Tài liệu:\n' + linkList.map((u: string) => `- ${u}`).join('\n'));
      }
      if (mediaList.length) {
        descParts.push('Media:\n' + mediaList.map((u: string) => `- ${u}`).join('\n'));
      }
      if (!descParts.length) descParts.push('Tạo tự động qua Model Context Protocol (MCP)');
      const finalDescription = descParts.join('\n\n');
      const refUrls = [...linkList, ...mediaList];

      let resJson;
          try {
            // Omit projectId if still empty — core-team-api ensureInboxProject handles it
            const body: any = {
                    title,
                    description: finalDescription,
                    assigneeId: targetUser ? targetUser.id : undefined,
                    priority: priority ? priority.toLowerCase() : "medium",
                    targetDate: target_date || undefined,
                    parentId: actualParentId || undefined,
                  };
            // Reference docs/media at create time (same field as submission outputs)
            if (refUrls.length) body.outputUrls = refUrls;
            if (finalProjectId) body.projectId = finalProjectId;
            resJson = (await apiClient.post(API_ROUTES.PLANE.ISSUES, body)) as any;
            
            if (resJson.success === false) {
              throw new Error(resJson.message || "Lỗi tạo issue tại Core API Service.");
            }
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, err.message || "Lỗi tạo issue tại Core API Service.");
          }
      
      const newIssue = resJson.data;
      const newId = newIssue?.id || "N/A";
      const assigneeText = targetUser ? targetUser.fullName : 'Chưa phân công';

      let shortId = newId;
      if (newIssue && newIssue.sequenceId) {
          if (newIssue.Project?.identifier) {
              shortId = `${newIssue.Project.identifier}-${newIssue.sequenceId}`;
          } else {
              try {
                  const projRes = (await apiClient.get(API_ROUTES.PLANE.PROJECTS)) as any;
                  const proj = (projRes.data || []).find((p: any) => p.id === newIssue.projectId);
                  if (proj && proj.identifier) {
                      shortId = `${proj.identifier}-${newIssue.sequenceId}`;
                  }
              } catch(e) {}
          }
      }

      return {
        content: [{
          type: "text",
          text: `Đã tạo công việc thành công! ✓\n• **ID**: ${shortId}\n• **Tiêu đề**: ${title}\n• **Người thực hiện**: ${assigneeText}\n• **Hạn chót**: ${target_date || 'None'}`
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

      // User (assignee) được Done trực tiếp — không còn ép In Review / admin request
      try {
            // Prefer status name so backend mapping + NATS stay consistent (not stateId-only)
            await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${foundIssue.id}`, {
              status: targetState.name,
              stateId: targetState.id,
            });
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

      const lowerAssignee = assignee.toLowerCase();
      let targetUser = members.find((m: any) => 
          m.fullName.toLowerCase() === lowerAssignee || 
          m.id.toLowerCase() === lowerAssignee ||
          (m.email && m.email.toLowerCase() === lowerAssignee) ||
          (m.telegramUsername && m.telegramUsername.toLowerCase() === lowerAssignee.replace('@', ''))
      );
      if (!targetUser) {
        targetUser = members.find((m: any) => 
           m.fullName.toLowerCase().includes(lowerAssignee) ||
           (m.email && m.email.toLowerCase().includes(lowerAssignee)) ||
           (m.telegramUsername && m.telegramUsername.toLowerCase().includes(lowerAssignee.replace('@', '')))
        );
      }
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
      if (!isBoss && assigneeName !== "" && assigneeName.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không được phép cập nhật công việc ${task_id} của người khác.`
        );
      }

      let assigneeId = undefined;
      if (assignee) {
        const lowerAssignee = assignee.toLowerCase();
        let targetMem = members.find((m: any) => 
            m.fullName.toLowerCase() === lowerAssignee || 
            m.id.toLowerCase() === lowerAssignee ||
            (m.email && m.email.toLowerCase() === lowerAssignee) ||
            (m.telegramUsername && m.telegramUsername.toLowerCase() === lowerAssignee.replace('@', ''))
        );
        if (!targetMem) {
          targetMem = members.find((m: any) => 
             m.fullName.toLowerCase().includes(lowerAssignee) ||
             (m.email && m.email.toLowerCase().includes(lowerAssignee)) ||
             (m.telegramUsername && m.telegramUsername.toLowerCase().includes(lowerAssignee.replace('@', '')))
          );
        }
        if (targetMem) assigneeId = targetMem.id;
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
            createdSubtasks.push(item.title);
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
      const { task_id, titles, overwrite } = args as any;

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

      // 2. Hủy các subtask cũ trong cùng dự án mẹ NẾU overwrite = true
      if (overwrite) {
        for (const sub of dbTasks) {
          if (sub.parentId === matchedSubtask.id) {
            try {
                await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${sub.id}`, { status: "cancelled" });
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
            await apiClient.post(API_ROUTES.PLANE.ISSUES, {
                      title: cleanTitle,
                      projectId: matchedSubtask.projectId,
                      description: `Tạo từ yêu cầu cập nhật việc con cho [${task_id}].`,
                      priority: matchedSubtask.priority || "medium",
                      assigneeId: matchedSubtask.assigneeId || undefined,
                      parentId: matchedSubtask.id
                    });
            createdSubtasks.push(cleanTitle);
          } catch (err: any) {
            throw err;
          }
      }

      return {
        content: [{
          type: "text",
          text: titles.length === 0
            ? (overwrite ? `📝 *ĐÃ XÓA TOÀN BỘ CÔNG VIỆC CON CHO ${task_id} THÀNH CÔNG:*\nCông việc gốc: *${matchedSubtask.title}*\nĐã dọn dẹp sạch toàn bộ subtask cũ của công việc này.` : `Không có việc con nào được tạo thêm.`)
            : `📝 *ĐÃ ${overwrite ? 'CẬP NHẬT' : 'TẠO THÊM'} CÁC CÔNG VIỆC CON CHO ${task_id} THÀNH CÔNG:*\n` +
              `Công việc gốc: *${matchedSubtask.title}*\n` +
              (overwrite ? `Đã xóa việc cũ và tạo mới ${createdSubtasks.length} việc con:\n` : `Đã tạo thêm ${createdSubtasks.length} việc con:\n`) +
              createdSubtasks.join("\n")
        }]
      };
    }
case "request_issue_approval": {
      const { task_id, type, reason, new_deadline } = args as any;

      // archive/delete: self-service — không còn chờ admin
      if (type === 'archive' || type === 'delete' || type === 'remove') {
        return executePlaneTool(
          type === 'delete' || type === 'remove' ? 'delete_issue' : 'archive_issue',
          { task_id, reason },
          user,
          isBoss,
          apiClient,
          members,
          username
        );
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
        if (type === 'extend') {
          // Dời deadline: user tự update (không chờ admin)
          await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${foundSubtask.id}`, {
            targetDate: new_deadline || undefined,
            description: `${foundSubtask.description || ''}\n\n[GIA HẠN]: Tới ${new_deadline || '?'}. Lý do: ${reason || 'N/A'}`.trim(),
          });
        } else {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Loại yêu cầu không hỗ trợ: ${type}. Dùng archive_issue / delete_issue / update_issue. Xin nghỉ dùng submit_leave_request.`
          );
        }
      } catch (err: any) {
        if (err instanceof McpError) throw err;
        throw new McpError(ErrorCode.InternalError, `Lỗi gửi yêu cầu: ${err.message || err}`);
      }

      return {
        content: [{
          type: "text",
          text: `Đã cập nhật deadline task ${task_id}${new_deadline ? ` → ${new_deadline}` : ''}.`
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
        if (decision === 'approve') {
          if (type === 'archive' || type === 'delete') {
             await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${foundSubtask.id}`, { status: 'cancelled' });
          } else if (type === 'extend') {
             await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${foundSubtask.id}`, { targetDate: new_deadline || undefined });
          }
        }
        // reject: no-op on state (request is only a note); optional description stamp could be added later
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

    case "archive_issue": {
      const { task_id, reason } = args as any;
      if (!task_id) throw new McpError(ErrorCode.InvalidParams, "Cần task_id");
      let tasksData: any;
      try {
        tasksData = await apiClient.get(API_ROUTES.PLANE.ISSUES);
      } catch {
        throw new McpError(ErrorCode.InternalError, "Lỗi fetch issues");
      }
      const found = findIssueHelper(tasksData.data || [], task_id);
      if (!found) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy task ${task_id}`);
      }
      const assigneeName = found.Assignee?.fullName || "";
      const isAssignee =
        (assigneeName && user.fullName && assigneeName.toLowerCase() === user.fullName.toLowerCase()) ||
        (found.assigneeId && user.id && found.assigneeId === user.id);
      if (!isBoss && !isAssignee) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Chỉ assignee hoặc Admin được lưu trữ task này."
        );
      }
      try {
        const desc = reason
          ? `${found.description || ''}\n\n[ARCHIVE]: ${reason}`.trim()
          : found.description;
        await apiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${found.id}`, {
          status: 'cancelled',
          ...(desc !== found.description ? { description: desc } : {}),
        });
      } catch (err: any) {
        throw new McpError(
          ErrorCode.InternalError,
          `Lỗi archive: ${err?.data?.message || err?.message || err}`
        );
      }
      return {
        content: [{
          type: "text",
          text: `Đã LƯU TRỮ (archive) task ${task_id} (${found.title || ''}). Task ẩn khỏi Kanban.`,
        }],
      };
    }

    case "delete_issue": {
      const { task_id } = args as any;
      if (!task_id) throw new McpError(ErrorCode.InvalidParams, "Cần task_id");
      let tasksData: any;
      try {
        tasksData = await apiClient.get(API_ROUTES.PLANE.ISSUES);
      } catch {
        throw new McpError(ErrorCode.InternalError, "Lỗi fetch issues");
      }
      const found = findIssueHelper(tasksData.data || [], task_id);
      if (!found) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy task ${task_id}`);
      }
      const assigneeName = found.Assignee?.fullName || "";
      const isAssignee =
        (assigneeName && user.fullName && assigneeName.toLowerCase() === user.fullName.toLowerCase()) ||
        (found.assigneeId && user.id && found.assigneeId === user.id);
      if (!isBoss && !isAssignee) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Chỉ assignee của task hoặc Admin được xoá vĩnh viễn. Dùng archive_issue nếu chỉ cần ẩn."
        );
      }
      try {
        await (apiClient as any).delete(`${API_ROUTES.PLANE.ISSUES}/${found.id}`, {
          data: { actorId: user.id, actorEmail: user.email },
        });
      } catch (err: any) {
        throw new McpError(
          ErrorCode.InternalError,
          `Lỗi xoá: ${err?.data?.message || err?.message || err}`
        );
      }
      return {
        content: [{
          type: "text",
          text: `Đã XOÁ VĨNH VIỄN task ${task_id} (${found.title || ''}).`,
        }],
      };
    }

    case "review_issue": {
      if (!isBoss) {
        throw new McpError(ErrorCode.InvalidRequest, "Chỉ Admin mới duyệt output task (review_issue).");
      }
      const { task_id, decision, review_note } = args as any;
      if (!task_id || !decision) {
        throw new McpError(ErrorCode.InvalidParams, "Cần task_id và decision (approve|reject).");
      }
      let tasksData: any;
      try {
        tasksData = await apiClient.get(API_ROUTES.PLANE.ISSUES);
      } catch {
        throw new McpError(ErrorCode.InternalError, "Lỗi fetch issues");
      }
      const found = findIssueHelper(tasksData.data || [], task_id);
      if (!found) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy task ${task_id}`);
      }
      const dec = String(decision).toLowerCase() === 'approve' || String(decision).toLowerCase() === 'approved'
        ? 'approve'
        : 'reject';
      try {
        await apiClient.post(`${API_ROUTES.PLANE.ISSUES}/${found.id}/review`, {
          decision: dec,
          reviewerId: user.id,
          reviewNote: review_note || (dec === 'approve' ? 'Duyệt qua MCP' : 'Từ chối qua MCP'),
        });
      } catch (err: any) {
        throw new McpError(
          ErrorCode.InternalError,
          `Lỗi review: ${err?.data?.message || err?.message || err}`
        );
      }
      return {
        content: [{
          type: "text",
          text: dec === 'approve'
            ? `✅ Đã duyệt task ${task_id} → Done`
            : `❌ Đã từ chối task ${task_id} → In Progress`
        }]
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Công cụ task ${name} chưa được hỗ trợ`);
  }
}
