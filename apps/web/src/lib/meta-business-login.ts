'use client';

import { getApiBaseUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';

const META_SDK_SCRIPT_ID = 'meta-business-login-sdk';
const META_SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
const META_GRAPH_VERSION = 'v21.0';
const META_LOGIN_TIMEOUT_MS = 15_000;

type MetaBusinessLoginOptions = {
  appId: string;
  configId: string;
};

export interface MetaBusinessLoginAuthPayload {
  accessToken: string;
  userId: string;
  expiresIn?: number;
  signedRequest?: string;
  dataAccessExpirationTime?: number;
}

interface MetaLoginResponse {
  status?: string;
  authResponse?: {
    accessToken?: string;
    userID?: string;
    expiresIn?: number;
    signedRequest?: string;
    data_access_expiration_time?: number;
  };
}

interface MetaBusinessLoginFinalizeResponse {
  data: Record<string, unknown>;
  error: null;
}

interface MetaSdk {
  init: (params: {
    appId: string;
    cookie?: boolean;
    xfbml?: boolean;
    version: string;
  }) => void;
  login: (
    callback: (response: MetaLoginResponse) => void,
    options?: Record<string, unknown>
  ) => void;
}

declare global {
  interface Window {
    FB?: MetaSdk;
    fbAsyncInit?: () => void;
  }
}

let sdkPromise: Promise<MetaSdk> | null = null;

function buildHeaders(token: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function resetMetaBusinessLoginSdkForTests() {
  sdkPromise = null;
}

export async function loadMetaBusinessLoginSdk({
  appId,
}: Pick<MetaBusinessLoginOptions, 'appId'>): Promise<MetaSdk> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Meta Business Login is only available in the browser.');
  }

  if (window.FB) {
    window.FB.init({
      appId,
      cookie: false,
      xfbml: false,
      version: META_GRAPH_VERSION,
    });
    return window.FB;
  }

  if (!sdkPromise) {
    sdkPromise = new Promise<MetaSdk>((resolve, reject) => {
      const existingScript = document.getElementById(META_SDK_SCRIPT_ID) as HTMLScriptElement | null;

      window.fbAsyncInit = () => {
        if (!window.FB) {
          reject(new Error('Meta Business Login SDK did not initialize correctly.'));
          return;
        }

        window.FB.init({
          appId,
          cookie: false,
          xfbml: false,
          version: META_GRAPH_VERSION,
        });
        resolve(window.FB);
      };

      if (existingScript && window.FB) {
        window.FB.init({
          appId,
          cookie: false,
          xfbml: false,
          version: META_GRAPH_VERSION,
        });
        resolve(window.FB);
        return;
      }

      if (!existingScript) {
        const script = document.createElement('script');
        script.id = META_SDK_SCRIPT_ID;
        script.src = META_SDK_SRC;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          sdkPromise = null;
          reject(new Error('Failed to load Meta Business Login. Please try again.'));
        };
        document.head.appendChild(script);
      }
    });
  }

  return sdkPromise;
}

export async function launchMetaBusinessLogin({
  appId,
  configId,
}: MetaBusinessLoginOptions): Promise<MetaBusinessLoginAuthPayload> {
  if (!appId || !configId) {
    throw new Error('Meta Business Login is not configured. Add the Meta app ID and config ID.');
  }

  const sdk = await loadMetaBusinessLoginSdk({ appId });

  return new Promise<MetaBusinessLoginAuthPayload>((resolve, reject) => {
    sdk.login((response) => {
      const authResponse = response.authResponse;
      if (response.status !== 'connected' || !authResponse?.accessToken || !authResponse.userID) {
        reject(new Error('Meta login was cancelled or did not return a usable business session.'));
        return;
      }

      resolve({
        accessToken: authResponse.accessToken,
        userId: authResponse.userID,
        expiresIn: authResponse.expiresIn,
        signedRequest: authResponse.signedRequest,
        dataAccessExpirationTime: authResponse.data_access_expiration_time,
      });
    }, {
      config_id: configId,
    });
  });
}

/**
 * Client invite Meta popup login (no config_id).
 *
 * Uses scope-based FB.login for unauthenticated client invite pages.
 * Does not use Facebook Login for Business config; avoids the "Feature Unavailable"
 * error for non-role client users.
 *
 * Scopes match the backend client Meta OAuth flow, including the Page access surface.
 */
const META_CLIENT_SCOPES = [
  'ads_management',
  'ads_read',
  'business_management',
  'pages_read_engagement',
  'pages_show_list',
].join(',');

export async function launchMetaClientPopupLogin(appId: string): Promise<MetaBusinessLoginAuthPayload> {
  if (!appId) {
    throw new Error('Meta app ID is required for client popup login.');
  }

  const sdk = await loadMetaBusinessLoginSdk({ appId });

  return new Promise<MetaBusinessLoginAuthPayload>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Meta login timed out. Falling back to redirect login.'));
    }, META_LOGIN_TIMEOUT_MS);

    const finish = (callback: () => void) => {
      clearTimeout(timeoutId);
      callback();
    };

    try {
      sdk.login(
        (response) => {
          const authResponse = response.authResponse;
          const accessToken = authResponse?.accessToken;
          const userId = authResponse?.userID;
          if (
            response.status !== 'connected' ||
            !accessToken ||
            !userId
          ) {
            finish(() => reject(new Error('Meta login was cancelled or did not return a usable session.')));
            return;
          }

          finish(() =>
            resolve({
              accessToken,
              userId,
              expiresIn: authResponse.expiresIn,
              signedRequest: authResponse.signedRequest,
              dataAccessExpirationTime: authResponse.data_access_expiration_time,
            })
          );
        },
        { scope: META_CLIENT_SCOPES, enable_profile_selector: true }
      );
    } catch (error) {
      finish(() => reject(error));
    }
  });
}

export async function finalizeMetaBusinessLogin(input: {
  agencyId: string;
  userEmail: string;
  getToken: () => Promise<string | null>;
  authPayload: MetaBusinessLoginAuthPayload;
}): Promise<Record<string, unknown>> {
  const token = await input.getToken();

  const response = await fetch(`${getApiBaseUrl()}/agency-platforms/meta/business-login/finalize`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({
      agencyId: input.agencyId,
      userEmail: input.userEmail,
      accessToken: input.authPayload.accessToken,
      userId: input.authPayload.userId,
      expiresIn: input.authPayload.expiresIn,
      signedRequest: input.authPayload.signedRequest,
      dataAccessExpirationTime: input.authPayload.dataAccessExpirationTime,
    }),
  });

  const json = await parseJsonResponse<MetaBusinessLoginFinalizeResponse>(response, {
    fallbackErrorMessage: 'Failed to finalize Meta Business Login',
  });

  return json.data;
}
