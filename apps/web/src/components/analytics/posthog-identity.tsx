'use client';

import { useAuth } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { setPosthogUserIdentity } from '@/lib/analytics/posthog-identity';

/** Clerk IDs only: never identify recipients as the agency sharing the link. */
export function PosthogIdentity() {
  const { isLoaded, userId } = useAuth();
  const pathname = usePathname();
  useEffect(() => {
    if (!isLoaded) return;
    const isRecipient = pathname === '/invite' || pathname?.startsWith('/invite/');
    setPosthogUserIdentity(userId ?? null, Boolean(isRecipient));
  }, [isLoaded, userId, pathname]);
  return null;
}
