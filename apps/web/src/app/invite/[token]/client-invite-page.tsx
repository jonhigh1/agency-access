'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, Lock, RefreshCw } from 'lucide-react';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import { trackInviteOpenedOncePerSession } from '@/lib/analytics/invite-events';
import { InviteFlowShell } from '@/components/flow/invite-flow-shell';
import { InviteHeroHeader } from '@/components/flow/invite-hero-header';
import { InvitePlatformQueueItem } from '@/components/flow/invite-platform-queue-item';
import { InvitePlatformStage } from '@/components/flow/invite-platform-stage';
import { InviteStickyRail } from '@/components/flow/invite-sticky-rail';
import { InviteLoadStateCard } from '@/components/flow/invite-load-state-card';
import { InviteTrustNote } from '@/components/flow/invite-trust-note';
import { Button, SingleSelect } from '@/components/ui';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { ACCESS_LEVEL_DESCRIPTIONS, PLATFORM_NAMES } from '@agency-platform/shared';
import { useInviteRequestLoader } from '@/lib/query/use-invite-request-loader';
import { resolveApiUrl } from '@/lib/api/api-env';
import {
  getInviteSecuritySummary,
  isClientInviteManualCallbackPlatform,
} from '@/lib/client-invite-platforms';
import { buildInvitePlatformQueue } from '@/lib/invite-platform-queue';
import type { AccessLevel, ClientAccessRequestPayload, Platform } from '@agency-platform/shared';

const PlatformAuthWizard = dynamic(
  () =>
    import('@/components/client-auth/PlatformAuthWizard').then((m) => ({
      default: m.PlatformAuthWizard,
    })),
  {
    loading: () => (
      <div
        className="min-h-[220px] rounded-xl border border-border bg-muted/25"
        aria-busy
        aria-label="Loading platform connection"
      />
    ),
  }
);

export type ClientInvitePageProps = {
  token?: string;
  serverInviteResult?:
    | { status: 'ok'; payload: ClientAccessRequestPayload }
    | { status: 'error'; message: string };
};

type PagePhase = 'intake' | 'platforms' | 'complete';

const SESSION_STORAGE_PREFIX = 'invite-progress:';

function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPlatformSummary(platforms: Platform[]): string {
  const uniqueNames = Array.from(new Set(platforms.map((platform) => PLATFORM_NAMES[platform])));

  if (uniqueNames.length <= 3) {
    return uniqueNames.join(', ');
  }

  return `${uniqueNames.slice(0, 2).join(', ')}, and ${uniqueNames.length - 2} more`;
}

