// ============================================================
// src/components/layout/AppShell.tsx
// Page chrome: header, tablist, degraded-data notice, the active
// tab panel, and the footer. Also owns the document lang/dir so the
// whole page follows the selected language.
// ============================================================

import { useEffect, type ReactNode } from 'react';
import { useApp } from '@/context/AppContext';
import { isRtl, translate } from '@/constants/translations';
import { TabNav } from './TabNav';
import { LocationPicker } from './LocationPicker';
import { LanguagePicker } from './LanguagePicker';

export function AppShell({ children }: { children: ReactNode }) {
  const { tab, language, air, reloadAir } = useApp();

  // Keep the document semantics in sync with the chosen language.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl(language) ? 'rtl' : 'ltr';
  }, [language]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 pb-16 sm:px-6">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="pt-6" aria-label="BreatheNest application header">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-chalk sm:text-3xl">
              <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-mint bn-pulse" />
              BreatheNest
            </h1>
            <p className="mt-1 text-sm text-fog sm:text-base">{translate(language, 'app.tagline')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LanguagePicker />
            <button
              type="button"
              onClick={reloadAir}
              className="flex items-center gap-2 rounded-xl border border-edge bg-raised px-3 text-sm font-medium text-chalk hover:border-mint/60"
            >
              {translate(language, 'action.refresh')}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-edge bg-panel p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-fog">Your location</h2>
          <LocationPicker />
        </div>
      </header>

      <div className="mt-4">
        <TabNav />
      </div>

      {air.degraded && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-warn/50 bg-warn/10 px-4 py-3 text-sm text-warn"
        >
          <strong className="font-semibold">{translate(language, 'common.offline')}</strong>
          {air.error && <span className="block text-warn/80">{air.error}</span>}
        </div>
      )}

      <main id="main-content" tabIndex={-1} className="mt-6 flex-1 outline-none">
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {children}
        </div>
      </main>

      <footer className="mt-12 border-t border-edge pt-6 text-xs text-fog" aria-label="Application footer">
        <p>
          BreatheNest is a decision-support tool, not medical advice. Air-quality values come from the
          Open-Meteo public API and follow US EPA breakpoints.
        </p>
        <p className="mt-1">
          Built for the PromptWars × Catalyst challenge. Open source under the MIT licence.
        </p>
      </footer>
    </div>
  );
}
