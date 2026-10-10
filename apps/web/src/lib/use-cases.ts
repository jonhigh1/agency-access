export const USE_CASE_SLUGS = [
  "ppc-agencies",
  "seo-agencies",
  "freelancers",
  "in-house-teams",
] as const;

export type UseCaseSlug = (typeof USE_CASE_SLUGS)[number];

export interface UseCaseSection {
  heading: string;
  body: string;
}

export interface UseCaseDefinition {
  slug: UseCaseSlug;
  title: string;
  metaTitle: string;
  metaDescription: string;
  hubSummary: string;
  heroSummary: string;
  platforms: string[];
  sections: UseCaseSection[];
  relatedSlugs: UseCaseSlug[];
}

const ALL_SLUGS: UseCaseSlug[] = [...USE_CASE_SLUGS];

function relatedTo(slug: UseCaseSlug): UseCaseSlug[] {
  return ALL_SLUGS.filter((item) => item !== slug);
}

const USE_CASES: UseCaseDefinition[] = [
  {
    slug: "ppc-agencies",
    title: "Client access for PPC agencies",
    metaTitle: "Client Access for PPC Agencies | AuthHub",
    metaDescription:
      "How paid-media teams collect Meta, Google Ads, LinkedIn, TikTok, and Snapchat access in one link instead of chasing Business Manager invites.",
    hubSummary:
      "Paid media lives or dies on partner access. One link for Meta, Google Ads, and the rest of the media plan.",
    heroSummary:
      "PPC work cannot start until the client grants the right ad accounts. AuthHub sends one link that walks them through official platform invites so the media plan is not waiting on screenshots.",
    platforms: ["Meta Ads", "Google Ads", "LinkedIn Ads", "TikTok Ads", "Snapchat Ads"],
    sections: [
      {
        heading: "The access job in paid media",
        body: "A new retainer usually needs Meta Business Manager partner access, Google Ads standard or admin, and often LinkedIn, TikTok, or Snapchat on the same week. Each platform has its own invite, role names, and expiry. Shared logins look faster and then fail 2FA, policy, and offboarding.",
      },
      {
        heading: "What to request (and what not to)",
        body: "Campaign build-out is standard access, not billing admin, unless the SOW includes spend and user management. Reporting-only analysts should not get advertiser. Use the ungated access-level tool before you send the link so the client is not staring at Admin vs Advertiser with no context.",
      },
      {
        heading: "How AuthHub fits a PPC stack",
        body: "Create one request for the platforms on the media plan. The client opens a branded link, signs in with each platform, and picks the accounts. Status is complete, pending, or failed — not a green check that hides a missing Page. Tokens sit in Infisical with an audit log, not in a spreadsheet of passwords.",
      },
    ],
    relatedSlugs: relatedTo("ppc-agencies"),
  },
  {
    slug: "seo-agencies",
    title: "Client access for SEO agencies",
    metaTitle: "Client Access for SEO Agencies | AuthHub",
    metaDescription:
      "Collect GA4, Search Console, Tag Manager, and Google Business Profile access in one client link — without mixing editor and viewer roles.",
    hubSummary:
      "SEO needs property-level Google access, not a shared Analytics login. One link for GA4, Search Console, GTM, and GBP.",
    heroSummary:
      "SEO retainers stall on Google property access. AuthHub asks for GA4, Search Console, Tag Manager, and Business Profile in the same request the client already understands.",
    platforms: ["GA4", "Google Search Console", "Google Tag Manager", "Google Business Profile"],
    sections: [
      {
        heading: "SEO access is property access",
        body: "Unlike ads, SEO work is usually GA4 properties, Search Console sites, Tag Manager containers, and Google Business Profile locations. Clients confuse Google account login with granting a product. A password to Gmail is not Search Console verification.",
      },
      {
        heading: "Viewer vs editor",
        body: "Most SEO delivery needs editor on Search Console and analyst or editor on GA4, not account admin. Tag Manager publish rights are a separate decision. The access-level tool maps the job to read-only vs standard so the request is not oversized.",
      },
      {
        heading: "How AuthHub fits an SEO stack",
        body: "Pair this with the GA4 guide for the manual path. The one-link path collects Google products together, shows which properties were selected, and keeps a record of who granted what. Offboarding is a revoke, not a scavenger hunt through old Gmail threads.",
      },
    ],
    relatedSlugs: relatedTo("seo-agencies"),
  },
  {
    slug: "freelancers",
    title: "Client access for freelance marketers",
    metaTitle: "Client Access for Freelance Marketers | AuthHub",
    metaDescription:
      "Freelancers get Meta and Google access from clients without a Business Manager ID lecture or a shared-password workaround.",
    hubSummary:
      "Solo operators cannot spend three days on access email. One link, named permissions, an audit trail you can show the client.",
    heroSummary:
      "Freelancers do not have an ops team to chase Business Manager invites. AuthHub is the access request you can send from a laptop and still look like a process.",
    platforms: ["Meta Ads", "Google Ads", "GA4", "LinkedIn Ads"],
    sections: [
      {
        heading: "Why shared passwords show up",
        body: "When you are the only person on the account, it is tempting to take the client's login and finish the setup yourself. That breaks 2FA, mixes personal and business Facebook, and leaves you holding credentials after the contract ends.",
      },
      {
        heading: "Ask for the job, not Admin by default",
        body: "Clients push back when a freelancer asks for Business Manager admin. Standard or advertiser is enough for most campaign work. Put that in the request. The access-level tool is public — send it with the link if the client wants a second opinion.",
      },
      {
        heading: "How AuthHub fits a freelance practice",
        body: "Starter is built for a small active-client list. One branded link, token refresh, and an audit log you can point to when the client asks who still has access. When the engagement ends, revoke instead of hoping they remember to remove you.",
      },
    ],
    relatedSlugs: relatedTo("freelancers"),
  },
  {
    slug: "in-house-teams",
    title: "Client access for in-house marketing teams",
    metaTitle: "Agency Access for In-House Marketing Teams | AuthHub",
    metaDescription:
      "In-house teams grant agencies and contractors platform access with a record of who was added and a path to revoke when the SOW ends.",
    hubSummary:
      "Brand teams hire agencies. They need a grant-and-revoke path, not another partner-ID email chain.",
    heroSummary:
      "In-house marketers are the ones who actually click Approve. AuthHub gives them one link, named permissions, and an audit log instead of a PDF of Business Manager screenshots.",
    platforms: ["Meta Ads", "Google Ads", "GA4", "LinkedIn Ads", "TikTok Ads"],
    sections: [
      {
        heading: "The brand-side problem",
        body: "When an agency starts, someone on the brand has to add them in every platform. That person is often not a media buyer. They bounce between Partner ID, Business ID, and Access and security. The agency waits. The campaign date does not move.",
      },
      {
        heading: "Least privilege and offboarding",
        body: "In-house teams should not grant billing admin because an agency asked for it in Slack. Standard for campaign work, read-only for reporting, revoke when the SOW ends. The audit log is the record legal and IT will ask for later.",
      },
      {
        heading: "How AuthHub fits an in-house stack",
        body: "The agency sends the link; the in-house operator stays inside official OAuth. Status is visible to both sides. Pair with the offboarding guide when a contractor rotates off. This page is for brand teams, not a dental or ecommerce playbook.",
      },
    ],
    relatedSlugs: relatedTo("in-house-teams"),
  },
];

export function getAllUseCases(): UseCaseDefinition[] {
  return USE_CASES;
}

export function getUseCaseBySlug(slug: string): UseCaseDefinition | undefined {
  return USE_CASES.find((item) => item.slug === slug);
}

export function getAllUseCaseSlugs(): UseCaseSlug[] {
  return ALL_SLUGS;
}
