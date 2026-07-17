
import { prisma } from '../config/prisma';

export class AdminController {
    static async getWorkerRequests(req: any, reply: any) {
        try {
            reply.code(200).send({ status: 'success', data: [] });
        } catch (error) {
            throw error;
        }
    }

    static async getProjects(req: any, reply: any) {
        try {
            const projects = await prisma.omniProject.findMany({
                orderBy: { createdAt: 'desc' },
                take: 50
            });
            reply.code(200).send({ status: 'success', data: projects });
        } catch (error) {
            throw error;
        }
    }

    static async createProject(req: any, reply: any) {
        try {
            const { name, description } = req.body;
            if (!name) return reply.code(400).send({ status: 'error', message: 'Name is required' });

            const key = name.toUpperCase().replace(/\s+/g, '_').substring(0, 10);

            const project = await prisma.omniProject.create({
                data: { name, description, key }
            });
            reply.code(201).send({ status: 'success', data: project });
        } catch (error: any) {
            throw error;
        }
    }

    static async deleteProject(req: any, reply: any) {
        try {
            const id = req.params.id as string;
            if (!id) return reply.code(400).send({ status: 'error', message: 'Project ID is required' });

            await prisma.omniProject.delete({
                where: { id }
            });
            reply.send({ status: 'success', message: 'Project deleted successfully' });
        } catch (error) {
            throw error;
        }
    }

    /**
     * @deprecated FROZEN 2026-07-17 — dual-write omni_tasks/omni_sub_tasks.
     * SSOT Kanban: POST /internal/v1/team/plane/issues
     * See: 00-Ecosystem-Docs/01-architecture/team/team-work-management.md
     */
    static async createTask(req: any, reply: any) {
        return reply.code(410).send({
            status: 'error',
            success: false,
            code: 'LEGACY_TASK_CREATE_FROZEN',
            message:
                'Legacy OmniTask create (omni_tasks/omni_sub_tasks) đã bị đóng băng. ' +
                'Dùng SSOT: POST /internal/v1/team/plane/issues với body { title, projectId, assigneeId?, priority?, targetDate? }.',
            migrateTo: {
                method: 'POST',
                path: '/internal/v1/team/plane/issues',
                example: {
                    title: 'Task title',
                    projectId: '<pl_project uuid>',
                    assigneeId: '<team_member uuid optional>',
                    priority: 'medium',
                    status: 'todo',
                },
            },
        });
    }
}
