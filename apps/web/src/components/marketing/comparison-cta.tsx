'use client';

import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface ComparisonCTAProps {
  variant?: 'brutalist' | 'secondary';
  size?: 'xl';
  children: React.ReactNode;
}

/**
 * ComparisonCTA - Clerk sign-up button with Growth tier pre-selection
 *
 * Used on comparison pages to initiate the Clerk auth modal flow
 * and pre-select the Growth tier for the user.
 */
export function ComparisonCTA({
  variant = 'brutalist',
  size = 'xl',
  children,
}: ComparisonCTAProps) {
  // Store selected tier and billing interval when user clicks CTA
  // Growth maps to STARTER backend tier (per pricing-tier-card.tsx)
  const handleTierSelect = () => {
    localStorage.setItem('selectedSubscriptionTier', 'STARTER');
    localStorage.setItem('selectedBillingInterval', 'monthly');
  };

  return (
    <SignUpButton mode="modal">
      <Button
        variant={variant}
        size={size}
        onClick={handleTierSelect}
        rightIcon={<ArrowRight className="h-5 w-5" />}
      >
        {children}
      </Button>
    </SignUpButton>
  );
}
