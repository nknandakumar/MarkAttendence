CREATE TABLE "holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" varchar(10) NOT NULL,
	"reason" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "holidays_date_unique" UNIQUE("date")
);
--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "session_start" varchar(5);--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "session_end" varchar(5);--> statement-breakpoint
CREATE INDEX "holidays_date_idx" ON "holidays" USING btree ("date");