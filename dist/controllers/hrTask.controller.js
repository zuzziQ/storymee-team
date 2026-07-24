"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HrTaskController = void 0;
function serialize(obj) {
    return JSON.parse(JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? value.toString() : value));
}
const FROZEN = (taskId) => ({
    status: 'error',
    success: false,
    code: 'LEGACY_TASK_APPROVAL_FROZEN',
    message: 'Legacy SubTask approval đã đóng băng. ' +
        'Archive: POST /internal/v1/team/plane/issues/:id/request-archive | ' +
        'Review: POST /internal/v1/team/plane/issues/:id/review',
    migrateTo: {
        archive: `POST /internal/v1/team/plane/issues/${taskId || ':id'}/request-archive`,
        review: `POST /internal/v1/team/plane/issues/${taskId || ':id'}/review`,
    },
});
class HrTaskController {
    static async requestApproval(req, reply) {
        const { taskId } = req.params;
        reply.code(410).send(FROZEN(taskId));
    }
    static async approveApproval(req, reply) {
        const { taskId } = req.params;
        reply.code(410).send(FROZEN(taskId));
    }
    /** Legacy parent Task projectId patch — still read-only useful for old rows; freeze write */
    static async updateTask(req, reply) {
        reply.code(410).send({
            status: 'error',
            success: false,
            code: 'LEGACY_TASK_UPDATE_FROZEN',
            message: 'Legacy omni_tasks update đã đóng băng. Dùng PATCH /internal/v1/team/plane/issues/:id',
            migrateTo: { method: 'PATCH', path: '/internal/v1/team/plane/issues/:id' },
        });
    }
}
exports.HrTaskController = HrTaskController;
