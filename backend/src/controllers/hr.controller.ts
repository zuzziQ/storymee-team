// @ts-nocheck
import { ITeamMember, ILeaveRequest } from "@storymee/api-client";
import { prisma } from '../config/prisma';
import { HrHandoverService } from '../services/hrHandover.service';
import { HrService } from '../services/hr.service';
import { NotificationService } from '../services/notification.service';
import { StringCodec } from 'nats';

function serialize(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

export class HrController {
  static async getTeamMembers(req: any, reply: any) {
    const members = await HrService.getTeamMembers();
    reply.code(200).send({
      status: 'success',
      data: serialize(members)
    });
  }

  static async upsertTeamMember(req: any, reply: any) {
    const { 
      fullName, telegramUsername, telegramChatId, planeMemberId, email, role, skills, 
      bankName, bankAccount, phone, lettaConversationId,
      workArrangement, annualLeaveLimit, annualLeaveUsed, remoteLimit, remoteUsed, 
      salaryGross, dependentCount, isActive
    } = req.body;
    if (!fullName || !email) {
      reply.code(400).send({
        status: 'error',
        message: 'fullName và email là bắt buộc'
      });
      return;
    }

    const member = await HrService.upsertTeamMember({
      fullName,
      telegramUsername,
      telegramChatId,
      planeMemberId,
      email,
      role,
      skills: skills || [],
      bankName,
      bankAccount,
      phone,
      lettaConversationId,
      workArrangement,
      annualLeaveLimit: annualLeaveLimit !== undefined ? Number(annualLeaveLimit) : undefined,
      annualLeaveUsed: annualLeaveUsed !== undefined ? Number(annualLeaveUsed) : undefined,
      remoteLimit: remoteLimit !== undefined ? Number(remoteLimit) : undefined,
      remoteUsed: remoteUsed !== undefined ? Number(remoteUsed) : undefined,
      salaryGross: salaryGross !== undefined ? Number(salaryGross) : undefined,
      dependentCount: dependentCount !== undefined ? Number(dependentCount) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    });

    reply.code(200).send({
      status: 'success',
      data: serialize(member)
    });
  }

  static async getSubtasks(req: any, reply: any) {
    const subtasks = await HrService.getSubtasks();
    const serialized = serialize(subtasks) as any[];

    // Group by parent Task to produce format: [{ id, title, subTasks: [...] }]
    // This is the format expected by storymeeteam-mcp MCP tools.
    const grouped: Record<string, any> = {};
    for (const sub of serialized) {
      const parentId = sub.taskId || '__no_parent__';
      if (!grouped[parentId]) {
        grouped[parentId] = {
          id: parentId,
          title: sub.Task?.title || sub.title,
          projectId: sub.Task?.projectId || null,
          subTasks: []
        };
      }
      grouped[parentId].subTasks.push(sub);
    }

    reply.code(200).send({
      status: 'success',
      data: Object.values(grouped)
    });
  }

  static async updateSubTask(req: any, reply: any) {
    const { id } = req.params;
    const { status, assigneeId, priority, deadline, estimatedHours, googleSheetRowId, planeTaskId, title, description } = req.body;

    const updated = await HrService.updateSubTask(id, {
      status,
      assigneeId,
      priority,
      deadline,
      estimatedHours,
      googleSheetRowId,
      planeTaskId,
      title,
      description
    });

    reply.code(200).send({
      status: 'success',
      data: serialize(updated)
    });
  }

  static async createSubTask(req: any, reply: any) {
    const { title, estimatedHours, priority, assigneeId, parentTaskId, status, planeTaskId } = req.body;
    const created = await HrService.createSubTask({
      title,
      estimatedHours,
      priority,
      assigneeId,
      parentTaskId,
      status,
      planeTaskId
    });
    reply.code(201).send({
      status: 'success',
      data: serialize(created)
    });
  }

  static async deleteSubTask(req: any, reply: any) {
    const { id } = req.params;
    await HrService.deleteSubTask(id);
    reply.code(200).send({
      status: 'success',
      message: 'Subtask deleted successfully'
    });
  }

  static async getAttendance(req: any, reply: any) {
    const { memberId } = req.query;
    const where = memberId ? { memberId: memberId as string } : {};
    const list = await prisma.attendance.findMany({
      where,
      include: { member: true },
      orderBy: { date: 'desc' }
    });
    reply.code(200).send({ status: 'success', data: serialize(list) });
  }

  /** CHECK-IN: Ghi nhận giờ vào — chỉ tạo mới, không update nếu đã check-in */
  static async checkin(req: any, reply: any) {
    const { memberId, notes, workType } = req.body;
    if (!memberId) {
      reply.code(400).send({ status: 'error', message: 'memberId là bắt buộc' });
      return;
    }

    const now = new Date();
    // Chuyển giờ hệ thống sang giờ VN, sau đó lấy mốc Midnight UTC của ngày hôm đó
    const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    const date = new Date(vnTimeStr);
    date.setHours(0, 0, 0, 0);


    // Kiểm tra đã check-in chưa
    const existing = await prisma.attendance.findUnique({
      where: { memberId_date: { memberId, date } }
    });

    if (existing?.checkIn) {
      reply.code(409).send({
        status: 'already_checked_in',
        message: 'Đã check-in rồi, vui lòng dùng endpoint checkout để check-out.',
        data: serialize(existing)
      });
      return;
    }

    // Xác định trạng thái đúng giờ / đi muộn (sau 9:00)
    const vietNamHour = new Date(vnTimeStr).getHours();
    const status = vietNamHour >= 9 ? 'late' : 'present';

    const attendance = await prisma.attendance.upsert({
      where: { memberId_date: { memberId, date } },
      create: {
        memberId,
        date,
        checkIn: now,
        status,
        workType: workType || 'office',
        notes: notes || `Check-in ${workType === 'remote' ? 'Remote' : 'Văn phòng'}`
      },
      update: {
        checkIn: now,
        status,
        workType: workType || 'office',
        notes: notes || undefined
      },
      include: { member: true }
    });

    reply.code(200).send({ status: 'success', action: 'check_in', data: serialize(attendance) });
  }

  /** CHECK-OUT: Ghi nhận giờ ra — chỉ update nếu đã check-in, tính totalHours */
  static async checkout(req: any, reply: any) {
    const { memberId, notes } = req.body;
    if (!memberId) {
      reply.code(400).send({ status: 'error', message: 'memberId là bắt buộc' });
      return;
    }

    const now = new Date();
    // Chuyển giờ hệ thống sang giờ VN, sau đó lấy mốc Midnight UTC của ngày hôm đó
    const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    const date = new Date(vnTimeStr);
    date.setHours(0, 0, 0, 0);

    const existing = await prisma.attendance.findUnique({
      where: { memberId_date: { memberId, date } }
    });

    if (!existing?.checkIn) {
      reply.code(400).send({ status: 'error', message: 'Chưa check-in, không thể check-out.' });
      return;
    }

    if (existing.checkOut) {
      reply.code(409).send({
        status: 'already_checked_out',
        message: 'Đã check-out rồi hôm nay.',
        data: serialize(existing)
      });
      return;
    }

    // Tính tổng giờ làm (checkIn -> checkOut)
    const checkInTime = new Date(existing.checkIn);
    const diffMs = now.getTime() - checkInTime.getTime();
    let totalHours = diffMs / (1000 * 60 * 60);

    // Trừ giờ nghỉ trưa (12:00 - 13:30)
    const lunchStart = new Date(date);
    lunchStart.setHours(12, 0, 0, 0);
    const lunchEnd = new Date(date);
    lunchEnd.setHours(13, 30, 0, 0);

    const overlapStart = new Date(Math.max(checkInTime.getTime(), lunchStart.getTime()));
    const overlapEnd = new Date(Math.min(now.getTime(), lunchEnd.getTime()));
    
    if (overlapStart < overlapEnd) {
      const overlapHours = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
      totalHours -= overlapHours;
    }
    
    if (totalHours < 0) totalHours = 0;
    totalHours = Math.round(totalHours * 100) / 100; // 2 decimal

    const attendance = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        totalHours,
        notes: notes ? `${existing.notes || ''} | Check-out: ${notes}` : existing.notes
      },
      include: { member: true }
    });

    reply.code(200).send({ status: 'success', action: 'check_out', totalHours, data: serialize(attendance) });
  }

  static async getLeaveRequests(req: any, reply: any) {
    const list = await prisma.leaveRequest.findMany({
      include: { member: true },
      orderBy: { createdAt: 'desc' }
    });
    reply.code(200).send({ status: 'success', data: serialize(list) });
  }

  static async createLeaveRequest(req: any, reply: any) {
    const { memberId, leaveType, startDate, endDate, reason } = req.body;
    if (!memberId || !leaveType || !startDate || !endDate) {
      reply.code(400).send({ status: 'error', message: 'Thiếu thông tin yêu cầu phép' });
      return;
    }

    const request = await prisma.leaveRequest.create({
      data: {
        memberId,
        leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        status: "pending"
      },
      include: { member: true }
    });

    const notif = await NotificationService.createNotification(
      memberId,
      `Yêu cầu nghỉ phép`,
      `Nhân sự xin ${leaveType === 'sick' ? 'nghỉ ốm' : leaveType === 'annual' ? 'nghỉ phép năm' : leaveType === 'remote' ? 'làm remote' : 'nghỉ việc riêng'} từ ${startDate} đến ${endDate}`,
      'leave_request',
      { leaveRequestId: request.id, leaveType, startDate, endDate, reason }
    );

    if (req.server && req.server.nats) {
      const sc = StringCodec();
      req.server.nats.publish('core.team.leave.request', sc.encode(JSON.stringify({
        leaveRequest: request,
        notification: notif
      })));
    }

    reply.code(201).send({ status: 'success', data: serialize(request) });
  }

  static async approveLeaveRequest(req: any, reply: any) {
    const { id } = req.params;
    const { status } = req.body; // "approved" hoặc "rejected"

    const current = await prisma.leaveRequest.findUnique({ where: { id }, include: { member: true } });
    if (!current) {
      reply.code(404).send({ status: 'error', message: 'Không tìm thấy đơn xin nghỉ' });
      return;
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: status || "approved"
      },
      include: { member: true }
    });

    // Nếu approve → cộng số ngày vào counter của member
    if (updated.status === 'approved' && current.status !== 'approved') {
      const start = new Date(current.startDate);
      const end = new Date(current.endDate);
      // Tính số ngày (inclusive, min 1)
      const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);

      const member = current.member;
      if (member) {
        if (current.leaveType === 'annual' || current.leaveType === 'sick') {
          await prisma.teamMember.update({
            where: { id: member.id },
            data: { annualLeaveUsed: { increment: diffDays } }
          });
        } else if (current.leaveType === 'remote') {
          await prisma.teamMember.update({
            where: { id: member.id },
            data: { remoteUsed: { increment: diffDays } }
          });
        }
      }
    }

    // Nếu reject sau khi đã approve trước đó → hoàn trả counter
    if (updated.status === 'rejected' && current.status === 'approved') {
      const start = new Date(current.startDate);
      const end = new Date(current.endDate);
      const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);
      const member = current.member;
      if (member) {
        if (current.leaveType === 'annual' || current.leaveType === 'sick') {
          await prisma.teamMember.update({
            where: { id: member.id },
            data: { annualLeaveUsed: { decrement: diffDays } }
          });
        } else if (current.leaveType === 'remote') {
          await prisma.teamMember.update({
            where: { id: member.id },
            data: { remoteUsed: { decrement: diffDays } }
          });
        }
      }
    }

    let handoverResult = null;
    if (updated.status === 'approved') {
      handoverResult = await HrHandoverService.handleLeaveApproval(updated.id);
    }
    
    const notif = await NotificationService.createNotification(
      updated.memberId,
      updated.status === 'approved' ? `Đơn xin nghỉ được duyệt` : `Đơn xin nghỉ bị từ chối`,
      updated.status === 'approved' ? `Admin đã phê duyệt đơn xin nghỉ của bạn.` : `Admin đã từ chối đơn xin nghỉ của bạn.`,
      'leave_resolved',
      { leaveRequestId: updated.id, status: updated.status }
    );

    if (req.server && req.server.nats) {
      const sc = StringCodec();
      req.server.nats.publish('core.team.leave.resolved', sc.encode(JSON.stringify({
        leaveRequest: updated,
        handover: handoverResult,
        notification: notif
      })));
    }

    reply.code(200).send({
      status: 'success',
      data: {
        leaveRequest: serialize(updated),
        handover: serialize(handoverResult)
      }
    });
  }

  /** Yêu cầu archive task (từ nhân viên) — status -> "archive_requested" */
  static async requestArchiveTask(req: any, reply: any) {
    const { taskId } = req.params;
    const { reason } = req.body;

    const task = await prisma.subTask.findUnique({ where: { id: taskId } });
    if (!task) {
      reply.code(404).send({ status: 'error', message: 'Không tìm thấy task' });
      return;
    }

    const updated = await prisma.subTask.update({
      where: { id: taskId },
      data: {
        status: 'archive_requested',
        description: reason
          ? `${task.description || ''}\n\n[Yêu cầu archive]: ${reason}`
          : task.description
      }
    });

    reply.code(200).send({ status: 'success', message: 'Đã gửi yêu cầu archive, chờ admin xác nhận.', data: serialize(updated) });
  }
}
