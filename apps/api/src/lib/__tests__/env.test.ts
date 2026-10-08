import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({
  default: {
    config: vi.fn(),
  },
}));

const ORIGINAL_ENV = { ...process.env };

function withRequiredBase(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: 'development',
    PORT: '3001',
    DATABASE_URL: 'postgresql://app_user:password@db.example.com:5432/app?sslmode=require',
    CLERK_PUBLISHABLE_KEY: 'pk_live_example',
    CLERK_SECRET_KEY: 'sk_live_example',
    INFISICAL_CLIENT_ID: 'infisical-client-id',
    INFISICAL_CLIENT_SECRET: 'infisical-client-secret',
    INFISICAL_PROJECT_ID: 'infisical-project-id',
    META_APP_ID: 'meta-app-id',
    META_APP_SECRET: 'meta-app-secret',
    CREEM_API_KEY: 'creem_live_example',
    CREEM_WEBHOOK_SECRET: 'whsec_live_example',
    OAUTH_STATE_HMAC_SECRET: '0123456789abcdef0123456789abcdef',
    ...overrides,
  };
}

async function importEnvWith(envValues: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };

  for (const [key, value] of Object.entries(envValues)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return import('../env.ts');
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe('env contract', () => {
  it('fails in production when FRONTEND_URL is missing', async () => {
    await expect(importEnvWith(withRequiredBase({
      NODE_ENV: 'production',
      FRONTEND_URL: undefined,
      API_URL: 'https://api.example.com',
      INFISICAL_ENVIRONMENT: 'production',
    }))).rejects.toThrow();
  });

  it('fails in production when API_URL is missing', async () => {
    await expect(importEnvWith(withRequiredBase({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
      API_URL: undefined,
      INFISICAL_ENVIRONMENT: 'production',
    }))).rejects.toThrow();
  });

  it('fails in production when FRONTEND_URL is localhost', async () => {
    await expect(importEnvWith(withRequiredBase({
      NODE_ENV: 'production',
      FRONTEND_URL: 'http://localhost:3000',
      API_URL: 'https://api.example.com',
      INFISICAL_ENVIRONMENT: 'production',
    }))).rejects.toThrow();
  });

  it('fails in production when API_URL is localhost', async () => {
    await expect(importEnvWith(withRequiredBase({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
      API_URL: 'http://localhost:3001',
      INFISICAL_ENVIRONMENT: 'production',
    }))).rejects.toThrow();
  });

  it('fails in production when DATABASE_URL is not a postgres URL', async () => {
    await expect(importEnvWith(withRequiredBase({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
      API_URL: 'https://api.example.com',
      DATABASE_URL: 'https://example.com/db',
      INFISICAL_ENVIRONMENT: 'production',
    }))).rejects.toThrow();
  });

  it('fails in production when DATABASE_URL does not enforce sslmode', async () => {
    await expect(importEnvWith(withRequiredBase({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
      API_URL: 'https://api.example.com',
      DATABASE_URL: 'postgresql://app_user:password@db.example.com:5432/app',
      INFISICAL_ENVIRONMENT: 'production',
    }))).rejects.toThrow();
  });

  it('fails in production for elevated DB user when DB_ENFORCE_LEAST_PRIVILEGE is true', async () => {
    await expect(importEnvWith(withRequiredBase({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
      API_URL: 'https://api.example.com',
      DATABASE_URL: 'postgresql://postgres:password@db.example.com:5432/app?sslmode=require',
      DB_ENFORCE_LEAST_PRIVILEGE: 'true',
      INFISICAL_ENVIRONMENT: 'production',
    }))).rejects.toThrow();
  });

  it('fails in production when OAUTH_STATE_HMAC_SECRET is missing', async () => {
    await expect(importEnvWith(withRequiredBase({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
      API_URL: 'https://api.example.com',
      INFISICAL_ENVIRONMENT: 'production',
      OAUTH_STATE_HMAC_SECRET: undefined,
    }))).rejects.toThrow(/OAUTH_STATE_HMAC_SECRET/);
  });

  it('fails in production when OAUTH_STATE_HMAC_SECRET is too short', async () => {
    await expect(importEnvWith(withRequiredBase({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
      API_URL: 'https://api.example.com',
      INFISICAL_ENVIRONMENT: 'production',
      OAUTH_STATE_HMAC_SECRET: 'short',
    }))).rejects.toThrow(/OAUTH_STATE_HMAC_SECRET/);
  });

  it('supports legacy INFISICAL_ENV when INFISICAL_ENVIRONMENT is not provided', async () => {
    const module = await importEnvWith(withRequiredBase({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
      API_URL: 'https://api.example.com',
      INFISICAL_ENVIRONMENT: undefined,
      INFISICAL_ENV: 'production',
    }));

    expect(module.env.INFISICAL_ENVIRONMENT).toBe('production');
  });

  it('keeps development defaults for FRONTEND_URL and API_URL', async () => {
    const module = await importEnvWith(withRequiredBase({
      NODE_ENV: 'development',
      FRONTEND_URL: undefined,
      API_URL: undefined,
      INFISICAL_ENVIRONMENT: 'dev',
    }));

    expect(module.env.FRONTEND_URL).toBe('http://localhost:3000');
    expect(module.env.API_URL).toBe('http://localhost:3001');
  });

  it.each(['', '   '])(
    'treats CORS_ALLOW_VERCEL_PREVIEWS=%j as unset instead of failing startup',
    async (value) => {
      const module = await importEnvWith(withRequiredBase({ CORS_ALLOW_VERCEL_PREVIEWS: value }));
      expect(module.env.CORS_ALLOW_VERCEL_PREVIEWS).toBe(false);
    }
  );

  it('parses CORS_ALLOW_VERCEL_PREVIEWS=true', async () => {
    const module = await importEnvWith(withRequiredBase({ CORS_ALLOW_VERCEL_PREVIEWS: 'true' }));
    expect(module.env.CORS_ALLOW_VERCEL_PREVIEWS).toBe(true);
  });

  it('parses CORS_PREVIEW_ORIGINS as a trimmed array of preview origins', async () => {
    const module = await importEnvWith(withRequiredBase({
      CORS_PREVIEW_ORIGINS:
        ' https://agency-access-git-staging-jons-projects-1906288f.vercel.app ,,',
    }));
    expect(module.env.CORS_PREVIEW_ORIGINS).toEqual([
      'https://agency-access-git-staging-jons-projects-1906288f.vercel.app',
    ]);
  });

  it('defaults CORS_PREVIEW_ORIGINS to an empty list (unset or empty)', async () => {
    const unset = await importEnvWith(withRequiredBase({ CORS_PREVIEW_ORIGINS: undefined }));
    expect(unset.env.CORS_PREVIEW_ORIGINS).toEqual([]);
    const empty = await importEnvWith(withRequiredBase({ CORS_PREVIEW_ORIGINS: '' }));
    expect(empty.env.CORS_PREVIEW_ORIGINS).toEqual([]);
  });

  it('fails when CORS_PREVIEW_ORIGINS lists a non-preview origin', async () => {
    await expect(importEnvWith(withRequiredBase({
      CORS_PREVIEW_ORIGINS: 'https://evil.example.com',
    }))).rejects.toThrow(/CORS_PREVIEW_ORIGINS/);
  });

  it('parses additional CORS origins as a trimmed array', async () => {
    const module = await importEnvWith(withRequiredBase({
      CORS_ALLOWED_ORIGINS: ' https://agency-access-beta.vercel.app, https://staging.authhub.co ,,',
    }));

    expect(module.env.CORS_ALLOWED_ORIGINS).toEqual([
      'https://agency-access-beta.vercel.app',
      'https://staging.authhub.co',
    ]);
  });

  it('parses INTERNAL_ADMIN_USER_IDS and INTERNAL_ADMIN_EMAILS as trimmed arrays', async () => {
    const module = await importEnvWith(withRequiredBase({
      INTERNAL_ADMIN_USER_IDS: ' user_1, user_2 ,,',
      INTERNAL_ADMIN_EMAILS: ' admin@example.com,ops@example.com ,, ',
    }));

    expect(module.env.INTERNAL_ADMIN_USER_IDS).toEqual(['user_1', 'user_2']);
    expect(module.env.INTERNAL_ADMIN_EMAILS).toEqual(['admin@example.com', 'ops@example.com']);
  });

  it('parses BACKGROUND_WORKERS_ENABLED as boolean (default true)', async () => {
    const moduleDefault = await importEnvWith(withRequiredBase({
      BACKGROUND_WORKERS_ENABLED: undefined,
    }));
    expect(moduleDefault.env.BACKGROUND_WORKERS_ENABLED).toBe(true);

    const moduleFalse = await importEnvWith(withRequiredBase({
      BACKGROUND_WORKERS_ENABLED: 'false',
    }));
    expect(moduleFalse.env.BACKGROUND_WORKERS_ENABLED).toBe(false);

    const moduleTrue = await importEnvWith(withRequiredBase({
      BACKGROUND_WORKERS_ENABLED: 'true',
    }));
    expect(moduleTrue.env.BACKGROUND_WORKERS_ENABLED).toBe(true);
  });

  it('parses Render boolean env strings', async () => {
    const module = await importEnvWith(withRequiredBase({
      RATE_LIMIT_ENABLED: 'false',
      RATE_LIMIT_SKIP_AUTHENTICATED: 'false',
      DB_ENFORCE_LEAST_PRIVILEGE: 'true',
    }));

    expect(module.env.RATE_LIMIT_ENABLED).toBe(false);
    expect(module.env.RATE_LIMIT_SKIP_AUTHENTICATED).toBe(false);
    expect(module.env.DB_ENFORCE_LEAST_PRIVILEGE).toBe(true);
  });

  it('defaults internal admin allowlists to empty arrays when unset', async () => {
    const module = await importEnvWith(withRequiredBase({
      INTERNAL_ADMIN_USER_IDS: undefined,
      INTERNAL_ADMIN_EMAILS: undefined,
    }));

    expect(module.env.INTERNAL_ADMIN_USER_IDS).toEqual([]);
    expect(module.env.INTERNAL_ADMIN_EMAILS).toEqual([]);
  });

  it('defaults DB_ENFORCE_LEAST_PRIVILEGE to false when unset', async () => {
    const module = await importEnvWith(withRequiredBase({
      DB_ENFORCE_LEAST_PRIVILEGE: undefined,
    }));

    expect(module.env.DB_ENFORCE_LEAST_PRIVILEGE).toBe(false);
  });

  it('maps legacy TikTok app credentials to TIKTOK_CLIENT_* when client vars are unset', async () => {
    const module = await importEnvWith(withRequiredBase({
      TIKTOK_CLIENT_ID: undefined,
      TIKTOK_CLIENT_SECRET: undefined,
      TIKTOK_APP_ID: 'legacy-app-id',
      TIKTOK_APP_SECRET: 'legacy-app-secret',
    }));

    expect(module.env.TIKTOK_CLIENT_ID).toBe('legacy-app-id');
    expect(module.env.TIKTOK_CLIENT_SECRET).toBe('legacy-app-secret');
  });

  it('prefers TIKTOK_CLIENT_* over legacy TIKTOK_APP_* when both are present', async () => {
    const module = await importEnvWith(withRequiredBase({
      TIKTOK_CLIENT_ID: 'new-client-id',
      TIKTOK_CLIENT_SECRET: 'new-client-secret',
      TIKTOK_APP_ID: 'legacy-app-id',
      TIKTOK_APP_SECRET: 'legacy-app-secret',
    }));

    expect(module.env.TIKTOK_CLIENT_ID).toBe('new-client-id');
    expect(module.env.TIKTOK_CLIENT_SECRET).toBe('new-client-secret');
  });

  it('preserves optional Help Scout Beacon secret when configured', async () => {
    const module = await importEnvWith(withRequiredBase({
      HELPSCOUT_BEACON_SECRET: 'hs_secret_test',
    }));

    expect(module.env.HELPSCOUT_BEACON_SECRET).toBe('hs_secret_test');
  });

  it('defaults affiliate configuration values when unset', async () => {
    const module = await importEnvWith(withRequiredBase({
      AFFILIATE_COOKIE_TTL_DAYS: undefined,
      AFFILIATE_DEFAULT_COMMISSION_BPS: undefined,
      AFFILIATE_DEFAULT_COMMISSION_MONTHS: undefined,
      AFFILIATE_DEFAULT_TRAILING_COMMISSION_BPS: undefined,
      AFFILIATE_DEFAULT_TRAILING_COMMISSION_MONTHS: undefined,
      AFFILIATE_HOLD_DAYS: undefined,
      AFFILIATE_PORTAL_ENABLED: undefined,
    }));

    expect(module.env.AFFILIATE_COOKIE_TTL_DAYS).toBe(90);
    expect(module.env.AFFILIATE_DEFAULT_COMMISSION_BPS).toBe(5000);
    expect(module.env.AFFILIATE_DEFAULT_COMMISSION_MONTHS).toBe(12);
    expect(module.env.AFFILIATE_DEFAULT_TRAILING_COMMISSION_BPS).toBe(3000);
    expect(module.env.AFFILIATE_DEFAULT_TRAILING_COMMISSION_MONTHS).toBe(6);
    expect(module.env.AFFILIATE_HOLD_DAYS).toBe(30);
    expect(module.env.AFFILIATE_PORTAL_ENABLED).toBe(false);
  });

  it('parses explicit affiliate configuration overrides', async () => {
    const module = await importEnvWith(withRequiredBase({
      AFFILIATE_COOKIE_TTL_DAYS: '120',
      AFFILIATE_DEFAULT_COMMISSION_BPS: '5500',
      AFFILIATE_DEFAULT_COMMISSION_MONTHS: '12',
      AFFILIATE_DEFAULT_TRAILING_COMMISSION_BPS: '3500',
      AFFILIATE_DEFAULT_TRAILING_COMMISSION_MONTHS: '9',
      AFFILIATE_HOLD_DAYS: '14',
      AFFILIATE_PORTAL_ENABLED: 'true',
    }));

    expect(module.env.AFFILIATE_COOKIE_TTL_DAYS).toBe(120);
    expect(module.env.AFFILIATE_DEFAULT_COMMISSION_BPS).toBe(5500);
    expect(module.env.AFFILIATE_DEFAULT_COMMISSION_MONTHS).toBe(12);
    expect(module.env.AFFILIATE_DEFAULT_TRAILING_COMMISSION_BPS).toBe(3500);
    expect(module.env.AFFILIATE_DEFAULT_TRAILING_COMMISSION_MONTHS).toBe(9);
    expect(module.env.AFFILIATE_HOLD_DAYS).toBe(14);
    expect(module.env.AFFILIATE_PORTAL_ENABLED).toBe(true);
  });

  it('defaults webhook delivery configuration values when unset', async () => {
    const module = await importEnvWith(withRequiredBase({
      WEBHOOK_DELIVERY_TIMEOUT_MS: undefined,
      WEBHOOK_FAILURE_DISABLE_THRESHOLD: undefined,
      WEBHOOK_MAX_ATTEMPTS: undefined,
    }));

    expect(module.env.WEBHOOK_DELIVERY_TIMEOUT_MS).toBe(5000);
    expect(module.env.WEBHOOK_FAILURE_DISABLE_THRESHOLD).toBe(5);
    expect(module.env.WEBHOOK_MAX_ATTEMPTS).toBe(6);
  });

  it('parses explicit webhook delivery configuration overrides', async () => {
    const module = await importEnvWith(withRequiredBase({
      WEBHOOK_DELIVERY_TIMEOUT_MS: '8000',
      WEBHOOK_FAILURE_DISABLE_THRESHOLD: '3',
      WEBHOOK_MAX_ATTEMPTS: '4',
    }));

    expect(module.env.WEBHOOK_DELIVERY_TIMEOUT_MS).toBe(8000);
    expect(module.env.WEBHOOK_FAILURE_DISABLE_THRESHOLD).toBe(3);
    expect(module.env.WEBHOOK_MAX_ATTEMPTS).toBe(4);
  });

  describe('Google client offboarding feature flag', () => {
    it('defaults offboarding to disabled', async () => {
      const module = await importEnvWith(withRequiredBase());
      expect(module.env.GOOGLE_CLIENT_OFFBOARDING_ENABLED).toBe(false);
      expect(module.env.GOOGLE_CLIENT_OFFBOARDING_GA4_ENABLED).toBe(false);
    });

    it('parses offboarding flags as booleans', async () => {
      const module = await importEnvWith(withRequiredBase({
        GOOGLE_CLIENT_OFFBOARDING_ENABLED: 'true',
        GOOGLE_CLIENT_OFFBOARDING_GA4_ENABLED: 'true',
      }));
      expect(module.env.GOOGLE_CLIENT_OFFBOARDING_ENABLED).toBe(true);
      expect(module.env.GOOGLE_CLIENT_OFFBOARDING_GA4_ENABLED).toBe(true);
    });

    it('isOffboardingEnabled returns false when global flag is disabled', async () => {
      const module = await importEnvWith(withRequiredBase({
        GOOGLE_CLIENT_OFFBOARDING_ALLOWED_AGENCIES: 'agency_1,agency_2',
      }));
      expect(module.isOffboardingEnabled('agency_1')).toBe(false);
    });

    it('isOffboardingEnabled returns false when no agencyId is provided', async () => {
      const module = await importEnvWith(withRequiredBase({
        GOOGLE_CLIENT_OFFBOARDING_ENABLED: 'true',
        GOOGLE_CLIENT_OFFBOARDING_ALLOWED_AGENCIES: 'agency_1',
      }));
      expect(module.isOffboardingEnabled()).toBe(false);
      expect(module.isOffboardingEnabled(undefined)).toBe(false);
    });

    it('isOffboardingEnabled returns false when allowlist is empty', async () => {
      const module = await importEnvWith(withRequiredBase({
        GOOGLE_CLIENT_OFFBOARDING_ENABLED: 'true',
        GOOGLE_CLIENT_OFFBOARDING_ALLOWED_AGENCIES: undefined,
      }));
      expect(module.isOffboardingEnabled('agency_1')).toBe(false);
    });

    it('isOffboardingEnabled returns true only for allowlisted agencies', async () => {
      const module = await importEnvWith(withRequiredBase({
        GOOGLE_CLIENT_OFFBOARDING_ENABLED: 'true',
        GOOGLE_CLIENT_OFFBOARDING_ALLOWED_AGENCIES: 'agency_1,agency_2',
      }));
      expect(module.isOffboardingEnabled('agency_1')).toBe(true);
      expect(module.isOffboardingEnabled('agency_2')).toBe(true);
      expect(module.isOffboardingEnabled('agency_3')).toBe(false);
    });

    it('parses offboarding allowed agencies as trimmed array', async () => {
      const module = await importEnvWith(withRequiredBase({
        GOOGLE_CLIENT_OFFBOARDING_ENABLED: 'true',
        GOOGLE_CLIENT_OFFBOARDING_ALLOWED_AGENCIES: ' agency_a , agency_b ,,',
      }));
      expect(module.env.GOOGLE_CLIENT_OFFBOARDING_ALLOWED_AGENCIES).toEqual(['agency_a', 'agency_b']);
    });

    it('fails in production when offboarding enabled without Google OAuth credentials', async () => {
      await expect(importEnvWith(withRequiredBase({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.example.com',
        API_URL: 'https://api.example.com',
        INFISICAL_ENVIRONMENT: 'production',
        GOOGLE_CLIENT_OFFBOARDING_ENABLED: 'true',
        GOOGLE_CLIENT_ID: undefined,
        GOOGLE_CLIENT_SECRET: undefined,
      }))).rejects.toThrow('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required when Google client offboarding is enabled');
    });

    it('fails in production when GA4 offboarding enabled without developer token', async () => {
      await expect(importEnvWith(withRequiredBase({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.example.com',
        API_URL: 'https://api.example.com',
        INFISICAL_ENVIRONMENT: 'production',
        GOOGLE_CLIENT_OFFBOARDING_ENABLED: 'true',
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        OFFBOARDING_CAPABILITY_SECRET: 'test-cap-secret',
        GOOGLE_CLIENT_OFFBOARDING_GA4_ENABLED: 'true',
        GOOGLE_ADS_DEVELOPER_TOKEN: undefined,
      }))).rejects.toThrow('GOOGLE_ADS_DEVELOPER_TOKEN is required when the GA4 offboarding adapter is enabled');
    });

    it('allows GA4 offboarding enabled with developer token present', async () => {
      await expect(importEnvWith(withRequiredBase({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.example.com',
        API_URL: 'https://api.example.com',
        INFISICAL_ENVIRONMENT: 'production',
        GOOGLE_CLIENT_OFFBOARDING_ENABLED: 'true',
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        OFFBOARDING_CAPABILITY_SECRET: 'test-cap-secret',
        GOOGLE_CLIENT_OFFBOARDING_GA4_ENABLED: 'true',
        GOOGLE_ADS_DEVELOPER_TOKEN: 'test-dev-token',
      }))).resolves.toBeDefined();
    });
  });

  describe('META_MARKETING_API_TIER_CRON_BURST', () => {
    it('enables burst only for true or 1', async () => {
      const enabledTrue = await importEnvWith(withRequiredBase({
        META_MARKETING_API_TIER_CRON_BURST: 'true',
      }));
      expect(enabledTrue.env.META_MARKETING_API_TIER_CRON_BURST).toBe(true);

      vi.resetModules();
      process.env = { ...ORIGINAL_ENV };
      const enabledOne = await importEnvWith(withRequiredBase({
        META_MARKETING_API_TIER_CRON_BURST: '1',
      }));
      expect(enabledOne.env.META_MARKETING_API_TIER_CRON_BURST).toBe(true);
    });

    it('defaults burst off for false, empty, or yes', async () => {
      const disabled = await importEnvWith(withRequiredBase({
        META_MARKETING_API_TIER_CRON_BURST: 'yes',
      }));
      expect(disabled.env.META_MARKETING_API_TIER_CRON_BURST).toBe(false);

      vi.resetModules();
      process.env = { ...ORIGINAL_ENV };
      const unset = await importEnvWith(withRequiredBase({}));
      expect(unset.env.META_MARKETING_API_TIER_CRON_BURST).toBe(false);
    });
  });
});
