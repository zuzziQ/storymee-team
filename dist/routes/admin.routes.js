"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.get('/worker-requests', admin_controller_1.AdminController.getWorkerRequests);
// Projects and Tasks Management
router.get('/projects', auth_1.authenticateApiKey, admin_controller_1.AdminController.getProjects);
router.post('/projects', auth_1.authenticateApiKey, admin_controller_1.AdminController.createProject);
router.delete('/projects/:id', auth_1.authenticateApiKey, admin_controller_1.AdminController.deleteProject);
router.post('/tasks', auth_1.authenticateApiKey, admin_controller_1.AdminController.createTask);
exports.default = router;
