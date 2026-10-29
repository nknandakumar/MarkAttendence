import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tests, testMarks } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { testMarksBatchSchema } from '@/lib/validation/schemas';
import { eq, sql } from 'drizzle-orm';
import { invalidateServerCache } from '@/lib/cache/server-cache';

export const dynamic = 'force-dynamic';

export async function POST(
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

    // 1. Verify test exists and get maxMarks for M1, M2, MI
    const testRecord = await db
      .select({
        id: tests.id,
        maxMarks: tests.maxMarks,
        maxMarksM1: tests.maxMarksM1,
        maxMarksM2: tests.maxMarksM2,
        maxMarksMI: tests.maxMarksMI,
      })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1);

    if (testRecord.length === 0) {
      return NextResponse.json({ success: false, message: 'Test not found' }, { status: 404 });
    }

    const { maxMarks, maxMarksM1, maxMarksM2, maxMarksMI } = testRecord[0];

    // 2. Parse payload
    const body = await req.json().catch(() => ({}));
    const parseResult = testMarksBatchSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: parseResult.error.errors[0]?.message || 'Invalid marks data',
        },
        { status: 400 }
      );
    }

    const { marks } = parseResult.data;

    // 3. Validate marks against maximum marks
    for (const item of marks) {
      // Validate M1
      if (!item.isAbsentM1 && item.marksM1 !== null && item.marksM1 !== undefined) {
        if (item.marksM1 > maxMarksM1) {
          return NextResponse.json(
            { success: false, message: `Mock Test 1 mark (${item.marksM1}) exceeds max marks (${maxMarksM1}).` },
            { status: 400 }
          );
        }
      }
      // Validate M2
      if (!item.isAbsentM2 && item.marksM2 !== null && item.marksM2 !== undefined) {
        if (item.marksM2 > maxMarksM2) {
          return NextResponse.json(
            { success: false, message: `Mock Test 2 mark (${item.marksM2}) exceeds max marks (${maxMarksM2}).` },
            { status: 400 }
          );
        }
      }
      // Validate MI
      if (!item.isAbsentMI && item.marksMI !== null && item.marksMI !== undefined) {
        if (item.marksMI > maxMarksMI) {
          return NextResponse.json(
            { success: false, message: `Mock Interview mark (${item.marksMI}) exceeds max marks (${maxMarksMI}).` },
            { status: 400 }
          );
        }
      }
    }

    // 4. Upsert marks records
    for (const item of marks) {
      const hasM1 = !item.isAbsentM1 && item.marksM1 !== null && item.marksM1 !== undefined;
      const hasM2 = !item.isAbsentM2 && item.marksM2 !== null && item.marksM2 !== undefined;
      const hasMI = !item.isAbsentMI && item.marksMI !== null && item.marksMI !== undefined;

      const anyEntered = hasM1 || hasM2 || hasMI;
      const allAbsent = item.isAbsentM1 && item.isAbsentM2 && item.isAbsentMI;

      // Compute total marks scored
      let totalScore: number | null = null;
      if (anyEntered) {
        totalScore =
          (hasM1 ? Number(item.marksM1) : 0) +
          (hasM2 ? Number(item.marksM2) : 0) +
          (hasMI ? Number(item.marksMI) : 0);
      } else if (item.marksObtained !== null && item.marksObtained !== undefined && !item.isAbsent) {
        totalScore = Number(item.marksObtained);
      }

      const isOverallAbsent = allAbsent || (item.isAbsent && !anyEntered);

      await db
        .insert(testMarks)
        .values({
          testId,
          studentId: item.studentId,
          marksObtained: totalScore,
          isAbsent: isOverallAbsent,
          marksM1: item.isAbsentM1 ? null : item.marksM1 ?? null,
          isAbsentM1: Boolean(item.isAbsentM1),
          marksM2: item.isAbsentM2 ? null : item.marksM2 ?? null,
          isAbsentM2: Boolean(item.isAbsentM2),
          marksMI: item.isAbsentMI ? null : item.marksMI ?? null,
          isAbsentMI: Boolean(item.isAbsentMI),
          notes: item.notes || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [testMarks.testId, testMarks.studentId],
          set: {
            marksObtained: totalScore,
            isAbsent: isOverallAbsent,
            marksM1: item.isAbsentM1 ? null : item.marksM1 ?? null,
            isAbsentM1: Boolean(item.isAbsentM1),
            marksM2: item.isAbsentM2 ? null : item.marksM2 ?? null,
            isAbsentM2: Boolean(item.isAbsentM2),
            marksMI: item.isAbsentMI ? null : item.marksMI ?? null,
            isAbsentMI: Boolean(item.isAbsentMI),
            notes: item.notes || null,
            updatedAt: new Date(),
          },
        });
    }

    invalidateServerCache('tests:');

    return NextResponse.json({
      success: true,
      message: 'Student marks saved successfully.',
    });
  } catch (error) {
    console.error('Error saving marks:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save marks' },
      { status: 500 }
    );
  }
}
