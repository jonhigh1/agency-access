import { describe, expect, it } from 'vitest';
import {
  buildInviteRequestIdentity,
  formatInviteRequestShortId,
} from '../invite-request-identity';

describe('formatInviteRequestShortId', () => {
  it('returns the first eight characters of a uuid-style id', () => {
    expect(formatInviteRequestShortId('f25a641e-8b2a-4c1d-9e0a-1b2c3d4e5f6a')).toBe('f25a641e');
  });

  it('returns short ids unchanged', () => {
    expect(formatInviteRequestShortId('abc')).toBe('abc');
  });
});

describe('buildInviteRequestIdentity', () => {
  it('uses external reference as the primary request name when set', () => {
    const identity = buildInviteRequestIdentity({
      agencyName: 'Northwind Media',
      id: '3d8a85dc-1111-2222-3333-444455556666',
      createdAt: '2026-10-01T12:00:00.000Z',
      externalReference: 'Q4 Meta onboarding',
    });

    expect(identity.agencyName).toBe('Northwind Media');
    expect(identity.requestLabel).toMatch(/Q4 Meta onboarding/i);
    expect(identity.requestLabel).toMatch(/3d8a85dc/);
  });

  it('labels by short id when createdAt is missing', () => {
    const identity = buildInviteRequestIdentity({
      agencyName: 'Demo Agency',
      id: 'f25a641e-aaaa-bbbb-cccc-dddddddddddd',
    });

    expect(identity.requestLabel).toBe('Request · Ref f25a641e');
  });

  it('falls back to request date and short id when no external reference', () => {
    const identity = buildInviteRequestIdentity({
      agencyName: 'Demo Agency',
      id: 'f25a641e-aaaa-bbbb-cccc-dddddddddddd',
      createdAt: '2026-09-15T08:00:00.000Z',
    });

    expect(identity.requestLabel).toMatch(/request/i);
    expect(identity.requestLabel).toMatch(/f25a641e/);
    expect(identity.requestLabel).toMatch(/9\/15\/2026|15\/9\/2026|2026/);
  });

  it('produces different labels for two requests from the same agency', () => {
    const base = {
      agencyName: 'Same Agency',
      createdAt: '2026-10-01T12:00:00.000Z',
    };

    const first = buildInviteRequestIdentity({
      ...base,
      id: 'f25a641e-0000-0000-0000-000000000001',
    });
    const second = buildInviteRequestIdentity({
      ...base,
      id: '3d8a85dc-0000-0000-0000-000000000002',
    });

    expect(first.requestLabel).not.toBe(second.requestLabel);
  });
});
