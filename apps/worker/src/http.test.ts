import { describe, expect, it } from 'vitest';
import { HttpError, redactSecrets, redactUrl } from './http';

const FIRMS_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const AIRNOW_KEY = 'ABCD-1234-EFGH-5678';

describe('redactUrl', () => {
  it('removes a FIRMS key from the URL path', () => {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/VIIRS_SNPP_NRT/-170,15,-60,72/1`;
    const safe = redactUrl(url, [FIRMS_KEY]);
    expect(safe).not.toContain(FIRMS_KEY);
    expect(safe).toContain('/api/area/csv/[redacted]/VIIRS_SNPP_NRT/');
  });

  it('removes credential-named query values even when the key is not configured', () => {
    const url = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=1&API_KEY=${AIRNOW_KEY}&distance=25`;
    const safe = redactUrl(url, []);
    expect(safe).not.toContain(AIRNOW_KEY);
    expect(safe).toContain('API_KEY=[redacted]&distance=25');
    expect(redactUrl('https://x.test/?key=abc&k=1', [])).toBe('https://x.test/?key=[redacted]&k=1');
  });

  it('leaves URLs without secrets alone', () => {
    expect(redactSecrets('https://api.weather.gov/points/45,-122', [FIRMS_KEY])).toBe('https://api.weather.gov/points/45,-122');
  });
});

describe('HttpError', () => {
  it('never carries the FIRMS key in its message, url or body', () => {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/VIIRS_SNPP_NRT/-170,15,-60,72/1`;
    const error = new HttpError(500, url, `Invalid MAP_KEY ${FIRMS_KEY}`, [FIRMS_KEY]);
    expect(error.message).not.toContain(FIRMS_KEY);
    expect(error.url).not.toContain(FIRMS_KEY);
    expect(error.body).not.toContain(FIRMS_KEY);
    expect(error.stack ?? '').not.toContain(FIRMS_KEY);
  });

  it('reads configured keys from the environment by default', () => {
    const previous = process.env.NASA_FIRMS_MAP_KEY;
    process.env.NASA_FIRMS_MAP_KEY = FIRMS_KEY;
    try {
      const error = new HttpError(403, `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/X/1`, '');
      expect(error.message).not.toContain(FIRMS_KEY);
    } finally {
      if (previous === undefined) delete process.env.NASA_FIRMS_MAP_KEY;
      else process.env.NASA_FIRMS_MAP_KEY = previous;
    }
  });
});
