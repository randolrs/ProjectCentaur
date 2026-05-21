import { describe, expect, it } from 'vitest';
import {
  formatForecast,
  pickPeriodForRaceDate,
  type TrackForecast,
} from '@/lib/weather/nws';

const dayPeriod = {
  startTime: '2026-05-19T06:00:00-04:00',
  isDaytime: true,
  temperature: 72,
  temperatureUnit: 'F' as const,
  windSpeed: '10 mph',
  windDirection: 'NW',
  shortForecast: 'Partly Cloudy',
  probabilityOfPrecipitation: { value: null },
};
const nightPeriod = {
  ...dayPeriod,
  startTime: '2026-05-19T18:00:00-04:00',
  isDaytime: false,
  shortForecast: 'Clear',
};

describe('pickPeriodForRaceDate', () => {
  it('returns the first daytime period that starts on raceDate', () => {
    const match = pickPeriodForRaceDate([nightPeriod, dayPeriod], '2026-05-19');
    expect(match?.shortForecast).toBe('Partly Cloudy');
  });

  it('skips nighttime periods even when their date matches', () => {
    const match = pickPeriodForRaceDate([nightPeriod], '2026-05-19');
    expect(match).toBeNull();
  });

  it('returns null when no period covers the raceDate', () => {
    expect(pickPeriodForRaceDate([dayPeriod], '2026-05-20')).toBeNull();
  });
});

describe('formatForecast', () => {
  it('renders the full set of fields when populated', () => {
    const forecast: TrackForecast = {
      shortForecast: 'Sloppy after AM rain',
      temperatureF: 64,
      windSpeed: '12 to 18 mph',
      windDirection: 'WSW',
      precipChancePercent: 70,
    };
    expect(formatForecast(forecast)).toBe(
      'Sloppy after AM rain · 64°F · wind 12 to 18 mph WSW · precip 70%',
    );
  });

  it('drops empty fields without leaving stray separators', () => {
    const forecast: TrackForecast = {
      shortForecast: 'Clear',
      temperatureF: null,
      windSpeed: null,
      windDirection: null,
      precipChancePercent: 0,
    };
    expect(formatForecast(forecast)).toBe('Clear');
  });
});
