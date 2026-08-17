// Quick script to apply only the new columns/table from 0001 migration
// Run with: npx ts-node --project tsconfig.json scripts/apply-new-migration.ts

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('Applying new migration: holidays table + session time columns...');
  
  try {
    // Create holidays table (idempotent)
    await sql`
      CREATE TABLE IF NOT EXISTS "holidays" (
        "id" serial PRIMARY KEY NOT NULL,
        "date" varchar(10) NOT NULL,
        "reason" varchar(255) NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "holidays_date_unique" UNIQUE("date")
      )
    `;
    console.log('✅ holidays table created (or already exists)');

    await sql`CREATE INDEX IF NOT EXISTS "holidays_date_idx" ON "holidays" USING btree ("date")`;
    console.log('✅ holidays_date_idx created');

    // Add session_start column if it doesn't exist
    await sql`
      ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "session_start" varchar(5)
    `;
    console.log('✅ session_start column added to classes');

    // Add session_end column if it doesn't exist
    await sql`
      ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "session_end" varchar(5)
    `;
    console.log('✅ session_end column added to classes');

    // Add email column to students if it doesn't exist
    await sql`
      ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "email" varchar(255)
    `;
    console.log('✅ email column added to students');

    console.log('\n🎉 All migrations applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
