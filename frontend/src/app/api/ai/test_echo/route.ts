import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({
    ok: true,
    msg: "Hello from test_echo!",
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV
    }
  });
}
