import { fetchAxios } from '@/lib/fetchAxios';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const res = await fetchAxios((process.env.NEXT_PUBLIC_API_URL === '/api' || process.env.NEXT_PUBLIC_API_URL === '/' || (process.env.NEXT_PUBLIC_API_URL || '').includes('//hub.storymee.com') || !process.env.NEXT_PUBLIC_API_URL ? 'https://dev-hub.storymee.com' : process.env.NEXT_PUBLIC_API_URL) ? `${process.env.NEXT_PUBLIC_API_URL}/internal/v1/ai/logs` : 'https://dev-hub.storymee.com/internal/v1/ai/logs', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Failed to fetch logs from Omni LLM Hub');
    }
    const data = await res.json();
    return NextResponse.json({ status: 'success', data: data.data || [] });
  } catch (err: any) {
    return NextResponse.json({ status: 'success', data: [] });
  }
}
