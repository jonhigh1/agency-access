const testEnvDefaults: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/agency_access_test',
  FRONTEND_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:3001',
  CLERK_PUBLISHABLE_KEY: 'pk_test_dummy',
  CLERK_SECRET_KEY: 'sk_test_dummy',
  INFISICAL_CLIENT_ID: 'test-infisical-client-id',
  INFISICAL_CLIENT_SECRET: 'test-infisical-client-secret',
  INFISICAL_PROJECT_ID: 'test-infisical-project-id',
  INFISICAL_ENVIRONMENT: 'test',
  META_APP_ID: 'test-meta-app-id',
  META_APP_SECRET: 'test-meta-app-secret',
  CREEM_API_KEY: 'test-creem-api-key',
  CREEM_WEBHOOK_SECRET: 'test-creem-webhook-secret',
  API_KEY_PEPPER: 'test-pepper-do-not-use-in-production',
  GOOGLE_ADS_DEVELOPER_TOKEN: 'test-google-ads-developer-token',
};

for (const [key, value] of Object.entries(testEnvDefaults)) {
  process.env[key] ??= value;
}
