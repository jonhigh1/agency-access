# Rate limits

One documented limiter governs v1: **100 requests per 60s sliding
window, per API key**. v1 traffic is exempt from the global IP limiter,
so a call is never counted twice.

## Headers and retry contract

Every gated response carries `X-RateLimit-Limit` and
`X-RateLimit-Remaining`. A `429 RATE_LIMIT_EXCEEDED` adds `Retry-After`
(seconds). On 429: wait the full `Retry-After`, then retry with
backoff. The budget counts a request once validation passes, so
rejected `400`s do not burn budget but cheap probing still does.

Failed key verifications throttle harder in a separate bucket keyed by
IP plus key prefix (10 per 60s), so credential stuffing degrades before
legitimate traffic does.

A cap of 100 live idempotency records per key bounds retry state;
replays of completed records are cheap reads against that budget.
