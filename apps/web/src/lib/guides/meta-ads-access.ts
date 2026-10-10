import type { GuideDefinition } from "./types";

export const metaAdsAccessGuide: GuideDefinition = {
  slug: "meta-ads-access",
  title: "How to Get Meta Ads Access for Agencies",
  breadcrumbName: "Meta Ads Access Guide",
  metaTitle: "How to Get Meta Ads Access for Agencies: Guide 2026",
  metaDescription:
    "How to get Meta Ads access: Client opens Meta Business Suite → Business Settings → Accounts → Ad Accounts → Add People → Add a Partner → Enter Business ID → Choose permissions. Manual: 6 steps. Or one link in 5 minutes.",
  keywords: [
    "Meta ads access for agencies",
    "Facebook Business Manager access for agencies",
    "give agency access to Meta Ads",
    "how to request Meta Ads access",
  ],
  updatedAt: "2026-10-10",
  updatedAtDisplay: "October 10, 2026",
  hubSummary:
    "Give your agency access to client Facebook and Instagram ad accounts. Manual Business Manager steps, or one AuthHub link.",
  heroSummary:
    "Give your agency access to client Facebook and Instagram ad accounts. Manual steps below, or one link that does it for you.",
  quickAnswer:
    "Client opens Meta Business Suite, then Business Settings, Accounts, and Ad Accounts. They add a partner with your Business ID, choose a permission, and confirm. You accept the request under Partner Requests. That path covers Facebook and Instagram ad accounts owned by the same Business.",
  quickSteps: [
    "Client opens Meta Business Suite",
    "Goes to Business Settings (gear icon)",
    "Navigates to Accounts → Ad Accounts",
    "Selects ad account(s) to share",
    "Clicks Add People → Add a Partner",
    "Enters your Business ID",
    "Chooses permissions (Admin, Advertiser, Analyst, Campaign Analyst)",
    "Clicks Confirm",
    "You accept in Business Settings → Users → Partner Requests",
  ],
  whyHeading: "Why Agencies Need Meta Ads Access",
  whyBody:
    "Meta Ads (Facebook and Instagram) is the largest social ad platform. Most clients run ads on one or both. Without access, you can't create campaigns, manage creatives, or optimize performance. The manual process works but Meta's interface is complex—Business Manager vs Business Suite, multiple ad accounts, different permission levels, previous agency partners to remove.",
  stepsHeading: "Step-by-Step: Requesting Meta Ads Access",
  howToName: "How to Get Meta Ads Access for Agencies",
  howToDescription:
    "Step-by-step guide to request Meta Ads access from clients through Meta Business Suite",
  howToSteps: [
    {
      name: "Open Meta Business Suite",
      text: "Client opens Meta Business Suite at business.facebook.com and logs in with their Facebook account.",
    },
    {
      name: "Navigate to Business Settings",
      text: "Click Business Settings (gear icon) in the left sidebar.",
    },
    {
      name: "Select Ad Accounts",
      text: "Go to Accounts → Ad Accounts and select the ad account(s) to share with the agency.",
    },
    {
      name: "Add Agency as Partner",
      text: "Click Add People → Add a Partner, then enter the agency's Business ID.",
    },
    {
      name: "Choose Permission Level",
      text: "Select Admin (full control), Ad Account Advertiser (create/edit campaigns, recommended), Analyst (view-only), or Campaign Analyst (view specific campaigns).",
    },
    {
      name: "Confirm and Accept",
      text: "Client clicks Confirm. Agency accepts the partner request in Business Settings → Users → Partner Requests.",
    },
  ],
  manualSteps: [
    "Client opens Meta Business Suite (business.facebook.com) and logs in.",
    "Navigates to Business Settings (gear icon, left sidebar).",
    "Goes to Accounts → Ad Accounts and selects the ad account(s) to share.",
    "Clicks Add People → Add a Partner, enters your agency's Business ID.",
    "Chooses permission level: Admin (full control including billing), Ad Account Advertiser (create and edit campaigns, recommended), Analyst (view-only reporting), or Campaign Analyst (view specific campaigns only).",
    "Client clicks Confirm. Agency accepts in Business Settings → Users → Partner Requests.",
  ],
  manualTip:
    "Multiple Business Managers? Grant access from each or consolidate first. Previous agency still has access? Client must remove them first: Business Settings → Users → Partner Accounts → Remove.",
  authHubMethod:
    "Send one link. Client signs in with Facebook, chooses the correct Business Portfolio, and selects Ad Accounts and Pages. AuthHub verifies the requested access and identifies linked professional Instagram relationships or any manual follow-up. Add optional intake questions to the same flow.",
  problems: [
    { problem: "Client can't find Business Settings", solution: "Click gear icon in left sidebar" },
    {
      problem: '"I don\'t see your request"',
      solution: "Check Business Settings → Users → Partner Requests. Expires after 30 days.",
    },
    {
      problem: "Multiple Business Managers",
      solution: "Grant access from each or consolidate ad accounts first",
    },
    {
      problem: "Previous agency still has access",
      solution: "Client removes them: Business Settings → Users → Partner Accounts → Remove",
    },
    {
      problem: "Wrong permission level",
      solution: "Use Ad Account Advertiser (create/edit), not Admin (includes billing)",
    },
    {
      problem: '"Which Business ID should I use?"',
      solution: "Business Settings → Business Info (16-digit number)",
    },
    {
      problem: "Ad account not showing",
      solution: "Client selected wrong account before adding you",
    },
    {
      problem: "Client doesn't have Business Manager",
      solution: "Create one at business.facebook.com first. Can't grant access from personal profiles.",
    },
  ],
  permissions: {
    heading: "Meta Ads Access Permissions Explained",
    columns: [
      "Permission Level",
      "Create Campaigns",
      "Edit Campaigns",
      "Delete",
      "View Billing",
      "Use Case",
    ],
    rows: [
      ["Admin", "Yes", "Yes", "Yes", "Yes", "Full account management"],
      [
        "Ad Account Advertiser",
        "Yes",
        "Yes",
        "No",
        "No",
        "Campaign management (most common)",
      ],
      ["Analyst", "No", "No", "No", "No", "Reporting and insights only"],
      ["Campaign Analyst", "No", "No", "No", "No", "View specific campaigns only"],
    ],
  },
  checklistHeading: "Meta Ads Access Checklist",
  checklist: [
    "Client has Meta Business Suite account",
    "Agency has provided Business ID",
    "Client knows which ad accounts to share",
    "Previous agency partners removed (if applicable)",
    "Correct permission level selected",
    "Partner invitation sent",
    "Agency accepted invitation",
    "Access verified: Can you see campaigns? Can you edit?",
    "Screenshot account overview for records",
    "Document Business Manager name and ad account IDs",
  ],
  faqs: [
    {
      question: "How do I give an agency access to my Facebook ad account?",
      answer:
        "Meta Business Suite → Business Settings → Accounts → Ad Accounts → select account → Add People → Add a Partner → enter Business ID → choose permissions → confirm. Agency accepts from their Business Settings.",
    },
    {
      question: "What Meta Ads permission should an agency get?",
      answer:
        "Ad Account Advertiser is the usual agency role: create and edit campaigns without billing. Use Admin only when the agency must manage payment methods. Analyst and Campaign Analyst are view-only.",
    },
    {
      question: "Where do I find a Meta Business ID?",
      answer:
        "In Meta Business Settings, open Business Info. The Business ID is the 16-digit number for that Business Portfolio. The agency needs that ID for a partner request, not a personal Facebook profile ID.",
    },
    {
      question: "What if a previous agency still has Meta access?",
      answer:
        "The client removes them in Business Settings → Users → Partner Accounts. Until that partner is removed, you can share an ad account and still collide with old users, pixels, or catalogs.",
    },
    {
      question: "Can a client grant Meta Ads access from a personal profile?",
      answer:
        "No. Access has to come from a Business Portfolio (Business Manager / Business Suite). If the client only has a personal ad account, they create a Business at business.facebook.com first, then add you as a partner.",
    },
  ],
  relatedSlugs: [
    "google-ads-access",
    "facebook-business-manager-access",
    "ga4-access",
  ],
  extraResource: {
    href: "/blog/client-onboarding-checklist",
    label: "Client Onboarding Checklist",
    before: "Getting Meta Ads access is just one step. Download our complete",
  },
  ctaBody:
    "Get Meta Ads access and intake forms in one link. No Business ID hunting. No expired invitations.",
  compareHref: "/compare/leadsie-alternative",
  compareLabel: "see how we compare to other tools",
};
