import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const originalGoogleAdsDeveloperToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
beforeAll(() => {
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-google-ads-developer-token';
});
afterAll(() => {
  if (originalGoogleAdsDeveloperToken === undefined) {
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  } else {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = originalGoogleAdsDeveloperToken;
  }
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    googleNativeGrant: {
      findUnique: vi.fn(),
    },
    clientConnection: {
      update: vi.fn(),
    },
    platformAuthorization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/services/google-native-grant.service', () => ({
  googleNativeGrantService: {
    upsertGrant: vi.fn(),
    updateGrantState: vi.fn(),
  },
}));

vi.mock('@/services/token-lifecycle.service', () => ({
  ensureAgencyAccessToken: vi.fn(),
  refreshClientPlatformAuthorization: vi.fn(),
}));

vi.mock('@/services/audit.service', () => ({
  auditService: {
    createAuditLog: vi.fn(),
  },
}));

vi.mock('@/services/connectors/google-ads', () => ({
  googleAdsConnector: {
    createManagerLinkInvitation: vi.fn(),
    findManagerLink: vi.fn(),
    verifyManagerLink: vi.fn(),
    createUserAccessInvitation: vi.fn(),
    findUserAccessInvitation: vi.fn(),
    verifyUserAccess: vi.fn(),
  },
}));

