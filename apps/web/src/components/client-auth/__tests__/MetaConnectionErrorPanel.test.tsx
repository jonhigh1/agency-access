import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MetaConnectionErrorPanel } from '../MetaConnectionErrorPanel';
import { mapMetaGraphError } from '@agency-platform/shared';

describe('MetaConnectionErrorPanel', () => {
  it('renders actionable copy and support code instead of raw Graph text', () => {
    const error = mapMetaGraphError({
      message: '(#200) Permissions error: User must be an admin of the ad account',
      code: 200,
    });

    expect(error).not.toBeNull();

    render(<MetaConnectionErrorPanel error={error!} onRetry={vi.fn()} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/admin access required/i)).toBeInTheDocument();
    expect(screen.getByText(/META_CONNECTION_NOT_ADMIN/)).toBeInTheDocument();
    expect(screen.queryByText('(#200)')).not.toBeInTheDocument();
    expect(screen.getByText(/forward this invite link/i)).toBeInTheDocument();
  });
});
