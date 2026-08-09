import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { students, classStudents, classes } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { studentSchema, normalizePhoneNumber } from '@/lib/validation/schemas';
import { eq, inArray } from 'drizzle-orm';

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

    let allStudents = await db.select().from(students).orderBy(students.id);

    // Filter search by name or phone
    if (search) {
      const lowerSearch = search.toLowerCase();
      const normalizedSearchPhone = normalizePhoneNumber(search);
      allStudents = allStudents.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerSearch) ||
          (normalizedSearchPhone && s.phone.includes(normalizedSearchPhone))
      );
    }

    // Enhance students with enrolled class details
    const enhancedStudents = await Promise.all(
      allStudents.map(async (student) => {
        const mappings = await db
          .select({
            id: classes.id,
            name: classes.name,
          })
          .from(classStudents)
          .innerJoin(classes, eq(classStudents.classId, classes.id))
          .where(eq(classStudents.studentId, student.id));

        return {
          ...student,
          classes: mappings,
          enrolledClasses: mappings,
          classIds: mappings.map((m) => m.id),
        };
      })
    );

    // Filter by class ID if requested
    let finalStudents = enhancedStudents;
    if (classIdParam) {
      const classIdNum = parseInt(classIdParam, 10);
      if (!isNaN(classIdNum)) {
        finalStudents = enhancedStudents.filter((s) =>
          s.classIds.includes(classIdNum)
        );
      }
    }

    return NextResponse.json({
      success: true,
      students: finalStudents,
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

    // Assign classes if provided
    if (classIds && classIds.length > 0) {
      for (const cId of classIds) {
        await db.insert(classStudents).values({
          classId: cId,
          studentId: newStudent.id,
        });
      }
    }

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
