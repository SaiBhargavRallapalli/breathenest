// ============================================================
// src/lib/planner.ts
// Deterministic daily planner.
// This is the always-available engine behind "Build my day": it works
// with no API key, no network and no quota, and it is the fallback the
// Gemini route degrades to. Every block carries a quantified impact so
// the advice is explained, not just asserted.
// ============================================================

import type {
  ActivityLevel,
  CommuteMode,
  DailyPlan,
  HourPoint,
  HouseholdProfile,
  RoutineBlock,
  TimeWindow,
} from '@/types';
import {
  bestWindow,
  CLEAN_WINDOW_MAX_PEAK_AQI,
  classifyRisk,
  concentrationForSubIndex,
  inhaledDose,
  round1,
  worstWindow,
} from './compute';
import { formatHour } from './format';

export interface PlanContext {
  readonly profile: HouseholdProfile;
  readonly currentAqi: number;
  readonly hours: readonly HourPoint[];
}

/** Ventilation cost of each way of getting to work. */
const COMMUTE_ACTIVITY: Readonly<Record<CommuteMode, ActivityLevel>> = {
  metro: 'light',
  electric_bus: 'light',
  diesel_bus: 'light',
  car: 'rest',
  ev: 'rest',
  cycling: 'moderate',
  walking: 'light',
  work_from_home: 'rest',
};

const COMMUTE_LABEL: Readonly<Record<CommuteMode, string>> = {
  metro: 'Metro or rail',
  electric_bus: 'Electric bus',
  diesel_bus: 'Bus',
  car: 'Car',
  ev: 'Electric car',
  cycling: 'Cycling',
  walking: 'Walking',
  work_from_home: 'Working from home',
};

/** Nearest available hour's AQI, falling back to the current reading. */
function aqiAt(hours: readonly HourPoint[], target: number, fallback: number): number {
  if (hours.length === 0) return fallback;
  const exact = hours.find((entry) => entry.hour === target);
  if (exact) return exact.aqi;
  return hours.reduce((best, entry) =>
    Math.abs(entry.hour - target) < Math.abs(best.hour - target) ? entry : best,
  ).aqi;
}

/** Inhaled micrograms for a block of activity at a given AQI. */
function doseUg(aqi: number, durationHours: number, activity: ActivityLevel, protection = 0): number {
  const pm25 = concentrationForSubIndex('pm25', Math.min(aqi, 500));
  return inhaledDose({ concentrationUgM3: pm25, durationHours, activity, protection });
}

/** Percentage of inhaled particles saved by moving from A to B. */
function percentSaved(fromAqi: number, toAqi: number, activity: ActivityLevel): number {
  const before = doseUg(fromAqi, 1, activity);
  const after = doseUg(toAqi, 1, activity);
  if (before <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - after / before) * 100)));
}

function sensitiveMembers(profile: HouseholdProfile): string[] {
  return profile.members
    .filter((member) => member.vulnerabilities.some((tag) => tag !== 'none'))
    .map((member) => member.label);
}

/** Builds a complete, self-contained plan for one day. */
export function buildLocalPlan(context: PlanContext): DailyPlan {
  const { profile, currentAqi, hours } = context;
  const sensitive = sensitiveMembers(profile);

  const cleanest = bestWindow(hours, {
    durationHours: 2,
    limit: 1,
    maxPeakAqi: CLEAN_WINDOW_MAX_PEAK_AQI,
  });
  const dirtiest = worstWindow(hours, 2);
  const morningAqi = aqiAt(hours, 7, currentAqi);
  const eveningAqi = aqiAt(hours, 20, currentAqi);

  const blocks: RoutineBlock[] = [];
  blocks.push(morningBlock(morningAqi, sensitive));
  blocks.push(commuteBlock(profile, hours, currentAqi, sensitive));

  if (cleanest) {
    blocks.push(outdoorBlock(cleanest, morningAqi));
  } else {
    blocks.push(stayIndoorBlock(currentAqi, sensitive));
  }

  blocks.push(eveningBlock(eveningAqi, dirtiest));
  blocks.push(nightBlock(profile, aqiAt(hours, 22, currentAqi)));

  blocks.sort((a, b) => hourOf(a.time) - hourOf(b.time));

  return {
    blocks,
    bestOutdoorWindow: cleanest,
    summary: buildSummary(profile, currentAqi, cleanest, sensitive),
    generator: 'local',
    generatedAt: new Date().toISOString(),
  };
}

