import { fetchAxios } from '@/lib/fetchAxios';
import { NextResponse } from 'next/server';
import { authenticateTeamRoute, teamRouteError } from '@/lib/teamRouteAuth';

export async function GET(request: Request) {
  try {
    await authenticateTeamRoute(request, 'ai-logs', 30);
    const base = process.env.NEXT_PUBLIC_API_URL || 'https://dev-hub.storymee.com';
    const res = await fetchAxios(`${base.replace(/\/+$/, '')}/internal/v1/ai/logs`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Failed to fetch logs from Omni LLM Hub');
    }
    const data = await res.json();
    return NextResponse.json({ status: 'success', data: data.data || [] });
  } catch (err: any) {
    return teamRouteError(err);
  }
}
