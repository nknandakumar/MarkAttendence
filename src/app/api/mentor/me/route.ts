import { NextResponse } from 'next/server';
import { getMentorSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getMentorSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    mentor: session,
  });
}
