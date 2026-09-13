'use client';

/**
 * SettingsGroup + SettingsRow
 *
 * The one layout primitive every settings tab uses. A group is a titled
 * section; a row is label + description on the left, the control on the
 * right at `md` and up, stacked below. Rows separate with a hairline; the
 * last row in a group drops it. Flat by design — no card, no shadow.
 */

import { useId } from 'react';

/** Placeholder for a value that has not loaded yet. Keeps layout stable. */
export const UNLOADED_VALUE = '—';

interface SettingsGroupProps {
  title: string;
  description?: string;
  /** Optional action rendered on the group's title line (e.g. a secondary button). */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function SettingsGroup({ title, description, aside, className = '', children }: SettingsGroupProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={headingId} className="font-display text-lg font-semibold text-ink">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}

interface SettingsRowProps {
  label: string;
  description?: React.ReactNode;
  /** When supplied, the label becomes a `<label htmlFor>` for that control. */
  controlId?: string;
  className?: string;
  children: React.ReactNode;
}

export function SettingsRow({ label, description, controlId, className = '', children }: SettingsRowProps) {
  const labelClass = 'block text-sm font-semibold text-ink';

  return (
    <div
      data-testid="settings-row"
      className={`grid gap-2 py-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8 hairline-b last:border-b-0 ${className}`}
    >
      <div className="min-w-0">
        {controlId ? (
          <label htmlFor={controlId} className={labelClass}>
            {label}
          </label>
        ) : (
          <p className={labelClass}>{label}</p>
        )}
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div data-testid="settings-row-control" className="min-w-0 w-full">
        {children}
      </div>
    </div>
  );
}
