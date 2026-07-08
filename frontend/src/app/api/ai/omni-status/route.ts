import { fetchAxios } from '@/lib/fetchAxios';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetchAxios(process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/internal/v1/ai/health` : 'https://dev-hub.storymee.com/internal/v1/ai/health', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Failed to fetch status from Omni LLM Hub');
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
