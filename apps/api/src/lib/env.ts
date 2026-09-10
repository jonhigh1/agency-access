import { z } from 'zod';
import dotenv from 'dotenv';
import { randomBytes } from 'crypto';

dotenv.config();

function isLocalhostUrl(value: string): boolean {
  const hostname = new URL(value).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function parseCsvList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseUrlSafely(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function parseBooleanish(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return undefined;
}

function booleanish(defaultValue: boolean) {
  return z.preprocess(
    value => parseBooleanish(value) ?? value,
    z.boolean().default(defaultValue)
  );
}

function isPostgresProtocol(protocol: string): boolean {
  return protocol === 'postgres:' || protocol === 'postgresql:';
}

function hasRequiredSslMode(url: URL): boolean {
  const sslMode = url.searchParams.get('sslmode');
  return sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full';
}

function hasProductionSecret(value: string | undefined, minimumLength = 32): boolean {
  return typeof value === 'string' && value.trim().length >= minimumLength;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  FRONTEND_URL: z.string().url().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  // Backend API URL (for OAuth callbacks)
  API_URL: z.string().url().optional(),

  // Clerk Authentication
  CLERK_PUBLISHABLE_KEY: z.string(),
  CLERK_SECRET_KEY: z.string(),
  CLERK_OAUTH_ISSUER: z.string().url().optional(),

  // External personal-agent access
  AGENT_NATIVE_ENABLED: booleanish(false),
  AGENT_NATIVE_AGENCY_ALLOWLIST: z.string().optional(),
  AGENT_MCP_RESOURCE_URL: z.string().url().optional(),
  CLERK_OAUTH_VERIFY_URL: z
    .string()
    .url()
    .default('https://api.clerk.com/v1/oauth_applications/access_tokens/verify'),
  AGENT_READ_RATE_LIMIT: z.coerce.number().int().min(1).default(120),
  AGENT_MUTATION_RATE_LIMIT: z.coerce.number().int().min(1).default(30),
  AGENT_AGENCY_RATE_LIMIT: z.coerce.number().int().min(1).default(300),
  AGENT_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(60),

  // Infisical (Secrets Management)
  INFISICAL_CLIENT_ID: z.string(),
  INFISICAL_CLIENT_SECRET: z.string(),
  INFISICAL_PROJECT_ID: z.string(),
  INFISICAL_ENVIRONMENT: z.string().default('dev'),

  // Background workers toggle
  // When false: no job handlers start, no scheduled jobs. Use for pre-launch/staging with zero traffic.
  BACKGROUND_WORKERS_ENABLED: booleanish(true),

  // Meta OAuth
  META_APP_ID: z.string(),
  META_APP_SECRET: z.string(),
  META_LOGIN_FOR_BUSINESS_CONFIG_ID: z.string().optional(),

  // Kit (ConvertKit) OAuth
  KIT_CLIENT_ID: z.string().optional(),
  KIT_CLIENT_SECRET: z.string().optional(),

  // Beehiiv API (Agency's API key for team access)
  BEEHIIV_API_KEY: z.string().optional(),

  // Google OAuth (unified - covers all Google products)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Legacy: Google Ads-specific credentials (optional, for API access)
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.string().optional(),

  // Google Merchant Center API version
  GOOGLE_MERCHANT_CENTER_API_VERSION: z.string().optional(),

  // TikTok OAuth
  TIKTOK_CLIENT_ID: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_APP_ID: z.string().optional(),
  TIKTOK_APP_SECRET: z.string().optional(),

  // Mailchimp OAuth
  MAILCHIMP_CLIENT_ID: z.string().optional(),
  MAILCHIMP_CLIENT_SECRET: z.string().optional(),

  // Snapchat OAuth
  SNAPCHAT_CLIENT_ID: z.string().optional(),
  SNAPCHAT_CLIENT_SECRET: z.string().optional(),

  // Pinterest OAuth
  PINTEREST_CLIENT_ID: z.string().optional(),
  PINTEREST_CLIENT_SECRET: z.string().optional(),

  // Klaviyo OAuth
  KLAVIYO_CLIENT_ID: z.string().optional(),
  KLAVIYO_CLIENT_SECRET: z.string().optional(),

  // Shopify OAuth
  SHOPIFY_API_KEY: z.string().optional(),
  SHOPIFY_API_SECRET_KEY: z.string().optional(),

  // Zapier OAuth
  ZAPIER_CLIENT_ID: z.string().optional(),
  ZAPIER_CLIENT_SECRET: z.string().optional(),

  // LinkedIn OAuth
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),

  // Notifications
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  RESEND_REPLY_TO_EMAIL: z.string().optional(),

  // Help Scout Beacon secure mode
  HELPSCOUT_BEACON_SECRET: z.string().optional(),

  // Creem Payments
  CREEM_API_KEY: z.string(),
  CREEM_WEBHOOK_SECRET: z.string(),
  CREEM_API_URL: z.string().url().default('https://api.creem.io'),

  // Sentry Error Monitoring
  SENTRY_DSN: z.string().optional(),
  SENTRY_SEND_IN_DEV: booleanish(false),
  SENTRY_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  LOG_LEVEL: z.string().default('info'),

  // Rate Limiting
  RATE_LIMIT_ENABLED: booleanish(true),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_TIME_WINDOW_SECONDS: z.coerce.number().default(60),
  RATE_LIMIT_SKIP_AUTHENTICATED: booleanish(true),
  DASHBOARD_SUMMARY_LIMITS_ENABLED: z.coerce.boolean().optional(),
  TRUST_PROXY_IPS: z.string().optional(),
  DB_ENFORCE_LEAST_PRIVILEGE: booleanish(false),

  // OAuth State Security
  OAUTH_STATE_HMAC_SECRET: z.string().default(() => {
    return randomBytes(32).toString('hex');
  }),

  // Internal Admin Access Control (comma-separated allowlists)
  INTERNAL_ADMIN_USER_IDS: z.string().optional(),
  INTERNAL_ADMIN_EMAILS: z.string().optional(),

  // Affiliate program
  AFFILIATE_COOKIE_TTL_DAYS: z.coerce.number().int().min(1).default(90),
  AFFILIATE_DEFAULT_COMMISSION_BPS: z.coerce.number().int().min(0).max(10000).default(5000),
  AFFILIATE_DEFAULT_COMMISSION_MONTHS: z.coerce.number().int().min(1).max(60).default(12),
  AFFILIATE_DEFAULT_TRAILING_COMMISSION_BPS: z.coerce.number().int().min(0).max(10000).default(3000),
  AFFILIATE_DEFAULT_TRAILING_COMMISSION_MONTHS: z.coerce.number().int().min(0).max(60).default(6),
  AFFILIATE_HOLD_DAYS: z.coerce.number().int().min(0).default(30),
  AFFILIATE_PORTAL_ENABLED: booleanish(false),

  // Google Client Offboarding (feature-flagged, design-partner gate)
  GOOGLE_CLIENT_OFFBOARDING_ENABLED: booleanish(false),
  GOOGLE_CLIENT_OFFBOARDING_ALLOWED_AGENCIES: z.string().optional(),
  GOOGLE_CLIENT_OFFBOARDING_GA4_ENABLED: booleanish(false),
  OFFBOARDING_CAPABILITY_SECRET: z.string().min(1).optional(),

  // Outbound webhook delivery
  WEBHOOK_DELIVERY_TIMEOUT_MS: z.coerce.number().int().min(1000).default(5000),
  WEBHOOK_FAILURE_DISABLE_THRESHOLD: z.coerce.number().int().min(1).default(5),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(6),
});

