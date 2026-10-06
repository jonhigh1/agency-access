/**
 * Visual Test Page for Meta Asset Creation UI Components
 *
 * This page shows the asset creation UI components for visual testing.
 * Only available in development mode.
 *
 * Components tested:
 * - MetaAssetCreator (Create Ad Account form)
 * - GuidedRedirectCard (Create Page modal)
 * - Empty state for Ad Accounts
 * - Empty state for Pages
 */

'use client';

import { useState, useEffect } from 'react';
import { MetaAssetCreator } from '@/components/client-auth/MetaAssetCreator';
import { MetaBusinessCreator } from '@/components/client-auth/MetaBusinessCreator';
import { ZeroPortfolioPageDiscovery } from '@/components/client-auth/ZeroPortfolioPageDiscovery';
import { MetaBusinessSetupChecklist } from '@/components/client-auth/MetaBusinessSetupChecklist';
import { GuidedRedirectCard } from '@/components/client-auth/GuidedRedirectModal';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Plus, ExternalLink, Loader2, Moon, Sun } from 'lucide-react';

// Helper to set theme
function setTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  localStorage.setItem('theme', theme);
}

// Only show in development
if (process.env.NODE_ENV === 'production') {
  // This will be handled in the component
}

export default function AssetCreationTestPage() {
  const [showAdAccountCreator, setShowAdAccountCreator] = useState(false);
  const [showPageCreator, setShowPageCreator] = useState(false);
  const [zeroPortfolioPrimaryPageId, setZeroPortfolioPrimaryPageId] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Default to light mode on mount
  useEffect(() => {
    setTheme('light');
  }, []);

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsRefreshing(false);
    setShowPageCreator(false);
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Page Header */}
        <div className="mb-8 p-6 bg-slate-100 dark:bg-slate-800 border-2 border-black dark:border-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--ink)] font-display mb-2">
                Asset Creation UI Components
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Visual test for Meta asset creation components. These components follow the Acid Brutalism design system.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Section 1: Ad Account Empty State */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-[var(--ink)] font-display mb-4 pb-2 border-b-2 border-black dark:border-white">
            1. Ad Account Empty State
          </h2>

          <div className="py-8 text-center px-6 border-2 border-black dark:border-white">
            {/* Empty state icon - Brutalist Square */}
            <div className="w-20 h-20 border-2 border-black dark:border-white bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl" role="img" aria-label="Empty">
                📭
              </span>
            </div>

            {/* Message */}
            <h3 className="text-lg font-bold text-[var(--ink)] mb-2 font-display">No Ad Accounts Found</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 max-w-sm mx-auto">
              You don't have any ad accounts in this Business Manager yet. Create one to get started.
            </p>

            {/* Create button */}
            <button
              onClick={() => setShowAdAccountCreator(true)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-coral text-white border-2 border-black dark:border-white rounded-[0.75rem] font-bold uppercase tracking-wide shadow-brutalist hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all min-h-[48px]"
            >
              <Plus className="w-5 h-5" />
              Create Ad Account
            </button>
          </div>
        </section>

        {/* Section 2: MetaAssetCreator Form */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-[var(--ink)] font-display mb-4 pb-2 border-b-2 border-black dark:border-white">
            2. MetaAssetCreator Form
          </h2>

          {showAdAccountCreator ? (
            <div className="border-2 border-[var(--coral)] bg-[var(--coral)]/5 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-[var(--ink)]">Create New Ad Account</h4>
                <button
                  onClick={() => setShowAdAccountCreator(false)}
                  className="text-sm text-slate-500 hover:text-[var(--coral)] underline"
                >
                  Cancel
                </button>
              </div>
              <MetaAssetCreator
                connectionId="test-connection-id"
                businessId="test-business-id"
                accessRequestToken="test-token"
                onSuccess={(account) => {
                  console.log('Account created:', account);
                  setShowAdAccountCreator(false);
                }}
                onError={(error) => {
                  console.error('Error:', error);
                }}
              />
            </div>
          ) : (
            <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Click "Create Ad Account" in Section 1 to see the form
              </p>
              <Button
                variant="brutalist"
                onClick={() => setShowAdAccountCreator(true)}
              >
                Show Form
              </Button>
            </div>
          )}
        </section>

        {/* Section 3: Page Empty State */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-[var(--ink)] font-display mb-4 pb-2 border-b-2 border-black dark:border-white">
            3. Page Empty State
          </h2>

          <div className="py-8 text-center px-6 border-2 border-black dark:border-white">
            {/* Empty state icon - Brutalist Square */}
            <div className="w-20 h-20 border-2 border-black dark:border-white bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl" role="img" aria-label="Empty">
                📄
              </span>
            </div>

            {/* Message */}
            <h3 className="text-lg font-bold text-[var(--ink)] mb-2 font-display">No Pages Found</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 max-w-sm mx-auto">
              You don't have any Facebook Pages in this Business Manager. Create one to get started.
            </p>

            {/* Create button */}
            <button
              onClick={() => setShowPageCreator(true)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-coral text-white border-2 border-black dark:border-white rounded-[0.75rem] font-bold uppercase tracking-wide shadow-brutalist hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all min-h-[48px]"
            >
              <Plus className="w-5 h-5" />
              Create Page
            </button>
          </div>
        </section>

        {/* Section 4: GuidedRedirectCard */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-[var(--ink)] font-display mb-4 pb-2 border-b-2 border-black dark:border-white">
            4. GuidedRedirectCard (Create Page Modal)
          </h2>

          {showPageCreator ? (
            <GuidedRedirectCard
              title="Create a Facebook Page"
              description="Pages must be created in Meta Business Manager. Follow these steps:"
              businessManagerUrl="https://business.facebook.com/settings/test-business-id/pages"
              instructions={[
                { title: 'Click the button below to open Meta Business Manager', description: 'A new tab will open' },
                { title: 'Click "Add a Page" or "Create a New Page"', description: 'Choose to create a new page or add an existing one' },
                { title: 'Follow the prompts to set up your page', description: 'Add name, category, and description' },
                { title: 'Return here and click "Refresh List"', description: 'Your new page will appear in the list' },
              ]}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
            />
          ) : (
            <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Click "Create Page" in Section 3 to see the guided redirect card
              </p>
              <Button
                variant="brutalist"
                onClick={() => setShowPageCreator(true)}
              >
                Show Guided Card
              </Button>
            </div>
          )}
        </section>

        {/* Section 5: Zero-portfolio Page discovery (pages_show_list) */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-[var(--ink)] font-display mb-4 pb-2 border-b-2 border-black dark:border-white">
            5. Zero-portfolio Page discovery + BM create unlock
          </h2>

          <div className="border-2 border-black dark:border-white bg-slate-50 dark:bg-slate-900 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-[var(--ink)] font-display">
                No Business Portfolio found
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Fixture for App Review: managed Pages listed with name and ID; primary Page
                selection unlocks Business Portfolio creation.
              </p>
            </div>

            <ZeroPortfolioPageDiscovery
              pages={[
                { id: '112233445566778', name: 'Acme Main', category: 'Retail' },
                { id: '998877665544332', name: 'Acme Deals', category: 'Shopping' },
              ]}
              loading={false}
              error={null}
              primaryPageId={zeroPortfolioPrimaryPageId}
              onPrimaryPageChange={setZeroPortfolioPrimaryPageId}
              businessCreator={
                zeroPortfolioPrimaryPageId ? (
                  <MetaBusinessCreator
                    connectionId="test-connection-id"
                    accessRequestToken="test-token"
                    userPages={[
                      { id: '112233445566778', name: 'Acme Main', category: 'Retail' },
                      { id: '998877665544332', name: 'Acme Deals', category: 'Shopping' },
                    ]}
                    fixedPrimaryPageId={zeroPortfolioPrimaryPageId}
                    onSuccess={(business) => console.log('Business created:', business)}
                    onError={(error) => console.error('Error:', error)}
                  />
                ) : null
              }
            />

            <div className="pt-8 border-t-2 border-dashed border-black dark:border-white">
              <p className="text-xs font-mono text-slate-500 mb-4">
                Visual QA fixture — primary Page already selected (BM create unlocked)
              </p>
              <ZeroPortfolioPageDiscovery
                pages={[
                  { id: '112233445566778', name: 'Acme Main', category: 'Retail' },
                ]}
                loading={false}
                error={null}
                primaryPageId="112233445566778"
                onPrimaryPageChange={() => {}}
                businessCreator={
                  <MetaBusinessCreator
                    connectionId="test-connection-id"
                    accessRequestToken="test-token"
                    userPages={[{ id: '112233445566778', name: 'Acme Main', category: 'Retail' }]}
                    fixedPrimaryPageId="112233445566778"
                    onSuccess={(business) => console.log('Business created:', business)}
                    onError={(error) => console.error('Error:', error)}
                  />
                }
              />
            </div>
          </div>
        </section>

        {/* Section 6: MetaBusinessSetupChecklist (unverified portfolio) */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-[var(--ink)] font-display mb-4 pb-2 border-b-2 border-black dark:border-white">
            6. MetaBusinessSetupChecklist (Unverified Portfolio)
          </h2>

          <MetaBusinessSetupChecklist accessRequestToken="test-token" businessId="test-business-id" />
        </section>

        {/* Section 7: Button Variants Used */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-[var(--ink)] font-display mb-4 pb-2 border-b-2 border-black dark:border-white">
            7. Button Variants Used in Components
          </h2>

          <div className="space-y-6">
            {/* Brutalist */}
            <div>
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">
                brutalist
              </h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="brutalist" size="lg">
                  Create Ad Account
                </Button>
                <Button variant="brutalist" size="lg" isLoading>
                  Creating...
                </Button>
                <Button variant="brutalist" size="lg" disabled>
                  Disabled
                </Button>
              </div>
            </div>

            {/* Secondary */}
            <div>
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">
                secondary
              </h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="secondary" size="md">
                  Create Another
                </Button>
                <Button variant="secondary" size="md" isLoading>
                  Loading...
                </Button>
                <Button variant="secondary" size="md" disabled>
                  Disabled
                </Button>
              </div>
            </div>

            {/* Loading States */}
            <div>
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">
                Loading States
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[var(--warning)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading Business Manager ID...
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 8: Design System Checklist */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-[var(--ink)] font-display mb-4 pb-2 border-b-2 border-black dark:border-white">
            6. Design System Checklist
          </h2>

          <div className="border-2 border-black dark:border-white p-6 bg-[var(--paper)] dark:bg-slate-800">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-[var(--teal)] font-bold">[x]</span>
                <span>Hard borders: <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">border-2 border-black dark:border-white</code></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--teal)] font-bold">[x]</span>
                <span>Brutalist shadows: <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">shadow-brutalist</code></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--teal)] font-bold">[x]</span>
                <span>Brand colors: <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">var(--coral)</code> for primary, <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">var(--teal)</code> for success</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--teal)] font-bold">[x]</span>
                <span>Typography: <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">font-display</code> for headings, <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">font-sans</code> for body</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--teal)] font-bold">[x]</span>
                <span>Touch targets: <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">min-h-[48px]</code> for buttons</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--teal)] font-bold">[x]</span>
                <span>Dark mode: All components use <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">dark:</code> variants</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--teal)] font-bold">[x]</span>
                <span>Focus states: <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">focus:ring-2 focus:ring-[var(--coral)]</code></span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
