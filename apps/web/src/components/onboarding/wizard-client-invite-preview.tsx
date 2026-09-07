'use client';

interface WizardClientInvitePreviewProps {
  agencyName?: string;
  accessLink: string;
}

export function WizardClientInvitePreview({
  agencyName,
  accessLink,
}: WizardClientInvitePreviewProps) {
  const agencyLabel = agencyName?.trim() || 'Your agency';
  const agencyInitial = agencyLabel.slice(0, 1).toUpperCase();

  return (
    <section aria-labelledby="wizard-client-preview-heading">
      <h3 id="wizard-client-preview-heading" className="label-micro text-muted-foreground mb-3">
        What your client sees
      </h3>

      <div
        className="rounded-lg border-2 border-black bg-paper p-4 pointer-events-none select-none"
        aria-hidden="true"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold text-ink">
            {agencyInitial}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {agencyLabel}
            </p>
            <p className="text-sm font-semibold text-ink font-display">Authorize platform access</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">Google</span>
            <span className="rounded-none border border-black bg-coral px-3 py-1.5 text-xs font-semibold text-white">
              Connect
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Connected when they finish Google
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        They open this link and connect Google. No account required on their side beyond Google.
      </p>

      <div className="mt-3 rounded-lg border border-border bg-card p-3">
        <p className="label-micro mb-1 text-muted-foreground">Invite link</p>
        <code className="block break-all font-mono text-xs text-ink">{accessLink}</code>
      </div>
    </section>
  );
}
