'use client';

import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { META_AD_ACCOUNT_INSTRUCTIONS } from '@/lib/content/meta-ad-account-instructions';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import {
  ClientGrantCtaRow,
  ClientGrantPrimaryButton,
  ClientGrantSecondaryButton,
} from '@/components/client-auth/client-grant-button';

interface ReviewDemoManualAdAccountPanelProps {
  agencyBusinessId: string;
  agencyBusinessName?: string;
  adAccountId: string;
  adAccountName?: string;
  verified: boolean;
  permittedTasks: string[];
  pendingMessage?: string;
  metaErrorCode?: number;
  metaErrorMessage?: string;
  checking: boolean;
  onCheckAccess: () => void;
}

export function ReviewDemoManualAdAccountPanel({
  agencyBusinessId,
  agencyBusinessName,
  adAccountId,
  adAccountName,
  verified,
  permittedTasks,
  pendingMessage,
  metaErrorCode,
  metaErrorMessage,
  checking,
  onCheckAccess,
}: ReviewDemoManualAdAccountPanelProps) {
  const content = META_AD_ACCOUNT_INSTRUCTIONS.en;
  const { copied, copy } = useCopyToClipboard();
  const agencyLabel = agencyBusinessName ?? 'the agency';

  return (
    <div className="space-y-5" data-testid="review-demo-manual-ad-checklist">
      <div>
        <h2 className="font-display text-xl font-bold">{content.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{content.description}</p>
        <p className="mt-2 text-sm text-foreground">
          {content.intro.replace('{agency}', agencyLabel).replace('{count}', '1')}
        </p>
        <p className="text-sm text-muted-foreground">{content.scopeNote.replace('{agency}', agencyLabel)}</p>
      </div>

      <div className="border border-black/15 p-4 text-sm" data-testid="review-demo-ad-account-summary">
        <p className="label-micro mb-1">Review sandbox ad account</p>
        <p className="font-semibold">{adAccountName ?? adAccountId}</p>
        <p className="font-mono text-xs text-muted-foreground">{adAccountId}</p>
      </div>

      <div className="border border-black/15 p-4">
        <p className="label-micro">{content.copyCard.label}</p>
        {agencyBusinessName ? (
          <p className="mt-1 text-sm text-muted-foreground">{agencyBusinessName}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span
            className="break-all font-mono text-sm font-bold"
            data-testid="review-demo-agency-bm-id"
          >
            {agencyBusinessId}
          </span>
          <ClientGrantSecondaryButton type="button" onClick={() => void copy(agencyBusinessId)}>
            {copied ? <Check className="h-4 w-4 text-success-ink" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copied ? content.copyCard.copied : content.copyCard.copyButton}
          </ClientGrantSecondaryButton>
        </div>
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>{content.step2.substeps[0]}</li>
        <li>{content.step2.substeps[1]}</li>
        <li>{content.step2.substeps[2]}</li>
        <li>{content.step2.substeps[3]}</li>
        <li>{content.step2.substeps[4]}</li>
      </ol>

      <p className="text-sm text-muted-foreground">{content.revocationNote}</p>

      <div className="border border-black/15 p-4 text-sm" data-testid="review-demo-partner-proof">
        <p className="label-micro mb-2">Check access readback (Graph GET only)</p>
        {metaErrorCode !== undefined && metaErrorMessage ? (
          <p className="font-semibold text-[rgb(var(--coral))]" role="alert">
            Meta Graph error #{metaErrorCode}: {metaErrorMessage}
          </p>
        ) : null}
        {!metaErrorCode && verified ? (
          <p className="font-semibold" data-testid="review-demo-partner-status">
            Partner access verified — tasks: {permittedTasks.join(', ') || 'none reported'}
          </p>
        ) : null}
        {!metaErrorCode && !verified && pendingMessage ? (
          <p className="text-muted-foreground">{pendingMessage}</p>
        ) : null}
        {!metaErrorCode && !verified && !pendingMessage ? (
          <p className="text-muted-foreground">
            Complete the manual partner share in Meta, then click Check access.
          </p>
        ) : null}
      </div>

      <ClientGrantCtaRow className="border-t border-black/10 pt-4">
        <ClientGrantPrimaryButton
          type="button"
          data-testid="review-demo-check-ad-access"
          onClick={onCheckAccess}
          disabled={checking || verified}
        >
          {checking ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              {content.verifying}
            </>
          ) : (
            content.checkAccess
          )}
        </ClientGrantPrimaryButton>
        <ClientGrantSecondaryButton asChild>
          <a href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {content.openBusinessManager}
          </a>
        </ClientGrantSecondaryButton>
      </ClientGrantCtaRow>
    </div>
  );
}
