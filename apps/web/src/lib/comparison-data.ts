/**
 * Comparison Page Data
 * Structured data for programmatic comparison pages
 */

import { LEADSIE_PRICING_SLUG } from "./leadsie-pricing-page";
import { THREE_WAY_COMPARE_SLUG } from "./three-way-comparison-data";
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
    "best-leadsie-alternatives-2026",
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

/** Honest published connector breadth on AgencyAccess compare pages (not full enum count). */
const AGENCYACCESS_COMPARE_AUTHHUB_PLATFORM_BREADTH = "15+";

/** Cleared testimonial names — must not appear on /compare/agencyaccess-alternative */
export const FORBIDDEN_AGENCYACCESS_COMPARE_TESTIMONIAL_NAMES = [
  "Mike Torres",
  "Jennifer Walsh",
  "David Park",
  "Sarah Mitchell",
] as const;

/**
 * AgencyAccess.co Alternative Comparison Page Data
 * Target keywords: "AgencyAccess alternative", "AuthHub vs AgencyAccess"
 *
 * Research verified 2026-09-24 (PT):
 * - AgencyAccess monthly: $44 / $99 / $199; annual equiv. $33 / $74 / $149
 * - Caps: 5 / 15 / 50 clients per month (Agency: 50 then custom)
 * - Both AuthHub and AgencyAccess publish public APIs
 */
