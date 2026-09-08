/**
 * Programmatic SEO Content Types
 * Extended types for blog posts and comparison pages optimized for SEO, GEO, and conversions
 */

// =============================================================================
// BLOG POST TYPES
// =============================================================================

export type BlogCategory =
  | "onboarding"
  | "tutorials"
  | "comparisons"
  | "security"
  | "operations"
  | "case-studies"
  | "research";

export type BlogStage = "awareness" | "consideration" | "decision";

export type BlogContentType = "tutorial" | "guide" | "listicle" | "case-study" | "comparison";

export interface BlogAuthor {
  name: string;
  role: string;
  bio: string;                    // 100-150 words with credentials for E-E-A-T
  avatar?: string;
  url?: string;                   // Author page link
}

export interface BlogKeywords {
  primary: string;
  secondary: string[];
  longTail: string[];
}

export interface BlogFAQ {
  question: string;
  answer: string;                 // 40-60 words each for featured snippets
}

export interface BlogInternalLink {
  anchorText: string;
  targetSlug: string;
}

export interface BlogFeaturedImage {
  url: string;
  alt: string;                    // Descriptive, includes keyword
  caption?: string;
}

export interface BlogCTA {
  headline: string;
  body: string;
  buttonText: string;
  buttonLink: string;
  variant?: "brutalist" | "brutalist-rounded" | "primary";
}

export interface BlogTestimonial {
  quote: string;
  author: string;
  company: string;
  role?: string;
  metric?: string;                // "Saved 12 hours/month"
  avatar?: string;
}

/**
 * Programmatic Blog Post - Full definition for SEO-optimized content
 */
export interface ProgrammaticBlogPost {
  // Core metadata
  id: string;
  slug: string;
  title: string;                  // H1, 50-60 chars, keyword at start
  metaTitle: string;              // 50-60 chars for SERP
  metaDescription: string;        // 105-155 chars with CTA

  // Content structure
  excerpt: string;                // 150-200 chars for cards
  directAnswer: string;           // 40-60 words - GEO optimized answer (first 100 words)
  content: string;                // Full markdown content

  // Classification
  category: BlogCategory;
  stage: BlogStage;
  contentType: BlogContentType;

  // Author & E-E-A-T
  author: BlogAuthor;

  // Dates
  publishedAt: string;
  updatedAt: string;              // Always show last updated for freshness

  // Reading metrics
  readTime: number;               // Minutes
  wordCount: number;              // Target: 2000-3000 for informational

  // SEO elements
  keywords: BlogKeywords;

  // Schema data
  faqs: BlogFAQ[];

  // Internal linking
  relatedPosts: string[];         // IDs of related posts (2-4 recommended)
  hubPage?: string;               // Parent hub page slug
  internalLinks: BlogInternalLink[];

  // Media
  featuredImage?: BlogFeaturedImage;

  // Conversion elements
  cta: BlogCTA;

  // Social proof
  testimonial?: BlogTestimonial;

  // Tags for filtering
  tags: string[];

  // Programmatic flags
  isProgrammatic?: boolean;
  templateId?: string;            // Reference to template used
  dataSource?: string;            // Where data came from
}

// =============================================================================
// COMPARISON PAGE TYPES
// =============================================================================

export type ComparisonFramework = "PAS" | "AIDA" | "BAB";

export interface CompetitorPricing {
  starting: number;
  currency: string;
  billing: "monthly" | "yearly" | "usage";
  starter?: { price: number; features: string[] };
  pro?: { price: number; features: string[] };
  enterprise?: { price: string; features: string[] };
}

export interface CompetitorData {
  name: string;
  tagline: string;
  logo: string;
  website: string;
  pricing: CompetitorPricing;
  founded?: string;
  location?: string;
  platforms: string[];            // Supported platforms
  weaknesses: string[];           // Known limitations
  strengths: string[];            // Known strengths
}

export interface OurProductData {
  name: string;                   // Always "AuthHub"
  tagline: string;
  logo: string;
  pricing: {
    starting: number;
    currency: string;
    billing: "monthly";
    starter: { price: number; features: string[] };
    pro: { price: number; features: string[] };
    enterprise: { price: string; features: string[] };
  };
  differentiators: string[];
  platforms: string[];
}

export interface ComparisonPainPoint {
  title: string;
  icon: string;                   // Lucide icon name
  quote: string;                  // Customer quote
  description: string;
  solution: string;
}

