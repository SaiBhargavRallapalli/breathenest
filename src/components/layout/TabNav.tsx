// ============================================================
// src/components/layout/TabNav.tsx
// ARIA tablist with full keyboard support (arrows, Home, End) and
// roving tabindex so a screen-reader user hears one tab stop.
// ============================================================

import { useRef, type KeyboardEvent } from 'react';
import { TAB_IDS, useApp, type TabId } from '@/context/AppContext';
import { translate, type TranslationKey } from '@/constants/translations';
import { Icon, type IconName } from '@/components/ui/Icon';

const TAB_META: Readonly<Record<TabId, { label: TranslationKey; icon: IconName }>> = {
  air: { label: 'nav.air', icon: 'air' },
  routine: { label: 'nav.routine', icon: 'day' },
  home: { label: 'nav.home', icon: 'home' },
  swaps: { label: 'nav.swaps', icon: 'swap' },
  impact: { label: 'nav.impact', icon: 'impact' },
  community: { label: 'nav.community', icon: 'community' },
};

export function TabNav() {
  const { tab, setTab, language } = useApp();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (delta: number, from: number) => {
    const next = (from + delta + TAB_IDS.length) % TAB_IDS.length;
    const target = TAB_IDS[next];
    if (target) {
      setTab(target);
      buttons.current[next]?.focus();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        move(1, index);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        move(-1, index);
        break;
      case 'Home':
        event.preventDefault();
        setTab(TAB_IDS[0] ?? 'air');
        buttons.current[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        setTab(TAB_IDS[TAB_IDS.length - 1] ?? 'community');
        buttons.current[TAB_IDS.length - 1]?.focus();
        break;
      default:
        break;
    }
  };

  return (
    <nav aria-label="Application sections" className="border-b border-edge bg-panel/70">
      <div
        role="tablist"
        aria-label="Application sections"
        className="flex gap-1 overflow-x-auto px-2 sm:px-4"
      >
        {TAB_IDS.map((id, index) => {
          const meta = TAB_META[id];
          const selected = tab === id;
          return (
            <button
              key={id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={selected}
              aria-controls={`panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`relative flex shrink-0 items-center gap-2 px-3.5 text-sm font-medium transition-colors sm:text-base ${
                selected ? 'text-mint' : 'text-fog hover:text-chalk'
              }`}
            >
              <Icon name={meta.icon} />
              {translate(language, meta.label)}
              {selected && (
                <span aria-hidden="true" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-mint" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
