/**
 * Comparison Page Data
 * Structured data for programmatic comparison pages
 */

import { SUPPORTED_PLATFORM_COUNT } from "@agency-platform/shared";

import { LEADSIE_PRICING_SLUG } from "./leadsie-pricing-page";
import type { ProgrammaticComparisonPage } from "./programmatic-types";

/**
 * Leadsie Alternative Comparison Page Data
 * Target keywords: "Leadsie alternative", "Leadsie vs AuthHub", "AuthHub vs Leadsie"
 */
/** Honest published connector breadth on Leadsie compare pages (not full enum count). */
const LEADSIE_COMPARE_AUTHHUB_PLATFORM_BREADTH = "15+";

export const leadsieAlternativePage: ProgrammaticComparisonPage = {
  id: "leadsie-alternative",
  slug: "leadsie-alternative",
  title: "AuthHub vs Leadsie: the Leadsie alternative for agency OAuth + intake",
  metaTitle: "Leadsie Alternative for Agencies: AuthHub vs Leadsie (Pricing & Switch)",
  metaDescription:
    "Comparing Leadsie alternatives? See AuthHub's tiered plans ($29/$79/$149), intake + OAuth in one link, token health + Infisical audit — plus Leadsie credit & overage math at 5–50 clients.",
  openGraphDescription:
    "AuthHub vs Leadsie for agencies: predictable tiers vs credits, 15+ core connectors vs 31+, dual-run migration, and worked monthly cost examples. Verify prices live.",

  competitor: {
    name: "Leadsie",
    tagline: "Client access platform for marketing agencies",
    logo: "/images/competitors/leadsie-logo.png",
    website: "https://leadsie.com",
    pricing: {
      starting: 59,
      currency: "USD",
      billing: "monthly",
      starter: {
        price: 59,
        features: [
          "3 client credits/month",
          "10 audit credits/month",
          "31+ integrations",
          "Overage fees apply",
          "$50 overage pack: 3 credits",
        ],
      },
      pro: {
        price: 129,
        features: [
          "10 client credits/month",
          "50 audit credits/month",
          "White-label and embed",
          "$50 overage pack: 5 credits",
        ],
      },
      enterprise: {
        price: "299",
        features: [
          "50 client credits/month",
          "250 audit credits/month",
          "Multi-brand (up to 3)",
          "Overage fees apply",
          "$50 overage pack: 10 credits",
        ],
      },
    },
    founded: "2019",
    location: "UK",
    platforms: [
      "Meta Ads",
      "Facebook Pages",
      "Instagram",
      "Google Ads",
      "Google Analytics",
      "Google Tag Manager",
      "Merchant Center",
      "Search Console",
      "LinkedIn Ads",
      "TikTok Ads",
      "Snapchat Ads",
      "Shopify",
      "Pinterest Ads",
      "Klaviyo",
      "Mailchimp",
      "WordPress",
      "YouTube",
    ],
    weaknesses: [
      "Client credits and overage packs",
      "No client intake forms",
      "API access listed on Enterprise only",
    ],
    strengths: [
      "31+ integrations",
      "Access Detective",
      "Meta asset creation",
      "Influencer whitelisting",
      "Access requests in 8 languages",
    ],
  },

  ourProduct: {
    name: "AuthHub",
    tagline: "Access + Intake in One Professional Link",
    logo: "/logo.png",
    pricing: {
      starting: 29,
      currency: "USD",
      billing: "monthly",
      starter: {
        price: 29,
        features: [
          "Up to 5 active clients",
          `${LEADSIE_COMPARE_AUTHHUB_PLATFORM_BREADTH} core platforms`,
          "Unlimited team seats",
          "One-link onboarding",
          "Token auto-refresh",
          "Audit logs",
          "AuthHub-branded client link",
          "US-based support",
        ],
      },
      pro: {
        price: 79,
        features: [
          "Everything in Starter",
          "Up to 20 active clients",
          "Full white-label branding",
          "Custom domain",
          "Webhooks & API",
          "Priority support",
          "Token health monitoring dashboard",
        ],
      },
      enterprise: {
        price: "149",
        features: [
          "Everything in Pro",
          "Up to 50 active clients",
          "Multi-brand (3 brands)",
          "Custom integrations",
          "Priority support",
        ],
      },
    },
    differentiators: [
      "Access + Intake in One Link",
      "Predictable tiered pricing (no credits)",
      "Token Health + Infisical Audit",
      `${LEADSIE_COMPARE_AUTHHUB_PLATFORM_BREADTH} Core Connectors`,
    ],
    platforms: [
      "Meta Ads",
      "Facebook Pages",
      "Instagram",
      "Google Ads",
      "GA4",
      "Google Tag Manager",
      "Merchant Center",
      "Search Console",
      "Business Profile",
      "LinkedIn Ads",
      "LinkedIn Pages",
      "TikTok Ads",
      "Snapchat Ads",
      "Pinterest",
      "Klaviyo",
      "Kit (ConvertKit)",
      "Beehiiv",
      "Shopify",
      "Mailchimp",
      "Zapier",
    ],
  },

  excerpt:
    "AuthHub is a Leadsie alternative for agencies that need client OAuth plus intake in one link, predictable monthly tiers ($29 / $79 / $149 with 5 / 20 / 50 active-client caps), and token-health monitoring with Infisical-backed audit trails. Leadsie still wins for 31+ integrations and specialized Meta or influencer workflows. Compare current pricing, platforms, and how to dual-run a switch without breaking live platform permissions.",

  content: "", // Rendered by component from structured data

  framework: "AIDA",

  painPoints: [
    {
      title: "Credit Anxiety",
      icon: "DollarSign",
      quote: "I never know what my bill will be each month.",
      description:
        "Leadsie charges one onboarding credit per new client with manager/admin access. Busy months can require $50 overage packs. Fixed tiers make the monthly bill easier to forecast.",
      solution: "$29 / $79 / $149 monthly tiers with 5 / 20 / 50 client caps",
    },
    {
      title: "Two-Step Onboarding",
      icon: "ArrowRight",
      quote: "I look unprofessional sending multiple links to new clients.",
      description:
        "Leadsie collects platform access. AuthHub request templates can include custom intake fields, so authorization and client context arrive in the same flow.",
      solution: "One link handles OAuth AND collects client info",
    },
    {
      title: "Token Operations",
      icon: "Clock",
      quote: "I need to know which connections are healthy before a campaign launch.",
      description:
        "Expired or revoked access can stop work. AuthHub monitors token health, uses provider-supported refresh where the provider allows it, stores token references in Infisical, and records audit events.",
      solution: "Token health, provider-supported refresh, and audit trails",
    },
    {
      title: "Support Hours",
      icon: "Globe",
      quote: "My team and clients need coverage during US business hours.",
      description:
        "Leadsie's team and many of its customers are strongest in UK/EU hours. AuthHub offers US-based support only — no published guaranteed response-time SLA.",
      solution: "US-based support for US agency ops hours",
    },
  ],

  quickComparison: [
    {
      feature: "Platform Count",
      competitor: "31+",
      authhub: LEADSIE_COMPARE_AUTHHUB_PLATFORM_BREADTH,
      winner: "competitor",
    },
    { feature: "Client Intake Forms", competitor: false, authhub: true, winner: "authhub", isExclusive: true },
    { feature: "API & Webhooks", competitor: "Enterprise", authhub: "Growth+", winner: "authhub" },
    { feature: "Pricing Model", competitor: "Credits + overages", authhub: "Fixed monthly tiers" },
    { feature: "Starting Price", competitor: "$59/mo", authhub: "$29/mo", winner: "authhub" },
  ],

  detailedComparison: [
    {
      category: "Platform Support",
      features: [
        { name: "Meta (Facebook, Instagram)", competitor: true, authhub: true },
        { name: "Google (Ads, Analytics)", competitor: true, authhub: true },
        { name: "LinkedIn Ads", competitor: true, authhub: true },
        { name: "TikTok Ads", competitor: true, authhub: true },
        { name: "Snapchat Ads", competitor: true, authhub: true },
        { name: "Pinterest Ads", competitor: true, authhub: true },
        { name: "Klaviyo", competitor: true, authhub: true },
        { name: "Shopify", competitor: true, authhub: true },
        { name: "Mailchimp", competitor: true, authhub: true },
        { name: "WordPress", competitor: true, authhub: false, notes: "Leadsie advantage" },
        { name: "YouTube", competitor: true, authhub: false, notes: "Leadsie advantage" },
      ],
    },
    {
      category: "Core Features",
      features: [
        { name: "Client Intake Forms", competitor: false, authhub: true },
        { name: "Reusable Templates", competitor: false, authhub: true },
        { name: "Custom Branding", competitor: "Agency tier", authhub: "All plans (depth by tier)" },
        { name: "API + Webhooks", competitor: "Enterprise", authhub: "Growth + Scale only" },
        { name: "Pricing model", competitor: "Credits + $50 overages", authhub: "Fixed monthly tiers" },
        {
          name: "Active-client / credit caps",
          competitor: "3 / 10 / 50 credits",
          authhub: "5 / 20 / 50 active clients",
        },
      ],
    },
    {
      category: "Token Operations & Security",
      features: [
        { name: "Token Health Monitoring", competitor: false, authhub: true },
        { name: "Provider-Supported Refresh", competitor: "Selected platforms", authhub: "Provider capability" },
        { name: "Token Storage", competitor: "Encrypted database", authhub: "Infisical secret references" },
        { name: "Audit Events", competitor: false, authhub: true },
      ],
    },
  ],

  recommendations: {
    stickWithCompetitor: [
      "You need Leadsie's 31+ long-tail integrations",
      "Access Detective, Meta asset creation, or influencer whitelisting is core to your workflow",
      "Your team and clients are best served during UK/EU hours",
      "You already have a separate intake process that works well",
      "You are happy with credit rollover and overage math",
    ],
    switchToAuthHub: [
      "You want predictable monthly bills without credit overages inside 5 / 20 / 50 caps",
      "You want intake answers and OAuth in the same client flow",
      "You want token-health monitoring and Infisical-backed audit events",
      `Your clients use AuthHub's ${LEADSIE_COMPARE_AUTHHUB_PLATFORM_BREADTH} core connectors (Meta, Google, LinkedIn, TikTok, and related)`,
      "You need API + webhooks on Growth or Scale",
      "US-based support fits your ops hours better than UK/EU-first coverage",
    ],
  },

  migrationSteps: [
    {
      step: 1,
      title: "List Active Clients",
      description:
        "List each active client, the platforms they granted, and which authorizations need continued management. Platform permissions stay where the client granted them.",
    },
    {
      step: 2,
      title: "Build AuthHub Templates",
      description:
        "Create reusable request templates, add custom intake fields, and apply your branding for the client types you onboard most often.",
    },
    {
      step: 3,
      title: "Dual-Run the Transition",
      description:
        "Send AuthHub links for new onboarding and renewed authorizations. Clients must re-authorize through AuthHub; existing Leadsie-managed connections do not auto-port. Run both tools in parallel until the clients you care about have completed AuthHub authorization and your team trusts token health in the new system. No 15-minute migration promise and no free CS migration claim.",
    },
  ],

  testimonials: [],

  pricingComparison: {
    competitor: {
      starting: 59,
      currency: "USD",
      billing: "monthly",
    },
    authhub: {
      starter: {
        price: 29,
        features: [
          "Up to 5 active clients",
          `${LEADSIE_COMPARE_AUTHHUB_PLATFORM_BREADTH} core platforms`,
          "Access + Intake",
          "US-based support",
        ],
      },
      pro: {
        price: 79,
        features: [
          "Up to 20 active clients",
          "Webhooks & API access",
          "Custom domain",
          "Priority support",
        ],
      },
      enterprise: {
        price: "149",
        features: [
          "Up to 50 active clients",
          "Multi-brand (3 brands)",
          "Priority support",
          "Custom integrations",
        ],
      },
    },
    savings: {
      monthly: 30,
      yearly: 360,
      percentage: 28,
    },
  },

  competitorPricingSubtitle: "$59 · $129 · $299 (3 / 10 / 50 client credits)",
  authhubSavingsHighlight:
    "$360/yr (~$30/mo) at 10 clients: Growth $79 vs Leadsie Agency yearly effective ~$107/mo",
  valueCallout: {
    headline: "How Leadsie credits work",
    body: "One onboarding credit is used when a new client grants manager or admin access (one client = one credit). View-only audits use separate audit credits. Unused credits typically roll for about three months. Overage packs cost $50 and add onboarding + view-only credits by tier (commonly 3 / 5 / 10 onboarding credits on Starter / Agency / Pro). Active subscriptions generally keep links live when over cap — the pack is the bill shock, not a hard mid-client stop.",
  },
  pricingScenarios: [
    {
      clients: "5",
      competitorPlan: "Starter + 1 overage pack",
      competitorCost: "$109",
      authHubPlan: "Starter",
      authHubCost: "$29",
    },
    {
      clients: "10",
      competitorPlan: "Agency",
      competitorCost: "$129",
      authHubPlan: "Growth",
      authHubCost: "$79",
    },
    {
      clients: "15",
      competitorPlan: "Agency + 1 overage pack",
      competitorCost: "$179",
      authHubPlan: "Growth",
      authHubCost: "$79",
    },
    {
      clients: "20",
      competitorPlan: "Agency + 2 overage packs",
      competitorCost: "$229",
      authHubPlan: "Growth",
      authHubCost: "$79",
    },
    {
      clients: "50",
      competitorPlan: "Pro",
      competitorCost: "$299",
      authHubPlan: "Scale",
      authHubCost: "$149",
    },
  ],
  pricingScenariosNote:
    "Worked examples use the lowest published monthly Leadsie option that covers the onboarding load, including listed overage packs, versus AuthHub monthly list tiers. Prices are pre-tax and were checked on September 23, 2026. Verify both vendors' live pricing pages before you buy.",
  faqs: [
    {
      question: "What is the best Leadsie alternative for marketing agencies?",
      answer:
        "For agencies that need a branded client link to collect OAuth access to Meta, Google Ads, GA4, LinkedIn, and TikTok — with predictable monthly pricing instead of onboarding credits — AuthHub is built as a Leadsie alternative focused on access + intake in one flow, provider-supported token refresh, and Infisical-backed token storage with audit logs. Agencies that need Leadsie's widest 31+ platform list, Access Detective, or Meta asset-creation / influencer workflows may still prefer Leadsie.",
    },
    {
      question: "How does Leadsie pricing work?",
      answer:
        "Leadsie's published monthly plans are $59 / $129 / $299 for 3 / 10 / 50 onboarding credits (Starter / Agency / Pro). View-only audit credits are separate. Unused credits typically roll for about three months. If you exceed the cap, Leadsie sells $50 overage packs (onboarding + view-only credits by tier). Always confirm on Leadsie's pricing page.",
    },
    {
      question: "How does AuthHub pricing compare at 5, 10, 15, 20, and 50 clients?",
      answer:
        "In the worked examples above (pre-tax, checked September 23, 2026), AuthHub costs $29 / $79 / $79 / $79 / $149 at those volumes on Starter → Growth → Scale. The lowest published monthly Leadsie paths in those scenarios are $109 / $129 / $179 / $229 / $299. For a 10-client savings headline we use AuthHub Growth $79/mo vs Leadsie Agency yearly effective ~$107/mo ≈ $360/yr only. Yearly AuthHub equivalents (~$24 / $66 / $124) are on /pricing. Full credit teardown: /compare/leadsie-pricing.",
    },
    {
      question: "Will switching from Leadsie break client access?",
      answer:
        "No. Existing permissions live in Meta, Google, LinkedIn, TikTok, and the other platforms. Canceling Leadsie does not remove those permissions. Clients you move to AuthHub must complete a fresh AuthHub authorization, so dual-run both tools during transition if needed.",
    },
    {
      question: "Does AuthHub support every Leadsie platform?",
      answer:
        `No. Leadsie advertises 31+ integrations, including platforms AuthHub does not currently expose (for example WordPress and YouTube on many Leadsie lists). AuthHub has ${LEADSIE_COMPARE_AUTHHUB_PLATFORM_BREADTH} core connectors across ads, analytics, commerce, and email. Match the matrix to the platforms your clients actually use.`,
    },
    {
      question: "What is the difference between AuthHub and Leadsie's intake approach?",
      answer:
        "Leadsie focuses on access requests. AuthHub request templates can include custom intake fields, so the client answers onboarding questions and authorizes platforms in the same flow.",
    },
    {
      question: "Do I keep client access if I cancel either tool?",
      answer:
        "Platform access remains until the client or platform removes it. Neither vendor owns the granted permission. You may lose vendor-side automation, monitoring, and audit history, but the direct platform authorization does not disappear just because a subscription ends.",
    },
    {
      question: "Does AuthHub include API and webhooks on every plan?",
      answer: "No. API + webhooks are on Growth and Scale only — not Starter.",
    },
    {
      question: "Does AuthHub claim formal SOC 2 certification on this page?",
      answer:
        "No. We do not use a SOC 2 readiness marketing claim here. We do describe Infisical-backed token references and audit logs. Ask security/compliance for current paperwork if you need a formal attestation.",
    },
  ],

  keywords: [
    "Leadsie alternative",
    "AuthHub vs Leadsie",
    "Leadsie vs AuthHub",
    "client access platform alternative",
    "agency onboarding software",
    "Leadsie pricing",
    "Leadsie alternatives",
    "Leadsie pricing comparison",
    "Leadsie competitor",
  ],

  relatedComparisons: ["agencyaccess-alternative", "leadsie-pricing"],
  relatedBlogPosts: [
    "how-to-get-meta-ads-access-from-clients",
    "google-ads-access-agency",
    "ga4-access-agencies",
  ],

  cta: {
    headline: "Ready to compare on a real month?",
    subheadline:
      "Start a 14-day free trial (no credit card), or go straight to AuthHub and Leadsie pricing numbers.",
    primaryButton: "Start 14 Day Free Trial",
    primaryLink: "/signup",
    secondaryButton: "AuthHub Pricing",
    secondaryLink: "/pricing",
    guarantee: "✓ Intake + OAuth in one link  ✓ $29/$79/$149 tiers (5/20/50 caps)  ✓ Dual-run migration",
  },

  isProgrammatic: true,
  templateId: "comparison-aida-v1",
  lastVerified: "2026-09-23",
};

