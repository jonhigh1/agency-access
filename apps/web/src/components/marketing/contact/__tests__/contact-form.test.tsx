import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ContactForm } from '../contact-form';

vi.mock('framer-motion', () => ({
  m: {
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ContactForm', () => {
  it('focuses the first invalid control and preserves entered values', async () => {
    render(<ContactForm />);

    const company = screen.getByRole('textbox', { name: /company/i });
    fireEvent.change(company, { target: { value: 'Example Agency' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveFocus();
    expect(company).toHaveValue('Example Agency');
    expect(screen.getAllByRole('alert')).toHaveLength(3);
  });

  it('submits once while pending and sends normalized values', async () => {
    let resolveResponse: ((value: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    })));

    render(<ContactForm />);

    fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), { target: { value: ' Ada Lovelace ' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^Email/ }), { target: { value: ' ada@example.com ' } });
    fireEvent.change(screen.getByRole('textbox', { name: /company/i }), { target: { value: ' Analytical Engines ' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^Message/ }), { target: { value: ' Please help with access. ' } });

    const form = screen.getByRole('button', { name: 'Send Message' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      company: 'Analytical Engines',
      message: 'Please help with access.',
    });

    resolveResponse?.({ ok: true, json: async () => ({ data: { success: true } }) } as Response);
    expect(await screen.findByText('Message Sent!')).toBeInTheDocument();
  });
});
