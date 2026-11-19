// ============================================================
// src/components/routine/RoutinePanel.tsx
// "Build my day": requests a generated plan from the gateway and
// falls back to the deterministic local planner on any failure, so
// the panel always renders a complete, quantified day.
//
// The plan is keyed by the inputs it was built from, so the loading
// state is *derived* (key mismatch) instead of set inside an effect.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { translate } from '@/constants/translations';
import { buildLocalPlan } from '@/lib/planner';
import { requestPlan } from '@/services/api';
import type { DailyPlan, HourPoint } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatHourRange } from '@/lib/format';

interface BuiltPlan {
  readonly key: string;
  readonly plan: DailyPlan;
  readonly degraded: boolean;
}

/** Risk → tone mapping shared by every plan block. */
const RISK_TONE = {
  ideal: 'text-mint',
  acceptable: 'text-warn',
  poor: 'text-alert',
  avoid: 'text-alert',
} as const;

const RISK_LABEL = {
  ideal: 'Clean air',
  acceptable: 'Acceptable',
  poor: 'Poor air',
  avoid: 'Avoid outdoor exposure',
} as const;

function toHourPoints(hours: readonly { hour: number; aqi: number }[]): HourPoint[] {
  return hours.map((entry) => ({ hour: entry.hour, aqi: entry.aqi }));
}

export function RoutinePanel() {
  const { profile, air, language } = useApp();
  const [built, setBuilt] = useState<BuiltPlan | null>(null);
  const [attempt, setAttempt] = useState(0);

  const bundle = air.bundle;
  const currentAqi = bundle?.reading.aqi ?? 100;
  const hours = useMemo<HourPoint[]>(
    () => (bundle ? toHourPoints(bundle.forecast.hours) : [{ hour: 9, aqi: 100 }]),
    [bundle],
  );

  // Identity of the inputs the plan must match; a mismatch reads as loading.
  const requestKey = `${bundle?.fetchedAt ?? 'none'}|${profile.locationId}|${profile.commute}|${attempt}`;

  useEffect(() => {
    if (!bundle) return;
    let cancelled = false;

    requestPlan({ profile, currentAqi, hours })
      .then((response) => {
        if (!cancelled) {
          setBuilt({ key: requestKey, plan: response.plan, degraded: false });
        }
      })
      .catch(() => {
        // Gateway unreachable, quota exhausted or malformed response —
        // the local planner still produces a complete plan.
        if (!cancelled) {
          setBuilt({
            key: requestKey,
            plan: buildLocalPlan({ profile, currentAqi, hours }),
            degraded: true,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bundle, profile, currentAqi, hours, requestKey]);

  const rebuild = useCallback(() => setAttempt((value) => value + 1), []);

  if (!bundle || built?.key !== requestKey) {
    return (
      <Card level={2} eyebrow={translate(language, 'routine.summary')} title="Building your day…">
        <div className="h-40 animate-pulse rounded-xl bg-raised" aria-hidden="true" />
        <p className="sr-only" role="status">
          {translate(language, 'common.loading')}
        </p>
      </Card>
    );
  }

  const { plan, degraded } = built;
  const window = plan.bestOutdoorWindow;

  return (
    <div className="grid gap-5">
      <Card
        level={2}
        eyebrow={translate(language, 'routine.summary')}
        title="Your low-emission day"
        description={plan.summary}
        actions={
          <button
            type="button"
            onClick={rebuild}
            className="rounded-xl border border-edge bg-raised px-3 text-sm font-medium text-chalk hover:border-mint/60"
          >
            {translate(language, 'action.generate')}
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-1 font-semibold ${
              plan.generator === 'local' ? 'bg-mint/15 text-mint' : 'bg-aqua/15 text-aqua'
            }`}
          >
            {plan.generator === 'local'
              ? 'Local planner'
              : `GenAI plan (${plan.generator === 'grok' ? 'Grok' : 'Gemini'})`}
          </span>
          {degraded && (
            <span className="rounded-full bg-warn/15 px-2.5 py-1 font-semibold text-warn">
              Gateway offline — deterministic fallback
            </span>
          )}
          <span className="text-fog">Generated {new Date(plan.generatedAt).toLocaleTimeString()}</span>
        </div>

        {window ? (
          <div className="mb-4 rounded-xl border border-mint/40 bg-mint/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-mint">
              {translate(language, 'routine.bestWindow')}
            </p>
            <p className="mt-1 text-lg font-semibold text-chalk">
              {formatHourRange(window.startHour, window.endHour)}{' '}
              <span className="text-sm font-normal text-fog">
                (average AQI {window.averageAqi}, peak {window.peakAqi})
              </span>
            </p>
            <p className="mt-1 text-sm text-chalk/90">
              Move the school run, exercise or window venting into this slot — it is the cleanest
              stretch of your day.
            </p>
          </div>
        ) : (
          <p className="mb-4 rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-chalk">
            No hour today clears the safe threshold, so there is no clean outdoor window. Keep outdoor
            time to essentials and run filtration indoors.
          </p>
        )}

        <ol className="grid gap-3">
          {plan.blocks.map((block) => (
            <li
              key={`${block.time}-${block.title}`}
              className="rounded-xl border border-edge bg-raised p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold tabular-nums text-mint">{block.time}</p>
                <span className={`text-xs font-semibold ${RISK_TONE[block.risk]}`}>
                  {RISK_LABEL[block.risk]} · AQI {block.windowAqi}
                </span>
              </div>
              <h3 className="mt-1 text-base font-semibold text-chalk">{block.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-fog">{block.detail}</p>
              <p className="mt-2 rounded-lg bg-panel p-2.5 text-sm leading-relaxed text-chalk">
                <strong className="text-mint">Direct impact:</strong> {block.impact}
              </p>
            </li>
          ))}
        </ol>
      </Card>

      <Card
        title="How this plan was built"
        description="Two engines produce the same shape of answer; the GenAI route adds household-specific wording."
      >
        <ul className="grid gap-3 text-sm leading-relaxed text-fog sm:grid-cols-2">
          <li className="rounded-xl border border-edge bg-raised p-3">
            <strong className="text-chalk">Deterministic planner</strong> — searches your 24-hour
            forecast for the cleanest slot, prices each block in inhaled PM2.5 and works with zero
            configuration.
          </li>
          <li className="rounded-xl border border-edge bg-raised p-3">
            <strong className="text-chalk">GenAI generator (Gemini or Grok)</strong> — rewrites the
            same plan with household-specific language, then has every field re-validated before it
            is shown.
          </li>
        </ul>
        <div className="mt-3">
          <Badge category={bundle.reading.category} />
        </div>
      </Card>
    </div>
  );
}
