// @ts-nocheck
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';

const AUDIENCE = 'storymee-team';

function sessionSecret(): string {
  const secret = process.env.TEAM_SESSION_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('TEAM_SESSION_JWT_SECRET is required');
  return secret;
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

export class TeamSessionService {
  static async issueOneTimeToken(teamMemberId: string, source = 'telegram') {
    const member = await prisma.teamMember.findUnique({ where: { id: teamMemberId } });
    if (!member || !member.isActive || member.accountStatus !== 'active') {
      const error: any = new Error('Team account is not active');
      error.statusCode = 403;
      error.code = 'ACCOUNT_NOT_ACTIVE';
      throw error;
    }
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const ttlSeconds = Math.max(60, Number(process.env.TEAM_LOGIN_TOKEN_TTL_SECONDS || 600));
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await prisma.$transaction([
      prisma.teamLoginToken.updateMany({
        where: { teamMemberId, consumedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.teamLoginToken.create({
        data: { teamMemberId, tokenHash, expiresAt, source },
      }),
    ]);
    return { rawToken, expiresAt, member };
  }

  static async exchangeOneTimeToken(rawToken: string) {
    if (!rawToken || rawToken.length < 32 || rawToken.length > 256) {
      const error: any = new Error('Invalid or expired login token');
      error.statusCode = 401;
      error.code = 'TOKEN_INVALID';
      throw error;
    }
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    const result = await prisma.$transaction(async (tx: any) => {
      const token = await tx.teamLoginToken.findUnique({
        where: { tokenHash },
        include: { teamMember: true },
      });
      if (!token) return null;
      const consumed = await tx.teamLoginToken.updateMany({
        where: {
          id: token.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return null;
      return token.teamMember;
    });
    if (!result || !result.isActive || result.accountStatus !== 'active') {
      const error: any = new Error('Invalid or expired login token');
      error.statusCode = 401;
      error.code = 'TOKEN_INVALID';
      throw error;
    }
    const ttlSeconds = Math.max(300, Number(process.env.TEAM_SESSION_TTL_SECONDS || 28800));
    const accessToken = jwt.sign(
      {
        actor: 'team',
        email: result.email,
        role: result.role || undefined,
        isTeamAdmin: Boolean(result.isTeamAdmin),
      },
      sessionSecret(),
      { subject: result.id, audience: AUDIENCE, expiresIn: ttlSeconds }
    );
    return { accessToken, expiresIn: ttlSeconds, member: result };
  }

  static verifySession(token: string): any {
    const claims: any = jwt.verify(token, sessionSecret(), { audience: AUDIENCE });
    if (claims.actor !== 'team' || !claims.sub) throw new Error('Invalid Team session');
    return claims;
  }
}
