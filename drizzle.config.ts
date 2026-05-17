import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Drizzle is pointed at the Supabase Postgres instance via DATABASE_URL.
export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  // Supabase manages the `anon` / `authenticated` / `service_role` roles —
  // don't let drizzle-kit try to create or drop them.
  entities: {
    roles: {
      provider: 'supabase',
    },
  },
  strict: true,
  verbose: true,
});
