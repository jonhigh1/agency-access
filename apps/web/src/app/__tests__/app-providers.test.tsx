import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../app-providers';

vi.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="clerk-provider">{children}</div>
  ),
}));

vi.mock('framer-motion', () => ({
  LazyMotion: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-motion-provider">{children}</div>
  ),
  MotionConfig: ({
    children,
    reducedMotion,
  }: {
    children: React.ReactNode;
    reducedMotion?: string;
  }) => (
    <div data-testid="app-motion-config" data-reduced-motion={reducedMotion}>
      {children}
    </div>
  ),
  domAnimation: {},
}));

vi.mock('@tanstack/react-query', () => ({
  QueryClient: class QueryClient {},
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-provider">{children}</div>
  ),
}));

vi.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}));

describe('AppProviders', () => {
  it('wraps app surfaces with theme and query state without reintroducing Clerk at this boundary', () => {
    render(
      <AppProviders>
        <div>Child</div>
      </AppProviders>
    );

    expect(screen.getByTestId('app-motion-provider')).toBeInTheDocument();
    // Reduced motion follows the OS setting for every Motion animation.
    expect(screen.getByTestId('app-motion-config')).toHaveAttribute(
      'data-reduced-motion',
      'user'
    );
    expect(screen.getByTestId('query-provider')).toBeInTheDocument();
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-provider')).not.toBeInTheDocument();
  });
});
