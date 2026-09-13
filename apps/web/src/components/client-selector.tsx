/**
 * ClientSelector Component
 *
 * Phase 5: Searchable client selector with inline client creation.
 * Part of Enhanced Access Request Creation.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { Client } from '@agency-platform/shared';
import { useAuthOrBypass } from '@/lib/dev-auth';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { extractMessageFromBody } from '@/lib/api/extract-error';
import { Button } from '@/components/ui/button';

interface ClientSelectorProps {
  agencyId: string;
  onSelect: (client: Client) => void;
  value?: string;
}

interface PaginatedClientsResponse {
  data: Client[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export function ClientSelector({ onSelect, value }: ClientSelectorProps) {
  const clerkAuth = useAuth();
  const { getToken } = clerkAuth;
  const auth = useAuthOrBypass(clerkAuth);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');

  // New client form state
  const [newClient, setNewClient] = useState({
    name: '',
    company: '',
    email: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const loadClients = useCallback(async (query: string, signal: AbortSignal) => {
    setLoading(true);
    setLoadError(null);

    try {
      const token = await getToken();
      if (!token && !auth.isDevelopmentBypass) throw new Error('No auth token');
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      params.set('limit', '50');

      const response = await fetch(
        `${getApiBaseUrl()}/api/clients?${params.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load clients');
      }

      const json = await response.json();
      if (signal.aborted) return;
      const result = Array.isArray(json?.data) ? json : json?.data ?? json;
      setClients(Array.isArray(result) ? result : (result as PaginatedClientsResponse).data || []);
    } catch (err) {
      if (signal.aborted) return;
      setLoadError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [auth.isDevelopmentBypass, getToken]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadClients(searchQuery, controller.signal);
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadClients, searchQuery]);

  const refreshClients = () => {
    const controller = new AbortController();
    void loadClients(searchQuery, controller.signal);
  };

  const handleSelectClient = (client: Client) => {
    onSelect(client);
  };

  const handleCreateClient = async () => {
    setFormErrors({});
    setCreateError(null);

    // Validate
    const errors: Record<string, string> = {};
    if (!newClient.name.trim()) errors.name = 'Name is required';
    if (!newClient.company.trim()) errors.company = 'Company is required';
    if (!newClient.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClient.email)) errors.email = 'Invalid email format';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setCreating(true);

    try {
      const token = await getToken();
      if (!token && !auth.isDevelopmentBypass) throw new Error('No auth token');
      const response = await fetch(`${getApiBaseUrl()}/api/clients`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...newClient, language: 'en' }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errorCode = data.errorCode || data.error?.code;
        if (errorCode === 'CLIENT_EMAIL_EXISTS' || errorCode === 'EMAIL_EXISTS') {
          errors.email = 'A client with this email already exists';
          setFormErrors(errors);
          return;
        }
        const msg = extractMessageFromBody(data, response.statusText || 'Failed to create client');
        throw new Error(msg);
      }

      const json = await response.json();
      // Handle both formats: { data: client } and direct client object
      const createdClient: Client = 'data' in json ? json.data : json;
      setActiveTab('existing'); // Switch back to existing tab
      setNewClient({ name: '', company: '', email: '' });
      onSelect(createdClient);
      refreshClients(); // Refresh client list
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setCreating(false);
    }
  };

  const handleCancelNewClient = () => {
    setActiveTab('existing');
    setNewClient({ name: '', company: '', email: '' });
    setFormErrors({});
    setCreateError(null);
  };

  return (
    <div className="overflow-hidden border border-border">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('existing')}
          className={`flex-1 px-5 py-3.5 text-base font-medium transition-colors border-b-2 ${
            activeTab === 'existing'
              ? 'text-danger-ink border-coral bg-coral/10'
              : 'text-muted-foreground border-transparent hover:text-ink hover:bg-muted/20'
          }`}
        >
          Existing Clients
        </button>
        <button
          type="button"
          aria-label="Add new client"
          onClick={() => setActiveTab('new')}
          className={`flex-1 px-5 py-3.5 text-base font-medium transition-colors border-b-2 ${
            activeTab === 'new'
              ? 'text-danger-ink border-coral bg-coral/10'
              : 'text-muted-foreground border-transparent hover:text-ink hover:bg-muted/20'
          }`}
        >
          Create New
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {activeTab === 'existing' ? (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
              placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search clients"
                className="w-full rounded-none border border-border py-2.5 pl-11 pr-4 text-base focus:border-coral focus:outline-none focus-visible:outline-[3px] focus-visible:outline-coral/25 focus-visible:[box-shadow:0_0_0_6px_rgb(var(--primary)/0.08)]"
              />
            </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-10" role="status" aria-live="polite">
              <Loader2 className="h-6 w-6 animate-spin text-danger-ink mr-2" />
              <span className="text-muted-foreground text-base">Loading clients...</span>
            </div>
          )}

          {/* Error State */}
          {loadError && !loading && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertCircle className="h-9 w-9 text-danger-ink" />
              <p className="text-muted-foreground text-base">Failed to load clients</p>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={refreshClients}
                className="text-danger-ink"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !loadError && (clients?.length ?? 0) === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-muted-foreground text-base">No clients found</p>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Add your first client to get started'}
              </p>
            </div>
          )}

          {/* Client List */}
          {!loading && !loadError && (clients?.length ?? 0) > 0 && (
            <div className="space-y-2" role="listbox" aria-label="Clients">
              {clients?.map((client) => {
                const isSelected = value === client.id;
                return (
                  <button
                    key={client.id}
                    type="button"
                    role="button"
                    onClick={() => handleSelectClient(client)}
                    className={`w-full text-left px-4 py-3.5 border rounded-none transition-colors flex items-center gap-3 ${
                      isSelected
                        ? 'border-coral bg-coral/10'
                        : 'border-border hover:border-border hover:bg-muted/20'
                    }`}
                    aria-selected={isSelected}
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-ink text-base">{client.name}</p>
                      <p className="text-sm text-muted-foreground">{client.company}</p>
                      <p className="text-xs text-muted-foreground mt-1">{client.email}</p>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-danger-ink" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          </div>
        ) : (
          /* New Client Form */
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">Create new client</h3>
              <button
                type="button"
                onClick={handleCancelNewClient}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>

            {/* Error */}
            {createError && (
              <div className="flex items-start gap-3 border border-coral/30 bg-coral/10 p-4">
                <AlertCircle className="h-5 w-5 text-danger-ink flex-shrink-0 mt-0.5" />
                <p className="text-base text-danger-ink">{createError}</p>
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="client-name" className="block text-sm font-medium text-foreground mb-1.5">
                Client Name <span className="text-danger-ink">*</span>
              </label>
              <input
                type="text"
                id="client-name"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateClient()}
                className={`w-full rounded-none border px-4 py-2.5 text-base focus:border-coral focus:outline-none focus-visible:outline-[3px] focus-visible:outline-coral/25 focus-visible:[box-shadow:0_0_0_6px_rgb(var(--primary)/0.08)] ${
                  formErrors.name ? 'border-coral/50' : 'border-border'
                }`}
                aria-invalid={!!formErrors.name}
                aria-describedby={formErrors.name ? 'name-error' : undefined}
              />
              {formErrors.name && (
                <p id="name-error" className="mt-1.5 text-sm text-danger-ink">
                  {formErrors.name}
                </p>
              )}
            </div>

            {/* Company */}
            <div>
              <label htmlFor="client-company" className="block text-sm font-medium text-foreground mb-1.5">
                Company <span className="text-danger-ink">*</span>
              </label>
              <input
                type="text"
                id="client-company"
                value={newClient.company}
                onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateClient()}
                className={`w-full rounded-none border px-4 py-2.5 text-base focus:border-coral focus:outline-none focus-visible:outline-[3px] focus-visible:outline-coral/25 focus-visible:[box-shadow:0_0_0_6px_rgb(var(--primary)/0.08)] ${
                  formErrors.company ? 'border-coral/50' : 'border-border'
                }`}
                aria-invalid={!!formErrors.company}
                aria-describedby={formErrors.company ? 'company-error' : undefined}
              />
              {formErrors.company && (
                <p id="company-error" className="mt-1.5 text-sm text-danger-ink">
                  {formErrors.company}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="client-email" className="block text-sm font-medium text-foreground mb-1.5">
                Email <span className="text-danger-ink">*</span>
              </label>
              <input
                type="email"
                id="client-email"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateClient()}
                className={`w-full rounded-none border px-4 py-2.5 text-base focus:border-coral focus:outline-none focus-visible:outline-[3px] focus-visible:outline-coral/25 focus-visible:[box-shadow:0_0_0_6px_rgb(var(--primary)/0.08)] ${
                  formErrors.email ? 'border-coral/50' : 'border-border'
                }`}
                aria-invalid={!!formErrors.email}
                aria-describedby={formErrors.email ? 'email-error' : undefined}
              />
              {formErrors.email && (
                <p id="email-error" className="mt-1.5 text-sm text-danger-ink">
                  {formErrors.email}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleCreateClient}
                isLoading={creating}
              >
                Create Client
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
