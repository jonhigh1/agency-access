'use client';

/**
 * Settings Page
 *
 * Three-tab structure:
 * - General: Agency Profile, Team Members, Notifications
 * - Billing: Current plan, usage, comparison, payments, invoices
 * - Webhooks: Endpoint configuration and delivery inspection
 */

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { SettingsTabs } from '@/components/settings/settings-tabs';
import { Reveal } from '@/components/marketing/reveal';
import {
  AgencyProfileCard,
  TeamMembersCard,
  NotificationsCard,
} from '@/components/settings/general';
import { UsageOverviewCard } from '@/components/settings/usage-overview-card';

function gatedTabFallback(label: string) {
  return (
    <div
      className="min-h-[220px] rounded-xl border border-border bg-muted/25"
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
      <UsageOverviewCard />
      <AgencyProfileCard />
      <TeamMembersCard />
      <NotificationsCard />
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoadingSkeleton />}>
      <Reveal direction="up">
        <SettingsTabs
          generalContent={<GeneralTabContent />}
          billingContent={<BillingTab />}
          webhooksContent={<WebhookSettingsTab />}
          agentsContent={<AgentsSettingsTab />}
        />
      </Reveal>
    </Suspense>
  );
}

function SettingsLoadingSkeleton() {
  return (
    <div className="flex-1 bg-paper p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="h-9 w-32 bg-card/50 rounded animate-pulse" />
          <div className="h-4 w-64 bg-card/50 rounded animate-pulse mt-2" />
        </div>
        <div className="flex gap-1 mb-6 border-b border-border pb-3">
          <div className="h-8 w-24 bg-card/50 rounded animate-pulse" />
          <div className="h-8 w-24 bg-card/50 rounded animate-pulse" />
          <div className="h-8 w-24 bg-card/50 rounded animate-pulse" />
        </div>
        <div className="space-y-6">
          <div className="h-48 bg-card rounded-lg border border-border animate-pulse" />
          <div className="h-32 bg-card rounded-lg border border-border animate-pulse" />
        </div>
      </div>
    </div>
  );
}
