/**
 * Success Link Screen — wizard Success step (post first_access_link_generated).
 *
 * Pending activation framing, copy-primary CTA, static client preview, and
 * connected-state example. No celebration / completion copy.
 */

'use client';

import { Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeVariants, fadeTransition } from '@/lib/animations';
import { formatOnboardingStepLabel } from '@/lib/onboarding-steps';
import { trackInviteLinkCopied, trackInviteSent } from '@/lib/analytics/invite-events';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Button } from '@/components/ui';
import { WizardClientInvitePreview } from '../wizard-client-invite-preview';
import { WizardConnectedExample } from '../wizard-connected-example';

interface SuccessLinkScreenProps {
  accessLink: string;
  agencyName?: string;
  accessRequestId?: string;
}

function extractAccessToken(accessLink: string): string {
  const segments = accessLink.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

export function SuccessLinkScreen({
  accessLink,
  agencyName,
  accessRequestId,
}: SuccessLinkScreenProps) {
  const { copied, copy } = useCopyToClipboard();
  const accessRequestToken = extractAccessToken(accessLink);

  const trackProps = {
    access_request_id: accessRequestId ?? '',
    access_request_token: accessRequestToken,
    status: 'pending' as const,
    surface: 'onboarding' as const,
  };

  const handleCopyLink = async () => {
    if (!accessRequestId || !accessRequestToken) return;
    trackInviteLinkCopied(trackProps);
    trackInviteSent({ ...trackProps, channel: 'copy' });
    await copy(accessLink);
  };

  return (
    <motion.div
      className="p-6 md:p-8"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={fadeTransition}
    >
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {formatOnboardingStepLabel(4)}
          </p>
          <h2 className="text-3xl font-bold text-ink font-display">Waiting on your client</h2>
          <p className="text-base text-muted-foreground">
            Your access link is ready. Share it — you&apos;re done when they connect Google.
          </p>
        </header>

        <Button
          className="w-full sm:w-auto"
          onClick={handleCopyLink}
          leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        >
          {copied ? 'Copied' : 'Copy Link'}
        </Button>

        <div className="grid gap-5 lg:grid-cols-2">
          <WizardClientInvitePreview agencyName={agencyName} accessLink={accessLink} />
          <WizardConnectedExample />
        </div>
      </div>
    </motion.div>
  );
}
