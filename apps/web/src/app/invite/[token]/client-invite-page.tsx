'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, Loader2, Lock, RefreshCw } from 'lucide-react';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import { trackInviteOpenedOncePerSession } from '@/lib/analytics/invite-events';
import { InviteFlowShell } from '@/components/flow/invite-flow-shell';
import { InviteHeroHeader } from '@/components/flow/invite-hero-header';
import { InvitePlatformStage } from '@/components/flow/invite-platform-stage';
import { InviteLoadStateCard } from '@/components/flow/invite-load-state-card';
import { InviteSupportCard } from '@/components/flow/invite-support-card';
import { InviteTrustNote } from '@/components/flow/invite-trust-note';
import { MetaFulfillmentCard } from '@/components/access-request-detail';
import { Button, SingleSelect } from '@/components/ui';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { ACCESS_LEVEL_DESCRIPTIONS, PLATFORM_NAMES, IntakeField } from '@agency-platform/shared';
import { INVITE_REQUEST_TIMEOUT_MS, useInviteRequestLoader } from '@/lib/query/use-invite-request-loader';
import { resolveApiUrl } from '@/lib/api/api-env';
import { ApiResponseError, parseJsonResponse } from '@/lib/api/parse-json-response';
import {
  getInviteSecuritySummary,
  isClientInviteManualCallbackPlatform,
  isClientInviteManualPlatform,
} from '@/lib/client-invite-platforms';
import { buildInvitePlatformQueue } from '@/lib/invite-platform-queue';
import { buildInvitePlatformChecklist } from '@/lib/invite/platform-status';
import { toDisplayName } from '@/lib/display-name';
import {
  isTerminalRequestCode,
  resolveInviteLandingState,
  terminalKindFromCode,
  type InviteTerminalKind,
  type InviteWizardStart,
} from '@/lib/invite/landing-state';
import type { AccessLevel, ClientAccessRequestPayload, Platform } from '@agency-platform/shared';

const PlatformAuthWizard = dynamic(
  () =>
    import('@/components/client-auth/PlatformAuthWizard').then((m) => ({
      default: m.PlatformAuthWizard,
    })),
  {
    loading: () => (
      <div
        className="min-h-[220px] rounded-none border border-border bg-muted/25"
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
    | { status: 'error'; message: string; code?: string | null };
};

type PagePhase = 'intake' | 'platforms' | 'finalizing' | 'complete';

/**
 * Terminal landing (R3, AE6): an expired or revoked request ends the flow.
 * Agency contact path only — no retry, no "Check again", no re-entry.
 */
const TERMINAL_LANDING_COPY: Record<InviteTerminalKind, { title: string; description: string }> = {
  expired: {
    title: 'This link has expired',
    description:
      'This access request expired, so access cannot be granted. Contact your agency to get a new link.',
  },
  revoked: {
    title: 'This request was revoked',
    description:
      'Your agency withdrew this access request. Contact them if this does not look right.',
  },
  unavailable: {
    title: 'This link is no longer available',
    description: 'We could not find this access request. Contact your agency for a new link.',
  },
};

function InviteTerminalCard({
  kind,
  logoUrl,
  agencyName,
}: {
  kind: InviteTerminalKind;
  logoUrl?: string | null;
  agencyName?: string | null;
}) {
  const copy = TERMINAL_LANDING_COPY[kind];
  const displayName = toDisplayName(agencyName || '');

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-md border-2 border-black bg-card p-8 text-center shadow-brutalist">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={displayName ? `${displayName} logo` : 'Agency logo'}
            className="mx-auto mb-4 h-10 w-auto max-h-10 object-contain"
          />
        ) : null}
        <h1 className="font-display text-2xl font-semibold text-ink text-balance">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.description}</p>
        <p className="mt-2 text-sm leading-6 text-ink">
          Nothing has been shared yet. You can safely close this page.
        </p>
        <InviteSupportCard
          className="mt-6 text-left"
          title="Need a new link?"
          description="Contact your agency or support and they will send a fresh authorization link."
          linkLabel="Contact support"
        />
      </div>
    </div>
  );
}

