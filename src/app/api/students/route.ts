import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { students, classStudents, classes } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { studentSchema, normalizePhoneNumber } from '@/lib/validation/schemas';
import { eq, inArray, sql } from 'drizzle-orm';
import { invalidateServerCache } from '@/lib/cache/server-cache';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() || '';
    const classIdParam = searchParams.get('classId');
    const countOnly = searchParams.get('countOnly') === 'true';

    // If caller only needs the total count, return it with a single COUNT query
    if (countOnly) {
      const countResult = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(students);
      return NextResponse.json({
        success: true,
        count: Number(countResult[0]?.count ?? 0),
      });
    }

    // === Optimized: Fetch all students + all their class mappings in 2 queries (was N+1) ===

    // Query 1: all students (optionally filtered by classId membership)
    let allStudents;
    if (classIdParam) {
      const classIdNum = parseInt(classIdParam, 10);
      if (!isNaN(classIdNum)) {
        // Only fetch students enrolled in the given class — single JOIN query
        allStudents = await db
          .select({
            id: students.id,
            name: students.name,
            phone: students.phone,
            createdAt: students.createdAt,
            updatedAt: students.updatedAt,
          })
          .from(students)
          .innerJoin(classStudents, eq(classStudents.studentId, students.id))
          .where(eq(classStudents.classId, classIdNum))
          .orderBy(students.id);
      } else {
        allStudents = await db.select().from(students).orderBy(students.id);
      }
    } else {
      allStudents = await db.select().from(students).orderBy(students.id);
    }

    // Apply search filter in-memory (fast, no extra DB round-trip)
    if (search) {
      const lowerSearch = search.toLowerCase();
      const normalizedSearchPhone = normalizePhoneNumber(search);
      allStudents = allStudents.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerSearch) ||
          (normalizedSearchPhone && s.phone.includes(normalizedSearchPhone))
      );
    }

    if (allStudents.length === 0) {
      return NextResponse.json({ success: true, students: [] });
    }

    // Query 2: fetch ALL class enrollments for ALL students in one JOIN query
    const studentIds = allStudents.map((s) => s.id);
    const allMappings = await db
      .select({
        studentId: classStudents.studentId,
        classId: classes.id,
        className: classes.name,
      })
      .from(classStudents)
      .innerJoin(classes, eq(classStudents.classId, classes.id))
      .where(inArray(classStudents.studentId, studentIds));

    // Group mappings by studentId in memory — O(N) single pass
    const mappingsByStudentId = new Map<number, { id: number; name: string }[]>();
    for (const m of allMappings) {
      const existing = mappingsByStudentId.get(m.studentId) || [];
      existing.push({ id: m.classId, name: m.className });
      mappingsByStudentId.set(m.studentId, existing);
    }

    // Merge without any additional DB queries
    const enhancedStudents = allStudents.map((student) => {
      const mappings = mappingsByStudentId.get(student.id) || [];
      return {
        ...student,
        classes: mappings,
        enrolledClasses: mappings,
        classIds: mappings.map((m) => m.id),
      };
    });

    return NextResponse.json({
      success: true,
      students: enhancedStudents,
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch students' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = studentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: parseResult.error.errors[0]?.message || 'Invalid student data' },
        { status: 400 }
      );
    }

    const { name, phone, classIds } = parseResult.data;

    // Check duplicate phone
    const existing = await db
      .select()
      .from(students)
      .where(eq(students.phone, phone))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, message: `Phone number ${phone} is already registered to ${existing[0].name}.` },
        { status: 400 }
      );
    }

    // Insert student
    const [newStudent] = await db
      .insert(students)
      .values({
        name: name.trim(),
        phone,
      })
      .returning();

    // Assign classes in one batch insert if provided
    if (classIds && classIds.length > 0) {
      await db.insert(classStudents).values(
        classIds.map((cId) => ({ classId: cId, studentId: newStudent.id }))
      );
    }

    // Invalidate class cache (student counts changed)
    invalidateServerCache('classes:');
    invalidateServerCache('dashboard:');

    return NextResponse.json({
      success: true,
      message: 'Student created successfully.',
      student: newStudent,
    });
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create student' },
      { status: 500 }
    );
  }
}
