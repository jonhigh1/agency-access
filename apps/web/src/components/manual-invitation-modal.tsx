/**
 * ManualInvitationModal Component
 *
 * Modal for connecting agency platforms that use team invitation flow
 * instead of OAuth. Agencies provide either:
 * - Email address (for Kit, Mailchimp, Beehiiv, Klaviyo)
 * - Business ID (for Pinterest)
 * - Shopify store domain + collaborator code (for Shopify)
 *
 * Used for: Kit, Mailchimp, Beehiiv, Klaviyo, Pinterest, Shopify
 */

'use client';

import { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Mail, Info, Building2, ExternalLink } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { PLATFORM_NAMES, type Platform } from '@agency-platform/shared';
import { Button } from '@/components/ui/button';
import { resolveApiUrl } from '@/lib/api/api-env';

// Platforms that use Business ID instead of email
const BUSINESS_ID_PLATFORMS = ['pinterest'];

interface ManualInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: string; // 'kit' | 'mailchimp' | 'beehiiv' | 'klaviyo' | 'pinterest' | 'shopify'
  agencyId: string;
  onSuccess?: () => void;
  mode?: 'create' | 'edit'; // 'create' for new connection, 'edit' to update details
  currentValue?: string; // Pre-filled value for edit mode
}

export function ManualInvitationModal({
  isOpen,
  onClose,
  platform,
  agencyId,
  onSuccess,
  mode = 'create',
  currentValue = '',
}: ManualInvitationModalProps) {
  const [value, setValue] = useState(currentValue || '');
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  const isBusinessIdPlatform = BUSINESS_ID_PLATFORMS.includes(platform);
  const isShopifyPlatform = platform === 'shopify';
  const platformName = PLATFORM_NAMES[platform as Platform] || platform;

  // Reset form when modal opens
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setValue('');
      setError(null);
    }
  };

  // Update value when currentValue prop changes (for edit mode)
  useEffect(() => {
    if (mode === 'edit' && currentValue) {
      setValue(currentValue);
    }
  }, [mode, currentValue]);

  // Connect mutation
  const { mutate: connectPlatform, isPending } = useMutation({
    mutationFn: async (inputValue: string) => {
      const token = await getToken();
      const endpoint = mode === 'edit'
        ? resolveApiUrl(`/agency-platforms/${platform}/manual-invitation`)
        : resolveApiUrl(`/agency-platforms/${platform}/manual-connect`);

      const method = mode === 'edit' ? 'PATCH' : 'POST';

      const body = isBusinessIdPlatform
        ? { agencyId, businessId: inputValue }
        : isShopifyPlatform
        ? { agencyId }
        : { agencyId, invitationEmail: inputValue };

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || `Failed to ${mode === 'edit' ? 'update' : 'connect'} platform`);
      }

      return response.json();
    },
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : `Failed to ${mode === 'edit' ? 'update' : 'connect'} platform`);
    },
  });

  const handleSubmit = () => {
    setError(null);

    if (isShopifyPlatform) {
      connectPlatform('');
      return;
    } else if (isBusinessIdPlatform) {
      // Validate Business ID (numeric, 1-20 digits)
      const businessIdRegex = /^\d{1,20}$/;
      if (!value || !businessIdRegex.test(value)) {
        setError('Please enter a valid Business ID (1-20 digits)');
        return;
      }
    } else {
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value || !emailRegex.test(value)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    connectPlatform(value);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence onExitComplete={() => handleOpenChange(false)}>
      {/* Backdrop */}
      <m.div
        key="manual-invitation-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm"
      />

      {/* Modal */}
      <m.div
        key="manual-invitation-content"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="relative bg-card rounded-lg shadow-brutalist-lg border-2 border-black w-full max-w-md overflow-hidden pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-paper">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-card border border-border flex items-center justify-center">
                {isBusinessIdPlatform ? (
                  <Building2 className="h-5 w-5 text-danger-ink" />
                ) : (
                  <Mail className="h-5 w-5 text-danger-ink" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink font-display">
                  {mode === 'edit' ? `Update ${platformName}` : `Connect ${platformName}`}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isBusinessIdPlatform
                    ? 'Business partnership setup'
                    : isShopifyPlatform
                    ? 'Collaborator access setup'
                    : mode === 'edit'
                    ? 'Update invitation email'
                    : 'Team invitation setup'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                handleOpenChange(false);
              }}
              aria-label="Close modal"
              className="p-2 hover:bg-coral/10 rounded-lg transition-colors text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            {/* Info box */}
            <div className="mb-5 p-4 bg-secondary/10 border border-secondary/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                <div className="text-sm text-ink">
                  <p className="font-medium mb-1">How this works</p>
                  {isBusinessIdPlatform ? (
                    <p className="text-muted-foreground">
                      Your clients will use this Business ID to add your agency as a partner in their {platformName} Business Manager.
                    </p>
                  ) : isShopifyPlatform ? (
                    <p className="text-muted-foreground">
                      Enable Shopify for access requests. Clients provide their store domain and collaborator code during authorization.
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      When requesting {platformName} account access, your client will invite{' '}
                      <span className="font-medium text-ink">this email address</span> to their {platformName} account.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <m.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-coral/10 border border-coral/30 rounded-lg text-sm text-foreground"
              >
                {error}
              </m.div>
            )}

            {/* Content */}
            <div>
              <div className="mb-5">
                {isShopifyPlatform ? (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Enabling Shopify here prepares request links so clients can submit their store domain and collaborator code.
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Client enters store details in the invite flow.</li>
                      <li>Your team uses those details to request access in Shopify Partners.</li>
                    </ul>
                  </div>
                ) : (
                  <>
                    <label htmlFor={isBusinessIdPlatform ? 'business-id' : 'invitation-email'} className="block text-sm font-medium text-ink mb-2">
                      {isBusinessIdPlatform
                        ? 'Pinterest Business ID'
                        : 'Email to receive invitations'}
                    </label>
                    <input
                      id={isBusinessIdPlatform ? 'business-id' : 'invitation-email'}
                      type={isBusinessIdPlatform ? 'text' : 'email'}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={isBusinessIdPlatform ? '1234567890' : 'your-agency@example.com'}
                      pattern={isBusinessIdPlatform ? '\\d{1,20}' : undefined}
                      maxLength={isBusinessIdPlatform ? 20 : undefined}
                      className="w-full px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-primary transition-colors bg-background"
                      disabled={isPending}
                      autoFocus
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {isBusinessIdPlatform
                        ? 'Your Pinterest Business ID (1-20 digits)'
                        : 'This email will receive team invitations from your clients'}
                    </p>
                  </>
                )}
              </div>

              {/* Find your Business ID helper - Pinterest only */}
              {isBusinessIdPlatform && (
                <div className="mb-5 p-4 bg-muted/20 border border-border rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-ink mb-1">Find your Business ID</p>
                      <p className="text-muted-foreground mb-2">
                        You can find your Pinterest Business ID in{' '}
                        <a
                          href={
                            value && /^\d{1,20}$/.test(value)
                              ? `https://www.pinterest.com/business/business-manager/${value}/settings/`
                              : 'https://www.pinterest.com/business/business-manager/'
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-danger-ink hover:text-danger-ink font-medium inline-flex items-center gap-1"
                        >
                          Pinterest Business Manager
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Go to Dashboard → Business settings to find your ID
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    onClose();
                    handleOpenChange(false);
                  }}
                  disabled={isPending}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={isPending || (!isShopifyPlatform && !value)}
                  isLoading={isPending}
                  className="flex-1"
                >
                  {mode === 'edit' ? 'Update' : 'Connect'}
                </Button>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="px-6 py-3 bg-paper border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              {isBusinessIdPlatform
                ? 'You can change this Business ID later from your settings'
                : isShopifyPlatform
                ? 'Clients provide Shopify store details during the access request flow.'
                : 'You can change this email address later from your settings'}
            </p>
          </div>
        </div>
      </m.div>
    </AnimatePresence>
  );
}