export interface QuickComparisonRow {
  feature: string;
  competitor: string | boolean;
  authhub: string | boolean;
  winner?: "competitor" | "authhub" | "tie";
  isExclusive?: boolean;          // AuthHub exclusive feature
}

export interface DetailedComparisonCategory {
  category: string;
  features: Array<{
    name: string;
    competitor: string | boolean;
    authhub: string | boolean;
    notes?: string;
  }>;
}

export interface ComparisonRecommendations {
  stickWithCompetitor: string[];  // When NOT to switch (honesty builds trust)
  switchToAuthHub: string[];      // When TO switch
}

export interface MigrationStep {
  step: number;
  title: string;
  description: string;
  icon?: string;
}

export interface ComparisonTestimonial {
  quote: string;
  author: string;
  company: string;
  role?: string;
  previousTool?: string;          // "Former {Competitor} user"
  avatar?: string;
  metric?: string;
}

export interface PricingComparison {
  competitor: CompetitorPricing;
  authhub: {
    starter: { price: number; features: string[] };
    pro: { price: number; features: string[] };
    enterprise: { price: string; features: string[] };
  };
  savings: {
    monthly: number;
    yearly: number;
    percentage?: number;
  };
}

export interface ComparisonPricingScenario {
  clients: string;
  competitorPlan: string;
  competitorCost: string;
  authHubPlan: string;
  authHubCost: string;
}

export interface ComparisonCTA {
  headline: string;
  subheadline: string;
  primaryButton: string;
  primaryLink?: string;
  secondaryButton?: string;
  secondaryLink?: string;
  guarantee?: string;
}

export interface ComparisonValueCallout {
  headline: string;
  body: string;
}

/**
 * Programmatic Comparison Page - Full definition for VS/Alternative pages
 */
export interface ProgrammaticComparisonPage {
  // Core metadata
  id: string;
  slug: string;
  title: string;                  // "{Competitor} Alternative | Why Agencies Switch"
  metaTitle: string;              // 50-60 chars
  metaDescription: string;        // 105-155 chars with value prop

  // Competitor data
  competitor: CompetitorData;

  // Our data (AuthHub)
  ourProduct: OurProductData;

  // Content structure
  excerpt: string;                // Executive summary (150-200 words)
  content: string;                // Full markdown content

  // Framework choice
  framework: ComparisonFramework;

  // Pain points (PAS framework)
  painPoints: ComparisonPainPoint[];

  // Comparison data
  quickComparison: QuickComparisonRow[];
  detailedComparison: DetailedComparisonCategory[];

  // Use case recommendations
  recommendations: ComparisonRecommendations;

  // Migration support
  migrationSteps: MigrationStep[];
  migrationTimeMinutes?: number;  // e.g., 15

  // Social proof
  testimonials: ComparisonTestimonial[];
  customerCount?: number;
  hoursSavedMetric?: number;

  // Pricing comparison
  pricingComparison: PricingComparison;

  /** Competitor-specific pricing callout (headline + body under pricing cards) */
  valueCallout?: ComparisonValueCallout;

  /** Subtitle under competitor starting price (e.g. Leadsie tier ladder) */
  competitorPricingSubtitle?: string;

  /** Highlight line under AuthHub starting price (e.g. savings vs competitor tier) */
  authhubSavingsHighlight?: string;

  /** Worked pricing examples for competitor-specific credit/pricing searches */
  pricingScenarios?: ComparisonPricingScenario[];
  pricingScenariosNote?: string;

  // FAQ
  faqs: BlogFAQ[];

  // SEO
  keywords: string[];
  relatedComparisons: string[];   // Slugs of other comparison pages
  relatedBlogPosts: string[];     // Slugs of related blog posts

  // CTA
  cta: ComparisonCTA;

  // Programmatic flags
  isProgrammatic?: boolean;
  templateId?: string;
  lastVerified?: string;          // When competitor data was last verified
}

// =============================================================================
// HUB PAGE TYPES
// =============================================================================

export interface HubPage {
  id: string;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  content: string;                // 2,500+ words
  spokePages: string[];           // Slugs of spoke pages
  category: BlogCategory;
}

// =============================================================================
// HELPER TYPES
// =============================================================================

export type ContentStatus = "draft" | "review" | "published" | "archived";

export interface ContentMetrics {
  pageViews?: number;
  avgTimeOnPage?: number;
  bounceRate?: number;
  conversionRate?: number;
  keywordRankings?: Record<string, number>;
  lastUpdated: string;
}
