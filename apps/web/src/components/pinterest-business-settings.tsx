'use client';

import { useState } from 'react';
import { ExternalLink, Edit2, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PinterestBusinessSettingsProps {
  agencyId: string;
  businessId?: string;
  onUpdate: (businessId: string) => Promise<void>;
}

/**
 * Pinterest Business Settings Component
 *
 * Displays the current Pinterest Business ID and allows editing.
 * Shows in the agency's platform connection settings.
 */
export function PinterestBusinessSettings({
  agencyId,
  businessId,
  onUpdate,
}: PinterestBusinessSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(businessId || '');
  const [isSaving, setIsSaving] = useState(false);

  const isValidBusinessId = /^\d{1,20}$/.test(value);

  const handleSave = async () => {
    if (!isValidBusinessId) return;

    setIsSaving(true);
    try {
      await onUpdate(value);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update Business ID:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="bg-card rounded-lg border border-slate-200 p-4">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
          Pinterest Business ID
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter Business ID"
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            maxLength={20}
            disabled={isSaving}
          />
          <Button
            onClick={handleSave}
            disabled={!isValidBusinessId || isSaving}
            variant="primary"
            size="sm"
          >
            {isSaving ? 'Saving...' : <><Check className="h-4 w-4" /> Save</>}
          </Button>
          <Button
            onClick={() => {
              setValue(businessId || '');
              setIsEditing(false);
            }}
            disabled={isSaving}
            variant="ghost"
            size="sm"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
            Pinterest Business ID
          </label>
          {businessId ? (
            <div className="flex items-center gap-3">
              <p className="text-sm font-mono text-slate-900">{businessId}</p>
              <a
                href={`https://www.pinterest.com/business/business-manager/${businessId}/settings/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-ink underline-offset-4 hover:underline"
              >
                View in Business Manager
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No Business ID set</p>
          )}
        </div>
        <Button
          onClick={() => setIsEditing(true)}
          variant="ghost"
          size="sm"
          className="px-3 py-1.5"
        >
          {businessId ? (
            <>
              <Edit2 className="h-4 w-4" /> Edit
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Add
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
