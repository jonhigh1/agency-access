'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@clerk/nextjs';
import {
  REVIEW_DEMO_STEP_LABELS,
  REVIEW_DEMO_STEP_ORDER,
  type ReviewDemoSession,
  type ReviewDemoStepId,
  type ReviewDemoStepPayload,
} from '@agency-platform/shared';
import { Button } from '@/components/ui/button';
import {
  addReviewDemoPagePartner,
  checkReviewDemoAdAccountAccess,
  disconnectReviewDemoMeta,
  fetchReviewDemoSession,
  fetchReviewDemoStep,
  initiateReviewDemoMetaOAuth,
} from '@/lib/review-demo-api';
import { ReviewDemoManualAdAccountPanel } from './ReviewDemoManualAdAccountPanel';

interface ReviewDemoScreenProps {
  initialStep?: ReviewDemoStepId;
}

export function ReviewDemoScreen({ initialStep = 'pages_show_list' }: ReviewDemoScreenProps) {
  const { getToken } = useAuth();
  const [activeStep, setActiveStep] = useState<ReviewDemoStepId>(initialStep);
  const [session, setSession] = useState<ReviewDemoSession | null>(null);
  const [stepPayload, setStepPayload] = useState<ReviewDemoStepPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkAccessPending, setCheckAccessPending] = useState(false);
  const [pagePartnerPending, setPagePartnerPending] = useState(false);
  const sessionLoading = loading && session === null;

  const stepIndex = useMemo(
    () => REVIEW_DEMO_STEP_ORDER.indexOf(activeStep),
    [activeStep]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const nextSession = await fetchReviewDemoSession(getToken, activeStep);
      setSession(nextSession);
      if (nextSession.connected) {
        const payload = await fetchReviewDemoStep(getToken, activeStep);
        setStepPayload(payload);
      } else {
        setStepPayload(null);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to load review demo');
      setStepPayload(null);
    } finally {
      setLoading(false);
    }
  }, [activeStep, getToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const connectMeta = async () => {
    setActionError(null);
    try {
      const { authUrl } = await initiateReviewDemoMetaOAuth(getToken);
      window.location.assign(authUrl);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to start Meta OAuth');
    }
  };

  const goToStep = (step: ReviewDemoStepId) => {
    setActiveStep(step);
  };

  const handleDisconnectMeta = async () => {
    setActionError(null);
    try {
      await disconnectReviewDemoMeta(getToken);
      setSession(null);
      setStepPayload(null);
      await reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to disconnect Meta');
    }
  };

  const handleAddPagePartner = async () => {
    setActionError(null);
    setPagePartnerPending(true);
    try {
      const payload = await addReviewDemoPagePartner(getToken);
      setStepPayload(payload);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to add agency to Page');
    } finally {
      setPagePartnerPending(false);
    }
  };

  const handleCheckAdAccountAccess = async () => {
    setActionError(null);
    setCheckAccessPending(true);
    try {
      const payload = await checkReviewDemoAdAccountAccess(getToken);
      setStepPayload(payload);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to check ad account access');
    } finally {
      setCheckAccessPending(false);
    }
  };

  const permissionLabel = REVIEW_DEMO_STEP_LABELS[activeStep];

  return (
    <div
      className="min-h-screen bg-[var(--paper)] text-[var(--ink)]"
      data-testid="review-demo-root"
    >
      <header
        className="border-b-4 border-[var(--ink)] bg-white px-6 py-5"
        data-testid="review-demo-permission-banner"
      >
        <p className="label-micro text-[var(--ink)]">Meta App Review — active permission</p>
        <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight md:text-4xl">{permissionLabel}</h1>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4" data-testid="review-demo-step-nav">
          <p className="label-micro">Guided steps</p>
          <ol className="space-y-2">
            {REVIEW_DEMO_STEP_ORDER.map((step, index) => {
              const isActive = step === activeStep;
              return (
                <li key={step}>
                  <Button
                    type="button"
                    variant={isActive ? 'primary' : 'secondary'}
                    data-testid={`review-demo-step-tab-${step}`}
                    className="h-auto w-full justify-start px-4 py-3 text-left"
                    aria-current={isActive ? 'step' : undefined}
                    onClick={() => goToStep(step)}
                  >
                    <span className="label-nano block w-full text-muted-foreground">
                      Step {index + 1} of {REVIEW_DEMO_STEP_ORDER.length}
                    </span>
                    <span className="font-mono text-sm font-semibold">{REVIEW_DEMO_STEP_LABELS[step]}</span>
                  </Button>
                </li>
              );
            })}
          </ol>
          <p className="text-sm text-muted-foreground" data-testid="review-demo-step-progress">
            Step {stepIndex + 1} of {REVIEW_DEMO_STEP_ORDER.length}
          </p>
        </aside>

        <main className="space-y-6">
          <section
            className="flex items-center gap-5 border-2 border-[var(--ink)] bg-white p-5 shadow-brutalist-sm"
            data-testid="review-demo-identity"
          >
            {session?.identity?.pictureUrl ? (
              <Image
                src={session.identity.pictureUrl}
                alt=""
                width={112}
                height={112}
                className="h-28 w-28 border-2 border-[var(--ink)] object-cover"
                data-testid="review-demo-identity-photo"
                unoptimized
              />
            ) : (
              <div
                className="flex h-28 w-28 items-center justify-center border-2 border-[var(--ink)] bg-[rgb(var(--warm-gray))]/30 font-display text-2xl font-bold"
                data-testid="review-demo-identity-photo-placeholder"
                aria-hidden="true"
              >
                ?
              </div>
            )}
            <div>
              <p className="label-micro">Connected Meta identity</p>
              <p className="font-display text-2xl font-bold" data-testid="review-demo-identity-name">
                {sessionLoading
                  ? 'Loading session…'
                  : session?.identity?.name ?? 'Not connected'}
              </p>
              {sessionLoading ? (
                <p className="text-sm text-muted-foreground" data-testid="review-demo-session-loading">
                  Checking Meta connection…
                </p>
              ) : null}
              {session?.identity?.id ? (
                <p className="font-mono text-xs text-muted-foreground">ID {session.identity.id}</p>
              ) : null}
              {!sessionLoading && session && !session.connected ? (
                <Button className="mt-3" onClick={() => void connectMeta()} data-testid="review-demo-connect-meta">
                  Connect Meta for review demo
                </Button>
              ) : null}
              {!sessionLoading && session?.connected ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  data-testid="review-demo-disconnect-meta"
                  onClick={() => void handleDisconnectMeta()}
                >
                  Disconnect Meta
                </Button>
              ) : null}
            </div>
          </section>

          {actionError ? (
            <div className="border-2 border-danger-ink bg-[rgb(var(--coral))]/10 p-4 text-sm" role="alert">
              {actionError}
            </div>
          ) : null}

          {loading ? (
            <p role="status" className="text-sm text-muted-foreground" data-testid="review-demo-loading">
              Loading review proof…
            </p>
          ) : null}

          {!loading && session?.connected && stepPayload ? (
            <section
              className="border-2 border-[var(--ink)] bg-white p-6 shadow-brutalist-sm"
              data-testid={`review-demo-step-panel-${activeStep}`}
            >
              {stepPayload.stepId === 'pages_show_list' ? (
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-bold">
                    {session?.usesSandboxAssets ? 'Pages list (Review BM sandbox)' : 'Pages list (granted at consent)'}
                  </h2>
                  {stepPayload.emptyState ? (
                    <p className="text-sm text-muted-foreground" data-testid="review-demo-empty-state">
                      {stepPayload.emptyState.message}
                    </p>
                  ) : null}
                  <ul className="space-y-3" data-testid="review-demo-pages-list">
                    {stepPayload.pages.map((page) => (
                      <li key={page.id} className="flex items-center gap-3 border border-black/15 p-3">
                        {page.pictureUrl ? (
                          <Image src={page.pictureUrl} alt="" width={48} height={48} className="h-12 w-12 object-cover" unoptimized />
                        ) : null}
                        <div>
                          <p className="font-semibold">{page.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{page.id}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {stepPayload.stepId === 'pages_read_engagement' ? (
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-bold">Validate Page access</h2>
                  <p className="text-sm text-muted-foreground" data-testid="review-demo-page-proof-purpose">
                    AuthHub reads these Page details to confirm it&apos;s the right Page before your agency is
                    added.
                  </p>
                  {stepPayload.emptyState ? (
                    <p className="text-sm text-muted-foreground" data-testid="review-demo-empty-state">
                      {stepPayload.emptyState.message}
                    </p>
                  ) : null}
                  {stepPayload.page ? (
                    <div data-testid="review-demo-page-engagement-proof">
                      <p className="font-semibold">{stepPayload.page.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{stepPayload.page.id}</p>
                      {stepPayload.page.category ? (
                        <p className="text-sm text-muted-foreground">Category: {stepPayload.page.category}</p>
                      ) : null}
                      {typeof stepPayload.page.fanCount === 'number' ? (
                        <p className="text-sm" data-testid="review-demo-page-fan-count">
                          Fans: {stepPayload.page.fanCount.toLocaleString()}
                        </p>
                      ) : null}
                      {typeof stepPayload.page.followerCount === 'number' ? (
                        <p className="text-sm" data-testid="review-demo-page-follower-count">
                          Followers: {stepPayload.page.followerCount.toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {stepPayload.stepId === 'ads_management' ? (
                <>
                  {stepPayload.emptyState ? (
                    <p className="mb-4 text-sm text-muted-foreground" data-testid="review-demo-empty-state">
                      {stepPayload.emptyState.message}
                    </p>
                  ) : null}
                <ReviewDemoManualAdAccountPanel
                  agencyBusinessId={stepPayload.agencyPartner.businessId}
                  agencyBusinessName={stepPayload.agencyPartner.name}
                  adAccountId={stepPayload.adAccountId ?? '—'}
                  adAccountName={stepPayload.adAccountName}
                  verified={stepPayload.agencyPartner.verified}
                  permittedTasks={stepPayload.agencyPartner.permittedTasks}
                  pendingMessage={stepPayload.agencyPartner.pendingMessage}
                  metaErrorCode={stepPayload.agencyPartner.metaErrorCode}
                  metaErrorMessage={stepPayload.agencyPartner.metaErrorMessage}
                  checking={checkAccessPending}
                  onCheckAccess={() => void handleCheckAdAccountAccess()}
                />
                </>
              ) : null}

              {stepPayload.stepId === 'business_management' ? (
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-bold">Client Business Portfolio</h2>
                  {stepPayload.stepCaption ? (
                    <p className="text-sm text-muted-foreground" data-testid="review-demo-bm-step-caption">
                      {stepPayload.stepCaption}
                    </p>
                  ) : null}
                  {stepPayload.business ? (
                    <>
                      <p className="font-semibold">{stepPayload.business.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{stepPayload.business.id}</p>
                    </>
                  ) : null}
                  {stepPayload.emptyState ? (
                    <p className="text-sm text-muted-foreground" data-testid="review-demo-empty-state">
                      {stepPayload.emptyState.message}
                    </p>
                  ) : null}
                  {stepPayload.sandboxMisconfigured ? (
                    <p
                      className="border-2 border-danger-ink bg-[rgb(var(--coral))]/10 p-4 text-sm"
                      role="alert"
                      data-testid="review-demo-bm-misconfigured"
                    >
                      {stepPayload.sandboxMisconfiguredMessage ??
                        'Review sandbox IDs are not configured on the API service.'}
                    </p>
                  ) : null}
                  <div>
                    <h3 className="label-micro mb-2">
                      {session?.usesSandboxAssets ? 'Review sandbox assets (scoped)' : 'Granted assets (scoped)'}
                    </h3>
                    <ul className="space-y-2" data-testid="review-demo-bm-assets-list">
                      {stepPayload.assets.map((asset) => (
                        <li key={`${asset.kind}-${asset.id}`} className="border border-black/15 p-3 text-sm">
                          <p className="font-semibold">{asset.name}</p>
                          <p className="font-mono text-xs">
                            {asset.kind} · {asset.id}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="border border-black/15 p-4 text-sm" data-testid="review-demo-bm-page-partner">
                    <p className="label-micro mb-2">Add agency to Page</p>
                    <p className="text-sm text-muted-foreground">
                      Runs the same production Page partner POST AuthHub uses in client authorization, then Graph
                      readback.
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      className="mt-3"
                      data-testid="review-demo-add-page-partner"
                      disabled={pagePartnerPending}
                      onClick={() => void handleAddPagePartner()}
                    >
                      {pagePartnerPending ? 'Adding…' : 'Add agency to Page'}
                    </Button>
                    {stepPayload.pagePartner ? (
                      <div className="mt-3 space-y-1">
                        <p
                          className="font-semibold"
                          data-testid={
                            stepPayload.pagePartner.verified
                              ? 'review-demo-page-partner-verified'
                              : undefined
                          }
                        >
                          Page {stepPayload.pagePartner.assetId} —{' '}
                          {stepPayload.pagePartner.verified ? 'Verified' : 'Not verified'}
                        </p>
                        {stepPayload.pagePartner.pendingMessage ? (
                          <p className="text-sm text-muted-foreground" data-testid="review-demo-page-partner-pending">
                            {stepPayload.pagePartner.pendingMessage}
                          </p>
                        ) : null}
                        <p>Tasks: {stepPayload.pagePartner.permittedTasks.join(', ') || 'None reported'}</p>
                        {stepPayload.pagePartner.graphError ? (
                          <p className="font-mono text-xs" data-testid="review-demo-page-partner-graph-error">
                            Meta #{stepPayload.pagePartner.graphError.code ?? '—'} (subcode{' '}
                            {stepPayload.pagePartner.graphError.errorSubcode ?? '—'}):{' '}
                            {stepPayload.pagePartner.graphError.message}
                            {stepPayload.pagePartner.graphError.fbtraceId
                              ? ` [fbtrace_id ${stepPayload.pagePartner.graphError.fbtraceId}]`
                              : ''}
                          </p>
                        ) : null}
                        {stepPayload.pagePartner.rawGraphResponse ? (
                          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs">
                            {stepPayload.pagePartner.rawGraphResponse}
                          </pre>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="border border-black/15 p-4 text-sm" data-testid="review-demo-bm-partner-proof">
                    <p className="label-micro mb-2">Agency partner on review ad account</p>
                    <p className="font-semibold">
                      {stepPayload.agencyPartner.name ?? 'Agency Business Portfolio'} on{' '}
                      {stepPayload.agencyPartner.assetId}
                    </p>
                    <p className="mt-1">
                      Tasks: {stepPayload.agencyPartner.permittedTasks.join(', ') || 'None reported'}
                    </p>
                    <p className="mt-1 font-semibold">
                      {stepPayload.agencyPartner.verified ? 'Verified via Graph readback' : 'Pending partner share'}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 border-t border-black/10 pt-4">
                <h3 className="label-micro mb-2">Graph operations (caption-friendly)</h3>
                <ul className="space-y-1 font-mono text-xs" data-testid="review-demo-graph-captions">
                  {stepPayload.graphCaptions.map((caption) => (
                    <li key={caption}>{caption}</li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
