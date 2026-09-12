/**
 * Schema.org JSON-LD Component
 * Injects structured data into pages for SEO and GEO optimization
 */

import { SUPPORTED_PLATFORM_COUNT } from '@agency-platform/shared';

interface SchemaProps {
  schema: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * Component to inject JSON-LD schema into the page head
 * Usage: <Schema schema={generateBlogPostSchema(post)} />
 */
export function Schema({ schema }: SchemaProps) {
  const schemaArray = Array.isArray(schema) ? schema : [schema];

  return (
    <>
      {schemaArray.map((s, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(s),
          }}
        />
      ))}
    </>
  );
}

/**
 * Multiple schemas combined into a single @graph
 */
export function CombinedSchema({ schemas }: { schemas: Record<string, unknown>[] }) {
  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": schemas,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(combinedSchema),
      }}
    />
  );
}

/**
 * Pre-built organization schema for AuthHub
 */
export function OrganizationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AuthHub",
    url: "https://authhub.co",
    logo: {
      "@type": "ImageObject",
      url: "https://authhub.co/logo.png",
    },
    description: `OAuth aggregation platform for marketing agencies. Get client access to Meta, Google, LinkedIn, and ${SUPPORTED_PLATFORM_COUNT} platforms with a single link.`,
    sameAs: [
      "https://twitter.com/authhub",
      "https://linkedin.com/company/authhub",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: "https://authhub.co/contact",
    },
  };

  return <Schema schema={schema} />;
}

/**
 * Pre-built website schema
 */
export function WebsiteSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AuthHub",
    url: "https://authhub.co",
    description: "OAuth aggregation platform for marketing agencies",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://authhub.co/search?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };

  return <Schema schema={schema} />;
}

/**
 * Breadcrumb schema for any page
 */
export function BreadcrumbSchema({ items }: { items: Array<{ name: string; url: string }> }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return <Schema schema={schema} />;
}

export default Schema;
