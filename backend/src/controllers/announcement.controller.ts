import { AnnouncementService } from '../services/announcement.service';
import { isTeamAdmin } from '../services/teamAuth.service';
import { resolveTeamActor } from '../middlewares/teamSessionAuth';

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
      const actor = await resolveTeamActor(req, { id: senderId });
      if (!isTeamAdmin(actor)) {
        return reply.status(403).send({ status: 'error', message: 'Chỉ Admin mới gửi thông báo' });
      }
      if (!title || !content) {
        return reply.status(400).send({ status: 'error', message: 'Missing required fields' });
      }
      
      const announcement = await AnnouncementService.createAnnouncement({
        title, content, senderId: actor.id, targetUserId
      });

      // Publish event via NATS (StringCodec — khớp core.team.> → Socket bridge)
      try {
        const nats = (req.server as any).nats;
        if (nats) {
          const { StringCodec } = require('nats');
          const sc = StringCodec();
          nats.publish('core.team.announcement.created', sc.encode(JSON.stringify({ announcement })));
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
      const actor = await resolveTeamActor(req, { id: userId });
      if (!actor || (actor.id !== userId && !isTeamAdmin(actor))) {
        return reply.status(403).send({ status: 'error', message: 'Không thể đánh dấu đã đọc thay người khác' });
      }
      
      const ann = await AnnouncementService.markAsRead(id, actor.id);
      reply.send({ status: 'success', data: ann });
    } catch (err: any) {
      req.log.error(err);
      reply.status(500).send({ status: 'error', message: err.message });
    }
  }
}
