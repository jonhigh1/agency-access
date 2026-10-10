type IdentityClient = {
  identify: (id: string) => unknown;
  reset: () => unknown;
  get_property: (key: string) => unknown;
  register: (properties: Record<string, unknown>) => unknown;
};

let client: IdentityClient | null = null;
let userId: string | null | undefined;
let recipient = false;

function applyIdentity(): void {
  if (!client || userId === undefined) return;
  try {
    const previousUser = client.get_property('$user_id');
    const previousScope = client.get_property('authhub_identity_scope');
    const nextScope = recipient ? 'recipient' : 'app';
    const scopeChanged = previousScope !== undefined && previousScope !== nextScope;
    const shouldReset = scopeChanged || Boolean(previousUser && previousUser !== userId);
    if (shouldReset) client.reset();
    if (userId && (previousUser !== userId || shouldReset)) client.identify(userId);
    // Persist the boundary across full page navigations, without storing PII.
    client.register({ authhub_identity_scope: nextScope });
  } catch {
    // Authentication never depends on analytics availability.
  }
}

/** Called from the SDK loaded callback so deferred init cannot lose auth state. */
export function registerPosthogIdentityClient(loadedClient: IdentityClient): void {
  client = loadedClient;
  applyIdentity();
}

export function setPosthogUserIdentity(nextUserId: string | null, isRecipient = false): void {
  recipient = isRecipient;
  userId = isRecipient ? null : nextUserId;
  applyIdentity();
}

export function resetPosthogIdentityForTests(): void {
  client = null;
  userId = undefined;
  recipient = false;
}
