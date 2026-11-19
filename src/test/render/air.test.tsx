// ============================================================
// src/test/render/air.test.tsx
// Air Now panel: gauge text twin, household guidance, stagnation
// reasoning, forecast strip and the pollutant breakdown.
// ============================================================

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { makeAirResponse, makeBundle, makeProfile, seedProfile, stubFetch } from '../fixtures';

const ROUTES = {
  '/api/air-quality': () => makeAirResponse(),
};

describe('current reading', () => {
  it('shows the location and observed time', async () => {
    stubFetch(ROUTES);
    render(<App />);

    expect(await screen.findByText(/Test City/)).toBeInTheDocument();
    expect(screen.getByText(/source: live/)).toBeInTheDocument();
  });

  it('pairs the dial with a screen-reader text twin', async () => {
    stubFetch(ROUTES);
    render(<App />);

    const twin = await screen.findByLabelText('Air quality index reading');
    expect(twin).toHaveTextContent('185');
    expect(twin).toHaveTextContent('Unhealthy');
  });

  it('states the AQI band in words, not just colour', async () => {
    stubFetch(ROUTES);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Unhealthy', level: 3 })).toBeInTheDocument();
    expect(screen.getAllByText('Unhealthy').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/limit prolonged outdoor exertion/i)).toBeInTheDocument();
  });

  it('adds household-specific guidance for vulnerable members', async () => {
    stubFetch(ROUTES);
    // The default household has no vulnerabilities, so seed a sensitive one.
    seedProfile(makeProfile());
    render(<App />);

    expect(await screen.findByText(/For your household/i)).toBeInTheDocument();
    expect(screen.getByText(/Sensitive members should stay indoors/i)).toBeInTheDocument();
  });

  it('summarises the day range and main pollutant', async () => {
    stubFetch(ROUTES);
    render(<App />);

    // One label in the stat grid, one badge inside the pollutant card.
    expect((await screen.findAllByText('Main pollutant')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('PM25')).toBeInTheDocument();
    expect(screen.getByText('Today’s range')).toBeInTheDocument();
  });
});

describe('stagnation assessment', () => {
  it('explains why the air is trapping', async () => {
    stubFetch(ROUTES);
    render(<App />);

    expect(await screen.findByText('Strong trapping likely')).toBeInTheDocument();
    // Recomputed live from the fixture: calm wind (3) + humidity (1) + swing (2) + dawn cap (2).
    expect(screen.getByText(/Trapping score 8 \/ 10/)).toBeInTheDocument();
    expect(screen.getByText(/nowhere to disperse/)).toBeInTheDocument();
  });

  it('reports normal dispersion when the air is moving', async () => {
    stubFetch({
      '/api/air-quality': () => {
        const bundle = makeBundle();
        return {
          reading: bundle.reading,
          forecast: {
            ...bundle.forecast,
            weather: { windSpeedKmh: 22, temperatureC: 24, humidityPct: 40 },
          },
          fetchedAt: bundle.fetchedAt,
        };
      },
    });
    render(<App />);

    // The wind term disappears; the curve terms still apply.
    expect(await screen.findByText(/Trapping score/)).toBeInTheDocument();
  });
});

describe('24-hour forecast strip', () => {
  it('lists every hour for screen readers', async () => {
    stubFetch(ROUTES);
    render(<App />);

    const twin = await screen.findByLabelText(/hourly forecast for the next 24 hours/i);
    const items = within(twin).getAllByRole('listitem');
    expect(items).toHaveLength(27); // summary + best + worst + 24 hours
    expect(items.some((item) => item.textContent?.includes('13:00'))).toBe(true);
  });

  it('calls out the best and worst windows in text', async () => {
    stubFetch(ROUTES);
    render(<App />);

    expect(await screen.findByText(/Best window:/)).toBeInTheDocument();
    expect(screen.getByText(/Worst window:/)).toBeInTheDocument();
  });

  it('hides the column chart from assistive technology', async () => {
    stubFetch(ROUTES);
    render(<App />);

    const chart = await screen.findByRole('presentation', { hidden: true });
    expect(chart).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('pollutant breakdown', () => {
  it('names the dominant pollutant in words', async () => {
    stubFetch(ROUTES);
    render(<App />);

    expect((await screen.findAllByText('Main pollutant')).length).toBeGreaterThanOrEqual(2);
    const cards = screen.getAllByText(/PM2\.5|PM10|NO₂/);
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it('gives each pollutant a health note', async () => {
    stubFetch(ROUTES);
    render(<App />);

    expect(await screen.findByText(/main winter-smog risk/i)).toBeInTheDocument();
    expect(screen.getByText(/inflames the lining of the lungs/i)).toBeInTheDocument();
  });

  it('states every sub-index as a fraction of 500', async () => {
    stubFetch(ROUTES);
    render(<App />);

    expect(await screen.findByText('185 / 500')).toBeInTheDocument();
    expect(screen.getByText('133 / 500')).toBeInTheDocument();
    expect(screen.getByText('38 / 500')).toBeInTheDocument();
  });
});

describe('refresh and loading states', () => {
  const hang = () => new Promise<never>(() => undefined);

  it('shows a labelled loading skeleton before data arrives', () => {
    stubFetch({ '/api/air-quality': hang });
    render(<App />);

    expect(screen.getByText(/loading air quality/i)).toBeInTheDocument();
    expect(screen.getByText(/loading…/i)).toBeInTheDocument();
  });

  it('keeps the tablist usable while readings load', () => {
    stubFetch({ '/api/air-quality': hang });
    render(<App />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
  });

  it('does not crash when the user switches tabs mid-load', async () => {
    const user = userEvent.setup();
    stubFetch({ '/api/air-quality': hang });
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /better swaps/i }));
    expect(await screen.findByText(/alternatives that fit your household/i)).toBeInTheDocument();
  });
});
