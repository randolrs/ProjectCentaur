import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Drizzle is pointed at the Supabase Postgres instance via DATABASE_URL.
// Schema definitions and the first generated migration land in M1.
export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
