/**
 * Three-way comparison: Leadsie vs AgencyAccess vs AuthHub
 * Target URL: /compare/leadsie-vs-agencyaccess-vs-authhub
 * Verified against public pricing pages: 2026-09-24 (PT)
 */

import type { ProgrammaticThreeWayComparisonPage } from "./programmatic-types";

export const THREE_WAY_COMPARE_SLUG = "leadsie-vs-agencyaccess-vs-authhub";

/** Cleared testimonial names — must not appear on the three-way compare page */
export const FORBIDDEN_THREE_WAY_COMPARE_TESTIMONIAL_NAMES = [
  "Mike Torres",
  "Jennifer Walsh",
  "David Park",
  "Sarah Mitchell",
] as const;

const AUTHHUB_PLATFORM_BREADTH = "15+";

export const leadsieVsAgencyAccessVsAuthHubPage: ProgrammaticThreeWayComparisonPage = {
  id: "leadsie-vs-agencyaccess-vs-authhub",
  slug: THREE_WAY_COMPARE_SLUG,
  title: "Leadsie vs AgencyAccess vs AuthHub (2026): Credits, Caps, and Token Refresh",
  metaTitle: "Leadsie vs AgencyAccess vs AuthHub (2026): Credits, Caps, and Token Refresh",
  metaDescription:
    'Compare Leadsie, AgencyAccess, and AuthHub on credits vs flat caps, intake, platforms, API, and automatic token refresh—with honest "pick X if…" gates.',
  openGraphDescription:
    "Three-way buyer guide: Leadsie credits, AgencyAccess invite caps, AuthHub token refresh + Infisical audit. Worked monthly math and honest pick-X-if gates. Verify prices live.",

  excerpt:
    "Leadsie, AgencyAccess, and AuthHub all help agencies collect client ad- and analytics-platform access through a branded link. This three-way ranks them on pricing model (credits vs invite caps vs active-client tiers), token refresh, security & audit, intake + branding, and platforms + automation—with honest “pick X if…” gates and worked monthly math. Prices are pre-tax from public list pages, checked September 24, 2026 (PT). Verify all three vendors live before you buy.",

  sharedJobLead:
    "Agency founders and ops leads share the same pain: chasing Meta Business Manager invites, Google Ads access, GA4, LinkedIn, TikTok, and the rest across email threads that stall campaigns.",
  sharedJobFollow:
    "All three tools replace password-chasing with a client-facing authorization link that uses each platform’s official permission flow. None invented one-link access alone. The shared job is access onboarding. Decide on what happens after the first grant: how you pay when volume spikes, whether tokens stay healthy, what vaulting and audit look like for vendor review, whether intake lives in the same link, and how API/webhooks fit your stack.",

  decisionAxes: [
    {
      title: "Pricing model & caps",
      body: "Leadsie onboarding credits + overages; AgencyAccess clients/invites per month; AuthHub active-client flat tiers (5 / 20 / 50).",
    },
    {
      title: "Token ops / refresh",
      body: "AuthHub automatic refresh where providers support it; competitors do not advertise the same primary story (no invented expiry SLAs).",
    },
    {
      title: "Security & audit",
      body: "AuthHub: Infisical-backed token references + audit logs. No SOC 2 claim. Competitors: GDPR / secure-OAuth framing without Infisical packaging.",
    },
    {
      title: "Intake + branding",
      body: "AuthHub and AgencyAccess both include intake in the access flow (parity — no exclusive-intake). Leadsie is access-first; intake is often separate.",
    },
    {
      title: "Platforms + automation",
      body: `AuthHub honest ${AUTHHUB_PLATFORM_BREADTH} core connectors. Leadsie and AgencyAccess are broader on niches. All three offer automation paths—compare depth and token lifecycle, not “who has an API.”`,
    },
  ],

  tableCategories: [
    {
      category: "Pricing & limits",
      intro:
        "Units differ. Leadsie sells onboarding credits (plus audit/view-only credits and $50 overage packs). AgencyAccess sells clients per month. AuthHub sells active clients on fixed monthly tiers (5 / 20 / 50 caps on every plan). AgencyAccess Premium is 15 clients/month (not an unlimited-invite tier).",
      rows: [
        {
          feature: "Model",
          leadsie: "Credits + overages",
          agencyAccess: "Clients / invites per month",
          authhub: "Flat active-client tiers",
        },
        {
          feature: "Monthly list (primary)",
          leadsie: "$59 / $129 / $299",
          agencyAccess: "$44 / $99 / $199",
          authhub: "$29 / $79 / $149",
        },
        {
          feature: "Caps",
          leadsie: "3 / 10 / 50 onboarding credits (+ audit 10 / 50 / 250)",
          agencyAccess: "5 / 15 / 50 clients/month (Agency: 50 then custom)",
          authhub: "5 / 20 / 50 active clients",
        },
        {
          feature: "Overage / over-cap",
          leadsie: "$50 packs (plan-dependent mix)",
          agencyAccess: "Wait for cycle reset or upgrade",
          authhub: "Upgrade tier when active clients exceed plan",
        },
        {
          feature: "Annual effective (footnote)",
          leadsie: "Yearly billing available (e.g. Starter ~$49/mo on annual display)",
          agencyAccess: "$33 / $74 / $149/mo",
          authhub: "~$24 / $66 / $124/mo equiv.",
        },
        {
          feature: "Trial",
          leadsie: "14-day (extend until first onboard per their FAQ)",
          agencyAccess: "30 days",
          authhub: "14 days",
        },
        {
          feature: "API / webhooks",
          leadsie: "Webhooks on Agency / Pro",
          agencyAccess: "Public API + Zapier on Premium+",
          authhub: "API + webhooks from Growth+",
        },
      ],
    },
    {
      category: "Token ops & security",
      intro: "Do not invent competitor token-expiry SLAs.",
      rows: [
        {
          feature: "Automatic token refresh",
          leadsie: "Not advertised as primary",
          agencyAccess: "Not advertised as primary",
          authhub: "Yes — provider-supported refresh before expiry",
        },
        {
          feature: "Token health monitoring",
          leadsie: "Not the primary pitch",
          agencyAccess: "Not the primary pitch",
          authhub: "Yes (Growth+)",
        },
        {
          feature: "Token storage",
          leadsie: "Encrypted / secure OAuth framing",
          agencyAccess: "Secure platform OAuth; GDPR framing",
          authhub: "Infisical-backed token references",
        },
        {
          feature: "Audit logs",
          leadsie: "Available (confirm on plan)",
          agencyAccess: "Not Infisical-style packaging",
          authhub: "Yes",
        },
        {
          feature: "SOC 2 claim",
          leadsie: "—",
          agencyAccess: "—",
          authhub: "Not claimed on this page",
        },
      ],
    },
    {
      category: "Intake & branding",
      intro:
        "Intake parity: AuthHub and AgencyAccess both include intake in-flow—not an AuthHub-only advantage versus AgencyAccess.",
      rows: [
        {
          feature: "Client intake in the access flow",
          leadsie: "Access-first; intake often separate",
          agencyAccess: "Yes",
          authhub: "Yes — custom intake fields on request templates",
        },
        {
          feature: "Custom branding",
          leadsie: "Logo/colors; whitelabel / embed on Agency+",
          agencyAccess: "Strong emphasis (Premium+)",
          authhub: "White-label / custom domain on Growth+",
        },
        {
          feature: "Multi-brand",
          leadsie: "Pro (up to 3 brands)",
          agencyAccess: "Confirm on plan",
          authhub: "Scale (up to 3 brands)",
        },
      ],
    },
    {
      category: "Platforms",
      intro: `AuthHub publishes ${AUTHHUB_PLATFORM_BREADTH} core connectors—featured Meta, Google Ads, GA4, LinkedIn, TikTok. Leadsie and AgencyAccess are broader on niches AuthHub does not highlight. No full-parity claim.`,
      rows: [
        {
          feature: "Meta / Google Ads / LinkedIn / TikTok",
          leadsie: true,
          agencyAccess: true,
          authhub: true,
        },
        {
          feature: "Shopify / commerce",
          leadsie: true,
          agencyAccess: true,
          authhub: "Yes (core set)",
        },
        {
          feature: "WordPress / YouTube",
          leadsie: "Yes (typical Leadsie list)",
          agencyAccess: "YouTube Studio highlighted",
          authhub: "Not AuthHub highlights",
        },
        {
          feature: "HubSpot",
          leadsie: "Check current list",
          agencyAccess: "Yes",
          authhub: "Not a current AuthHub highlight",
        },
        {
          feature: "Published breadth",
          leadsie: "Broader (~31+ marketing)",
          agencyAccess: "Broader niches",
          authhub: `${AUTHHUB_PLATFORM_BREADTH} core`,
        },
        {
          feature: "Specialty",
          leadsie: "Access Detective, Meta asset creation, audits",
          agencyAccess: "Deep branding / niches",
          authhub: "Token health + Infisical/audit",
        },
      ],
    },
    {
      category: "Automation",
      rows: [
        {
          feature: "Public API",
          leadsie: "Higher / custom packaging (confirm live)",
          agencyAccess: "Yes — REST (X-Auth)",
          authhub: "Yes — Growth + Scale",
        },
        {
          feature: "Webhooks",
          leadsie: "Agency / Pro",
          agencyAccess: "Confirm on docs; Zapier on Premium+",
          authhub: "Yes on Growth + Scale",
        },
        {
          feature: "Zapier",
          leadsie: "—",
          agencyAccess: "Yes on Premium / Agency",
          authhub: "Not AuthHub’s primary packaging",
        },
      ],
    },
  ],

  costScenarios: [
    {
      headline: "~5 new clients / month",
      rows: [
        {
          vendor: "AuthHub",
          plan: "Starter",
          monthly: "$29",
          capFit: "5 active clients",
        },
        {
          vendor: "AgencyAccess",
          plan: "Starter",
          monthly: "$44",
          capFit: "5 clients/month",
        },
        {
          vendor: "Leadsie",
          plan: "Starter + 1 overage pack",
          monthly: "$59 + $50 = $109",
          capFit: "Starter = 3 credits; pack adds 3 → covers 5",
        },
      ],
      deltas:
        "AuthHub vs AgencyAccess = $15/mo ($180/yr). AuthHub vs Leadsie (with pack) = $80/mo ($960/yr). Inside Leadsie’s 3-credit Starter alone, Leadsie is still $30/mo above AuthHub ($59 − $29). Against AgencyAccess annual $33, AuthHub monthly $29 is $4/mo lower.",
    },
    {
      headline: "~15–20 new clients / month",
      rows: [
        {
          vendor: "AuthHub (~15)",
          plan: "Growth",
          monthly: "$79",
          capFit: "20 active",
        },
        {
          vendor: "AgencyAccess (~15)",
          plan: "Premium",
          monthly: "$99",
          capFit: "15/month",
        },
        {
          vendor: "Leadsie (~15)",
          plan: "Agency + 1 pack",
          monthly: "$129 + $50 = $179",
          capFit: "10 + 5 credits",
        },
        {
          vendor: "AuthHub (~20)",
          plan: "Growth",
          monthly: "$79",
          capFit: "Still fits",
        },
        {
          vendor: "AgencyAccess (~20)",
          plan: "Agency",
          monthly: "$199",
          capFit: "Premium’s 15 not enough",
        },
        {
          vendor: "Leadsie (~20)",
          plan: "Agency + 2 packs",
          monthly: "$129 + $100 = $229",
          capFit: "10 + 10 credits",
        },
      ],
      deltas:
        "At ~15, AgencyAccess − AuthHub = $20/mo ($240/yr); Leadsie − AuthHub = $100/mo ($1,200/yr). At ~20, AgencyAccess − AuthHub = $120/mo ($1,440/yr); Leadsie − AuthHub = $150/mo ($1,800/yr). Against Premium annual $74, AuthHub monthly $79 is $5/mo higher; AuthHub annual ~$66 vs $74 is $8/mo lower.",
    },
  ],

  costMathClosing:
    "AuthHub usually wins on predictable tiers once you cross Premium’s 15/month wall or Leadsie credit packs. Competitors can still win on platform breadth, trial length, audits, or branding.",

  pickSections: [
    {
      vendor: "Leadsie",
      bullets: [
        "You need the broadest platform set or prospect audit / view-only workflows at volume",
        "Access Detective, Meta asset creation, or GoHighLevel-adjacent habits are core",
        "You are comfortable with credits, rollover, and $50 overage packs",
        "Leadsie’s established workflow and support model already fit",
      ],
      closing: "Staying on Leadsie is a valid outcome.",
    },
    {
      vendor: "AgencyAccess",
      bullets: [
        "You want their intake + deep branding and prefer invite / clients-per-month caps",
        `You need niches outside AuthHub’s ${AUTHHUB_PLATFORM_BREADTH} (notably HubSpot, YouTube Studio)`,
        "A 30-day trial and 24/7 chat matter more than AuthHub’s 14-day / US-based support",
        "Their API + Zapier cover automation and tokens are stable enough without Infisical-style vaulting",
      ],
      closing: "Staying on AgencyAccess is a valid outcome.",
    },
    {
      vendor: "AuthHub",
      bullets: [
        "Expired tokens and reconnect friction are the pain—and you want automatic token refresh where providers allow it",
        "Vendor review needs Infisical-backed token references and audit logs (no SOC 2 claim)",
        "You want API + webhooks from Growth with predictable caps ($29 / $79 / $149 for 5 / 20 / 50)",
        `You want white-label one-link + intake without credit overages—and clients live on AuthHub’s ${AUTHHUB_PLATFORM_BREADTH} core set (Meta, Google Ads, GA4, LinkedIn, TikTok, related)`,
      ],
      closing:
        "Optional: AuthHub also fits teams mixing humans and agents in access workflows—see OAuth token management for agencies (/blog/oauth-token-management-agencies). No MCP product-page claims here.",
    },
  ],

  migrationSteps: [
    {
      step: 1,
      title: "Inventory",
      description:
        "List active clients, platforms granted, and what must stay live.",
      icon: "Users",
    },
    {
      step: 2,
      title: "Dual-run",
      description:
        "Keep your current tool for clients you are not ready to touch. Build the new tool’s templates for new onboardings and moves.",
      icon: "Globe",
    },
    {
      step: 3,
      title: "Re-authorize",
      description:
        "Clients managed in the new tool must complete a fresh authorization through that tool’s link. Run both until token health looks right. No quick migration promises and no free CS migration claim.",
      icon: "ArrowRight",
    },
  ],

  aeoSections: [
    {
      headline: "What is the difference between Leadsie, AgencyAccess, and AuthHub?",
      body: "All three help marketing agencies collect client platform access through a branded link. Leadsie is the established credit-based access tool with broad platform coverage and audit-oriented workflows. AgencyAccess competes with built-in intake, deeper branding, invite-based plans, and a longer trial. AuthHub competes on automatic OAuth token refresh, Infisical-backed token storage with audit logs, in-link intake, and flat active-client tiers at $29 / $79 / $149 for 5 / 20 / 50 clients, with API and webhooks from Growth up.",
    },
    {
      headline: "Does AgencyAccess have an API?",
      body: "Yes. AgencyAccess documents a public API for creating and managing clients and access requests (API key via X-Auth). AuthHub offers API and webhooks starting on Growth. Leadsie offers webhooks on higher plans. Compare workflow depth and token lifecycle—not whether an API exists.",
    },
    {
      headline: "Is AgencyAccess or Leadsie better—and where does AuthHub fit?",
      body: "Choose Leadsie if you want maximum platform breadth, prospect audits, or GoHighLevel-native workflows and are comfortable with credits and overages. Choose AgencyAccess if intake-in-link, branding depth, niche integrations, or a 30-day trial matter most. Choose AuthHub if expired-token reconnects are the pain, you need Infisical-style vaulting and audit logs for vendor review, or you want predictable active-client caps with Growth-tier API/webhooks.",
    },
  ],

  faqs: [
    {
      question: "What is the difference between Leadsie, AgencyAccess, and AuthHub?",
      answer:
        "All three help marketing agencies collect client platform access through a branded link. Leadsie is the established credit-based access tool with broad platform coverage and audit-oriented workflows. AgencyAccess competes with built-in intake, deeper branding, invite-based plans, and a longer trial. AuthHub competes on automatic OAuth token refresh, Infisical-backed token storage with audit logs, in-link intake, and flat active-client tiers at $29 / $79 / $149 for 5 / 20 / 50 clients, with API and webhooks from Growth up.",
    },
    {
      question: "How do credits vs flat caps vs active-client tiers differ?",
      answer:
        "Leadsie charges one onboarding credit per new client that grants manager/admin access, with separate audit credits and $50 overage packs. AgencyAccess meters clients per month (5 / 15 / 50). AuthHub meters active clients on fixed tiers (5 / 20 / 50) at $29 / $79 / $149 monthly. See worked examples above.",
    },
    {
      question: "Does AgencyAccess have an API, or only Zapier?",
      answer:
        "AgencyAccess has a public API for clients and access requests (X-Auth). Zapier is an additional path on higher plans. AuthHub offers API + webhooks on Growth and Scale. Leadsie offers webhooks on Agency / Pro. Compare workflow depth and token lifecycle—not whether an API exists.",
    },
    {
      question: "Who has built-in intake?",
      answer:
        "AuthHub and AgencyAccess both include client intake in the access flow. Leadsie is typically access-first. Intake is not an AuthHub exclusive versus AgencyAccess.",
    },
    {
      question: "Does AuthHub have SOC 2?",
      answer:
        "No SOC 2 claim on this page. AuthHub stores OAuth token references in Infisical and ships audit logs. Ask each vendor for the paperwork your clients require.",
    },
    {
      question: "Do I lose platform access if I cancel?",
      answer:
        "Generally no. Permissions live in the platforms until the client or platform revokes them. You may lose vendor-side monitoring, automation, and audit history. Clients you move must re-authorize through the new tool.",
    },
    {
      question: "Which binary page should I read next?",
      answer:
        "AuthHub vs Leadsie (/compare/leadsie-alternative), Leadsie pricing deep-dive (/compare/leadsie-pricing), AuthHub vs AgencyAccess (/compare/agencyaccess-alternative). Older overview: /blog/leadsie-vs-authhub-comparison (superseded by this compare page).",
    },
  ],

  cta: {
    headline: "Ready to decide with real numbers?",
    subheadline:
      "Start a 14-day free trial (no credit card), or go straight to the tables.",
    primaryButton: "Start 14 Day Free Trial",
    primaryLink: "/signup",
    secondaryButton: "AuthHub Pricing",
    secondaryLink: "/pricing",
    guarantee: "✓ $29/$79/$149 monthly tiers  ✓ 5/20/50 active clients  ✓ Dual-run + re-authorize migration",
  },

  heroLinks: [
    { label: "AuthHub vs Leadsie", href: "/compare/leadsie-alternative" },
    { label: "AuthHub vs AgencyAccess", href: "/compare/agencyaccess-alternative" },
    { label: "Leadsie pricing deep-dive", href: "/compare/leadsie-pricing" },
  ],

  keywords: [
    "leadsie vs agencyaccess",
    "leadsie vs agencyaccess vs authhub",
    "authhub vs leadsie vs agencyaccess",
    "client oauth platform comparison",
    "agencyaccess vs leadsie",
    "best client access tool for agencies",
    "automatic token refresh",
    "Infisical audit logs",
  ],

  relatedComparisons: ["leadsie-alternative", "agencyaccess-alternative", "leadsie-pricing"],
  relatedBlogPosts: [
    "best-client-onboarding-software-agencies-2026",
    "oauth-token-management-agencies",
    "flat-rate-vs-credit-pricing",
  ],

  lastVerified: "2026-09-24",

  pricingSourcesNote:
    "Sources: leadsie.com/pricing, help.leadsie.com/article/96-leadsie-pricing (updated July 1, 2026), agencyaccess.co/pricing, authhub.co/pricing — checked September 24, 2026 (PT).",
};

export function getThreeWayComparisonPage(): ProgrammaticThreeWayComparisonPage {
  return leadsieVsAgencyAccessVsAuthHubPage;
}

export function isThreeWayComparisonSlug(slug: string): boolean {
  return slug === THREE_WAY_COMPARE_SLUG;
}
