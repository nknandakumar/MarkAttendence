import { z } from 'zod';

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  // Strip non-digit characters
  let digits = phone.replace(/\D/g, '');
  // If 12 digits starting with 91 (India country code), reduce to 10 digits if valid
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  // If 11 digits starting with 0, strip leading zero
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

export const markAttendanceSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required.')
    .transform((val) => normalizePhoneNumber(val))
    .refine((val) => val.length >= 7 && val.length <= 15, {
      message: 'Please enter a valid phone number (7 to 15 digits).',
    }),
  classId: z.number().optional(),
});

export const mentorLoginSchema = z.object({
  username: z.string().min(1, 'Username is required.'),
  password: z.string().min(4, 'Password must be at least 4 characters.'),
});

// HH:MM 24h time format validator
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// YYYY-MM-DD date format validator
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const classSchema = z.object({
  name: z.string().min(1, 'Class name is required.').max(100),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  classType: z.enum(['weekday', 'weekend']).default('weekday').optional(),
  sessionStart: z.string().min(1, 'Session start time is required.').regex(timeRegex, 'Session start must be in HH:MM format.'),
  sessionEnd: z.string().min(1, 'Session end time is required.').regex(timeRegex, 'Session end must be in HH:MM format.'),
  startDate: z
    .string()
    .regex(dateRegex, 'Start date must be in YYYY-MM-DD format.')
    .optional()
    .nullable(),
  endDate: z
    .string()
    .regex(dateRegex, 'End date must be in YYYY-MM-DD format.')
    .optional()
    .nullable(),
});

export const studentSchema = z.object({
  name: z.string().min(1, 'Student name is required.').max(100),
  phone: z
    .string()
    .min(1, 'Phone number is required.')
    .transform((val) => normalizePhoneNumber(val))
    .refine((val) => val.length >= 7 && val.length <= 15, {
      message: 'Please enter a valid phone number (7 to 15 digits).',
    }),
  classIds: z.array(z.number()).optional(),
});

export const appSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export const holidaySchema = z.object({
  date: z
    .string()
    .regex(dateRegex, 'Date must be in YYYY-MM-DD format.')
    .min(1, 'Date is required.'),
  reason: z
    .string()
    .min(1, 'Reason is required.')
    .max(255, 'Reason must be 255 characters or less.'),
});

export const testSchema = z.object({
  classId: z.number({ required_error: 'Class is required' }),
  title: z.string().min(1, 'Test title is required.').max(255),
  testDate: z
    .string()
    .regex(dateRegex, 'Test date must be in YYYY-MM-DD format.')
    .min(1, 'Test date is required.'),
  maxMarksM1: z.number().int().positive().optional().default(50),
  maxMarksM2: z.number().int().positive().optional().default(50),
  maxMarksMI: z.number().int().positive().optional().default(50),
  maxMarks: z
    .number()
    .int('Maximum marks must be an integer')
    .positive('Maximum marks must be greater than 0')
    .optional(),
});

export const updateTestSchema = z.object({
  classId: z.number().optional(),
  title: z.string().min(1, 'Test title is required.').max(255).optional(),
  testDate: z
    .string()
    .regex(dateRegex, 'Test date must be in YYYY-MM-DD format.')
    .optional(),
  maxMarksM1: z.number().int().positive().optional(),
  maxMarksM2: z.number().int().positive().optional(),
  maxMarksMI: z.number().int().positive().optional(),
  maxMarks: z
    .number()
    .int('Maximum marks must be an integer')
    .positive('Maximum marks must be greater than 0')
    .optional(),
});

export const singleMarkSchema = z.object({
  studentId: z.number({ required_error: 'Student ID is required' }),
  marksM1: z.number().int().min(0).nullable().optional(),
  isAbsentM1: z.boolean().default(false),
  marksM2: z.number().int().min(0).nullable().optional(),
  isAbsentM2: z.boolean().default(false),
  marksMI: z.number().int().min(0).nullable().optional(),
  isAbsentMI: z.boolean().default(false),
  marksObtained: z.number().int().min(0).nullable().optional(),
  isAbsent: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export const testMarksBatchSchema = z.object({
  marks: z.array(singleMarkSchema),
});

