/**
 * Blog listing page - displays all blog posts with filtering
 */

import type { Metadata } from "next";
import { BlogHeader } from "@/components/blog/blog-header";
import { Button } from "@/components/ui/button";
import { BlogCard } from "@/components/blog/blog-card";
import { getBlogPosts, getBlogPostsByCategory } from "@/lib/blog-data";
import { BlogCategory } from "@/lib/blog-types";
import { Suspense } from "react";

interface BlogPageProps {
  searchParams: Promise<{ category?: string }>;
}

export const metadata: Metadata = {
  title: 'Blog | AuthHub - Agency Growth Resources',
  description: 'Expert guides, tutorials, and strategies for marketing agencies on client onboarding, platform access, and scaling your agency.',
  alternates: {
    canonical: 'https://authhub.co/blog',
  },
  openGraph: {
    title: 'Blog | AuthHub - Agency Growth Resources',
    description: 'Expert guides, tutorials, and strategies for marketing agencies.',
    type: 'website',
    url: 'https://authhub.co/blog',
  },
};

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { category } = await searchParams;
  const selectedCategory = category as BlogCategory | undefined;

  // Filter posts by category if selected
  const posts = selectedCategory
    ? getBlogPostsByCategory(selectedCategory)
    : getBlogPosts();

  // Get featured posts (first 3)
  const featuredPosts = posts.slice(0, 3);
  const regularPosts = posts.slice(3);

  return (
    <div className="min-h-screen bg-paper">
      <BlogHeader
        title="Agency Growth Resources"
        description="Expert guides, tutorials, and strategies for marketing agencies"
        selectedCategory={selectedCategory || "all"}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Featured posts */}
        {featuredPosts.length > 0 && !selectedCategory && (
          <section className="mb-16">
            <h2 className="font-dela text-2xl text-ink mb-6 border-l-4 border-coral pl-4">
              Featured Posts
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredPosts.map((post) => (
                <BlogCard key={post.id} post={post} variant="featured" />
              ))}
            </div>
          </section>
        )}

        {/* All posts */}
        <section>
          <h2 className="font-dela text-2xl text-ink mb-6 border-l-4 border-ink pl-4">
            {selectedCategory ? `${selectedCategory} Posts` : "All Posts"}
          </h2>
          <Suspense
            fallback={
              <div className="text-center py-12">
                <p className="font-mono text-gray-600">Loading posts...</p>
              </div>
            }
          >
            {posts.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-none">
                <p className="font-mono text-gray-600">
                  No posts found in this category.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                  <BlogCard key={post.id} post={post} variant="default" />
                ))}
              </div>
            )}
          </Suspense>
        </section>

        {/* Newsletter signup */}
        <section className="mt-20">
          <div className="border-[3px] border-black bg-coral/10 p-8 md:p-12 rounded-none text-center">
            <h2 className="font-dela text-3xl md:text-4xl text-ink mb-4">
              Get Weekly Agency Growth Tips
            </h2>
            <p className="font-mono text-gray-700 mb-6 max-w-xl mx-auto">
              Join 1,000+ agency owners receiving actionable strategies for
              client onboarding, platform access, and scaling.
            </p>
            <form className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 px-4 py-3 border-2 border-black rounded-none font-mono text-sm focus:outline-none focus:ring-2 focus:ring-coral"
                required
              />
              <Button type="submit" variant="secondary">
                Subscribe
              </Button>
            </form>
            <p className="font-mono text-xs text-gray-500 mt-3">
              No spam. Unsubscribe anytime.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

// Generate static params for categories (for static generation)
export function generateStaticParams() {
  return [{ category: "all" }];
}
