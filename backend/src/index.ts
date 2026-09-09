import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Fastify from 'fastify';
import { setupCors, globalErrorHandler } from '@storymeedev/fastify-common';
import { Server } from 'socket.io';
import { connect, NatsConnection } from 'nats';

import adminRoutes from './modules/tasks/index';
import hrRoutes from './modules/hr/index';
import omnitaskRoutes from './modules/omnitask/index';
import planeRoutes from './modules/plane/index';
import authRoutes from './modules/auth/index';
import { HrController } from './controllers/hr.controller';
import { TeamAccountService } from './services/teamAccount.service';
import { requireTeamSession } from './middlewares/teamSessionAuth';
import { TeamSessionService } from './services/teamSession.service';
import { prisma } from './config/prisma';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const fastify = Fastify({
  logger: false,
  bodyLimit: 52428800
});

async function startServer() {
  fastify.setErrorHandler(globalErrorHandler as any);
  
  // Setup NATS
  let nc: NatsConnection | undefined;
  try {
    nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
    console.log(`[Core Team API] Connected to NATS on ${nc.getServer()}`);
    // Expose NATS to controllers via fastify decorator
    fastify.decorate('nats', nc);
  } catch (err) {
    console.warn('[Core Team API] Failed to connect to NATS:', err);
  }
  
  await fastify.register(setupCors as any);
  fastify.addHook('preHandler', requireTeamSession);

  // Internal account schema (account_status on omni_team_members)
  try {
    await TeamAccountService.ensureSchema();
    console.log('[Core Team API] Team account schema ready (account_status)');
  } catch (e: any) {
    console.warn('[Core Team API] Team account schema ensure failed:', e?.message || e);
  }

  fastify.get('/internal/v1/team/health', async (request, reply) => {
      return { status: 'ok', service: 'core-team-api' };
  });

  await fastify.register(authRoutes, { prefix: '/internal/v1/team/auth' });

  await fastify.register(adminRoutes, { prefix: '/internal/v1/team/projects' });
  await fastify.register(hrRoutes, { prefix: '/internal/v1/team/hr' });
  await fastify.register(omnitaskRoutes, { prefix: '/internal/v1/team/omnitask' });
  await fastify.register(planeRoutes, { prefix: '/internal/v1/team/plane' });

  const port = parseInt(process.env.PORT || '4503');

  // Setup Socket.io before listening
  const io = new Server(fastify.server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/internal/v1/team/socket.io'
  });
  fastify.decorate('io', io);

  io.use(async (socket, next) => {
    try {
      const authToken = String(socket.handshake.auth?.token || '');
      const header = String(socket.handshake.headers.authorization || '');
      const token = authToken || (header.startsWith('Bearer ') ? header.slice(7).trim() : '');
      const claims = TeamSessionService.verifySession(token);
      const member = await prisma.teamMember.findUnique({ where: { id: claims.sub } });
      if (!member || !member.isActive || member.accountStatus !== 'active') throw new Error('inactive');
      socket.data.teamMemberId = member.id;
      next();
    } catch {
      next(new Error('TEAM_SESSION_REQUIRED'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Core Team API] Socket connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[Core Team API] Socket disconnected: ${socket.id}`);
    });
  });

  // Subscribe to NATS to forward to WebSockets
  if (nc) {
    nc.subscribe('core.team.>', {
      callback: (err, msg) => {
        if (!err) {
          try {
            const data = JSON.parse(msg.data.toString());
            // Map subject 'core.team.issue.updated' -> 'issue_updated'
            const eventName = msg.subject.replace('core.team.', '').replace(/\./g, '_');
            io.emit(eventName, data);
            
            // For backward compatibility since frontend expects 'issue_updated'
            if (msg.subject === 'core.team.issue.updated') {
              // already handled by mapping above
            }
          } catch (e) {
            console.error('Error forwarding NATS message to Socket.io', e);
          }
        }
      }
    });
  }

  fastify.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error('[Core Team API] Startup failed:', err);
      process.exit(1);
    }
    console.log(`[Core Team API] Server is listening at ${address}`);
  });
}

function setupAutoCheckoutCron() {
  let lastRunDate = '';
  setInterval(() => {
    try {
      const vnNowStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
      const now = new Date(vnNowStr);
      const dateStr = now.toISOString().substring(0, 10);
      if (now.getHours() === 23 && now.getMinutes() >= 50 && lastRunDate !== dateStr) {
        lastRunDate = dateStr;
        console.log(`[Cron] Running nightly auto-checkout for date: ${dateStr}...`);
        HrController.autoCheckout().then((res: any) => {
          console.log(`[Cron] Auto-checkout finished: ${res?.updatedCount} records updated.`);
        }).catch((err: any) => {
          console.error('[Cron] Auto-checkout failed:', err);
        });
      }
    } catch (e) {
      console.error('[Cron] Error in auto-checkout interval:', e);
    }
  }, 30000);
}

startServer().then(() => {
  setupAutoCheckoutCron();
}).catch(console.error);
