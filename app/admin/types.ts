import type { IngestDaySummary } from '@/db/queries';
import type { DigestRunSummary, UserDigestResult } from '@/lib/digest/pipeline';
import type { BackfillResult, IngestResult } from '@/lib/racing/ingest';

export type AdminActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type IngestActionResult = AdminActionResult<IngestResult>;
export type DigestActionResult = AdminActionResult<DigestRunSummary>;
export type IngestDayActionResult = AdminActionResult<IngestDaySummary>;
export type EmailDigestActionResult = AdminActionResult<UserDigestResult>;
export type BackfillActionResult = AdminActionResult<BackfillResult>;
