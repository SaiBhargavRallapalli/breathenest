// ============================================================
// src/test/render/shell.test.tsx
// Application chrome: landmarks, tablist keyboard support,
// language switching (including RTL) and the degraded-data notice.
// ============================================================

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { makeAirResponse, stubFetch } from '../fixtures';

const BASE_ROUTES = {
  // Echo the requested place so location switches are observable in the UI.
  '/api/air-quality': (url: URL) => ({
    ...makeAirResponse(),
    reading: {
      ...makeAirResponse().reading,
      locationName: url.searchParams.get('name') ?? 'Test City',
      region: url.searchParams.get('region') ?? 'Test Region',
    },
  }),
  '/api/locations': () => ({
    results: [
      {
        id: 'mumbai-in',
        name: 'Mumbai',
        region: 'Maharashtra',
        country: 'India',
        countryCode: 'IN',
        latitude: 19.076,
        longitude: 72.8777,
      },
    ],
  }),
};

describe('application shell', () => {
  it('renders the brand as the page heading', async () => {
    stubFetch(BASE_ROUTES);
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: /BreatheNest/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/smog companion/i)).toBeInTheDocument();
  });

  it('exposes a skip link that targets the main region', () => {
    stubFetch(BASE_ROUTES);
    render(<App />);

    const skip = screen.getByRole('link', { name: /skip to main content/i });
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('declares exactly six tabs in a labelled tablist', () => {
    stubFetch(BASE_ROUTES);
    render(<App />);

    const tablist = screen.getByRole('tablist', { name: /application sections/i });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(6);
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Air now',
      'My day',
      'Home air',
      'Better swaps',
      'Impact',
      'Community',
    ]);
  });

  it('marks only the active tab as selected with a single tab stop', () => {
    stubFetch(BASE_ROUTES);
    render(<App />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
  });

  it('links each tab to its panel and back', () => {
    stubFetch(BASE_ROUTES);
    render(<App />);

    const tab = screen.getByRole('tab', { name: /air now/i });
    const panel = screen.getByRole('tabpanel');
    expect(tab).toHaveAttribute('aria-controls', 'panel-air');
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-air');
  });

  it('keeps the medical and data-source disclaimer in the footer', () => {
    stubFetch(BASE_ROUTES);
    render(<App />);

    expect(screen.getByText(/not medical advice/i)).toBeInTheDocument();
    expect(screen.getByText(/Open-Meteo/i)).toBeInTheDocument();
    expect(screen.getByText(/MIT licence/i)).toBeInTheDocument();
  });
});

describe('tab keyboard navigation', () => {
  it('moves selection with the arrow keys', async () => {
    const user = userEvent.setup();
    stubFetch(BASE_ROUTES);
    render(<App />);

    const first = screen.getByRole('tab', { name: /air now/i });
    first.focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: /my day/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /my day/i })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /air now/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('jumps to the ends with Home and End', async () => {
    const user = userEvent.setup();
    stubFetch(BASE_ROUTES);
    render(<App />);

    screen.getByRole('tab', { name: /air now/i }).focus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /community/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: /air now/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('switches panels when a tab is clicked', async () => {
    const user = userEvent.setup();
    stubFetch(BASE_ROUTES);
    render(<App />);

    await user.click(screen.getByRole('tab', { name: /home air/i }));
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-home');
    expect(await screen.findByText(/what your room needs/i)).toBeInTheDocument();
  });
});

describe('language and direction', () => {
  it('switches the interface language', async () => {
    const user = userEvent.setup();
    stubFetch(BASE_ROUTES);
    render(<App />);

    expect(screen.getByRole('tab', { name: /air now/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/language/i), 'hi');
    expect(screen.getByRole('tab', { name: 'अभी हवा' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('hi');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('flips the document to right-to-left for Arabic', async () => {
    const user = userEvent.setup();
    stubFetch(BASE_ROUTES);
    render(<App />);

    await user.selectOptions(screen.getByLabelText(/language/i), 'ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(screen.getByRole('tab', { name: 'الهواء الآن' })).toBeInTheDocument();
  });

  it('returns to left-to-right when English is reselected', async () => {
    const user = userEvent.setup();
    stubFetch(BASE_ROUTES);
    render(<App />);

    await user.selectOptions(screen.getByLabelText(/language/i), 'ar');
    await user.selectOptions(screen.getByLabelText(/language/i), 'en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});

describe('degraded data notice', () => {
  it('warns when live readings are unavailable', async () => {
    stubFetch({}); // no routes: every request 404s
    render(<App />);

    const notice = await screen.findByText(/sample readings shown/i);
    expect(notice.closest('[role="status"]')).not.toBeNull();
  });

  it('stays hidden while live data flows', async () => {
    stubFetch(BASE_ROUTES);
    render(<App />);

    expect(await screen.findByText(/Delhi, National Capital Territory/)).toBeInTheDocument();
    expect(screen.queryByText(/sample readings shown/i)).not.toBeInTheDocument();
  });
});

describe('location controls', () => {
  it('offers quick city shortcuts', async () => {
    stubFetch(BASE_ROUTES);
    render(<App />);

    const quick = screen.getByRole('list', { name: /quick city list/i });
    expect(within(quick).getByRole('button', { name: 'Delhi' })).toBeInTheDocument();
    expect(within(quick).getByRole('button', { name: 'Lahore' })).toBeInTheDocument();
  });

  it('searches for a city and applies the result', async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(BASE_ROUTES);
    render(<App />);

    await user.type(screen.getByLabelText(/search for a city/i), 'Mumbai');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    const result = await screen.findByRole('button', { name: /Mumbai/ });
    await user.click(result);

    // One in the location aria-live region, one in the reading card title.
    expect((await screen.findAllByText(/Mumbai, Maharashtra/)).length).toBeGreaterThanOrEqual(1);
    const airCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/air-quality?'),
    );
    expect(airCalls.length).toBeGreaterThanOrEqual(1);
    expect(String(airCalls[airCalls.length - 1]?.[0])).toContain('name=Mumbai');  });

  it('switches location from the quick list', async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(BASE_ROUTES);
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Lahore' }));

    const airCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/air-quality?'),
    );
    expect(String(airCalls[airCalls.length - 1]?.[0])).toContain('name=Lahore');
    expect(String(airCalls[airCalls.length - 1]?.[0])).toContain('lat=31.5204');
  });

  it('reloads readings when Refresh is pressed', async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(BASE_ROUTES);
    render(<App />);

    await screen.findByText(/Delhi, National Capital Territory/);
    const before = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/air-quality?'),
    ).length;

    await user.click(screen.getByRole('button', { name: /refresh readings/i }));

    expect(
      (await screen.findAllByText(/Delhi, National Capital Territory/)).length,
    ).toBeGreaterThanOrEqual(1);
    const after = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/air-quality?'),
    ).length;
    expect(after).toBeGreaterThan(before);
  });
});
