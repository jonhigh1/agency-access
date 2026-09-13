'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useUser } from '@clerk/nextjs';
import { Loader2, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { SingleSelect } from '@/components/ui/single-select';
import { Button } from '@/components/ui/button';
import { finalizeMetaBusinessLogin, launchMetaBusinessLogin } from '@/lib/meta-business-login';
import { resolveApiUrl } from '@/lib/api/api-env';

interface Business {
  id: string;
  name: string;
}

interface MetaBusinessPortfolioSelectorProps {
  agencyId: string;
  onSelect: (businessId: string, businessName: string) => void;
  isSaving?: boolean;
  selectedBusinessId?: string;
}

export function MetaBusinessPortfolioSelector({
  agencyId,
  onSelect,
  isSaving = false,
  selectedBusinessId,
}: MetaBusinessPortfolioSelectorProps) {
  const [selectedId, setSelectedId] = useState<string>(selectedBusinessId || '');
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const { getToken } = useAuth();
  const { user } = useUser();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['meta-businesses', agencyId],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch(
        resolveApiUrl(`/agency-platforms/meta/business-accounts?agencyId=${agencyId}&refresh=true`),
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch businesses');
      const result = await response.json();
      return result.data as { businesses: Business[] };
    },
  });

  const businesses = data?.businesses || [];

  // Update selectedId when selectedBusinessId prop changes or when businesses load
  useEffect(() => {
    if (selectedBusinessId && businesses.length > 0) {
      // Verify the selectedBusinessId exists in the businesses list
      const exists = businesses.some(b => b.id === selectedBusinessId);
      if (exists) {
        setSelectedId(selectedBusinessId);
      }
    } else if (selectedBusinessId && !selectedId) {
      // Set it even if businesses haven't loaded yet
      setSelectedId(selectedBusinessId);
    }
  }, [selectedBusinessId, businesses, selectedId]);

  const handleReauthenticate = async () => {
    const userEmail =
      user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
    if (!userEmail) {
      setReauthError('Unable to resolve your account email.');
      return;
    }

    setReauthError(null);
    setIsReauthenticating(true);

    try {
      const authPayload = await launchMetaBusinessLogin({
        appId: process.env.NEXT_PUBLIC_META_APP_ID || '',
        configId: process.env.NEXT_PUBLIC_META_LOGIN_FOR_BUSINESS_CONFIG_ID || '',
      });

      await finalizeMetaBusinessLogin({
        agencyId,
        userEmail,
        getToken,
        authPayload,
      });

      await refetch();
    } catch (err) {
      setReauthError(
        err instanceof Error ? err.message : 'Failed to refresh Meta Business Portfolios.'
      );
    } finally {
      setIsReauthenticating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-400" />
        <p className="text-slate-600 font-medium">Checking for Meta Business accounts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-lg border border-red-100">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
        <p className="text-red-900 font-semibold mb-1">Failed to load portfolios</p>
        <p className="text-red-700 text-sm mb-4">Please try refreshing the page or connecting again.</p>
        <Button onClick={() => refetch()} variant="ghost" size="sm" className="text-danger-ink">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="p-10 text-center bg-slate-50 rounded-lg border border-slate-200 border-dashed">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-slate-900 font-bold mb-2">No Meta Business portfolios found</h3>
        <p className="text-slate-600 text-sm max-w-xs mx-auto mb-6">
          Don't see your Business Portfolio? To refresh this list{' '}
          <button 
            onClick={() => void handleReauthenticate()}
            className="text-indigo-600 font-semibold hover:underline px-1"
            disabled={isReauthenticating}
          >
            {isReauthenticating ? 'logging in again…' : 'log in again'}
          </button>
        </p>
        {reauthError && <p className="text-sm text-red-700">{reauthError}</p>}
      </div>
    );
  }

  const handleConnect = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!selectedId) {
      return;
    }
    const business = businesses.find(b => b.id === selectedId);
    if (business) {
      onSelect(business.id, business.name);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-slate-900">Select Business Portfolio</h3>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-full">
              Required
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Choose the Meta Business Portfolio you want to use for this connection. This is required to manage client assets.
          </p>
          <p className="text-xs text-slate-400 mt-2 italic">
            Don't worry, you can always change this selection later in your Meta connection settings.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
              Business Portfolio
            </label>
            <SingleSelect
              options={businesses.map((b) => ({
                value: b.id,
                label: `${b.name} (${b.id})`,
              }))}
              value={selectedId}
              onChange={(id: string) => setSelectedId(id)}
              placeholder="Select a portfolio..."
              ariaLabel="Business Portfolio"
            />
          </div>

          <div className="pt-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Don't see your portfolio?{' '}
              <button
                onClick={() => void handleReauthenticate()}
                className="text-indigo-600 font-medium hover:underline"
                disabled={isReauthenticating}
              >
                {isReauthenticating ? 'Logging in again…' : 'Log in again'}
              </button>
            </p>
            <Button
              onClick={handleConnect}
              disabled={!selectedId || isSaving}
              type="button"
              variant="primary"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Connect Portfolio
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
          {reauthError && (
            <p className="text-xs text-red-700 pt-2">{reauthError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
