// @ts-nocheck
import { prisma } from '../config/prisma';
import { TeamSessionService } from '../services/teamSession.service';

const PUBLIC_PATHS = new Set([
  '/internal/v1/team/health',
  '/internal/v1/team/auth/one-time/exchange',
  '/internal/v1/team/auth/one-time/request',
  '/internal/v1/team/hr/team-members/register',
]);

function bearer(request: any): string {
  const auth = String(request.headers.authorization || '');
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

function isServiceKey(request: any): boolean {
  const expected = process.env.STORYMEE_SERVICE_API_KEY || process.env.HUB_API_KEY || '';
  const token = bearer(request) || String(request.headers['x-api-key'] || '');
  return Boolean(expected && token && token === expected);
}

export async function requireTeamSession(request: any, reply: any) {
  const path = request.url.split('?')[0];
  if (PUBLIC_PATHS.has(path)) return;
  if (isServiceKey(request)) {
    request.teamService = true;
    return;
  }
  try {
    const claims = TeamSessionService.verifySession(bearer(request));
    const member = await prisma.teamMember.findUnique({ where: { id: claims.sub } });
    if (!member || !member.isActive || member.accountStatus !== 'active') throw new Error('inactive');
    request.teamMember = member;
  } catch {
    return reply.code(401).send({
      status: 'error',
      code: 'TEAM_SESSION_REQUIRED',
      message: 'Team session required',
    });
  }
}

export function requireServiceKey(request: any, reply: any): boolean {
  if (request.teamService || isServiceKey(request)) return true;
  reply.code(403).send({
    status: 'error',
    code: 'SERVICE_KEY_REQUIRED',
    message: 'Service credential required',
  });
  return false;
}

/**
 * Browser callers are always represented by the member loaded from the signed
 * Team JWT. Service callers may explicitly identify an actor because they do
 * not have a human session (Telegram/MCP jobs).
 */
export async function resolveTeamActor(
  request: any,
  claimed: { id?: string | null; email?: string | null } = {}
) {
  if (request.teamMember) return request.teamMember;
  if (!request.teamService) return null;

  if (claimed.id) {
    return prisma.teamMember.findUnique({ where: { id: claimed.id } });
  }
  if (claimed.email) {
    return prisma.teamMember.findFirst({
      where: { email: { equals: String(claimed.email).trim(), mode: 'insensitive' } },
    });
  }
  return null;
}
