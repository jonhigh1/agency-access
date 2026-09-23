/**
 * Dynamic Comparison Page Route
 * Generates comparison pages from data in comparison-data.ts
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComparisonPageTemplate, LeadsiePricingPageTemplate } from "@/components/programmatic";
import { generateComparisonSchema, generateLeadsiePricingSchema } from "@/lib/schema-generators";
import { Schema } from "@/components/seo";
import {
  getComparisonPageBySlug,
  getAllComparisonPageSlugs,
} from "@/lib/comparison-data";
import { getLeadsiePricingPage, isLeadsiePricingSlug } from "@/lib/leadsie-pricing-page";

interface ComparisonPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ComparisonPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (isLeadsiePricingSlug(slug)) {
    const pricingPage = getLeadsiePricingPage();
    const ogDescription =
      pricingPage.openGraphDescription ?? pricingPage.metaDescription;
    return {
      title: pricingPage.metaTitle,
      description: pricingPage.metaDescription,
      keywords: pricingPage.keywords,
      openGraph: {
        title: pricingPage.metaTitle,
        description: ogDescription,
        type: "article",
      },
    };
  }

  const page = getComparisonPageBySlug(slug);

  if (!page) {
    return {
      title: "Comparison Not Found",
    };
  }

  const ogDescription = page.openGraphDescription ?? page.metaDescription;

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    keywords: page.keywords,
    openGraph: {
      title: page.metaTitle,
      description: ogDescription,
      type: "website",
    },
  };
}

export default async function ComparisonPage({ params }: ComparisonPageProps) {
  const { slug } = await params;

  if (isLeadsiePricingSlug(slug)) {
    const pricingPage = getLeadsiePricingPage();
    const schema = generateLeadsiePricingSchema(pricingPage);

    return (
      <>
        <Schema schema={schema} />
        <LeadsiePricingPageTemplate page={pricingPage} />
      </>
    );
  }

  const page = getComparisonPageBySlug(slug);

  if (!page) {
    notFound();
  }

  const schema = generateComparisonSchema(page);

  return (
    <>
      <Schema schema={schema} />
      <ComparisonPageTemplate page={page} />
    </>
  );
}

// Generate static params for all comparison pages
export async function generateStaticParams() {
  return getAllComparisonPageSlugs().map((slug) => ({ slug }));
}
