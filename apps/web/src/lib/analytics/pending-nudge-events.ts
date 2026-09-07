import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import type { InviteSurface } from './invite-events';

export type PendingNudgeCliff = '24h' | '72h';
export type PendingNudgeSurface = Extract<InviteSurface, 'dashboard' | 'detail'>;
export type PendingNudgeCta = 'copy_link' | 'send_reminder' | 'dismiss' | 'view_details';

type PendingNudgeBannerBaseProps = {
  access_request_id: string;
  access_request_token: string;
  cliff: PendingNudgeCliff;
  surface: PendingNudgeSurface;
};

type PendingNudgeBannerShownProps = PendingNudgeBannerBaseProps;

type PendingNudgeBannerCtaProps = PendingNudgeBannerBaseProps & {
  cta: PendingNudgeCta;
};

function capturePendingNudgeEvent(eventName: string, properties: Record<string, unknown>): void {
  void capturePosthogEvent(eventName, properties);
}

export function trackPendingNudgeBannerShown(properties: PendingNudgeBannerShownProps): void {
  capturePendingNudgeEvent('pending_nudge_banner_shown', properties);
}

export function trackPendingNudgeBannerCta(properties: PendingNudgeBannerCtaProps): void {
  capturePendingNudgeEvent('pending_nudge_banner_cta', properties);
}
