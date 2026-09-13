/**
 * Blog navigation component for previous/next post links
 * Follows brutalist design system
 */

import { BlogPost } from "@/lib/blog-types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface BlogNavigationProps {
  previousPost?: BlogPost;
  nextPost?: BlogPost;
}

export function BlogNavigation({
  previousPost,
  nextPost,
}: BlogNavigationProps) {
  return (
    <nav className="border-t-2 border-b-2 border-black bg-gray-50 py-8 mt-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Previous post */}
          {previousPost ? (
            <Link href={`/blog/${previousPost.slug}`} className="group block">
              <div className="border-2 border-black bg-card p-6 rounded-none shadow-brutalist-sm hover:shadow-brutalist hover:-translate-x-1 hover:translate-y-1 transition-all">
                <div className="flex items-center gap-2 text-sm font-bold text-danger-ink mb-2">
                  <ChevronLeft size={16} />
                  <span>PREVIOUS</span>
                </div>
                <h3 className="font-dela text-lg text-ink hover:text-danger-ink transition-colors line-clamp-2">
                  {previousPost.title}
                </h3>
                <p className="font-mono text-xs text-gray-500 mt-2">
                  {new Date(previousPost.publishedAt).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" }
                  )}
                </p>
              </div>
            </Link>
          ) : (
            <div className="border-2 border-dashed border-gray-300 p-6 rounded-none">
              <span className="text-sm font-mono text-gray-400">
                ← No previous post
              </span>
            </div>
          )}

          {/* Next post */}
          {nextPost ? (
            <Link href={`/blog/${nextPost.slug}`} className="group block">
              <div className="border-2 border-black bg-card p-6 rounded-none shadow-brutalist-sm hover:shadow-brutalist hover:translate-x-1 hover:translate-y-1 transition-all md:text-right">
                <div className="flex items-center justify-end gap-2 text-sm font-bold text-danger-ink mb-2 md:flex-row-reverse">
                  <span>NEXT</span>
                  <ChevronRight size={16} />
                </div>
                <h3 className="font-dela text-lg text-ink hover:text-danger-ink transition-colors line-clamp-2">
                  {nextPost.title}
                </h3>
                <p className="font-mono text-xs text-gray-500 mt-2">
                  {new Date(nextPost.publishedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </Link>
          ) : (
            <div className="border-2 border-dashed border-gray-300 p-6 rounded-none md:text-right">
              <span className="text-sm font-mono text-gray-400">
                No next post →
              </span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
