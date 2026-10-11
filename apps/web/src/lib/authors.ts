import { CANONICAL_ORIGIN } from "@/lib/seo-canonical";

export interface AuthorProfile {
  slug: string;
  name: string;
  role: string;
  bio: string;
}

export const AUTHORS: AuthorProfile[] = [
  {
    slug: "jon-high",
    name: "Jon High",
    role: "Founder",
    bio: "Jon High is the founder of AuthHub. He writes the client-access how-tos on this site from operating the product: agencies send one link, clients authorize Meta, Google, and related platforms, and tokens stay in Infisical with an audit log.",
  },
];

export function getAllAuthors(): AuthorProfile[] {
  return [...AUTHORS];
}

export function getAllAuthorSlugs(): string[] {
  return AUTHORS.map((author) => author.slug);
}

export function getAuthorBySlug(slug: string): AuthorProfile | undefined {
  return AUTHORS.find((author) => author.slug === slug);
}

export function authorCanonicalUrl(slug: string): string {
  return `${CANONICAL_ORIGIN}/authors/${slug}`;
}

export function generatePersonSchema(author: AuthorProfile): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    jobTitle: author.role,
    url: authorCanonicalUrl(author.slug),
    description: author.bio,
    worksFor: {
      "@type": "Organization",
      name: "AuthHub",
      url: CANONICAL_ORIGIN,
    },
  };
}

export function slugifyAuthorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
