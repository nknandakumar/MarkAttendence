import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  index,
  unique,
} from 'drizzle-orm/pg-core';

export const mentors = pgTable('mentors', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const students = pgTable(
  'students',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }).notNull().unique(),
    email: varchar('email', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('students_phone_idx').on(table.phone),
  ]
);

export const classes = pgTable('classes', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  // Session window: "HH:MM" in 24h format (e.g. "10:00", "11:10"). Null = no restriction.
  sessionStart: varchar('session_start', { length: 5 }),
  sessionEnd: varchar('session_end', { length: 5 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const classStudents = pgTable(
  'class_students',
  {
    id: serial('id').primaryKey(),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('class_student_unique').on(table.classId, table.studentId),
    index('class_students_class_id_idx').on(table.classId),
    index('class_students_student_id_idx').on(table.studentId),
  ]
);

export const attendance = pgTable(
  'attendance',
  {
    id: serial('id').primaryKey(),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    attendanceDate: varchar('attendance_date', { length: 10 }).notNull(), // YYYY-MM-DD
    status: varchar('status', { length: 50 }).default('Present').notNull(),
    markedAt: timestamp('marked_at').defaultNow().notNull(),
    ipAddress: varchar('ip_address', { length: 100 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('attendance_class_student_date_unique').on(
      table.classId,
      table.studentId,
      table.attendanceDate
    ),
    index('attendance_student_id_idx').on(table.studentId),
    index('attendance_class_id_idx').on(table.classId),
    index('attendance_date_idx').on(table.attendanceDate),
  ]
);

export const appSettings = pgTable('app_settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * holidays — Admin-managed no-class dates.
 * Covers both public/festival holidays and ad-hoc "no class today" dates.
 * Date format: YYYY-MM-DD
 */
export const holidays = pgTable(
  'holidays',
  {
    id: serial('id').primaryKey(),
    date: varchar('date', { length: 10 }).notNull().unique(), // YYYY-MM-DD, one entry per day
    reason: varchar('reason', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('holidays_date_idx').on(table.date),
  ]
);

export type Mentor = typeof mentors.$inferSelect;
export type NewMentor = typeof mentors.$inferInsert;

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;

export type ClassModel = typeof classes.$inferSelect;
export type NewClassModel = typeof classes.$inferInsert;

export type ClassStudent = typeof classStudents.$inferSelect;
export type NewClassStudent = typeof classStudents.$inferInsert;

export type Attendance = typeof attendance.$inferSelect;
export type NewAttendance = typeof attendance.$inferInsert;

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;

export type Holiday = typeof holidays.$inferSelect;
export type NewHoliday = typeof holidays.$inferInsert;
