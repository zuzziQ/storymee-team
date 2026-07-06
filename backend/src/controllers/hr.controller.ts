// @ts-nocheck
import { ITeamMember, ILeaveRequest } from "@storymee/api-client";
import { ITeamMember, ILeaveRequest } from "@storymee/api-client";
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../config/prisma';
import { HrHandoverService } from '../services/hrHandover.service';
import { HrService } from '../services/hr.service';

function serialize(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

export class HrController {
  static getTeamMembers = asyncHandler(async (req: Request, res: Response) => {
    const members = await HrService.getTeamMembers();
    res.status(200).json({
      status: 'success',
      data: serialize(members)
    });
  });

  static upsertTeamMember = asyncHandler(async (req: Request, res: Response) => {
    const { 
      fullName, telegramUsername, telegramChatId, planeMemberId, email, role, skills, 
      bankName, bankAccount, phone, lettaConversationId,
      workArrangement, annualLeaveLimit, annualLeaveUsed, remoteLimit, remoteUsed, 
      salaryGross, dependentCount 
    } = req.body;
    if (!fullName || !email) {
      res.status(400).json({
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
    });

    res.status(200).json({
      status: 'success',
      data: serialize(member)
    });
  });

  static getSubtasks = asyncHandler(async (req: Request, res: Response) => {
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
          title: sub.title, // fallback title
          subTasks: []
        };
      }
      grouped[parentId].subTasks.push(sub);
    }

    res.status(200).json({
      status: 'success',
      data: Object.values(grouped)
    });
  });

  static updateSubTask = asyncHandler(async (req: Request, res: Response) => {
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

    res.status(200).json({
      status: 'success',
      data: serialize(updated)
    });
  });

  static createSubTask = asyncHandler(async (req: Request, res: Response) => {
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
    res.status(201).json({
      status: 'success',
      data: serialize(created)
    });
  });

  static deleteSubTask = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await HrService.deleteSubTask(id);
    res.status(200).json({
      status: 'success',
      message: 'Subtask deleted successfully'
    });
  });

  static getAttendance = asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.query;
    const where = memberId ? { memberId: memberId as string } : {};
    const list = await prisma.attendance.findMany({
      where,
      include: { member: true },
      orderBy: { date: 'desc' }
    });
    res.status(200).json({ status: 'success', data: serialize(list) });
  });

  /** CHECK-IN: Ghi nhận giờ vào — chỉ tạo mới, không update nếu đã check-in */
  static checkin = asyncHandler(async (req: Request, res: Response) => {
    const { memberId, notes, workType } = req.body;
    if (!memberId) {
      res.status(400).json({ status: 'error', message: 'memberId là bắt buộc' });
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
      res.status(409).json({
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

    res.status(200).json({ status: 'success', action: 'check_in', data: serialize(attendance) });
  });

  /** CHECK-OUT: Ghi nhận giờ ra — chỉ update nếu đã check-in, tính totalHours */
  static checkout = asyncHandler(async (req: Request, res: Response) => {
    const { memberId, notes } = req.body;
    if (!memberId) {
      res.status(400).json({ status: 'error', message: 'memberId là bắt buộc' });
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
      res.status(400).json({ status: 'error', message: 'Chưa check-in, không thể check-out.' });
      return;
    }

    if (existing.checkOut) {
      res.status(409).json({
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

    res.status(200).json({ status: 'success', action: 'check_out', totalHours, data: serialize(attendance) });
  });

  static getLeaveRequests = asyncHandler(async (req: Request, res: Response) => {
    const list = await prisma.leaveRequest.findMany({
      include: { member: true },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', data: serialize(list) });
  });

  static createLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
    const { memberId, leaveType, startDate, endDate, reason } = req.body;
    if (!memberId || !leaveType || !startDate || !endDate) {
      res.status(400).json({ status: 'error', message: 'Thiếu thông tin yêu cầu phép' });
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

    res.status(201).json({ status: 'success', data: serialize(request) });
  });

  static approveLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body; // "approved" hoặc "rejected"

    const current = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!current) {
      res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn xin nghỉ' });
      return;
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: status || "approved"
      },
      include: { member: true }
    });

    let handoverResult = null;
    if (updated.status === 'approved') {
      handoverResult = await HrHandoverService.handleLeaveApproval(updated.id);
    }

    res.status(200).json({
      status: 'success',
      data: {
        leaveRequest: serialize(updated),
        handover: serialize(handoverResult)
      }
    });
  });

  /** Yêu cầu archive task (từ nhân viên) — status -> "archive_requested" */
  static requestArchiveTask = asyncHandler(async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const { reason } = req.body;

    const task = await prisma.subTask.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ status: 'error', message: 'Không tìm thấy task' });
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

    res.status(200).json({ status: 'success', message: 'Đã gửi yêu cầu archive, chờ admin xác nhận.', data: serialize(updated) });
  });
}
