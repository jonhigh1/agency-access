import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import sitemap from '@/app/sitemap';
import GoogleAdsAccessGuidePage from '../google-ads-access/page';
import MetaAdsAccessGuidePage from '../meta-ads-access/page';
import GuidesHubPage, { metadata as guidesHubMetadata } from '../page';

vi.mock('@/components/marketing/comparison-cta', () => ({ ComparisonCTA: () => <div>AuthHub call to action</div> }));

describe('published guides', () => {
  it('renders static Meta access guidance', () => {
    render(<MetaAdsAccessGuidePage />);
    expect(screen.getByRole('heading', { name: /How to Get Meta Ads Access for Agencies/i })).toBeInTheDocument();
    expect(screen.getByText(/October 10, 2026/)).toBeInTheDocument();
  });

  it('renders static Google access guidance', () => {
    render(<GoogleAdsAccessGuidePage />);
    expect(screen.getByRole('heading', { name: /How to Get Google Ads Access/i })).toBeInTheDocument();
    expect(screen.getByText(/October 10, 2026/)).toBeInTheDocument();
  });
});

describe('guides hub', () => {
  it('self-canonicalizes to /guides and links both live guides', () => {
    expect(guidesHubMetadata.alternates?.canonical).toBe('https://authhub.co/guides');
    const { container } = render(<GuidesHubPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /platform access guides/i }),
    ).toBeInTheDocument();
    expect(container.querySelector('a[href="/guides/meta-ads-access"]')).not.toBeNull();
    expect(container.querySelector('a[href="/guides/google-ads-access"]')).not.toBeNull();
  });

  it('is listed in the sitemap so guide breadcrumbs are not a 404', () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain('/guides');
  });
});
