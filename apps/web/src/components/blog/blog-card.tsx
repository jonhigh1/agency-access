/**
 * Blog card component for article previews
 * Follows brutalist design system with border-2, border-black, shadow-brutalist
 */

import { BlogPost, BLOG_CATEGORIES } from "@/lib/blog-types";
import { Calendar, Clock, User } from "lucide-react";
import Link from "next/link";

interface BlogCardProps {
  post: BlogPost;
  variant?: "default" | "featured" | "compact";
}

export function BlogCard({ post, variant = "default" }: BlogCardProps) {
  const category = BLOG_CATEGORIES[post.category];

  if (variant === "compact") {
    return (
      <Link href={`/blog/${post.slug}`} className="group block">
        <div className="border-2 border-black bg-card p-4 rounded-none shadow-brutalist-sm hover:shadow-brutalist hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span
              className={`inline-block px-2 py-1 text-xs font-bold uppercase tracking-wider mb-2 bg-${category.color}-10 text-${category.color}`}
            >
              {category.icon} {category.name}
            </span>
            <h3 className="font-dela text-lg text-ink hover:text-danger-ink transition-colors line-clamp-2">
              {post.title}
            </h3>
            <div className="flex items-center gap-3 mt-2 text-xs font-mono text-gray-600">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {post.readTime} min read
              </span>
            </div>
          </div>
        </div>
        </div>
      </Link>
    );
  }

  if (variant === "featured") {
    return (
      <Link href={`/blog/${post.slug}`} className="group block">
        <div className="border-[3px] border-black bg-card rounded-none shadow-brutalist-lg hover:-translate-y-1 transition-all overflow-hidden">
        {/* Category badge - tilted */}
        <div className="relative">
          <div className="absolute top-4 left-4 z-10">
            <span
              className={`inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider bg-${category.color} text-white border-2 border-black -rotate-2`}
            >
              {category.icon} {category.name}
            </span>
          </div>
          {/* Placeholder for featured image */}
          <div className="aspect-video bg-gradient-to-br from-coral/20 via-teal/20 to-coral/20 border-b-2 border-black flex items-center justify-center">
            <span className="font-dela text-4xl text-ink/20">
              {post.title.charAt(0)}
            </span>
          </div>
        </div>

        <div className="p-6">
          <h2 className="font-dela text-2xl md:text-3xl text-ink hover:text-danger-ink transition-colors mb-3">
            {post.title}
          </h2>
          <p className="font-mono text-sm text-gray-600 mb-4 line-clamp-2">
            {post.excerpt}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs font-mono text-gray-600">
              <span className="flex items-center gap-1">
                <User size={14} />
                {post.author.name}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {post.readTime} min read
              </span>
            </div>
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 rounded-none"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        </div>
      </Link>
    );
  }

  // Default variant
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <div className="border-2 border-black bg-card rounded-none shadow-brutalist-sm hover:shadow-brutalist hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
      {/* Category badge */}
      <div className="relative p-6 pb-0">
        <span
          className={`inline-block px-2 py-1 text-xs font-bold uppercase tracking-wider bg-${category.color}-20 text-${category.color} border border-${category.color}-30 rounded-sm`}
        >
          {category.icon} {category.name}
        </span>
      </div>

      <div className="p-6 pt-3">
        <h3 className="font-dela text-xl text-ink hover:text-danger-ink transition-colors mb-2 line-clamp-2">
          {post.title}
        </h3>
        <p className="font-mono text-sm text-gray-600 mb-4 line-clamp-3">
          {post.excerpt}
        </p>

        <div className="flex items-center justify-between text-xs font-mono text-gray-600 border-t border-gray-200 pt-3">
          <span className="flex items-center gap-1">
            <User size={12} />
            {post.author.name}
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {new Date(post.publishedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {post.readTime}m
            </span>
          </div>
        </div>
      </div>
      </div>
    </Link>
  );
}
