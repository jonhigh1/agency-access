/**
 * Meta Configuration Diagnostic Script
 *
 * Checks public app metadata, production OAuth URLs, Login for Business config,
 * and app permission access levels.
 *
 * Usage:
 *   META_APP_ID=... META_APP_SECRET=... META_LOGIN_FOR_BUSINESS_CONFIG_ID=... npx tsx scripts/verify-meta-config.ts
 */

import { META_GRAPH_VERSION } from '@agency-platform/shared';

const appId = process.env.META_APP_ID;
const appSecret = process.env.META_APP_SECRET;
const apiUrl = process.env.API_URL;
const frontendUrl = process.env.FRONTEND_URL;
const serverConfigId = process.env.META_LOGIN_FOR_BUSINESS_CONFIG_ID;
const configId = serverConfigId;

const GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

async function fetchMetaJson(url: string, appToken?: string): Promise<Record<string, any>> {
  const response = await fetch(url, {
    ...(appToken ? { headers: { Authorization: `Bearer ${appToken}` } } : {}),
    signal: AbortSignal.timeout(15_000),
    redirect: 'error',
  });
  const data = await response.json() as Record<string, any>;
  if (!response.ok || data.error) {
    const message = data.error?.message || `HTTP ${response.status}`;
    throw new Error(`Meta request failed: ${message}`);
  }
  return data;
}

