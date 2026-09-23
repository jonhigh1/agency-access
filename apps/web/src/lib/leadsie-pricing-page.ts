/**
 * Leadsie pricing breakdown — programmatic compare article (copy verified 2026-09-23)
 */

const LEADSIE_PRICING_AUTHHUB_PLATFORM_BREADTH = "15+";

export const LEADSIE_PRICING_SLUG = "leadsie-pricing";

export interface LeadsiePlanRow {
  name: string;
  monthly: string;
  yearly: string;
  onboardingCredits: string;
  auditCredits: string;
}

export interface LeadsieOverageRow {
  plan: string;
  packPrice: string;
  onboardingCredits: string;
  auditCredits: string;
}

export interface LeadsieWorkedExampleRow {
  newClients: string;
  leadsiePath: string;
  leadsieCost: string;
  authHubPlan: string;
  authHubCost: string;
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
  lastVerified: string;
  introLead: string;
  plans: LeadsiePlanRow[];
  overagePacks: LeadsieOverageRow[];
  creditBullets: string[];
  runOutNote: string;
  workedExamples: LeadsieWorkedExampleRow[];
  workedExamplesFootnote: string;
  stayOnLeadsie: string[];
  switchToAuthHub: string[];
  faqs: LeadsiePricingFaq[];
  bottomLine: string;
  keywords: string[];
}

export const leadsiePricingPage: LeadsiePricingPageData = {
  slug: LEADSIE_PRICING_SLUG,
  title: "Leadsie Pricing (2026): Plans, Credits, and Real Monthly Cost",
  metaTitle: "Leadsie Pricing (2026): Plans, Credits & Real Cost",
  metaDescription:
    "Leadsie plans start at $59/mo for 3 client credits. See credit rules, $50 overages, and busy-month cost vs AuthHub fixed tiers.",
  openGraphDescription:
    "Leadsie pricing explained: Starter, Agency, Pro, onboarding vs audit credits, $50 overage packs, and what a 10- or 20-client month actually costs.",
  lastVerified: "2026-09-23",
  introLead:
    "Leadsie plans start at $59/month for 3 onboarding credits. Busy months add $50 overage packs. Below is how credits work, what a real month costs at 5 / 10 / 15 / 20 / 50 new clients, and how AuthHub’s fixed tiers compare. Prices are pre-tax and were checked on Leadsie’s pricing page on September 23, 2026 — confirm both vendors before you buy.",
  plans: [
    {
      name: "Starter",
      monthly: "$59",
      yearly: "~$49/mo ($590/yr)",
      onboardingCredits: "3 / month",
      auditCredits: "10 / month",
    },
    {
      name: "Agency",
      monthly: "$129",
      yearly: "~$107/mo ($1,290/yr)",
      onboardingCredits: "10 / month",
      auditCredits: "50 / month",
    },
    {
      name: "Pro",
      monthly: "$299",
      yearly: "~$249/mo ($2,990/yr)",
      onboardingCredits: "50 / month",
      auditCredits: "250 / month",
    },
    {
      name: "Enterprise",
      monthly: "Custom",
      yearly: "Custom",
      onboardingCredits: "Custom",
      auditCredits: "Custom",
    },
  ],
  creditBullets: [
    "Onboarding credit: each new client that grants manager or admin access uses one credit, regardless of how many assets they share.",
    "Audit credit: view-only access checks use separate audit credits.",
    "Rollover: unused credits roll over for about three months on paid plans.",
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
  runOutNote:
    "Your access links stay live when credits run out — Leadsie does not shut off existing requests. The cliff is buying $50 overage packs (or upgrading) before the next onboarding or audit you need.",
  workedExamples: [
    {
      newClients: "5",
      leadsiePath: "Starter + 1 overage",
      leadsieCost: "$109",
      authHubPlan: "Starter",
      authHubCost: "$29",
    },
    {
      newClients: "10",
      leadsiePath: "Agency",
      leadsieCost: "$129",
      authHubPlan: "Growth",
      authHubCost: "$79",
    },
    {
      newClients: "15",
      leadsiePath: "Agency + 1 overage",
      leadsieCost: "$179",
      authHubPlan: "Growth",
      authHubCost: "$79",
    },
    {
      newClients: "20",
      leadsiePath: "Agency + 2 overages",
      leadsieCost: "$229",
      authHubPlan: "Growth",
      authHubCost: "$79",
    },
    {
      newClients: "50",
      leadsiePath: "Pro",
      leadsieCost: "$299",
      authHubPlan: "Scale",
      authHubCost: "$149",
    },
  ],
  workedExamplesFootnote:
    "Worked examples use the lowest published monthly Leadsie path that covers the workload, including listed $50 overage packs. AuthHub figures use monthly list prices ($29 Starter · $79 Growth · $149 Scale). AuthHub also offers annual billing (effective $24 / $66 / $124 on /pricing).",
  stayOnLeadsie: [
    "You need Leadsie's 31+ long-tail integrations",
    "Access Detective, Meta asset creation, or influencer whitelisting is core to your workflow",
    "Your team and clients are best served during UK/EU hours",
    "You already have a separate intake process that works well",
    "You are happy with credit rollover and overage math",
  ],
  switchToAuthHub: [
    "You want a predictable monthly number without credit math",
    "You regularly onboard in the 5–20 client band where overage packs show up",
    "You want intake fields + OAuth in one client link",
    "You care about token health monitoring and Infisical-backed audit events on AuthHub's core connectors",
    `Your clients use AuthHub's ${LEADSIE_PRICING_AUTHHUB_PLATFORM_BREADTH} core connectors`,
  ],
  faqs: [
    {
      question: "How much does Leadsie cost per month in 2026?",
      answer:
        "Leadsie's published monthly list prices are $59 for Starter (3 onboarding credits), $129 for Agency (10 credits), and $299 for Pro (50 credits). Yearly billing shows about $49, $107, and $249 per month when paid upfront ($590, $1,290, and $2,990 annually). Enterprise is custom. Confirm on Leadsie's pricing page before purchase.",
    },
    {
      question: "What counts as a Leadsie onboarding credit?",
      answer:
        "One onboarding credit is used when a new client grants manager or admin access through Leadsie, regardless of how many ad accounts or assets they include. View-only audits consume separate audit credits.",
    },
    {
      question: "How much are Leadsie overage packs?",
      answer:
        "Each overage pack costs $50. Starter plans get 3 onboarding credits and 10 audit credits per pack; Agency gets 5 and 25; Pro gets 10 and 50. Packs apply when you exceed your plan's monthly allowance.",
    },
    {
      question: "Do unused Leadsie credits roll over?",
      answer:
        "Yes. Leadsie states unused credits roll over for about three months on paid plans. That helps steady agencies but does not remove $50 overage charges in spike months.",
    },
    {
      question: "How does AuthHub pricing compare to Leadsie for busy months?",
      answer:
        "AuthHub Starter ($29), Growth ($79), and Scale ($149) cap active clients at 5, 20, and 50 per month with no credit packs. In the worked examples above, 10–20 new clients stay on Growth at $79 while Leadsie ranges from $129 to $229 depending on overages. Verify both pricing pages before you buy.",
    },
  ],
  bottomLine:
    "Leadsie fits agencies that want the broadest integration list and are comfortable modeling credits and $50 overage packs. AuthHub fits agencies that want fixed monthly tiers, intake plus OAuth in one link, and published token-health and audit tooling. Prices change — re-check Leadsie and AuthHub before you sign.",
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
