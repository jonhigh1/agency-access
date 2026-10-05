/**
 * Leadsie pricing breakdown — programmatic compare article (copy verified 2026-10-05)
 */

const LEADSIE_PRICING_AUTHHUB_PLATFORM_BREADTH = "15+";

export const LEADSIE_PRICING_SLUG = "leadsie-pricing";

export interface LeadsiePlanRow {
  name: string;
  monthly: string;
  yearlyTotal: string;
  effectiveMonthly: string;
  newClients: string;
  prospects: string;
  keyGates: string;
}

export interface LeadsieOverageRow {
  plan: string;
  packPrice: string;
  onboardingCredits: string;
  auditCredits: string;
}

export interface LeadsieWorkedExample {
  label: string;
  scenario: string;
  leadsiePath: string;
  leadsieCost: string;
  authHubPlan: string;
  authHubCost: string;
  deltaNote: string;
  extraNote?: string;
}

export interface LeadsiePricingFaq {
  question: string;
  answer: string;
}

export interface LeadsiePricingPageData {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  openGraphDescription?: string;
  datePublished: string;
  lastVerified: string;
  lastVerifiedDisplay: string;
  answerBox: string;
  priceCheckNote: string;
  annualCreditPoolsIntro: string;
  annualCreditPoolsBullets: string[];
  plans: LeadsiePlanRow[];
  overagePacks: LeadsieOverageRow[];
  creditBullets: string[];
  runOutIntro: string;
  unitsDifferenceRows: { label: string; leadsie: string; authHub: string }[];
  unitsCallout: string;
  authHubPricingNote: string;
  workedExamplesIntro: string;
  workedExamples: LeadsieWorkedExample[];
  workedExamplesFootnote: string;
  stayOnLeadsie: string[];
  switchToAuthHub: string[];
  migrationIntro: string;
  migrationSteps: string[];
  migrationFootnote: string;
  faqs: LeadsiePricingFaq[];
  bottomLine: string;
  keywords: string[];
}

