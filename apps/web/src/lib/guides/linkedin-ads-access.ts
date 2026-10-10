import type { GuideDefinition } from "./types";

export const linkedinAdsAccessGuide: GuideDefinition = {
  slug: "linkedin-ads-access",
  title: "How to Get LinkedIn Ads Access for Agencies",
  breadcrumbName: "LinkedIn Ads Access Guide",
  metaTitle: "LinkedIn Ads Access for Agencies: Campaign Manager (2026)",
  metaDescription:
    "How to get LinkedIn Ads access: connect on LinkedIn, open Campaign Manager, Manage Access, add the agency, and assign Campaign Manager. Page access is a separate grant.",
  keywords: [
    "LinkedIn Ads access for agencies",
    "LinkedIn Campaign Manager access",
    "give agency access to LinkedIn Ads",
  ],
  updatedAt: "2026-10-10",
  updatedAtDisplay: "October 10, 2026",
  hubSummary:
    "Campaign Manager roles are separate from Company Page roles. Connect first, then grant Campaign Manager.",
  heroSummary:
    "LinkedIn splits Company Page access and Ad Account access. Connect, then grant the ad account role — or send one AuthHub link.",
  quickAnswer:
    "You and the client must be connected on LinkedIn first. The client opens Campaign Manager, Account Settings, then Manage Access, searches for you, and assigns Campaign Manager. Company Page access is a different grant and does not include ads. Accept the invitation in Campaign Manager before you expect the account to appear.",
  quickSteps: [
    "Connect with the client on LinkedIn if you are not already connected.",
    "Client opens linkedin.com/campaignmanager (or /adaccount) and signs in.",
    "Client opens Account Settings (gear) → Manage Access.",
    "Client clicks Add people and searches your name or email.",
    "Client assigns Campaign Manager (or Viewer / Account Manager as needed).",
    "You accept the invitation and confirm the ad account appears.",
  ],
  whyHeading: "Why LinkedIn Ads Access Trips Agencies Up",
  whyBody:
    "Company Page permissions and Ad Account permissions are separate systems. Page admin does not let you run Sponsored Content. LinkedIn also requires a first-degree connection before the client can find you in Manage Access. Request the ad account role you need, and a page role only if you will post organic content.",
  stepsHeading: "Step-by-Step: Requesting LinkedIn Ads Access",
  howToName: "How to Get LinkedIn Ads Access for Agencies",
  howToDescription:
    "Step-by-step guide for agencies to request LinkedIn Campaign Manager access from clients",
  howToSteps: [
    {
      name: "Connect on LinkedIn",
      text: "Send a connection request to the client contact if you are not already connected. They cannot add you in Campaign Manager until that connection exists.",
    },
    {
      name: "Open Campaign Manager",
      text: "Client goes to Campaign Manager, selects the correct ad account, and opens Account Settings → Manage Access.",
    },
    {
      name: "Add the agency and choose a role",
      text: "Client clicks Add people, searches your profile, and assigns Viewer, Creative Manager, Campaign Manager, Account Manager, or Account Billing Admin.",
    },
    {
      name: "Accept the invitation",
      text: "Agency accepts from LinkedIn notifications or Campaign Manager. The client's ad account should then appear in the agency account list.",
    },
  ],
  manualSteps: [
    "Confirm you and the client contact are connected on LinkedIn.",
    "Client opens Campaign Manager and selects the ad account to share.",
    "Client clicks the gear (Account Settings) and chooses Manage Access.",
    "Client clicks Add people, searches your name or work email, and selects a role. Campaign Manager is the usual agency role.",
    "Client sends the invitation. You accept it in Campaign Manager.",
  ],
  manualTip:
    "If you do not appear in search, the connection is missing or you are searching the wrong ad account. Page admin is not a substitute for an ad account role.",
  authHubMethod:
    "Send one AuthHub link. The client signs in with LinkedIn and can authorize LinkedIn Ads (and Pages when requested) without hunting Manage Access. Optional intake questions stay on the same link.",
  problems: [
    {
      problem: "Agency does not appear when adding people",
      solution: "Connect on LinkedIn first, then retry Manage Access on the correct ad account.",
    },
    {
      problem: "You can post on the Page but cannot see ads",
      solution: "Grant a Campaign Manager ad account role. Page roles do not include paid access.",
    },
    {
      problem: "Invitation accepted but account missing",
      solution: "Switch ad accounts in the Campaign Manager picker. Confirm you accepted on the same LinkedIn user the client added.",
    },
    {
      problem: "Need billing vs campaign work",
      solution:
        "Campaign Manager cannot touch billing. Account Billing Admin is usually the client. Account Manager can manage users without billing.",
    },
  ],
  permissions: {
    heading: "LinkedIn Ads Roles",
    columns: ["Role", "View", "Create / edit campaigns", "Manage users", "Billing", "Use case"],
    rows: [
      ["Viewer", "Yes", "No", "No", "No", "Reporting only"],
      ["Creative Manager", "Yes", "Creatives only", "No", "No", "Ad creative teams"],
      ["Campaign Manager", "Yes", "Yes", "No", "No", "Usual agency media buying"],
      ["Account Manager", "Yes", "Yes", "Yes", "No", "Agency lead on the account"],
      ["Account Billing Admin", "Yes", "Yes", "Yes", "Yes", "Usually the client; one per account"],
    ],
  },
  checklistHeading: "LinkedIn Ads Access Checklist",
  checklist: [
    "First-degree LinkedIn connection with the client contact",
    "Correct ad account selected (clients often have more than one)",
    "Campaign Manager role (or Viewer / Account Manager as scoped)",
    "Company Page role requested only if organic posting is in scope",
    "Invitation accepted and account visible in Campaign Manager",
  ],
  faqs: [
    {
      question: "How do I give an agency access to LinkedIn Ads?",
      answer:
        "Connect with them on LinkedIn, then in Campaign Manager open Account Settings → Manage Access, add their profile, and assign Campaign Manager. They must accept the invitation.",
    },
    {
      question: "Does Company Page admin include LinkedIn Ads access?",
      answer:
        "No. Page roles cover organic posting and page analytics. Sponsored campaigns need a separate Ad Account role in Campaign Manager.",
    },
    {
      question: "What LinkedIn Ads role should an agency request?",
      answer:
        "Campaign Manager for creating and editing campaigns without billing. Viewer for reporting. Account Manager if the agency lead must add teammates. Leave Account Billing Admin with the client.",
    },
    {
      question: "Why can't the client find me when adding LinkedIn access?",
      answer:
        "LinkedIn only lists first-degree connections in that search. Send a connection request, wait for accept, then try Manage Access again on the right ad account.",
    },
  ],
  relatedSlugs: ["meta-ads-access", "google-ads-access", "tiktok-ads-access"],
  ctaBody:
    "Skip the connection-and-Manage-Access loop. Send one link for LinkedIn Ads and the other platforms on the request.",
  compareHref: "/compare/leadsie-alternative",
  compareLabel: "see how we compare to other tools",
};
