import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InviteHeroHeader } from '../invite-hero-header';

describe('InviteHeroHeader', () => {
  it('renders the request title, description, and security promise', () => {
    render(
      <InviteHeroHeader
        title="Share account access"
        description="Demo Agency requested access to Google."
        badge="2 platforms"
      />
    );

    expect(screen.getByRole('heading', { name: /share account access/i })).toBeInTheDocument();
    expect(screen.getByText(/passwords are never requested/i)).toBeInTheDocument();
    expect(screen.getByText(/2 platforms/i)).toBeInTheDocument();
  });
});
