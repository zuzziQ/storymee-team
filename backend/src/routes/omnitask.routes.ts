/**
 * /omnitask/* routes — compatibility alias for storymeeteam-mcp client.
 *
 * MCP gọi /omnitask/*, nhưng internal route thực là /api/hr/* và /api/admin/*.
 * File này mount lại đúng controller để MCP hoạt động mà không cần thay đổi MCP source.
 *
 * Mapping:
 *   GET  /omnitask/                    → HrTaskController.getTasks
 *   POST /omnitask/                    → AdminController.createTask
 *   GET  /omnitask/team-members        → HrController.getTeamMembers
 *   POST /omnitask/team-members        → HrController.upsertTeamMember
 *   GET  /omnitask/subtasks            → HrController.getSubtasks
 *   POST /omnitask/subtasks            → HrController.createSubTask
 *   PATCH /omnitask/subtasks/:id       → HrController.updateSubTask
 *   DELETE /omnitask/subtasks/:id      → HrController.deleteSubTask
 *   POST /omnitask/hr/attendance/checkin  → HrController.checkin
 *   GET  /omnitask/hr/attendance       → HrController.getAttendance
 *   GET  /omnitask/hr/leave-requests   → HrController.getLeaveRequests
 *   POST /omnitask/hr/leave-request    → HrController.createLeaveRequest
 *   POST /omnitask/hr/leave-requests/:id/approve → HrController.approveLeaveRequest
 *   POST /omnitask/hr/tasks/:id/request → HrTaskController.requestApproval
 *   POST /omnitask/hr/tasks/:id/approve → HrTaskController.approveApproval
 */
import { Router } from 'express';
import { HrController } from '../controllers/hr.controller';
import { HrTaskController } from '../controllers/hrTask.controller';
import { AdminController } from '../controllers/admin.controller';

const router = Router();

// ── Tasks (OmniTask top-level) — MCP calls GET /omnitask/ to list all tasks ──
// Tasks in our system = SubTasks (the granular work items)
router.get('/', HrController.getSubtasks);
router.post('/', AdminController.createTask);

// ── Team members ──────────────────────────────────────────────────────────────
router.get('/team-members', HrController.getTeamMembers);
router.post('/team-members', HrController.upsertTeamMember);

// ── Subtasks ──────────────────────────────────────────────────────────────────
router.get('/subtasks', HrController.getSubtasks);
router.post('/subtasks', HrController.createSubTask);
router.patch('/subtasks/:id', HrController.updateSubTask);
router.delete('/subtasks/:id', HrController.deleteSubTask);

// ── HR: Attendance ────────────────────────────────────────────────────────────
router.post('/hr/attendance/checkin', HrController.checkin);
router.post('/hr/attendance/checkout', HrController.checkout);
router.get('/hr/attendance', HrController.getAttendance);

// ── HR: Leave requests ────────────────────────────────────────────────────────
router.get('/hr/leave-requests', HrController.getLeaveRequests);
router.post('/hr/leave-requests', HrController.createLeaveRequest);
router.post('/hr/leave-requests/:id/approve', HrController.approveLeaveRequest);

// ── HR: Task approval flow ────────────────────────────────────────────────────
router.post('/hr/tasks/:taskId/request', HrTaskController.requestApproval);
router.post('/hr/tasks/:taskId/approve', HrTaskController.approveApproval);

// ── Projects ──────────────────────────────────────────────────────────────────
router.get('/projects', AdminController.getProjects);
router.post('/projects', AdminController.createProject);

export default router;
