"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv.config({ path: path_1.default.resolve(__dirname, '../.env') });
const fastify_1 = __importDefault(require("fastify"));
const fastify_common_1 = require("@storymee/fastify-common");
const socket_io_1 = require("socket.io");
const nats_1 = require("nats");
const index_1 = __importDefault(require("./modules/tasks/index"));
const index_2 = __importDefault(require("./modules/hr/index"));
const index_3 = __importDefault(require("./modules/omnitask/index"));
const index_4 = __importDefault(require("./modules/plane/index"));
const index_5 = __importDefault(require("./modules/auth/index"));
const teamAccount_service_1 = require("./services/teamAccount.service");
const teamSessionAuth_1 = require("./middlewares/teamSessionAuth");
const teamSession_service_1 = require("./services/teamSession.service");
const prisma_1 = require("./config/prisma");
BigInt.prototype.toJSON = function () {
    return this.toString();
};
const fastify = (0, fastify_1.default)({
    logger: false,
    bodyLimit: 52428800
});
async function startServer() {
    fastify.setErrorHandler(fastify_common_1.globalErrorHandler);
    // Setup NATS
    let nc;
    try {
        nc = await (0, nats_1.connect)({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
        console.log(`[Core Team API] Connected to NATS on ${nc.getServer()}`);
        // Expose NATS to controllers via fastify decorator
        fastify.decorate('nats', nc);
    }
    catch (err) {
        console.warn('[Core Team API] Failed to connect to NATS:', err);
    }
    await fastify.register(fastify_common_1.setupCors);
    fastify.addHook('preHandler', teamSessionAuth_1.requireTeamSession);
    // Internal account schema (account_status on omni_team_members)
    try {
        await teamAccount_service_1.TeamAccountService.ensureSchema();
        console.log('[Core Team API] Team account schema ready (account_status)');
    }
    catch (e) {
        console.warn('[Core Team API] Team account schema ensure failed:', e?.message || e);
    }
    fastify.get('/internal/v1/team/health', async (request, reply) => {
        return { status: 'ok', service: 'core-team-api' };
    });
    await fastify.register(index_5.default, { prefix: '/internal/v1/team/auth' });
    await fastify.register(index_1.default, { prefix: '/internal/v1/team/projects' });
    await fastify.register(index_2.default, { prefix: '/internal/v1/team/hr' });
    await fastify.register(index_3.default, { prefix: '/internal/v1/team/omnitask' });
    await fastify.register(index_4.default, { prefix: '/internal/v1/team/plane' });
    const port = parseInt(process.env.PORT || '4503');
    // Setup Socket.io before listening
    const io = new socket_io_1.Server(fastify.server, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
        path: '/internal/v1/team/socket.io'
    });
    fastify.decorate('io', io);
    io.use(async (socket, next) => {
        try {
            const authToken = String(socket.handshake.auth?.token || '');
            const header = String(socket.handshake.headers.authorization || '');
            const token = authToken || (header.startsWith('Bearer ') ? header.slice(7).trim() : '');
            const claims = teamSession_service_1.TeamSessionService.verifySession(token);
            const member = await prisma_1.prisma.teamMember.findUnique({ where: { id: claims.sub } });
            if (!member || !member.isActive || member.accountStatus !== 'active')
                throw new Error('inactive');
            socket.data.teamMemberId = member.id;
            next();
        }
        catch {
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
                    }
                    catch (e) {
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
startServer().catch(console.error);
