"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingService = void 0;
const prisma_1 = require("../config/prisma");
class MeetingService {
    static async getMeetings() {
        return prisma_1.prisma.omniMeeting.findMany({
            orderBy: { startTime: 'desc' },
            where: {
                startTime: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // last 30 days
            },
            include: {
                host: {
                    select: { id: true, fullName: true, email: true }
                }
            }
        });
    }
    static async createMeeting(data) {
        return prisma_1.prisma.omniMeeting.create({
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
    static async updateMeeting(id, data) {
        return prisma_1.prisma.omniMeeting.update({
            where: { id },
            data: {
                ...(data.title && { title: data.title }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.startTime && { startTime: new Date(data.startTime) }),
                ...(data.endTime && { endTime: new Date(data.endTime) }),
                ...(data.attendees && { attendees: data.attendees }),
                ...(data.meetLink !== undefined && { meetLink: data.meetLink }),
                ...(data.status && { status: data.status }),
                ...(data.documents && { documents: data.documents }),
                ...(data.outputUrls && { outputUrls: data.outputUrls })
            },
            include: { host: true }
        });
    }
}
exports.MeetingService = MeetingService;
