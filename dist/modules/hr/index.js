"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const meeting_controller_1 = require("../../controllers/meeting.controller");
const announcement_controller_1 = require("../../controllers/announcement.controller");
const hr_controller_1 = require("../../controllers/hr.controller");
const hrTask_controller_1 = require("../../controllers/hrTask.controller");
const admin_controller_1 = require("../../controllers/admin.controller");
const plugin = async (fastify) => {
    // Team members / internal accounts (omni_team_members)
    fastify.get('/team-members', hr_controller_1.HrController.getTeamMembers);
    fastify.post('/team-members', hr_controller_1.HrController.upsertTeamMember);
    fastify.post('/team-members/register', hr_controller_1.HrController.registerTeamMember);
    fastify.post('/team-members/:id/approve', hr_controller_1.HrController.approveMember);
    fastify.post('/team-members/:id/reject', hr_controller_1.HrController.rejectMember);
    fastify.post('/team-members/:id/suspend', hr_controller_1.HrController.suspendMember);
    fastify.post('/team-members/:id/set-admin', hr_controller_1.HrController.setMemberAdmin);
    fastify.delete('/team-members/:id', hr_controller_1.HrController.deleteMember);
    // Login gate — only active accounts
    fastify.get('/auth/lookup', hr_controller_1.HrController.authLookup);
    // Privacy / team settings (admin configurable)
    fastify.get('/settings/privacy', hr_controller_1.HrController.getPrivacySettings);
    fastify.patch('/settings/privacy', hr_controller_1.HrController.updatePrivacySettings);
    // Subtasks routes
    fastify.get('/subtasks', hr_controller_1.HrController.getSubtasks);
    fastify.patch('/subtasks/:id', hr_controller_1.HrController.updateSubTask);
    fastify.post('/subtasks', hr_controller_1.HrController.createSubTask);
    fastify.delete('/subtasks/:id', hr_controller_1.HrController.deleteSubTask);
    // Attendance routes
    fastify.get('/attendance', hr_controller_1.HrController.getAttendance);
    fastify.post('/attendance/checkin', hr_controller_1.HrController.checkin);
    fastify.post('/attendance/checkout', hr_controller_1.HrController.checkout);
    // Projects & Tasks
    fastify.get('/projects', admin_controller_1.AdminController.getProjects);
    fastify.post('/projects', admin_controller_1.AdminController.createProject);
    fastify.delete('/projects/:id', admin_controller_1.AdminController.deleteProject);
    fastify.post('/tasks', admin_controller_1.AdminController.createTask);
    // Leave request routes
    fastify.get('/leave-requests', hr_controller_1.HrController.getLeaveRequests);
    fastify.post('/leave-requests', hr_controller_1.HrController.createLeaveRequest);
    fastify.post('/leave-requests/:id/approve', hr_controller_1.HrController.approveLeaveRequest);
    // Task requests (by employee and admin)
    fastify.post('/tasks/:taskId/request-archive', hr_controller_1.HrController.requestArchiveTask);
    fastify.post('/tasks/:taskId/request', hrTask_controller_1.HrTaskController.requestApproval);
    fastify.post('/tasks/:taskId/approve', hrTask_controller_1.HrTaskController.approveApproval);
    fastify.get('/meetings', meeting_controller_1.MeetingController.getMeetings);
    fastify.post('/meetings', meeting_controller_1.MeetingController.createMeeting);
    fastify.patch('/meetings/:id', meeting_controller_1.MeetingController.updateMeeting);
    fastify.get('/announcements', announcement_controller_1.AnnouncementController.getAnnouncements);
    fastify.post('/announcements', announcement_controller_1.AnnouncementController.createAnnouncement);
    fastify.post('/announcements/:id/read', announcement_controller_1.AnnouncementController.markAsRead);
};
exports.default = plugin;
