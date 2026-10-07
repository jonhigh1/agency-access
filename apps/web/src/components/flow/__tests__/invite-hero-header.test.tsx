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

  it('renders stable agency and request identity above the step title', () => {
    render(
      <InviteHeroHeader
        title="Complete Meta access"
        requestIdentity={{
          agencyName: 'Northwind Media',
          requestLabel: 'Q4 Meta onboarding · Sent 10/1/2026 · Ref 3d8a85dc',
        }}
      />
    );

    expect(screen.getByText('Northwind Media')).toBeInTheDocument();
    expect(screen.getByText(/Q4 Meta onboarding · Sent 10\/1\/2026 · Ref 3d8a85dc/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /complete meta access/i })).toBeInTheDocument();
  });
});
