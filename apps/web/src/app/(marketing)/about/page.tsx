import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'About AuthHub | Secure Agency Access Management',
  description: 'AuthHub replaces weeks of manual OAuth setup with a single 5-minute link. Built for marketing agencies who onboard clients across Meta, Google, LinkedIn, and more.',
  alternates: {
    canonical: 'https://authhub.co/about',
  },
  openGraph: {
    title: 'About AuthHub | Secure Agency Access Management',
    description: 'AuthHub replaces weeks of manual OAuth setup with a single 5-minute link. Built for marketing agencies.',
    type: 'website',
    url: 'https://authhub.co/about',
  },
};

export default function AboutPage() {
  return (
    <main className="relative bg-paper min-h-screen">
      {/* Hero */}
      <section className="pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-coral/10 text-danger-ink px-4 py-1.5 rounded-full font-mono text-sm font-medium mb-6">
            About AuthHub
          </span>
          <h1 className="font-dela text-4xl sm:text-5xl lg:text-6xl font-black text-ink mb-6 leading-tight">
            Client Access in 5 Minutes,
            <br />
            Not 5 Days
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            AuthHub replaces the fragmented emails, confused clients, and expired tokens
            of manual OAuth setup with one guided link and a clear status view.
          </p>
        </div>
      </section>

      {/* Problem */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-dela text-2xl sm:text-3xl font-black text-ink mb-8">
            The Problem We Solve
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-6">
            Marketing agencies need client access to advertising, analytics, and marketing
            platforms — Meta Ads, Google Ads, GA4, LinkedIn, and more. Getting that access
            means walking non-technical clients through OAuth flows they don&apos;t understand,
            over email, with screenshots, and follow-up messages that take days.
          </p>
          <p className="text-gray-600 text-lg leading-relaxed">
            The result: stalled onboarding, frustrated clients, and agencies spending more
            time on access logistics than on actual campaign work.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-paper-light">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-dela text-2xl sm:text-3xl font-black text-ink mb-12 text-center">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="border-2 border-ink p-6 shadow-brutalist">
              <span className="font-mono text-danger-ink text-sm font-medium">01</span>
              <h3 className="font-dela text-xl font-black text-ink mt-2 mb-3">Create a Request</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Select the platforms and permission levels you need. One request, multiple platforms.</p>
            </div>
            <div className="border-2 border-ink p-6 shadow-brutalist">
              <span className="font-mono text-danger-ink text-sm font-medium">02</span>
              <h3 className="font-dela text-xl font-black text-ink mt-2 mb-3">Send a Link</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Your client gets one simple link — no screenshots, no confusion, no back-and-forth.</p>
            </div>
            <div className="border-2 border-ink p-6 shadow-brutalist">
              <span className="font-mono text-danger-ink text-sm font-medium">03</span>
              <h3 className="font-dela text-xl font-black text-ink mt-2 mb-3">Get Access</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Client authorizes through a guided flow. You see real-time status — done, pending, or blocked.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-dela text-2xl sm:text-3xl font-black text-ink mb-12 text-center">
            What We Believe
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="p-6">
              <h3 className="font-dela text-lg font-black text-ink mb-2">Status Should Be Truthful</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Complete, partial, pending, revoked, failed — never smooth uncertainty into false success.</p>
            </div>
            <div className="p-6">
              <h3 className="font-dela text-lg font-black text-ink mb-2">The Next Action Should Be Obvious</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Every screen makes clear what happened, who needs to act, and what to do next.</p>
            </div>
            <div className="p-6">
              <h3 className="font-dela text-lg font-black text-ink mb-2">Trust Through Clarity</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Explain access, permissions, and errors in plain language while preserving diagnostic detail.</p>
            </div>
            <div className="p-6">
              <h3 className="font-dela text-lg font-black text-ink mb-2">Security Is Not Optional</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Tokens stored in enterprise-grade secrets management. Every access logged. Expiration enforced.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-dela text-2xl sm:text-3xl font-black text-ink mb-4">
            Stop Wasting Time on OAuth
          </h2>
          <p className="text-gray-600 text-lg mb-8">
            Start your 14-day free trial. No credit card required.
          </p>
          <Button variant="secondary" size="lg" className="font-dela" asChild>
            <a href="/sign-up">Get Started Free</a>
          </Button>
        </div>
      </section>
    </main>
  );
}
