import { NextResponse } from 'next/server';
import { destroyMentorSession } from '@/lib/auth/session';

export async function POST() {
  await destroyMentorSession();
  return NextResponse.json({
    success: true,
    message: 'Logged out successfully.',
  });
}
