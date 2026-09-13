/* Hallmark · genre: modern-minimal · macrostructure: Index-First · design-system: DESIGN_SYSTEM.md v2.0 · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R5 V3 — self-assessment; the render gate (visual-qa 2026-09-12: PASS-WITH-NITS) is the evidence */
'use client';

/**
 * Settings shell
 *
 * Owns the page header, the mono identity line, the accessible tab rail,
 * and the `?tab=` URL model. Tab bodies are passed in; this file never
 * fetches tab data. Four tabs: General, Billing, Webhooks, Agents.
 */

import { useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SUBSCRIPTION_TIER_NAMES } from '@agency-platform/shared';
import { usePrefetchBillingData, useSubscription } from '@/lib/query/billing';
import { useUserAgency } from '@/hooks/use-user-agency';
import { resolveBillingLifecycle } from './billing/billing-lifecycle';
import { UNLOADED_VALUE } from './settings-row';

const TAB_IDS = ['general', 'billing', 'webhooks', 'agents'] as const;
type SettingsTab = (typeof TAB_IDS)[number];

const TAB_LABELS: Record<SettingsTab, string> = {
  general: 'General',
  billing: 'Billing',
  webhooks: 'Webhooks',
  agents: 'Agents',
};

const UNLOADED = UNLOADED_VALUE;

/** Two-ring focus, copied from Button base styles — globals.css only sets it on form fields. */
const TAB_FOCUS =
  'focus-visible:outline-[3px] focus-visible:outline-coral/25 focus-visible:outline-offset-0 focus-visible:[box-shadow:0_0_0_6px_rgb(var(--primary)/0.08)]';

function isSettingsTab(value: string | null): value is SettingsTab {
  return value !== null && (TAB_IDS as readonly string[]).includes(value);
}

interface SettingsTabsProps {
  generalContent: React.ReactNode;
  billingContent: React.ReactNode;
  webhooksContent: React.ReactNode;
  agentsContent: React.ReactNode;
}

export function SettingsTabs({ generalContent, billingContent, webhooksContent, agentsContent }: SettingsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefetchBilling = usePrefetchBillingData();
  const { data: agency } = useUserAgency();
  const { data: subscription } = useSubscription();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const requested = searchParams.get('tab');
  const currentTab: SettingsTab = isSettingsTab(requested) ? requested : 'general';

  const setTab = useCallback(
    (tab: SettingsTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const focusTab = (index: number) => {
    const count = TAB_IDS.length;
    const next = ((index % count) + count) % count;
    tabRefs.current[next]?.focus();
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusTab(index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusTab(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusTab(0);
        break;
      case 'End':
        event.preventDefault();
        focusTab(TAB_IDS.length - 1);
        break;
      default:
        break;
    }
  };

  const lifecycle = resolveBillingLifecycle(subscription);
  const planName =
    lifecycle === 'FREE' || !subscription?.tier ? 'Free' : SUBSCRIPTION_TIER_NAMES[subscription.tier];
  const identity = [agency?.name || UNLOADED, planName, agency?.id || UNLOADED].join(' · ');

  const content: Record<SettingsTab, React.ReactNode> = {
    general: generalContent,
    billing: billingContent,
    webhooks: webhooksContent,
    agents: agentsContent,
  };

  return (
    <div className="flex-1 bg-paper p-6 md:p-8">
      <div className="max-w-7xl mx-auto" data-testid="settings-shell">
        <header className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-ink tracking-display-md">Settings</h1>
          <p
            className="mt-1 font-mono text-xs tracking-[0.04em] text-muted-foreground"
            data-testid="settings-identity"
          >
            {identity}
          </p>
        </header>

        <div role="tablist" aria-label="Settings sections" className="flex gap-3 sm:gap-6 mb-8 hairline-b overflow-x-auto">
          {TAB_IDS.map((tab, index) => {
            const selected = currentTab === tab;
            return (
              <button
                key={tab}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`settings-tab-${tab}`}
                aria-selected={selected}
                aria-controls={`settings-panel-${tab}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(tab)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                onMouseEnter={tab === 'billing' ? prefetchBilling : undefined}
                onFocus={tab === 'billing' ? prefetchBilling : undefined}
                className={`-mb-px min-h-[44px] px-1 pb-3 text-sm font-semibold transition-colors duration-150 border-b-2 ${
                  selected
                    ? 'border-coral text-ink'
                    : 'border-transparent text-muted-foreground hover:text-ink'
                } ${TAB_FOCUS}`}
              >
                {TAB_LABELS[tab]}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`settings-panel-${currentTab}`}
          aria-labelledby={`settings-tab-${currentTab}`}
          className="space-y-10"
        >
          {content[currentTab]}
        </div>
      </div>
    </div>
  );
}
