import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateClientModal } from '../CreateClientModal';

const { getToken } = vi.hoisted(() => ({ getToken: vi.fn() }));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken }),
}));

describe('CreateClientModal', () => {
  beforeEach(() => {
    getToken.mockResolvedValue('test-token');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value() {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value() {
        this.removeAttribute('open');
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes a named dialog, close control, and fields', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CreateClientModal onClose={vi.fn()} />
      </QueryClientProvider>
    );

    expect(screen.getByRole('dialog', { name: 'Create Client' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close create client' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /client contact name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /company name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email address/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Website' })).toBeInTheDocument();
  });

  it('uses a native dialog, cancels on Escape, and restores the opener focus', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open create client</button>
          {open && <CreateClientModal onClose={() => setOpen(false)} />}
        </>
      );
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Harness />
      </QueryClientProvider>
    );

    const opener = screen.getByRole('button', { name: 'Open create client' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Create Client' });
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog).toHaveAttribute('open');

    fireEvent(dialog, new Event('cancel', { cancelable: true }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it('submits once while the create request is pending', async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    })));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <CreateClientModal onClose={vi.fn()} />
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByRole('textbox', { name: /client contact name/i }), { target: { value: 'Ada Lovelace' } });
    fireEvent.change(screen.getByRole('textbox', { name: /company name/i }), { target: { value: 'Analytical Engines' } });
    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), { target: { value: 'ada@example.com' } });

    const form = screen.getByRole('button', { name: 'Create Client' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    resolveResponse?.({ ok: true, json: async () => ({ data: { id: 'client-1', name: 'Ada Lovelace', email: 'ada@example.com' } }) } as Response);
    expect(await screen.findByText('Client created successfully')).toBeInTheDocument();
  });

  it('shows an error when the API omits the created client', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <CreateClientModal onClose={vi.fn()} />
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByRole('textbox', { name: /client contact name/i }), { target: { value: 'Ada Lovelace' } });
    fireEvent.change(screen.getByRole('textbox', { name: /company name/i }), { target: { value: 'Analytical Engines' } });
    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), { target: { value: 'ada@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create Client' }).closest('form')!);

    expect(await screen.findByText('Server returned no client')).toBeInTheDocument();
  });
});
