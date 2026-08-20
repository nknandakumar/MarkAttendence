// Migration script for tests and test_marks tables
// Run with: npx tsx scripts/apply-tests-migration.ts

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('Applying tests and test_marks migration...');
  
  try {
    // 1. Create tests table
    await sql`
      CREATE TABLE IF NOT EXISTS "tests" (
        "id" serial PRIMARY KEY NOT NULL,
        "class_id" integer NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
        "title" varchar(255) NOT NULL,
        "test_date" varchar(10) NOT NULL,
        "max_marks" integer NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('✅ tests table created (or already exists)');

    await sql`CREATE INDEX IF NOT EXISTS "tests_class_id_idx" ON "tests" USING btree ("class_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "tests_date_idx" ON "tests" USING btree ("test_date")`;
    console.log('✅ tests indexes created');

    // 2. Create test_marks table
    await sql`
      CREATE TABLE IF NOT EXISTS "test_marks" (
        "id" serial PRIMARY KEY NOT NULL,
        "test_id" integer NOT NULL REFERENCES "tests"("id") ON DELETE CASCADE,
        "student_id" integer NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "marks_obtained" integer,
        "is_absent" boolean DEFAULT false NOT NULL,
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "test_marks_test_student_unique" UNIQUE("test_id", "student_id")
      )
    `;
    console.log('✅ test_marks table created (or already exists)');

    await sql`CREATE INDEX IF NOT EXISTS "test_marks_test_id_idx" ON "test_marks" USING btree ("test_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "test_marks_student_id_idx" ON "test_marks" USING btree ("student_id")`;
    console.log('✅ test_marks indexes created');

    console.log('\n🎉 All test migrations applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
