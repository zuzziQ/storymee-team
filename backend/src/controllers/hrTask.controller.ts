// @ts-nocheck
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../config/prisma';

function serialize(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

export class HrTaskController {
  static requestApproval = asyncHandler(async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const { type, reason, newDeadline } = req.body;

    const task = await prisma.subTask.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ status: 'error', message: 'Không tìm thấy task' });
      return;
    }

    let statusToSet = task.status;
    let descUpdate = task.description || '';

    if (type === 'archive') {
      statusToSet = 'pending_archive';
      descUpdate = `${descUpdate}\n\n[YÊU CẦU LƯU TRỮ]: ${reason || 'Không có lý do'}`;
    } else if (type === 'extend') {
      statusToSet = 'pending_extension';
      descUpdate = `${descUpdate}\n\n[YÊU CẦU GIA HẠN]: Tới ngày ${newDeadline}. Lý do: ${reason || 'Không có lý do'}`;
    }

    const updated = await prisma.subTask.update({
      where: { id: taskId },
      data: {
        status: statusToSet,
        description: descUpdate
      }
    });

    res.status(200).json({ status: 'success', message: 'Đã gửi yêu cầu, chờ Admin duyệt.', data: serialize(updated) });
  });

  static approveApproval = asyncHandler(async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const { type, decision, newDeadline } = req.body;

    const task = await prisma.subTask.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ status: 'error', message: 'Không tìm thấy task' });
      return;
    }

    if (decision === 'reject') {
      const updated = await prisma.subTask.update({
        where: { id: taskId },
        data: {
          status: 'pending', // Revert to pending or previous state (we assume pending for simplicity)
          description: `${task.description}\n\n[ADMIN TỪ CHỐI]: Yêu cầu ${type} không được duyệt.`
        }
      });
      res.status(200).json({ status: 'success', message: 'Đã từ chối yêu cầu.', data: serialize(updated) });
      return;
    }

    if (type === 'archive') {
      const updated = await prisma.subTask.update({
        where: { id: taskId },
        data: { status: 'archived' }
      });
      res.status(200).json({ status: 'success', message: 'Đã lưu trữ task.', data: serialize(updated) });
    } else if (type === 'extend') {
      const updated = await prisma.subTask.update({
        where: { id: taskId },
        data: { 
          status: 'pending', 
          deadline: newDeadline ? new Date(newDeadline) : task.deadline
        }
      });
      res.status(200).json({ status: 'success', message: 'Đã gia hạn deadline.', data: serialize(updated) });
    } else {
      res.status(400).json({ status: 'error', message: 'Loại yêu cầu không hợp lệ' });
    }
  });
}

