// ============================================================
// src/test/server/schemas.test.ts
// Zod contracts: well-formed requests pass, everything else is
// rejected before any business logic runs.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  advisoryRequestSchema,
  airQualityQuerySchema,
  locationQuerySchema,
  planRequestSchema,
  profileSchema,
} from '@/../server/schemas';
import { makeProfile } from '../fixtures';

const validHours = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  aqi: 60 + (hour % 40),
}));

describe('profileSchema', () => {
  it('accepts a well-formed profile', () => {
    expect(profileSchema.safeParse(makeProfile()).success).toBe(true);
  });

  it('rejects out-of-range coordinates', () => {
    expect(profileSchema.safeParse(makeProfile({ latitude: 91 })).success).toBe(false);
    expect(profileSchema.safeParse(makeProfile({ longitude: -181 })).success).toBe(false);
  });

  it('requires at least one household member', () => {
    expect(profileSchema.safeParse(makeProfile({ members: [] })).success).toBe(false);
  });

  it('caps the household at twelve members', () => {
    const members = Array.from({ length: 13 }, (_, index) => ({
      id: `m${index}`,
      label: `M${index}`,
      age: 30,
      vulnerabilities: ['none' as const],
    }));
    expect(profileSchema.safeParse(makeProfile({ members })).success).toBe(false);
  });

  it('rejects an unknown commute mode', () => {
    expect(
      profileSchema.safeParse(makeProfile({ commute: 'jetpack' as never })).success,
    ).toBe(false);
  });

  it('rejects an unknown language', () => {
    expect(profileSchema.safeParse(makeProfile({ language: 'kl' as never })).success).toBe(false);
  });

  it('rejects impossible working hours', () => {
    expect(profileSchema.safeParse(makeProfile({ workStartHour: 25 })).success).toBe(false);
    expect(profileSchema.safeParse(makeProfile({ workEndHour: 30 })).success).toBe(false);
  });
});

describe('planRequestSchema', () => {
  const valid = { profile: makeProfile(), currentAqi: 150, hours: validHours };

  it('accepts a full day request', () => {
    expect(planRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('requires at least one hourly point', () => {
    expect(planRequestSchema.safeParse({ ...valid, hours: [] }).success).toBe(false);
  });

  it('rejects an hour outside 0-23', () => {
    const hours = [...validHours, { hour: 24, aqi: 100 }];
    expect(planRequestSchema.safeParse({ ...valid, hours }).success).toBe(false);
  });

  it('rejects an AQI above 500', () => {
    expect(planRequestSchema.safeParse({ ...valid, currentAqi: 501 }).success).toBe(false);
    expect(planRequestSchema.safeParse({ ...valid, currentAqi: -1 }).success).toBe(false);
  });

  it('rejects more than 24 hourly points', () => {
    const hours = Array.from({ length: 25 }, (_, index) => ({ hour: index % 24, aqi: 80 }));
    expect(planRequestSchema.safeParse({ ...valid, hours }).success).toBe(false);
  });
});

describe('advisoryRequestSchema', () => {
  it('accepts a minimal advisory request', () => {
    expect(
      advisoryRequestSchema.safeParse({ locationName: 'Delhi', aqi: 210, language: 'hi' })
        .success,
    ).toBe(true);
  });

  it('accepts the request with members attached', () => {
    const result = advisoryRequestSchema.safeParse({
      locationName: 'Delhi',
      aqi: 210,
      language: 'en',
      members: [{ id: 'm1', label: 'Ravi', age: 71, vulnerabilities: ['elderly'] }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unsupported language', () => {
    expect(
      advisoryRequestSchema.safeParse({ locationName: 'Delhi', aqi: 100, language: 'xx' }).success,
    ).toBe(false);
  });

  it('rejects a missing location', () => {
    expect(
      advisoryRequestSchema.safeParse({ locationName: '', aqi: 100, language: 'en' }).success,
    ).toBe(false);
  });
});

describe('locationQuerySchema', () => {
  it('accepts a normal city name', () => {
    expect(locationQuerySchema.safeParse({ q: 'Delhi' }).success).toBe(true);
  });

  it('trims the query', () => {
    const result = locationQuerySchema.safeParse({ q: '  Mumbai  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.q).toBe('Mumbai');
  });

  it('rejects queries shorter than two characters', () => {
    expect(locationQuerySchema.safeParse({ q: 'D' }).success).toBe(false);
    expect(locationQuerySchema.safeParse({ q: '' }).success).toBe(false);
  });

  it('rejects a missing query', () => {
    expect(locationQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe('airQualityQuerySchema', () => {
  it('coerces string coordinates from the query string', () => {
    const result = airQualityQuerySchema.safeParse({ lat: '28.61', lon: '77.21' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lat).toBeCloseTo(28.61, 2);
  });

  it('rejects out-of-range coordinates', () => {
    expect(airQualityQuerySchema.safeParse({ lat: '95', lon: '0' }).success).toBe(false);
    expect(airQualityQuerySchema.safeParse({ lat: '0', lon: '190' }).success).toBe(false);
  });

  it('rejects non-numeric coordinates', () => {
    expect(airQualityQuerySchema.safeParse({ lat: 'abc', lon: '0' }).success).toBe(false);
  });

  it('makes the location label optional', () => {
    expect(airQualityQuerySchema.safeParse({ lat: '1', lon: '1' }).success).toBe(true);
  });
});
