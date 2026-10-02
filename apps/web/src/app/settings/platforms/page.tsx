'use client';

/**
 * Settings Platforms Page
 *
 * This page has been moved to /connections.
 * This component now redirects to the new location.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPlatformsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new connections page
    router.replace('/connections');
  }, [router]);

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-coral border-r-transparent"></div>
        <p className="mt-4 text-sm text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
