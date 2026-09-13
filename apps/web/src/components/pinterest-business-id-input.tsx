'use client';

import { useState } from 'react';
import { ExternalLink, Info, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PinterestBusinessIdInputProps {
  agencyId: string;
  onSubmit: (businessId: string) => void;
  onSkip: () => void;
  isSaving?: boolean;
}

/**
 * Pinterest Business ID Input Component
 *
 * Collects Pinterest Business ID from agency owners (optional).
 * The Business ID is found in Pinterest Business Manager settings.
 *
 * Pinterest API works without Business ID for basic ad account access,
 * but collecting it provides:
 * - Better UX (identifying which business is connected)
 * - Future business-specific operations (audience sharing, partnerships)
 * - Improved metadata and reporting
 */
export function PinterestBusinessIdInput({
  agencyId,
  onSubmit,
  onSkip,
  isSaving = false,
}: PinterestBusinessIdInputProps) {
  const [businessId, setBusinessId] = useState('');

  // Pinterest Business IDs are numeric strings (1-20 digits)
  const isValidBusinessId = /^\d{1,20}$/.test(businessId);
  const canSubmit = isValidBusinessId && !isSaving;

  const handleSubmit = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (canSubmit) {
      onSubmit(businessId);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-slate-900">Pinterest Business ID</h3>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-full">
              Optional
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Add your Pinterest Business ID to help identify your connection. This is optional but recommended for better organization.
          </p>
        </div>

        {/* Instructions */}
        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-indigo-900 font-semibold mb-1">
                Where to find your Pinterest Business ID
              </p>
              <p className="text-sm text-indigo-700 mb-2">
                1. Go to{' '}
                <a
                  href="https://www.pinterest.com/business/business-manager/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-ink underline-offset-4 hover:underline"
                >
                  Pinterest Business Manager
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              <p className="text-sm text-indigo-700 mb-2">
                2. Select your business from the left sidebar
              </p>
              <p className="text-sm text-indigo-700 mb-2">
                3. Click <strong className="text-indigo-900">Settings</strong> in the top navigation
              </p>
              <p className="text-sm text-indigo-700">
                4. Your Business ID is displayed in the overview section
              </p>
              <div className="mt-3 p-2 bg-card rounded border border-indigo-200">
                <p className="text-xs text-indigo-600 font-mono">
                  Example: 664351519939856629
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="space-y-4">
          <div>
            <label htmlFor="pinterest-business-id" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
              Business ID <span className="text-slate-300">(numbers only)</span>
            </label>
            <input
              id="pinterest-business-id"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="e.g., 664351519939856629"
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              maxLength={20}
            />
            {businessId && !isValidBusinessId && (
              <p className="mt-2 text-xs text-red-600 px-1">
                Business ID must contain only numbers
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-between gap-3">
            <Button
              onClick={onSkip}
              disabled={isSaving}
              type="button"
              variant="ghost"
              size="sm"
            >
              Skip for now
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              type="button"
              variant="primary"
            >
              {isSaving ? (
                'Saving...'
              ) : (
                <>
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
