---
title: "Creem Checkout API - cancel_url Parameter Not Supported"
description: "Creem's checkout session API returns 400 Bad Request when a cancel_url parameter is included, unlike Stripe's API which accepts this parameter."
severity: high
component: billing-payments
tags:
  - creem-api
  - checkout
  - api-integration
  - parameter-validation
  - billing
  - third-party-api
date: 2026-03-08
resolved: true
resolution_time: 27min
---

## Problem

Users clicking "Start free trial" in the Billing section encountered a 500 Internal Server Error. The error message was generic: "Creem API request failed" with no additional details initially.

### Observable Symptoms

- HTTP 500 error when calling `/api/subscriptions/checkout`
- Generic error message in frontend: "Failed to create checkout session"
- Users completely unable to start free trials or upgrade subscriptions
- Critical revenue-generating feature was blocked

### Timeline

- **2026-03-08 21:03:41** - Initial fix commit attempted
- **2026-03-08 21:21:43** - Database schema fix for missing `affiliate_referrals` table
- **2026-03-08 21:25:18** - Added detailed logging for Creem checkout debugging
- **2026-03-08 21:27:40** - Added comprehensive Creem API request/response logging
- **2026-03-08 21:30:23** - Root cause identified and fix deployed
- **Total resolution time**: ~27 minutes

## Root Cause

