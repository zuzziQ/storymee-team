import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Fastify from 'fastify';
import { setupCors, globalErrorHandler } from '@storymee/fastify-common';
import { Server } from 'socket.io';
import { connect, NatsConnection } from 'nats';

import adminRoutes from './modules/tasks/index';
import hrRoutes from './modules/hr/index';
import omnitaskRoutes from './modules/omnitask/index';
import planeRoutes from './modules/plane/index';

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

  fastify.get('/internal/v1/team/health', async (request, reply) => {
      return { status: 'ok', service: 'core-team-api' };
  });

  await fastify.register(adminRoutes, { prefix: '/internal/v1/team/projects' });
  await fastify.register(hrRoutes, { prefix: '/internal/v1/team/hr' });
  await fastify.register(omnitaskRoutes, { prefix: '/internal/v1/team/omnitask' });
  await fastify.register(planeRoutes, { prefix: '/internal/v1/team/plane' });

  const port = parseInt(process.env.PORT || '4503');
  fastify.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error('[Core Team API] Startup failed:', err);
      process.exit(1);
    }
    console.log(`[Core Team API] Server is listening at ${address}`);

    // Setup Socket.io
    const io = new Server(fastify.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      path: '/internal/v1/team/socket.io'
    });
    
    fastify.decorate('io', io);

    io.on('connection', (socket) => {
      console.log(`[Core Team API] Socket connected: ${socket.id}`);
      socket.on('disconnect', () => {
        console.log(`[Core Team API] Socket disconnected: ${socket.id}`);
      });
    });

    // Subscribe to NATS to forward to WebSockets
    if (nc) {
      nc.subscribe('core.team.issue.updated', {
        callback: (err, msg) => {
          if (!err) {
            try {
              const data = JSON.parse(msg.data.toString());
              io.emit('issue_updated', data);
            } catch (e) {
              console.error('Error forwarding NATS message to Socket.io', e);
            }
          }
        }
      });
    }
  });
}

startServer().catch(console.error);
