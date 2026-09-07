/**
 * Team Invite Screen (Screen 4)
 *
 * Step 5 of the unified onboarding flow.
 * Purpose: AFTER value delivered, offer team expansion (fully skippable).
 *
 * Key Elements:
 * - Fully optional (prominent "Skip" button)
 * - Clear "you can do this later" reassurance
 * - Simple invite mechanism
 * - No guilt for skipping
 *
 * Design Principles:
 * - Optional: Value has already been delivered, this is extra
 * - No Pressure: Users shouldn't feel guilty for skipping
 * - Fast: Can complete in 30 seconds or skip immediately
 */

'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AgencyRole } from '@agency-platform/shared';
import { OpinionatedInput } from '../opinionated-input';
import { SingleSelect } from '@/components/ui/single-select';
import { fadeVariants, fadeTransition } from '@/lib/animations';
import { formatOnboardingStepLabel } from '@/lib/onboarding-steps';
import { X, Plus, Mail } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface TeamInvite {
  email: string;
  role: AgencyRole;
}

interface TeamInviteScreenProps {
  teamInvites: TeamInvite[];
  onAddInvite: (invite: TeamInvite) => void;
  onRemoveInvite: (email: string) => void;
  onUpdateInviteRole: (email: string, role: AgencyRole) => void;
  canSendInvites: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const ROLE_OPTIONS: Array<{ value: AgencyRole; label: string; description: string }> = [
  { value: 'admin', label: 'Admin', description: 'Full access to all features' },
  { value: 'member', label: 'Member', description: 'Create & manage access requests' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
];

// ============================================================
// COMPONENT
// ============================================================

export function TeamInviteScreen({
  teamInvites,
  onAddInvite,
  onRemoveInvite,
  onUpdateInviteRole,
  canSendInvites,
}: TeamInviteScreenProps) {
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AgencyRole>('member');

  // Handle adding a new invite
  const handleAddInvite = useCallback(() => {
    if (!newEmail.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return;

    onAddInvite({ email: newEmail, role: newRole });
    setNewEmail('');
    setNewRole('member');
  }, [newEmail, newRole, onAddInvite]);

  // Handle removing an invite
  const handleRemoveInvite = useCallback(
    (email: string) => {
      onRemoveInvite(email);
    },
    [onRemoveInvite]
  );

  // Handle updating role
  const handleUpdateRole = useCallback(
    (email: string, role: AgencyRole) => {
      onUpdateInviteRole(email, role);
    },
    [onUpdateInviteRole]
  );

  return (
    <motion.div
      className="p-6 md:p-10"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={fadeTransition}
    >
      {/* Step Header */}
      <div className="mb-8">
        <div className="text-sm font-semibold text-danger-ink mb-2">{formatOnboardingStepLabel(5, true)}</div>
        <h2 className="text-3xl font-bold text-ink mb-2">Want to invite your team?</h2>
        <p className="text-muted-foreground">
          Team members can help manage access requests. You can also do this later from Settings.
        </p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Add Team Member Input */}
        <div className="bg-paper border-2 border-dashed border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-danger-ink" />
            <h3 className="font-semibold text-ink">Add team member</h3>
          </div>

          <div className="space-y-4">
            {/* Email Input */}
            <OpinionatedInput
              label="Email Address"
              value={newEmail}
              onChange={setNewEmail}
              placeholder="colleague@agency.com"
              type="email"
              helperText="We'll send an invite to this email"
              validationMessage="Please enter a valid email address"
              isValid={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)}
            />

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Role
              </label>
              <div className="grid grid-cols-3 gap-3">
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => setNewRole(role.value)}
                    className={`
                      p-3 rounded-lg border-2 text-left transition-all
                      ${newRole === role.value
                        ? 'border-coral bg-coral/10'
                        : 'border-border hover:border-border bg-card'
                      }
                    `}
                  >
                    <div className="font-semibold text-ink text-sm">{role.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{role.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Add Button */}
            <button
              type="button"
              onClick={handleAddInvite}
              disabled={!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)}
              className="w-full px-4 py-3 bg-coral hover:bg-coral/90 disabled:bg-muted/30 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Team Member
            </button>
          </div>
        </div>

        {/* Invites List */}
        {teamInvites.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-ink">
              {teamInvites.length} team member{teamInvites.length > 1 ? 's' : ''} to invite
            </h3>
            {teamInvites.map((invite) => (
              <motion.div
                key={invite.email}
                className="flex items-center justify-between p-4 bg-card border-2 border-border rounded-lg"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-coral/15 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-danger-ink" />
                  </div>
                  <div>
                    <div className="font-medium text-ink">{invite.email}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <span>Role:</span>
                      <SingleSelect
                        options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
                        value={invite.role}
                        onChange={(v) => handleUpdateRole(invite.email, v as AgencyRole)}
                        placeholder="Role"
                        ariaLabel={`Role for ${invite.email}`}
                        triggerClassName="ml-1 px-2 py-0.5 rounded border border-border text-foreground text-xs min-h-auto"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveInvite(invite.email)}
                  className="p-2 text-muted-foreground hover:text-danger-ink hover:bg-coral/10 rounded-lg transition-all"
                  aria-label="Remove invite"
                >
                  <X className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Reassurance */}
        <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-warning mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1 text-sm text-ink">
              <span className="font-semibold">No pressure!</span>{' '}
              You can invite team members anytime from Settings. This step is completely optional.
            </div>
          </div>
        </div>

        {/* What's Next Tease */}
        {teamInvites.length === 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Click "Continue" to finish onboarding and go to your dashboard
          </div>
        )}
      </div>
    </motion.div>
  );
}
