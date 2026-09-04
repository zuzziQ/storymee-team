import { NextResponse } from 'next/server';

type TeamMemberIdentity = {
  id: string;
  email: string;
  fullName?: string;
  name?: string;
  role?: string;
  isTeamAdmin?: boolean;
  [key: string]: unknown;
};

type RateEntry = { count: number; resetAt: number };
const rateStore = new Map<string, RateEntry>();

function teamApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'https://dev-hub.storymee.com';
  const base = raw === '/api' || raw === '/' ? 'https://dev-hub.storymee.com' : raw;
  return `${base.replace(/\/+$/, '')}/api/v1/team`;
}

export class TeamRouteAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function authenticateTeamRoute(
  request: Request,
  scope: string,
  limitPerMinute = 30
): Promise<TeamMemberIdentity> {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    throw new TeamRouteAuthError(401, 'Team session required');
  }

  const response = await fetch(`${teamApiBase()}/auth/me`, {
    headers: { Authorization: authorization },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new TeamRouteAuthError(401, 'Invalid or expired Team session');
  }

  const payload = await response.json().catch(() => null);
  const member = payload?.data || payload?.member;
  if (!member?.id || !member?.email) {
    throw new TeamRouteAuthError(401, 'Invalid Team identity');
  }

  const now = Date.now();
  const key = `${member.id}:${scope}`;
  const current = rateStore.get(key);
  const next = !current || current.resetAt <= now
    ? { count: 1, resetAt: now + 60_000 }
    : { ...current, count: current.count + 1 };
  rateStore.set(key, next);
  if (next.count > limitPerMinute) {
    throw new TeamRouteAuthError(429, 'Too many requests');
  }

  if (rateStore.size > 5_000) {
    for (const [entryKey, entry] of rateStore) {
      if (entry.resetAt <= now) rateStore.delete(entryKey);
    }
  }

  return member;
}

export function teamRouteError(error: unknown) {
  if (error instanceof TeamRouteAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('[Team AI route]', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}
