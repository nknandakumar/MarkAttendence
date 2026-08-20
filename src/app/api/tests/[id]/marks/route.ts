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

    // 1. Verify test exists and get maxMarks
    const testRecord = await db
      .select({ id: tests.id, maxMarks: tests.maxMarks })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1);

    if (testRecord.length === 0) {
      return NextResponse.json({ success: false, message: 'Test not found' }, { status: 404 });
    }

    const maxMarks = testRecord[0].maxMarks;

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

    // 3. Validate marks against maxMarks
    for (const item of marks) {
      if (!item.isAbsent && item.marksObtained !== null && item.marksObtained !== undefined) {
        if (item.marksObtained > maxMarks) {
          return NextResponse.json(
            {
              success: false,
              message: `Mark ${item.marksObtained} exceeds maximum marks (${maxMarks}).`,
            },
            { status: 400 }
          );
        }
        if (item.marksObtained < 0) {
          return NextResponse.json(
            {
              success: false,
              message: 'Marks cannot be negative.',
            },
            { status: 400 }
          );
        }
      }
    }

    // 4. Upsert marks records
    // Process each student entry
    for (const item of marks) {
      const marksVal = item.isAbsent ? null : item.marksObtained ?? null;

      await db
        .insert(testMarks)
        .values({
          testId,
          studentId: item.studentId,
          marksObtained: marksVal,
          isAbsent: item.isAbsent,
          notes: item.notes || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [testMarks.testId, testMarks.studentId],
          set: {
            marksObtained: marksVal,
            isAbsent: item.isAbsent,
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
