// ============================================================
// src/components/ui/Meter.tsx
// Labelled progress bar used for effectiveness, dose and impact.
// The percentage is always written out, never implied by width.
// ============================================================

interface MeterProps {
  readonly label: string;
  /** 0–1 fraction. Clamped before rendering. */
  readonly value: number;
  readonly valueText: string;
  readonly tone?: 'mint' | 'warn' | 'alert' | 'aqua';
  readonly description?: string;
}

const TONE_COLOR: Readonly<Record<NonNullable<MeterProps['tone']>, string>> = {
  mint: 'var(--color-mint)',
  warn: 'var(--color-warn)',
  alert: 'var(--color-alert)',
  aqua: 'var(--color-aqua)',
};

export function Meter({ label, value, valueText, tone = 'mint', description }: MeterProps) {
  const fraction = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-fog">{label}</span>
        <span className="font-semibold tabular-nums text-chalk">{valueText}</span>
      </div>
      <div
        role="meter"
        aria-valuenow={Math.round(fraction * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${valueText}`}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-edge/70"
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${fraction * 100}%`, backgroundColor: TONE_COLOR[tone] }}
        />
      </div>
      {description && <p className="mt-1 text-xs text-fog">{description}</p>}
    </div>
  );
}
