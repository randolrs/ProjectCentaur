import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseUrl } from '@/lib/env';
import * as schema from './schema';

// Lazily-initialised Drizzle client over the Supabase Postgres instance.
// Lazy so that importing this module never throws when DATABASE_URL is
// absent (e.g. in unit tests or build steps that don't touch the DB).

let client: ReturnType<typeof postgres> | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!database) {
    client = postgres(getDatabaseUrl(), { prepare: false });
    database = drizzle(client, { schema });
  }
  return database;
}
