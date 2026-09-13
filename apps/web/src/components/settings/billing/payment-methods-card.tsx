'use client';

/**
 * Payment Methods
 *
 * One row per saved payment method, or a three-beat empty row that sends
 * the operator to the billing portal.
 */

import { ExternalLink, Loader2 } from 'lucide-react';
import { usePaymentMethods, useOpenPortal } from '@/lib/query/billing';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { SettingsGroup, SettingsRow } from '../settings-row';

export function PaymentMethodsCard() {
  const { data: paymentMethods, isLoading } = usePaymentMethods();
  const openPortal = useOpenPortal();

  const handleManagePayments = async () => {
    const result = await openPortal.mutateAsync(window.location.href);
    window.location.href = result.portalUrl;
  };

  const manageButton = (
    <Button variant="secondary" size="sm" onClick={handleManagePayments} disabled={openPortal.isPending}>
      {openPortal.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <ExternalLink className="h-4 w-4" />
          Manage
        </>
      )}
    </Button>
  );

  return (
    <SettingsGroup
      title="Payment methods"
      description="Manage your payment options"
      aside={paymentMethods && paymentMethods.length > 0 ? manageButton : undefined}
    >
      {isLoading ? (
        <SettingsRow label="Saved cards">
          <div aria-hidden="true" className="h-10 w-full max-w-xs bg-muted animate-pulse" />
        </SettingsRow>
      ) : paymentMethods && paymentMethods.length > 0 ? (
        paymentMethods.map((method) => (
          <SettingsRow
            key={method.id}
            label={`•••• •••• •••• ${method.last4}`}
            description={`Expires ${method.expMonth}/${method.expYear}`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-6 w-10 items-center justify-center border border-border bg-muted font-mono text-xs font-medium text-muted-foreground">
                {method.brand.toUpperCase()}
              </span>
              {method.isDefault && <StatusBadge badgeVariant="success">Default</StatusBadge>}
            </div>
          </SettingsRow>
        ))
      ) : (
        <SettingsRow
          label="No payment methods saved"
          description="Add a card so your plan renews without interruption."
        >
          <Button variant="secondary" size="sm" onClick={handleManagePayments} disabled={openPortal.isPending}>
            {openPortal.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening...
              </>
            ) : (
              'Add a payment method'
            )}
          </Button>
        </SettingsRow>
      )}
    </SettingsGroup>
  );
}
