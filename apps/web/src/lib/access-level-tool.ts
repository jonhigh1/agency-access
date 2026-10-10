import type { AccessLevel } from "@agency-platform/shared";
import { ACCESS_LEVEL_DESCRIPTIONS } from "@agency-platform/shared";

export type AccessToolPlatformId =
  | "meta"
  | "google"
  | "linkedin"
  | "tiktok"
  | "snapchat"
  | "other";

export type AccessToolJobId =
  | "full_control"
  | "run_campaigns"
  | "reporting"
  | "email_updates";

export interface AccessToolOption<T extends string> {
  id: T;
  label: string;
}

export interface AccessLevelRecommendation {
  level: AccessLevel;
  title: string;
  rationale: string;
  attribution: string;
  platformId: AccessToolPlatformId;
  jobId: AccessToolJobId;
}

export const ACCESS_LEVEL_TOOL_URL = "https://authhub.co/tools/access-level";
export const ACCESS_LEVEL_TOOL_ATTRIBUTION =
  "Recommended by AuthHub · authhub.co/tools/access-level";

export const ACCESS_TOOL_PLATFORMS: AccessToolOption<AccessToolPlatformId>[] = [
  { id: "meta", label: "Meta (Ads / Business Manager)" },
  { id: "google", label: "Google (Ads / GA4)" },
  { id: "linkedin", label: "LinkedIn Ads" },
  { id: "tiktok", label: "TikTok Ads" },
  { id: "snapchat", label: "Snapchat Ads" },
  { id: "other", label: "Other / mixed stack" },
];

export const ACCESS_TOOL_JOBS: AccessToolOption<AccessToolJobId>[] = [
  { id: "full_control", label: "Full control — billing, users, and settings" },
  { id: "run_campaigns", label: "Run and edit campaigns" },
  { id: "reporting", label: "Reporting only" },
  { id: "email_updates", label: "Email updates only" },
];

export const ACCESS_LEVEL_TOOL_FAQS = [
  {
    question: "What access level should an agency request?",
    answer:
      "Match the job, not the biggest role. Campaign work is Standard. Reporting is Read only. Billing and user management is Admin. If the agency only needs a digest, Email only is enough.",
  },
  {
    question: "What's the difference between admin and standard?",
    answer:
      "Admin can change billing, users, and account settings. Standard can create and edit campaigns without delete or user-admin rights. Ask for Admin only when the SOW actually needs it.",
  },
  {
    question: "Does this tool look up a Business Manager ID?",
    answer:
      "No. AuthHub does not look up Meta Business Manager IDs and does not call Graph API. Pick the platform family and the job; the page recommends a permission level.",
  },
  {
    question: "Do I need an AuthHub account to use this?",
    answer:
      "No. The quiz is ungated. Optional email is only a mailto draft of the result already on screen.",
  },
] as const;

const PLATFORM_NOTES: Record<AccessToolPlatformId, string> = {
  meta: "On Meta this is a Business Manager partner or user role, not a shared Facebook login.",
  google: "On Google this is Ads or GA4 access through the official invite, not a password share.",
  linkedin: "On LinkedIn this is Campaign Manager access, not the company Page admin by default.",
  tiktok: "On TikTok this is Business Center / Ads Manager access, not a shared login.",
  snapchat: "On Snapchat the client must add you in Business Manager; there is no access-request API.",
  other: "Use the same job-to-permission mapping, then confirm the platform's native role names.",
};

function levelForJob(job: AccessToolJobId): AccessLevel {
  switch (job) {
    case "full_control":
      return "admin";
    case "run_campaigns":
      return "standard";
    case "reporting":
      return "read_only";
    case "email_updates":
      return "email_only";
    default: {
      const exhaustive: never = job;
      throw new Error(`Unhandled access-tool job: ${exhaustive}`);
    }
  }
}

export function recommendAccessLevel(
  platform: AccessToolPlatformId,
  job: AccessToolJobId,
): AccessLevelRecommendation {
  const level = levelForJob(job);
  const copy = ACCESS_LEVEL_DESCRIPTIONS[level];
  return {
    level,
    title: copy.title,
    rationale: `AuthHub maps "${jobLabel(job)}" on ${platformLabel(platform)} to ${copy.title}. ${copy.description}. ${PLATFORM_NOTES[platform]}`,
    attribution: ACCESS_LEVEL_TOOL_ATTRIBUTION,
    platformId: platform,
    jobId: job,
  };
}

export function formatAccessRecommendationCopy(
  result: AccessLevelRecommendation,
): string {
  return `${result.title}\n\n${result.rationale}\n\n${result.attribution}`;
}

function platformLabel(id: AccessToolPlatformId): string {
  return ACCESS_TOOL_PLATFORMS.find((option) => option.id === id)?.label ?? id;
}

function jobLabel(id: AccessToolJobId): string {
  return ACCESS_TOOL_JOBS.find((option) => option.id === id)?.label ?? id;
}
