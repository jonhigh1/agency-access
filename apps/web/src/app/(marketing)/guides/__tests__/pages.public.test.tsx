import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GoogleAdsAccessGuidePage from '../google-ads-access/page';
import MetaAdsAccessGuidePage from '../meta-ads-access/page';

vi.mock('@/components/marketing/comparison-cta', () => ({ ComparisonCTA: () => <div>AuthHub call to action</div> }));

describe('published guides', () => {
  it('renders static Meta access guidance', () => {
    render(<MetaAdsAccessGuidePage />);
    expect(screen.getByRole('heading', { name: /How to Get Meta Ads Access for Agencies/i })).toBeInTheDocument();
  });

  it('renders static Google access guidance', () => {
    render(<GoogleAdsAccessGuidePage />);
    expect(screen.getByRole('heading', { name: /How to Get Google Ads Access/i })).toBeInTheDocument();
  });
});