vi.mock('@/lib/queue-helpers', () => ({
  queueGoogleNativeGrantExecution: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { auditService } from '@/services/audit.service';
import { googleAdsConnector } from '@/services/connectors/google-ads';
import { googleNativeGrantService } from '@/services/google-native-grant.service';
import { queueGoogleNativeGrantExecution } from '@/lib/queue-helpers';
import {
  ensureAgencyAccessToken,
  refreshClientPlatformAuthorization,
} from '@/services/token-lifecycle.service';
import { googleNativeAccessService } from '../google-native-access.service.js';

function mockGrantedAssetsTransaction(): void {
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
    callback(prisma)
  );
  vi.mocked(prisma.$queryRaw).mockResolvedValue([
    {
      id: 'connection-1',
      granted_assets: {
        google_ads: {
          adAccounts: ['9756457868'],
        },
      },
    },
  ] as never);
}

describe('GoogleNativeAccessService manager-link execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGrantedAssetsTransaction();
  });

  it('creates a manager-link invitation and persists client-pending lifecycle state', async () => {
    vi.mocked(prisma.googleNativeGrant.findUnique).mockResolvedValue({
      id: 'grant-1',
      accessRequestId: 'request-1',
      connectionId: 'connection-1',
      product: 'google_ads',
      assetId: '9756457868',
      grantMode: 'manager_link',
      managerCustomerId: '6449142979',
      nativeGrantState: 'pending',
      metadata: {
        requestedMode: 'manager_link',
        resolvedMode: 'manager_link',
      },
      connection: {
        id: 'connection-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
            googleGrantLifecycle: {
              product: 'google_ads',
              capabilityTier: 'native_grant_supported',
              fulfillmentMode: 'manager_link',
              state: 'pending_native_grant',
              requiresNativeGrant: true,
              isFulfilled: false,
              grantStatus: 'pending',
              pendingActor: 'none',
            },
          },
        },
      },
    } as any);
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'auth-1',
      metadata: {
        selectedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(ensureAgencyAccessToken).mockResolvedValue({
      data: {
        accessToken: 'agency-google-access-token',
      },
      error: null,
    } as any);
    vi.mocked(googleAdsConnector.createManagerLinkInvitation).mockResolvedValue({
      resourceName: 'customers/6449142979/customerClientLinks/123',
    });
    vi.mocked(googleAdsConnector.findManagerLink).mockResolvedValue({
      managerLinkId: '123',
      resourceName: 'customers/6449142979/customerClientLinks/123',
      status: 'PENDING',
    });
    vi.mocked(googleNativeGrantService.updateGrantState).mockResolvedValue({
      data: { id: 'grant-1' },
      error: null,
    } as any);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({ id: 'connection-1' } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'auth-1' } as any);

    const result = await googleNativeAccessService.executeGoogleNativeGrant('grant-1');

    expect(result.error).toBeNull();
    expect(googleAdsConnector.createManagerLinkInvitation).toHaveBeenCalledWith({
      accessToken: 'agency-google-access-token',
      managerCustomerId: '6449142979',
      clientCustomerId: '9756457868',
    });
    expect(googleAdsConnector.findManagerLink).toHaveBeenCalledWith({
      accessToken: 'agency-google-access-token',
      managerCustomerId: '6449142979',
      clientCustomerId: '9756457868',
    });
    expect(googleNativeGrantService.updateGrantState).toHaveBeenCalledWith(
      'grant-1',
      expect.objectContaining({
        nativeGrantState: 'awaiting_client_acceptance',
        providerExternalId: '123',
        providerResourceName: 'customers/6449142979/customerClientLinks/123',
        metadata: expect.objectContaining({
          requestedMode: 'manager_link',
          resolvedMode: 'manager_link',
          latestProviderStatus: 'PENDING',
        }),
      })
    );
    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
      data: {
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
            googleGrantLifecycle: expect.objectContaining({
              fulfillmentMode: 'manager_link',
              grantStatus: 'awaiting_client_acceptance',
              pendingActor: 'client',
            }),
          },
        },
      },
    });
    expect(prisma.platformAuthorization.update).toHaveBeenCalledWith({
      where: { id: 'auth-1' },
      data: {
        metadata: {
          selectedAssets: {
            google_ads: {
              adAccounts: ['9756457868'],
              googleGrantLifecycle: expect.objectContaining({
                grantStatus: 'awaiting_client_acceptance',
              }),
            },
          },
        },
      },
    });
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-1',
        action: 'GOOGLE_TOKEN_READ',
        resourceId: 'connection-1',
      })
    );
  });

  it('verifies an existing manager-link grant once Google reports it as active', async () => {
    const verifiedAt = new Date('2026-03-15T21:11:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(verifiedAt);

    vi.mocked(prisma.googleNativeGrant.findUnique).mockResolvedValue({
      id: 'grant-1',
      accessRequestId: 'request-1',
      connectionId: 'connection-1',
      product: 'google_ads',
      assetId: '9756457868',
      grantMode: 'manager_link',
      managerCustomerId: '6449142979',
      providerExternalId: '123',
      providerResourceName: 'customers/6449142979/customerClientLinks/123',
      nativeGrantState: 'awaiting_client_acceptance',
      metadata: {
        requestedMode: 'manager_link',
        resolvedMode: 'manager_link',
      },
      connection: {
        id: 'connection-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'auth-1',
      metadata: {
        selectedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(ensureAgencyAccessToken).mockResolvedValue({
      data: {
        accessToken: 'agency-google-access-token',
      },
      error: null,
    } as any);
    vi.mocked(googleAdsConnector.verifyManagerLink).mockResolvedValue({
      isLinked: true,
      status: 'ACTIVE',
      managerLinkId: '123',
    });
    vi.mocked(googleNativeGrantService.updateGrantState).mockResolvedValue({
      data: { id: 'grant-1' },
      error: null,
    } as any);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({ id: 'connection-1' } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'auth-1' } as any);

    const result = await googleNativeAccessService.executeGoogleNativeGrant('grant-1');

    expect(result.error).toBeNull();
    expect(googleAdsConnector.verifyManagerLink).toHaveBeenCalledWith({
      accessToken: 'agency-google-access-token',
      managerCustomerId: '6449142979',
      clientCustomerId: '9756457868',
      managerLinkId: '123',
    });
    expect(googleNativeGrantService.updateGrantState).toHaveBeenCalledWith(
      'grant-1',
      expect.objectContaining({
        nativeGrantState: 'verified',
        verifiedAt,
        metadata: expect.objectContaining({
          latestProviderStatus: 'ACTIVE',
        }),
      })
    );
    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
      data: {
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
            googleGrantLifecycle: expect.objectContaining({
              state: 'fulfilled',
              isFulfilled: true,
              grantStatus: 'verified',
              pendingActor: 'none',
            }),
          },
        },
      },
    });

    vi.useRealTimers();
  });

  it('resumes manager-link lookup without reissuing a create mutation when a provider resource already exists', async () => {
    vi.mocked(prisma.googleNativeGrant.findUnique).mockResolvedValue({
      id: 'grant-6',
      accessRequestId: 'request-1',
      connectionId: 'connection-1',
      product: 'google_ads',
      assetId: '9756457868',
      grantMode: 'manager_link',
      managerCustomerId: '6449142979',
      providerResourceName: 'customers/6449142979/customerClientLinks/123',
      nativeGrantState: 'pending',
      metadata: {
        requestedMode: 'manager_link',
        resolvedMode: 'manager_link',
      },
      connection: {
        id: 'connection-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'auth-1',
      metadata: {
        selectedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(ensureAgencyAccessToken).mockResolvedValue({
      data: {
        accessToken: 'agency-google-access-token',
      },
      error: null,
    } as any);
    vi.mocked(googleAdsConnector.findManagerLink).mockResolvedValue({
      managerLinkId: '123',
      resourceName: 'customers/6449142979/customerClientLinks/123',
      status: 'PENDING',
    });
    vi.mocked(googleNativeGrantService.updateGrantState).mockResolvedValue({
      data: { id: 'grant-6' },
      error: null,
    } as any);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({ id: 'connection-1' } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'auth-1' } as any);

    const result = await googleNativeAccessService.executeGoogleNativeGrant('grant-6');

    expect(result.error).toBeNull();
    expect(googleAdsConnector.createManagerLinkInvitation).not.toHaveBeenCalled();
    expect(googleAdsConnector.findManagerLink).toHaveBeenCalledWith({
      accessToken: 'agency-google-access-token',
      managerCustomerId: '6449142979',
      clientCustomerId: '9756457868',
    });
    expect(googleNativeGrantService.updateGrantState).toHaveBeenCalledWith(
      'grant-6',
      expect.objectContaining({
        nativeGrantState: 'awaiting_client_acceptance',
        providerExternalId: '123',
        providerResourceName: 'customers/6449142979/customerClientLinks/123',
      })
    );
  });
});

describe('GoogleNativeAccessService direct user-invite execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGrantedAssetsTransaction();
  });

  it('creates a user invitation with the client token and persists agency-pending lifecycle state', async () => {
    vi.mocked(prisma.googleNativeGrant.findUnique).mockResolvedValue({
      id: 'grant-2',
      accessRequestId: 'request-1',
      connectionId: 'connection-1',
      product: 'google_ads',
      assetId: '9756457868',
      grantMode: 'user_invite',
      recipientEmail: 'jon.highmu@gmail.com',
      nativeGrantState: 'pending',
      metadata: {
        requestedMode: 'user_invite',
        resolvedMode: 'user_invite',
      },
      connection: {
        id: 'connection-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'auth-1',
      metadata: {
        selectedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(refreshClientPlatformAuthorization).mockResolvedValue({
      data: {
        accessToken: 'client-google-access-token',
      },
      error: null,
    } as any);
    vi.mocked(googleAdsConnector.createUserAccessInvitation).mockResolvedValue({
      resourceName:
        'customers/9756457868/customerUserAccessInvitations/jon.highmu@gmail.com',
    });
    vi.mocked(googleAdsConnector.findUserAccessInvitation).mockResolvedValue({
      invitationId: '555',
      resourceName:
        'customers/9756457868/customerUserAccessInvitations/jon.highmu@gmail.com',
      emailAddress: 'jon.highmu@gmail.com',
      accessRole: 'ADMIN',
    });
    vi.mocked(googleNativeGrantService.updateGrantState).mockResolvedValue({
      data: { id: 'grant-2' },
      error: null,
    } as any);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({ id: 'connection-1' } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'auth-1' } as any);

    const result = await googleNativeAccessService.executeGoogleNativeGrant('grant-2');

    expect(result.error).toBeNull();
    expect(refreshClientPlatformAuthorization).toHaveBeenCalledWith('connection-1', 'google');
    expect(googleAdsConnector.createUserAccessInvitation).toHaveBeenCalledWith({
      accessToken: 'client-google-access-token',
      clientCustomerId: '9756457868',
      emailAddress: 'jon.highmu@gmail.com',
      accessRole: 'ADMIN',
    });
    expect(googleNativeGrantService.updateGrantState).toHaveBeenCalledWith(
      'grant-2',
      expect.objectContaining({
        nativeGrantState: 'awaiting_agency_acceptance',
        providerExternalId: '555',
        providerResourceName:
          'customers/9756457868/customerUserAccessInvitations/jon.highmu@gmail.com',
      })
    );
    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
      data: {
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
            googleGrantLifecycle: expect.objectContaining({
              fulfillmentMode: 'user_invite',
              grantStatus: 'awaiting_agency_acceptance',
              pendingActor: 'agency',
            }),
          },
        },
      },
    });
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'GOOGLE_TOKEN_READ',
        resourceId: 'connection-1',
      })
    );
  });

  it('verifies a direct user invite once the agency email has accepted access', async () => {
    const verifiedAt = new Date('2026-03-15T21:18:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(verifiedAt);

    vi.mocked(prisma.googleNativeGrant.findUnique).mockResolvedValue({
      id: 'grant-2',
      accessRequestId: 'request-1',
      connectionId: 'connection-1',
      product: 'google_ads',
      assetId: '9756457868',
      grantMode: 'user_invite',
      recipientEmail: 'jon.highmu@gmail.com',
      providerExternalId: '555',
      providerResourceName:
        'customers/9756457868/customerUserAccessInvitations/jon.highmu@gmail.com',
      nativeGrantState: 'awaiting_agency_acceptance',
      metadata: {
        requestedMode: 'user_invite',
        resolvedMode: 'user_invite',
      },
      connection: {
        id: 'connection-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'auth-1',
      metadata: {
        selectedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(refreshClientPlatformAuthorization).mockResolvedValue({
      data: {
        accessToken: 'client-google-access-token',
      },
      error: null,
    } as any);
    vi.mocked(googleAdsConnector.verifyUserAccess).mockResolvedValue({
      hasAccess: true,
      accessRole: 'ADMIN',
      emailAddress: 'jon.highmu@gmail.com',
    });
    vi.mocked(googleNativeGrantService.updateGrantState).mockResolvedValue({
      data: { id: 'grant-2' },
      error: null,
    } as any);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({ id: 'connection-1' } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'auth-1' } as any);

    const result = await googleNativeAccessService.executeGoogleNativeGrant('grant-2');

    expect(result.error).toBeNull();
    expect(googleAdsConnector.verifyUserAccess).toHaveBeenCalledWith({
      accessToken: 'client-google-access-token',
      clientCustomerId: '9756457868',
      emailAddress: 'jon.highmu@gmail.com',
    });
    expect(googleNativeGrantService.updateGrantState).toHaveBeenCalledWith(
      'grant-2',
      expect.objectContaining({
        nativeGrantState: 'verified',
        verifiedAt,
      })
    );
    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
      data: {
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
            googleGrantLifecycle: expect.objectContaining({
              state: 'fulfilled',
              grantStatus: 'verified',
              pendingActor: 'none',
            }),
          },
        },
      },
    });

    vi.useRealTimers();
  });

  it('resumes user-invite lookup without reissuing a create mutation when a provider resource already exists', async () => {
    vi.mocked(prisma.googleNativeGrant.findUnique).mockResolvedValue({
      id: 'grant-7',
      accessRequestId: 'request-1',
      connectionId: 'connection-1',
      product: 'google_ads',
      assetId: '9756457868',
      grantMode: 'user_invite',
      recipientEmail: 'jon.highmu@gmail.com',
      providerResourceName:
        'customers/9756457868/customerUserAccessInvitations/jon.highmu@gmail.com',
      nativeGrantState: 'pending',
      metadata: {
        requestedMode: 'user_invite',
        resolvedMode: 'user_invite',
      },
      connection: {
        id: 'connection-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'auth-1',
      metadata: {
        selectedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(refreshClientPlatformAuthorization).mockResolvedValue({
      data: {
        accessToken: 'client-google-access-token',
      },
      error: null,
    } as any);
    vi.mocked(googleAdsConnector.findUserAccessInvitation).mockResolvedValue({
      invitationId: '555',
      resourceName:
        'customers/9756457868/customerUserAccessInvitations/jon.highmu@gmail.com',
      emailAddress: 'jon.highmu@gmail.com',
      accessRole: 'ADMIN',
    });
    vi.mocked(googleNativeGrantService.updateGrantState).mockResolvedValue({
      data: { id: 'grant-7' },
      error: null,
    } as any);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({ id: 'connection-1' } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'auth-1' } as any);

    const result = await googleNativeAccessService.executeGoogleNativeGrant('grant-7');

    expect(result.error).toBeNull();
    expect(googleAdsConnector.createUserAccessInvitation).not.toHaveBeenCalled();
    expect(googleAdsConnector.findUserAccessInvitation).toHaveBeenCalledWith({
      accessToken: 'client-google-access-token',
      clientCustomerId: '9756457868',
      emailAddress: 'jon.highmu@gmail.com',
    });
    expect(googleNativeGrantService.updateGrantState).toHaveBeenCalledWith(
      'grant-7',
      expect.objectContaining({
        nativeGrantState: 'awaiting_agency_acceptance',
        providerExternalId: '555',
        providerResourceName:
          'customers/9756457868/customerUserAccessInvitations/jon.highmu@gmail.com',
      })
    );
  });

  it('marks manager-link grants as follow-up-needed for non-retryable provider errors', async () => {
    vi.mocked(prisma.googleNativeGrant.findUnique).mockResolvedValue({
      id: 'grant-4',
      accessRequestId: 'request-1',
      connectionId: 'connection-1',
      product: 'google_ads',
      assetId: '9756457868',
      grantMode: 'manager_link',
      managerCustomerId: '6449142979',
      nativeGrantState: 'pending',
      metadata: {
        requestedMode: 'manager_link',
        resolvedMode: 'manager_link',
      },
      connection: {
        id: 'connection-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'auth-1',
      metadata: {
        selectedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(ensureAgencyAccessToken).mockResolvedValue({
      data: {
        accessToken: 'agency-google-access-token',
      },
      error: null,
    } as any);
    const providerError = Object.assign(new Error('Manager link cannot be created'), {
      code: 'FAILED_PRECONDITION',
      retryable: false,
    });
    vi.mocked(googleAdsConnector.createManagerLinkInvitation).mockRejectedValue(providerError);
    vi.mocked(googleNativeGrantService.updateGrantState).mockResolvedValue({
      data: { id: 'grant-4' },
      error: null,
    } as any);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({ id: 'connection-1' } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'auth-1' } as any);

    const result = await googleNativeAccessService.executeGoogleNativeGrant('grant-4');

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({
      code: 'FAILED_PRECONDITION',
      details: {
        retryable: false,
      },
    });
    expect(googleNativeGrantService.updateGrantState).toHaveBeenCalledWith(
      'grant-4',
      expect.objectContaining({
        nativeGrantState: 'follow_up_needed',
        lastErrorCode: 'FAILED_PRECONDITION',
        lastErrorMessage: 'Manager link cannot be created',
      })
    );
    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
      data: {
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
            googleGrantLifecycle: expect.objectContaining({
              state: 'follow_up_needed',
              grantStatus: 'follow_up_needed',
            }),
          },
        },
      },
    });
  });

  it('falls back from manager-link to a queued user invite for explicit pre-mutation auth errors', async () => {
    vi.mocked(prisma.googleNativeGrant.findUnique).mockResolvedValue({
      id: 'grant-8',
      accessRequestId: 'request-1',
      connectionId: 'connection-1',
      product: 'google_ads',
      assetId: '9756457868',
      grantMode: 'manager_link',
      managerCustomerId: '6449142979',
      recipientEmail: 'jon.highmu@gmail.com',
      nativeGrantState: 'pending',
      metadata: {
        requestedMode: 'manager_link',
        resolvedMode: 'manager_link',
      },
      connection: {
        id: 'connection-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'auth-1',
      metadata: {
        selectedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(ensureAgencyAccessToken).mockResolvedValue({
      data: {
        accessToken: 'agency-google-access-token',
      },
      error: null,
    } as any);
    const providerError = Object.assign(new Error('The authorized customer does not have access'), {
      code: 'USER_PERMISSION_DENIED',
      retryable: false,
    });
    vi.mocked(googleAdsConnector.createManagerLinkInvitation).mockRejectedValue(providerError);
    vi.mocked(googleNativeGrantService.updateGrantState).mockResolvedValue({
      data: { id: 'grant-8' },
      error: null,
    } as any);
    vi.mocked(googleNativeGrantService.upsertGrant).mockResolvedValue({
      data: {
        id: 'grant-8-fallback',
        connectionId: 'connection-1',
        product: 'google_ads',
        assetId: '9756457868',
        grantMode: 'user_invite',
        nativeGrantState: 'pending',
      },
      error: null,
    } as any);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({ id: 'connection-1' } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'auth-1' } as any);

    const result = await googleNativeAccessService.executeGoogleNativeGrant('grant-8');

    expect(result.error).toBeNull();
    expect(googleNativeGrantService.updateGrantState).toHaveBeenCalledWith(
      'grant-8',
      expect.objectContaining({
        nativeGrantState: 'failed',
        lastErrorCode: 'USER_PERMISSION_DENIED',
        metadata: expect.objectContaining({
          fallbackReason: 'provider_error_user_permission_denied',
          fallbackGrantMode: 'user_invite',
        }),
      })
    );
    expect(googleNativeGrantService.upsertGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        accessRequestId: 'request-1',
        connectionId: 'connection-1',
        product: 'google_ads',
        assetId: '9756457868',
        grantMode: 'user_invite',
        recipientEmail: 'jon.highmu@gmail.com',
        nativeGrantState: 'pending',
        metadata: expect.objectContaining({
          requestedMode: 'manager_link',
          resolvedMode: 'user_invite',
          fallbackReason: 'provider_error_user_permission_denied',
          fallbackFromGrantId: 'grant-8',
        }),
      })
    );
    expect(queueGoogleNativeGrantExecution).toHaveBeenCalledWith('grant-8-fallback');
    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
      data: {
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
            googleGrantLifecycle: expect.objectContaining({
              fulfillmentMode: 'user_invite',
              grantStatus: 'pending',
              state: 'pending_native_grant',
            }),
          },
        },
      },
    });
  });

  it('keeps manager-link grants pending for retryable provider errors and lets the worker retry', async () => {
    vi.mocked(prisma.googleNativeGrant.findUnique).mockResolvedValue({
      id: 'grant-5',
      accessRequestId: 'request-1',
      connectionId: 'connection-1',
      product: 'google_ads',
      assetId: '9756457868',
      grantMode: 'manager_link',
      managerCustomerId: '6449142979',
      nativeGrantState: 'pending',
      metadata: {
        requestedMode: 'manager_link',
        resolvedMode: 'manager_link',
      },
      connection: {
        id: 'connection-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        grantedAssets: {
          google_ads: {
            adAccounts: ['9756457868'],
          },
        },
      },
    } as any);
    vi.mocked(ensureAgencyAccessToken).mockResolvedValue({
      data: {
        accessToken: 'agency-google-access-token',
      },
      error: null,
    } as any);
    const providerError = Object.assign(new Error('Temporary Google Ads outage'), {
      code: 'UNAVAILABLE',
      retryable: true,
    });
    vi.mocked(googleAdsConnector.createManagerLinkInvitation).mockRejectedValue(providerError);
    vi.mocked(googleNativeGrantService.updateGrantState).mockResolvedValue({
      data: { id: 'grant-5' },
      error: null,
    } as any);

    const result = await googleNativeAccessService.executeGoogleNativeGrant('grant-5');

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({
      code: 'UNAVAILABLE',
      details: {
        retryable: true,
      },
    });
    expect(googleNativeGrantService.updateGrantState).toHaveBeenCalledWith(
      'grant-5',
      expect.objectContaining({
        nativeGrantState: 'pending',
        lastErrorCode: 'UNAVAILABLE',
        lastErrorMessage: 'Temporary Google Ads outage',
      })
    );
    expect(prisma.clientConnection.update).not.toHaveBeenCalled();
  });
});
