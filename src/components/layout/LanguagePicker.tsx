// ============================================================
// src/components/layout/LanguagePicker.tsx
// Interface language switcher. Selecting a language flips both the
// document language and its writing direction (Arabic is RTL).
// ============================================================

import { LANGUAGES } from '@/constants/translations';
import type { SupportedLanguage } from '@/types';
import { useApp } from '@/context/AppContext';

export function LanguagePicker() {
  const { language, setLanguage } = useApp();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language-select" className="text-xs font-medium uppercase tracking-wider text-fog">
        Language
      </label>
      <select
        id="language-select"
        value={language}
        onChange={(event) => setLanguage(event.target.value as SupportedLanguage)}
        className="rounded-xl border border-edge bg-raised px-3 text-sm text-chalk"
      >
        {LANGUAGES.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.label}
          </option>
        ))}
      </select>
    </div>
  );
}
