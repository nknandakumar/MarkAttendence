import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { classes, classStudents, attendance } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { classSchema } from '@/lib/validation/schemas';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { withCache, invalidateServerCache } from '@/lib/cache/server-cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// IST date helper
function getISTDateStr(): string {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(Date.now() + istOffsetMs).toISOString().split('T')[0];
}

export async function GET() {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const todayStr = getISTDateStr();
    const cacheKey = `classes:${todayStr}`;

    const enhancedClasses = await withCache(cacheKey, 15_000, async () => {
      // 1. Fetch all classes in one query
      const allClasses = await db.select().from(classes).orderBy(classes.id);

      if (allClasses.length === 0) return [];

      const classIds = allClasses.map((c) => c.id);

      // 2. Fetch ALL student counts in ONE query using GROUP BY
      const studentCounts = await db
        .select({
          classId: classStudents.classId,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(classStudents)
        .where(inArray(classStudents.classId, classIds))
        .groupBy(classStudents.classId);

      // 3. Fetch ALL today's attendance counts in ONE query using GROUP BY
      const todayAttendanceCounts = await db
        .select({
          classId: attendance.classId,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(attendance)
        .where(
          and(
            inArray(attendance.classId, classIds),
            eq(attendance.attendanceDate, todayStr)
          )
        )
        .groupBy(attendance.classId);

      // Build lookup maps for O(1) access
      const studentCountMap = new Map<number, number>(
        studentCounts.map((r) => [r.classId, Number(r.count)])
      );
      const attendanceCountMap = new Map<number, number>(
        todayAttendanceCounts.map((r) => [r.classId, Number(r.count)])
      );

      // Merge results — 0 extra DB queries
      return allClasses.map((cls) => ({
        ...cls,
        studentCount: studentCountMap.get(cls.id) ?? 0,
        todayPresent: attendanceCountMap.get(cls.id) ?? 0,
        sessionStart: cls.sessionStart ?? null,
        sessionEnd: cls.sessionEnd ?? null,
      }));
    });

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

    const newClass = await db
      .insert(classes)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        isActive: isActive ?? true,
        sessionStart: sessionStart || null,
        sessionEnd: sessionEnd || null,
      })
      .returning();

    // Invalidate class cache after write
    invalidateServerCache('classes:');

    return NextResponse.json({
      success: true,
      class: newClass[0],
    });
  } catch (error) {
    console.error('Error creating class:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create class' },
      { status: 500 }
    );
  }
}
