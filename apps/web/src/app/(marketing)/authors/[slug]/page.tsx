import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import {
  authorCanonicalUrl,
  generatePersonSchema,
  getAllAuthorSlugs,
  getAuthorBySlug,
} from "@/lib/authors";
import { getPostsByAuthorSlug } from "@/lib/blog-data";
import { Schema } from "@/components/seo";

interface AuthorPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return getAllAuthorSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const author = getAuthorBySlug(slug);
  if (!author) {
    return { title: "Author Not Found" };
  }

  const canonical = authorCanonicalUrl(author.slug);
  const title = `${author.name}, ${author.role} | AuthHub`;

  return {
    title,
    description: author.bio,
    alternates: { canonical },
    openGraph: {
      title,
      description: author.bio,
      type: "profile",
      url: canonical,
    },
  };
}

export default async function AuthorPage({ params }: AuthorPageProps): Promise<ReactElement> {
  const { slug } = await params;
  const author = getAuthorBySlug(slug);
  if (!author) {
    notFound();
  }

  const posts = getPostsByAuthorSlug(author.slug);

  return (
    <div className="min-h-screen bg-paper">
      <Schema schema={generatePersonSchema(author)} />
      <section className="border-b-2 border-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-3xl">
            <p className="label-micro text-danger-ink mb-4">Author</p>
            <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-3 tracking-tight">
              {author.name}
            </h1>
            <p className="font-mono text-sm text-muted-foreground mb-6">{author.role}</p>
            <p className="font-mono text-base text-foreground">{author.bio}</p>
          </div>
        </div>
      </section>
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <h2 className="font-dela text-xl md:text-2xl text-ink mb-6">Articles</h2>
        {posts.length === 0 ? (
          <p className="font-mono text-sm text-foreground">No published articles yet.</p>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.slug} className="border-2 border-black bg-card p-5">
                <Link
                  href={`/blog/${post.slug}` as Route}
                  className="font-display text-lg font-bold text-ink hover:text-danger-ink hover:underline"
                >
                  {post.title}
                </Link>
                <p className="font-mono text-sm text-foreground mt-2">{post.excerpt}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
