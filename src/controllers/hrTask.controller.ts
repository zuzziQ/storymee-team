// @ts-nocheck
/**
 * Legacy SubTask approval controllers — FROZEN 2026-07-17.
 * SSOT: /internal/v1/team/plane/issues/*
 * See: team-work-management.md
 */
import { prisma } from '../config/prisma';

function serialize(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

const FROZEN = (taskId?: string) => ({
  status: 'error',
  success: false,
  code: 'LEGACY_TASK_APPROVAL_FROZEN',
  message:
    'Legacy SubTask approval đã đóng băng. ' +
    'Archive: POST /internal/v1/team/plane/issues/:id/request-archive | ' +
    'Review: POST /internal/v1/team/plane/issues/:id/review',
  migrateTo: {
    archive: `POST /internal/v1/team/plane/issues/${taskId || ':id'}/request-archive`,
    review: `POST /internal/v1/team/plane/issues/${taskId || ':id'}/review`,
  },
});

export class HrTaskController {
  static async requestApproval(req: any, reply: any) {
    const { taskId } = req.params;
    reply.code(410).send(FROZEN(taskId));
  }

  static async approveApproval(req: any, reply: any) {
    const { taskId } = req.params;
    reply.code(410).send(FROZEN(taskId));
  }

  /** Legacy parent Task projectId patch — still read-only useful for old rows; freeze write */
  static async updateTask(req: any, reply: any) {
    reply.code(410).send({
      status: 'error',
      success: false,
      code: 'LEGACY_TASK_UPDATE_FROZEN',
      message: 'Legacy omni_tasks update đã đóng băng. Dùng PATCH /internal/v1/team/plane/issues/:id',
      migrateTo: { method: 'PATCH', path: '/internal/v1/team/plane/issues/:id' },
    });
  }
}
