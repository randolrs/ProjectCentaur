import type { DigestRunSummary } from '@/lib/digest/pipeline';
import type { IngestResult } from '@/lib/racing/ingest';

export type AdminActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type IngestActionResult = AdminActionResult<IngestResult>;
export type DigestActionResult = AdminActionResult<DigestRunSummary>;