export default function ClientAuthorizationPage({
  token: tokenProp,
  serverInviteResult,
}: ClientInvitePageProps = {}) {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = tokenProp ?? (params.token as string);

  const urlConnectionId = searchParams.get('connectionId');
  const urlPlatform = searchParams.get('platform') as Platform | null;
  const urlStep = searchParams.get('step');
  const urlView = searchParams.get('view');

  const [phase, setPhase] = useState<PagePhase>('intake');
  const [data, setData] = useState<ClientAccessRequestPayload | null>(() =>
    serverInviteResult?.status === 'ok' ? serverInviteResult.payload : null
  );
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [intakeResponses, setIntakeResponses] = useState<Record<string, string>>({});
  const [completedPlatforms, setCompletedPlatforms] = useState<Set<Platform>>(new Set());
  const [oauthConnectionInfo, setOauthConnectionInfo] = useState<{
    connectionId: string;
    platform: Platform;
  } | null>(null);
  const [isReviewingConnectStatus, setIsReviewingConnectStatus] = useState(false);

  const completionSubmittedRef = useRef(false);
  const startedTrackedRef = useRef(false);
  const platformStageRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const storageKey = `${SESSION_STORAGE_PREFIX}${token}`;

  const {
    data: loadedPayload,
    error: loadError,
    phase: loadPhase,
    retry: retryLoad,
  } = useInviteRequestLoader<ClientAccessRequestPayload>({
    endpoint: resolveApiUrl(`/api/client/${token}`),
    source: 'invite-core',
    serverInviteResult,
  });
  const intakeFields = data?.intakeFields ?? [];

  const requestedPlatforms = useMemo(
    () => data?.platforms?.map((group) => group.platformGroup as Platform) || [],
    [data]
  );
  const securitySummary = useMemo(() => getInviteSecuritySummary(requestedPlatforms), [requestedPlatforms]);
  const platformSummary = useMemo(() => buildPlatformSummary(requestedPlatforms), [requestedPlatforms]);

  const isComplete = useMemo(() => {
    if (!data?.platforms?.length) return false;
    return data.platforms.every((group) => completedPlatforms.has(group.platformGroup as Platform));
  }, [data, completedPlatforms]);
  const platformQueue = useMemo(
    () =>
      buildInvitePlatformQueue({
        platforms: data?.platforms || [],
        completedPlatforms,
        returningPlatform: oauthConnectionInfo?.platform ?? (urlView === 'connect' ? urlPlatform : null),
      }),
    [completedPlatforms, data?.platforms, oauthConnectionInfo?.platform, urlPlatform, urlView]
  );
  const activePlatformName = platformQueue.activePlatform
    ? PLATFORM_NAMES[platformQueue.activePlatform.platformGroup as Platform]
    : null;

  const railIdentities = useMemo(() => {
    if (!data) return [];

    const targets = data.manualInviteTargets || {};
    const identities: Array<{ label: string; value: string }> = [];

    const emailPlatforms: Array<Platform> = ['beehiiv', 'kit', 'klaviyo', 'mailchimp', 'snapchat'];
    for (const platform of emailPlatforms) {
      const value = (targets as any)?.[platform]?.agencyEmail;
      if (value) {
        identities.push({
          label: platform === 'snapchat' ? 'Snapchat Business Email' : `${PLATFORM_NAMES[platform]} invite email`,
          value,
        });
      }
    }

    const pinterestBusinessId = (targets as any)?.pinterest?.businessId;
    if (pinterestBusinessId) {
      identities.push({ label: 'Pinterest Business ID', value: pinterestBusinessId });
    }

    const shopifyDomain = (targets as any)?.shopify?.shopDomain;
    if (shopifyDomain) {
      identities.push({ label: 'Shopify store', value: shopifyDomain });
    }

    const shopifyCollaboratorCode = (targets as any)?.shopify?.collaboratorCode;
    if (shopifyCollaboratorCode) {
      identities.push({ label: 'Shopify collaborator code', value: shopifyCollaboratorCode });
    }

    return identities;
  }, [data]);

  useEffect(() => {
    if (!loadedPayload) return;

    setData(loadedPayload);

    const apiCompleted = new Set<Platform>(
      (loadedPayload.authorizationProgress?.completedPlatforms || []) as Platform[]
    );

    let sessionCompleted = new Set<Platform>();
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        sessionCompleted = new Set<Platform>(JSON.parse(raw));
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }

    let mergedCompleted = new Set<Platform>([
      ...Array.from(apiCompleted),
      ...Array.from(sessionCompleted),
    ]);

    if (!urlStep && !startedTrackedRef.current) {
      startedTrackedRef.current = true;
      const startedPlatforms = loadedPayload.platforms?.map((p) => p.platformGroup) || [];
      trackInviteOpenedOncePerSession({
        access_request_token: token,
        status: loadedPayload.authorizationProgress?.isComplete ? 'completed' : 'pending',
        surface: 'invite_page',
        agency_name: loadedPayload.agencyName,
        client_name: loadedPayload.clientName,
        platform_count: loadedPayload.platforms?.length || 0,
      });
      void capturePosthogEvent('client_authorization_started', {
        access_request_token: token,
        platform: startedPlatforms[0] ?? null,
        agency_name: loadedPayload.agencyName,
        client_name: loadedPayload.clientName,
        client_email: loadedPayload.clientEmail,
        platform_count: loadedPayload.platforms?.length || 0,
        platforms: startedPlatforms,
        has_intake_fields: loadedPayload.intakeFields?.length > 0,
        has_custom_branding: !!loadedPayload.branding?.logoUrl,
      });
    }

    if (urlStep === '2' && urlConnectionId && urlPlatform) {
      setIsReviewingConnectStatus(false);
      if (isClientInviteManualCallbackPlatform(urlPlatform)) {
        mergedCompleted = new Set<Platform>([...Array.from(mergedCompleted), urlPlatform]);
        setOauthConnectionInfo(null);
      } else {
        setOauthConnectionInfo({ connectionId: urlConnectionId, platform: urlPlatform });
      }

      setCompletedPlatforms(mergedCompleted);
      setPhase('platforms');
      return;
    }

    setCompletedPlatforms(mergedCompleted);

    const allRequestedPlatformsComplete =
      loadedPayload.platforms?.length > 0 &&
      loadedPayload.platforms.every((group) => mergedCompleted.has(group.platformGroup as Platform));

    if (urlView === 'connect') {
      setOauthConnectionInfo(null);
      setIsReviewingConnectStatus(allRequestedPlatformsComplete || Boolean(loadedPayload.authorizationProgress?.isComplete));
      setPhase('platforms');
      return;
    }

    if (allRequestedPlatformsComplete || loadedPayload.authorizationProgress?.isComplete) {
      setIsReviewingConnectStatus(false);
      setPhase('complete');
      return;
    }

    const hasStartedConnecting = mergedCompleted.size > 0;

    setPhase(hasStartedConnecting ? 'platforms' : 'intake');
  }, [loadedPayload, storageKey, token, urlConnectionId, urlPlatform, urlStep, urlView]);

  useEffect(() => {
    if (!completedPlatforms.size) return;
    sessionStorage.setItem(storageKey, JSON.stringify(Array.from(completedPlatforms)));
  }, [completedPlatforms, storageKey]);

  // Scroll platform stage into view when switching platforms (e.g. Google → Meta) to avoid blank-seeming transitions
  useLayoutEffect(() => {
    if (phase !== 'platforms' || !platformQueue.activePlatform) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    platformStageRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'instant' : 'smooth',
      block: 'start',
    });
  }, [phase, platformQueue.activePlatform?.platformGroup]);

  /**
   * Posts the completion call for both the auto-submit effect and the manual
   * retry button. Marks completionSubmittedRef on success and clears it on
   * failure so either path can retry.
   */
  const finalizeCompletion = async () => {
    try {
      const response = await fetch(resolveApiUrl(`/api/client/${token}/complete`), {
        method: 'POST',
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Failed to finalize authorization');
      }

      completionSubmittedRef.current = true;
      void capturePosthogEvent('client_authorization_completed', {
        access_request_token: token,
        agency_name: data?.agencyName,
        client_name: data?.clientName,
        platforms_completed: Array.from(completedPlatforms),
        total_platforms: data?.platforms?.length || 0,
      });

      sessionStorage.removeItem(storageKey);
    } catch (error) {
      completionSubmittedRef.current = false;
      setCompletionError(
        error instanceof Error
          ? error.message
          : 'Authorization was completed, but we could not finalize status. Retry below.'
      );
    }
  };

  useEffect(() => {
    if (!data) return;
    if (isReviewingConnectStatus) return;
    const readyToComplete = phase === 'complete' || (phase === 'platforms' && isComplete);
    if (!readyToComplete) return;
    if (phase === 'platforms' && isComplete) {
      setPhase('complete');
    }

    if (completionSubmittedRef.current) return;

    const submitCompletion = async () => {
      completionSubmittedRef.current = true;
      await finalizeCompletion();
    };

    submitCompletion();
  }, [data, phase, isComplete, token, completedPlatforms, storageKey, isReviewingConnectStatus]);

  const handleRetryComplete = async () => {
    setCompletionError(null);
    setIsReviewingConnectStatus(false);
    await finalizeCompletion();
  };

  const handleIntakeSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setIsReviewingConnectStatus(false);
    setPhase('platforms');
  };

  const handlePlatformComplete = (platform: Platform) => {
    setIsReviewingConnectStatus(false);
    if (oauthConnectionInfo?.platform === platform) {
      setOauthConnectionInfo(null);
    }

    // Clear OAuth callback params from URL to avoid stale state when switching to next platform
    if (urlConnectionId || urlPlatform || urlStep) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('connectionId');
      params.delete('platform');
      params.delete('step');
      const qs = params.toString();
      const href = (qs ? `${pathname}?${qs}` : pathname) as Parameters<
        typeof router.replace
      >[0];
      router.replace(href);
    }

    setCompletedPlatforms((prev) => {
      const updated = new Set(prev);
      updated.add(platform);
      if (data?.platforms && updated.size >= data.platforms.length) {
        queueMicrotask(() => setPhase('complete'));
      }
      return updated;
    });

    void capturePosthogEvent('client_platform_authorized', {
      access_request_token: token,
      platform,
      platform_name: PLATFORM_NAMES[platform],
      total_completed: completedPlatforms.size + 1,
      total_platforms: data?.platforms?.length || 0,
    });
  };

  if (!data) {
    return (
      <InviteLoadStateCard
        phase={loadPhase === 'ready' ? 'loading' : loadPhase}
        message={
          loadError ||
          (loadPhase === 'timeout'
            ? 'The request took too long to load. Please retry or contact your agency for a new link.'
            : 'This request link is invalid or expired. Contact your agency for a new link.')
        }
        onRetry={retryLoad}
      />
    );
  }

  const flowSteps = ['Setup', 'Connect', 'Done'];
  const flowTotalSteps = 3;
  const currentStep = phase === 'intake' ? 1 : phase === 'platforms' ? 2 : 3;
  const layoutMode = phase === 'intake' ? 'focused' : 'split';
  const isConnectStatusReview = phase === 'platforms' && isComplete && isReviewingConnectStatus;

  // Per-phase hero and rail copy.
  const phaseCopyByPhase: Record<PagePhase, {
    eyebrow?: string;
    title: string;
    description: string;
    stats: Array<{ label: string; value: string }>;
    railObjective: string;
    railActionLabel: string;
  }> = {
    intake: {
      eyebrow: undefined,
      title: `Share account access with ${toTitleCase(data.clientName)}`,
      description:
        intakeFields.length > 0
          ? 'Share a few details, then confirm which accounts to share.'
          : 'Confirm which accounts to share below, then continue.',
      stats: [
        { label: 'From', value: data.agencyName },
        { label: 'Next', value: 'Confirm what will be shared' },
      ],
      railObjective: 'Finish the remaining platform connection steps.',
      railActionLabel: 'Complete current platform step',
    },
    platforms: {
      eyebrow: `Request for ${toTitleCase(data.clientName)}`,
      title: isConnectStatusReview
        ? 'Review connected platforms'
        : activePlatformName
        ? `Complete ${activePlatformName} access`
        : 'Complete account access',
      description: isConnectStatusReview
        ? 'Review which platforms are connected or return to the final confirmation.'
        : activePlatformName
        ? `Finish ${activePlatformName} first, then continue through the remaining requested platforms.`
        : 'Finish the remaining platform connection steps.',
      stats: [
        { label: 'Platforms', value: platformSummary || 'No platforms requested' },
        {
          label: 'Next',
          value: isConnectStatusReview
            ? 'Return to final confirmation'
            : activePlatformName
            ? `Complete ${activePlatformName}`
            : 'Review completion',
        },
      ],
      railObjective: isConnectStatusReview
        ? 'Review what was connected before closing the request.'
        : 'Finish the remaining platform connection steps.',
      railActionLabel: isConnectStatusReview
        ? 'Return to final confirmation'
        : 'Complete current platform step',
    },
    complete: {
      eyebrow: `Request for ${toTitleCase(data.clientName)}`,
      title: `Share account access with ${toTitleCase(data.clientName)}`,
      description: `Review the request, confirm the access levels below, and continue only with the accounts you want to share. ${data.agencyName} requested access to ${platformSummary || 'your requested platforms'}.`,
      stats: [
        { label: 'Requested by', value: data.agencyName },
        {
          label: 'Recipient',
          value: data.clientEmail ? `${toTitleCase(data.clientName)} · ${data.clientEmail}` : toTitleCase(data.clientName),
        },
        { label: 'Platforms', value: platformSummary || 'No platforms requested' },
        { label: 'Next', value: 'Review the completed authorization' },
      ],
      railObjective: 'Review your completed authorizations.',
      railActionLabel: 'Authorization complete',
    },
  };
  const phaseCopy = phaseCopyByPhase[phase];

  return (
    <InviteFlowShell
      title={data.agencyName}
      description={`Authorize access for ${data.clientName}`}
      density="compact"
      hideStepChipsOnMobile
      header={
        <InviteHeroHeader
          eyebrow={phaseCopy.eyebrow}
          title={phaseCopy.title}
          description={phaseCopy.description}
          badge={securitySummary.badge}
          logoUrl={data.branding?.logoUrl}
          logoAlt={`${data.agencyName} logo`}
          density="compact"
          statsLayout="inline"
          hideInlineStatsOnMobile
          stats={phaseCopy.stats}
        />
      }
      step={currentStep}
      totalSteps={flowTotalSteps}
      steps={flowSteps}
      layoutMode={layoutMode}
      rail={
        <InviteStickyRail
          objective={phaseCopy.railObjective}
          securityNote={securitySummary.detail}
          identities={railIdentities}
          completedCount={completedPlatforms.size}
          totalCount={requestedPlatforms.length || 1}
          actionStatus={{
            label: phaseCopy.railActionLabel,
            disabledReason:
              phase === 'platforms' && requestedPlatforms.length > completedPlatforms.size
                ? 'Continue becomes available after platform step completion.'
                : undefined,
          }}
        />
      }
    >
      {phase === 'intake' &&
        (intakeFields.length > 0 ? (
          <form
            onSubmit={handleIntakeSubmit}
            className="rounded-lg border-2 border-black bg-card shadow-brutalist overflow-hidden"
          >
            <div className="border-b border-border bg-muted/10 px-6 py-5">
              <h2 className="text-xl font-semibold text-ink font-display">Quick Setup</h2>
              <p className="mt-1 text-sm text-muted-foreground">Share a few details before authorization.</p>
            </div>

            <div className="space-y-5 px-6 py-6">
              {intakeFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <label className="block text-sm font-semibold text-ink">
                    {field.label}
                    {field.required ? <span className="ml-1 text-danger-ink">*</span> : null}
                  </label>

                  {field.type === 'textarea' ? (
                    <textarea
                      value={intakeResponses[field.id] || ''}
                      onChange={(e) =>
                        setIntakeResponses((prev) => ({
                          ...prev,
                          [field.id]: e.target.value,
                        }))
                      }
                      required={field.required}
                      rows={4}
                      className="w-full"
                    />
                  ) : field.type === 'dropdown' ? (
                    <SingleSelect
                      options={[
                        { value: '', label: 'Select an option' },
                        ...(field.options ?? []).map((opt) => ({ value: opt, label: opt })),
                      ]}
                      value={intakeResponses[field.id] || ''}
                      onChange={(v) =>
                        setIntakeResponses((prev) => ({
                          ...prev,
                          [field.id]: v,
                        }))
                      }
                      placeholder="Select an option"
                      ariaLabel={field.label}
                      triggerClassName="w-full rounded-lg border-2 border-border"
                    />
                  ) : (
                    <input
                      type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                      value={intakeResponses[field.id] || ''}
                      onChange={(e) =>
                        setIntakeResponses((prev) => ({
                          ...prev,
                          [field.id]: e.target.value,
                        }))
                      }
                      required={field.required}
                      className="w-full"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-border bg-muted/10 px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-4 w-4" />
                {securitySummary.detail}
              </div>
              <Button type="submit" variant="primary">
                Continue
              </Button>
            </div>
          </form>
        ) : (
          <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-sm">
            <div className="space-y-3 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Requested platforms
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.platforms.map((groupConfig) => {
                    const platform = groupConfig.platformGroup as Platform;

                    return (
                      <div key={platform} className="rounded-xl border border-border bg-paper/70 p-3.5">
                        <div className="flex items-center gap-2.5 mb-2">
                          <PlatformIcon platform={platform} size="sm" />
                          <p className="text-sm font-semibold text-ink">{PLATFORM_NAMES[platform]}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {groupConfig.products.map((product) => (
                            <span
                              key={`${platform}:${product.product}`}
                              className="rounded-full border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground"
                            >
                        {`${PLATFORM_NAMES[product.product as Platform] || product.product} · ${ACCESS_LEVEL_DESCRIPTIONS[product.accessLevel as AccessLevel]?.title ?? product.accessLevel.replace(/_/g, ' ')}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <InviteTrustNote
                density="compact"
                title="Approve only what you want to share"
                description="Your agency receives access only to the accounts you explicitly approve in the next step."
              />
            </div>

            <div className="border-t border-border bg-muted/10 px-5 py-3 sm:px-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                <span>Passwords are never requested</span>
              </div>
              <Button variant="primary" onClick={() => setPhase('platforms')}>
                Continue to connect
              </Button>
            </div>
          </div>
        ))}

      {phase === 'platforms' && (
        <div className="space-y-4">
          {isConnectStatusReview ? (
            <div className="rounded-[1.5rem] border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink font-display">Review connected platforms</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    All requested platforms are connected. You can review the status below or return to the final confirmation.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsReviewingConnectStatus(false);
                    setPhase('complete');
                  }}
                >
                  Return to done
                </Button>
              </div>
            </div>
          ) : null}

          {/* When all platforms are done, activePlatform is null - show complete view to avoid blank state */}
          {platformQueue.activePlatform ? (
            <div ref={platformStageRef}>
            <InvitePlatformStage
              platformName={PLATFORM_NAMES[platformQueue.activePlatform.platformGroup as Platform]}
              description={
                platformQueue.nextPlatform
                  ? `Complete this step, then continue to ${PLATFORM_NAMES[platformQueue.nextPlatform.platformGroup as Platform]}.`
                  : 'Complete this final platform to finish the request.'
              }
              remainingCount={platformQueue.remainingPlatforms.length}
              completedCount={platformQueue.completedPlatforms.length}
              totalCount={requestedPlatforms.length}
              nextPlatformName={
                platformQueue.nextPlatform
                  ? PLATFORM_NAMES[platformQueue.nextPlatform.platformGroup as Platform]
                  : null
              }
            >
              <PlatformAuthWizard
                key={platformQueue.activePlatform.platformGroup}
                platform={platformQueue.activePlatform.platformGroup as Platform}
                platformName={PLATFORM_NAMES[platformQueue.activePlatform.platformGroup as Platform]}
                products={platformQueue.activePlatform.products}
                accessRequestToken={token}
                deferManualRedirect={urlView === 'connect'}
                onComplete={() =>
                  handlePlatformComplete(platformQueue.activePlatform!.platformGroup as Platform)
                }
                completionActionLabel={
                  platformQueue.nextPlatform
                    ? `Continue to ${PLATFORM_NAMES[platformQueue.nextPlatform.platformGroup as Platform]}`
                    : 'Finish'
                }
                initialConnectionId={
                  oauthConnectionInfo?.platform === platformQueue.activePlatform.platformGroup
                    ? oauthConnectionInfo.connectionId
                    : undefined
                }
                initialStep={
                  oauthConnectionInfo?.platform === platformQueue.activePlatform.platformGroup ? 2 : undefined
                }
              />
            </InvitePlatformStage>
            </div>
          ) : null}

          {platformQueue.remainingPlatforms.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Remaining in queue
                </h3>
                <p className="text-sm text-muted-foreground">
                  {platformQueue.remainingPlatforms.length} platform
                  {platformQueue.remainingPlatforms.length === 1 ? '' : 's'} left after this
                </p>
              </div>

              <div className="space-y-2">
                {platformQueue.remainingPlatforms.map((groupConfig) => (
                  <InvitePlatformQueueItem
                    key={groupConfig.platformGroup}
                    platform={groupConfig.platformGroup as Platform}
                    platformName={PLATFORM_NAMES[groupConfig.platformGroup as Platform]}
                    description="Queued until the current platform is finished."
                    status="up-next"
                    sequenceLabel={`Then ${PLATFORM_NAMES[groupConfig.platformGroup as Platform]}`}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {platformQueue.completedPlatforms.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Completed
              </h3>
              <div className="space-y-3">
                {platformQueue.completedPlatforms.map((groupConfig) => (
                  <InvitePlatformQueueItem
                    key={groupConfig.platformGroup}
                    platform={groupConfig.platformGroup as Platform}
                    platformName={PLATFORM_NAMES[groupConfig.platformGroup as Platform]}
                    description="Access confirmed for this platform."
                    status="completed"
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {phase === 'complete' && (
        <div className="rounded-lg border-2 border-black bg-card p-8 shadow-brutalist text-center">
          {completionError ? (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-coral bg-coral/10">
                <RefreshCw className="h-8 w-8 text-danger-ink" />
              </div>
              <h2 className="text-2xl font-semibold text-ink font-display">
                Almost done — finalize failed
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                All platforms are connected, but we couldn&apos;t confirm completion with your
                agency.
              </p>
              <div className="mt-4 rounded-lg border border-coral/30 bg-coral/10 p-4 text-left">
                <p className="text-sm text-danger-ink">{completionError}</p>
              </div>
              <Button
                className="mt-3"
                variant="primary"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={handleRetryComplete}
              >
                Retry Finalization
              </Button>
            </>
          ) : (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-teal bg-teal/10">
                <Check className="h-8 w-8 text-success-ink" />
              </div>
              <h2 className="text-2xl font-semibold text-ink font-display">
                All set — you&apos;re done
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {data.agencyName} now has access to the accounts you approved. Nothing else is
                needed from you.
              </p>
              <div className="mt-6 rounded-lg border border-border bg-muted/10 p-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Connected Platforms
                </p>
                <p className="mt-2 text-sm text-ink">
                  {Array.from(completedPlatforms)
                    .map((platform) => PLATFORM_NAMES[platform])
                    .join(', ') || 'No platforms connected'}
                </p>
              </div>
            </>
          )}
          <p className="mt-6 text-sm text-muted-foreground">
            You can safely close this window.
          </p>
        </div>
      )}
    </InviteFlowShell>
  );
}
