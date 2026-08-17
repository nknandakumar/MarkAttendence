import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { students, classes, classStudents, attendance } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { eq, and } from 'drizzle-orm';
import { invalidateServerCache } from '@/lib/cache/server-cache';

/**
 * Admin Manual Attendance Marking API Route
 * Requires Mentor Session authentication.
 * Bypasses Wi-Fi, time window, weekend, and holiday restrictions!
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify Mentor Authentication Session
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Mentor session required.' },
        { status: 401 }
      );
    }

    // 2. Parse Request Body
    const body = await req.json().catch(() => ({}));
    const { studentId, classId, attendanceDate, status } = body;

    const sId = parseInt(String(studentId), 10);
    const cId = parseInt(String(classId), 10);
    const dateStr = String(attendanceDate || '').trim() || new Date().toISOString().split('T')[0];
    const attendanceStatus = String(status || 'Present').trim();

    if (isNaN(sId) || isNaN(cId)) {
      return NextResponse.json(
        { success: false, message: 'Please select both a valid student and class.' },
        { status: 400 }
      );
    }

    // 3. Verify Student exists
    const studentRecords = await db
      .select()
      .from(students)
      .where(eq(students.id, sId))
      .limit(1);

    if (studentRecords.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Selected student was not found.' },
        { status: 404 }
      );
    }
    const student = studentRecords[0];

    // 4. Verify Class exists
    const classRecords = await db
      .select()
      .from(classes)
      .where(eq(classes.id, cId))
      .limit(1);

    if (classRecords.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Selected class was not found.' },
        { status: 404 }
      );
    }
    const classRecord = classRecords[0];

    // 5. Check if Student is enrolled in Class; if not enrolled, automatically enroll them!
    const membershipRecords = await db
      .select()
      .from(classStudents)
      .where(
        and(
          eq(classStudents.classId, cId),
          eq(classStudents.studentId, sId)
        )
      )
      .limit(1);

    if (membershipRecords.length === 0) {
      // Auto-enroll for convenience
      await db.insert(classStudents).values({
        classId: cId,
        studentId: sId,
      });
    }

    // 6. Upsert Attendance record for the given date (Admin override)
    const existing = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.classId, cId),
          eq(attendance.studentId, sId),
          eq(attendance.attendanceDate, dateStr)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing record status
      await db
        .update(attendance)
        .set({
          status: attendanceStatus,
          markedAt: new Date(),
        })
        .where(eq(attendance.id, existing[0].id));

      // Invalidate caches so dashboard reflects updated status
      invalidateServerCache('dashboard:');
      invalidateServerCache('classes:');

      return NextResponse.json({
        success: true,
        message: `Attendance updated to '${attendanceStatus}' for ${student.name} on ${dateStr}.`,
        studentName: student.name,
        className: classRecord.name,
      });
    } else {
      // Insert new attendance record
      await db.insert(attendance).values({
        classId: cId,
        studentId: sId,
        attendanceDate: dateStr,
        status: attendanceStatus,
        ipAddress: 'Admin Override',
      });

      // Invalidate caches so dashboard reflects new attendance
      invalidateServerCache('dashboard:');
      invalidateServerCache('classes:');

      return NextResponse.json({
        success: true,
        message: `Attendance marked as '${attendanceStatus}' for ${student.name} on ${dateStr}.`,
        studentName: student.name,
        className: classRecord.name,
      });
    }
  } catch (error: any) {
    console.error('Error in admin manual attendance entry:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to mark attendance. Please try again.' },
      { status: 500 }
    );
  }
}
