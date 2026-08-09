import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { students, classes, classStudents, attendance } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { generateCSV, generateExcelBuffer } from '@/lib/export';
import { eq, sql, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'students'; // 'students' | 'classes' | 'daily'
    const classIdParam = searchParams.get('classId');
    const format = searchParams.get('format'); // 'csv' | 'xlsx' | json
    const todayStr = new Date().toISOString().split('T')[0];

    const targetClassId = classIdParam ? parseInt(classIdParam, 10) : null;

    if (type === 'students') {
      // Student-centric report
      let allStudents = await db.select().from(students).orderBy(students.name);

      const studentReports = await Promise.all(
        allStudents.map(async (student) => {
          // Get enrolled classes
          const enrolledMappings = await db
            .select({ classId: classStudents.classId, className: classes.name })
            .from(classStudents)
            .innerJoin(classes, eq(classStudents.classId, classes.id))
            .where(eq(classStudents.studentId, student.id));

          let studentClassIds = enrolledMappings.map((m) => m.classId);

          if (targetClassId && !isNaN(targetClassId)) {
            if (!studentClassIds.includes(targetClassId)) return null;
            studentClassIds = [targetClassId];
          }

          // Count total conducted attendance dates across enrolled classes
          let totalSessions = 0;
          let presentCount = 0;

          for (const cId of studentClassIds) {
            // Count unique dates attendance was marked for this class
            const uniqueDatesResult = await db
              .select({ date: attendance.attendanceDate })
              .from(attendance)
              .where(eq(attendance.classId, cId))
              .groupBy(attendance.attendanceDate);

            totalSessions += uniqueDatesResult.length;

            // Count student's present attendance in this class
            const presentResult = await db
              .select({ count: sql<number>`count(*)` })
              .from(attendance)
              .where(
                and(
                  eq(attendance.classId, cId),
                  eq(attendance.studentId, student.id)
                )
              );

            presentCount += Number(presentResult[0]?.count || 0);
          }

          // Get last active attendance date for student
          const lastAttendanceRecord = await db
            .select({ date: attendance.attendanceDate })
            .from(attendance)
            .where(eq(attendance.studentId, student.id))
            .orderBy(desc(attendance.markedAt))
            .limit(1);

          const lastAttendedDate = lastAttendanceRecord.length > 0 ? lastAttendanceRecord[0].date : 'N/A';

          const absentCount = Math.max(0, totalSessions - presentCount);
          const percentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

          return {
            studentId: student.id,
            name: student.name,
            phone: student.phone,
            totalClasses: enrolledMappings.length,
            enrolledClassNames: enrolledMappings.map((m) => m.className).join(', '),
            totalSessions,
            present: presentCount,
            totalAttended: presentCount,
            absent: absentCount,
            attendancePercentage: `${percentage}%`,
            attendanceRate: percentage,
            rawPercentage: percentage,
            lastAttendedDate,
          };
        })
      );

      const filteredReports = studentReports.filter(Boolean) as any[];

      // Handle Export format
      if (format === 'csv' || format === 'xlsx') {
        const exportRows = filteredReports.map((r) => ({
          'Student Name': r.name,
          'Phone': r.phone,
          'Classes Enrolled': r.enrolledClassNames,
          'Total Sessions': r.totalSessions,
          'Present / Attended': r.totalAttended,
          'Absent': r.absent,
          'Attendance Percentage': `${r.attendanceRate}%`,
          'Last Active Date': r.lastAttendedDate,
        }));

        if (format === 'csv') {
          const csvData = generateCSV(exportRows);
          return new NextResponse(csvData, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="student_attendance_report_${todayStr}.csv"`,
            },
          });
        }

        if (format === 'xlsx') {
          const excelBuffer = generateExcelBuffer(exportRows, 'Student Attendance');
          return new NextResponse(excelBuffer as unknown as BodyInit, {
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Content-Disposition': `attachment; filename="student_attendance_report_${todayStr}.xlsx"`,
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        type: 'students',
        reports: filteredReports,
      });
    }

    if (type === 'classes') {
      // Class-centric report
      let allClasses = await db.select().from(classes).orderBy(classes.name);
      if (targetClassId && !isNaN(targetClassId)) {
        allClasses = allClasses.filter((c) => c.id === targetClassId);
      }

      const classReports = await Promise.all(
        allClasses.map(async (cls) => {
          // Total enrolled students
          const studentCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(classStudents)
            .where(eq(classStudents.classId, cls.id));

          const totalStudents = Number(studentCountResult[0]?.count || 0);

          // Today's present students
          const todayPresentResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(attendance)
            .where(
              and(
                eq(attendance.classId, cls.id),
                eq(attendance.attendanceDate, todayStr)
              )
            );

          const todayPresent = Number(todayPresentResult[0]?.count || 0);
          const todayAbsent = Math.max(0, totalStudents - todayPresent);
          const todayPercentage = totalStudents > 0 ? Math.round((todayPresent / totalStudents) * 100) : 0;

          // Total overall sessions conducted
          const totalSessionsResult = await db
            .select({ date: attendance.attendanceDate })
            .from(attendance)
            .where(eq(attendance.classId, cls.id))
            .groupBy(attendance.attendanceDate);

          const totalSessions = totalSessionsResult.length;

          return {
            classId: cls.id,
            className: cls.name,
            totalStudents,
            todayPresent,
            todayAbsent,
            todayPercentage: `${todayPercentage}%`,
            averageAttendance: todayPercentage,
            totalSessions,
          };
        })
      );

      if (format === 'csv' || format === 'xlsx') {
        const exportRows = classReports.map((c) => ({
          'Class Name': c.className,
          'Total Students': c.totalStudents,
          "Today's Present": c.todayPresent,
          "Today's Absent": c.todayAbsent,
          "Today's Attendance %": c.todayPercentage,
          'Total Conducted Sessions': c.totalSessions,
        }));

        if (format === 'csv') {
          const csvData = generateCSV(exportRows);
          return new NextResponse(csvData, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="class_attendance_summary_${todayStr}.csv"`,
            },
          });
        }

        if (format === 'xlsx') {
          const excelBuffer = generateExcelBuffer(exportRows, 'Class Summary');
          return new NextResponse(excelBuffer as unknown as BodyInit, {
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Content-Disposition': `attachment; filename="class_attendance_summary_${todayStr}.xlsx"`,
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        type: 'classes',
        reports: classReports,
      });
    }

    if (type === 'daily') {
      // Detailed daily log export
      const dateFilter = searchParams.get('date') || todayStr;
      const query = db
        .select({
          date: attendance.attendanceDate,
          studentName: students.name,
          phone: students.phone,
          className: classes.name,
          status: attendance.status,
          markedAt: attendance.markedAt,
        })
        .from(attendance)
        .innerJoin(students, eq(attendance.studentId, students.id))
        .innerJoin(classes, eq(attendance.classId, classes.id));

      const dailyRecords = targetClassId
        ? await query.where(and(eq(attendance.attendanceDate, dateFilter), eq(attendance.classId, targetClassId)))
        : await query.where(eq(attendance.attendanceDate, dateFilter));

      return NextResponse.json({
        success: true,
        type: 'daily',
        records: dailyRecords,
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid report type' }, { status: 400 });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
