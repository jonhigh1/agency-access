import type { Metadata } from 'next';
import { HeroCopyRewriteHeroSection } from '@/components/marketing/hero-copy-rewrite/hero-copy-rewrite-hero-section';
import { HeroCopyRewriteSocialProofSection } from '@/components/marketing/hero-copy-rewrite/hero-copy-rewrite-social-proof-section';
import { HeroCopyRewriteProblemSection } from '@/components/marketing/hero-copy-rewrite/hero-copy-rewrite-problem-section';
import { HeroCopyRewriteSolutionSection } from '@/components/marketing/hero-copy-rewrite/hero-copy-rewrite-solution-section';
import { HeroCopyRewriteValuePropsSection } from '@/components/marketing/hero-copy-rewrite/hero-copy-rewrite-value-props-section';
import { HeroCopyRewriteIntegrationsSection } from '@/components/marketing/hero-copy-rewrite/hero-copy-rewrite-integrations-section';
import { HeroCopyRewriteHowItWorksSection } from '@/components/marketing/hero-copy-rewrite/hero-copy-rewrite-how-it-works-section';
import { HeroCopyRewriteCaseStudySection } from '@/components/marketing/hero-copy-rewrite/hero-copy-rewrite-case-study-section';
import { HeroCopyRewriteFinalCtaSection } from '@/components/marketing/hero-copy-rewrite/hero-copy-rewrite-final-cta-section';

export const metadata: Metadata = {
  title: 'AuthHub Hero Copy Rewrite | Client Access Software for Marketing Agencies',
  description:
    'Client access software for marketing agencies. Send one branded link during client onboarding so clients can authorize Meta, Google Ads, GA4, LinkedIn, and related platforms in one flow.',
  openGraph: {
    title: 'AuthHub Hero Copy Rewrite | Client Access Software for Marketing Agencies',
    description:
      'Send one branded link during client onboarding so agencies can collect Meta, Google Ads, GA4, LinkedIn, and related platform access in one flow.',
    type: 'website',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function HeroCopyRewritePage() {
  return (
    <div className="relative bg-background">
      <HeroCopyRewriteHeroSection />
      <HeroCopyRewriteSocialProofSection />
      <HeroCopyRewriteProblemSection />
      <HeroCopyRewriteSolutionSection />
      <HeroCopyRewriteValuePropsSection />
      <HeroCopyRewriteIntegrationsSection />
      <HeroCopyRewriteHowItWorksSection />
      <HeroCopyRewriteCaseStudySection />
      <HeroCopyRewriteFinalCtaSection />
    </div>
  );
}
