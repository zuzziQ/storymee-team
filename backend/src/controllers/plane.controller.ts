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

    static async createProject(req: FastifyRequest, reply: FastifyReply) {
        try {
            const data = req.body as any;
            if (!data.name) {
                return reply.status(400).send({ success: false, message: "Missing project name" });
            }

            // Get default workspace
            let workspace = await prisma.plWorkspace.findFirst();
            if (!workspace) {
                workspace = await prisma.plWorkspace.create({
                    data: { name: 'Default Workspace', slug: 'default-workspace' }
                });
            }

            let identifier = data.identifier;
            if (!identifier) {
                identifier = data.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'PRO';
                // Add a random number to avoid collision
                identifier += Math.floor(Math.random() * 100).toString();
            }

            const project = await prisma.plProject.create({
                data: {
                    name: data.name,
                    identifier: identifier,
                    description: data.description,
                    workspaceId: workspace.id
                }
            });

            // Create default states
            await prisma.plState.createMany({
                data: [
                    { name: 'Backlog',     group: 'backlog',    projectId: project.id, color: '#9ca3af', sequence: 1 },
                    { name: 'Todo',        group: 'unstarted',  projectId: project.id, color: '#3b82f6', sequence: 2 },
                    { name: 'In Progress', group: 'started',    projectId: project.id, color: '#f59e0b', sequence: 3 },
                    { name: 'In Review',   group: 'started',    projectId: project.id, color: '#8b5cf6', sequence: 4 },
                    { name: 'Done',        group: 'completed',  projectId: project.id, color: '#10b981', sequence: 5 }
                ]
            });

            const finalProject = await prisma.plProject.findUnique({
                where: { id: project.id },
                include: { states: true }
            });

            return reply.send({ success: true, data: finalProject });
        } catch (error: any) {
            console.error("Lỗi createProject:", error);
            return reply.status(500).send({ success: false, message: error.message });
        }
    }
    static async deleteProject(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            
            // Delete related records (states, issues, etc) depending on Prisma schema cascades.
            // If cascade is enabled, deleting the project deletes states and issues.
            // Let's manually delete the project.
            await prisma.plProject.delete({
                where: { id }
            });
            
            return reply.send({ success: true, message: "Deleted project successfully" });
        } catch (error: any) {
            console.error("Lỗi deleteProject:", error);
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
                include: { State: true, Assignee: true, Project: true, subIssues: { include: { State: true } }, Parent: true }
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
                    estimateHours: data.estimateHours ? parseFloat(data.estimateHours) : null,
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

            let finalStateId = data.stateId;
            if (data.status && !finalStateId) {
                const issue = await prisma.plIssue.findUnique({ 
                    where: { id }, 
                    include: { 
                        Project: { include: { states: true } },
                        Parent: { include: { Project: { include: { states: true } } } }
                    } 
                });
                
                let availableStates = issue?.Project?.states || issue?.Parent?.Project?.states;
                if (!availableStates || availableStates.length === 0) {
                    availableStates = await prisma.plState.findMany(); // Fallback to all states in DB
                }

                if (availableStates && availableStates.length > 0) {
                    const statusLower = data.status.toLowerCase();
                    let stateObj = availableStates.find((s: any) => 
                        s.name.toLowerCase() === statusLower || 
                        ((statusLower === 'in review' || statusLower === 'in_review') && s.name.toLowerCase() === 'in review')
                    );
                    
                    if (!stateObj) {
                        stateObj = availableStates.find((s: any) => 
                            ((statusLower === 'backlog') && s.group === 'backlog') ||
                            ((statusLower === 'todo' || statusLower === 'pending') && s.group === 'unstarted') ||
                            ((statusLower === 'in progress' || statusLower === 'in_progress' || statusLower === 'working') && s.group === 'started') ||
                            ((statusLower === 'done' || statusLower === 'completed') && s.group === 'completed') ||
                            ((statusLower === 'cancelled' || statusLower === 'canceled') && s.group === 'cancelled')
                        );
                    }

                    if (!stateObj && (statusLower === 'in review' || statusLower === 'in_review')) {
                        const projectId = issue?.projectId || issue?.Parent?.projectId;
                        if (projectId) {
                            stateObj = await prisma.plState.create({
                                data: { name: 'In Review', group: 'started', projectId: projectId, color: '#8b5cf6', sequence: 4 }
                            });
                        }
                    }

                    if (stateObj) finalStateId = stateObj.id;
                }
            }

            const updated = await prisma.plIssue.update({
                where: { id },
                data: {
                    title: data.title,
                    description: data.description,
                    stateId: finalStateId,
                    assigneeId: data.assigneeId,
                    parentId: data.parentId,
                    priority: data.priority,
                    estimateHours: data.estimateHours !== undefined ? parseFloat(data.estimateHours) : undefined,
                    targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
                    startDate: data.startDate ? new Date(data.startDate) : undefined,
                    // Lưu output khi nhân sự nộp review
                    ...(data.outputContent !== undefined && { outputContent: data.outputContent }),
                    ...(data.outputUrls !== undefined && { outputUrls: data.outputUrls }),
                    ...(data.submittedById !== undefined && {
                        submittedById: data.submittedById,
                        submittedAt: new Date(),
                    }),
                },
                include: { State: true, Assignee: true, Project: true }
            });

            // Publish NATS event
            const fastify: any = req.server;
            if (fastify.nats) {
                try {
                    const { StringCodec } = require('nats');
                    const sc = StringCodec();
                    fastify.nats.publish('core.team.issue.updated', sc.encode(JSON.stringify(updated)));

                    // Nếu chuyển sang In Review — notify admins
                    const isInReview = (data.status === 'in_review' || data.status === 'in review');
                    if (isInReview) {
                        // Fetch admins có telegramChatId
                        const admins = await prisma.teamMember.findMany({
                            where: {
                                telegramChatId: { not: null },
                                OR: [
                                    { role: { contains: 'Founder' } },
                                    { role: { contains: 'IT Admin' } },
                                ]
                            }
                        });
                        fastify.nats.publish('core.team.task.submitted_for_review', sc.encode(JSON.stringify({
                            issue: updated,
                            admins: admins.map((a: any) => ({ id: a.id, telegramChatId: a.telegramChatId?.toString(), fullName: a.fullName })),
                        })));
                    }
                } catch (e) {
                    console.error('Failed to publish NATS event', e);
                }
            }
            
            return reply.send({ success: true, data: updated });
        } catch (error: any) {
            return reply.status(500).send({ success: false, message: error.message });
        }
    }

    /** Admin duyệt hoặc từ chối task — POST /plane/issues/:id/review */
    static async reviewIssue(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const { decision, reviewerId, reviewNote } = req.body as {
                decision: 'approve' | 'reject';
                reviewerId: string;
                reviewNote?: string;
            };

            if (!decision || !reviewerId) {
                return reply.status(400).send({ success: false, message: 'Missing decision or reviewerId' });
            }

            // Kiểm tra quyền admin
            const reviewer = await prisma.teamMember.findUnique({ where: { id: reviewerId } });
            const isAdmin = reviewer?.role?.includes('Founder') ||
                reviewer?.role?.includes('IT Admin');
            if (!isAdmin) {
                return reply.status(403).send({ success: false, message: 'Không có quyền phê duyệt' });
            }

            // Lấy issue hiện tại
            const issue = await prisma.plIssue.findUnique({
                where: { id },
                include: { Project: { include: { states: true } }, Assignee: true }
            });
            if (!issue) return reply.status(404).send({ success: false, message: 'Không tìm thấy task' });

            const states = issue.Project?.states || [];
            let newStateId: string | undefined;
            let natsEvent: string;

            if (decision === 'approve') {
                const doneState = states.find((s: any) => s.group === 'completed') ||
                    await prisma.plState.findFirst({ where: { projectId: issue.projectId, group: 'completed' } });
                newStateId = doneState?.id;
                natsEvent = 'core.team.task.review_approved';
            } else {
                const inProgressState = states.find((s: any) => s.group === 'started' && s.name.toLowerCase().includes('progress')) ||
                    states.find((s: any) => s.group === 'started') ||
                    await prisma.plState.findFirst({ where: { projectId: issue.projectId, group: 'started' } });
                newStateId = inProgressState?.id;
                natsEvent = 'core.team.task.review_rejected';
            }

            if (!newStateId) {
                return reply.status(500).send({ success: false, message: 'Không tìm thấy trạng thái phù hợp' });
            }

            const updated = await prisma.plIssue.update({
                where: { id },
                data: {
                    stateId: newStateId,
                    reviewNote: reviewNote || null,
                    reviewedAt: new Date(),
                    reviewedById: reviewerId,
                },
                include: { State: true, Assignee: true }
            });

            // Publish NATS để Telegram bot notify assignee
            const fastify: any = req.server;
            if (fastify.nats) {
                try {
                    const { StringCodec } = require('nats');
                    const sc = StringCodec();
                    fastify.nats.publish(natsEvent, sc.encode(JSON.stringify({
                        issue: updated,
                        reviewer: { fullName: reviewer.fullName, id: reviewer.id },
                        reviewNote: reviewNote || '',
                        assignee: issue.Assignee,
                    })));
                } catch (e) {
                    console.error('NATS publish error:', e);
                }
            }

            return reply.send({
                success: true,
                message: decision === 'approve' ? 'Đã duyệt task, chuyển sang Done.' : 'Đã từ chối, trả về In Progress.',
                data: updated
            });
        } catch (error: any) {
            console.error('reviewIssue error:', error);
            return reply.status(500).send({ success: false, message: error.message });
        }
    }
}
