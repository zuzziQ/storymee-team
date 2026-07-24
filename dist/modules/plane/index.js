"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plane_controller_1 = require("../../controllers/plane.controller");
const planeRoutes = async (fastify) => {
    fastify.get('/workspaces', plane_controller_1.PlaneController.getWorkspaces);
    fastify.get('/projects', plane_controller_1.PlaneController.getProjects);
    fastify.post('/projects', plane_controller_1.PlaneController.createProject);
    fastify.delete('/projects/:id', plane_controller_1.PlaneController.deleteProject);
    fastify.get('/issues', plane_controller_1.PlaneController.getIssues);
    fastify.post('/issues', plane_controller_1.PlaneController.createIssue);
    fastify.patch('/issues/:id', plane_controller_1.PlaneController.updateIssue);
    fastify.post('/issues/:id/review', plane_controller_1.PlaneController.reviewIssue); // Admin duyệt task (SSOT)
    fastify.post('/issues/:id/request-archive', plane_controller_1.PlaneController.requestArchive); // Employee xin archive (PlIssue)
    fastify.delete('/issues/:id', plane_controller_1.PlaneController.deleteIssue);
};
exports.default = planeRoutes;
