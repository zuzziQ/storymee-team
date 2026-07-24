"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const express_1 = require("express");
const hr_controller_1 = require("../controllers/hr.controller");
const hrTask_controller_1 = require("../controllers/hrTask.controller");
const admin_controller_1 = require("../controllers/admin.controller");
const router = (0, express_1.Router)();
// ── Tasks (OmniTask top-level) — MCP calls GET /omnitask/ to list all tasks ──
// Tasks in our system = SubTasks (the granular work items)
router.get('/', hr_controller_1.HrController.getSubtasks);
router.post('/', admin_controller_1.AdminController.createTask);
router.patch('/tasks/:id', hrTask_controller_1.HrTaskController.updateTask);
// ── Team members ──────────────────────────────────────────────────────────────
router.get('/team-members', hr_controller_1.HrController.getTeamMembers);
router.post('/team-members', hr_controller_1.HrController.upsertTeamMember);
// ── Subtasks ──────────────────────────────────────────────────────────────────
router.get('/subtasks', hr_controller_1.HrController.getSubtasks);
router.post('/subtasks', hr_controller_1.HrController.createSubTask);
router.patch('/subtasks/:id', hr_controller_1.HrController.updateSubTask);
router.delete('/subtasks/:id', hr_controller_1.HrController.deleteSubTask);
// ── HR: Attendance ────────────────────────────────────────────────────────────
router.post('/hr/attendance/checkin', hr_controller_1.HrController.checkin);
router.post('/hr/attendance/checkout', hr_controller_1.HrController.checkout);
router.get('/hr/attendance', hr_controller_1.HrController.getAttendance);
// ── HR: Leave requests ────────────────────────────────────────────────────────
router.get('/hr/leave-requests', hr_controller_1.HrController.getLeaveRequests);
router.post('/hr/leave-requests', hr_controller_1.HrController.createLeaveRequest);
router.post('/hr/leave-requests/:id/approve', hr_controller_1.HrController.approveLeaveRequest);
// ── HR: Task approval flow ────────────────────────────────────────────────────
router.post('/hr/tasks/:taskId/request', hrTask_controller_1.HrTaskController.requestApproval);
router.post('/hr/tasks/:taskId/approve', hrTask_controller_1.HrTaskController.approveApproval);
// ── Projects ──────────────────────────────────────────────────────────────────
router.get('/projects', admin_controller_1.AdminController.getProjects);
router.post('/projects', admin_controller_1.AdminController.createProject);
exports.default = router;
