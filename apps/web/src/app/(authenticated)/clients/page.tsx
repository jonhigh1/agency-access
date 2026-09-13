'use client';

/**
 * Clients Page
 *
 * List all client connections with their authorized platforms.
 * Shows connection status, platforms, and quick actions.
 */

import { useState, Suspense, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, AlertCircle, ExternalLink, Plus } from 'lucide-react';
import { LogoSpinner } from '@/components/ui/logo-spinner';
import Link from 'next/link';
import { StatusBadge, PlatformIcon, EmptyState, Button } from '@/components/ui';
import { CreateClientModal } from '@/components/client-detail/CreateClientModal';
import { UpgradeModal } from '@/components/upgrade-modal';
import { useQuotaCheck, QuotaExceededError } from '@/lib/query/quota';
import { resolveApiUrl } from '@/lib/api/api-env';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import type { Platform } from '@agency-platform/shared';
import type { StatusType } from '@/components/ui/status-badge';
import { useSearchParams } from 'next/navigation';

interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
  platforms: Platform[];
  status: 'active' | 'pending' | 'expired' | 'revoked' | 'none';
  connectionCount: number;
  lastActivityAt: string;
  createdAt: string;
}

// Map client status to StatusBadge StatusType
function mapClientStatusToStatusType(status: Client['status']): StatusType {
  if (status === 'none') {
    return 'unknown';
  }
  return status as StatusType;
}

function ClientsPageContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email');
  
  const [searchQuery, setSearchQuery] = useState(initialEmail || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialEmail || '');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [quotaError, setQuotaError] = useState<QuotaExceededError | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 250);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  // Quota check hook
  const checkQuota = useQuotaCheck();

  // Fetch clients with connection data
  const {
    data: clientsResponse,
    isLoading: isLoadingClients,
    error: fetchError,
  } = useQuery({
    queryKey: ['clients-with-connections', debouncedSearchQuery],
    queryFn: async () => {
      const url = new URL(resolveApiUrl('/api/clients'));
      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);

      return authorizedApiFetch(url.toString(), { getToken });
    },
    enabled: true,
  });

  const clients = clientsResponse?.data?.data || [];
  const pagination = clientsResponse?.data?.pagination || { total: 0 };

  const handleCreateClientClick = async () => {
    try {
      const result = await checkQuota.mutateAsync({ metric: 'clients' });
      if (!result.allowed) {
        setQuotaError(
          new QuotaExceededError({
            code: 'QUOTA_EXCEEDED',
            message: `You've reached your client limit`,
            metric: 'clients',
            limit: result.limit,
            used: result.used,
            remaining: result.remaining,
            upgradeUrl: result.upgradeUrl || '',
            currentTier: result.currentTier,
            suggestedTier: result.suggestedTier,
          })
        );
        setShowUpgradeModal(true);
        return;
      }
      setShowCreateModal(true);
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        setQuotaError(error);
        setShowUpgradeModal(true);
      } else {
        console.error('Failed to check quota:', error);
        setShowCreateModal(true);
      }
    }
  };

  if (isLoadingClients && !clients.length) {
    return (
      <div className="flex-1 bg-paper p-8">
        <div className="flex items-center justify-center py-12">
          <LogoSpinner size="md" />
          <span className="ml-2 text-muted-foreground">Loading clients...</span>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex-1 bg-paper p-8">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <p className="text-destructive font-medium">Failed to load clients. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-paper p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-semibold text-foreground leading-tight">
              Clients
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage client connections and platform authorizations
            </p>
          </div>
          <Button
            variant="brutalist"
            className="sm:px-8"
            onClick={handleCreateClientClick}
          >
            <Plus className="h-4 w-4" />
            Create Client
          </Button>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-8 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search clients by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring min-h-[44px]"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 border border-border rounded-none hover:bg-coral/10 transition-colors flex items-center gap-2 min-h-[44px] ${
              showFilters ? 'bg-coral/10' : 'bg-background'
            }`}
          >
            <Filter className="h-5 w-5" />
            Filters
          </button>
        </div>

        {/* Empty state */}
        {clients.length === 0 && !searchQuery && (
          <EmptyState
            title="No clients yet"
            description="Clients will appear here once they authorize their platforms through access requests."
            actionLabel="Create Client"
            onAction={handleCreateClientClick}
          />
        )}

        {/* No search results */}
        {clients.length === 0 && searchQuery && (
          <div className="text-center py-12 bg-card rounded-lg shadow-brutalist border border-black/10">
            <div className="inline-flex p-4 bg-muted rounded-full mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground mb-2 font-display">No clients found</p>
            <p className="text-muted-foreground">
              Try adjusting your search query
            </p>
          </div>
        )}

        {/* Clients Grid */}
        {clients.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client: Client) => (
              <div
                key={client.id}
                className="bg-card rounded-lg shadow-brutalist border border-black/10 p-6 hover:translate-y-[-1px] hover:shadow-brutalist transition-all duration-300"
              >
                {/* Client Info */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-sans font-semibold text-foreground truncate">
                      {client.name}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">{client.email}</p>
                    {client.company && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {client.company}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={mapClientStatusToStatusType(client.status)} />
                </div>

                {/* Platforms */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-foreground mb-2">
                    Connected Platforms ({client.platforms.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {client.platforms.length > 0 ? (
                      client.platforms.map((platform) => (
                        <PlatformIcon key={platform} platform={platform} size="sm" />
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        No platforms connected
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground mb-4">
                  <div className="flex justify-between">
                    <span className="font-medium text-muted">Total Requests:</span>
                    <span className="text-foreground">{client.connectionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-muted">Last Activity:</span>
                    <span className="text-foreground">
                      {new Date(client.lastActivityAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  asChild
                >
                  <Link href={`/clients/${client.id}` as any}>
                    View Details
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Client count */}
        {clients.length > 0 && (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            Showing {clients.length} of {pagination.total} clients
          </div>
        )}
      </div>

      {/* Create Client Modal */}
      {showCreateModal && (
        <CreateClientModal
          onClose={() => setShowCreateModal(false)}
        />
      )}

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
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 bg-paper p-8">
          <div className="flex items-center justify-center py-12">
            <LogoSpinner size="md" />
            <span className="ml-2 text-muted-foreground">Loading...</span>
          </div>
        </div>
      }
    >
      <ClientsPageContent />
    </Suspense>
  );
}
