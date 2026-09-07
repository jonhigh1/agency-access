/**
 * Success Link Screen (Screen 3)
 *
 * Step 4 of the unified onboarding flow.
 * Purpose: Deliver the access link and set pending expectations — client still needs to authorize.
 */

'use client';

import { Platform } from '@agency-platform/shared';
import { SuccessLinkCard } from '../success-link-card';
import { fadeVariants, fadeTransition } from '@/lib/animations';
import { formatOnboardingStepLabel } from '@/lib/onboarding-steps';
import {
  buildInviteSentMailto,
  trackInviteLinkCopied,
  trackInviteSent,
} from '@/lib/analytics/invite-events';
import { motion } from 'framer-motion';

interface SuccessLinkScreenProps {
  accessLink: string;
  clientName: string;
  clientEmail?: string;
  accessRequestId?: string;
  selectedPlatforms: Platform[];
}

function extractAccessToken(accessLink: string): string {
  const segments = accessLink.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

export function SuccessLinkScreen({
  accessLink,
  clientName,
  clientEmail,
  accessRequestId,
  selectedPlatforms,
}: SuccessLinkScreenProps) {
  const accessRequestToken = extractAccessToken(accessLink);

  const trackProps = {
    access_request_id: accessRequestId ?? '',
    access_request_token: accessRequestToken,
    status: 'pending' as const,
    surface: 'onboarding' as const,
  };

  const handleCopy = () => {
    if (!accessRequestId || !accessRequestToken) return;
    trackInviteLinkCopied(trackProps);
    trackInviteSent({ ...trackProps, channel: 'copy' });
  };

  const handleEmail = () => {
    if (!accessRequestId || !accessRequestToken) return;
    trackInviteSent({ ...trackProps, channel: 'email' });

    if (clientEmail) {
      window.location.assign(
        buildInviteSentMailto({
          clientEmail,
          clientName,
          authorizationUrl: accessLink,
        })
      );
    }
  };

  return (
    <motion.div
      className="p-6 md:p-10"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={fadeTransition}
    >
      <div className="mb-8 text-center">
        <div className="text-sm font-semibold text-muted-foreground mb-2">
          {formatOnboardingStepLabel(4)}
        </div>
        <h2 className="text-3xl font-bold text-ink mb-2 font-display">
          Pending — waiting on {clientName}
        </h2>
        <p className="text-muted-foreground">
          Link is ready. Connected when they finish Google.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <SuccessLinkCard
          link={accessLink}
          clientName={clientName}
          platformCount={selectedPlatforms.length}
          onCopy={handleCopy}
          onEmail={handleEmail}
        />
      </div>

      <div className="mt-8 max-w-4xl mx-auto">
        <div className="rounded-lg border-2 border-black bg-paper p-6">
          <h3 className="font-semibold text-ink mb-3 font-display">What happens next</h3>
          <div className="space-y-2 text-sm text-foreground">
            <p>Copy the link or email it to {clientName}.</p>
            <p>They authorize Google when ready — usually under two minutes.</p>
            <p>OAuth tokens appear in the dashboard only after they finish.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
