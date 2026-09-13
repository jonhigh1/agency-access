'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { META_AD_ACCOUNT_INSTRUCTIONS } from '@/lib/content/meta-ad-account-instructions';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';
import { Button } from '@/components/ui/button';
import { BusinessIdDisplay } from './BusinessIdDisplay';

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
  const content = META_AD_ACCOUNT_INSTRUCTIONS.en;
  const apiUrl = getApiBaseUrl();

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

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-ink mb-2">{content.title}</h3>
        <p className="text-muted-foreground">{content.description}</p>
      </div>

      <div
        className={`rounded-xl border-2 p-4 ${
          status === 'verified'
            ? 'border-[var(--teal)] bg-[var(--teal)]/10 text-[var(--teal)]'
            : 'border-[var(--warning)] bg-[var(--warning)]/10 text-[var(--ink)]'
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
            <p className="flex items-center gap-2 font-semibold">
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

      {/* Steps */}
      <div className="space-y-6">
        {/* Step 1: Select Assets */}
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-coral text-white flex items-center justify-center font-bold">
            1
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-ink mb-1">{content.step1.title}</h4>
            <p className="text-muted-foreground text-sm mb-2">{content.step1.description}</p>
            {selectedAdAccounts.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-semibold text-foreground mb-1">Selected accounts:</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {selectedAdAccounts.map((account) => (
                    <li key={account.id}>{account.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Share Asset (combined navigation + sharing) */}
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-coral text-white flex items-center justify-center font-bold">
            2
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-ink mb-1">{content.step2.title}</h4>
            <p className="text-muted-foreground text-sm mb-3">{content.step2.description}</p>
            
            {/* Sub-steps for Step 2 */}
            <div className="space-y-3 ml-4 border-l-2 border-border pl-4">
              {/* Sub-step 1: Select account and click Assign Partner */}
              <div>
                <p className="text-foreground text-sm">{content.step2.substeps?.[0]}</p>
              </div>
              
              {/* Sub-step 2: Enter Business Manager ID */}
              <div>
                <p className="text-foreground text-sm mb-2">{content.step2.substeps?.[1]}</p>
                <BusinessIdDisplay businessId={businessId} businessName={businessName} />
              </div>
              
              {/* Sub-step 3: Check Manage ad accounts */}
              <div>
                <p className="text-foreground text-sm">{content.step2.substeps?.[2]}</p>
              </div>
              
              {/* Sub-step 4: Click Assign */}
              <div>
                <p className="text-foreground text-sm">{content.step2.substeps?.[3]}</p>
              </div>
              
              {/* Sub-step 5: Wait for confirmation */}
              <div>
                <p className="text-foreground text-sm">{content.step2.substeps?.[4]}</p>
              </div>
            </div>
          </div>
        </div>
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
