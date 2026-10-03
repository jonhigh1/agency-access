import { describe, it, expect, beforeEach, vi } from 'vitest';

const { resolveAgencyMock, clerkClientMock } = vi.hoisted(() => ({
  resolveAgencyMock: vi.fn(),
  clerkClientMock: {
    users: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => clerkClientMock),
}));

vi.mock('@/services/agency-resolution.service', () => ({
  agencyResolutionService: {
    resolveAgency: resolveAgencyMock,
  },
}));

import { resolveAuthenticatedUserEmail, resolvePrincipalAgency } from '../authorization';

describe('resolveAuthenticatedUserEmail', () => {
  beforeEach(() => {
    clerkClientMock.users.getUser.mockReset();
  });

  it('uses a verified Clerk email when a valid JWT has no email claim', async () => {
    clerkClientMock.users.getUser.mockResolvedValue({
      primaryEmailAddressId: 'email_1',
      emailAddresses: [
        {
          id: 'email_1',
          emailAddress: 'Owner@Acme.test',
          verification: { status: 'verified' },
        },
      ],
    });

    await expect(resolveAuthenticatedUserEmail({ sub: 'user_1' })).resolves.toBe(
      'owner@acme.test'
    );
    expect(clerkClientMock.users.getUser).toHaveBeenCalledWith('user_1');
  });

  it('uses the normalized JWT email without a Clerk lookup', async () => {
    await expect(
      resolveAuthenticatedUserEmail({ sub: 'user_1', email: 'Owner@Acme.test' })
    ).resolves.toBe('owner@acme.test');
    expect(clerkClientMock.users.getUser).not.toHaveBeenCalled();
  });

  it('does not use an unverified Clerk email', async () => {
    clerkClientMock.users.getUser.mockResolvedValue({
      primaryEmailAddressId: 'email_1',
      emailAddresses: [
        {
          id: 'email_1',
          emailAddress: 'owner@acme.test',
          verification: { status: 'unverified' },
        },
      ],
    });

    await expect(resolveAuthenticatedUserEmail({ sub: 'user_1' })).resolves.toBeUndefined();
  });

  it('does not call Clerk for a subject that is not a user id', async () => {
    await expect(
      resolveAuthenticatedUserEmail({ sub: 'org_2abc' })
    ).resolves.toBeUndefined();
    expect(clerkClientMock.users.getUser).not.toHaveBeenCalled();
  });

  it('does not call Clerk when there is no subject at all', async () => {
    await expect(resolveAuthenticatedUserEmail(undefined)).resolves.toBeUndefined();
    expect(clerkClientMock.users.getUser).not.toHaveBeenCalled();
  });
});

