// ============================================================
// src/lib/format.ts
// Presentation helpers shared by every panel.
// Kept out of the compute layer because these exist only for display.
// ============================================================

/** Locale-aware integer/decimal formatting with a sane fallback. */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return value.toFixed(decimals);
  }
}

/** Compact form for large figures (1.2k, 3.4M). */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${formatNumber(value / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${formatNumber(value / 1_000, 1)}k`;
  return formatNumber(value, abs < 10 ? 1 : 0);
}

/** Currency figure with symbol, e.g. "$340". */
export function formatMoney(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: value < 100 ? 2 : 0,
    }).format(value);
  } catch {
    return `${currency} ${formatNumber(value, 0)}`;
  }
}

/** Hour number → "07:00". */
export function formatHour(hour: number): string {
  const normalised = ((Math.round(hour) % 24) + 24) % 24;
  return `${String(normalised).padStart(2, '0')}:00`;
}

/** Inclusive start hour + duration → "07:00–09:00". */
export function formatHourRange(startHour: number, endHour: number): string {
  return `${formatHour(startHour)}–${formatHour(endHour)}`;
}

/** ISO timestamp → "18 Nov, 21:30". */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown time';
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return iso;
  }
}

/** Percentage string from a 0–1 fraction. */
export function formatPercent(fraction: number, decimals = 0): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${formatNumber(fraction * 100, decimals)}%`;
}

/** Spoken-friendly distance for screen readers, e.g. "3 point 5 km". */
export function speakDistance(km: number): string {
  return `${formatNumber(km, 1)} kilometres`;
}
