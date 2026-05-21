import { getRacingApiConfig, type RacingApiConfig } from '@/lib/env';
import {
  naEntriesResponseSchema,
  naMeetsResponseSchema,
  naResultsResponseSchema,
  type NaEntriesResponse,
  type NaMeetsResponse,
  type NaResultsResponse,
  type Racecard,
} from './types';
import { usRegionStrategy } from './regions';

export interface RacingApiClientOptions extends RacingApiConfig {
  /** Override for testing. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/** Thrown when the Racing API returns a non-2xx response. */
export class RacingApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'RacingApiError';
  }
}

/**
 * Typed client for theracingapi.com.
 *
 * This client is the only place that knows about the raw, region-specific
 * wire format. Public methods return normalized, region-agnostic
 * `Racecard` values produced by the relevant `RegionStrategy`.
 */
export class RacingApiClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: RacingApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.username = options.username;
    this.password = options.password;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Build a client from environment variables (RACING_API_* ). */
  static fromEnv(fetchImpl?: typeof fetch): RacingApiClient {
    return new RacingApiClient({ ...getRacingApiConfig(), fetchImpl });
  }

  private authHeader(): string {
    const token = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    return `Basic ${token}`;
  }

  /** Low-level GET against the Racing API, returning parsed JSON. */
  async get<T = unknown>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const response = await this.fetchImpl(url, {
      headers: {
        Authorization: this.authHeader(),
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new RacingApiError(
        `Racing API request failed: ${response.status} ${response.statusText} (${path})`,
        response.status,
        body,
      );
    }

    return (await response.json()) as T;
  }

  /**
   * List North America meets (a track's card for a day) for a date.
   *
   * The endpoint paginates: `limit` is capped at 50 by the provider and
   * `skip` offsets into the result set.
   */
  async listNorthAmericaMeets(
    date: string,
    limit = 50,
    skip = 0,
  ): Promise<NaMeetsResponse> {
    const json = await this.get('/v1/north-america/meets', {
      start_date: date,
      end_date: date,
      limit,
      skip,
    });
    return naMeetsResponseSchema.parse(json);
  }

  /** Fetch the races + runners for a single North America meet. */
  async getNorthAmericaEntries(meetId: string): Promise<NaEntriesResponse> {
    const json = await this.get(
      `/v1/north-america/meets/${encodeURIComponent(meetId)}/entries`,
    );
    return naEntriesResponseSchema.parse(json);
  }

  /** Fetch the finishing results for a single North America meet. */
  async getNorthAmericaResults(meetId: string): Promise<NaResultsResponse> {
    const json = await this.get(
      `/v1/north-america/meets/${encodeURIComponent(meetId)}/results`,
    );
    return naResultsResponseSchema.parse(json);
  }

  /**
   * v1 entry point: fetch and normalize today's US racecards.
   *
   * Returns one `Racecard` per race across every US track running today.
   * No filtering or scoring is applied here — that is digest-pipeline work.
   */
  async fetchTodayUSRacecards(): Promise<Racecard[]> {
    const raw = await usRegionStrategy.dataFetch(this);
    return usRegionStrategy.raceNormalization(raw);
  }
}