/**
 * AgencyAccess.co Alternative Comparison Page Data
 * Target keywords: "AgencyAccess alternative", "AgencyAccess.co vs AuthHub"
 *
 * Research verified 2026-03-06:
 * - Pricing: $33/$74/$149 monthly (Starter/Premium/Agency) - annual discount
 * - Location: AgencyAccess B.V. (Netherlands/EU)
 * - Claimed agencies: 500+
 * - Platforms: Meta, Google, TikTok, LinkedIn, Shopify, HubSpot, YouTube, Instagram (20+)
 * - Has intake forms, Zapier integration, custom branding
 * - 24/7 chat support on higher tiers
 */
export const agencyAccessAlternativePage: ProgrammaticComparisonPage = {
  id: "agencyaccess-alternative",
  slug: "agencyaccess-alternative",
  title: "AuthHub vs AgencyAccess: Best Client Onboarding Software for Agencies [2026]",
  metaTitle: "AuthHub vs AgencyAccess: Best Client Onboarding Software for Agencies [2026]",
  metaDescription: "Both platforms help agencies collect client permissions through a single link. Compare automatic token refresh, Infisical-backed token storage with audit logs, tiered plans (5/20/50 clients/month), and developer-friendly API access.",

  competitor: {
    name: "AgencyAccess",
    tagline: "Client onboarding platform for marketing agencies",
    logo: "/images/competitors/agencyaccess-logo.png",
    website: "https://www.agencyaccess.co",
    pricing: {
      starting: 33,
      currency: "USD",
      billing: "monthly",
      starter: {
        price: 33,
        features: [
          "5 invites",
          "Up to 3 team members",
          "Email support weekdays",
          "All platforms",
          "Custom branding",
        ],
      },
      pro: {
        price: 74,
        features: [
          "Unlimited invites",
          "Up to 10 team members",
          "Priority email + chat",
          "Zapier integration",
          "Static invite links",
        ],
      },
      enterprise: {
        price: "149",
        features: [
          "Unlimited team members",
          "Multiple brands",
          "24/7 chat support",
          "Priority support",
        ],
      },
    },
    founded: "Unknown",
    location: "Netherlands (EU)",
    platforms: [
      "Meta Ads",
      "Facebook Pages",
      "Instagram",
      "Google Ads",
      "Google Analytics",
      "Google Tag Manager",
      "Google Merchant Center",
      "Google Search Console",
      "Google Business Profile",
      "LinkedIn Company Pages",
      "TikTok Ads",
      "YouTube Studio",
      "Shopify",
      "HubSpot",
      "Klaviyo",
      "20+ total platforms",
    ],
    weaknesses: [
      "Invite limits on Starter tier (5 invites)",
      "No automatic token refresh (manual reconnect required)",
      "No public API for custom development",
      "Limited audit log functionality",
    ],
    strengths: [
      "500+ agencies using the platform",
      "20+ platform integrations (Shopify, HubSpot, Klaviyo)",
      "Zapier integration (7000+ tools)",
      "Custom branding on all tiers",
      "Intake forms included",
      "GDPR compliant",
      "30-day free trial",
      "24/7 chat support on Premium/Agency plans",
    ],
  },

  ourProduct: {
    name: "AuthHub",
    tagline: "Enterprise-grade client access with automation built-in",
    logo: "/logo.png",
    pricing: {
      starting: 29,
      currency: "USD",
      billing: "monthly",
      starter: {
        price: 29,
        features: [
          "Up to 5 active clients",
          "Unlimited team seats",
          "One-link onboarding",
          "Token auto-refresh",
          "Complete audit logs",
          "Infisical-backed token storage",
          `${SUPPORTED_PLATFORM_COUNT} platform connectors`,
          "AuthHub-branded client link",
          "US-based support",
        ],
      },
      pro: {
        price: 79,
        features: [
          "Everything in Starter",
          "Up to 20 active clients",
          "Full white-label branding",
          "Custom domain",
          "API + webhooks",
          "Priority support",
        ],
      },
      enterprise: {
        price: "149",
        features: [
          "Everything in Pro",
          "Up to 50 active clients",
          "Multi-brand (3 brands)",
          "Custom integrations",
          "Priority support",
        ],
      },
    },
    differentiators: [
      "Automatic Token Refresh",
      "Infisical-backed Token Storage",
      "API & Webhooks Built-In",
    ],
    platforms: [
      "Meta Ads",
      "Facebook Pages",
      "Instagram",
      "Google Ads",
      "GA4",
      "Google Tag Manager",
      "Merchant Center",
      "Search Console",
      "LinkedIn Ads",
      "TikTok Ads",
      `${SUPPORTED_PLATFORM_COUNT} platform connectors`,
    ],
  },

  excerpt: "Both platforms help agencies collect client permissions through a single link. Compare automatic token refresh, Infisical-backed token storage with audit logs, tiered plans (5/20/50 clients/month), and developer-friendly API access.",

  content: "", // Rendered by template

  framework: "AIDA",

  painPoints: [
    {
      title: "Manual Token Reconnection",
      icon: "RefreshCw",
      quote: "When tokens expire, clients need to manually reconnect, which can interrupt live campaigns.",
      description: "AgencyAccess uses official platform APIs but doesn't advertise automatic token refresh. This means expired tokens require client action to restore access—often at the worst possible time during active campaigns.",
      solution: "AuthHub monitors token health and automatically refreshes credentials before they expire—with zero client involvement.",
    },
    {
      title: "No Infisical-Grade Token Storage",
      icon: "Shield",
      quote: "We need audit trails and secure token vaulting, but AgencyAccess doesn't advertise Infisical-backed storage.",
      description: "AgencyAccess is GDPR compliant and secure by design, but lacks public documentation of Infisical-backed token storage or comprehensive audit logs. For agencies serving regulated industries or enterprise clients, this can slow vendor approval.",
      solution: "AuthHub stores OAuth tokens in Infisical with complete audit logs—bank-grade encryption without storing tokens in the database.",
    },
    {
      title: "Zapier-Only Automation",
      icon: "Code",
      quote: "We want to build custom workflows, but AgencyAccess only offers Zapier—no public API.",
      description: "AgencyAccess offers Zapier integration on Premium plans ($74+/mo) for connecting to other tools. But there's no public API for custom development or advanced automation beyond pre-built connectors.",
      solution: "AuthHub includes webhooks and API access on paid tiers with live OAuth event telemetry. Build internal workflows, data pipelines, and custom automation beyond pre-built connectors.",
    },
    {
      title: "Invite Limits on Starter",
      icon: "Users",
      quote: "I hit the 5-invite limit on Starter and now I'm stuck until next month.",
      description: "AgencyAccess caps Starter at 5 invites/month. Growing agencies can blow through that in one busy week. You need Premium ($74/mo) for more invites.",
      solution: "AuthHub Growth includes 20 clients/month at $79/mo—no invite caps, no upgrade pressure.",
    },
  ],

  quickComparison: [
    { feature: "Client onboarding", competitor: true, authhub: true, winner: "tie" },
    { feature: "Access request management", competitor: true, authhub: true, winner: "tie" },
    { feature: "Multi-platform OAuth", competitor: true, authhub: true, winner: "tie" },
    { feature: "Priority support", competitor: false, authhub: true, winner: "authhub" },
    { feature: "API access", competitor: false, authhub: true, winner: "authhub", isExclusive: true },
    { feature: "Custom branding", competitor: false, authhub: true, winner: "authhub", isExclusive: true },
  ],

  detailedComparison: [
    {
      category: "Core Features",
      features: [
        { name: "One-Link Client Onboarding", competitor: true, authhub: true },
        { name: "Automatic Token Refresh", competitor: false, authhub: true, notes: "AuthHub exclusive" },
        { name: "Token Health Monitoring", competitor: false, authhub: true, notes: "Proactive refresh before expiry" },
        { name: "Client Intake Forms", competitor: true, authhub: true, notes: "AuthHub: custom fields on request templates" },
        { name: "Custom Branding", competitor: true, authhub: true },
        { name: "Custom Subdomain", competitor: true, authhub: true },
      ],
    },
    {
      category: "Security & Compliance",
      features: [
        { name: "Infisical-backed Token Storage", competitor: false, authhub: true, notes: "AuthHub exclusive" },
        { name: "GDPR Compliant", competitor: true, authhub: true },
        { name: "Complete Audit Logs", competitor: false, authhub: true },
        { name: "Bank-Grade Token Encryption", competitor: false, authhub: true, notes: "Via Infisical" },
      ],
    },
    {
      category: "Automation & Integration",
      features: [
        { name: "API Access", competitor: false, authhub: true, notes: "All paid plans" },
        { name: "Webhooks", competitor: false, authhub: true, notes: "Live OAuth event telemetry" },
        { name: "Zapier Integration", competitor: true, authhub: true, notes: "$74+/mo on AgencyAccess" },
      ],
    },
    {
      category: "Pricing & Limits",
      features: [
        { name: "Starting Price", competitor: "$33/mo (annual)", authhub: "$29 Starter · $79 Growth · $149 Scale" },
        { name: "Client Caps by Tier", competitor: "Premium for unlimited invites", authhub: "5 / 20 / 50 clients/month" },
        { name: "Starter Invite Limit", competitor: "5/month", authhub: "5 clients/month" },
        { name: "Free Trial", competitor: "30 days", authhub: "14 days" },
      ],
    },
    {
      category: "Platform Support",
      features: [
        { name: "Meta (Facebook, Instagram)", competitor: true, authhub: true },
        { name: "Google (Ads, Analytics, GTM)", competitor: true, authhub: true },
        { name: "LinkedIn", competitor: true, authhub: true },
        { name: "TikTok Ads", competitor: true, authhub: true },
        { name: "Shopify", competitor: true, authhub: true },
        { name: "HubSpot", competitor: true, authhub: false },
        { name: "Klaviyo", competitor: true, authhub: true },
        { name: "YouTube Studio", competitor: true, authhub: false },
      ],
    },
  ],

  recommendations: {
    stickWithCompetitor: [
      "You need HubSpot or YouTube Studio integrations",
      "You value 24/7 chat support and longer trial periods",
      "You're comfortable with Zapier-based automation only",
      "You have multi-language client requirements",
    ],
    switchToAuthHub: [
      "You need Infisical-backed token storage and audit trails",
      "You're building custom automation with API/webhooks",
      "You want predictable tiered pricing (5/20/50 clients/month)",
      "You need always-on access with automatic token refresh",
      "You're a developer who needs more than Zapier integrations",
      "You want enterprise-grade security at a startup price",
    ],
  },

  migrationSteps: [
    {
      step: 1,
      title: "Keep Existing Connections",
      description: "OAuth connections are direct between client and platform. Your existing authorizations remain intact—no need to re-authorize current clients.",
      icon: "Link",
    },
    {
      step: 2,
      title: "Set Up AuthHub",
      description: "Create your AuthHub account and configure branding. Set up API webhooks if you're building custom automation.",
      icon: "Settings",
    },
    {
      step: 3,
      title: "Send New Links",
      description: "Use AuthHub links for future client onboarding. Migration takes about 5 minutes per client for new authorizations.",
      icon: "Send",
    },
  ],

  migrationTimeMinutes: 5,

  testimonials: [
    {
      quote: "Automatic token refresh alone saved us 3-4 support tickets per week. Clients never even know their access was about to expire.",
      author: "David Park",
      company: "Growth Engine Agency",
      role: "Founder",
      metric: "Eliminated token expiry tickets",
    },
    {
      quote: "We needed Infisical-backed token storage and audit logs for an enterprise client. AuthHub had both documented; AgencyAccess didn't. That was the entire decision.",
      author: "Sarah Mitchell",
      company: "Compliance-first Marketing",
      role: "Director of Operations",
    },
  ],

  customerCount: 250,
  hoursSavedMetric: 12,

  pricingComparison: {
    competitor: {
      starting: 33,
      currency: "USD",
      billing: "monthly",
    },
    authhub: {
      starter: {
        price: 29,
        features: [
          "Up to 5 active clients",
          `${SUPPORTED_PLATFORM_COUNT} platform connectors`,
          "Automatic token refresh",
          "Complete audit logs",
          "Infisical-backed token storage",
          "AuthHub-branded client link",
        ],
      },
      pro: {
        price: 79,
        features: [
          "Up to 20 active clients",
          "Full white-label + custom domain",
          "API + webhooks included",
          "Priority support",
          "Token health monitoring dashboard",
        ],
      },
      enterprise: {
        price: "149",
        features: [
          "Up to 50 active clients",
          "Multi-brand (3 brands)",
          "Custom integrations",
          "Priority support",
        ],
      },
    },
    // Starter vs Starter, both billed annually: AuthHub $24/mo vs AgencyAccess $33/mo.
    savings: {
      monthly: 9,
      yearly: 108,
      percentage: 27,
    },
  },

  authhubSavingsHighlight: "$108/yr less on Starter: AuthHub $24/mo billed yearly vs AgencyAccess $33/mo billed annually",

  faqs: [
    {
      question: "Can I migrate my existing clients from AgencyAccess to AuthHub?",
      answer: "Yes. Since both platforms use official OAuth flows, your clients simply need to authorize through AuthHub once. It takes about 5 minutes per client and doesn't affect existing permissions. You can run both platforms simultaneously during migration.",
    },
    {
      question: "Does AuthHub support the same platforms as AgencyAccess?",
      answer: "AuthHub supports all major advertising and analytics platforms including Meta Ads, Google Ads, GA4, Google Search Console, LinkedIn Ads, TikTok Ads, and more. AgencyAccess advertises 20+ integrations, including HubSpot and YouTube Studio, which AuthHub does not offer. Check both platforms for your specific needs.",
    },
    {
      question: "How does AuthHub's automatic token refresh work?",
      answer: "AuthHub monitors token health and automatically refreshes credentials before they expire. This happens in the background with zero client involvement. AgencyAccess requires clients to manually reconnect when access expires, which can interrupt live campaigns and require additional support.",
    },
    {
      question: "Is AuthHub more expensive than AgencyAccess?",
      answer: "AuthHub Growth starts at $79/month with up to 20 active clients and API access. AgencyAccess Starter is $33/month (annual) but limits you to 5 invites. For equivalent features (more invites, automation), AgencyAccess Premium costs $74/month. AuthHub delivers better value for automation-focused teams.",
    },
    {
      question: "What security certifications does AuthHub have?",
      answer: "AuthHub stores OAuth tokens in Infisical with bank-grade encryption and provides complete audit logs for compliance documentation. We never store tokens directly in our database. AgencyAccess is GDPR compliant but doesn't advertise Infisical-backed token storage or comprehensive audit logs.",
    },
    {
      question: "Do I lose client access if I cancel AuthHub?",
      answer: "No. Just like AgencyAccess, permissions live in the platforms themselves (Meta, Google, etc.) and remain active until your client revokes them. Canceling either platform doesn't affect your platform-level access.",
    },
    {
      question: "Does AuthHub have intake forms like AgencyAccess?",
      answer: "Yes. AuthHub request templates carry custom intake fields, so the client answers onboarding questions and authorizes platforms in the same flow. AgencyAccess also includes built-in intake forms.",
    },
    {
      question: "Which platform has better support?",
      answer: "AgencyAccess offers 24/7 chat support on Premium and Agency plans. AuthHub provides email and documentation support. For teams requiring round-the-clock assistance, AgencyAccess may be the better choice.",
    },
  ],

  keywords: [
    "AgencyAccess alternative",
    "AgencyAccess.co vs AuthHub",
    "AgencyAccess pricing",
    "client access platform alternative",
    "agency onboarding software",
    "AgencyAccess competitor",
    "AgencyAccess review",
    "automatic token refresh",
    "Infisical token storage agency tools",
  ],

  relatedComparisons: ["leadsie-alternative"],
  relatedBlogPosts: [
    "how-to-get-meta-ads-access-from-clients",
    "google-ads-access-agency",
    "tiktok-ads-access-agency",
  ],

  cta: {
    headline: "Ready to Upgrade Your Client Onboarding?",
    subheadline: "Join agencies who chose AuthHub for automatic token refresh, Infisical-backed security, and predictable tiered pricing.",
    primaryButton: "Start Free Trial",
    primaryLink: "/signup",
    secondaryButton: "Schedule Demo",
    secondaryLink: "/pricing",
    guarantee: "✓ No credit card required ✓ 14-day free trial ✓ Cancel anytime",
  },

  isProgrammatic: true,
  templateId: "comparison-aida-v1",
  lastVerified: "2026-03-06",
};

/**
 * All comparison pages data
 * Add new comparison pages by adding objects to this array
 */
export const COMPARISON_PAGES: ProgrammaticComparisonPage[] = [
  leadsieAlternativePage,
  agencyAccessAlternativePage,
  // Add more comparison pages here:
  // otherPlatformAlternativePage,
  // anotherCompetitorAlternativePage,
];

/**
 * Get comparison page by slug
 */
export function getComparisonPageBySlug(slug: string): ProgrammaticComparisonPage | undefined {
  return COMPARISON_PAGES.find((page) => page.slug === slug);
}

/**
 * Get all comparison page slugs for static generation
 */
export function getAllComparisonPageSlugs(): string[] {
  return [...COMPARISON_PAGES.map((page) => page.slug), LEADSIE_PRICING_SLUG];
}

/**
 * Get related comparison pages (for internal linking)
 */
export function getRelatedComparisons(currentSlug: string, limit = 3): ProgrammaticComparisonPage[] {
  return COMPARISON_PAGES.filter((page) => page.slug !== currentSlug).slice(0, limit);
}
