import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsGroup, SettingsRow } from '../settings-row';

describe('SettingsRow', () => {
  it('renders the label, the description, and the control', () => {
    render(
      <SettingsRow label="Agency name" description="Shown to clients on the request page." controlId="agency-name">
        <input id="agency-name" defaultValue="Acme" />
      </SettingsRow>
    );

    expect(screen.getByText('Agency name')).toBeInTheDocument();
    expect(screen.getByText('Shown to clients on the request page.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Acme')).toBeInTheDocument();
  });

  it('associates the label with the control when controlId is supplied', () => {
    render(
      <SettingsRow label="Website" controlId="website">
        <input id="website" />
      </SettingsRow>
    );

    expect(screen.getByLabelText('Website')).toBeInstanceOf(HTMLInputElement);
  });

  it('renders the label as plain text when no controlId is supplied', () => {
    render(
      <SettingsRow label="Invoices">
        <p>None yet</p>
      </SettingsRow>
    );

    expect(screen.queryByLabelText('Invoices')).toBeNull();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
  });

  it('separates rows with a hairline and drops it on the last row of a group', () => {
    render(
      <SettingsGroup title="Profile">
        <SettingsRow label="One">
          <span>a</span>
        </SettingsRow>
        <SettingsRow label="Two">
          <span>b</span>
        </SettingsRow>
      </SettingsGroup>
    );

    const rows = screen.getAllByTestId('settings-row');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.className).toContain('hairline-b');
      expect(row.className).toContain('last:border-b-0');
    }
  });

  it('collapses to one column below md and lets the control fill the width', () => {
    render(
      <SettingsRow label="Logo URL" controlId="logo">
        <input id="logo" />
      </SettingsRow>
    );

    const row = screen.getByTestId('settings-row');
    expect(row.className).toMatch(/\bgrid\b/);
    expect(row.className).toMatch(/\bmd:grid-cols-/);
    expect(row.className).not.toMatch(/(^|\s)grid-cols-[2-9]/);
    expect(screen.getByTestId('settings-row-control').className).toContain('min-w-0');
  });

  it('SettingsGroup renders its title as a heading and labels the section', () => {
    render(
      <SettingsGroup title="Billing details">
        <SettingsRow label="Name">
          <span>x</span>
        </SettingsRow>
      </SettingsGroup>
    );

    const heading = screen.getByRole('heading', { level: 2, name: 'Billing details' });
    const section = heading.closest('section');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('aria-labelledby')).toBe(heading.id);
  });
});
