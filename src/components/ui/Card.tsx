// ============================================================
// src/components/ui/Card.tsx
// Surface primitive used by every panel. Keeps heading levels
// consistent so the document outline stays valid for screen readers.
// ============================================================

import type { ReactNode } from 'react';

interface CardProps {
  readonly title?: string;
  readonly eyebrow?: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  /** Heading level — pick the one that fits the surrounding outline. */
  readonly level?: 2 | 3 | 4;
  readonly className?: string;
}

export function Card({
  title,
  eyebrow,
  description,
  actions,
  children,
  level = 3,
  className = '',
}: CardProps) {
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4';

  return (
    <section
      className={`rounded-2xl border border-edge bg-panel p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] ${className}`}
      aria-label={title}
    >
      {(title || eyebrow || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mint/80">{eyebrow}</p>
            )}
            {title && (
              <Heading className="mt-1 text-lg font-semibold text-chalk sm:text-xl">{title}</Heading>
            )}
            {description && <p className="mt-1 max-w-prose text-sm text-fog">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
