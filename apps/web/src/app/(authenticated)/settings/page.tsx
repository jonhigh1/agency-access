'use client';

/**
 * Settings Page
 *
 * Four-tab structure inside one shell:
 * - General: Plan strip, usage, agency profile
 * - Billing: Plan status, usage, comparison, payments, invoices
 * - Webhooks: Endpoint configuration and delivery inspection
 * - Agents: MCP endpoint and personal-agent grants
 */

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { SettingsTabs } from '@/components/settings/settings-tabs';
import { AgencyProfileCard, PlanStrip } from '@/components/settings/general';
import { UsageOverviewCard } from '@/components/settings/usage-overview-card';

function gatedTabFallback(label: string) {
  return (
    <div
      className="min-h-[220px] border border-border bg-muted/25"
      aria-busy
      aria-label={label}
    />
  );
}

const BillingTab = dynamic(
  () =>
    import('@/components/settings/billing/billing-tab').then((m) => ({
      default: m.BillingTab,
    })),
  { loading: () => gatedTabFallback('Loading billing settings') }
);

const WebhookSettingsTab = dynamic(
  () =>
    import('@/components/settings/webhooks/webhook-settings-tab').then((m) => ({
      default: m.WebhookSettingsTab,
    })),
  { loading: () => gatedTabFallback('Loading webhook settings') }
);

const AgentsSettingsTab = dynamic(
  () =>
    import('@/components/settings/agents/agents-settings-tab').then((m) => ({
      default: m.AgentsSettingsTab,
    })),
  { loading: () => gatedTabFallback('Loading agent settings') }
);

function GeneralTabContent() {
  return (
    <>
      <PlanStrip />
      <UsageOverviewCard />
      <AgencyProfileCard />
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoadingSkeleton />}>
      <SettingsTabs
        generalContent={<GeneralTabContent />}
        billingContent={<BillingTab />}
        webhooksContent={<WebhookSettingsTab />}
        agentsContent={<AgentsSettingsTab />}
      />
    </Suspense>
  );
}

function SettingsLoadingSkeleton() {
  return (
    <div className="flex-1 bg-paper p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="h-8 w-32 bg-muted animate-pulse" />
          <div className="h-3 w-64 bg-muted animate-pulse mt-3" />
        </div>
        <div className="flex gap-6 mb-8 hairline-b pb-3">
          <div className="h-5 w-16 bg-muted animate-pulse" />
          <div className="h-5 w-16 bg-muted animate-pulse" />
          <div className="h-5 w-20 bg-muted animate-pulse" />
          <div className="h-5 w-16 bg-muted animate-pulse" />
        </div>
        <div className="space-y-10">
          <div className="h-24 bg-ink/90 animate-pulse" />
          <div className="h-40 border border-border animate-pulse" />
        </div>
      </div>
    </div>
  );
}
