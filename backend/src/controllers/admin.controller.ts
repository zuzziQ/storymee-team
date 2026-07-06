import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

export class AdminController {
    static async getWorkerRequests(req: Request, res: Response, next: NextFunction) {
        try {
            res.status(200).json({ status: 'success', data: [] });
        } catch (error) {
            next(error);
        }
    }

    static async getProjects(req: Request, res: Response, next: NextFunction) {
        try {
            const projects = await prisma.omniProject.findMany({
                orderBy: { createdAt: 'desc' },
                take: 50
            });
            res.status(200).json({ status: 'success', data: projects });
        } catch (error) {
            next(error);
        }
    }

    static async createProject(req: Request, res: Response, next: NextFunction) {
        try {
            const { name, description } = req.body;
            if (!name) return res.status(400).json({ status: 'error', message: 'Name is required' });

            const key = name.toUpperCase().replace(/\s+/g, '_').substring(0, 10);

            const project = await prisma.omniProject.create({
                data: { name, description, key }
            });
            res.status(201).json({ status: 'success', data: project });
        } catch (error: any) {
            next(error);
        }
    }

    static async deleteProject(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ status: 'error', message: 'Project ID is required' });

            await prisma.omniProject.delete({
                where: { id }
            });
            res.json({ status: 'success', message: 'Project deleted successfully' });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /omnitask/
     * Tạo Task mẹ (container) + SubTask con thực tế (gắn assignee, deadline, priority).
     * Body: {
     *   title: string,
     *   description?: string,
     *   projectId?: string,       // optional - nếu không có thì task không thuộc dự án nào
     *   subtasks?: [{
     *     title: string,
     *     suggestedAssigneeName?: string,
     *     estimatedHours?: number,
     *     priority?: string,
     *     deadlineDays?: number,
     *     deadline?: string,
     *   }]
     * }
     * Nếu không có subtasks thì tự tạo 1 SubTask từ title của task mẹ.
     */
    static async createTask(req: Request, res: Response, next: NextFunction) {
        try {
            const { title, description, projectId, subtasks } = req.body;
            if (!title) return res.status(400).json({ status: 'error', message: 'Title is required' });

            // 1. Tạo Task mẹ (container) - projectId optional
            const parentTask = await prisma.task.create({
                data: {
                    title,
                    description: description || null,
                    projectId: projectId || null,
                    source: 'telegram',
                }
            });

            // 2. Chuẩn bị danh sách subtask
            const subtaskDefs = Array.isArray(subtasks) && subtasks.length > 0
                ? subtasks
                : [{ title, description: description || null }];

            // 3. Đếm SubTask hiện có để auto-increment ID
            const currentCount = await prisma.subTask.count();

            const createdSubtasks = [];
            for (let i = 0; i < subtaskDefs.length; i++) {
                const sub = subtaskDefs[i];

                // Tìm assignee theo tên (fuzzy, case-insensitive)
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

                // Tính deadline từ deadlineDays hoặc deadline ISO string
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

            res.status(201).json({
                status: 'success',
                data: {
                    ...parentTask,
                    subTasks: createdSubtasks
                }
            });
        } catch (error) {
            next(error);
        }
    }
}
