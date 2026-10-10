'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { useEffect, useMemo, useState } from 'react';
import { trackAffiliateEvent } from '@/lib/analytics/affiliate';
import { PosthogIdentity } from '@/components/analytics/posthog-identity';
import {
  clearPendingAffiliateClickFromDocument,
  getAffiliateClickTokenFromDocument,
  hasPendingAffiliateClickFromDocument,
} from '@/lib/affiliate-cookie';

export function RootProviders({ children }: { children: React.ReactNode }) {
  const [selectedPlanName, setSelectedPlanName] = useState('Growth');

  useEffect(() => {
    if (!hasPendingAffiliateClickFromDocument()) {
      return;
    }

    const hasClickToken = Boolean(getAffiliateClickTokenFromDocument());
    clearPendingAffiliateClickFromDocument();

    if (!hasClickToken) {
      return;
    }

    trackAffiliateEvent('affiliate_referral_clicked', {
      source: 'first_party_redirect',
    });
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.displayName) {
        setSelectedPlanName(detail.displayName);
      }
    };

    window.addEventListener('tierSelected', handler);
    return () => window.removeEventListener('tierSelected', handler);
  }, []);

  const localization = useMemo(
    () => ({
      signUp: {
        start: {
          subtitle: `You're starting a 14-day free trial of the ${selectedPlanName} plan.`,
        },
      },
    }),
    [selectedPlanName]
  );

  const getAfterSignUpUrl = () => {
    if (typeof window !== 'undefined') {
      const storedTier = localStorage.getItem('selectedSubscriptionTier');
      if (storedTier && storedTier !== 'STARTER') {
        return `/onboarding/unified?tier=${storedTier}`;
      }
    }

    return '/onboarding/unified';
  };

  return (
    <ClerkProvider
      appearance={{
        cssLayerName: 'clerk',
        elements: {
          formButtonPrimary: 'clerk-form-button-primary',
          socialButtonsBlockButton: 'clerk-social-button',
          socialButtonsBlockButtonText: 'clerk-social-button-text',
          formFieldInput: 'clerk-input',
          modalCloseButton: 'clerk-modal-close-button',
          dividerRow: 'clerk-divider-row',
          dividerLine: 'clerk-divider-line',
          dividerText: 'clerk-divider-text',
          headerSubtitle: 'clerk-header-subtitle',
          formFieldRow__firstName: { display: 'none' },
          formFieldRow__lastName: { display: 'none' },
          formField__firstName: { display: 'none' },
          formField__lastName: { display: 'none' },
        },
      }}
      localization={localization}
      afterSignUpUrl={getAfterSignUpUrl()}
      afterSignInUrl="/dashboard"
    >
      <PosthogIdentity />
      {children}
    </ClerkProvider>
  );
}
