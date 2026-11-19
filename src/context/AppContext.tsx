// ============================================================
// src/context/AppContext.tsx
// Single provider for cross-cutting UI state: language, active tab,
// chosen location, household profile and the shared air-quality
// bundle. Panels read from here instead of each fetching their own.
// ============================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AirBundle,
  HouseholdProfile,
  LoadState,
  SupportedLanguage,
} from '@/types';
import { DEFAULT_CITY, SEED_CITIES, type CitySeed } from '@/constants/cities';
import { assessStagnation } from '@/lib/compute';
import { fetchAirQuality } from '@/services/api';
import { sampleBundle } from '@/constants/sample';
import { loadEnum, loadJson, saveJson, STORAGE_KEYS } from '@/services/storage';

export type TabId = 'air' | 'routine' | 'home' | 'swaps' | 'impact' | 'community';

export const TAB_IDS: readonly TabId[] = ['air', 'routine', 'home', 'swaps', 'impact', 'community'];

const LANGUAGE_IDS: readonly SupportedLanguage[] = ['en', 'hi', 'ar', 'es'];

export interface AirState {
  readonly status: LoadState;
  readonly bundle: AirBundle | null;
  /** True when bundled sample readings are standing in for live data. */
  readonly degraded: boolean;
  readonly error: string | null;
}

export interface AppContextValue {
  readonly language: SupportedLanguage;
  readonly setLanguage: (language: SupportedLanguage) => void;
  readonly tab: TabId;
  readonly setTab: (tab: TabId) => void;
  readonly location: CitySeed;
  readonly setLocation: (city: CitySeed) => void;
  readonly profile: HouseholdProfile;
  readonly updateProfile: (patch: Partial<HouseholdProfile>) => void;
  readonly air: AirState;
  readonly reloadAir: () => void;
  /** Swap ids the household has committed to; drives the Impact ledger. */
  readonly selectedSwaps: readonly string[];
  readonly toggleSwap: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

/** A neutral starting household so the app is usable on first paint. */
export function defaultProfile(city: CitySeed, language: SupportedLanguage = 'en'): HouseholdProfile {
  return {
    locationId: city.id,
    locationName: city.name,
    country: city.country,
    latitude: city.latitude,
    longitude: city.longitude,
    members: [{ id: 'member-1', label: 'You', age: 34, vulnerabilities: ['none'] }],
    commute: 'metro',
    workStartHour: 9,
    workEndHour: 18,
    homeType: 'apartment',
    budget: 'low',
    cookingFuel: 'gas',
    language,
  };
}

/** Validates a persisted profile before we trust its shape. */
function isValidProfile(value: unknown): value is HouseholdProfile {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<HouseholdProfile>;
  return (
    typeof candidate.locationId === 'string' &&
    typeof candidate.locationName === 'string' &&
    Array.isArray(candidate.members) &&
    typeof candidate.commute === 'string' &&
    typeof candidate.homeType === 'string'
  );
}

/** Restores the last location, falling back to a seed city. */
function loadInitialLocation(): CitySeed {
  const saved = loadJson<CitySeed | null>(`${STORAGE_KEYS.profile}:city`, null);
  if (saved && typeof saved.latitude === 'number' && typeof saved.longitude === 'number') {
    return saved;
  }
  const savedProfile = loadJson<unknown>(STORAGE_KEYS.profile, null);
  if (isValidProfile(savedProfile)) {
    const match = SEED_CITIES.find((city) => city.id === savedProfile.locationId);
    if (match) return match;
  }
  return DEFAULT_CITY;
}

export function AppProvider({ children }: { children: ReactNode }): ReactNode {
  const [language, setLanguageState] = useState<SupportedLanguage>(() =>
    loadEnum(STORAGE_KEYS.language, LANGUAGE_IDS, 'en'),
  );
  const [tab, setTab] = useState<TabId>('air');
  const [location, setLocationState] = useState<CitySeed>(loadInitialLocation);
  const [profile, setProfile] = useState<HouseholdProfile>(() => {
    const saved = loadJson<unknown>(STORAGE_KEYS.profile, null);
    return isValidProfile(saved) ? saved : defaultProfile(DEFAULT_CITY);
  });
  const [air, setAir] = useState<AirState>({ status: 'loading', bundle: null, degraded: false, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  const setLanguage = useCallback((next: SupportedLanguage) => {
    setLanguageState(next);
    saveJson(STORAGE_KEYS.language, next);
  }, []);

  const setLocation = useCallback((city: CitySeed) => {
    setLocationState(city);
    saveJson(`${STORAGE_KEYS.profile}:city`, city);
    setAir((current) => ({ ...current, status: 'loading', error: null }));
    setProfile((current) => ({ ...current, locationId: city.id, locationName: city.name, country: city.country, latitude: city.latitude, longitude: city.longitude }));
  }, []);

  const updateProfile = useCallback((patch: Partial<HouseholdProfile>) => {
    setProfile((current) => {
      const next = { ...current, ...patch };
      saveJson(STORAGE_KEYS.profile, next);
      return next;
    });
  }, []);

  const reloadAir = useCallback(() => {
    setAir((current) => ({ ...current, status: 'loading', error: null }));
    setReloadKey((key) => key + 1);
  }, []);

  const [selectedSwaps, setSelectedSwaps] = useState<string[]>(() => {
    const saved = loadJson<unknown>(STORAGE_KEYS.swaps, []);
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
  });

  const toggleSwap = useCallback((id: string) => {
    setSelectedSwaps((current) => {
      const next = current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id];
      saveJson(STORAGE_KEYS.swaps, next);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchAirQuality({
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name,
      region: location.region,
      country: location.country,
      id: location.id,
    })
      .then((response) => {
        if (cancelled) return;
        setAir({
          status: 'success',
          degraded: false,
          error: null,
          bundle: {
            reading: response.reading,
            forecast: response.forecast,
            stagnation: assessStagnation(response.forecast),
            fetchedAt: response.fetchedAt,
          },
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAir({
          status: 'success',
          degraded: true,
          error: error instanceof Error ? error.message : 'Live data unavailable.',
          bundle: sampleBundle(location.name, location.country),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [location, reloadKey]);

  const value = useMemo<AppContextValue>(
    () => ({
      language,
      setLanguage,
      tab,
      setTab,
      location,
      setLocation,
      profile,
      updateProfile,
      air,
      reloadAir,
      selectedSwaps,
      toggleSwap,
    }),
    [
      language,
      setLanguage,
      tab,
      setTab,
      location,
      setLocation,
      profile,
      updateProfile,
      air,
      reloadAir,
      selectedSwaps,
      toggleSwap,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Typed access to the app store; throws if used outside the provider. */
export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (context === null) {
    throw new Error('useApp() must be called inside <AppProvider>.');
  }
  return context;
}
