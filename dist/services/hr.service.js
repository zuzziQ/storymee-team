"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HrService = void 0;
const prisma_1 = require("../config/prisma");
class HrService {
    static async getTeamMembers() {
        return prisma_1.prisma.teamMember.findMany({
            orderBy: { fullName: 'asc' }
        });
    }
    static async upsertTeamMember(data) {
        return prisma_1.prisma.teamMember.upsert({
            where: { email: data.email },
            update: {
                fullName: data.fullName,
                telegramUsername: data.telegramUsername,
                telegramChatId: data.telegramChatId ? BigInt(data.telegramChatId) : null,
                planeMemberId: data.planeMemberId,
                role: data.role,
                skills: data.skills,
                bankName: data.bankName,
                bankAccount: data.bankAccount,
                phone: data.phone,
                lettaConversationId: data.lettaConversationId,
                ...(data.workArrangement !== undefined && { workArrangement: data.workArrangement }),
                ...(data.annualLeaveLimit !== undefined && { annualLeaveLimit: data.annualLeaveLimit }),
                ...(data.annualLeaveUsed !== undefined && { annualLeaveUsed: data.annualLeaveUsed }),
                ...(data.remoteLimit !== undefined && { remoteLimit: data.remoteLimit }),
                ...(data.remoteUsed !== undefined && { remoteUsed: data.remoteUsed }),
                ...(data.salaryGross !== undefined && { salaryGross: data.salaryGross }),
                ...(data.dependentCount !== undefined && { dependentCount: data.dependentCount }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            },
            create: {
                fullName: data.fullName,
                telegramUsername: data.telegramUsername,
                telegramChatId: data.telegramChatId ? BigInt(data.telegramChatId) : null,
                planeMemberId: data.planeMemberId,
                email: data.email,
                role: data.role,
                skills: data.skills,
                bankName: data.bankName,
                bankAccount: data.bankAccount,
                phone: data.phone,
                lettaConversationId: data.lettaConversationId,
                workArrangement: data.workArrangement ?? "office",
                annualLeaveLimit: data.annualLeaveLimit ?? 12,
                annualLeaveUsed: data.annualLeaveUsed ?? 0,
                remoteLimit: data.remoteLimit ?? 4,
                remoteUsed: data.remoteUsed ?? 0,
                salaryGross: data.salaryGross ?? 0,
                dependentCount: data.dependentCount ?? 0,
                isActive: data.isActive ?? true,
            }
        });
    }
    static async getSubtasks() {
        return prisma_1.prisma.subTask.findMany({
            include: { Assignee: true, Task: true },
            orderBy: { createdAt: 'desc' }
        });
    }
    static async updateSubTask(id, updateData) {
        return prisma_1.prisma.subTask.update({
            where: { id },
            data: {
                title: updateData.title,
                description: updateData.description,
                status: updateData.status,
                assigneeId: updateData.assigneeId,
                priority: updateData.priority,
                deadline: updateData.deadline ? new Date(updateData.deadline) : undefined,
                estimatedHours: updateData.estimatedHours,
                googleSheetRowId: updateData.googleSheetRowId,
                planeTaskId: updateData.planeTaskId,
            },
            include: {
                Assignee: true
            }
        });
    }
    static async createSubTask(data) {
        let shortId = data.planeTaskId;
        if (!shortId) {
            const startCount = await prisma_1.prisma.subTask.count();
            shortId = `T-${String(startCount + 101).padStart(3, '0')}`;
        }
        return prisma_1.prisma.subTask.create({
            data: {
                taskId: data.parentTaskId,
                title: data.title,
                estimatedHours: data.estimatedHours || 2,
                priority: data.priority || "medium",
                assigneeId: data.assigneeId || null,
                status: data.status || "pending",
                planeTaskId: shortId
            },
            include: {
                Assignee: true
            }
        });
    }
    static async deleteSubTask(id) {
        return prisma_1.prisma.subTask.delete({
            where: { id }
        });
    }
    /**
     * Tự động chấm công (Check-in)
     */
    static async checkIn(telegramUsername) {
        const username = telegramUsername.replace(/^@/, '').toLowerCase().trim();
        // 1. Tìm Team Member
        const member = await prisma_1.prisma.teamMember.findFirst({
            where: {
                telegramUsername: {
                    equals: username,
                    mode: 'insensitive'
                }
            }
        });
        if (!member) {
            console.warn(`[HrService] TeamMember not found for telegram username: ${telegramUsername}`);
            return null;
        }
        const now = new Date();
        // Lấy ngày hiện tại theo giờ Việt Nam
        const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
        const vnDate = new Date(vnTimeStr);
        // Lấy mốc Midnight UTC của ngày VN đó
        const today = new Date(vnDate.getFullYear(), vnDate.getMonth(), vnDate.getDate());
        // 2. Check xem đã điểm danh hôm nay chưa
        const existingAttendance = await prisma_1.prisma.attendance.findUnique({
            where: {
                memberId_date: {
                    memberId: member.id,
                    date: today
                }
            }
        });
        if (existingAttendance) {
            console.log(`[HrService] Member ${member.fullName} is checking out.`);
            // Tính số giờ làm việc
            const checkInTime = existingAttendance.checkIn || existingAttendance.createdAt;
            const ms = now.getTime() - checkInTime.getTime();
            let hours = ms / 3600000;
            // Trừ giờ nghỉ trưa (12:00 - 13:30)
            const lunchStart = new Date(today);
            lunchStart.setHours(12, 0, 0, 0);
            const lunchEnd = new Date(today);
            lunchEnd.setHours(13, 30, 0, 0);
            const overlapStart = new Date(Math.max(checkInTime.getTime(), lunchStart.getTime()));
            const overlapEnd = new Date(Math.min(now.getTime(), lunchEnd.getTime()));
            if (overlapStart < overlapEnd) {
                const overlapHours = (overlapEnd.getTime() - overlapStart.getTime()) / 3600000;
                hours -= overlapHours;
            }
            if (hours < 0)
                hours = 0;
            const updatedAttendance = await prisma_1.prisma.attendance.update({
                where: { id: existingAttendance.id },
                data: {
                    checkOut: now,
                    totalHours: parseFloat(hours.toFixed(2))
                }
            });
            return {
                attendanceId: updatedAttendance.id,
                status: updatedAttendance.status,
                checkIn: updatedAttendance.checkIn || checkInTime,
                checkOut: updatedAttendance.checkOut || now,
                totalHours: updatedAttendance.totalHours || hours,
                notes: updatedAttendance.notes || '',
                isNew: false
            };
        }
        // 3. Quy định giờ đi muộn: sau 9:00 AM (giờ Việt Nam)
        const vietNamHour = vnDate.getHours();
        const status = vietNamHour >= 9 ? 'late' : 'present';
        const notes = 'Checkin tự động qua Telegram Bot';
        // 4. Tạo bản ghi điểm danh
        const attendance = await prisma_1.prisma.attendance.create({
            data: {
                memberId: member.id,
                date: today,
                checkIn: now,
                status,
                notes
            }
        });
        console.log(`[HrService] Check-in success for ${member.fullName}: ${status}`);
        return {
            attendanceId: attendance.id,
            status: status,
            checkIn: now,
            notes,
            isNew: true
        };
    }
    /**
     * Tạo yêu cầu xin nghỉ phép và tìm nhân sự đề xuất nhận chuyển giao task
     */
    static async createLeaveRequest(telegramUsername, leaveType, startDateStr, endDateStr, reason) {
        const username = telegramUsername.replace(/^@/, '').toLowerCase().trim();
        // 1. Tìm Team Member xin nghỉ
        const member = await prisma_1.prisma.teamMember.findFirst({
            where: {
                telegramUsername: {
                    equals: username,
                    mode: 'insensitive'
                }
            }
        });
        if (!member) {
            console.warn(`[HrService] TeamMember not found for leave request: ${telegramUsername}`);
            return null;
        }
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        // 2. Quét DB tìm các task bị ảnh hưởng (các subtasks chưa hoàn thành có deadline trong khoảng nghỉ)
        const affectedTasks = await prisma_1.prisma.subTask.findMany({
            where: {
                assigneeId: member.id,
                status: {
                    notIn: ['done', 'failed']
                },
                deadline: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                Task: true
            }
        });
        // 3. Tìm nhân sự đề xuất nhận chuyển giao (cùng skills, trống tải nhất hôm nay)
        let suggestedHandover = null;
        if (member.skills && member.skills.length > 0) {
            const potentialMembers = await prisma_1.prisma.teamMember.findMany({
                where: {
                    id: { not: member.id },
                    isActive: true,
                    skills: {
                        hasSome: member.skills
                    }
                }
            });
            const workloads = [];
            for (const pm of potentialMembers) {
                // Tính tải trọng công việc chưa hoàn thành của pm
                const pmTasks = await prisma_1.prisma.subTask.findMany({
                    where: {
                        assigneeId: pm.id,
                        status: { notIn: ['done', 'failed'] }
                    }
                });
                const totalHours = pmTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
                workloads.push({ member: pm, totalHours });
            }
            // Sắp xếp tăng dần theo giờ tải trọng
            workloads.sort((a, b) => a.totalHours - b.totalHours);
            suggestedHandover = workloads[0]?.member || null;
        }
        // 4. Tạo bản ghi LeaveRequest
        const leaveRequest = await prisma_1.prisma.leaveRequest.create({
            data: {
                memberId: member.id,
                leaveType,
                startDate,
                endDate,
                reason,
                status: 'pending',
                handoverMemberId: suggestedHandover ? suggestedHandover.id : null
            },
            include: {
                member: true
            }
        });
        return {
            leaveRequest,
            affectedTasks,
            suggestedHandover
        };
    }
    /**
     * Phê duyệt nghỉ phép và tự động chuyển giao task
     */
    static async approveLeaveRequest(requestId) {
        // 1. Tìm Leave Request
        const leaveRequest = await prisma_1.prisma.leaveRequest.findUnique({
            where: { id: requestId },
            include: {
                member: true
            }
        });
        if (!leaveRequest) {
            console.error(`[HrService] LeaveRequest not found: ${requestId}`);
            return null;
        }
        if (leaveRequest.status !== 'pending') {
            console.warn(`[HrService] LeaveRequest is already ${leaveRequest.status}: ${requestId}`);
            return {
                success: false,
                leaveRequest,
                transferredTasksCount: 0,
                handoverMember: null
            };
        }
        let handoverMember = null;
        let transferredTasksCount = 0;
        // 2. Cập nhật status sang approved
        const updatedRequest = await prisma_1.prisma.leaveRequest.update({
            where: { id: requestId },
            data: { status: 'approved' }
        });
        // 3. Thực hiện chuyển giao các task bị ảnh hưởng sang handover member
        if (leaveRequest.handoverMemberId) {
            handoverMember = await prisma_1.prisma.teamMember.findUnique({
                where: { id: leaveRequest.handoverMemberId }
            });
            if (handoverMember) {
                // Lấy các task của member gốc có deadline nằm trong khoảng nghỉ
                const tasksToTransfer = await prisma_1.prisma.subTask.findMany({
                    where: {
                        assigneeId: leaveRequest.memberId,
                        status: {
                            notIn: ['done', 'failed']
                        },
                        deadline: {
                            gte: leaveRequest.startDate,
                            lte: leaveRequest.endDate
                        }
                    }
                });
                for (const subTask of tasksToTransfer) {
                    await prisma_1.prisma.subTask.update({
                        where: { id: subTask.id },
                        data: {
                            assigneeId: handoverMember.id,
                            description: subTask.description
                                ? `${subTask.description}\n\n[Handover] Tự động chuyển giao từ ${leaveRequest.member.fullName} do nghỉ phép.`
                                : `[Handover] Tự động chuyển giao từ ${leaveRequest.member.fullName} do nghỉ phép.`
                        }
                    });
                    transferredTasksCount++;
                }
                console.log(`[HrService] Transferred ${transferredTasksCount} tasks to ${handoverMember.fullName}`);
            }
        }
        // Gửi thông báo Telegram cho nhân sự xin nghỉ
        if (leaveRequest.member && leaveRequest.member.telegramChatId) {
            const empChatId = Number(leaveRequest.member.telegramChatId);
            const startD = leaveRequest.startDate.toISOString().split('T')[0];
            const endD = leaveRequest.endDate.toISOString().split('T')[0];
            const typeStr = leaveRequest.leaveType === 'sick' ? 'Nghỉ ốm' : leaveRequest.leaveType === 'annual' ? 'Nghỉ phép năm' : leaveRequest.leaveType === 'remote' ? 'Làm Remote' : 'Việc riêng';
            const handoverStr = handoverMember ? `\n• Chuyển giao công việc cho: *${handoverMember.fullName}*` : '';
        }
        return {
            success: true,
            leaveRequest: updatedRequest,
            transferredTasksCount,
            handoverMember
        };
    }
    /**
     * Từ chối nghỉ phép
     */
    static async rejectLeaveRequest(requestId) {
        const leaveRequest = await prisma_1.prisma.leaveRequest.findUnique({
            where: { id: requestId },
            include: { member: true }
        });
        if (!leaveRequest) {
            return null;
        }
        const updated = await prisma_1.prisma.leaveRequest.update({
            where: { id: requestId },
            data: { status: 'rejected' },
            include: { member: true }
        });
        // Gửi thông báo Telegram cho nhân sự xin nghỉ
        if (updated.member && updated.member.telegramChatId) {
            const empChatId = Number(updated.member.telegramChatId);
            const startD = updated.startDate.toISOString().split('T')[0];
            const endD = updated.endDate.toISOString().split('T')[0];
            const typeStr = updated.leaveType === 'sick' ? 'Nghỉ ốm' : updated.leaveType === 'annual' ? 'Nghỉ phép năm' : updated.leaveType === 'remote' ? 'Làm Remote' : 'Việc riêng';
        }
        return updated;
    }
}
exports.HrService = HrService;
