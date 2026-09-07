/**
 * Save as Template Modal Component
 *
 * Allows users to save the current wizard configuration as a reusable template.
 */

'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import posthog from 'posthog-js';
import { useAccessRequest } from '@/contexts/access-request-context';
import { createTemplate } from '@/lib/api/templates';
import { useQuotaCheck, QuotaExceededError } from '@/lib/query/quota';
import { UpgradeModal } from '@/components/upgrade-modal';

interface SaveAsTemplateModalProps {
  agencyId: string;
  createdBy: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function SaveAsTemplateModal({
  agencyId,
  createdBy,
  isOpen,
  onClose,
  onSave,
}: SaveAsTemplateModalProps) {
  const { getToken } = useAuth();
  const { state } = useAccessRequest();
  const checkQuota = useQuotaCheck();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<QuotaExceededError | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a template name');
      return;
    }

    setError(null);

    // Check quota before saving template
    try {
      const result = await checkQuota.mutateAsync({ metric: 'templates' });
      if (!result.allowed) {
        setQuotaError(
          new QuotaExceededError({
            code: 'QUOTA_EXCEEDED',
            message: `You've reached your Templates limit`,
            metric: 'templates',
            limit: result.limit,
            used: result.used,
            remaining: result.remaining,
            currentTier: result.currentTier,
            suggestedTier: result.suggestedTier,
            upgradeUrl: result.upgradeUrl || '',
          })
        );
        setShowUpgradeModal(true);
        return;
      }
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        setQuotaError(error);
        setShowUpgradeModal(true);
        return;
      }
      // Other errors - allow save to proceed (will be caught by createTemplate)
    }

    setSaving(true);

    try {
      const result = await createTemplate(
        {
          agencyId,
          name: name.trim(),
          description: description.trim() || undefined,
          platforms: state.selectedPlatforms,
          globalAccessLevel: state.globalAccessLevel || 'standard',
          intakeFields: state.intakeFields,
          branding: state.branding,
          isDefault,
          createdBy,
        },
        getToken
      );

      if (result.error) {
        setError(result.error.message);
        setSaving(false);
        return;
      }

      // Track template save in PostHog
      const platformCount = Object.values(state.selectedPlatforms).reduce(
        (sum, products) => sum + products.length,
        0
      );
      posthog.capture('template_saved', {
        template_id: result.data?.id,
        agency_id: agencyId,
        template_name: name.trim(),
        is_default: isDefault,
        platform_count: platformCount,
        platforms: Object.keys(state.selectedPlatforms),
        access_level: state.globalAccessLevel,
        intake_fields_count: state.intakeFields.length,
        has_custom_branding: !!state.branding.logoUrl || state.branding.primaryColor !== '#FF6B35',
      });

      setSaving(false);
      onSave();
      onClose();
      setName('');
      setDescription('');
      setIsDefault(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
      setSaving(false);
    }
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card rounded-lg shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h2 className="text-lg font-semibold text-ink">Save as Template</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 hover:bg-muted/30 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div>
                  <label htmlFor="template-name" className="block text-sm font-medium text-foreground mb-1">
                    Template Name <span className="text-danger-ink">*</span>
                  </label>
                  <input
                    type="text"
                    id="template-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., E-commerce Standard Access"
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-coral"
                  />
                </div>

                <div>
                  <label htmlFor="template-description" className="block text-sm font-medium text-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    id="template-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of what this template is for..."
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-coral"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-danger-ink focus:ring-ring"
                  />
                  <span className="text-sm text-foreground">Set as default template</span>
                </label>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-coral/10 border border-coral/30 rounded-lg text-sm text-danger-ink"
                  >
                    {error}
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 p-6 border-t border-border">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 text-foreground hover:text-ink hover:bg-muted/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>

    {/* Upgrade Modal */}
    {showUpgradeModal && quotaError && (
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false);
          setQuotaError(null);
        }}
        quotaError={quotaError}
      />
    )}
  </>
  );
}
