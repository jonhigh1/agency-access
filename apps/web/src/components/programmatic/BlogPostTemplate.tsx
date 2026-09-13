/**
 * Programmatic Blog Post Template
 * SEO and GEO-optimized blog post component with structured content sections
 * Designed for programmatic generation with the Answer-First structure
 */

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Calendar, Clock, User, Share2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import Link from "next/link";
import type { ProgrammaticBlogPost, BlogFAQ } from "@/lib/programmatic-types";
import type { Components } from "react-markdown";

// Helper to set Growth tier for trial signup
const handleTrialSignup = () => {
  localStorage.setItem("selectedSubscriptionTier", "STARTER");
  localStorage.setItem("selectedBillingInterval", "yearly");
};

interface BlogPostTemplateProps {
  post: ProgrammaticBlogPost;
}

// Markdown components with brutalist styling
const markdownComponents: Components = {
  h1: () => null, // Skip h1 - title is shown in article header

  h2: ({ children, ...props }) => (
    <h2
      {...props}
      className="font-dela text-2xl md:text-3xl text-ink mt-10 mb-4 border-b-2 border-black pb-2 scroll-mt-20"
    >
      {children}
    </h2>
  ),

  h3: ({ children, ...props }) => (
    <h3
      {...props}
      className="font-dela text-xl md:text-2xl text-ink mt-8 mb-3 scroll-mt-20"
    >
      {children}
    </h3>
  ),

  h4: ({ children, ...props }) => (
    <h4
      {...props}
      className="font-display text-lg font-bold text-ink mt-6 mb-2 scroll-mt-20"
    >
      {children}
    </h4>
  ),

  p: ({ children, ...props }) => (
    <p {...props} className="mb-4 font-mono text-ink leading-relaxed">
      {children}
    </p>
  ),

  ul: ({ children, ...props }) => (
    <ul {...props} className="mb-4 ml-6 list-disc space-y-2 font-mono text-ink">
      {children}
    </ul>
  ),

  ol: ({ children, ...props }) => (
    <ol {...props} className="mb-4 ml-6 list-decimal space-y-2 font-mono text-ink">
      {children}
    </ol>
  ),

  li: ({ children, ...props }) => (
    <li {...props} className="ml-2">
      {children}
    </li>
  ),

  strong: ({ children, ...props }) => (
    <strong {...props} className="font-bold text-ink">
      {children}
    </strong>
  ),

  blockquote: ({ children, ...props }) => (
    <blockquote
      {...props}
      className="border-l-4 border-coral pl-4 my-6 py-2 bg-coral/5 italic text-gray-700 font-mono"
    >
      {children}
    </blockquote>
  ),

  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          {...props}
          className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm border border-gray-300"
        >
          {children}
        </code>
      );
    }
    return (
      <code {...props} className={className}>
        {children}
      </code>
    );
  },

  pre: ({ children, ...props }) => (
    <div className="my-6 overflow-x-auto border-2 border-black bg-gray-50 p-4">
      <pre {...props} className="font-mono text-sm text-ink">
        {children}
      </pre>
    </div>
  ),

  table: ({ children, ...props }) => (
    <div className="my-6 overflow-x-auto border-2 border-black">
      <table {...props} className="w-full border-collapse text-sm font-mono">
        {children}
      </table>
    </div>
  ),

  thead: ({ children, ...props }) => (
    <thead {...props} className="bg-gray-100 border-b-2 border-black">
      {children}
    </thead>
  ),

  tbody: ({ children, ...props }) => (
    <tbody {...props} className="divide-y border-black">
      {children}
    </tbody>
  ),

  tr: ({ children, ...props }) => (
    <tr {...props} className="border-b border-gray-300 last:border-b-0">
      {children}
    </tr>
  ),

  th: ({ children, ...props }) => (
    <th
      {...props}
      className="px-4 py-3 text-left font-bold text-ink border-r border-black last:border-r-0"
    >
      {children}
    </th>
  ),

  td: ({ children, ...props }) => (
    <td
      {...props}
      className="px-4 py-3 text-ink border-r border-gray-300 last:border-r-0"
    >
      {children}
    </td>
  ),

  a: ({ href, children, ...props }) => (
    <a
      {...props}
      href={href}
      className="font-mono text-danger-ink font-bold underline hover:no-underline"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  ),

  hr: () => <hr className="my-8 border-2 border-black border-dashed" />,
};

/**
 * Direct Answer Box - GEO optimized component for AI overviews
 * This content is designed to be pulled by AI systems
 */
function DirectAnswerBox({ answer }: { answer: string }) {
  return (
    <div className="bg-teal/10 border-2 border-teal p-6 mb-8 rounded-none">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen size={20} className="text-success-ink" />
        <span className="font-mono text-sm font-bold text-success-ink uppercase tracking-wider">
          Quick Answer
        </span>
      </div>
      <p className="font-mono text-ink leading-relaxed">{answer}</p>
    </div>
  );
}

/**
 * FAQ Section with schema-ready structure
 */
