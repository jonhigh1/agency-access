import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Platform } from '@agency-platform/shared';

vi.mock('next/image', () => ({
  default: ({ src, alt, unoptimized, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

async function loadPlatformIcon() {
  const mod = await import('../platform-icon');
  return mod.PlatformIcon;
}

describe('PlatformIcon', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('renders Brandfetch logo image when client id is configured', async () => {
    process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID = 'brandfetch-test';
    const PlatformIcon = await loadPlatformIcon();

    render(<PlatformIcon platform={'google' as Platform} size="md" />);

    const image = screen.getByAltText('Google logo') as HTMLImageElement;
    expect(image).toBeInTheDocument();
    expect(image.src).toContain('cdn.brandfetch.io/google.com?c=brandfetch-test');
  });

  it('uses the Facebook product mark for Meta Pages and keeps Meta corporate separate', async () => {
    process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID = 'brandfetch-test';
    const PlatformIcon = await loadPlatformIcon();

    const { rerender } = render(<PlatformIcon platform="meta_pages" />);
    expect((screen.getByAltText('Meta Pages logo') as HTMLImageElement).src).toContain('facebook.com');

    rerender(<PlatformIcon platform="meta" />);
    expect((screen.getByAltText('Meta logo') as HTMLImageElement).src).toContain('meta.com');
  });

  it('shows the Facebook mark when Brandfetch is unavailable', async () => {
    delete process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID;
    const PlatformIcon = await loadPlatformIcon();

    render(<PlatformIcon platform="meta_pages" />);
    expect(screen.getByRole('img', { name: 'Facebook logo' })).toBeInTheDocument();
  });

  it('falls back to platform initial when Brandfetch client id is missing', async () => {
    delete process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID;
    const PlatformIcon = await loadPlatformIcon();

    render(<PlatformIcon platform={'linkedin' as Platform} size="md" />);

    expect(screen.getByText('L')).toBeInTheDocument();
  });

  it('falls back to platform initial when logo image fails to load', async () => {
    process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID = 'brandfetch-test';
    const PlatformIcon = await loadPlatformIcon();

    render(<PlatformIcon platform={'google' as Platform} size="md" />);

    fireEvent.error(screen.getByAltText('Google logo'));
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('handles unknown platform ids without crashing', async () => {
    delete process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID;
    const PlatformIcon = await loadPlatformIcon();

    render(<PlatformIcon platform={'google_tag_manager' as Platform} size="md" showLabel />);

    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('Google Tag Manager')).toBeInTheDocument();
  });
});
