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
import { FastifyPluginAsync } from 'fastify';
import { HrController } from '../../controllers/hr.controller';
import { HrTaskController } from '../../controllers/hrTask.controller';
import { AdminController } from '../../controllers/admin.controller';

const plugin: FastifyPluginAsync = async (fastify) => {

// ── Tasks (OmniTask top-level) — MCP calls GET /omnitask/ to list all tasks ──
// Tasks in our system = SubTasks (the granular work items)
fastify.get('/', HrController.getSubtasks);
fastify.post('/', AdminController.createTask);
fastify.patch('/tasks/:id', HrTaskController.updateTask);

// ── Team members ──────────────────────────────────────────────────────────────
fastify.get('/team-members', HrController.getTeamMembers);
fastify.post('/team-members', HrController.upsertTeamMember);

// ── Subtasks ──────────────────────────────────────────────────────────────────
fastify.get('/subtasks', HrController.getSubtasks);
fastify.post('/subtasks', HrController.createSubTask);
fastify.patch('/subtasks/:id', HrController.updateSubTask);
fastify.delete('/subtasks/:id', HrController.deleteSubTask);

// ── HR: Attendance ────────────────────────────────────────────────────────────
fastify.post('/hr/attendance/checkin', HrController.checkin);
fastify.post('/hr/attendance/checkout', HrController.checkout);
fastify.get('/hr/attendance', HrController.getAttendance);

// ── HR: Leave requests ────────────────────────────────────────────────────────
fastify.get('/hr/leave-requests', HrController.getLeaveRequests);
fastify.post('/hr/leave-requests', HrController.createLeaveRequest);
fastify.post('/hr/leave-requests/:id/approve', HrController.approveLeaveRequest);

// ── HR: Task approval flow ────────────────────────────────────────────────────
fastify.post('/hr/tasks/:taskId/request', HrTaskController.requestApproval);
fastify.post('/hr/tasks/:taskId/approve', HrTaskController.approveApproval);

// ── Projects ──────────────────────────────────────────────────────────────────
fastify.get('/projects', AdminController.getProjects);
fastify.post('/projects', AdminController.createProject);

};
export default plugin;
