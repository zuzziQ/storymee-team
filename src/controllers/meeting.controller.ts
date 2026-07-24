import { MeetingService } from '../services/meeting.service';

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
      if (!title || !startTime || !endTime || !hostId) {
        return reply.status(400).send({ status: 'error', message: 'Missing required fields' });
      }
      
      const meeting = await MeetingService.createMeeting({
        title, description, startTime, endTime, hostId, attendees, meetLink
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
      const { title, description, startTime, endTime, attendees, meetLink, status, documents, outputUrls } = req.body;
      
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
