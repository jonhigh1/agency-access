import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppProviders } from '../app-providers';

/**
 * KTD13: every invite route is reached through a logged-out bearer link, so
 * the token rides in the URL path — and the oauth-callback sibling carries
 * OAuth code and state query parameters. The restrictive referrer policy
 * lives on this shared layout so every route under /invite (the main flow
 * page, the nested manual-invite pages, and oauth-callback) inherits it and
 * no route can opt out by being forgotten. Analytics-side scrubbing lives in
 * instrumentation-client.ts (PostHog sanitize_properties) and
 * sentry.client.config.ts (beforeSend).
 *
 * AppProviders supplies the React Query client. The invite page uses
 * useUserAgency (React Query) for preview analytics; without the provider
 * the route throws "No QueryClient set" during SSR (broken 2026-10-07 by
 * #155, which added the hook after the Mar 2026 provider split removed the
 * root-level QueryClientProvider from this route).
 */
export const metadata: Metadata = {
  referrer: 'no-referrer',
};

export default function InviteLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
