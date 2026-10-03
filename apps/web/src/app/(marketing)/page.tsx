import { HeroSection } from '@/components/marketing/hero-section';
import { SocialProofSection } from '@/components/marketing/social-proof-section';
import { PainSection } from '@/components/marketing/pain-section';
import { SolutionSection } from '@/components/marketing/solution-section-new';
import CombinedFeaturedSection from '@/components/ui/combined-featured-section';
import { IntegrationSection } from '@/components/marketing/integration-section';
import { HowItWorksSection } from '@/components/marketing/how-it-works-section';
import { SuccessStoriesSection } from '@/components/marketing/success-stories-section';
import { HomepageFAQSection } from '@/components/marketing/homepage-faq-section';
import { CTASection } from '@/components/marketing/cta-section';

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What makes AuthHub agent-first?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AuthHub was built from the ground up for autonomous AI agents. Every feature thinks like an agent, making decisions without human bottlenecks or approval delays—unlike platforms that retrofitted agent capabilities.',
      },
    },
    {
      '@type': 'Question',
      name: 'How fast can I get clients onboarded?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Most agencies get their first client live in 15 minutes. Unlike traditional tools that require weeks of configuration, AuthHub pre-built agency templates and autonomous agents eliminate manual setup.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which ad platforms does AuthHub support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AuthHub supports Meta Ads, Google Ads, GA4, LinkedIn Ads, and TikTok—agents handle the entire authorization flow autonomously, reducing manual oversight by 80%.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does agent-first architecture differ from AI automation?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Generic automation creates more work through maintenance overhead. Agent-first architecture means agents adapt and improve over time, complete multi-step workflows without intervention, and scale without proportional technical overhead.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is AuthHub white-label for agencies?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Agencies can customize their logo and brand colors for the client authorization experience. Authorization links use an AuthHub URL, and clients complete permissions on the official platform surfaces.',
      },
    },
  ],
};

export default function MarketingPage() {
  return (
    <div className="relative bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <HeroSection />
      <SocialProofSection />
      <PainSection />
      <SolutionSection />
      <CombinedFeaturedSection />
      <IntegrationSection />
      <HowItWorksSection />
      <SuccessStoriesSection />
      <HomepageFAQSection />
      <CTASection />
    </div>
  );
}
