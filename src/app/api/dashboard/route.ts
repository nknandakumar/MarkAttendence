import { NextResponse } from 'next/server';
import { db } from '@/db';
import { classes, classStudents, students, attendance } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { withCache, invalidateServerCache } from '@/lib/cache/server-cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// IST date helper
function getISTDateStr(): string {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(Date.now() + istOffsetMs).toISOString().split('T')[0];
}

/**
 * Combined dashboard endpoint — returns everything the dashboard needs in ONE request.
 * 
 * Before: 3 sequential HTTP calls → 3 DB round-trips + N+1 queries per class
 * After:  1 HTTP call → 4 DB queries total, results cached for 15 seconds
 * 
 * When 50+ students mark attendance simultaneously, this caching ensures
 * the mentor dashboard doesn't fire N+1 DB queries per page refresh.
 */
export async function GET() {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const todayStr = getISTDateStr();
    const cacheKey = `dashboard:${todayStr}`;

    const dashboardData = await withCache(cacheKey, 15_000, async () => {
      // Run all independent queries in PARALLEL — not sequential
      const [allClasses, studentCountResult, studentCounts, todayAttendanceCounts] =
        await Promise.all([
          // Query 1: all classes
          db.select().from(classes).orderBy(classes.id),

          // Query 2: total student count (single COUNT)
          db.select({ count: sql<number>`cast(count(*) as int)` }).from(students),

          // Query 3: enrolled count per class (single GROUP BY)
          db
            .select({
              classId: classStudents.classId,
              count: sql<number>`cast(count(*) as int)`,
            })
            .from(classStudents)
            .groupBy(classStudents.classId),

          // Query 4: today's present count per class (single GROUP BY)
          db
            .select({
              classId: attendance.classId,
              count: sql<number>`cast(count(*) as int)`,
            })
            .from(attendance)
            .where(eq(attendance.attendanceDate, todayStr))
            .groupBy(attendance.classId),
        ]);

      // Build O(1) lookup maps
      const studentCountMap = new Map<number, number>(
        studentCounts.map((r) => [r.classId, Number(r.count)])
      );
      const attendanceCountMap = new Map<number, number>(
        todayAttendanceCounts.map((r) => [r.classId, Number(r.count)])
      );

      const enhancedClasses = allClasses.map((cls) => ({
        ...cls,
        studentCount: studentCountMap.get(cls.id) ?? 0,
        todayPresent: attendanceCountMap.get(cls.id) ?? 0,
        sessionStart: cls.sessionStart ?? null,
        sessionEnd: cls.sessionEnd ?? null,
      }));

      return {
        classes: enhancedClasses,
        totalStudents: Number(studentCountResult[0]?.count ?? 0),
      };
    });

    return NextResponse.json({
      success: true,
      mentor: session,
      ...dashboardData,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}
