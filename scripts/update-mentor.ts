import { db, pool } from '../src/db/index';
import { mentors } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function updateMentor() {
  console.log('🔄 Updating mentor credentials in live Neon DB...');
  try {
    const updated = await db
      .update(mentors)
      .set({
        name: 'Admin',
        email: 'admin', // Plain text username
        passwordHash: 'password123', // Plain text password
        updatedAt: new Date(),
      })
      .where(eq(mentors.id, 1))
      .returning();

    console.log('✅ Mentor row updated successfully in Neon DB:');
    console.log(updated);
  } catch (err) {
    console.error('❌ Error updating mentor in DB:', err);
  } finally {
    await pool.end();
  }
}

updateMentor();
