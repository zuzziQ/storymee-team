import { FastifyPluginAsync } from 'fastify';
import { PlaneController } from '../../controllers/plane.controller';

const planeRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/workspaces', PlaneController.getWorkspaces);
    fastify.get('/projects', PlaneController.getProjects);
    
    fastify.get('/issues', PlaneController.getIssues);
    fastify.post('/issues', PlaneController.createIssue);
    fastify.patch('/issues/:id', PlaneController.updateIssue);
};

export default planeRoutes;
