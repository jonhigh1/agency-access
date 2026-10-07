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
    headline: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
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
    dateModified: post.updatedAt ?? post.publishedAt,
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
      mainEntity: [
        {
          "@type": "Question",
          name: "What should a client onboarding checklist include?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Contract/SOW close, intake and brand assets, platform access with exact roles, expectations (comms, approvals, reporting, scope), kickoff with a written success metric, and a first-value path through a 30-day review. Every task needs an owner and a due day.",
          },
        },
        {
          "@type": "Question",
          name: "How long should client onboarding take?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Plan about two weeks from signed contract to first useful deliverable if access is verified early. Day 0–3 for close, intake, and access; kickoff by Day 5; first small win inside two weeks; formal review at Day 30.",
          },
        },
        {
          "@type": "Question",
          name: "Who should own client onboarding at an agency?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "One accountable owner (usually the account manager), with billing or ops on close and a strategist on kickoff. If everyone owns onboarding, nobody chases open platform-access rows.",
          },
        },
        {
          "@type": "Question",
          name: "What access do I need from a new marketing client?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Whatever platforms you will run: typically Meta, Google Ads, GA4, and any of LinkedIn, TikTok, Pinterest, or Snapchat in scope — plus pixel or GTM publish rights, Search Console, and CMS or Shopify access if you will touch landing pages. Ask for the role that lets you do the work, then verify each one in-platform.",
          },
        },
        {
          "@type": "Question",
          name: "How do I get access without asking for passwords?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Use each platform's official partner or user invite (Business Manager, Google Ads users, GA4 property access, and similar). Send clear role names. You can also send one AuthHub link that walks the client through those official surfaces. Never share logins.",
          },
        },
        {
          "@type": "Question",
          name: "Should the client or the agency own the ad accounts?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The client owns the ad accounts. The agency gets partner or user access with the right role. That keeps billing, asset ownership, and offboarding clean when the engagement ends.",
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
    "best-leadsie-alternatives-2026": {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What are the best Leadsie alternatives in 2026?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The main Leadsie alternatives agencies shortlist are ClientInvite, AgencyAccess, AuthHub, ClientFuse, and free or credit-based options such as OnboardClient and Access Pilot. The best pick depends on pricing model, platform breadth, and whether token lifecycle and audit matter.",
          },
        },
        {
          "@type": "Question",
          name: "Does AgencyAccess have an API?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. AgencyAccess documents a public REST API and also offers Zapier on higher plans. Do not treat it as Zapier-only.",
          },
        },
        {
          "@type": "Question",
          name: "Is ClientInvite or AuthHub the better Leadsie alternative?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Choose ClientInvite for flat-fee unlimited connections at a published $89 Agency plan when Meta, Google, Shopify, and LinkedIn cover your stack. Choose AuthHub if expired-token reconnects, Infisical-style vaulting and audit logs, in-link intake, or Growth-tier API and webhooks on 5/20/50 active-client caps are the bottleneck.",
          },
        },
        {
          "@type": "Question",
          name: "Should I stay on Leadsie?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Stay on Leadsie if you rely on broader platform set, prospect-audit workflows, Meta helpers, multi-brand Pro features, or credit pooling on annual plans. Switch when credits and overages, branding depth, intake-in-link, or automatic token refresh become the bottleneck.",
          },
        },
      ],
    },
    "snapchat-ads-access-agencies": {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Can I request Snapchat ad account access as an agency?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Snapchat has no inbound request system. The client must invite you as an Organization member and assign ad account roles.",
          },
        },
        {
          "@type": "Question",
          name: "What is the minimum access an agency needs?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Organization Member plus Campaign Manager on the ad account. Add Data Analyst for reporting-only staff.",
          },
        },
        {
          "@type": "Question",
          name: "Does my client need a Public Profile before I can run ads?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Snapchat requires a Public Profile for all advertising. Create it before assigning ad account access.",
          },
        },
        {
          "@type": "Question",
          name: "Can multiple agencies work in the same Snapchat ad account?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, but each member gets their own role assignment. Snapchat's Agency Admin role is designed for exactly this. It cannot change business details.",
          },
        },
        {
          "@type": "Question",
          name: "Can the client and agency both pay for spend?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Not in the same ad account. Snapchat allows one funding source per ad account. Use separate accounts for separate billing arrangements.",
          },
        },
        {
          "@type": "Question",
          name: "How do I remove agency access later?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Remove ad account roles, Public Profile roles, and Organization membership, in that order. Verify all three.",
          },
        },
        {
          "@type": "Question",
          name: 'What does "Organization not spend ready" (PERMISSION_DENIED) mean on Snapchat?',
          acceptedAnswer: {
            "@type": "Answer",
            text: "Most likely, the Organization that owns the ad account or Public Profile isn't set up to spend yet — usually a missing billing address, payment method, or business details. Snapchat doesn't publish an official definition. An Organization Admin on that org (almost always the client) completes Business Details + Billing & Payments, then retries. Agencies invited as Members usually can't clear it themselves.",
          },
        },
      ],
    },
    "mcp-oauth-client-access-agencies": {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How do I give an AI agent / MCP server access to a client's Meta or Google account without passwords?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Send a branded OAuth authorization link. The client completes each platform's official grant. Store and refresh the token in a vault with audit logs. Point your MCP connector or agent at that client's credentials only—never a shared personal admin token for the whole book.",
          },
        },
        {
          "@type": "Question",
          name: "Is AuthHub an ads MCP server?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. AuthHub collects and vaults client OAuth. Ads MCP products (AdKit, Agency AI, 1ClickReport, meta-ads-mcp, and peers) expose tools to Claude, ChatGPT, or Cursor. Most AI-forward agencies need both.",
          },
        },
        {
          "@type": "Question",
          name: "What happens when tokens expire on Friday night?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Without refresh and monitoring, agents and automations fail silently until a human notices. AuthHub auto-refreshes where providers allow it and keeps health/audit signals. Platform-specific expiry and reauth workflows are covered in the OAuth token management for agencies guide.",
          },
        },
        {
          "@type": "Question",
          name: "Can I migrate from Leadsie or another tool without downtime?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Dual-run: keep the current tool live, send AuthHub links for new onboards and re-authorizations, cut over when the clients you care about complete the new flow. No silent permission port.",
          },
        },
        {
          "@type": "Question",
          name: "When should I stay on a peer or DIY instead of AuthHub?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Stay on Leadsie for breadth and audits. Pick AgencyAccess for branding, intake, 30-day trial, and API/Zapier. Pick ClientInvite for unlimited flat on a focused stack. DIY when engineering owns system users and secrets. Choose AuthHub when humans and agents need the same one-link OAuth intake with Infisical, refresh, and audit logs.",
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
            Ready to simplify client access?
          </h2>
          <p className="font-mono text-gray-300 mb-6 max-w-xl mx-auto">
            AuthHub sends one branded link that walks each client through official
            platform invites — no shared logins, no multi-day email threads.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="brutalist" size="lg" asChild>
              <a href="https://authhub.co/">Start Your Free Trial</a>
            </Button>
            <Button variant="outline" size="lg" className="bg-transparent text-white border-white hover:bg-white/10" asChild>
              <a href="https://authhub.co/pricing">See pricing</a>
            </Button>
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
