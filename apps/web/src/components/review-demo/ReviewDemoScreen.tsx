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
  ensureReviewDemoAdAccountPartner,
  fetchReviewDemoSession,
  fetchReviewDemoStep,
  initiateReviewDemoMetaOAuth,
} from '@/lib/review-demo-api';

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
  const [partnerActionPending, setPartnerActionPending] = useState(false);

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

  const handleEnsureAdAccountPartner = async () => {
    setActionError(null);
    setPartnerActionPending(true);
    try {
      const payload = await ensureReviewDemoAdAccountPartner(getToken);
      setStepPayload(payload);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to assign agency partner');
    } finally {
      setPartnerActionPending(false);
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
                {session?.identity?.name ?? 'Not connected'}
              </p>
              {session?.identity?.id ? (
                <p className="font-mono text-xs text-muted-foreground">ID {session.identity.id}</p>
              ) : null}
              {!session?.connected ? (
                <Button className="mt-3" onClick={() => void connectMeta()} data-testid="review-demo-connect-meta">
                  Connect Meta for review demo
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
                  <h2 className="font-display text-xl font-bold">Pages list (Review BM sandbox)</h2>
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
                  <p className="text-sm text-muted-foreground">
                    Same proof path as production client onboarding — Page metadata plus recent post dates (no post text).
                  </p>
                  <div data-testid="review-demo-page-engagement-proof">
                    <p className="font-semibold">{stepPayload.page.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{stepPayload.page.id}</p>
                    {stepPayload.page.category ? (
                      <p className="text-sm text-muted-foreground">Category: {stepPayload.page.category}</p>
                    ) : null}
                    {stepPayload.page.managedTasks.length > 0 ? (
                      <p className="text-sm">Managed tasks: {stepPayload.page.managedTasks.join(', ')}</p>
                    ) : null}
                    {stepPayload.connectedInstagram ? (
                      <p className="text-sm">
                        Instagram: @{stepPayload.connectedInstagram.username} ({stepPayload.connectedInstagram.id})
                      </p>
                    ) : null}
                  </div>
                  <ul className="space-y-2" data-testid="review-demo-posts-list">
                    {stepPayload.posts.map((post) => (
                      <li key={post.id} className="border border-black/15 p-3 text-sm">
                        <p className="font-mono text-xs text-muted-foreground">{post.id}</p>
                        {post.createdTime ? <p>Created {post.createdTime}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {stepPayload.stepId === 'ads_management' ? (
                <div className="space-y-5">
                  <h2 className="font-display text-xl font-bold">Ad account agency partner</h2>
                  <p className="text-sm text-muted-foreground">
                    AuthHub adds the agency Business Portfolio as a partner on the client ad account — not ad pause/resume.
                  </p>
                  <div className="border border-black/15 p-4 text-sm" data-testid="review-demo-ad-account-summary">
                    <p className="font-semibold">{stepPayload.adAccountName ?? stepPayload.adAccountId}</p>
                    <p className="font-mono text-xs text-muted-foreground">{stepPayload.adAccountId}</p>
                  </div>
                  <div
                    className="border border-black/15 p-4 text-sm"
                    data-testid="review-demo-partner-proof"
                  >
                    <p className="label-micro mb-2">Agency partner readback</p>
                    <p className="font-semibold">
                      {stepPayload.agencyPartner.name ?? 'Agency Business Portfolio'}{' '}
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        ({stepPayload.agencyPartner.businessId})
                      </span>
                    </p>
                    <p className="mt-2">
                      Permitted tasks:{' '}
                      {stepPayload.agencyPartner.permittedTasks.length > 0
                        ? stepPayload.agencyPartner.permittedTasks.join(', ')
                        : 'None reported yet'}
                    </p>
                    <p
                      className="mt-2 font-semibold"
                      data-testid="review-demo-partner-status"
                    >
                      {stepPayload.agencyPartner.verified ? 'Partner access verified' : 'Partner not verified yet'}
                    </p>
                  </div>
                  <Button
                    data-testid="review-demo-ensure-ad-partner"
                    onClick={() => void handleEnsureAdAccountPartner()}
                    disabled={partnerActionPending || stepPayload.agencyPartner.verified}
                  >
                    {stepPayload.agencyPartner.verified
                      ? 'Agency already assigned'
                      : partnerActionPending
                        ? 'Assigning partner…'
                        : 'Add agency as ad account partner'}
                  </Button>
                </div>
              ) : null}

              {stepPayload.stepId === 'business_management' ? (
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-bold">Client Business Portfolio</h2>
                  <p className="font-semibold">{stepPayload.business.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{stepPayload.business.id}</p>
                  <div>
                    <h3 className="label-micro mb-2">Portfolio assets (production discovery path)</h3>
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
