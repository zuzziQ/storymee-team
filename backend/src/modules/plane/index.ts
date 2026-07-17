import { FastifyPluginAsync } from 'fastify';
import { PlaneController } from '../../controllers/plane.controller';

const planeRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/workspaces', PlaneController.getWorkspaces);
    fastify.get('/projects', PlaneController.getProjects);
    fastify.post('/projects', PlaneController.createProject);
    fastify.delete('/projects/:id', PlaneController.deleteProject);
    
    fastify.get('/issues', PlaneController.getIssues);
    fastify.post('/issues', PlaneController.createIssue);
    fastify.patch('/issues/:id', PlaneController.updateIssue);
    fastify.post('/issues/:id/review', PlaneController.reviewIssue); // Admin duyệt task (SSOT)
    fastify.post('/issues/:id/request-archive', PlaneController.requestArchive); // Employee xin archive (PlIssue)
    fastify.delete('/issues/:id', PlaneController.deleteIssue);
};

export default planeRoutes;
