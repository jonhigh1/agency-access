'use client';

/**
 * MetaDatasetVerifyPanel - the step-3 checklist action for Pixels & Datasets.
 *
 * Mirrors the selector's dataset verify row: a guided redirect into the
 * client Business Portfolio plus a server-truth verify POST against
 * /meta/datasets/verify. The panel owns no wizard state — every outcome is
 * reported through `onSettled`, so the checklist machine stays the single
 * source of truth. Verify never navigates steps.
 */

import { useRef, useState } from 'react';
import { GuidedRedirectCard } from './GuidedRedirectModal';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { ApiResponseError, parseJsonResponse } from '@/lib/api/parse-json-response';

interface DatasetVerifyResult {
  assetId: string;
  assetName?: string;
  status: string;
  errorMessage?: string;
}

interface DatasetVerifyResponse {
  data?: {
    success?: boolean;
    partial?: boolean;
    status?: string;
    results?: DatasetVerifyResult[];
  };
  error?: { message?: string };
}

interface MetaDatasetVerifyPanelProps {
  datasetIds: string[];
  /** Selected dataset names for the unresolved list; ids are the fallback. */
  datasetNames?: Array<{ id: string; name: string }>;
  /** Client Business Portfolio id; the panel renders only when it is known. */
  clientBusinessId: string | null;
  connectionId: string;
  accessRequestToken: string;
  onError?: (message: string) => void;
  onSettled: (state: 'done' | 'action_required') => void;
}

/** Server-truth copy, one line per verify outcome (client-voiced). */
function statusLine(status: string | undefined): string {
  if (status === 'verified') {
    return 'Meta confirmed access for every selected recipient and required task.';
  }
  if (status === 'partial') {
    return 'Meta confirmed some access. Review the remaining people, partner, or tasks in Business Settings.';
  }
  return 'Meta did not confirm the required access. Check the people, partner, and tasks in Business Settings, then verify again.';
}

export function MetaDatasetVerifyPanel({
  datasetIds,
  datasetNames,
  clientBusinessId,
  connectionId,
  accessRequestToken,
  onError,
  onSettled,
}: MetaDatasetVerifyPanelProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<DatasetVerifyResponse['data'] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Supersede guard: a slow response must never overwrite a newer verify.
  const verifyVersionRef = useRef(0);

  if (!clientBusinessId || datasetIds.length === 0) return null;

  const verify = async () => {
    const version = ++verifyVersionRef.current;
    setIsVerifying(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/client/${accessRequestToken}/meta/datasets/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId, datasetIds }),
        }
      );
      const json = await parseJsonResponse<DatasetVerifyResponse>(response, {
        fallbackErrorMessage: 'Could not verify Pixel or Dataset access',
      });
      if (version !== verifyVersionRef.current) return;
      if (json.error) {
        throw new ApiResponseError(
          json.error.message || 'Could not verify Pixel or Dataset access'
        );
      }

      const data = json.data || {};
      setResult(data);
      // Server truth decides the state: only a fully verified response is a
      // Done; partial and manual_action_required stay on the client.
      onSettled(data.status === 'verified' ? 'done' : 'action_required');
    } catch (err) {
      if (version !== verifyVersionRef.current) return;
      const message =
        err instanceof Error ? err.message : 'Could not verify Pixel or Dataset access.';
      setErrorMessage(message);
      onError?.(message);
    } finally {
      if (version === verifyVersionRef.current) {
        setIsVerifying(false);
      }
    }
  };

  const nameById = new Map((datasetNames || []).map((dataset) => [dataset.id, dataset.name]));
  const unresolvedResults = (result?.results || []).filter(
    (item) => item.status !== 'verified'
  );

  return (
    <div className="mt-3">
      {result?.status ? (
        <p role="status" className="mb-3 text-sm text-ink">
          {statusLine(result.status)}
        </p>
      ) : null}

      {unresolvedResults.length > 0 ? (
        <ul className="mb-3 space-y-1 text-sm text-[rgb(var(--warning))]">
          {unresolvedResults.map((item) => (
            <li key={item.assetId}>
              {`${nameById.get(item.assetId) || item.assetName || item.assetId}: ${
                item.errorMessage || 'Meta has not confirmed the required access.'
              }`}
            </li>
          ))}
        </ul>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="mb-3 border border-danger-ink bg-coral/10 p-3 text-sm text-danger-ink"
        >
          {errorMessage}
        </p>
      ) : null}

      <GuidedRedirectCard
        title="Manage Pixels and Datasets in Meta"
        description="Assign the requested access to each recipient and the agency partner. Return here to check the access that Meta reports."
        businessManagerUrl={`https://business.facebook.com/settings/${encodeURIComponent(clientBusinessId)}`}
        instructions={[
          { title: 'Open this Business Portfolio in Meta Business Settings.' },
          {
            title:
              'Open Data Sources, then Pixels or Datasets. Assign the requested tasks to each selected person and the agency partner.',
          },
          {
            title:
              'Return here and verify access. AuthHub reports only the access that Meta confirms.',
          },
        ]}
        onRefresh={verify}
        isRefreshing={isVerifying}
        completionLabel="Verify access"
        actionLabel="Verify access"
      />
    </div>
  );
}
