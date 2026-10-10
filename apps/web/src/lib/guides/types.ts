export interface GuideFaq {
  question: string;
  answer: string;
}

export interface GuideHowToStep {
  name: string;
  text: string;
}

export interface GuideProblem {
  problem: string;
  solution: string;
}

export interface GuidePermissionTable {
  heading: string;
  columns: string[];
  rows: string[][];
}

export interface GuideDefinition {
  slug: string;
  title: string;
  breadcrumbName: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  updatedAt: string;
  updatedAtDisplay: string;
  hubSummary: string;
  heroSummary: string;
  quickAnswer: string;
  quickSteps: string[];
  whyHeading: string;
  whyBody: string;
  stepsHeading: string;
  howToName: string;
  howToDescription: string;
  howToSteps: GuideHowToStep[];
  manualSteps: string[];
  manualTip?: string;
  authHubMethod: string;
  problems: GuideProblem[];
  problemsSourceHref?: string;
  problemsSourceLabel?: string;
  permissions?: GuidePermissionTable;
  checklistHeading: string;
  checklist: string[];
  faqs: GuideFaq[];
  relatedSlugs: string[];
  extraResource?: { href: string; label: string; before: string };
  ctaBody: string;
  compareHref: string;
  compareLabel: string;
}
