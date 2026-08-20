import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tests, testMarks, classes, classStudents, students } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { updateTestSchema } from '@/lib/validation/schemas';
import { eq, and } from 'drizzle-orm';
import { invalidateServerCache } from '@/lib/cache/server-cache';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const testId = parseInt(id, 10);
    if (isNaN(testId)) {
      return NextResponse.json({ success: false, message: 'Invalid test ID' }, { status: 400 });
    }

    // 1. Fetch test
    const testResult = await db
      .select({
        id: tests.id,
        classId: tests.classId,
        className: classes.name,
        title: tests.title,
        testDate: tests.testDate,
        maxMarks: tests.maxMarks,
        createdAt: tests.createdAt,
        updatedAt: tests.updatedAt,
      })
      .from(tests)
      .innerJoin(classes, eq(tests.classId, classes.id))
      .where(eq(tests.id, testId))
      .limit(1);

    if (testResult.length === 0) {
      return NextResponse.json({ success: false, message: 'Test not found' }, { status: 404 });
    }

    const test = testResult[0];

    // 2. Fetch all enrolled students for this class
    const enrolledStudents = await db
      .select({
        id: students.id,
        name: students.name,
        phone: students.phone,
      })
      .from(students)
      .innerJoin(classStudents, eq(classStudents.studentId, students.id))
      .where(eq(classStudents.classId, test.classId))
      .orderBy(students.name);

    // 3. Fetch existing marks for this test
    const recordedMarks = await db
      .select({
        id: testMarks.id,
        studentId: testMarks.studentId,
        marksObtained: testMarks.marksObtained,
        isAbsent: testMarks.isAbsent,
        notes: testMarks.notes,
      })
      .from(testMarks)
      .where(eq(testMarks.testId, testId));

    const marksMap = new Map<number, (typeof recordedMarks)[0]>();
    for (const m of recordedMarks) {
      marksMap.set(m.studentId, m);
    }

    // 4. Merge student list with their marks
    const studentListWithMarks = enrolledStudents.map((s) => {
      const record = marksMap.get(s.id);
      const marksObtained = record ? record.marksObtained : null;
      const isAbsent = record ? record.isAbsent : false;
      const notes = record ? record.notes : null;
      const markId = record ? record.id : null;

      const percentage =
        !isAbsent && marksObtained !== null && marksObtained !== undefined && test.maxMarks > 0
          ? Math.round((marksObtained / test.maxMarks) * 1000) / 10
          : null;

      return {
        studentId: s.id,
        studentName: s.name,
        studentPhone: s.phone,
        markId,
        marksObtained,
        isAbsent,
        notes,
        percentage,
      };
    });

    // Compute live stats
    const scoredList = studentListWithMarks.filter((s) => !s.isAbsent && s.marksObtained !== null);
    const absentList = studentListWithMarks.filter((s) => s.isAbsent);

    let averageMarks: number | null = null;
    let averagePercentage: number | null = null;
    let highestMarks: number | null = null;
    let lowestMarks: number | null = null;

    if (scoredList.length > 0) {
      const scores = scoredList.map((s) => s.marksObtained as number);
      const sum = scores.reduce((a, b) => a + b, 0);
      averageMarks = Math.round((sum / scores.length) * 10) / 10;
      averagePercentage = test.maxMarks > 0 ? Math.round((averageMarks / test.maxMarks) * 1000) / 10 : 0;
      highestMarks = Math.max(...scores);
      lowestMarks = Math.min(...scores);
    }

    return NextResponse.json({
      success: true,
      test: {
        ...test,
        enrolledCount: enrolledStudents.length,
        gradedCount: scoredList.length,
        absentCount: absentList.length,
        averageMarks,
        averagePercentage,
        highestMarks,
        lowestMarks,
      },
      students: studentListWithMarks,
    });
  } catch (error) {
    console.error('Error fetching test details:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch test details' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const testId = parseInt(id, 10);
    if (isNaN(testId)) {
      return NextResponse.json({ success: false, message: 'Invalid test ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = updateTestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: parseResult.error.errors[0]?.message || 'Invalid update data' },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (parseResult.data.title !== undefined) updates.title = parseResult.data.title.trim();
    if (parseResult.data.testDate !== undefined) updates.testDate = parseResult.data.testDate;
    if (parseResult.data.maxMarks !== undefined) updates.maxMarks = parseResult.data.maxMarks;
    if (parseResult.data.classId !== undefined) updates.classId = parseResult.data.classId;

    const [updatedTest] = await db
      .update(tests)
      .set(updates)
      .where(eq(tests.id, testId))
      .returning();

    if (!updatedTest) {
      return NextResponse.json({ success: false, message: 'Test not found' }, { status: 404 });
    }

    invalidateServerCache('tests:');

    return NextResponse.json({
      success: true,
      message: 'Test updated successfully.',
      test: updatedTest,
    });
  } catch (error) {
    console.error('Error updating test:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update test' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const testId = parseInt(id, 10);
    if (isNaN(testId)) {
      return NextResponse.json({ success: false, message: 'Invalid test ID' }, { status: 400 });
    }

    const deleted = await db.delete(tests).where(eq(tests.id, testId)).returning();

    if (deleted.length === 0) {
      return NextResponse.json({ success: false, message: 'Test not found' }, { status: 404 });
    }

    invalidateServerCache('tests:');

    return NextResponse.json({
      success: true,
      message: 'Test and associated marks deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting test:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete test' },
      { status: 500 }
    );
  }
}
