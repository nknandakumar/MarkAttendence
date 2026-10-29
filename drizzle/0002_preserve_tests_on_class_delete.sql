-- Add class_name column to tests table to preserve class name after class deletion
ALTER TABLE "tests" ADD COLUMN "class_name" varchar(255);
--> statement-breakpoint

-- Backfill class_name from classes table for existing tests
UPDATE "tests" SET "class_name" = (
  SELECT "name" FROM "classes" WHERE "classes"."id" = "tests"."class_id"
) WHERE "class_name" IS NULL;
--> statement-breakpoint

-- Set a fallback for any orphaned tests
UPDATE "tests" SET "class_name" = 'Deleted Class' WHERE "class_name" IS NULL;
--> statement-breakpoint

-- Make class_name NOT NULL after backfill
ALTER TABLE "tests" ALTER COLUMN "class_name" SET NOT NULL;
--> statement-breakpoint

-- Make class_id nullable (was NOT NULL before)
ALTER TABLE "tests" ALTER COLUMN "class_id" DROP NOT NULL;
--> statement-breakpoint

-- Drop the old cascade FK constraint
ALTER TABLE "tests" DROP CONSTRAINT IF EXISTS "tests_class_id_classes_id_fk";
--> statement-breakpoint

-- Add new FK with SET NULL on delete
ALTER TABLE "tests" ADD CONSTRAINT "tests_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
