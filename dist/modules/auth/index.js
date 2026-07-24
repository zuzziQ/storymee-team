"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const teamSession_service_1 = require("../../services/teamSession.service");
const teamSessionAuth_1 = require("../../middlewares/teamSessionAuth");
const plugin = async (fastify) => {
    fastify.post('/one-time/issue', async (request, reply) => {
        if (!(0, teamSessionAuth_1.requireServiceKey)(request, reply))
            return;
        const teamMemberId = String(request.body?.teamMemberId || '').trim();
        if (!teamMemberId)
            return reply.code(400).send({ status: 'error', message: 'teamMemberId is required' });
        const issued = await teamSession_service_1.TeamSessionService.issueOneTimeToken(teamMemberId, String(request.body?.source || 'telegram'));
        const publicBase = String(process.env.TEAM_LOGIN_PUBLIC_URL || 'https://storymee-team.vercel.app/login').replace(/#.*$/, '');
        return reply.send({
            status: 'success',
            data: { token: issued.rawToken, expiresAt: issued.expiresAt, loginUrl: `${publicBase}#token=${encodeURIComponent(issued.rawToken)}` },
        });
    });
    fastify.post('/one-time/exchange', async (request, reply) => {
        const result = await teamSession_service_1.TeamSessionService.exchangeOneTimeToken(String(request.body?.token || ''));
        return reply.send({ status: 'success', data: result });
    });
    fastify.get('/me', async (request, reply) => {
        return reply.send({ status: 'success', data: request.teamMember });
    });
};
exports.default = plugin;
