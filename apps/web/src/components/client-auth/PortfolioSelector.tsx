'use client';

/**
 * PortfolioSelector - receipt-first business-portfolio choice for client surfaces.
 *
 * Confirmation-first selection (R6, KTD5):
 * - One owner business  → receipt ("Sharing from {name}") with an escape
 *   affordance to choose a different business — never a chooser.
 * - Several businesses  → one plain-language question with a name-only list.
 * - Zero businesses     → the business-creation path stays reachable through
 *   onCreateBusiness.
 *
 * Choices show business names with Meta Business Portfolio IDs visible for
 * App Review (business_management). When two businesses share a name, vertical
 * or verification status disambiguates the colliding pair alongside the ID.
 *
 * The data source is injected: the invite wizard passes the token-auth
 * fetcher, the OAuth callback page passes the Clerk fetcher. onBusinessConfirmed
 * hands the chosen business to the consumer, which fetches that business's
 * assets.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { SingleSelect } from '@/components/ui/single-select';
import { Button } from '@/components/ui/button';
import {
  trackInviteBusinessChosen,
  trackInviteQuestionShown,
  trackInviteReceiptShown,
} from '@/lib/analytics/invite-events';
import { formatMetaEntityIdentity } from '@/lib/invite/meta-entity-identity';

export interface PortfolioBusiness {
  id: string;
  name: string;
  verificationStatus?: string;
  /** Meta vertical (payload field `verticalName`); collision tiebreaker. */
  vertical?: string;
}

interface PortfolioSelectorProps {
  businesses: PortfolioBusiness[];
  selectedBusiness?: PortfolioBusiness | null;
  selectionRequired?: boolean;
  /**
   * Data source for the full business list, fetched when the client escapes
   * the single-owner receipt. Results are cached for the component's life so
   * returning to the original business never triggers a second fetch.
   */
  fetchBusinesses: () => Promise<PortfolioBusiness[]>;
  /** Fired on confirm. The consumer then loads that business's assets. */
  onBusinessConfirmed: (business: PortfolioBusiness) => void;
  /** Zero-business escape hatch; the consumer routes to its creation branch. */
  onCreateBusiness?: () => void;
  /**
   * Consumer data error (for example, assets failed to load after
   * auto-select). Renders an error state with retry — never a blank receipt.
   */
  error?: string | null;
  /** Retry for the consumer data error above. */
  onRetry?: () => void;
}

const COLLISION_IGNORED = /[\s_-]+/g;

