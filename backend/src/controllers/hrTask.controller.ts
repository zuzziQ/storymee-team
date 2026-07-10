// @ts-nocheck

import { prisma } from '../config/prisma';
import { NotificationService } from '../services/notification.service';
import { StringCodec } from 'nats';

function serialize(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

export class HrTaskController {
  static async requestApproval(req: any, reply: any) {
    const { taskId } = req.params;
    const { type, reason, newDeadline } = req.body;

    const task = await prisma.subTask.findUnique({ where: { id: taskId } });
    if (!task) {
      reply.code(404).send({ status: 'error', message: 'Không tìm thấy task' });
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

    // 1. Lưu Notification cho Admin (Ở đây ta tạo Notification chung, hoặc gán memberId của requester để track)
    // Tạm thời lưu cho người xin với status unread để track (có thể cải tiến thêm sau)
    const notif = await NotificationService.createNotification(
      updated.assigneeId || 'system',
      `Yêu cầu phê duyệt công việc`,
      `Nhân sự xin ${type === 'archive' ? 'lưu trữ' : 'gia hạn'} công việc: ${updated.title}`,
      'task_approval',
      { taskId: updated.id, type, reason, newDeadline, assigneeId: updated.assigneeId, planeTaskId: updated.planeTaskId }
    );

    // 2. Publish NATS event để Telegram Bot / SocketIO xử lý
    if (req.server && req.server.nats) {
      const sc = StringCodec();
      req.server.nats.publish('core.team.task.request_approval', sc.encode(JSON.stringify({
        task: updated,
        notification: notif,
        type,
        reason,
        newDeadline
      })));
    }

    reply.code(200).send({ status: 'success', message: 'Đã gửi yêu cầu, chờ Admin duyệt.', data: serialize(updated) });
  }

  static async approveApproval(req: any, reply: any) {
    const { taskId } = req.params;
    const { type, decision, newDeadline } = req.body;

    const task = await prisma.subTask.findUnique({ where: { id: taskId } });
    if (!task) {
      reply.code(404).send({ status: 'error', message: 'Không tìm thấy task' });
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
      
      const notif = await NotificationService.createNotification(
        updated.assigneeId || 'system',
        `Yêu cầu bị từ chối`,
        `Admin đã từ chối yêu cầu ${type === 'archive' ? 'lưu trữ' : 'gia hạn'} cho công việc: ${updated.title}`,
        'task_approval_rejected',
        { taskId: updated.id, type }
      );
      if (req.server && req.server.nats) {
        const sc = StringCodec();
        req.server.nats.publish('core.team.task.rejected', sc.encode(JSON.stringify({ task: updated, notification: notif })));
      }

      reply.code(200).send({ status: 'success', message: 'Đã từ chối yêu cầu.', data: serialize(updated) });
      return;
    }

    if (type === 'archive') {
      const updated = await prisma.subTask.update({
        where: { id: taskId },
        data: { status: 'archived' }
      });
      
      const notif = await NotificationService.createNotification(updated.assigneeId || 'system', 'Yêu cầu được phê duyệt', `Admin đã duyệt lưu trữ công việc: ${updated.title}`, 'task_approval_approved', { taskId: updated.id });
      if (req.server && req.server.nats) req.server.nats.publish('core.team.task.approved', StringCodec().encode(JSON.stringify({ task: updated, notification: notif })));
      
      reply.code(200).send({ status: 'success', message: 'Đã lưu trữ task.', data: serialize(updated) });
    } else if (type === 'extend') {
      const updated = await prisma.subTask.update({
        where: { id: taskId },
        data: { 
          status: 'pending', 
          deadline: newDeadline ? new Date(newDeadline) : task.deadline
        }
      });
      
      const notif = await NotificationService.createNotification(updated.assigneeId || 'system', 'Yêu cầu được phê duyệt', `Admin đã duyệt gia hạn công việc: ${updated.title} tới ${newDeadline}`, 'task_approval_approved', { taskId: updated.id });
      if (req.server && req.server.nats) req.server.nats.publish('core.team.task.approved', StringCodec().encode(JSON.stringify({ task: updated, notification: notif })));

      reply.code(200).send({ status: 'success', message: 'Đã gia hạn deadline.', data: serialize(updated) });
    } else {
      reply.code(400).send({ status: 'error', message: 'Loại yêu cầu không hợp lệ' });
    }
  }
  static async updateTask(req: any, reply: any) {
    const { id } = req.params;
    const { projectId } = req.body;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      reply.code(404).send({ status: 'error', message: 'Không tìm thấy task mẹ' });
      return;
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        projectId: projectId === null ? null : projectId
      }
    });

    reply.code(200).send({ status: 'success', data: serialize(updated) });
  }
}
