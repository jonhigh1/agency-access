/**
 * Meta Ads Access Guide
 * Target keywords: "Meta ads access for agencies", "Facebook Business Manager access for agencies"
 * Structure: Platform Access Guide template + elite-copywriter (brevity, PAS, Before/After/Bridge)
 */

import Link from "next/link";
import { Metadata } from "next";
import { ComparisonCTA } from "@/components/marketing/comparison-cta";

export const metadata: Metadata = {
  title: "How to Get Meta Ads Access for Agencies: Guide 2026",
  description:
    "How to get Meta Ads access: Client opens Meta Business Suite → Business Settings → Accounts → Ad Accounts → Add People → Add a Partner → Enter Business ID → Choose permissions. Manual: 6 steps. Or one link in 5 minutes.",
  keywords: [
    "Meta ads access for agencies",
    "Facebook Business Manager access for agencies",
    "give agency access to Meta Ads",
    "how to request Meta Ads access",
  ],
  openGraph: {
    title: "How to Get Meta Ads Access for Agencies: Guide 2026",
    description:
      "Step-by-step guide to request Meta Ads access from clients. Manual process or one-link option that takes 5 minutes.",
    type: "article",
  },
  alternates: {
    canonical: "https://authhub.co/guides/meta-ads-access",
  },
};

