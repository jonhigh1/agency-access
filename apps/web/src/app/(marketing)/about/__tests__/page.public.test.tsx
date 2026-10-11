import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AboutPage from '../page';

describe('about page operator story', () => {
  it('names Jon High as the operator and links the author page', () => {
    const { container } = render(<AboutPage />);
    expect(screen.getByText(/Jon High/)).toBeInTheDocument();
    expect(container.querySelector('a[href="/authors/jon-high"]')).not.toBeNull();
  });
});
