import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Fastify from 'fastify';
import { setupCors, globalErrorHandler } from '@storymee/fastify-common';

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
  });
}

startServer().catch(console.error);
