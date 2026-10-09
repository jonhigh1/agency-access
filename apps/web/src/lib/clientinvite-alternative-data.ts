/**
 * ClientInvite Alternative Comparison Page Data
 * Target keywords: "ClientInvite alternative", "ClientInvite vs AuthHub", "AuthHub vs ClientInvite"
 *
 * Prices verified 2026-10-01 (~09:40 PT) from public pricing pages.
 */

import type { ProgrammaticComparisonPage } from "./programmatic-types";

const CLIENTINVITE_COMPARE_AUTHHUB_PLATFORM_BREADTH = "15+";

export const FORBIDDEN_CLIENTINVITE_COMPARE_TESTIMONIAL_NAMES = [
  "Mike Torres",
  "Jennifer Walsh",
] as const;

export const clientInviteAlternativePage: ProgrammaticComparisonPage = {
  id: "clientinvite-alternative",
  slug: "clientinvite-alternative",
  title: "ClientInvite vs AuthHub: Which Client Access Tool Fits Your Agency?",
  metaTitle: "ClientInvite vs AuthHub: Which Client Access Tool Fits Your Agency?",
  metaDescription:
    "ClientInvite vs AuthHub for agencies: flat connections vs active-client tiers, platform coverage, and token refresh — with honest pick-X-if gates.",
  openGraphDescription:
    "ClientInvite vs AuthHub: monthly connections vs active clients, Shopify vs TikTok breadth, token refresh and Infisical audit — with pick-X-if gates. Prices checked October 1, 2026 (PT).",

  competitor: {
    name: "ClientInvite",
    tagline: "Flat-rate client access for marketing agencies",
    logo: "/images/competitors/clientinvite-logo.png",
    website: "https://clientinvite.com",
    pricing: {
      starting: 29,
      currency: "USD",
      billing: "monthly",
      starter: {
        price: 29,
        features: [
          "3 monthly connections",
          "Customizable branding",
          "Meta, Google, Shopify, LinkedIn",
          "14-day free trial (no card)",
        ],
      },
      pro: {
        price: 89,
        features: [
          "Unlimited monthly connections",
          "API & webhooks",
          "Customizable branding",
          "30-day money-back guarantee",
        ],
      },
      enterprise: {
        price: "89",
        features: [
          "Same Agency plan — unlimited connections",
          "Save ~20% on annual billing",
          "Official platform APIs",
        ],
      },
    },
    founded: "Unknown",
    location: "Unknown",
    platforms: [
      "Meta Ads",
      "Google Ads",
      "Google Analytics",
      "Shopify",
      "Shopify Partner",
      "LinkedIn",
    ],
    weaknesses: [
      "Monthly connection caps on Freelancer (3)",
      "Automatic token refresh not the primary public pitch",
      "Infisical-style vaulting and audit packaging not advertised",
      "Focused four-family platform story vs broader ad stacks",
    ],
    strengths: [
      "Unlimited connections on Agency ($89)",
      "Shopify Partner / collaborator emphasis",
      "Flat pricing (no credits)",
      "Branding on both Freelancer and Agency",
      "14-day trial and 30-day money-back",
      "API & webhooks on Agency",
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
          `${CLIENTINVITE_COMPARE_AUTHHUB_PLATFORM_BREADTH} core platforms`,
          "Unlimited team seats",
          "One-link onboarding",
          "Token auto-refresh (provider-supported)",
          "Audit logs",
          "Infisical-backed token references",
          "AuthHub-branded client link",
        ],
      },
      pro: {
        price: 79,
        features: [
          "Up to 20 active clients",
          "Full white-label + custom domain",
          "API + webhooks",
          "Token health monitoring",
          "Priority support",
        ],
      },
      enterprise: {
        price: "149",
        features: [
          "Up to 50 active clients",
          "Multi-brand (3 brands)",
          "API + webhooks",
          "Custom integrations emphasis",
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
      "Google Ads",
      "GA4",
      "LinkedIn Ads",
      "TikTok Ads",
      `${CLIENTINVITE_COMPARE_AUTHHUB_PLATFORM_BREADTH} core connectors`,
    ],
  },

  excerpt:
    "ClientInvite and AuthHub both help agencies collect client ad- and analytics-platform access through one branded link—no password sharing. This page is the honest binary: pricing units (monthly connections vs active clients), platform breadth, token ops, and security—including when ClientInvite is the better pick. Prices are pre-tax from public list pages, checked October 1, 2026 (~09:40 PT). Verify both vendors live before you buy.",

  content: "",

  framework: "AIDA",

  painPoints: [
    {
      title: "Pricing units",
      icon: "DollarSign",
      quote: "We onboard in bursts—but our roster stays large all month.",
      description:
        "ClientInvite meters monthly connections (each completed access link = one connection). AuthHub meters active clients on your roster. Same $29 entry sticker hides different caps: Freelancer resets at 3 connections; Starter allows 5 active clients.",
      solution:
        "Map onboard rate and roster size before you pick. Annual footnotes only: AuthHub ~$24 / $66 / $124; ClientInvite save ~20% on Agency.",
    },
    {
      title: "Platform breadth",
      icon: "Globe",
      quote: "We need TikTok and more than four platform families.",
      description:
        "ClientInvite’s live story is Meta, Google, Shopify, and LinkedIn—with Shopify Partner as a differentiator. AuthHub publishes honest 15+ connectors (featured Meta, Google Ads, GA4, LinkedIn, TikTok). Do not claim Leadsie’s full long-tail connector list; Shopify Partner is not claimed for AuthHub on this page.",
      solution: `${CLIENTINVITE_COMPARE_AUTHHUB_PLATFORM_BREADTH} core connectors with TikTok featured—match both lists to your book of business.`,
    },
    {
      title: "Token ops & security",
      icon: "Shield",
      quote: "Expired tokens and vendor review packets are eating our week.",
      description:
        "AuthHub emphasizes automatic token refresh where providers allow, Infisical-backed token references (/security), and audit logs—not SOC 2. ClientInvite uses official APIs, encrypted tokens, and GDPR/DPA language on their site; automatic refresh is not the primary public pitch.",
      solution: "Infisical + audit logs only (no SOC 2 claim). Do not promise permanent grants without in-platform checks.",
    },
    {
      title: "Automation",
      icon: "Zap",
      quote: "We need webhooks when a client finishes the link.",
      description:
        "ClientInvite includes API & webhooks on the Agency plan ($89). AuthHub offers API + webhooks on Growth and Scale—not Starter.",
      solution: "API + webhooks on ClientInvite Agency or AuthHub Growth+.",
    },
  ],

  quickComparison: [
    {
      feature: "Pricing unit",
      competitor: "Monthly connections",
      authhub: "Active clients",
      winner: "tie",
    },
    {
      feature: "Entry monthly price",
      competitor: "$29/mo (3 connections)",
      authhub: "$29/mo (5 active clients)",
      winner: "tie",
    },
    {
      feature: "Unlimited onboarding tier",
      competitor: "$89 Agency",
      authhub: "$149 Scale (50 active)",
      winner: "competitor",
    },
    {
      feature: "Automatic token refresh",
      competitor: "Not primary pitch",
      authhub: "Yes (provider-supported)",
      winner: "authhub",
    },
    {
      feature: "Shopify Partner emphasis",
      competitor: "Yes (differentiator)",
      authhub: "Not claimed here",
      winner: "competitor",
    },
  ],

  detailedComparison: [
    {
      category: "Core onboarding",
      features: [
        { name: "One-link client onboarding", competitor: true, authhub: true },
        { name: "Official OAuth / platform permissions", competitor: true, authhub: true },
        {
          name: "Custom branding",
          competitor: "Both plans",
          authhub: "Growth+ white-label / custom domain",
        },
        {
          name: "Auto-assign Meta users",
          competitor: "Published",
          authhub: "Confirm in current product UX",
        },
      ],
    },
    {
      category: "Platforms",
      features: [
        { name: "Meta (Facebook, Instagram, Pixel, etc.)", competitor: true, authhub: true },
        { name: "Google Ads / Analytics / related", competitor: true, authhub: true },
        { name: "LinkedIn", competitor: true, authhub: true },
        {
          name: "Shopify / Shopify Partner",
          competitor: "Yes — ClientInvite differentiator",
          authhub: "Shopify Partner not claimed on this page",
        },
        {
          name: "TikTok Ads",
          competitor: "Not primary four-family story",
          authhub: "Yes (featured)",
        },
        {
          name: "Published breadth",
          competitor: "Four families + more on request",
          authhub: `Honest ${CLIENTINVITE_COMPARE_AUTHHUB_PLATFORM_BREADTH}`,
        },
      ],
    },
    {
      category: "Token ops, security & automation",
      features: [
        {
          name: "Automatic token refresh",
          competitor: "Not the primary public pitch",
          authhub: "Yes — where provider supports refresh",
        },
        {
          name: "Token vault packaging",
          competitor: "Encrypted tokens; official APIs; GDPR/DPA on site",
          authhub: "Infisical-backed token references",
        },
        { name: "Audit logs", competitor: "Not Infisical-style packaging", authhub: "Yes" },
        { name: "SOC 2", competitor: "—", authhub: "Not claimed (Infisical + audit only)" },
        { name: "Public API / webhooks", competitor: "Agency plan", authhub: "Growth + Scale" },
      ],
    },
    {
      category: "Pricing & limits",
      features: [
        {
          name: "Monthly list (primary)",
          competitor: "Freelancer $29 · Agency $89",
          authhub: "$29 / $79 / $149",
        },
        {
          name: "Cap / unit",
          competitor: "3 connections · unlimited Agency",
          authhub: "5 / 20 / 50 active clients",
        },
        {
          name: "Hit the cap?",
          competitor: "Wait for next cycle or upgrade",
          authhub: "Upgrade tier for higher active-client band",
        },
        {
          name: "Trial / guarantee",
          competitor: "14-day trial · 30-day money-back",
          authhub: "14-day trial (no card)",
        },
        {
          name: "Annual footnote",
          competitor: "Save ~20% (Agency ~$71/mo on calculator)",
          authhub: "~$24 / $66 / $124/mo equiv. on /pricing",
        },
      ],
    },
  ],

  recommendations: {
    stickWithCompetitor: [
      "You are Shopify-heavy (ecommerce / Shopify Partner collaborator access is a deciding factor)",
      "You want unlimited monthly connections at a predictable $89 Agency flat",
      "Your stack is mostly Meta / Google / Shopify / LinkedIn",
      "You like Freelancer branding at $29 with a 3-connection starter cap",
      "You want ClientInvite’s 30-day money-back alongside the 14-day trial",
    ],
    switchToAuthHub: [
      "You need TikTok and a broader ad stack beyond ClientInvite’s four live families—honest 15+, not every Leadsie niche connector",
      "Expired tokens and reconnect friction hurt campaigns—and you want automatic token refresh where providers allow",
      "Vendor review needs Infisical-backed token references and audit logs (AuthHub is not SOC 2–certified)",
      "You prefer capacity priced by active clients (5 / 20 / 50) rather than monthly connection quotas",
      "You want API + webhooks on Growth or Scale with white-label / custom domain packaging",
      "Your team mixes humans and AI agents on the same access path—see MCP OAuth blog (soft-link only)",
    ],
  },

  migrationSteps: [
    {
      step: 1,
      title: "Inventory",
      description:
        "List active clients, platforms granted, and what must stay live this week. Neither SaaS moves existing platform permissions.",
      icon: "Users",
    },
    {
      step: 2,
      title: "Dual-run",
      description:
        "Keep ClientInvite for clients you are not ready to touch. Build AuthHub templates (platforms + branding + intake fields) for new onboardings and moves.",
      icon: "Globe",
    },
    {
      step: 3,
      title: "Re-authorize",
      description:
        "Clients you manage in AuthHub must complete a fresh AuthHub authorization. ClientInvite connections do not auto-port. Run both until token health and campaign coverage look right. No free CS migration promise.",
      icon: "ArrowRight",
    },
  ],

  testimonials: [],

  pricingComparison: {
    competitor: {
      starting: 29,
      currency: "USD",
      billing: "monthly",
      starter: { price: 29, features: ["3 monthly connections"] },
      pro: { price: 89, features: ["Unlimited monthly connections", "API & webhooks"] },
      enterprise: { price: "89", features: ["Agency plan — unlimited connections"] },
    },
    authhub: {
      starter: {
        price: 29,
        features: [
          "Up to 5 active clients",
          `${CLIENTINVITE_COMPARE_AUTHHUB_PLATFORM_BREADTH} core connectors`,
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
        ],
      },
      enterprise: {
        price: "149",
        features: ["Up to 50 active clients", "Multi-brand", "API + webhooks"],
      },
    },
    savings: {
      monthly: 0,
      yearly: 0,
    },
  },

  competitorPricingSubtitle: "Freelancer $29 (3 connections) · Agency $89 unlimited",
  authhubSavingsHighlight:
    "~3 new onboards/mo: both list at $29—compare connection cap vs 5 active clients before you buy",
  valueCallout: {
    headline: "Unit mismatch (read this first)",
    body: "ClientInvite meters monthly connections (each completed access link = one connection). AuthHub meters active clients on your roster. Leadsie (if you are leaving credits) meters onboard/audit credits. Do not collapse these into one fake meter.",
  },

  pricingScenarios: [
    {
      clients: "~3 new onboards/mo",
      competitorPlan: "Freelancer",
      competitorCost: "$29",
      authHubPlan: "Starter",
      authHubCost: "$29",
    },
    {
      clients: "~6–10 new onboards/mo",
      competitorPlan: "Agency (unlimited connections)",
      competitorCost: "$89",
      authHubPlan: "Growth",
      authHubCost: "$79",
    },
    {
      clients: "High volume / burst",
      competitorPlan: "Agency",
      competitorCost: "$89 flat",
      authHubPlan: "Scale",
      authHubCost: "$149",
    },
  ],
  pricingScenariosNote:
    "Monthly list prices primary (pre-tax), checked October 1, 2026 (~09:40 PT). Scenario B delta: $89 − $79 = $10/mo if both fit—but units differ. Sources: clientinvite.com/pricing and authhub.co/pricing. Verify live before you buy.",

  supplementalProse: {
    sharedJobLead:
      "ClientInvite owns much of the flat pricing, no credits / best-Leadsie-alternative narrative. AuthHub already ships Leadsie and AgencyAccess compares—but until this page, there was no dedicated ClientInvite ↔ AuthHub URL.",
    sharedJobFollow:
      "This page is for founders and ops leads comparing the two (or evaluating ClientInvite after a Leadsie credit invoice). Promise: live math with honest pick-X-if gates.",
    costMathDetail:
      "Scenario A: same $29 sticker—Freelancer at the 3-connection cap vs Starter with 5 active clients (room for roster growth). Scenario B: Agency $89 unlimited connections vs Growth $79 for 20 active clients—bursty onboards favor ClientInvite; large steady rosters favor AuthHub if platforms and token ops fit. Scenario C: leaving Leadsie packs? Both are flat alternatives with different units—see Leadsie alternative and flat-rate vs credit pricing (soft-links).",
    pricingSourcesNote:
      "Sources: clientinvite.com/pricing and authhub.co/pricing, checked October 1, 2026 (~09:40 PT).",
    stickWithClosing: "Those are fair wins. This page is not a binary ad.",
    switchOptionalNote:
      "Many agencies dual-run during a switch because access ultimately lives in the ad platforms. Deeper token ops: OAuth token management for agencies (/blog/oauth-token-management-agencies).",
  },

  aeoSections: [
    {
      headline: "What is the difference between ClientInvite and AuthHub?",
      body: "Both help marketing agencies collect client access to ad and analytics platforms through one branded link using official OAuth flows—no password sharing. ClientInvite focuses on Meta, Google, Shopify, and LinkedIn with flat monthly plans (Freelancer $29 for 3 monthly connections, Agency $89 unlimited, as of October 1, 2026 PT public pricing). AuthHub uses tiered flat pricing by active clients ($29 / $79 / $149 for 5 / 20 / 50) and emphasizes broader platform coverage (honest 15+), automatic token refresh, and Infisical-backed storage with audit logs. Re-fetch each vendor’s pricing page before you decide.",
    },
    {
      headline: "Is ClientInvite a good AuthHub alternative (or vice versa)?",
      body: "ClientInvite is a strong fit if your stack is Meta/Google/Shopify/LinkedIn, you want unlimited monthly connections at $89, and Shopify Partner access matters. AuthHub is a stronger fit if you need more than those four platform families, want automatic OAuth token refresh plus Infisical and audit logs (AuthHub is not SOC 2–certified), or prefer capacity priced by active clients rather than monthly connection quotas. Many agencies dual-run during a switch because access ultimately lives in the ad platforms.",
    },
    {
      headline: "ClientInvite vs AuthHub — which should agencies pick?",
      body: "Pick ClientInvite for Shopify-heavy work and predictable unlimited onboarding on the Agency plan ($89/mo as of October 1, 2026 PT). Pick AuthHub when token health, auditability, and wider ad-platform coverage (honest 15+) matter more than a single unlimited-connections tier. If you are still on Leadsie credits, read a flat-vs-credit pricing explainer and a Leadsie alternative compare before you shortlist—re-check clientinvite.com/pricing and authhub.co/pricing on the day you buy.",
    },
  ],

  faqs: [
    {
      question: "How do the pricing caps differ?",
      answer:
        "ClientInvite: Freelancer 3 monthly connections; Agency unlimited (one completed link = one connection). AuthHub: 5 / 20 / 50 active clients. Map both your onboard rate and roster size.",
    },
    {
      question: "Does AuthHub support Shopify Partner access like ClientInvite?",
      answer:
        "ClientInvite markets Shopify Partner / collaborator-style access as a differentiator. AuthHub does not claim Shopify Partner on this page. Match both platform lists before you switch.",
    },
    {
      question: "What security can AuthHub claim without SOC 2?",
      answer:
        "Infisical-backed token references and audit logs only (/security)—no SOC 2 claim. ClientInvite emphasizes official APIs, encryption, and GDPR/DPA language. Compare paperwork, not slogans.",
    },
    {
      question: "Will switching break live campaigns?",
      answer:
        "Dual-run. Platform permissions stay until revoked in-platform. Moved clients must re-authorize in AuthHub. You may lose vendor-side monitoring, automation, and audit history for the tool you stop. Grants are not permanent—confirm revocation behavior in each ad platform.",
    },
    {
      question: "When should I look at Leadsie or AgencyAccess instead?",
      answer:
        "Credit + audit-heavy volume → Leadsie alternative and Leadsie pricing. Broader niche integrations → AgencyAccess alternative. Three-way shortlist → Leadsie vs AgencyAccess vs AuthHub. Roundup context → Best Leadsie alternatives 2026.",
    },
  ],

  keywords: [
    "ClientInvite alternative",
    "ClientInvite vs AuthHub",
    "AuthHub vs ClientInvite",
    "client access tool agencies",
    "flat connections pricing",
    "Shopify Partner client access",
    "automatic token refresh",
    "Infisical audit logs",
  ],

  relatedComparisons: [
    "leadsie-alternative",
    "leadsie-pricing",
    "agencyaccess-alternative",
  ],
  relatedBlogPosts: [
    "best-leadsie-alternatives-2026",
    "flat-rate-vs-credit-pricing",
    "oauth-token-management-agencies",
    "mcp-oauth-client-access-agencies",
    "best-client-onboarding-software-agencies-2026",
  ],

  cta: {
    headline: "Ready to compare with live numbers?",
    subheadline:
      "Start a 14-day free trial (no credit card), or open AuthHub pricing. Still on Leadsie credits? See the Leadsie alternative compare and flat-rate vs credit explainer.",
    primaryButton: "Start 14 Day Free Trial",
    primaryLink: "/signup",
    secondaryButton: "AuthHub Pricing",
    secondaryLink: "/pricing",
    guarantee:
      "✓ $29/$79/$149 monthly tiers  ✓ 5/20/50 active clients  ✓ Dual-run + re-authorize migration",
  },

  isProgrammatic: true,
  templateId: "comparison-aida-v1",
  lastVerified: "2026-10-01",
};
