import type { NextRequest } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { getCronSecret } from '@/lib/env';
import { RacingApiClient, RacingApiError } from '@/lib/racing/client';
import { createClient } from '@/lib/supabase/server';

// TEMPORARY verification probe for results ingestion (M-results step 0).
//
// Inspects the RAW shape of the North America `/entries` payload for a meet
// that has finished, to answer: does a finished meet's runners carry
// finish/beaten-lengths/final-odds fields in the same endpoint, or do we need
// a separate results endpoint? Uses the low-level `client.get` so the zod
// schemas don't strip unknown keys. Admin-guarded; delete once the shape is
// confirmed.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** YYYY-MM-DD for `now` minus `days`, in UTC. */
function isoDateMinus(days: number, now = new Date()): string {
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Union of top-level keys seen across an array of objects. */
function keyUnion(objs: unknown[]): string[] {
  const keys = new Set<string>();
  for (const o of objs) {
    if (o && typeof o === 'object') {
      for (const k of Object.keys(o as Record<string, unknown>)) keys.add(k);
    }
  }
  return Array.from(keys).sort();
}

interface RawMeet {
  meet_id?: string;
  track_name?: string;
}
interface RawMeetsResponse {
  meets?: RawMeet[];
}
interface RawRace {
  has_results?: boolean;
  runners?: unknown[];
  race_key?: { race_number?: string };
  [key: string]: unknown;
}
interface RawEntriesResponse {
  races?: RawRace[];
  [key: string]: unknown;
}

/** Compact structural description of an arbitrary response body. */
function describeBody(body: unknown): Record<string, unknown> {
  if (Array.isArray(body)) {
    return { shape: 'array', length: body.length, itemKeys: keyUnion(body), sampleItem: body[0] ?? null };
  }
  if (!body || typeof body !== 'object') return { shape: typeof body };
  const obj = body as Record<string, unknown>;
  const out: Record<string, unknown> = { shape: 'object', topLevelKeys: keyUnion([obj]) };
  if (Array.isArray(obj.races)) {
    const races = obj.races as RawRace[];
    out.raceKeys = keyUnion(races);
    out.runnerKeys = keyUnion(races.flatMap((r) => r.runners ?? []));
    out.sampleRace = races[0] ?? null;
  }
  if (Array.isArray(obj.results)) {
    out.resultKeys = keyUnion(obj.results as unknown[]);
    out.sampleResult = (obj.results as unknown[])[0] ?? null;
  }
  return out;
}

/** Try one endpoint, capturing its HTTP status and (on 200) its shape. */
async function probeEndpoint(
  client: RacingApiClient,
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<Record<string, unknown>> {
  try {
    const body = await client.get(path, params);
    return { path, status: 200, ok: true, ...describeBody(body) };
  } catch (error) {
    if (error instanceof RacingApiError) {
      return { path, status: error.status ?? 0, ok: false };
    }
    return { path, status: 0, ok: false, error: String(error) };
  }
}

/**
 * Authorize either as a signed-in admin (browser on the production domain) or
 * with the `CRON_SECRET` bearer (a curl against a preview URL, where no admin
 * session cookie exists). Returns null when allowed.
 */
async function authorize(request: NextRequest): Promise<Response | null> {
  const auth = request.headers.get('authorization');
  if (auth) {
    try {
      if (auth === `Bearer ${getCronSecret()}`) return null;
    } catch {
      // CRON_SECRET unset — fall through to the session check.
    }
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (isAdminEmail(user?.email)) return null;
  return Response.json({ ok: false, error: 'Not authorized.' }, { status: 403 });
}

export async function GET(request: NextRequest): Promise<Response> {
  const denied = await authorize(request);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const date = params.get('date') ?? isoDateMinus(1);
  const meetOverride = params.get('meet') ?? undefined;
  const scan = Math.min(Number(params.get('scan') ?? 12) || 12, 50);

  try {
    const client = RacingApiClient.fromEnv();

    // 1. Confirm past-date meets return at all.
    const meetsRaw = await client.get<RawMeetsResponse>(
      '/v1/north-america/meets',
      { start_date: date, end_date: date, limit: 50, skip: 0 },
    );
    const meets = meetsRaw.meets ?? [];
    console.log(
      `[probe-results] date=${date} meets=${meets.length}` +
        (meets[0] ? ` first=${meets[0].meet_id} (${meets[0].track_name})` : ''),
    );

    // 2. Walk meets until we find one whose entries carry finished races.
    const meetIds = meetOverride
      ? [meetOverride]
      : meets.map((m) => m.meet_id).filter((id): id is string => Boolean(id));

    let inspectedMeetId: string | null = null;
    let entriesRaw: RawEntriesResponse | null = null;
    let finishedRace: RawRace | null = null;
    const perMeet: { meetId: string; races: number; withResults: number }[] = [];

    for (const meetId of meetIds.slice(0, scan)) {
      const e = await client.get<RawEntriesResponse>(
        `/v1/north-america/meets/${encodeURIComponent(meetId)}/entries`,
      );
      const races = e.races ?? [];
      const withResults = races.filter((r) => r.has_results === true);
      perMeet.push({ meetId, races: races.length, withResults: withResults.length });
      if (!inspectedMeetId) {
        inspectedMeetId = meetId;
        entriesRaw = e;
      }
      if (withResults[0]) {
        inspectedMeetId = meetId;
        entriesRaw = e;
        finishedRace = withResults[0];
        break;
      }
    }

    const races = entriesRaw?.races ?? [];
    const allRunners = races.flatMap((r) => r.runners ?? []);
    const sampleRace = finishedRace ?? races[0] ?? null;
    const sampleRunner =
      (sampleRace?.runners as unknown[] | undefined)?.[0] ?? allRunners[0] ?? null;

    const raceKeys = keyUnion(races);
    const runnerKeys = keyUnion(allRunners);

    console.log(
      `[probe-results] inspectedMeet=${inspectedMeetId} ` +
        `foundFinishedRace=${Boolean(finishedRace)} ` +
        `entriesTopLevelKeys=${keyUnion([entriesRaw]).join(',')}`,
    );
    console.log(`[probe-results] raceKeys=${raceKeys.join(',')}`);
    console.log(`[probe-results] runnerKeys=${runnerKeys.join(',')}`);

    // 3. /entries carries no finishing order, only closing-odds pools. Sweep
    // the likely dedicated results-endpoint paths to find where order-of-finish
    // and beaten-lengths actually live.
    const mid = inspectedMeetId ? encodeURIComponent(inspectedMeetId) : null;
    const raceNumber = finishedRace?.race_key?.race_number;
    const candidates: { path: string; params?: Record<string, string | number> }[] = [];
    if (mid) {
      candidates.push(
        { path: `/v1/north-america/meets/${mid}/results` },
        { path: `/v1/north-america/meets/${mid}/result` },
        { path: `/v1/north-america/meets/${mid}/charts` },
        { path: `/v1/north-america/meets/${mid}/chart` },
        { path: `/v1/north-america/meets/${mid}/payouts` },
        { path: `/v1/north-america/meets/${mid}/entries/results` },
      );
      if (raceNumber) {
        candidates.push({
          path: `/v1/north-america/meets/${mid}/races/${encodeURIComponent(raceNumber)}/results`,
        });
      }
    }
    candidates.push(
      { path: '/v1/north-america/results', params: { start_date: date, end_date: date } },
      { path: '/v1/north-america/charts', params: { start_date: date, end_date: date } },
    );

    const candidateResults: Record<string, unknown>[] = [];
    for (const c of candidates) {
      candidateResults.push(await probeEndpoint(client, c.path, c.params));
    }
    for (const r of candidateResults) {
      console.log(`[probe-results] candidate ${r.path} -> status=${r.status}`);
    }

    return Response.json({
      ok: true,
      date,
      meetCount: meets.length,
      scanned: perMeet,
      inspectedMeetId,
      foundFinishedRace: Boolean(finishedRace),
      entriesTopLevelKeys: keyUnion([entriesRaw]),
      raceKeys,
      runnerKeys,
      candidateResults,
      sampleRace,
      sampleRunner,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[probe-results] failed:', message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
