import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import { getAuthorBySlug } from '@/lib/authors';
import AuthorPage, { generateMetadata } from '../[slug]/page';

describe('author pages', () => {
  it('renders Jon High with Person schema and is listed in the sitemap', async () => {
    const author = getAuthorBySlug('jon-high');
    expect(author?.name).toBe('Jon High');

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'jon-high' }),
    });
    expect(metadata.alternates?.canonical).toBe('https://authhub.co/authors/jon-high');

    const page = await AuthorPage({ params: Promise.resolve({ slug: 'jon-high' }) });
    const { container } = render(page);
    expect(screen.getByRole('heading', { level: 1, name: /Jon High/ })).toBeInTheDocument();
    const person = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((node) => JSON.parse(node.innerHTML) as Record<string, unknown>)
      .find((schema) => schema['@type'] === 'Person');
    expect(person).toMatchObject({
      name: 'Jon High',
      url: 'https://authhub.co/authors/jon-high',
    });

    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain('/authors/jon-high');
  });
});
