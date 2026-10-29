import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tests, testMarks, classes, classStudents, students } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { testSchema } from '@/lib/validation/schemas';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import { invalidateServerCache } from '@/lib/cache/server-cache';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const classIdParam = searchParams.get('classId');
    const classId = classIdParam ? parseInt(classIdParam, 10) : null;

    // 1. Fetch tests — LEFT JOIN with classes since class may have been deleted
    const testList = classId && !isNaN(classId)
      ? await db
          .select({
            id: tests.id,
            classId: tests.classId,
            className: tests.className,
            title: tests.title,
            testDate: tests.testDate,
            maxMarks: tests.maxMarks,
            maxMarksM1: tests.maxMarksM1,
            maxMarksM2: tests.maxMarksM2,
            maxMarksMI: tests.maxMarksMI,
            createdAt: tests.createdAt,
            updatedAt: tests.updatedAt,
          })
          .from(tests)
          .where(eq(tests.classId, classId))
          .orderBy(desc(tests.testDate), desc(tests.id))
      : await db
          .select({
            id: tests.id,
            classId: tests.classId,
            className: tests.className,
            title: tests.title,
            testDate: tests.testDate,
            maxMarks: tests.maxMarks,
            maxMarksM1: tests.maxMarksM1,
            maxMarksM2: tests.maxMarksM2,
            maxMarksMI: tests.maxMarksMI,
            createdAt: tests.createdAt,
            updatedAt: tests.updatedAt,
          })
          .from(tests)
          .orderBy(desc(tests.testDate), desc(tests.id));

    if (testList.length === 0) {
      return NextResponse.json({ success: true, tests: [] });
    }

    const testIds = testList.map((t) => t.id);
    const classIds = Array.from(new Set(testList.map((t) => t.classId).filter((id): id is number => id !== null)));

    // 2. Fetch enrolled student counts per class in one query (only for active classes)
    let enrolledMap = new Map<number, number>();
    if (classIds.length > 0) {
      const enrolledCounts = await db
        .select({
          classId: classStudents.classId,
          count: sql<number>`cast(count(${classStudents.studentId}) as int)`,
        })
        .from(classStudents)
        .where(inArray(classStudents.classId, classIds))
        .groupBy(classStudents.classId);

      for (const row of enrolledCounts) {
        enrolledMap.set(row.classId, row.count);
      }
    }

    // 3. Fetch all marks records for these tests
    const allMarks = await db
      .select({
        testId: testMarks.testId,
        studentId: testMarks.studentId,
        studentName: students.name,
        marksObtained: testMarks.marksObtained,
        isAbsent: testMarks.isAbsent,
      })
      .from(testMarks)
      .innerJoin(students, eq(testMarks.studentId, students.id))
      .where(inArray(testMarks.testId, testIds));

    // Group marks by testId
    const marksByTest = new Map<number, typeof allMarks>();
    for (const m of allMarks) {
      const existing = marksByTest.get(m.testId) || [];
      existing.push(m);
      marksByTest.set(m.testId, existing);
    }

    // 4. Compute statistics for each test
    const enrichedTests = testList.map((test) => {
      const marks = marksByTest.get(test.id) || [];
      const enrolledCount = test.classId ? (enrolledMap.get(test.classId) || 0) : 0;

      const scoredMarks = marks.filter((m) => !m.isAbsent && m.marksObtained !== null && m.marksObtained !== undefined);
      const absentCount = marks.filter((m) => m.isAbsent).length;
      const gradedCount = scoredMarks.length;

      let averageMarks: number | null = null;
      let averagePercentage: number | null = null;
      let highestMarks: number | null = null;
      let lowestMarks: number | null = null;
      let highestScorers: string[] = [];

      if (scoredMarks.length > 0) {
        const scores = scoredMarks.map((m) => m.marksObtained as number);
        const sum = scores.reduce((a, b) => a + b, 0);
        averageMarks = Math.round((sum / scores.length) * 10) / 10;
        averagePercentage = test.maxMarks > 0 ? Math.round((averageMarks / test.maxMarks) * 1000) / 10 : 0;
        
        highestMarks = Math.max(...scores);
        lowestMarks = Math.min(...scores);

        highestScorers = scoredMarks
          .filter((m) => m.marksObtained === highestMarks)
          .map((m) => m.studentName);
      }

      return {
        ...test,
        classDeleted: test.classId === null,
        enrolledCount,
        gradedCount,
        absentCount,
        averageMarks,
        averagePercentage,
        highestMarks,
        lowestMarks,
        highestScorers,
      };
    });

    return NextResponse.json({
      success: true,
      tests: enrichedTests,
    });
  } catch (error) {
    console.error('Error fetching tests:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch tests' },
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
    const parseResult = testSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: parseResult.error.errors[0]?.message || 'Invalid test data',
        },
        { status: 400 }
      );
    }

    const { classId, title, testDate, maxMarksM1 = 50, maxMarksM2 = 50, maxMarksMI = 50 } = parseResult.data;
    const computedMaxMarks = parseResult.data.maxMarks ?? (maxMarksM1 + maxMarksM2 + maxMarksMI);

    // Check class exists and get class name to store
    const cls = await db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(eq(classes.id, classId))
      .limit(1);

    if (cls.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Selected class does not exist.' },
        { status: 404 }
      );
    }

    const [newTest] = await db
      .insert(tests)
      .values({
        classId,
        className: cls[0].name,
        title: title.trim(),
        testDate,
        maxMarks: computedMaxMarks,
        maxMarksM1,
        maxMarksM2,
        maxMarksMI,
      })
      .returning();

    invalidateServerCache('tests:');

    return NextResponse.json({
      success: true,
      message: 'Test created successfully.',
      test: {
        ...newTest,
      },
    });
  } catch (error) {
    console.error('Error creating test:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create test' },
      { status: 500 }
    );
  }
}
