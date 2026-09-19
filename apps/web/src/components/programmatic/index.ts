/**
 * Programmatic SEO Components Index
 * Export all programmatic content generation components and utilities
 */

// Components
export { BlogPostTemplate } from "./BlogPostTemplate";
export { ComparisonPageTemplate } from "./ComparisonPageTemplate";
export { LeadsiePricingPageTemplate } from "./LeadsiePricingPageTemplate";

// Types
export type {
  ProgrammaticBlogPost,
  ProgrammaticComparisonPage,
  BlogCategory,
  BlogStage,
  BlogContentType,
  BlogAuthor,
  BlogKeywords,
  BlogFAQ,
  BlogInternalLink,
  BlogFeaturedImage,
  BlogCTA,
  BlogTestimonial,
  CompetitorData,
  OurProductData,
  ComparisonFramework,
  ComparisonPainPoint,
  QuickComparisonRow,
  DetailedComparisonCategory,
  ComparisonRecommendations,
  MigrationStep,
  ComparisonTestimonial,
  PricingComparison,
  ComparisonCTA,
  HubPage,
} from "@/lib/programmatic-types";

// Schema generators
export {
  generateBlogPostSchema,
  generateBlogListSchema,
  generateComparisonSchema,
  generateLeadsiePricingSchema,
  generateFAQSchema,
  generateHowToSchema,
  generateOrganizationSchema,
  schemaToJSONLD,
  combineSchemas,
} from "@/lib/schema-generators";

export type {
  BlogSchemaOptions,
  ComparisonSchemaOptions,
  HowToStep,
} from "@/lib/schema-generators";
