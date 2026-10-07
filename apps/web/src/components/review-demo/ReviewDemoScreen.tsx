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
import { cn } from '@/lib/utils';
import {
  fetchReviewDemoSession,
  fetchReviewDemoStep,
  initiateReviewDemoMetaOAuth,
  pauseReviewDemoTestAd,
  resumeReviewDemoTestAd,
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
  const [pauseProof, setPauseProof] = useState<string | null>(null);

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
    setPauseProof(null);
    setActiveStep(step);
  };

  const handlePause = async (adId?: string) => {
    setActionError(null);
    try {
      const result = await pauseReviewDemoTestAd(getToken, adId);
      setPauseProof(`Paused ad ${result.adId} (${result.effectiveStatus})`);
      await reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to pause test ad');
    }
  };

  const handleResume = async (adId?: string) => {
    setActionError(null);
    try {
      const result = await resumeReviewDemoTestAd(getToken, adId);
      setPauseProof(`Resumed ad ${result.adId} (${result.effectiveStatus})`);
      await reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to resume test ad');
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
                  <button
                    type="button"
                    data-testid={`review-demo-step-tab-${step}`}
                    className={cn(
                      'w-full border-2 px-4 py-3 text-left transition-transform',
                      isActive
                        ? 'border-[var(--ink)] bg-[rgb(var(--coral))]/15 shadow-brutalist-sm translate-x-0'
                        : 'border-black/20 bg-white hover:border-[var(--ink)]'
                    )}
                    onClick={() => goToStep(step)}
                  >
                    <span className="label-nano block text-muted-foreground">
                      Step {index + 1} of {REVIEW_DEMO_STEP_ORDER.length}
                    </span>
                    <span className="font-mono text-sm font-semibold">{REVIEW_DEMO_STEP_LABELS[step]}</span>
                  </button>
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
                  <h2 className="font-display text-xl font-bold">Page posts & engagement</h2>
                  <p className="font-semibold">{stepPayload.page.name}</p>
                  <ul className="space-y-2" data-testid="review-demo-posts-list">
                    {stepPayload.posts.map((post) => (
                      <li key={post.id} className="border border-black/15 p-3 text-sm">
                        <p className="font-mono text-xs text-muted-foreground">{post.id}</p>
                        {post.createdTime ? <p>{post.createdTime}</p> : null}
                        {post.messagePreview ? <p className="mt-1">{post.messagePreview}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {stepPayload.stepId === 'ads_management' ? (
                <div className="space-y-5">
                  <h2 className="font-display text-xl font-bold">Campaigns & test ad control</h2>
                  <p className="text-sm text-muted-foreground">
                    Ad account {stepPayload.adAccountName ?? stepPayload.adAccountId}
                  </p>
                  <div>
                    <h3 className="label-micro mb-2">Campaigns</h3>
                    <ul className="space-y-2" data-testid="review-demo-campaigns-list">
                      {stepPayload.campaigns.map((campaign) => (
                        <li key={campaign.id} className="border border-black/15 p-3 text-sm">
                          <p className="font-semibold">{campaign.name}</p>
                          <p className="font-mono text-xs">{campaign.id}</p>
                          {campaign.effectiveStatus ? (
                            <p className="text-muted-foreground">Status: {campaign.effectiveStatus}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="label-micro mb-2">Ads</h3>
                    <ul className="space-y-2" data-testid="review-demo-ads-list">
                      {stepPayload.ads.map((ad) => (
                        <li key={ad.id} className="border border-black/15 p-3 text-sm">
                          <p className="font-semibold">{ad.name}</p>
                          <p className="font-mono text-xs">{ad.id}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      data-testid="review-demo-pause-ad"
                      onClick={() => void handlePause(stepPayload.pauseTargetAd?.id)}
                      disabled={!stepPayload.pauseTargetAd}
                    >
                      Pause test ad (reversible)
                    </Button>
                    <Button
                      variant="secondary"
                      data-testid="review-demo-resume-ad"
                      onClick={() => void handleResume(stepPayload.pausedAd?.id ?? stepPayload.pauseTargetAd?.id)}
                    >
                      Resume test ad
                    </Button>
                  </div>
                  {pauseProof ? (
                    <p className="border-2 border-success-ink bg-[rgb(var(--teal))]/10 p-3 text-sm" data-testid="review-demo-pause-proof">
                      {pauseProof}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {stepPayload.stepId === 'business_management' ? (
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-bold">Business Manager assets & catalog</h2>
                  <p className="font-semibold">{stepPayload.business.name}</p>
                  <div>
                    <h3 className="label-micro mb-2">Catalogs</h3>
                    <ul className="space-y-2" data-testid="review-demo-catalog-list">
                      {stepPayload.catalogs.map((catalog) => (
                        <li key={catalog.id} className="border border-black/15 p-3 text-sm">
                          <p className="font-semibold">{catalog.name}</p>
                          <p className="font-mono text-xs">{catalog.id}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="label-micro mb-2">BM assets</h3>
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
