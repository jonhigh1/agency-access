'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

/**
 * Landing route for custom OAuth SSO redirects (sign-up/sign-in via
 * authenticateWithRedirect). Kept public in src/proxy.ts.
 */
export default function SSOCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}
