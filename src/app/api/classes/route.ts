import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { classes, classStudents, attendance } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { classSchema } from '@/lib/validation/schemas';
import { eq, sql, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch classes
    const allClasses = await db.select().from(classes).orderBy(classes.id);

    // Enhance classes with statistics
    const enhancedClasses = await Promise.all(
      allClasses.map(async (cls) => {
        // Total enrolled students
        const studentCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(classStudents)
          .where(eq(classStudents.classId, cls.id));

        const studentCount = Number(studentCountResult[0]?.count || 0);

        // Today's present students count
        const todayAttendanceResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(attendance)
          .where(
            and(
              eq(attendance.classId, cls.id),
              eq(attendance.attendanceDate, todayStr)
            )
          );

        const todayPresent = Number(todayAttendanceResult[0]?.count || 0);

        return {
          ...cls,
          studentCount,
          todayPresent,
          sessionStart: cls.sessionStart ?? null,
          sessionEnd: cls.sessionEnd ?? null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      classes: enhancedClasses,
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch classes' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = classSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: parseResult.error.errors[0]?.message || 'Invalid class data' },
        { status: 400 }
      );
    }

    const { name, description, isActive, sessionStart, sessionEnd } = parseResult.data;

    // Check duplicate name
    const existing = await db
      .select()
      .from(classes)
      .where(eq(classes.name, name.trim()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, message: 'A class with this name already exists.' },
        { status: 400 }
      );
    }

    const [newClass] = await db
      .insert(classes)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        isActive,
        sessionStart: sessionStart || null,
        sessionEnd: sessionEnd || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Class created successfully.',
      class: newClass,
    });
  } catch (error) {
    console.error('Error creating class:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create class' },
      { status: 500 }
    );
  }
}
