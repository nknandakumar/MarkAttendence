import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { students, classes, classStudents, attendance } from '@/db/schema';
import { isClassroomNetwork } from '@/lib/network/is-classroom-network';
import { markAttendanceSchema } from '@/lib/validation/schemas';
import { checkRateLimit } from '@/lib/rate-limit';
import { eq, and } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    // 1. IP Network Verification (Server-Side)
    const { isAllowed, clientIp } = isClassroomNetwork(req);
    if (!isAllowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'CLASSROOM_NETWORK_REQUIRED',
          message: 'Connect to the classroom Wi-Fi to mark attendance.',
        },
        { status: 403 }
      );
    }

    // 2. Rate Limiting (60 requests per minute per IP)
    const rateLimit = checkRateLimit(clientIp, 60, 60000);
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests. Please wait a moment before trying again.',
        },
        { status: 429 }
      );
    }

    // 3. Request Payload Validation
    const body = await req.json().catch(() => ({}));
    const parseResult = markAttendanceSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors[0]?.message || 'Invalid phone number format.';
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_INPUT',
          message: errorMsg,
        },
        { status: 400 }
      );
    }

    const { phone: normalizedPhone, classId: requestedClassId } = parseResult.data;

    // 4. Find Student by Phone
    const studentRecords = await db
      .select()
      .from(students)
      .where(eq(students.phone, normalizedPhone))
      .limit(1);

    if (studentRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'STUDENT_NOT_FOUND',
          message: 'Phone number is not registered.',
        },
        { status: 404 }
      );
    }

    const student = studentRecords[0];

    // 5. Determine Target Class
    const targetClassId = requestedClassId;

    if (!targetClassId || isNaN(targetClassId)) {
      return NextResponse.json(
        {
          success: false,
          code: 'NO_CLASS_SELECTED',
          message: 'Please select a class for attendance.',
        },
        { status: 400 }
      );
    }

    const currentClassId = targetClassId;

    // Verify class exists
    const classRecords = await db
      .select()
      .from(classes)
      .where(eq(classes.id, currentClassId))
      .limit(1);

    if (classRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'CLASS_NOT_FOUND',
          message: 'Selected class was not found.',
        },
        { status: 400 }
      );
    }

    // 6. Check Student Membership in Active Class
    const membershipRecords = await db
      .select()
      .from(classStudents)
      .where(
        and(
          eq(classStudents.classId, currentClassId),
          eq(classStudents.studentId, student.id)
        )
      )
      .limit(1);

    if (membershipRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'NOT_ENROLLED',
          message: `Student "${student.name}" is not enrolled in ${classRecords[0].name}.`,
        },
        { status: 400 }
      );
    }

    // 7. Today's Date String (YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0];

    // 8. Check Existing Attendance Record
    const existingAttendance = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.classId, currentClassId),
          eq(attendance.studentId, student.id),
          eq(attendance.attendanceDate, todayStr)
        )
      )
      .limit(1);

    if (existingAttendance.length > 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'ALREADY_MARKED',
          message: 'Attendance already marked today.',
          studentName: student.name,
        },
        { status: 200 }
      );
    }

    // 9. Insert Attendance (with DB Unique Constraint safety)
    try {
      await db.insert(attendance).values({
        classId: currentClassId,
        studentId: student.id,
        attendanceDate: todayStr,
        status: 'Present',
        ipAddress: clientIp,
      });

      return NextResponse.json({
        success: true,
        studentName: student.name,
        className: classRecords[0].name,
        message: 'Attendance marked successfully.',
      });
    } catch (err: any) {
      // Postgres duplicate constraint error code 23505
      if (err?.code === '23505' || err?.message?.includes('unique') || err?.message?.includes('duplicate')) {
        return NextResponse.json(
          {
            success: false,
            code: 'ALREADY_MARKED',
            message: 'Attendance already marked today.',
            studentName: student.name,
          },
          { status: 200 }
        );
      }
      throw err;
    }
  } catch (error: any) {
    console.error('Error marking attendance:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
      { status: 500 }
    );
  }
}
