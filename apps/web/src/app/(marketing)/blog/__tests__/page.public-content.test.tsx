import { describe, expect, it } from 'vitest';
import BlogPage from '../page';

describe('BlogPage public content', () => {
  it('does not render a newsletter promise without a subscription endpoint', async () => {
    const page = await BlogPage({ searchParams: Promise.resolve({}) });
    const { container } = (await import('@testing-library/react')).render(page);

    expect(container.querySelector('form')).toBeNull();
    expect(container.textContent).not.toMatch(/weekly agency growth tips|subscribe|unsubscribe anytime/i);
  });
});
