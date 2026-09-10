/**
 * PlatformCard Component Tests
 *
 * Tests for the platform connection card component
 * with connect/connected states and loading indicators
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlatformCard } from '../platform-card';
import { Platform } from '@agency-platform/shared';

describe('PlatformCard', () => {
  const mockOnConnect = vi.fn();
  const mockOnDisconnect = vi.fn();
  const mockOnEditEmail = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render platform name and icon', () => {
    render(
      <PlatformCard
        platform={'meta_ads' as Platform}
        connected={false}
        onConnect={mockOnConnect}
      />
    );

    expect(screen.getByText('Meta Ads')).toBeInTheDocument();
  });

  it('should render Connect button when not connected', () => {
    render(
      <PlatformCard
        platform={'meta_ads' as Platform}
        connected={false}
        onConnect={mockOnConnect}
      />
    );

    const button = screen.getByRole('button', { name: /connect/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('should call onConnect with platform when Connect button is clicked', () => {
    render(
      <PlatformCard
        platform={'google_ads' as Platform}
        connected={false}
        onConnect={mockOnConnect}
      />
    );

    const button = screen.getByRole('button', { name: /connect/i });
    fireEvent.click(button);

    expect(mockOnConnect).toHaveBeenCalledTimes(1);
    expect(mockOnConnect).toHaveBeenCalledWith('google_ads');
  });

  it('should display email when connected', () => {
    render(
      <PlatformCard
        platform={'linkedin' as Platform}
        connected={true}
        connectedEmail="user@example.com"
        onConnect={mockOnConnect}
      />
    );

    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /connect/i })).not.toBeInTheDocument();
  });

  it('should display "Connected" when connected but no email provided', () => {
    render(
      <PlatformCard
        platform={'tiktok' as Platform}
        connected={true}
        onConnect={mockOnConnect}
      />
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('should show loading state during connection', () => {
    render(
      <PlatformCard
        platform={'snapchat' as Platform}
        connected={false}
        isConnecting={true}
        onConnect={mockOnConnect}
      />
    );

    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should display status badge for expired connections', () => {
    render(
      <PlatformCard
        platform={'ga4' as Platform}
        connected={true}
        connectedEmail="expired@example.com"
        status="expired"
        onConnect={mockOnConnect}
      />
    );

    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('expired@example.com')).toBeInTheDocument();
  });

  it('should display status badge for invalid connections', () => {
    render(
      <PlatformCard
        platform={'instagram' as Platform}
        connected={true}
        connectedEmail="invalid@example.com"
        status="invalid"
        onConnect={mockOnConnect}
      />
    );

    expect(screen.getByText('Invalid')).toBeInTheDocument();
  });

  it('should not display status badge for active connections', () => {
    render(
      <PlatformCard
        platform={'meta_ads' as Platform}
        connected={true}
        connectedEmail="active@example.com"
        status="active"
        onConnect={mockOnConnect}
      />
    );

    expect(screen.queryByText('active')).not.toBeInTheDocument();
    expect(screen.getByText('active@example.com')).toBeInTheDocument();
  });

  it('should render disconnect button when onDisconnect is provided', () => {
    render(
      <PlatformCard
        platform={'google_ads' as Platform}
        connected={true}
        connectedEmail="user@example.com"
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />
    );

    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    expect(disconnectButton).toBeInTheDocument();
  });

  it('should call onDisconnect with platform when disconnect button is clicked', () => {
    render(
      <PlatformCard
        platform={'linkedin' as Platform}
        connected={true}
        connectedEmail="user@example.com"
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />
    );

    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(disconnectButton);

    expect(mockOnDisconnect).toHaveBeenCalledTimes(1);
    expect(mockOnDisconnect).toHaveBeenCalledWith('linkedin');
  });

  it('should not render disconnect button when onDisconnect is not provided', () => {
    render(
      <PlatformCard
        platform={'tiktok' as Platform}
        connected={true}
        connectedEmail="user@example.com"
        onConnect={mockOnConnect}
      />
    );

    expect(screen.queryByRole('button', { name: /disconnect/i })).not.toBeInTheDocument();
  });

  it('should truncate long email addresses', () => {
    const longEmail = 'very.long.email.address.that.should.be.truncated@example.com';
    render(
      <PlatformCard
        platform={'snapchat' as Platform}
        connected={true}
        connectedEmail={longEmail}
        onConnect={mockOnConnect}
      />
    );

    const emailElement = screen.getByText(longEmail);
    expect(emailElement).toHaveClass('truncate');
    expect(emailElement).toHaveAttribute('title', longEmail);
  });

  it('should render edit email button for non-Shopify manual platforms', () => {
    render(
      <PlatformCard
        platform={'kit' as Platform}
        connected={true}
        connectedEmail="ops@example.com"
        onConnect={mockOnConnect}
        onEditEmail={mockOnEditEmail}
      />
    );

    expect(screen.getByRole('button', { name: /edit email/i })).toBeInTheDocument();
  });

  it('should not render edit email button for snapchat now that it connects with OAuth', () => {
    render(
      <PlatformCard
        platform={'snapchat' as Platform}
        connected={true}
        connectedEmail="snap@agency.com"
        onConnect={mockOnConnect}
        onEditEmail={mockOnEditEmail}
      />
    );

    expect(screen.queryByRole('button', { name: /edit email/i })).not.toBeInTheDocument();
  });

  it('should not render edit details button for Shopify', () => {
    render(
      <PlatformCard
        platform={'shopify' as Platform}
        connected={true}
        connectedEmail="enabled"
        onConnect={mockOnConnect}
        onEditEmail={mockOnEditEmail}
      />
    );

    expect(screen.queryByRole('button', { name: /edit details/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit email/i })).not.toBeInTheDocument();
  });
});
