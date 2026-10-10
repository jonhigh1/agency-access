/**
 * Whether a Fastify error response should be reported to Sentry.
 * Uses SDK init state (not env presence) so hardcoded DSN fallbacks still report.
 */
export function shouldReportServerError(
  statusCode: number,
  sentryInitialized: boolean
): boolean {
  return statusCode >= 500 && sentryInitialized;
}
