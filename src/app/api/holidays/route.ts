import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { holidays } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { holidaySchema } from '@/lib/validation/schemas';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Public: Returns all holidays sorted by date ascending */
export async function GET() {
  try {
    const allHolidays = await db
      .select()
      .from(holidays)
      .orderBy(holidays.date);

    return NextResponse.json({
      success: true,
      holidays: allHolidays,
    });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch holidays.' },
      { status: 500 }
    );
  }
}

/** Admin only: Add a new holiday / no-class date */
export async function POST(req: NextRequest) {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = holidaySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: parseResult.error.errors[0]?.message || 'Invalid data.' },
        { status: 400 }
      );
    }

    const { date, reason } = parseResult.data;

    // Upsert: if date already exists, update the reason
    const existing = await db
      .select()
      .from(holidays)
      .where(eq(holidays.date, date))
      .limit(1);

    let holiday;
    if (existing.length > 0) {
      [holiday] = await db
        .update(holidays)
        .set({ reason })
        .where(eq(holidays.date, date))
        .returning();
    } else {
      [holiday] = await db
        .insert(holidays)
        .values({ date, reason })
        .returning();
    }

    return NextResponse.json({
      success: true,
      message: 'Holiday saved successfully.',
      holiday,
    });
  } catch (error) {
    console.error('Error saving holiday:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save holiday.' },
      { status: 500 }
    );
  }
}

/** Admin only: Delete a holiday by id (?id=123) */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id') || '', 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, message: 'Valid holiday id is required.' },
        { status: 400 }
      );
    }

    await db.delete(holidays).where(eq(holidays.id, id));

    return NextResponse.json({
      success: true,
      message: 'Holiday removed successfully.',
    });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete holiday.' },
      { status: 500 }
    );
  }
}
