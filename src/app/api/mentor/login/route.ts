import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { mentors } from '@/db/schema';
import { comparePassword, createMentorSession } from '@/lib/auth/session';
import { mentorLoginSchema } from '@/lib/validation/schemas';
import { eq, or } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parseResult = mentorLoginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: parseResult.error.errors[0]?.message || 'Invalid credentials input.',
        },
        { status: 400 }
      );
    }

    const { username, password } = parseResult.data;
    const cleanUsername = username.trim().toLowerCase();

    // Look up mentor by email or name matching cleanUsername
    const mentorRecords = await db
      .select()
      .from(mentors)
      .where(or(eq(mentors.email, cleanUsername), eq(mentors.name, username.trim())))
      .limit(1);

    // Fallback: If not found, fetch first mentor in DB (since only 1 mentor uses system)
    let mentor = mentorRecords[0];
    if (!mentor) {
      const allMentors = await db.select().from(mentors).limit(1);
      if (allMentors.length > 0) {
        mentor = allMentors[0];
      }
    }

    if (!mentor) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid username or password.',
        },
        { status: 401 }
      );
    }

    const isPasswordValid = await comparePassword(password, mentor.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid username or password.',
        },
        { status: 401 }
      );
    }

    await createMentorSession({
      id: mentor.id,
      email: mentor.email,
      name: mentor.name,
    });

    return NextResponse.json({
      success: true,
      message: 'Login successful.',
      mentor: {
        id: mentor.id,
        name: mentor.name,
        email: mentor.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred during login.',
      },
      { status: 500 }
    );
  }
}
