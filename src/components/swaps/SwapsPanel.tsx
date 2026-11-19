// ============================================================
// src/components/swaps/SwapsPanel.tsx
// Sustainable alternatives filtered to this household. Every swap
// states what it replaces, what it costs in effort, and the annual
// CO2 / daily inhaled PM2.5 / money delta it delivers — including
// the honest case where a swap raises personal exposure.
// ============================================================

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { SWAPS, swapsFor } from '@/constants/swaps';
import { translate } from '@/constants/translations';
import { formatMoney } from '@/lib/format';
import type { Swap } from '@/types';
import { Card } from '@/components/ui/Card';

type CategoryFilter = 'all' | Swap['category'];

const CATEGORY_LABEL: Readonly<Record<Swap['category'], string>> = {
  commute: 'Getting around',
  home_energy: 'Home energy',
  food: 'Food',
  waste: 'Waste',
  water: 'Water',
};

const EFFORT_LABEL: Readonly<Record<Swap['effort'], string>> = {
  zero: 'No cost',
  low: 'Low cost',
  medium: 'Medium cost',
  high: 'Higher investment',
};

function DeltaText({ swap, currency }: { swap: Swap; currency: string }) {
  const delta = swap.annualBaseline;
  const inhaled = delta.inhaledPm25UgPerDay;

  return (
    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
      <div className="rounded-lg bg-panel p-2">
        <dt className="text-[11px] uppercase tracking-wider text-fog">CO₂ / year</dt>
        <dd className="mt-0.5 text-sm font-semibold tabular-nums text-mint">
          −{Math.round(delta.co2KgPerYear)} kg
        </dd>
      </div>
      <div className="rounded-lg bg-panel p-2">
        <dt className="text-[11px] uppercase tracking-wider text-fog">Inhaled PM2.5 / day</dt>
        <dd
          className={`mt-0.5 text-sm font-semibold tabular-nums ${
            inhaled >= 0 ? 'text-mint' : 'text-alert'
          }`}
        >
          {inhaled >= 0 ? '−' : '+'}
          {Math.abs(inhaled)} µg
        </dd>
      </div>
      <div className="rounded-lg bg-panel p-2">
        <dt className="text-[11px] uppercase tracking-wider text-fog">Money / year</dt>
        <dd className="mt-0.5 text-sm font-semibold tabular-nums text-aqua">
          +{formatMoney(delta.moneySavedPerYear, currency)}
        </dd>
      </div>
    </dl>
  );
}

export function SwapsPanel() {
  const { profile, selectedSwaps, toggleSwap, language } = useApp();
  const [category, setCategory] = useState<CategoryFilter>('all');

  const applicable = useMemo(() => swapsFor(profile), [profile]);
  const visible = useMemo(
    () => (category === 'all' ? applicable : applicable.filter((swap) => swap.category === category)),
    [applicable, category],
  );

  const notApplicable = SWAPS.filter((swap) => !applicable.includes(swap));

  return (
    <div className="grid gap-5">
      <Card
        level={2}
        eyebrow={translate(language, 'swaps.title')}
        title="Alternatives that fit your household"
        description="Ranked by annual CO₂ avoided. Pick the ones you will actually keep — the Impact tab totals your choices."
        actions={
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter swaps by category">
            {(['all', 'commute', 'home_energy', 'food', 'waste', 'water'] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={category === entry}
                onClick={() => setCategory(entry)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  category === entry
                    ? 'border-mint bg-mint/15 text-mint'
                    : 'border-edge text-fog hover:text-chalk'
                }`}
              >
                {entry === 'all' ? 'All' : CATEGORY_LABEL[entry]}
              </button>
            ))}
          </div>
        }
      >
        <p className="mb-3 text-sm text-fog" role="status">
          {selectedSwaps.length} of {applicable.length} suitable swaps selected.
        </p>

        <ul className="grid gap-4 md:grid-cols-2">
          {visible.map((swap) => {
            const selected = selectedSwaps.includes(swap.id);
            return (
              <li
                key={swap.id}
                className={`rounded-xl border p-4 transition-colors ${
                  selected ? 'border-mint/60 bg-mint/5' : 'border-edge bg-raised'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-fog">
                      {CATEGORY_LABEL[swap.category]}
                    </p>
                    <h3 className="mt-0.5 text-base font-semibold text-chalk">{swap.title}</h3>
                  </div>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSwap(swap.id)}
                    className={`shrink-0 rounded-xl border px-3 py-1.5 text-sm font-semibold ${
                      selected
                        ? 'border-mint bg-mint text-ink'
                        : 'border-edge bg-panel text-chalk hover:border-mint/60'
                    }`}
                  >
                    {selected ? 'Selected ✓' : 'Select'}
                  </button>
                </div>

                <p className="mt-2 text-sm text-fog">
                  <span className="line-through opacity-70">{swap.from}</span>
                  <span aria-hidden="true" className="mx-2 text-mint">
                    →
                  </span>
                  <span className="text-chalk">{swap.to}</span>
                </p>

                <DeltaText swap={swap} currency={swap.annualBaseline.currency} />

                <p className="mt-3 text-sm leading-relaxed text-fog">{swap.why}</p>

                <p className="mt-2 text-xs text-fog">
                  Budget: <strong className="text-chalk">{EFFORT_LABEL[swap.effort]}</strong>
                  {swap.annualBaseline.inhaledPm25UgPerDay < 0 && (
                    <span className="ml-1 text-alert">
                      · raises your own exposure on dirty days — only do this when AQI is low
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>

        {visible.length === 0 && (
          <p className="text-sm text-fog">No swaps in this category for your household setup.</p>
        )}
      </Card>

      {notApplicable.length > 0 && (
        <Card
          title="Not applicable to your home"
          description="Shown for transparency — these swaps depend on a setup you told us you do not have."
        >
          <ul className="flex flex-wrap gap-2">
            {notApplicable.map((swap) => (
              <li
                key={swap.id}
                className="rounded-full border border-edge px-3 py-1 text-xs text-fog"
              >
                {swap.title}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