The Creem Payments API does **not** accept a `cancel_url` parameter in their checkout session creation endpoint (`POST /v1/checkouts`). The code was attempting to pass this parameter (similar to Stripe's API which does accept it), causing Creem to return:

```json
{
  "trace_id": "d923ef56-3060-4634-8608-6e08d4b17dd1",
  "status": 400,
  "error": "Bad Request",
  "message": ["property cancel_url should not exist"],
  "timestamp": 1773030584595
}
```

This was a parameter mismatch between our internal API expectations and Creem's actual API specification.

## Investigation Steps

### 1. Enhanced Error Logging

**Commit**: `dd5b4c8` - Added detailed logging for Creem checkout debugging

Added logging to `subscription.service.ts` to capture:
- Request parameters (productId, customerEmail, tier, billingInterval)
- Full Creem error response details (code, message, details)

```typescript
console.log('Creem checkout request:', {
  productId,
  hasCustomer: !!creemCustomerId,
  customerEmail: agency.email,
  tier,
  billingInterval: billingInterval ?? 'monthly',
});

// ... on error ...
console.error('Creem checkout error:', {
  code: checkoutResult.error?.code,
  message: checkoutResult.error?.message,
  details: checkoutResult.error?.details,
});
```

### 2. Comprehensive Creem API Logging

**Commit**: `1762f4b` - Added comprehensive Creem API logging

Added request/response logging to `creem.ts`:

```typescript
console.log(`Creem API Request: ${options.method || 'GET'} ${url}`, {
  headers: options.headers,
  body: options.body ? JSON.parse(options.body as string) : undefined,
});

console.log(`Creem API Response: ${response.status} ${response.statusText}`, {
  status: response.status,
  body: result,
});
```

This revealed the actual Creem error response with the specific parameter validation error.

### 3. Database Schema Fix

**Commit**: `ae372c3` - Fixed handling of missing affiliate_referrals table

Added try/catch fallback for production database missing the `affiliate_referrals` table:

```typescript
let agency: any;
try {
  agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true,
      email: true,
      name: true,
      affiliateReferral: {
        select: {
          id: true,
          partnerId: true,
          clickId: true,
        },
      },
    },
  });
} catch (error) {
  // Table might not exist (affiliate_referrals not created in production yet)
  // Fall back to basic query without affiliate data
  agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });
}
```

This was a separate issue that needed to be resolved but was not the root cause of the checkout failure.

## Solution

### Working Fix

**Commit**: `4f0f0d9` - Remove cancel_url parameter from Creem checkout API

**File**: `apps/api/src/lib/creem.ts`

**Before** (lines 151-155):
```typescript
const body: Record<string, unknown> = {
  product_id: params.productId,
  success_url: params.successUrl,
  ...(params.cancelUrl && { cancel_url: params.cancelUrl }),  // ❌ Creem rejects this
  ...(params.metadata && { metadata: params.metadata }),
};
```

**After** (lines 151-154):
```typescript
const body: Record<string, unknown> = {
  product_id: params.productId,
  success_url: params.successUrl,
  ...(params.metadata && { metadata: params.metadata }),
};
```

**Change**: Removed the conditional spread operator that added `cancel_url` to the request body.

### TypeScript Interface Update

The `cancelUrl` parameter is still accepted in the TypeScript interface for API compatibility, but it is no longer sent to Creem:

```typescript
async createCheckoutSession(params: {
  customer?: string;
  customerEmail?: string;
  productId: string;
  successUrl: string;
  cancelUrl?: string;  // Accepted but not sent to Creem
  metadata?: Record<string, any>;
}): Promise<CreemResponse<any>>
```

This prevents breaking changes in the frontend code while avoiding the API error.

## Prevention Strategies

### API Parameter Validation

1. **Documentation-First Development**
   - Always read the official API documentation THREE times before implementation
   - Cross-reference documentation with code examples
   - Check for parameter support differences between similar APIs (e.g., Stripe vs Creem)
   - Look for "common mistakes" or "gotchas" sections in API docs

2. **Parameter Mapping Checklist**
   - For every third-party API client method, verify ALL parameters are supported
   - Create explicit mapping between TypeScript interfaces and API parameters
   - Document which parameters are accepted by our code vs sent to the API
   - Use ESLint rules to detect unused parameters in public methods

3. **Integration Testing with Real API**
   - Test against staging environment before production
   - Verify each parameter individually (send request, check API received it)
   - Test error scenarios (invalid parameters, missing parameters)
   - Document actual API behavior vs documentation (catch discrepancies)

### Third-Party API Integration Best Practices

1. **Request/Response Logging**
   - Log ALL requests and responses at development time
   - In production, sanitize sensitive data (API keys, tokens, PII)
   - Include correlation IDs to trace request-response pairs
   - Implement structured logging with log levels (debug, info, warn, error)

2. **Error Response Analysis**
   - Parse and log ALL error responses from third-party APIs
   - Create error code mapping for common issues
   - Store raw error responses for debugging
   - Implement retry logic only for transient failures (not validation errors)

3. **Explicit Parameter Transformation**
   ```typescript
   // GOOD: Explicit transformation with comments
   const body: Record<string, unknown> = {
     product_id: params.productId,     // TypeScript: productId → API: product_id
     success_url: params.successUrl,   // TypeScript: successUrl → API: success_url
     // cancelUrl intentionally omitted (not supported by Creem)
   };
   ```

### Testing Recommendations

1. **Integration Tests with Mock Servers**
   - Use MSW (Mock Service Worker) or Nock to mock Creem API responses
   - Test BOTH success and failure scenarios
   - Include tests for unsupported parameters
   - Verify parameter mapping by inspecting captured requests

2. **Contract Testing**
   - Create snapshot tests of actual API requests
   - Compare against API documentation regularly
   - Use tools like Pact for consumer-driven contract testing
   - Automate detection of API changes

3. **Manual Testing Checklist**
   - Create a manual test plan for ALL third-party integrations
   - Test each parameter individually against real API
   - Document actual API behavior vs documentation
   - Share findings with team via code review

## Related Documentation

### Creem Integration Files
- **Client Implementation**: `apps/api/src/lib/creem.ts`
- **Product Configuration**: `apps/api/src/config/creem.config.ts`
- **Signature Verification**: `apps/api/src/lib/creem-signature.ts`
- **Environment Variables**: `apps/api/src/lib/env.ts` (lines 155-157)

### Related Solutions
- **Webhook Support Runbook**: `docs/features/webhooks-support-runbook.md`
- **Affiliate Program MVP**: `docs/sprints/2026-03-08-affiliate-program-mvp.md`
- **Production Checklist**: `docs/PRODUCTION_CHECKLIST.md`

### Testing References
- **Signature Test Suite**: `apps/api/src/lib/__tests__/creem-signature.test.ts`
- **Checkout Tests**: `apps/api/src/routes/__tests__/subscriptions.checkout.test.ts`

## Monitoring

### Detection Strategies

1. **API Error Tracking**
   - Track error rates by endpoint and parameter combination
   - Create alerts for spikes in `INVALID_PARAMETER` errors
   - Monitor for new error codes not seen before
   - Correlate errors with code deployments

2. **Parameter Usage Monitoring**
   - Log which parameters are being sent to third-party APIs
   - Alert when "optional" parameters cause validation errors
   - Track parameter value distribution changes
   - Monitor for parameters that are always null/undefined

### Alerting Thresholds

- Alert when error rate exceeds 5% for any checkout endpoint
- Alert when `INVALID_PARAMETER` errors appear >10 times/hour
- Alert on new error codes from Creem API
- Create dashboard showing real-time checkout success/failure rates

## Cross-References

### Similar Issues
- **Stripe Integration**: Note that Stripe DOES accept `cancel_url` - this difference caused the confusion
- **Other Payment Gateways**: Always verify parameter support when switching providers

### API Documentation References
- Creem API Documentation: https://docs.creem.io (verify current API specification)
- Product Configuration: See `apps/api/src/config/creem.config.ts` for product ID mappings

## Key Takeaways

1. **Never assume API similarity** - Just because Stripe accepts `cancel_url` doesn't mean Creem does
2. **Add comprehensive logging early** - This dramatically reduced debugging time from hours to minutes
3. **Test with real APIs when possible** - Mock servers can miss API contract differences
4. **Document API discrepancies** - When documentation differs from actual behavior, note it prominently
5. **Monitor third-party API errors** - Set up alerts for validation errors to catch issues quickly
