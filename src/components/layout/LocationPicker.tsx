// ============================================================
// src/components/layout/LocationPicker.tsx
// City search backed by the gateway's geocoding proxy, plus the
// bundled seed cities so the picker is useful with no network.
// ============================================================

import { useState, type FormEvent } from 'react';
import { SEED_CITIES, type CitySeed } from '@/constants/cities';
import { searchLocations, type GeoResult } from '@/services/api';
import { useApp } from '@/context/AppContext';
import { Icon } from '@/components/ui/Icon';

function toSeed(result: GeoResult): CitySeed {
  return {
    id: result.id,
    name: result.name,
    region: result.region,
    country: result.country,
    countryCode: result.countryCode,
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

export function LocationPicker() {
  const { location, setLocation, language } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');

  const runSearch = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    setStatus('loading');
    try {
      const found = await searchLocations(trimmed);
      setResults(found);
      setStatus(found.length > 0 ? 'done' : 'error');
    } catch {
      setResults(SEED_CITIES.map(toSeedResult));
      setStatus('error');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={runSearch} role="search" className="flex gap-2">
        <label htmlFor="city-search" className="sr-only">
          Search for a city
        </label>
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-fog">
            <Icon name="pin" />
          </span>
          <input
            id="city-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your city"
            autoComplete="address-level2"
            className="w-full rounded-xl border border-edge bg-raised ps-9 pe-3 text-sm text-chalk placeholder:text-fog/70"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-xl border border-edge bg-raised px-3 text-sm font-medium text-chalk hover:border-mint/60"
        >
          Search
        </button>
      </form>

      <p className="text-xs text-fog" aria-live="polite">
        {status === 'loading' && 'Searching…'}
        {status === 'done' && `${results.length} place${results.length === 1 ? '' : 's'} found.`}
        {status === 'error' && 'Search unavailable — pick from the list below.'}
        {status === 'idle' && `Showing ${location.name}${location.region ? `, ${location.region}` : ''}`}
      </p>

      {results.length > 0 && (
        <ul className="max-h-52 overflow-y-auto rounded-xl border border-edge bg-raised p-1">
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                onClick={() => {
                  setLocation(toSeed(result));
                  setResults([]);
                  setQuery('');
                  setStatus('idle');
                }}
                className="w-full rounded-lg px-3 py-2 text-start text-sm text-chalk hover:bg-edge/60"
              >
                {result.name}
                <span className="block text-xs text-fog">
                  {[result.region, result.country].filter(Boolean).join(', ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ul className="flex flex-wrap gap-1.5" aria-label="Quick city list">
        {SEED_CITIES.slice(0, 6).map((city) => (
          <li key={city.id}>
            <button
              type="button"
              onClick={() => setLocation(city)}
              aria-pressed={location.id === city.id}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                location.id === city.id
                  ? 'border-mint bg-mint/15 text-mint'
                  : 'border-edge text-fog hover:text-chalk'
              }`}
            >
              {city.name}
            </button>
          </li>
        ))}
      </ul>
      <p className="sr-only" lang={language}>
        Selected location: {location.name}, {location.country}
      </p>
    </div>
  );
}

/** Adapts a seed city into the search-result shape for fallback lists. */
function toSeedResult(city: CitySeed): GeoResult {
  return {
    id: city.id,
    name: city.name,
    region: city.region,
    country: city.country,
    countryCode: city.countryCode,
    latitude: city.latitude,
    longitude: city.longitude,
  };
}
