/**
 * White-label client access feature page
 * Target URL: /features/white-label
 */

import Link from "next/link";
import type { Metadata } from "next";
import { ComparisonCTA } from "@/components/marketing/comparison-cta";
import { Button } from "@/components/ui/button";

const PAGE_TITLE = "White-Label Client Access: Branded OAuth Links for Agencies";
const META_DESCRIPTION =
  "White-label client access for agencies: branded OAuth links with your logo and colors — not a project portal. See plan gates, peers, and token ops.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: META_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: META_DESCRIPTION,
    type: "article",
    url: "https://authhub.co/features/white-label",
  },
  alternates: {
    canonical: "https://authhub.co/features/white-label",
  },
};

const faqPlainText = [
  {
    question: "What is AuthHub white-label client access?",
    answer:
      "AuthHub white-label lets marketing agencies customize the logo and colors on a client authorization experience. Clients grant access to ad and analytics platforms through official OAuth flows without sharing passwords. Authorization links use an AuthHub URL, and provider authorization screens retain their official platform branding. It is not a white-label project portal (files/tickets/billing); it is a branded access-collection experience. AuthHub prices by active clients ($29 / $79 / $149 for 5 / 20 / 50 on public monthly tiers as of 2026-10-02 ~09:34 PT) and stores tokens with Infisical plus audit logs; AuthHub is not SOC2-certified. Growth+ includes logo and color customization; Starter uses AuthHub branding. Confirm gates on authhub.co/pricing before you buy.",
  },
  {
    question: "How is a white-label client access link different from a white-label client portal?",
    answer:
      "A white-label client portal (tools like SuiteDash, ManyRequests, or Assembly) is usually a branded workspace for projects, files, messaging, and billing. A white-label client access link (AuthHub, Leadsie, ClientInvite) is a branded flow where the client signs into Meta, Google, or other platforms and grants the agency access via OAuth. Agencies often need both; they solve different jobs. Pick a portal for ongoing collaboration hubs; pick an access tool when the bottleneck is getting into ad accounts safely.",
  },
  {
    question: "AuthHub white-label vs Leadsie branding — which should agencies pick?",
    answer:
      "Both let you customize the client-facing access experience. Leadsie's public pricing emphasizes white-label & embed unlocked on Agency ($129/mo as of 2026-10-02) and multi-brand on Pro ($299), with Starter at $59 and $50 overage packs. AuthHub provides logo and color customization on its client authorization experience, plus automatic token refresh and Infisical/audit logs, with capacity priced by active clients rather than Leadsie credits. AuthHub authorization links use an AuthHub URL. Pick Leadsie if you need its credit/audit workflow and embed story; pick AuthHub when token health, auditability, and broader platform coverage (honest 15+, no Leadsie parity claim) matter more. Re-fetch both pricing pages on the day you decide.",
  },
] as const;

