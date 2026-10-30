ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "class_type" varchar(20) DEFAULT 'weekday' NOT NULL;
--> statement-breakpoint
UPDATE "classes" SET "class_type" = 'weekday' WHERE "class_type" IS NULL;

