import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InviteTerminalCard } from '../invite-terminal-card';

describe('InviteTerminalCard', () => {
  it.each(['expired', 'revoked', 'unavailable'] as const)(
    'does not assert that prior access was never shared for a %s request',
    (kind) => {
      render(<InviteTerminalCard kind={kind} />);
      expect(screen.queryByText(/nothing has been shared/i)).not.toBeInTheDocument();
      expect(screen.getByText('You can safely close this page.')).toBeInTheDocument();
    }
  );
});
