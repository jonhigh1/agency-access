'use client';

import { notFound } from 'next/navigation';
import { SignIn, useUser } from '@clerk/nextjs';
import { ReviewDemoScreen } from '@/components/review-demo/ReviewDemoScreen';
import { hasLabReviewAccessForClerkUser, isReviewDemoRouteEnabled } from '@/lib/lab-review-access';

export default function ReviewDemoPage() {
  const { user, isLoaded } = useUser();

  if (!isReviewDemoRouteEnabled()) {
    notFound();
  }

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-[var(--paper)] p-8">
        <p role="status" className="text-sm text-muted-foreground">
          Loading review demo…
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--paper)] p-8">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="font-display text-2xl font-semibold text-foreground">Meta App Review Lab</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your lab reviewer account to continue the guided demo.
          </p>
          <SignIn routing="hash" forceRedirectUrl="/review-demo" signUpUrl="/sign-up" />
        </div>
      </main>
    );
  }

  if (!hasLabReviewAccessForClerkUser(user)) {
    notFound();
  }

  return <ReviewDemoScreen />;
}
