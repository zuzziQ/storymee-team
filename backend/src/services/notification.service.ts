import { prisma } from '../config/prisma';

export class NotificationService {
    static async createNotification(
        memberId: string,
        title: string,
        message: string,
        type: string,
        payload?: any
    ) {
        try {
            const notif = await prisma.notification.create({
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
        } catch (error) {
            console.error('[NotificationService] Error creating notification', error);
            return null;
        }
    }

    static async markAsResolved(notificationId: string) {
        try {
            return await prisma.notification.update({
                where: { id: notificationId },
                data: { status: 'resolved' }
            });
        } catch (error) {
            console.error('[NotificationService] Error updating notification', error);
            return null;
        }
    }

    static async markAsRead(notificationId: string) {
        try {
            return await prisma.notification.update({
                where: { id: notificationId },
                data: { status: 'read' }
            });
        } catch (error) {
            console.error('[NotificationService] Error updating notification', error);
            return null;
        }
    }

    static async getUnread(memberId: string) {
        try {
            return await prisma.notification.findMany({
                where: { memberId, status: 'unread' },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            console.error('[NotificationService] Error getting notifications', error);
            return [];
        }
    }
}
