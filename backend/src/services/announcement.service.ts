import { prisma } from 'prisma-client';

export class AnnouncementService {
  static async getAnnouncements(userId?: string) {
    return prisma.omniAnnouncement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: {
          select: { id: true, fullName: true }
        }
      }
    });
  }

  static async createAnnouncement(data: {
    title: string;
    content: string;
    senderId?: string;
    targetUserId?: string;
  }) {
    return prisma.omniAnnouncement.create({
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

  static async markAsRead(id: string, userId: string) {
    const ann = await prisma.omniAnnouncement.findUnique({ where: { id } });
    if (!ann) throw new Error('Not found');

    let readBy = Array.isArray(ann.readBy) ? ann.readBy : [];
    if (!readBy.includes(userId)) {
      readBy.push(userId);
      return prisma.omniAnnouncement.update({
        where: { id },
        data: { readBy }
      });
    }
    return ann;
  }
}
