import type { GuideDefinition } from "./types";

export const tiktokAdsAccessGuide: GuideDefinition = {
  slug: "tiktok-ads-access",
  title: "How to Get TikTok Ads Access for Agencies",
  breadcrumbName: "TikTok Ads Access Guide",
  metaTitle: "TikTok Ads Access for Agencies: Business Center (2026)",
  metaDescription:
    "How to get TikTok Ads access: request the ad account from Business Center, or have the client add your Business Center ID as a partner. Operator is the usual campaign role.",
  keywords: [
    "TikTok Ads access for agencies",
    "TikTok Business Center access",
    "give agency access to TikTok Ads",
  ],
  updatedAt: "2026-10-10",
  updatedAtDisplay: "October 10, 2026",
  hubSummary:
    "Request the ad account from Business Center, or have the client add your Business Center ID as a partner.",
  heroSummary:
    "TikTok access lives in Business Center, not Ads Manager alone. Request the account or send a partner invite — or one AuthHub link.",
  quickAnswer:
    "From your TikTok Business Center, open Assets, Ad Accounts, then Request Access and enter the client's Ad Account ID with Operator or Admin. Or the client adds your Business Center ID under Users → Partners. Approvals often land in the TikTok app inbox, not email. Spark Ads still need a separate QR scan by the creator.",
  quickSteps: [
    "Have the client's Ad Account ID (Ads Manager) or your Business Center ID ready.",
    "Agency path: Business Center → Assets → Ad Accounts → Add → Request Access.",
    "Enter the Ad Account ID and choose Operator (campaigns) or Admin.",
    "Client path: Business Center → Users → Partners → Add Partner → your BC ID.",
    "Client approves in Business Center or the TikTok app Messages inbox.",
    "Confirm the ad account appears under your Business Center assets.",
  ],
  whyHeading: "Why TikTok Ads Access Is Its Own Workflow",
  whyBody:
    "TikTok Business Center owns the assets. Ads Manager is where campaigns run. A user is limited to three Business Centers, so plan which BC you invite people into. Partner linking lets a client keep their account and share it with more than one agency. Spark Ads that boost organic posts need a separate QR authorization from the TikTok account owner.",
  stepsHeading: "Step-by-Step: Requesting TikTok Ads Access",
  howToName: "How to Get TikTok Ads Access for Agencies",
  howToDescription:
    "Step-by-step guide for agencies to request TikTok Business Center ad account access from clients",
  howToSteps: [
    {
      name: "Collect the IDs",
      text: "Get the client's Ad Account ID from TikTok Ads Manager, and have your Business Center ID ready from Business Center settings.",
    },
    {
      name: "Request access or send a partner invite",
      text: "Either request the ad account from your Business Center (Assets → Ad Accounts → Request Access) or have the client add your Business Center as a partner and assign the account.",
    },
    {
      name: "Choose Operator or Admin",
      text: "Operator can create and edit ads without finance access. Admin includes financial management. Analyst is reports only.",
    },
    {
      name: "Client approves the request",
      text: "Client checks Business Center notifications and the TikTok app Messages inbox, then approves. Agency confirms the account under Assets.",
    },
  ],
  manualSteps: [
    "Create or open your agency TikTok Business Center at business.tiktok.com.",
    "To pull the account in: Assets → Ad Accounts → Add Ad Account → Request Access → enter Ad Account ID → Operator or Admin.",
    "Or have the client open Users → Partners → Add Partner, enter your Business Center ID, pick ad accounts, and send.",
    "Client approves in Business Center or TikTok app → Messages.",
    "If you need Spark Ads, request TikTok Account access and have the creator scan the QR code in the TikTok app.",
  ],
  manualTip:
    "Access requests often show in the TikTok app, not email. If the client 'never got it,' have them open Profile → Menu → Messages and look for Business Center.",
  authHubMethod:
    "Send one AuthHub link. The client signs in with TikTok and grants the ad account from the same invite as other platforms. Spark Ads QR scans still happen in TikTok when you boost organic posts.",
  problems: [
    {
      problem: "Request not received",
      solution:
        "Have the client check TikTok app Messages for Business Center notifications, not only email.",
    },
    {
      problem: "Account already linked to another Business Center",
      solution:
        "TikTok can link an ad account to more than one BC. Client links your BC ID from their Assets list instead of moving the account.",
    },
    {
      problem: "Wrong role after approval",
      solution: "Business Center → Users → the ad account → edit the member role. It applies immediately.",
    },
    {
      problem: "Business Center limit reached",
      solution:
        "A user can belong to three Business Centers. Invite teammates into an existing agency BC instead of creating another.",
    },
  ],
  permissions: {
    heading: "TikTok Ad Account Roles",
    columns: ["Role", "Create / edit ads", "Finance", "Use case"],
    rows: [
      ["Admin", "Yes", "Yes", "Account lead"],
      ["Operator", "Yes", "No", "Media buyers (usual agency role)"],
      ["Analyst", "No", "No", "Reporting only"],
    ],
  },
  checklistHeading: "TikTok Ads Access Checklist",
  checklist: [
    "Agency Business Center exists",
    "Client Ad Account ID or agency Business Center ID exchanged",
    "Operator or Admin chosen on purpose",
    "Client approved in app or Business Center",
    "Ad account visible under agency Assets",
    "Spark Ads QR planned with the creator if organic boosts are in scope",
  ],
  faqs: [
    {
      question: "How do I give an agency access to TikTok Ads?",
      answer:
        "In TikTok Business Center the client adds the agency as a partner with the agency Business Center ID, or the agency requests the Ad Account ID from Assets. The client approves in Business Center or the TikTok app inbox.",
    },
    {
      question: "What TikTok role should an agency get?",
      answer:
        "Operator is enough to create and edit ads without payment methods. Admin includes finance. Analyst is view-only. Keep Finance Manager with the client unless the contract includes billing.",
    },
    {
      question: "Why did the TikTok access request never show up?",
      answer:
        "Many approvals land in the TikTok mobile app under Messages, not in email. Also confirm the Ad Account ID and that the client is an admin on that Business Center.",
    },
    {
      question: "Do Spark Ads use the same TikTok access grant?",
      answer:
        "No. Boosting organic posts needs the TikTok account owner to scan a QR code in the app. Ad account Operator access does not replace that scan.",
    },
  ],
  relatedSlugs: ["meta-ads-access", "linkedin-ads-access", "google-ads-access"],
  ctaBody:
    "Put TikTok next to Meta and Google on one client link instead of trading Business Center IDs over email.",
  compareHref: "/compare/leadsie-alternative",
  compareLabel: "see how we compare to other tools",
};
