import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../config/prisma';

const plugin: FastifyPluginAsync = async (fastify) => {
    fastify.get('/worker-requests', async (req, reply) => {
        try {
            return reply.code(200).send({ status: 'success', data: [] });
        } catch (error: any) {
            return reply.code(500).send({ status: 'error', message: error.message });
        }
    });

    fastify.get('/projects', async (req, reply) => {
        try {
            const projects = await prisma.omniProject.findMany({
                orderBy: { createdAt: 'desc' },
                take: 50
            });
            return reply.code(200).send({ status: 'success', data: projects });
        } catch (error: any) {
            return reply.code(500).send({ status: 'error', message: error.message });
        }
    });

    fastify.post('/projects', async (req: any, reply) => {
        try {
            const { name, description } = req.body;
            if (!name) return reply.code(400).send({ status: 'error', message: 'Name is required' });

            const key = name.toUpperCase().replace(/\s+/g, '_').substring(0, 10);

            const project = await prisma.omniProject.create({
                data: { name, description, key }
            });
            return reply.code(201).send({ status: 'success', data: project });
        } catch (error: any) {
            return reply.code(500).send({ status: 'error', message: error.message });
        }
    });

    fastify.delete('/projects/:id', async (req: any, reply) => {
        try {
            const id = req.params.id as string;
            if (!id) return reply.code(400).send({ status: 'error', message: 'Project ID is required' });

            await prisma.omniProject.delete({
                where: { id }
            });
            return reply.send({ status: 'success', message: 'Project deleted successfully' });
        } catch (error: any) {
            return reply.code(500).send({ status: 'error', message: error.message });
        }
    });

    fastify.post('/tasks', async (req: any, reply) => {
        try {
            const { title, description, projectId, subtasks } = req.body;
            if (!title) return reply.code(400).send({ status: 'error', message: 'Title is required' });

            const parentTask = await prisma.task.create({
                data: {
                    title,
                    description: description || null,
                    projectId: projectId || null,
                    source: 'telegram',
                }
            });

            const subtaskDefs = Array.isArray(subtasks) && subtasks.length > 0
                ? subtasks
                : [{ title, description: description || null }];

            const currentCount = await prisma.subTask.count();
            const createdSubtasks = [];

            for (let i = 0; i < subtaskDefs.length; i++) {
                const sub = subtaskDefs[i];
                let assigneeId: string | null = null;
                
                if (sub.suggestedAssigneeName) {
                    const found = await prisma.teamMember.findFirst({
                        where: {
                            fullName: {
                                contains: sub.suggestedAssigneeName.trim(),
                                mode: 'insensitive'
                            }
                        }
                    });
                    if (found) assigneeId = found.id;
                }

                let deadlineDate: Date | null = null;
                if (sub.deadlineDays && sub.deadlineDays > 0) {
                    deadlineDate = new Date();
                    deadlineDate.setDate(deadlineDate.getDate() + Math.round(sub.deadlineDays));
                } else if (sub.deadline) {
                    deadlineDate = new Date(sub.deadline);
                }

                const idx = currentCount + i + 101;
                const planeTaskId = 'T-' + String(idx).padStart(3, '0');

                const created = await prisma.subTask.create({
                    data: {
                        taskId: parentTask.id,
                        title: sub.title || title,
                        description: sub.description || description || 'Tạo tự động qua Model Context Protocol (MCP)',
                        assigneeId,
                        estimatedHours: sub.estimatedHours || 4,
                        priority: (sub.priority || 'medium').toLowerCase(),
                        status: 'pending',
                        deadline: deadlineDate,
                        planeTaskId
                    },
                    include: { Assignee: true }
                });

                createdSubtasks.push(created);
            }

            return reply.code(201).send({
                status: 'success',
                data: {
                    ...parentTask,
                    subTasks: createdSubtasks
                }
            });
        } catch (error: any) {
            return reply.code(500).send({ status: 'error', message: error.message });
        }
    });
};

export default plugin;
