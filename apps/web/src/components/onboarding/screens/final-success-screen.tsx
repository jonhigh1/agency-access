/**
 * Final Success Screen (Screen 5)
 *
 * Step 6 of the unified onboarding flow.
 * Purpose: Confirm setup progress while keeping activation state pending on the client.
 */

'use client';

import { m } from 'framer-motion';
import { Clock, ArrowRight, LoaderCircle } from 'lucide-react';
import { staggerContainer, staggerItem } from '@/lib/animations';

interface FinalSuccessScreenProps {
  agencyName: string;
  clientName: string;
  accessRequestId: string;
  teamInvitesSent: number;
  platforms?: string[];
  loading?: boolean;
  onComplete: () => void;
}

export function FinalSuccessScreen({
  agencyName,
  clientName,
  accessRequestId,
  teamInvitesSent,
  platforms = [],
  loading = false,
  onComplete,
}: FinalSuccessScreenProps) {
  const requestedPlatforms = platforms.length === 1
    ? platforms[0].replaceAll('_', ' ')
    : 'the requested platforms';
  return (
    <m.div
      className="p-6 md:p-10"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <m.div className="text-center mb-8" variants={staggerItem}>
        <div className="inline-flex items-center justify-center w-20 h-20 bg-coral/10 border-2 border-coral/30 rounded-full mb-6">
          <Clock className="w-10 h-10 text-danger-ink" strokeWidth={2} />
        </div>

        <h2 className="text-4xl font-bold text-ink mb-2 font-display">
          Pending — waiting on {clientName}
        </h2>
        <p className="text-xl text-muted-foreground">
          {agencyName} is set up. Your client still needs to authorize {requestedPlatforms}.
        </p>
      </m.div>

      <m.div className="max-w-2xl mx-auto mb-8" variants={staggerItem}>
        <div className="rounded-lg border-2 border-black bg-paper p-6">
          <p className="label-micro text-muted-foreground mb-2">Activation status</p>
          <p className="text-lg font-semibold text-ink mb-2">Link ready — client authorization pending</p>
          <p className="text-sm text-muted-foreground">
            Send or resend the link anytime from the dashboard. Tokens are stored only after{' '}
            {clientName} completes authorization.
          </p>
          {teamInvitesSent > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {teamInvitesSent} team invite{teamInvitesSent > 1 ? 's' : ''} sent — they can help follow up.
            </p>
          )}
        </div>
      </m.div>

      {accessRequestId && (
        <m.div className="max-w-2xl mx-auto mb-8 text-center" variants={staggerItem}>
          <p className="text-sm text-muted-foreground">
            Track pending status and send reminders from the dashboard while you wait.
          </p>
        </m.div>
      )}

      <m.div className="text-center" variants={staggerItem}>
        <m.button
          type="button"
          onClick={onComplete}
          disabled={loading}
          aria-busy={loading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-card hover:bg-muted/10 text-ink font-semibold rounded-lg border-2 border-black transition-all"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {loading ? 'Completing setup…' : 'Go to Dashboard'}
          {loading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        </m.button>

        <p className="mt-4 text-sm text-muted-foreground">
          Your access request stays pending until {clientName} authorizes
        </p>
      </m.div>
    </m.div>
  );
}
