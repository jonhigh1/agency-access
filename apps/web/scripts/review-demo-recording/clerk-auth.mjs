import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClerkClient } from '@clerk/backend';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../../..');

function loadEnv() {
  dotenv.config({ path: path.join(repoRoot, 'apps/api/.env') });
  dotenv.config({ path: path.join(repoRoot, 'apps/web/.env.local') });
}

export function resolveBaseUrl() {
  return (process.env.META_REVIEW_RECORDING_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000').replace(
    /\/$/,
    ''
  );
}

export function resolveLabClerkUserId() {
  const explicit = process.env.META_REVIEW_LAB_CLERK_USER_ID?.trim();
  if (explicit) return explicit;
  const fromList = (process.env.NEXT_PUBLIC_META_REVIEW_LAB_USER_IDS || process.env.META_REVIEW_LAB_USER_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)[0];
  if (fromList) return fromList;
  throw new Error(
    'Set META_REVIEW_LAB_CLERK_USER_ID or NEXT_PUBLIC_META_REVIEW_LAB_USER_IDS for recording harness auth'
  );
}

export async function mintClerkSessionJwt() {
  loadEnv();
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is required (apps/api/.env or env)');
  }
  const userId = resolveLabClerkUserId();
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const session = await clerk.sessions.createSession({ userId });
  const tokenResponse = await fetch(`https://api.clerk.com/v1/sessions/${session.id}/tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    throw new Error(`Failed to mint Clerk session token: ${tokenResponse.status} ${details}`);
  }
  const tokenPayload = await tokenResponse.json();
  if (!tokenPayload.jwt) {
    throw new Error('Clerk token endpoint returned no jwt field');
  }
  return { userId, sessionId: session.id, jwt: tokenPayload.jwt };
}

/**
 * Clerk Next.js stores session state in cookies after UI sign-in.
 * Prefer a saved storage state for repeatable headful runs; fall back to UI sign-in when credentials are set.
 * @param {import('playwright').BrowserContext} context
 * @param {import('playwright').Page} page
 */
export async function ensureClerkSignedIn(context, page) {
  const storagePath = process.env.META_REVIEW_CLERK_STORAGE_STATE?.trim();
  if (storagePath) {
    try {
      await fs.access(storagePath);
      const state = JSON.parse(await fs.readFile(storagePath, 'utf8'));
      await context.addCookies(state.cookies ?? []);
      return;
    } catch (error) {
      throw new Error(`Failed to load META_REVIEW_CLERK_STORAGE_STATE at ${storagePath}: ${error}`);
    }
  }

  const email = process.env.META_REVIEW_CLERK_EMAIL?.trim();
  const password = process.env.META_REVIEW_CLERK_PASSWORD;
  if (email && password) {
    const baseUrl = resolveBaseUrl();
    await page.goto(`${baseUrl}/sign-in`, { waitUntil: 'domcontentloaded' });
    const identifier = page.locator('input[name="identifier"], input[type="email"]').first();
    await identifier.waitFor({ state: 'visible', timeout: 30_000 });
    await identifier.fill(email);
    const continueButton = page.getByRole('button', { name: /continue/i }).first();
    await continueButton.click();
    const passwordField = page.locator('input[name="password"], input[type="password"]').first();
    await passwordField.waitFor({ state: 'visible', timeout: 30_000 });
    await passwordField.fill(password);
    await page.getByRole('button', { name: /continue|sign in/i }).first().click();
    await page.waitForURL((url) => !url.pathname.includes('sign-in'), { timeout: 120_000 });
    if (storagePath) {
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await context.storageState({ path: storagePath });
    }
    return;
  }

  throw new Error(
    'Clerk auth for recording: set META_REVIEW_CLERK_STORAGE_STATE (recommended) or META_REVIEW_CLERK_EMAIL + META_REVIEW_CLERK_PASSWORD'
  );
}
