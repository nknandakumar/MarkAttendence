-- Add start_date and end_date to classes table
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "start_date" varchar(10);
--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "end_date" varchar(10);
--> statement-breakpoint

-- Add max_marks_m1, max_marks_m2, max_marks_mi to tests table
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "max_marks_m1" integer DEFAULT 50 NOT NULL;
--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "max_marks_m2" integer DEFAULT 50 NOT NULL;
--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "max_marks_mi" integer DEFAULT 50 NOT NULL;
--> statement-breakpoint

-- Add individual marks & absent status for M1, M2, and MI to test_marks table
ALTER TABLE "test_marks" ADD COLUMN IF NOT EXISTS "marks_m1" integer;
--> statement-breakpoint
ALTER TABLE "test_marks" ADD COLUMN IF NOT EXISTS "is_absent_m1" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_marks" ADD COLUMN IF NOT EXISTS "marks_m2" integer;
--> statement-breakpoint
ALTER TABLE "test_marks" ADD COLUMN IF NOT EXISTS "is_absent_m2" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_marks" ADD COLUMN IF NOT EXISTS "marks_mi" integer;
--> statement-breakpoint
ALTER TABLE "test_marks" ADD COLUMN IF NOT EXISTS "is_absent_mi" boolean DEFAULT false NOT NULL;
