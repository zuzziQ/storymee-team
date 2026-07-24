"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnouncementController = void 0;
const announcement_service_1 = require("../services/announcement.service");
class AnnouncementController {
    static async getAnnouncements(req, reply) {
        try {
            const announcements = await announcement_service_1.AnnouncementService.getAnnouncements();
            reply.send({ status: 'success', data: announcements });
        }
        catch (err) {
            req.log.error(err);
            reply.status(500).send({ status: 'error', message: err.message });
        }
    }
    static async createAnnouncement(req, reply) {
        try {
            const { title, content, senderId, targetUserId } = req.body;
            if (!title || !content) {
                return reply.status(400).send({ status: 'error', message: 'Missing required fields' });
            }
            const announcement = await announcement_service_1.AnnouncementService.createAnnouncement({
                title, content, senderId, targetUserId
            });
            // Publish event via NATS (StringCodec — khớp core.team.> → Socket bridge)
            try {
                const nats = req.server.nats;
                if (nats) {
                    const { StringCodec } = require('nats');
                    const sc = StringCodec();
                    nats.publish('core.team.announcement.created', sc.encode(JSON.stringify({ announcement })));
                }
            }
            catch (e) {
                req.log.error('Failed to publish announcement NATS event:', e);
            }
            reply.send({ status: 'success', data: announcement });
        }
        catch (err) {
            req.log.error(err);
            reply.status(500).send({ status: 'error', message: err.message });
        }
    }
    static async markAsRead(req, reply) {
        try {
            const { id } = req.params;
            const { userId } = req.body;
            if (!userId) {
                return reply.status(400).send({ status: 'error', message: 'Missing userId' });
            }
            const ann = await announcement_service_1.AnnouncementService.markAsRead(id, userId);
            reply.send({ status: 'success', data: ann });
        }
        catch (err) {
            req.log.error(err);
            reply.status(500).send({ status: 'error', message: err.message });
        }
    }
}
exports.AnnouncementController = AnnouncementController;
