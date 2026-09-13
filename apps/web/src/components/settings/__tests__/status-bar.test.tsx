import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBar } from '../status-bar';

describe('StatusBar', () => {
  it('renders as the one ink surface with each label·value pair in mono', () => {
    const { container } = render(
      <StatusBar
        label="Plan"
        items={[
          { label: 'Tier', value: 'Free', testId: 'sb-tier' },
          { label: 'Status', value: 'No subscription' },
          { label: 'Limits', value: '1 clients · 3 requests · 1 members' },
        ]}
      />
    );

    const bar = container.querySelector('.ink-panel') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.getAttribute('role')).toBe('status');
    expect(screen.getByText('Plan').className).toContain('label-micro');
    expect(screen.getByTestId('sb-tier')).toHaveTextContent('Free');
    expect(screen.getByText('Tier').className).toContain('label-nano');
    expect(screen.getByText('No subscription')).toBeInTheDocument();
    expect(bar.querySelector('button')).toBeNull();
  });

  it('is a single compact line: no vertical grid, tight padding', () => {
    const { container } = render(<StatusBar label="Endpoint" items={[{ label: 'URL', value: 'https://x.y/z' }]} />);
    const bar = container.querySelector('.ink-panel') as HTMLElement;
    expect(bar.className).not.toMatch(/\bp-6\b|grid-cols-3|md:grid-cols/);
    expect(bar.className).toMatch(/\bpy-3\b/);
    expect(bar.className).toMatch(/\bflex\b/);
  });

  it('renders — for unloaded values and an optional trailing action', () => {
    render(
      <StatusBar
        label="MCP endpoint"
        items={[{ label: 'URL', value: null }]}
        action={<a href="#copy" className="label-micro">Copy endpoint</a>}
      />
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Copy endpoint' })).toBeInTheDocument();
  });

  it('accepts a React node as a value (status badge) and wraps long values', () => {
    render(
      <StatusBar
        label="Endpoint"
        items={[
          { label: 'URL', value: 'https://example.com/a/very/long/webhook/endpoint/path', testId: 'sb-url' },
          { label: 'Status', value: <span data-testid="badge">active</span> },
        ]}
      />
    );

    expect(screen.getByTestId('badge')).toBeInTheDocument();
    expect(screen.getByTestId('sb-url').className).toContain('overflow-wrap:anywhere');
  });
});
