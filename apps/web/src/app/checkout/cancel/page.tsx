'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';
import { m } from 'framer-motion';

function CheckoutCancelContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const agencyId = searchParams.get('agency');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <m.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="max-w-md w-full bg-card rounded-none border border-border p-8 text-center"
      >
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 bg-warning/10 rounded-full flex items-center justify-center">
            <XCircle className="h-10 w-10 text-warning" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-ink mb-2">
          Payment cancelled
        </h1>
        <p className="text-muted-foreground mb-6">
          Your account has been created, but the payment was cancelled. You can complete
          your subscription later from Settings.
        </p>

        <div className="bg-warning/10 border border-warning/30 rounded-none p-4 mb-8">
          <p className="text-sm text-warning">
            <strong>Don't worry!</strong> Your account is ready to use. You can activate your
            subscription anytime from the Settings page.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full"
            onClick={() => router.push('/settings?tab=billing')}
          >
            Complete Subscription
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

export default function CheckoutCancelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <CheckoutCancelContent />
    </Suspense>
  );
}
