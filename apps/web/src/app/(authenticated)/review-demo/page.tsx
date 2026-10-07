'use client';

import { notFound } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
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

  if (!hasLabReviewAccessForClerkUser(user)) {
    notFound();
  }

  return <ReviewDemoScreen />;
}
