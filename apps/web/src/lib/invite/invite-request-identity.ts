import { toDisplayName } from '@/lib/display-name';
import { formatShortDate } from '@/lib/format';

export interface InviteRequestIdentityInput {
  agencyName: string;
  id: string;
  createdAt?: string | null;
  externalReference?: string | null;
}

export interface InviteRequestIdentity {
  agencyName: string;
  requestLabel: string;
}

export function formatInviteRequestShortId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.length <= 8) {
    return trimmed;
  }
  return trimmed.slice(0, 8);
}

export function buildInviteRequestIdentity(input: InviteRequestIdentityInput): InviteRequestIdentity {
  const agencyName = toDisplayName(input.agencyName) || input.agencyName;
  const shortId = formatInviteRequestShortId(input.id);
  const sentOn = input.createdAt ? formatShortDate(input.createdAt) : null;
  const reference = input.externalReference?.trim();
  const sentSegment = sentOn ? ` · Sent ${sentOn}` : '';

  const requestLabel = reference
    ? `${reference}${sentSegment} · Ref ${shortId}`
    : `Request${sentSegment} · Ref ${shortId}`;

  return { agencyName, requestLabel };
}
