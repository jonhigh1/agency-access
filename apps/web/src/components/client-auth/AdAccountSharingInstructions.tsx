'use client';

/**
 * AdAccountSharingInstructions - Manual Meta partner-grant journey (U9).
 *
 * The numbered steps render as a stateful checklist: one checkbox per row,
 * persisted in sessionStorage keyed by (request token + agency business id),
 * so a returning client picks up where they stopped. The agency business ID
 * gets a one-tap copy card with an accessible confirmation, and a single
 * revocation-reassurance line sits near the steps.
 *
 * Verify contract: unchanged — both the start and verify POSTs and the
 * server-truth rendering behave exactly as before (see tests).
 */

import { useEffect, useState } from 'react';
import {
  ExternalLink,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Check,
  Copy,
  ShieldCheck,
} from 'lucide-react';
import { META_AD_ACCOUNT_INSTRUCTIONS } from '@/lib/content/meta-ad-account-instructions';
import { toDisplayName } from '@/lib/display-name';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';
import {
  readManualGrantChecklistRows,
  writeManualGrantChecklistRow,
} from '@/lib/invite/manual-grant-checklist-storage';
import {
  trackInviteGrantChecklistToggled,
  trackInviteVerifyResult,
  type InviteVerifyResultKind,
} from '@/lib/analytics/invite-events';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Button } from '@/components/ui/button';

interface AdAccount {
  id: string;
  name: string;
}

interface AdAccountSharingInstructionsProps {
  businessId: string;
  businessName?: string;
  selectedAdAccounts: AdAccount[];
  accessRequestToken: string;
  connectionId: string;
  onComplete: (result: ManualMetaShareCompletionResult) => void;
  onError?: (error: string) => void;
}

export type ManualMetaShareVerificationStatus = 'verified' | 'partial';

export interface ManualMetaShareCompletionResult {
  status: ManualMetaShareVerificationStatus;
  verificationResults?: Array<{
    assetId: string;
    assetName: string;
    status: 'waiting_for_manual_share' | 'verified' | 'unresolved' | 'failed';
    verifiedAt?: string;
    errorCode?: string;
    errorMessage?: string;
  }>;
}

interface ManualMetaShareResponse {
  data?: {
    success: boolean;
    partial?: boolean;
    status: 'waiting_for_manual_share' | 'verified' | 'partial';
    partnerBusinessId: string;
    partnerBusinessName?: string;
    verificationResults?: Array<{
      assetId: string;
      assetName: string;
      status: 'waiting_for_manual_share' | 'verified' | 'unresolved' | 'failed';
      verifiedAt?: string;
      errorCode?: string;
      errorMessage?: string;
    }>;
  };
  error?: { message?: string };
}

/* ------------------------------------------------------------------ */
/* Checklist storage (U9)                                              */
/*                                                                     */
/* Per-row check state lives in sessionStorage under a key scoped to   */
/* (request token, agency business id, row id). The helpers live in    */
/* lib/invite/manual-grant-checklist-storage.ts, where the reset       */
/* registration points (MetaAssetSelector, PlatformAuthWizard) import  */
/* clearManualGrantChecklistStorage from directly.                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Checklist row                                                       */
/* ------------------------------------------------------------------ */

interface ChecklistRowProps {
  rowId: string;
  number: string;
  title: string;
  description?: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  indented?: boolean;
  hairline?: boolean;
  children?: React.ReactNode;
}

