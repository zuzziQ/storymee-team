import { MeetingService } from '../services/meeting.service';
import { prisma } from '../config/prisma';
import { isTeamAdmin } from '../services/teamAuth.service';
import { resolveTeamActor } from '../middlewares/teamSessionAuth';

export class MeetingController {
  static async getMeetings(req: any, reply: any) {
    try {
      const meetings = await MeetingService.getMeetings();
      reply.send({ status: 'success', data: meetings });
    } catch (err: any) {
      req.log.error(err);
      reply.status(500).send({ status: 'error', message: err.message });
    }
  }

  static async createMeeting(req: any, reply: any) {
    try {
      const { title, description, startTime, endTime, hostId, attendees, meetLink } = req.body;
      const actor = await resolveTeamActor(req, { id: hostId });
      if (!actor || (actor.id !== hostId && !isTeamAdmin(actor))) {
        return reply.status(403).send({ status: 'error', message: 'Không thể tạo lịch với host khác' });
      }
      if (!title || !startTime || !endTime || !hostId) {
        return reply.status(400).send({ status: 'error', message: 'Missing required fields' });
      }
      
      const meeting = await MeetingService.createMeeting({
        title, description, startTime, endTime, hostId: actor.id, attendees, meetLink
      });

      try {
        const nats = (req.server as any).nats;
        if (nats) {
          const { StringCodec } = require('nats');
          const sc = StringCodec();
          nats.publish('core.team.meeting.created', sc.encode(JSON.stringify({ meeting })));
        }
      } catch (e) {
        req.log.error('Failed to publish meeting NATS event:', e);
      }

      reply.send({ status: 'success', data: meeting });
    } catch (err: any) {
      req.log.error(err);
      reply.status(500).send({ status: 'error', message: err.message });
    }
  }

  static async updateMeeting(req: any, reply: any) {
    try {
      const { id } = req.params;
      const existing = await prisma.omniMeeting.findUnique({ where: { id } });
      const { title, description, startTime, endTime, attendees, meetLink, status, documents, outputUrls, actorId } = req.body;
      const actor = await resolveTeamActor(req, { id: actorId });
      if (!existing) return reply.status(404).send({ status: 'error', message: 'Meeting not found' });
      if (!actor || (actor.id !== existing.hostId && !isTeamAdmin(actor))) {
        return reply.status(403).send({ status: 'error', message: 'Chỉ host hoặc Admin được sửa lịch' });
      }
      const meeting = await MeetingService.updateMeeting(id, {
        title, description, startTime, endTime, attendees, meetLink, status, documents, outputUrls
      });

      try {
        const nats = (req.server as any).nats;
        if (nats) {
          const { StringCodec } = require('nats');
          const sc = StringCodec();
          nats.publish('core.team.meeting.updated', sc.encode(JSON.stringify({ meeting })));
        }
      } catch (e) {
        req.log.error('Failed to publish meeting updated NATS event:', e);
      }

      reply.send({ status: 'success', data: meeting });
    } catch (err: any) {
      req.log.error(err);
      reply.status(500).send({ status: 'error', message: err.message });
    }
  }
}
