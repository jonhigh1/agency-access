'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useAuthOrBypass } from '@/lib/dev-auth';
import { useUserAgency } from '@/hooks/use-user-agency';
import { Check, Loader2, Lock, RefreshCw } from 'lucide-react';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import {
  trackClientChecklistResumed,
  trackInviteOpenedOncePerSession,
} from '@/lib/analytics/invite-events';
import {
  buildInviteFunnelProperties,
  setInviteFunnelContext,
} from '@/lib/analytics/invite-funnel-properties';
import { InviteFlowShell } from '@/components/flow/invite-flow-shell';
import { InviteTerminalCard } from '@/components/flow/invite-terminal-card';
import { beginRequestDeadline } from '@/lib/invite/request-deadline';
import { InviteHeroHeader } from '@/components/flow/invite-hero-header';
import { InvitePlatformStage } from '@/components/flow/invite-platform-stage';
import { InviteLoadStateCard } from '@/components/flow/invite-load-state-card';
import { InviteSupportCard } from '@/components/flow/invite-support-card';
import { InviteTrustNote } from '@/components/flow/invite-trust-note';
import { MetaFulfillmentCard } from '@/components/access-request-detail';
import { Button, SingleSelect } from '@/components/ui';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { ACCESS_LEVEL_DESCRIPTIONS, PLATFORM_NAMES, IntakeField } from '@agency-platform/shared';
import { useInviteRequestLoader } from '@/lib/query/use-invite-request-loader';
import { resolveApiUrl } from '@/lib/api/api-env';
import { ApiResponseError, parseJsonResponse } from '@/lib/api/parse-json-response';
import {
  getInviteSecuritySummary,
  isClientInviteManualPlatform,
} from '@/lib/client-invite-platforms';
import { buildInvitePlatformQueue } from '@/lib/invite-platform-queue';
import { buildInvitePlatformChecklist } from '@/lib/invite/platform-status';
import { toDisplayName } from '@/lib/display-name';
import { buildInviteRequestIdentity } from '@/lib/invite/invite-request-identity';
import {
  buildMetaSelectionPrefill,
  hasOpenMetaFulfillment,
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
        className="min-h-[220px] rounded-none bg-muted/25"
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

const SESSION_STORAGE_PREFIX = 'invite-progress:';
const CLIENT_AUTHORIZATION_STARTED_PREFIX = 'client-authorization-started:';


const isAbortError = (error: unknown) => error instanceof Error && error.name === 'AbortError';

// Shared mapper inputs for both landing resolutions (OAuth-return and plain
// hydrate); only `resume` differs between the two call sites. The mapper gets
// BOTH completed sets: `completedPlatforms` is the page's session-merged view,
// `serverCompletedPlatforms` the payload's own truth — the Meta checklist
// resume reads the server set so a stale sessionStorage entry for meta cannot
// shadow it.
const landingBaseInputs = (
  payload: ClientAccessRequestPayload,
  mergedCompleted: ReadonlySet<Platform>
): Omit<Parameters<typeof resolveInviteLandingState>[0], 'resume'> => ({
  platforms: payload.platforms || [],
  completedPlatforms: mergedCompleted,
  serverCompletedPlatforms: new Set(payload.authorizationProgress?.completedPlatforms || []),
  metaConnectionId: payload.connections?.find(
    (connection) => connection.platformGroup === 'meta'
  )?.id,
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
  const authorizationStartedTrackedRef = useRef(false);
  const platformStageRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const storageKey = `${SESSION_STORAGE_PREFIX}${token}`;
  const clerkAuth = useAuth();
  const auth = useAuthOrBypass(clerkAuth);
  const { userId, orgId, isLoaded: authIsLoaded } = auth;
  const viewerAgencyPrincipalId = orgId || userId;
  const { data: viewerAgency, isFetched: viewerAgencyFetched } = useUserAgency();
  const agencyPreviewLookupSettled =
    authIsLoaded !== false && (!viewerAgencyPrincipalId || viewerAgencyFetched);

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
  const requestIdentity = useMemo(() => {
    if (!data?.id) {
      return null;
    }
    return buildInviteRequestIdentity({
      agencyName: data.agencyName,
      id: data.id,
      createdAt: data.createdAt,
      externalReference: data.externalReference,
    });
  }, [data?.agencyName, data?.createdAt, data?.externalReference, data?.id]);

  const isComplete = useMemo(() => {
    if (!data?.platforms?.length) return false;
    return data.platforms.every((group) => completedPlatforms.has(group.platformGroup as Platform));
  }, [data, completedPlatforms]);

  // The read-side connection summary for Meta: the grant-checklist resume
  // reuses this connection instead of creating a second OAuth connection.
  const metaConnectionId = useMemo(
    () => data?.connections?.find((connection) => connection.platformGroup === 'meta')?.id,
    [data?.connections]
  );
  const metaResumeBusinessId = useMemo(
    () => data?.metaResumeSelections?.find((selection) => selection.connectionId === metaConnectionId)
      ?.clientBusinessId,
    [data?.metaResumeSelections, metaConnectionId]
  );
  const platformQueue = useMemo(
    () =>
      buildInvitePlatformQueue({
        platforms: data?.platforms || [],
        completedPlatforms,
        unresolvedProducts: data?.authorizationProgress?.unresolvedProducts,
        returningPlatform: oauthConnectionInfo?.platform ?? (urlView === 'connect' ? urlPlatform : null),
      }),
    [
      completedPlatforms,
      data?.authorizationProgress?.unresolvedProducts,
      data?.platforms,
      oauthConnectionInfo?.platform,
      urlPlatform,
      urlView,
    ]
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

  // Funnel join/exclusion props for every invite_* / client_* event fired while
  // this request is open. Layout effect so it is registered before any passive
  // effect below captures an event for the same payload.
  const inviteFunnelProperties = useMemo(
    () =>
      loadedPayload
        ? buildInviteFunnelProperties({
            accessRequestId: loadedPayload.id,
            requestAgencyId: loadedPayload.agencyId,
            viewerClerkUserId: userId ?? null,
            viewerAgencyId: viewerAgency?.id ?? null,
            requestAgencyInternal: loadedPayload.analyticsInternal,
            viewerInternal: viewerAgency?.analyticsInternal,
            isDevelopmentBypass: auth.isDevelopmentBypass,
          })
        : null,
    [
      auth.isDevelopmentBypass,
      loadedPayload,
      userId,
      viewerAgency?.analyticsInternal,
      viewerAgency?.id,
    ]
  );

  useLayoutEffect(() => {
    if (!inviteFunnelProperties) return;
    setInviteFunnelContext(inviteFunnelProperties);
    return () => setInviteFunnelContext(null);
  }, [inviteFunnelProperties]);

  // invite_opened waits for the viewer-agency lookup (like
  // client_authorization_started) so agency self-previews carry is_preview.
  useEffect(() => {
    if (!loadedPayload || urlStep || startedTrackedRef.current) return;
    if (!agencyPreviewLookupSettled) return;
    startedTrackedRef.current = true;
    trackInviteOpenedOncePerSession({
      access_request_token: token,
      access_request_id: loadedPayload.id,
      status: loadedPayload.authorizationProgress?.isComplete ? 'completed' : 'pending',
      surface: 'invite_page',
      platform_count: loadedPayload.platforms?.length || 0,
    });
  }, [agencyPreviewLookupSettled, loadedPayload, token, urlStep]);

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
    // Session storage records local navigation only. Server unresolved work
    // reopens its platform instead of allowing stale state to finalize it.
    for (const unresolved of loadedPayload.authorizationProgress?.unresolvedProducts || []) {
      mergedCompleted.delete(unresolved.platformGroup as Platform);
    }

    // A finalization or confirmed completion owns the phase from here on; a
    // hydration re-run (e.g. after OAuth params are stripped from the URL)
    // must not clobber 'finalizing'/'complete' back to 'platforms'.
    if (finalizationInFlightRef.current || completionConfirmedRef.current) {
      return;
    }

    if (urlStep === '2' && urlConnectionId && urlPlatform) {
      setIsReviewingConnectStatus(false);
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

    // A confirmed Meta selection with open grant work resumes the wizard at
    // the step-3 checklist even without OAuth params in the URL.
    if (landing.wizardStart) {
      setOauthConnectionInfo(null);
      setIsReviewingConnectStatus(false);
      setResumeWizardStart(landing.wizardStart);
    } else if (landing.phase !== 'intake') {
      setResumeWizardStart(null);
    }

    setPhase(landing.phase === 'intake' ? 'intake' : 'platforms');
  }, [
    loadedPayload,
    storageKey,
    token,
    urlConnectionId,
    urlPlatform,
    urlStep,
    urlView,
  ]);

  useEffect(() => {
    if (!loadedPayload || urlStep || authorizationStartedTrackedRef.current) return;
    if (!agencyPreviewLookupSettled) return;

    const startedSessionKey = `${CLIENT_AUTHORIZATION_STARTED_PREFIX}${token}`;
    let shouldTrackStarted = true;
    try {
      if (sessionStorage.getItem(startedSessionKey)) {
        shouldTrackStarted = false;
      } else {
        sessionStorage.setItem(startedSessionKey, '1');
      }
    } catch {
      // sessionStorage unavailable — still attempt once per mount via ref.
    }

    authorizationStartedTrackedRef.current = true;
    if (!shouldTrackStarted) return;

    const startedPlatforms = loadedPayload.platforms?.map((p) => p.platformGroup) || [];
    void capturePosthogEvent('client_authorization_started', {
      access_request_id: loadedPayload.id,
      platform: startedPlatforms[0] ?? null,
      platform_count: loadedPayload.platforms?.length || 0,
      platforms: startedPlatforms,
      has_intake_fields: loadedPayload.intakeFields?.length > 0,
      has_custom_branding:
        !!loadedPayload.branding?.logoUrl ||
        !!loadedPayload.branding?.primaryColor &&
          loadedPayload.branding.primaryColor.toUpperCase() !== '#FF6B35',
      ...inviteFunnelProperties,
    });
  }, [agencyPreviewLookupSettled, inviteFunnelProperties, loadedPayload, token, urlStep]);

  useEffect(() => {
    // Persist only once hydration has run for this token — an earlier write
    // would wipe saved progress before the hydrate reads it. Persist even
    // when empty afterwards: the checklist resume removes meta from the local
    // set, and a stale entry would re-complete meta on the next reload.
    if (intakeHydratedForTokenRef.current !== token) return;
    sessionStorage.setItem(storageKey, JSON.stringify(Array.from(completedPlatforms)));
  }, [completedPlatforms, storageKey, token]);

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
      const alreadyComplete =
        data?.authorizationProgress?.isComplete === true || data?.status === 'completed';
      if (!alreadyComplete) {
        void capturePosthogEvent('client_authorization_completed', {
          access_request_id: data?.id,
          platforms_completed: Array.from(completedPlatforms),
          total_platforms: data?.platforms?.length || 0,
        });
      }

      sessionStorage.removeItem(storageKey);
      setPhase('complete');
    } catch (error) {
      // U7: an expired or revoked request is terminal, not a retry loop (AE6).
      const errorCode = error instanceof ApiResponseError ? error.code : undefined;
      if (isTerminalRequestCode(errorCode)) {
        setForcedTerminalCode(errorCode);
        return;
      }

      if (error instanceof ApiResponseError) {
        const pendingItemCount =
          data?.metaFulfillment?.filter(
            (row) => row.status !== 'verified' && row.status !== 'excluded'
          ).length ?? 0;
        void capturePosthogEvent('client_authorization_complete_failed', {
          access_request_id: data?.id,
          code: errorCode ?? 'UNKNOWN',
          pending_item_count: pendingItemCount,
        });
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
    // Refresh first: the fulfillment card must render fresh rows before the
    // re-POST, and the refreshed payload is what finalization is judged on.
    await refreshAuthorizationProgress();
    await finalizeCompletion();
  };

  // Way back into the grant checklist from the post-completion 409 card.
  // Meta leaves the locally completed set: the grants are unverified, the
  // queue must re-activate Meta, and isComplete must drop so the
  // auto-finalize effect does not immediately re-fire the 409.
  const handleResumeMetaChecklist = () => {
    if (!data) return;
    trackClientChecklistResumed();
    setIsReviewingConnectStatus(false);
    setResumeWizardStart({
      platform: 'meta',
      step: 3,
      connectionId: metaConnectionId ?? '',
      metaSelectionPrefill: buildMetaSelectionPrefill(data.metaFulfillment),
    });
    setOauthConnectionInfo(null);
    setCompletionError(null);
    setCompletedPlatforms((prev) => {
      const next = new Set<Platform>(prev);
      next.delete('meta');
      return next;
    });
    setPhase('platforms');
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
      document.getElementById(`intake-${missingRequiredField.id}`)?.focus();
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
      access_request_id: data?.id ?? null,
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
        : isComplete ? 'Confirming account access' : 'Awaiting agency verification',
      description: isConnectStatusReview
        ? 'All requested platforms are connected. Review the status or return to the final confirmation.'
        : activePlatformName
        ? `Finish ${activePlatformName} first. The rest of the request is listed below.`
        : isComplete
        ? 'Confirming the requested account access.'
        : 'Your remaining platform reports are waiting for verification.',
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
      primaryColor={data.branding?.primaryColor}
      header={
        <InviteHeroHeader
          title={phaseCopy.title}
          description={phaseCopy.description}
          logoUrl={data.branding?.logoUrl}
          logoAlt={`${agencyDisplayName} logo`}
          requestIdentity={requestIdentity ?? undefined}
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
            <div className="border-b border-black/10 dark:border-white/10 bg-muted/10 px-6 py-5">
              <h2 className="text-xl font-semibold text-ink font-display">Quick Setup</h2>
              <p className="mt-1 text-sm text-muted-foreground">Share a few details before authorization.</p>
            </div>

            <div className="space-y-5 px-6 py-6">
              {intakeFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <label htmlFor={`intake-${field.id}`} className="block text-sm font-semibold text-ink">
                    {field.label}
                    {field.required ? <span className="ml-1 text-danger-ink">*</span> : null}
                  </label>

                  {field.type === 'textarea' ? (
                    <textarea
                      id={`intake-${field.id}`}
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
                      className="w-full px-4 py-3"
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
                      id={`intake-${field.id}`}
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
                      className="w-full px-4 py-3"
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

            <div className="flex flex-col items-stretch gap-3 border-t border-black/10 dark:border-white/10 bg-muted/10 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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

            <div className="flex flex-col items-stretch gap-3 border-t border-black/10 dark:border-white/10 bg-muted/10 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
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
                  : 'Complete this platform step, then check the request’s progress.'
              }
              exitNote={
                isClientInviteManualPlatform(platformQueue.activePlatform.platformGroup as Platform)
                  ? `Complete the native invite steps inside ${PLATFORM_NAMES[platformQueue.activePlatform.platformGroup as Platform]}, then return to this request.`
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
                metaCatalogEnabled={data.metaCatalogEnabled ?? false}
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
                    : resumeWizardStart?.platform === platformQueue.activePlatform.platformGroup
                      ? resumeWizardStart.connectionId
                      : undefined
                }
                initialStep={
                  resumeWizardStart?.platform === platformQueue.activePlatform.platformGroup
                    ? resumeWizardStart.step
                    : undefined
                }
                initialMetaSelections={
                  resumeWizardStart?.platform === platformQueue.activePlatform.platformGroup
                    ? resumeWizardStart.metaSelectionPrefill
                    : undefined
                }
                initialMetaBusinessId={
                  resumeWizardStart?.platform === platformQueue.activePlatform.platformGroup
                    ? metaResumeBusinessId
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
                metaFulfillment={data.metaFulfillment}
                metaDeclines={data.metaDeclines}
                onRequestRefresh={refreshAuthorizationProgress}
              />
            </InvitePlatformStage>
            </div>
          ) : !isConnectStatusReview ? (
            <div className="border-t border-black py-6 text-center" role="status" aria-live="polite">
              <h2 className="text-xl font-semibold text-ink font-display">Access verification is in progress</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your agency is verifying the reported access. Check again after they confirm it.
              </p>
              <Button className="mt-4" variant="secondary" onClick={refreshAuthorizationProgress}>
                Check again
              </Button>
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
                <MetaFulfillmentCard results={data.metaFulfillment || []} declines={data.metaDeclines} />
              </div>
              {hasOpenMetaFulfillment(data.metaFulfillment) &&
              data.connections?.some((connection) => connection.platformGroup === 'meta') ? (
                <Button
                  className="mt-3"
                  variant="secondary"
                  onClick={handleResumeMetaChecklist}
                >
                  Resume Meta checklist
                </Button>
              ) : null}
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
