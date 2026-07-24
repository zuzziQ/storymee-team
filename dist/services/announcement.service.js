"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnouncementService = void 0;
const prisma_1 = require("../config/prisma");
class AnnouncementService {
    static async getAnnouncements(userId) {
        return prisma_1.prisma.omniAnnouncement.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                sender: {
                    select: { id: true, fullName: true }
                }
            }
        });
    }
    static async createAnnouncement(data) {
        return prisma_1.prisma.omniAnnouncement.create({
            data: {
                title: data.title,
                content: data.content,
                senderId: data.senderId,
                targetUserId: data.targetUserId,
                readBy: []
            },
            include: { sender: true }
        });
    }
    static async markAsRead(id, userId) {
        const ann = await prisma_1.prisma.omniAnnouncement.findUnique({ where: { id } });
        if (!ann)
            throw new Error('Not found');
        let readBy = Array.isArray(ann.readBy) ? ann.readBy : [];
        if (!readBy.includes(userId)) {
            readBy.push(userId);
            return prisma_1.prisma.omniAnnouncement.update({
                where: { id },
                data: { readBy }
            });
        }
        return ann;
    }
}
exports.AnnouncementService = AnnouncementService;
