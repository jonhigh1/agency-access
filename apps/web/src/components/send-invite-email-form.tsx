'use client';

import { useId, useState, type FormEvent } from 'react';
import { Check, Send } from 'lucide-react';
import { Button } from '@/components/ui';
import { sendAccessRequestInviteEmail } from '@/lib/api/access-requests';
import { trackInviteEmailSent, type InviteSurface } from '@/lib/analytics/invite-events';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface SendInviteEmailFormProps {
  accessRequestId: string;
  surface: InviteSurface;
  status?: string | null;
  defaultEmail?: string | null;
  getToken: () => Promise<string | null>;
  size?: 'sm' | 'md';
  className?: string;
}

type SendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

export function SendInviteEmailForm({
  accessRequestId,
  surface,
  status,
  defaultEmail,
  getToken,
  size = 'md',
  className,
}: SendInviteEmailFormProps) {
  const inputId = useId();
  const messageId = `${inputId}-message`;
  const [email, setEmail] = useState(defaultEmail?.trim() ?? '');
  const [state, setState] = useState<SendState>({ kind: 'idle' });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.kind === 'sending') return;

    const recipient = email.trim();
    if (!EMAIL_PATTERN.test(recipient)) {
      setState({ kind: 'error', message: 'Enter a valid client email address.' });
      return;
    }

    setState({ kind: 'sending' });
    const result = await sendAccessRequestInviteEmail(accessRequestId, recipient, getToken);

    if (result.data) {
      trackInviteEmailSent({ access_request_id: accessRequestId, surface, status });
      setState({ kind: 'sent', email: recipient });
      return;
    }

    setState({
      kind: 'error',
      message: result.error?.message || 'We could not send the invite email. Try again or copy the link.',
    });
  };

  const inputHeight = size === 'sm' ? 'h-11' : 'h-12';

  return (
    <form className={className} onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink">
        Client email
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (state.kind !== 'sending') setState({ kind: 'idle' });
          }}
          placeholder="client@example.com"
          maxLength={254}
          aria-invalid={state.kind === 'error'}
          aria-describedby={state.kind === 'error' || state.kind === 'sent' ? messageId : undefined}
          className={`${inputHeight} w-full min-w-0 sm:flex-1 rounded-lg border-2 border-border bg-card px-3 text-sm text-ink placeholder:text-muted-foreground focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/30`}
        />
        <Button
          type="submit"
          variant="secondary"
          size={size}
          disabled={state.kind === 'sending'}
          aria-busy={state.kind === 'sending'}
          leftIcon={state.kind === 'sent' ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        >
          {state.kind === 'sending' ? 'Sending…' : state.kind === 'sent' ? 'Sent' : 'Send invite'}
        </Button>
      </div>
      {state.kind === 'error' ? (
        <p id={messageId} role="alert" className="mt-2 text-sm text-danger-ink">
          {state.message}
        </p>
      ) : null}
      {state.kind === 'sent' ? (
        <p id={messageId} role="status" className="mt-2 text-sm text-muted-foreground">
          Invite sent to {state.email}. Replies go to you.
        </p>
      ) : null}
    </form>
  );
}