const faqs = [
  {
    question: faqPlainText[0].question,
    answer: (
      <>
        AuthHub white-label lets marketing agencies customize the logo and colors on a client authorization
        experience. Clients grant access to ad and analytics platforms through official OAuth flows without
        sharing passwords. Authorization links use an AuthHub URL, and provider authorization screens retain
        their official platform branding. It is <strong>not</strong> a
        white-label project portal (files/tickets/billing); it is a branded{" "}
        <strong>access-collection</strong> experience. AuthHub prices by active clients (
        <strong>$29 / $79 / $149</strong> for <strong>5 / 20 / 50</strong> on public monthly tiers as of{" "}
        <strong>2026-10-02 ~09:34 PT</strong>) and stores tokens with <strong>Infisical</strong> plus{" "}
        <strong>audit logs</strong>; AuthHub is <strong>not SOC2-certified</strong>. Logo and color
        customization unlocks on <strong>Growth+</strong>; Starter uses AuthHub branding. Confirm
        gates on{" "}
        <a
          href="https://authhub.co/pricing"
          className="text-danger-ink font-bold hover:underline"
        >
          authhub.co/pricing
        </a>{" "}
        before you buy.
      </>
    ),
  },
  {
    question: faqPlainText[1].question,
    answer: (
      <>
        A white-label client <strong>portal</strong> (tools like SuiteDash, ManyRequests, or Assembly)
        is usually a branded workspace for projects, files, messaging, and billing. A white-label client{" "}
        <strong>access link</strong> (AuthHub, Leadsie, ClientInvite) is a branded flow where the client
        signs into Meta, Google, or other platforms and grants the agency access via OAuth. Agencies often
        need both; they solve different jobs. Pick a portal for ongoing collaboration hubs; pick an access
        tool when the bottleneck is getting into ad accounts safely.
      </>
    ),
  },
  {
    question: faqPlainText[2].question,
    answer: (
      <>
        Both let you customize the client-facing access experience. Leadsie&apos;s public pricing emphasizes{" "}
        <strong>white-label &amp; embed</strong> unlocked on <strong>Agency</strong> (
        <strong>$129</strong>/mo as of <strong>2026-10-02</strong>) and multi-brand on <strong>Pro</strong> (
        <strong>$299</strong>), with Starter at <strong>$59</strong> and <strong>$50</strong> overage packs.
        AuthHub provides <strong>logo and color customization</strong> on its client authorization experience,
        plus automatic token refresh and Infisical/audit logs, with capacity priced by <strong>active clients</strong>
        rather than Leadsie credits. Authorization links use an AuthHub URL. Pick Leadsie if you need its
        credit/audit workflow and embed story; pick AuthHub when token health, auditability, and broader
        platform coverage (honest <strong>15+</strong>, no Leadsie parity claim) matter more. Re-fetch both
        pricing pages on the day you decide.
      </>
    ),
  },
];

const tableClass = "w-full border-collapse border-2 border-black font-mono text-sm";
const thClass = "border border-black p-3 text-left font-bold";
const tdClass = "border border-black p-3 align-top";

