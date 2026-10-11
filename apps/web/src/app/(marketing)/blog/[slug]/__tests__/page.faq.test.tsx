import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getBlogPostBySlug } from '@/lib/blog-data';
import BlogPostPage from '../page';

vi.mock('@/components/lazy-clerk-auth-buttons', () => ({
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function jsonLdBlocks(container: HTMLElement): Record<string, unknown>[] {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].map(
    (node) => JSON.parse(node.innerHTML) as Record<string, unknown>,
  );
}

describe('blog FAQ schema from content', () => {
  it('emits FAQPage JSON-LD that matches the visible questions on a post with faqs', async () => {
    const post = getBlogPostBySlug('client-onboarding-checklist');
    expect(post?.faqs?.length).toBeGreaterThan(0);

    const page = await BlogPostPage({
      params: Promise.resolve({ slug: 'client-onboarding-checklist' }),
    });
    const { container } = render(page);

    const faq = jsonLdBlocks(container).find((schema) => schema['@type'] === 'FAQPage');
    expect(faq).toBeDefined();
    const questions = faq?.mainEntity as Array<{
      name: string;
      acceptedAnswer: { text: string };
    }>;
    expect(questions.map((item) => item.name)).toEqual(post!.faqs!.map((item) => item.question));
    expect(questions.map((item) => item.acceptedAnswer.text)).toEqual(
      post!.faqs!.map((item) => item.answer),
    );
    for (const item of post!.faqs!) {
      expect(screen.getByRole('heading', { name: item.question })).toBeInTheDocument();
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }
  });

  it('does not emit FAQPage JSON-LD when the post has no faqs', async () => {
    const post = getBlogPostBySlug('google-ads-access-agency');
    expect(post?.faqs).toBeUndefined();

    const page = await BlogPostPage({
      params: Promise.resolve({ slug: 'google-ads-access-agency' }),
    });
    const { container } = render(page);
    const types = jsonLdBlocks(container).map((schema) => schema['@type']);
    expect(types).not.toContain('FAQPage');
  });
});
