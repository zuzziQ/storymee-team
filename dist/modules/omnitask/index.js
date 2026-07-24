"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hr_controller_1 = require("../../controllers/hr.controller");
const hrTask_controller_1 = require("../../controllers/hrTask.controller");
const admin_controller_1 = require("../../controllers/admin.controller");
const plugin = async (fastify) => {
    // ── Tasks (OmniTask top-level) — MCP calls GET /omnitask/ to list all tasks ──
    // Tasks in our system = SubTasks (the granular work items)
    fastify.get('/', hr_controller_1.HrController.getSubtasks);
    fastify.post('/', admin_controller_1.AdminController.createTask);
    fastify.patch('/tasks/:id', hrTask_controller_1.HrTaskController.updateTask);
    // ── Team members ──────────────────────────────────────────────────────────────
    fastify.get('/team-members', hr_controller_1.HrController.getTeamMembers);
    fastify.post('/team-members', hr_controller_1.HrController.upsertTeamMember);
    // ── Subtasks ──────────────────────────────────────────────────────────────────
    fastify.get('/subtasks', hr_controller_1.HrController.getSubtasks);
    fastify.post('/subtasks', hr_controller_1.HrController.createSubTask);
    fastify.patch('/subtasks/:id', hr_controller_1.HrController.updateSubTask);
    fastify.delete('/subtasks/:id', hr_controller_1.HrController.deleteSubTask);
    // ── HR: Attendance ────────────────────────────────────────────────────────────
    fastify.post('/hr/attendance/checkin', hr_controller_1.HrController.checkin);
    fastify.post('/hr/attendance/checkout', hr_controller_1.HrController.checkout);
    fastify.get('/hr/attendance', hr_controller_1.HrController.getAttendance);
    // ── HR: Leave requests ────────────────────────────────────────────────────────
    fastify.get('/hr/leave-requests', hr_controller_1.HrController.getLeaveRequests);
    fastify.post('/hr/leave-requests', hr_controller_1.HrController.createLeaveRequest);
    fastify.post('/hr/leave-requests/:id/approve', hr_controller_1.HrController.approveLeaveRequest);
    // ── HR: Task approval flow ────────────────────────────────────────────────────
    fastify.post('/hr/tasks/:taskId/request', hrTask_controller_1.HrTaskController.requestApproval);
    fastify.post('/hr/tasks/:taskId/approve', hrTask_controller_1.HrTaskController.approveApproval);
    // ── Projects ──────────────────────────────────────────────────────────────────
    fastify.get('/projects', admin_controller_1.AdminController.getProjects);
    fastify.post('/projects', admin_controller_1.AdminController.createProject);
};
exports.default = plugin;
