import type { Metadata } from "next";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { UseCaseTemplate } from "@/components/uses/use-case-template";
import { getAllUseCaseSlugs, getUseCaseBySlug } from "@/lib/use-cases";
import { CANONICAL_ORIGIN } from "@/lib/seo-canonical";

interface UseCasePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return getAllUseCaseSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: UseCasePageProps): Promise<Metadata> {
  const { slug } = await params;
  const useCase = getUseCaseBySlug(slug);
  if (!useCase) {
    return { title: "Use case not found" };
  }

  const canonical = `${CANONICAL_ORIGIN}/uses/${useCase.slug}`;
  return {
    title: useCase.metaTitle,
    description: useCase.metaDescription,
    alternates: { canonical },
    openGraph: {
      title: useCase.metaTitle,
      description: useCase.metaDescription,
      type: "website",
      url: canonical,
    },
  };
}

export default async function UseCasePage({ params }: UseCasePageProps): Promise<ReactElement> {
  const { slug } = await params;
  const useCase = getUseCaseBySlug(slug);
  if (!useCase) {
    notFound();
  }

  return <UseCaseTemplate useCase={useCase} />;
}