export const agencyAccessAlternativePage: ProgrammaticComparisonPage = {
  id: "agencyaccess-alternative",
  slug: "agencyaccess-alternative",
  title: "AuthHub vs AgencyAccess (2026): Token Refresh, Pricing, and Who Should Switch",
  metaTitle: "AuthHub vs AgencyAccess (2026): Token Refresh, Pricing, and Who Should Switch",
  metaDescription:
    "Compare AuthHub and AgencyAccess on token auto-refresh, Infisical audit logs, API/webhooks, intake, and plan caps—plus honest reasons to stay on AgencyAccess.",
  openGraphDescription:
    "Both have APIs. Compare token auto-refresh, Infisical audit logs, AuthHub Growth+ webhooks, intake parity, and plan caps ($29/$79/$149 vs $44/$99/$199)—plus when to stay on AgencyAccess.",

  competitor: {
    name: "AgencyAccess",
    tagline: "Client onboarding platform for marketing agencies",
    logo: "/images/competitors/agencyaccess-logo.png",
    website: "https://www.agencyaccess.co",
    pricing: {
      starting: 44,
      currency: "USD",
      billing: "monthly",
      starter: {
        price: 44,
        features: [
          "5 clients/month",
          "Up to 3 team members",
          "Email support weekdays",
          "All platforms",
          "Custom branding",
        ],
      },
      pro: {
        price: 99,
        features: [
          "15 clients/month",
          "Up to 10 team members",
          "Priority email + chat",
          "Zapier integration (Premium+)",
          "Static invite links",
        ],
      },
      enterprise: {
        price: "199",
        features: [
          "50 clients/month, then custom",
          "Unlimited team members",
          "Multiple brands",
          "24/7 chat support",
          "Public REST API + Zapier",
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
      "Clients-per-month caps (5 / 15 / 50)",
      "Automatic token refresh not advertised as primary",
      "Infisical-style vaulting and audit packaging not advertised",
    ],
    strengths: [
      "Broader niche platform coverage (HubSpot, YouTube Studio)",
      "Public REST API (X-Auth) plus Zapier on Premium+",
      "Built-in intake forms",
      "Custom branding and subdomain emphasis",
      "GDPR-oriented security framing",
      "30-day free trial",
      "24/7 chat support on Premium/Agency plans",
    ],
  },

  ourProduct: {
    name: "AuthHub",
    tagline: "Access + intake with token lifecycle automation",
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
          "One-link onboarding + intake fields",
          "Token auto-refresh (provider-supported)",
          "Audit logs",
          "Infisical-backed token references",
          `${AGENCYACCESS_COMPARE_AUTHHUB_PLATFORM_BREADTH} core connectors`,
          "AuthHub-branded client link",
          "US-based support (no same-day SLA)",
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
          "Token health monitoring",
          "Priority support",
        ],
      },
      enterprise: {
        price: "149",
        features: [
          "Everything in Pro",
          "Up to 50 active clients",
          "Multi-brand (3 brands)",
          "API + webhooks",
          "Priority support",
        ],
      },
    },
    differentiators: [
      "Automatic Token Refresh",
      "Infisical-backed Token Storage",
      "API + Webhooks on Growth+",
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
      "Shopify",
      `${AGENCYACCESS_COMPARE_AUTHHUB_PLATFORM_BREADTH} core connectors`,
    ],
  },

  excerpt:
    "Both AuthHub and AgencyAccess help agencies collect client ad- and analytics-platform permissions through a single branded link. Compare token auto-refresh, Infisical-backed storage with audit logs, API/webhooks, intake, and plan caps—plus honest reasons to stay on AgencyAccess when their platform breadth, trial, or support model fits better. Prices pre-tax from public list pages, checked September 24, 2026 (PT). Verify both vendors live before you buy.",

  content: "", // Rendered by template

  framework: "AIDA",

  painPoints: [
    {
      title: "Token ops / refresh",
      icon: "Clock",
      quote: "Expired tokens keep pulling us back into support threads mid-campaign.",
      description:
        "AuthHub monitors token health and automatically refreshes where the provider supports it. AgencyAccess uses official platform APIs and does not advertise automatic refresh as a primary story.",
      solution: "Provider-supported refresh before expiry with token health monitoring on Growth+.",
    },
    {
      title: "Security & audit",
      icon: "Shield",
      quote: "Enterprise clients ask for vaulting and audit trails—not just GDPR copy.",
      description:
        "AuthHub stores OAuth token references in Infisical and ships audit logs. AgencyAccess is GDPR-oriented and secure by design; it does not advertise Infisical-backed vaulting or the same audit packaging. AuthHub does not claim SOC 2 on this page.",
      solution: "Infisical-backed token references and audit logs (no SOC 2 claim).",
    },
    {
      title: "Automation (both have APIs)",
      icon: "Zap",
      quote: "We need more than Zapier—but both vendors publish APIs.",
      description:
        "AgencyAccess documents a public REST API (X-Auth) for clients and access requests, plus Zapier on higher plans. AuthHub offers API + webhooks from Growth (not Starter). Compare workflow depth and token lifecycle—not whether an API exists.",
      solution: "API + webhooks on AuthHub Growth and Scale; AgencyAccess API + Zapier on Premium+.",
    },
    {
      title: "Pricing, trial, support",
      icon: "DollarSign",
      quote: "Premium’s 15 clients/month wall hits faster than our onboarding pace.",
      description:
        "AuthHub: flat active-client tiers (5 / 20 / 50), 14-day trial, US-based support (no same-day SLA). AgencyAccess: clients-per-month (5 / 15 / 50), 30-day trial, 24/7 chat emphasis.",
      solution: "$29 / $79 / $149 monthly with 5 / 20 / 50 active clients; annual ~$24 / $66 / $124 on /pricing.",
    },
  ],

  quickComparison: [
    { feature: "One-link onboarding", competitor: true, authhub: true, winner: "tie" },
    { feature: "Client intake in flow", competitor: true, authhub: true, winner: "tie" },
    { feature: "Public API", competitor: "Yes (X-Auth)", authhub: "Growth+", winner: "tie" },
    { feature: "Automatic token refresh", competitor: "Not primary pitch", authhub: "Yes", winner: "authhub" },
    { feature: "Monthly list price", competitor: "$44/mo", authhub: "$29/mo", winner: "authhub" },
  ],

  detailedComparison: [
    {
      category: "Core onboarding",
      features: [
        { name: "One-link client onboarding", competitor: true, authhub: true },
        { name: "Client intake in the access flow", competitor: true, authhub: true, notes: "AuthHub: custom intake fields on templates" },
        { name: "Custom branding", competitor: "Premium+", authhub: "Growth+" },
        { name: "Custom subdomain / branded URL", competitor: "Strong AA emphasis", authhub: "Custom domain on Growth+" },
      ],
    },
    {
      category: "Token ops & security",
      features: [
        { name: "Automatic token refresh", competitor: "Not advertised as primary", authhub: "Yes (provider-supported)" },
        { name: "Token health monitoring", competitor: "Not the primary pitch", authhub: "Yes (Growth+)" },
        { name: "Token storage", competitor: "Secure platform OAuth; GDPR framing", authhub: "Infisical-backed references" },
        { name: "Audit logs", competitor: "Not Infisical-style packaging", authhub: "Yes" },
        { name: "SOC 2 claim", competitor: "—", authhub: "Not claimed on this page" },
      ],
    },
    {
      category: "Automation",
      features: [
        { name: "Public API", competitor: "Yes — REST (X-Auth)", authhub: "Yes — Growth + Scale" },
        { name: "Webhooks", competitor: "Confirm on AA docs/plans", authhub: "Yes on Growth + Scale" },
        { name: "Zapier", competitor: "Premium / Agency", authhub: "Not primary packaging" },
      ],
    },
    {
      category: "Pricing & limits",
      features: [
        { name: "Monthly list (primary)", competitor: "$44 / $99 / $199", authhub: "$29 / $79 / $149" },
        { name: "Annual effective (footnote)", competitor: "$33 / $74 / $149 per mo yearly", authhub: "$24 / $66 / $124 per mo yearly" },
        { name: "Caps", competitor: "5 / 15 / 50 clients/month", authhub: "5 / 20 / 50 active clients" },
        { name: "Team seats (public)", competitor: "Up to 3 / 10 / unlimited", authhub: "Unlimited on all plans" },
        { name: "API + webhooks", competitor: "Public API; Zapier Premium+", authhub: "Growth + Scale only" },
        { name: "Trial / support", competitor: "30 days; 24/7 chat emphasis", authhub: "14 days; US-based support, no same-day SLA" },
      ],
    },
    {
      category: "Platforms",
      features: [
        { name: "Meta (Facebook, Instagram)", competitor: true, authhub: true },
        { name: "Google Ads / Analytics / GTM", competitor: true, authhub: true },
        { name: "LinkedIn / TikTok Ads", competitor: true, authhub: true },
        { name: "Shopify", competitor: true, authhub: true },
        { name: "HubSpot", competitor: true, authhub: "Not a current highlight" },
        { name: "YouTube Studio", competitor: true, authhub: "Not a current highlight" },
        { name: "Published breadth", competitor: "Broader niche coverage", authhub: `${AGENCYACCESS_COMPARE_AUTHHUB_PLATFORM_BREADTH} core connectors` },
      ],
    },
  ],

  recommendations: {
    stickWithCompetitor: [
      "You need niches AuthHub does not highlight—especially HubSpot, YouTube Studio, or other long-tail connectors",
      "You want a 30-day trial and 24/7 chat",
      "You prefer their invite / clients-per-month model and team-seat packaging",
      "Branding / multi-language flows on AgencyAccess already fit",
      "Tokens are stable enough, vendor review does not need Infisical-style vaulting, and their API + Zapier cover automation",
    ],
    switchToAuthHub: [
      "Expired tokens and reconnect friction are costing campaigns—and you want automatic token refresh where providers allow it",
      "Vendor review needs Infisical-backed token references and audit logs (no SOC 2 claim)",
      "You want API + webhooks on Growth or Scale with flat 5 / 20 / 50 active-client caps",
      `Clients live primarily on AuthHub's ${AGENCYACCESS_COMPARE_AUTHHUB_PLATFORM_BREADTH} core set (Meta, Google Ads, GA4, LinkedIn, TikTok, related)`,
      "You want predictable monthly math without hitting Premium's 15 clients/month wall at ~20 onboardings",
    ],
  },

  migrationSteps: [
    {
      step: 1,
      title: "Inventory",
      description:
        "List active clients, platforms granted, and what must stay live. Neither SaaS moves existing platform permissions—they live in Meta, Google, LinkedIn, TikTok, and the other platforms.",
      icon: "Users",
    },
    {
      step: 2,
      title: "Dual-run",
      description:
        "Keep AgencyAccess for clients you are not ready to touch. Build AuthHub templates (intake + branding) for new onboardings and moves.",
      icon: "Globe",
    },
    {
      step: 3,
      title: "Re-authorize",
      description:
        "Clients managed in AuthHub must complete a fresh AuthHub authorization. AgencyAccess connections do not auto-port. Run both tools until token health looks right. No 15-minute migration and no free CS migration claim.",
      icon: "ArrowRight",
    },
  ],

  testimonials: [],

  pricingComparison: {
    competitor: {
      starting: 44,
      currency: "USD",
      billing: "monthly",
      starter: { price: 44, features: ["5 clients/month"] },
      pro: { price: 99, features: ["15 clients/month"] },
      enterprise: { price: "199", features: ["50 clients/month, then custom"] },
    },
    authhub: {
      starter: {
        price: 29,
        features: [
          "Up to 5 active clients",
          `${AGENCYACCESS_COMPARE_AUTHHUB_PLATFORM_BREADTH} core connectors`,
          "Automatic token refresh",
          "Audit logs",
          "Infisical-backed token references",
        ],
      },
      pro: {
        price: 79,
        features: [
          "Up to 20 active clients",
          "Full white-label + custom domain",
          "API + webhooks",
          "Token health monitoring",
        ],
      },
      enterprise: {
        price: "149",
        features: [
          "Up to 50 active clients",
          "Multi-brand (3 brands)",
          "API + webhooks",
        ],
      },
    },
    savings: {
      monthly: 15,
      yearly: 180,
      percentage: 34,
    },
  },

  competitorPricingSubtitle: "$44 · $99 · $199 monthly ($33 · $74 · $149 annual equiv.)",
  authhubSavingsHighlight:
    "~5 clients/mo: $44 − $29 = $15/mo vs AgencyAccess Starter (monthly list); verify live before you buy",
  valueCallout: {
    headline: "What is the difference between AuthHub and AgencyAccess?",
    body: "Both are one-link client access tools for marketing agencies. AuthHub emphasizes automatic OAuth token refresh, Infisical-backed token storage with audit logs, and API/webhooks on Growth and Scale plans at flat active-client caps ($29 / $79 / $149 for 5 / 20 / 50). AgencyAccess emphasizes broader platform coverage, invite-based plans, deep branding, and built-in intake, with its own public API and Zapier automation. Intake is not a monopoly—both include it.",
  },
  pricingScenarios: [
    {
      clients: "~5",
      competitorPlan: "Starter",
      competitorCost: "$44",
      authHubPlan: "Starter",
      authHubCost: "$29",
    },
    {
      clients: "~15",
      competitorPlan: "Premium",
      competitorCost: "$99",
      authHubPlan: "Growth",
      authHubCost: "$79",
    },
    {
      clients: "~20",
      competitorPlan: "Agency (Premium cap is 15/mo)",
      competitorCost: "$199",
      authHubPlan: "Growth",
      authHubCost: "$79",
    },
  ],
  pricingScenariosNote:
    "Worked examples use monthly list prices (pre-tax), checked September 24, 2026 (PT). AuthHub annual equivalents (~$24 / $66 / $124) are on /pricing. AgencyAccess annual ($33 / $74 / $149) shown as footnote on their pricing page. AgencyAccess FAQ copy may list Zapier on “Pro and Agency” while the pricing page shows Zapier on Premium+—this page follows agencyaccess.co/pricing. Verify both vendors live before you buy.",

  supplementalProse: {
    sharedJobLead:
      "Agency founders and ops leads share the same pain: chasing Meta Business Manager invites, Google Ads access, GA4, LinkedIn, TikTok, and the rest across email threads that stall campaigns.",
    sharedJobFollow:
      "AuthHub and AgencyAccess both solve that with official OAuth (or platform permission) flows behind one client link. The shared job is access onboarding. Decide on what happens after the first grant: token expiry, vaulting and audit, automation hooks, and how plan caps hit a busy month.",
    costMathDetail:
      "~5 clients/mo: $44 − $29 = $15/mo ($180/yr) if both monthly. Against AgencyAccess annual $33, AuthHub monthly $29 is $4/mo lower; both annualized (~$24 vs $33) is $9/mo. ~15 clients: $99 − $79 = $20/mo ($240/yr) both monthly. Against Premium annual $74, AuthHub monthly $79 is $5/mo higher; AuthHub annual ~$66 vs $74 is $8/mo lower. ~20 clients: AgencyAccess needs Agency $199 → $199 − $79 = $120/mo ($1,440/yr). Against Agency annual $149, AuthHub monthly $79 is $70/mo lower ($840/yr). AuthHub usually wins on predictable tiers once you cross Premium’s 15/month wall. AgencyAccess can still win on platform breadth, trial length, support hours, or volume inside Starter/Premium.",
    pricingSourcesNote:
      "Sources: authhub.co/pricing and agencyaccess.co/pricing, checked September 24, 2026 (PT).",
    stickWithClosing: "Staying is a valid outcome.",
    switchOptionalNote:
      "Optional: AuthHub also fits teams mixing humans and agents in access workflows—see OAuth token management for agencies (/blog/oauth-token-management-agencies). No MCP product-page claims here.",
  },

  aeoSections: [
    {
      headline: "Does AgencyAccess have an API?",
      body: "Yes. AgencyAccess documents a public API for creating and managing clients and access requests (API key via X-Auth). AuthHub also offers API and webhooks starting on Growth. The useful comparison is workflow depth and token lifecycle—not whether an API exists.",
    },
    {
      headline: "Who should switch from AgencyAccess to AuthHub?",
      body: "Switch (or dual-run) if expired tokens and reconnect friction are costing you campaigns, if vendor review needs Infisical-style vaulting and audit logs, or if you want AuthHub’s Growth-tier API/webhook packaging with predictable active-client tiers. Stay if you need AgencyAccess’s broader niche integrations, longer trial, or support model.",
    },
  ],

  faqs: [
    {
      question: "Does AgencyAccess have a public API, or only Zapier?",
      answer:
        "AgencyAccess has a public API for clients and access requests (X-Auth API key). Zapier is an additional path on Premium+ per their pricing page (some FAQ copy says Pro and Agency—confirm live). AuthHub offers API + webhooks on Growth and Scale. Zapier-only is outdated—do not use it as a switch reason.",
    },
    {
      question: "Do both tools include client intake?",
      answer:
        "Yes. AgencyAccess markets built-in intake. AuthHub request templates carry custom intake fields in the same flow. Intake is not an AuthHub-only advantage versus AgencyAccess.",
    },
    {
      question: "How does AuthHub pricing compare to AgencyAccess?",
      answer:
        "AuthHub monthly: $29 / $79 / $149 for 5 / 20 / 50 active clients (annual ~$24 / $66 / $124). AgencyAccess monthly: $44 / $99 / $199 for 5 / 15 / 50 clients/month (annual $33 / $74 / $149). See worked examples above; verify on ship day.",
    },
    {
      question: "How does AuthHub's automatic token refresh differ?",
      answer:
        "AuthHub monitors token health and refreshes before expiry where the provider supports it. AgencyAccess uses official platform APIs and does not advertise automatic refresh as a core differentiator. Confirm current behavior for your platforms.",
    },
    {
      question: "What security can AuthHub claim without SOC 2?",
      answer:
        "Infisical-backed token references and audit logs. We do not claim SOC 2 or SOC2-ready. AgencyAccess emphasizes GDPR and secure OAuth. Ask each vendor for the paperwork your clients require.",
    },
    {
      question: "Does AuthHub support every AgencyAccess platform?",
      answer: `No. AgencyAccess is broader on niches such as HubSpot and YouTube Studio. AuthHub focuses on ${AGENCYACCESS_COMPARE_AUTHHUB_PLATFORM_BREADTH} core connectors. Match both lists to your book of business.`,
    },
    {
      question: "Will switching break client access? Do I lose access if I cancel?",
      answer:
        "No to both. Existing permissions live in the platforms until the client or platform revokes them. Canceling either tool does not remove those grants by itself. Clients you move must re-authorize through AuthHub—dual-run if campaigns cannot wait. You may lose vendor-side monitoring, automation, and audit history.",
    },
    {
      question: "Which support model fits better?",
      answer:
        "AgencyAccess: 24/7 chat, 30-day trial. AuthHub: US-based support, 14-day trial—no same-day SLA claimed here.",
    },
  ],

  keywords: [
    "AgencyAccess alternative",
    "AuthHub vs AgencyAccess",
    "AgencyAccess vs AuthHub",
    "AgencyAccess pricing",
    "client access platform alternative",
    "agency onboarding software",
    "AgencyAccess competitor",
    "automatic token refresh",
    "Infisical audit logs",
  ],

  relatedComparisons: ["leadsie-alternative", "leadsie-pricing"],
  relatedBlogPosts: [
    "best-client-onboarding-software-agencies-2026",
    "oauth-token-management-agencies",
    "how-to-get-meta-ads-access-from-clients",
  ],

  cta: {
    headline: "Ready to decide with real numbers?",
    subheadline:
      "Start a 14-day free trial (no credit card), or compare AuthHub and AgencyAccess pricing tables live.",
    primaryButton: "Start 14 Day Free Trial",
    primaryLink: "/signup",
    secondaryButton: "AuthHub Pricing",
    secondaryLink: "/pricing",
    guarantee: "✓ $29/$79/$149 monthly tiers  ✓ 5/20/50 active clients  ✓ Dual-run + re-authorize migration",
  },

  isProgrammatic: true,
  templateId: "comparison-aida-v1",
  lastVerified: "2026-09-24",
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
  return [
    ...COMPARISON_PAGES.map((page) => page.slug),
    THREE_WAY_COMPARE_SLUG,
    LEADSIE_PRICING_SLUG,
  ];
}

/**
 * Get related comparison pages (for internal linking)
 */
export function getRelatedComparisons(currentSlug: string, limit = 3): ProgrammaticComparisonPage[] {
  return COMPARISON_PAGES.filter((page) => page.slug !== currentSlug).slice(0, limit);
}
