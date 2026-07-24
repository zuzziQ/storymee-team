"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingController = void 0;
const meeting_service_1 = require("../services/meeting.service");
class MeetingController {
    static async getMeetings(req, reply) {
        try {
            const meetings = await meeting_service_1.MeetingService.getMeetings();
            reply.send({ status: 'success', data: meetings });
        }
        catch (err) {
            req.log.error(err);
            reply.status(500).send({ status: 'error', message: err.message });
        }
    }
    static async createMeeting(req, reply) {
        try {
            const { title, description, startTime, endTime, hostId, attendees, meetLink } = req.body;
            if (!title || !startTime || !endTime || !hostId) {
                return reply.status(400).send({ status: 'error', message: 'Missing required fields' });
            }
            const meeting = await meeting_service_1.MeetingService.createMeeting({
                title, description, startTime, endTime, hostId, attendees, meetLink
            });
            try {
                const nats = req.server.nats;
                if (nats) {
                    const { StringCodec } = require('nats');
                    const sc = StringCodec();
                    nats.publish('core.team.meeting.created', sc.encode(JSON.stringify({ meeting })));
                }
            }
            catch (e) {
                req.log.error('Failed to publish meeting NATS event:', e);
            }
            reply.send({ status: 'success', data: meeting });
        }
        catch (err) {
            req.log.error(err);
            reply.status(500).send({ status: 'error', message: err.message });
        }
    }
    static async updateMeeting(req, reply) {
        try {
            const { id } = req.params;
            const { title, description, startTime, endTime, attendees, meetLink, status, documents, outputUrls } = req.body;
            const meeting = await meeting_service_1.MeetingService.updateMeeting(id, {
                title, description, startTime, endTime, attendees, meetLink, status, documents, outputUrls
            });
            try {
                const nats = req.server.nats;
                if (nats) {
                    const { StringCodec } = require('nats');
                    const sc = StringCodec();
                    nats.publish('core.team.meeting.updated', sc.encode(JSON.stringify({ meeting })));
                }
            }
            catch (e) {
                req.log.error('Failed to publish meeting updated NATS event:', e);
            }
            reply.send({ status: 'success', data: meeting });
        }
        catch (err) {
            req.log.error(err);
            reply.status(500).send({ status: 'error', message: err.message });
        }
    }
}
exports.MeetingController = MeetingController;
