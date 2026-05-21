import type { TrackCoordinates } from './coordinates';

// Geocode a track name to coordinates via OpenStreetMap's Nominatim — free,
// no key, suitable for our low volume (a handful of new tracks per month).
// Racetracks are named POIs in OSM; appending "racetrack" sharpens the hit.
// Within a few miles is plenty for a forecast, so accuracy is non-critical.

const NOMINATIM_USER_AGENT = 'Furlong/1.0 (hello@furlong.co)';

interface NominatimResult {
  lat?: string;
  lon?: string;
}

export async function geocodeTrack(
  trackName: string,
): Promise<TrackCoordinates | null> {
  try {
    const query = `${trackName} racetrack`;
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
    });
    if (!res.ok) return null;
    const results = (await res.json()) as NominatimResult[];
    const first = results[0];
    if (!first?.lat || !first?.lon) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
