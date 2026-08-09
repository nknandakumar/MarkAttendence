import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { students, classStudents } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { studentSchema } from '@/lib/validation/schemas';
import { eq, and, ne } from 'drizzle-orm';

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
    const studentId = parseInt(id, 10);
    if (isNaN(studentId)) {
      return NextResponse.json({ success: false, message: 'Invalid student ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = studentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: parseResult.error.errors[0]?.message || 'Invalid data' },
        { status: 400 }
      );
    }

    const { name, phone, classIds } = parseResult.data;

    // Check phone collision with other student
    const existing = await db
      .select()
      .from(students)
      .where(and(eq(students.phone, phone), ne(students.id, studentId)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, message: `Phone number ${phone} is already registered to another student.` },
        { status: 400 }
      );
    }

    // Update student info
    const [updatedStudent] = await db
      .update(students)
      .set({
        name: name.trim(),
        phone,
        updatedAt: new Date(),
      })
      .where(eq(students.id, studentId))
      .returning();

    // Update class assignments
    if (classIds !== undefined) {
      // Clear old mappings
      await db.delete(classStudents).where(eq(classStudents.studentId, studentId));
      // Add new mappings
      for (const cId of classIds) {
        await db.insert(classStudents).values({
          classId: cId,
          studentId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Student updated successfully.',
      student: updatedStudent,
    });
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update student' },
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
    const studentId = parseInt(id, 10);
    if (isNaN(studentId)) {
      return NextResponse.json({ success: false, message: 'Invalid student ID' }, { status: 400 });
    }

    await db.delete(students).where(eq(students.id, studentId));

    return NextResponse.json({
      success: true,
      message: 'Student deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete student' },
      { status: 500 }
    );
  }
}