const rawEnv = {
  ...process.env,
  INFISICAL_ENVIRONMENT: process.env.INFISICAL_ENVIRONMENT ?? process.env.INFISICAL_ENV,
  // TikTok credential migration: prefer new CLIENT_* names and fall back to legacy APP_* names.
  TIKTOK_CLIENT_ID: process.env.TIKTOK_CLIENT_ID ?? process.env.TIKTOK_APP_ID,
  TIKTOK_CLIENT_SECRET: process.env.TIKTOK_CLIENT_SECRET ?? process.env.TIKTOK_APP_SECRET,
  // Keep legacy vars populated for compatibility with any older code paths.
  TIKTOK_APP_ID: process.env.TIKTOK_APP_ID ?? process.env.TIKTOK_CLIENT_ID,
  TIKTOK_APP_SECRET: process.env.TIKTOK_APP_SECRET ?? process.env.TIKTOK_CLIENT_SECRET,
};

const parsedEnv = envSchema.parse(rawEnv);

if (parsedEnv.NODE_ENV === 'production') {
  if (!parsedEnv.FRONTEND_URL) {
    throw new Error('FRONTEND_URL is required in production');
  }

  if (!parsedEnv.API_URL) {
    throw new Error('API_URL is required in production');
  }

  if (isLocalhostUrl(parsedEnv.FRONTEND_URL)) {
    throw new Error('FRONTEND_URL cannot point to localhost in production');
  }

  if (isLocalhostUrl(parsedEnv.API_URL)) {
    throw new Error('API_URL cannot point to localhost in production');
  }

  const databaseUrl = parseUrlSafely(parsedEnv.DATABASE_URL);
  if (!databaseUrl || !isPostgresProtocol(databaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use postgres:// or postgresql:// in production');
  }

  if (!hasRequiredSslMode(databaseUrl)) {
    throw new Error('DATABASE_URL must set sslmode=require (or verify-ca/verify-full) in production');
  }

  if (parsedEnv.DB_ENFORCE_LEAST_PRIVILEGE) {
    const dbUser = decodeURIComponent(databaseUrl.username || '').toLowerCase();
    const disallowedElevatedUsers = new Set(['postgres', 'neondb_owner', 'root', 'admin']);
    if (disallowedElevatedUsers.has(dbUser)) {
      throw new Error('DATABASE_URL must use a least-privilege runtime DB role in production');
    }
  }

  if (!hasProductionSecret(process.env.OAUTH_STATE_HMAC_SECRET)) {
    throw new Error('OAUTH_STATE_HMAC_SECRET must be set to at least 32 characters in production');
  }

  if (parsedEnv.AGENT_NATIVE_ENABLED) {
    if (!parsedEnv.CLERK_OAUTH_ISSUER || !parsedEnv.AGENT_MCP_RESOURCE_URL) {
      throw new Error(
        'CLERK_OAUTH_ISSUER and AGENT_MCP_RESOURCE_URL are required when agent-native access is enabled'
      );
    }
    if (
      new URL(parsedEnv.CLERK_OAUTH_ISSUER).protocol !== 'https:' ||
      new URL(parsedEnv.AGENT_MCP_RESOURCE_URL).protocol !== 'https:'
    ) {
      throw new Error('Agent OAuth issuer and MCP resource URLs must use HTTPS in production');
    }
    if (parseCsvList(parsedEnv.AGENT_NATIVE_AGENCY_ALLOWLIST).length === 0) {
      throw new Error('AGENT_NATIVE_AGENCY_ALLOWLIST must include at least one agency when enabled');
    }
  }

  if (parsedEnv.GOOGLE_CLIENT_OFFBOARDING_ENABLED) {
    if (!parsedEnv.GOOGLE_CLIENT_ID || !parsedEnv.GOOGLE_CLIENT_SECRET) {
      throw new Error(
        'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required when Google client offboarding is enabled'
      );
    }
    if (!parsedEnv.OFFBOARDING_CAPABILITY_SECRET) {
      throw new Error(
        'OFFBOARDING_CAPABILITY_SECRET is required when Google client offboarding is enabled'
      );
    }
    if (parsedEnv.GOOGLE_CLIENT_OFFBOARDING_GA4_ENABLED && !parsedEnv.GOOGLE_ADS_DEVELOPER_TOKEN) {
      throw new Error(
        'GOOGLE_ADS_DEVELOPER_TOKEN is required when the GA4 offboarding adapter is enabled'
      );
    }
  }
}

const FRONTEND_URL = parsedEnv.FRONTEND_URL ?? 'http://localhost:3000';
const CORS_ALLOWED_ORIGINS = parseCsvList(parsedEnv.CORS_ALLOWED_ORIGINS);
const API_URL = parsedEnv.API_URL ?? `http://localhost:${parsedEnv.PORT}`;
const INTERNAL_ADMIN_USER_IDS = parseCsvList(parsedEnv.INTERNAL_ADMIN_USER_IDS);
const INTERNAL_ADMIN_EMAILS = parseCsvList(parsedEnv.INTERNAL_ADMIN_EMAILS);
const TRUST_PROXY_IPS = parseCsvList(parsedEnv.TRUST_PROXY_IPS);
const DASHBOARD_SUMMARY_LIMITS_ENABLED =
  parsedEnv.DASHBOARD_SUMMARY_LIMITS_ENABLED ?? true;
const CLERK_OAUTH_ISSUER =
  parsedEnv.CLERK_OAUTH_ISSUER ?? 'https://clerk.invalid';
const AGENT_MCP_RESOURCE_URL =
  parsedEnv.AGENT_MCP_RESOURCE_URL ?? `${API_URL}/mcp`;
const AGENT_NATIVE_AGENCY_ALLOWLIST = parseCsvList(parsedEnv.AGENT_NATIVE_AGENCY_ALLOWLIST);
const GOOGLE_CLIENT_OFFBOARDING_ALLOWED_AGENCIES = parseCsvList(
  parsedEnv.GOOGLE_CLIENT_OFFBOARDING_ALLOWED_AGENCIES
);

function isOffboardingEnabled(agencyId?: string): boolean {
  if (!parsedEnv.GOOGLE_CLIENT_OFFBOARDING_ENABLED) return false;
  if (!agencyId) return false;
  if (GOOGLE_CLIENT_OFFBOARDING_ALLOWED_AGENCIES.length === 0) return false;
  return GOOGLE_CLIENT_OFFBOARDING_ALLOWED_AGENCIES.includes(agencyId);
}

export const env = {
  ...parsedEnv,
  FRONTEND_URL,
  CORS_ALLOWED_ORIGINS,
  API_URL,
  INTERNAL_ADMIN_USER_IDS,
  INTERNAL_ADMIN_EMAILS,
  TRUST_PROXY_IPS,
  DASHBOARD_SUMMARY_LIMITS_ENABLED,
  CLERK_OAUTH_ISSUER,
  AGENT_MCP_RESOURCE_URL,
  AGENT_NATIVE_AGENCY_ALLOWLIST,
  GOOGLE_CLIENT_OFFBOARDING_ALLOWED_AGENCIES,
};

export { isOffboardingEnabled };

/** Frontend base URL without a trailing slash (for building links sent to users). */
export function frontendBaseUrl(): string {
  return env.FRONTEND_URL.replace(/\/$/, '');
}
