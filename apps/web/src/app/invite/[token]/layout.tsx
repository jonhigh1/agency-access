import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * KTD13: every invite route is reached through a logged-out bearer link, so
 * the token rides in the URL path. The restrictive referrer policy applies to
 * the main flow page and the nested manual-invite pages (beehiiv, kit,
 * klaviyo, mailchimp, pinterest, shopify) through layout inheritance. The
 * page.tsx export restates it for that route; analytics-side token scrubbing
 * lives in instrumentation-client.ts (PostHog sanitize_properties).
 */
export const metadata: Metadata = {
  referrer: 'no-referrer',
};

export default function InviteTokenLayout({ children }: { children: ReactNode }) {
  return children;
}
