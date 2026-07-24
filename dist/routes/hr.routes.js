"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const hr_controller_1 = require("../controllers/hr.controller");
const hrTask_controller_1 = require("../controllers/hrTask.controller");
const admin_controller_1 = require("../controllers/admin.controller");
const router = (0, express_1.Router)();
// Team members routes
router.get('/team-members', hr_controller_1.HrController.getTeamMembers);
router.post('/team-members', hr_controller_1.HrController.upsertTeamMember);
// Subtasks routes
router.get('/subtasks', hr_controller_1.HrController.getSubtasks);
router.patch('/subtasks/:id', hr_controller_1.HrController.updateSubTask);
router.post('/subtasks', hr_controller_1.HrController.createSubTask);
router.delete('/subtasks/:id', hr_controller_1.HrController.deleteSubTask);
// Attendance routes
router.get('/attendance', hr_controller_1.HrController.getAttendance);
router.post('/attendance/checkin', hr_controller_1.HrController.checkin);
router.post('/attendance/checkout', hr_controller_1.HrController.checkout);
// Projects & Tasks
router.get('/projects', admin_controller_1.AdminController.getProjects);
router.post('/projects', admin_controller_1.AdminController.createProject);
router.delete('/projects/:id', admin_controller_1.AdminController.deleteProject);
router.post('/tasks', admin_controller_1.AdminController.createTask);
// Leave request routes
router.get('/leave-requests', hr_controller_1.HrController.getLeaveRequests);
router.post('/leave-requests', hr_controller_1.HrController.createLeaveRequest);
router.post('/leave-requests/:id/approve', hr_controller_1.HrController.approveLeaveRequest);
// Task requests (by employee and admin)
router.post('/tasks/:taskId/request-archive', hr_controller_1.HrController.requestArchiveTask);
router.post('/tasks/:taskId/request', hrTask_controller_1.HrTaskController.requestApproval);
router.post('/tasks/:taskId/approve', hrTask_controller_1.HrTaskController.approveApproval);
exports.default = router;
