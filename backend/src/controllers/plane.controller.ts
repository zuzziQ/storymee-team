import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/prisma';

export class PlaneController {
    
    // WORKSPACES
    static async getWorkspaces(req: FastifyRequest, reply: FastifyReply) {
        try {
            const workspaces = await prisma.plWorkspace.findMany({
                include: { projects: true }
            });
            return reply.send({ success: true, data: workspaces });
        } catch (error: any) {
            return reply.status(500).send({ success: false, message: error.message });
        }
    }

    // PROJECTS
    static async getProjects(req: FastifyRequest, reply: FastifyReply) {
        try {
            const projects = await prisma.plProject.findMany({
                include: { states: true, Workspace: true }
            });
            return reply.send({ success: true, data: projects });
        } catch (error: any) {
            return reply.status(500).send({ success: false, message: error.message });
        }
    }

    // ISSUES
    static async getIssues(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { projectId } = req.query as { projectId?: string };
            const whereClause = projectId ? { projectId } : {};
            
            const issues = await prisma.plIssue.findMany({
                where: whereClause,
                include: { State: true, Assignee: true, Project: true, subIssues: true, Parent: true }
            });
            return reply.send({ success: true, data: issues });
        } catch (error: any) {
            return reply.status(500).send({ success: false, message: error.message });
        }
    }

    static async createIssue(req: FastifyRequest, reply: FastifyReply) {
        try {
            const data = req.body as any;
            if (!data.title || !data.projectId) {
                return reply.status(400).send({ success: false, message: "Missing title or projectId" });
            }

            let stateId = data.stateId;
            let workspaceId = data.workspaceId;
            const project = await prisma.plProject.findUnique({
                where: { id: data.projectId },
                include: { states: true }
            });
            if (!project) return reply.status(404).send({ success: false, message: "Project not found" });
            
            if (!workspaceId) workspaceId = project.workspaceId;
            if (!stateId && project.states.length > 0) {
                stateId = project.states.find((s: any) => s.name === 'Todo' || s.group === 'unstarted')?.id || project.states[0].id;
            }

            const newIssue = await prisma.plIssue.create({
                data: {
                    title: data.title,
                    description: data.description,
                    projectId: data.projectId,
                    workspaceId: workspaceId,
                    stateId: stateId!,
                    assigneeId: data.assigneeId,
                    parentId: data.parentId,
                    priority: data.priority || 'medium',
                    startDate: data.startDate ? new Date(data.startDate) : null,
                    targetDate: data.targetDate ? new Date(data.targetDate) : null,
                }
            });
            return reply.send({ success: true, data: newIssue });
        } catch (error: any) {
            return reply.status(500).send({ success: false, message: error.message });
        }
    }

    static async updateIssue(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const data = req.body as any;

            const updated = await prisma.plIssue.update({
                where: { id },
                data: {
                    title: data.title,
                    description: data.description,
                    stateId: data.stateId,
                    assigneeId: data.assigneeId,
                    priority: data.priority,
                    targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
                    startDate: data.startDate ? new Date(data.startDate) : undefined
                }
            });
            return reply.send({ success: true, data: updated });
        } catch (error: any) {
            return reply.status(500).send({ success: false, message: error.message });
        }
    }
}
