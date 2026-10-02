'use client';

/**
 * ClientTabs Component
 *
 * Tab navigation for client detail page.
 * Switches between Overview and Activity tabs.
 */

import { useRef, useState, type KeyboardEvent } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
  ClientAccessRequest,
  ClientActivityItem,
  ClientDetailPlatformGroup,
  Platform,
} from '@agency-platform/shared';
import { OverviewTab } from './OverviewTab';
import { ActivityTab } from './ActivityTab';
import { GoogleOffboardingPanel } from './GoogleOffboardingPanel';

interface GoogleConnectionInfo {
  connectionId: string;
  label: string;
}

interface ClientTabsProps {
  platformGroups: ClientDetailPlatformGroup[];
  accessRequests: ClientAccessRequest[];
  activity: ClientActivityItem[];
  initialExpandedPlatformGroup?: Platform;
  clientId: string;
  googleConnection?: GoogleConnectionInfo;
}

type TabValue = 'overview' | 'offboarding' | 'activity';

export function ClientTabs({
  platformGroups,
  accessRequests,
  activity,
  initialExpandedPlatformGroup,
  clientId,
  googleConnection,
}: ClientTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const tabValues: TabValue[] = googleConnection
    ? ['overview', 'activity', 'offboarding']
    : ['overview', 'activity'];
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' ? index + 1
      : event.key === 'ArrowLeft' ? index - 1
        : event.key === 'Home' ? 0
          : event.key === 'End' ? tabValues.length - 1
            : null;
    if (next === null) return;
    event.preventDefault();
    tabRefs.current[(next + tabValues.length) % tabValues.length]?.focus();
  };

  return (
    <Card className="border-black/10 shadow-sm">
      {/* Tab Navigation */}
      <div className="border-b border-border px-3 sm:px-6">
        <nav className="flex flex-wrap gap-4 sm:gap-8" role="tablist" aria-label="Client detail tabs">
          {tabValues.map((tab, index) => (
            <button
              key={tab}
              ref={(element) => { tabRefs.current[index] = element; }}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              type="button"
              role="tab"
              id={`client-tab-${tab}`}
              aria-selected={activeTab === tab}
              aria-controls={`client-tabpanel-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              className={cn(
                'min-h-[44px] border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              {tab === 'overview' ? 'Overview' : tab === 'activity' ? 'Activity' : 'Offboarding'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div
        className="p-3 sm:p-6"
        role="tabpanel"
        id={
          activeTab === 'overview'
            ? 'client-tabpanel-overview'
            : activeTab === 'offboarding'
              ? 'client-tabpanel-offboarding'
              : 'client-tabpanel-activity'
        }
        aria-labelledby={
          activeTab === 'overview'
            ? 'client-tab-overview'
            : activeTab === 'offboarding'
              ? 'client-tab-offboarding'
              : 'client-tab-activity'
        }
      >
        {activeTab === 'overview' && (
          <OverviewTab
            platformGroups={platformGroups}
            accessRequests={accessRequests}
            initialExpandedPlatformGroup={initialExpandedPlatformGroup}
          />
        )}
        {activeTab === 'offboarding' && googleConnection && (
          <GoogleOffboardingPanel
            agencyId={clientId}
            connectionId={googleConnection.connectionId}
            connectionLabel={googleConnection.label}
          />
        )}
        {activeTab === 'activity' && (
          <ActivityTab activity={activity} />
        )}
      </div>
    </Card>
  );
}
