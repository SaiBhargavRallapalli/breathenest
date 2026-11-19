// ============================================================
// src/components/community/CommunityPanel.tsx
// Neighbourhood pledges: residents commit to weekly actions, the
// tab annualises the collective effect, and a GenAI advisory is
// fetched from the gateway with a deterministic fallback.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { PLEDGES } from '@/constants/pledges';
import { translate } from '@/constants/translations';
import { communityAnnualTotals } from '@/lib/compute';
import { formatCompact } from '@/lib/format';
import { requestAdvisory } from '@/services/api';
import { loadJson, saveJson, STORAGE_KEYS } from '@/services/storage';
import { Card } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';

type AdvisoryState = {
  readonly key: string;
  readonly text: string;
  readonly degraded: boolean;
};

const FALLBACK_ADVISORY =
  'Air quality in your area is elevated. Keep windows shut during the morning and evening peaks, run filtration indoors, move outdoor activity to the middle of the day, and check on elderly or asthmatic neighbours.';

function loadInitialPledges(): string[] {
  const saved = loadJson<unknown>(STORAGE_KEYS.pledges, []);
  return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
}

export function CommunityPanel() {
  const { profile, language, air } = useApp();
  const [joined, setJoined] = useState<string[]>(loadInitialPledges);
  const [advisory, setAdvisory] = useState<AdvisoryState | null>(null);
  const [attempt, setAttempt] = useState(0);

  const activePledges = useMemo(
    () => PLEDGES.filter((pledge) => joined.includes(pledge.id)),
    [joined],
  );

  // Members beyond the account holder: assume neighbours join in.
  const assumedMembers = 1 + activePledges.length * 4;
  const totals = useMemo(
    () => communityAnnualTotals(activePledges, activePledges.length > 0 ? assumedMembers : 0),
    [activePledges, assumedMembers],
  );

  const toggle = useCallback((id: string) => {
    setJoined((current) => {
      const next = current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id];
      saveJson(STORAGE_KEYS.pledges, next);
      return next;
    });
  }, []);

  const bundle = air.bundle;
  const aqi = bundle?.reading.aqi ?? 100;
  const advisoryKey = `${bundle?.fetchedAt ?? 'none'}|${language}|${attempt}`;

  useEffect(() => {
    if (!bundle) return;
    let cancelled = false;

    requestAdvisory({
      locationName: profile.locationName,
      aqi,
      language,
      members: profile.members,
    })
      .then((response) => {
        if (!cancelled) {
          setAdvisory({ key: advisoryKey, text: response.advisory, degraded: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAdvisory({ key: advisoryKey, text: FALLBACK_ADVISORY, degraded: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bundle, profile.locationName, profile.members, aqi, language, advisoryKey]);

  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  const loading = !bundle || advisory?.key !== advisoryKey;

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card
          level={2}
          eyebrow={translate(language, 'community.title')}
          title="Pledge with your street"
          description="Small weekly commitments, annualised across everyone who joins. Pick the ones your household will honestly keep."
        >
          <ul className="grid gap-3">
            {PLEDGES.map((pledge) => {
              const active = joined.includes(pledge.id);
              return (
                <li
                  key={pledge.id}
                  className={`rounded-xl border p-4 ${
                    active ? 'border-mint/60 bg-mint/5' : 'border-edge bg-raised'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-chalk">{pledge.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-fog">{pledge.detail}</p>
                      <p className="mt-2 text-xs text-fog">
                        {pledge.co2KgPerWeek > 0 && (
                          <span className="text-mint">
                            −{pledge.co2KgPerWeek} kg CO₂/week per person
                          </span>
                        )}
                        {pledge.pm25GramsPerWeek > 0 && (
                          <span className="ms-2 text-aqua">
                            −{pledge.pm25GramsPerWeek} g particles/week
                          </span>
                        )}
                        {pledge.co2KgPerWeek === 0 && pledge.pm25GramsPerWeek === 0 && (
                          <span className="text-warn">Care action — no emission figure</span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(pledge.id)}
                      className={`shrink-0 rounded-xl border px-3 py-1.5 text-sm font-semibold ${
                        active
                          ? 'border-mint bg-mint text-ink'
                          : 'border-edge bg-panel text-chalk hover:border-mint/60'
                      }`}
                    >
                      {active ? 'Pledged ✓' : translate(language, 'action.join')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="grid content-start gap-5">
          <Card title="If everyone keeps it" description="Annualised across an estimated street of participants.">
            <dl className="grid gap-4">
              <Stat
                label="CO₂ avoided per year"
                value={`${formatCompact(totals.co2KgPerYear)} kg`}
                hint={`${assumedMembers} participants`}
                tone="good"
              />
              <Stat
                label="Particles kept out of lungs"
                value={`${formatCompact(totals.pm25GramsPerYear)} g`}
                hint="per year, across the street"
                tone="good"
              />
              <Stat
                label="Your pledges"
                value={`${activePledges.length} / ${PLEDGES.length}`}
                hint="weekly commitments"
              />
            </dl>
            {activePledges.length === 0 && (
              <p className="mt-3 text-sm text-fog">
                Join a pledge to see the collective effect grow.
              </p>
            )}
          </Card>

          <Card
            title="Public advisory"
            description="Generated for your location and language, with a fixed fallback if the model is unavailable."
            actions={
              <button
                type="button"
                onClick={refresh}
                className="rounded-xl border border-edge bg-raised px-3 text-sm font-medium text-chalk hover:border-mint/60"
              >
                {translate(language, 'action.refresh')}
              </button>
            }
          >
            {loading && (
              <p className="text-sm text-fog" role="status">
                {translate(language, 'common.loading')}
              </p>
            )}
            {!loading && advisory && (
              <>
                <p className="text-sm leading-relaxed text-chalk">{advisory.text}</p>
                <p className="mt-2 text-xs text-fog">
                  {advisory.degraded
                    ? 'Source: fixed fallback (gateway or model unavailable).'
                    : 'Source: Gemini via the BreatheNest gateway.'}
                </p>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
