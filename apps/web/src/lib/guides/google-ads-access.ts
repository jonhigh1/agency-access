import type { GuideDefinition } from "./types";

export const googleAdsAccessGuide: GuideDefinition = {
  slug: "google-ads-access",
  title: "How to Get Google Ads Access for Agencies",
  breadcrumbName: "Google Ads Access Guide",
  metaTitle: "How to Get Google Ads Access for Agencies (2026 Guide)",
  metaDescription:
    "How to request Google Ads access: client signs in, goes to Tools & Settings → Access and security, adds your email, chooses a role. Or use one link and get access in 5 minutes.",
  keywords: [
    "how to request google ads access",
    "give google ads access to agency",
    "google ads access for agency",
  ],
  updatedAt: "2026-10-10",
  updatedAtDisplay: "October 10, 2026",
  hubSummary:
    "Request Google Ads manager access from clients: Customer ID, Access and security, roles — or send one link.",
  heroSummary:
    "Give your agency access to client Google Ads accounts in minutes. Manual steps below, or one link that does it for you.",
  quickAnswer:
    "The client signs in to Google Ads, opens Tools and Settings, then Access and security, and adds your Google email. They pick Admin, Standard, or Read-only and send the invite. You accept from email or inside Google Ads. For several accounts, add the user on the MCC so every linked account is visible.",
  quickSteps: [
    "Client signs in to Google Ads.",
    "Click Tools & Settings (wrench icon, top right), then under Setup choose Access and security.",
    "Click the plus (+) button to add a user.",
    "Enter the agency user's email address.",
    "Choose access level: Admin, Standard, or Read-only.",
    "Send the invitation; the agency accepts from the email or in Google Ads.",
  ],
  whyHeading: "Why Agencies Need Google Ads Access",
  whyBody:
    "Most paid search runs through Google Ads. To manage campaigns, build reports, or optimize for a client, you need access to their account. The manual way works but costs time: clients get lost in the UI, send the wrong permissions, or forget to accept. That back-and-forth can burn a day or two per client. A clear process (or a single link that handles it) cuts that to minutes.",
  stepsHeading: "Step-by-Step: Requesting Google Ads Access",
  howToName: "How to Get Google Ads Access for Agencies",
  howToDescription:
    "Step-by-step guide for agencies to request Google Ads manager account access from clients",
  howToSteps: [
    {
      name: "Get the Agency's Customer ID",
      text: "Find your agency's 10-digit Customer ID in Google Ads under Tools and Settings > Account Setup.",
    },
    {
      name: "Send the Access Request Link",
      text: "Send your client the link: ads.google.com/home/tools/account-access. This opens the Access and Security page.",
    },
    {
      name: "Client Adds Your Account",
      text: "Client clicks the + button on the Access and Security page, selects 'Manage access' or 'Admin' access level, and enters your agency's Customer ID.",
    },
    {
      name: "Review and Confirm",
      text: "Client reviews the access level and permissions, then clicks Send Request.",
    },
    {
      name: "Accept the Request",
      text: "Agency accepts the request in Google Ads under Tools and Settings > Account Access. Access is now active.",
    },
  ],
  manualSteps: [
    "The client signs in to Google Ads at ads.google.com.",
    "Click the wrench icon (Tools & Settings) in the top right. Under Setup, open Access and security.",
    "Click the plus (+) button to add a user. Enter the agency team member's Google email.",
    "Choose the role: Admin (full control), Standard (create and edit campaigns), or Read-only (reports only).",
    "Send the invitation. The agency receives an email and must accept in Google Ads or from the link.",
  ],
  manualTip:
    "If the client manages multiple accounts (e.g. MCC), they must add the user in the correct account or at the MCC level so you see all accounts they want to share.",
  authHubMethod:
    "Send the client one link. They sign in with Google once; you get access to the accounts they choose. You can add optional intake questions in the same flow so you get access and client info in a single step. No chasing separate invites or forms.",
  problems: [
    {
      problem: "Client can't find Access and security",
      solution: "Tools & Settings (wrench icon, top right) → Under Setup, Access and security.",
    },
    {
      problem: "Wrong account or multiple Google Ads accounts",
      solution:
        "Check which account is selected at the top of the UI. Add the user in the correct account, or at MCC level if they manage many.",
    },
    {
      problem: "Invitation not received",
      solution:
        "Check spam; ensure the email matches the one used in Google Ads. Client can resend from Access and security.",
    },
    {
      problem: "Need MCC vs single-account access",
      solution:
        "For multiple accounts, add the user at the Manager (MCC) level so they see all linked accounts. For one account, add at that account level.",
    },
  ],
  problemsSourceHref: "https://support.google.com/google-ads/answer/6139186",
  problemsSourceLabel: "Google Ads Help – Add or remove users",
  permissions: {
    heading: "Google Ads Access Roles",
    columns: ["Role", "Create / edit campaigns", "Manage users", "Billing", "Use case"],
    rows: [
      ["Admin", "Yes", "Yes", "Yes", "Full account control"],
      ["Standard", "Yes", "No", "No", "Day-to-day campaign work"],
      ["Read-only", "No", "No", "No", "Reporting only"],
    ],
  },
  checklistHeading: "Google Ads Access Checklist",
  checklist: [
    "Client is signed in to the correct Google Ads account",
    "Agency email is correct (no typos)",
    "Role chosen: Admin, Standard, or Read-only",
    "Invitation accepted on the agency side",
    "If using AuthHub: one link sent, client completed the flow",
  ],
  faqs: [
    {
      question: "How do I give an agency access to my Google Ads?",
      answer:
        "In Google Ads, go to Tools & Settings → Access and security, then add the agency's email and pick Admin, Standard, or Read-only. They get an email invite and accept.",
    },
    {
      question: "Should an agency get Admin or Standard access in Google Ads?",
      answer:
        "Standard is enough to create and edit campaigns. Admin can manage users and billing. Read-only is reports only. Most retainers should start at Standard unless the agency also owns billing.",
    },
    {
      question: "How do I grant Google Ads access across an MCC?",
      answer:
        "Add the agency at the Manager (MCC) level so they see every linked account the client wants to share. Adding them on one child account hides the rest of the MCC.",
    },
    {
      question: "The Google Ads invitation never arrived. What now?",
      answer:
        "Confirm the email is the Google account the agency uses in Google Ads, check spam, then resend from Access and security. The invite lives on that page even if the email is missing.",
    },
  ],
  relatedSlugs: ["meta-ads-access", "ga4-access", "linkedin-ads-access"],
  ctaBody:
    "Save 2–3 days per client with a single link that handles Google Ads and other platforms, plus optional intake. One flow, one link.",
  compareHref: "/compare/leadsie-alternative",
  compareLabel: "see how we compare to other tools",
};