export default function WhiteLabelFeaturePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqPlainText.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://authhub.co" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Features",
        item: "https://authhub.co/features/white-label",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "White-Label Client Access",
        item: "https://authhub.co/features/white-label",
      },
    ],
  };

  return (
    <div className="min-h-screen bg-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <section className="border-b-2 border-black bg-coral/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <p className="font-mono text-sm text-danger-ink font-bold uppercase tracking-wider mb-3">
              Product feature
            </p>
            <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-4 tracking-tight">
              {PAGE_TITLE}
            </h1>
            <p className="font-mono text-base text-foreground mb-4">
              Most results for &ldquo;white label client portal&rdquo; are <strong>project hubs</strong>
              —files, tickets, messaging, and billing under your domain (SuiteDash, ManyRequests, Assembly,
              and similar). AuthHub&apos;s job is different: a <strong>branded OAuth access link</strong> so
              clients grant Meta, Google, GA4, LinkedIn, TikTok, and more through official OAuth—without sharing
              passwords. Branding controls can show <strong>your logo and colors</strong> in the AuthHub experience.
            </p>
            <p className="font-mono text-sm text-foreground mb-8">
              This page explains what AuthHub white-label includes, <strong>which plans unlock full branding vs an AuthHub-branded link</strong>, how peers (Leadsie, ClientInvite) gate branding, and what sits behind the link (token refresh + Infisical/audit). Prices and plan gates checked{" "}
              <strong>October 2, 2026 (~09:34 PT)</strong>.{" "}
              <strong>Verify live `/pricing` pages before you buy.</strong>
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-6">
              <ComparisonCTA variant="brutalist" size="xl">
                Start 14-day free trial — no credit card
              </ComparisonCTA>
              <Button variant="secondary" size="lg" asChild className="min-h-[48px] font-bold uppercase tracking-wider">
                <Link href="/pricing">See plan gates on pricing</Link>
              </Button>
            </div>
            <p className="font-mono text-sm text-foreground">
              <Link href="/compare/leadsie-alternative" className="text-danger-ink font-bold hover:underline">
                Leaving Leadsie?
              </Link>
              {" · "}
              <Link href="/compare/clientinvite-alternative" className="text-danger-ink font-bold hover:underline">
                ClientInvite vs AuthHub
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-card" aria-labelledby="category-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="category-heading" className="font-dela text-xl md:text-2xl text-ink mb-4">
              White-label access ≠ white-label portal
            </h2>
            <h3 className="font-display text-lg font-semibold text-ink mb-3">Two products, two jobs</h3>
            <div className="overflow-x-auto mb-6">
              <table className={tableClass}>
                <thead>
                  <tr className="bg-ink text-white">
                    <th className={thClass}>Job</th>
                    <th className={thClass}>Typical tools</th>
                    <th className={thClass}>What the client does</th>
                  </tr>
                </thead>
                <tbody className="bg-paper">
                  <tr>
                    <td className={tdClass}>
                      <strong>White-label client portal</strong>
                    </td>
                    <td className={tdClass}>SuiteDash, ManyRequests, Assembly, Sagely-class guides</td>
                    <td className={tdClass}>
                      Work in a branded workspace (projects, files, billing, chat)
                    </td>
                  </tr>
                  <tr>
                    <td className={tdClass}>
                      <strong>White-label client access link</strong>
                    </td>
                    <td className={tdClass}>AuthHub, Leadsie, ClientInvite</td>
                    <td className={tdClass}>
                      Sign into Meta/Google/etc. and <strong>grant agency access</strong> via official OAuth
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="font-mono text-sm text-foreground mb-4">
              Agencies often need <strong>both</strong>. A portal does not collect ad-account permissions. An
              access tool does not replace your project hub. Search volume for the portal phrase is small but
              real—SnowSEO US <strong>`white label client portal` = 10/mo (MEDIUM)</strong> as of{" "}
              <strong>2026-10-02</strong>; exact supporting phrases like `white label client access` / `branded
              oauth link agency` return <strong>0</strong>. This page is feature clarity + AEO, not a volume
              chase—and AuthHub GSC has <strong>no</strong> `white label*` query rows in the recent 28-day window.
            </p>
            <h3 className="font-display text-lg font-semibold text-ink mb-3">One-line AuthHub promise</h3>
            <p className="font-mono text-sm text-foreground">
              <strong>Your logo and colors. Official platform OAuth. AuthHub authorization links.</strong> Soft-link
              the product overview on the{" "}
              <Link href="/" className="text-danger-ink font-bold hover:underline">
                homepage
              </Link>{" "}
              and live gates on{" "}
              <Link href="/pricing" className="text-danger-ink font-bold hover:underline">
                pricing
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-paper" aria-labelledby="includes-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="includes-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
              What AuthHub white-label includes
            </h2>

            <h3 className="font-display text-lg font-semibold text-ink mb-3">Client-facing brand surface</h3>
            <p className="font-mono text-sm text-foreground mb-3">On <strong>Growth and Scale</strong>, AuthHub white-label covers:</p>
            <ul className="list-disc list-inside space-y-2 font-mono text-sm text-foreground mb-4 marker:text-coral">
              <li>
                <strong>Your logo and brand colors</strong> on the client authorization experience
              </li>
              <li>
                Authorization links use an <strong>AuthHub URL</strong>; custom-domain routing is not currently available
              </li>
              <li>
                Clients complete Meta, Google, and other platform permissions on the <strong>official platform screens</strong>
              </li>
            </ul>
            <p className="font-mono text-sm text-foreground mb-6">
              <strong>Starter</strong> ships an <strong>AuthHub-branded client link</strong>. Growth and Scale add logo
              and color customization. All authorization links use an AuthHub URL. Confirm bullets on{" "}
              <a href="https://authhub.co/pricing" className="text-danger-ink font-bold hover:underline">
                authhub.co/pricing
              </a>{" "}
              on the day you buy.
            </p>

            <h3 className="font-display text-lg font-semibold text-ink mb-3">The one-link job</h3>
            <p className="font-mono text-sm text-foreground mb-6">
              One link replaces the &ldquo;can you add us to Business Manager?&rdquo; email chain. Clients authorize
              featured platforms (Meta Ads, Google Ads, GA4, LinkedIn, TikTok) and the broader honest{" "}
              <strong>15+</strong> set AuthHub supports—<strong>no Leadsie platform-parity claim</strong>. Optional
              intake can ride the same flow where you use it; intake is real, not exclusive vs peers.
            </p>

            <h3 className="font-display text-lg font-semibold text-ink mb-3">Ops behind the branded link</h3>
            <p className="font-mono text-sm text-foreground mb-3">
              Branding is the surface. Ops is why access stays usable after day one:
            </p>
            <ul className="list-disc list-inside space-y-2 font-mono text-sm text-foreground mb-4 marker:text-coral">
              <li>
                <strong>Automatic token refresh</strong> where providers allow (so teams spend less time re-chasing expired grants)
              </li>
              <li>
                <strong>Infisical-backed token storage</strong> (encrypted vault—not passwords in a shared doc)
              </li>
              <li>
                <strong>Audit logs</strong>—who accessed what, when
              </li>
            </ul>
            <p className="font-mono text-sm text-foreground">
              <strong>AuthHub is not SOC2-certified.</strong> Security story = Infisical + audit logs. Do not treat
              marketing homepage lines about access &ldquo;never dropping&rdquo; as a contractual forever-access
              claim—platform grants can still be revoked by the client or the platform.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-card" aria-labelledby="plans-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="plans-heading" className="font-dela text-xl md:text-2xl text-ink mb-4">
              Plans and white-label gates (AuthHub)
            </h2>
            <p className="font-mono text-sm text-foreground mb-6">
              <strong>Monthly list prices are primary.</strong> Annual figures are footnotes only.
            </p>
            <div className="overflow-x-auto mb-6">
              <table className={tableClass}>
                <thead>
                  <tr className="bg-ink text-white">
                    <th className={thClass}>Plan</th>
                    <th className={thClass}>Monthly</th>
                    <th className={thClass}>Active clients</th>
                    <th className={thClass}>Branding surface</th>
                    <th className={thClass}>Also notable</th>
                  </tr>
                </thead>
                <tbody className="bg-paper">
                  <tr>
                    <td className={tdClass}>
                      <strong>Starter</strong>
                    </td>
                    <td className={tdClass}>
                      <strong>$29</strong>
                    </td>
                    <td className={tdClass}>
                      <strong>5</strong>
                    </td>
                    <td className={tdClass}>
                      <strong>AuthHub-branded</strong> client link
                    </td>
                    <td className={tdClass}>
                      One-link onboarding, token auto-refresh, audit logs, unlimited team seats
                    </td>
                  </tr>
                  <tr>
                    <td className={tdClass}>
                      <strong>Growth</strong>
                    </td>
                    <td className={tdClass}>
                      <strong>$79</strong>
                    </td>
                    <td className={tdClass}>
                      <strong>20</strong>
                    </td>
                    <td className={tdClass}>
                      <strong>Logo and color customization</strong>
                    </td>
                    <td className={tdClass}>Webhooks &amp; API, priority support, token health monitoring</td>
                  </tr>
                  <tr>
                    <td className={tdClass}>
                      <strong>Scale</strong>
                    </td>
                    <td className={tdClass}>
                      <strong>$149</strong>
                    </td>
                    <td className={tdClass}>
                      <strong>50</strong>
                    </td>
                    <td className={tdClass}>Everything in Growth + <strong>multi-brand (up to 3)</strong></td>
                    <td className={tdClass}>Custom integrations</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="font-mono text-sm text-foreground">
              <strong>Annual footnote (pay-for-10-get-12 framing on site):</strong> ~<strong>$24 / $66 / $124</strong>
              /mo equiv. ($290 / $790 / $1,490/yr). <strong>14-day free trial</strong>, no credit card.
            </p>
            <p className="font-mono text-sm text-foreground mt-4">
              <strong>Do not invent &ldquo;white-label on every plan.&rdquo;</strong> Starter is AuthHub-branded; logo and
              color customization starts at <strong>Growth</strong>; multi-brand is <strong>Scale</strong>. Custom-domain
              routing is not currently available. Live
              source: AuthHub `/pricing` SoftwareApplication JSON-LD + plan cards, checked{" "}
              <strong>2026-10-02 ~09:34 PT</strong>.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-paper" aria-labelledby="peers-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="peers-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
              How peers handle branding (fair table)
            </h2>
            <div className="overflow-x-auto mb-6">
              <table className={tableClass}>
                <thead>
                  <tr className="bg-ink text-white">
                    <th className={thClass}>Dimension</th>
                    <th className={thClass}>AuthHub</th>
                    <th className={thClass}>Leadsie</th>
                    <th className={thClass}>ClientInvite</th>
                    <th className={thClass}>Portal tools</th>
                  </tr>
                </thead>
                <tbody className="bg-paper">
                  <tr>
                    <td className={tdClass}>
                      <strong>What you brand</strong>
                    </td>
                    <td className={tdClass}>Access authorization link (logo / colors)</td>
                    <td className={tdClass}>Access requests (slug, logo, fonts, colors, embed)</td>
                    <td className={tdClass}>Access link (&ldquo;customize your branding&rdquo;)</td>
                    <td className={tdClass}>Project workspace (files, tickets, billing)</td>
                  </tr>
                  <tr>
                    <td className={tdClass}>
                      <strong>When branding unlocks</strong>
                    </td>
                    <td className={tdClass}>
                      Logo and color customization on <strong>Growth+</strong> ($79); AuthHub-branded on Starter
                      ($29); multi-brand on Scale ($149). Custom-domain routing is not currently available.
                    </td>
                    <td className={tdClass}>
                      <strong>White-label &amp; embed</strong> on <strong>Agency+</strong> ($129); multi-brand on{" "}
                      <strong>Pro</strong> ($299)
                    </td>
                    <td className={tdClass}>
                      Branding on <strong>Solo $14.99 / Freelancer $29 / Agency $89</strong>
                    </td>
                    <td className={tdClass}>Usually core to the portal product</td>
                  </tr>
                  <tr>
                    <td className={tdClass}>
                      <strong>Pricing unit</strong>
                    </td>
                    <td className={tdClass}>
                      <strong>Active clients</strong> (5 / 20 / 50)
                    </td>
                    <td className={tdClass}>
                      <strong>Onboard + audit credits</strong> + <strong>$50</strong> packs
                    </td>
                    <td className={tdClass}>
                      <strong>Monthly connections</strong> (1 / 3 / unlimited)
                    </td>
                    <td className={tdClass}>Seat / portal plans (out of scope here)</td>
                  </tr>
                  <tr>
                    <td className={tdClass}>
                      <strong>Ops emphasis</strong>
                    </td>
                    <td className={tdClass}>Token auto-refresh + Infisical + audit</td>
                    <td className={tdClass}>Access Detective, Meta asset helpers, credit rollover</td>
                    <td className={tdClass}>Official APIs; Meta / Google / Shopify emphasis</td>
                    <td className={tdClass}>Collaboration hub—not OAuth access</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="font-mono text-xs text-muted-foreground mb-8">
              Sources:{" "}
              <a href="https://authhub.co/pricing" className="text-danger-ink font-bold hover:underline">
                authhub.co/pricing
              </a>
              ,{" "}
              <a
                href="https://www.leadsie.com/pricing"
                className="text-danger-ink font-bold hover:underline"
              >
                leadsie.com/pricing
              </a>
              ,{" "}
              <a
                href="https://clientinvite.com/pricing"
                className="text-danger-ink font-bold hover:underline"
              >
                clientinvite.com/pricing
              </a>
              , checked <strong>October 2, 2026 (~09:34 PT)</strong>.
            </p>

            <h3 className="font-display text-lg font-semibold text-ink mb-3">When AuthHub white-label wins</h3>
            <ul className="list-disc list-inside space-y-2 font-mono text-sm text-foreground mb-6 marker:text-coral">
              <li>
                You need logo and color customization in the AuthHub authorization experience
              </li>
              <li>
                You want <strong>broader ad/analytics stack coverage</strong> (honest <strong>15+</strong>) plus{" "}
                <strong>token refresh</strong> and <strong>Infisical/audit</strong> behind the link
              </li>
              <li>
                You prefer <strong>active-client flat tiers</strong> ($29 / $79 / $149) over credit packs—see{" "}
                <Link href="/blog/flat-rate-vs-credit-pricing" className="text-danger-ink font-bold hover:underline">
                  flat-rate vs credit pricing
                </Link>
              </li>
            </ul>

            <h3 className="font-display text-lg font-semibold text-ink mb-3">
              When a peer&apos;s branding (or a portal) is enough
            </h3>
            <ul className="list-disc list-inside space-y-2 font-mono text-sm text-foreground mb-6 marker:text-coral">
              <li>
                <strong>Shopify-heavy</strong> Meta/Google/Shopify flow + <strong>unlimited</strong> connections at{" "}
                <strong>$89</strong> →{" "}
                <Link href="/compare/clientinvite-alternative" className="text-danger-ink font-bold hover:underline">
                  ClientInvite vs AuthHub
                </Link>{" "}
                may fit better
              </li>
              <li>
                Need Leadsie&apos;s <strong>credit/audit</strong> workflow, Access Detective, and <strong>embed</strong>{" "}
                story on Agency+ → stay on / evaluate{" "}
                <Link href="/compare/leadsie-alternative" className="text-danger-ink font-bold hover:underline">
                  Leadsie alternative
                </Link>{" "}
                and{" "}
                <Link href="/compare/leadsie-pricing" className="text-danger-ink font-bold hover:underline">
                  Leadsie pricing
                </Link>
              </li>
              <li>
                Need a full <strong>project portal</strong> (files, tickets, billing) → SuiteDash-class tools; that is{" "}
                <strong>not</strong> AuthHub&apos;s job
              </li>
              <li>
                Early branding experiments on a tiny roster → ClientInvite Solo/Freelancer branding starts lower on the
                ladder; AuthHub Starter is AuthHub-branded until Growth
              </li>
            </ul>
            <p className="font-mono text-sm text-foreground">
              More peer context:{" "}
              <Link
                href="/compare/leadsie-vs-agencyaccess-vs-authhub"
                className="text-danger-ink font-bold hover:underline"
              >
                three-way buyer guide
              </Link>{" "}
              ·{" "}
              <Link href="/compare/agencyaccess-alternative" className="text-danger-ink font-bold hover:underline">
                AgencyAccess alternative
              </Link>{" "}
              ·{" "}
              <Link href="/blog/best-leadsie-alternatives-2026" className="text-danger-ink font-bold hover:underline">
                best Leadsie alternatives 2026
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-card" aria-labelledby="security-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="security-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
              Security and compliance (honest)
            </h2>
            <div className="overflow-x-auto mb-6">
              <table className={tableClass}>
                <thead>
                  <tr className="bg-ink text-white">
                    <th className={thClass}>Topic</th>
                    <th className={thClass}>AuthHub stance on this page</th>
                  </tr>
                </thead>
                <tbody className="bg-paper">
                  <tr>
                    <td className={tdClass}>Token storage</td>
                    <td className={tdClass}>
                      <strong>Infisical</strong>-backed vault
                    </td>
                  </tr>
                  <tr>
                    <td className={tdClass}>Visibility</td>
                    <td className={tdClass}>
                      <strong>Audit logs</strong> on activity
                    </td>
                  </tr>
                  <tr>
                    <td className={tdClass}>Certification</td>
                    <td className={tdClass}>
                      <strong>No SOC2</strong> claim
                    </td>
                  </tr>
                  <tr>
                    <td className={tdClass}>Forever access</td>
                    <td className={tdClass}>
                      <strong>Not claimed</strong>—clients and platforms can revoke grants
                    </td>
                  </tr>
                  <tr>
                    <td className={tdClass}>Password sharing</td>
                    <td className={tdClass}>Not required—official OAuth / permission screens</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="font-mono text-sm text-foreground">
              Deeper ops reading:{" "}
              <Link href="/blog/oauth-token-management-agencies" className="text-danger-ink font-bold hover:underline">
                OAuth token management for agencies
              </Link>{" "}
              ·{" "}
              <Link href="/blog/mcp-oauth-client-access-agencies" className="text-danger-ink font-bold hover:underline">
                MCP + OAuth client access
              </Link>
              . Category context:{" "}
              <Link
                href="/blog/best-client-onboarding-software-agencies-2026"
                className="text-danger-ink font-bold hover:underline"
              >
                best client onboarding software for agencies
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-paper" aria-labelledby="switching-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="switching-heading" className="font-dela text-xl md:text-2xl text-ink mb-4">
              Switching / dual-run
            </h2>
            <p className="font-mono text-sm text-foreground">
              Moving from Leadsie, ClientInvite, or another access tool does <strong>not</strong> require a big-bang
              cutover. <strong>Dual-run</strong> is fine: keep existing peer links live while you send AuthHub&apos;s
              branded (or AuthHub-branded Starter) link to new or re-authorized clients. Access ultimately lives in the{" "}
              <strong>ad platforms</strong>; re-authorize what you need, then retire the old link when ready. No
              &ldquo;15-minute free CS migration&rdquo; promise here.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-card" aria-labelledby="faq-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 id="faq-heading" className="font-dela text-2xl md:text-3xl text-ink mb-8 text-center max-w-3xl mx-auto">
            FAQ
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="group border-2 border-ink p-4 rounded-none">
                <summary className="font-dela text-lg text-ink cursor-pointer list-none flex justify-between items-center gap-4">
                  {faq.question}
                  <span className="transform transition-transform group-open:rotate-180 shrink-0" aria-hidden>
                    ▼
                  </span>
                </summary>
                <div className="font-mono text-sm text-foreground mt-4 pt-4 border-t border-gray-200">{faq.answer}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-paper" aria-labelledby="related-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="related-heading" className="font-dela text-xl md:text-2xl text-ink mb-4">
              Related reading / next steps
            </h2>
            <ul className="list-disc list-inside space-y-2 font-mono text-sm text-foreground marker:text-coral">
              <li>
                <Link href="/pricing" className="text-danger-ink font-bold hover:underline">
                  AuthHub pricing
                </Link>{" "}
                — live white-label tier gates
              </li>
              <li>
                <Link href="/" className="text-danger-ink font-bold hover:underline">
                  Homepage
                </Link>{" "}
                — product + trial
              </li>
              <li>
                <Link href="/compare/clientinvite-alternative" className="text-danger-ink font-bold hover:underline">
                  ClientInvite vs AuthHub
                </Link>
              </li>
              <li>
                <Link href="/compare/leadsie-alternative" className="text-danger-ink font-bold hover:underline">
                  Leadsie alternative
                </Link>{" "}
                ·{" "}
                <Link href="/compare/leadsie-pricing" className="text-danger-ink font-bold hover:underline">
                  Leadsie pricing
                </Link>
              </li>
              <li>
                <Link href="/blog/flat-rate-vs-credit-pricing" className="text-danger-ink font-bold hover:underline">
                  Flat-rate vs credit pricing
                </Link>
              </li>
              <li>
                <Link href="/blog/oauth-token-management-agencies" className="text-danger-ink font-bold hover:underline">
                  OAuth token management for agencies
                </Link>
              </li>
              <li>
                <Link href="/blog/mcp-oauth-client-access-agencies" className="text-danger-ink font-bold hover:underline">
                  MCP OAuth client access for agencies
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-ink text-white" aria-labelledby="final-cta-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-3xl mx-auto text-center">
            <h2 id="final-cta-heading" className="font-dela text-xl md:text-2xl mb-6">
              Start your 14-day free trial — send a branded (or AuthHub-branded) link this week
            </h2>
            <ComparisonCTA variant="secondary" size="xl">
              Start 14-day free trial — no credit card
            </ComparisonCTA>
            <p className="mt-8 font-mono text-xs text-white/70 max-w-2xl mx-auto">
              Prices and branding gates from public vendor pages checked October 2, 2026 (~09:34 PT). SnowSEO keyword
              figure for `white label client portal` from 2026-10-02 US pull. Nothing invented beyond those sources.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
