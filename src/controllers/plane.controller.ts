import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/prisma';
import { PlaneService } from '../services/plane.service';
import { isTeamAdmin, isInReviewState, getAdminEmails } from '../services/teamAuth.service';

function publishNats(fastify: any, subject: string, payload: unknown) {
    if (!fastify?.nats) return;
    try {
        const { StringCodec } = require('nats');
        const sc = StringCodec();
        fastify.nats.publish(subject, sc.encode(JSON.stringify(payload)));
    } catch (e) {
        console.error(`[PlaneController] NATS publish failed (${subject}):`, e);
    }
}

/** Admins with Telegram for fan-out (email allowlist + role keywords). */
async function listTelegramAdmins() {
    const emails = getAdminEmails();
    const members = await prisma.teamMember.findMany({
        where: { telegramChatId: { not: null }, isActive: true },
    });
    return members
        .filter((m: any) => isTeamAdmin(m) || emails.includes((m.email || '').toLowerCase()))
        .map((a: any) => ({
            id: a.id,
            telegramChatId: a.telegramChatId?.toString(),
            fullName: a.fullName,
            email: a.email,
            role: a.role,
        }));
}

/**
 * Bucket "không thuộc dự án nào" — NEVER fall back to first project (e.g. StorymeeTeam).
 * Prefer identifier DFLT / INBOX / NONE, else name match, else create DFLT.
 */
export async function ensureInboxProject() {
    const projects = await prisma.plProject.findMany({ include: { states: true } });
    const byIdent = projects.find((p: any) =>
        ['DFLT', 'INBOX', 'NONE', 'NOPROJ'].includes(String(p.identifier || '').toUpperCase())
    );
    if (byIdent) return byIdent;

    const byName = projects.find((p: any) => {
        const n = String(p.name || '').toLowerCase();
        return (
            n.includes('không thuộc dự án') ||
            n.includes('khong thuoc du an') ||
            n.includes('no project') ||
            n.includes('mặc định') ||
            n.includes('mac dinh')
        );
    });
    if (byName) return byName;

    let workspace = await prisma.plWorkspace.findFirst();
    if (!workspace) {
        workspace = await prisma.plWorkspace.create({
            data: { name: 'Default Workspace', slug: 'default-workspace' },
        });
    }

    const project = await prisma.plProject.create({
        data: {
            name: 'Mặc định (Không thuộc dự án nào)',
            identifier: 'DFLT',
            description: 'Task không gán dự án cụ thể — bucket inbox hệ thống.',
            workspaceId: workspace.id,
        },
    });
    await prisma.plState.createMany({
        data: [
            { name: 'Backlog', group: 'backlog', projectId: project.id, color: '#9ca3af', sequence: 1 },
            { name: 'Todo', group: 'unstarted', projectId: project.id, color: '#3b82f6', sequence: 2 },
            { name: 'In Progress', group: 'started', projectId: project.id, color: '#f59e0b', sequence: 3 },
            { name: 'In Review', group: 'started', projectId: project.id, color: '#8b5cf6', sequence: 4 },
            { name: 'Done', group: 'completed', projectId: project.id, color: '#10b981', sequence: 5 },
        ],
    });
    return prisma.plProject.findUnique({
        where: { id: project.id },
        include: { states: true },
    });
}

