/**
 * HierarchicalPlatformSelector Component
 *
 * Simplified platform selection - only shows connected platforms.
 * Includes toggle switches for each platform to select/deselect all products.
 *
 * For manual invitation platforms (Kit, Beehiiv, Mailchimp, Klaviyo),
 * shows email configuration UI instead of product selection.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, Check, Minus, AlertCircle, Link2, Edit, Mail } from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PLATFORM_HIERARCHY, AccessLevel, ACCESS_LEVEL_DESCRIPTIONS } from '@agency-platform/shared';
import { normalizePlatformToGroup } from '@/lib/transform-platforms';
import Link from 'next/link';
import { ManualInvitationModal } from '@/components/manual-invitation-modal';
import { PlatformIcon, Button } from '@/components/ui';
import { SingleSelect } from '@/components/ui/single-select';
import type { Platform } from '@agency-platform/shared';
import { cn } from '@/lib/utils';

interface ConnectedPlatform {
  platform: string;
  name: string;
  connected: boolean;
  status?: string;
  connectedEmail?: string;
}

interface HierarchicalPlatformSelectorProps {
  selectedPlatforms: Record<string, string[]>;
  onSelectionChange: (platforms: Record<string, string[]>) => void;
  connectedPlatforms?: ConnectedPlatform[];
  agencyId?: string; // For manual invitation modal
  showAllPlatforms?: boolean;
  platformAccessLevels?: Record<string, AccessLevel>;
  onPlatformAccessLevelChange?: (group: string, level: AccessLevel) => void;
}

// Platforms that use manual invitation flow instead of OAuth
const MANUAL_INVITATION_PLATFORMS = new Set(['kit', 'beehiiv', 'mailchimp', 'klaviyo']);

interface GroupState {
  [key: string]: boolean;
}

export function HierarchicalPlatformSelector({
  selectedPlatforms,
  onSelectionChange,
  connectedPlatforms = [],
  agencyId,
  showAllPlatforms = false,
  platformAccessLevels,
  onPlatformAccessLevelChange,
}: HierarchicalPlatformSelectorProps) {
  const prefersReducedMotion = useReducedMotion();
  const [expandedGroups, setExpandedGroups] = useState<GroupState>({});

  // Manual invitation modal state
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<string>('');

  // Filter to only show connected platforms
  const connectedPlatformIds = useMemo(() => {
    return new Set(
      connectedPlatforms
        .filter(p => p.connected)
        .map(p => normalizePlatformToGroup(p.platform))
    );
  }, [connectedPlatforms]);

  // Filter PLATFORM_HIERARCHY to only include connected platforms
  const availableGroups = useMemo(() => {
    if (showAllPlatforms) {
      return Object.entries(PLATFORM_HIERARCHY);
    }

    return Object.entries(PLATFORM_HIERARCHY).filter(([groupKey]) => 
      connectedPlatformIds.has(groupKey)
    );
  }, [connectedPlatformIds, showAllPlatforms]);

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }, []);

  const handlePlatformToggle = useCallback(
    (groupKey: string, products: typeof PLATFORM_HIERARCHY[keyof typeof PLATFORM_HIERARCHY]['products']) => {
      const currentSelection = selectedPlatforms[groupKey] || [];
      const allSelected = products.length > 0 && currentSelection.length === products.length;

      const newSelection = allSelected ? [] : products.map(p => p.id);

      onSelectionChange({
        ...selectedPlatforms,
        [groupKey]: newSelection,
      });
    },
    [selectedPlatforms, onSelectionChange]
  );

  const handleProductToggle = useCallback(
    (groupKey: string, productId: string) => {
      const currentSelection = selectedPlatforms[groupKey] || [];
      const isSelected = currentSelection.includes(productId);

      const newSelection = isSelected
        ? currentSelection.filter(id => id !== productId)
        : [...currentSelection, productId];

      onSelectionChange({
        ...selectedPlatforms,
        [groupKey]: newSelection,
      });
    },
    [selectedPlatforms, onSelectionChange]
  );

  const handleSelectAll = useCallback(
    (groupKey: string, products: typeof PLATFORM_HIERARCHY[keyof typeof PLATFORM_HIERARCHY]['products']) => {
      const currentSelection = selectedPlatforms[groupKey] || [];
      const allSelected = products.length > 0 && currentSelection.length === products.length;

      const newSelection = allSelected ? [] : products.map(p => p.id);

      onSelectionChange({
        ...selectedPlatforms,
        [groupKey]: newSelection,
      });
    },
    [selectedPlatforms, onSelectionChange]
  );

  const getGroupSelectionCount = useCallback(
    (groupKey: string) => {
      return (selectedPlatforms[groupKey] || []).length;
    },
    [selectedPlatforms]
  );

  const getPlatformToggleState = useCallback(
    (groupKey: string, productCount: number) => {
      const selection = selectedPlatforms[groupKey] || [];
      if (selection.length === 0) return { checked: false, indeterminate: false };
      if (selection.length === productCount) return { checked: true, indeterminate: false };
      return { checked: false, indeterminate: true };
    },
    [selectedPlatforms]
  );

  const isProductSelected = useCallback(
    (groupKey: string, productId: string) => {
      return (selectedPlatforms[groupKey] || []).includes(productId);
    },
    [selectedPlatforms]
  );

  // Handle email edit for manual invitation platforms
  const handleEditEmail = useCallback((platform: string, currentEmail: string) => {
    setEditingPlatform(platform);
    setEditingEmail(currentEmail);
    setManualModalOpen(true);
  }, []);

  const handleManualModalClose = useCallback(() => {
    setManualModalOpen(false);
    setEditingPlatform(null);
    setEditingEmail('');
  }, []);

  const handleManualSuccess = useCallback(() => {
    setManualModalOpen(false);
    setEditingPlatform(null);
    setEditingEmail('');
  }, []);

  // Get the connected email for a platform
  const getPlatformEmail = useCallback((platform: string) => {
    return connectedPlatforms.find(p => p.platform === platform)?.connectedEmail;
  }, [connectedPlatforms]);

  // Empty state - no connected platforms
  if (!showAllPlatforms && availableGroups.length === 0) {
    return (
      <div className="text-center py-8 px-6 bg-muted/20 rounded-lg border border-border">
        <div className="inline-flex p-3 bg-muted/30 rounded-full mb-4">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-ink mb-2">
          No platforms connected
        </h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
          Connect platforms in your settings before creating access requests.
        </p>
        <Button asChild variant="primary" size="sm">
          <Link href="/connections">
            <Link2 className="h-4 w-4" />
            Go to Connections
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {availableGroups.map(([groupKey, group]) => {
        const isExpanded = expandedGroups[groupKey] || false;
        const selectionCount = getGroupSelectionCount(groupKey);
        const { checked: platformChecked, indeterminate: platformIndeterminate } =
          getPlatformToggleState(groupKey, group.products.length);
        const selectionState = platformChecked ? 'all' : platformIndeterminate ? 'partial' : 'none';

        return (
          <div
            key={groupKey}
            className={cn(
              'border rounded-xl overflow-hidden transition-all duration-200',
              selectionState !== 'none'
                ? 'border-coral/40 bg-coral/[0.03]'
                : 'border-border bg-card'
            )}
          >
            {/* Platform Header */}
            <div className="flex items-center gap-3 px-4 py-3 min-h-[56px]">
              {/* Select-all toggle checkbox */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlatformToggle(groupKey, group.products);
                }}
                aria-label={`Toggle all ${group.name} products`}
                className={cn(
                  'flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200',
                  selectionState === 'all'
                    ? 'bg-coral border-coral'
                    : selectionState === 'partial'
                      ? 'bg-coral/15 border-coral'
                      : 'bg-background border-border hover:border-coral/50'
                )}
              >
                {selectionState === 'all' && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                {selectionState === 'partial' && <Minus className="h-3.5 w-3.5 text-danger-ink" strokeWidth={3} />}
              </button>

              {/* Clickable header area */}
              <button
                type="button"
                onClick={() => toggleGroup(groupKey)}
                className="flex-1 flex items-center gap-3 text-left min-w-0"
                aria-expanded={isExpanded}
                aria-label={`${group.name} platform group`}
              >
                <PlatformIcon platform={groupKey as Platform} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm text-foreground">{group.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {selectionCount > 0
                      ? `${selectionCount} of ${group.products.length} selected`
                      : `${group.products.length} products`}
                  </span>
                </div>

                {selectionCount > 0 && (
                  <span className="flex-shrink-0 text-xs font-semibold text-danger-ink">
                    {selectionCount} selected
                  </span>
                )}

                <ChevronDown
                  className={cn(
                    'flex-shrink-0 h-4 w-4 text-muted-foreground transition-transform duration-200',
                    isExpanded && 'rotate-180'
                  )}
                />
              </button>
            </div>

            {/* Products / Email config (expanded) */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <m.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.2,
                    ease: 'easeInOut',
                  }}
                  className="overflow-hidden"
                >
                  {(() => {
                    const isManualPlatform = MANUAL_INVITATION_PLATFORMS.has(groupKey);
                    const platformEmail = getPlatformEmail(groupKey);

                    if (isManualPlatform) {
                      return (
                        <div className="border-t border-border/50 p-4 bg-muted/10">
                          <div className="flex items-start gap-3 p-4 bg-card border border-border rounded-xl">
                            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-coral/10 border border-border flex items-center justify-center">
                              <Mail className="h-5 w-5 text-danger-ink" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-foreground mb-1">Invitation Email</h4>
                              <p className="text-xs text-muted-foreground mb-3">
                                Clients will invite this email to their {group.name} account
                              </p>
                              {platformEmail ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 px-3 py-2 bg-muted/20 border border-border rounded-lg">
                                    <p className="text-sm font-mono text-foreground truncate" title={platformEmail}>
                                      {platformEmail}
                                    </p>
                                  </div>
                                  {agencyId && (
                                    <button
                                      type="button"
                                      onClick={() => handleEditEmail(groupKey, platformEmail)}
                                      className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors flex items-center gap-1"
                                    >
                                      <Edit className="h-3 w-3" />
                                      Edit
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="p-3 bg-muted/20 border border-border rounded-lg">
                                  <p className="text-xs text-foreground">
                                    No email configured.{' '}
                                    <Link href="/connections" className="font-medium underline hover:text-foreground">
                                      Connect {group.name}
                                    </Link>{' '}
                                    to set up the invitation email.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Standard product grid
                    return (
                      <div className="border-t border-border/50 px-4 pb-3 pt-2 bg-muted/5">
                        {/* Select all row */}
                        <button
                          type="button"
                          onClick={() => handleSelectAll(groupKey, group.products)}
                          className="flex items-center gap-2.5 cursor-pointer py-2 mb-1 w-full text-left"
                          aria-label={`Select all ${group.name} products`}
                        >
                          <div
                            className={cn(
                              'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-150',
                              selectionState === 'all'
                                ? 'bg-coral border-coral'
                                : selectionState === 'partial'
                                  ? 'bg-coral/15 border-coral'
                                  : 'bg-background border-border'
                            )}
                          >
                            {selectionState === 'all' && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                            {selectionState === 'partial' && <Minus className="h-3 w-3 text-danger-ink" strokeWidth={3} />}
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            Select all ({group.products.length})
                          </span>
                        </button>

                        {/* Per-platform access level selector (if enabled and products selected) */}
                        {platformAccessLevels && onPlatformAccessLevelChange && selectionCount > 0 && (
                          <div className="flex items-center gap-2.5 py-2 mb-1">
                            <label
                              htmlFor={`access-level-${groupKey}`}
                              className="text-xs text-muted-foreground whitespace-nowrap"
                            >
                              Access level:
                            </label>
                            <SingleSelect
                              options={[
                                { value: 'admin', label: 'Admin' },
                                { value: 'standard', label: 'Standard' },
                                { value: 'read_only', label: 'Read Only' },
                                { value: 'email_only', label: 'Email Only' },
                              ]}
                              value={platformAccessLevels[groupKey] || 'standard'}
                              onChange={(v: string) => onPlatformAccessLevelChange(groupKey, v as AccessLevel)}
                              ariaLabel={`Access level for ${group.name}`}
                              className="flex-1 min-w-0"
                              triggerClassName="px-2 py-1.5 text-sm min-h-auto"
                            />
                          </div>
                        )}

                        {/* Product grid */}
                        <div className="grid grid-cols-2 gap-1">
                          {group.products.map(product => {
                            const isSelected = isProductSelected(groupKey, product.id);
                            const inputId = `product-${groupKey}-${product.id}`;
                            return (
                              <label
                                key={product.id}
                                htmlFor={inputId}
                                className={cn(
                                  'flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2.5 transition-all duration-150 min-h-[44px]',
                                  isSelected
                                    ? 'bg-coral/8'
                                    : 'hover:bg-muted/40'
                                )}
                              >
                                <div
                                  className={cn(
                                    'flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 pointer-events-none',
                                    isSelected
                                      ? 'bg-coral border-coral'
                                      : 'bg-background border-border'
                                  )}
                                >
                                  {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                                </div>
                                <input
                                  id={inputId}
                                  type="checkbox"
                                  className="sr-only"
                                  aria-label={product.name}
                                  checked={isSelected}
                                  onChange={() => handleProductToggle(groupKey, product.id)}
                                />
                                <PlatformIcon platform={product.id as Platform} size="sm" />
                                <span className={cn(
                                  'text-sm font-medium leading-tight',
                                  isSelected ? 'text-danger-ink' : 'text-foreground'
                                )}>
                                  {product.name}
                                </span>
                                {isSelected && (
                                  <Check className="h-3.5 w-3.5 text-danger-ink ml-auto flex-shrink-0" />
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </m.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Manual Invitation Modal */}
      {editingPlatform && agencyId && (
        <ManualInvitationModal
          isOpen={manualModalOpen}
          onClose={handleManualModalClose}
          platform={editingPlatform}
          agencyId={agencyId}
          onSuccess={handleManualSuccess}
          mode="edit"
          currentValue={editingEmail}
        />
      )}
    </div>
  );
}
