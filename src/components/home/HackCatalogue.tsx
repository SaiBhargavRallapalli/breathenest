// ============================================================
// src/components/home/HackCatalogue.tsx
// The ranked indoor-air hack catalogue with its zone filter.
// Data lives in `constants/hacks`; this file only filters and
// renders it.
// ============================================================

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { AIR_HACKS } from '@/constants/hacks';
import { translate } from '@/constants/translations';
import { Card } from '@/components/ui/Card';
import { Meter } from '@/components/ui/Meter';

const ZONE_LABEL = {
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  living_room: 'Living room',
  whole_home: 'Whole home',
} as const;

const EFFORT_LABEL = {
  trivial: 'No effort',
  easy: 'Easy',
  weekend: 'A weekend job',
} as const;

type ZoneFilter = 'all' | 'bedroom' | 'kitchen' | 'living_room' | 'whole_home';

export function HackCatalogue() {
  const { language } = useApp();

  const [zone, setZone] = useState<ZoneFilter>('all');

  const hacks = useMemo(
    () => (zone === 'all' ? AIR_HACKS : AIR_HACKS.filter((hack) => hack.zone === zone)),
    [zone],
  );

  return (
    <>
      <Card
        level={2}
        eyebrow={translate(language, 'home.hacks')}
        title="Indoor air hacks, ranked by effect"
        description="Each hack states its expected drop in indoor PM2.5 and what it costs to do."
        actions={
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter hacks by zone">
            {(['all', 'bedroom', 'kitchen', 'living_room', 'whole_home'] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={zone === entry}
                onClick={() => setZone(entry)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  zone === entry
                    ? 'border-mint bg-mint/15 text-mint'
                    : 'border-edge text-fog hover:text-chalk'
                }`}
              >
                {entry === 'all' ? 'All zones' : ZONE_LABEL[entry]}
              </button>
            ))}
          </div>
        }
      >
        <ul className="grid gap-4 md:grid-cols-2">
          {hacks.map((hack) => (
            <li key={hack.id} className="rounded-xl border border-edge bg-raised p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-chalk">{hack.title}</h3>
                <span className="rounded-full bg-panel px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-fog">
                  {ZONE_LABEL[hack.zone]}
                </span>
              </div>

              <div className="mt-2">
                <Meter
                  label="Expected indoor PM2.5 drop"
                  value={hack.reduction}
                  valueText={`${Math.round(hack.reduction * 100)}%`}
                  tone={hack.reduction >= 0.3 ? 'mint' : hack.reduction >= 0.15 ? 'aqua' : 'warn'}
                />
              </div>

              <ol className="mt-3 list-inside list-decimal space-y-1 text-sm leading-relaxed text-fog">
                {hack.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <p className="mt-3 text-sm leading-relaxed text-chalk/90">{hack.explanation}</p>

              <p className="mt-2 text-xs text-fog">
                Cost band: <strong className="text-chalk">{hack.costBand}</strong> · Effort:{' '}
                <strong className="text-chalk">{EFFORT_LABEL[hack.effort]}</strong>
                {hack.acrPerHour > 0 && (
                  <>
                    {' '}
                    · Adds <strong className="text-chalk">{hack.acrPerHour}</strong> clean air
                    changes/hour
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>

        {hacks.length === 0 && (
          <p className="text-sm text-fog">No hacks in this zone yet — try another filter.</p>
        )}
      </Card>
    </>
  );
}