function isNoProjectSentinel(v: unknown): boolean {
    if (v == null || v === '') return true;
    const s = String(v).trim().toLowerCase();
    return [
        'default',
        'default_no_project',
        'none',
        'null',
        'undefined',
        'no_project',
        'no-project',
        'inbox',
        'dflt',
        'all',
    ].includes(s);
}

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
                include: { State: true, Assignee: true, Project: true, subIssues: { include: { State: true, Assignee: true } }, Parent: true }
            });
            return reply.send({ success: true, data: issues });
        } catch (error: any) {
            return reply.status(500).send({ success: false, message: error.message });
        }
    }

    static async createIssue(req: FastifyRequest, reply: FastifyReply) {
        try {
            const data = req.body as any;
            if (!data.title) {
                return reply.status(400).send({ success: false, message: "Missing title" });
            }

            // No project selected → inbox DFLT (không thuộc dự án nào). Never auto-pick StorymeeTeam.
            let resolvedProjectId = data.projectId as string | undefined;
            if (isNoProjectSentinel(resolvedProjectId)) {
                const inbox = await ensureInboxProject();
                if (!inbox?.id) {
                    return reply.status(500).send({
                        success: false,
                        message: 'Không tạo được bucket mặc định (DFLT)',
                    });
                }
                resolvedProjectId = inbox.id;
            }

            let stateId = data.stateId;
            let workspaceId = data.workspaceId;
            const project = await prisma.plProject.findUnique({
                where: { id: resolvedProjectId },
                include: { states: true }
            });
            if (!project) return reply.status(404).send({ success: false, message: "Project not found" });
            
            if (!workspaceId) workspaceId = project.workspaceId;
            if (!stateId && data.status && project.states.length > 0) {
                const statusLower = String(data.status).toLowerCase();
                let matchedState = project.states.find((s: any) => 
                    s.name.toLowerCase() === statusLower || 
                    ((statusLower === 'in review' || statusLower === 'in_review') && s.name.toLowerCase() === 'in review')
                );
                if (!matchedState) {
                    if (statusLower === 'in progress' || statusLower === 'in_progress' || statusLower === 'working') {
                        matchedState = project.states.find((s: any) =>
                            s.group === 'started' && !isInReviewState(s) && s.name.toLowerCase().includes('progress')
                        ) || project.states.find((s: any) => s.group === 'started' && !isInReviewState(s));
                    } else {
                        matchedState = project.states.find((s: any) => 
                            ((statusLower === 'backlog') && s.group === 'backlog') ||
                            ((statusLower === 'todo' || statusLower === 'pending') && s.group === 'unstarted') ||
                            ((statusLower === 'done' || statusLower === 'completed') && s.group === 'completed') ||
                            ((statusLower === 'cancelled' || statusLower === 'canceled') && s.group === 'cancelled')
                        );
                    }
                }
                if (matchedState) stateId = matchedState.id;
            }
            if (!stateId && project.states.length > 0) {
                stateId = project.states.find((s: any) => s.name === 'Todo' || s.group === 'unstarted')?.id || project.states[0].id;
            }

            let finalAssigneeId = data.assigneeId;
            if (!finalAssigneeId && data.parentId) {
                const parent = await prisma.plIssue.findUnique({ where: { id: data.parentId }});
                if (parent && parent.assigneeId) {
                    finalAssigneeId = parent.assigneeId;
                }
            }

            const outputUrls = Array.isArray(data.outputUrls)
                ? data.outputUrls
                : Array.isArray(data.links)
                    ? data.links
                    : undefined;

            const newIssue = await prisma.plIssue.create({
                data: {
                    title: data.title,
                    description: data.description || null,
                    projectId: resolvedProjectId!,
                    workspaceId: workspaceId,
                    stateId: stateId!,
                    assigneeId: finalAssigneeId,
                    parentId: data.parentId,
                    priority: data.priority || 'medium',
                    estimateHours: data.estimateHours ? parseFloat(data.estimateHours) : null,
                    startDate: data.startDate ? new Date(data.startDate) : null,
                    targetDate: data.targetDate ? new Date(data.targetDate) : null,
                    // Optional reference links/media at create (Drive, Figma, image URLs…)
                    ...(outputUrls ? { outputUrls } : {}),
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

            const issue = await prisma.plIssue.findUnique({ 
                where: { id }, 
                include: { 
                    Project: { include: { states: true } },
                    Parent: { include: { Project: { include: { states: true } } } },
                    State: true
                } 
            });
            
            if (!issue) {
                return reply.status(404).send({ success: false, message: 'Issue not found' });
            }

            let finalProjectId = data.projectId || issue.projectId;
            let finalStateId = data.stateId;
            let finalStateObj = null;
            
            const isProjectChanged = data.projectId && data.projectId !== issue.projectId;

            // Fetch target project states if project is changed
            let availableStates = issue.Project?.states || issue.Parent?.Project?.states;
            if (isProjectChanged) {
                const newProject = await prisma.plProject.findUnique({
                    where: { id: data.projectId },
                    include: { states: true }
                });
                if (newProject) {
                    availableStates = newProject.states;
                }
            }

            if (!availableStates || availableStates.length === 0) {
                availableStates = await prisma.plState.findMany({ where: { projectId: finalProjectId }});
            }

            // Map Status to State
            if (data.status) {
                const statusLower = String(data.status).toLowerCase();
                finalStateObj = availableStates.find((s: any) => 
                    s.name.toLowerCase() === statusLower || 
                    ((statusLower === 'in review' || statusLower === 'in_review') && s.name.toLowerCase() === 'in review')
                );
                
                if (!finalStateObj) {
                    // Prefer "In Progress" (not "In Review") when mapping generic started-group statuses
                    if (statusLower === 'in progress' || statusLower === 'in_progress' || statusLower === 'working') {
                        finalStateObj = availableStates.find((s: any) =>
                            s.group === 'started' && !isInReviewState(s) && s.name.toLowerCase().includes('progress')
                        ) || availableStates.find((s: any) => s.group === 'started' && !isInReviewState(s));
                    } else {
                        finalStateObj = availableStates.find((s: any) => 
                            ((statusLower === 'backlog') && s.group === 'backlog') ||
                            ((statusLower === 'todo' || statusLower === 'pending') && s.group === 'unstarted') ||
                            ((statusLower === 'done' || statusLower === 'completed') && s.group === 'completed') ||
                            ((statusLower === 'cancelled' || statusLower === 'canceled') && s.group === 'cancelled')
                        );
                    }
                }
                
                // create 'In Review' state if not exists
                if (!finalStateObj && (statusLower === 'in review' || statusLower === 'in_review')) {
                    if (finalProjectId) {
                        finalStateObj = await prisma.plState.create({
                            data: { name: 'In Review', group: 'started', projectId: finalProjectId, color: '#8b5cf6', sequence: 4 }
                        });
                    }
                }
                
                // create 'Cancelled' state if not exists
                if (!finalStateObj && (statusLower === 'cancelled' || statusLower === 'canceled')) {
                    if (finalProjectId) {
                        finalStateObj = await prisma.plState.create({
                            data: { name: 'Cancelled', group: 'cancelled', projectId: finalProjectId, color: '#ef4444', sequence: 5 }
                        });
                    }
                }
            }

            // Resolve stateId-only updates (Telegram/MCP sometimes PATCH stateId without status)
            if (!finalStateObj && data.stateId) {
                finalStateObj = availableStates.find((s: any) => s.id === data.stateId)
                    || await prisma.plState.findUnique({ where: { id: data.stateId } });
                finalStateId = data.stateId;
            }
            
            // Handle project change but no status provided -> map old state to new project's equivalent state
            if (isProjectChanged && !data.status && !data.stateId) {
                const oldStateGroup = issue.State?.group || 'unstarted';
                const oldStateName = issue.State?.name || 'Todo';
                
                finalStateObj = availableStates.find((s: any) => s.name === oldStateName) || 
                                availableStates.find((s: any) => s.group === oldStateGroup) ||
                                availableStates[0];
            }

            if (finalStateObj) {
                finalStateId = finalStateObj.id;
            } else if (isProjectChanged && !finalStateId) {
                // Last resort fallback
                finalStateId = availableStates[0]?.id;
            }

            const wasInReview = isInReviewState(issue.State);

            const updated = await prisma.plIssue.update({
                where: { id },
                data: {
                    title: data.title,
                    description: data.description,
                    ...(finalStateId && { stateId: finalStateId }),
                    ...(data.projectId && { projectId: data.projectId }),
                    ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
                    parentId: data.parentId,
                    priority: data.priority,
                    estimateHours: data.estimateHours !== undefined ? parseFloat(data.estimateHours) : undefined,
                    targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
                    startDate: data.startDate ? new Date(data.startDate) : undefined,
                    ...(data.outputContent !== undefined && { outputContent: data.outputContent }),
                    ...(data.outputUrls !== undefined && { outputUrls: data.outputUrls }),
                    ...(data.submittedById !== undefined && {
                        submittedById: data.submittedById,
                        submittedAt: new Date(),
                    }),
                    // Compat: some clients still PATCH review fields (prefer POST /review)
                    ...(data.reviewNote !== undefined && { reviewNote: data.reviewNote }),
                    ...(data.reviewedById !== undefined && {
                        reviewedById: data.reviewedById,
                        reviewedAt: new Date(),
                    }),
                },
                include: { State: true, Assignee: true, Project: true }
            });

            const fastify: any = req.server;
            publishNats(fastify, 'core.team.issue.updated', updated);

            // Transition INTO In Review (status string OR stateId) → notify admins once
            const enteredInReview = isInReviewState(updated.State) && !wasInReview;
            const explicitSubmit = data.status && ['in_review', 'in review'].includes(String(data.status).toLowerCase());
            if (enteredInReview || (explicitSubmit && isInReviewState(updated.State))) {
                const admins = await listTelegramAdmins();
                publishNats(fastify, 'core.team.task.submitted_for_review', {
                    issue: updated,
                    admins,
                });
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

            // Kiểm tra quyền admin (email allowlist + role keywords)
            const reviewer = await prisma.teamMember.findUnique({ where: { id: reviewerId } });
            if (!isTeamAdmin(reviewer)) {
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

            // Publish NATS để Telegram bot notify assignee (+ Socket bridge)
            const fastify: any = req.server;
            publishNats(fastify, natsEvent, {
                issue: updated,
                reviewer: { fullName: reviewer!.fullName, id: reviewer!.id },
                reviewNote: reviewNote || '',
                assignee: issue.Assignee,
            });
            publishNats(fastify, 'core.team.issue.updated', updated);

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

    /**
     * Employee requests archive on a PlIssue (SSOT).
     * POST /plane/issues/:id/request-archive  { reason }
     * Does NOT delete; notifies admins via NATS for approve/reject.
     */
    static async requestArchive(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const { reason, requesterId } = (req.body || {}) as { reason?: string; requesterId?: string };

            const issue = await prisma.plIssue.findUnique({
                where: { id },
                include: { Assignee: true, Project: true, State: true },
            });
            if (!issue) {
                return reply.status(404).send({ success: false, message: 'Không tìm thấy task (PlIssue)' });
            }

            const note = reason
                ? `${issue.description || ''}\n\n[YÊU CẦU LƯU TRỮ]: ${reason}`.trim()
                : issue.description;

            const updated = await prisma.plIssue.update({
                where: { id },
                data: {
                    description: note,
                    ...(requesterId ? { submittedById: requesterId, submittedAt: new Date() } : {}),
                },
                include: { Assignee: true, Project: true, State: true },
            });

            const shortId = updated.Project?.identifier && updated.sequenceId
                ? `${updated.Project.identifier}-${updated.sequenceId}`
                : updated.id;

            // Shape compatible with Telegram NATS handlers that expect `task`
            const taskShaped = {
                id: updated.id,
                title: updated.title,
                planeTaskId: shortId,
                assigneeId: updated.assigneeId,
                description: updated.description,
            };

            const fastify: any = req.server;
            publishNats(fastify, 'core.team.task.request_approval', {
                task: taskShaped,
                issue: updated,
                type: 'archive',
                reason: reason || '',
            });
            publishNats(fastify, 'core.team.issue.updated', updated);

            return reply.send({
                success: true,
                status: 'success',
                message: 'Đã gửi yêu cầu archive, chờ admin xác nhận.',
                data: updated,
            });
        } catch (error: any) {
            console.error('requestArchive error:', error);
            return reply.status(500).send({ success: false, message: error.message });
        }
    }

    /**
     * DELETE /plane/issues/:id
     * Hard-delete: Admin hoặc assignee của task. Body: { actorId | actorEmail }
     * Cascades sub-issues first. Ưu tiên archive (status cancelled) nếu chỉ cần ẩn.
     */
    static async deleteIssue(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const body = (req.body || {}) as any;
            const actorId = body.actorId || body.reviewerId || (req.query as any)?.actorId;
            const actorEmail = (body.actorEmail || body.reviewerEmail || (req.query as any)?.actorEmail || '')
                .toString()
                .toLowerCase()
                .trim();

            let actor: any = null;
            if (actorId) {
                actor = await prisma.teamMember.findUnique({ where: { id: actorId } });
            } else if (actorEmail) {
                actor = await prisma.teamMember.findFirst({
                    where: { email: { equals: actorEmail, mode: 'insensitive' } },
                });
            }

            const issue = await prisma.plIssue.findUnique({
                where: { id },
                include: {
                    Project: { include: { Workspace: true } },
                    subIssues: true,
                },
            });

            if (!issue) {
                return reply.status(404).send({ success: false, message: 'Issue not found' });
            }

            const isAssignee = !!(actor && issue.assigneeId && actor.id === issue.assigneeId);
            if (!actor || (!isTeamAdmin(actor) && !isAssignee)) {
                return reply.status(403).send({
                    success: false,
                    code: 'FORBIDDEN',
                    message: 'Chỉ assignee của task hoặc Admin được xoá vĩnh viễn. Dùng Archive nếu chỉ cần ẩn.',
                });
            }

            // Delete children first
            if (issue.subIssues?.length) {
                await prisma.plIssue.deleteMany({ where: { parentId: id } });
            }

            const workspaceSlug = issue.Project?.Workspace?.slug || process.env.PLANE_WORKSPACE_SLUG || 'default';
            if (workspaceSlug && issue.projectId) {
                try {
                    await PlaneService.deleteIssue(workspaceSlug, issue.projectId, id);
                } catch (planeErr: any) {
                    console.warn(
                        `[deleteIssue] Plane remote delete skipped: ${planeErr.message}`
                    );
                }
            }

            await prisma.plIssue.delete({ where: { id } });

            publishNats(req.server, 'core.team.issue.deleted', {
                id,
                projectId: issue.projectId,
                deletedBy: actor.id,
                deletedByEmail: actor.email,
                title: issue.title,
            });

            return reply.send({
                success: true,
                message: 'Đã xoá task vĩnh viễn',
                data: { id, title: issue.title },
            });
        } catch (error: any) {
            console.error('Lỗi deleteIssue:', error);
            return reply.status(500).send({ success: false, message: error.message });
        }
    }
}
