import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { students, classes, classStudents } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { normalizePhoneNumber } from '@/lib/validation/schemas';
import { eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const targetClassIdStr = formData.get('classId') as string | null;
    const targetClassId = targetClassIdStr ? parseInt(targetClassIdStr, 10) : null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Please upload a CSV or XLSX file.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);

    if (!rawRows || rawRows.length === 0) {
      return NextResponse.json({ success: false, message: 'The uploaded file is empty.' }, { status: 400 });
    }

    let importedCount = 0;
    const invalid: { row: number; name?: string; phone?: string; reason: string }[] = [];

    // Pre-fetch existing students map by phone
    const existingStudentsList = await db.select().from(students);
    const studentMapByPhone = new Map(existingStudentsList.map((s) => [s.phone, s]));

    // Pre-fetch classes list
    const allClasses = await db.select().from(classes);
    const classNameMap = new Map(allClasses.map((c) => [c.name.toLowerCase().trim(), c.id]));

    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];
      const rowNum = index + 2; // header is row 1
      const keys = Object.keys(row);

      // Flexibly map column keys (handles headers like "Email Address", "full name", "Phone number")
      const emailKey = keys.find((k) => k.toLowerCase().includes('email') || k.toLowerCase().includes('mail'));
      const nameKey = keys.find((k) => {
        const lk = k.toLowerCase();
        return !lk.includes('email') && !lk.includes('mail') && (lk.includes('name') || lk.includes('student'));
      });
      const phoneKey = keys.find((k) => {
        const lk = k.toLowerCase();
        return !lk.includes('email') && (lk.includes('phone') || lk.includes('mobile') || lk.includes('contact') || lk.includes('number'));
      });
      const classKey = keys.find((k) => {
        const lk = k.toLowerCase();
        return lk.includes('class') || lk.includes('subject') || lk.includes('course');
      });

      const rawEmail = emailKey ? String(row[emailKey]).trim() : '';
      const rawName = nameKey ? String(row[nameKey]).trim() : '';
      const rawPhone = phoneKey ? String(row[phoneKey]).trim() : '';
      const rawClassName = classKey ? String(row[classKey]).trim() : '';

      if (!rawName) {
        invalid.push({ row: rowNum, phone: rawPhone, reason: 'Missing student name' });
        continue;
      }

      const normalizedPhone = normalizePhoneNumber(rawPhone);
      if (!normalizedPhone || normalizedPhone.length < 7 || normalizedPhone.length > 15) {
        invalid.push({ row: rowNum, name: rawName, phone: rawPhone, reason: 'Invalid phone number format' });
        continue;
      }

      // Determine class ID to assign
      let assignClassId = targetClassId;
      if (!assignClassId && rawClassName) {
        const foundId = classNameMap.get(rawClassName.toLowerCase());
        if (foundId) assignClassId = foundId;
      }

      let studentIdToEnroll: number;

      // Handle duplicate / existing phone numbers: Upsert student without throwing duplicate error
      if (studentMapByPhone.has(normalizedPhone)) {
        const existingStudent = studentMapByPhone.get(normalizedPhone)!;
        studentIdToEnroll = existingStudent.id;

        // Update student name / email if provided
        const updateData: Record<string, any> = {};
        if (rawName && rawName !== existingStudent.name) updateData.name = rawName;
        if (rawEmail && rawEmail !== existingStudent.email) updateData.email = rawEmail;

        if (Object.keys(updateData).length > 0) {
          await db
            .update(students)
            .set({ ...updateData, updatedAt: new Date() })
            .where(eq(students.id, existingStudent.id));
        }
      } else {
        // Insert new student
        const [insertedStudent] = await db
          .insert(students)
          .values({
            name: rawName,
            phone: normalizedPhone,
            email: rawEmail || null,
          })
          .returning();

        studentIdToEnroll = insertedStudent.id;
        studentMapByPhone.set(normalizedPhone, insertedStudent);
      }

      importedCount++;

      // Assign student to target class if specified
      if (assignClassId) {
        await db
          .insert(classStudents)
          .values({
            classId: assignClassId,
            studentId: studentIdToEnroll,
          })
          .catch(() => {}); // ignore if already enrolled in this class
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: rawRows.length,
        importedCount,
        duplicateCount: 0,
        invalidCount: invalid.length,
        invalid,
      },
      message: `Import completed successfully: ${importedCount} student records processed and enrolled.`,
    });
  } catch (error: any) {
    console.error('Error importing students:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to process file import: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