function ChecklistRow({
  rowId,
  number,
  title,
  description,
  checked,
  onToggle,
  indented = false,
  hairline = true,
  children,
}: ChecklistRowProps) {
  return (
    <li className={hairline ? 'hairline-b' : undefined}>
      <label
        htmlFor={`manual-grant-${rowId}`}
        className={`flex min-h-[44px] cursor-pointer items-start gap-3 py-3 ${
          indented ? 'pl-11' : ''
        }`}
      >
        <input
          id={`manual-grant-${rowId}`}
          type="checkbox"
          checked={checked}
          onChange={(event) => onToggle(event.target.checked)}
          className="peer sr-only"
        />
        {/* Square checkbox box; the two-ring focus style lands via peer. */}
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center border-2 bg-card ${
            checked ? 'border-coral bg-coral' : 'border-border'
          } peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-[rgb(var(--coral)/0.25)] peer-focus-visible:outline-offset-0 peer-focus-visible:[box-shadow:0_0_0_6px_rgb(var(--primary)/0.08)]`}
        >
          {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
        </span>
        <span className="flex flex-1 items-start gap-2">
          <span className="pt-0.5 font-mono text-xs font-bold text-muted-foreground">
            {number}
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-ink">{title}</span>
            {description && (
              <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
            )}
          </span>
        </span>
      </label>
      {children}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* One-tap copy card for the agency business ID                        */
/* ------------------------------------------------------------------ */

interface BusinessIdCopyCardProps {
  businessId: string;
  businessName?: string;
  content: (typeof META_AD_ACCOUNT_INSTRUCTIONS)['en']['copyCard'];
}

function BusinessIdCopyCard({ businessId, businessName, content }: BusinessIdCopyCardProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="border border-border bg-muted/20 p-4">
      <p className="label-micro">{content.label}</p>
      {businessName && (
        <p className="mt-1 text-sm text-muted-foreground">{businessName}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="break-all font-mono text-sm font-bold text-ink">{businessId}</span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void copy(businessId)}
        >
          {copied ? (
            <Check className="h-4 w-4 text-success-ink" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {copied ? content.copied : content.copyButton}
        </Button>
      </div>
      {/* Stable live region: the confirmation swaps in on copy, so screen
          readers announce it — never color-only. */}
      <p
        role="status"
        className={`mt-2 text-sm ${
          copied ? 'font-semibold text-success-ink' : 'text-muted-foreground'
        }`}
      >
        {copied ? content.copied : content.helper}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function AdAccountSharingInstructions({
  businessId,
  businessName,
  selectedAdAccounts,
  accessRequestToken,
  connectionId,
  onComplete,
  onError,
}: AdAccountSharingInstructionsProps) {
  const [isStarting, setIsStarting] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [status, setStatus] = useState<'waiting_for_manual_share' | 'verified' | 'partial'>(
    'waiting_for_manual_share'
  );
  const [verificationResults, setVerificationResults] = useState<
    NonNullable<ManualMetaShareResponse['data']>['verificationResults']
  >(
    selectedAdAccounts.map((account) => ({
      assetId: account.id,
      assetName: account.name,
      status: 'waiting_for_manual_share',
    }))
  );
  const [checkedRows, setCheckedRows] = useState<Record<string, boolean>>({});
  const content = META_AD_ACCOUNT_INSTRUCTIONS.en;
  const apiUrl = getApiBaseUrl();

  // Restore the per-row check state for this (token, business) scope. The
  // effect also re-reads when the scope changes without a remount.
  useEffect(() => {
    setCheckedRows(readManualGrantChecklistRows(accessRequestToken, businessId));
  }, [accessRequestToken, businessId]);

  const toggleRow = (rowId: string, checked: boolean) => {
    setCheckedRows((prev) => ({ ...prev, [rowId]: checked }));
    writeManualGrantChecklistRow(accessRequestToken, businessId, rowId, checked);
    // U11: one event per toggle, from the change handler. Row ids are the
    // static checklist ids — never asset or business names.
    trackInviteGrantChecklistToggled({ row_id: rowId, checked });
  };

  useEffect(() => {
    let isMounted = true;

    const startManualShare = async () => {
      try {
        setIsStarting(true);
        const response = await fetch(
          `${apiUrl}/api/client/${accessRequestToken}/meta/manual-ad-account-share/start`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connectionId,
            }),
          }
        );

        const json = await parseJsonResponse<ManualMetaShareResponse>(response, {
          fallbackErrorMessage: 'Failed to start manual ad-account sharing',
        });

        if (!isMounted) return;

        if (json.error) {
          throw new Error(json.error.message || 'Failed to start manual ad-account sharing');
        }

        setStatus(json.data?.status || 'waiting_for_manual_share');
        if (json.data?.verificationResults) {
          setVerificationResults(json.data.verificationResults);
        }
      } catch (error) {
        if (!isMounted) return;
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to start manual ad-account sharing';
        onError?.(errorMessage);
      } finally {
        if (isMounted) {
          setIsStarting(false);
        }
      }
    };

    void startManualShare();

    return () => {
      isMounted = false;
    };
  }, [accessRequestToken, apiUrl, connectionId, onError]);

  const handleVerifyAccess = async () => {
    try {
      setIsVerifying(true);
      const response = await fetch(
        `${apiUrl}/api/client/${accessRequestToken}/meta/manual-ad-account-share/verify`,
        {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
        }),
        }
      );

      const json = await parseJsonResponse<ManualMetaShareResponse>(response, {
        fallbackErrorMessage: 'Failed to verify ad-account access',
      });

      if (json.error) {
        throw new Error(json.error.message || 'Failed to verify ad-account access');
      }

      const nextStatus = json.data?.status || 'waiting_for_manual_share';
      const nextResults = json.data?.verificationResults || [];
      setStatus(nextStatus);
      setVerificationResults(nextResults);

      // U11: the server-truth verify outcome, once per verify response. Kind
      // and counts only — no asset names.
      const resultKind: InviteVerifyResultKind =
        nextStatus === 'waiting_for_manual_share' ? 'waiting' : nextStatus;
      trackInviteVerifyResult({
        result_kind: resultKind,
        verified_count: nextResults.filter((result) => result.status === 'verified').length,
        unresolved_count: nextResults.filter((result) => result.status !== 'verified').length,
      });

      if (nextStatus === 'verified' || nextStatus === 'partial') {
        onComplete({
          status: nextStatus,
          verificationResults: nextResults,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify ad-account access';
      onError?.(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  const verifiedCount =
    verificationResults?.filter((result) => result.status === 'verified').length || 0;
  const unresolvedResults =
    verificationResults?.filter((result) => result.status !== 'verified') || [];
  const hasUnresolvedResults = unresolvedResults.length > 0;

  const agencyName = toDisplayName(businessName || '') || 'the agency';
  const introText = content.intro
    .replace('{agency}', agencyName)
    .replace('{count}', String(selectedAdAccounts.length));
  const scopeNoteText = content.scopeNote.replace('{agency}', agencyName);

  const substepRows = content.step2.substeps.map((text, index) => ({
    id: `step-2-${index + 1}`,
    number: `2.${index + 1}`,
    title: text,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-ink mb-2">{content.title}</h3>
        <p className="text-muted-foreground">{content.description}</p>
      </div>

      {/* Plain-language framing: what the client is doing and why. */}
      <div className="space-y-1">
        <p className="text-sm text-foreground">{introText}</p>
        <p className="text-sm text-muted-foreground">{scopeNoteText}</p>
      </div>

      <div
        className={`border-2 p-4 ${
          status === 'verified'
            ? 'border-[rgb(var(--teal))] bg-[rgb(var(--teal))]/10 text-success-ink'
            : 'border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 text-ink'
        }`}
      >
        {isStarting ? (
          <p className="flex items-center gap-2 font-semibold">
            <Loader2 className="h-4 w-4 animate-spin" />
            {content.starting}
          </p>
        ) : status === 'verified' ? (
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            {content.verified.replace('{count}', String(verifiedCount))}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="flex items-center gap-2 font-semibold text-[rgb(var(--warning))]">
              <AlertCircle className="h-4 w-4" />
              {content.waiting.replace('{verifiedCount}', String(verifiedCount)).replace(
                '{selectedCount}',
                String(selectedAdAccounts.length)
              )}
            </p>
            {hasUnresolvedResults && (
              <ul className="text-sm space-y-1">
                {unresolvedResults.map((result) => (
                  <li key={result.assetId}>
                    {result.assetName}: {result.errorMessage || content.pending}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Stateful checklist: two numbered steps, five numbered sub-steps,
          one checkbox per row, persisted per (token, business). */}
      <div>
        <div className="border border-border">
          <p className="label-micro hairline-b px-4 py-3">{content.checklistHint}</p>
          <ol className="px-4">
            <ChecklistRow
              rowId="step-1"
              number="1"
              title={content.step1.title}
              description={content.step1.description}
              checked={Boolean(checkedRows['step-1'])}
              onToggle={(checked) => toggleRow('step-1', checked)}
            >
              {selectedAdAccounts.length > 0 && (
                <div className="pb-3 pl-8">
                  <p className="text-sm font-semibold text-foreground mb-1">
                    Selected accounts:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {selectedAdAccounts.map((account) => (
                      <li key={account.id}>{account.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </ChecklistRow>

            <ChecklistRow
              rowId="step-2"
              number="2"
              title={content.step2.title}
              description={content.step2.description}
              checked={Boolean(checkedRows['step-2'])}
              onToggle={(checked) => toggleRow('step-2', checked)}
            >
              <p
                role="note"
                className="mb-3 ml-8 border border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 px-3 py-2 text-sm text-[rgb(var(--warning))]"
              >
                {content.step2.securityNote}
              </p>
            </ChecklistRow>

            {substepRows.map((row, index) => (
              <ChecklistRow
                key={row.id}
                rowId={row.id}
                number={row.number}
                title={row.title}
                indented
                hairline={index < substepRows.length - 1}
                checked={Boolean(checkedRows[row.id])}
                onToggle={(checked) => toggleRow(row.id, checked)}
              >
                {row.id === 'step-2-2' && (
                  <div className="pb-3 pl-11">
                    <BusinessIdCopyCard
                      businessId={businessId}
                      businessName={businessName}
                      content={content.copyCard}
                    />
                  </div>
                )}
              </ChecklistRow>
            ))}
          </ol>
        </div>

        {/* Revocation reassurance (R9): rendered once, near the steps. */}
        <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {content.revocationNote}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4 border-t-2 border-border">
        <Button asChild variant="secondary" className="flex-1">
          <a
            href="https://business.facebook.com/settings"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="w-5 h-5" />
            {content.openBusinessManager}
          </a>
        </Button>
        <Button
          onClick={handleVerifyAccess}
          disabled={isStarting || isVerifying || status === 'verified'}
          variant="primary"
          className="flex-1"
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {content.verifying}
            </>
          ) : status === 'verified' ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              {content.verifiedButton}
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              {content.checkAccess}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
