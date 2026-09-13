'use client';

/**
 * Blog content renderer for displaying blog post content
 * Uses react-markdown with remark-gfm for proper markdown, table, and rich text rendering
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BlogPost, BLOG_CATEGORIES } from '@/lib/blog-types';
import { Calendar, Clock, User, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import type { Components } from 'react-markdown';

// Helper to set Growth tier (STARTER in backend) for trial signup
const handleTrialSignup = () => {
  localStorage.setItem('selectedSubscriptionTier', 'STARTER');
  localStorage.setItem('selectedBillingInterval', 'yearly');
};

interface BlogContentProps {
  post: BlogPost;
}

const markdownComponents: Components = {
  // Skip h1 - title is shown in article header
  h1: () => null,

  h2: ({ children, ...props }) => (
    <h2
      {...props}
      className="font-dela text-2xl md:text-3xl text-ink mt-10 mb-4 border-b-2 border-black pb-2"
    >
      {children}
    </h2>
  ),

  h3: ({ children, ...props }) => (
    <h3
      {...props}
      className="font-dela text-xl md:text-2xl text-ink mt-8 mb-3"
    >
      {children}
    </h3>
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
      className="border-l-4 border-coral pl-4 my-4 italic text-gray-700 font-mono"
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

  // Tables - proper thead/tbody structure with brutalist styling
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
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),

  hr: () => <hr className="my-8 border-2 border-black border-dashed" />,
};

export function BlogContent({ post }: BlogContentProps) {
  const category = BLOG_CATEGORIES[post.category];

  return (
    <article className="max-w-4xl mx-auto">
      {/* Article header */}
      <header className="mb-10 pb-10 border-b-2 border-black">
        {/* Category badge */}
        <span
          className={`inline-block px-3 py-1 text-sm font-bold uppercase tracking-wider bg-${category.color} text-white border-2 border-black mb-4`}
        >
          {category.icon} {category.name}
        </span>

        {/* Title */}
        <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-6 leading-tight">
          {post.title}
        </h1>

        {/* Excerpt */}
        <p className="font-mono text-lg text-gray-600 mb-6">{post.excerpt}</p>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 text-sm font-mono text-gray-600">
          <span className="flex items-center gap-2">
            <User size={16} />
            <span className="font-bold">{post.author.name}</span>
            <span className="text-gray-400">· {post.author.role}</span>
          </span>
          <span className="flex items-center gap-2">
            <Calendar size={16} />
            {new Date(post.publishedAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <span className="flex items-center gap-2">
            <Clock size={16} />
            {post.readTime} min read
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: post.title,
                  text: post.excerpt,
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
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6">
            {post.tags.map((tag) => (
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

      {/* Article content - proper markdown rendering */}
      <div className="prose prose-lg max-w-none [&>*:first-child]:mt-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {post.content}
        </ReactMarkdown>
      </div>

      {/* Article footer */}
      <footer className="mt-16 pt-8 border-t-2 border-black">
        <div className="bg-coral/10 border-2 border-coral p-6 rounded-none">
          <h3 className="font-dela text-xl text-ink mb-2">
            Ready to transform your client onboarding?
          </h3>
          <p className="font-mono text-gray-700 mb-4">
            Teams save hundreds of hours every month with Agency Access Platform.
          </p>
          <SignUpButton mode="modal">
            <Button variant="brutalist" size="lg" onClick={handleTrialSignup}>
              Start Your Free Trial
            </Button>
          </SignUpButton>
        </div>
      </footer>
    </article>
  );
}
