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
import { SettingsTabs } from '@/components/settings/settings-tabs';
import {
  AgencyProfileCard,
  TeamMembersCard,
  NotificationsCard,
} from '@/components/settings/general';
import { BillingTab } from '@/components/settings/billing';
import { UsageOverviewCard } from '@/components/settings/usage-overview-card';
import { WebhookSettingsTab } from '@/components/settings/webhooks';
import { AgentsSettingsTab } from '@/components/settings/agents';

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
