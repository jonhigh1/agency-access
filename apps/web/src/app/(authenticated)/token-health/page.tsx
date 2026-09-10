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

import { useState, useEffect, useCallback } from 'react';
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
import { StatCard, HealthBadge, ExpirationCountdown, PlatformIcon, StatusBadge, formatRelativeTime } from '@/components/ui';
import type { Platform, HealthStatus } from '@agency-platform/shared';
import { resolveApiUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';

type TokenHealth = {
  id: string;
  connectionId: string;
  clientName: string;
  platform: Platform;
  health: HealthStatus;
  // Authorization status: 'active' | 'expired' | 'invalid' | 'revoked'.
  // Refresh is a property of the authorization, not of the token countdown.
  status: string;
  // Null for tokens that never expire (non_expiring platforms).
  expiresAt: Date | null;
  daysUntilExpiry: number;
  lastRefreshedAt: Date | null;
  canRefresh: boolean;
};

type HealthFilter = 'all' | 'healthy' | 'expiring' | 'expired';

export default function TokenHealthPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [tokens, setTokens] = useState<TokenHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HealthFilter>('all');
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());

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
            <h1 className="text-2xl font-semibold text-slate-900">Token Health</h1>
            <p className="text-sm text-slate-600 mt-1">
              Monitor and manage client connection tokens
            </p>
          </div>
          <button
            onClick={fetchTokenHealth}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
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
          <div className="relative">
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-background transition-colors">
              <Filter className="h-4 w-4" />
              <span>
                {filter === 'all'
                  ? 'All Tokens'
                  : filter === 'healthy'
                    ? 'Healthy'
                    : filter === 'expiring'
                      ? 'Expiring Soon'
                      : 'Expired'}
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {/* Dropdown Menu */}
            <div className="absolute top-full left-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-sm overflow-hidden z-10">
              {[
                { value: 'all', label: 'All Tokens' },
                { value: 'healthy', label: 'Healthy' },
                { value: 'expiring', label: 'Expiring Soon' },
                { value: 'expired', label: 'Expired' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value as HealthFilter)}
                  className={`w-full text-left px-4 py-2 hover:bg-background transition-colors ${
                    filter === f.value ? 'bg-slate-100 font-medium' : ''
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Refresh All Expiring */}
          {stats.expiring > 0 && (
            <button
              onClick={handleRefreshAll}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh All Expiring
            </button>
          )}
        </div>

        {/* Token List */}
        {loading ? (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-12 text-center">
            <div className="inline-flex items-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
              <span className="text-slate-600">Loading token health...</span>
            </div>
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-12 text-center">
            <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {filter === 'all'
                ? 'No connections yet'
                : `No ${filter} tokens`}
            </h3>
            <p className="text-slate-600 max-w-sm mx-auto">
              {filter === 'all'
                ? 'Tokens will appear here after clients authorize access.'
                : `No tokens matching the ${filter} filter.`}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-background border-b border-border text-sm font-medium text-slate-700">
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
                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-background transition-colors"
                  >
                    {/* Client & Platform */}
                    <div className="col-span-3">
                      <div className="font-medium text-slate-900">{token.clientName}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <PlatformIcon platform={token.platform} size="sm" showLabel />
                      </div>
                    </div>

                    {/* Status */}
                    <div className="col-span-3">
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
                    <div className="col-span-3">
                      <ExpirationCountdown
                        daysUntilExpiry={token.daysUntilExpiry}
                        expiresAt={token.expiresAt}
                      />
                    </div>

                    {/* Last Refreshed */}
                    <div className="col-span-2">
                      {token.lastRefreshedAt ? (
                        <span className="text-sm text-slate-600">
                          {formatRelativeTime(token.lastRefreshedAt)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">Never</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-1">
                      {isRowActive ? (
                        <button
                          onClick={() => handleRefresh(token.id, token.platform)}
                          aria-label={`Refresh ${token.platform} token`}
                          disabled={isRefreshing || !canRefreshRow}
                          className={`p-2 rounded-lg transition-colors ${
                            isRefreshing
                              ? 'opacity-50 cursor-not-allowed'
                              : canRefreshRow
                                ? 'text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50'
                                : 'text-slate-300 cursor-not-allowed'
                          }`}
                        >
                          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                      ) : (
                        <Link
                          href="/clients"
                          className="text-xs font-medium text-danger-ink hover:underline"
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
