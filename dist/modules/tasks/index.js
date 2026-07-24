"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../../config/prisma");
const plugin = async (fastify) => {
    fastify.get('/worker-requests', async (req, reply) => {
        try {
            return reply.code(200).send({ status: 'success', data: [] });
        }
        catch (error) {
            return reply.code(500).send({ status: 'error', message: error.message });
        }
    });
    fastify.get('/projects', async (req, reply) => {
        try {
            const projects = await prisma_1.prisma.omniProject.findMany({
                orderBy: { createdAt: 'desc' },
                take: 50
            });
            return reply.code(200).send({ status: 'success', data: projects });
        }
        catch (error) {
            return reply.code(500).send({ status: 'error', message: error.message });
        }
    });
    fastify.post('/projects', async (req, reply) => {
        try {
            const { name, description } = req.body;
            if (!name)
                return reply.code(400).send({ status: 'error', message: 'Name is required' });
            const key = name.toUpperCase().replace(/\s+/g, '_').substring(0, 10);
            const project = await prisma_1.prisma.omniProject.create({
                data: { name, description, key }
            });
            return reply.code(201).send({ status: 'success', data: project });
        }
        catch (error) {
            return reply.code(500).send({ status: 'error', message: error.message });
        }
    });
    fastify.delete('/projects/:id', async (req, reply) => {
        try {
            const id = req.params.id;
            if (!id)
                return reply.code(400).send({ status: 'error', message: 'Project ID is required' });
            await prisma_1.prisma.omniProject.delete({
                where: { id }
            });
            return reply.send({ status: 'success', message: 'Project deleted successfully' });
        }
        catch (error) {
            return reply.code(500).send({ status: 'error', message: error.message });
        }
    });
    /**
     * FROZEN — legacy omni_tasks write path.
     * SSOT: POST /internal/v1/team/plane/issues
     */
    fastify.post('/tasks', async (_req, reply) => {
        return reply.code(410).send({
            status: 'error',
            success: false,
            code: 'LEGACY_TASK_CREATE_FROZEN',
            message: 'Legacy POST /projects/tasks đã bị đóng băng. Dùng POST /internal/v1/team/plane/issues.',
            migrateTo: {
                method: 'POST',
                path: '/internal/v1/team/plane/issues',
            },
        });
    });
};
exports.default = plugin;
