import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { students, classes, classStudents, attendance, holidays } from '@/db/schema';
import { isClassroomNetwork } from '@/lib/network/is-classroom-network';
import { markAttendanceSchema } from '@/lib/validation/schemas';
import { checkRateLimit } from '@/lib/rate-limit';
import { eq, and } from 'drizzle-orm';

/**
 * Returns the current time in IST as { hours, minutes, timeStr }
 * where timeStr is "HH:MM" in 24-hour format.
 */
function getISTTime() {
  const now = new Date();
  // IST = UTC + 5:30
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { hours, minutes, timeStr };
}

/**
 * Returns today's date string in YYYY-MM-DD based on IST.
 */
function getISTDateStr() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  return istDate.toISOString().split('T')[0];
}

/** Format 24h HH:MM to 12h H:MM AM/PM */
function formatTime12h(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

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

    // 4. Weekend Check (IST) — Saturday (6) and Sunday (0) are non-class days
    const todayStr = getISTDateStr();
    const dayOfWeek = new Date(todayStr + 'T00:00:00Z').getUTCDay(); // 0=Sun, 6=Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const dayName = dayOfWeek === 0 ? 'Sunday' : 'Saturday';
      return NextResponse.json(
        {
          success: false,
          code: 'SESSION_HOLIDAY',
          message: `No class today — it's ${dayName}! Enjoy your weekend. 🎉`,
        },
        { status: 403 }
      );
    }

    // 5. Public Holiday / No-Class Check
    const holidayRecord = await db
      .select()
      .from(holidays)
      .where(eq(holidays.date, todayStr))
      .limit(1);

    if (holidayRecord.length > 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'SESSION_HOLIDAY',
          message: `No class today — ${holidayRecord[0].reason}. See you next time! 🎉`,
        },
        { status: 403 }
      );
    }

    // 6. Find Student by Phone
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

    // 7. Determine Target Class automatically via Current IST Time
    const { timeStr: currentTimeStr } = getISTTime();
    let classRecord: any = null;

    if (requestedClassId && !isNaN(requestedClassId)) {
      const found = await db
        .select()
        .from(classes)
        .where(eq(classes.id, requestedClassId))
        .limit(1);
      if (found.length > 0) classRecord = found[0];
    }

    // If classId wasn't passed or not found, find the currently active class for current time
    if (!classRecord) {
      const allClasses = await db.select().from(classes);
      const activeClass = allClasses.find((c) => {
        if (!c.isActive) return false;
        if (!c.sessionStart || !c.sessionEnd) return false;
        return currentTimeStr >= c.sessionStart && currentTimeStr <= c.sessionEnd;
      });

      if (!activeClass) {
        return NextResponse.json(
          {
            success: false,
            code: 'SESSION_CLOSED',
            message: 'No active class session right now. Attendance is currently closed.',
          },
          { status: 403 }
        );
      }

      classRecord = activeClass;
    }

    const currentClassId = classRecord.id;

    // 8. Verify Session Time Window (IST) for the class
    if (classRecord.sessionStart && classRecord.sessionEnd) {
      if (currentTimeStr < classRecord.sessionStart || currentTimeStr > classRecord.sessionEnd) {
        const isBeforeSession = currentTimeStr < classRecord.sessionStart;
        const message = isBeforeSession
          ? `Session for ${classRecord.name} opens at ${formatTime12h(classRecord.sessionStart)}. Please wait until class starts.`
          : `Session for ${classRecord.name} closed at ${formatTime12h(classRecord.sessionEnd)}. Attendance window has ended.`;

        return NextResponse.json(
          {
            success: false,
            code: 'SESSION_CLOSED',
            message,
            sessionStart: classRecord.sessionStart,
            sessionEnd: classRecord.sessionEnd,
          },
          { status: 403 }
        );
      }
    }

    // 9. Check Student Membership in Active Class
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
          message: `Student "${student.name}" is not enrolled in ${classRecord.name}.`,
        },
        { status: 400 }
      );
    }

    // 10. Check Existing Attendance Record
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
          message: `Attendance already marked today for ${classRecord.name}.`,
          studentName: student.name,
        },
        { status: 200 }
      );
    }

    // 11. Insert Attendance
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
        className: classRecord.name,
        message: 'Attendance marked successfully.',
      });
    } catch (err: any) {
      if (err?.code === '23505' || err?.message?.includes('unique') || err?.message?.includes('duplicate')) {
        return NextResponse.json(
          {
            success: false,
            code: 'ALREADY_MARKED',
            message: `Attendance already marked today for ${classRecord.name}.`,
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
