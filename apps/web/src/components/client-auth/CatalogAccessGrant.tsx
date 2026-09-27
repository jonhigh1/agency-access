'use client';

import { useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';
import { Button } from '@/components/ui/button';

type Catalog = { id: string; name: string };

export function CatalogAccessGrant({
  catalogs,
  connectionId,
  accessRequestToken,
  onComplete,
}: {
  catalogs: Catalog[];
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

  const grant = async () => {
    const version = ++requestVersion.current;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/client/${accessRequestToken}/grant-meta-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, assetTypes: ['catalog'] }),
      });
      const json = await parseJsonResponse<{
        data?: { success?: boolean; partial?: boolean; assetGrantResults?: Array<{ assetId: string; assetType: string; status: string }> };
        error?: { message?: string };
      }>(response, { fallbackErrorMessage: 'Could not grant catalog access' });
      if (version !== requestVersion.current) return;
      if (json.error) throw new Error(json.error.message || 'Could not grant catalog access');
      const results = json.data?.assetGrantResults?.filter((result) => result.assetType === 'catalog') || [];
      const verifiedIds = new Set(results.filter((result) => result.status === 'verified').map((result) => result.assetId));
      const verified = results.length > 0 && results.every((result) => result.status === 'verified') &&
        catalogs.every((catalog) => verifiedIds.has(catalog.id));
      setMessage(verified ? 'Catalog access is granted and verified.' : 'Some catalog access could not be verified. Review the result and try again.');
      onComplete(verified);
    } catch (error) {
      if (version !== requestVersion.current) return;
      setMessage(error instanceof Error ? error.message : 'Could not grant catalog access');
      onComplete(false);
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  };

  return (
    <section className="mt-6 space-y-3 border-2 border-black p-4" aria-label="Product catalog access">
      <h3 className="text-lg font-bold text-[var(--ink)] font-display">Share product catalogs</h3>
      <p className="text-sm text-muted-foreground">Selected catalogs: {catalogs.map((catalog) => catalog.name).join(', ')}</p>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      <Button type="button" variant="primary" onClick={grant} disabled={busy}>
        {busy ? 'Sharing catalogs…' : 'Grant catalog access'}
      </Button>
    </section>
  );
}
