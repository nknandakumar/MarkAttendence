import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { attendance, students, classes, classStudents } from '@/db/schema';
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
    const includeAbsentParam = searchParams.get('includeAbsent');

    const includeAbsent = includeAbsentParam !== 'false';

    // 1. Fetch Existing Attendance Records from DB
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
    } else if (startDateParam || endDateParam) {
      if (startDateParam) conditions.push(gte(attendance.attendanceDate, startDateParam));
      if (endDateParam) conditions.push(lte(attendance.attendanceDate, endDateParam));
    }

    const presentQuery = db
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

    const existingRecords = conditions.length > 0
      ? await presentQuery.where(and(...conditions))
      : await presentQuery;

    // If includeAbsent is false or date range is used without single date, return existing records
    if (!includeAbsent) {
      return NextResponse.json({
        success: true,
        attendance: existingRecords,
      });
    }

    // 2. Fetch Enrolled Students to compute absent students for target date
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istTodayStr = new Date(Date.now() + istOffsetMs).toISOString().split('T')[0];
    const targetDate = dateParam || istTodayStr;

    const enrolledConditions = [];
    if (classIdParam) {
      const cId = parseInt(classIdParam, 10);
      if (!isNaN(cId)) enrolledConditions.push(eq(classStudents.classId, cId));
    }
    if (studentIdParam) {
      const sId = parseInt(studentIdParam, 10);
      if (!isNaN(sId)) enrolledConditions.push(eq(classStudents.studentId, sId));
    }

    const enrolledQuery = db
      .select({
        studentId: classStudents.studentId,
        studentName: students.name,
        studentPhone: students.phone,
        classId: classStudents.classId,
        className: classes.name,
      })
      .from(classStudents)
      .innerJoin(students, eq(classStudents.studentId, students.id))
      .innerJoin(classes, eq(classStudents.classId, classes.id));

    const enrolledList = enrolledConditions.length > 0
      ? await enrolledQuery.where(and(...enrolledConditions))
      : await enrolledQuery;

    // Map existing attendance records by "classId_studentId_attendanceDate"
    const existingMap = new Map<string, any>();
    existingRecords.forEach((rec) => {
      const key = `${rec.classId}_${rec.studentId}_${rec.attendanceDate}`;
      existingMap.set(key, rec);
    });

    // Build synthetic Absent records for students who don't have an attendance entry on targetDate
    const absentRecords: any[] = [];
    enrolledList.forEach((enrolled) => {
      const key = `${enrolled.classId}_${enrolled.studentId}_${targetDate}`;
      if (!existingMap.has(key)) {
        absentRecords.push({
          id: `absent-${enrolled.classId}-${enrolled.studentId}`,
          attendanceDate: targetDate,
          status: 'Absent',
          markedAt: null,
          ipAddress: null,
          studentId: enrolled.studentId,
          studentName: enrolled.studentName,
          studentPhone: enrolled.studentPhone,
          classId: enrolled.classId,
          className: enrolled.className,
        });
      }
    });

    // Combine existing records (which contain Present + manually marked Absent) and synthetic Absent records
    const allAttendance = [...existingRecords, ...absentRecords];

    return NextResponse.json({
      success: true,
      attendance: allAttendance,
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch attendance history' },
      { status: 500 }
    );
  }
}
