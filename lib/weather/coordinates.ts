// Approximate coordinates for each canonical track name we may ingest. Used
// to look up the NWS forecast at the right grid for each race day. Precision
// to the nearest hundredth of a degree (~1km) is more than enough — weather
// at the track is effectively the weather at the surrounding metro.

export interface TrackCoordinates {
  lat: number;
  lng: number;
}

export const TRACK_COORDINATES: Readonly<Record<string, TrackCoordinates>> = {
  // v1 marquee tracks (seasonal — may appear in future ingests)
  Aqueduct: { lat: 40.67, lng: -73.83 },
  'Belmont Park': { lat: 40.72, lng: -73.73 },
  Saratoga: { lat: 43.07, lng: -73.78 },
  'Churchill Downs': { lat: 38.21, lng: -85.77 },
  Keeneland: { lat: 38.05, lng: -84.61 },
  'Del Mar': { lat: 32.97, lng: -117.26 },
  'Santa Anita Park': { lat: 34.14, lng: -118.04 },
  'Gulfstream Park': { lat: 25.98, lng: -80.14 },
  'Oaklawn Park': { lat: 34.49, lng: -93.05 },
  'Fair Grounds': { lat: 29.98, lng: -90.08 },
  'Tampa Bay Downs': { lat: 28.08, lng: -82.62 },
  'Kentucky Downs': { lat: 36.65, lng: -86.58 },
  // Year-round tracks currently in the synced `tracks` table
  'Finger Lakes': { lat: 42.96, lng: -77.24 },
  'Horseshoe Indianapolis': { lat: 39.6, lng: -86.08 },
  'Louisiana Downs': { lat: 32.54, lng: -93.65 },
  'Mountaineer Park': { lat: 40.63, lng: -80.57 },
  'Parx Racing': { lat: 40.13, lng: -74.93 },
  'Prairie Meadows': { lat: 41.63, lng: -93.49 },
  'Presque Isle Downs': { lat: 42.12, lng: -80.09 },
  Thistledown: { lat: 41.41, lng: -81.56 },
};
