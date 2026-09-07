import type { Metadata } from 'next';
import { ContactForm } from '@/components/marketing/contact/contact-form';
import { ContactInfoCard } from '@/components/marketing/contact/contact-info-card';
import { Reveal } from '@/components/marketing/reveal';
import { getDocsUrl } from '@/lib/docs-url';

export const metadata: Metadata = {
  title: 'Contact Us | AuthHub',
  description: 'Get in touch with our team. We typically respond within 24 hours.',
  alternates: {
    canonical: 'https://authhub.co/contact',
  },
  openGraph: {
    title: 'Contact Us | AuthHub',
    description: 'Get in touch with our team. We typically respond within 24 hours.',
    type: 'website',
    url: 'https://authhub.co/contact',
  },
};

export default function ContactPage() {
  return (
    <main className="relative bg-paper min-h-screen">
      {/* Hero Section */}
      <section className="pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <Reveal direction="up">
            <span className="inline-block bg-coral/10 text-danger-ink px-4 py-1.5 rounded-full font-mono text-sm font-medium mb-6">
              We&apos;d love to hear from you
            </span>
          </Reveal>
          <Reveal direction="up" delay={0.1}>
            <h1 className="font-dela text-4xl sm:text-5xl lg:text-6xl font-black text-ink mb-6 leading-tight">
              Get in Touch
            </h1>
          </Reveal>
          <Reveal direction="up" delay={0.2}>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Have a question about AuthHub? Want to see a demo? We&apos;re here to help.
              Fill out the form below and we&apos;ll get back to you within 24 hours.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Main Content - Two Column Layout */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Contact Form - Takes 3 columns on desktop */}
            <div className="lg:col-span-3 [&_.reveal-element]:h-full">
              <Reveal direction="up" delay={0.3}>
                <div className="bg-paper border-2 border-black shadow-brutalist p-8 h-full">
                  <h2 className="font-display text-2xl font-bold text-ink mb-6">
                    Send us a message
                  </h2>
                  <ContactForm />
                </div>
              </Reveal>
            </div>

            {/* Contact Info Card - Takes 2 columns on desktop */}
            <div className="lg:col-span-2 [&_.reveal-element]:h-full">
              <Reveal direction="up" delay={0.4}>
                <ContactInfoCard />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Teaser Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-warm-mesh">
        <div className="max-w-4xl mx-auto">
          <Reveal direction="up">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink text-center mb-8">
              Frequently Asked Questions
            </h2>
          </Reveal>
          <div className="space-y-4">
            <Reveal direction="up" delay={0.1}>
              <div className="bg-paper border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-ink mb-2">
                  How does the pricing work?
                </h3>
                <p className="text-gray-600">
                  We offer simple tiered pricing based on the number of clients you onboard per month.
                  Check out our <a href="/pricing" className="text-danger-ink hover:underline">pricing page</a> for details.
                </p>
              </div>
            </Reveal>
            <Reveal direction="up" delay={0.2}>
              <div className="bg-paper border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-ink mb-2">
                  Which platforms do you support?
                </h3>
                <p className="text-gray-600">
                  We support Meta (Facebook/Instagram), Google Ads, GA4, LinkedIn, TikTok, Snapchat,
                  and more. New platforms are added regularly.
                </p>
              </div>
            </Reveal>
            <Reveal direction="up" delay={0.3}>
              <div className="bg-paper border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-ink mb-2">
                  Is there a free trial?
                </h3>
                <p className="text-gray-600">
                  Yes! Start your 14-day free trial on any paid plan—Starter, Growth, or Agency.
                  No credit card required.
                </p>
              </div>
            </Reveal>
          </div>
          <Reveal direction="up" delay={0.4}>
            <div className="text-center mt-8">
              <a
                href={getDocsUrl()}
                className="inline-flex items-center gap-2 text-danger-ink hover:text-danger-ink font-medium transition-colors"
              >
                Visit the Help Center
                <span>&rarr;</span>
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
