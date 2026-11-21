// ============================================================
// src/components/home/RoomCalculator.tsx
// The live room calculator: dimensions and filter specs in; volume,
// required CADR, achieved air changes and clearance time out. The
// ventilation verdict is derived here too, because it is the same
// calculation seen from the other side.
// ============================================================

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { translate } from '@/constants/translations';
import {
  clearanceTimeMinutes,
  equivalentAch,
  indoorAqi,
  recommendedAch,
  requiredCadr,
  requiredFilterAirflow,
  roomVolume,
  ventilationAdvice,
} from '@/lib/compute';
import { formatHour } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Meter } from '@/components/ui/Meter';

export function RoomCalculator() {
  const { air, profile, language } = useApp();

  const [length, setLength] = useState(5);
  const [width, setWidth] = useState(4);
  const [height, setHeight] = useState(2.8);
  const [filterFlow, setFilterFlow] = useState(400);
  const [efficiency, setEfficiency] = useState(0.85);

  const outdoorAqi = air.bundle?.reading.aqi ?? 100;

  const calc = useMemo(() => {
    const volume = roomVolume(length, width, height);
    const targetAch = recommendedAch(air.bundle?.reading.category ?? 'unhealthy');
    const cadr = requiredCadr(volume, targetAch);
    const airflow = requiredFilterAirflow(volume, targetAch, efficiency);
    const achievedAch = equivalentAch(volume, filterFlow * efficiency);
    const minutes = clearanceTimeMinutes({
      volumeM3: volume,
      airflowM3h: filterFlow,
      efficiency,
      targetFraction: 0.2,
    });
    const indoor = indoorAqi(outdoorAqi, 'closedUnfiltered');
    return { volume, targetAch, cadr, airflow, achievedAch, minutes, indoor };
  }, [length, width, height, filterFlow, efficiency, outdoorAqi, air.bundle]);

  const advice = useMemo(() => {
    const hours = air.bundle?.forecast.hours ?? [];
    return ventilationAdvice(hours, new Date().getHours(), calc.indoor);
  }, [air.bundle, calc.indoor]);

  return (
    <>
        <Card
          level={2}
          eyebrow={translate(language, 'home.calculator')}
          title="What your room needs"
          description="Size the filter for your actual room instead of trusting the box."
        >
          <div className="grid grid-cols-3 gap-3">
            <label className="text-sm text-fog">
              Length (m)
              <input
                type="number"
                min={1}
                max={40}
                step={0.5}
                value={length}
                onChange={(event) => setLength(Number(event.target.value) || 1)}
                className="mt-1 w-full rounded-xl border border-edge bg-raised px-3 text-chalk"
              />
            </label>
            <label className="text-sm text-fog">
              Width (m)
              <input
                type="number"
                min={1}
                max={40}
                step={0.5}
                value={width}
                onChange={(event) => setWidth(Number(event.target.value) || 1)}
                className="mt-1 w-full rounded-xl border border-edge bg-raised px-3 text-chalk"
              />
            </label>
            <label className="text-sm text-fog">
              Height (m)
              <input
                type="number"
                min={2}
                max={6}
                step={0.1}
                value={height}
                onChange={(event) => setHeight(Number(event.target.value) || 2.4)}
                className="mt-1 w-full rounded-xl border border-edge bg-raised px-3 text-chalk"
              />
            </label>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-edge bg-raised p-3">
              <dt className="text-xs uppercase tracking-wider text-fog">Volume</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-chalk">
                {calc.volume} m³
              </dd>
            </div>
            <div className="rounded-xl border border-edge bg-raised p-3">
              <dt className="text-xs uppercase tracking-wider text-fog">Target ACH</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-chalk">
                {calc.targetAch}/h
              </dd>
            </div>
            <div className="rounded-xl border border-edge bg-raised p-3">
              <dt className="text-xs uppercase tracking-wider text-fog">CADR needed</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-chalk">
                {calc.cadr} m³/h
              </dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-3">
            <label className="text-sm text-fog">
              Your fan / purifier airflow: {filterFlow} m³/h
              <input
                type="range"
                min={50}
                max={1200}
                step={50}
                value={filterFlow}
                onChange={(event) => setFilterFlow(Number(event.target.value))}
                className="mt-2 w-full accent-emerald-400"
              />
            </label>
            <label className="text-sm text-fog">
              Filter efficiency: {Math.round(efficiency * 100)}%
              <input
                type="range"
                min={0.3}
                max={1}
                step={0.05}
                value={efficiency}
                onChange={(event) => setEfficiency(Number(event.target.value))}
                className="mt-2 w-full accent-emerald-400"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3">
            <Meter
              label="Equivalent air changes you actually get"
              value={Math.min(1, calc.achievedAch / (calc.targetAch * 2))}
              valueText={`${calc.achievedAch} / ${calc.targetAch} per hour`}
              tone={calc.achievedAch >= calc.targetAch ? 'mint' : 'warn'}
              description={
                calc.achievedAch >= calc.targetAch
                  ? 'This setup clears your target — run it 30 minutes before bed.'
                  : 'Below target: add a second filter, raise the speed, or run it for longer.'
              }
            />
            <p className="text-sm leading-relaxed text-fog">
              Sealed at {calc.indoor} AQI indoors right now (outdoor {outdoorAqi}). A 20-minute burst
              of this filter brings a 20% residual in about{' '}
              <strong className="text-chalk">{calc.minutes} minutes</strong>.
            </p>
          </div>
        </Card>

        <Card
          title={translate(language, 'air.stagnation')}
          description="Opening the window helps only when outdoor air beats what is already inside."
        >
          <p
            className={`text-lg font-semibold ${advice.shouldOpen ? 'text-mint' : 'text-alert'}`}
            role="status"
          >
            {advice.shouldOpen ? 'Ventilate now' : 'Keep windows shut'}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-chalk">{advice.reason}</p>

          {advice.recommendedHours.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-fog">
                Hours worth opening
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {advice.recommendedHours.map((hour) => (
                  <li
                    key={hour}
                    className="rounded-full border border-mint/40 bg-mint/10 px-2.5 py-1 text-xs tabular-nums text-mint"
                  >
                    {formatHour(hour)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-edge bg-raised p-3 text-sm leading-relaxed text-fog">
            Your home type ({profile.homeType}) is assumed to leak at the typical rate for that
            construction. Seal gaps first — every crack that lets warm air out also pulls smog in.
          </div>
        </Card>
    </>
  );
}
