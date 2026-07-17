import { useState } from 'react';
import { Task, TeamMember, Project, Priority } from '../../../constants';
import { coreApiClient } from '../../../../lib/apiClient';
import { API_ROUTES } from '@/lib/apiClient';
import { mapIssueStatus, toApiStatus } from '@/lib/taskStatus';
import { resolveCreateProjectId } from '@/lib/projectInbox';

const formatLocalTime = (isoString: string) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function useTaskState() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dbTaskError, setDbTaskError] = useState<string | null>(null);

  const fetchTasksData = async () => {
    try {
      const issuesData = await coreApiClient.get(API_ROUTES.PLANE.ISSUES);
      if ((issuesData.status === 'success' || issuesData.success === true) && Array.isArray(issuesData.data)) {
        const dbIssues = issuesData.data;
        const mappedTasks: any[] = dbIssues.filter((issue: any) => !issue.parentId).map((issue: any) => {
          const group = issue.State?.group || 'unstarted';
          const nameLower = (issue.State?.name || '').toLowerCase();
          const mappedStatus = mapIssueStatus(nameLower, group);

          const subtasks = (issue.subIssues || []).map((c: any) => {
            const cGroup = c.State?.group || 'unstarted';
            const cName = (c.State?.name || '').toLowerCase();
            let cStatus = 'pending';
            if (cName === 'in review' || cName === 'in_review') cStatus = 'in_review';
            else if (cName === 'working' || cName === 'in progress' || cGroup === 'started') cStatus = 'working';
            else if (cGroup === 'completed' || cGroup === 'cancelled') cStatus = 'done';
            return {
              id: c.id, dbId: c.id, title: c.title,
              isDone: cGroup === 'completed' || cName === 'done',
              status: cStatus,
              assignee: c.Assignee?.fullName || issue.Assignee?.fullName || 'Chưa phân công'
            };
          });

          return {
            id: (issue.Project?.identifier && issue.sequenceId) ? `${issue.Project.identifier}-${issue.sequenceId}` : issue.id,
            dbId: issue.id,
            title: issue.title,
            description: issue.description || '',
            assignee: issue.Assignee ? issue.Assignee.fullName : 'Chưa phân công',
            assigneeId: issue.assigneeId || null,
            createdAt: issue.createdAt || new Date().toISOString(),
            priority: (issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)),
            status: mappedStatus,
            deadline: formatLocalTime(issue.targetDate),
            estimate: issue.estimateHours ? parseFloat(issue.estimateHours) : 0,
            parentTaskId: null,
            projectId: issue.projectId || 'default_no_project',
            outputSuggested: '',
            // Review fields
            outputContent: issue.outputContent || '',
            outputUrls: Array.isArray(issue.outputUrls) ? issue.outputUrls : [],
            submittedAt: issue.submittedAt || null,
            reviewNote: issue.reviewNote || '',
            reviewedAt: issue.reviewedAt || null,
            subtasks
          };
        });
        setTasks(mappedTasks);
        setDbTaskError(null);
      }
    } catch (err) {
      console.error('Lỗi fetch tasks:', err);
      setDbTaskError('Không thể tải danh sách công việc từ Core API.');
    }
  };

  const handleUpdateTask = async (
    task: Task,
    teamMembers: TeamMember[],
    onRefresh: () => void
  ) => {
    setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    try {
      const apiStatus = toApiStatus(task.status);
      const matchedMember = teamMembers.find(m => m.name === task.assignee);
      const subtaskId = task.dbId || task.id;
      let isoTargetDate: string | undefined;
      if (task.deadline && task.deadline !== 'None') {
        try {
          const d = new Date(task.deadline);
          if (!isNaN(d.getTime())) isoTargetDate = d.toISOString();
        } catch {}
      }
      await coreApiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${subtaskId}`, {
        title: task.title || undefined,
        status: apiStatus,
        assigneeId: matchedMember ? matchedMember.id : undefined,
        priority: task.priority ? task.priority.toLowerCase() : undefined,
        targetDate: isoTargetDate,
        estimateHours: task.estimate || undefined,
        projectId: task.projectId || undefined
      });
      onRefresh();
    } catch (err) {
      console.error('Lỗi cập nhật task:', err);
    }
  };

  const handleCreateTask = async (
    title: string,
    assignee: string,
    estimate: number,
    priority: Priority,
    activeProjectId: string,
    teamMembers: TeamMember[],
    projects: Project[],
    onRefresh: () => void,
    status?: string
  ) => {
    try {
      const matchedMember = teamMembers.find(m => m.name === assignee);
      // Filter "all" / no selection → DFLT (Không thuộc dự án nào), NEVER projects[0]/StorymeeTeam
      const targetProjectId = resolveCreateProjectId(activeProjectId, projects as any);
      const body: any = {
        title,
        priority: priority.toLowerCase(),
        assigneeId: matchedMember ? matchedMember.id : null,
        estimateHours: estimate || undefined,
        status: status
      };
      // Omit projectId if still null — API resolves inbox DFLT
      if (targetProjectId) body.projectId = targetProjectId;
      await coreApiClient.post(API_ROUTES.PLANE.ISSUES, body);
      onRefresh();
    } catch (err) {
      console.error('Lỗi tạo task:', err);
      alert('Không thể tạo công việc: ' + (err as any)?.message || String(err));
    }
  };

  const handleCreateSubtask = async (
    title: string,
    parentTaskId: string,
    projectId: string,
    onRefresh: () => void
  ) => {
    try {
      await coreApiClient.post(API_ROUTES.PLANE.ISSUES, {
        title, parentId: parentTaskId, projectId, priority: 'medium'
      });
      onRefresh();
    } catch (err) {
      console.error('Lỗi tạo subtask:', err);
    }
  };

  const handleUpdateSubtaskState = async (
    subtaskId: string,
    isDone: boolean,
    onRefresh: () => void
  ) => {
    try {
      await coreApiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${subtaskId}`, {
        status: isDone ? 'done' : 'pending'
      });
      onRefresh();
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái subtask:', err);
    }
  };

  const handleArchiveTaskDirect = async (
    task: { id: string; dbId?: string; title?: string },
    onRefresh: () => void
  ) => {
    const dbId = task.dbId || task.id;
    if (!window.confirm(`Đưa task "${task.title || task.id}" vào Lưu trữ (Archive)?`)) return;
    try {
      await coreApiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${dbId}`, { status: 'cancelled' });
      setTasks(prev => prev.filter(t => t.id !== task.id));
      onRefresh();
    } catch (err) {
      console.error('Lỗi lưu trữ task:', err);
      alert('Không thể lưu trữ task: ' + String(err));
    }
  };

  /** Hard-delete — assignee hoặc admin (API enforce). Cascade subtasks. */
  const handleDeleteTaskHard = async (
    task: { id: string; dbId?: string; title?: string },
    actor: { id?: string; email?: string },
    onRefresh: () => void
  ) => {
    const dbId = task.dbId || task.id;
    const ok = window.confirm(
      `⚠️ XOÁ VĨNH VIỄN task "${task.title || task.id}"?\n\nThao tác này không thể hoàn tác (cả subtask con). Nên dùng Archive nếu chỉ muốn ẩn.`
    );
    if (!ok) return;
    try {
      await coreApiClient.delete(API_ROUTES.PLANE.issueDelete(dbId), {
        actorId: actor.id,
        actorEmail: actor.email,
      } as any);
      setTasks((prev) => prev.filter((t) => t.id !== task.id && t.dbId !== dbId));
      onRefresh();
    } catch (err: any) {
      console.error('Lỗi xoá task:', err);
      alert(
        'Không thể xoá task: ' +
          (err?.data?.message || err?.message || String(err))
      );
    }
  };

  const handleRequestArchive = async (
    task: { id: string; dbId?: string },
    reason: string,
    onRefresh: () => void
  ) => {
    // SSOT: PlIssue via /plane/issues/:id/request-archive (không dùng legacy /hr/tasks SubTask)
    const dbId = task.dbId || task.id;
    try {
      await coreApiClient.post(`${API_ROUTES.PLANE.ISSUES}/${dbId}/request-archive`, { reason });
      alert('✅ Đã gửi yêu cầu archive. Admin sẽ xem xét và xác nhận.');
      onRefresh();
    } catch (err) {
      console.error('Lỗi gửi yêu cầu archive:', err);
      alert('Không thể gửi yêu cầu archive: ' + String((err as any)?.message || err));
    }
  };

  /** Nộp output và chuyển task sang "In Review" — nhân sự gọi */
  const handleSubmitForReview = async (
    task: Task,
    outputContent: string,
    outputUrls: string[], // array of URL strings
    submitterId: string,
    onRefresh: () => void
  ) => {
    const dbId = task.dbId || task.id;
    try {
      await coreApiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${dbId}`, {
        status: 'in_review',
        outputContent,
        outputUrls,
        submittedById: submitterId,
      });
      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? { ...t, status: 'In Review' as any, outputContent, outputUrls, submittedAt: new Date().toISOString() }
          : t
      ));
      onRefresh();
    } catch (err) {
      console.error('Lỗi nộp output:', err);
      throw err;
    }
  };

  /** Admin duyệt hoặc từ chối task */
  const handleReviewDecision = async (
    taskId: string,
    taskDbId: string,
    decision: 'approve' | 'reject',
    reviewerId: string,
    reviewNote: string,
    onRefresh: () => void
  ) => {
    try {
      await coreApiClient.post(API_ROUTES.PLANE.issueReview(taskDbId), {
        decision,
        reviewerId,
        reviewNote,
      });
      if (decision === 'approve') {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Done' as any } : t));
      } else {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'In Progress' as any, reviewNote } : t));
      }
      onRefresh();
    } catch (err) {
      console.error('Lỗi duyệt task:', err);
      throw err;
    }
  };

  return {
    tasks,
    setTasks,
    dbTaskError,
    fetchTasksData,
    handleUpdateTask,
    handleCreateTask,
    handleCreateSubtask,
    handleUpdateSubtaskState,
    handleArchiveTaskDirect,
    handleDeleteTaskHard,
    handleRequestArchive,
    handleSubmitForReview,
    handleReviewDecision,
  };
}
