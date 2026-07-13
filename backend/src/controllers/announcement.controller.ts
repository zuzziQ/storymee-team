import { AnnouncementService } from '../services/announcement.service';

export class AnnouncementController {
  static async getAnnouncements(req: any, reply: any) {
    try {
      const announcements = await AnnouncementService.getAnnouncements();
      reply.send({ status: 'success', data: announcements });
    } catch (err: any) {
      req.log.error(err);
      reply.status(500).send({ status: 'error', message: err.message });
    }
  }

  static async createAnnouncement(req: any, reply: any) {
    try {
      const { title, content, senderId, targetUserId } = req.body;
      if (!title || !content) {
        return reply.status(400).send({ status: 'error', message: 'Missing required fields' });
      }
      
      const announcement = await AnnouncementService.createAnnouncement({
        title, content, senderId, targetUserId
      });

      // Publish event via NATS
      try {
        const nats = (req.server as any).nats;
        if (nats) {
          nats.publish('core.team.announcement.created', JSON.stringify({ announcement }));
        }
      } catch (e) {
        req.log.error('Failed to publish announcement NATS event:', e);
      }

      reply.send({ status: 'success', data: announcement });
    } catch (err: any) {
      req.log.error(err);
      reply.status(500).send({ status: 'error', message: err.message });
    }
  }

  static async markAsRead(req: any, reply: any) {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      if (!userId) {
        return reply.status(400).send({ status: 'error', message: 'Missing userId' });
      }
      
      const ann = await AnnouncementService.markAsRead(id, userId);
      reply.send({ status: 'success', data: ann });
    } catch (err: any) {
      req.log.error(err);
      reply.status(500).send({ status: 'error', message: err.message });
    }
  }
}
