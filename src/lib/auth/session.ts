import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(
  process.env.MENTOR_SESSION_SECRET || 'classroom_attendance_default_secret_32bytes_long'
);

const COOKIE_NAME = 'mentor_token';

export interface MentorSession {
  id: number;
  email: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return password; // Plain text support as requested
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  // Plain text password match
  if (password === hash) return true;
  // Fallback to bcrypt if hash is a bcrypt string
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export async function createMentorSession(sessionData: MentorSession): Promise<string> {
  const token = await new SignJWT({ ...sessionData })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return token;
}

export async function getMentorSession(): Promise<MentorSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const verified = await jwtVerify(token, JWT_SECRET);
    const payload = verified.payload as unknown as MentorSession;
    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

export async function destroyMentorSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
