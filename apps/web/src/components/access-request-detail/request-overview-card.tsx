'use client';

import { Bell, Calendar, Clipboard, ExternalLink, Mail, User } from 'lucide-react';
import { Card, Button, StatusBadge } from '@/components/ui';
import type { AccessRequest } from '@/lib/api/access-requests';

interface RequestOverviewCardProps {
  request: AccessRequest;
  authorizationUrl: string;
  onCopyLink: () => void;
  onPreviewLink: () => void;
  onSendReminder?: () => void;
  onEmailClient?: () => void;
  copied: boolean;
  reminderCopied?: boolean;
}

function isAwaitingClient(status: AccessRequest['status']): boolean {
  return status === 'pending' || status === 'partial';
}

export function RequestOverviewCard({
  request,
  authorizationUrl,
  onCopyLink,
  onPreviewLink,
  onSendReminder,
  onEmailClient,
  copied,
  reminderCopied = false,
}: RequestOverviewCardProps) {
  const awaitingClient = isAwaitingClient(request.status);

  return (
    <Card className="border-black/10 shadow-sm">
      <div className="border-b border-border px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Request Overview</h2>
          <p className="text-sm text-muted-foreground">Client and request lifecycle details</p>
        </div>
        <StatusBadge status={request.status as any} />
      </div>

      {awaitingClient && (
        <div className="mx-6 mt-4 rounded-lg border border-coral/30 bg-coral/5 px-4 py-3">
          <p className="text-sm font-semibold text-ink">Waiting on client authorization</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your client authorizes when they are ready. Access tokens are stored only after they
            complete authorization — not when the link is sent.
          </p>
        </div>
      )}

      <div className="p-6 grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Client</p>
            <p className="text-sm font-semibold text-ink">{request.clientName}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
            <p className="text-sm font-semibold text-ink">{request.clientEmail}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
            <p className="text-sm font-semibold text-ink">{new Date(request.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Expires</p>
            <p className="text-sm font-semibold text-ink">{new Date(request.expiresAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-border px-6 py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Authorization Link</p>
        <div className="rounded-lg border border-border bg-paper p-3">
          <code className="break-all text-xs text-ink">{authorizationUrl}</code>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Clipboard className="h-4 w-4" />}
            onClick={onCopyLink}
          >
            {copied ? 'Copied' : 'Copy Link'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ExternalLink className="h-4 w-4" />}
            onClick={onPreviewLink}
          >
            Preview Link
          </Button>
          {awaitingClient && onSendReminder && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Bell className="h-4 w-4" />}
              onClick={onSendReminder}
              aria-label="Send reminder to client"
            >
              {reminderCopied ? 'Link copied — send when ready' : 'Send Reminder'}
            </Button>
          )}
          {awaitingClient && onEmailClient && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Mail className="h-4 w-4" />}
              onClick={onEmailClient}
              aria-label="Email client authorization link"
            >
              Email Client
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
