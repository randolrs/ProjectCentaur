import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { type DigestRow, digests, type NewDigestRow } from '@/db/schema';

// ---------------------------------------------------------------------------
// Digest persistence.
//
// One `digests` row per (user, racing day). The pipeline skips a user whose
// row is already `sent`, so a re-triggered run never re-sends a digest a
// user already received; a prior skip or failure is retried.
// ---------------------------------------------------------------------------

/** The digest row for a user on a racing day, or null if none exists. */
export async function getDigest(
  userId: string,
  raceDate: string,
): Promise<DigestRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(digests)
    .where(and(eq(digests.userId, userId), eq(digests.raceDate, raceDate)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Persist a digest run's outcome. Upserts on the (user, race_date) key so a
 * retried run overwrites a prior attempt for the same day rather than
 * failing on the unique constraint.
 */
export async function recordDigest(row: NewDigestRow): Promise<void> {
  const db = getDb();
  const { id: _id, createdAt: _createdAt, ...mutable } = row;
  await db
    .insert(digests)
    .values(row)
    .onConflictDoUpdate({
      target: [digests.userId, digests.raceDate],
      set: { ...mutable, updatedAt: new Date() },
    });
}
