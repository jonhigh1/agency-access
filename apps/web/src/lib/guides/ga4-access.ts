import type { GuideDefinition } from "./types";

export const ga4AccessGuide: GuideDefinition = {
  slug: "ga4-access",
  title: "How to Get GA4 Access for Agencies",
  breadcrumbName: "GA4 Access Guide",
  metaTitle: "GA4 Access for Agencies: Property Authorization (2026)",
  metaDescription:
    "How to get GA4 access for agencies. Client opens Admin, then Account or Property Access Management, adds your Google email, and picks Editor or Administrator.",
  keywords: [
    "GA4 access for agencies",
    "Google Analytics 4 property access",
    "grant GA4 access to agency",
  ],
  updatedAt: "2026-10-10",
  updatedAtDisplay: "October 10, 2026",
  hubSummary:
    "Request the right GA4 property — not a leftover Universal Analytics duplicate — with Editor or Administrator access.",
  heroSummary:
    "Get the live GA4 property, not a migration leftover. Manual Admin steps below, or one Google sign-in that includes Analytics.",
  quickAnswer:
    "The client opens analytics.google.com, clicks Admin, then Account Access Management or Property Access Management, and adds your Google email. Pick Editor or Administrator so you can configure events and data streams. Confirm the Measurement ID matches the site before they click Add. Account-level access shows every property under that account.",
  quickSteps: [
    "Client opens Google Analytics and clicks Admin (bottom left).",
    "Confirm the property whose Measurement ID is on the live site.",
    "Open Account Access Management (all properties) or Property Access Management (one property).",
    "Click + and choose Add users.",
    "Enter the agency Google email and select Editor or Administrator.",
    "Click Add. You should see the property after a refresh.",
  ],
  whyHeading: "Why Agencies Need the Right GA4 Property",
  whyBody:
    "GA4 is not Universal Analytics. Clients often have several properties from migrations and tests. Access to the wrong property means you report on the wrong traffic. Analyst or Viewer can see reports but cannot configure events, conversions, or data streams — so request Editor unless you only need dashboards.",
  stepsHeading: "Step-by-Step: Requesting GA4 Access",
  howToName: "How to Get GA4 Access for Agencies",
  howToDescription:
    "Step-by-step guide for agencies to request Google Analytics 4 property access from clients",
  howToSteps: [
    {
      name: "Identify the live property",
      text: "Client opens analytics.google.com, clicks Admin, and checks Property Settings → Data Streams so the website URL and Measurement ID match the live site.",
    },
    {
      name: "Open access management",
      text: "For every property under the account, use Account Access Management. For one property only, use Property Access Management.",
    },
    {
      name: "Add the agency user",
      text: "Click +, choose Add users, enter the agency Google email, and select Editor or Administrator.",
    },
    {
      name: "Confirm the agency can configure",
      text: "Agency signs in to Google Analytics, opens the property, and checks they can see data streams and conversion settings — not just reports.",
    },
  ],
  manualSteps: [
    "Client goes to analytics.google.com and clicks Admin (bottom left).",
    "In Property Settings → Data Streams, they confirm the website URL and Measurement ID (G-XXXXXXXXXX) match the live site.",
    "They open Account Access Management to share every property, or Property Access Management to share one.",
    "They click +, choose Add users, enter the agency Google email, and select Editor or Administrator.",
    "They click Add. The agency refreshes Analytics and opens that property.",
  ],
  manualTip:
    "Ask the client for a screenshot of Property Settings showing name, Measurement ID, and website URL before they grant access. That prevents reporting on a duplicate migration property.",
  authHubMethod:
    "Send one AuthHub link. The client signs in with Google and can grant Google Ads and GA4 in the same OAuth. They still choose which properties to share. Optional intake questions ride on the same link.",
  problems: [
    {
      problem: "Access granted but the property is missing",
      solution:
        "Confirm the email, wait a few minutes, then check Account vs Property access. Sign out and back in.",
    },
    {
      problem: "You can see data but cannot configure events",
      solution:
        "You have Analyst or Viewer. Client updates you to Editor in Property Access Management.",
    },
    {
      problem: "Several GA4 properties, unclear which is live",
      solution:
        "Match the Measurement ID in the site source (G-XXXXXXXXXX) to Property Settings.",
    },
    {
      problem: "No permission to view this data stream",
      solution: "Data streams need Editor or Administrator. Viewer and Analyst cannot open them.",
    },
  ],
  permissions: {
    heading: "GA4 Permission Levels",
    columns: ["Level", "View reports", "Configure events / streams", "Manage users", "Use case"],
    rows: [
      ["Administrator", "Yes", "Yes", "Yes", "Full property or account control"],
      ["Editor", "Yes", "Yes", "No", "Campaign and analytics setup (usual agency role)"],
      ["Analyst", "Yes", "No", "No", "Reports and explorations only"],
      ["Viewer", "Yes", "No", "No", "Read-only dashboards"],
    ],
  },
  checklistHeading: "GA4 Access Checklist",
  checklist: [
    "Live Measurement ID confirmed against the website",
    "Account-level vs property-level access chosen on purpose",
    "Agency email has no typos",
    "Editor or Administrator selected",
    "Agency can open data streams after refresh",
  ],
  faqs: [
    {
      question: "How do I give an agency access to GA4?",
      answer:
        "In Google Analytics, open Admin, then Account or Property Access Management, add the agency's Google email, and choose Editor or Administrator. Analyst is not enough if they need to configure events.",
    },
    {
      question: "Should GA4 access be at the account or the property?",
      answer:
        "Account access shows every property under that Analytics account. Property access limits the agency to one property. Use property-level when the client has test or duplicate properties they do not want shared.",
    },
    {
      question: "What GA4 role does an agency need?",
      answer:
        "Editor can configure events, conversions, and data streams without managing other users. Administrator can also add users. Analyst and Viewer cannot change measurement setup.",
    },
    {
      question: "How do I know which GA4 property is on the website?",
      answer:
        "Find the G- Measurement ID in the site source or Tag Assistant, then match it in Admin → Property Settings. Do not assume the property with the client's company name is the live one.",
    },
  ],
  relatedSlugs: ["google-ads-access", "meta-ads-access", "linkedin-ads-access"],
  ctaBody:
    "Collect Google Ads and GA4 in one client link, with optional intake on the same flow.",
  compareHref: "/compare/leadsie-alternative",
  compareLabel: "see how we compare to other tools",
};
