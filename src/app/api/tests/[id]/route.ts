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

    // 1. Fetch test — className is stored directly on the test record
    const testResult = await db
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
      .where(eq(tests.id, testId))
      .limit(1);

    if (testResult.length === 0) {
      return NextResponse.json({ success: false, message: 'Test not found' }, { status: 404 });
    }

    const test = testResult[0];
    const classDeleted = test.classId === null;

    // 2. Fetch enrolled students — only if class still exists
    let enrolledStudents: { id: number; name: string; phone: string }[] = [];
    if (!classDeleted && test.classId) {
      enrolledStudents = await db
        .select({
          id: students.id,
          name: students.name,
          phone: students.phone,
        })
        .from(students)
        .innerJoin(classStudents, eq(classStudents.studentId, students.id))
        .where(eq(classStudents.classId, test.classId))
        .orderBy(students.name);
    }

    // 3. Fetch existing marks for this test (includes students who may no longer be in the class)
    const recordedMarks = await db
      .select({
        id: testMarks.id,
        studentId: testMarks.studentId,
        studentName: students.name,
        studentPhone: students.phone,
        marksObtained: testMarks.marksObtained,
        isAbsent: testMarks.isAbsent,
        marksM1: testMarks.marksM1,
        isAbsentM1: testMarks.isAbsentM1,
        marksM2: testMarks.marksM2,
        isAbsentM2: testMarks.isAbsentM2,
        marksMI: testMarks.marksMI,
        isAbsentMI: testMarks.isAbsentMI,
        notes: testMarks.notes,
      })
      .from(testMarks)
      .innerJoin(students, eq(testMarks.studentId, students.id))
      .where(eq(testMarks.testId, testId));

    // 4. Build a merged student list:
    //    - All currently enrolled students (if class exists)
    //    - Plus any students who have marks recorded but may no longer be enrolled
    const marksMap = new Map<number, (typeof recordedMarks)[0]>();
    for (const m of recordedMarks) {
      marksMap.set(m.studentId, m);
    }

    const seenStudentIds = new Set<number>();
    const studentListWithMarks: any[] = [];

    // First add all currently enrolled students
    for (const s of enrolledStudents) {
      seenStudentIds.add(s.id);
      const record = marksMap.get(s.id);

      studentListWithMarks.push({
        studentId: s.id,
        studentName: s.name,
        studentPhone: s.phone,
        markId: record ? record.id : null,
        marksObtained: record ? record.marksObtained : null,
        isAbsent: record ? record.isAbsent : false,
        marksM1: record ? record.marksM1 : null,
        isAbsentM1: record ? record.isAbsentM1 : false,
        marksM2: record ? record.marksM2 : null,
        isAbsentM2: record ? record.isAbsentM2 : false,
        marksMI: record ? record.marksMI : null,
        isAbsentMI: record ? record.isAbsentMI : false,
        notes: record ? record.notes : null,
      });
    }

    // Then add students who have marks but are no longer enrolled (or class was deleted)
    for (const m of recordedMarks) {
      if (!seenStudentIds.has(m.studentId)) {
        seenStudentIds.add(m.studentId);
        studentListWithMarks.push({
          studentId: m.studentId,
          studentName: m.studentName,
          studentPhone: m.studentPhone,
          markId: m.id,
          marksObtained: m.marksObtained,
          isAbsent: m.isAbsent,
          marksM1: m.marksM1,
          isAbsentM1: m.isAbsentM1,
          marksM2: m.marksM2,
          isAbsentM2: m.isAbsentM2,
          marksMI: m.marksMI,
          isAbsentMI: m.isAbsentMI,
          notes: m.notes,
        });
      }
    }

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
        classDeleted,
        enrolledCount: studentListWithMarks.length,
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
    if (parseResult.data.maxMarksM1 !== undefined) updates.maxMarksM1 = parseResult.data.maxMarksM1;
    if (parseResult.data.maxMarksM2 !== undefined) updates.maxMarksM2 = parseResult.data.maxMarksM2;
    if (parseResult.data.maxMarksMI !== undefined) updates.maxMarksMI = parseResult.data.maxMarksMI;
    if (parseResult.data.maxMarks !== undefined) {
      updates.maxMarks = parseResult.data.maxMarks;
    } else if (
      parseResult.data.maxMarksM1 !== undefined ||
      parseResult.data.maxMarksM2 !== undefined ||
      parseResult.data.maxMarksMI !== undefined
    ) {
      // Recalculate combined max marks
      const m1 = updates.maxMarksM1 ?? 50;
      const m2 = updates.maxMarksM2 ?? 50;
      const mi = updates.maxMarksMI ?? 50;
      updates.maxMarks = m1 + m2 + mi;
    }
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
