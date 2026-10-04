/**
 * Access Request Test Content Component
 *
 * Client component that contains the visual test page content.
 * Wrapped in Suspense by the page due to useSearchParams() usage.
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlatformAuthWizard } from '@/components/client-auth/PlatformAuthWizard';
import type { MetaFulfillmentDeclines, MetaFulfillmentResult } from '@agency-platform/shared';

// Mock data for visual testing
const mockData = {
  agencyName: 'Pillar AI Agency',
  clientName: 'Acme Corporation',
  clientEmail: 'client@acme.com',
  platforms: [
    {
      platformGroup: 'meta' as const,
      products: [
        { product: 'meta_ads', accessLevel: 'standard' },
      ],
    },
    {
      platformGroup: 'google' as const,
      products: [
        { product: 'google_ads', accessLevel: 'standard' },
        { product: 'ga4', accessLevel: 'read_only' },
      ],
    },
  ],
  intakeFields: [
    { id: 'business_name', label: 'Business Name', type: 'text', required: true },
    { id: 'website', label: 'Website URL', type: 'url', required: false },
    { id: 'monthly_budget', label: 'Monthly Ad Budget', type: 'dropdown', required: true, options: ['Under $5,000', '$5,000 - $20,000', '$20,000 - $50,000', '$50,000+'] },
    { id: 'notes', label: 'Any additional notes?', type: 'textarea', required: false },
  ],
  branding: {
    primaryColor: '#FF6B35',
  },
};

// Mock fulfillment rows exercising every checklist visual state (step 3).
const mockMetaFulfillment: MetaFulfillmentResult[] = [
  { id: 'row-1', assetKind: 'ad_account', assetId: 'act_1', assetName: 'Acme Ads', recipientType: 'business', recipientId: 'biz-1', recipientName: 'Agency Portfolio', requestedTasks: ['ADVERTISE'], verifiedTasks: ['ADVERTISE'], status: 'verified', updatedAt: '2026-10-03T00:00:00.000Z' },
  { id: 'row-2', assetKind: 'ad_account', assetId: 'act_2', assetName: 'Acme Prospecting', recipientType: 'business', recipientId: 'biz-1', recipientName: 'Agency Portfolio', requestedTasks: ['ADVERTISE'], verifiedTasks: [], status: 'manual_action_required', updatedAt: '2026-10-03T00:00:00.000Z' },
  { id: 'row-3', assetKind: 'page', assetId: 'page_1', assetName: 'Acme Main Page', recipientType: 'business', recipientId: 'biz-1', recipientName: 'Agency Portfolio', requestedTasks: ['MANAGE'], verifiedTasks: [], status: 'selected', updatedAt: '2026-10-03T00:00:00.000Z' },
];

const mockMetaDeclines: MetaFulfillmentDeclines = [
  { assetKind: 'catalog', declinedAt: '2026-10-03T00:00:00.000Z' },
];

export function AccessRequestTestContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [completedPlatforms, setCompletedPlatforms] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam === '2') setStep(2);
    else if (stepParam === '3') setStep(3);
    else setStep(1);
  }, [searchParams]);

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--ink)]">Not Found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Dev Controls */}
        <div className="mb-8 p-4 bg-slate-100 dark:bg-slate-800 border-2 border-black dark:border-white">
          <h2 className="font-bold text-sm uppercase tracking-wide mb-3">Visual Test Controls</h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStep(1)}
              className={`px-4 py-2 border-2 border-black dark:border-white font-semibold ${
                step === 1 ? 'bg-[var(--coral)] text-white' : 'bg-white dark:bg-slate-700'
              }`}
            >
              Step 1: Connect
            </button>
            <button
              onClick={() => setStep(2)}
              className={`px-4 py-2 border-2 border-black dark:border-white font-semibold ${
                step === 2 ? 'bg-[var(--coral)] text-white' : 'bg-white dark:bg-slate-700'
              }`}
            >
              Step 2: Choose
            </button>
            <button
              onClick={() => setStep(3)}
              className={`px-4 py-2 border-2 border-black dark:border-white font-semibold ${
                step === 3 ? 'bg-[var(--coral)] text-white' : 'bg-white dark:bg-slate-700'
              }`}
            >
              Step 3: Complete
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            Current step: {step} | Completed: {completedPlatforms.size} platforms
          </p>
        </div>

        {/* Platform Wizards */}
        <div className="space-y-8">
          {mockData.platforms.map((platformConfig) => (
            <TestPlatformWizard
              key={platformConfig.platformGroup}
              platform={platformConfig.platformGroup}
              platformName={platformConfig.platformGroup === 'meta' ? 'Meta' : 'Google'}
              products={platformConfig.products}
              forceStep={step}
              onComplete={() => {
                setCompletedPlatforms(new Set([...completedPlatforms, platformConfig.platformGroup]));
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Test wrapper that forces a specific step
function TestPlatformWizard({
  platform,
  platformName,
  products,
  forceStep,
  onComplete,
}: {
  platform: 'meta' | 'google';
  platformName: string;
  products: Array<{ product: string; accessLevel: string }>;
  forceStep: 1 | 2 | 3;
  onComplete: () => void;
}) {
  // For step 2, we need a mock connectionId
  const mockConnectionId = 'test-connection-id-' + platform;

  return (
    <div className="relative">
      <PlatformAuthWizard
        platform={platform}
        platformName={platformName}
        products={products}
        accessRequestToken="test-token"
        onComplete={onComplete}
        metaFulfillment={platform === 'meta' ? mockMetaFulfillment : undefined}
        metaDeclines={platform === 'meta' ? mockMetaDeclines : undefined}
        // Force the step by providing initial values
        initialStep={forceStep}
        initialConnectionId={forceStep >= 2 ? mockConnectionId : undefined}
      />

      {/* Mock data overlay for step 2 */}
      {forceStep === 2 && (
        <div className="absolute inset-0 pointer-events-none" />
      )}
    </div>
  );
}