/** Title-case a Meta vertical token for client-facing display ("RETAIL" → "Retail"). */
const humanizeVertical = (vertical: string) => {
  const words = vertical.toLowerCase().split(COLLISION_IGNORED).filter(Boolean);
  if (words.length === 0) return vertical;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

/** Client-facing verification wording; never raw enum values. */
const humanizeVerification = (status?: string) => {
  switch ((status || '').trim().toLowerCase()) {
    case 'verified':
      return 'Verified';
    case 'pending':
      return 'Verification pending';
    default:
      return 'Verification incomplete';
  }
};

export function PortfolioSelector({
  businesses,
  selectedBusiness,
  selectionRequired = false,
  fetchBusinesses,
  onBusinessConfirmed,
  onCreateBusiness,
  error,
  onRetry,
}: PortfolioSelectorProps) {
  const [choosing, setChoosing] = useState(false);
  const [pendingBusinessId, setPendingBusinessId] = useState('');
  const [listStatus, setListStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  // Full business list loaded through the escape affordance. Cached in state
  // for the component's lifetime so returning to the original business reuses
  // the loaded list without a second fetch.
  const [fullList, setFullList] = useState<PortfolioBusiness[] | null>(null);

  // Leaving the chooser for a different selected business returns to the receipt.
  const selectedBusinessId = selectedBusiness?.id ?? null;
  const lastSelectedBusinessIdRef = useRef(selectedBusinessId);
  useEffect(() => {
    if (lastSelectedBusinessIdRef.current !== selectedBusinessId) {
      lastSelectedBusinessIdRef.current = selectedBusinessId;
      setChoosing(false);
      setPendingBusinessId('');
    }
  }, [selectedBusinessId]);

  const optionBusinesses = fullList ?? businesses;

  // U11 funnel: receipt and question are shown states. Fire on the view-mode
  // transition only (never per render), and re-arm while any other view is up
  // so a return to the receipt or question is a new, single occurrence.
  // Chooser mode: escaped from the receipt, the API flagged the request as
  // selection-required, or no business has been confirmed yet.
  const shouldAsk = choosing || (selectionRequired && !selectedBusiness);

  const shownView: 'receipt' | 'question' | 'creation' | 'loading' | 'error' = error
    ? 'error'
    : listStatus === 'error'
      ? 'error'
      : listStatus === 'loading'
        ? 'loading'
        : !shouldAsk && selectedBusiness
          ? 'receipt'
          : optionBusinesses.length === 0
            ? 'creation'
            : 'question';
  const lastShownViewRef = useRef<string | null>(null);
  useEffect(() => {
    if (shownView !== 'receipt' && shownView !== 'question') {
      lastShownViewRef.current = null;
      return;
    }
    if (lastShownViewRef.current === shownView) return;
    lastShownViewRef.current = shownView;
    const properties = { business_count: optionBusinesses.length };
    if (shownView === 'receipt') {
      trackInviteReceiptShown(properties);
    } else {
      trackInviteQuestionShown(properties);
    }
  }, [shownView, optionBusinesses.length]);

  const loadBusinessList = async () => {
    setListStatus('loading');
    try {
      const list = await fetchBusinesses();
      setFullList(Array.isArray(list) ? list : []);
      setListStatus('idle');
    } catch {
      setListStatus('error');
    }
  };

  const startChoosing = () => {
    setPendingBusinessId('');
    setChoosing(true);
    if (fullList) return; // already loaded — no second fetch
    void loadBusinessList();
  };

  const confirmBusiness = () => {
    const chosen = optionBusinesses.find((business) => business.id === pendingBusinessId);
    if (!chosen) return;
    // U11: fire from the confirm handler — counts only, never names or ids.
    trackInviteBusinessChosen({ business_count: optionBusinesses.length });
    onBusinessConfirmed(chosen);
    setChoosing(false);
    setPendingBusinessId('');
  };

  // Names only (R2): a secondary attribute renders on colliding names only (KTD11).
  const nameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const business of optionBusinesses) {
      const key = business.name.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [optionBusinesses]);
  const optionDescription = (business: PortfolioBusiness): string => {
    const isColliding = (nameCounts.get(business.name.trim().toLowerCase()) ?? 0) > 1;
    const tiebreaker = isColliding
      ? business.vertical
        ? humanizeVertical(business.vertical)
        : humanizeVerification(business.verificationStatus)
      : null;
    if (tiebreaker) {
      return `${tiebreaker} · ID ${business.id}`;
    }
    return `ID ${business.id}`;
  };

  const renderCreationCard = () => (
    <section
      aria-label="No Business Portfolio found"
      className="bg-[rgb(var(--warm-gray))]/20 p-6 space-y-4"
    >
      <div>
        <h3 className="text-lg font-bold text-[rgb(var(--ink))] font-display">
          No Business Portfolio found
        </h3>
        <p className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">
          Meta needs a Business Portfolio to hold ad accounts and Pages. Your managed Facebook
          Pages are listed below — choose a primary Page, then create a portfolio here.
        </p>
      </div>
      {onCreateBusiness ? (
        <Button type="button" variant="primary" onClick={onCreateBusiness}>
          Create a business portfolio
        </Button>
      ) : null}
    </section>
  );

  const renderQuestionCard = () => (
    <section
      aria-label="Choose a business"
      className="bg-[rgb(var(--warm-gray))]/20 p-6 space-y-4"
    >
      <div>
        <span className="label-micro">Your business</span>
        <h3 className="mt-1 text-lg font-bold text-[rgb(var(--ink))] font-display">
          Which business are we sharing from?
        </h3>
        <p className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">
          Choose the business that owns the ad accounts and pages in this request.
        </p>
      </div>
      <SingleSelect
        options={optionBusinesses.map((business) => ({
          value: business.id,
          label: business.name,
          description: optionDescription(business),
        }))}
        value={pendingBusinessId}
        onChange={(value) => setPendingBusinessId(value)}
        placeholder="Choose your business..."
        ariaLabel="Business"
        triggerClassName="border-2 border-black dark:border-white min-h-[48px]"
      />
      <Button
        type="button"
        variant="primary"
        disabled={!pendingBusinessId}
        onClick={confirmBusiness}
      >
        Confirm business
      </Button>
    </section>
  );

  const renderErrorCard = (message: string, onRetryClick?: () => void) => (
    <section
      role="alert"
      aria-label="Business loading problem"
      className="border border-danger-ink bg-[rgb(var(--coral))]/10 p-6 space-y-3"
    >
      <h3 className="text-lg font-bold text-danger-ink font-display">
        We couldn&apos;t load your businesses
      </h3>
      <p className="text-sm text-danger-ink">{message}</p>
      {onRetryClick ? (
        <Button type="button" variant="secondary" onClick={onRetryClick}>
          Try again
        </Button>
      ) : null}
    </section>
  );

  // Consumer data error wins: a failed assets load shows retry, never a blank receipt.
  if (error) {
    return renderErrorCard(error, onRetry);
  }

  if (listStatus === 'error') {
    return renderErrorCard('Meta did not return your business list.', () => void loadBusinessList());
  }

  if (listStatus === 'loading') {
    return (
      <p role="status" className="text-sm text-[rgb(var(--muted-foreground))]">
        Loading your businesses...
      </p>
    );
  }

  if (!shouldAsk && selectedBusiness) {
    return (
      <section
        aria-label="Sharing receipt"
        className="border-l-2 border-black bg-[rgb(var(--card))] p-6 space-y-4 dark:border-white"
      >
        <div>
          <span className="label-micro">Now sharing</span>
          <p className="mt-1 text-lg font-bold text-[rgb(var(--ink))] font-display">
            Sharing from <span>{selectedBusiness.name}</span>
          </p>
          <p className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">
            The assets in this request will be shared from this business.
          </p>
          <p className="mt-2 font-mono text-xs text-[rgb(var(--muted-foreground))]">
            {formatMetaEntityIdentity(selectedBusiness.name, selectedBusiness.id)}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={startChoosing}>
          Choose a different business
        </Button>
      </section>
    );
  }

  // Zero businesses (or an escape fetch that came back empty) routes to the
  // creation path; anything else asks the one plain-language question.
  return optionBusinesses.length === 0 ? renderCreationCard() : renderQuestionCard();
}
