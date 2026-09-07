/**
 * Agency Profile Screen (Screen 1)
 *
 * Step 1 of the unified onboarding flow.
 * Purpose: Set up agency with minimal friction.
 *
 * Key Elements:
 * - Only agency name is required (auto-filled from Clerk)
 * - Smart defaults for everything else (timezone, industry)
 * - "You can customize later" reassurance
 * - Continue button enabled immediately (minimal friction)
 *
 * Design Principles:
 * - Opinionated: Pre-fill everything we can
 * - Fast: Users can complete in 10-15 seconds
 * - Reassuring: Clear that customization comes later
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { OpinionatedInput } from '../opinionated-input';
import { SingleSelect } from '@/components/ui/single-select';
import { fadeVariants, fadeTransition } from '@/lib/animations';
import { formatOnboardingStepLabel } from '@/lib/onboarding-steps';

// ============================================================
// TYPES
// ============================================================

interface AgencyProfileScreenProps {
  agencyName: string;
  timezone: string;
  industry: string;
  onUpdate: (data: { name: string; timezone: string; industry: string }) => void;
}

// ============================================================
// CONSTANTS
// ============================================================

const COMMON_INDUSTRIES = [
  'Digital Marketing',
  'SEO Agency',
  'PPC Agency',
  'Social Media Marketing',
  'Content Marketing',
  'Full-Service Agency',
  'E-commerce Agency',
  'B2B Marketing',
  'Other',
];

// ============================================================
// COMPONENT
// ============================================================

export function AgencyProfileScreen({
  agencyName,
  timezone,
  industry,
  onUpdate,
}: AgencyProfileScreenProps) {
  const [localName, setLocalName] = useState(agencyName);
  const [localTimezone, setLocalTimezone] = useState(timezone);
  const [localIndustry, setLocalIndustry] = useState(industry);

  // Sync with parent state
  useEffect(() => {
    onUpdate({
      name: localName,
      timezone: localTimezone,
      industry: localIndustry,
    });
  }, [localName, localTimezone, localIndustry, onUpdate]);

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
        <div className="text-sm font-semibold text-danger-ink mb-2">{formatOnboardingStepLabel(1)}</div>
        <h2 className="text-3xl font-bold text-ink mb-2">Tell us about your agency</h2>
        <p className="text-muted-foreground">We'll get you set up in seconds.</p>
      </div>

      {/* Form */}
      <div className="space-y-6 max-w-4xl">
        {/* Agency Name */}
        <OpinionatedInput
          label="Agency Name"
          value={localName}
          onChange={setLocalName}
          placeholder="e.g., Acme Digital Marketing"
          type="text"
          required
          helperText="This is how your agency will appear to clients"
          validationMessage="Please enter your agency name (at least 2 characters)"
          isValid={localName.trim().length >= 2}
          autoFocus
        />

        {/* Timezone (Pre-detected) */}
        <div className="p-4 bg-teal/10 border border-teal/30 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-success-ink mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <div className="font-semibold text-ink mb-1">Timezone detected</div>
              <div className="text-sm text-success-ink">
                Your timezone is set to <span className="font-mono bg-card px-1.5 py-0.5 rounded">{localTimezone}</span>
              </div>
              <div className="text-xs text-success-ink mt-1">
                You can customize this in Settings later
              </div>
            </div>
          </div>
        </div>

        {/* Industry (Pre-selected with option to change) */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">
            Industry
          </label>
          <SingleSelect
            options={COMMON_INDUSTRIES.map((ind) => ({
              value: ind.toLowerCase().replace(/\s+/g, '_'),
              label: ind,
            }))}
            value={localIndustry}
            onChange={(v) => setLocalIndustry(v)}
            placeholder="Select industry"
            ariaLabel="Industry"
            triggerClassName="w-full px-4 py-3 rounded-lg border-2 border-border focus:border-coral focus:ring-2 focus:ring-coral/30"
          />
          <p className="mt-1.5 text-sm text-muted-foreground">
            Helps us provide relevant tips and templates
          </p>
        </div>

        {/* Reassurance */}
        <div className="p-4 bg-coral/10 border border-coral/30 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-danger-ink mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1 text-sm text-ink">
              <span className="font-semibold">Everything else is pre-configured.</span>{' '}
              You can customize your logo, branding, and more in Settings after onboarding.
            </div>
          </div>
        </div>

        {/* Example of what's pre-configured */}
        <div className="border-t border-border pt-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">We've set up for you:</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'Default Access Level', value: 'Standard (recommended)' },
              { label: 'Intake Form', value: 'Basic questions included' },
              { label: 'Branding', value: 'Professional default theme' },
              { label: 'Team Roles', value: 'Admin, Member, Viewer' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-success-ink flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <span className="font-medium text-foreground">{item.label}:</span>{' '}
                  <span className="text-muted-foreground">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
