/**
 * Client Selection Screen (Screen 2A)
 *
 * Step 2 of the unified onboarding flow.
 * Purpose: Create the first access request - this is the CORE aha moment.
 *
 * Key Elements:
 * - Simple client selection (typeahead with existing clients)
 * - Pre-selected platforms shown as "most popular"
 * - Clear "why this matters" microcopy
 * - Continue button requires valid client
 *
 * Design Principles:
 * - Interactive: Users CREATE something valuable immediately
 * - Fast: Can complete in 20-30 seconds
 * - Clear: Users know exactly what they're creating
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Client } from '@agency-platform/shared';
import { OpinionatedInput } from '../opinionated-input';
import { fadeVariants, fadeTransition } from '@/lib/animations';
import { formatOnboardingStepLabel } from '@/lib/onboarding-steps';

// ============================================================
// TYPES
// ============================================================

interface ClientSelectionScreenProps {
  clientName: string;
  clientEmail: string;
  websiteUrl: string;
  existingClients: Client[];
  loading: boolean;
  onUpdate: (data: { id?: string; name: string; email: string }) => void;
  onWebsiteUrlChange: (website: string) => void;
  onLoadClients?: () => Promise<void>;
  onDefer?: () => Promise<void> | void;
}

type ClientSelectionMode = 'existing' | 'new';

// ============================================================
// COMPONENT
// ============================================================

export function ClientSelectionScreen({
  clientName,
  clientEmail,
  websiteUrl,
  existingClients,
  loading,
  onUpdate,
  onWebsiteUrlChange,
  onLoadClients,
  onDefer,
}: ClientSelectionScreenProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [mode, setMode] = useState<ClientSelectionMode>(
    existingClients.length > 0 ? 'existing' : 'new'
  );
  const [hasUserSelectedMode, setHasUserSelectedMode] = useState(false);

  // Auto-select the best mode only before the user has interacted.
  useEffect(() => {
    if (!hasUserSelectedMode) {
      setMode(existingClients.length > 0 ? 'existing' : 'new');
    }
  }, [existingClients.length, hasUserSelectedMode]);

  useEffect(() => {
    void onLoadClients?.();
  }, [onLoadClients]);

  // Get client suggestions for typeahead
  const clientSuggestions = existingClients.map((c) => c.name);

  // Handle selecting an existing client
  const handleSelectClient = useCallback(
    (client: Client) => {
      setSelectedClientId(client.id);
      setHasUserSelectedMode(true);
      setMode('existing');
      onUpdate({
        id: client.id,
        name: client.name,
        email: client.email,
      });
    },
    [onUpdate]
  );

  // Handle creating a new client
  const handleCreateNew = useCallback(() => {
    setSelectedClientId(null);
    setHasUserSelectedMode(true);
    setMode('new');
  }, []);

  const handleSwitchToExisting = useCallback(() => {
    setHasUserSelectedMode(true);
    setMode('existing');
  }, []);

  const handleClientNameChange = useCallback((name: string) => {
    setHasUserSelectedMode(true);
    setMode('new');
    onUpdate({ name, email: clientEmail });
  }, [clientEmail, onUpdate]);

  const handleClientEmailChange = useCallback((email: string) => {
    setHasUserSelectedMode(true);
    setMode('new');
    onUpdate({ name: clientName, email });
  }, [clientName, onUpdate]);

  const handleWebsiteChange = useCallback((website: string) => {
    onWebsiteUrlChange(website);
  }, [onWebsiteUrlChange]);

  // Filter existing clients by search
  const [searchQuery, setSearchQuery] = useState('');
  const filteredClients = existingClients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
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
        <div className="text-sm font-semibold text-danger-ink mb-2">{formatOnboardingStepLabel(2)}</div>
        <h2 className="text-3xl font-bold text-ink mb-2">Create your first access request</h2>
        <p className="text-muted-foreground">
          Add a client and we'll generate a branded link they can authorize.
        </p>
      </div>

      <div className="space-y-6 max-w-4xl">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading existing clients...</p>
        )}

        {/* Existing Clients Section */}
        {existingClients.length > 0 && mode === 'existing' && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-foreground">
              Select an existing client
            </label>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clients..."
                className="w-full px-4 py-3 rounded-lg border-2 border-border focus:outline-none focus:border-coral focus:ring-2 focus:ring-coral/30"
              />
            </div>

            {/* Client List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredClients.map((client) => (
                <motion.button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelectClient(client)}
                  className={`
                    w-full p-4 rounded-lg border-2 text-left transition-all
                    ${selectedClientId === client.id
                      ? 'border-coral bg-coral/10'
                      : 'border-border hover:border-border bg-card'
                    }
                  `}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-ink">{client.name}</div>
                      <div className="text-sm text-muted-foreground">{client.email}</div>
                    </div>
                    {selectedClientId === client.id && (
                      <svg className="w-5 h-5 text-danger-ink" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Create New Button */}
            <button
              type="button"
              onClick={handleCreateNew}
              className="text-sm text-danger-ink hover:text-danger-ink font-medium"
            >
              + Create a new client instead
            </button>
          </div>
        )}

        {/* Create New Client Form */}
        {(existingClients.length === 0 || mode === 'new') && (
          <div className="space-y-4">
            {existingClients.length > 0 && (
              <button
                type="button"
                onClick={handleSwitchToExisting}
                className="text-sm text-danger-ink hover:text-danger-ink font-medium"
              >
                ← Back to client list
              </button>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <OpinionatedInput
                label="Client Name"
                value={clientName}
                onChange={handleClientNameChange}
                placeholder="e.g., Acme Corp"
                type="text"
                required
                helperText="Required: use the real client or company name"
                validationMessage="Please enter the real client name (at least 2 characters)"
                isValid={clientName.trim().length >= 2}
                suggestions={clientSuggestions}
              />

              <OpinionatedInput
                label="Client Email"
                value={clientEmail}
                onChange={handleClientEmailChange}
                placeholder="client@acmecorp.com"
                type="email"
                required
                helperText="Required: use the real email that should receive or own this request"
                validationMessage="Please enter a valid email address"
                isValid={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())}
              />
            </div>
          </div>
        )}

        <div className="max-w-md">
          <OpinionatedInput
            label="Website URL"
            value={websiteUrl}
            onChange={handleWebsiteChange}
            placeholder="https://youragency.com"
            type="url"
            helperText="Optional: this maps to Company Website in Settings"
            validationMessage="Please enter a valid URL (including https://)"
            isValid={websiteUrl.trim().length === 0 || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(websiteUrl.trim())}
          />
        </div>

        {/* Insight Box */}
        <div className="p-4 bg-teal/10 border border-teal/30 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="flex-1 text-sm text-ink">
              <span className="font-semibold">Why this matters:</span>{' '}
              After you create this access request, you'll get a unique link that your client can use to authorize all their platforms in one go. No more back-and-forth emails!
            </div>
          </div>
        </div>

        {onDefer && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => void onDefer()}
              className="text-sm font-medium text-danger-ink hover:text-danger-ink"
            >
              No client yet
            </button>
          </div>
        )}

        {/* Next Step Teaser */}
        <div className="border-t border-border pt-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">Next: Choose Platforms</h3>
          <p className="text-sm text-muted-foreground">
            We'll select which platforms this client needs to authorize. Google Ads and Meta Ads are pre-selected (most agencies start with these).
          </p>
        </div>
      </div>
    </motion.div>
  );
}
