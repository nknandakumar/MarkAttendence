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
    const duplicates: { row: number; name: string; phone: string; reason: string }[] = [];
    const invalid: { row: number; name?: string; phone?: string; reason: string }[] = [];

    // Pre-fetch existing students map by phone
    const existingStudents = await db.select().from(students);
    const existingPhoneSet = new Set(existingStudents.map((s) => s.phone));

    // Pre-fetch classes list
    const allClasses = await db.select().from(classes);
    const classNameMap = new Map(allClasses.map((c) => [c.name.toLowerCase().trim(), c.id]));

    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];
      const rowNum = index + 2; // header is row 1

      // Flexibly map column keys (case-insensitive)
      const nameKey = Object.keys(row).find((k) => k.toLowerCase().includes('name'));
      const phoneKey = Object.keys(row).find(
        (k) => k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile') || k.toLowerCase().includes('contact')
      );
      const classKey = Object.keys(row).find((k) => k.toLowerCase().includes('class'));

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

      if (existingPhoneSet.has(normalizedPhone)) {
        duplicates.push({ row: rowNum, name: rawName, phone: normalizedPhone, reason: 'Phone number already registered' });
        continue;
      }

      // Determine class ID to assign
      let assignClassId = targetClassId;
      if (!assignClassId && rawClassName) {
        const foundId = classNameMap.get(rawClassName.toLowerCase());
        if (foundId) assignClassId = foundId;
      }

      // Insert student
      const [insertedStudent] = await db
        .insert(students)
        .values({
          name: rawName,
          phone: normalizedPhone,
        })
        .returning();

      existingPhoneSet.add(normalizedPhone);
      importedCount++;

      // Assign to class if specified
      if (assignClassId) {
        await db.insert(classStudents).values({
          classId: assignClassId,
          studentId: insertedStudent.id,
        }).catch(() => {}); // ignore duplicate mapping
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: rawRows.length,
        importedCount,
        duplicateCount: duplicates.length,
        invalidCount: invalid.length,
        duplicates,
        invalid,
      },
      message: `Import finished: ${importedCount} imported, ${duplicates.length} duplicates, ${invalid.length} invalid.`,
    });
  } catch (error: any) {
    console.error('Error importing students:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to process file import: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
