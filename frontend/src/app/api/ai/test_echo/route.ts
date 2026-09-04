import { NextResponse } from 'next/server';
import { authenticateTeamRoute, teamRouteError } from '@/lib/teamRouteAuth';

export async function GET(request: Request) {
  try {
    await authenticateTeamRoute(request, 'ai-test', 10);
  return NextResponse.json({
    ok: true,
    msg: "Hello from test_echo!"
  });
  } catch (error) {
    return teamRouteError(error);
  }
}
