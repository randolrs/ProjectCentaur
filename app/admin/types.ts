import type { IngestDaySummary } from '@/db/queries';
import type { ConditionPollResult } from '@/lib/alerts/poller';
import type { DigestRunSummary, UserDigestResult } from '@/lib/digest/pipeline';
import type { BackfillResult, IngestResult } from '@/lib/racing/ingest';
import type { SeedTracksResult } from '@/lib/racing/seed-tracks';

export type AdminActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type IngestActionResult = AdminActionResult<IngestResult>;
export type DigestActionResult = AdminActionResult<DigestRunSummary>;
export type IngestDayActionResult = AdminActionResult<IngestDaySummary>;
export type EmailDigestActionResult = AdminActionResult<UserDigestResult>;
export type BackfillActionResult = AdminActionResult<BackfillResult>;
export type ConditionPollActionResult = AdminActionResult<ConditionPollResult>;

/** Seed result plus the catalog's total US track count after the upsert. */
export type SeedTracksActionResult = AdminActionResult<
  SeedTracksResult & { catalogTracks: number }
>;
