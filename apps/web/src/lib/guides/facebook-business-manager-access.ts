import type { GuideDefinition } from "./types";

export const facebookBusinessManagerAccessGuide: GuideDefinition = {
  slug: "facebook-business-manager-access",
  title: "How to Grant Meta Business Manager Access",
  breadcrumbName: "Meta Business Manager Access",
  metaTitle: "How to Grant Meta Business Manager Access (2026)",
  metaDescription:
    "Grant agency access to a Meta Business Portfolio: add People or add a Partner with a Business ID, then assign Pages, ad accounts, and Instagram. Different from ad-account-only sharing.",
  keywords: [
    "Facebook Business Manager access for agencies",
    "Meta Business Manager partner access",
    "grant Business Manager access",
  ],
  updatedAt: "2026-10-10",
  updatedAtDisplay: "October 10, 2026",
  hubSummary:
    "Add the agency as People or as a Partner on the Business Portfolio, then assign assets. Ad account sharing alone is not enough.",
  heroSummary:
    "Business Manager (Business Portfolio / Business Suite) is the entity. Ad accounts are assets inside it. Grant the business first, then assign Pages, ad accounts, and Instagram.",
  quickAnswer:
    "The client opens business.facebook.com, confirms the correct Business Portfolio, then either adds your email under Users → People or adds your Business ID under Users → Partners. After you accept, they assign Pages, ad accounts, and Instagram with Employee or a partner permission — not only an ad account share. Admin on the business is more than most agencies need.",
  quickSteps: [
    "Client opens business.facebook.com and confirms the Business name at the top left.",
    "People path: Users → People → Add → agency work email → Employee → Confirm.",
    "Partner path: Users → Partners → Add → agency 16-digit Business ID.",
    "Agency accepts the email or partner request.",
    "Client assigns Pages, ad accounts, catalogs, and Instagram to that person or partner.",
    "Agency verifies assets appear under the client's Business, not only a shared ad account.",
  ],
  whyHeading: "Why Business Manager Access Is Not the Same as Ad Account Access",
  whyBody:
    "Sharing an ad account as a partner can still leave you unable to see Pages, pixels, catalogs, or Instagram. Those live on the Business Portfolio. Adding a person without assigning assets creates an unassigned user. This guide is the business-entity path; the Meta Ads guide covers ad-account partner requests in isolation.",
  stepsHeading: "Step-by-Step: Granting Business Manager Access",
  howToName: "How to Grant Meta Business Manager Access",
  howToDescription:
    "Step-by-step guide for clients to add an agency to a Meta Business Portfolio and assign assets",
  howToSteps: [
    {
      name: "Open the correct Business Portfolio",
      text: "Client goes to business.facebook.com, opens Business Settings, and confirms the Business name. Wrong portfolio is the usual reason assets never show up.",
    },
    {
      name: "Add People or add a Partner",
      text: "People: Users → People → Add, enter the agency email, choose Employee. Partner: Users → Partners → Add, enter the agency Business ID from Business Info.",
    },
    {
      name: "Accept the invitation",
      text: "Agency accepts from email (People) or Business Settings → Users → Partner Requests (Partner).",
    },
    {
      name: "Assign assets",
      text: "Client selects the person or partner and assigns Pages, ad accounts, catalogs, and Instagram with the needed permission. Access is incomplete until assets are assigned.",
    },
  ],
  manualSteps: [
    "Client signs in at business.facebook.com and opens Business Settings (gear).",
    "They verify the Business Portfolio name. Switch portfolios if this is the wrong company.",
    "To add a teammate by email: Users → People → Add → Employee (not Admin unless they must manage the business itself).",
    "To add the agency business: Users → Partners → Add → paste the agency Business ID from Business Settings → Business Info.",
    "After the agency accepts, the client assigns ad accounts, Pages, and Instagram to that person or partner.",
    "Agency checks those assets appear under the client's business.",
  ],
  manualTip:
    "Find the Business ID under Business Settings → Business Info. It is a 16-digit number. Do not send a personal Facebook profile ID or an ad account ID in a partner invite.",
  authHubMethod:
    "Send one AuthHub link. The client signs in with Facebook, picks the Business Portfolio, and selects Ad Accounts and Pages in one pass. AuthHub records the grant instead of leaving an unassigned People invite sitting in email.",
  problems: [
    {
      problem: "Pending request that never completes",
      solution:
        "Agency checks email junk and Business Settings → Users → Partner Requests. Requests expire. Confirm they used your Business ID, not an ad account ID.",
    },
    {
      problem: "Added as People but no ad accounts",
      solution: "The client added a user and skipped Assign assets. They must attach Pages and ad accounts to that user.",
    },
    {
      problem: "Wrong Business Portfolio",
      solution:
        "Clients with more than one business must switch the name at the top of Business Settings before adding you.",
    },
    {
      problem: "Personal profile instead of a Business",
      solution:
        "Create a Business Portfolio at business.facebook.com. Personal ad accounts cannot add Partners the way a Business can.",
    },
  ],
  permissions: {
    heading: "People vs Partner on the Business",
    columns: ["Method", "What you add", "Typical agency use"],
    rows: [
      ["People", "Work email", "A named operator inside the client's business"],
      ["Partner", "Agency Business ID", "Agency Business Manager linked as a partner"],
      ["Ad account share only", "Partner on one ad account", "Campaigns only — see the Meta Ads guide"],
    ],
  },
  checklistHeading: "Business Manager Access Checklist",
  checklist: [
    "Correct Business Portfolio selected",
    "People (email) or Partner (Business ID) chosen on purpose",
    "Invitation accepted on the agency side",
    "Pages, ad accounts, and Instagram assigned after accept",
    "Previous unused partners reviewed",
    "Agency can see assets under that business",
  ],
  faqs: [
    {
      question: "How do I give an agency access to Meta Business Manager?",
      answer:
        "In Business Settings, add them under People with their work email, or under Partners with their Business ID. Then assign Pages, ad accounts, and Instagram. Accepting the invite without assigned assets grants nothing useful.",
    },
    {
      question: "What is the difference between People and Partners?",
      answer:
        "People adds a Facebook user into the client's business by email. Partners links two Business Portfolios using a Business ID. Agencies usually want the Partner path so assets sit on the agency business, not on one employee's personal login.",
    },
    {
      question: "Where do I find a Facebook Business ID?",
      answer:
        "Business Settings → Business Info. Copy the 16-digit Business ID for that portfolio. An ad account ID or Page ID will not work in Add a Partner.",
    },
    {
      question: "Do I still need the Meta Ads access steps?",
      answer:
        "If the client only shares one ad account as a partner, use the Meta Ads guide. If you need Pages, Instagram, pixels, or catalogs too, finish this Business Manager path so those assets are assigned.",
    },
  ],
  relatedSlugs: ["meta-ads-access", "google-ads-access", "tiktok-ads-access"],
  extraResource: {
    href: "/guides/meta-ads-access",
    label: "Meta Ads access guide",
    before: "Need ad-account-only sharing without adding the whole business? See the",
  },
  ctaBody:
    "Skip People vs Partner guesswork. One link lets the client pick the Business Portfolio and the assets you actually need.",
  compareHref: "/compare/leadsie-alternative",
  compareLabel: "see how we compare to other tools",
};