function FAQSection({ faqs }: { faqs: BlogFAQ[] }) {
  if (faqs.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="font-dela text-2xl md:text-3xl text-ink mb-6 border-b-2 border-black pb-2">
        Frequently Asked Questions
      </h2>
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div key={i} className="border-2 border-gray-300 p-4 rounded-none">
            <h3 className="font-dela text-lg text-ink mb-2">
              {faq.question}
            </h3>
            <p className="font-mono text-sm text-foreground">
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Table of Contents - Auto-generated from headings
 */
function TableOfContents({ content }: { content: string }) {
  // Extract H2 headings from content
  const headings = content.match(/^## (.+)$/gm);
  if (!headings || headings.length < 3) return null;

  const items = headings.map((h) => {
    const text = h.replace(/^## /, "");
    const slug = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return { text, slug };
  });

  return (
    <nav className="bg-gray-50 border-2 border-black p-4 mb-8 rounded-none">
      <h3 className="font-dela text-lg text-ink mb-3">In This Article</h3>
      <ol className="space-y-1">
        {items.map((item, i) => (
          <li key={item.slug}>
            <a
              href={`#${item.slug}`}
              className="font-mono text-sm text-danger-ink hover:underline"
            >
              {i + 1}. {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Author Bio - E-E-A-T signals
 */
function AuthorBio({ author }: { author: ProgrammaticBlogPost["author"] }) {
  return (
    <div className="flex items-start gap-4 py-4 border-t-2 border-black mt-8">
      <div className="w-16 h-16 bg-coral/20 rounded-full flex items-center justify-center flex-shrink-0">
        {author.avatar ? (
          <img src={author.avatar} alt={author.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          <span className="font-dela text-2xl text-danger-ink">{author.name[0]}</span>
        )}
      </div>
      <div>
        <p className="font-dela text-lg text-ink">{author.name}</p>
        <p className="font-mono text-sm text-muted-foreground mb-2">{author.role}</p>
        {author.bio && (
          <p className="font-mono text-sm text-foreground">{author.bio}</p>
        )}
      </div>
    </div>
  );
}

/**
 * CTA Box - Conversion element
 */
function CTABox({ cta, testimonial }: { cta: ProgrammaticBlogPost["cta"]; testimonial?: ProgrammaticBlogPost["testimonial"] }) {
  return (
    <div className="bg-coral/10 border-2 border-coral p-6 md:p-8 rounded-none mt-12">
      <h3 className="font-dela text-xl md:text-2xl text-ink mb-2">
        {cta.headline}
      </h3>
      <p className="font-mono text-foreground mb-4">
        {cta.body}
      </p>

      {testimonial && (
        <blockquote className="border-l-4 border-teal pl-4 mb-4 italic text-gray-700 font-mono text-sm">
          &ldquo;{testimonial.quote}&rdquo;
          <footer className="mt-1 not-italic font-bold text-ink">
            — {testimonial.author}, {testimonial.company}
            {testimonial.metric && <span className="text-success-ink"> ({testimonial.metric})</span>}
          </footer>
        </blockquote>
      )}

      <SignUpButton mode="modal">
        <Button variant="brutalist" size="lg" onClick={handleTrialSignup}>
          {cta.buttonText}
        </Button>
      </SignUpButton>
    </div>
  );
}

/**
 * Related Posts Section
 */
function RelatedPostsSection({ posts }: { posts: string[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t-2 border-black">
      <h3 className="font-dela text-xl text-ink mb-4">Related Articles</h3>
      <div className="flex flex-wrap gap-2">
        {posts.map((slug) => (
          <Link
            key={slug}
            href={`/blog/${slug}`}
            className="px-4 py-2 bg-gray-100 border-2 border-black font-mono text-sm text-ink hover:bg-coral hover:text-white transition-colors"
          >
            {slug.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Main Blog Post Template Component
 */
export function BlogPostTemplate({ post }: BlogPostTemplateProps) {
  const { title, excerpt, directAnswer, content, author, publishedAt, updatedAt, readTime, faqs, cta, testimonial, relatedPosts, keywords, tags } = post;

  const isUpdated = updatedAt && updatedAt !== publishedAt;

  return (
    <article className="max-w-4xl mx-auto">
      {/* Article Header */}
      <header className="mb-10 pb-10 border-b-2 border-black">
        {/* Breadcrumb */}
        <nav className="font-mono text-sm text-muted-foreground mb-4">
          <Link href="/blog" className="hover:text-danger-ink">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{title}</span>
        </nav>

        {/* Title */}
        <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-6 leading-tight">
          {title}
        </h1>

        {/* Excerpt */}
        <p className="font-mono text-lg text-gray-600 mb-6">{excerpt}</p>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 text-sm font-mono text-gray-600">
          <span className="flex items-center gap-2">
            <User size={16} />
            <span className="font-bold">{author.name}</span>
            <span className="text-gray-400">· {author.role}</span>
          </span>
          <span className="flex items-center gap-2">
            <Calendar size={16} />
            {new Date(publishedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {isUpdated && (
              <span className="text-success-ink">(Updated {new Date(updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})</span>
            )}
          </span>
          <span className="flex items-center gap-2">
            <Clock size={16} />
            {readTime} min read
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title,
                  text: excerpt,
                  url: `/blog/${post.slug}`,
                });
              }
            }}
          >
            <Share2 size={14} className="mr-1" />
            Share
          </Button>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-xs font-mono bg-gray-100 border-2 border-gray-300 rounded-none hover:bg-gray-200 transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Direct Answer Box - GEO optimized */}
      {directAnswer && <DirectAnswerBox answer={directAnswer} />}

      {/* Table of Contents */}
      <TableOfContents content={content} />

      {/* Article Content */}
      <div className="prose prose-lg max-w-none [&>*:first-child]:mt-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>

      {/* FAQ Section */}
      <FAQSection faqs={faqs} />

      {/* Author Bio */}
      <AuthorBio author={author} />

      {/* CTA Box */}
      <CTABox cta={cta} testimonial={testimonial} />

      {/* Related Posts */}
      <RelatedPostsSection posts={relatedPosts} />

      {/* Footer */}
      <footer className="mt-12 pt-8 border-t-2 border-gray-200 text-center">
        <p className="font-mono text-sm text-muted-foreground">
          Last updated: {new Date(updatedAt || publishedAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </footer>
    </article>
  );
}

export default BlogPostTemplate;
