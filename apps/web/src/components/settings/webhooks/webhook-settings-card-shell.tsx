'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { SettingsGroup } from '../settings-row';

interface WebhookSettingsCardShellProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  aside?: ReactNode;
  children: ReactNode;
}

/**
 * Thin adapter over SettingsGroup so the webhook tab's section titles and
 * descriptions keep their exact copy. The icon prop is accepted for
 * compatibility and no longer rendered — v2.0 drops icon-tile headers.
 */
export function WebhookSettingsCardShell({ title, description, aside, children }: WebhookSettingsCardShellProps) {
  return (
    <SettingsGroup title={title} description={description} aside={aside}>
      {children}
    </SettingsGroup>
  );
}
