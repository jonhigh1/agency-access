import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import sitemap from '@/app/sitemap';
import { GuideTemplate } from '@/components/guides/guide-template';
import { getAllGuideSlugs, getAllGuides, getGuideBySlug } from '@/lib/guides';
import GuidesHubPage, { metadata as guidesHubMetadata } from '../page';

vi.mock('@/components/marketing/comparison-cta', () => ({ ComparisonCTA: () => <div>AuthHub call to action</div> }));

function jsonLdBlocks(container: HTMLElement): Record<string, unknown>[] {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].map((node) =>
    JSON.parse(node.innerHTML) as Record<string, unknown>,
  );
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

describe('published guides', () => {
  it.each(['meta-ads-access', 'google-ads-access'] as const)(
    'keeps the live %s guide public with a visible updated date',
    (slug) => {
      const guide = getGuideBySlug(slug);
      expect(guide).toBeDefined();
      render(<GuideTemplate guide={guide!} />);
      expect(screen.getByRole('heading', { level: 1, name: guide!.title })).toBeInTheDocument();
      expect(screen.getByText(guide!.updatedAtDisplay)).toBeInTheDocument();
    },
  );

  it('ships HowTo, FAQPage, and a /guides breadcrumb from the same page data', () => {
    for (const guide of getAllGuides()) {
      const { container, unmount } = render(<GuideTemplate guide={guide} />);
      const schemas = jsonLdBlocks(container);

      const howTo = schemas.find((schema) => schema['@type'] === 'HowTo');
      expect(howTo).toBeDefined();
      expect(howTo?.name).toBe(guide.howToName);
      const howToSteps = howTo?.step as Array<{ name: string; text: string }>;
      expect(howToSteps.map((step) => step.name)).toEqual(guide.howToSteps.map((step) => step.name));
      expect(howToSteps.map((step) => step.text)).toEqual(guide.howToSteps.map((step) => step.text));

      const faq = schemas.find((schema) => schema['@type'] === 'FAQPage');
      expect(faq).toBeDefined();
      const questions = faq?.mainEntity as Array<{
        name: string;
        acceptedAnswer: { text: string };
      }>;
      expect(questions).toHaveLength(guide.faqs.length);
      expect(guide.faqs.length).toBeGreaterThanOrEqual(4);
      expect(guide.faqs.length).toBeLessThanOrEqual(6);
      for (const item of questions) {
        expect(screen.getByRole('heading', { name: item.name })).toBeInTheDocument();
        expect(screen.getByText(item.acceptedAnswer.text)).toBeInTheDocument();
      }

      const crumbs = schemas.find((schema) => schema['@type'] === 'BreadcrumbList');
      const items = crumbs?.itemListElement as Array<{ name: string; item: string }>;
      expect(items?.[1]).toMatchObject({
        name: 'Guides',
        item: 'https://authhub.co/guides',
      });

      expect(wordCount(guide.quickAnswer)).toBeGreaterThanOrEqual(40);
      expect(wordCount(guide.quickAnswer)).toBeLessThanOrEqual(60);
      expect(screen.getByText(guide.quickAnswer)).toBeInTheDocument();
      expect(container.querySelector('a[href="/guides"]')).not.toBeNull();
      expect(container.querySelector(`a[href="${guide.compareHref}"]`)).not.toBeNull();
      unmount();
    }
  });
});

describe('guides hub', () => {
  it('self-canonicalizes to /guides and links every published guide', () => {
    expect(guidesHubMetadata.alternates?.canonical).toBe('https://authhub.co/guides');
    const { container } = render(<GuidesHubPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /platform access guides/i }),
    ).toBeInTheDocument();
    for (const slug of getAllGuideSlugs()) {
      expect(container.querySelector(`a[href="/guides/${slug}"]`)).not.toBeNull();
    }
  });

  it('lists the hub and every guide in the sitemap with content lastmod', () => {
    const entries = sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain('/guides');
    for (const guide of getAllGuides()) {
      expect(paths).toContain(`/guides/${guide.slug}`);
      const entry = entries.find((item) => new URL(item.url).pathname === `/guides/${guide.slug}`);
      expect(entry?.lastModified).toBe(new Date(guide.updatedAt).toISOString());
    }
  });
});
