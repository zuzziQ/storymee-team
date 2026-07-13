import { prisma } from 'prisma-client';

export class MeetingService {
  static async getMeetings() {
    return prisma.omniMeeting.findMany({
      orderBy: { startTime: 'asc' },
      where: {
        startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // from yesterday onwards
      },
      include: {
        host: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });
  }

  static async createMeeting(data: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    hostId: string;
    attendees?: any;
    meetLink?: string;
  }) {
    return prisma.omniMeeting.create({
      data: {
        title: data.title,
        description: data.description,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        hostId: data.hostId,
        attendees: data.attendees || [],
        meetLink: data.meetLink,
        status: 'scheduled'
      },
      include: { host: true }
    });
  }
}
