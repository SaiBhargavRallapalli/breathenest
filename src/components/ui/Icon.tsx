// ============================================================
// src/components/ui/Icon.tsx
// Small stroke icon set. Purely decorative: every icon is
// aria-hidden and always sits next to a text label.
// ============================================================

export type IconName = 'air' | 'day' | 'home' | 'swap' | 'impact' | 'community' | 'pin' | 'refresh';

const PATHS: Readonly<Record<IconName, readonly string[]>> = {
  air: ['M3 8h11a3 3 0 1 0-3-3', 'M3 12h15a3 3 0 1 1-3 3', 'M3 16h7'],
  day: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5'],
  swap: ['M4 7h13', 'M14 4l3 3-3 3', 'M20 17H7', 'M10 14l-3 3 3 3'],
  impact: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  community: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  pin: ['M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z', 'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  refresh: ['M21 12a9 9 0 1 1-2.64-6.36', 'M21 3v6h-6'],
};

interface IconProps {
  readonly name: IconName;
  readonly className?: string;
}

export function Icon({ name, className = 'h-4 w-4' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
