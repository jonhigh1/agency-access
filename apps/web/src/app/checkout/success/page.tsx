'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock3 } from 'lucide-react';
import { m } from 'framer-motion';
import { useSubscription } from '@/lib/query/billing';
import { SUBSCRIPTION_TIER_NAMES } from '@agency-platform/shared';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: subscription, isLoading, isFetching, isError } = useSubscription();
  const isConfirmed = !isLoading && !isFetching && !isError && (subscription?.status === 'active' || subscription?.status === 'trialing');
  const isProcessing = isLoading || isFetching || (!isError && !isConfirmed);
  const confirmedTierName = subscription?.tier ? SUBSCRIPTION_TIER_NAMES[subscription.tier] : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <m.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="max-w-md w-full bg-card rounded-none border border-border p-8 text-center"
      >
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 bg-teal/10 rounded-full flex items-center justify-center">
            {isConfirmed ? <CheckCircle className="h-10 w-10 text-success-ink" /> : <Clock3 className="h-10 w-10 text-warning" />}
          </div>
        </div>

        <h1 className="text-3xl font-bold text-ink mb-2">
          {isConfirmed ? 'Subscription confirmed' : isError ? 'Subscription not confirmed' : 'Payment processing'}
        </h1>
        <p className="text-muted-foreground mb-6">
          {isConfirmed
            ? `Your ${confirmedTierName} subscription is active.`
            : isProcessing
              ? 'We are waiting for the subscription record to update. This page will not show activation until it is confirmed.'
              : 'We could not verify the subscription. Check billing details or try again later.'}
        </p>

        <div className="bg-muted/30 border border-border rounded-none p-4 mb-8">
          <p className="text-sm text-muted-foreground">
            {isConfirmed
              ? 'You can now invite team members and create access requests.'
              : 'You can open billing settings to review the current subscription status.'}
          </p>
        </div>

        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full"
            onClick={() => router.push(isConfirmed ? '/connections' : '/settings?tab=billing')}
          >
            {isConfirmed ? 'Go to Connections' : 'Review billing'}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="w-full"
            onClick={() => router.push('/dashboard')}
          >
            Go to Dashboard
          </Button>
        </div>
      </m.div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