export default function MetaAdsAccessGuidePage() {
  // HowTo schema JSON-LD
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Get Meta Ads Access for Agencies",
    "description": "Step-by-step guide to request Meta Ads access from clients through Meta Business Suite",
    "step": [
      {
        "@type": "HowToStep",
        "name": "Open Meta Business Suite",
        "text": "Client opens Meta Business Suite at business.facebook.com and logs in with their Facebook account.",
      },
      {
        "@type": "HowToStep",
        "name": "Navigate to Business Settings",
        "text": "Click Business Settings (gear icon) in the left sidebar.",
      },
      {
        "@type": "HowToStep",
        "name": "Select Ad Accounts",
        "text": "Go to Accounts → Ad Accounts and select the ad account(s) to share with the agency.",
      },
      {
        "@type": "HowToStep",
        "name": "Add Agency as Partner",
        "text": "Click Add People → Add a Partner, then enter the agency's Business ID.",
      },
      {
        "@type": "HowToStep",
        "name": "Choose Permission Level",
        "text": "Select Admin (full control), Ad Account Advertiser (create/edit campaigns, recommended), Analyst (view-only), or Campaign Analyst (view specific campaigns).",
      },
      {
        "@type": "HowToStep",
        "name": "Confirm and Accept",
        "text": "Client clicks Confirm. Agency accepts the partner request in Business Settings → Users → Partner Requests.",
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
        "name": "Meta Ads Access Guide",
        "item": "https://authhub.co/guides/meta-ads-access",
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
              How to Get Meta Ads Access for Agencies
            </h1>
            <p className="font-mono text-xs text-muted-foreground mb-4">
              Updated <time dateTime="2026-10-10">October 10, 2026</time>
            </p>
            <p className="font-mono text-base text-foreground">
              Give your agency access to client Facebook and Instagram ad accounts. Manual steps below, or one link that does it for you.
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
              Client opens Meta Business Suite → Business Settings → Accounts → Ad Accounts → Add People → Add a Partner → Enter your Business ID → Choose permissions → Confirm. You accept the request in your Business Settings.
            </p>
            <ol className="list-decimal list-inside space-y-2 font-mono text-sm text-foreground marker:font-bold marker:text-coral">
              <li>Client opens Meta Business Suite</li>
              <li>Goes to Business Settings (gear icon)</li>
              <li>Navigates to Accounts → Ad Accounts</li>
              <li>Selects ad account(s) to share</li>
              <li>Clicks Add People → Add a Partner</li>
              <li>Enters your Business ID</li>
              <li>Chooses permissions (Admin, Advertiser, Analyst, Campaign Analyst)</li>
              <li>Clicks Confirm</li>
              <li>You accept in Business Settings → Users → Partner Requests</li>
            </ol>
          </div>
        </div>
      </section>

      {/* People Also Ask */}
      <section className="border-b-2 border-black bg-paper" aria-labelledby="paa-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-3xl mx-auto">
            <h2 id="paa-heading" className="font-dela text-lg md:text-xl text-ink mb-3">
              How do I give an agency access to my Facebook ad account?
            </h2>
            <p className="font-mono text-sm text-foreground mb-2">
              Meta Business Suite → Business Settings → Accounts → Ad Accounts → select account → Add People → Add a Partner → enter Business ID → choose permissions → confirm. Agency accepts from their Business Settings.
            </p>
            <Link href="#step-by-step" className="font-mono text-sm text-danger-ink font-bold hover:underline">
              See step-by-step instructions →
            </Link>
          </div>
        </div>
      </section>

      {/* Why Agencies Need Meta Ads Access */}
      <section className="border-b-2 border-black bg-card" aria-labelledby="why-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="why-heading" className="font-dela text-xl md:text-2xl text-ink mb-4">
              Why Agencies Need Meta Ads Access
            </h2>
            <p className="font-mono text-foreground">
              Meta Ads (Facebook and Instagram) is the largest social ad platform. Most clients run ads on one or both. Without access, you can't create campaigns, manage creatives, or optimize performance. The manual process works but Meta's interface is complex—Business Manager vs Business Suite, multiple ad accounts, different permission levels, previous agency partners to remove.
            </p>
          </div>
        </div>
      </section>

      {/* Step-by-Step */}
      <section id="step-by-step" className="border-b-2 border-black bg-paper" aria-labelledby="steps-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="steps-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
              Step-by-Step: Requesting Meta Ads Access
            </h2>

            <h3 className="font-display text-lg font-semibold text-ink mb-3">
              Method 1: Manual process (free, time-consuming)
            </h3>
            <ol className="list-decimal list-inside space-y-3 font-mono text-sm text-foreground marker:font-bold marker:text-coral mb-8">
              <li>Client opens Meta Business Suite (business.facebook.com) and logs in.</li>
              <li>Navigates to Business Settings (gear icon, left sidebar).</li>
              <li>Goes to Accounts → Ad Accounts and selects the ad account(s) to share.</li>
              <li>Clicks Add People → Add a Partner, enters your agency's Business ID.</li>
              <li>Chooses permission level: Admin (full control including billing), Ad Account Advertiser (create and edit campaigns, recommended), Analyst (view-only reporting), or Campaign Analyst (view specific campaigns only).</li>
              <li>Client clicks Confirm. Agency accepts in Business Settings → Users → Partner Requests.</li>
            </ol>
            <p className="font-mono text-xs text-muted-foreground mb-6">
              <strong>Pro tip:</strong> Multiple Business Managers? Grant access from each or consolidate first. Previous agency still has access? Client must remove them first: Business Settings → Users → Partner Accounts → Remove.
            </p>

            <h3 className="font-display text-lg font-semibold text-ink mb-3">
              Method 2: Using AuthHub (5 minutes)
            </h3>
            <p className="font-mono text-sm text-foreground">
              Send one link. Client signs in with Facebook, chooses the correct Business Portfolio, and selects Ad Accounts and Pages. AuthHub verifies the requested access and identifies linked professional Instagram relationships or any manual follow-up. Add optional intake questions to the same flow.
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
                    <td className="border border-black p-3">Client can't find Business Settings</td>
                    <td className="border border-black p-3">Click gear icon (⚙️) in left sidebar</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3">"I don't see your request"</td>
                    <td className="border border-black p-3">Check Business Settings → Users → Partner Requests. Expires after 30 days.</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3">Multiple Business Managers</td>
                    <td className="border border-black p-3">Grant access from each or consolidate ad accounts first</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3">Previous agency still has access</td>
                    <td className="border border-black p-3">Client removes them: Business Settings → Users → Partner Accounts → Remove</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3">Wrong permission level</td>
                    <td className="border border-black p-3">Use Ad Account Advertiser (create/edit), not Admin (includes billing)</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3">"Which Business ID should I use?"</td>
                    <td className="border border-black p-3">Business Settings → Business Info (16-digit number)</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3">Ad account not showing</td>
                    <td className="border border-black p-3">Client selected wrong account before adding you</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3">Client doesn't have Business Manager</td>
                    <td className="border border-black p-3">Create one at business.facebook.com first. Can't grant access from personal profiles.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Meta Ads Permissions Explained */}
      <section className="border-b-2 border-black bg-paper" aria-labelledby="permissions-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="permissions-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
              Meta Ads Access Permissions Explained
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-2 border-black font-mono text-sm">
                <thead>
                  <tr className="bg-ink text-white">
                    <th className="border border-black p-3 text-left font-bold">Permission Level</th>
                    <th className="border border-black p-3 text-center font-bold">Create Campaigns</th>
                    <th className="border border-black p-3 text-center font-bold">Edit Campaigns</th>
                    <th className="border border-black p-3 text-center font-bold">Delete</th>
                    <th className="border border-black p-3 text-center font-bold">View Billing</th>
                    <th className="border border-black p-3 text-left font-bold">Use Case</th>
                  </tr>
                </thead>
                <tbody className="bg-paper">
                  <tr>
                    <td className="border border-black p-3 font-bold">Admin</td>
                    <td className="border border-black p-3 text-center">✅</td>
                    <td className="border border-black p-3 text-center">✅</td>
                    <td className="border border-black p-3 text-center">✅</td>
                    <td className="border border-black p-3 text-center">✅</td>
                    <td className="border border-black p-3">Full account management</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3 font-bold">Ad Account Advertiser</td>
                    <td className="border border-black p-3 text-center">✅</td>
                    <td className="border border-black p-3 text-center">✅</td>
                    <td className="border border-black p-3 text-center">❌</td>
                    <td className="border border-black p-3 text-center">❌</td>
                    <td className="border border-black p-3">Campaign management (most common)</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3 font-bold">Analyst</td>
                    <td className="border border-black p-3 text-center">❌</td>
                    <td className="border border-black p-3 text-center">❌</td>
                    <td className="border border-black p-3 text-center">❌</td>
                    <td className="border border-black p-3 text-center">❌</td>
                    <td className="border border-black p-3">Reporting and insights only</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3 font-bold">Campaign Analyst</td>
                    <td className="border border-black p-3 text-center">❌</td>
                    <td className="border border-black p-3 text-center">❌</td>
                    <td className="border border-black p-3 text-center">❌</td>
                    <td className="border border-black p-3 text-center">❌</td>
                    <td className="border border-black p-3">View specific campaigns only</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Meta Ads Access Checklist */}
      <section className="border-b-2 border-black bg-card" aria-labelledby="checklist-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="checklist-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
              Meta Ads Access Checklist
            </h2>
            <ul className="space-y-2 font-mono text-sm text-foreground list-none">
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Client has Meta Business Suite account
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Agency has provided Business ID
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Client knows which ad accounts to share
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Previous agency partners removed (if applicable)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Correct permission level selected
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Partner invitation sent
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Agency accepted invitation
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Access verified: Can you see campaigns? Can you edit?
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Screenshot account overview for records
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-ink font-bold">□</span>
                Document Business Manager name and ad account IDs
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Related Resources */}
      <section className="border-b-2 border-black bg-card" aria-labelledby="resources-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="resources-heading" className="font-dela text-xl md:text-2xl text-ink mb-4">
              Need a Complete Onboarding Process?
            </h2>
            <p className="font-mono text-sm text-foreground mb-4">
              Getting Meta Ads access is just one step. Download our complete <Link href="/blog/client-onboarding-checklist" className="text-danger-ink font-bold hover:underline">Client Onboarding Checklist</Link> with all platforms, intake forms, and first-week milestones.
            </p>
          </div>
        </div>
      </section>

      {/* Related Platform Guides */}
      <section className="border-b-2 border-black bg-paper" aria-labelledby="related-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="related-heading" className="font-dela text-xl md:text-2xl text-ink mb-4">
              Related Platform Guides
            </h2>
            <p className="font-mono text-sm text-foreground mb-4">
              Need access to other platforms? We have guides for{" "}
              <Link href="/guides/google-ads-access" className="text-danger-ink font-bold hover:underline">
                Google Ads access for agencies
              </Link>
              ,{" "}
              <Link href="/blog/linkedin-ads-access-agency" className="text-danger-ink font-bold hover:underline">
                LinkedIn Ads access
              </Link>
              ,{" "}
              <Link href="/blog/tiktok-ads-access-agency" className="text-danger-ink font-bold hover:underline">
                TikTok Ads access
              </Link>
              , and{" "}
              <Link href="/blog/pinterest-ads-access-agencies" className="text-danger-ink font-bold hover:underline">
                Pinterest Ads access
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
              Get Meta Ads access and intake forms in one link. No Business ID hunting. No expired invitations.
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
