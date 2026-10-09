import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { AccessRequestProvider, useAccessRequest } from '../access-request-context';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/api/access-requests');

const FLAG = 'NEXT_PUBLIC_META_PENDING_APPROVAL';
const original = process.env[FLAG];

const wrapper = ({ children }: { children: ReactNode }) => (
  <AccessRequestProvider agencyId="agency-123">{children}</AccessRequestProvider>
);

const template = {
  id: 'template-1',
  agencyId: 'agency-123',
  name: 'Example template',
  platforms: { google: ['google_ads'], meta: ['meta_ads'] },
  globalAccessLevel: 'standard',
  intakeFields: [],
  branding: {},
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

describe('AccessRequestContext: Meta pending approval flag', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
  });

  it('flag on: Meta cannot be selected directly or through a template', () => {
    process.env[FLAG] = 'true';
    const { result } = renderHook(() => useAccessRequest(), { wrapper });

    act(() => result.current.updatePlatforms({ google: ['google_ads'], meta: ['meta_ads'] }));
    expect(result.current.state.selectedPlatforms).toEqual({ google: ['google_ads'] });
    expect(result.current.state.platformAccessLevels).not.toHaveProperty('meta');

    act(() => result.current.updateTemplate(template));
    expect(result.current.state.selectedPlatforms).toEqual({ google: ['google_ads'] });
    expect(result.current.state.platformAccessLevels).toEqual({ google: 'standard' });
  });

  it('flag off: Meta selections are kept as today', () => {
    delete process.env[FLAG];
    const { result } = renderHook(() => useAccessRequest(), { wrapper });

    act(() => result.current.updatePlatforms({ google: ['google_ads'], meta: ['meta_ads'] }));
    expect(result.current.state.selectedPlatforms).toEqual({ google: ['google_ads'], meta: ['meta_ads'] });

    act(() => result.current.updateTemplate(template));
    expect(result.current.state.selectedPlatforms).toEqual({ google: ['google_ads'], meta: ['meta_ads'] });
    expect(result.current.state.platformAccessLevels).toEqual({ google: 'standard', meta: 'standard' });
  });
});