/** Extracts the leading hour from a "07:00" style label. */
function hourOf(time: string): number {
  const parsed = Number.parseInt(time.slice(0, 2), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function morningBlock(morningAqi: number, sensitive: string[]): RoutineBlock {
  const risk = classifyRisk(morningAqi);
  const ventCost = percentSaved(morningAqi, Math.max(20, morningAqi - 60), 'light');
  const restricted = morningAqi > 100 && sensitive.length > 0;

  return {
    time: '06:30',
    title: 'Wake up indoors',
    detail: restricted
      ? `${sensitive.join(', ')} should skip any outdoor errand before midday — the night inversion is still pinning traffic exhaust to street level.`
      : morningAqi > 100
        ? 'The night inversion is still pinning traffic exhaust to street level. Keep windows shut through the morning rush.'
        : 'Air is reasonably clear, but the morning traffic peak is about to build. Ventilate later rather than now.',
    windowAqi: morningAqi,
    risk,
    impact: `Holding the windows shut until midday keeps roughly ${ventCost}% of the fine particles you would otherwise breathe during this hour out of the house.`,
  };
}

function commuteBlock(
  profile: HouseholdProfile,
  hours: readonly HourPoint[],
  currentAqi: number,
  sensitive: string[],
): RoutineBlock {
  const departHour = Math.max(0, profile.workStartHour - 1);
  const departAqi = aqiAt(hours, departHour, currentAqi);
  const activity = COMMUTE_ACTIVITY[profile.commute];
  const mode = COMMUTE_LABEL[profile.commute];
  const dose = doseUg(departAqi, 1, activity, profile.commute === 'car' || profile.commute === 'ev' ? 0.6 : 0.15);
  const risk = classifyRisk(departAqi);

  const advice =
    profile.commute === 'cycling' && departAqi > 100
      ? 'Hard breathing on a dirty day multiplies your intake. Shift this ride to the afternoon window instead.'
      : profile.commute === 'car' || profile.commute === 'ev'
        ? 'Recirculate the cabin air and keep the windows up until you are clear of the traffic queue.'
        : profile.commute === 'work_from_home'
          ? 'No commute today — the biggest single exposure of a working day simply does not happen.'
          : 'Cover your nose and mouth for the wait at the stop; platforms sit right in the exhaust plume.';

  return {
    time: formatHour(departHour),
    title: `Leave for work — ${mode}`,
    detail: advice,
    windowAqi: departAqi,
    risk,
    impact: `This trip is set to cost about ${round1(dose)} µg of fine particles. ${
      sensitive.length > 0 ? `${sensitive.join(', ')} should keep outdoor waiting to a minimum. ` : ''
    }A cleaner departure hour would lower that.`,
  };
}

function outdoorBlock(window: TimeWindow, morningAqi: number): RoutineBlock {
  const saved = percentSaved(morningAqi, window.averageAqi, 'moderate');
  return {
    time: formatHour(window.startHour),
    title: 'Your outdoor window',
    detail:
      'Sunshine has broken the inversion cap and the air is at its cleanest. This is the slot for the school run, a walk, exercise or open-window ventilation.',
    windowAqi: window.averageAqi,
    risk: window.risk,
    impact: `Doing outdoor activity at ${formatHour(window.startHour)} instead of 07:00 cuts the fine particles you inhale during it by about ${saved}% (${round1(
      doseUg(morningAqi, 1, 'moderate'),
    )} µg → ${round1(doseUg(window.averageAqi, 1, 'moderate'))} µg).`,
  };
}

function stayIndoorBlock(currentAqi: number, sensitive: string[]): RoutineBlock {
  const hourlyDose = round1(doseUg(currentAqi, 1, 'moderate'));
  return {
    time: '12:00',
    title: 'No safe outdoor window today',
    detail:
      'Every hour of the forecast sits above the safe threshold, so there is no clean slot to move activity into. Keep outdoor time to essentials.',
    windowAqi: currentAqi,
    risk: classifyRisk(currentAqi),
    impact: sensitive.length
      ? `${sensitive.join(', ')} should stay inside with filtration running; skipping one hour outdoors avoids roughly ${hourlyDose} µg of inhaled particles.`
      : `Postponing an hour of outdoor plans to a cleaner day avoids about ${hourlyDose} µg of inhaled particles in one decision.`,
  };
}

function eveningBlock(eveningAqi: number, dirtiest: TimeWindow | null): RoutineBlock {
  return {
    time: '19:00',
    title: 'Close up before the evening peak',
    detail:
      eveningAqi > 100
        ? 'Cooking, heating and the return commute stack up after sunset. Shut the windows and run the filter.'
        : 'Air is still passable, but it will worsen as the boundary layer drops. Close up before the peak.',
    windowAqi: eveningAqi,
    risk: classifyRisk(eveningAqi),
    impact: dirtiest
      ? `The dirtiest stretch of today is ${formatHour(dirtiest.startHour)}–${formatHour(
          dirtiest.endHour,
        )} at an average AQI of ${dirtiest.averageAqi}. Shutting the windows before it begins keeps roughly ${round1(
          doseUg(dirtiest.averageAqi, 1, 'light'),
        )} µg of particles you would otherwise inhale during that window out of the living room.`
      : `Closing the windows before dusk keeps about ${round1(
          doseUg(eveningAqi, 1, 'light'),
        )} µg of inhaled particles from the evening peak out of the living room.`,
  };
}

function nightBlock(profile: HouseholdProfile, nightAqi: number): RoutineBlock {
  return {
    time: '21:30',
    title: 'Clean the bedroom before sleep',
    detail: `Run the purifier or box-fan filter for 30 minutes with the bedroom door closed, then leave it on low overnight (${
      profile.homeType
    } layout).`,
    windowAqi: nightAqi,
    risk: classifyRisk(nightAqi),
    impact: `You spend about a third of the day asleep. Clearing the bedroom first removes roughly ${round1(
      doseUg(nightAqi, 1, 'rest'),
    )} µg you would otherwise take in over the first hour of sleep.`,
  };
}

function buildSummary(
  profile: HouseholdProfile,
  currentAqi: number,
  cleanest: TimeWindow | null,
  sensitive: string[],
): string {
  const who = profile.members.map((member) => member.label).join(', ');
  const windowText = cleanest
    ? `The cleanest outdoors slot is ${formatHour(cleanest.startHour)}–${formatHour(cleanest.endHour)} at an average AQI of ${cleanest.averageAqi}.`
    : 'No hour today clears the safe threshold, so outdoor plans should move or wait.';

  const riskText =
    currentAqi > 150 && sensitive.length > 0
      ? ` ${sensitive.join(', ')} should stay indoors with filtered air.`
      : '';

  return `${who ? `${who}: ` : ''}air quality right now is AQI ${currentAqi}. ${windowText}${riskText}`;
}
