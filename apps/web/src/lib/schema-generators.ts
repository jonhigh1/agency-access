/**
 * Schema.org JSON-LD Generators for Programmatic SEO
 * Generates structured data for blog posts, comparison pages, and FAQs
 */

import type {
  ProgrammaticBlogPost,
  ProgrammaticComparisonPage,
  BlogFAQ,
} from "./programmatic-types";

// =============================================================================
// BLOG POST SCHEMA
// =============================================================================

export interface BlogSchemaOptions {
  siteUrl?: string;
  siteName?: string;
  siteLogo?: string;
}

const defaultOptions: BlogSchemaOptions = {
  siteUrl: "https://authhub.co",
  siteName: "AuthHub",
  siteLogo: "https://authhub.co/logo.png",
};

/**
 * Generate comprehensive schema for a blog post
 * Includes Article, FAQPage, BreadcrumbList, and Author schemas
 */
export function generateBlogPostSchema(
  post: ProgrammaticBlogPost,
  options: BlogSchemaOptions = {}
): Record<string, unknown> {
  const opts = { ...defaultOptions, ...options };
  const postUrl = `${opts.siteUrl}/blog/${post.slug}`;

  const schemas: Record<string, unknown>[] = [
    // Article Schema
    {
      "@type": "Article",
      "@id": `${postUrl}#article`,
      headline: post.metaTitle,
      description: post.metaDescription,
      image: post.featuredImage?.url,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      wordCount: post.wordCount,
      timeRequired: `PT${post.readTime}M`,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": postUrl,
      },
      author: {
        "@type": "Person",
        name: post.author.name,
        jobTitle: post.author.role,
        description: post.author.bio,
        ...(post.author.url && { url: post.author.url }),
      },
      publisher: {
        "@type": "Organization",
        name: opts.siteName,
        logo: {
          "@type": "ImageObject",
          url: opts.siteLogo,
        },
      },
      articleSection: post.category,
      keywords: [...post.keywords.secondary, ...post.keywords.longTail].join(", "),
    },
  ];

  // FAQ Schema (if FAQs exist)
  if (post.faqs.length > 0) {
    schemas.push({
      "@type": "FAQPage",
      "@id": `${postUrl}#faq`,
      mainEntity: post.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    });
  }

  // Breadcrumb Schema
  schemas.push({
    "@type": "BreadcrumbList",
    "@id": `${postUrl}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: opts.siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${opts.siteUrl}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: postUrl,
      },
    ],
  });

  // WebPage Schema
  schemas.push({
    "@type": "WebPage",
    "@id": postUrl,
    url: postUrl,
    name: post.metaTitle,
    description: post.metaDescription,
    isPartOf: {
      "@type": "WebSite",
      name: opts.siteName,
      url: opts.siteUrl,
    },
    about: {
      "@type": "Thing",
      name: post.keywords.primary,
    },
  });

  return {
    "@context": "https://schema.org",
    "@graph": schemas,
  };
}

/**
 * Generate minimal schema for blog listing pages
 */
export function generateBlogListSchema(options: BlogSchemaOptions = {}): Record<string, unknown> {
  const opts = { ...defaultOptions, ...options };

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Agency Growth Resources",
    description: "Expert guides, tutorials, and strategies for marketing agencies",
    url: `${opts.siteUrl}/blog`,
    isPartOf: {
      "@type": "WebSite",
      name: opts.siteName,
      url: opts.siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: opts.siteName,
      logo: {
        "@type": "ImageObject",
        url: opts.siteLogo,
      },
    },
  };
}

// =============================================================================
// COMPARISON PAGE SCHEMA
// =============================================================================

export interface ComparisonSchemaOptions extends BlogSchemaOptions {
  rating?: number;
  reviewCount?: number;
}

/**
 * Generate comprehensive schema for comparison pages
 * Includes SoftwareApplication, Review, FAQPage, and BreadcrumbList schemas
 */
export function generateComparisonSchema(
  page: ProgrammaticComparisonPage,
  options: ComparisonSchemaOptions = {}
): Record<string, unknown> {
  const opts = { ...defaultOptions, ...options };
  const pageUrl = `${opts.siteUrl}/compare/${page.slug}`;

  const schemas: Record<string, unknown>[] = [];

  // Competitor Product Schema
  schemas.push({
    "@type": "SoftwareApplication",
    "@id": `${pageUrl}#competitor`,
    name: page.competitor.name,
    description: page.competitor.tagline,
    image: page.competitor.logo,
    url: page.competitor.website,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: page.competitor.pricing.starting,
      priceCurrency: page.competitor.pricing.currency,
      availability: "https://schema.org/InStock",
    },
    ...(page.competitor.founded && {
      foundingDate: page.competitor.founded,
    }),
  });

  // AuthHub Product Schema
  schemas.push({
    "@type": "SoftwareApplication",
    "@id": `${pageUrl}#authhub`,
    name: page.ourProduct.name,
    description: page.ourProduct.tagline,
    image: page.ourProduct.logo,
    url: opts.siteUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: page.ourProduct.pricing.starting,
      priceCurrency: page.ourProduct.pricing.currency,
      availability: "https://schema.org/InStock",
    },
    ...(opts.rating !== undefined &&
      opts.reviewCount !== undefined && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: opts.rating,
          reviewCount: opts.reviewCount,
          bestRating: 5,
          worstRating: 1,
        },
      }),
  });

  // Review Schema (comparison itself)
  if (opts.rating !== undefined) {
    schemas.push({
      "@type": "Review",
      "@id": `${pageUrl}#review`,
      itemReviewed: [
        {
          "@type": "SoftwareApplication",
          name: page.competitor.name,
        },
        {
          "@type": "SoftwareApplication",
          name: page.ourProduct.name,
        },
      ],
      reviewRating: {
        "@type": "Rating",
        ratingValue: opts.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: {
        "@type": "Organization",
        name: opts.siteName,
        url: opts.siteUrl,
      },
      datePublished: page.competitor.founded || new Date().toISOString().split("T")[0],
      dateModified: page.lastVerified || new Date().toISOString().split("T")[0],
    });
  }

  // FAQ Schema
  if (page.faqs.length > 0) {
    schemas.push({
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      mainEntity: page.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    });
  }

  // Breadcrumb Schema
  schemas.push({
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: opts.siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Compare",
        item: `${opts.siteUrl}/compare`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${page.competitor.name} Alternative`,
        item: pageUrl,
      },
    ],
  });

  // WebPage Schema
  schemas.push({
    "@type": "WebPage",
    "@id": pageUrl,
    url: pageUrl,
    name: page.metaTitle,
    description: page.metaDescription,
    isPartOf: {
      "@type": "WebSite",
      name: opts.siteName,
      url: opts.siteUrl,
    },
    about: [
      {
        "@type": "SoftwareApplication",
        name: page.competitor.name,
      },
      {
        "@type": "SoftwareApplication",
        name: page.ourProduct.name,
      },
    ],
  });

  return {
    "@context": "https://schema.org",
    "@graph": schemas,
  };
}

// =============================================================================
// FAQ SCHEMA (Standalone)
// =============================================================================

/**
 * Generate standalone FAQ schema for any page
 */
export function generateFAQSchema(
  faqs: BlogFAQ[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// =============================================================================
// HOW-TO SCHEMA
// =============================================================================

export interface HowToStep {
  name: string;
  text: string;
  image?: string;
  url?: string;
}

/**
 * Generate HowTo schema for tutorial content
 */
export function generateHowToSchema(
  data: {
    name: string;
    description: string;
    totalTime?: string;           // ISO 8601 duration (e.g., "PT15M")
    estimatedCost?: string;
    steps: HowToStep[];
  },
  pageUrl: string
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: data.name,
    description: data.description,
    url: pageUrl,
    ...(data.totalTime && { totalTime: data.totalTime }),
    ...(data.estimatedCost && {
      estimatedCost: {
        "@type": "MonetaryAmount",
        currency: "USD",
        value: data.estimatedCost,
      },
    }),
    step: data.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.image && { image: step.image }),
      ...(step.url && { url: step.url }),
    })),
  };
}

// =============================================================================
// ORGANIZATION SCHEMA
// =============================================================================

/**
 * Generate Organization schema for the site
 */
export function generateOrganizationSchema(
  options: BlogSchemaOptions & {
    sameAs?: string[];
    contactPoint?: {
      telephone: string;
      contactType: string;
      email?: string;
    };
  } = {}
): Record<string, unknown> {
  const opts = { ...defaultOptions, ...options };

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: opts.siteName,
    url: opts.siteUrl,
    logo: {
      "@type": "ImageObject",
      url: opts.siteLogo,
    },
    ...(options.sameAs && { sameAs: options.sameAs }),
    ...(options.contactPoint && {
      contactPoint: {
        "@type": "ContactPoint",
        telephone: options.contactPoint.telephone,
        contactType: options.contactPoint.contactType,
        ...(options.contactPoint.email && { email: options.contactPoint.email }),
      },
    }),
  };
}

// =============================================================================
// SCHEMA RENDERER COMPONENT HELPER
// =============================================================================

/**
 * Convert schema object to JSON-LD script tag content
 */
export function schemaToJSONLD(schema: Record<string, unknown>): string {
  return JSON.stringify(schema, null, 0);
}

/**
 * Generate multiple schemas and combine into single @graph
 */
export function combineSchemas(
  ...schemas: Record<string, unknown>[]
): Record<string, unknown> {
  const allGraphs: Record<string, unknown>[] = [];

  for (const schema of schemas) {
    if (schema["@graph"]) {
      allGraphs.push(...(schema["@graph"] as Record<string, unknown>[]));
    } else if (schema["@type"]) {
      allGraphs.push(schema);
    }
  }

  return {
    "@context": "https://schema.org",
    "@graph": allGraphs,
  };
}
