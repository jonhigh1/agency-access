/**
 * Dynamic Comparison Page Route
 * Generates comparison pages from data in comparison-data.ts
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComparisonPageTemplate } from "@/components/programmatic";
import { generateComparisonSchema } from "@/lib/schema-generators";
import { Schema } from "@/components/seo";
import {
  getComparisonPageBySlug,
  getAllComparisonPageSlugs,
  COMPARISON_PAGES,
} from "@/lib/comparison-data";

interface ComparisonPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ComparisonPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getComparisonPageBySlug(slug);

  if (!page) {
    return {
      title: "Comparison Not Found",
    };
  }

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    keywords: page.keywords,
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      type: "website",
    },
  };
}

export default async function ComparisonPage({ params }: ComparisonPageProps) {
  const { slug } = await params;
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
