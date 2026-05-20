import type { TrackCoordinates } from './coordinates';

// ---------------------------------------------------------------------------
// National Weather Service forecast — free, no API key, US-only. Used to
// give the digest's LLM a real read on track conditions (rain, wind, temp)
// for each race day. A failed fetch is a clean null so the digest line is
// just omitted rather than breaking the pipeline.
// ---------------------------------------------------------------------------

const NWS_USER_AGENT = 'Furlong/1.0 (hello@furlong.co)';

export interface TrackForecast {
  /** Plain-language summary, e.g. "Partly Cloudy". */
  shortForecast: string;
  /** Daytime high, when the API returns Fahrenheit. */
  temperatureF: number | null;
  /** Wind speed text, e.g. "5 to 10 mph". */
  windSpeed: string | null;
  /** Compass wind direction, e.g. "NW". */
  windDirection: string | null;
  /** Precipitation probability 0-100, when supplied. */
  precipChancePercent: number | null;
}

interface NwsPoints {
  properties?: { forecast?: string };
}

interface NwsPeriod {
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: 'F' | 'C';
  windSpeed: string | null;
  windDirection: string | null;
  shortForecast: string;
  probabilityOfPrecipitation?: { value: number | null } | null;
}

interface NwsForecast {
  properties?: { periods?: NwsPeriod[] };
}

/** Fetch the daytime forecast period for `raceDate` at the given coordinates. */
export async function fetchTrackForecast(
  coords: TrackCoordinates,
  raceDate: string,
): Promise<TrackForecast | null> {
  try {
    const pointsRes = await fetch(
      `https://api.weather.gov/points/${coords.lat},${coords.lng}`,
      {
        headers: {
          'User-Agent': NWS_USER_AGENT,
          Accept: 'application/geo+json',
        },
      },
    );
    if (!pointsRes.ok) return null;
    const points = (await pointsRes.json()) as NwsPoints;
    const forecastUrl = points.properties?.forecast;
    if (!forecastUrl) return null;

    const forecastRes = await fetch(forecastUrl, {
      headers: {
        'User-Agent': NWS_USER_AGENT,
        Accept: 'application/geo+json',
      },
    });
    if (!forecastRes.ok) return null;
    const forecast = (await forecastRes.json()) as NwsForecast;

    const period = pickPeriodForRaceDate(
      forecast.properties?.periods ?? [],
      raceDate,
    );
    if (!period) return null;

    return {
      shortForecast: period.shortForecast,
      temperatureF:
        period.temperatureUnit === 'F' ? period.temperature : null,
      windSpeed: period.windSpeed,
      windDirection: period.windDirection,
      precipChancePercent: period.probabilityOfPrecipitation?.value ?? null,
    };
  } catch {
    return null;
  }
}

/** Pick the first daytime period whose local start date matches raceDate. */
export function pickPeriodForRaceDate(
  periods: readonly NwsPeriod[],
  raceDate: string,
): NwsPeriod | null {
  for (const period of periods) {
    if (!period.isDaytime) continue;
    if (period.startTime.slice(0, 10) === raceDate) return period;
  }
  return null;
}

/** Compact one-line summary suitable for an LLM context window. */
export function formatForecast(forecast: TrackForecast): string {
  const parts: string[] = [forecast.shortForecast];
  if (forecast.temperatureF !== null) {
    parts.push(`${forecast.temperatureF}°F`);
  }
  if (forecast.windSpeed) {
    const dir = forecast.windDirection ? ` ${forecast.windDirection}` : '';
    parts.push(`wind ${forecast.windSpeed}${dir}`);
  }
  if (
    forecast.precipChancePercent !== null &&
    forecast.precipChancePercent > 0
  ) {
    parts.push(`precip ${forecast.precipChancePercent}%`);
  }
  return parts.join(' · ');
}

// In-process cache so multiple users sharing a track in a single cron run
// only trigger one NWS fetch. Cleared between serverless invocations.
const inFlight = new Map<string, Promise<TrackForecast | null>>();

/** Fetch the forecast, deduplicating concurrent requests for the same key. */
export function getCachedForecast(
  track: string,
  coords: TrackCoordinates,
  raceDate: string,
): Promise<TrackForecast | null> {
  const key = `${track}|${raceDate}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = fetchTrackForecast(coords, raceDate);
  inFlight.set(key, promise);
  return promise;
}
