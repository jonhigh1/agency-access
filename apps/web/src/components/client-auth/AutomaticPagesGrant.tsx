'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { META_GRANT_ACCESS } from '@/lib/content/meta-grant-access';
import { formatMetaPageChipDisplay } from '@/lib/invite/meta-entity-identity';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { ApiResponseError, parseJsonResponse } from '@/lib/api/parse-json-response';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import { ClientGrantPrimaryButton } from './client-grant-button';
import { PlatformIcon } from '@/components/ui/platform-icon';

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
  /** Visual QA fixture: submit grant once after mount when fetch is mocked. */
  fixtureAutoGrantOnMount?: boolean;
}

export function AutomaticPagesGrant({
  selectedPages,
  accessLevel = 'Admin',
  connectionId,
  accessRequestToken,
  onGrantComplete,
  onError,
  fixtureAutoGrantOnMount = false,
}: AutomaticPagesGrantProps) {
  const [isGranting, setIsGranting] = useState(false);
  const [grantResults, setGrantResults] = useState<GrantResult[] | null>(null);
  const [removedPages, setRemovedPages] = useState<Set<string>>(new Set());
  const [localError, setLocalError] = useState<string | null>(null);
  const fixtureGrantStarted = useRef(false);

  const content = META_GRANT_ACCESS.en.automatic;
  const displayPages = selectedPages.filter((p) => !removedPages.has(p.id));

  async function handleGrantAccess() {
    if (displayPages.length === 0) {
      const errorMsg = 'No pages selected';
      setLocalError(errorMsg);
      onError?.(errorMsg);
      void capturePosthogEvent('client_meta_grant_failed', {
        connection_id: connectionId,
        selected_page_count: 0,
        result_count: 0,
        verified_page_count: 0,
        failed_page_count: 0,
        error_code: 'NO_PAGES_SELECTED',
        failure_reason: 'no_pages_selected',
      });
      return;
    }

    try {
      setIsGranting(true);
      setGrantResults(null); // Clear previous results
      setLocalError(null); // Clear previous errors
      void capturePosthogEvent('client_meta_grant_started', {
        connection_id: connectionId,
        selected_page_count: displayPages.length,
      });
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
        void capturePosthogEvent('client_meta_grant_failed', {
          connection_id: connectionId,
          selected_page_count: displayPages.length,
          result_count: 0,
          verified_page_count: 0,
          failed_page_count: displayPages.length,
          error_code: json.error.code || 'API_ERROR',
          failure_reason: 'api_error',
        });
        return;
      }

      const pageResults = (json.data?.assetGrantResults || []).filter((result) => result.assetType === 'page');
      const resultsByPage = pageResults.reduce<Map<string, GrantResult>>((byPage, result) => {
        const existing = byPage.get(result.assetId);
        if (existing) {
          if (result.status !== 'verified') {
            existing.status = 'failed';
            existing.error = result.errorMessage || existing.error;
          }
        } else {
          byPage.set(result.assetId, {
            id: result.assetId,
            status: result.status === 'verified' ? 'granted' : 'failed',
            error: result.status === 'verified' ? undefined : result.errorMessage,
          });
        }
        return byPage;
      }, new Map());
      const hasMissingResult = displayPages.some((page) => !resultsByPage.has(page.id));
      const results = displayPages.map((page) =>
        resultsByPage.get(page.id) || {
          id: page.id,
          status: 'failed' as const,
          error: 'No verified grant result returned',
        }
      );
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
        void capturePosthogEvent('client_meta_grant_failed', {
          connection_id: connectionId,
          selected_page_count: displayPages.length,
          result_count: pageResults.length,
          verified_page_count: results.filter((result) => result.status === 'granted').length,
          failed_page_count: failedPages.length,
          error_code: hasMissingResult ? 'INCOMPLETE_RESULTS' : 'UNVERIFIED_RESULT',
          failure_reason: hasMissingResult ? 'missing_verified_result' : 'unverified_result',
        });
      } else {
        setLocalError(null); // Clear error on success
        void capturePosthogEvent('client_meta_grant_completed', {
          connection_id: connectionId,
          selected_page_count: displayPages.length,
          result_count: pageResults.length,
          verified_page_count: results.length,
          failed_page_count: 0,
        });
      }
      
      onGrantComplete(results);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to grant access';
      setLocalError(errorMessage);
      onError?.(errorMessage);
      void capturePosthogEvent('client_meta_grant_failed', {
        connection_id: connectionId,
        selected_page_count: displayPages.length,
        result_count: 0,
        verified_page_count: 0,
        failed_page_count: displayPages.length,
        error_code: error instanceof ApiResponseError ? error.code || 'API_RESPONSE_ERROR' : 'REQUEST_FAILED',
        failure_reason: error instanceof ApiResponseError ? 'api_response' : 'request_failed',
      });
    } finally {
      setIsGranting(false);
    }
  }

  useEffect(() => {
    if (!fixtureAutoGrantOnMount || fixtureGrantStarted.current || displayPages.length === 0) {
      return;
    }
    fixtureGrantStarted.current = true;
    void handleGrantAccess();
  }, [fixtureAutoGrantOnMount, displayPages.length]);

  const handleRemovePage = (pageId: string) => {
    setRemovedPages((prev) => new Set(prev).add(pageId));
  };

  const hasGranted = grantResults?.some((r) => r.status === 'granted');
  const hasFailed = grantResults?.some((r) => r.status === 'failed');

  return (
    <div className="space-y-5">
      <div>
        <p className="label-micro">{content.title}</p>
        <p className="text-sm text-muted-foreground">{content.subtitle}</p>
      </div>

      {localError && (
        <div className="border border-danger-ink bg-coral/10 p-4 text-danger-ink">
          <p className="font-semibold">{localError}</p>
        </div>
      )}

      {hasGranted && !isGranting ? (
        <div
          role="status"
          data-testid="automatic-pages-readback-success"
          className="border border-success-ink bg-[rgb(var(--teal))]/10 p-4 text-ink"
        >
          <p className="flex items-center gap-2 font-semibold text-success-ink">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
            {content.facebookPages.readBackSuccessTitle}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{content.facebookPages.readBackSuccessDetail}</p>
        </div>
      ) : null}

      {hasFailed && !isGranting && !hasGranted ? (
        <div
          role="alert"
          data-testid="automatic-pages-readback-failure"
          className="border border-danger-ink bg-coral/10 p-4 text-ink"
        >
          <p className="flex items-center gap-2 font-semibold text-danger-ink">
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
            {content.facebookPages.readBackFailureTitle}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{content.facebookPages.manualFallback}</p>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-none bg-coral/20 flex items-center justify-center flex-shrink-0">
            <PlatformIcon platform="meta_pages" size="sm" />
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
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Select accounts
          </label>
          <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-none border border-black/10 p-2 dark:border-white/10">
            {displayPages.length === 0 ? (
              <span className="text-muted-foreground text-sm">No pages selected</span>
            ) : (
              displayPages.map((page) => {
                const result = grantResults?.find((r) => r.id === page.id);
                const isGranted = result?.status === 'granted';
                const isFailed = result?.status === 'failed';

                const chip = formatMetaPageChipDisplay(page.name, page.id);

                return (
                  <div
                    key={page.id}
                    className={`inline-flex max-w-full min-h-9 items-center gap-2 rounded-none border px-3 py-1 ${
                      isGranted
                        ? 'bg-[rgb(var(--teal))]/10 border-[rgb(var(--teal))]/40'
                        : isFailed
                        ? 'bg-coral/10 border-coral/30'
                        : 'bg-muted/20 border-black/10 dark:border-white/10'
                    }`}
                  >
                    <span className="text-sm font-medium text-ink" title={chip.title}>
                      {chip.label}
                    </span>
                    {isGranted && (
                      <CheckCircle2 className="w-4 h-4 text-success-ink" />
                    )}
                    {isFailed && (
                      <AlertCircle className="w-4 h-4 text-danger-ink" />
                    )}
                    {!isGranting && (
                      <button
                        onClick={() => handleRemovePage(page.id)}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-muted-foreground"
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
        </div>

        <ClientGrantPrimaryButton
          data-testid="automatic-pages-grant-button"
          onClick={() => void handleGrantAccess()}
          disabled={isGranting || displayPages.length === 0 || hasGranted}
          className={
            isGranting || displayPages.length === 0 || hasGranted
              ? 'bg-muted/40 text-ink/70 hover:bg-muted/40'
              : undefined
          }
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
          ) : hasFailed ? (
            content.facebookPages.tryAgainButton
          ) : (
            content.facebookPages.grantButton
          )}
        </ClientGrantPrimaryButton>
      </div>
    </div>
  );
}
