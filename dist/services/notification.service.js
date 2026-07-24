"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const prisma_1 = require("../config/prisma");
class NotificationService {
    static async createNotification(memberId, title, message, type, payload) {
        try {
            const notif = await prisma_1.prisma.notification.create({
                data: {
                    memberId,
                    title,
                    message,
                    type,
                    payload: payload || {},
                    status: 'unread'
                }
            });
            return notif;
        }
        catch (error) {
            console.error('[NotificationService] Error creating notification', error);
            return null;
        }
    }
    static async markAsResolved(notificationId) {
        try {
            return await prisma_1.prisma.notification.update({
                where: { id: notificationId },
                data: { status: 'resolved' }
            });
        }
        catch (error) {
            console.error('[NotificationService] Error updating notification', error);
            return null;
        }
    }
    static async markAsRead(notificationId) {
        try {
            return await prisma_1.prisma.notification.update({
                where: { id: notificationId },
                data: { status: 'read' }
            });
        }
        catch (error) {
            console.error('[NotificationService] Error updating notification', error);
            return null;
        }
    }
    static async getUnread(memberId) {
        try {
            return await prisma_1.prisma.notification.findMany({
                where: { memberId, status: 'unread' },
                orderBy: { createdAt: 'desc' }
            });
        }
        catch (error) {
            console.error('[NotificationService] Error getting notifications', error);
            return [];
        }
    }
}
exports.NotificationService = NotificationService;
