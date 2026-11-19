// ============================================================
// src/components/impact/ImpactPanel.tsx
// The payoff screen: totals every swap the household selected into
// one ledger with relatable equivalents, and shows the honest
// per-choice breakdown — including trades where personal exposure
// and emissions move in opposite directions.
// ============================================================

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { SWAPS } from '@/constants/swaps';
import { translate } from '@/constants/translations';
import { aggregateImpact, co2Equivalents } from '@/lib/compute';
import { formatCompact, formatMoney } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Meter } from '@/components/ui/Meter';
import { Stat } from '@/components/ui/Stat';

export function ImpactPanel() {
  const { profile, selectedSwaps, language } = useApp();

  const selected = useMemo(
    () => SWAPS.filter((swap) => selectedSwaps.includes(swap.id)),
    [selectedSwaps],
  );

  const ledger = useMemo(
    () => aggregateImpact(selected.map((swap) => swap.annualBaseline)),
    [selected],
  );

  // Reference: what one fully-diesel week of commuting would cost.
  const carReference = 0.171 * 40 * 52;

  if (selected.length === 0) {
    return (
      <Card
        level={2}
        eyebrow={translate(language, 'impact.title')}
        title="No choices selected yet"
        description="Head to the Better swaps tab and pick the alternatives you will actually keep. Your direct impact is calculated from those choices."
      >
        <p className="text-sm text-fog">
          Nothing is committed yet, so there is nothing to total. Even one swap — LEDs everywhere or
          washing cold — produces a measurable annual figure.
        </p>
      </Card>
    );
  }

  const equivalents = co2Equivalents(ledger.co2KgPerYear);
  const vsCarWeek = ledger.co2KgPerYear / carReference;

  return (
    <div className="grid gap-5">
      <Card
        level={2}
        eyebrow={translate(language, 'impact.title')}
        title="Your direct impact"
        description={`${selected.length} swap${selected.length === 1 ? '' : 's'} selected for ${profile.locationName}.`}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-mint/40 bg-mint/10 p-4">
            <Stat
              label="CO₂ avoided per year"
              value={`${formatCompact(ledger.co2KgPerYear)} kg`}
              hint={`≈ ${vsCarWeek.toFixed(1)} weeks of a 40 km/day diesel commute`}
              tone="good"
            />
          </div>
          <div className="rounded-xl border border-aqua/40 bg-aqua/10 p-4">
            <Stat
              label="Fine particles not inhaled"
              value={`${Math.abs(ledger.inhaledPm25UgPerDay)} µg/day`}
              hint={
                ledger.inhaledPm25UgPerDay >= 0
                  ? 'average across the household'
                  : 'net increase — some swaps trade exposure for emissions'
              }
              tone={ledger.inhaledPm25UgPerDay >= 0 ? 'good' : 'bad'}
            />
          </div>
          <div className="rounded-xl border border-edge bg-raised p-4">
            <Stat
              label="Money kept per year"
              value={formatMoney(ledger.moneyPerYear, ledger.currency)}
              hint="fuel, power and water bills"
              tone="default"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-fog">
            What that CO₂ looks like
          </p>
          {equivalents.map((equivalent) => (
            <Meter
              key={equivalent.label}
              label={equivalent.label}
              value={Math.min(1, equivalent.value / 1000)}
              valueText={`${formatCompact(equivalent.value)} ${equivalent.unit}`}
              tone="mint"
            />
          ))}
        </div>
      </Card>

      <Card
        title="Choice-by-choice breakdown"
        description="Every number below traces back to a published emission factor — no black boxes."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">
              Annual impact of each selected swap
            </caption>
            <thead>
              <tr className="border-b border-edge text-start">
                <th scope="col" className="py-2 text-start font-semibold text-fog">
                  Choice
                </th>
                <th scope="col" className="py-2 text-end font-semibold text-fog">
                  CO₂ / year
                </th>
                <th scope="col" className="py-2 text-end font-semibold text-fog">
                  Inhaled PM2.5 / day
                </th>
                <th scope="col" className="py-2 text-end font-semibold text-fog">
                  Money / year
                </th>
              </tr>
            </thead>
            <tbody>
              {selected.map((swap) => {
                const delta = swap.annualBaseline;
                return (
                  <tr key={swap.id} className="border-b border-edge/60">
                    <th scope="row" className="py-2.5 text-start font-medium text-chalk">
                      {swap.title}
                    </th>
                    <td className="py-2.5 text-end tabular-nums text-mint">
                      −{Math.round(delta.co2KgPerYear)} kg
                    </td>
                    <td
                      className={`py-2.5 text-end tabular-nums ${
                        delta.inhaledPm25UgPerDay >= 0 ? 'text-mint' : 'text-alert'
                      }`}
                    >
                      {delta.inhaledPm25UgPerDay >= 0 ? '−' : '+'}
                      {Math.abs(delta.inhaledPm25UgPerDay)} µg
                    </td>
                    <td className="py-2.5 text-end tabular-nums text-aqua">
                      +{formatMoney(delta.moneySavedPerYear, delta.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="py-2.5 text-start font-semibold text-chalk">
                  Total
                </th>
                <td className="py-2.5 text-end font-semibold tabular-nums text-mint">
                  −{Math.round(ledger.co2KgPerYear)} kg
                </td>
                <td
                  className={`py-2.5 text-end font-semibold tabular-nums ${
                    ledger.inhaledPm25UgPerDay >= 0 ? 'text-mint' : 'text-alert'
                  }`}
                >
                  {ledger.inhaledPm25UgPerDay >= 0 ? '−' : '+'}
                  {Math.abs(ledger.inhaledPm25UgPerDay)} µg
                </td>
                <td className="py-2.5 text-end font-semibold tabular-nums text-aqua">
                  +{formatMoney(ledger.moneyPerYear, ledger.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-4 rounded-xl border border-edge bg-raised p-3 text-sm leading-relaxed text-fog">
          <strong className="text-chalk">Why one row is negative:</strong> cycling short trips cuts
          emissions, but hard breathing raises how much you personally inhale. On dirty days the
          second effect wins — so BreatheNest only recommends the ride when AQI is below 50.
        </p>
      </Card>
    </div>
  );
}
