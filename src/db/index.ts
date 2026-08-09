import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

// Create Neon serverless pool connection
export const pool = new Pool({
  connectionString: connectionString || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
});

export const db = drizzle(pool, { schema });
