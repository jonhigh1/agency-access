/**
 * Individual blog post page
 */

import { notFound } from "next/navigation";
import { getBlogPostBySlug, getBlogPosts } from "@/lib/blog-data";
import { BLOG_CATEGORIES } from "@/lib/blog-types";
import { BlogContent } from "@/components/blog/blog-content";
import { BlogNavigation } from "@/components/blog/blog-navigation";
import { BlogCard } from "@/components/blog/blog-card";
import { Button } from "@/components/ui/button";
import { getRelatedPosts } from "@/lib/blog-data";
import { Metadata } from "next";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  const canonicalUrl = post.canonical || `https://authhub.co/blog/${slug}`;

  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    keywords: post.tags,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: post.metaTitle || post.title,
      description:
        post.openGraphDescription ||
        post.metaDescription ||
        post.excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      url: canonicalUrl,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  // Get previous and next posts for navigation
  const allPosts = getBlogPosts();
  const currentIndex = allPosts.findIndex((p) => p.id === post.id);
  const previousPost = currentIndex > 0 ? allPosts[currentIndex - 1] : undefined;
  const nextPost =
    currentIndex < allPosts.length - 1
      ? allPosts[currentIndex + 1]
      : undefined;

  // Get related posts
  const relatedPosts = getRelatedPosts(post.id, 3);

  // Article schema JSON-LD with publisher
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    author: {
      "@type": "Person",
      name: post.author.name,
    },
    publisher: {
      "@type": "Organization",
      "name": "AuthHub",
      "logo": {
        "@type": "ImageObject",
        "url": "https://authhub.co/authhub.png",
      },
    },
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://authhub.co/blog/${slug}`,
    },
  };

  // Breadcrumb schema for navigation
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://authhub.co",
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Blog",
        "item": "https://authhub.co/blog",
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": post.title,
        "item": `https://authhub.co/blog/${slug}`,
      },
    ],
  };

  // FAQ schema per post (visible FAQ section at the end of each post)
  const faqSchemas: Record<string, object> = {
    "client-onboarding-checklist": {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What causes client onboarding delays?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Common causes include: Business Manager vs personal profile confusion, wrong permission levels granted, multiple Business Managers across platforms, previous agency still has access, and personal email used instead of business email.",
          },
        },
        {
          "@type": "Question",
          "name": "How do I speed up client onboarding?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Use automated access request platforms like AuthHub, create standardized templates, use annotated screenshots, and always specify exact permission levels in your requests.",
          },
        },
      ],
    },
    "best-client-onboarding-software-agencies-2026": {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is agency onboarding software?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Agency onboarding software is any tool that removes a step between signed contract and live work. That usually spans four jobs: platform access (OAuth permissions to Meta, Google, and similar), intake forms, contracts/e-sign, and internal project management.",
          },
        },
        {
          "@type": "Question",
          "name": "Which agency onboarding software should I buy first?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Buy for your current bottleneck. If campaigns are blocked waiting on Meta Business Manager or Google Ads permissions, start with access management (AuthHub, Leadsie, or Agency Access). If the pain is brand assets, questionnaires, signatures, and deposits in one client link, start with a client portal.",
          },
        },
        {
          "@type": "Question",
          "name": "How is AuthHub different in this category?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "AuthHub is client OAuth onboarding for agencies: one link for featured platforms (Meta, Google Ads, GA4, LinkedIn, TikTok) across an honest 15+ platform set, with in-link intake, flat-rate plans ($29 / $79 / $149, caps 5 / 20 / 50), Infisical-backed token storage, and audit logs.",
          },
        },
        {
          "@type": "Question",
          "name": "Portal vs access — which do I need?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Portals collect forms, files, signatures, and often payments. Access tools collect platform permissions. If work is blocked on Meta/Google access, buy access first. If work is blocked on missing brand kits or unsigned SOWs, buy portal / contracts first.",
          },
        },
        {
          "@type": "Question",
          "name": "How much does access-oriented onboarding software cost?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "AuthHub monthly list: $29 / $79 / $149. Leadsie monthly list: $59 / $129 / $299 (credits plus $50 packs). Agency Access: roughly $33–44 / $74–99 / $149–199 depending on monthly vs yearly billing.",
          },
        },
      ],
    },
  };
  const faqSchema = faqSchemas[post.id] ?? null;

  return (
    <div className="min-h-screen bg-paper">
      {/* Schema JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqSchema),
          }}
        />
      )}

      {/* Article container */}
      <article className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <BlogContent post={post} />
      </article>

      {/* Navigation */}
      <BlogNavigation previousPost={previousPost} nextPost={nextPost} />

      {/* Related posts */}
      {relatedPosts.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="font-dela text-2xl text-ink mb-6 border-l-4 border-teal pl-4">
            Related Articles
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedPosts.map((relatedPost) => (
              <BlogCard key={relatedPost.id} post={relatedPost} variant="compact" />
            ))}
          </div>
        </section>
      )}

      {/* CTA section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="border-[3px] border-black bg-ink text-white p-8 md:p-12 rounded-none text-center">
          <h2 className="font-dela text-3xl md:text-4xl mb-4">
            Ready to Transform Your Client Onboarding?
          </h2>
          <p className="font-mono text-gray-300 mb-6 max-w-xl mx-auto">
            Teams use AuthHub to save hundreds of hours every month. Replace
            47-email onboarding with a single link.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="brutalist" size="lg" asChild>
              <a href="/pricing">Start Free Trial</a>
            </Button>
            <a
              href="#"
              className="px-8 py-4 bg-transparent text-white font-bold uppercase tracking-wider border-2 border-white rounded-none hover:bg-card hover:text-ink transition-all"
            >
              Schedule Demo
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

// Generate static params for all blog posts (for static generation)
export async function generateStaticParams() {
  const posts = getBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}
