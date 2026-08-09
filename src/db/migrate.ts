import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { db, pool } from './index';

async function main() {
  console.log('⏳ Running database migrations...');
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Database migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
