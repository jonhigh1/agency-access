/**
 * Join/exclusion properties for invite + grant funnel events.
 *
 * Every invite_* and client_* (grant) event carries the same five keys so the
 * funnel can be joined on `access_request_id` and filtered on who fired it,
 * without names, emails, or invite tokens (all stripped since PII hardening):
 *
 * - access_request_id  join key across agency-side and client-side events
 * - agency_id          agency that owns the request (or the signed-in agency)
 * - clerk_user_id      signed-in Clerk user, or null for anonymous clients
 * - is_preview         the request's own agency is viewing its client link
 * - is_internal        AuthHub-internal agency/user (decided server-side from an
 *                      env allowlist so no ids ship in source); null = unknown
 *
 * Context is registered by the surface that knows it (the invite page, or the
 * signed-in agency lookup) and merged at the capture boundary. Explicit event
 * properties always win over context; context never adds keys to other events.
 */

export type InviteFunnelProperties = {
  access_request_id: string | null;
  agency_id: string | null;
  clerk_user_id: string | null;
  is_preview: boolean;
  is_internal: boolean | null;
};

export type BuildInviteFunnelPropertiesInput = {
  accessRequestId?: string | null;
  /** Agency that owns the access request. */
  requestAgencyId?: string | null;
  /** Signed-in viewer's Clerk user id, if any. */
  viewerClerkUserId?: string | null;
  /** Signed-in viewer's agency id, if any. */
  viewerAgencyId?: string | null;
  /** Server verdict for the request's agency (API `analyticsInternal`). */
  requestAgencyInternal?: boolean | null;
  /** Server verdict for the viewer's agency/user (API `analyticsInternal`). */
  viewerInternal?: boolean | null;
  /** Local dev-bypass sessions are always internal. */
  isDevelopmentBypass?: boolean;
};

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function buildInviteFunnelProperties(
  input: BuildInviteFunnelPropertiesInput
): InviteFunnelProperties {
  const requestAgencyId = nonEmpty(input.requestAgencyId);
  const viewerAgencyId = nonEmpty(input.viewerAgencyId);

  const isPreview = Boolean(requestAgencyId && viewerAgencyId && requestAgencyId === viewerAgencyId);

  let isInternal: boolean | null;
  if (
    input.isDevelopmentBypass === true ||
    input.requestAgencyInternal === true ||
    input.viewerInternal === true
  ) {
    isInternal = true;
  } else if (input.requestAgencyInternal === false || input.viewerInternal === false) {
    isInternal = false;
  } else {
    isInternal = null;
  }

  return {
    access_request_id: nonEmpty(input.accessRequestId),
    agency_id: requestAgencyId ?? viewerAgencyId,
    clerk_user_id: nonEmpty(input.viewerClerkUserId),
    is_preview: isPreview,
    is_internal: isInternal,
  };
}

/** invite_* and client_* (grant) events, plus the Meta asset pick inside the invite flow. */
export function isInviteFunnelEvent(event: string): boolean {
  if (event.startsWith('invite_')) return true;
  if (event === 'meta_assets_selected') return true;
  // client_list_* are agency dashboard list events, not invite/grant events.
  return event.startsWith('client_') && !event.startsWith('client_list_');
}

type AgencyViewerContext = {
  agencyId: string | null;
  clerkUserId: string | null;
  isInternal: boolean | null;
};

let inviteContext: InviteFunnelProperties | null = null;
let agencyViewerContext: AgencyViewerContext | null = null;

/** Invite page: register the loaded request's funnel properties (null on unmount). */
export function setInviteFunnelContext(context: InviteFunnelProperties | null): void {
  inviteContext = context;
}

/** Signed-in agency surfaces: register who is acting (null on sign-out). */
export function setAgencyViewerAnalyticsContext(context: AgencyViewerContext | null): void {
  // Keep a known is_internal verdict when a later caller (e.g. onboarding) only
  // knows the same agency/user but not the verdict.
  if (
    context &&
    context.isInternal === null &&
    agencyViewerContext &&
    agencyViewerContext.isInternal !== null &&
    agencyViewerContext.clerkUserId === context.clerkUserId &&
    (context.agencyId === null || agencyViewerContext.agencyId === context.agencyId)
  ) {
    agencyViewerContext = {
      agencyId: context.agencyId ?? agencyViewerContext.agencyId,
      clerkUserId: context.clerkUserId,
      isInternal: agencyViewerContext.isInternal,
    };
    return;
  }
  agencyViewerContext = context;
}

function currentContext(): InviteFunnelProperties | null {
  if (inviteContext) return inviteContext;
  if (!agencyViewerContext) return null;
  return buildInviteFunnelProperties({
    viewerAgencyId: agencyViewerContext.agencyId,
    viewerClerkUserId: agencyViewerContext.clerkUserId,
    viewerInternal: agencyViewerContext.isInternal,
  });
}

/**
 * Merge funnel context into an invite/grant event's properties. Explicit,
 * non-nullish properties win; nothing is added when no context is registered
 * or the event is not an invite/grant event.
 */
export function withInviteFunnelProperties(
  event: string,
  properties?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!isInviteFunnelEvent(event)) return properties;
  const context = currentContext();
  if (!context) return properties;

  const merged: Record<string, unknown> = { ...context };
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (value === undefined) continue;
    if (value === null && key in context && merged[key] !== null) continue;
    if (key === 'access_request_id' && value === '') continue;
    merged[key] = value;
  }
  return merged;
}

/** Test-only reset for module-level context. */
export function resetInviteFunnelContextForTests(): void {
  inviteContext = null;
  agencyViewerContext = null;
}
