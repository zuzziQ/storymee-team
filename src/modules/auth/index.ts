// @ts-nocheck
import { TeamSessionService } from '../../services/teamSession.service';
import { requireServiceKey } from '../../middlewares/teamSessionAuth';
import { prisma } from '../../config/prisma';

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

  fastify.post('/one-time/request', async (request: any, reply: any) => {
    const identifier = String(request.body?.identifier || '').trim();
    if (!identifier) return reply.code(400).send({ status: 'error', message: 'Vui lòng nhập Email hoặc @telegram_username' });
    
    let member;
    if (identifier.includes('@') && !identifier.startsWith('@')) {
      member = await prisma.teamMember.findUnique({ where: { email: identifier.toLowerCase() } });
    } else {
      const tgUsername = identifier.replace('@', '');
      member = await prisma.teamMember.findFirst({ where: { telegramUsername: { equals: tgUsername, mode: 'insensitive' } } });
    }

    if (!member || !member.isActive || member.accountStatus !== 'active') {
       return reply.code(404).send({ status: 'error', message: 'Không tìm thấy tài khoản hoặc tài khoản chưa kích hoạt' });
    }

    const issued = await TeamSessionService.issueOneTimeToken(member.id, 'web_request');
    const publicBase = String(process.env.TEAM_LOGIN_PUBLIC_URL || 'https://storymee-team.vercel.app/login').replace(/#.*$/, '');
    const loginUrl = `${publicBase}#token=${encodeURIComponent(issued.rawToken)}`;

    const nc = fastify.nats;
    if (nc && member.telegramChatId) {
      nc.publish('core.team.auth.login_requested', Buffer.from(JSON.stringify({
        memberId: member.id,
        telegramChatId: member.telegramChatId,
        loginUrl
      })));
    } else if (!member.telegramChatId) {
      return reply.code(400).send({ status: 'error', message: 'Tài khoản chưa liên kết Telegram. Vui lòng mở Bot để lấy link.' });
    }

    return reply.send({ status: 'success', message: 'Liên kết đăng nhập đã được gửi qua Telegram của bạn.' });
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
