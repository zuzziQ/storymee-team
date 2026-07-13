import { MeetingController } from '../../controllers/meeting.controller';
import { AnnouncementController } from '../../controllers/announcement.controller';
import { FastifyPluginAsync } from 'fastify';
import { HrController } from '../../controllers/hr.controller';

import { HrTaskController } from '../../controllers/hrTask.controller';
import { AdminController } from '../../controllers/admin.controller';

const plugin: FastifyPluginAsync = async (fastify) => {

// Team members routes
fastify.get('/team-members', HrController.getTeamMembers);
fastify.post('/team-members', HrController.upsertTeamMember);

// Subtasks routes
fastify.get('/subtasks', HrController.getSubtasks);
fastify.patch('/subtasks/:id', HrController.updateSubTask);
fastify.post('/subtasks', HrController.createSubTask);
fastify.delete('/subtasks/:id', HrController.deleteSubTask);

// Attendance routes
fastify.get('/attendance', HrController.getAttendance);
fastify.post('/attendance/checkin', HrController.checkin);
fastify.post('/attendance/checkout', HrController.checkout);

// Projects & Tasks
fastify.get('/projects', AdminController.getProjects);
fastify.post('/projects', AdminController.createProject);
fastify.delete('/projects/:id', AdminController.deleteProject);
fastify.post('/tasks', AdminController.createTask);

// Leave request routes
fastify.get('/leave-requests', HrController.getLeaveRequests);
fastify.post('/leave-requests', HrController.createLeaveRequest);
fastify.post('/leave-requests/:id/approve', HrController.approveLeaveRequest);

// Task requests (by employee and admin)
fastify.post('/tasks/:taskId/request-archive', HrController.requestArchiveTask);
fastify.post('/tasks/:taskId/request', HrTaskController.requestApproval);
fastify.post('/tasks/:taskId/approve', HrTaskController.approveApproval);

fastify.get('/meetings', MeetingController.getMeetings);
fastify.post('/meetings', MeetingController.createMeeting);
fastify.get('/announcements', AnnouncementController.getAnnouncements);
fastify.post('/announcements', AnnouncementController.createAnnouncement);

};
export default plugin;
