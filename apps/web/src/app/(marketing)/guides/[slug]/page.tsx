import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { GuideTemplate } from "@/components/guides/guide-template";
import {
  getAllGuideSlugs,
  getGuideBySlug,
  guideCanonicalUrl,
} from "@/lib/guides";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return getAllGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) {
    return { title: "Guide Not Found" };
  }

  const canonical = guideCanonicalUrl(guide.slug);

  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    keywords: guide.keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      title: guide.metaTitle,
      description: guide.metaDescription,
      type: "article",
      url: canonical,
    },
  };
}

export default async function GuidePage({ params }: GuidePageProps): Promise<ReactElement> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) {
    notFound();
  }

  return <GuideTemplate guide={guide} />;
}
