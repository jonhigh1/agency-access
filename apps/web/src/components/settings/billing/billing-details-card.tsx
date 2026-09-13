'use client';

/**
 * Billing Details
 *
 * Rows for billing contact and address. Address inputs sit in a
 * `grid-cols-1 md:grid-cols-2` grid so 320px shows one column.
 */

import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { useBillingDetails, useUpdateBillingDetails, type BillingDetails } from '@/lib/query/billing';
import { Button } from '@/components/ui/button';
import { SettingsGroup, SettingsRow } from '../settings-row';

const INPUT_CLASS = 'w-full max-w-lg border border-black px-4 py-3';
const FIELD_LABEL_CLASS = 'mb-1 block text-xs font-medium text-muted-foreground';

export function BillingDetailsCard() {
  const { data: billingDetails, isLoading } = useBillingDetails();
  const updateBilling = useUpdateBillingDetails();

  const [formData, setFormData] = useState<BillingDetails>({
    name: '',
    email: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    },
  });

  useEffect(() => {
    if (billingDetails) {
      setFormData({
        name: billingDetails.name || '',
        email: billingDetails.email || '',
        address: {
          line1: billingDetails.address?.line1 || '',
          line2: billingDetails.address?.line2 || '',
          city: billingDetails.address?.city || '',
          state: billingDetails.address?.state || '',
          postalCode: billingDetails.address?.postalCode || '',
          country: billingDetails.address?.country || '',
        },
      });
    }
  }, [billingDetails]);

  const handleSave = async () => {
    await updateBilling.mutateAsync(formData);
  };

  const updateField = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.replace('address.', '');
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [addressField]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  if (isLoading) {
    return (
      <SettingsGroup title="Billing details" description="Invoice and billing address">
        <SettingsRow label="Company name">
          <div aria-hidden="true" className="h-12 w-full max-w-lg bg-muted animate-pulse" />
        </SettingsRow>
        <SettingsRow label="Billing email">
          <div aria-hidden="true" className="h-12 w-full max-w-lg bg-muted animate-pulse" />
        </SettingsRow>
        <SettingsRow label="Address">
          <div aria-hidden="true" className="h-12 w-full max-w-lg bg-muted animate-pulse" />
        </SettingsRow>
      </SettingsGroup>
    );
  }

  return (
    <SettingsGroup title="Billing details" description="Invoice and billing address">
      <SettingsRow label="Company name" description="Shown on every invoice." controlId="billing-company-name">
        <input
          id="billing-company-name"
          type="text"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
          className={INPUT_CLASS}
        />
      </SettingsRow>

      <SettingsRow label="Billing email" description="Where invoices and receipts are sent." controlId="billing-email">
        <input
          id="billing-email"
          type="email"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
          className={INPUT_CLASS}
        />
      </SettingsRow>

      <SettingsRow label="Address" description="Used for tax and invoice compliance.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
          <div className="md:col-span-2">
            <label htmlFor="billing-address-line1" className={FIELD_LABEL_CLASS}>
              Address line 1
            </label>
            <input
              id="billing-address-line1"
              type="text"
              value={formData.address?.line1}
              onChange={(e) => updateField('address.line1', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="billing-address-line2" className={FIELD_LABEL_CLASS}>
              Address line 2
            </label>
            <input
              id="billing-address-line2"
              type="text"
              value={formData.address?.line2}
              onChange={(e) => updateField('address.line2', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="billing-address-city" className={FIELD_LABEL_CLASS}>
              City
            </label>
            <input
              id="billing-address-city"
              type="text"
              value={formData.address?.city}
              onChange={(e) => updateField('address.city', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="billing-address-state" className={FIELD_LABEL_CLASS}>
              State
            </label>
            <input
              id="billing-address-state"
              type="text"
              value={formData.address?.state}
              onChange={(e) => updateField('address.state', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="billing-address-postal-code" className={FIELD_LABEL_CLASS}>
              Postal code
            </label>
            <input
              id="billing-address-postal-code"
              type="text"
              value={formData.address?.postalCode}
              onChange={(e) => updateField('address.postalCode', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="billing-address-country" className={FIELD_LABEL_CLASS}>
              Country
            </label>
            <input
              id="billing-address-country"
              type="text"
              value={formData.address?.country}
              onChange={(e) => updateField('address.country', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </SettingsRow>

      <SettingsRow label="Save details" description="Changes apply to your next invoice.">
        <Button variant="secondary" onClick={handleSave} disabled={updateBilling.isPending}>
          {updateBilling.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Details
            </>
          )}
        </Button>
      </SettingsRow>
    </SettingsGroup>
  );
}
