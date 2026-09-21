'use client';

import { useState } from 'react';
import { Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { META_GRANT_ACCESS } from '@/lib/content/meta-grant-access';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import { Button } from '@/components/ui/button';

interface Page {
  id: string;
  name: string;
}

interface GrantResult {
  id: string;
  status: 'granted' | 'failed';
  error?: string;
}

interface MetaGrantAccessResponse {
  data?: {
    assetGrantResults?: Array<{
      assetId: string;
      assetType: 'page' | 'ad_account' | 'instagram_account';
      status: 'pending' | 'granted' | 'verified' | 'failed' | 'unresolved';
      errorMessage?: string;
    }>;
  };
  error?: { code?: string; message?: string };
}

interface AutomaticPagesGrantProps {
  selectedPages: Page[];
  accessLevel?: 'Admin' | 'Editor' | 'Analyst';
  connectionId: string;
  accessRequestToken: string;
  onGrantComplete: (results: GrantResult[]) => void;
  onError?: (error: string) => void;
}

export function AutomaticPagesGrant({
  selectedPages,
  accessLevel = 'Admin',
  connectionId,
  accessRequestToken,
  onGrantComplete,
  onError,
}: AutomaticPagesGrantProps) {
  const [isGranting, setIsGranting] = useState(false);
  const [grantResults, setGrantResults] = useState<GrantResult[] | null>(null);
  const [removedPages, setRemovedPages] = useState<Set<string>>(new Set());
  const [localError, setLocalError] = useState<string | null>(null);

  const content = META_GRANT_ACCESS.en.automatic;
  const displayPages = selectedPages.filter((p) => !removedPages.has(p.id));

  const handleGrantAccess = async () => {
    if (displayPages.length === 0) {
      const errorMsg = 'No pages selected';
      setLocalError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    void capturePosthogEvent('client_meta_grant_started', {
      access_request_token: accessRequestToken,
      connection_id: connectionId,
      page_count: displayPages.length,
    });

    const captureGrantFailed = (extra: Record<string, unknown>) =>
      void capturePosthogEvent('client_meta_grant_failed', {
        access_request_token: accessRequestToken,
        connection_id: connectionId,
        ...extra,
      });

    try {
      setIsGranting(true);
      setGrantResults(null); // Clear previous results
      setLocalError(null); // Clear previous errors
      const apiUrl = getApiBaseUrl();

      const response = await fetch(`${apiUrl}/api/client/${accessRequestToken}/grant-meta-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          assetTypes: ['page'],
        }),
      });

      const json = await parseJsonResponse<MetaGrantAccessResponse>(response, {
        fallbackErrorMessage: 'Failed to grant access',
      });

      if (json.error) {
        // Show the error message from the API
        const errorMessage = json.error.message || 'Failed to grant access';
        setLocalError(errorMessage);
        onError?.(errorMessage);
        captureGrantFailed({
          failure_reason: 'api_error',
          error_code: json.error.code ?? null,
          error_message: errorMessage,
        });
        return;
      }

      const results: GrantResult[] = (json.data?.assetGrantResults || [])
        .filter((result) => result.assetType === 'page')
        .map((result) => ({
          id: result.assetId,
          status: result.status === 'verified' ? 'granted' : 'failed',
          error: result.status === 'verified' ? undefined : result.errorMessage,
        }));
      setGrantResults(results);

      // Check if any pages failed
      const hasFailures = results.some((r) => r.status === 'failed');
      if (hasFailures) {
        const failedPages = results.filter((r) => r.status === 'failed');
        const errorMessages = failedPages.map((r) => r.error).filter(Boolean);
        if (errorMessages.length > 0) {
          const errorMsg = `Some pages failed: ${errorMessages.join('; ')}`;
          setLocalError(errorMsg);
          onError?.(errorMsg);
        }
        captureGrantFailed({
          failure_reason: 'assets_not_verified',
          granted_count: results.filter((r) => r.status === 'granted').length,
          failed_count: failedPages.length,
        });
      } else {
        setLocalError(null); // Clear error on success
        void capturePosthogEvent('client_meta_grant_completed', {
          access_request_token: accessRequestToken,
          connection_id: connectionId,
          granted_count: results.length,
        });
      }

      onGrantComplete(results);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to grant access';
      setLocalError(errorMessage);
      onError?.(errorMessage);
      captureGrantFailed({
        failure_reason: 'request_exception',
        error_message: errorMessage,
      });
    } finally {
      setIsGranting(false);
    }
  };

  const handleRemovePage = (pageId: string) => {
    setRemovedPages((prev) => new Set(prev).add(pageId));
  };

  const hasGranted = grantResults?.some((r) => r.status === 'granted');
  const hasFailed = grantResults?.some((r) => r.status === 'failed');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-ink mb-1">{content.title}</h3>
        <p className="text-muted-foreground">{content.subtitle}</p>
      </div>

      {localError && (
        <div className="bg-coral/10 border-2 border-coral/30 rounded-xl p-4 text-danger-ink">
          <p className="font-semibold">{localError}</p>
        </div>
      )}

      <div className="bg-card border-2 border-border rounded-xl p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-lg bg-coral/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">f</span>
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-ink mb-1">
              {content.facebookPages.title}
            </h4>
            <span className="inline-block px-2 py-1 bg-muted/30 text-foreground text-xs font-semibold rounded">
              {accessLevel}
            </span>
          </div>
        </div>

        {/* Account Selector */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-foreground mb-2">
            Select Accounts
          </label>
          <div className="min-h-[60px] border-2 border-border rounded-lg p-3 flex flex-wrap gap-2">
            {displayPages.length === 0 ? (
              <span className="text-muted-foreground text-sm">No pages selected</span>
            ) : (
              displayPages.map((page) => {
                const result = grantResults?.find((r) => r.id === page.id);
                const isGranted = result?.status === 'granted';
                const isFailed = result?.status === 'failed';

                return (
                  <div
                    key={page.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 ${
                      isGranted
                        ? 'bg-emerald-50 border-emerald-200'
                        : isFailed
                        ? 'bg-coral/10 border-coral/30'
                        : 'bg-muted/20 border-border'
                    }`}
                  >
                    <span className="text-sm font-medium text-ink">
                      {page.name} ({page.id.slice(0, 6)}...)
                    </span>
                    {isGranted && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                    {isFailed && (
                      <AlertCircle className="w-4 h-4 text-danger-ink" />
                    )}
                    {!isGranting && (
                      <button
                        onClick={() => handleRemovePage(page.id)}
                        className="text-muted-foreground hover:text-muted-foreground"
                        aria-label="Remove page"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {hasFailed && (
            <div className="mt-2 text-sm text-danger-ink">
              Some pages failed to grant access. Please try again.
            </div>
          )}
        </div>

        {/* Grant Access Button */}
        <Button
          onClick={handleGrantAccess}
          disabled={isGranting || displayPages.length === 0 || hasGranted}
          variant="primary"
          size="lg"
          className="w-full px-6 py-3"
        >
          {isGranting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {content.facebookPages.granting}
            </span>
          ) : hasGranted ? (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              {content.facebookPages.success}
            </span>
          ) : (
            content.facebookPages.grantButton
          )}
        </Button>
      </div>
    </div>
  );
}
