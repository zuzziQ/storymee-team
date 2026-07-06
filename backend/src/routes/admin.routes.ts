import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateApiKey } from '../middlewares/auth';

const router = Router();

router.get('/worker-requests', AdminController.getWorkerRequests);

// Projects and Tasks Management
router.get('/projects', authenticateApiKey, AdminController.getProjects);
router.post('/projects', authenticateApiKey, AdminController.createProject);
router.delete('/projects/:id', authenticateApiKey, AdminController.deleteProject);
router.post('/tasks', authenticateApiKey, AdminController.createTask);

export default router;
