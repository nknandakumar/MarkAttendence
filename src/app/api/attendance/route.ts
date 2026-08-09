import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { attendance, students, classes } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const classIdParam = searchParams.get('classId');
    const studentIdParam = searchParams.get('studentId');
    const dateParam = searchParams.get('date');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Build conditions
    const conditions = [];

    if (classIdParam) {
      const cId = parseInt(classIdParam, 10);
      if (!isNaN(cId)) conditions.push(eq(attendance.classId, cId));
    }

    if (studentIdParam) {
      const sId = parseInt(studentIdParam, 10);
      if (!isNaN(sId)) conditions.push(eq(attendance.studentId, sId));
    }

    if (dateParam) {
      conditions.push(eq(attendance.attendanceDate, dateParam));
    } else {
      if (startDateParam) conditions.push(gte(attendance.attendanceDate, startDateParam));
      if (endDateParam) conditions.push(lte(attendance.attendanceDate, endDateParam));
    }

    const query = db
      .select({
        id: attendance.id,
        attendanceDate: attendance.attendanceDate,
        status: attendance.status,
        markedAt: attendance.markedAt,
        ipAddress: attendance.ipAddress,
        studentId: attendance.studentId,
        studentName: students.name,
        studentPhone: students.phone,
        classId: attendance.classId,
        className: classes.name,
      })
      .from(attendance)
      .innerJoin(students, eq(attendance.studentId, students.id))
      .innerJoin(classes, eq(attendance.classId, classes.id))
      .orderBy(desc(attendance.markedAt));

    const records = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

    return NextResponse.json({
      success: true,
      attendance: records,
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch attendance history' },
      { status: 500 }
    );
  }
}
