'use client';

export function WizardConnectedExample() {
  return (
    <section aria-labelledby="wizard-connected-example-heading">
      <h3 id="wizard-connected-example-heading" className="label-micro text-muted-foreground mb-3">
        When they connect, you&apos;ll see
      </h3>

      <div className="rounded-lg border-2 border-dashed border-border bg-muted/10 p-4">
        <p className="label-micro text-muted-foreground mb-2">Example</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-muted-foreground">Google</span>
          <span className="text-sm font-semibold text-success-ink">Connected</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        That&apos;s the finish line — not creating the link.
      </p>
    </section>
  );
}
