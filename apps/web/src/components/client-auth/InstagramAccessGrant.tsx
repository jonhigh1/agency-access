'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';

type InstagramAccount = { id: string; name: string };
type GrantResult = { assetId: string; assetType: string; recipientType?: string; recipientId?: string; status: string };

export function InstagramAccessGrant({
  accounts,
  clientBusinessId,
  agencyBusinessId,
  connectionId,
  accessRequestToken,
  onComplete,
}: {
  accounts: InstagramAccount[];
  clientBusinessId: string;
  agencyBusinessId: string;
  connectionId: string;
  accessRequestToken: string;
  onComplete: (verified: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => () => {
    requestVersion.current += 1;
  }, []);

  const verify = async () => {
    const version = ++requestVersion.current;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/client/${accessRequestToken}/grant-meta-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, assetTypes: ['instagram_account'] }),
      });
      const json = await parseJsonResponse<{
        data?: { assetGrantResults?: GrantResult[] };
        error?: { message?: string };
      }>(response, { fallbackErrorMessage: 'Could not verify Instagram access' });
      if (version !== requestVersion.current) return;
      if (json.error) throw new Error(json.error.message || 'Could not verify Instagram access');

      const businessResults = (json.data?.assetGrantResults || []).filter(
        (result) => result.assetType === 'instagram_account' &&
          result.recipientType === 'business' && result.recipientId === agencyBusinessId
      );
      const verifiedIds = new Set(businessResults.filter((result) => result.status === 'verified').map((result) => result.assetId));
      const verified = accounts.length > 0 && accounts.every((account) => verifiedIds.has(account.id));
      setMessage(verified
        ? 'Meta confirmed agency Business Portfolio access. Individual people and system users are not verified here.'
        : 'Meta has not confirmed agency Business Portfolio access. Check sharing in Business Settings, then verify again.');
      onComplete(verified);
    } catch (error) {
      if (version !== requestVersion.current) return;
      setMessage(error instanceof Error ? error.message : 'Could not verify Instagram access');
      onComplete(false);
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  };

  return (
    <section className="mt-6 space-y-3 border-2 border-black p-4" aria-label="Instagram access">
      <h3 className="text-lg font-bold text-[var(--ink)] font-display">Share direct Instagram access</h3>
      <p className="text-sm text-muted-foreground">Selected accounts: {accounts.map((account) => account.name).join(', ')}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Open Meta Business Settings and select Instagram accounts.</li>
        <li>Add agency Business Portfolio <code>{agencyBusinessId}</code> as a partner for each selected account.</li>
        <li>Return here and verify. This check confirms agency Business Portfolio access only. It does not verify individual people or system users.</li>
      </ol>
      <a
        className="inline-flex min-h-[44px] items-center font-semibold text-[var(--ink)] underline"
        href={`https://business.facebook.com/settings/${encodeURIComponent(clientBusinessId)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open Meta Business Settings
      </a>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      <Button type="button" variant="primary" onClick={verify} disabled={busy}>
        {busy ? 'Checking Instagram access…' : 'Verify agency Instagram access'}
      </Button>
    </section>
  );
}
