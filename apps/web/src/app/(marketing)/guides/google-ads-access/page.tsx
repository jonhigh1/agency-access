/**
 * Google Ads Access Guide
 * Target keywords: "how to request google ads access", "give google ads access to agency"
 * Structure: Platform Access Guide template + elite-copywriter (brevity, PAS, Before/After/Bridge)
 */

import Link from "next/link";
import { Metadata } from "next";
import { ComparisonCTA } from "@/components/marketing/comparison-cta";

export const metadata: Metadata = {
  title: "How to Get Google Ads Access for Agencies (2026 Guide)",
  description:
    "How to request Google Ads access: client signs in, goes to Tools & Settings → Access and security, adds your email, chooses a role. Or use one link and get access in 5 minutes.",
  alternates: {
    canonical: 'https://authhub.co/guides/google-ads-access',
  },
  keywords: [
    "how to request google ads access",
    "give google ads access to agency",
    "google ads access for agency",
  ],
  openGraph: {
    title: "How to Get Google Ads Access for Agencies (2026 Guide)",
    description:
      "Step-by-step guide to request Google Ads access from clients. Manual process or one-link option that takes 5 minutes.",
    type: "article",
    url: 'https://authhub.co/guides/google-ads-access',
  },
};

export default function GoogleAdsAccessGuidePage() {
  // HowTo schema JSON-LD
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Get Google Ads Access for Agencies",
    "description": "Step-by-step guide for agencies to request Google Ads manager account access from clients",
    "step": [
      {
        "@type": "HowToStep",
        "name": "Get the Agency's Customer ID",
        "text": "Find your agency's 10-digit Customer ID in Google Ads under Tools and Settings > Account Setup.",
      },
      {
        "@type": "HowToStep",
        "name": "Send the Access Request Link",
        "text": "Send your client the link: ads.google.com/home/tools/account-access. This opens the Access and Security page.",
      },
      {
        "@type": "HowToStep",
        "name": "Client Adds Your Account",
        "text": "Client clicks the + button on the Access and Security page, selects 'Manage access' or 'Admin' access level, and enters your agency's Customer ID.",
      },
      {
        "@type": "HowToStep",
        "name": "Review and Confirm",
        "text": "Client reviews the access level and permissions, then clicks Send Request.",
      },
      {
        "@type": "HowToStep",
        "name": "Accept the Request",
        "text": "Agency accepts the request in Google Ads under Tools and Settings > Account Access. Access is now active.",
      },
    ],
  };

  // Breadcrumb schema for navigation
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://authhub.co",
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Guides",
        "item": "https://authhub.co/guides",
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Google Ads Access Guide",
        "item": "https://authhub.co/guides/google-ads-access",
      },
    ],
  };

  return (
    <div className="min-h-screen bg-paper">
      {/* HowTo Schema JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(howToSchema),
        }}
      />
      {/* Breadcrumb Schema JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
      {/* Hero */}
      <section className="border-b-2 border-black bg-coral/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <p className="font-mono text-sm text-danger-ink font-bold uppercase tracking-wider mb-3">
              Platform Access Guide
            </p>
            <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-4 tracking-tight">
              How to Get Google Ads Access for Agencies
            </h1>
            <p className="font-mono text-xs text-muted-foreground mb-4">
              Updated <time dateTime="2026-10-10">October 10, 2026</time>
            </p>
            <p className="font-mono text-base text-foreground">
              Give your agency access to client Google Ads accounts in minutes. Manual steps below, or one link that does it for you.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Answer (featured-snippet target) */}
      <section className="border-b-2 border-black bg-card" aria-labelledby="quick-answer-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="quick-answer-heading" className="font-dela text-xl md:text-2xl text-ink mb-4">
              Quick Answer
            </h2>
            <p className="font-mono text-foreground mb-4">
              To give an agency access to your Google Ads account, the client signs in to Google Ads, opens Tools & Settings (wrench icon), then Access and security, adds the agency by email, and chooses a role. The agency accepts the invitation.
            </p>
            <ol className="list-decimal list-inside space-y-2 font-mono text-sm text-foreground marker:font-bold marker:text-coral">
              <li>Client signs in to Google Ads.</li>
              <li>Click Tools & Settings (wrench icon, top right), then under Setup choose Access and security.</li>
              <li>Click the plus (+) button to add a user.</li>
              <li>Enter the agency user&apos;s email address.</li>
              <li>Choose access level: Admin, Standard, or Read-only.</li>
              <li>Send the invitation; the agency accepts from the email or in Google Ads.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* People Also Ask */}
      <section className="border-b-2 border-black bg-paper" aria-labelledby="paa-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-3xl mx-auto">
            <h2 id="paa-heading" className="font-dela text-lg md:text-xl text-ink mb-3">
              How do I give an agency access to my Google Ads?
            </h2>
            <p className="font-mono text-sm text-foreground mb-2">
              In Google Ads, go to Tools & Settings → Access and security, then add the agency&apos;s email and pick Admin, Standard, or Read-only. They get an email invite and accept. For full steps, see the section below.
            </p>
            <Link href="#step-by-step" className="font-mono text-sm text-danger-ink font-bold hover:underline">
              See step-by-step instructions →
            </Link>
          </div>
        </div>
      </section>

      {/* Why Agencies Need Google Ads Access */}
      <section className="border-b-2 border-black bg-card" aria-labelledby="why-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="why-heading" className="font-dela text-xl md:text-2xl text-ink mb-4">
              Why Agencies Need Google Ads Access
            </h2>
            <p className="font-mono text-foreground">
              Most paid search runs through Google Ads. To manage campaigns, build reports, or optimize for a client, you need access to their account. The manual way works but costs time: clients get lost in the UI, send the wrong permissions, or forget to accept. That back-and-forth can burn a day or two per client. A clear process (or a single link that handles it) cuts that to minutes.
            </p>
          </div>
        </div>
      </section>

      {/* Step-by-Step */}
      <section id="step-by-step" className="border-b-2 border-black bg-paper" aria-labelledby="steps-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="steps-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
              Step-by-Step: Requesting Google Ads Access
            </h2>

            <h3 className="font-display text-lg font-semibold text-ink mb-3">
              Method 1: Manual process (free, time-consuming)
            </h3>
            <ol className="list-decimal list-inside space-y-3 font-mono text-sm text-foreground marker:font-bold marker:text-coral mb-8">
              <li>The client signs in to Google Ads at ads.google.com.</li>
              <li>Click the wrench icon (Tools & Settings) in the top right. Under Setup, open Access and security.</li>
              <li>Click the plus (+) button to add a user. Enter the agency team member&apos;s Google email.</li>
              <li>Choose the role: Admin (full control), Standard (create and edit campaigns), or Read-only (reports only).</li>
              <li>Send the invitation. The agency receives an email and must accept in Google Ads or from the link.</li>
            </ol>
            <p className="font-mono text-xs text-muted-foreground mb-6">
              Pro tip: If the client manages multiple accounts (e.g. MCC), they must add the user in the correct account or at the MCC level so you see all accounts they want to share.
            </p>

            <h3 className="font-display text-lg font-semibold text-ink mb-3">
              Method 2: Using AuthHub (5 minutes)
            </h3>
            <p className="font-mono text-sm text-foreground">
              Send the client one link. They sign in with Google once; you get access to the accounts they choose. You can add optional intake questions in the same flow so you get access and client info in a single step. No chasing separate invites or forms.
            </p>
          </div>
        </div>
      </section>

      {/* Common Problems and Solutions */}
      <section className="border-b-2 border-black bg-card" aria-labelledby="problems-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="problems-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
              Common Problems and Solutions
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-2 border-black font-mono text-sm">
                <thead>
                  <tr className="bg-ink text-white">
                    <th className="border border-black p-3 text-left font-bold">Problem</th>
                    <th className="border border-black p-3 text-left font-bold">Solution</th>
                  </tr>
                </thead>
                <tbody className="bg-paper">
                  <tr>
                    <td className="border border-black p-3">Client can&apos;t find Access and security</td>
                    <td className="border border-black p-3">Tools & Settings (wrench icon, top right) → Under Setup, Access and security.</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3">Wrong account or multiple Google Ads accounts</td>
                    <td className="border border-black p-3">Check which account is selected at the top of the UI. Add the user in the correct account, or at MCC level if they manage many.</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3">Invitation not received</td>
                    <td className="border border-black p-3">Check spam; ensure the email matches the one used in Google Ads. Client can resend from Access and security.</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3">Need MCC vs single-account access</td>
                    <td className="border border-black p-3">For multiple accounts, add the user at the Manager (MCC) level so they see all linked accounts. For one account, add at that account level.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              Official reference:{" "}
              <a
                href="https://support.google.com/google-ads/answer/6139186"
                target="_blank"
                rel="noopener noreferrer"
                className="text-danger-ink font-bold hover:underline"
              >
                Google Ads Help – Add or remove users
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Google Ads Access Checklist */}
      <section className="border-b-2 border-black bg-paper" aria-labelledby="checklist-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="checklist-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
              Google Ads Access Checklist
            </h2>
            <ul className="space-y-2 font-mono text-sm text-foreground list-none">
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Client is signed in to the correct Google Ads account
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Agency email is correct (no typos)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Role chosen: Admin, Standard, or Read-only
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Invitation accepted on the agency side
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                If using AuthHub: one link sent, client completed the flow
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Related Platform Guides */}
      <section className="border-b-2 border-black bg-card" aria-labelledby="related-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="related-heading" className="font-dela text-xl md:text-2xl text-ink mb-4">
              Related Platform Guides
            </h2>
            <p className="font-mono text-sm text-foreground mb-4">
              Need access to other platforms? We have guides for{" "}
              <Link href="/guides/meta-ads-access" className="text-danger-ink font-bold hover:underline">
                Meta Ads access for agencies
              </Link>
              ,{" "}
              <Link href="/blog/ga4-access-agencies" className="text-danger-ink font-bold hover:underline">
                Google Analytics (GA4) access for agencies
              </Link>
              , and{" "}
              <Link href="/blog/linkedin-ads-access-agency" className="text-danger-ink font-bold hover:underline">
                LinkedIn Ads access
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Simplify with AuthHub (soft CTA) */}
      <section className="border-b-2 border-black bg-ink text-white" aria-labelledby="cta-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-3xl mx-auto text-center">
            <h2 id="cta-heading" className="font-dela text-xl md:text-2xl mb-4">
              Simplify with AuthHub
            </h2>
            <p className="font-mono text-sm text-white/90 mb-6">
              Save 2–3 days per client with a single link that handles Google Ads and other platforms, plus optional intake. One flow, one link.
            </p>
            <ComparisonCTA variant="brutalist" size="xl">
              Start free trial
            </ComparisonCTA>
            <p className="mt-4 font-mono text-xs text-white/70">
              Or{" "}
              <Link href="/compare/leadsie-alternative" className="text-danger-ink font-bold hover:underline">
                see how we compare to other tools
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