async function runDiagnostic() {
  let configurationError = false;
  console.log('='.repeat(60));
  console.log('🔍 META OAUTH & APP CONFIGURATION DIAGNOSTIC');
  console.log('='.repeat(60));

  if (!appId) {
    console.error('❌ Missing META_APP_ID.');
    process.exit(1);
  }

  console.log(`📱 Meta App ID: ${appId}`);
  console.log(`🌐 Graph API version: ${META_GRAPH_VERSION}`);
  console.log(`🔐 Meta App Secret: ${appSecret ? 'configured (value hidden)' : 'missing'}`);
  if (!appSecret && process.env.NODE_ENV === 'production') {
    console.error('❌ META_APP_SECRET is required in production.');
    configurationError = true;
  }
  if (apiUrl) {
    try {
      const parsedApiUrl = new URL(apiUrl);
      console.log(`🔗 API URL: ${parsedApiUrl.origin}`);
      console.log(`↩️ Agency OAuth callback: ${new URL('/agency-platforms/meta/callback', parsedApiUrl).toString()}`);
      if (process.env.NODE_ENV === 'production' && parsedApiUrl.protocol !== 'https:') {
        console.error('❌ Production API_URL must use HTTPS.');
        configurationError = true;
      }
    } catch {
      console.error('❌ API_URL is not a valid URL.');
      configurationError = true;
    }
  } else {
    console.log('⚠️  API_URL is missing; callback cannot be checked.');
    if (process.env.NODE_ENV === 'production') configurationError = true;
  }
  if (frontendUrl) {
    try {
      const parsedFrontendUrl = new URL(frontendUrl);
      console.log(`🖥️ Frontend URL: ${parsedFrontendUrl.origin}`);
      console.log(`↩️ Client OAuth callback: ${new URL('/invite/oauth-callback', parsedFrontendUrl).toString()}`);
      if (process.env.NODE_ENV === 'production' && parsedFrontendUrl.protocol !== 'https:') {
        console.error('❌ Production FRONTEND_URL must use HTTPS.');
        configurationError = true;
      }
    } catch {
      console.error('❌ FRONTEND_URL is not a valid URL.');
      configurationError = true;
    }
  } else {
    console.log('⚠️  FRONTEND_URL is missing; client callback cannot be checked.');
    if (process.env.NODE_ENV === 'production') configurationError = true;
  }
  if (configId) {
    console.log(`⚙️  Login for Business Config ID: ${configId}`);
  } else {
    console.log('⚠️  No Config ID provided.');
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ META_LOGIN_FOR_BUSINESS_CONFIG_ID is required in production.');
      configurationError = true;
    }
  }

  if (!appSecret) {
    console.log('\n⚠️  META_APP_SECRET was not provided in the environment.');
    console.log('   Running public/app-tokenless checks only...\n');
  }

  const appToken = appSecret ? `${appId}|${appSecret}` : null;

  // 1. Check App Details
  console.log('\n1️⃣ Checking Meta App Details...');
  try {
    const fields = [
      'id',
      'name',
      'link',
      'category',
      'app_domains',
      'privacy_policy_url',
      'terms_of_service_url',
      'user_support_email',
      'restrictions',
      'supported_platforms',
    ].join(',');

    const url = appToken
      ? `${GRAPH_BASE}/${appId}?fields=${fields}`
      : `${GRAPH_BASE}/${appId}?fields=id,name`;

    const data = await fetchMetaJson(url, appToken || undefined);
    if (data.id !== appId) {
      console.error(`❌ Meta returned App ID ${data.id}, expected ${appId}.`);
      configurationError = true;
    } else {
      console.log(`✅ App Name: ${data.name}`);
    }
    if (data.category) console.log(`   Category: ${data.category}`);
    if (data.app_domains) console.log(`   App Domains: ${JSON.stringify(data.app_domains)}`);
    if (data.privacy_policy_url) console.log(`   Privacy Policy: ${data.privacy_policy_url}`);
    if (data.terms_of_service_url) console.log(`   Terms of Service: ${data.terms_of_service_url}`);
    if (data.user_support_email) console.log(`   Support Email: ${data.user_support_email}`);
    if (data.restrictions) console.log(`   ⚠️ Restrictions: ${JSON.stringify(data.restrictions)}`);
  } catch (err) {
    console.error('❌ Failed to query Meta App info:', err);
    configurationError = true;
  }

  // 2. Discover Configurations and/or Check Facebook Login for Business Configuration (config_id)
  if (appToken) {
    console.log('\n2️⃣ Checking Facebook Login for Business Configurations...');

    // Try to list configurations on the app
    try {
      const listUrl = `${GRAPH_BASE}/${appId}/login_for_business_configs`;
      const listData = await fetchMetaJson(listUrl, appToken);
      if (listData.data && listData.data.length > 0) {
        console.log(`✅ Found ${listData.data.length} Configuration(s) on App:`);
        listData.data.forEach((cfg: any) => {
          console.log(`   - ID: ${cfg.id} | Name: ${cfg.name || 'Unnamed'}`);
        });
      } else if (listData.error) {
        console.log(`ℹ️ List configs on app: [${listData.error.code}] ${listData.error.message}`);
      } else {
        console.log(`ℹ️ No configurations returned under /{appId}/login_for_business_configs.`);
      }
    } catch (err) {
      console.warn('⚠️ Could not list Login for Business configs; checking supplied config ID directly.', err);
    }

    if (!configId) {
      console.log('\n   No Login for Business config ID was supplied; skipping its detail check.');
    } else {
      console.log(`\n   Checking Configuration ID: ${configId}`);
      try {
        const url = `${GRAPH_BASE}/${configId}?fields=id,name,business_id,permissions,response_type,session_duration,asset_types`;
        const data = await fetchMetaJson(url, appToken);
        if (data.id !== configId) {
          console.error(`❌ Meta returned Config ID ${data.id}, expected ${configId}.`);
          configurationError = true;
        } else {
          console.log(`✅ Configuration Found: "${data.name || data.id}"`);
        }
        if (data.business_id) console.log(`   Owning Business ID: ${data.business_id}`);
        if (data.permissions) {
          console.log('   Configured Permissions:');
          data.permissions.forEach((p: any) => console.log(`     - ${typeof p === 'string' ? p : JSON.stringify(p)}`));
        }
        if (data.asset_types) console.log(`   Configured Asset Types: ${JSON.stringify(data.asset_types)}`);
      } catch (err) {
        console.error(`❌ Failed to query Config ID ${configId}:`, err);
        configurationError = true;
      }
    }
  }

  // 3. Check App Permissions & Review Status
  if (appToken) {
    console.log('\n3️⃣ Checking App Permissions & Access Levels (Standard vs Advanced)...');
    try {
      const url = `${GRAPH_BASE}/${appId}/permissions`;
      const data = await fetchMetaJson(url, appToken);

      if (data.data) {
        console.log(`📋 Permissions & Review Status:`);
        const permissions: Array<{ permission: string; status: string }> = data.data;
        if (permissions.length === 0) {
          console.log('   (No explicit permissions returned on /permissions endpoint)');
        } else {
          permissions.forEach((p) => {
            const isAdvanced = p.status === 'live' || p.status === 'granted';
            const icon = isAdvanced ? '🟢' : '🟡';
            console.log(`   ${icon} ${p.permission}: ${p.status}`);
          });
        }
      }
    } catch (err) {
      console.error('❌ Failed to query App Permissions:', err);
      configurationError = true;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 DIAGNOSTIC COMPLETE');
  console.log('='.repeat(60));
  if (configurationError) process.exitCode = 1;
}

runDiagnostic().catch((err) => {
  console.error('❌ Meta configuration diagnostic failed:', err);
  process.exitCode = 1;
});
