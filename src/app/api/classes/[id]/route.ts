import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { classes } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { classSchema } from '@/lib/validation/schemas';
import { eq } from 'drizzle-orm';
import { invalidateServerCache } from '@/lib/cache/server-cache';

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
    const classId = parseInt(id, 10);
    if (isNaN(classId)) {
      return NextResponse.json({ success: false, message: 'Invalid class ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = classSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: parseResult.error.errors[0]?.message || 'Invalid data' },
        { status: 400 }
      );
    }

    const { name, description, isActive, sessionStart, sessionEnd } = parseResult.data;

    const [updatedClass] = await db
      .update(classes)
      .set({
        name: name.trim(),
        description: description?.trim() || null,
        isActive,
        sessionStart: sessionStart || null,
        sessionEnd: sessionEnd || null,
        updatedAt: new Date(),
      })
      .where(eq(classes.id, classId))
      .returning();

    // Invalidate class + dashboard caches after write
    invalidateServerCache('classes:');
    invalidateServerCache('dashboard:');

    return NextResponse.json({
      success: true,
      message: 'Class updated successfully.',
      class: updatedClass,
    });
  } catch (error) {
    console.error('Error updating class:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update class' },
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
    const classId = parseInt(id, 10);
    if (isNaN(classId)) {
      return NextResponse.json({ success: false, message: 'Invalid class ID' }, { status: 400 });
    }

    await db.delete(classes).where(eq(classes.id, classId));

    // Invalidate class + dashboard caches after delete
    invalidateServerCache('classes:');
    invalidateServerCache('dashboard:');

    return NextResponse.json({
      success: true,
      message: 'Class deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting class:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete class' },
      { status: 500 }
    );
  }
}
