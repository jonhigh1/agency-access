'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { MetaPageEngagementProof as PageProof } from '@agency-platform/shared';
import { Button } from '@/components/ui/button';
import { resolveApiUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';

interface MetaPageEngagementProofProps {
  selectedPage: Pick<PageProof['page'], 'id' | 'name'>;
  connectionId: string;
  accessRequestToken: string;
}

export function MetaPageEngagementProof({
  selectedPage,
  connectionId,
  accessRequestToken,
}: MetaPageEngagementProofProps) {
  const [proof, setProof] = useState<PageProof | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({ connectionId, pageId: selectedPage.id });
      const response = await fetch(
        resolveApiUrl(`/api/client/${accessRequestToken}/meta-page-proof?${query.toString()}`),
        { signal: AbortSignal.timeout(20_000) }
      );
      const json = await parseJsonResponse<{ data?: PageProof; error?: { message?: string } }>(
        response,
        { fallbackErrorMessage: 'Failed to read Page content' }
      );

      if (!response.ok || json.error || !json.data) {
        throw new Error(json.error?.message || 'Failed to read Page content');
      }

      setProof(json.data);
    } catch (requestError) {
      setProof(null);
      setError(requestError instanceof Error ? requestError.message : 'Failed to read Page content');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="border-2 border-black bg-card p-4 dark:border-white" aria-labelledby={`meta-page-proof-title-${selectedPage.id}`}>
      <div className="mb-3">
        <h4 id={`meta-page-proof-title-${selectedPage.id}`} className="text-lg font-bold text-[var(--ink)] font-display">
          Validate Page access
        </h4>
        <p className="text-sm text-muted-foreground">
          AuthHub will validate this Page, its management tasks, connected Instagram account, and recent public post dates.
        </p>
      </div>

      <div className="mb-3 border-2 border-black/20 p-3 dark:border-white/30">
        <p className="font-semibold text-[var(--ink)]">{selectedPage.name}</p>
        <p className="font-mono text-xs text-muted-foreground">Page ID: {selectedPage.id}</p>
      </div>

      <Button
        type="button"
        onClick={handleVerify}
        disabled={isLoading}
        variant="brutalist"
        size="sm"
      >
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isLoading ? 'Validating Page…' : 'Validate Page access'}
      </Button>

      {error ? (
        <div className="mt-3 flex gap-2 border-2 border-[var(--coral)] bg-[var(--coral)]/10 p-3 text-sm text-danger-ink" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {proof ? (
        <div className="mt-3 border-2 border-[var(--teal)] bg-[var(--teal)]/10 p-3" role="status" aria-live="polite">
          <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--ink)]">
            <CheckCircle2 className="h-4 w-4 text-[var(--teal)]" aria-hidden="true" />
            Page access validated for {proof.page.name}
          </div>
          <dl className="mb-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {proof.page.category ? (
              <div><dt className="label-nano">Category</dt><dd>{proof.page.category}</dd></div>
            ) : null}
            {typeof proof.page.followerCount === 'number' ? (
              <div><dt className="label-nano">Followers</dt><dd>{proof.page.followerCount.toLocaleString()}</dd></div>
            ) : null}
            <div>
              <dt className="label-nano">Managed tasks</dt>
              <dd>{proof.page.managedTasks.length > 0 ? proof.page.managedTasks.join(', ') : 'No tasks returned'}</dd>
            </div>
            {proof.connectedInstagram ? (
              <div><dt className="label-nano">Connected Instagram</dt><dd>@{proof.connectedInstagram.username}</dd></div>
            ) : null}
          </dl>
          {proof.posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent public posts were returned.</p>
          ) : (
            <ul className="space-y-2 text-sm text-[var(--ink)]">
              {proof.posts.map((post) => (
                <li key={post.id} className="border-t border-black/20 pt-2 dark:border-white/20">
                  <span className="font-mono text-xs text-muted-foreground">Recent Page post</span>
                  <p>
                    <time dateTime={post.createdTime}>
                      {post.createdTime ? new Date(post.createdTime).toLocaleDateString() : 'Date unavailable'}
                    </time>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
