import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { students, classes, classStudents, attendance } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { generateCSV, generateExcelBuffer } from '@/lib/export';
import { eq, sql, and, desc, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// IST date helper
function getISTDateStr(): string {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(Date.now() + istOffsetMs).toISOString().split('T')[0];
}

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
    const todayStr = getISTDateStr();

    const targetClassId = classIdParam ? parseInt(classIdParam, 10) : null;

    if (type === 'students') {
      // === Optimized Student Report: was N+1 per student, now 5 parallel queries ===

      // 1. Get all students (optionally filtered by class)
      let allStudents = await db.select().from(students).orderBy(students.name);

      // 2. Get all class enrollments in one JOIN query
      const allEnrollments = await db
        .select({
          studentId: classStudents.studentId,
          classId: classStudents.classId,
          className: classes.name,
        })
        .from(classStudents)
        .innerJoin(classes, eq(classStudents.classId, classes.id));

      // If filtering by class, only keep students in that class
      if (targetClassId && !isNaN(targetClassId)) {
        const enrolledStudentIds = new Set(
          allEnrollments
            .filter((e) => e.classId === targetClassId)
            .map((e) => e.studentId)
        );
        allStudents = allStudents.filter((s) => enrolledStudentIds.has(s.id));
      }

      if (allStudents.length === 0) {
        return NextResponse.json({ success: true, type: 'students', reports: [] });
      }

      const studentIds = allStudents.map((s) => s.id);

      // 3. Get total attendance dates per class (for session count) — one query
      const uniqueSessionDates = await db
        .select({
          classId: attendance.classId,
          date: attendance.attendanceDate,
        })
        .from(attendance)
        .groupBy(attendance.classId, attendance.attendanceDate);

      // 4. Get present count per (student, class) pair — one query
      const presentCounts = await db
        .select({
          studentId: attendance.studentId,
          classId: attendance.classId,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(attendance)
        .where(inArray(attendance.studentId, studentIds))
        .groupBy(attendance.studentId, attendance.classId);

      // 5. Get last active date per student — one query
      const lastActiveDates = await db
        .select({
          studentId: attendance.studentId,
          lastDate: sql<string>`max(${attendance.attendanceDate})`,
        })
        .from(attendance)
        .where(inArray(attendance.studentId, studentIds))
        .groupBy(attendance.studentId);

      // Build lookup maps
      const enrollmentsByStudent = new Map<number, { classId: number; className: string }[]>();
      for (const e of allEnrollments) {
        const arr = enrollmentsByStudent.get(e.studentId) || [];
        arr.push({ classId: e.classId, className: e.className });
        enrollmentsByStudent.set(e.studentId, arr);
      }

      // Sessions per class: Map<classId, Set<date>>
      const sessionsByClass = new Map<number, number>();
      for (const row of uniqueSessionDates) {
        sessionsByClass.set(row.classId, (sessionsByClass.get(row.classId) || 0) + 1);
      }

      // Present counts: Map<"studentId_classId", number>
      const presentMap = new Map<string, number>();
      for (const row of presentCounts) {
        presentMap.set(`${row.studentId}_${row.classId}`, Number(row.count));
      }

      // Last active date: Map<studentId, string>
      const lastActiveMap = new Map<number, string>();
      for (const row of lastActiveDates) {
        lastActiveMap.set(row.studentId, row.lastDate);
      }

      // Build report — no DB queries in loop
      const studentReports = allStudents.map((student) => {
        const enrolledClasses = enrollmentsByStudent.get(student.id) || [];

        // Filter to target class if specified
        const relevantClasses = targetClassId && !isNaN(targetClassId)
          ? enrolledClasses.filter((e) => e.classId === targetClassId)
          : enrolledClasses;

        let totalSessions = 0;
        let presentCount = 0;

        for (const ec of relevantClasses) {
          totalSessions += sessionsByClass.get(ec.classId) || 0;
          presentCount += presentMap.get(`${student.id}_${ec.classId}`) || 0;
        }

        const absentCount = Math.max(0, totalSessions - presentCount);
        const percentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;
        const lastAttendedDate = lastActiveMap.get(student.id) || 'N/A';

        return {
          studentId: student.id,
          name: student.name,
          phone: student.phone,
          totalClasses: enrolledClasses.length,
          enrolledClassNames: enrolledClasses.map((e) => e.className).join(', '),
          totalSessions,
          present: presentCount,
          totalAttended: presentCount,
          absent: absentCount,
          attendancePercentage: `${percentage}%`,
          attendanceRate: percentage,
          rawPercentage: percentage,
          lastAttendedDate,
        };
      });

      if (format === 'csv' || format === 'xlsx') {
        const exportRows = studentReports.map((r) => ({
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
        reports: studentReports,
      });
    }

    if (type === 'classes') {
      // === Optimized Class Report: was N+1 per class, now 3 parallel queries ===

      let allClasses = await db.select().from(classes).orderBy(classes.name);
      if (targetClassId && !isNaN(targetClassId)) {
        allClasses = allClasses.filter((c) => c.id === targetClassId);
      }

      if (allClasses.length === 0) {
        return NextResponse.json({ success: true, type: 'classes', reports: [] });
      }

      const classIds = allClasses.map((c) => c.id);

      // Run 3 queries in parallel
      const [studentCounts, todayAttendanceCounts, totalSessionCounts] = await Promise.all([
        // Student count per class
        db
          .select({
            classId: classStudents.classId,
            count: sql<number>`cast(count(*) as int)`,
          })
          .from(classStudents)
          .where(inArray(classStudents.classId, classIds))
          .groupBy(classStudents.classId),

        // Today's present count per class
        db
          .select({
            classId: attendance.classId,
            count: sql<number>`cast(count(*) as int)`,
          })
          .from(attendance)
          .where(
            and(
              inArray(attendance.classId, classIds),
              eq(attendance.attendanceDate, todayStr)
            )
          )
          .groupBy(attendance.classId),

        // Total session count per class (distinct dates)
        db
          .select({
            classId: attendance.classId,
            sessions: sql<number>`cast(count(distinct ${attendance.attendanceDate}) as int)`,
          })
          .from(attendance)
          .where(inArray(attendance.classId, classIds))
          .groupBy(attendance.classId),
      ]);

      const studentCountMap = new Map(studentCounts.map((r) => [r.classId, Number(r.count)]));
      const todayPresentMap = new Map(todayAttendanceCounts.map((r) => [r.classId, Number(r.count)]));
      const sessionMap = new Map(totalSessionCounts.map((r) => [r.classId, Number(r.sessions)]));

      const classReports = allClasses.map((cls) => {
        const totalStudents = studentCountMap.get(cls.id) ?? 0;
        const todayPresent = todayPresentMap.get(cls.id) ?? 0;
        const todayAbsent = Math.max(0, totalStudents - todayPresent);
        const todayPercentage = totalStudents > 0 ? Math.round((todayPresent / totalStudents) * 100) : 0;
        const totalSessions = sessionMap.get(cls.id) ?? 0;

        return {
          classId: cls.id,
          className: cls.name,
          totalStudents,
          totalEnrolled: totalStudents,
          todayPresent,
          todayAbsent,
          todayPercentage: `${todayPercentage}%`,
          averageAttendance: todayPercentage,
          totalSessions,
        };
      });

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
      // Detailed daily log — already efficient (single JOIN query)
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
