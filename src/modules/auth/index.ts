// @ts-nocheck
import { TeamSessionService } from '../../services/teamSession.service';
import { requireServiceKey } from '../../middlewares/teamSessionAuth';

const plugin = async (fastify: any) => {
  fastify.post('/one-time/issue', async (request: any, reply: any) => {
    if (!requireServiceKey(request, reply)) return;
    const teamMemberId = String(request.body?.teamMemberId || '').trim();
    if (!teamMemberId) {
      return reply.code(400).send({ status: 'error', message: 'teamMemberId is required' });
    }
    const issued = await TeamSessionService.issueOneTimeToken(
      teamMemberId,
      String(request.body?.source || 'telegram')
    );
    const publicBase = String(
      process.env.TEAM_LOGIN_PUBLIC_URL || 'https://storymee-team.vercel.app/login'
    ).replace(/#.*$/, '');
    return reply.send({
      status: 'success',
      data: {
        token: issued.rawToken,
        expiresAt: issued.expiresAt,
        loginUrl: `${publicBase}#token=${encodeURIComponent(issued.rawToken)}`,
      },
    });
  });

  fastify.post('/one-time/exchange', async (request: any, reply: any) => {
    const result = await TeamSessionService.exchangeOneTimeToken(String(request.body?.token || ''));
    return reply.send({ status: 'success', data: result });
  });

  fastify.get('/me', async (request: any, reply: any) => {
    return reply.send({ status: 'success', data: request.teamMember });
  });
};

export default plugin;
