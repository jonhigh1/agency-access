'use client';

import { Platform, PLATFORM_NAMES } from '@agency-platform/shared';
import { cn } from '@/lib/utils';
import { isManualInvitePlatform } from '@/lib/client-invite-platforms';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import type { StatusType } from '@/components/ui/status-badge';
import { Loader2, Unlink, Edit } from 'lucide-react';

interface PlatformCardProps {
  platform: Platform;
  connected: boolean;
  connectedEmail?: string;
  status?: string;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
  variant?: 'default' | 'featured' | 'other';
  onConnect: (platform: Platform) => void;
  onDisconnect?: (platform: Platform) => void;
  onManageAssets?: (platform: Platform) => void;
  onEditEmail?: (platform: Platform, currentEmail: string) => void;
}

function mapStatusToBadge(status: string): StatusType {
  const s = status?.toLowerCase();
  if (s === 'expired' || s === 'invalid' || s === 'revoked') return s as StatusType;
  if (s === 'expiring') return 'expiring';
  return 'unknown';
}

export function PlatformCard({
  platform,
  connected,
  connectedEmail,
  status,
  isConnecting = false,
  isDisconnecting = false,
  variant = 'default',
  onConnect,
  onDisconnect,
  onManageAssets,
  onEditEmail,
}: PlatformCardProps) {
  const platformName = PLATFORM_NAMES[platform];
  const isManualPlatform = isManualInvitePlatform(platform);
  const isShopify = platform === 'shopify';

  const isFeatured = variant === 'featured';
  const isOther = variant === 'other';
  const iconSize = isFeatured ? 'lg' : isOther ? 'lg' : 'md';
  const textClass = isFeatured ? 'text-lg' : isOther ? 'text-lg' : 'text-base';

  const cardBaseClasses = cn(
    'bg-card border border-black/10 rounded-none h-full',
    'px-4 py-5 md:px-5 md:py-6',
    isFeatured && 'border-coral/30 bg-gradient-to-b from-coral/5 to-card'
  );

  return (
    <div className={cardBaseClasses}>
      <div className="flex h-full min-h-[176px] flex-col">
        {/* Platform Icon and Name */}
        <div className={cn('flex flex-col items-center gap-2.5', 'mb-4')}>
          <PlatformIcon platform={platform} size={iconSize as 'sm' | 'md' | 'lg' | 'xl'} />
          <h3 className={`${textClass} font-semibold text-ink text-center`}>
            {platformName}
          </h3>
        </div>

        {/* Connection Status or Action */}
        <div className="mt-auto flex flex-col items-center gap-2.5">
          {connected ? (
            <>
              {/* Connected state - show email */}
              <div className="text-center w-full">
                <p className="text-sm text-muted-foreground truncate px-2" title={connectedEmail}>
                  {connectedEmail || 'Connected'}
                </p>
                {status && status !== 'active' && (
                  <div className="mt-2">
                    <StatusBadge status={mapStatusToBadge(status)} size="sm" />
                  </div>
                )}
              </div>

              {/* Action buttons - use Button for design system alignment and touch targets */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-1 w-full">
                {onManageAssets && (platform === 'meta' || platform === 'google') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onManageAssets(platform)}
                    className="text-danger-ink hover:text-danger-ink hover:bg-coral/5"
                  >
                    Manage Assets
                  </Button>
                )}

                {onEditEmail && isManualPlatform && !isShopify && connectedEmail && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditEmail(platform, connectedEmail)}
                    leftIcon={<Edit className="h-3.5 w-3.5" />}
                  >
                    Edit Email
                  </Button>
                )}

                {onDisconnect && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDisconnect(platform)}
                    disabled={isDisconnecting}
                    leftIcon={
                      isDisconnecting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unlink className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Not connected - show Connect button */}
              <Button
                variant="primary"
                size="sm"
                isLoading={isConnecting}
                onClick={() => onConnect(platform)}
                disabled={isConnecting}
                className="w-full"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
