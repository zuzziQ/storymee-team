import { Router } from 'express';
import { HrController } from '../controllers/hr.controller';

import { HrTaskController } from '../controllers/hrTask.controller';
import { AdminController } from '../controllers/admin.controller';

const router = Router();

// Team members routes
router.get('/team-members', HrController.getTeamMembers);
router.post('/team-members', HrController.upsertTeamMember);

// Subtasks routes
router.get('/subtasks', HrController.getSubtasks);
router.patch('/subtasks/:id', HrController.updateSubTask);
router.post('/subtasks', HrController.createSubTask);
router.delete('/subtasks/:id', HrController.deleteSubTask);

// Attendance routes
router.get('/attendance', HrController.getAttendance);
router.post('/attendance/checkin', HrController.checkin);
router.post('/attendance/checkout', HrController.checkout);

// Projects & Tasks
router.get('/projects', AdminController.getProjects);
router.post('/projects', AdminController.createProject);
router.delete('/projects/:id', AdminController.deleteProject);
router.post('/tasks', AdminController.createTask);

// Leave request routes
router.get('/leave-requests', HrController.getLeaveRequests);
router.post('/leave-requests', HrController.createLeaveRequest);
router.post('/leave-requests/:id/approve', HrController.approveLeaveRequest);

// Task requests (by employee and admin)
router.post('/tasks/:taskId/request-archive', HrController.requestArchiveTask);
router.post('/tasks/:taskId/request', HrTaskController.requestApproval);
router.post('/tasks/:taskId/approve', HrTaskController.approveApproval);

export default router;
