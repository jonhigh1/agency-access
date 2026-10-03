'use client';

import { ManualInviteFlow } from '@/components/flow/manual-invite-flow';
import { zapierManualConfig } from '../../manual-invite.config';

export default function ZapierManualPage() {
  return <ManualInviteFlow config={zapierManualConfig} />;
}
