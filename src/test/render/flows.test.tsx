// ============================================================
// src/test/render/flows.test.tsx
// Cross-panel journeys: generated routine (with and without the
// gateway), swap selection feeding the impact ledger, community
// pledges and the indoor calculator.
// ============================================================

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { makeAirResponse, makeProfile, seedProfile, stubFetch } from '../fixtures';

const ROUTES = {
  '/api/air-quality': () => makeAirResponse(),
};

function geminiPlanBody() {
  const blocks = [
    { time: '06:30', title: 'Wake indoors', detail: 'Keep the windows shut through dawn.', windowAqi: 205, risk: 'avoid', impact: 'Avoids about 140 µg inhaled before breakfast.' },
    { time: '08:00', title: 'Leave by metro', detail: 'Sealed carriage beats the kerb.', windowAqi: 210, risk: 'avoid', impact: 'Cuts the trip dose by roughly 60% versus walking.' },
    { time: '13:00', title: 'Outdoor window', detail: 'Sun has broken the inversion.', windowAqi: 68, risk: 'ideal', impact: 'Cuts inhaled particles by about 70% versus 07:00.' },
    { time: '19:00', title: 'Close up', detail: 'Evening peak builds after sunset.', windowAqi: 196, risk: 'avoid', impact: 'Keeps roughly 55 µg of evening exposure outdoors.' },
    { time: '21:30', title: 'Filter the bedroom', detail: 'Run the purifier before sleep.', windowAqi: 194, risk: 'avoid', impact: 'Clears about 80% of bedroom particles in 30 minutes.' },
  ];
  return {
    plan: {
      blocks,
      bestOutdoorWindow: null,
      summary: 'Asha and you: AQI 185 right now. Plan around the 13:00 window.',
      generator: 'gemini',
      generatedAt: '2026-11-19T09:00:00.000Z',
    },
    source: 'gemini',
  };
}

describe('routine tab — deterministic fallback', () => {
  it('builds a complete local plan when the gateway is unavailable', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES); // no /api/plan route
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /my day/i }));

    expect(await screen.findByText('Your low-emission day')).toBeInTheDocument();
    expect(screen.getByText('Local planner')).toBeInTheDocument();
    expect(screen.getByText(/gateway offline — deterministic fallback/i)).toBeInTheDocument();
  });

  it('names the best outdoor window from the forecast', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /my day/i }));

    expect(await screen.findByText('Best outdoor window')).toBeInTheDocument();
    // Appears once in the callout and once in the plan summary sentence.
    expect(screen.getAllByText(/13:00–15:00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/average AQI 68/)).toBeInTheDocument();
  });

  it('quantifies the impact of every block', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /my day/i }));
    await screen.findByText('Your low-emission day');

    const impacts = screen.getAllByText('Direct impact:');
    expect(impacts.length).toBeGreaterThanOrEqual(5);
    for (const label of impacts) {
      const text = label.parentElement?.textContent ?? '';
      expect(text).toMatch(/µg|%/);
    }
  });

  it('prices the commute block for the household mode', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /my day/i }));
    expect(await screen.findByText(/leave for work — metro/i)).toBeInTheDocument();
  });

  it('shows how the two generators differ', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /my day/i }));
    expect(await screen.findByText(/how this plan was built/i)).toBeInTheDocument();
    expect(screen.getByText(/deterministic planner/i)).toBeInTheDocument();
    expect(screen.getByText(/gemini generator/i)).toBeInTheDocument();
  });
});

describe('routine tab — GenAI route', () => {
  it('uses the generated plan when the gateway answers', async () => {
    const user = userEvent.setup();
    stubFetch({ ...ROUTES, '/api/plan': () => geminiPlanBody() });
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /my day/i }));

    expect(await screen.findByText('GenAI plan (Gemini)')).toBeInTheDocument();
    expect(screen.queryByText(/gateway offline/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Asha and you: AQI 185/)).toBeInTheDocument();
    expect(screen.getByText(/Filter the bedroom/)).toBeInTheDocument();
  });
});

