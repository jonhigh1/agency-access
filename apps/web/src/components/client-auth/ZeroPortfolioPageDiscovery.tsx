'use client';

import type { ReactNode } from 'react';

/**
 * Zero-portfolio Page discovery (pages_show_list).
 *
 * Lists managed Pages via GET /me/accounts with name and ID visible for App
 * Review proof. Primary Page selection is required before Business Portfolio
 * creation controls render.
 */

import { SingleSelect } from '@/components/ui/single-select';

export interface ZeroPortfolioUserPage {
  id: string;
  name: string;
  category?: string;
}

interface ZeroPortfolioPageDiscoveryProps {
  pages: ZeroPortfolioUserPage[] | null;
  loading: boolean;
  error: string | null;
  primaryPageId: string;
  onPrimaryPageChange: (pageId: string) => void;
  /** Shown only after a primary Page is selected (MetaBusinessCreator). */
  businessCreator: ReactNode;
}

export function ZeroPortfolioPageDiscovery({
  pages,
  loading,
  error,
  primaryPageId,
  onPrimaryPageChange,
  businessCreator,
}: ZeroPortfolioPageDiscoveryProps) {
  if (error) {
    return (
      <section
        aria-label="Facebook Pages discovery error"
        className="border border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 p-6 text-sm text-[rgb(var(--warning))]"
      >
        {error}
      </section>
    );
  }

  if (loading || pages === null) {
    return (
      <p role="status" className="text-sm text-[rgb(var(--muted-foreground))]">
        Loading your Facebook Pages…
      </p>
    );
  }

  if (pages.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Your Facebook Pages"
      className="bg-[rgb(var(--warm-gray))]/20 p-6 space-y-4 border-2 border-black dark:border-white"
    >
      <div>
        <span className="label-micro">Page discovery</span>
        <h3 className="mt-1 text-lg font-bold text-[rgb(var(--ink))] font-display">
          Your Facebook Pages
        </h3>
        <p className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">
          These are Pages you manage on Facebook (user Page listing). Choose one as the primary
          Page before creating a Business Portfolio.
        </p>
      </div>

      <ul className="space-y-2" aria-label="Managed Pages list">
        {pages.map((page) => (
          <li
            key={page.id}
            className="border-2 border-black bg-[rgb(var(--card))] p-3 dark:border-white"
          >
            <p className="font-display font-bold text-[rgb(var(--ink))]">{page.name}</p>
            <p className="font-mono text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
              Page ID: {page.id}
            </p>
            {page.category ? (
              <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">{page.category}</p>
            ) : null}
          </li>
        ))}
      </ul>

      <div>
        <SingleSelect
          options={pages.map((page) => ({
            value: page.id,
            label: page.name,
            description: `Page ID ${page.id}`,
          }))}
          value={primaryPageId}
          onChange={onPrimaryPageChange}
          placeholder="Select primary Page…"
          ariaLabel="Primary Facebook Page"
          triggerClassName="border-2 border-black dark:border-white min-h-[48px]"
        />
        <p className="text-xs text-[rgb(var(--muted-foreground))] mt-2">
          Business Portfolio creation unlocks after you choose a primary Page.
        </p>
      </div>

      {primaryPageId ? (
        <div className="pt-2 border-t-2 border-black dark:border-white">{businessCreator}</div>
      ) : (
        <p role="status" className="text-sm text-[rgb(var(--muted-foreground))]">
          Select a primary Page to continue with Business Portfolio creation.
        </p>
      )}
    </section>
  );
}
