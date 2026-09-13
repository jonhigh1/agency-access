'use client';

/**
 * Invoices
 *
 * One row per invoice (date, amount, status, PDF link). No table, so the
 * list never scrolls horizontally at 320px.
 */

import { Download } from 'lucide-react';
import { useInvoices } from '@/lib/query/billing';
import { StatusBadge } from '@/components/ui/status-badge';
import { SettingsGroup, SettingsRow } from '../settings-row';
import { formatMediumDate } from '@/lib/format';

export function InvoicesCard() {
  const { data: invoices, isLoading } = useInvoices();

  const getStatusBadge = (status: string) => {
    const statusVariants: Record<string, 'success' | 'warning' | 'default'> = {
      paid: 'success',
      open: 'warning',
      void: 'default',
      uncollectible: 'default',
    };
    const variant = statusVariants[status] || 'warning';
    return <StatusBadge badgeVariant={variant}>{status}</StatusBadge>;
  };

  return (
    <SettingsGroup title="Invoices" description="Your billing history">
      {isLoading ? (
        <SettingsRow label="Recent invoices">
          <div className="space-y-2">
            <div aria-hidden="true" className="h-5 w-full max-w-xs bg-muted animate-pulse" />
            <div aria-hidden="true" className="h-5 w-full max-w-xs bg-muted animate-pulse" />
          </div>
        </SettingsRow>
      ) : invoices && invoices.length > 0 ? (
        invoices.map((invoice) => (
          <SettingsRow
            key={invoice.id}
            label={formatMediumDate(invoice.invoiceDate)}
            description={
              <span className="font-mono">
                ${(invoice.amount / 100).toFixed(2)} {invoice.currency.toUpperCase()}
              </span>
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              {getStatusBadge(invoice.status)}
              {invoice.pdfUrl && (
                <a
                  href={invoice.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-ink underline-offset-4 hover:underline"
                >
                  <Download className="h-4 w-4" />
                  PDF
                </a>
              )}
            </div>
          </SettingsRow>
        ))
      ) : (
        <SettingsRow
          label="No invoices yet"
          description="Invoices appear here after your first payment, with a PDF for your records."
        >
          <p className="font-mono text-sm text-muted-foreground">—</p>
        </SettingsRow>
      )}
    </SettingsGroup>
  );
}