describe('resolvePrincipalAgency', () => {
  beforeEach(() => {
    resolveAgencyMock.mockReset();
    clerkClientMock.users.getUser.mockReset();
    clerkClientMock.users.getUser.mockRejectedValue(new Error('Clerk unavailable'));
  });

  it('uses cache-first lookup without create-if-missing when agency exists', async () => {
    resolveAgencyMock.mockResolvedValue({
      data: {
        agencyId: 'agency_123',
        agency: {
          id: 'agency_123',
          clerkUserId: 'user_123',
          name: 'Acme Agency',
          email: 'owner@acme.test',
        },
      },
      error: null,
    });

    const request: any = {
      user: {
        sub: 'user_123',
      },
    };

    const result = await resolvePrincipalAgency(request);

    expect(resolveAgencyMock).toHaveBeenCalledTimes(1);
    expect(resolveAgencyMock).toHaveBeenCalledWith('user_123', {
      createIfMissing: false,
      userEmail: undefined,
    });
    expect(clerkClientMock.users.getUser).not.toHaveBeenCalled();

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      agencyId: 'agency_123',
      principalId: 'user_123',
      agency: {
        id: 'agency_123',
        name: 'Acme Agency',
        email: 'owner@acme.test',
      },
    });
  });

  it('falls back to create-if-missing when cache-first lookup misses', async () => {
    resolveAgencyMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'AGENCY_NOT_FOUND',
          message: 'not found',
        },
      })
      .mockResolvedValueOnce({
        data: {
          agencyId: 'agency_999',
          agency: {
            id: 'agency_999',
            clerkUserId: 'user_123',
            name: 'Recovered Agency',
            email: 'owner@acme.test',
          },
        },
        error: null,
      });

    const request: any = {
      user: {
        sub: 'user_123',
      },
    };

    const result = await resolvePrincipalAgency(request);

    expect(resolveAgencyMock).toHaveBeenCalledTimes(2);
    expect(resolveAgencyMock).toHaveBeenNthCalledWith(1, 'user_123', {
      createIfMissing: false,
      userEmail: undefined,
    });
    expect(resolveAgencyMock).toHaveBeenNthCalledWith(2, 'user_123', {
      createIfMissing: true,
      userEmail: undefined,
    });

    expect(result.error).toBeNull();
    expect(result.data?.agencyId).toBe('agency_999');
  });

  it('passes normalized email from token claims when resolving principal agency', async () => {
    resolveAgencyMock.mockResolvedValue({
      data: {
        agencyId: 'agency_123',
        agency: {
          id: 'agency_123',
          clerkUserId: 'user_123',
          name: 'Acme Agency',
          email: 'owner@acme.test',
        },
      },
      error: null,
    });

    const request: any = {
      user: {
        sub: 'user_123',
        email_addresses: [{ email_address: 'OWNER@ACME.TEST' }],
      },
    };

    await resolvePrincipalAgency(request);

    expect(resolveAgencyMock).toHaveBeenCalledWith('user_123', {
      createIfMissing: false,
      userEmail: 'owner@acme.test',
    });
  });

  it('fetches the Clerk email before creating a missing agency', async () => {
    clerkClientMock.users.getUser.mockResolvedValue({
      primaryEmailAddressId: 'email_1',
      emailAddresses: [
        {
          id: 'email_1',
          emailAddress: 'ben@mindbentmedia.com',
          verification: { status: 'verified' },
        },
      ],
    });
    resolveAgencyMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          agencyId: 'agency_1',
          agency: {
            id: 'agency_1',
            clerkUserId: 'user_1',
            name: 'Mindbent Media',
            email: 'ben@mindbentmedia.com',
          },
        },
        error: null,
      });

    const result = await resolvePrincipalAgency({
      user: { sub: 'user_1' },
    } as any);

    expect(result.error).toBeNull();
    expect(clerkClientMock.users.getUser).toHaveBeenCalledWith('user_1');
    expect(resolveAgencyMock).toHaveBeenLastCalledWith('user_1', {
      createIfMissing: true,
      userEmail: 'ben@mindbentmedia.com',
    });
  });

  it('does not inherit an unverified Clerk email as agency identity', async () => {
    clerkClientMock.users.getUser.mockResolvedValue({
      primaryEmailAddressId: 'email_1',
      emailAddresses: [
        {
          id: 'email_1',
          emailAddress: 'owner@victim-agency.test',
          verification: { status: 'unverified' },
        },
      ],
    });
    resolveAgencyMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          agencyId: 'agency_1',
          agency: {
            id: 'agency_1',
            clerkUserId: 'user_1',
            name: 'My Agency',
            email: 'user_1@clerk.temp',
          },
        },
        error: null,
      });

    const result = await resolvePrincipalAgency({
      user: { sub: 'user_1' },
    } as any);

    expect(clerkClientMock.users.getUser).toHaveBeenCalledWith('user_1');
    expect(resolveAgencyMock).toHaveBeenLastCalledWith('user_1', {
      createIfMissing: true,
      userEmail: undefined,
    });
  });

  it('prefers the primary email over a later verified address', async () => {
    clerkClientMock.users.getUser.mockResolvedValue({
      primaryEmailAddressId: 'email_2',
      emailAddresses: [
        {
          id: 'email_1',
          emailAddress: 'first@acme.test',
          verification: { status: 'verified' },
        },
        {
          id: 'email_2',
          emailAddress: 'primary@acme.test',
          verification: { status: 'verified' },
        },
      ],
    });
    resolveAgencyMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          agencyId: 'agency_1',
          agency: {
            id: 'agency_1',
            clerkUserId: 'user_1',
            name: 'Acme',
            email: 'primary@acme.test',
          },
        },
        error: null,
      });

    await resolvePrincipalAgency({ user: { sub: 'user_1' } } as any);

    expect(resolveAgencyMock).toHaveBeenLastCalledWith('user_1', {
      createIfMissing: true,
      userEmail: 'primary@acme.test',
    });
  });
});
