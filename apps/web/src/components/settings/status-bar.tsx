'use client';

/**
 * StatusBar — the one dark surface per settings tab, as a single mono line.
 *
 * Reads like a terminal status line: a micro header, then label·value pairs
 * that wrap on narrow screens. Unloaded values render as "—". An optional
 * trailing action slot takes a link-styled control; never a Button (the
 * brutalist button lives in the row layer).
 */

import type { ReactNode } from 'react';
import { UNLOADED_VALUE } from './settings-row';

export interface StatusBarItem {
  label: string;
  value: ReactNode | null | undefined;
  testId?: string;
}

interface StatusBarProps {
  label: string;
  items: StatusBarItem[];
  action?: ReactNode;
  /** Short muted note that wraps to its own line on narrow screens. */
  note?: string;
  className?: string;
}

export function StatusBar({ label, items, action, note, className = '' }: StatusBarProps) {
  return (
    <div
      role="status"
      className={`ink-panel flex flex-wrap items-baseline gap-x-8 gap-y-2 px-5 py-3 ${className}`}
    >
      <span className="label-micro shrink-0">{label}</span>
      <dl className="flex min-w-0 basis-full flex-wrap items-baseline gap-x-8 gap-y-2 sm:flex-1 sm:basis-auto">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 basis-full items-baseline gap-x-2 sm:basis-auto">
            <dt className="label-nano shrink-0">{item.label}</dt>
            <dd className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]" data-testid={item.testId}>
              {item.value === null || item.value === undefined || item.value === '' ? UNLOADED_VALUE : item.value}
            </dd>
          </div>
        ))}
      </dl>
      {action && <div className="shrink-0">{action}</div>}
      {note && <span className="basis-full text-xs text-paper/70">{note}</span>}
    </div>
  );
}
