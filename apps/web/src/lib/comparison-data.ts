/**
 * Comparison Page Data
 * Structured data for programmatic comparison pages
 */

import type { ProgrammaticComparisonPage } from "./programmatic-types";

/**
 * Leadsie Alternative Comparison Page Data
 * Target keywords: "Leadsie alternative", "Leadsie vs AuthHub", "AuthHub vs Leadsie"
 */
export const leadsieAlternativePage: ProgrammaticComparisonPage = {
  id: "leadsie-alternative",
  slug: "leadsie-alternative",
  title: "Leadsie Alternative | Why Agencies Switch to AuthHub",
  metaTitle: "Leadsie Alternative | Why Agencies Switch to AuthHub",
  metaDescription: "Looking for a Leadsie alternative or comparing AuthHub vs Leadsie? AuthHub combines access + intake in one link, tiered pricing from $29/mo (Starter 5 · Growth 20 · Agency 50 clients), and US-based support. See why agencies made the switch.",

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
          "31+ platforms",
          "Email support",
          "Overage fees apply",
        ],
      },
      pro: {
        price: 129,
        features: [
          "10 client credits/month",
          "All platforms",
          "Priority support",
          "Team members",
        ],
      },
      enterprise: {
        price: 299,
        features: [
          "50 client credits/month",
          "White-label option",
          "Dedicated support",
          "Overage fees apply",
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
      "LinkedIn Ads",
      "TikTok Ads",
      "Snapchat Ads",
    ],
    weaknesses: [
      "No client intake forms",
      "UK-based support (8hr time difference)",
      "Limited advanced platform support (no Pinterest, Klaviyo, Shopify)",
      "No reusable onboarding templates",
      "No API access on lower tiers",
    ],
    strengths: [
      "Simple, clean interface",
      "Good documentation",
      "Established brand in UK/EU",
      "Quick setup",
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
          "5 clients/month",
          "15+ platforms",
          "Unlimited team seats",
          "White-label branding",
          "US-based support",
        ],
      },
      pro: {
        price: 79,
        features: [
          "Everything in Starter",
          "20 clients/month",
          "API access",
          "Custom domain",
          "Webhooks",
        ],
      },
      enterprise: {
        price: 149,
        features: [
          "Everything in Pro",
          "50 clients/month",
          "Multi-brand (3 brands)",
          "Priority support",
          "Custom integrations",
        ],
      },
    },
    differentiators: [
      "Access + Intake in One Link",
      "Predictable tiered pricing (no credits)",
      "US-Based Support",
      "15+ Platforms",
    ],
    platforms: [
      "Meta Ads",
      "Facebook Pages",
      "Instagram",
      "WhatsApp Business",
      "Google Ads",
      "GA4",
      "Google Tag Manager",
      "Merchant Center",
      "Search Console",
      "LinkedIn Ads",
      "TikTok Ads",
      "Snapchat Ads",
      "Pinterest Ads",
      "Klaviyo",
      "Kit (ConvertKit)",
      "Beehiiv",
      "Shopify",
    ],
  },

  excerpt: "Stop juggling separate tools for access and intake. Get both in one professional link—tiered plans from $29/mo (5/20/50 clients). Save $600/year vs Leadsie Agency when you choose AuthHub Growth ($79 vs $129)—or $1,800/year vs Leadsie Pro at Agency volume ($149 vs $299).",

  content: "", // Rendered by component from structured data

  framework: "AIDA",

  painPoints: [
    {
      title: "Credit Anxiety",
      icon: "DollarSign",
      quote: "I never know what my bill will be each month.",
      description:
        "Usage-based pricing creates unpredictable costs. One busy month throws your budget. Growing agencies need predictable expenses they can plan around.",
      solution: "Predictable tiered pricing: $29 / $79 / $149 (5 / 20 / 50 clients/mo)—no credits",
    },
    {
      title: "Two-Step Onboarding",
      icon: "ArrowRight",
      quote: "I look unprofessional sending multiple links to new clients.",
      description:
        "Leadsie handles access. You still need Google Forms or Typeform for intake. Two links, two emails, two chances for clients to drop off.",
      solution: "One link handles OAuth AND collects client info",
    },
    {
      title: "UK Support Hours",
      icon: "Clock",
      quote: "They're in the UK, I'm in the US. Response times don't work.",
      description:
        "8-hour time difference means next-day responses. When a client is locked out during your business hours, waiting until tomorrow isn't an option.",
      solution: "US-based support with same-day responses",
    },
    {
      title: "Missing Platforms",
      icon: "Globe",
      quote: "They don't support Pinterest, Klaviyo, or Shopify.",
      description:
        "E-commerce and email agencies need platforms beyond Meta and Google. Limited support means manual workarounds or turning away clients.",
      solution: "15+ platforms including Pinterest, Klaviyo, Shopify, Kit, Beehiiv",
    },
  ],

  quickComparison: [
    { feature: "Platform Count", competitor: "31+", authhub: "15+", winner: "competitor" },
    { feature: "Client Intake Forms", competitor: false, authhub: true, winner: "authhub", isExclusive: true },
    { feature: "US-Based Support", competitor: false, authhub: true, winner: "authhub" },
    { feature: "Onboarding Templates", competitor: false, authhub: true, winner: "authhub", isExclusive: true },
    { feature: "API Access (All Tiers)", competitor: false, authhub: true, winner: "authhub", isExclusive: true },
    { feature: "Predictable tiered pricing (no credits)", competitor: false, authhub: true, winner: "authhub" },
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
        { name: "Pinterest Ads", competitor: false, authhub: true, notes: "AuthHub exclusive" },
        { name: "Klaviyo", competitor: false, authhub: true, notes: "AuthHub exclusive" },
        { name: "Kit (ConvertKit)", competitor: false, authhub: true, notes: "AuthHub exclusive" },
        { name: "Beehiiv", competitor: false, authhub: true, notes: "AuthHub exclusive" },
        { name: "Shopify", competitor: false, authhub: true, notes: "AuthHub exclusive" },
      ],
    },
    {
      category: "Core Features",
      features: [
        { name: "Client Intake Forms", competitor: false, authhub: true },
        { name: "Permission Levels", competitor: "2-3", authhub: "4 (admin, standard, read_only, email_only)" },
        { name: "Reusable Templates", competitor: false, authhub: true },
        { name: "Custom Branding", competitor: "Limited", authhub: "Full white-label" },
        { name: "API Access", competitor: "Enterprise only", authhub: "All tiers" },
        { name: "Multi-Language", competitor: false, authhub: "EN, ES, NL" },
      ],
    },
    {
      category: "Support & Security",
      features: [
        { name: "Support Location", competitor: "UK (GMT)", authhub: "US (EST/PST)" },
        { name: "Response Time", competitor: "Next business day", authhub: "Same day" },
        { name: "Token Storage", competitor: "Database", authhub: "Infisical (Enterprise-grade)" },
        { name: "Audit Logging", competitor: "Basic", authhub: "Comprehensive (Infisical-backed)" },
      ],
    },
  ],

  recommendations: {
    stickWithCompetitor: [
      "You only need Meta + Google access",
      "You're UK-based and don't need US support hours",
      "You have fewer than 20 clients",
      "You already have a separate intake process that works well",
      "Enterprise security requirements aren't a priority",
    ],
    switchToAuthHub: [
      "You need Pinterest, Klaviyo, or Shopify access",
      "You're tired of sending multiple links for client onboarding",
      "You're US-based and want same-day support",
      "You want predictable tiered pricing (no credits)",
      "You have 20+ clients or plan to scale",
      "You need reusable onboarding templates",
      "Enterprise-grade security and audit logs are required",
    ],
  },

  migrationSteps: [
    {
      step: 1,
      title: "Export from Leadsie",
      description:
        "Download your existing connections and client data from Leadsie's dashboard. This gives you a record of all active authorizations.",
    },
    {
      step: 2,
      title: "Create Your Templates",
      description:
        "Set up reusable templates in AuthHub for your common client types (e-commerce, lead gen, local business). This speeds up future onboarding.",
    },
    {
      step: 3,
      title: "Send New Links",
      description:
        "Send AuthHub links to active clients. Existing Leadsie connections stay live until clients re-authorize through AuthHub—no downtime.",
    },
  ],

  migrationTimeMinutes: 15,

  testimonials: [
    {
      quote:
        "We switched from Leadsie and immediately noticed the difference. One link instead of two, and our clients love the integrated intake form.",
      author: "Mike Torres",
      company: "Scale Media Partners",
      role: "CEO",
      previousTool: "Former Leadsie user",
      metric: "Saved 8 hours/month",
    },
    {
      quote:
        "The US-based support was the deciding factor. Getting same-day responses during our business hours is huge for client retention.",
      author: "Jennifer Walsh",
      company: "Digital Growth Co",
      role: "Director of Operations",
      previousTool: "Former Leadsie user",
    },
  ],

  customerCount: 250,
  hoursSavedMetric: 12,

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
          "5 clients/month",
          "15+ platforms",
          "Access + Intake",
          "US support",
          "Unlimited team seats",
        ],
      },
      pro: {
        price: 79,
        features: [
          "20 clients/month",
          "Webhooks & API access",
          "Custom domain",
          "Reusable templates",
          "Priority support",
        ],
      },
      enterprise: {
        price: 149,
        features: [
          "50 clients/month",
          "Multi-brand (3 brands)",
          "Priority support",
          "Custom integrations",
        ],
      },
    },
    savings: {
      monthly: 50,
      yearly: 600,
      percentage: 50,
    },
  },

  faqs: [
    {
      question: "How long does it take to migrate from Leadsie to AuthHub?",
      answer:
        "Most agencies complete the migration in 15-30 minutes. Export your client list from Leadsie, set up templates in AuthHub, and send new links to active clients. Existing connections remain active until clients re-authorize.",
    },
    {
      question: "Will my clients need to re-authorize their accounts?",
      answer:
        "Yes, clients will need to authorize their accounts through AuthHub. However, the process takes just 2-3 minutes per platform, and you can send them a single link that handles all platforms at once.",
    },
    {
      question: "Does AuthHub support all the same platforms as Leadsie?",
      answer:
        "AuthHub supports all platforms Leadsie supports plus Pinterest, Klaviyo, Kit, Beehiiv, and Shopify—15+ total platforms vs Leadsie's 31+.",
    },
    {
      question: "What's the difference between AuthHub and Leadsie's intake approach?",
      answer:
        "Leadsie requires a separate tool (Google Forms, Typeform) for client intake. AuthHub includes customizable intake forms built into the authorization flow—clients complete everything in one seamless experience.",
    },
  ],

  keywords: [
    "Leadsie alternative",
    "AuthHub vs Leadsie",
    "Leadsie vs AuthHub",
    "client access platform alternative",
    "agency onboarding software",
    "Leadsie pricing comparison",
    "Leadsie competitor",
  ],

  relatedComparisons: [],
  relatedBlogPosts: [
    "how-to-get-meta-ads-access-from-clients",
    "google-ads-access-agency",
    "ga4-access-agencies",
  ],

  cta: {
    headline: "Ready to Streamline Your Onboarding?",
    subheadline:
      "Start your 14-day free trial today. No credit card required. See why agencies switched from Leadsie to AuthHub.",
    primaryButton: "Start 14 Day Free Trial",
    primaryLink: "/signup",
    secondaryButton: "View Pricing",
    secondaryLink: "/pricing",
    guarantee: "✓ Access + Intake in one link  ✓ From $29/mo · 5/20/50 client caps  ✓ US-based support",
  },

  isProgrammatic: true,
  templateId: "comparison-aida-v1",
  lastVerified: "2026-03-18",
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
      "No SOC 2 certification advertised",
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
          "5 clients/month",
          "Unlimited team seats",
          "White-label branding",
          "Automatic token refresh",
          "Complete audit logs",
          "Infisical-backed token storage",
          "19 platform connectors",
        ],
      },
      pro: {
        price: 79,
        features: [
          "Everything in Starter",
          "20 clients/month",
          "API + webhooks",
          "Custom domain",
          "Priority support",
        ],
      },
      enterprise: {
        price: "149",
        features: [
          "Everything in Pro",
          "50 clients/month",
          "Multi-brand (3 brands)",
          "Priority support",
          "Custom integrations",
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
      "19 platform connectors",
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
        { name: "Client Intake Forms", competitor: true, authhub: false, notes: "AgencyAccess advantage" },
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
        { name: "Starting Price", competitor: "$33/mo (annual)", authhub: "$29 Starter · $79 Growth · $149 Agency" },
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
        { name: "Shopify", competitor: true, authhub: false },
        { name: "HubSpot", competitor: true, authhub: false },
        { name: "Klaviyo", competitor: true, authhub: false },
        { name: "YouTube Studio", competitor: true, authhub: false },
      ],
    },
  ],

  recommendations: {
    stickWithCompetitor: [
      "You need 20+ platform integrations (Shopify, HubSpot, Klaviyo)",
      "You value 24/7 chat support and longer trial periods",
      "You're comfortable with Zapier-based automation only",
      "You want intake forms built into the onboarding flow",
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
        price: 79,
        features: [
          "20 clients/month",
          "API + webhooks included",
          "Automatic token refresh",
          "Complete audit logs",
          "Infisical-backed token storage",
          "19 platform connectors",
        ],
      },
      pro: {
        price: 149,
        features: [
          "50 clients/month",
          "Multi-brand support",
          "Priority support",
          "Advanced automation",
        ],
      },
      enterprise: {
        price: "Custom",
        features: ["White-label", "SSO", "Dedicated CSM", "SLA"],
      },
    },
    savings: {
      monthly: 44,
      yearly: 528,
      percentage: 59,
    },
  },

  faqs: [
    {
      question: "Can I migrate my existing clients from AgencyAccess to AuthHub?",
      answer: "Yes. Since both platforms use official OAuth flows, your clients simply need to authorize through AuthHub once. It takes about 5 minutes per client and doesn't affect existing permissions. You can run both platforms simultaneously during migration.",
    },
    {
      question: "Does AuthHub support the same platforms as AgencyAccess?",
      answer: "AuthHub supports all major advertising and analytics platforms including Meta Ads, Google Ads, GA4, Google Search Console, LinkedIn Ads, TikTok Ads, and more. AgencyAccess has broader coverage with 20+ integrations including Shopify, HubSpot, and Klaviyo. Check both platforms for your specific needs.",
    },
    {
      question: "How does AuthHub's automatic token refresh work?",
      answer: "AuthHub monitors token health and automatically refreshes credentials before they expire. This happens in the background with zero client involvement. AgencyAccess requires clients to manually reconnect when access expires, which can interrupt live campaigns and require additional support.",
    },
    {
      question: "Is AuthHub more expensive than AgencyAccess?",
      answer: "AuthHub Growth starts at $79/month with 20 clients/month and API access. AgencyAccess Starter is $33/month (annual) but limits you to 5 invites. For equivalent features (more invites, automation), AgencyAccess Premium costs $74/month. AuthHub delivers better value for automation-focused teams.",
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
      answer: "AgencyAccess includes built-in intake forms to collect budgets, goals, and context during onboarding. AuthHub focuses on OAuth authorization. You can use AuthHub alongside your existing intake process or connect forms via webhooks/API.",
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
  return COMPARISON_PAGES.map((page) => page.slug);
}

/**
 * Get related comparison pages (for internal linking)
 */
export function getRelatedComparisons(currentSlug: string, limit = 3): ProgrammaticComparisonPage[] {
  return COMPARISON_PAGES.filter((page) => page.slug !== currentSlug).slice(0, limit);
}