export const leadsiePricingPage: LeadsiePricingPageData = {
  slug: LEADSIE_PRICING_SLUG,
  title: "Leadsie Pricing 2026: Plans, Credits, and What a Busy Month Really Costs",
  metaTitle: "Leadsie Pricing 2026: $59–$299/mo + What Overages Really Cost",
  metaDescription:
    "Leadsie costs $59, $129 or $299/mo. We priced busy months at 5, 10, 20 and 50 new clients — including $50 overage packs — then matched AuthHub active-client tiers. Checked Oct 2026.",
  openGraphDescription:
    "Leadsie list prices, credit rules, $50 overage packs, annual pools, and busy-month math vs AuthHub active-client tiers — units matched honestly. Checked Oct 2026.",
  datePublished: "2026-09-23",
  lastVerified: "2026-10-05",
  lastVerifiedDisplay: "October 5, 2026 (~09:37 AM PT)",
  answerBox:
    "Leadsie costs $59, $129, or $299/mo (Starter / Agency / Pro) for 3 / 10 / 50 new-client credits, larger audit pools, and $50 overage packs past the cap. List price isn’t always the bill — busy months add packs (or force an upgrade); annual plans pool credits for the year. Below: plans, credit rules, annual pools, and busy-month math vs AuthHub’s active-client tiers — units matched honestly.",
  priceCheckNote:
    "Prices are pre-tax, checked October 5, 2026 (~09:37 AM PT) on Leadsie pricing and AuthHub pricing. Verify both vendors live before you buy.",
  annualCreditPoolsIntro:
    "Yearly plans front a year of credits: Starter 36 + 120, Agency 120 + 600, Pro 600 + 3,000 (clients + prospects). Quiet months can subsidize spikes until the pool is gone. Monthly plans still get ~3-month rollover. Confirm Leadsie’s annual toggle before you commit.",
  annualCreditPoolsBullets: [
    "Three public monthly plans, plus Enterprise on request. Annual billing pools credits for the year (~two months free on the yearly path).",
    "Sources: leadsie.com/pricing, Leadsie help pricing article (updated July 1, 2026). USD; tax at checkout. 14-day trial (no card); 30-day money-back.",
  ],
  plans: [
    {
      name: "Starter",
      monthly: "$59",
      yearlyTotal: "$590/yr",
      effectiveMonthly: "~$49/mo",
      newClients: "3/mo (annual 36/yr)",
      prospects: "10/mo (120/yr)",
      keyGates: "Core 1-link access",
    },
    {
      name: "Agency",
      monthly: "$129",
      yearlyTotal: "$1,290/yr",
      effectiveMonthly: "~$107/mo",
      newClients: "10/mo (annual 120/yr)",
      prospects: "50/mo (600/yr)",
      keyGates: "White-label & embed, webhooks, unlimited teams",
    },
    {
      name: "Pro",
      monthly: "$299",
      yearlyTotal: "$2,990/yr",
      effectiveMonthly: "~$249/mo",
      newClients: "50/mo (annual 600/yr)",
      prospects: "250/mo (3,000/yr)",
      keyGates: "Agency gates + multi-brand (up to 3)",
    },
    {
      name: "Enterprise",
      monthly: "Custom",
      yearlyTotal: "Custom",
      effectiveMonthly: "Custom",
      newClients: "Custom",
      prospects: "Custom",
      keyGates: "API / custom (contact)",
    },
  ],
  creditBullets: [
    "Onboarding — new client grants manager/admin access → 1 credit (any asset count).",
    "Audit (prospect) — view-only; larger pool than onboarding on every plan.",
    "Prospect → client — upgrade to manage/admin costs an onboarding credit.",
    "Rollover — unused credits typically roll ~three months on monthly plans.",
    "“Onboarding credits” ≈ “new clients with manage access this month.” That number drives the invoice.",
  ],
  overagePacks: [
    {
      plan: "Starter",
      packPrice: "$50",
      onboardingCredits: "+3",
      auditCredits: "+10",
    },
    {
      plan: "Agency",
      packPrice: "$50",
      onboardingCredits: "+5",
      auditCredits: "+25",
    },
    {
      plan: "Pro",
      packPrice: "$50",
      onboardingCredits: "+10",
      auditCredits: "+50",
    },
  ],
  runOutIntro:
    "Active subscriptions keep links live over the cap. Going over triggers a $50 overage pack (or an upgrade). Same Agency plan, different pack counts → different invoices.",
  unitsDifferenceRows: [
    {
      label: "Meter",
      leadsie: "New-client / prospect credits per month (or annual pools)",
      authHub: "Active-client roster caps",
    },
    {
      label: "Public caps",
      leadsie: "3 / 10 / 50 new clients + audit pools",
      authHub: "5 / 20 / 50 active clients",
    },
    {
      label: "Spike cost",
      leadsie: "$50 packs or upgrade",
      authHub: "Upgrade when roster exceeds cap",
    },
    {
      label: "Accumulation",
      leadsie: "Credits reset (with rollover)",
      authHub: "Actives accumulate until churn / offboard",
    },
  ],
  unitsCallout:
    "Why “10–20 new/mo = Growth $79” was wrong: Growth caps 20 active clients, not 20 new onboards. At 10–20 news/month with low churn, you cross 20 actives in ~2–3 months. Examples pair Leadsie onboard math with an explicit AuthHub roster.",
  authHubPricingNote:
    "AuthHub monthly (primary): $29 / $79 / $149 for 5 / 20 / 50 actives. Annual ~$24 / $66 / $124/mo — footnote only.",
  workedExamplesIntro:
    "Assumptions labeled. Pre-tax. Lowest Leadsie monthly path covering the onboard load (incl. $50 packs). AuthHub = tier for the stated active roster.",
  workedExamples: [
    {
      label: "A",
      scenario: "~5 active clients, ~5 new onboards",
      leadsiePath: "Starter + 1 pack (3+3 ≥ 5)",
      leadsieCost: "$109",
      authHubPlan: "Starter (5 active)",
      authHubCost: "$29",
      deltaNote: "Delta: $80 if AuthHub stays at 5 actives.",
      extraNote: "Net-new, no churn → Starter breaks next month.",
    },
    {
      label: "B",
      scenario: "~18 active, ~8–10 new onboards",
      leadsiePath: "Agency (≤10 news)",
      leadsieCost: "$129",
      authHubPlan: "Growth (18 ≤ 20)",
      authHubCost: "$79",
      deltaNote: "Delta: $50.",
      extraNote: "Net adds past 20 actives → AuthHub Scale $149.",
    },
    {
      label: "C",
      scenario: "~15 new onboards; roster already ~22 active",
      leadsiePath: "Agency + 1 pack (10+5)",
      leadsieCost: "$179",
      authHubPlan: "Scale (22 > 20)",
      authHubCost: "$149",
      deltaNote: "Delta: $30.",
      extraNote:
        "Growth ($79) is unavailable past 20 actives — even if “only” 15 were new this month.",
    },
    {
      label: "D",
      scenario: "~20 new onboards, building toward 40–50 actives",
      leadsiePath: "Agency + 2 packs (10+10)",
      leadsieCost: "$229",
      authHubPlan: "Scale",
      authHubCost: "$149",
      deltaNote: "Deltas: $80 (Agency+packs vs Scale); $150 (Pro vs Scale).",
      extraNote: "Or Pro $299 if surges repeat.",
    },
    {
      label: "E",
      scenario: "~50 new onboards in one month",
      leadsiePath: "Pro",
      leadsieCost: "$299",
      authHubPlan: "Scale",
      authHubCost: "$149",
      deltaNote: "Delta: $150 if actives stay ≤50.",
      extraNote: "Already 30 actives + 50 news → past Scale; talk to both vendors.",
    },
  ],
  workedExamplesFootnote:
    "Read: Leadsie list price is the floor; credits + packs (or annual pool burn) are the bill. AuthHub = tier for active roster. Don’t map “new this month” 1:1 onto AuthHub caps.",
  stayOnLeadsie: [
    `Broader coverage than AuthHub’s ${LEADSIE_PRICING_AUTHHUB_PLATFORM_BREADTH} — Leadsie lists 31 accounts/assets (integrations)`,
    "Access Detective, Meta asset creation, or influencer whitelisting is core",
    "Few news/month; rarely hit overages",
    "Annual pools / 3-month rollover beat a hard active-client cap",
    "On-demand support + Meta-heavy workflow already fit",
  ],
  switchToAuthHub: [
    "Predictable monthly number without credit/pack math",
    "Active roster fits 5 / 20 / 50; spikes would otherwise buy Leadsie packs",
    "Intake + OAuth in one link, token health, Infisical + audit logs (no SOC 2)",
    `Clients on AuthHub’s ${LEADSIE_PRICING_AUTHHUB_PLATFORM_BREADTH} core set (Meta, Google Ads, GA4, LinkedIn, TikTok, related) — no Leadsie parity`,
    "API + webhooks on Growth/Scale or white-label on Growth+",
  ],
  migrationIntro:
    "Neither SaaS moves existing platform permissions. Canceling Leadsie does not revoke grants; AuthHub does not inherit them.",
  migrationSteps: [
    "Inventory clients and platforms.",
    "Dual-run — keep Leadsie for clients you’re not moving; AuthHub for new onboardings.",
    "Re-authorize — AuthHub-managed clients need a fresh AuthHub authorization.",
  ],
  migrationFootnote: "No instant-migration promise.",
  faqs: [
    {
      question: "How much does Leadsie cost per month?",
      answer:
        "$59 / $129 / $299 monthly. Annual $590 / $1,290 / $2,990 (~$49 / $107 / $249/mo). Real cost = plan + any $50 packs. Enterprise custom. Confirm on leadsie.com/pricing.",
    },
    {
      question: "Is there a free plan or trial?",
      answer:
        "Leadsie: 14-day trial (no card; extendable until you onboard per their FAQ) + 30-day money-back. AuthHub: 14-day trial, no card. No permanent free plan on pages checked Oct 5, 2026.",
    },
    {
      question: "What counts as a Leadsie credit?",
      answer:
        "One onboarding credit per new manage/admin client (any asset count). Audit credits for view-only. Prospect → manage costs an onboarding credit. Unused typically roll ~three months; annual uses yearly pools.",
    },
    {
      question: "What happens when credits run out?",
      answer:
        "Links stay live. Pay a $50 pack (Starter +3/+10, Agency +5/+25, Pro +10/+50) or upgrade.",
    },
    {
      question: "Do unused credits roll over? What about annual?",
      answer:
        "Yes monthly (~three months). Annual pools a year up front (36+120 / 120+600 / 600+3000). Pools smooth lumps; they don’t remove the overage cliff once spent.",
    },
    {
      question: "How does AuthHub compare for a busy month?",
      answer:
        "Match units. Leadsie = new-client credits (+ packs). AuthHub = $29 / $79 / $149 for 5 / 20 / 50 actives. 10–20 new clients does not auto-fit Growth — only ≤20 actives does. See worked examples above.",
    },
  ],
  bottomLine:
    "Leadsie is simple on the marketing page and conditional in production: credits, rollover/annual pools, and $50 packs decide the invoice. AuthHub is simple if your active roster fits 5 / 20 / 50 — misleading if you treat “new this month” as the cap. Pick the meter that matches how you grow; dual-run to prove it.",
  keywords: [
    "Leadsie pricing",
    "Leadsie cost",
    "Leadsie credits",
    "Leadsie overage",
    "Leadsie plans 2026",
    "AuthHub pricing",
  ],
};

export function getLeadsiePricingPage(): LeadsiePricingPageData {
  return leadsiePricingPage;
}

export function isLeadsiePricingSlug(slug: string): boolean {
  return slug === LEADSIE_PRICING_SLUG;
}
