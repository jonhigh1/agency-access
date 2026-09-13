'use client';

import { AppProviders } from '../app-providers';
import { useAuth, UserButton } from '@clerk/nextjs';
import { redirect, usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar';
import { LogoSpinner } from '@/components/ui/logo-spinner';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { HelpScoutBeacon } from '@/components/help-scout-beacon';
import { getDocsUrl } from '@/lib/docs-url';
import {
  LayoutDashboard,
  Network,
  HeartPulse,
  UsersRound,
  Settings,
  CircleHelp,
} from 'lucide-react';
import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useAuthOrBypass, signOutDevBypass } from '@/lib/dev-auth';
import { readPerfHarnessContext, startPerfTimer } from '@/lib/perf-harness';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import { TrialBanner } from '@/components/trial-banner';
import { useSubscription } from '@/lib/query/billing';
import { shouldEnforceOnboardingRedirect, useAgencyOnboardingStatus, type AgencyOnboardingStatusData } from '@/lib/query/onboarding';
import { useUserAgency } from '@/hooks/use-user-agency';
import { trackOnboardingEvent } from '@/lib/analytics/onboarding';
import { SUBSCRIPTION_TIER_NAMES } from '@agency-platform/shared';

const agencyRedirectCache = new Map<string, boolean>();
const inAppUserButtonAppearance = {
  elements: {
    userButtonTrigger: 'clerk-user-trigger',
    userButtonAvatarBox: 'clerk-user-avatar',
    userButtonPopoverRootBox: 'clerk-user-popover-root',
    userButtonPopoverCard: 'clerk-user-popover',
    userButtonPopoverMain: 'clerk-user-popover-main',
    userButtonPopoverActions: 'clerk-user-popover-actions',
    userButtonPopoverActionButton: 'clerk-user-popover-action',
    menuList: 'clerk-user-menu-list',
    menuItem: 'clerk-user-menu-item',
    menuButton: 'clerk-user-menu-button',
    userButtonPopoverActionButtonIconBox: 'clerk-user-popover-action-icon-box',
    userButtonPopoverActionButtonIcon: 'clerk-user-popover-action-icon',
    userButtonPopoverFooter: 'clerk-user-popover-footer',
    userPreview: 'clerk-user-preview',
    userPreviewTextContainer: 'clerk-user-preview-text',
    userPreviewMainIdentifier: 'clerk-user-preview-name',
    userPreviewSecondaryIdentifier: 'clerk-user-preview-email',
  },
};

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProviders>
      <Suspense fallback={<AuthenticatedLayoutFallback />}>
        <AuthenticatedLayoutInner>{children}</AuthenticatedLayoutInner>
      </Suspense>
    </AppProviders>
  );
}

function AuthenticatedLayoutFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <LogoSpinner size="lg" />
        <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function AuthenticatedLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const clerkAuth = useAuth();
  const { userId, isLoaded, orgId, isDevelopmentBypass } = useAuthOrBypass(clerkAuth);
  const perfHarness = useMemo(() => readPerfHarnessContext(), []);
  const runPerfAgencyCheck = isDevelopmentBypass && !!perfHarness?.token;
  const [open, setOpen] = useState(true);
  const pathname = usePathname();
  const isDashboardRootPath = pathname === '/dashboard';
  const { data: subscription } = useSubscription({ enabled: !isDashboardRootPath });
  const router = useRouter();
  const previousPathname = useRef(pathname);
  const sharedPrincipalId = !isDevelopmentBypass ? (orgId || userId) : null;
  const getLayoutAuthToken = useCallback(
    async () => (await clerkAuth.getToken()) || perfHarness?.token || null,
    [clerkAuth, perfHarness?.token]
  );
  const { data: sharedAgency, isFetched: isAgencyFetched } = useUserAgency({
    principalClerkId: sharedPrincipalId,
    getAuthToken: getLayoutAuthToken,
    enabled: !isDashboardRootPath && !!sharedPrincipalId,
  });
  const { data: sharedOnboardingStatus, isFetched: isOnboardingStatusFetched } = useAgencyOnboardingStatus(
    runPerfAgencyCheck ? undefined : sharedAgency?.id
  );

  // Redirect unauthenticated users (skip in bypass mode)
  if (!isDevelopmentBypass && isLoaded && !userId) {
    redirect('/');
  }

  // Check if user has an agency and redirect to onboarding if needed
  useEffect(() => {
    const checkAgencyAndRedirect = async () => {
      const wasOnboarding = previousPathname.current?.startsWith('/onboarding');
      if (wasOnboarding && pathname && !pathname.startsWith('/onboarding')) {
        agencyRedirectCache.clear();
      }
      previousPathname.current = pathname;

      // Skip if already on onboarding page
      if (!pathname || pathname.startsWith('/onboarding') || isDashboardRootPath) {
        return;
      }

      // In bypass mode, skip agency check (we have a mock agency)
      if (isDevelopmentBypass && !runPerfAgencyCheck) {
        return;
      }

      if (!isLoaded || !userId) {
        return;
      }

      if (!runPerfAgencyCheck) {
        if (!isAgencyFetched || !sharedPrincipalId) return;
        const cacheKey = `${sharedPrincipalId}:${sharedAgency?.id || 'none'}`;
        const cachedDecision = agencyRedirectCache.get(cacheKey);
        if (cachedDecision !== undefined) {
          if (cachedDecision && sharedOnboardingStatus && !shouldEnforceOnboardingRedirect(sharedOnboardingStatus)) {
            agencyRedirectCache.set(cacheKey, false);
            return;
          }
          if (cachedDecision) router.replace('/onboarding/unified');
          return;
        }
        if (!sharedAgency) {
          agencyRedirectCache.set(cacheKey, true);
          router.replace('/onboarding/unified');
          return;
        }
        if (!isOnboardingStatusFetched || !sharedOnboardingStatus) return;
        const shouldRedirect = shouldEnforceOnboardingRedirect(sharedOnboardingStatus);
        agencyRedirectCache.set(cacheKey, shouldRedirect);
        if (shouldRedirect) router.replace('/onboarding/unified');
        return;
      }

      let stopTimer: (() => void) | null = null;
      try {
        stopTimer = startPerfTimer('layout:agency-check');

        const principalClerkId = (runPerfAgencyCheck ? perfHarness?.principalId : null) || orgId || userId;
        const token = await clerkAuth.getToken() || perfHarness?.token;
        if (!token || !principalClerkId) {
          return;
        }

        const checkKey = `${principalClerkId}:${pathname}`;
        if (agencyRedirectCache.has(checkKey)) {
          return;
        }

        // Token is already resolved above; authorizedApiFetch re-reads it identically.
        const getToken = async () => token;

        // Check if user has an agency by clerkUserId.
        // Fail-open degradation is deliberate: on any error, let the user through.
        const result = await authorizedApiFetch<{
          data?: Array<{ id?: string }>;
        }>(
          `/api/agencies?clerkUserId=${encodeURIComponent(principalClerkId)}&fields=id,name,email,clerkUserId`,
          { getToken }
        );

        // If no agency found, redirect to unified onboarding
        if (!result.data || result.data.length === 0) {
          agencyRedirectCache.set(checkKey, true);
          router.replace('/onboarding/unified');
          return;
        }

        const agencyId = result.data[0]?.id as string | undefined;
        if (!agencyId) {
          return;
        }

        const onboardingResult = await authorizedApiFetch<{
          data?: AgencyOnboardingStatusData;
        }>(`/api/agencies/${agencyId}/onboarding-status`, { getToken });

        if (!onboardingResult.data) {
          return;
        }

        const shouldRedirect = shouldEnforceOnboardingRedirect(onboardingResult.data);
        agencyRedirectCache.set(checkKey, shouldRedirect);
        if (shouldRedirect) {
          trackOnboardingEvent('redirected_to_onboarding', {
            source: 'authenticated_layout',
            status: onboardingResult.data.status,
            agencyId,
          });
          router.replace('/onboarding/unified');
        }
      } catch (err) {
        console.error('Failed to check agency for redirect:', err);
        // On error, don't block the user - let them through
      } finally {
        stopTimer?.();
      }
    };

    checkAgencyAndRedirect();
  }, [
    userId,
    orgId,
    isLoaded,
    pathname,
    isDevelopmentBypass,
    router,
    clerkAuth,
    runPerfAgencyCheck,
    perfHarness,
    isDashboardRootPath,
    isAgencyFetched,
    sharedPrincipalId,
    sharedAgency,
    isOnboardingStatusFetched,
    sharedOnboardingStatus,
  ]);

  // Show loading state while auth loads.
  // Agency checks run in the background to avoid blocking initial route render.
  if (!isDevelopmentBypass && !isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <LogoSpinner size="lg" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const navigationGroups = [
    {
      label: 'Workspace',
      links: [
        {
          label: 'Dashboard',
          href: '/dashboard',
          icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0" />,
        },
        {
          label: 'Connections',
          href: '/connections',
          icon: <Network className="h-5 w-5 flex-shrink-0" />,
        },
        {
          label: 'Token Health',
          href: '/token-health',
          icon: <HeartPulse className="h-5 w-5 flex-shrink-0" />,
        },
        {
          label: 'Clients',
          href: '/clients',
          icon: <UsersRound className="h-5 w-5 flex-shrink-0" />,
        },
      ],
    },
    {
      label: 'Account',
      links: [
        {
          label: 'Settings',
          href: '/settings',
          icon: <Settings className="h-5 w-5 flex-shrink-0" />,
        },
      ],
    },
  ];
  const docsUrl = getDocsUrl();

  return (
    <div
      className={cn(
        'flex flex-col md:flex-row bg-muted w-full flex-1 mx-auto border border-border overflow-hidden',
        'h-screen'
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {/* Logo */}
            <div className={cn(
              "flex items-center gap-3 mb-8 overflow-hidden min-h-[2rem]",
              open ? "justify-center md:justify-start" : "justify-center"
            )}>
              <div
                className={cn(
                  'relative h-8 w-8 flex-shrink-0 transition-transform duration-200 motion-reduce:transition-none',
                  open ? 'scale-100' : 'scale-75'
                )}
              >
                <Image
                  src="/authhub.png"
                  alt="AuthHub"
                  fill
                  sizes="32px"
                  className="object-contain"
                  priority
                />
              </div>
              <span
                aria-hidden={!open}
                className={cn(
                  'inline-block overflow-hidden whitespace-nowrap text-xl font-semibold text-foreground transition-opacity duration-150 motion-reduce:transition-none',
                  open ? 'opacity-100' : 'pointer-events-none opacity-0'
                )}
              >
                AuthHub
              </span>
            </div>

            {/* Navigation Links */}
            <nav aria-label="Primary navigation" className="mt-8 flex flex-col gap-8">
              {navigationGroups.map((group) => (
                <div key={group.label} className="flex flex-col gap-2">
                  <span
                    aria-hidden={!open}
                    className={cn(
                      'label-nano pl-4 text-muted-foreground',
                      !open && 'hidden'
                    )}
                  >
                    {group.label}
                  </span>
                  <div className="flex flex-col gap-1">
                    {group.links.map((link) => (
                      <SidebarLink key={link.href} link={link} />
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="mt-6 border-t border-border pt-4">
              <a
                href={docsUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Help Center"
                className={cn(
                  'group flex min-h-[44px] w-full items-center border-l-4 border-transparent transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  open ? 'justify-start pl-3 py-2' : 'justify-center px-4 py-3'
                )}
              >
                <div
                  className={cn(
                    'flex h-5 w-5 flex-shrink-0 items-center justify-center text-muted-foreground transition-colors group-hover:text-foreground',
                    open && 'mr-4'
                  )}
                >
                  <CircleHelp className="h-5 w-5 flex-shrink-0" />
                </div>
                <div className={cn(open ? 'overflow-visible' : 'overflow-hidden')}>
                  <span
                    aria-hidden={!open}
                    className={cn(
                      'inline-block origin-left whitespace-nowrap text-lg font-medium text-muted-foreground transition-all duration-200 motion-reduce:transition-none group-hover:translate-x-1 group-hover:text-foreground',
                      open ? 'translate-x-0 scale-x-100 opacity-100' : '-translate-x-2 scale-x-0 opacity-0'
                    )}
                  >
                    Help Center
                  </span>
                </div>
              </a>
            </div>
          </div>

          {/* User Profile at Bottom */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              {isDevelopmentBypass ? (
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-warning text-white text-xs font-bold" aria-hidden>
                    D
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm font-medium text-warning">Dev Mode</span>
                    <button
                      type="button"
                      onClick={() => {
                        signOutDevBypass();
                        router.push('/');
                      }}
                      className="text-left text-xs text-warning/90 hover:text-warning hover:underline"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-2.5">
                  <UserButton appearance={inAppUserButtonAppearance} afterSignOutUrl="/" />
                  <span
                    aria-hidden={!open}
                    className={cn(
                      'inline-block origin-left text-sm font-medium text-foreground/90 transition-all duration-200 motion-reduce:transition-none',
                      open ? 'scale-x-100 opacity-100' : 'pointer-events-none scale-x-0 opacity-0'
                    )}
                  >
                    Account
                  </span>
                </div>
              )}
              <ThemeToggle />
            </div>
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-auto bg-background">
        {!isDashboardRootPath && subscription?.status === 'trialing' && subscription.trialEnd && (
          <TrialBanner
            trialEnd={subscription.trialEnd}
            tierName={subscription.tier ? SUBSCRIPTION_TIER_NAMES[subscription.tier] : 'your'}
          />
        )}
        {children}
      </div>
      <HelpScoutBeacon />
    </div>
  );
}
