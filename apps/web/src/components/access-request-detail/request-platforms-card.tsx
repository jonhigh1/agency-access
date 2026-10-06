'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import type { AccessRequest } from '@/lib/api/access-requests';
import type { ManualConfirmationPlatform } from '@agency-platform/shared';
import { PLATFORM_NAMES } from '@agency-platform/shared';
import { ShopifySubmissionPanel } from './shopify-submission-panel';

interface RequestPlatformsCardProps {
  request: AccessRequest;
  onConfirmManualAccess?: (platform: ManualConfirmationPlatform) => Promise<string | null>;
}

type UnresolvedProduct = NonNullable<
  NonNullable<AccessRequest['authorizationProgress']>['unresolvedProducts']
>[number];

function formatGroup(group: string): string {
  return PLATFORM_NAMES[group as keyof typeof PLATFORM_NAMES] || group.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatProduct(product: string): string {
  return PLATFORM_NAMES[product as keyof typeof PLATFORM_NAMES] || product.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatUnresolvedReason(reason: string): string {
  switch (reason) {
    case 'no_assets':
      return 'No assets found';
    case 'selection_required':
      return 'Selection required';
    default:
      return formatProduct(reason);
  }
}

export function RequestPlatformsCard({ request, onConfirmManualAccess }: RequestPlatformsCardProps) {
  const [acknowledgedPlatforms, setAcknowledgedPlatforms] = useState<Record<string, boolean>>({});
  const [submittingPlatform, setSubmittingPlatform] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const shopifyRequested = request.platforms.some(
    (group) =>
      group.platformGroup === 'shopify' ||
      group.products.some((product) => product.product === 'shopify')
  );
  const unresolvedProducts = request.authorizationProgress?.unresolvedProducts || [];
  const manualConfirmations = request.manualConfirmations || [];

  const submitManualConfirmation = async (platform: ManualConfirmationPlatform) => {
    if (!onConfirmManualAccess || !acknowledgedPlatforms[platform] || submittingPlatform) return;
    setSubmittingPlatform(platform);
    setErrors((current) => ({ ...current, [platform]: '' }));
    const error = await onConfirmManualAccess(platform);
    if (error) setErrors((current) => ({ ...current, [platform]: error }));
    setSubmittingPlatform(null);
  };

  return (
    <Card className="border-black/10 shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h2 className="font-display text-lg font-semibold text-ink">Requested Platforms</h2>
        <p className="text-sm text-muted-foreground">Products and requested access levels</p>
      </div>

      <div className="p-6">
        {request.platforms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No platforms requested.</p>
        ) : (
          <div className="space-y-4">
            {request.platforms.map((group) => (
              <div key={group.platformGroup}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  {formatGroup(group.platformGroup)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.products.map((product) => (
                    <span
                      key={`${group.platformGroup}-${product.product}`}
                      className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
                    >
                      {formatProduct(product.product)} · {product.accessLevel.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {unresolvedProducts.length > 0 && (
          <div className="mt-5 rounded-md border border-[var(--warning)] bg-[var(--warning)]/10 p-4">
            <p className="text-sm font-semibold text-ink">Still needs follow-up</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {unresolvedProducts.map((item: UnresolvedProduct) => (
                <li key={`${item.platformGroup}-${item.product}-${item.reason}`}>
                  {formatProduct(item.product)} · {formatUnresolvedReason(item.reason)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {manualConfirmations.length > 0 && (
          <div className="mt-5 space-y-3" aria-label="Manual access confirmations">
            {manualConfirmations.map((confirmation) => {
              const platformName = formatGroup(confirmation.platform);
              if (confirmation.verificationStatus === 'verified') {
                return (
                  <div
                    key={confirmation.platform}
                    className="flex items-start gap-3 border border-teal/30 bg-teal/10 p-4"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-ink" />
                    <div>
                      <p className="text-sm font-semibold text-ink">{platformName}</p>
                      <p className="mt-1 text-sm font-medium text-success-ink">Confirmed by agency</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Manual review recorded. This is not automated provider verification.
                      </p>
                    </div>
                  </div>
                );
              }

              const error = errors[confirmation.platform];
              const isSubmitting = submittingPlatform === confirmation.platform;
              return (
                <div
                  key={confirmation.platform}
                  className="border border-[var(--warning)] bg-[var(--warning)]/10 p-4"
                >
                  <p className="text-sm font-semibold text-ink">{platformName} access needs agency review</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Check access in {platformName}, then record your manual confirmation.
                  </p>
                  <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-ink">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-coral"
                      checked={Boolean(acknowledgedPlatforms[confirmation.platform])}
                      disabled={Boolean(submittingPlatform)}
                      onChange={(event) => setAcknowledgedPlatforms((current) => ({
                        ...current,
                        [confirmation.platform]: event.target.checked,
                      }))}
                    />
                    I checked {platformName} access in the native platform.
                  </label>
                  {error && (
                    <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-danger-ink">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {error}
                    </p>
                  )}
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    isLoading={isSubmitting}
                    disabled={!acknowledgedPlatforms[confirmation.platform] || Boolean(submittingPlatform)}
                    onClick={() => void submitManualConfirmation(confirmation.platform)}
                  >
                    {error ? 'Try confirmation again' : 'Confirm access manually'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5">
          <ShopifySubmissionPanel
            requested={shopifyRequested}
            submission={request.shopifySubmission}
          />
        </div>
      </div>
    </Card>
  );
}
