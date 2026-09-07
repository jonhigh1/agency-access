/**
 * Final Success Screen (Screen 5)
 *
 * Step 6 of the unified onboarding flow.
 * Purpose: Confirm setup progress while keeping activation state pending on the client.
 */

'use client';

import { motion } from 'framer-motion';
import { Clock, ArrowRight } from 'lucide-react';
import { staggerContainer, staggerItem } from '@/lib/animations';

interface FinalSuccessScreenProps {
  agencyName: string;
  clientName: string;
  accessRequestId: string;
  teamInvitesSent: number;
  onComplete: () => void;
}

export function FinalSuccessScreen({
  agencyName,
  clientName,
  accessRequestId,
  teamInvitesSent,
  onComplete,
}: FinalSuccessScreenProps) {
  return (
    <motion.div
      className="p-6 md:p-10"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="text-center mb-8" variants={staggerItem}>
        <div className="inline-flex items-center justify-center w-20 h-20 bg-coral/10 border-2 border-coral/30 rounded-full mb-6">
          <Clock className="w-10 h-10 text-danger-ink" strokeWidth={2} />
        </div>

        <h2 className="text-4xl font-bold text-ink mb-2 font-display">
          Pending — waiting on {clientName}
        </h2>
        <p className="text-xl text-muted-foreground">
          {agencyName} is set up. Connected when they finish Google.
        </p>
      </motion.div>

      <motion.div className="max-w-2xl mx-auto mb-8" variants={staggerItem}>
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
      </motion.div>

      {accessRequestId && (
        <motion.div className="max-w-2xl mx-auto mb-8 text-center" variants={staggerItem}>
          <p className="text-sm text-muted-foreground">
            Track pending status and send reminders from the dashboard while you wait.
          </p>
        </motion.div>
      )}

      <motion.div className="text-center" variants={staggerItem}>
        <motion.button
          onClick={onComplete}
          className="inline-flex items-center gap-2 px-6 py-3 bg-card hover:bg-muted/10 text-ink font-semibold rounded-lg border-2 border-black transition-all"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4" />
        </motion.button>

        <p className="mt-4 text-sm text-muted-foreground">
          Your access request stays pending until {clientName} authorizes
        </p>
      </motion.div>
    </motion.div>
  );
}
