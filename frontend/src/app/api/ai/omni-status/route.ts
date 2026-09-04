import { fetchAxios } from '@/lib/fetchAxios';
import { NextResponse } from 'next/server';
import { authenticateTeamRoute, teamRouteError } from '@/lib/teamRouteAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await authenticateTeamRoute(request, 'ai-status', 60);
    const base = process.env.NEXT_PUBLIC_API_URL || 'https://dev-hub.storymee.com';
    const res = await fetchAxios(`${base.replace(/\/+$/, '')}/internal/v1/ai/health`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Failed to fetch status from Omni LLM Hub');
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return teamRouteError(error);
  }
}
