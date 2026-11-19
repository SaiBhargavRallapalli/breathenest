// ============================================================
// src/components/ui/Stat.tsx
// Compact label/value pair used in every summary strip.
// ============================================================

interface StatProps {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: 'default' | 'good' | 'warn' | 'bad';
}

const TONE_CLASS: Readonly<Record<NonNullable<StatProps['tone']>, string>> = {
  default: 'text-chalk',
  good: 'text-mint',
  warn: 'text-warn',
  bad: 'text-alert',
};

export function Stat({ label, value, hint, tone = 'default' }: StatProps) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wider text-fog">{label}</dt>
      {/* The hint lives inside the <dd> so the <dl> only ever holds dt/dd pairs. */}
      <dd className="mt-0.5">
        <span className={`block truncate text-xl font-semibold tabular-nums ${TONE_CLASS[tone]}`}>
          {value}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-fog">{hint}</span>}
      </dd>
    </div>
  );
}