describe('swaps → impact ledger', () => {
  it('starts with an honest empty state', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /impact/i }));
    expect(await screen.findByText('No choices selected yet')).toBeInTheDocument();
    expect(screen.getByText(/head to the better swaps tab/i)).toBeInTheDocument();
  });

  it('selects a swap and totals it on the impact tab', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /better swaps/i }));
    expect(await screen.findByText(/alternatives that fit your household/i)).toBeInTheDocument();

    const [firstSelect] = screen.getAllByRole('button', { name: 'Select' });
    expect(firstSelect).toBeDefined();
    if (firstSelect) await user.click(firstSelect);
    expect(screen.getByRole('button', { name: /selected/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/1 of \d+ suitable swaps selected/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /impact/i }));
    expect(await screen.findByRole('heading', { name: 'Your direct impact', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('CO₂ avoided per year')).toBeInTheDocument();
    expect(screen.getByText('Money kept per year')).toBeInTheDocument();
    expect(screen.getByText(/choice-by-choice breakdown/i)).toBeInTheDocument();
  });

  it('marks swaps that raise personal exposure', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    // Only drivers see the "cycle on clean days" swap with its exposure caveat.
    seedProfile(makeProfile({ commute: 'car' }));
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /better swaps/i }));
    expect(
      await screen.findByText(/raises your own exposure on dirty days/i),
    ).toBeInTheDocument();
  });

  it('hides swaps that do not fit the household', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /better swaps/i }));
    // The default profile cooks with gas in an apartment, so solar water
    // heating and solid-fuel induction are disclosed as not applicable.
    expect(await screen.findByText(/not applicable to your home/i)).toBeInTheDocument();
    expect(screen.getByText(/Let the sun heat your water/)).toBeInTheDocument();
  });

  it('filters swaps by category', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /better swaps/i }));
    await screen.findByText(/alternatives that fit your household/i);

    await user.click(screen.getByRole('button', { name: 'Food' }));
    expect(screen.getByText(/Keep two red-meat days a week/)).toBeInTheDocument();
    expect(screen.queryByText(/Wash clothes cold and full/)).not.toBeInTheDocument();
  });
});

describe('community tab', () => {
  it('lists pledges and annualises the collective effect', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES); // no /api/advisory route
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /community/i }));
    expect(await screen.findByText(/pledge with your street/i)).toBeInTheDocument();

    const pledgeButtons = screen.getAllByRole('button', { name: /i’m in/i });
    expect(pledgeButtons.length).toBeGreaterThanOrEqual(6);

    const [firstPledge] = pledgeButtons;
    if (firstPledge) await user.click(firstPledge);
    expect(screen.getByRole('button', { name: /pledged/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await screen.findByText('CO₂ avoided per year')).toBeInTheDocument();
    expect(screen.getByText('1 / 8')).toBeInTheDocument();
  });

  it('falls back to a fixed advisory when the model is unavailable', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /community/i }));
    expect(await screen.findByText(/source: fixed fallback/i)).toBeInTheDocument();
    expect(screen.getByText(/keep windows shut during the morning/i)).toBeInTheDocument();
  });

  it('states the care pledge has no emission figure', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /community/i }));
    expect(await screen.findByText(/care action — no emission figure/i)).toBeInTheDocument();
  });
});

describe('home air tab', () => {
  it('computes room volume and the CADR target', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /home air/i }));
    expect(await screen.findByText(/what your room needs/i)).toBeInTheDocument();
    expect(screen.getByText('56 m³')).toBeInTheDocument();
    expect(screen.getByText('224 m³/h')).toBeInTheDocument();
  });

  it('advisises on ventilation using the live forecast', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /home air/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/ventilate now|keep windows shut/i);
    expect(screen.getByText(/windows shut and run your filter|vent then/i)).toBeInTheDocument();
  });

  it('lists indoor hacks with quantified effect', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /home air/i }));
    expect(await screen.findByText(/indoor air hacks, ranked by effect/i)).toBeInTheDocument();
    expect(screen.getByText(/build a box-fan filter/i)).toBeInTheDocument();
    // One label per hack card.
    expect(screen.getAllByText('Expected indoor PM2.5 drop').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByRole('button', { name: 'All zones' })).toHaveLength(1);
  });

  it('filters hacks by zone', async () => {
    const user = userEvent.setup();
    stubFetch(ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /home air/i }));
    await screen.findByText(/indoor air hacks, ranked by effect/i);

    await user.click(screen.getByRole('button', { name: 'Kitchen' }));
    expect(screen.getByText(/run the kitchen exhaust 10 minutes early/i)).toBeInTheDocument();
    expect(screen.queryByText(/build a box-fan filter/i)).not.toBeInTheDocument();
  });
});
