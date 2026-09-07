export const INVITE_OAUTH_RETURN_KEY = 'invite-oauth-return-token';

export function rememberInviteOAuthReturnToken(accessRequestToken: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(INVITE_OAUTH_RETURN_KEY, accessRequestToken);
}

export function clearInviteOAuthReturnToken(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(INVITE_OAUTH_RETURN_KEY);
}

export function readInviteOAuthReturnToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(INVITE_OAUTH_RETURN_KEY);
}
