import { NextResponse } from 'next/server';
import { db } from '@/db';
import { classes } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const allClasses = await db
      .select({
        id: classes.id,
        name: classes.name,
        description: classes.description,
        isActive: classes.isActive,
        sessionStart: classes.sessionStart,
        sessionEnd: classes.sessionEnd,
      })
      .from(classes)
      .orderBy(classes.id);

    return NextResponse.json({
      success: true,
      classes: allClasses,
    });
  } catch (error) {
    console.error('Error fetching public classes:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch classes' },
      { status: 500 }
    );
  }
}