const SESSION_STORAGE_PREFIX = 'invite-progress:';

// One shared request deadline (the loader's own timeout): aborts a stalled
// request so the client never wedges on a spinner with no exit.
const beginRequestDeadline = () => {
  const abortController = new AbortController();
  const timeoutTimer = window.setTimeout(() => abortController.abort(), INVITE_REQUEST_TIMEOUT_MS);
  return {
    signal: abortController.signal,
    settle: () => window.clearTimeout(timeoutTimer),
  };
};

const isAbortError = (error: unknown) => error instanceof Error && error.name === 'AbortError';

// Shared mapper inputs for both landing resolutions (OAuth-return and plain
// hydrate); only `resume` differs between the two call sites.
const landingBaseInputs = (
  payload: ClientAccessRequestPayload,
  mergedCompleted: ReadonlySet<Platform>
): Omit<Parameters<typeof resolveInviteLandingState>[0], 'resume'> => ({
  platforms: payload.platforms || [],
  completedPlatforms: mergedCompleted,
  unresolvedProducts: payload.authorizationProgress?.unresolvedProducts,
  requestStatus: payload.status,
  isComplete: payload.authorizationProgress?.isComplete,
  terminalErrorCode: null,
  metaFulfillment: payload.metaFulfillment,
});

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
  // U7: set when any response (load, save, refresh) carries a terminal request
  // code. Once set, the terminal card replaces the whole flow — terminal is
  // one-way (AE6).
  const [forcedTerminalCode, setForcedTerminalCode] = useState<string | null>(null);
  // U7: the share-step resume start state resolved by the landing mapper.
  const [resumeWizardStart, setResumeWizardStart] = useState<InviteWizardStart | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completionVerified, setCompletionVerified] = useState(false);
  const [intakeResponses, setIntakeResponses] = useState<Record<string, string>>({});
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [isSavingIntake, setIsSavingIntake] = useState(false);
  const [completedPlatforms, setCompletedPlatforms] = useState<Set<Platform>>(new Set());
  const [oauthConnectionInfo, setOauthConnectionInfo] = useState<{
    connectionId: string;
    platform: Platform;
  } | null>(null);
  const [isReviewingConnectStatus, setIsReviewingConnectStatus] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusCheckError, setStatusCheckError] = useState<string | null>(null);

  const finalizationInFlightRef = useRef(false);
  const completionConfirmedRef = useRef(false);
  const intakeHydratedForTokenRef = useRef<string | null>(null);
  const completionErrorRef = useRef<HTMLDivElement | null>(null);
  const startedTrackedRef = useRef(false);
  const platformStageRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const storageKey = `${SESSION_STORAGE_PREFIX}${token}`;

  const {
    data: loadedPayload,
    error: loadError,
    errorCode: loadErrorCode,
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

  // R3: one progress surface. Derived per platform from server truth plus the
  // locally completed set the page already maintains.
  const progressChecklist = useMemo(
    () =>
      buildInvitePlatformChecklist({
        platforms: data?.platforms || [],
        completedPlatforms,
        unresolvedProducts: data?.authorizationProgress?.unresolvedProducts,
      }).map((entry) => ({
        ...entry,
        isActive: entry.platform === platformQueue.activePlatform?.platformGroup,
      })),
    [completedPlatforms, data, platformQueue.activePlatform]
  );
  const activePlatformStatus = platformQueue.activePlatform
    ? progressChecklist.find(
        (entry) => entry.platform === platformQueue.activePlatform!.platformGroup
      )?.status
    : undefined;

  const railIdentities = useMemo(() => {
    if (!data) return [];

    const targets = data.manualInviteTargets || {};
    const identities: Array<{ platform: Platform; label: string; value: string }> = [];

    const emailPlatforms: Array<Platform> = ['beehiiv', 'kit', 'klaviyo', 'mailchimp'];
    for (const platform of emailPlatforms) {
      const value = (targets as any)?.[platform]?.agencyEmail;
      if (value) {
        identities.push({
          platform,
          label: `${PLATFORM_NAMES[platform]} invite email`,
          value,
        });
      }
    }

    const pinterestBusinessId = (targets as any)?.pinterest?.businessId;
    if (pinterestBusinessId) {
      identities.push({ platform: 'pinterest', label: 'Pinterest Business ID', value: pinterestBusinessId });
    }

    const shopifyDomain = (targets as any)?.shopify?.shopDomain;
    if (shopifyDomain) {
      identities.push({ platform: 'shopify', label: 'Shopify store', value: shopifyDomain });
    }

    const shopifyCollaboratorCode = (targets as any)?.shopify?.collaboratorCode;
    if (shopifyCollaboratorCode) {
      identities.push({ platform: 'shopify', label: 'Shopify collaborator code', value: shopifyCollaboratorCode });
    }

    return identities;
  }, [data]);

  const activePlatformIdentities = useMemo(() => {
    const activePlatform = platformQueue.activePlatform?.platformGroup as Platform | undefined;
    if (!activePlatform) return [];
    return railIdentities
      .filter((identity) => identity.platform === activePlatform)
      .map(({ label, value }) => ({ label, value }));
  }, [platformQueue.activePlatform?.platformGroup, railIdentities]);

  useEffect(() => {
    if (!loadedPayload) return;

    setData(loadedPayload);
    if (intakeHydratedForTokenRef.current !== token) {
      setIntakeResponses(loadedPayload.intakeResponses || {});
      intakeHydratedForTokenRef.current = token;
    }

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

    // A finalization or confirmed completion owns the phase from here on; a
    // hydration re-run (e.g. after OAuth params are stripped from the URL)
    // must not clobber 'finalizing'/'complete' back to 'platforms'.
    if (finalizationInFlightRef.current || completionConfirmedRef.current) {
      return;
    }

    if (urlStep === '2' && urlConnectionId && urlPlatform) {
      setIsReviewingConnectStatus(false);
      if (isClientInviteManualCallbackPlatform(urlPlatform)) {
        mergedCompleted = new Set<Platform>([...Array.from(mergedCompleted), urlPlatform]);
        setOauthConnectionInfo(null);
        setResumeWizardStart(null);
        setCompletedPlatforms(mergedCompleted);
        setPhase('platforms');
        return;
      }

      // U7: the OAuth return or refresh resumes the SAME connection at the
      // share step, with Meta selections prefilled from server truth. The
      // mapper owns the phase decision (R7, KTD12).
      const landing = resolveInviteLandingState({
        ...landingBaseInputs(loadedPayload, mergedCompleted),
        resume: { platform: urlPlatform, connectionId: urlConnectionId },
      });

      if (landing.wizardStart) {
        setOauthConnectionInfo({
          connectionId: landing.wizardStart.connectionId,
          platform: landing.wizardStart.platform,
        });
        setResumeWizardStart(landing.wizardStart);
      } else {
        setOauthConnectionInfo(null);
        setResumeWizardStart(null);
      }

      setCompletedPlatforms(mergedCompleted);
      setPhase(landing.phase === 'complete' ? 'complete' : 'platforms');
      if (landing.phase === 'complete') {
        completionConfirmedRef.current = true;
        setCompletionVerified(true);
      }
      return;
    }

    setCompletedPlatforms(mergedCompleted);

    const allRequestedPlatformsComplete =
      loadedPayload.platforms?.length > 0 &&
      loadedPayload.platforms.every((group) => mergedCompleted.has(group.platformGroup as Platform));

    if (urlView === 'connect') {
      setOauthConnectionInfo(null);
      setResumeWizardStart(null);
      setIsReviewingConnectStatus(allRequestedPlatformsComplete || Boolean(loadedPayload.authorizationProgress?.isComplete));
      setPhase('platforms');
      return;
    }

    const landing = resolveInviteLandingState({
      ...landingBaseInputs(loadedPayload, mergedCompleted),
      resume: null,
      metaFulfillment: loadedPayload.metaFulfillment,
    });

    if (landing.phase === 'complete') {
      setIsReviewingConnectStatus(false);
      completionConfirmedRef.current = true;
      setCompletionVerified(true);
      setPhase('complete');
      return;
    }

    if (landing.phase === 'intake') {
      setOauthConnectionInfo(null);
      setResumeWizardStart(null);
    }

    setPhase(landing.phase === 'intake' ? 'intake' : 'platforms');
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

  const finalizeCompletion = async () => {
    if (finalizationInFlightRef.current || completionConfirmedRef.current) return;

    finalizationInFlightRef.current = true;
    setCompletionError(null);
    setPhase('finalizing');

    const deadline = beginRequestDeadline();

    try {
      const response = await fetch(resolveApiUrl(`/api/client/${token}/complete`), {
        method: 'POST',
        signal: deadline.signal,
      });

      await parseJsonResponse(response, { fallbackErrorMessage: 'Failed to finalize authorization' });

      completionConfirmedRef.current = true;
      setCompletionVerified(true);
      void capturePosthogEvent('client_authorization_completed', {
        access_request_token: token,
        agency_name: data?.agencyName,
        client_name: data?.clientName,
        platforms_completed: Array.from(completedPlatforms),
        total_platforms: data?.platforms?.length || 0,
      });

      sessionStorage.removeItem(storageKey);
      setPhase('complete');
    } catch (error) {
      // U7: an expired or revoked request is terminal, not a retry loop (AE6).
      const errorCode = error instanceof ApiResponseError ? error.code : undefined;
      if (isTerminalRequestCode(errorCode)) {
        setForcedTerminalCode(errorCode);
        return;
      }

      setCompletionError(
        isAbortError(error)
          ? 'The final confirmation is taking longer than expected. Retry below.'
          : error instanceof Error
          ? error.message
          : 'Authorization was completed, but we could not finalize status. Retry below.'
      );
      setPhase('complete');
    } finally {
      deadline.settle();
      finalizationInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!data) return;
    if (isReviewingConnectStatus) return;
    const readyToComplete = phase === 'platforms' && isComplete;
    if (!readyToComplete) return;
    void finalizeCompletion();
  }, [data, phase, isComplete, token, completedPlatforms, storageKey, isReviewingConnectStatus]);

  const handleRetryComplete = async () => {
    setIsReviewingConnectStatus(false);
    await finalizeCompletion();
  };

  // Check again (KTD7): refetch GET /client/:token BEFORE any result renders.
  // The checklist state changes only after the fresh payload resolves, so the
  // pre-fetch status is never presented as a fresh result. On failure the
  // prior entries stay on screen behind an explicit failure note.
  const refreshAuthorizationProgress = async () => {
    if (isCheckingStatus) return;
    setIsCheckingStatus(true);
    setStatusCheckError(null);

    const deadline = beginRequestDeadline();

    try {
      const response = await fetch(resolveApiUrl(`/api/client/${token}`), {
        cache: 'no-store',
        signal: deadline.signal,
      });
      const result = await parseJsonResponse<{ data?: ClientAccessRequestPayload }>(response, {
        fallbackErrorMessage: 'Could not check your progress. Please try again.',
      });
      const fresh = result.data;
      if (!fresh) return;

      setData(fresh);
      setCompletedPlatforms((prev) => {
        const merged = new Set<Platform>(prev);
        for (const platform of fresh.authorizationProgress?.completedPlatforms || []) {
          merged.add(platform as Platform);
        }
        return merged;
      });
    } catch (error) {
      // U7: check-again is a refetch (KTD7); a terminal answer from it ends
      // the flow instead of surfacing a transient failure note.
      const errorCode = error instanceof ApiResponseError ? error.code : undefined;
      if (isTerminalRequestCode(errorCode)) {
        setForcedTerminalCode(errorCode);
        return;
      }
      setStatusCheckError("We couldn't check just now. Try again.");
    } finally {
      deadline.settle();
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (completionError) completionErrorRef.current?.focus();
  }, [completionError]);

  const handleIntakeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSavingIntake) return;

    const missingRequiredField = intakeFields.find(
      (field) => field.required && !(intakeResponses[field.id] || '').trim()
    );
    if (missingRequiredField) {
      setIntakeError(`Complete ${missingRequiredField.label} before continuing.`);
      return;
    }

    setIsSavingIntake(true);
    setIntakeError(null);
    setIsReviewingConnectStatus(false);

    const deadline = beginRequestDeadline();

    try {
      const response = await fetch(resolveApiUrl(`/api/client/${token}/intake`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeResponses }),
        signal: deadline.signal,
      });
      const result = await parseJsonResponse<{ data?: { intakeResponses?: Record<string, string> } }>(
        response,
        { fallbackErrorMessage: 'Could not save your responses. Please try again.' }
      );

      setIntakeResponses(result.data?.intakeResponses || intakeResponses);
      setPhase('platforms');
    } catch (error) {
      // U7: an expired request must never read as a save hiccup (AE6).
      const errorCode = error instanceof ApiResponseError ? error.code : undefined;
      if (isTerminalRequestCode(errorCode)) {
        setForcedTerminalCode(errorCode);
        return;
      }

      setIntakeError(
        isAbortError(error)
          ? 'Saving your responses is taking longer than expected. Please try again.'
          : error instanceof Error
          ? error.message
          : 'Could not save your responses. Please try again.'
      );
    } finally {
      deadline.settle();
      setIsSavingIntake(false);
    }
  };

  // An unanswered required field is only an error once a submit attempt failed.
  const showFieldUnanswered = (field: IntakeField) =>
    Boolean(intakeError && field.required && !(intakeResponses[field.id] || '').trim());

  const handlePlatformComplete = (platform: Platform) => {
    setIsReviewingConnectStatus(false);
    if (oauthConnectionInfo?.platform === platform) {
      setOauthConnectionInfo(null);
      setResumeWizardStart(null);
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
    // U7 (R3): expired and revoked load failures are terminal. The retry
    // card would read as "try the same dead link again" — never render it.
    if (isTerminalRequestCode(loadErrorCode)) {
      return <InviteTerminalCard kind={terminalKindFromCode(loadErrorCode)} />;
    }


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

  // U7: a save, verify, or refresh response said expired/revoked mid-flow.
  // The terminal card replaces everything (AE6).
  if (isTerminalRequestCode(forcedTerminalCode)) {
    return (
      <InviteTerminalCard
        kind={terminalKindFromCode(forcedTerminalCode)}
        logoUrl={data.branding?.logoUrl}
        agencyName={data.agencyName}
      />
    );
  }

  const isConnectStatusReview = phase === 'platforms' && isComplete && isReviewingConnectStatus;

  // The agency name renders on every screen; normalize an all-lowercase
  // entry for display and keep the raw value as the fallback.
  const agencyDisplayName = toDisplayName(data.agencyName) || data.agencyName;

  // Per-phase copy.
  const phaseCopyByPhase: Record<PagePhase, { title: string; description: string }> = {
    intake: {
      title: `${agencyDisplayName} needs access to finish setup`,
      description:
        intakeFields.length > 0
          ? `${agencyDisplayName} asked for a few details, then you confirm which accounts to share.`
          : `${agencyDisplayName} requested access to ${platformSummary || 'your platforms'}. Confirm which accounts to share below.`,
    },
    platforms: {
      title: isConnectStatusReview
        ? 'Review connected platforms'
        : activePlatformName
        ? `Complete ${activePlatformName} access`
        : 'Complete account access',
      description: isConnectStatusReview
        ? 'All requested platforms are connected. Review the status or return to the final confirmation.'
        : activePlatformName
        ? `Finish ${activePlatformName} first. The rest of the request is listed below.`
        : 'Finish the remaining platform connection steps.',
    },
    finalizing: {
      title: 'Confirming your authorization',
      description: 'Your connected platforms are being confirmed with the agency.',
    },
    complete: {
      title: completionError
        ? 'Access needs follow-up'
        : completionVerified
        ? `${agencyDisplayName} now has verified access`
        : 'Verifying access',
      description: completionError
        ? 'Finish the unresolved access item, then check again.'
        : completionVerified
        ? 'The selected accounts and assignees are verified.'
        : 'Checking that the selected accounts and assignees have access.',
    },
  };
  const phaseCopy = phaseCopyByPhase[phase];

  return (
    <InviteFlowShell
      title={agencyDisplayName}
      description={`Authorize access for ${data.clientName}`}
      header={
        <InviteHeroHeader
          title={phaseCopy.title}
          description={phaseCopy.description}
          logoUrl={data.branding?.logoUrl}
          logoAlt={`${agencyDisplayName} logo`}
        />
      }
      checklist={progressChecklist}
      onRefresh={
        phase === 'intake' || phase === 'platforms' ? refreshAuthorizationProgress : undefined
      }
      isRefreshing={isCheckingStatus}
      refreshError={statusCheckError}
    >
      {phase === 'intake' &&
        (intakeFields.length > 0 ? (
          <form
            onSubmit={handleIntakeSubmit}
            className="border-2 border-black bg-card shadow-brutalist overflow-hidden"
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
                      aria-invalid={showFieldUnanswered(field)}
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
                      triggerClassName="w-full border-2 border-black"
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
                      aria-invalid={showFieldUnanswered(field)}
                      className="w-full"
                    />
                  )}
                </div>
              ))}
              {intakeError ? (
                <p className="border border-danger-ink bg-coral/10 p-3 text-sm text-danger-ink" role="alert">
                  {intakeError}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col items-stretch gap-3 border-t border-border bg-muted/10 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-4 w-4" />
                {securitySummary.detail}
              </div>
              <Button type="submit" variant="primary" className="w-full sm:w-auto" isLoading={isSavingIntake}>
                Continue
              </Button>
            </div>
          </form>
        ) : (
          <div className="border-2 border-black bg-card shadow-brutalist">
            <div className="space-y-3 px-5 py-4 sm:px-6">
              <div>
                <p className="label-micro">Requested platforms</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.platforms.map((groupConfig) => {
                    const platform = groupConfig.platformGroup as Platform;

                    return (
                      <div key={platform} className="border border-black/25 bg-paper p-3.5">
                        <div className="flex items-center gap-2.5 mb-2">
                          <PlatformIcon platform={platform} size="sm" />
                          <p className="text-sm font-semibold text-ink">{PLATFORM_NAMES[platform]}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {groupConfig.products.map((product) => (
                            <span
                              key={`${platform}:${product.product}`}
                              className="border border-black/25 bg-card px-2 py-1 text-[11px] text-muted-foreground"
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

            <div className="flex flex-col items-stretch gap-3 border-t border-border bg-muted/10 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                <span>Passwords are never requested</span>
              </div>
              <Button className="w-full sm:w-auto" variant="primary" onClick={() => setPhase('platforms')}>
                Continue to connect
              </Button>
            </div>
          </div>
        ))}

      {phase === 'platforms' && (
        <div className="space-y-4">
          {isConnectStatusReview ? (
            <div className="border-2 border-black bg-card p-4">
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
                    void finalizeCompletion();
                  }}
                >
                  Confirm completion
                </Button>
              </div>
            </div>
          ) : null}

          {/* When all platforms are done, activePlatform is null - show complete view to avoid blank state */}
          {platformQueue.activePlatform ? (
            <div ref={platformStageRef}>
            <InvitePlatformStage
              platform={platformQueue.activePlatform.platformGroup as Platform}
              platformName={PLATFORM_NAMES[platformQueue.activePlatform.platformGroup as Platform]}
              status={activePlatformStatus}
              description={
                platformQueue.nextPlatform
                  ? `Complete this step, then continue to ${PLATFORM_NAMES[platformQueue.nextPlatform.platformGroup as Platform]}.`
                  : 'Complete this final platform to finish the request.'
              }
              exitNote={
                isClientInviteManualPlatform(platformQueue.activePlatform.platformGroup as Platform)
                  ? `This takes about two minutes inside ${PLATFORM_NAMES[platformQueue.activePlatform.platformGroup as Platform]}. You stay on this page.`
                  : `You will leave for ${PLATFORM_NAMES[platformQueue.activePlatform.platformGroup as Platform]} and come right back here.`
              }
              identities={activePlatformIdentities}
            >
              <PlatformAuthWizard
                key={platformQueue.activePlatform.platformGroup}
                platform={platformQueue.activePlatform.platformGroup as Platform}
                platformName={PLATFORM_NAMES[platformQueue.activePlatform.platformGroup as Platform]}
                products={platformQueue.activePlatform.products}
                accessRequestToken={token}
                metaAccessConfig={data.metaAccessConfig}
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
                initialMetaSelections={
                  resumeWizardStart?.platform === platformQueue.activePlatform.platformGroup
                    ? resumeWizardStart.metaSelectionPrefill
                    : undefined
                }
                requestAvailability={
                  isTerminalRequestCode(forcedTerminalCode)
                    ? terminalKindFromCode(forcedTerminalCode) === 'revoked'
                      ? 'revoked'
                      : 'expired'
                    : 'available'
                }
                onRequestUnavailable={(code) => setForcedTerminalCode(code)}
              />
            </InvitePlatformStage>
            </div>
          ) : null}
        </div>
      )}

      {phase === 'finalizing' && (
        <div className="border-2 border-black bg-card p-8 text-center shadow-brutalist" aria-live="polite">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-ink" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-semibold text-ink font-display">Confirming access</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your platforms are connected. We are confirming the final status with {agencyDisplayName}.
          </p>
        </div>
      )}

      {phase === 'complete' && (
        <div className="border-2 border-black bg-card p-8 shadow-brutalist text-center">
          {completionError ? (
            <div ref={completionErrorRef} role="alert" tabIndex={-1}>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-black">
                <RefreshCw className="h-8 w-8 text-danger-ink" />
              </div>
              <p className="text-2xl font-semibold text-ink font-display">
                Access needs follow-up
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                One or more selected assets or assignees are not verified yet. Complete the action below, then check again.
              </p>
              <div className="mt-4 border border-black bg-paper p-4 text-left">
                <p className="text-sm text-danger-ink">{completionError}</p>
              </div>
              <div className="mt-4 text-left">
                <MetaFulfillmentCard results={data.metaFulfillment || []} />
              </div>
              <Button
                className="mt-3"
                variant="primary"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={handleRetryComplete}
              >
                Check again
              </Button>
            </div>
          ) : !completionVerified ? (
            <div role="status" aria-live="polite">
              <Loader2 className="mx-auto mb-5 h-8 w-8 animate-spin" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Checking access. Keep this window open.</p>
            </div>
          ) : (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-black">
                <Check className="h-8 w-8 text-success-ink" />
              </div>
              <h2 className="text-2xl font-semibold text-ink font-display">
                All set — you&apos;re done
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {agencyDisplayName} now has access to the accounts you approved. Nothing else is
                needed from you.
              </p>
              <div className="mt-6 border border-black bg-paper p-4 text-left">
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
          {completionVerified && !completionError ? (
            <p className="mt-6 text-sm text-muted-foreground">
              You can safely close this window.
            </p>
          ) : null}
        </div>
      )}
    </InviteFlowShell>
  );
}
