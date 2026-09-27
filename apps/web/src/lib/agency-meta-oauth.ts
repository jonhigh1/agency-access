import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';

export async function startAgencyMetaOAuth(input: {
  agencyId: string;
  userEmail: string;
  getToken: () => Promise<string | null>;
}) {
  if (!input.agencyId || !input.userEmail) {
    throw new Error('Agency and user identity are required to connect Meta.');
  }

  const json = await authorizedApiFetch<{ data?: { authUrl?: string } }>('/agency-platforms/meta/initiate', {
    method: 'POST',
    getToken: input.getToken,
    body: JSON.stringify({
      agencyId: input.agencyId,
      userEmail: input.userEmail,
      redirectUrl: `${window.location.origin}/platforms/callback`,
    }),
  });
  if (!json.data?.authUrl) throw new Error('Meta did not return an authorization URL.');

  window.location.assign(json.data.authUrl);
}
