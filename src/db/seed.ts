import { db, pool } from './index';
import { mentors, classes, students, classStudents, appSettings, attendance } from './schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('🌱 Starting database seed...');

  try {
    // 1. Seed Mentor
    const existingMentor = await db.select().from(mentors).where(eq(mentors.email, 'mentor@classroom.com'));
    let mentorId: number;

    if (existingMentor.length === 0) {
      const passwordHash = await bcrypt.hash('password123', 10);
      const [inserted] = await db
        .insert(mentors)
        .values({
          name: 'Demo Mentor',
          email: 'mentor@classroom.com',
          passwordHash,
        })
        .returning();
      mentorId = inserted.id;
      console.log('✅ Demo mentor created: mentor@classroom.com / password123');
    } else {
      mentorId = existingMentor[0].id;
      console.log('ℹ️ Demo mentor already exists.');
    }

    // 2. Seed Classes
    const classList = [
      { name: 'Python', description: 'Python Programming & Data Structures' },
      { name: 'SQL', description: 'Database Design & SQL Mastery' },
      { name: 'Linux', description: 'Linux System Administration & Shell Scripting' },
    ];

    const insertedClassIds: number[] = [];

    for (const c of classList) {
      const existingClass = await db.select().from(classes).where(eq(classes.name, c.name));
      if (existingClass.length === 0) {
        const [inserted] = await db.insert(classes).values(c).returning();
        insertedClassIds.push(inserted.id);
        console.log(`✅ Class created: ${c.name}`);
      } else {
        insertedClassIds.push(existingClass[0].id);
        console.log(`ℹ️ Class already exists: ${c.name}`);
      }
    }

    // 3. Seed Students
    const studentList = [
      { name: 'Nanda Kumar', phone: '9876543210' },
      { name: 'Rahul Sharma', phone: '9876543211' },
      { name: 'Priya Patel', phone: '9876543212' },
      { name: 'Amit Singh', phone: '9876543213' },
      { name: 'Sneha Reddy', phone: '9876543214' },
      { name: 'Vikas Gupta', phone: '9876543215' },
    ];

    const insertedStudentIds: number[] = [];

    for (const s of studentList) {
      const existingStudent = await db.select().from(students).where(eq(students.phone, s.phone));
      if (existingStudent.length === 0) {
        const [inserted] = await db.insert(students).values(s).returning();
        insertedStudentIds.push(inserted.id);
        console.log(`✅ Student created: ${s.name} (${s.phone})`);
      } else {
        insertedStudentIds.push(existingStudent[0].id);
        console.log(`ℹ️ Student already exists: ${s.name}`);
      }
    }

    // 4. Enroll Students in Classes
    // Enroll all students in Python and SQL, and first 3 in Linux
    for (let i = 0; i < insertedStudentIds.length; i++) {
      const studentId = insertedStudentIds[i];

      // Assign to Python & SQL
      for (const classId of [insertedClassIds[0], insertedClassIds[1]]) {
        const existingMap = await db
          .select()
          .from(classStudents)
          .where(eq(classStudents.classId, classId));
        const isMapped = existingMap.some((m) => m.studentId === studentId);
        if (!isMapped) {
          await db.insert(classStudents).values({ classId, studentId });
        }
      }

      // Assign first 3 to Linux
      if (i < 3 && insertedClassIds[2]) {
        const classId = insertedClassIds[2];
        const existingMap = await db
          .select()
          .from(classStudents)
          .where(eq(classStudents.classId, classId));
        const isMapped = existingMap.some((m) => m.studentId === studentId);
        if (!isMapped) {
          await db.insert(classStudents).values({ classId, studentId });
        }
      }
    }
    console.log('✅ Class student memberships configured.');

    // 5. Seed App Settings (Current Class ID)
    const existingSetting = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'current_class_id'));

    if (existingSetting.length === 0 && insertedClassIds.length > 0) {
      await db.insert(appSettings).values({
        key: 'current_class_id',
        value: String(insertedClassIds[0]),
      });
      console.log(`✅ Current attendance class set to class ID ${insertedClassIds[0]} (${classList[0].name})`);
    } else {
      console.log('ℹ️ Current class setting already configured.');
    }

    console.log('🎉 Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await pool.end();
  }
}

main();
