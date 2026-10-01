/**
 * Token Health Dashboard
 *
 * Shows connection status and token health for all client platforms.
 * Features real-time status indicators, expiration countdowns, and manual refresh.
 *
 * Aesthetic: Data-focused dashboard with clear visual hierarchy.
 * Status badges use color for immediate recognition.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import {
  RefreshCw,
  Clock,
  Filter,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { StatCard, HealthBadge, ExpirationCountdown, PlatformIcon, StatusBadge, formatRelativeTime, Button } from '@/components/ui';
import type { Platform, HealthStatus, AuthorizationStatus } from '@agency-platform/shared';
import { resolveApiUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';

type TokenHealth = {
  id: string;
  connectionId: string;
  clientName: string;
  platform: Platform;
  health: HealthStatus;
  // Refresh is a property of the authorization, not of the token countdown.
  status: AuthorizationStatus;
  // Null for tokens that never expire (non_expiring platforms).
  expiresAt: Date | null;
  daysUntilExpiry: number;
  lastRefreshedAt: Date | null;
  canRefresh: boolean;
};

type HealthFilter = 'all' | 'healthy' | 'expiring' | 'expired';

const HEALTH_FILTER_OPTIONS: { value: HealthFilter; label: string }[] = [
  { value: 'all', label: 'All Tokens' },
  { value: 'healthy', label: 'Healthy' },
  { value: 'expiring', label: 'Expiring Soon' },
  { value: 'expired', label: 'Expired' },
];

function healthFilterLabel(filter: HealthFilter): string {
  switch (filter) {
    case 'all':
      return 'All Tokens';
    case 'healthy':
      return 'Healthy';
    case 'expiring':
      return 'Expiring Soon';
    case 'expired':
      return 'Expired';
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}

export default function TokenHealthPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [tokens, setTokens] = useState<TokenHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HealthFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const filterRef = useRef<HTMLDivElement>(null);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const fetchTokenHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(resolveApiUrl('/api/token-health'), {
        headers: await getAuthHeaders(),
      });
      // Missing-token degradation is deliberate: getAuthHeaders may send no Authorization header.
      const result = await parseJsonResponse<{ data?: TokenHealth[] }>(res, {
        fallbackErrorMessage: 'Failed to fetch token health',
      });
      if (result.data) {
        // JSON dates arrive as strings; coerce once at the boundary so the
        // Date-typed fields below are real Date objects for every consumer.
        // A null expiresAt must stay null — new Date(null) is the epoch, which
        // would render a never-expiring token as long expired.
        setTokens(
          result.data.map((t) => ({
            ...t,
            expiresAt: t.expiresAt ? new Date(t.expiresAt) : null,
            lastRefreshedAt: t.lastRefreshedAt ? new Date(t.lastRefreshedAt) : null,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch token health:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch token health');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchTokenHealth();
    }
  }, [fetchTokenHealth, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!filterOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [filterOpen]);

  const handleRefresh = async (tokenId: string, platform: Platform, refetch = true) => {
    setRefreshing((prev) => new Set(prev).add(tokenId));
    try {
      const res = await fetch(resolveApiUrl('/api/token-refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ connectionId: tokens.find((t) => t.id === tokenId)?.connectionId, platform }),
      });

      const result = await parseJsonResponse<{ data?: unknown }>(res, {
        fallbackErrorMessage: 'Failed to refresh token',
      });
      if (result.data && refetch) {
        // Refresh the list
        await fetchTokenHealth();
      }
    } catch (err) {
      console.error('Failed to refresh token:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh token');
    } finally {
      setRefreshing((prev) => {
        const next = new Set(prev);
        next.delete(tokenId);
        return next;
      });
    }
  };

  const handleRefreshAll = async () => {
    const expiringTokens = tokens.filter((t) => t.health === 'expiring' && t.canRefresh);
    await Promise.all(expiringTokens.map((token) => handleRefresh(token.id, token.platform, false)));
    await fetchTokenHealth();
  };

  const filteredTokens = tokens.filter((token) => {
    if (filter === 'all') return true;
    return token.health === filter;
  });

  const filterLabel = healthFilterLabel(filter);

  const stats = {
    total: tokens.length,
    healthy: tokens.filter((t) => t.health === 'healthy').length,
    expiring: tokens.filter((t) => t.health === 'expiring').length,
    expired: tokens.filter((t) => t.health === 'expired').length,
  };

  return (
    <div className="flex-1 bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Token health</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor and manage client connection tokens
            </p>
          </div>
          <button
            onClick={fetchTokenHealth}
            aria-label="Refresh token health"
            className="p-2 text-muted-foreground hover:bg-muted/10 rounded-none transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-none border border-coral/30 bg-coral/10 p-4 text-sm text-danger-ink" role="alert">
            {error}
          </div>
        )}
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Connections"
            value={stats.total}
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            label="Healthy"
            value={stats.healthy}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            label="Expiring Soon"
            value={stats.expiring}
            icon={<AlertCircle className="h-5 w-5" />}
          />
          <StatCard
            label="Expired"
            value={stats.expired}
            icon={<XCircle className="h-5 w-5" />}
          />
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          {/* Filter Dropdown */}
          <div className="relative" ref={filterRef}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="px-4 py-2"
              aria-label={`Filter tokens: ${filterLabel}`}
              aria-haspopup="listbox"
              aria-expanded={filterOpen}
              aria-controls="token-health-filter-menu"
              onClick={() => setFilterOpen((open) => !open)}
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              <span>{filterLabel}</span>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>

            {filterOpen && (
              <div
                id="token-health-filter-menu"
                role="listbox"
                aria-label="Token health filters"
                className="absolute top-full left-0 mt-2 w-48 bg-card border border-border rounded-none overflow-hidden z-10"
              >
                {HEALTH_FILTER_OPTIONS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    role="option"
                    aria-selected={filter === f.value}
                    onClick={() => {
                      setFilter(f.value);
                      setFilterOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-none hover:bg-background transition-colors ${
                      filter === f.value ? 'bg-muted/30 font-medium' : ''
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh All Expiring */}
          {stats.expiring > 0 && (
            <Button variant="primary" size="sm" onClick={handleRefreshAll}>
              <RefreshCw className="h-4 w-4" />
              Refresh All Expiring
            </Button>
          )}
        </div>

        {/* Token List */}
        {loading ? (
          <div className="bg-card rounded-none border border-border p-12 text-center">
            <div className="inline-flex items-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Loading token health...</span>
            </div>
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="bg-card rounded-none border border-border p-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-ink mb-2">
              {filter === 'all'
                ? 'No connections yet'
                : `No ${filter} tokens`}
            </h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {filter === 'all'
                ? 'Tokens will appear here after clients authorize access.'
                : `No tokens matching the ${filter} filter.`}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-none border border-border overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-muted/10 border-b border-border text-sm font-medium text-ink">
              <div className="col-span-3">Client / Platform</div>
              <div className="col-span-3">Status</div>
              <div className="col-span-3">Expires In</div>
              <div className="col-span-2">Last Refreshed</div>
              <div className="col-span-1">Actions</div>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredTokens.map((token) => {
                const isRefreshing = refreshing.has(token.id);
                // Refresh is gated on the authorization, not the countdown: an
                // active row stays refreshable even when its stored expiry has
                // passed. A dead grant cannot be refreshed by retrying.
                const isRowActive = token.status === 'active';
                const canRefreshRow = isRowActive && token.canRefresh;

                return (
                  <div
                    key={token.id}
                    className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-12 md:gap-4 md:px-6 md:items-center"
                  >
                    {/* Client & Platform */}
                    <div className="md:col-span-3">
                      <span className="label-nano md:hidden">Client / Platform</span>
                      <div className="font-medium text-ink">{token.clientName}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <PlatformIcon platform={token.platform} size="sm" showLabel />
                      </div>
                    </div>

                    {/* Status */}
                    <div className="md:col-span-3">
                      <span className="label-nano md:hidden">Status</span>
                      <div className="flex flex-col items-start gap-1.5">
                        <HealthBadge health={token.health} />
                        {!isRowActive && (
                          <StatusBadge badgeVariant="danger" size="sm">
                            Reconnect Required
                          </StatusBadge>
                        )}
                      </div>
                    </div>

                    {/* Expires In */}
                    <div className="md:col-span-3">
                      <span className="label-nano md:hidden">Expires in</span>
                      <ExpirationCountdown
                        daysUntilExpiry={token.daysUntilExpiry}
                        expiresAt={token.expiresAt}
                      />
                    </div>

                    {/* Last Refreshed */}
                    <div className="md:col-span-2">
                      <span className="label-nano md:hidden">Last refreshed</span>
                      {token.lastRefreshedAt ? (
                        <span className="text-sm text-muted-foreground">
                          {formatRelativeTime(token.lastRefreshedAt)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="md:col-span-1">
                      <span className="label-nano md:hidden">Actions</span>
                      {isRowActive ? (
                        <button
                          onClick={() => handleRefresh(token.id, token.platform)}
                          aria-label={`Refresh ${token.platform} token`}
                          disabled={isRefreshing || !canRefreshRow}
                          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-none transition-colors ${
                            isRefreshing
                              ? 'opacity-50 cursor-not-allowed'
                              : canRefreshRow
                                ? 'text-ink hover:bg-muted/20'
                                : 'text-muted-foreground/50 cursor-not-allowed'
                          }`}
                        >
                          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                      ) : (
                        <Link
                          href="/clients"
                          className="text-xs font-medium text-ink hover:underline"
                        >
                          Re-request access
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
